import { verifyToken, findUserById } from '../services/userService.js';

export function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  let token = null;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7).trim();
  } else if (req.headers['x-auth-token']) {
    token = req.headers['x-auth-token'];
  }

  if (!token) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required. Please log in.'
    });
  }

  const decoded = verifyToken(token);
  if (!decoded || !decoded.id) {
    return res.status(401).json({
      success: false,
      error: 'Invalid or expired session. Please log in again.'
    });
  }

  const user = findUserById(decoded.id);
  if (!user) {
    return res.status(401).json({
      success: false,
      error: 'User account not found.'
    });
  }

  req.user = {
    id: user.id,
    email: user.email
  };

  next();
}
