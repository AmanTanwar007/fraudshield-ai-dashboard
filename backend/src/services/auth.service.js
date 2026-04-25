'use strict';

const jwt      = require('jsonwebtoken');
const { User, AuditLog } = require('../models');

const JWT_SECRET  = process.env.JWT_SECRET  || 'dev_secret_change_me';
const JWT_EXPIRES = process.env.JWT_EXPIRES_IN || '7d';

function signToken(userId) {
  return jwt.sign({ id: userId }, JWT_SECRET, { expiresIn: JWT_EXPIRES });
}

async function register({ name, email, password, role }) {
  const existing = await User.findOne({ where: { email } });
  if (existing) {
    const err = new Error('Email already registered');
    err.statusCode = 409;
    throw err;
  }

  const user = await User.create({ name, email, password, role: role || 'analyst' });
  const token = signToken(user.id);

  return { token, user: user.toSafeJSON() };
}

async function login({ email, password }, requestMeta = {}) {
  const user = await User.findOne({ where: { email } });

  if (!user || !(await user.verifyPassword(password))) {
    await AuditLog.create({
      action:    'LOGIN_FAILED',
      details:   { email },
      ipAddress: requestMeta.ipAddress,
      userAgent: requestMeta.userAgent,
      success:   false,
    });
    const err = new Error('Invalid email or password');
    err.statusCode = 401;
    throw err;
  }

  if (!user.isActive) {
    const err = new Error('Account suspended. Contact support.');
    err.statusCode = 403;
    throw err;
  }

  await user.update({ lastLogin: new Date(), loginCount: user.loginCount + 1 });

  await AuditLog.create({
    userId:    user.id,
    action:    'LOGIN',
    details:   { email },
    ipAddress: requestMeta.ipAddress,
    userAgent: requestMeta.userAgent,
    success:   true,
  });

  const token = signToken(user.id);
  return { token, user: user.toSafeJSON() };
}

async function verifyToken(token) {
  const decoded = jwt.verify(token, JWT_SECRET);
  const user    = await User.findByPk(decoded.id);
  if (!user || !user.isActive) throw new Error('Invalid token');
  return user;
}

module.exports = { register, login, verifyToken, signToken };
