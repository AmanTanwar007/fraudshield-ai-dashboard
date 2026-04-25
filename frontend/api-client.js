/**
 * BackHackers AI — Frontend API Client
 * ══════════════════════════════════════════════════════════
 * Drop this file into your frontend to connect the live site
 * at back-hackers-ai.vercel.app to the Node.js backend API.
 *
 * Usage: Replace <script src="main.js"> with
 *        <script src="api-client.js">
 *
 * Set BACKEND_URL below to your deployed backend URL.
 * ══════════════════════════════════════════════════════════
 */

'use strict';

// ── Config ────────────────────────────────────────────────
const BACKEND_URL = 'https://backhackers-ai-backend.vercel.app'; // ← change this

// ── Auth token storage ────────────────────────────────────
const Auth = {
  getToken:    ()      => localStorage.getItem('bh_token'),
  setToken:    (t)     => localStorage.setItem('bh_token', t),
  clearToken:  ()      => localStorage.removeItem('bh_token'),
  getHeaders:  ()      => ({
    'Content-Type': 'application/json',
    ...(Auth.getToken() ? { Authorization: `Bearer ${Auth.getToken()}` } : {}),
  }),
};

// ── Base fetch wrapper ────────────────────────────────────
async function apiFetch(path, options = {}) {
  const res  = await fetch(`${BACKEND_URL}${path}`, {
    headers: Auth.getHeaders(),
    ...options,
  });
  const data = await res.json();
  if (!data.success) throw new Error(data.message || 'API error');
  return data;
}

// ══════════════════════════════════════════════════════════
// AUTH API
// ══════════════════════════════════════════════════════════
const AuthAPI = {
  async login(email, password) {
    const { data } = await apiFetch('/api/auth/login', {
      method: 'POST',
      body:   JSON.stringify({ email, password }),
    });
    Auth.setToken(data.token);
    return data;
  },

  async register(name, email, password) {
    const { data } = await apiFetch('/api/auth/register', {
      method: 'POST',
      body:   JSON.stringify({ name, email, password }),
    });
    Auth.setToken(data.token);
    return data;
  },

  async getMe() {
    const { data } = await apiFetch('/api/auth/me');
    return data.user;
  },

  logout() {
    Auth.clearToken();
    window.location.reload();
  },
};

// ══════════════════════════════════════════════════════════
// TRANSACTION API
// ══════════════════════════════════════════════════════════
const TransactionAPI = {
  /**
   * Analyze a transaction (public — no auth required).
   * Replaces the local analyzeTransaction() function.
   */
  async analyze(params) {
    const { data } = await apiFetch('/api/transactions/analyze', {
      method: 'POST',
      body:   JSON.stringify(params),
    });
    return data;
  },

  /**
   * Analyze + persist (requires auth).
   */
  async create(params) {
    const { data } = await apiFetch('/api/transactions', {
      method: 'POST',
      body:   JSON.stringify(params),
    });
    return data;
  },

  async list(filters = {}) {
    const qs     = new URLSearchParams(filters).toString();
    const { data } = await apiFetch(`/api/transactions?${qs}`);
    return data;
  },

  async getById(id) {
    const { data } = await apiFetch(`/api/transactions/${id}`);
    return data.transaction;
  },

  async review(id, status, reviewNotes = '') {
    const { data } = await apiFetch(`/api/transactions/${id}/review`, {
      method: 'PATCH',
      body:   JSON.stringify({ status, reviewNotes }),
    });
    return data.transaction;
  },
};

// ══════════════════════════════════════════════════════════
// DASHBOARD API
// ══════════════════════════════════════════════════════════
const DashboardAPI = {
  async getStats() {
    const { data } = await apiFetch('/api/dashboard/stats');
    return data;
  },

  async getTicker() {
    const { data } = await apiFetch('/api/dashboard/ticker');
    return data.ticker;
  },

  async getHealth() {
    const { data } = await apiFetch('/api/dashboard/health');
    return data;
  },
};

// ══════════════════════════════════════════════════════════
// ALERT API
// ══════════════════════════════════════════════════════════
const AlertAPI = {
  async list(filters = {}) {
    const qs     = new URLSearchParams(filters).toString();
    const { data } = await apiFetch(`/api/alerts?${qs}`);
    return data;
  },

  async unreadCount() {
    const { data } = await apiFetch('/api/alerts/unread-count');
    return data.count;
  },

  async markRead(id) {
    return apiFetch(`/api/alerts/${id}/read`, { method: 'PATCH' });
  },

  async markAllRead() {
    return apiFetch('/api/alerts/read-all', { method: 'PATCH' });
  },

  async resolve(id) {
    return apiFetch(`/api/alerts/${id}/resolve`, { method: 'PATCH' });
  },
};

// ══════════════════════════════════════════════════════════
// ANALYTICS API
// ══════════════════════════════════════════════════════════
const AnalyticsAPI = {
  async overview(days = 30) {
    const { data } = await apiFetch(`/api/analytics/overview?days=${days}`);
    return data;
  },

  async riskDistribution() {
    const { data } = await apiFetch('/api/analytics/risk-distribution');
    return data.distribution;
  },

  async countryHeatmap(days = 30) {
    const { data } = await apiFetch(`/api/analytics/country-heatmap?days=${days}`);
    return data.heatmap;
  },

  async trend(days = 14) {
    const { data } = await apiFetch(`/api/analytics/trend?days=${days}`);
    return data.trend;
  },

  async topSignals() {
    const { data } = await apiFetch('/api/analytics/top-signals');
    return data.topSignals;
  },
};

// ══════════════════════════════════════════════════════════
// UI WIRING — connects backend to existing frontend elements
// ══════════════════════════════════════════════════════════

/**
 * Map frontend form values → backend API field names.
 */
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
    amount:          parseFloat(document.getElementById('tx-amount').value)   || 500,
    transactionType: typeMap[document.getElementById('tx-type').value]        || 'online_purchase',
    country:         document.getElementById('tx-country').value,
    hourOfDay:       parseInt(document.getElementById('tx-hour').value)        || 14,
    deviceRisk:      deviceMap[document.getElementById('tx-device').value]    || 'trusted',
    velocity:        parseInt(document.getElementById('tx-velocity').value)   || 1,
  };
}

/**
 * Render result into the existing frontend output panel.
 * (same _renderResult() signature as original main.js)
 */
function _renderResult(score, signals) {
  document.getElementById('result-idle').style.display = 'none';

  const display = document.getElementById('result-display');
  display.style.display = 'block';
  display.classList.add('visible');

  const scoreEl   = document.getElementById('risk-score-display');
  const barEl     = document.getElementById('risk-bar');
  const verdictEl = document.getElementById('risk-verdict');
  const sigListEl = document.getElementById('signals-list');

  scoreEl.textContent = score;
  scoreEl.style.color =
    score >= 70 ? 'var(--accent2)' :
    score >= 40 ? '#ffb830'        : 'var(--accent)';

  setTimeout(() => { barEl.style.width = score + '%'; }, 50);

  if (score >= 70) {
    verdictEl.textContent = '🚫 HIGH RISK — BLOCK RECOMMENDED';
    verdictEl.style.color = 'var(--accent2)';
  } else if (score >= 40) {
    verdictEl.textContent = '⚠️ MEDIUM RISK — REVIEW REQUIRED';
    verdictEl.style.color = '#ffb830';
  } else {
    verdictEl.textContent = '✅ LOW RISK — CLEAR TO PROCEED';
    verdictEl.style.color = 'var(--accent)';
  }

  sigListEl.innerHTML = '';
  signals.forEach(s => {
    const li   = document.createElement('li');
    li.className = 'signal-item ' + s.cls;
    const icon = s.cls === 'warn' ? '⚠' : s.cls === 'ok' ? '✓' : 'ℹ';
    li.textContent = `${icon} ${s.msg}`;
    sigListEl.appendChild(li);
  });
}

/**
 * Main entry — called when "Run Fraud Analysis" is clicked.
 * Replaces the local analyzeTransaction() in main.js.
 */
async function analyzeTransaction() {
  const btn = document.querySelector('.analyze-btn');
  if (btn) { btn.textContent = '⏳ Analyzing...'; btn.disabled = true; }

  try {
    const params = readFormParams();
    const result = await TransactionAPI.analyze(params);
    _renderResult(result.score, result.signals);
  } catch (err) {
    console.error('Analysis error:', err);

    // Graceful fallback — show error in output panel
    const idleEl = document.getElementById('result-idle');
    if (idleEl) {
      idleEl.style.display = 'flex';
      idleEl.innerHTML = `
        <div class="result-idle-icon">⚠️</div>
        <div>Backend unavailable.<br>Check your connection.</div>
      `;
    }
  } finally {
    if (btn) { btn.textContent = '⚡ Run Fraud Analysis'; btn.disabled = false; }
  }
}

/**
 * Populate the live dashboard from real backend data.
 */
async function loadDashboard() {
  if (!Auth.getToken()) return; // skip if not logged in

  try {
    const stats = await DashboardAPI.getStats();
    const { summary, hourlyVolume, recentTransactions } = stats;

    // Update counter values
    const fc = document.getElementById('fraud-count');
    const sc = document.getElementById('safe-count');
    if (fc) fc.textContent = (summary.fraudBlocked || 0).toLocaleString();
    if (sc) sc.textContent = (summary.safePassed   || 0).toLocaleString();

    // Update gauge label
    const gl = document.querySelector('.gauge-label');
    if (gl) gl.textContent = summary.avgRiskScore || 0;

    // Rebuild volume chart from real hourly data
    buildChartFromData('volume-chart', hourlyVolume.map(h => h.total), []);

    // Rebuild live feed from real transactions
    const feed = document.getElementById('live-feed');
    if (feed && recentTransactions?.length) {
      feed.innerHTML = '';
      recentTransactions.forEach(tx => {
        const row = document.createElement('div');
        row.className = 'tx-row ' + (
          tx.verdict === 'block'  ? 'flagged'  :
          tx.verdict === 'clear'  ? 'safe-tx'  : ''
        );
        const badgeCls =
          tx.verdict === 'block'  ? 'badge-fraud'  :
          tx.verdict === 'clear'  ? 'badge-ok'     : 'badge-review';
        const label =
          tx.verdict === 'block'  ? 'FRAUD'  :
          tx.verdict === 'clear'  ? 'CLEAR'  : 'REVIEW';

        row.innerHTML = `
          <div>
            <div class="tx-id">${tx.txnId}</div>
            <div class="tx-amount">$${parseFloat(tx.amount).toLocaleString()}</div>
          </div>
          <span class="tx-badge ${badgeCls}">${label}</span>
        `;
        feed.appendChild(row);
      });
    }

    // Alert badge
    const alertCount = summary.unreadAlerts || 0;
    if (alertCount > 0) {
      const navCta = document.querySelector('.nav-cta');
      if (navCta) navCta.textContent = `🔔 ${alertCount} Alerts`;
    }
  } catch (err) {
    console.warn('Dashboard data unavailable, using static values:', err.message);
  }
}

/**
 * Build chart from a flat array of values (same interface as main.js buildChart).
 */
function buildChartFromData(id, values, alertIndexes = []) {
  const el = document.getElementById(id);
  if (!el || !values.length) return;
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

// ── Static fallback charts (same as original main.js) ─────
function buildChart(id, count, alertIdxs, heights) {
  const el = document.getElementById(id);
  if (!el) return;
  el.innerHTML = '';
  for (let i = 0; i < count; i++) {
    const b = document.createElement('div');
    b.className = 'bar' + (alertIdxs.includes(i) ? ' alert' : '');
    b.style.height = heights[i] + '%';
    b.style.animationDelay = (i * 0.05) + 's';
    el.appendChild(b);
  }
}

function buildTxFeed() {
  const txData = [
    { id: 'TXN-99142', amount: '$12,540', type: 'fraud',  label: 'FRAUD',  cls: 'flagged' },
    { id: 'TXN-99143', amount: '$234',    type: 'ok',     label: 'CLEAR',  cls: 'safe-tx' },
    { id: 'TXN-99144', amount: '$3,200',  type: 'review', label: 'REVIEW', cls: ''        },
    { id: 'TXN-99145', amount: '$890',    type: 'ok',     label: 'CLEAR',  cls: 'safe-tx' },
    { id: 'TXN-99146', amount: '$8,100',  type: 'fraud',  label: 'FRAUD',  cls: 'flagged' },
  ];
  const feed = document.getElementById('live-feed');
  if (!feed) return;
  txData.forEach((tx, i) => {
    const row = document.createElement('div');
    row.className = 'tx-row ' + tx.cls;
    row.style.animationDelay = (i * 0.15) + 's';
    const badgeCls = tx.type === 'fraud' ? 'badge-fraud' : tx.type === 'ok' ? 'badge-ok' : 'badge-review';
    row.innerHTML = `
      <div>
        <div class="tx-id">${tx.id}</div>
        <div class="tx-amount">${tx.amount}</div>
      </div>
      <span class="tx-badge ${badgeCls}">${tx.label}</span>`;
    feed.appendChild(row);
  });
}

function animateCounter(el, target) {
  if (!el) return;
  let current = 0;
  const inc = Math.ceil(target / 60);
  const timer = setInterval(() => {
    current += inc;
    if (current >= target) { current = target; clearInterval(timer); }
    el.textContent = current.toLocaleString();
  }, 30);
}

// ── Boot ──────────────────────────────────────────────────
window.addEventListener('load', async () => {
  // Always render static charts first (instant)
  buildChart('fraud-chart', 16, [3,7,11,15],
    [30,40,35,90,50,40,60,95,45,55,70,88,50,60,45,100]);
  buildChart('safe-chart', 16, [],
    [60,70,65,80,75,70,90,85,80,88,95,92,85,90,88,100]);
  buildChart('volume-chart', 24, [2,8,17,22],
    [40,35,80,50,60,70,65,55,85,90,88,95,92,85,80,75,70,98,65,60,90,55,85,70]);

  buildTxFeed();

  animateCounter(document.getElementById('fraud-count'), 1247);
  animateCounter(document.getElementById('safe-count'),  98341);

  // Then try to upgrade with real backend data
  await loadDashboard();
});

// ── Export for module environments ────────────────────────
if (typeof module !== 'undefined') {
  module.exports = { AuthAPI, TransactionAPI, DashboardAPI, AlertAPI, AnalyticsAPI };
}
