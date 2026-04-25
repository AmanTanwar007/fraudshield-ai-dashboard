'use strict';

const express = require('express');
const router  = express.Router();
const txController  = require('../controllers/transaction.controller');
const { protect, restrict } = require('../middleware/auth.middleware');
const {
  validateTransaction,
  validateReview,
  validatePagination,
} = require('../middleware/validate.middleware');

// ── Public ────────────────────────────────────────────────
// POST /api/transactions/analyze  — analyze without persisting (demo mode)
router.post('/analyze', validateTransaction, txController.analyze);

// ── Protected ─────────────────────────────────────────────
router.use(protect);

// POST /api/transactions           — analyze + persist
router.post('/', validateTransaction, txController.create);

// GET  /api/transactions            — list with filters & pagination
router.get('/', validatePagination, txController.list);

// GET  /api/transactions/:id        — single transaction detail
router.get('/:id', txController.getById);

// PATCH /api/transactions/:id/review — update status (analyst+)
router.patch('/:id/review', restrict('admin', 'analyst'), validateReview, txController.review);

// DELETE /api/transactions/:id      — admin only
router.delete('/:id', restrict('admin'), txController.remove);

module.exports = router;
