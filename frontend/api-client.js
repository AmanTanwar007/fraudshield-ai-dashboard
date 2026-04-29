/* ══════════════════════════════════════════════════════════
   BackHackers AI — Frontend API Client  v3.0
   ══════════════════════════════════════════════════════════ */

'use strict';

/* ── BACKEND URL ─────────────────────────────────────────── */
const BACKEND_URL = (() => {
  const h = window.location.hostname;
  if (h === 'localhost' || h === '127.0.0.1') return 'http://localhost:5000';
  return 'https://back-hackers-ai.vercel.app';
})();

/* ── AUTH STORE ──────────────────────────────────────────── */
const Auth = {
  getToken:   ()  => localStorage.getItem('bh_token'),
  setToken:   (t) => localStorage.setItem('bh_token', t),
  clearToken: ()  => localStorage.removeItem('bh_token'),
  getUser:    ()  => { try { return JSON.parse(localStorage.getItem('bh_user')); } catch { return null; } },
  setUser:    (u) => localStorage.setItem('bh_user', JSON.stringify(u)),
  getHeaders() {
    const h = { 'Content-Type': 'application/json' };
    if (this.getToken()) h['Authorization'] = `Bearer ${this.getToken()}`;
    return h;
  },
};

/* ── BASE FETCH ──────────────────────────────────────────── */
async function apiFetch(path, options = {}) {
  const res = await fetch(`${BACKEND_URL}${path}`, {
    headers: Auth.getHeaders(),
    ...options,
  });
  let body;
  try { body = await res.json(); } catch { body = {}; }
  if (res.status === 401) Auth.clearToken();
  if (!res.ok) throw new Error(body.message || `HTTP ${res.status}`);
  return body;
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
  async analyze(params) {
    try {
      const body = await apiFetch('/api/transactions/analyze', {
        method: 'POST',
        body:   JSON.stringify(params),
      });
      return body.data || body;
    } catch (err) {
      console.warn('Backend analyze failed, using local engine:', err.message);
      return _localAnalyze(params);
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
      Object.fromEntries(Object.entries(filters).filter(([, v]) => v != null && v !== ''))
    ).toString();
    const body = await apiFetch(`/api/transactions${qs ? '?' + qs : ''}`);
    return body.data || body;
  },

  async getById(id) {
    const body = await apiFetch(`/api/transactions/${id}`);
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
};

/* ══════════════════════════════════════════════════════════
   UI — MODAL SYSTEM
   ══════════════════════════════════════════════════════════ */
function createModal(title, content) {
  // Remove existing modal
  const existing = document.getElementById('bh-modal');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.id = 'bh-modal';
  overlay.style.cssText = `
    position:fixed; inset:0; z-index:9999;
    background:rgba(4,7,15,0.92);
    backdrop-filter:blur(12px);
    display:flex; align-items:center; justify-content:center;
    padding:20px; animation:fadeInUp 0.3s ease;
  `;

  overlay.innerHTML = `
    <div style="
      background:#080e1c; border:1px solid rgba(0,200,150,0.2);
      border-radius:12px; padding:40px; max-width:480px; width:100%;
      position:relative;
    ">
      <button onclick="document.getElementById('bh-modal').remove()" style="
        position:absolute; top:16px; right:16px;
        background:transparent; border:1px solid rgba(0,200,150,0.2);
        color:#6b7a99; width:32px; height:32px; border-radius:6px;
        cursor:pointer; font-size:1rem; display:flex; align-items:center; justify-content:center;
      ">✕</button>
      <h2 style="font-family:'Syne',sans-serif; color:#00e8a2; margin-bottom:24px; font-size:1.4rem;">${title}</h2>
      ${content}
    </div>
  `;

  // Close on overlay click
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) overlay.remove();
  });

  document.body.appendChild(overlay);
  return overlay;
}

function inputStyle() {
  return `width:100%; background:#0c1428; border:1px solid rgba(0,200,150,0.15);
    color:#e8f0ff; padding:12px 16px; border-radius:6px;
    font-family:'DM Mono',monospace; font-size:0.85rem; outline:none;
    margin-bottom:16px; transition:border-color 0.2s;`;
}

function btnStyle(color = '#00e8a2') {
  return `width:100%; background:${color}; color:#04070f;
    border:none; padding:13px; border-radius:6px;
    font-family:'Syne',sans-serif; font-weight:700; font-size:0.9rem;
    cursor:pointer; margin-top:4px; letter-spacing:0.03em;
    transition:transform 0.15s, box-shadow 0.2s;`;
}

/* ── Free Trial Modal ──────────────────────────────────── */
function showTrialModal() {
  const content = `
    <p style="color:#6b7a99; font-size:0.85rem; margin-bottom:24px;">
      Start your 14-day free trial. No credit card required.
    </p>
    <input id="trial-name"  type="text"     placeholder="Your Name"     style="${inputStyle()}" />
    <input id="trial-email" type="email"    placeholder="Work Email"     style="${inputStyle()}" />
    <input id="trial-pass"  type="password" placeholder="Password (min 8 chars)" style="${inputStyle()}" />
    <div id="trial-msg" style="color:#ff4d6d; font-size:0.8rem; margin-bottom:12px; min-height:20px;"></div>
    <button onclick="handleTrialSignup()" style="${btnStyle()}">🚀 Start Free Trial</button>
    <p style="text-align:center; margin-top:16px; font-size:0.78rem; color:#6b7a99;">
      Already have an account? <a href="#" onclick="showLoginModal()" style="color:#00e8a2;">Sign In</a>
    </p>
  `;
  createModal('Start Free Trial', content);
  setTimeout(() => document.getElementById('trial-name')?.focus(), 100);
}

async function handleTrialSignup() {
  const name  = document.getElementById('trial-name')?.value?.trim();
  const email = document.getElementById('trial-email')?.value?.trim();
  const pass  = document.getElementById('trial-pass')?.value;
  const msg   = document.getElementById('trial-msg');

  if (!name || !email || !pass) { msg.textContent = 'All fields are required'; return; }
  if (pass.length < 8)          { msg.textContent = 'Password must be at least 8 characters'; return; }

  const btn = document.querySelector('#bh-modal button[onclick="handleTrialSignup()"]');
  if (btn) { btn.textContent = '⏳ Creating account...'; btn.disabled = true; }
  msg.textContent = '';

  try {
    await AuthAPI.register(name, email, pass, 'viewer');
    document.getElementById('bh-modal').remove();
    showSuccessToast('🎉 Account created! Welcome to BackHackers AI');
    updateNavForLoggedIn();
    setTimeout(() => document.getElementById('analyzer-section')?.scrollIntoView({ behavior: 'smooth' }), 500);
  } catch (err) {
    msg.textContent = err.message || 'Registration failed';
    if (btn) { btn.textContent = '🚀 Start Free Trial'; btn.disabled = false; }
  }
}

/* ── Login Modal ────────────────────────────────────────── */
function showLoginModal() {
  const existing = document.getElementById('bh-modal');
  if (existing) existing.remove();

  const content = `
    <p style="color:#6b7a99; font-size:0.85rem; margin-bottom:24px;">
      Sign in to access your fraud detection dashboard.
    </p>
    <input id="login-email" type="email"    placeholder="Email"    style="${inputStyle()}" />
    <input id="login-pass"  type="password" placeholder="Password" style="${inputStyle()}" />
    <div id="login-msg" style="color:#ff4d6d; font-size:0.8rem; margin-bottom:12px; min-height:20px;"></div>
    <button onclick="handleLogin()" style="${btnStyle()}">🔐 Sign In</button>
    <p style="text-align:center; margin-top:16px; font-size:0.78rem; color:#6b7a99;">
      No account? <a href="#" onclick="showTrialModal()" style="color:#00e8a2;">Start Free Trial</a>
    </p>
    <div style="margin-top:20px; padding:16px; background:#0c1428; border-radius:8px; border:1px solid rgba(0,200,150,0.1);">
      <p style="color:#6b7a99; font-size:0.75rem; margin-bottom:8px;">Demo credentials:</p>
      <p style="color:#00e8a2; font-size:0.78rem; font-family:'DM Mono',monospace;">admin@backhackers.ai / Admin@1234</p>
    </div>
  `;
  createModal('Sign In', content);
  setTimeout(() => document.getElementById('login-email')?.focus(), 100);
}

async function handleLogin() {
  const email = document.getElementById('login-email')?.value?.trim();
  const pass  = document.getElementById('login-pass')?.value;
  const msg   = document.getElementById('login-msg');

  if (!email || !pass) { msg.textContent = 'Email and password required'; return; }

  const btn = document.querySelector('#bh-modal button[onclick="handleLogin()"]');
  if (btn) { btn.textContent = '⏳ Signing in...'; btn.disabled = true; }
  msg.textContent = '';

  try {
    await AuthAPI.login(email, pass);
    document.getElementById('bh-modal').remove();
    showSuccessToast('✅ Signed in successfully!');
    updateNavForLoggedIn();
    loadDashboard();
  } catch (err) {
    msg.textContent = err.message || 'Login failed';
    if (btn) { btn.textContent = '🔐 Sign In'; btn.disabled = false; }
  }
}

/* ── Demo Modal ─────────────────────────────────────────── */
function showDemoModal() {
  const content = `
    <p style="color:#6b7a99; font-size:0.85rem; margin-bottom:20px;">
      Watch BackHackers AI detect fraud in real time using our live demo system.
    </p>
    <div style="display:flex; flex-direction:column; gap:12px;">
      <button onclick="document.getElementById('bh-modal').remove(); scrollToAnalyzer()" style="${btnStyle()}">
        ⚡ Try Live Analyzer
      </button>
      <button onclick="runDemoScenario('high')" style="
        width:100%; background:transparent; color:#ff4d6d;
        border:1px solid rgba(255,77,109,0.4); padding:13px; border-radius:6px;
        font-family:'Syne',sans-serif; font-weight:700; font-size:0.9rem; cursor:pointer;
      ">🚫 Simulate HIGH RISK Transaction</button>
      <button onclick="runDemoScenario('medium')" style="
        width:100%; background:transparent; color:#ffb830;
        border:1px solid rgba(255,184,48,0.4); padding:13px; border-radius:6px;
        font-family:'Syne',sans-serif; font-weight:700; font-size:0.9rem; cursor:pointer;
      ">⚠️ Simulate MEDIUM RISK Transaction</button>
      <button onclick="runDemoScenario('low')" style="
        width:100%; background:transparent; color:#00e8a2;
        border:1px solid rgba(0,232,162,0.3); padding:13px; border-radius:6px;
        font-family:'Syne',sans-serif; font-weight:700; font-size:0.9rem; cursor:pointer;
      ">✅ Simulate LOW RISK Transaction</button>
    </div>
    <p style="color:#6b7a99; font-size:0.75rem; margin-top:16px; text-align:center;">
      Powered by real backend AI engine → back-hackers-ai.vercel.app/api
    </p>
  `;
  createModal('Live Demo', content);
}

async function runDemoScenario(level) {
  document.getElementById('bh-modal')?.remove();
  scrollToAnalyzer();

  const scenarios = {
    high: {
      amount: 15000, type: 'Crypto Exchange', country: 'Nigeria',
      hour: 3, device: 'Flagged Device', velocity: 8,
    },
    medium: {
      amount: 3500, type: 'Wire Transfer', country: 'Brazil',
      hour: 22, device: 'New Device', velocity: 3,
    },
    low: {
      amount: 250, type: 'Online Purchase', country: 'United States',
      hour: 14, device: 'Trusted Device', velocity: 1,
    },
  };

  const s = scenarios[level];
  // Fill form fields
  const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.value = val; };
  setVal('tx-amount',   s.amount);
  setVal('tx-hour',     s.hour);
  setVal('tx-velocity', s.velocity);
  // Set selects by visible text
  const setSelect = (id, text) => {
    const el = document.getElementById(id);
    if (!el) return;
    [...el.options].forEach((o, i) => { if (o.text === text) el.selectedIndex = i; });
  };
  setSelect('tx-type',    s.type);
  setSelect('tx-country', s.country);
  setSelect('tx-device',  s.device);

  await analyzeTransaction();
}

function scrollToAnalyzer() {
  const el = document.querySelector('.analyzer-section');
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/* ── Contact / Pricing Modal ────────────────────────────── */
function showContactModal(plan) {
  const content = `
    <p style="color:#6b7a99; font-size:0.85rem; margin-bottom:20px;">
      ${plan === 'Enterprise'
        ? 'Get a custom quote for enterprise-grade fraud detection.'
        : `Start your ${plan} plan — includes a 14-day free trial.`}
    </p>
    <input id="contact-name"  type="text"  placeholder="Your Name"    style="${inputStyle()}" />
    <input id="contact-email" type="email" placeholder="Work Email"   style="${inputStyle()}" />
    <input id="contact-org"   type="text"  placeholder="Organization" style="${inputStyle()}" />
    <div id="contact-msg" style="color:#ff4d6d; font-size:0.8rem; margin-bottom:12px; min-height:20px;"></div>
    <button onclick="handleContactSubmit('${plan}')" style="${btnStyle()}">
      ${plan === 'Enterprise' ? '📞 Request Demo Call' : '🚀 Get Started — ' + plan}
    </button>
  `;
  createModal(plan + ' Plan', content);
  setTimeout(() => document.getElementById('contact-name')?.focus(), 100);
}

function handleContactSubmit(plan) {
  const name  = document.getElementById('contact-name')?.value?.trim();
  const email = document.getElementById('contact-email')?.value?.trim();
  const msg   = document.getElementById('contact-msg');
  if (!name || !email) { msg.textContent = 'Name and email are required'; return; }
  document.getElementById('bh-modal').remove();
  showSuccessToast(`✅ Thanks ${name}! We'll reach out about the ${plan} plan within 24 hours.`);
}

/* ── Success Toast ──────────────────────────────────────── */
function showSuccessToast(message) {
  const existing = document.getElementById('bh-toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.id = 'bh-toast';
  toast.style.cssText = `
    position:fixed; bottom:30px; right:30px; z-index:99999;
    background:#080e1c; border:1px solid rgba(0,232,162,0.4);
    color:#e8f0ff; padding:16px 24px; border-radius:8px;
    font-family:'DM Mono',monospace; font-size:0.85rem;
    box-shadow:0 8px 30px rgba(0,0,0,0.4);
    animation:fadeInUp 0.3s ease;
    max-width:380px;
  `;
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 4000);
}

/* ── Update Nav When Logged In ─────────────────────────── */
function updateNavForLoggedIn() {
  const user = Auth.getUser();
  if (!user) return;
  const btn = document.querySelector('.nav-cta');
  if (btn) {
    btn.textContent = `👤 ${user.name?.split(' ')[0] || 'Account'}`;
    btn.onclick = () => {
      const menu = document.createElement('div');
      menu.style.cssText = `
        position:fixed; top:70px; right:48px; z-index:999;
        background:#080e1c; border:1px solid rgba(0,200,150,0.2);
        border-radius:8px; overflow:hidden; min-width:180px;
      `;
      menu.innerHTML = `
        <div style="padding:12px 16px; font-size:0.75rem; color:#6b7a99; border-bottom:1px solid rgba(0,200,150,0.1);">${user.email}</div>
        <button onclick="AuthAPI.logout()" style="
          width:100%; padding:12px 16px; background:transparent;
          color:#ff4d6d; border:none; cursor:pointer; text-align:left;
          font-family:'DM Mono',monospace; font-size:0.82rem;
        ">🚪 Sign Out</button>
      `;
      document.body.appendChild(menu);
      setTimeout(() => document.addEventListener('click', () => menu.remove(), { once: true }), 100);
    };
  }
}

/* ══════════════════════════════════════════════════════════
   UI — CHART BUILDER
   ══════════════════════════════════════════════════════════ */
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
function animateCounter(el, target) {
  if (!el || !target) return;
  let current = 0;
  const inc   = Math.ceil(target / 60);
  const timer = setInterval(() => {
    current = Math.min(current + inc, target);
    el.textContent = current.toLocaleString();
    if (current >= target) clearInterval(timer);
  }, 30);
}

/* ══════════════════════════════════════════════════════════
   UI — LIVE TX FEED
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
    const row     = document.createElement('div');
    const isBlock = tx.verdict === 'block';
    const isClear = tx.verdict === 'clear';
    row.className = 'tx-row ' + (isBlock ? 'flagged' : isClear ? 'safe-tx' : '');
    row.style.animationDelay = (i * 0.15) + 's';
    const badgeCls = isBlock ? 'badge-fraud' : isClear ? 'badge-ok' : 'badge-review';
    const label    = isBlock ? 'FRAUD'        : isClear ? 'CLEAR'    : 'REVIEW';
    const amt      = parseFloat(tx.amount || 0);
    row.innerHTML  = `
      <div>
        <div class="tx-id">${tx.txnId || tx.id}</div>
        <div class="tx-amount">$${amt.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
      </div>
      <span class="tx-badge ${badgeCls}">${label}</span>`;
    feed.appendChild(row);
  });
}

/* ══════════════════════════════════════════════════════════
   UI — TICKER
   ══════════════════════════════════════════════════════════ */
async function loadTicker() {
  try {
    const ticker = await DashboardAPI.getTicker();
    if (!ticker?.length) return;
    const wrap = document.querySelector('.ticker');
    if (!wrap) return;
    const items = ticker.slice(0, 7).map(tx => {
      const isBlock = tx.status === 'BLOCKED' || tx.verdict === 'block';
      const label   = isBlock
        ? `<span>BLOCKED</span>`
        : `<span style="color:var(--accent)">CLEARED</span>`;
      return `<div class="tick-item">${tx.txnId} ${label} · $${parseFloat(tx.amount).toLocaleString()} <div class="tick-sep">|</div></div>`;
    });
    wrap.innerHTML = [...items, ...items].join('');
  } catch { /* keep static ticker */ }
}

/* ══════════════════════════════════════════════════════════
   UI — FRAUD ANALYZER
   ══════════════════════════════════════════════════════════ */
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
    amount:          parseFloat(document.getElementById('tx-amount')?.value)  || 500,
    transactionType: typeMap[document.getElementById('tx-type')?.value]       || 'online_purchase',
    country:         document.getElementById('tx-country')?.value             || 'United States',
    hourOfDay:       parseInt(document.getElementById('tx-hour')?.value)      || 14,
    deviceRisk:      deviceMap[document.getElementById('tx-device')?.value]   || 'trusted',
    velocity:        parseInt(document.getElementById('tx-velocity')?.value)  || 1,
  };
}

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
      const cls = s.cls || (s.type === 'warning' ? 'warn' : s.type === 'info' ? 'info' : 'ok');
      const msg = s.msg || s.message || '';
      li.className   = 'signal-item ' + cls;
      li.textContent = (cls === 'warn' ? '⚠ ' : cls === 'ok' ? '✓ ' : 'ℹ ') + msg;
      sigListEl.appendChild(li);
    });
  }
}

async function analyzeTransaction() {
  const btn = document.querySelector('.analyze-btn');
  if (btn) { btn.textContent = '⏳ Analyzing…'; btn.disabled = true; }
  try {
    const params = readFormParams();
    const result = await TransactionAPI.analyze(params);
    _renderResult(result.score ?? result.riskScore, result.signals ?? result.flags ?? []);
  } catch (err) {
    console.error('Analysis error:', err);
    showSuccessToast('❌ Analysis failed: ' + err.message);
  } finally {
    if (btn) { btn.textContent = '⚡ Run Fraud Analysis'; btn.disabled = false; }
  }
}

/* ══════════════════════════════════════════════════════════
   UI — DASHBOARD LOADER
   ══════════════════════════════════════════════════════════ */
async function loadDashboard() {
  try {
    const stats   = await DashboardAPI.getStats();
    const summary = stats.summary || stats;

    const fc = document.getElementById('fraud-count');
    const sc = document.getElementById('safe-count');
    if (fc && summary.fraudBlocked != null) animateCounter(fc, summary.fraudBlocked);
    if (sc && summary.safePassed   != null) animateCounter(sc, summary.safePassed);

    const gl = document.querySelector('.gauge-label');
    const gp = document.getElementById('gauge-path');
    if (gl && summary.avgRiskScore != null) {
      gl.textContent = Math.round(summary.avgRiskScore);
      if (gp) gp.style.strokeDashoffset = 251 - (summary.avgRiskScore / 100) * 251;
    }

    const hourlyData = stats.hourlyVolume || [];
    if (hourlyData.length) {
      buildChartFromData('volume-chart', hourlyData.map(h => h.total || 0), []);
    }

    buildTxFeed(stats.recentTransactions);

    const alertCount = summary.unreadAlerts || 0;
    if (alertCount > 0) {
      const navCta = document.querySelector('.nav-cta');
      if (navCta && !Auth.getUser()) navCta.textContent = `🔔 ${alertCount} Alerts`;
    }
  } catch (err) {
    console.warn('Dashboard upgrade skipped:', err.message);
  }
}

/* ══════════════════════════════════════════════════════════
   LOCAL ANALYZE FALLBACK
   ══════════════════════════════════════════════════════════ */
function _localAnalyze({ amount, transactionType, country, hourOfDay, deviceRisk, velocity }) {
  let score = 10;
  const signals = [];

  if (amount > 10000)      { score += 35; signals.push({ cls: 'warn', msg: `High value ($${amount.toLocaleString()}) — 3× avg ticket` }); }
  else if (amount > 3000)  { score += 18; signals.push({ cls: 'warn', msg: `Above-average amount ($${amount.toLocaleString()})` }); }
  else                     { signals.push({ cls: 'ok',   msg: `Amount within normal range ($${amount.toLocaleString()})` }); }

  const highRisk = ['Nigeria','Russia','Brazil','Iran','Venezuela','Myanmar','Romania','Ukraine'];
  if (highRisk.includes(country)) { score += 28; signals.push({ cls: 'warn', msg: `High-risk jurisdiction: ${country}` }); }
  else                             { signals.push({ cls: 'ok',   msg: `Country risk low: ${country}` }); }

  if (hourOfDay >= 1 && hourOfDay <= 4)  { score += 20; signals.push({ cls: 'warn', msg: `Off-hours: ${hourOfDay}:00 AM` }); }
  else if (hourOfDay === 0 || hourOfDay >= 22) { score += 8; signals.push({ cls: 'info', msg: `Late/early hour: ${hourOfDay}:00` }); }
  else                                    { signals.push({ cls: 'ok',   msg: `Normal hour: ${hourOfDay}:00` }); }

  if (deviceRisk === 'flagged')    { score += 30; signals.push({ cls: 'warn', msg: 'Device in fraud registry' }); }
  else if (deviceRisk === 'vpn_proxy') { score += 22; signals.push({ cls: 'warn', msg: 'VPN/Proxy — identity obfuscation' }); }
  else if (deviceRisk === 'new')   { score += 10; signals.push({ cls: 'info', msg: 'New device — monitoring' }); }
  else                             { signals.push({ cls: 'ok',   msg: 'Trusted device — verified' }); }

  if (velocity >= 5)       { score += 25; signals.push({ cls: 'warn', msg: `Velocity breach: ${velocity} txns/hr` }); }
  else if (velocity >= 3)  { score += 10; signals.push({ cls: 'info', msg: `Elevated velocity: ${velocity}/hr` }); }
  else                     { signals.push({ cls: 'ok',   msg: `Normal velocity: ${velocity}/hr` }); }

  if (transactionType === 'crypto_exchange') { score += 15; signals.push({ cls: 'warn', msg: 'Crypto — laundering vector flagged' }); }
  else if (transactionType === 'wire_transfer') { score += 8; signals.push({ cls: 'info', msg: 'Wire transfer — verify identity' }); }
  else { signals.push({ cls: 'ok', msg: `Type "${transactionType}" — standard risk` }); }

  return {
    score:   Math.min(score, 100),
    signals,
    verdict: score >= 70 ? 'block' : score >= 40 ? 'review' : 'clear',
  };
}

/* ══════════════════════════════════════════════════════════
   WIRE UP ALL BUTTONS
   ══════════════════════════════════════════════════════════ */
function wireButtons() {
  // ── Nav CTA (Get Started) ──────────────────────────────
  const navCta = document.querySelector('.nav-cta');
  if (navCta) {
    navCta.addEventListener('click', () => {
      if (Auth.getUser()) return; // already handled in updateNavForLoggedIn
      showTrialModal();
    });
  }

  // ── Hero buttons ───────────────────────────────────────
  const btnPrimary = document.querySelector('.btn-primary');
  if (btnPrimary) btnPrimary.addEventListener('click', showTrialModal);

  const btnGhost = document.querySelector('.btn-ghost');
  if (btnGhost) btnGhost.addEventListener('click', showDemoModal);

  // ── Nav Links ──────────────────────────────────────────
  const navLinks = document.querySelectorAll('.nav-links a');
  const sections = {
    'Platform': '.section',
    'Models':   '.features-section',
    'API':      '.pipeline-section',
    'Docs':     '.analyzer-section',
    'Pricing':  '.pricing',
  };
  navLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const target = sections[link.textContent.trim()];
      if (target) {
        document.querySelector(target)?.scrollIntoView({ behavior: 'smooth' });
      }
    });
  });

  // ── Pricing buttons ────────────────────────────────────
  document.querySelectorAll('.price-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const card = btn.closest('.price-card');
      const tier = card?.querySelector('.price-tier')?.textContent?.trim() || 'Starter';
      if (tier === 'Enterprise') {
        showContactModal('Enterprise');
      } else if (btn.classList.contains('solid')) {
        showTrialModal();
      } else {
        showContactModal(tier);
      }
    });
  });

  // ── Feature card "Learn More" on hover click ───────────
  document.querySelectorAll('.feat-card').forEach(card => {
    card.style.cursor = 'pointer';
    card.addEventListener('click', () => {
      scrollToAnalyzer();
    });
  });

  // ── Footer links ───────────────────────────────────────
  document.querySelectorAll('.footer-col a').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      showSuccessToast('📄 This page is coming soon!');
    });
  });

  // ── Footer Privacy / Terms / Cookies ──────────────────
  document.querySelectorAll('.footer-bottom a').forEach(link => {
    link?.addEventListener('click', (e) => {
      e.preventDefault();
      showSuccessToast('📄 Legal pages coming soon!');
    });
  });
}

/* ══════════════════════════════════════════════════════════
   SMOOTH SCROLL FOR SECTIONS
   ══════════════════════════════════════════════════════════ */
function addSectionIds() {
  const map = [
    ['.section.features-section', 'features'],
    ['.pipeline-section',         'pipeline'],
    ['.analyzer-section',         'analyzer-section'],
    ['.pricing',                  'pricing'],
    ['.testimonials',             'testimonials'],
  ];
  map.forEach(([sel, id]) => {
    const el = document.querySelector(sel);
    if (el && !el.id) el.id = id;
  });
}

/* ══════════════════════════════════════════════════════════
   BOOT
   ══════════════════════════════════════════════════════════ */
window.addEventListener('load', async () => {
  // 1. Add section IDs for scroll navigation
  addSectionIds();

  // 2. Wire all button click handlers
  wireButtons();

  // 3. If already logged in — update nav
  if (Auth.getUser()) updateNavForLoggedIn();

  // 4. Render static charts immediately
  buildChart('fraud-chart',  16, [3,7,11,15],
    [30,40,35,90,50,40,60,95,45,55,70,88,50,60,45,100]);
  buildChart('safe-chart',   16, [],
    [60,70,65,80,75,70,90,85,80,88,95,92,85,90,88,100]);
  buildChart('volume-chart', 24, [2,8,17,22],
    [40,35,80,50,60,70,65,55,85,90,88,95,92,85,80,75,70,98,65,60,90,55,85,70]);

  // 5. Seed static TX feed
  buildTxFeed();

  // 6. Animate counters with static values
  animateCounter(document.getElementById('fraud-count'), 1247);
  animateCounter(document.getElementById('safe-count'),  98341);

  // 7. Auto-login as viewer to load live dashboard data
  try {
    if (!Auth.getToken()) {
      await AuthAPI.login('viewer@backhackers.ai', 'Viewer@1234');
    }
  } catch (e) {
    console.warn('Auto viewer login failed:', e.message);
  }

  // 8. Load real backend data silently
  await Promise.allSettled([
    loadDashboard(),
    loadTicker(),
  ]);
});

/* ══════════════════════════════════════════════════════════
   EXPORTS
   ══════════════════════════════════════════════════════════ */
if (typeof module !== 'undefined') {
  module.exports = { AuthAPI, TransactionAPI, DashboardAPI, AlertAPI, AnalyticsAPI };
}
