'use strict';

/**
 * Integration tests for the BackHackers AI REST API.
 * These tests use an in-memory mock approach so they run without a live DB.
 *
 * For real integration tests against a test DB, set TEST_DB=true
 * and ensure a Postgres instance is running.
 */

const request = require('supertest');

// ── Mock Sequelize before importing app ───────────────────
jest.mock('../src/models', () => {
  const mockUser = {
    id:        'user-uuid-001',
    name:      'Test Admin',
    email:     'admin@test.com',
    role:      'admin',
    isActive:  true,
    loginCount: 0,
    toSafeJSON: () => ({ id: 'user-uuid-001', name: 'Test Admin', email: 'admin@test.com', role: 'admin' }),
    verifyPassword: jest.fn().mockResolvedValue(true),
    update:    jest.fn().mockResolvedValue(true),
  };

  const mockTransaction = {
    id:        'txn-uuid-001',
    txnId:     'TXN-TEST-001',
    amount:    '500.00',
    verdict:   'clear',
    riskScore: 20,
    signals:   [],
    destroy:   jest.fn(),
    update:    jest.fn().mockResolvedValue(true),
  };

  const mockAlert = {
    id:         'alert-uuid-001',
    severity:   'high',
    isRead:     false,
    isResolved: false,
    update:     jest.fn().mockResolvedValue(true),
    destroy:    jest.fn(),
  };

  return {
    sequelize: {
      authenticate: jest.fn().mockResolvedValue(true),
      sync:         jest.fn().mockResolvedValue(true),
      query:        jest.fn().mockResolvedValue([]),
    },
    User: {
      findOne:   jest.fn().mockResolvedValue(mockUser),
      findByPk:  jest.fn().mockResolvedValue(mockUser),
      findAll:   jest.fn().mockResolvedValue([mockUser]),
      create:    jest.fn().mockResolvedValue(mockUser),
      count:     jest.fn().mockResolvedValue(5),
      update:    jest.fn().mockResolvedValue([1]),
    },
    Transaction: {
      findOne:        jest.fn().mockResolvedValue(mockTransaction),
      findByPk:       jest.fn().mockResolvedValue(mockTransaction),
      findAll:        jest.fn().mockResolvedValue([mockTransaction]),
      findAndCountAll: jest.fn().mockResolvedValue({ count: 1, rows: [mockTransaction] }),
      create:         jest.fn().mockResolvedValue(mockTransaction),
      bulkCreate:     jest.fn().mockResolvedValue([mockTransaction]),
      count:          jest.fn().mockResolvedValue(10),
    },
    Alert: {
      findOne:        jest.fn().mockResolvedValue(mockAlert),
      findByPk:       jest.fn().mockResolvedValue(mockAlert),
      findAll:        jest.fn().mockResolvedValue([mockAlert]),
      findAndCountAll: jest.fn().mockResolvedValue({ count: 1, rows: [mockAlert] }),
      bulkCreate:     jest.fn().mockResolvedValue([mockAlert]),
      create:         jest.fn().mockResolvedValue(mockAlert),
      count:          jest.fn().mockResolvedValue(3),
      update:         jest.fn().mockResolvedValue([1]),
    },
    AuditLog: {
      create:         jest.fn().mockResolvedValue({}),
      findAll:        jest.fn().mockResolvedValue([]),
      findAndCountAll: jest.fn().mockResolvedValue({ count: 0, rows: [] }),
    },
  };
});

// ── Mock JWT verify ───────────────────────────────────────
jest.mock('jsonwebtoken', () => ({
  sign:   jest.fn().mockReturnValue('mock.jwt.token'),
  verify: jest.fn().mockReturnValue({ id: 'user-uuid-001' }),
}));

// ── Mock bcrypt ───────────────────────────────────────────
jest.mock('bcryptjs', () => ({
  hash:    jest.fn().mockResolvedValue('hashed_password'),
  compare: jest.fn().mockResolvedValue(true),
}));

const app = require('../src/app');

// ── Helper token ──────────────────────────────────────────
const AUTH_TOKEN = 'Bearer mock.jwt.token';

// ═══════════════════════════════════════════════════════════
// HEALTH CHECK
// ═══════════════════════════════════════════════════════════
describe('GET /api/health', () => {
  it('returns 200 with operational status', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.service).toBe('BackHackers AI API');
    expect(res.body.status).toBe('operational');
  });
});

// ═══════════════════════════════════════════════════════════
// AUTH ROUTES
// ═══════════════════════════════════════════════════════════
describe('POST /api/auth/login', () => {
  it('returns 200 + token on valid credentials', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@test.com', password: 'Admin@1234' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('token');
    expect(res.body.data).toHaveProperty('user');
  });

  it('returns 400 on missing fields', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@test.com' });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 400 on invalid email', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'not-an-email', password: 'pass' });
    expect(res.status).toBe(400);
  });
});

describe('POST /api/auth/register', () => {
  it('returns 201 on valid registration', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Test User', email: 'new@test.com', password: 'NewPass1' });
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('token');
  });

  it('returns 400 if password too short', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Test', email: 'x@x.com', password: 'short' });
    expect(res.status).toBe(400);
    expect(res.body.errors).toBeDefined();
  });

  it('returns 400 if name missing', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'x@x.com', password: 'ValidPass1' });
    expect(res.status).toBe(400);
  });
});

describe('GET /api/auth/me', () => {
  it('returns 401 without token', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  it('returns 200 with valid token', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', AUTH_TOKEN);
    expect(res.status).toBe(200);
    expect(res.body.data.user).toHaveProperty('email');
  });
});

// ═══════════════════════════════════════════════════════════
// TRANSACTION — PUBLIC ANALYZE ENDPOINT
// ═══════════════════════════════════════════════════════════
describe('POST /api/transactions/analyze (public)', () => {
  const validPayload = {
    amount: 500,
    transactionType: 'online_purchase',
    country: 'United States',
    hourOfDay: 14,
    deviceRisk: 'trusted',
    velocity: 1,
  };

  it('returns 200 with score, verdict, and signals', async () => {
    const res = await request(app)
      .post('/api/transactions/analyze')
      .send(validPayload);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('score');
    expect(res.body.data).toHaveProperty('verdict');
    expect(res.body.data).toHaveProperty('signals');
    expect(res.body.data).toHaveProperty('recommendation');
    expect(res.body.data).toHaveProperty('txnId');
  });

  it('verdict is one of clear | review | block', async () => {
    const res = await request(app)
      .post('/api/transactions/analyze')
      .send(validPayload);
    expect(['clear', 'review', 'block']).toContain(res.body.data.verdict);
  });

  it('score is between 0 and 100', async () => {
    const res = await request(app)
      .post('/api/transactions/analyze')
      .send(validPayload);
    const { score } = res.body.data;
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });

  it('signals is a non-empty array with cls and msg', async () => {
    const res = await request(app)
      .post('/api/transactions/analyze')
      .send(validPayload);
    const { signals } = res.body.data;
    expect(Array.isArray(signals)).toBe(true);
    expect(signals.length).toBeGreaterThan(0);
    signals.forEach(s => {
      expect(s).toHaveProperty('cls');
      expect(s).toHaveProperty('msg');
    });
  });

  it('returns 400 on missing required fields', async () => {
    const res = await request(app)
      .post('/api/transactions/analyze')
      .send({ amount: 500 });
    expect(res.status).toBe(400);
    expect(res.body.errors).toBeDefined();
  });

  it('returns 400 on invalid transactionType', async () => {
    const res = await request(app)
      .post('/api/transactions/analyze')
      .send({ ...validPayload, transactionType: 'invalid_type' });
    expect(res.status).toBe(400);
  });

  it('returns 400 on hourOfDay out of range', async () => {
    const res = await request(app)
      .post('/api/transactions/analyze')
      .send({ ...validPayload, hourOfDay: 25 });
    expect(res.status).toBe(400);
  });

  it('returns 400 on invalid deviceRisk', async () => {
    const res = await request(app)
      .post('/api/transactions/analyze')
      .send({ ...validPayload, deviceRisk: 'unknown' });
    expect(res.status).toBe(400);
  });

  it('handles high-risk payload returning block verdict', async () => {
    const res = await request(app)
      .post('/api/transactions/analyze')
      .send({
        amount: 20000,
        transactionType: 'crypto_exchange',
        country: 'Nigeria',
        hourOfDay: 3,
        deviceRisk: 'flagged',
        velocity: 9,
      });
    expect(res.status).toBe(200);
    expect(res.body.data.verdict).toBe('block');
    expect(res.body.data.score).toBeGreaterThanOrEqual(70);
  });
});

// ═══════════════════════════════════════════════════════════
// TRANSACTION — PROTECTED ROUTES
// ═══════════════════════════════════════════════════════════
describe('GET /api/transactions (protected)', () => {
  it('returns 401 without auth token', async () => {
    const res = await request(app).get('/api/transactions');
    expect(res.status).toBe(401);
  });

  it('returns 200 with valid token', async () => {
    const res = await request(app)
      .get('/api/transactions')
      .set('Authorization', AUTH_TOKEN);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('data');
    expect(res.body.data).toHaveProperty('total');
  });
});

describe('GET /api/transactions/:id (protected)', () => {
  it('returns 401 without token', async () => {
    const res = await request(app).get('/api/transactions/txn-uuid-001');
    expect(res.status).toBe(401);
  });

  it('returns 200 for existing transaction', async () => {
    const res = await request(app)
      .get('/api/transactions/txn-uuid-001')
      .set('Authorization', AUTH_TOKEN);
    expect(res.status).toBe(200);
    expect(res.body.data.transaction).toBeDefined();
  });
});

// ═══════════════════════════════════════════════════════════
// DASHBOARD ROUTES
// ═══════════════════════════════════════════════════════════
describe('GET /api/dashboard/stats', () => {
  it('returns 401 without token', async () => {
    const res = await request(app).get('/api/dashboard/stats');
    expect(res.status).toBe(401);
  });

  it('returns 200 with token', async () => {
    const res = await request(app)
      .get('/api/dashboard/stats')
      .set('Authorization', AUTH_TOKEN);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

describe('GET /api/dashboard/ticker', () => {
  it('returns ticker array with valid token', async () => {
    const res = await request(app)
      .get('/api/dashboard/ticker')
      .set('Authorization', AUTH_TOKEN);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('ticker');
    expect(Array.isArray(res.body.data.ticker)).toBe(true);
  });
});

describe('GET /api/dashboard/health', () => {
  it('returns system health data', async () => {
    const res = await request(app)
      .get('/api/dashboard/health')
      .set('Authorization', AUTH_TOKEN);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('status');
    expect(res.body.data).toHaveProperty('uptime');
    expect(res.body.data.status).toBe('operational');
  });
});

// ═══════════════════════════════════════════════════════════
// ALERTS ROUTES
// ═══════════════════════════════════════════════════════════
describe('GET /api/alerts', () => {
  it('returns 401 without token', async () => {
    const res = await request(app).get('/api/alerts');
    expect(res.status).toBe(401);
  });

  it('returns paginated alerts with token', async () => {
    const res = await request(app)
      .get('/api/alerts')
      .set('Authorization', AUTH_TOKEN);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('data');
    expect(res.body.data).toHaveProperty('total');
  });
});

describe('GET /api/alerts/unread-count', () => {
  it('returns a count number', async () => {
    const res = await request(app)
      .get('/api/alerts/unread-count')
      .set('Authorization', AUTH_TOKEN);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('count');
    expect(typeof res.body.data.count).toBe('number');
  });
});

// ═══════════════════════════════════════════════════════════
// 404 HANDLER
// ═══════════════════════════════════════════════════════════
describe('404 handler', () => {
  it('returns 404 for unknown routes', async () => {
    const res = await request(app).get('/api/does-not-exist');
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/not found/i);
  });
});

// ═══════════════════════════════════════════════════════════
// ANALYTICS ROUTES
// ═══════════════════════════════════════════════════════════
describe('GET /api/analytics/overview', () => {
  it('returns 200 with KPI fields', async () => {
    const res = await request(app)
      .get('/api/analytics/overview')
      .set('Authorization', AUTH_TOKEN);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('total');
    expect(res.body.data).toHaveProperty('fraudRate');
  });
});
