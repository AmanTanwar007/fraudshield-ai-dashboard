'use strict';

const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const AuditLog = sequelize.define('AuditLog', {
    id: {
      type:         DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey:   true,
    },
    userId: {
      type:      DataTypes.UUID,
      allowNull: true,
    },
    action: {
      type:      DataTypes.STRING(100),
      allowNull: false,
    },
    resourceType: {
      type:      DataTypes.STRING(50),
      allowNull: true,
    },
    resourceId: {
      type:      DataTypes.STRING(100),
      allowNull: true,
    },
    details: {
      type:         DataTypes.JSONB,
      defaultValue: {},
    },
    ipAddress: {
      type:      DataTypes.STRING(50),
      allowNull: true,
    },
    success: {
      type:         DataTypes.BOOLEAN,
      defaultValue: true,
    },
  }, {
    tableName:  'audit_logs',
    timestamps: true,
    updatedAt:  false,
  });

  return AuditLog;
};
