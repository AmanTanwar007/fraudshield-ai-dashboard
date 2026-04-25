'use strict';

const { User, AuditLog } = require('../models');

// GET /api/users
exports.list = async (req, res, next) => {
  try {
    const users = await User.findAll({
      attributes: { exclude: ['password'] },
      order: [['createdAt', 'DESC']],
    });
    res.json({ success: true, data: { users } });
  } catch (err) { next(err); }
};

// GET /api/users/:id
exports.getById = async (req, res, next) => {
  try {
    const user = await User.findByPk(req.params.id, {
      attributes: { exclude: ['password'] },
    });
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    res.json({ success: true, data: { user } });
  } catch (err) { next(err); }
};

// PATCH /api/users/:id
exports.update = async (req, res, next) => {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    const allowed = ['name', 'role', 'isActive'];
    const updates = {};
    allowed.forEach(f => { if (req.body[f] !== undefined) updates[f] = req.body[f]; });

    await user.update(updates);
    res.json({ success: true, message: 'User updated', data: { user: user.toSafeJSON() } });
  } catch (err) { next(err); }
};

// DELETE /api/users/:id  (soft delete — deactivate)
exports.remove = async (req, res, next) => {
  try {
    if (req.params.id === req.user.id) {
      return res.status(400).json({ success: false, message: 'You cannot deactivate your own account' });
    }
    const user = await User.findByPk(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    await user.update({ isActive: false });
    res.json({ success: true, message: 'User deactivated' });
  } catch (err) { next(err); }
};

// GET /api/users/:id/audit-logs
exports.getAuditLogs = async (req, res, next) => {
  try {
    const logs = await AuditLog.findAll({
      where: { userId: req.params.id },
      order: [['createdAt', 'DESC']],
      limit: 100,
    });
    res.json({ success: true, data: { logs } });
  } catch (err) { next(err); }
};
