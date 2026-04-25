'use strict';

const { Alert, Transaction } = require('../models');
const { Op } = require('sequelize');

// GET /api/alerts
exports.list = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, severity, isRead, isResolved, category } = req.query;
    const where = {};
    if (severity)   where.severity   = severity;
    if (category)   where.category   = category;
    if (isRead      !== undefined) where.isRead      = isRead === 'true';
    if (isResolved  !== undefined) where.isResolved  = isResolved === 'true';

    const offset = (parseInt(page) - 1) * parseInt(limit);
    const { count, rows } = await Alert.findAndCountAll({
      where,
      limit:   parseInt(limit),
      offset,
      order:   [['createdAt', 'DESC']],
      include: [{
        model:      Transaction,
        as:         'transaction',
        attributes: ['txnId', 'amount', 'currency', 'verdict', 'riskScore'],
      }],
    });

    res.json({
      success: true,
      data: {
        total:      count,
        page:       parseInt(page),
        totalPages: Math.ceil(count / parseInt(limit)),
        data:       rows,
      },
    });
  } catch (err) { next(err); }
};

// GET /api/alerts/unread-count
exports.unreadCount = async (req, res, next) => {
  try {
    const count = await Alert.count({ where: { isRead: false } });
    res.json({ success: true, data: { count } });
  } catch (err) { next(err); }
};

// GET /api/alerts/:id
exports.getById = async (req, res, next) => {
  try {
    const alert = await Alert.findByPk(req.params.id, {
      include: [{ association: 'transaction' }],
    });
    if (!alert) return res.status(404).json({ success: false, message: 'Alert not found' });
    res.json({ success: true, data: { alert } });
  } catch (err) { next(err); }
};

// PATCH /api/alerts/:id/read
exports.markRead = async (req, res, next) => {
  try {
    const alert = await Alert.findByPk(req.params.id);
    if (!alert) return res.status(404).json({ success: false, message: 'Alert not found' });
    await alert.update({ isRead: true });
    res.json({ success: true, message: 'Alert marked as read', data: { alert } });
  } catch (err) { next(err); }
};

// PATCH /api/alerts/read-all
exports.markAllRead = async (req, res, next) => {
  try {
    const [count] = await Alert.update({ isRead: true }, { where: { isRead: false } });
    res.json({ success: true, message: `${count} alert(s) marked as read` });
  } catch (err) { next(err); }
};

// PATCH /api/alerts/:id/resolve
exports.resolve = async (req, res, next) => {
  try {
    const alert = await Alert.findByPk(req.params.id);
    if (!alert) return res.status(404).json({ success: false, message: 'Alert not found' });
    await alert.update({ isResolved: true, resolvedAt: new Date(), isRead: true });
    res.json({ success: true, message: 'Alert resolved', data: { alert } });
  } catch (err) { next(err); }
};

// DELETE /api/alerts/:id  (admin)
exports.remove = async (req, res, next) => {
  try {
    const alert = await Alert.findByPk(req.params.id);
    if (!alert) return res.status(404).json({ success: false, message: 'Alert not found' });
    await alert.destroy();
    res.json({ success: true, message: 'Alert deleted' });
  } catch (err) { next(err); }
};
