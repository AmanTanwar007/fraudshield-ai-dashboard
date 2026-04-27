'use strict';

const { Transaction, Alert } = require('../models');
const { Op, fn, col, literal } = require('sequelize');

async function getDashboardStats() {
  const now      = new Date();
  const today    = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);

  const [fraudBlocked, safePassed, underReview, yesterdayBlocked, avgScoreRow, criticalAlerts, unreadAlerts] =
    await Promise.all([
      Transaction.count({ where: { verdict: 'block',  createdAt: { [Op.gte]: today } } }),
      Transaction.count({ where: { verdict: 'clear',  createdAt: { [Op.gte]: today } } }),
      Transaction.count({ where: { verdict: 'review', createdAt: { [Op.gte]: today } } }),
      Transaction.count({ where: { verdict: 'block',  createdAt: { [Op.gte]: yesterday, [Op.lt]: today } } }),
      Transaction.findOne({ attributes: [[fn('AVG', col('riskScore')), 'avg']], where: { createdAt: { [Op.gte]: today } }, raw: true }),
      Alert.count({ where: { severity: 'critical', isResolved: false } }),
      Alert.count({ where: { isRead: false } }),
    ]);

  const totalToday = fraudBlocked + safePassed + underReview;
  const blockDelta = yesterdayBlocked > 0
    ? (((fraudBlocked - yesterdayBlocked) / yesterdayBlocked) * 100).toFixed(1)
    : 0;

  const recentTransactions = await Transaction.findAll({
    limit: 5, order: [['createdAt', 'DESC']],
    attributes: ['id','txnId','amount','currency','verdict','riskScore','country','createdAt'],
  });

  const verdictBreakdown = await Transaction.findAll({
    attributes: ['verdict', [fn('COUNT', col('id')), 'count']],
    group: ['verdict'], raw: true,
  });

  const topFraudCountries = await Transaction.findAll({
    attributes: ['country', [fn('COUNT', col('id')), 'total']],
    where: { verdict: 'block' },
    group: ['country'],
    order: [[fn('COUNT', col('id')), 'DESC']],
    limit: 5, raw: true,
  });

  const hourlyVolume = await Transaction.findAll({
    attributes: [
      [fn('DATE_PART', 'hour', col('createdAt')), 'hour'],
      [fn('COUNT', col('id')), 'total'],
      [fn('SUM', literal("CASE WHEN verdict='block' THEN 1 ELSE 0 END")), 'blocked'],
    ],
    where: { createdAt: { [Op.gte]: today } },
    group: [fn('DATE_PART', 'hour', col('createdAt'))],
    order: [[fn('DATE_PART', 'hour', col('createdAt')), 'ASC']],
    raw: true,
  });

  const hourlyFilled = Array.from({ length: 24 }, (_, h) => {
    const found = hourlyVolume.find(r => parseInt(r.hour) === h);
    return { hour: h, total: parseInt(found?.total || 0), blocked: parseInt(found?.blocked || 0) };
  });

  return {
    summary: {
      fraudBlocked, safePassed, underReview, totalToday,
      avgRiskScore: Math.round(parseFloat(avgScoreRow?.avg) || 0),
      criticalAlerts, unreadAlerts,
      blockDelta: parseFloat(blockDelta),
    },
    recentTransactions,
    verdictBreakdown,
    topFraudCountries,
    hourlyVolume: hourlyFilled,
  };
}

module.exports = { getDashboardStats };
