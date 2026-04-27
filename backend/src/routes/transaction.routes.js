'use strict';
const r = require('express').Router();
const c = require('../controllers/transaction.controller');
const { protect, restrict } = require('../middleware/auth.middleware');
const { validateTransaction } = require('../middleware/validate.middleware');

r.post('/analyze', validateTransaction, c.analyze);   // PUBLIC
r.use(protect);
r.post('/',           validateTransaction, c.create);
r.get('/',            c.list);
r.get('/:id',         c.getById);
r.patch('/:id/review', restrict('admin','analyst'), c.review);
r.delete('/:id',      restrict('admin'), c.remove);
module.exports = r;
