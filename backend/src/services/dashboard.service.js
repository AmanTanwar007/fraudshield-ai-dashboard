'use strict';

const { Transaction, Alert } = require('../models');
const { Op, fn, col, literal } = require('sequelize');

/**
 * Returns all data needed to power the live dashboard.
 */
async function getDashboardStats() {
  const now      = new Date();
  const today    = new Date(now); today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
  const weekAgo  = new Date(today); weekAgo.setDate(today.getDate() - 7);

  // ── Today's counts ──────────────────────────────────────
  const [todayBlocked, todaySafe, todayReview] = await Promise.all([
    Transaction.count({ where: { verdict: 'block',  createdAt: { [Op.gte]: today } } }),
    Transaction.count({ where: { verdict: 'clear',  createdAt: { [Op.gte]: today } } }),
    Transaction.count({ where: { verdict: 'review', createdAt: { [Op.gte]: today } } }),
  ]);

  // ── Yesterday's blocked (for delta %) ───────────────────
  const yesterdayBlocked = await Transaction.count({
    where: {
      verdict: 'block',
      createdAt: { [Op.gte]: yesterday, [Op.lt]: today },
    },
  });

  // ── Average risk score today ─────────────────────────────
  const avgRiskResult = await Transaction.findOne({
    attributes: [[fn('AVG', col('riskScore')), 'avgScore']],
    where: { createdAt: { [Op.gte]: today } },
    raw: true,
  });
  const avgRiskScore = Math.round(parseFloat(avgRiskResult?.avgScore) || 0);

  // ── Unread alerts ────────────────────────────────────────
  const [criticalAlerts, unreadAlerts] = await Promise.all([
    Alert.count({ where: { severity: 'critical', isResolved: false } }),
    Alert.count({ where: { isRead: false } }),
  ]);

  // ── 24-hour volume histogram (1 bucket per hour) ─────────
  const volumeData = await Transaction.findAll({
    attributes: [
      [fn('DATE_PART', 'hour', col('createdAt')), 'hour'],
      [fn('COUNT', col('id')), 'total'],
      [fn('SUM', literal("CASE WHEN verdict = 'block' THEN 1 ELSE 0 END")), 'blocked'],
    ],
    where: { createdAt: { [Op.gte]: today } },
    group: [fn('DATE_PART', 'hour', col('createdAt'))],
    order: [[fn('DATE_PART', 'hour', col('createdAt')), 'ASC']],
    raw: true,
  });

  // Fill all 24 hours (0–23), defaulting missing hours to 0
  const hourlyVolume = Array.from({ length: 24 }, (_, h) => {
    const bucket = volumeData.find(r => parseInt(r.hour) === h);
    return {
      hour: h,
      total:   parseInt(bucket?.total   || 0),
      blocked: parseInt(bucket?.blocked || 0),
    };
  });

  // ── Recent 5 transactions for live feed ──────────────────
  const recentTransactions = await Transaction.findAll({
    limit:  5,
    order:  [['createdAt', 'DESC']],
    attributes: ['id', 'txnId', 'amount', 'currency', 'verdict', 'riskScore', 'country', 'createdAt'],
  });

  // ── Weekly trend (7 days) ────────────────────────────────
  const weeklyTrend = await Transaction.findAll({
    attributes: [
      [fn('DATE', col('createdAt')), 'date'],
      [fn('COUNT', col('id')), 'total'],
      [fn('SUM', literal("CASE WHEN verdict = 'block' THEN 1 ELSE 0 END")), 'blocked'],
    ],
    where: { createdAt: { [Op.gte]: weekAgo } },
    group: [fn('DATE', col('createdAt'))],
    order: [[fn('DATE', col('createdAt')), 'ASC']],
    raw: true,
  });

  // ── Verdict breakdown pie ────────────────────────────────
  const verdictBreakdown = await Transaction.findAll({
    attributes: [
      'verdict',
      [fn('COUNT', col('id')), 'count'],
    ],
    group: ['verdict'],
    raw: true,
  });

  // ── Top countries by fraud ────────────────────────────────
  const topFraudCountries = await Transaction.findAll({
    attributes: [
      'country',
      [fn('COUNT', col('id')), 'total'],
    ],
    where: { verdict: 'block' },
    group: ['country'],
    order: [[fn('COUNT', col('id')), 'DESC']],
    limit: 5,
    raw: true,
  });

  const todayTotal = todayBlocked + todaySafe + todayReview;
  const blockDelta = yesterdayBlocked > 0
    ? (((todayBlocked - yesterdayBlocked) / yesterdayBlocked) * 100).toFixed(1)
    : 0;

  return {
    summary: {
      fraudBlocked:    todayBlocked,
      safePassed:      todaySafe,
      underReview:     todayReview,
      totalToday:      todayTotal,
      avgRiskScore,
      criticalAlerts,
      unreadAlerts,
      blockDelta:      parseFloat(blockDelta),
    },
    hourlyVolume,
    recentTransactions,
    weeklyTrend,
    verdictBreakdown,
    topFraudCountries,
  };
}

module.exports = { getDashboardStats };
