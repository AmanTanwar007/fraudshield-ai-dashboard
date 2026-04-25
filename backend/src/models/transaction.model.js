'use strict';

const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Transaction = sequelize.define('Transaction', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    txnId: {
      type: DataTypes.STRING(20),
      unique: true,
      allowNull: false,
    },
    // ── Transaction Details ─────────────────────────────
    amount: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
      validate: { min: 0.01 },
    },
    currency: {
      type: DataTypes.STRING(3),
      defaultValue: 'USD',
    },
    transactionType: {
      type: DataTypes.ENUM(
        'online_purchase', 'wire_transfer', 'atm_withdrawal',
        'pos_payment', 'crypto_exchange'
      ),
      allowNull: false,
    },
    country: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    hourOfDay: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: { min: 0, max: 23 },
    },
    deviceRisk: {
      type: DataTypes.ENUM('trusted', 'new', 'flagged', 'vpn_proxy'),
      allowNull: false,
    },
    velocity: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
      validate: { min: 0 },
    },
    // ── Computed Risk Fields ─────────────────────────────
    riskScore: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: { min: 0, max: 100 },
    },
    verdict: {
      type: DataTypes.ENUM('clear', 'review', 'block'),
      allowNull: false,
    },
    signals: {
      type: DataTypes.JSONB,  // Array of {cls, msg} objects
      defaultValue: [],
    },
    // ── Status / Workflow ───────────────────────────────
    status: {
      type: DataTypes.ENUM('pending', 'reviewed', 'escalated', 'resolved'),
      defaultValue: 'pending',
    },
    reviewedBy: {
      type: DataTypes.UUID,
      references: { model: 'users', key: 'id' },
      allowNull: true,
    },
    reviewedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    reviewNotes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    // ── Metadata ─────────────────────────────────────────
    ipAddress: {
      type: DataTypes.INET,
      allowNull: true,
    },
    userAgent: {
      type: DataTypes.STRING(512),
      allowNull: true,
    },
    merchantId: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    accountId: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
  }, {
    tableName: 'transactions',
    timestamps: true,
    indexes: [
      { fields: ['riskScore'] },
      { fields: ['verdict'] },
      { fields: ['status'] },
      { fields: ['createdAt'] },
      { fields: ['country'] },
      { fields: ['txnId'], unique: true },
    ],
  });

  return Transaction;
};
