'use strict';

const { Alert, Transaction } = require('../models');
const { Op } = require('sequelize');

/**
 * Create one or more alerts linked to a transaction.
 */
async function createAlerts(transactionId, alertsData) {
  if (!alertsData || alertsData.length === 0) return [];
  const records = alertsData.map(a => ({ ...a, transactionId }));
  return Alert.bulkCreate(records);
}

/**
 * Get alert summary counts — used for the dashboard badge.
 */
async function getAlertSummary() {
  const [total, unread, critical, unresolved] = await Promise.all([
    Alert.count(),
    Alert.count({ where: { isRead: false } }),
    Alert.count({ where: { severity: 'critical', isResolved: false } }),
    Alert.count({ where: { isResolved: false } }),
  ]);
  return { total, unread, critical, unresolved };
}

/**
 * Paginated alert list with optional filters.
 */
async function getAlerts({ page = 1, limit = 20, severity, category, isRead, isResolved }) {
  const where = {};
  if (severity !== undefined)  where.severity   = severity;
  if (category !== undefined)  where.category   = category;
  if (isRead !== undefined)    where.isRead      = isRead === 'true' || isRead === true;
  if (isResolved !== undefined) where.isResolved = isResolved === 'true' || isResolved === true;

  const offset = (parseInt(page) - 1) * parseInt(limit);
  const { count, rows } = await Alert.findAndCountAll({
    where,
    limit:   parseInt(limit),
    offset,
    order:   [['createdAt', 'DESC']],
    include: [{
      model:      Transaction,
      as:         'transaction',
      attributes: ['txnId', 'amount', 'currency', 'verdict', 'riskScore', 'country'],
    }],
  });

  return {
    total:      count,
    page:       parseInt(page),
    totalPages: Math.ceil(count / parseInt(limit)),
    data:       rows,
  };
}

/**
 * Mark multiple alerts as read by IDs.
 */
async function markManyRead(ids) {
  const [count] = await Alert.update(
    { isRead: true },
    { where: { id: { [Op.in]: ids } } }
  );
  return count;
}

/**
 * Resolve an alert by ID.
 */
async function resolveAlert(id) {
  const alert = await Alert.findByPk(id);
  if (!alert) {
    const err = new Error('Alert not found');
    err.statusCode = 404;
    throw err;
  }
  await alert.update({ isResolved: true, resolvedAt: new Date(), isRead: true });
  return alert;
}

module.exports = { createAlerts, getAlertSummary, getAlerts, markManyRead, resolveAlert };
