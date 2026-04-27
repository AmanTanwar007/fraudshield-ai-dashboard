'use strict';

const txService = require('../services/transaction.service');
const { analyzeTransaction, generateTxnId } = require('../services/fraudEngine.service');

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
        txnId:   generateTxnId(),
        score,
        verdict,
        signals,
        alertCount: alertsToCreate.length,
        riskLevel:  score >= 70 ? 'HIGH' : score >= 40 ? 'MEDIUM' : 'LOW',
        recommendation:
          verdict === 'block'  ? '🚫 HIGH RISK — Block Recommended' :
          verdict === 'review' ? '⚠️ MEDIUM RISK — Review Required' :
                                 '✅ LOW RISK — Clear to Proceed',
        timestamp: new Date().toISOString(),
      },
    });
  } catch (err) { next(err); }
};

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
    const meta   = { ipAddress: req.ip, userId: req.user?.id };
    const result = await txService.createTransaction(params, meta);
    res.status(201).json({ success: true, message: `Transaction: ${result.transaction.verdict.toUpperCase()}`, data: result });
  } catch (err) { next(err); }
};

exports.list = async (req, res, next) => {
  try {
    const result = await txService.getTransactions(req.query);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
};

exports.getById = async (req, res, next) => {
  try {
    const transaction = await txService.getTransactionById(req.params.id);
    res.json({ success: true, data: { transaction } });
  } catch (err) { next(err); }
};

exports.review = async (req, res, next) => {
  try {
    const transaction = await txService.reviewTransaction(req.params.id, req.body, req.user.id);
    res.json({ success: true, message: 'Review saved', data: { transaction } });
  } catch (err) { next(err); }
};

exports.remove = async (req, res, next) => {
  try {
    const transaction = await txService.getTransactionById(req.params.id);
    await transaction.destroy();
    res.json({ success: true, message: 'Deleted' });
  } catch (err) { next(err); }
};
