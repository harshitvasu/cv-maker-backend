import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { defaultResumeData } from '../data/defaultResume.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const backendRoot = path.resolve(__dirname, '../..');
const USERS_DIR = path.join(backendRoot, 'data', 'users');

export function sanitizeId(id) {
  if (!id) return 'resume_' + Date.now();
  return String(id)
    .replace(/\.json$/i, '')
    .replace(/[^a-zA-Z0-9_-]/g, '_');
}

export function formatTitleFromFileName(filename) {
  if (!filename) return 'Resume';
  let clean = filename
    .replace(/\.json$/i, '')
    .replace(/___/g, ' - ')
    .replace(/[_-]+/g, ' ')
    .trim();

  return clean
    .split(' ')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function getUserDir(userId) {
  if (!userId) throw new Error('User ID is required');
  const userDir = path.join(USERS_DIR, userId);
  if (!fs.existsSync(userDir)) {
    fs.mkdirSync(userDir, { recursive: true });
  }
  return userDir;
}

function getUserResumesDir(userId) {
  const userDir = getUserDir(userId);
  const resumesDir = path.join(userDir, 'resumes');
  if (!fs.existsSync(resumesDir)) {
    fs.mkdirSync(resumesDir, { recursive: true });
  }
  return resumesDir;
}

function getUserMetaPath(userId) {
  const userDir = getUserDir(userId);
  return path.join(userDir, 'meta.json');
}

function readUserMeta(userId) {
  const metaPath = getUserMetaPath(userId);
  if (fs.existsSync(metaPath)) {
    try {
      return JSON.parse(fs.readFileSync(metaPath, 'utf-8')) || {};
    } catch {
      return {};
    }
  }
  return {};
}

function writeUserMeta(userId, meta) {
  const metaPath = getUserMetaPath(userId);
  const tempPath = `${metaPath}.tmp`;
  fs.writeFileSync(tempPath, JSON.stringify(meta, null, 2), 'utf-8');
  fs.renameSync(tempPath, metaPath);
}

/**
 * Initializes default resume file (pure raw format) for a new user.
 */
export function initializeUserResumes(userId) {
  const resumesDir = getUserResumesDir(userId);
  const defaultId = 'default_resume';
  const filePath = path.join(resumesDir, `${defaultId}.json`);

  // Save purely in raw resume JSON format
  fs.writeFileSync(filePath, JSON.stringify(defaultResumeData, null, 2), 'utf-8');

  writeUserMeta(userId, {
    activeProfileId: defaultId,
    titles: {
      [defaultId]: 'Default Resume'
    },
    updatedAt: new Date().toISOString()
  });

  return {
    activeProfileId: defaultId,
    savedProfiles: [
      {
        id: defaultId,
        title: 'Default Resume',
        updatedAt: new Date().toISOString(),
        data: defaultResumeData
      }
    ],
    activeResumeData: defaultResumeData
  };
}

/**
 * Reads all raw resume JSON files from the user's resumes/ folder.
 */
export function getUserResumes(userId) {
  const resumesDir = getUserResumesDir(userId);
  const meta = readUserMeta(userId);
  const titlesMap = meta.titles || {};

  const files = fs.readdirSync(resumesDir).filter((f) => f.toLowerCase().endsWith('.json'));

  // If no resumes exist, initialize with default raw resume
  if (files.length === 0) {
    return initializeUserResumes(userId);
  }

  const savedProfiles = [];
  for (const file of files) {
    const filePath = path.join(resumesDir, file);
    try {
      const rawText = fs.readFileSync(filePath, 'utf-8');
      const parsed = JSON.parse(rawText);
      const stats = fs.statSync(filePath);
      const baseId = file.replace(/\.json$/i, '');

      // Ensure pure raw resume format (extract .data if an old wrapper ever slipped in)
      const rawResumeData = parsed.data && parsed.personalInfo === undefined
        ? parsed.data
        : parsed;

      const title = titlesMap[baseId] || formatTitleFromFileName(baseId);

      savedProfiles.push({
        id: baseId,
        title,
        updatedAt: stats.mtime.toISOString(),
        data: rawResumeData
      });
    } catch (readErr) {
      console.error(`Failed to read raw resume file ${file}:`, readErr.message);
    }
  }

  if (savedProfiles.length === 0) {
    return initializeUserResumes(userId);
  }

  // Sort by updatedAt descending
  savedProfiles.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

  let activeProfileId = meta.activeProfileId;
  if (!activeProfileId || !savedProfiles.some((p) => p.id === activeProfileId)) {
    activeProfileId = savedProfiles[0].id;
  }

  const activeProfile = savedProfiles.find((p) => p.id === activeProfileId) || savedProfiles[0];
  const activeResumeData = activeProfile?.data || defaultResumeData;

  return {
    activeProfileId,
    savedProfiles,
    activeResumeData
  };
}

/**
 * Saves resumes as separate raw JSON files and removes deleted resume files from disk.
 */
export function saveUserResumes(userId, { activeProfileId, savedProfiles, activeResumeData }) {
  const resumesDir = getUserResumesDir(userId);
  const meta = readUserMeta(userId);
  const titlesMap = { ...(meta.titles || {}) };

  const profilesList = Array.isArray(savedProfiles) && savedProfiles.length > 0
    ? savedProfiles
    : [
        {
          id: 'default_resume',
          title: 'Default Resume',
          data: activeResumeData || defaultResumeData
        }
      ];

  const currentDiskFiles = fs.readdirSync(resumesDir).filter((f) => f.toLowerCase().endsWith('.json'));
  const keptFileNames = new Set();

  for (const profile of profilesList) {
    const safeId = sanitizeId(profile.id);
    const fileName = `${safeId}.json`;
    keptFileNames.add(fileName.toLowerCase());

    if (profile.title) {
      titlesMap[safeId] = profile.title;
    }

    // Determine the raw resume data to write
    const rawDataToWrite = safeId === activeProfileId && activeResumeData
      ? activeResumeData
      : profile.data || defaultResumeData;

    const filePath = path.join(resumesDir, fileName);
    const tempPath = `${filePath}.tmp`;

    // Write ONLY the raw resume JSON directly
    fs.writeFileSync(tempPath, JSON.stringify(rawDataToWrite, null, 2), 'utf-8');
    fs.renameSync(tempPath, filePath);
  }

  // Remove any file from disk that was deleted from savedProfiles
  for (const diskFile of currentDiskFiles) {
    if (!keptFileNames.has(diskFile.toLowerCase())) {
      const fileToDelete = path.join(resumesDir, diskFile);
      if (fs.existsSync(fileToDelete)) {
        try {
          fs.unlinkSync(fileToDelete);
          console.log(`Deleted raw resume file from disk: ${fileToDelete}`);
        } catch (err) {
          console.error(`Failed to delete file ${fileToDelete}:`, err);
        }
      }
    }
  }

  const safeActiveId = sanitizeId(activeProfileId || profilesList[0].id);

  writeUserMeta(userId, {
    activeProfileId: safeActiveId,
    titles: titlesMap,
    updatedAt: new Date().toISOString()
  });

  return getUserResumes(userId);
}

/**
 * Explicitly removes a resume file from disk by profile ID.
 */
export function deleteUserResume(userId, profileId) {
  const resumesDir = getUserResumesDir(userId);
  const safeId = sanitizeId(profileId);
  const meta = readUserMeta(userId);

  const candidateNames = [
    `${profileId}.json`,
    `${safeId}.json`
  ];

  for (const name of candidateNames) {
    const filePath = path.join(resumesDir, name);
    if (fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
        console.log(`Physically unlinked resume file: ${filePath}`);
      } catch (err) {
        console.error(`Could not unlink ${filePath}:`, err);
      }
    }
  }

  // Clean titles map
  if (meta.titles) {
    delete meta.titles[profileId];
    delete meta.titles[safeId];
    writeUserMeta(userId, meta);
  }

  return getUserResumes(userId);
}
