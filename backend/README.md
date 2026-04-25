# BackHackers AI — Backend API

> Production-ready Node.js/Express REST API for the BackHackers AI fraud detection platform.

**Frontend Live:** https://back-hackers-ai.vercel.app  
**GitHub:** https://github.com/AmanTanwar007/BackHackers_AI

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Runtime | Node.js 18+ |
| Framework | Express.js 4 |
| Database | PostgreSQL + Sequelize ORM |
| Auth | JWT (jsonwebtoken) + bcrypt |
| Validation | express-validator |
| Security | helmet, cors, express-rate-limit |
| Logging | winston |
| Testing | Jest |
| Deployment | Vercel (serverless) |

---

## Project Structure

```
backhackers-backend/
├── src/
│   ├── server.js               # Entry point
│   ├── app.js                  # Express app + middleware
│   ├── config/
│   │   └── database.js         # Sequelize/PostgreSQL config
│   ├── models/
│   │   ├── index.js            # Model loader + associations
│   │   ├── user.model.js       # Users (admin/analyst/viewer)
│   │   ├── transaction.model.js # Core transaction + risk data
│   │   ├── alert.model.js      # Fraud alerts
│   │   └── auditLog.model.js   # Compliance audit trail
│   ├── services/
│   │   ├── fraudEngine.service.js  # ⭐ AI scoring engine
│   │   ├── transaction.service.js
│   │   ├── dashboard.service.js
│   │   └── auth.service.js
│   ├── controllers/
│   │   ├── auth.controller.js
│   │   ├── transaction.controller.js
│   │   ├── dashboard.controller.js
│   │   ├── alert.controller.js
│   │   ├── user.controller.js
│   │   └── analytics.controller.js
│   ├── routes/
│   │   ├── auth.routes.js
│   │   ├── transaction.routes.js
│   │   ├── dashboard.routes.js
│   │   ├── alert.routes.js
│   │   ├── user.routes.js
│   │   └── analytics.routes.js
│   ├── middleware/
│   │   ├── auth.middleware.js     # JWT protect + restrict
│   │   ├── error.middleware.js    # Global error handler
│   │   └── validate.middleware.js # Input validation
│   └── utils/
│       ├── logger.js              # Winston logger
│       └── seed.js                # DB seed script
├── tests/
│   └── fraudEngine.test.js
├── .env.example
├── vercel.json
├── jest.config.js
└── package.json
```

---

## Quick Start

### 1. Clone & Install

```bash
git clone https://github.com/AmanTanwar007/BackHackers_AI
cd backhackers-backend
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env
# Edit .env with your PostgreSQL credentials and JWT secret
```

### 3. Setup Database

```bash
# Create the PostgreSQL database
createdb backhackers_db

# Seed with sample data (200 transactions + 3 users)
npm run seed
```

### 4. Start Server

```bash
npm run dev      # Development (nodemon)
npm start        # Production
```

### 5. Run Tests

```bash
npm test
```

Server runs on **http://localhost:5000**

---

## Environment Variables

```env
PORT=5000
NODE_ENV=development

JWT_SECRET=your_super_secret_key
JWT_EXPIRES_IN=7d

DB_HOST=localhost
DB_PORT=5432
DB_NAME=backhackers_db
DB_USER=postgres
DB_PASSWORD=your_password

ALLOWED_ORIGINS=http://localhost:3000,https://back-hackers-ai.vercel.app

RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX=100
LOG_LEVEL=info
```

---

## Seeded Credentials

After running `npm run seed`:

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@backhackers.ai | Admin@1234 |
| Analyst | analyst@backhackers.ai | Analyst@1234 |
| Viewer | viewer@backhackers.ai | Viewer@1234 |

---

## API Reference

All endpoints return:
```json
{ "success": true/false, "message": "...", "data": { ... } }
```

### Authentication

All protected routes require:
```
Authorization: Bearer <token>
```

---

### 🔐 Auth Endpoints

#### `POST /api/auth/register`
Create a new user account.

**Body:**
```json
{
  "name": "Aman Tanwar",
  "email": "aman@example.com",
  "password": "SecurePass1",
  "role": "analyst"
}
```
**Response:**
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIs...",
    "user": { "id": "uuid", "name": "Aman Tanwar", "email": "...", "role": "analyst" }
  }
}
```

---

#### `POST /api/auth/login`
```json
{ "email": "admin@backhackers.ai", "password": "Admin@1234" }
```

---

#### `GET /api/auth/me` 🔒
Returns the authenticated user's profile.

---

#### `PATCH /api/auth/change-password` 🔒
```json
{ "currentPassword": "OldPass1", "newPassword": "NewPass1" }
```

---

### 💳 Transaction Endpoints

#### `POST /api/transactions/analyze` (Public — no auth needed)
Run the fraud engine without persisting to DB. Perfect for the frontend demo.

**Body:**
```json
{
  "amount": 4850,
  "transactionType": "wire_transfer",
  "country": "Nigeria",
  "hourOfDay": 3,
  "deviceRisk": "vpn_proxy",
  "velocity": 5
}
```

**`transactionType` values:** `online_purchase` | `wire_transfer` | `atm_withdrawal` | `pos_payment` | `crypto_exchange`

**`deviceRisk` values:** `trusted` | `new` | `flagged` | `vpn_proxy`

**Response:**
```json
{
  "success": true,
  "data": {
    "txnId": "TXN-LX3K2A-MNQP",
    "score": 83,
    "verdict": "block",
    "riskLevel": "HIGH",
    "recommendation": "🚫 HIGH RISK — Block Recommended",
    "signals": [
      { "cls": "warn", "msg": "Above-average transaction amount ($4,850.00)" },
      { "cls": "warn", "msg": "High-risk jurisdiction detected: Nigeria — FATF-monitored region" },
      { "cls": "warn", "msg": "Transaction at 3:00 AM — deep off-hours window (01:00–04:59)" },
      { "cls": "warn", "msg": "VPN/Proxy detected — identity obfuscation attempt identified" },
      { "cls": "warn", "msg": "Velocity breach: 5 transactions/hr — well above normal threshold" },
      { "cls": "info", "msg": "Wire transfer — irreversible instrument, additional verification recommended" },
      { "cls": "warn", "msg": "Multi-factor risk compounding: 5 high-risk signals detected simultaneously (+12 pts)" }
    ],
    "alertCount": 5,
    "timestamp": "2026-04-19T10:30:00.000Z"
  }
}
```

---

#### `POST /api/transactions` 🔒
Same as `/analyze` but persists transaction + alerts to DB.

**Extra optional fields:**
```json
{
  "currency": "USD",
  "merchantId": "Amazon",
  "accountId": "ACC-4821"
}
```

---

#### `GET /api/transactions` 🔒
List with filters and pagination.

**Query params:**

| Param | Type | Description |
|-------|------|-------------|
| `page` | int | Page number (default: 1) |
| `limit` | int | Per page (default: 20, max: 100) |
| `verdict` | string | `block` \| `review` \| `clear` |
| `status` | string | `pending` \| `reviewed` \| `escalated` \| `resolved` |
| `country` | string | Filter by country |
| `minScore` | int | Minimum risk score |
| `maxScore` | int | Maximum risk score |
| `startDate` | ISO | Start date filter |
| `endDate` | ISO | End date filter |

**Example:** `GET /api/transactions?verdict=block&minScore=70&page=1&limit=10`

---

#### `GET /api/transactions/:id` 🔒
Get single transaction with alerts and reviewer details.
`id` can be the UUID or the `txnId` (e.g. `TXN-LX3K2A-MNQP`).

---

#### `PATCH /api/transactions/:id/review` 🔒 (analyst+)
```json
{
  "status": "resolved",
  "reviewNotes": "Confirmed fraud. Card blocked. Customer notified."
}
```

**`status` values:** `pending` | `reviewed` | `escalated` | `resolved`

---

#### `DELETE /api/transactions/:id` 🔒 (admin only)

---

### 📊 Dashboard Endpoints

#### `GET /api/dashboard/stats` 🔒
Returns all data needed to power the live dashboard:

```json
{
  "data": {
    "summary": {
      "fraudBlocked": 47,
      "safePassed": 892,
      "underReview": 23,
      "totalToday": 962,
      "avgRiskScore": 34,
      "criticalAlerts": 8,
      "unreadAlerts": 15,
      "blockDelta": 3.2
    },
    "hourlyVolume": [
      { "hour": 0, "total": 12, "blocked": 3 },
      ...
    ],
    "recentTransactions": [...],
    "weeklyTrend": [...],
    "verdictBreakdown": [
      { "verdict": "block", "count": "47" },
      { "verdict": "clear", "count": "892" }
    ],
    "topFraudCountries": [...]
  }
}
```

---

#### `GET /api/dashboard/ticker` 🔒
Last 20 transactions formatted for the scrolling ticker.

---

#### `GET /api/dashboard/health` 🔒
System health card: uptime, memory, total transactions, alert counts.

---

### 🔔 Alert Endpoints

#### `GET /api/alerts` 🔒

| Param | Type | Description |
|-------|------|-------------|
| `severity` | string | `critical` \| `high` \| `medium` \| `low` \| `info` |
| `category` | string | `velocity_breach` \| `high_value` \| `device_flagged` etc. |
| `isRead` | boolean | `true` \| `false` |
| `isResolved` | boolean | `true` \| `false` |

---

#### `GET /api/alerts/unread-count` 🔒
Returns `{ "count": 15 }` — for notification badge.

---

#### `PATCH /api/alerts/:id/read` 🔒
Mark single alert as read.

#### `PATCH /api/alerts/read-all` 🔒
Mark all unread alerts as read.

#### `PATCH /api/alerts/:id/resolve` 🔒 (analyst+)
Mark alert as resolved with timestamp.

---

### 👤 User Endpoints (Admin Only)

#### `GET /api/users` 🔒🛡️
List all users.

#### `PATCH /api/users/:id` 🔒🛡️
```json
{ "role": "analyst", "isActive": true }
```

#### `DELETE /api/users/:id` 🔒🛡️
Soft delete (deactivates account).

#### `GET /api/users/:id/audit-logs` 🔒🛡️
Full audit trail for a user.

---

### 📈 Analytics Endpoints

#### `GET /api/analytics/overview?days=30` 🔒
Top-level KPIs: total transactions, fraud rate, avg score, alerts.

#### `GET /api/analytics/risk-distribution` 🔒
Score histogram in 10-point buckets (0-9, 10-19, ..., 90-100).

#### `GET /api/analytics/country-heatmap?days=30` 🔒
Fraud totals, fraud rate %, avg score by country.

#### `GET /api/analytics/trend?days=14` 🔒
Daily totals, blocked, cleared, avg score.

#### `GET /api/analytics/device-breakdown` 🔒
Breakdown by device risk level.

#### `GET /api/analytics/type-breakdown` 🔒
Breakdown by transaction type.

#### `GET /api/analytics/top-signals` 🔒
Top 10 most frequent fraud warning signals (parsed from JSONB).

#### `GET /api/analytics/audit-logs` 🔒🛡️ (admin)
Full paginated system audit log.

---

## Fraud Engine

The core `analyzeTransaction()` function evaluates 6 features:

| Feature | Conditions | Max Increment |
|---------|-----------|---------------|
| Amount | >$50k: +40, >$10k: +35, >$3k: +18 | +40 |
| Country | High-risk (FATF): +28, Medium-risk: +12 | +28 |
| Hour | 01:00–04:59: +20, Midnight/05–06: +10, 22+: +8 | +20 |
| Device | Flagged: +30, VPN/Proxy: +22, New: +10 | +30 |
| Velocity | ≥8/hr: +30, ≥5/hr: +25, ≥3/hr: +10 | +30 |
| Tx Type | Crypto: +15, Wire: +8, ATM: +5 | +15 |
| **Multi-factor** | 3+ warn signals → +15% compounding | variable |

**Score → Verdict:**
- 0–39: `clear` ✅
- 40–69: `review` ⚠️
- 70–100: `block` 🚫

---

## Connecting to the Frontend

In your frontend's `main.js`, replace the local `analyzeTransaction()` call:

```javascript
// Replace this:
function analyzeTransaction() {
  // local heuristic scoring ...
}

// With this:
async function analyzeTransaction() {
  const payload = {
    amount:          parseFloat(document.getElementById('tx-amount').value),
    transactionType: document.getElementById('tx-type').value
                       .toLowerCase().replace(/ /g, '_'),
    country:         document.getElementById('tx-country').value,
    hourOfDay:       parseInt(document.getElementById('tx-hour').value),
    deviceRisk:      document.getElementById('tx-device').value
                       .toLowerCase().replace(/ \/ /g, '_').replace(/ /g, '_'),
    velocity:        parseInt(document.getElementById('tx-velocity').value),
  };

  const res  = await fetch('https://your-backend.vercel.app/api/transactions/analyze', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(payload),
  });
  const data = await res.json();

  if (data.success) _renderResult(data.data.score, data.data.signals);
}
```

---

## Deployment (Vercel)

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel --prod

# Set env vars
vercel env add JWT_SECRET
vercel env add DB_HOST
# ... (add all .env vars)
```

For the database, use [Neon](https://neon.tech) or [Supabase](https://supabase.com) — both offer free PostgreSQL hosting compatible with this backend.

---

## Rate Limits

| Endpoint Group | Limit |
|---------------|-------|
| All `/api/*` routes | 100 req / 15 min |
| `/api/auth/*` routes | 20 req / 15 min |

---

## Security Features

- ✅ Helmet.js HTTP headers
- ✅ CORS whitelist
- ✅ JWT authentication with role-based access
- ✅ bcrypt password hashing (12 rounds)
- ✅ Input validation on all endpoints
- ✅ Rate limiting
- ✅ Request compression
- ✅ SQL injection protection via Sequelize ORM
- ✅ Immutable audit log trail
- ✅ No passwords in API responses

---

## License

MIT — © 2026 BackHackers AI
