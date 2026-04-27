'use strict';

const { sequelize } = require('../config/database');

const User        = require('./user.model')(sequelize);
const Transaction = require('./transaction.model')(sequelize);
const Alert       = require('./alert.model')(sequelize);
const AuditLog    = require('./auditLog.model')(sequelize);

// Associations
User.hasMany(Transaction, { foreignKey: 'reviewedBy', as: 'reviewedTransactions' });
Transaction.belongsTo(User, { foreignKey: 'reviewedBy', as: 'reviewer' });

Transaction.hasMany(Alert, { foreignKey: 'transactionId', as: 'alerts', onDelete: 'CASCADE' });
Alert.belongsTo(Transaction, { foreignKey: 'transactionId', as: 'transaction' });

User.hasMany(AuditLog, { foreignKey: 'userId', as: 'auditLogs' });
AuditLog.belongsTo(User, { foreignKey: 'userId', as: 'user' });

module.exports = { sequelize, User, Transaction, Alert, AuditLog };
