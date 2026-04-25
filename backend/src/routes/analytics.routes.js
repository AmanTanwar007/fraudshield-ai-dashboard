'use strict';

const express = require('express');
const router  = express.Router();
const analyticsController = require('../controllers/analytics.controller');
const { protect, restrict } = require('../middleware/auth.middleware');

router.use(protect);

// GET /api/analytics/overview         — top-level KPIs
router.get('/overview', analyticsController.overview);

// GET /api/analytics/risk-distribution — score histogram
router.get('/risk-distribution', analyticsController.riskDistribution);

// GET /api/analytics/country-heatmap  — fraud by country
router.get('/country-heatmap', analyticsController.countryHeatmap);

// GET /api/analytics/trend            — daily fraud trend (last N days)
router.get('/trend', analyticsController.trend);

// GET /api/analytics/device-breakdown — device risk breakdown
router.get('/device-breakdown', analyticsController.deviceBreakdown);

// GET /api/analytics/type-breakdown   — fraud by transaction type
router.get('/type-breakdown', analyticsController.typeBreakdown);

// GET /api/analytics/top-signals      — most common fraud signals
router.get('/top-signals', analyticsController.topSignals);

// GET /api/analytics/audit-logs  (admin)
router.get('/audit-logs', restrict('admin'), analyticsController.auditLogs);

module.exports = router;
