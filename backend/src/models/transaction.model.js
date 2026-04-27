'use strict';

const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Transaction = sequelize.define('Transaction', {
    id: {
      type:         DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey:   true,
    },
    txnId: {
      type:      DataTypes.STRING(30),
      allowNull: false,
      unique:    true,
    },
    amount: {
      type:      DataTypes.DECIMAL(15, 2),
      allowNull: false,
    },
    currency: {
      type:         DataTypes.STRING(3),
      defaultValue: 'USD',
    },
    transactionType: {
      type:      DataTypes.ENUM('online_purchase','wire_transfer','atm_withdrawal','pos_payment','crypto_exchange'),
      allowNull: false,
    },
    country: {
      type:      DataTypes.STRING(100),
      allowNull: false,
    },
    hourOfDay: {
      type:      DataTypes.INTEGER,
      allowNull: false,
    },
    deviceRisk: {
      type:      DataTypes.ENUM('trusted','new','flagged','vpn_proxy'),
      allowNull: false,
    },
    velocity: {
      type:         DataTypes.INTEGER,
      defaultValue: 1,
    },
    riskScore: {
      type:      DataTypes.INTEGER,
      allowNull: false,
    },
    verdict: {
      type:      DataTypes.ENUM('clear','review','block'),
      allowNull: false,
    },
    signals: {
      type:         DataTypes.JSONB,
      defaultValue: [],
    },
    status: {
      type:         DataTypes.ENUM('pending','reviewed','escalated','resolved'),
      defaultValue: 'pending',
    },
    reviewedBy: {
      type:       DataTypes.UUID,
      allowNull:  true,
    },
    reviewedAt: {
      type:      DataTypes.DATE,
      allowNull: true,
    },
    reviewNotes: {
      type:      DataTypes.TEXT,
      allowNull: true,
    },
    ipAddress: {
      type:      DataTypes.STRING(50),
      allowNull: true,
    },
    merchantId: {
      type:      DataTypes.STRING(100),
      allowNull: true,
    },
    accountId: {
      type:      DataTypes.STRING(100),
      allowNull: true,
    },
  }, {
    tableName:  'transactions',
    timestamps: true,
    indexes: [
      { fields: ['verdict'] },
      { fields: ['riskScore'] },
      { fields: ['status'] },
      { fields: ['createdAt'] },
      { fields: ['txnId'], unique: true },
    ],
  });

  return Transaction;
};
