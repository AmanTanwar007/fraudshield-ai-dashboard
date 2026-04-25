'use strict';

const express = require('express');
const router  = express.Router();
const authController = require('../controllers/auth.controller');
const { validateRegister, validateLogin } = require('../middleware/validate.middleware');
const { protect } = require('../middleware/auth.middleware');

// POST /api/auth/register
router.post('/register', validateRegister, authController.register);

// POST /api/auth/login
router.post('/login', validateLogin, authController.login);

// GET  /api/auth/me  (protected)
router.get('/me', protect, authController.getMe);

// PATCH /api/auth/change-password (protected)
router.patch('/change-password', protect, authController.changePassword);

module.exports = router;
