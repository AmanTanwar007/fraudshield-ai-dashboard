'use strict';

const { Transaction, Alert, AuditLog } = require('../models');
const { Op, fn, col, literal, QueryTypes } = require('sequelize');
const { sequelize } = require('../models');

/**
 * High-level KPI overview for a given lookback period.
 */
async function getOverview(days = 30) {
  const since = new Date();
  since.setDate(since.getDate() - parseInt(days));

  const [total, blocked, reviewed, cleared, avgScoreRow, totalAlerts, unresolvedAlerts] =
    await Promise.all([
      Transaction.count({ where: { createdAt: { [Op.gte]: since } } }),
      Transaction.count({ where: { verdict: 'block',  createdAt: { [Op.gte]: since } } }),
      Transaction.count({ where: { verdict: 'review', createdAt: { [Op.gte]: since } } }),
      Transaction.count({ where: { verdict: 'clear',  createdAt: { [Op.gte]: since } } }),
      Transaction.findOne({
        attributes: [[fn('AVG', col('riskScore')), 'avg']],
        where: { createdAt: { [Op.gte]: since } },
        raw: true,
      }),
      Alert.count({ where: { createdAt: { [Op.gte]: since } } }),
      Alert.count({ where: { isResolved: false } }),
    ]);

  return {
    period:          `${days}d`,
    total,
    blocked,
    reviewed,
    cleared,
    fraudRate:       total > 0 ? ((blocked / total) * 100).toFixed(2) : '0.00',
    avgRiskScore:    Math.round(parseFloat(avgScoreRow?.avg) || 0),
    totalAlerts,
    unresolvedAlerts,
  };
}

/**
 * Score distribution in 10-point buckets.
 */
async function getRiskDistribution() {
  const rows = await sequelize.query(`
    SELECT
      FLOOR("riskScore" / 10) * 10 AS bucket,
      COUNT(*)::int                 AS count
    FROM transactions
    GROUP BY bucket
    ORDER BY bucket
  `, { type: QueryTypes.SELECT });

  return Array.from({ length: 10 }, (_, i) => {
    const bucket = i * 10;
    const found  = rows.find(r => parseInt(r.bucket) === bucket);
    return {
      range: `${bucket}–${bucket === 90 ? 100 : bucket + 9}`,
      count: found?.count || 0,
    };
  });
}

/**
 * Per-country fraud statistics.
 */
async function getCountryHeatmap(days = 30) {
  const since = new Date();
  since.setDate(since.getDate() - parseInt(days));

  const rows = await Transaction.findAll({
    attributes: [
      'country',
      [fn('COUNT', col('id')),                                             'total'],
      [fn('SUM', literal("CASE WHEN verdict='block' THEN 1 ELSE 0 END")), 'blocked'],
      [fn('AVG', col('riskScore')),                                        'avgScore'],
    ],
    where:  { createdAt: { [Op.gte]: since } },
    group:  ['country'],
    order:  [[fn('COUNT', col('id')), 'DESC']],
    raw:    true,
  });

  return rows.map(r => ({
    country:   r.country,
    total:     parseInt(r.total),
    blocked:   parseInt(r.blocked),
    fraudRate: r.total > 0 ? ((r.blocked / r.total) * 100).toFixed(1) : '0.0',
    avgScore:  Math.round(parseFloat(r.avgScore) || 0),
  }));
}

/**
 * Daily trend over N days.
 */
async function getTrend(days = 14) {
  const since = new Date();
  since.setDate(since.getDate() - parseInt(days));

  return Transaction.findAll({
    attributes: [
      [fn('DATE', col('createdAt')),                                       'date'],
      [fn('COUNT', col('id')),                                             'total'],
      [fn('SUM', literal("CASE WHEN verdict='block' THEN 1 ELSE 0 END")), 'blocked'],
      [fn('SUM', literal("CASE WHEN verdict='clear' THEN 1 ELSE 0 END")), 'cleared'],
      [fn('AVG', col('riskScore')),                                        'avgScore'],
    ],
    where:  { createdAt: { [Op.gte]: since } },
    group:  [fn('DATE', col('createdAt'))],
    order:  [[fn('DATE', col('createdAt')), 'ASC']],
    raw:    true,
  });
}

/**
 * Breakdown by device risk level.
 */
async function getDeviceBreakdown() {
  return Transaction.findAll({
    attributes: [
      'deviceRisk',
      [fn('COUNT', col('id')),                                             'total'],
      [fn('SUM', literal("CASE WHEN verdict='block' THEN 1 ELSE 0 END")), 'blocked'],
      [fn('AVG', col('riskScore')),                                        'avgScore'],
    ],
    group: ['deviceRisk'],
    order: [[fn('COUNT', col('id')), 'DESC']],
    raw:   true,
  });
}

/**
 * Breakdown by transaction type.
 */
async function getTypeBreakdown() {
  return Transaction.findAll({
    attributes: [
      'transactionType',
      [fn('COUNT', col('id')),                                             'total'],
      [fn('SUM', literal("CASE WHEN verdict='block' THEN 1 ELSE 0 END")), 'blocked'],
      [fn('AVG', col('riskScore')),                                        'avgScore'],
      [fn('AVG', col('amount')),                                           'avgAmount'],
    ],
    group: ['transactionType'],
    order: [[fn('COUNT', col('id')), 'DESC']],
    raw:   true,
  });
}

/**
 * Top 10 most frequent fraud warning signals (from JSONB column).
 */
async function getTopSignals() {
  return sequelize.query(`
    SELECT
      signal->>'msg'  AS message,
      signal->>'cls'  AS cls,
      COUNT(*)::int   AS occurrences
    FROM transactions,
         jsonb_array_elements(signals) AS signal
    WHERE signal->>'cls' = 'warn'
    GROUP BY signal->>'msg', signal->>'cls'
    ORDER BY occurrences DESC
    LIMIT 10
  `, { type: QueryTypes.SELECT });
}

/**
 * Paginated audit log.
 */
async function getAuditLogs({ page = 1, limit = 50, action } = {}) {
  const where  = {};
  if (action) where.action = action;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  const { count, rows } = await AuditLog.findAndCountAll({
    where,
    limit:   parseInt(limit),
    offset,
    order:   [['createdAt', 'DESC']],
    include: [{ association: 'user', attributes: ['id', 'name', 'email'] }],
  });

  return {
    total:      count,
    page:       parseInt(page),
    totalPages: Math.ceil(count / parseInt(limit)),
    data:       rows,
  };
}

module.exports = {
  getOverview,
  getRiskDistribution,
  getCountryHeatmap,
  getTrend,
  getDeviceBreakdown,
  getTypeBreakdown,
  getTopSignals,
  getAuditLogs,
};
