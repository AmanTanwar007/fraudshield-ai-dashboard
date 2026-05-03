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
app.use(helmet());

const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: function (origin, callback) {
      // 1. Allow requests with no origin (like mobile apps, curl, or server-to-server)
      if (!origin) return callback(null, true);

      // 2. Check if origin is in your explicit ALLOWED_ORIGINS whitelist
      const isWhitelisted = allowedOrigins.includes(origin);

      // 3. Check if origin is a Vercel subdomain (covers all preview & production URLs)
      const isVercel = origin.endsWith('.vercel.app');

      // 4. Allow if it's whitelisted, a Vercel URL, or if no whitelist is set (for testing)
      if (isWhitelisted || isVercel || allowedOrigins.length === 0) {
        return callback(null, true);
      }

      // If it fails all checks, block it
      console.error(`CORS Blocked: ${origin}`); // Helpful for debugging in Vercel logs
      callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
  })
);

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