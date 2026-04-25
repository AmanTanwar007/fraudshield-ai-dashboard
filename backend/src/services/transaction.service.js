'use strict';

const { Transaction, Alert, AuditLog } = require('../models');
const { analyzeTransaction, generateTxnId } = require('./fraudEngine.service');
const { Op } = require('sequelize');
const logger = require('../utils/logger');

/**
 * Analyze and persist a transaction.
 */
async function createTransaction(params, requestMeta = {}) {
  // 1. Run fraud engine
  const { score, verdict, signals, alertsToCreate } = analyzeTransaction(params);

  // 2. Persist transaction
  const txnId = generateTxnId();
  const transaction = await Transaction.create({
    txnId,
    amount:          params.amount,
    currency:        params.currency || 'USD',
    transactionType: params.transactionType,
    country:         params.country,
    hourOfDay:       params.hourOfDay,
    deviceRisk:      params.deviceRisk,
    velocity:        params.velocity,
    riskScore:       score,
    verdict,
    signals,
    ipAddress:       requestMeta.ipAddress,
    userAgent:       requestMeta.userAgent,
    merchantId:      params.merchantId,
    accountId:       params.accountId,
  });

  // 3. Create associated alerts
  if (alertsToCreate.length > 0) {
    await Alert.bulkCreate(
      alertsToCreate.map(a => ({ ...a, transactionId: transaction.id }))
    );
  }

  // 4. Audit log
  await AuditLog.create({
    userId:       requestMeta.userId || null,
    action:       'ANALYZE_TRANSACTION',
    resourceType: 'Transaction',
    resourceId:   transaction.id,
    details:      { txnId, score, verdict, alertCount: alertsToCreate.length },
    ipAddress:    requestMeta.ipAddress,
    userAgent:    requestMeta.userAgent,
    success:      true,
  });

  logger.info(`Transaction analyzed: ${txnId} | Score: ${score} | Verdict: ${verdict}`);

  return { transaction, alerts: alertsToCreate };
}

/**
 * Get paginated list of transactions with filters.
 */
async function getTransactions({ page = 1, limit = 20, verdict, status, country, minScore, maxScore, startDate, endDate }) {
  const where = {};

  if (verdict)   where.verdict   = verdict;
  if (status)    where.status    = status;
  if (country)   where.country   = country;
  if (minScore || maxScore) {
    where.riskScore = {};
    if (minScore) where.riskScore[Op.gte] = parseInt(minScore);
    if (maxScore) where.riskScore[Op.lte] = parseInt(maxScore);
  }
  if (startDate || endDate) {
    where.createdAt = {};
    if (startDate) where.createdAt[Op.gte] = new Date(startDate);
    if (endDate)   where.createdAt[Op.lte] = new Date(endDate);
  }

  const offset = (parseInt(page) - 1) * parseInt(limit);

  const { count, rows } = await Transaction.findAndCountAll({
    where,
    limit:    parseInt(limit),
    offset,
    order:    [['createdAt', 'DESC']],
    include:  [{ association: 'reviewer', attributes: ['id', 'name', 'email'] }],
  });

  return {
    total:      count,
    page:       parseInt(page),
    totalPages: Math.ceil(count / parseInt(limit)),
    data:       rows,
  };
}

/**
 * Get single transaction by ID with its alerts.
 */
async function getTransactionById(id) {
  const transaction = await Transaction.findOne({
    where: { [Op.or]: [{ id }, { txnId: id }] },
    include: [
      { association: 'alerts' },
      { association: 'reviewer', attributes: ['id', 'name', 'email'] },
    ],
  });

  if (!transaction) {
    const err = new Error('Transaction not found');
    err.statusCode = 404;
    throw err;
  }

  return transaction;
}

/**
 * Update transaction status (review workflow).
 */
async function reviewTransaction(id, { status, reviewNotes }, reviewerId) {
  const transaction = await getTransactionById(id);

  await transaction.update({
    status,
    reviewNotes,
    reviewedBy: reviewerId,
    reviewedAt: new Date(),
  });

  await AuditLog.create({
    userId:       reviewerId,
    action:       'REVIEW_TRANSACTION',
    resourceType: 'Transaction',
    resourceId:   transaction.id,
    details:      { oldStatus: transaction.status, newStatus: status, reviewNotes },
    success:      true,
  });

  return transaction;
}

module.exports = { createTransaction, getTransactions, getTransactionById, reviewTransaction };
