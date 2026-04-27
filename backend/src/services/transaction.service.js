'use strict';

const { Transaction, Alert, AuditLog } = require('../models');
const { analyzeTransaction, generateTxnId } = require('./fraudEngine.service');
const { Op } = require('sequelize');

async function createTransaction(params, meta = {}) {
  const { score, verdict, signals, alertsToCreate } = analyzeTransaction(params);
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
    ipAddress:       meta.ipAddress,
    merchantId:      params.merchantId,
    accountId:       params.accountId,
  });

  if (alertsToCreate.length > 0) {
    await Alert.bulkCreate(alertsToCreate.map(a => ({ ...a, transactionId: transaction.id })));
  }

  return { transaction, alerts: alertsToCreate };
}

async function getTransactions(query) {
  const { page = 1, limit = 20, verdict, status, country, minScore, maxScore } = query;
  const where = {};
  if (verdict)   where.verdict   = verdict;
  if (status)    where.status    = status;
  if (country)   where.country   = country;
  if (minScore || maxScore) {
    where.riskScore = {};
    if (minScore) where.riskScore[Op.gte] = parseInt(minScore);
    if (maxScore) where.riskScore[Op.lte] = parseInt(maxScore);
  }
  const offset = (parseInt(page) - 1) * parseInt(limit);
  const { count, rows } = await Transaction.findAndCountAll({
    where, limit: parseInt(limit), offset, order: [['createdAt', 'DESC']],
  });
  return { total: count, page: parseInt(page), totalPages: Math.ceil(count / parseInt(limit)), data: rows };
}

async function getTransactionById(id) {
  const transaction = await Transaction.findOne({
    where: { [Op.or]: [{ id }, { txnId: id }] },
    include: [{ association: 'alerts' }],
  });
  if (!transaction) {
    const err = new Error('Transaction not found');
    err.statusCode = 404;
    throw err;
  }
  return transaction;
}

async function reviewTransaction(id, { status, reviewNotes }, reviewerId) {
  const transaction = await getTransactionById(id);
  await transaction.update({ status, reviewNotes, reviewedBy: reviewerId, reviewedAt: new Date() });
  return transaction;
}

module.exports = { createTransaction, getTransactions, getTransactionById, reviewTransaction };
