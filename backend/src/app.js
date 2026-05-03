// backend/src/app.js

'use strict';

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const rateLimit = require('express-rate-limit');

const app = express();

/* ─────────────────────────────────────────────
   Security
───────────────────────────────────────────── */
const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

const corsOptions = {
  origin: function (origin, callback) {
    // Requests without origin (Postman/mobile/server)
    if (!origin) return callback(null, true);

    const isWhitelisted = allowedOrigins.includes(origin);
    const isVercel = origin.includes('.vercel.app');

    if (isWhitelisted || isVercel || allowedOrigins.length === 0) {
      return callback(null, true);
    }

    console.log('Blocked by CORS:', origin);

    // Do NOT throw error, just deny silently
    return callback(null, false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization']
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));
/* ─────────────────────────────────────────────
   General
───────────────────────────────────────────── */
app.use(compression());
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

/* ─────────────────────────────────────────────
   Health Check
───────────────────────────────────────────── */
app.get('/api/health', (_req, res) => {
  res.json({
    success: true,
    service: 'BackHackers AI API',
    version: '1.0.0',
    status: 'operational',
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()),
  });
});

/* ─────────────────────────────────────────────
   Routes
───────────────────────────────────────────── */
app.use('/api/auth', require('./routes/auth.routes'));
app.use('/api/transactions', require('./routes/transaction.routes'));
app.use('/api/dashboard', require('./routes/dashboard.routes'));
app.use('/api/alerts', require('./routes/alert.routes'));
app.use('/api/users', require('./routes/user.routes'));
app.use('/api/analytics', require('./routes/analytics.routes'));

/* ─────────────────────────────────────────────
   404
───────────────────────────────────────────── */
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.method} ${req.originalUrl} not found`,
  });
});

/* ─────────────────────────────────────────────
   Global Error Handler
───────────────────────────────────────────── */
app.use((err, req, res, _next) => {
  console.error('Error:', err.message);

  if (err.name === 'SequelizeValidationError') {
    return res.status(400).json({
      success: false,
      message: 'Validation error',
      errors: err.errors.map((e) => ({
        field: e.path,
        message: e.message,
      })),
    });
  }

  if (
    err.name === 'JsonWebTokenError' ||
    err.name === 'TokenExpiredError'
  ) {
    return res.status(401).json({
      success: false,
      message: 'Invalid or expired token',
    });
  }

  res.status(err.statusCode || 500).json({
    success: false,
    message: err.message || 'Internal server error',
  });
});

module.exports = app;