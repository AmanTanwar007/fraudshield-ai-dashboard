/* ══════════════════════════════════════════════════════════
   BackHackers AI — Frontend API Client  v2.0
   ══════════════════════════════════════════════════════════
   Replaces main.js entirely. Already loaded in index.html via:
     <script src="api-client.js"></script>

   FIX LOG (v1 → v2):
   ─────────────────────────────────────────────────────────
   1. BACKEND_URL corrected:
      ✗ backhackers-ai-backend.vercel.app  (wrong — 404s)
      ✓ back-hackers-ai.vercel.app         (matches vercel.json routes)

   2. Response shape fix:
      Backend returns { success, data: { ... } }
      apiFetch now returns full `data` object; callers destructure correctly.

   3. /api/transactions/analyze — added fallback to local engine
      in case backend route doesn't exist yet.

   4. /api/dashboard/stats — mapped to actual backend response keys:
      summary.fraudBlocked, summary.safePassed, summary.avgRiskScore,
      recentTransactions[], hourlyVolume[].

   5. Ticker populated from real backend data.

   6. Static charts + counters always render first (offline-safe),
      then backend data upgrades them silently.

   7. CORS: ALLOWED_ORIGINS in .env already includes
      https://back-hackers-ai.vercel.app — no change needed there.
   ══════════════════════════════════════════════════════════ */

'use strict';

/* ──────────────────────────────────────────────────────────
   CONFIG
   Change BACKEND_URL if you deploy the backend elsewhere.
   ────────────────────────────────────────────────────────── */
const BACKEND_URL = (() => {
  const h = window.location.hostname;
  if (h === 'localhost' || h === '127.0.0.1') return 'http://localhost:5000';
  // Production: backend is served from the same Vercel project
  // via vercel.json routes → backend/src/server.js
  return 'https://back-hackers-ai.vercel.app';
})();

/* ──────────────────────────────────────────────────────────
   TOKEN / AUTH STORE
   ────────────────────────────────────────────────────────── */
const Auth = {
  getToken:   ()    => localStorage.getItem('bh_token'),
  setToken:   (t)   => localStorage.setItem('bh_token', t),
  clearToken: ()    => localStorage.removeItem('bh_token'),
  getUser:    ()    => { try { return JSON.parse(localStorage.getItem('bh_user')); } catch { return null; } },
  setUser:    (u)   => localStorage.setItem('bh_user', JSON.stringify(u)),

  getHeaders() {
    const h = { 'Content-Type': 'application/json' };
    if (this.getToken()) h['Authorization'] = `Bearer ${this.getToken()}`;
    return h;
  },
};

/* ──────────────────────────────────────────────────────────
   BASE FETCH WRAPPER
   Returns the full parsed JSON body.
   Throws with backend message on non-2xx.
   ────────────────────────────────────────────────────────── */
async function apiFetch(path, options = {}) {
  const res  = await fetch(`${BACKEND_URL}${path}`, {
    headers: Auth.getHeaders(),
    ...options,
  });

  let body;
  try { body = await res.json(); } catch { body = {}; }

  if (res.status === 401) {
    Auth.clearToken();
    // Don't redirect — page works in demo mode without auth
  }

  if (!res.ok) {
    throw new Error(body.message || `HTTP ${res.status}`);
  }

  return body; // { success, data, message, ... }
}

/* ══════════════════════════════════════════════════════════
   AUTH API
   ══════════════════════════════════════════════════════════ */
const AuthAPI = {
  async login(email, password) {
    const body = await apiFetch('/api/auth/login', {
      method: 'POST',
      body:   JSON.stringify({ email, password }),
    });
    const token = body.data?.token || body.token;
    const user  = body.data?.user  || body.user;
    if (token) { Auth.setToken(token); Auth.setUser(user); }
    return body.data || body;
  },

  async register(name, email, password, role = 'viewer') {
    const body = await apiFetch('/api/auth/register', {
      method: 'POST',
      body:   JSON.stringify({ name, email, password, role }),
    });
    const token = body.data?.token || body.token;
    if (token) Auth.setToken(token);
    return body.data || body;
  },

  async getMe() {
    const body = await apiFetch('/api/auth/me');
    return body.data?.user || body.user || body.data;
  },

  logout() {
    Auth.clearToken();
    localStorage.removeItem('bh_user');
    window.location.reload();
  },
};

/* ══════════════════════════════════════════════════════════
   TRANSACTION API
   ══════════════════════════════════════════════════════════ */
const TransactionAPI = {
  /**
   * POST /api/transactions/analyze
   * Returns { score, verdict, signals }
   * Falls back to local heuristic if backend is unreachable.
   */
  async analyze(params) {
    try {
      const body = await apiFetch('/api/transactions/analyze', {
        method: 'POST',
        body:   JSON.stringify(params),
      });
      // Backend may return data at body.data or body directly
      return body.data || body;
    } catch (err) {
      console.warn('Backend analyze failed, using local engine:', err.message);
      return _localAnalyze(params); // fallback (see bottom of file)
    }
  },

  async create(params) {
    const body = await apiFetch('/api/transactions', {
      method: 'POST',
      body:   JSON.stringify(params),
    });
    return body.data || body;
  },

  async list(filters = {}) {
    const qs = new URLSearchParams(
      Object.fromEntries(Object.entries(filters).filter(([,v]) => v != null && v !== ''))
    ).toString();
    const body = await apiFetch(`/api/transactions${qs ? '?' + qs : ''}`);
    return body.data || body;
  },

  async getById(id) {
    const body = await apiFetch(`/api/transactions/${id}`);
    return body.data?.transaction || body.data || body;
  },

  async updateStatus(id, status, reviewNotes = '') {
    const body = await apiFetch(`/api/transactions/${id}/review`, {
      method: 'PATCH',
      body:   JSON.stringify({ status, reviewNotes }),
    });
    return body.data?.transaction || body.data || body;
  },
};

/* ══════════════════════════════════════════════════════════
   DASHBOARD API
   ══════════════════════════════════════════════════════════ */
const DashboardAPI = {
  async getStats() {
    const body = await apiFetch('/api/dashboard/stats');
    return body.data || body;
  },

  async getTicker() {
    const body = await apiFetch('/api/dashboard/ticker');
    return body.data?.ticker || body.ticker || [];
  },

  async getHealth() {
    const body = await apiFetch('/api/health');
    return body;
  },
};

/* ══════════════════════════════════════════════════════════
   ALERT API
   ══════════════════════════════════════════════════════════ */
const AlertAPI = {
  async list(filters = {}) {
    const qs = new URLSearchParams(filters).toString();
    const body = await apiFetch(`/api/alerts${qs ? '?' + qs : ''}`);
    return body.data || body;
  },

  async unreadCount() {
    const body = await apiFetch('/api/alerts/unread-count');
    return body.data?.count ?? body.count ?? 0;
  },

  async markRead(id) {
    return apiFetch(`/api/alerts/${id}/read`, { method: 'PATCH' });
  },

  async markAllRead() {
    return apiFetch('/api/alerts/read-all', { method: 'PATCH' });
  },
};

/* ══════════════════════════════════════════════════════════
   ANALYTICS API
   ══════════════════════════════════════════════════════════ */
const AnalyticsAPI = {
  async overview(days = 30) {
    const body = await apiFetch(`/api/analytics/overview?days=${days}`);
    return body.data || body;
  },

  async riskDistribution() {
    const body = await apiFetch('/api/analytics/risk-distribution');
    return body.data?.distribution || body.distribution || body.data || [];
  },

  async trend(days = 14) {
    const body = await apiFetch(`/api/analytics/trend?days=${days}`);
    return body.data?.trend || body.trend || body.data || [];
  },
};

/* ══════════════════════════════════════════════════════════
   UI — CHART BUILDER (used by dashboard loader below)
   ══════════════════════════════════════════════════════════ */

/** Build static bar chart from explicit heights array */
function buildChart(id, count, alertIdxs, heights) {
  const el = document.getElementById(id);
  if (!el) return;
  el.innerHTML = '';
  for (let i = 0; i < count; i++) {
    const bar = document.createElement('div');
    bar.className = 'bar' + (alertIdxs.includes(i) ? ' alert' : '');
    bar.style.height = heights[i] + '%';
    bar.style.animationDelay = (i * 0.05) + 's';
    el.appendChild(bar);
  }
}

/** Build bar chart from a flat values array (normalised to max=100%) */
function buildChartFromData(id, values, alertIndexes = []) {
  const el = document.getElementById(id);
  if (!el || !values?.length) return;
  const max = Math.max(...values, 1);
  el.innerHTML = '';
  values.forEach((v, i) => {
    const bar = document.createElement('div');
    bar.className = 'bar' + (alertIndexes.includes(i) ? ' alert' : '');
    bar.style.height = Math.round((v / max) * 100) + '%';
    bar.style.animationDelay = (i * 0.04) + 's';
    el.appendChild(bar);
  });
}

/* ══════════════════════════════════════════════════════════
   UI — COUNTER ANIMATION
   ══════════════════════════════════════════════════════════ */
function animateCounter(el, target, suffix = '') {
  if (!el) return;
  let current = 0;
  const inc = Math.ceil(target / 60);
  const timer = setInterval(() => {
    current = Math.min(current + inc, target);
    el.textContent = current.toLocaleString() + suffix;
    if (current >= target) clearInterval(timer);
  }, 30);
}

/* ══════════════════════════════════════════════════════════
   UI — LIVE TX FEED (static seed)
   ══════════════════════════════════════════════════════════ */
function buildTxFeed(transactions) {
  const feed = document.getElementById('live-feed');
  if (!feed) return;
  feed.innerHTML = '';

  const staticData = [
    { txnId: 'TXN-99142', amount: 12540, verdict: 'block'  },
    { txnId: 'TXN-99143', amount: 234,   verdict: 'clear'  },
    { txnId: 'TXN-99144', amount: 3200,  verdict: 'review' },
    { txnId: 'TXN-99145', amount: 890,   verdict: 'clear'  },
    { txnId: 'TXN-99146', amount: 8100,  verdict: 'block'  },
  ];

  const rows = transactions?.length ? transactions : staticData;

  rows.slice(0, 6).forEach((tx, i) => {
    const row = document.createElement('div');
    const isBlock  = tx.verdict === 'block';
    const isClear  = tx.verdict === 'clear';
    row.className  = 'tx-row ' + (isBlock ? 'flagged' : isClear ? 'safe-tx' : '');
    row.style.animationDelay = (i * 0.15) + 's';

    const badgeCls = isBlock ? 'badge-fraud' : isClear ? 'badge-ok' : 'badge-review';
    const label    = isBlock ? 'FRAUD'        : isClear ? 'CLEAR'    : 'REVIEW';
    const amt      = parseFloat(tx.amount || 0);

    row.innerHTML = `
      <div>
        <div class="tx-id">${tx.txnId || tx.id}</div>
        <div class="tx-amount">$${amt.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
      </div>
      <span class="tx-badge ${badgeCls}">${label}</span>`;
    feed.appendChild(row);
  });
}

/* ══════════════════════════════════════════════════════════
   UI — LIVE TICKER (populate from backend or keep static)
   ══════════════════════════════════════════════════════════ */
async function loadTicker() {
  try {
    const ticker = await DashboardAPI.getTicker();
    if (!ticker?.length) return;

    const wrap = document.querySelector('.ticker');
    if (!wrap) return;

    const items = ticker.slice(0, 7).map(tx => {
      const isBlock = tx.verdict === 'block';
      const label   = isBlock ? `<span>BLOCKED</span>` : `<span style="color:var(--accent)">CLEARED</span>`;
      const reason  = tx.fraudReason ? ` · ${tx.fraudReason}` : '';
      return `<div class="tick-item">${tx.txnId} ${label} · $${parseFloat(tx.amount).toLocaleString()}${reason} <div class="tick-sep">|</div></div>`;
    });

    // Duplicate for seamless loop
    wrap.innerHTML = [...items, ...items].join('');
  } catch { /* keep static ticker */ }
}

/* ══════════════════════════════════════════════════════════
   UI — FRAUD ANALYZER
   Called by onclick="analyzeTransaction()" in index.html
   ══════════════════════════════════════════════════════════ */

/** Map display values → backend field values */
function readFormParams() {
  const typeMap = {
    'Online Purchase': 'online_purchase',
    'Wire Transfer':   'wire_transfer',
    'ATM Withdrawal':  'atm_withdrawal',
    'POS Payment':     'pos_payment',
    'Crypto Exchange': 'crypto_exchange',
  };
  const deviceMap = {
    'New Device':     'new',
    'Trusted Device': 'trusted',
    'Flagged Device': 'flagged',
    'VPN / Proxy':    'vpn_proxy',
  };

  return {
    amount:          parseFloat(document.getElementById('tx-amount')?.value)   || 500,
    transactionType: typeMap[document.getElementById('tx-type')?.value]        || 'online_purchase',
    country:         document.getElementById('tx-country')?.value              || 'United States',
    hourOfDay:       parseInt(document.getElementById('tx-hour')?.value)        || 14,
    deviceRisk:      deviceMap[document.getElementById('tx-device')?.value]    || 'trusted',
    velocity:        parseInt(document.getElementById('tx-velocity')?.value)   || 1,
  };
}

/** Render result into the output panel */
function _renderResult(score, signals) {
  const idleEl    = document.getElementById('result-idle');
  const displayEl = document.getElementById('result-display');
  if (idleEl)    idleEl.style.display    = 'none';
  if (displayEl) { displayEl.style.display = 'block'; displayEl.classList.add('visible'); }

  const scoreEl   = document.getElementById('risk-score-display');
  const barEl     = document.getElementById('risk-bar');
  const verdictEl = document.getElementById('risk-verdict');
  const sigListEl = document.getElementById('signals-list');

  if (scoreEl) {
    scoreEl.textContent = score;
    scoreEl.style.color = score >= 70 ? 'var(--accent2)' : score >= 40 ? '#ffb830' : 'var(--accent)';
  }

  if (barEl) setTimeout(() => { barEl.style.width = score + '%'; }, 50);

  if (verdictEl) {
    if      (score >= 70) { verdictEl.textContent = '🚫 HIGH RISK — BLOCK RECOMMENDED'; verdictEl.style.color = 'var(--accent2)'; }
    else if (score >= 40) { verdictEl.textContent = '⚠️ MEDIUM RISK — REVIEW REQUIRED';  verdictEl.style.color = '#ffb830'; }
    else                  { verdictEl.textContent = '✅ LOW RISK — CLEAR TO PROCEED';     verdictEl.style.color = 'var(--accent)'; }
  }

  if (sigListEl) {
    sigListEl.innerHTML = '';
    (signals || []).forEach(s => {
      const li  = document.createElement('li');
      // Backend may send { cls, msg } or { type, message } — handle both
      const cls = s.cls  || (s.type === 'warning' ? 'warn' : s.type === 'info' ? 'info' : 'ok');
      const msg = s.msg  || s.message || s.signal || '';
      li.className   = 'signal-item ' + cls;
      li.textContent = (cls === 'warn' ? '⚠ ' : cls === 'ok' ? '✓ ' : 'ℹ ') + msg;
      sigListEl.appendChild(li);
    });
  }
}

/** Main analyze entry — wired to onclick in HTML */
async function analyzeTransaction() {
  const btn = document.querySelector('.analyze-btn');
  if (btn) { btn.textContent = '⏳ Analyzing…'; btn.disabled = true; }

  try {
    const params = readFormParams();
    const result = await TransactionAPI.analyze(params);
    _renderResult(result.score ?? result.riskScore, result.signals ?? result.flags ?? []);
  } catch (err) {
    console.error('Analysis error:', err);
    const idleEl = document.getElementById('result-idle');
    if (idleEl) {
      idleEl.style.display = 'flex';
      idleEl.innerHTML = `<div class="result-idle-icon">⚠️</div><div>Analysis failed.<br><small>${err.message}</small></div>`;
    }
  } finally {
    if (btn) { btn.textContent = '⚡ Run Fraud Analysis'; btn.disabled = false; }
  }
}

/* ══════════════════════════════════════════════════════════
   UI — DASHBOARD DATA LOADER
   Upgrades static numbers with live backend data silently.
   ══════════════════════════════════════════════════════════ */
async function loadDashboard() {
  if (!Auth.getToken()) return; // public page works without auth

  try {
    const stats = await DashboardAPI.getStats();

    // The backend dashboard.service.js returns:
    // { summary: { totalTransactions, fraudBlocked, safePassed, avgRiskScore, unreadAlerts },
    //   recentTransactions: [...],
    //   hourlyVolume: [{ hour, total, fraud }] }
    const summary = stats.summary || stats;

    /* ── Counters ── */
    const fc = document.getElementById('fraud-count');
    const sc = document.getElementById('safe-count');
    if (fc && summary.fraudBlocked != null) animateCounter(fc, summary.fraudBlocked);
    if (sc && summary.safePassed   != null) animateCounter(sc, summary.safePassed);

    /* ── Gauge ── */
    const gl = document.querySelector('.gauge-label');
    const gp = document.getElementById('gauge-path');
    if (gl && summary.avgRiskScore != null) {
      gl.textContent = Math.round(summary.avgRiskScore);
      // Gauge arc: dashoffset 251=empty → 0=full. Map score 0-100 → offset 251→0
      if (gp) gp.style.strokeDashoffset = 251 - (summary.avgRiskScore / 100) * 251;
    }

    /* ── Volume chart ── */
    const hourlyData = stats.hourlyVolume || stats.hourly || [];
    if (hourlyData.length) {
      buildChartFromData('volume-chart', hourlyData.map(h => h.total || h.count || 0), []);
    }

    /* ── Fraud / safe mini charts ── */
    if (stats.dailyFraud?.length) {
      buildChartFromData('fraud-chart', stats.dailyFraud, []);
    }

    /* ── Live feed ── */
    buildTxFeed(stats.recentTransactions);

    /* ── Alert badge on nav button ── */
    const alertCount = summary.unreadAlerts || 0;
    const navCta = document.querySelector('.nav-cta');
    if (navCta && alertCount > 0) navCta.textContent = `🔔 ${alertCount} Alerts`;

  } catch (err) {
    console.warn('Dashboard upgrade skipped (backend unreachable):', err.message);
    // Static values already rendered — no visible failure
  }
}

/* ══════════════════════════════════════════════════════════
   LOCAL ANALYZE FALLBACK
   Mirrors the fraud engine logic from backend/src/services/fraudEngine.service.js
   Used when backend /api/transactions/analyze is unavailable.
   ══════════════════════════════════════════════════════════ */
function _localAnalyze({ amount, transactionType, country, hourOfDay, deviceRisk, velocity }) {
  let score = 10;
  const signals = [];

  if (amount > 10000)     { score += 35; signals.push({ cls: 'warn', msg: `High value transaction ($${amount.toLocaleString()}) — 3× average ticket` }); }
  else if (amount > 3000) { score += 18; signals.push({ cls: 'warn', msg: `Above-average amount ($${amount.toLocaleString()})` }); }
  else                    { signals.push({ cls: 'ok',   msg: `Amount within normal range ($${amount.toLocaleString()})` }); }

  const highRisk = ['Nigeria','Russia','Brazil','Romania','Ukraine','Vietnam'];
  if (highRisk.includes(country)) { score += 28; signals.push({ cls: 'warn', msg: `High-risk jurisdiction: ${country}` }); }
  else                             { signals.push({ cls: 'ok',   msg: `Country risk low: ${country}` }); }

  if (hourOfDay >= 1 && hourOfDay <= 5) { score += 20; signals.push({ cls: 'warn', msg: `Off-hours activity at ${hourOfDay}:00` }); }
  else                                   { signals.push({ cls: 'ok',   msg: `Normal activity hour: ${hourOfDay}:00` }); }

  if (deviceRisk === 'flagged')   { score += 30; signals.push({ cls: 'warn', msg: 'Device matches known fraud registry' }); }
  else if (deviceRisk === 'vpn_proxy') { score += 22; signals.push({ cls: 'warn', msg: 'VPN/Proxy — identity obfuscation risk' }); }
  else if (deviceRisk === 'new')  { score += 10; signals.push({ cls: 'info', msg: 'First-time device — monitoring' }); }
  else                            { signals.push({ cls: 'ok',   msg: 'Trusted device — verified fingerprint' }); }

  if (velocity >= 5)      { score += 25; signals.push({ cls: 'warn', msg: `Velocity breach: ${velocity} txns/hour` }); }
  else if (velocity >= 3) { score += 10; signals.push({ cls: 'info', msg: `Elevated velocity: ${velocity} txns/hr` }); }
  else                    { signals.push({ cls: 'ok',   msg: `Normal velocity: ${velocity} txn(s)/hr` }); }

  if (transactionType === 'crypto_exchange') { score += 15; signals.push({ cls: 'warn', msg: 'Crypto exchange — laundering vector flagged' }); }
  else if (transactionType === 'wire_transfer') { score += 8; signals.push({ cls: 'info', msg: 'Wire transfer — additional verification recommended' }); }

  return { score: Math.min(score, 100), signals, verdict: score >= 70 ? 'block' : score >= 40 ? 'review' : 'clear' };
}

/* ══════════════════════════════════════════════════════════
   BOOT
   ══════════════════════════════════════════════════════════ */
window.addEventListener('load', async () => {
  /* 1. Render static charts immediately (works offline) */
  buildChart('fraud-chart',  16, [3,7,11,15],
    [30,40,35,90,50,40,60,95,45,55,70,88,50,60,45,100]);
  buildChart('safe-chart',   16, [],
    [60,70,65,80,75,70,90,85,80,88,95,92,85,90,88,100]);
  buildChart('volume-chart', 24, [2,8,17,22],
    [40,35,80,50,60,70,65,55,85,90,88,95,92,85,80,75,70,98,65,60,90,55,85,70]);

  /* 2. Seed static live feed */
  buildTxFeed();

  /* 3. Animate counters with static values */
  animateCounter(document.getElementById('fraud-count'), 1247);
  animateCounter(document.getElementById('safe-count'),  98341);

  /* 4. Silently upgrade with real data (no errors shown if backend offline) */
  await Promise.allSettled([
    loadDashboard(),
    loadTicker(),
  ]);
});

/* ══════════════════════════════════════════════════════════
   EXPORTS (Node/module environments)
   ══════════════════════════════════════════════════════════ */
if (typeof module !== 'undefined') {
  module.exports = { AuthAPI, TransactionAPI, DashboardAPI, AlertAPI, AnalyticsAPI };
}
