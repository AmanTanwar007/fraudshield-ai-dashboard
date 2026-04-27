'use strict';

const { Transaction, Alert } = require('../models');
const { Op, fn, col, literal } = require('sequelize');
const { sequelize } = require('../models');

exports.overview = async (req, res, next) => {
  try {
    const days  = parseInt(req.query.days) || 30;
    const since = new Date(); since.setDate(since.getDate() - days);
    const [total, blocked, reviewed, cleared, avgRow, alerts] = await Promise.all([
      Transaction.count({ where: { createdAt: { [Op.gte]: since } } }),
      Transaction.count({ where: { verdict: 'block',  createdAt: { [Op.gte]: since } } }),
      Transaction.count({ where: { verdict: 'review', createdAt: { [Op.gte]: since } } }),
      Transaction.count({ where: { verdict: 'clear',  createdAt: { [Op.gte]: since } } }),
      Transaction.findOne({ attributes: [[fn('AVG', col('riskScore')), 'avg']], where: { createdAt: { [Op.gte]: since } }, raw: true }),
      Alert.count({ where: { createdAt: { [Op.gte]: since } } }),
    ]);
    res.json({ success: true, data: { period: `${days}d`, total, blocked, reviewed, cleared, fraudRate: total > 0 ? ((blocked/total)*100).toFixed(2) : '0.00', avgRiskScore: Math.round(parseFloat(avgRow?.avg)||0), totalAlerts: alerts } });
  } catch (err) { next(err); }
};

exports.trend = async (req, res, next) => {
  try {
    const days  = parseInt(req.query.days) || 14;
    const since = new Date(); since.setDate(since.getDate() - days);
    const rows  = await Transaction.findAll({
      attributes: [
        [fn('DATE', col('createdAt')), 'date'],
        [fn('COUNT', col('id')), 'total'],
        [fn('SUM', literal("CASE WHEN verdict='block' THEN 1 ELSE 0 END")), 'blocked'],
        [fn('AVG', col('riskScore')), 'avgScore'],
      ],
      where: { createdAt: { [Op.gte]: since } },
      group: [fn('DATE', col('createdAt'))],
      order: [[fn('DATE', col('createdAt')), 'ASC']],
      raw: true,
    });
    res.json({ success: true, data: { trend: rows } });
  } catch (err) { next(err); }
};

exports.countryHeatmap = async (req, res, next) => {
  try {
    const rows = await Transaction.findAll({
      attributes: ['country', [fn('COUNT', col('id')), 'total'], [fn('SUM', literal("CASE WHEN verdict='block' THEN 1 ELSE 0 END")), 'blocked']],
      group: ['country'], order: [[fn('COUNT', col('id')), 'DESC']], raw: true,
    });
    res.json({ success: true, data: { heatmap: rows.map(r => ({ country: r.country, total: parseInt(r.total), blocked: parseInt(r.blocked), fraudRate: r.total > 0 ? ((r.blocked/r.total)*100).toFixed(1) : '0.0' })) } });
  } catch (err) { next(err); }
};

exports.deviceBreakdown = async (req, res, next) => {
  try {
    const rows = await Transaction.findAll({
      attributes: ['deviceRisk', [fn('COUNT', col('id')), 'total'], [fn('SUM', literal("CASE WHEN verdict='block' THEN 1 ELSE 0 END")), 'blocked']],
      group: ['deviceRisk'], raw: true,
    });
    res.json({ success: true, data: { breakdown: rows } });
  } catch (err) { next(err); }
};

exports.typeBreakdown = async (req, res, next) => {
  try {
    const rows = await Transaction.findAll({
      attributes: ['transactionType', [fn('COUNT', col('id')), 'total'], [fn('SUM', literal("CASE WHEN verdict='block' THEN 1 ELSE 0 END")), 'blocked']],
      group: ['transactionType'], order: [[fn('COUNT', col('id')), 'DESC']], raw: true,
    });
    res.json({ success: true, data: { breakdown: rows } });
  } catch (err) { next(err); }
};

exports.topSignals = async (req, res, next) => {
  try {
    const { QueryTypes } = require('sequelize');
    const rows = await sequelize.query(`
      SELECT signal->>'msg' AS message, signal->>'cls' AS cls, COUNT(*)::int AS occurrences
      FROM transactions, jsonb_array_elements(signals) AS signal
      WHERE signal->>'cls' = 'warn'
      GROUP BY signal->>'msg', signal->>'cls'
      ORDER BY occurrences DESC LIMIT 10
    `, { type: QueryTypes.SELECT });
    res.json({ success: true, data: { topSignals: rows } });
  } catch (err) { next(err); }
};

exports.riskDistribution = async (req, res, next) => {
  try {
    const { QueryTypes } = require('sequelize');
    const rows = await sequelize.query(`
      SELECT FLOOR("riskScore"/10)*10 AS bucket, COUNT(*)::int AS count
      FROM transactions GROUP BY bucket ORDER BY bucket
    `, { type: QueryTypes.SELECT });
    const dist = Array.from({ length: 10 }, (_, i) => {
      const b = i * 10;
      const f = rows.find(r => parseInt(r.bucket) === b);
      return { range: `${b}-${b+9}`, count: f?.count || 0 };
    });
    res.json({ success: true, data: { distribution: dist } });
  } catch (err) { next(err); }
};
