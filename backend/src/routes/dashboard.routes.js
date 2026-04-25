'use strict';

const express = require('express');
const router  = express.Router();
const dashController = require('../controllers/dashboard.controller');
const { protect } = require('../middleware/auth.middleware');

router.use(protect);

// GET /api/dashboard/stats    — all live dashboard data
router.get('/stats', dashController.getStats);

// GET /api/dashboard/ticker   — last 20 transactions for live ticker
router.get('/ticker', dashController.getTicker);

// GET /api/dashboard/health   — system health card
router.get('/health', dashController.getSystemHealth);

module.exports = router;
