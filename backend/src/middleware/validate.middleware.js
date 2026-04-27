'use strict';

const { body, validationResult } = require('express-validator');

function handle(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array().map(e => ({ field: e.path, message: e.msg })),
    });
  }
  next();
}

const validateRegister = [
  body('name').trim().isLength({ min: 2 }).withMessage('Name min 2 chars'),
  body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
  body('password').isLength({ min: 8 }).withMessage('Password min 8 chars'),
  handle,
];

const validateLogin = [
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty().withMessage('Password required'),
  handle,
];

const validateTransaction = [
  body('amount').isFloat({ min: 0.01 }).withMessage('Amount must be positive'),
  body('transactionType')
    .isIn(['online_purchase','wire_transfer','atm_withdrawal','pos_payment','crypto_exchange'])
    .withMessage('Invalid transaction type'),
  body('country').trim().notEmpty().withMessage('Country required'),
  body('hourOfDay').isInt({ min: 0, max: 23 }).withMessage('Hour must be 0-23'),
  body('deviceRisk')
    .isIn(['trusted','new','flagged','vpn_proxy'])
    .withMessage('Invalid device risk'),
  body('velocity').isInt({ min: 0 }).withMessage('Velocity must be >= 0'),
  handle,
];

module.exports = { validateRegister, validateLogin, validateTransaction };
