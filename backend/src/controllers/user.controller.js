'use strict';

const { User } = require('../models');

exports.list = async (req, res, next) => {
  try {
    const users = await User.findAll({ attributes: { exclude: ['password'] }, order: [['createdAt','DESC']] });
    res.json({ success: true, data: { users } });
  } catch (err) { next(err); }
};

exports.getById = async (req, res, next) => {
  try {
    const user = await User.findByPk(req.params.id, { attributes: { exclude: ['password'] } });
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    res.json({ success: true, data: { user } });
  } catch (err) { next(err); }
};

exports.update = async (req, res, next) => {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    const allowed = ['name','role','isActive'];
    const updates = {};
    allowed.forEach(f => { if (req.body[f] !== undefined) updates[f] = req.body[f]; });
    await user.update(updates);
    res.json({ success: true, data: { user: user.toSafeJSON() } });
  } catch (err) { next(err); }
};

exports.remove = async (req, res, next) => {
  try {
    if (req.params.id === req.user.id)
      return res.status(400).json({ success: false, message: 'Cannot deactivate yourself' });
    const user = await User.findByPk(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    await user.update({ isActive: false });
    res.json({ success: true, message: 'User deactivated' });
  } catch (err) { next(err); }
};
