// auth.routes.js
'use strict';
const r = require('express').Router();
const c = require('../controllers/auth.controller');
const { validateRegister, validateLogin } = require('../middleware/validate.middleware');
const { protect } = require('../middleware/auth.middleware');
r.post('/register', validateRegister, c.register);
r.post('/login',    validateLogin,    c.login);
r.get('/me',        protect,          c.getMe);
r.patch('/change-password', protect,  c.changePassword);
module.exports = r;
