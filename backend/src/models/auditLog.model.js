'use strict';

const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const AuditLog = sequelize.define('AuditLog', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: true, // null for system actions
      references: { model: 'users', key: 'id' },
    },
    action: {
      type: DataTypes.STRING(100),
      allowNull: false,
      // e.g. 'LOGIN', 'ANALYZE_TRANSACTION', 'REVIEW_TRANSACTION', 'RESOLVE_ALERT'
    },
    resourceType: {
      type: DataTypes.STRING(50),
      allowNull: true,
      // e.g. 'Transaction', 'Alert', 'User'
    },
    resourceId: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    details: {
      type: DataTypes.JSONB,
      defaultValue: {},
    },
    ipAddress: {
      type: DataTypes.INET,
      allowNull: true,
    },
    userAgent: {
      type: DataTypes.STRING(512),
      allowNull: true,
    },
    success: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
  }, {
    tableName: 'audit_logs',
    timestamps: true,
    updatedAt: false, // audit logs are immutable
    indexes: [
      { fields: ['userId'] },
      { fields: ['action'] },
      { fields: ['createdAt'] },
    ],
  });

  return AuditLog;
};
