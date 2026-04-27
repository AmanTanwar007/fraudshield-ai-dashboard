'use strict';

const { verifyToken } = require('../services/auth.service');

async function protect(req, res, next) {
  try {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }
    const token = header.split(' ')[1];
    req.user = await verifyToken(token);
    next();
  } catch {
    res.status(401).json({ success: false, message: 'Invalid or expired token' });
  }
}

function restrict(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ success: false, message: `Access denied. Required: ${roles.join(', ')}` });
    }
    next();
  };
}

module.exports = { protect, restrict };
