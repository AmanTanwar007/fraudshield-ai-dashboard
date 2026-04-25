'use strict';

const express = require('express');
const router  = express.Router();
const alertController = require('../controllers/alert.controller');
const { protect, restrict } = require('../middleware/auth.middleware');
const { validatePagination } = require('../middleware/validate.middleware');

router.use(protect);

// GET    /api/alerts              — list alerts
router.get('/', validatePagination, alertController.list);

// GET    /api/alerts/unread-count — badge count
router.get('/unread-count', alertController.unreadCount);

// GET    /api/alerts/:id          — single alert
router.get('/:id', alertController.getById);

// PATCH  /api/alerts/:id/read     — mark as read
router.patch('/:id/read', alertController.markRead);

// PATCH  /api/alerts/read-all     — mark all read
router.patch('/read-all', alertController.markAllRead);

// PATCH  /api/alerts/:id/resolve  — resolve alert (analyst+)
router.patch('/:id/resolve', restrict('admin', 'analyst'), alertController.resolve);

// DELETE /api/alerts/:id          — admin only
router.delete('/:id', restrict('admin'), alertController.remove);

module.exports = router;
