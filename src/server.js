import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// Resolve directory of current file and load .env from backend root or cwd
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const backendRoot = path.resolve(__dirname, '..');

// Load .env from backendRoot first, and allow cwd fallback
dotenv.config({ path: path.join(backendRoot, '.env') });
dotenv.config(); // fallback to cwd/.env if present

import express from 'express';
import cors from 'cors';
import {
  isApiKeyConfigured,
  SUPPORTED_MODELS,
  tailorResume
} from './services/aiService.js';
import {
  createUser,
  authenticateUser,
  findUserById
} from './services/userService.js';
import {
  getUserResumes,
  saveUserResumes,
  deleteUserResume
} from './services/resumeService.js';
import { authenticateToken } from './middleware/authMiddleware.js';

const app = express();
const PORT = process.env.PORT || 5001;

// CORS configuration - allow all local and client origins
app.use(cors({
  origin: true,
  credentials: true
}));

// Body parser
app.use(express.json({ limit: '10mb' }));

// Health Check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'cv-maker-backend',
    uptime: process.uptime()
  });
});

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'cv-maker-backend',
    uptime: process.uptime()
  });
});

// ============================================================================
// AUTHENTICATION ROUTES (JWT + bcryptjs)
// ============================================================================

// Register / Create user
app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Email and password are required.'
      });
    }

    const { user, token } = await createUser(email, password);
    return res.status(201).json({
      success: true,
      message: 'Account created successfully',
      user,
      token
    });
  } catch (err) {
    const isConflict = err.message.toLowerCase().includes('already exists');
    return res.status(isConflict ? 409 : 400).json({
      success: false,
      error: err.message || 'Failed to create user account'
    });
  }
});

// Login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Email and password are required.'
      });
    }

    const { user, token } = await authenticateUser(email, password);
    return res.json({
      success: true,
      message: 'Logged in successfully',
      user,
      token
    });
  } catch (err) {
    return res.status(401).json({
      success: false,
      error: err.message || 'Invalid email or password'
    });
  }
});

// Get current logged-in user profile
app.get('/api/auth/me', authenticateToken, (req, res) => {
  return res.json({
    success: true,
    user: req.user
  });
});

// ============================================================================
// USER-SPECIFIC RESUME STORAGE ROUTES (Saved in data/users/<userId>/resumes.json)
// ============================================================================

// Get current user's resumes
app.get('/api/resumes', authenticateToken, (req, res) => {
  try {
    const data = getUserResumes(req.user.id);
    return res.json({
      success: true,
      data
    });
  } catch (err) {
    console.error('Error fetching user resumes:', err);
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve resume data from user directory'
    });
  }
});

// Save current user's resumes
const handleSaveResumes = (req, res) => {
  try {
    const { activeProfileId, savedProfiles, activeResumeData } = req.body || {};
    const saved = saveUserResumes(req.user.id, {
      activeProfileId,
      savedProfiles,
      activeResumeData
    });

    return res.json({
      success: true,
      message: 'Resumes saved to user directory',
      data: saved
    });
  } catch (err) {
    console.error('Error saving user resumes:', err);
    return res.status(500).json({
      success: false,
      error: 'Failed to save resume data to user directory'
    });
  }
};

app.put('/api/resumes', authenticateToken, handleSaveResumes);
app.post('/api/resumes', authenticateToken, handleSaveResumes);

// Delete specific resume file from disk
const handleDeleteResume = (req, res) => {
  try {
    const profileId = req.params.id;
    if (!profileId) {
      return res.status(400).json({ success: false, error: 'Profile ID is required' });
    }
    const data = deleteUserResume(req.user.id, profileId);
    return res.json({
      success: true,
      message: `Resume ${profileId} deleted from user directory`,
      data
    });
  } catch (err) {
    console.error('Error deleting user resume:', err);
    return res.status(500).json({
      success: false,
      error: 'Failed to delete resume file'
    });
  }
};

app.delete('/api/resumes/:id', authenticateToken, handleDeleteResume);
app.delete('/api/resumes/profile/:id', authenticateToken, handleDeleteResume);

// ============================================================================
// AI TAILORING ROUTES
// ============================================================================

// AI Configuration / Status (Never leaks the actual secret key)
const handleAiStatus = (req, res) => {
  res.json({
    configured: isApiKeyConfigured(),
    defaultModel: 'openai/gpt-oss-120b',
    models: SUPPORTED_MODELS
  });
};

app.get('/api/ai/status', handleAiStatus);
app.get('/api/status', handleAiStatus);
app.get('/ai/status', handleAiStatus);

// List supported models
app.get('/api/ai/models', (req, res) => {
  res.json({
    models: SUPPORTED_MODELS
  });
});

// AI Resume Tailoring endpoint handler
const handleTailorRequest = async (req, res) => {
  try {
    const {
      mode = 'jd',
      currentResume,
      jobDescription,
      targetRole,
      prompt,
      model,
      apiKey: bodyApiKey
    } = req.body || {};

    const headerApiKey = req.headers['x-api-key'];
    const customApiKey = bodyApiKey || headerApiKey || '';

    if (!currentResume) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: currentResume'
      });
    }

    const result = await tailorResume({
      mode,
      currentResume,
      jobDescription,
      targetRole,
      prompt,
      apiKey: customApiKey,
      model
    });

    return res.json({
      success: true,
      ...result
    });
  } catch (error) {
    console.error('Error during AI tailor:', error.message);
    const statusCode = error.message.includes('missing') || error.message.includes('provide') ? 400 : 500;
    return res.status(statusCode).json({
      success: false,
      error: error.message || 'Internal AI service error'
    });
  }
};

app.post('/api/ai/tailor', handleTailorRequest);
app.post('/api/tailor', handleTailorRequest);
app.post('/ai/tailor', handleTailorRequest);

// Global 404 handler
app.use((req, res) => {
  res.status(404).json({ error: `Route not found: ${req.method} ${req.originalUrl}` });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Unhandled server error:', err);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`=========================================`);
  console.log(`🚀 CV Maker Backend listening on port ${PORT}`);
  console.log(`🔑 AI API Key configured: ${isApiKeyConfigured() ? 'YES' : 'NO'}`);
  console.log(`🔐 JWT Auth & User Directory Storage Enabled`);
  console.log(`🌐 Health check: http://localhost:${PORT}/api/health`);
  console.log(`=========================================`);
});
