'use strict';

const { body, query, param, validationResult } = require('express-validator');

// ── Reusable: check validation results ───────────────────
function handleValidation(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors:  errors.array().map(e => ({ field: e.path, message: e.msg })),
    });
  }
  next();
}

// ── Auth validators ───────────────────────────────────────
const validateRegister = [
  body('name').trim().isLength({ min: 2, max: 100 }).withMessage('Name must be 2–100 characters'),
  body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
    .matches(/^(?=.*[A-Z])(?=.*[0-9])/).withMessage('Password must contain an uppercase letter and a number'),
  body('role').optional().isIn(['admin', 'analyst', 'viewer']).withMessage('Invalid role'),
  handleValidation,
];

const validateLogin = [
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty().withMessage('Password required'),
  handleValidation,
];

// ── Transaction validators ────────────────────────────────
const validateTransaction = [
  body('amount')
    .isFloat({ min: 0.01 })
    .withMessage('Amount must be a positive number'),
  body('transactionType')
    .isIn(['online_purchase', 'wire_transfer', 'atm_withdrawal', 'pos_payment', 'crypto_exchange'])
    .withMessage('Invalid transaction type'),
  body('country')
    .trim().notEmpty().isLength({ min: 2, max: 100 })
    .withMessage('Country is required'),
  body('hourOfDay')
    .isInt({ min: 0, max: 23 })
    .withMessage('Hour of day must be 0–23'),
  body('deviceRisk')
    .isIn(['trusted', 'new', 'flagged', 'vpn_proxy'])
    .withMessage('Invalid device risk value'),
  body('velocity')
    .isInt({ min: 0, max: 100 })
    .withMessage('Velocity must be 0–100'),
  body('currency').optional().isLength({ min: 3, max: 3 }).isAlpha(),
  body('merchantId').optional().trim().isLength({ max: 100 }),
  body('accountId').optional().trim().isLength({ max: 100 }),
  handleValidation,
];

// ── Review validator ──────────────────────────────────────
const validateReview = [
  param('id').isUUID().withMessage('Invalid transaction ID'),
  body('status')
    .isIn(['pending', 'reviewed', 'escalated', 'resolved'])
    .withMessage('Invalid status'),
  body('reviewNotes').optional().trim().isLength({ max: 2000 }),
  handleValidation,
];

// ── Pagination validators ─────────────────────────────────
const validatePagination = [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  handleValidation,
];

module.exports = {
  validateRegister,
  validateLogin,
  validateTransaction,
  validateReview,
  validatePagination,
};
