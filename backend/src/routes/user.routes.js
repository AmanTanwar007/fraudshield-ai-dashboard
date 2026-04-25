'use strict';

const express = require('express');
const router  = express.Router();
const userController = require('../controllers/user.controller');
const { protect, restrict } = require('../middleware/auth.middleware');

router.use(protect);

// GET  /api/users         — list all users (admin only)
router.get('/',    restrict('admin'), userController.list);

// GET  /api/users/:id     — single user (admin only)
router.get('/:id', restrict('admin'), userController.getById);

// PATCH /api/users/:id    — update role / active status (admin)
router.patch('/:id', restrict('admin'), userController.update);

// DELETE /api/users/:id   — soft-delete (admin)
router.delete('/:id', restrict('admin'), userController.remove);

// GET /api/users/:id/audit-logs
router.get('/:id/audit-logs', restrict('admin'), userController.getAuditLogs);

module.exports = router;
