'use strict';

const express      = require('express');
const cors         = require('cors');
const helmet       = require('helmet');
const morgan       = require('morgan');
const compression  = require('compression');
const rateLimit    = require('express-rate-limit');
const logger       = require('./utils/logger');

// ── Route Imports ─────────────────────────────────────────
const authRoutes        = require('./routes/auth.routes');
const transactionRoutes = require('./routes/transaction.routes');
const dashboardRoutes   = require('./routes/dashboard.routes');
const alertRoutes       = require('./routes/alert.routes');
const userRoutes        = require('./routes/user.routes');
const analyticsRoutes   = require('./routes/analytics.routes');

// ── Error Handler ─────────────────────────────────────────
const { errorHandler, notFoundHandler } = require('./middleware/error.middleware');

const app = express();

// ════════════════════════════════════════════════════════════
// SECURITY MIDDLEWARE
// ════════════════════════════════════════════════════════════
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

// CORS
const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:3000')
  .split(',')
  .map(o => o.trim());

app.use(cors({
  origin: (origin, callback) => {
    // Allow no-origin requests (curl, Postman) in development
    if (!origin && process.env.NODE_ENV !== 'production') return callback(null, true);
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error(`CORS policy violation: origin ${origin} not allowed`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max:      parseInt(process.env.RATE_LIMIT_MAX)        || 100,
  standardHeaders: true,
  legacyHeaders:   false,
  message: { success: false, message: 'Too many requests. Please try again later.' },
});

// Stricter limit for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { success: false, message: 'Too many auth attempts. Please wait 15 minutes.' },
});

app.use('/api/', limiter);
app.use('/api/auth/', authLimiter);

// ════════════════════════════════════════════════════════════
// GENERAL MIDDLEWARE
// ════════════════════════════════════════════════════════════
app.use(compression());
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// HTTP request logger
app.use(morgan('combined', {
  stream: { write: (msg) => logger.info(msg.trim()) },
  skip: (req) => req.url === '/api/health',
}));

// Attach request timestamp
app.use((req, _res, next) => {
  req.requestTime = new Date().toISOString();
  next();
});

// ════════════════════════════════════════════════════════════
// ROUTES
// ════════════════════════════════════════════════════════════
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

app.use('/api/auth',         authRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/dashboard',    dashboardRoutes);
app.use('/api/alerts',       alertRoutes);
app.use('/api/users',        userRoutes);
app.use('/api/analytics',    analyticsRoutes);

// ════════════════════════════════════════════════════════════
// ERROR HANDLING
// ════════════════════════════════════════════════════════════
app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
