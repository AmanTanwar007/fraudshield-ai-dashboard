'use strict';

const txService = require('../services/transaction.service');
const { analyzeTransaction, generateTxnId } = require('../services/fraudEngine.service');
const { Transaction } = require('../models');

const getMeta = (req) => ({
  ipAddress: req.ip || req.connection?.remoteAddress,
  userAgent: req.headers['user-agent'],
  userId:    req.user?.id,
});

// POST /api/transactions/analyze  — demo: no DB write
exports.analyze = async (req, res, next) => {
  try {
    const params = {
      amount:          parseFloat(req.body.amount),
      transactionType: req.body.transactionType,
      country:         req.body.country,
      hourOfDay:       parseInt(req.body.hourOfDay),
      deviceRisk:      req.body.deviceRisk,
      velocity:        parseInt(req.body.velocity),
    };

    const { score, verdict, signals, alertsToCreate } = analyzeTransaction(params);

    res.json({
      success: true,
      data: {
        txnId:    generateTxnId(),
        score,
        verdict,
        signals,
        alertCount:  alertsToCreate.length,
        riskLevel:
          score >= 70 ? 'HIGH' :
          score >= 40 ? 'MEDIUM' : 'LOW',
        recommendation:
          verdict === 'block'  ? '🚫 HIGH RISK — Block Recommended' :
          verdict === 'review' ? '⚠️  MEDIUM RISK — Review Required' :
                                 '✅ LOW RISK — Clear to Proceed',
        timestamp: new Date().toISOString(),
      },
    });
  } catch (err) { next(err); }
};

// POST /api/transactions  — analyze + persist
exports.create = async (req, res, next) => {
  try {
    const params = {
      amount:          parseFloat(req.body.amount),
      currency:        req.body.currency,
      transactionType: req.body.transactionType,
      country:         req.body.country,
      hourOfDay:       parseInt(req.body.hourOfDay),
      deviceRisk:      req.body.deviceRisk,
      velocity:        parseInt(req.body.velocity),
      merchantId:      req.body.merchantId,
      accountId:       req.body.accountId,
    };

    const result = await txService.createTransaction(params, getMeta(req));
    const { transaction, alerts } = result;

    res.status(201).json({
      success: true,
      message: `Transaction analyzed: ${transaction.verdict.toUpperCase()}`,
      data: {
        transaction,
        alertsGenerated: alerts.length,
      },
    });
  } catch (err) { next(err); }
};

// GET /api/transactions
exports.list = async (req, res, next) => {
  try {
    const result = await txService.getTransactions(req.query);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
};

// GET /api/transactions/:id
exports.getById = async (req, res, next) => {
  try {
    const transaction = await txService.getTransactionById(req.params.id);
    res.json({ success: true, data: { transaction } });
  } catch (err) { next(err); }
};

// PATCH /api/transactions/:id/review
exports.review = async (req, res, next) => {
  try {
    const { status, reviewNotes } = req.body;
    const transaction = await txService.reviewTransaction(
      req.params.id,
      { status, reviewNotes },
      req.user.id
    );
    res.json({ success: true, message: 'Transaction review saved', data: { transaction } });
  } catch (err) { next(err); }
};

// DELETE /api/transactions/:id  (admin)
exports.remove = async (req, res, next) => {
  try {
    const transaction = await txService.getTransactionById(req.params.id);
    await transaction.destroy();
    res.json({ success: true, message: 'Transaction deleted' });
  } catch (err) { next(err); }
};
