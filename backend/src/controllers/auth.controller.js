'use strict';

const authService = require('../services/auth.service');
const { User }    = require('../models');

const getMeta = (req) => ({
  ipAddress: req.ip || req.connection?.remoteAddress,
  userAgent: req.headers['user-agent'],
});

// POST /api/auth/register
exports.register = async (req, res, next) => {
  try {
    const { name, email, password, role } = req.body;
    const result = await authService.register({ name, email, password, role }, getMeta(req));
    res.status(201).json({ success: true, message: 'Account created successfully', data: result });
  } catch (err) { next(err); }
};

// POST /api/auth/login
exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const result = await authService.login({ email, password }, getMeta(req));
    res.json({ success: true, message: 'Login successful', data: result });
  } catch (err) { next(err); }
};

// GET /api/auth/me
exports.getMe = async (req, res, next) => {
  try {
    res.json({ success: true, data: { user: req.user.toSafeJSON() } });
  } catch (err) { next(err); }
};

// PATCH /api/auth/change-password
exports.changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = await User.findByPk(req.user.id);

    if (!newPassword || newPassword.length < 8) {
      return res.status(400).json({ success: false, message: 'New password must be at least 8 characters' });
    }

    const valid = await user.verifyPassword(currentPassword);
    if (!valid) return res.status(401).json({ success: false, message: 'Current password is incorrect' });

    await user.update({ password: newPassword });
    res.json({ success: true, message: 'Password updated successfully' });
  } catch (err) { next(err); }
};
