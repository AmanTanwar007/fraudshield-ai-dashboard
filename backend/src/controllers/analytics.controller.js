'use strict';

const { Transaction, Alert, AuditLog, User } = require('../models');
const { Op, fn, col, literal, QueryTypes } = require('sequelize');
const { sequelize } = require('../models');

// GET /api/analytics/overview
exports.overview = async (req, res, next) => {
  try {
    const { days = 30 } = req.query;
    const since = new Date();
    since.setDate(since.getDate() - parseInt(days));

    const [total, blocked, reviewed, cleared, avgScore, totalAlerts] = await Promise.all([
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
    ]);

    res.json({
      success: true,
      data: {
        period:       `${days}d`,
        total,
        blocked,
        reviewed,
        cleared,
        fraudRate:    total > 0 ? ((blocked / total) * 100).toFixed(2) : '0.00',
        avgRiskScore: Math.round(parseFloat(avgScore?.avg) || 0),
        totalAlerts,
      },
    });
  } catch (err) { next(err); }
};

// GET /api/analytics/risk-distribution
exports.riskDistribution = async (req, res, next) => {
  try {
    // Bucket scores into ranges: 0-9, 10-19, ..., 90-100
    const rows = await sequelize.query(`
      SELECT
        FLOOR("riskScore" / 10) * 10 AS bucket,
        COUNT(*)::int                 AS count
      FROM transactions
      GROUP BY bucket
      ORDER BY bucket
    `, { type: QueryTypes.SELECT });

    const distribution = Array.from({ length: 10 }, (_, i) => {
      const bucket = i * 10;
      const found  = rows.find(r => parseInt(r.bucket) === bucket);
      return { range: `${bucket}-${bucket + 9}`, count: found?.count || 0 };
    });

    res.json({ success: true, data: { distribution } });
  } catch (err) { next(err); }
};

// GET /api/analytics/country-heatmap
exports.countryHeatmap = async (req, res, next) => {
  try {
    const { days = 30 } = req.query;
    const since = new Date();
    since.setDate(since.getDate() - parseInt(days));

    const rows = await Transaction.findAll({
      attributes: [
        'country',
        [fn('COUNT', col('id')),                                             'total'],
        [fn('SUM', literal("CASE WHEN verdict='block' THEN 1 ELSE 0 END")), 'blocked'],
        [fn('AVG', col('riskScore')),                                        'avgScore'],
      ],
      where: { createdAt: { [Op.gte]: since } },
      group: ['country'],
      order: [[fn('COUNT', col('id')), 'DESC']],
      raw: true,
    });

    const heatmap = rows.map(r => ({
      country:    r.country,
      total:      parseInt(r.total),
      blocked:    parseInt(r.blocked),
      fraudRate:  r.total > 0 ? ((r.blocked / r.total) * 100).toFixed(1) : '0.0',
      avgScore:   Math.round(parseFloat(r.avgScore)),
    }));

    res.json({ success: true, data: { heatmap } });
  } catch (err) { next(err); }
};

// GET /api/analytics/trend
exports.trend = async (req, res, next) => {
  try {
    const { days = 14 } = req.query;
    const since = new Date();
    since.setDate(since.getDate() - parseInt(days));

    const rows = await Transaction.findAll({
      attributes: [
        [fn('DATE', col('createdAt')),                                       'date'],
        [fn('COUNT', col('id')),                                             'total'],
        [fn('SUM', literal("CASE WHEN verdict='block' THEN 1 ELSE 0 END")), 'blocked'],
        [fn('SUM', literal("CASE WHEN verdict='clear' THEN 1 ELSE 0 END")), 'cleared'],
        [fn('AVG', col('riskScore')),                                        'avgScore'],
      ],
      where: { createdAt: { [Op.gte]: since } },
      group: [fn('DATE', col('createdAt'))],
      order: [[fn('DATE', col('createdAt')), 'ASC']],
      raw: true,
    });

    res.json({ success: true, data: { trend: rows } });
  } catch (err) { next(err); }
};

// GET /api/analytics/device-breakdown
exports.deviceBreakdown = async (req, res, next) => {
  try {
    const rows = await Transaction.findAll({
      attributes: [
        'deviceRisk',
        [fn('COUNT', col('id')),                                             'total'],
        [fn('SUM', literal("CASE WHEN verdict='block' THEN 1 ELSE 0 END")), 'blocked'],
        [fn('AVG', col('riskScore')),                                        'avgScore'],
      ],
      group: ['deviceRisk'],
      raw: true,
    });

    res.json({ success: true, data: { breakdown: rows } });
  } catch (err) { next(err); }
};

// GET /api/analytics/type-breakdown
exports.typeBreakdown = async (req, res, next) => {
  try {
    const rows = await Transaction.findAll({
      attributes: [
        'transactionType',
        [fn('COUNT', col('id')),                                             'total'],
        [fn('SUM', literal("CASE WHEN verdict='block' THEN 1 ELSE 0 END")), 'blocked'],
        [fn('AVG', col('riskScore')),                                        'avgScore'],
        [fn('AVG', col('amount')),                                           'avgAmount'],
      ],
      group: ['transactionType'],
      order: [[fn('COUNT', col('id')), 'DESC']],
      raw: true,
    });

    res.json({ success: true, data: { breakdown: rows } });
  } catch (err) { next(err); }
};

// GET /api/analytics/top-signals
// Parses JSONB signals column and tallies most common warnings
exports.topSignals = async (req, res, next) => {
  try {
    const rows = await sequelize.query(`
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

    res.json({ success: true, data: { topSignals: rows } });
  } catch (err) { next(err); }
};

// GET /api/analytics/audit-logs  (admin)
exports.auditLogs = async (req, res, next) => {
  try {
    const { page = 1, limit = 50, action } = req.query;
    const where = {};
    if (action) where.action = action;

    const offset = (parseInt(page) - 1) * parseInt(limit);
    const { count, rows } = await AuditLog.findAndCountAll({
      where,
      limit:   parseInt(limit),
      offset,
      order:   [['createdAt', 'DESC']],
      include: [{ association: 'user', attributes: ['id', 'name', 'email'] }],
    });

    res.json({
      success: true,
      data: {
        total:      count,
        page:       parseInt(page),
        totalPages: Math.ceil(count / parseInt(limit)),
        logs:       rows,
      },
    });
  } catch (err) { next(err); }
};
