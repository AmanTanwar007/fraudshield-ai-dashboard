'use strict';
const r = require('express').Router();
const c = require('../controllers/dashboard.controller');
const { protect } = require('../middleware/auth.middleware');
r.use(protect);
r.get('/stats',  c.getStats);
r.get('/ticker', c.getTicker);
r.get('/health', c.getSystemHealth);
module.exports = r;
