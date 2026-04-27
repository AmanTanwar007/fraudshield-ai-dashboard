'use strict';

const dashService = require('../services/dashboard.service');
const { Transaction, Alert } = require('../models');

exports.getStats = async (req, res, next) => {
  try {
    const stats = await dashService.getDashboardStats();
    res.json({ success: true, data: stats });
  } catch (err) { next(err); }
};

exports.getTicker = async (req, res, next) => {
  try {
    const rows = await Transaction.findAll({
      limit: 20, order: [['createdAt', 'DESC']],
      attributes: ['txnId','amount','currency','verdict','transactionType','country','createdAt'],
    });
    const ticker = rows.map(r => ({
      txnId:   r.txnId,
      amount:  parseFloat(r.amount),
      currency: r.currency,
      status:  r.verdict === 'block' ? 'BLOCKED' : r.verdict === 'review' ? 'REVIEW' : 'CLEARED',
      country: r.country,
      time:    r.createdAt,
    }));
    res.json({ success: true, data: { ticker } });
  } catch (err) { next(err); }
};

exports.getSystemHealth = async (req, res, next) => {
  try {
    const [totalTx, unresolvedAlerts] = await Promise.all([
      Transaction.count(),
      Alert.count({ where: { isResolved: false } }),
    ]);
    res.json({
      success: true,
      data: {
        status: 'operational',
        uptime: Math.floor(process.uptime()),
        totalTransactions: totalTx,
        unresolvedAlerts,
        memoryMB: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        timestamp: new Date().toISOString(),
      },
    });
  } catch (err) { next(err); }
};
