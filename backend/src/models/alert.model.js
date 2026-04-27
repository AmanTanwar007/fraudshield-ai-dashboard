'use strict';

const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Alert = sequelize.define('Alert', {
    id: {
      type:         DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey:   true,
    },
    transactionId: {
      type:      DataTypes.UUID,
      allowNull: false,
    },
    severity: {
      type:      DataTypes.ENUM('critical','high','medium','low','info'),
      allowNull: false,
    },
    category: {
      type:      DataTypes.ENUM('velocity_breach','high_value','high_risk_country','device_flagged','off_hours','crypto_transaction','wire_transfer','vpn_detected','multi_factor'),
      allowNull: false,
    },
    title: {
      type:      DataTypes.STRING(255),
      allowNull: false,
    },
    message: {
      type:      DataTypes.TEXT,
      allowNull: false,
    },
    isRead: {
      type:         DataTypes.BOOLEAN,
      defaultValue: false,
    },
    isResolved: {
      type:         DataTypes.BOOLEAN,
      defaultValue: false,
    },
    resolvedAt: {
      type:      DataTypes.DATE,
      allowNull: true,
    },
  }, {
    tableName:  'alerts',
    timestamps: true,
  });

  return Alert;
};
