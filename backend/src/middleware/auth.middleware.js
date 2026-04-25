'use strict';

const { verifyToken } = require('../services/auth.service');

/**
 * Require a valid JWT. Attaches req.user.
 */
async function protect(req, res, next) {
  try {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'Authentication required. Please log in.' });
    }

    const token = header.split(' ')[1];
    const user  = await verifyToken(token);
    req.user = user;
    next();
  } catch (err) {
    res.status(401).json({ success: false, message: 'Invalid or expired token. Please log in again.' });
  }
}

/**
 * Restrict to specific roles.
 * Usage: restrict('admin', 'analyst')
 */
function restrict(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Access denied. Required role(s): ${roles.join(', ')}`,
      });
    }
    next();
  };
}

module.exports = { protect, restrict };
