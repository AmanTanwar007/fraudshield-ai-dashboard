'use strict';

const { User, AuditLog } = require('../models');
const { Op } = require('sequelize');

/**
 * Return all users (safe — no passwords).
 */
async function getAllUsers(filters = {}) {
  const where = {};
  if (filters.role)     where.role     = filters.role;
  if (filters.isActive !== undefined) where.isActive = filters.isActive;

  const users = await User.findAll({
    where,
    attributes: { exclude: ['password'] },
    order: [['createdAt', 'DESC']],
  });
  return users;
}

/**
 * Return one user by PK (safe).
 */
async function getUserById(id) {
  const user = await User.findByPk(id, { attributes: { exclude: ['password'] } });
  if (!user) {
    const err = new Error('User not found');
    err.statusCode = 404;
    throw err;
  }
  return user;
}

/**
 * Update allowed fields on a user.
 */
async function updateUser(id, updates, actorId) {
  const user = await User.findByPk(id);
  if (!user) {
    const err = new Error('User not found');
    err.statusCode = 404;
    throw err;
  }

  const ALLOWED = ['name', 'role', 'isActive'];
  const safe    = {};
  ALLOWED.forEach(f => { if (updates[f] !== undefined) safe[f] = updates[f]; });

  await user.update(safe);

  await AuditLog.create({
    userId:       actorId,
    action:       'UPDATE_USER',
    resourceType: 'User',
    resourceId:   id,
    details:      safe,
    success:      true,
  });

  return user.toSafeJSON();
}

/**
 * Soft-delete: deactivate a user.
 */
async function deactivateUser(id, actorId) {
  if (id === actorId) {
    const err = new Error('You cannot deactivate your own account');
    err.statusCode = 400;
    throw err;
  }
  const user = await User.findByPk(id);
  if (!user) {
    const err = new Error('User not found');
    err.statusCode = 404;
    throw err;
  }
  await user.update({ isActive: false });
  await AuditLog.create({
    userId:       actorId,
    action:       'DEACTIVATE_USER',
    resourceType: 'User',
    resourceId:   id,
    success:      true,
  });
  return { message: 'User deactivated successfully' };
}

/**
 * Get audit trail for a user.
 */
async function getUserAuditLogs(userId, { page = 1, limit = 50 } = {}) {
  const offset = (parseInt(page) - 1) * parseInt(limit);
  const { count, rows } = await AuditLog.findAndCountAll({
    where:  { userId },
    order:  [['createdAt', 'DESC']],
    limit:  parseInt(limit),
    offset,
  });
  return {
    total:      count,
    page:       parseInt(page),
    totalPages: Math.ceil(count / parseInt(limit)),
    data:       rows,
  };
}

module.exports = { getAllUsers, getUserById, updateUser, deactivateUser, getUserAuditLogs };
