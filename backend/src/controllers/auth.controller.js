'use strict';

const authService = require('../services/auth.service');

exports.register = async (req, res, next) => {
  try {
    const result = await authService.register(req.body);
    res.status(201).json({ success: true, message: 'Account created', data: result });
  } catch (err) { next(err); }
};

exports.login = async (req, res, next) => {
  try {
    const meta   = { ipAddress: req.ip };
    const result = await authService.login(req.body, meta);
    res.json({ success: true, message: 'Login successful', data: result });
  } catch (err) { next(err); }
};

exports.getMe = async (req, res) => {
  res.json({ success: true, data: { user: req.user.toSafeJSON() } });
};

exports.changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!newPassword || newPassword.length < 8)
      return res.status(400).json({ success: false, message: 'New password min 8 chars' });
    const valid = await req.user.verifyPassword(currentPassword);
    if (!valid)
      return res.status(401).json({ success: false, message: 'Current password incorrect' });
    await req.user.update({ password: newPassword });
    res.json({ success: true, message: 'Password updated' });
  } catch (err) { next(err); }
};
