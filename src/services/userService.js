import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { defaultResumeData } from '../data/defaultResume.js';
import { initializeUserResumes } from './resumeService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const backendRoot = path.resolve(__dirname, '../..');
const DATA_DIR = path.join(backendRoot, 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const USERS_DIR = path.join(DATA_DIR, 'users');

const JWT_SECRET = process.env.JWT_SECRET || 'cv_maker_secret_jwt_key_fallback_2026';

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(USERS_DIR)) {
  fs.mkdirSync(USERS_DIR, { recursive: true });
}

function readUsers() {
  if (!fs.existsSync(USERS_FILE)) {
    return [];
  }
  try {
    const raw = fs.readFileSync(USERS_FILE, 'utf-8');
    return JSON.parse(raw) || [];
  } catch (err) {
    console.error('Error reading users.json:', err);
    return [];
  }
}

function writeUsers(users) {
  const tempFile = `${USERS_FILE}.tmp`;
  fs.writeFileSync(tempFile, JSON.stringify(users, null, 2), 'utf-8');
  fs.renameSync(tempFile, USERS_FILE);
}

export function findUserByEmail(email) {
  if (!email) return null;
  const normalized = email.trim().toLowerCase();
  const users = readUsers();
  return users.find((u) => u.email.toLowerCase() === normalized) || null;
}

export function findUserById(id) {
  if (!id) return null;
  const users = readUsers();
  return users.find((u) => u.id === id) || null;
}

export function generateToken(user) {
  return jwt.sign(
    {
      id: user.id,
      email: user.email
    },
    JWT_SECRET,
    { expiresIn: '14d' }
  );
}

export function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (err) {
    return null;
  }
}

export async function createUser(email, password) {
  if (!email || !email.includes('@')) {
    throw new Error('Please provide a valid email address.');
  }
  if (!password || password.length < 6) {
    throw new Error('Password must be at least 6 characters long.');
  }

  const normalizedEmail = email.trim().toLowerCase();
  const existing = findUserByEmail(normalizedEmail);
  if (existing) {
    throw new Error('User already exists with this email address.');
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const userId = `usr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

  // Create user specific directory
  const userDir = path.join(USERS_DIR, userId);
  if (!fs.existsSync(userDir)) {
    fs.mkdirSync(userDir, { recursive: true });
  }

  // Initialize user's separate resume files in their user-specific directory
  initializeUserResumes(userId);

  const newUser = {
    id: userId,
    email: normalizedEmail,
    passwordHash,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  const users = readUsers();
  users.push(newUser);
  writeUsers(users);

  const token = generateToken(newUser);

  return {
    user: {
      id: newUser.id,
      email: newUser.email
    },
    token
  };
}

export async function authenticateUser(email, password) {
  if (!email || !password) {
    throw new Error('Email and password are required.');
  }

  const normalizedEmail = email.trim().toLowerCase();
  const user = findUserByEmail(normalizedEmail);
  if (!user) {
    throw new Error('Invalid email or password.');
  }

  const isMatch = await bcrypt.compare(password, user.passwordHash);
  if (!isMatch) {
    throw new Error('Invalid email or password.');
  }

  const token = generateToken(user);

  return {
    user: {
      id: user.id,
      email: user.email
    },
    token
  };
}
