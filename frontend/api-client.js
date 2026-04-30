/* ══════════════════════════════════════════════════════════
   BackHackers AI — Frontend API Client  v4.0
   Fixes: INR currency, working login, footer buttons, scroll
   ══════════════════════════════════════════════════════════ */

'use strict';

/* ── BACKEND URL ─────────────────────────────────────────── */
const BACKEND_URL = (() => {
  const h = window.location.hostname;
  if (h === 'localhost' || h === '127.0.0.1') return 'http://localhost:5000';
  return 'https://back-hackers-ai.vercel.app';
})();

/* ── CURRENCY HELPER (INR) ───────────────────────────────── */
function formatINR(amount) {
  const num = parseFloat(amount) || 0;
  return '₹' + num.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/* ── AUTH STORE ──────────────────────────────────────────── */
const Auth = {
  getToken:   ()  => localStorage.getItem('bh_token'),
  setToken:   (t) => localStorage.setItem('bh_token', t),
  clearToken: ()  => localStorage.removeItem('bh_token'),
  getUser:    ()  => {
    try { return JSON.parse(localStorage.getItem('bh_user')); }
    catch { return null; }
  },
  setUser: (u) => localStorage.setItem('bh_user', JSON.stringify(u)),
  getHeaders() {
    const h = { 'Content-Type': 'application/json' };
    if (this.getToken()) h['Authorization'] = `Bearer ${this.getToken()}`;
    return h;
  },
};

/* ── BASE FETCH ──────────────────────────────────────────── */
async function apiFetch(path, options = {}) {
  const url = `${BACKEND_URL}${path}`;
  console.log('[API]', options.method || 'GET', url);

  const res = await fetch(url, {
    headers: Auth.getHeaders(),
    ...options,
  });

  let body;
  try { body = await res.json(); }
  catch { body = { message: `HTTP ${res.status}` }; }

  console.log('[API] Response:', res.status, body);

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
    const user  = body.data?.user  || body.user;
    if (token) { Auth.setToken(token); Auth.setUser(user); }
    return body.data || body;
  },

  async getMe() {
    const body = await apiFetch('/api/auth/me');
    return body.data?.user || body.user || body.data;
  },

  logout() {
    Auth.clearToken();
    localStorage.removeItem('bh_user');
    const btn = document.querySelector('.nav-cta');
    if (btn) { btn.textContent = 'Get Started →'; btn.onclick = showTrialModal; }
    showSuccessToast('👋 Signed out successfully');
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

  async list(filters = {}) {
    const qs = new URLSearchParams(
      Object.fromEntries(Object.entries(filters).filter(([, v]) => v != null && v !== ''))
    ).toString();
    const body = await apiFetch(`/api/transactions${qs ? '?' + qs : ''}`);
    return body.data || body;
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
  async unreadCount() {
    const body = await apiFetch('/api/alerts/unread-count');
    return body.data?.count ?? body.count ?? 0;
  },
  async markAllRead() {
    return apiFetch('/api/alerts/read-all', { method: 'PATCH' });
  },
};

/* ══════════════════════════════════════════════════════════
   MODAL SYSTEM
   ══════════════════════════════════════════════════════════ */
function closeModal() {
  const m = document.getElementById('bh-modal');
  if (m) m.remove();
}

function createModal(title, content) {
  closeModal();
  const overlay = document.createElement('div');
  overlay.id = 'bh-modal';
  overlay.style.cssText = `
    position:fixed;inset:0;z-index:9999;
    background:rgba(4,7,15,0.93);
    backdrop-filter:blur(14px);
    display:flex;align-items:center;justify-content:center;
    padding:20px;
  `;
  overlay.innerHTML = `
    <div style="
      background:#080e1c;
      border:1px solid rgba(0,232,162,0.25);
      border-radius:14px;
      padding:40px;
      max-width:460px;
      width:100%;
      position:relative;
      animation:fadeInUp .3s ease;
    ">
      <button
        onclick="closeModal()"
        style="position:absolute;top:14px;right:14px;
          background:transparent;border:1px solid rgba(0,200,150,0.2);
          color:#6b7a99;width:30px;height:30px;border-radius:6px;
          cursor:pointer;font-size:1rem;line-height:1;display:flex;
          align-items:center;justify-content:center;">✕</button>
      <h2 style="font-family:'Syne',sans-serif;color:#00e8a2;
        margin-bottom:8px;font-size:1.4rem;">${title}</h2>
      <div id="modal-body">${content}</div>
    </div>`;
  overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(); });
  document.body.appendChild(overlay);
}

const IS = `width:100%;background:#0c1428;border:1px solid rgba(0,200,150,0.15);
  color:#e8f0ff;padding:12px 16px;border-radius:6px;
  font-family:'DM Mono',monospace;font-size:0.85rem;outline:none;
  margin-bottom:14px;box-sizing:border-box;`;

const BS = (c='#00e8a2') => `width:100%;background:${c};
  color:${c==='#00e8a2'?'#04070f':'#fff'};
  border:none;padding:13px;border-radius:6px;
  font-family:'Syne',sans-serif;font-weight:700;font-size:0.9rem;
  cursor:pointer;margin-top:6px;letter-spacing:.03em;
  transition:transform .15s,box-shadow .2s;`;

/* ── FREE TRIAL MODAL ───────────────────────────────────── */
function showTrialModal() {
  createModal('Start Free Trial', `
    <p style="color:#6b7a99;font-size:.85rem;margin-bottom:20px;">
      14-day free trial. No credit card required.
    </p>
    <input id="t-name"  type="text"     placeholder="Your Name"           style="${IS}"/>
    <input id="t-email" type="email"    placeholder="Work Email"           style="${IS}"/>
    <input id="t-pass"  type="password" placeholder="Password (min 8 chars)" style="${IS}"/>
    <div id="t-msg" style="color:#ff4d6d;font-size:.8rem;min-height:18px;margin-bottom:8px;"></div>
    <button onclick="handleTrialSignup()" style="${BS()}">🚀 Start Free Trial</button>
    <p style="text-align:center;margin-top:14px;font-size:.78rem;color:#6b7a99;">
      Already have an account?
      <a href="#" onclick="showLoginModal()" style="color:#00e8a2;text-decoration:none;">Sign In</a>
    </p>
  `);
  setTimeout(() => document.getElementById('t-name')?.focus(), 80);
}

async function handleTrialSignup() {
  const name  = document.getElementById('t-name')?.value.trim();
  const email = document.getElementById('t-email')?.value.trim();
  const pass  = document.getElementById('t-pass')?.value;
  const msg   = document.getElementById('t-msg');
  if (!name)           { msg.textContent = 'Name is required'; return; }
  if (!email)          { msg.textContent = 'Email is required'; return; }
  if (!pass || pass.length < 8) { msg.textContent = 'Password must be at least 8 characters'; return; }

  const btn = document.querySelector('#bh-modal button[onclick="handleTrialSignup()"]');
  if (btn) { btn.textContent = '⏳ Creating account…'; btn.disabled = true; }
  msg.textContent = '';

  try {
    await AuthAPI.register(name, email, pass, 'viewer');
    closeModal();
    showSuccessToast(`🎉 Welcome, ${name}! Account created successfully.`);
    updateNavForLoggedIn();
    setTimeout(scrollToAnalyzer, 600);
  } catch (err) {
    msg.textContent = err.message || 'Registration failed. Try a different email.';
    if (btn) { btn.textContent = '🚀 Start Free Trial'; btn.disabled = false; }
  }
}

/* ── LOGIN MODAL ────────────────────────────────────────── */
function showLoginModal() {
  createModal('Sign In', `
    <p style="color:#6b7a99;font-size:.85rem;margin-bottom:20px;">
      Sign in to access your fraud detection dashboard.
    </p>
    <input id="l-email" type="email"    placeholder="Email"    style="${IS}"/>
    <input id="l-pass"  type="password" placeholder="Password" style="${IS}"/>
    <div id="l-msg" style="color:#ff4d6d;font-size:.8rem;min-height:18px;margin-bottom:8px;"></div>
    <button onclick="handleLogin()" style="${BS()}">🔐 Sign In</button>
    <div style="margin-top:18px;padding:14px;background:#0a1020;
      border-radius:8px;border:1px solid rgba(0,232,162,0.12);">
      <p style="color:#6b7a99;font-size:.72rem;margin-bottom:6px;letter-spacing:.06em;">DEMO CREDENTIALS</p>
      <p style="color:#00e8a2;font-family:'DM Mono',monospace;font-size:.78rem;cursor:pointer;"
         onclick="document.getElementById('l-email').value='admin@backhackers.ai';
                  document.getElementById('l-pass').value='Admin@1234';">
        👆 admin@backhackers.ai / Admin@1234
      </p>
    </div>
    <p style="text-align:center;margin-top:14px;font-size:.78rem;color:#6b7a99;">
      No account?
      <a href="#" onclick="showTrialModal()" style="color:#00e8a2;text-decoration:none;">Start Free Trial</a>
    </p>
  `);
  setTimeout(() => document.getElementById('l-email')?.focus(), 80);
}

async function handleLogin() {
  const email = document.getElementById('l-email')?.value.trim();
  const pass  = document.getElementById('l-pass')?.value;
  const msg   = document.getElementById('l-msg');
  if (!email || !pass) { msg.textContent = 'Email and password are required'; return; }

  const btn = document.querySelector('#bh-modal button[onclick="handleLogin()"]');
  if (btn) { btn.textContent = '⏳ Signing in…'; btn.disabled = true; }
  msg.textContent = '';

  try {
    await AuthAPI.login(email, pass);
    closeModal();
    showSuccessToast('✅ Signed in successfully!');
    updateNavForLoggedIn();
    await loadDashboard();
  } catch (err) {
    console.error('Login error:', err);
    msg.textContent = err.message || 'Login failed. Check credentials.';
    if (btn) { btn.textContent = '🔐 Sign In'; btn.disabled = false; }
  }
}

/* ── DEMO MODAL ─────────────────────────────────────────── */
function showDemoModal() {
  createModal('Live Demo', `
    <p style="color:#6b7a99;font-size:.85rem;margin-bottom:18px;">
      Run a real fraud analysis using our AI engine. Pick a scenario:
    </p>
    <button onclick="runDemoScenario('high')"
      style="width:100%;background:#1a0810;color:#ff4d6d;
        border:1px solid rgba(255,77,109,0.35);padding:13px;border-radius:6px;
        font-family:'Syne',sans-serif;font-weight:700;font-size:.88rem;
        cursor:pointer;margin-bottom:10px;text-align:left;">
      🚫 HIGH RISK — ₹15,00,000 · Crypto · Nigeria · 3 AM · Flagged Device
    </button>
    <button onclick="runDemoScenario('medium')"
      style="width:100%;background:#1a1408;color:#ffb830;
        border:1px solid rgba(255,184,48,0.35);padding:13px;border-radius:6px;
        font-family:'Syne',sans-serif;font-weight:700;font-size:.88rem;
        cursor:pointer;margin-bottom:10px;text-align:left;">
      ⚠️ MEDIUM RISK — ₹3,50,000 · Wire Transfer · Brazil · 10 PM · New Device
    </button>
    <button onclick="runDemoScenario('low')"
      style="width:100%;background:#001a10;color:#00e8a2;
        border:1px solid rgba(0,232,162,0.3);padding:13px;border-radius:6px;
        font-family:'Syne',sans-serif;font-weight:700;font-size:.88rem;
        cursor:pointer;margin-bottom:10px;text-align:left;">
      ✅ LOW RISK — ₹25,000 · Online Purchase · India · 2 PM · Trusted Device
    </button>
    <button onclick="closeModal();scrollToAnalyzer()"
      style="${BS()} margin-top:4px;">
      ⚡ Open Live Analyzer →
    </button>
  `);
}

async function runDemoScenario(level) {
  closeModal();
  scrollToAnalyzer();

  await new Promise(r => setTimeout(r, 600));

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
      amount: 250, type: 'Online Purchase', country: 'India',
      hour: 14, device: 'Trusted Device', velocity: 1,
    },
  };

  const s = scenarios[level];
  const setVal = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.value = val;
  };
  const setSelect = (id, text) => {
    const el = document.getElementById(id);
    if (!el) return;
    [...el.options].forEach((o, i) => { if (o.text === text) el.selectedIndex = i; });
  };

  setVal('tx-amount',   s.amount);
  setVal('tx-hour',     s.hour);
  setVal('tx-velocity', s.velocity);
  setSelect('tx-type',    s.type);
  setSelect('tx-country', s.country);
  setSelect('tx-device',  s.device);

  await analyzeTransaction();
}

/* ── CONTACT MODAL ──────────────────────────────────────── */
function showContactModal(plan) {
  const isEnterprise = plan === 'Enterprise';
  createModal(plan + ' Plan', `
    <p style="color:#6b7a99;font-size:.85rem;margin-bottom:20px;">
      ${isEnterprise
        ? 'Get a custom enterprise quote. Our team will reach out within 24 hours.'
        : `Get started with the ${plan} plan. 14-day free trial included.`}
    </p>
    <input id="c-name"  type="text"  placeholder="Your Name"    style="${IS}"/>
    <input id="c-email" type="email" placeholder="Work Email"   style="${IS}"/>
    <input id="c-org"   type="text"  placeholder="Organisation" style="${IS}"/>
    <div id="c-msg" style="color:#ff4d6d;font-size:.8rem;min-height:18px;margin-bottom:8px;"></div>
    <button onclick="handleContact('${plan}')" style="${BS()}">
      ${isEnterprise ? '📞 Request Demo Call' : '🚀 Get Started — ' + plan}
    </button>
  `);
  setTimeout(() => document.getElementById('c-name')?.focus(), 80);
}

function handleContact(plan) {
  const name  = document.getElementById('c-name')?.value.trim();
  const email = document.getElementById('c-email')?.value.trim();
  const msg   = document.getElementById('c-msg');
  if (!name || !email) { msg.textContent = 'Name and email are required'; return; }
  closeModal();
  showSuccessToast(`✅ Thanks ${name}! We'll contact you about the ${plan} plan within 24 hours.`);
}

/* ── TOAST ──────────────────────────────────────────────── */
function showSuccessToast(message, duration = 4000) {
  const old = document.getElementById('bh-toast');
  if (old) old.remove();
  const t = document.createElement('div');
  t.id = 'bh-toast';
  t.style.cssText = `
    position:fixed;bottom:28px;right:28px;z-index:99999;
    background:#080e1c;border:1px solid rgba(0,232,162,0.35);
    color:#e8f0ff;padding:14px 20px;border-radius:8px;
    font-family:'DM Mono',monospace;font-size:.82rem;
    box-shadow:0 8px 32px rgba(0,0,0,.5);
    max-width:360px;line-height:1.5;
    animation:slideInRight .3s ease;
  `;
  t.textContent = message;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), duration);
}

/* ── UPDATE NAV FOR LOGGED-IN USER ──────────────────────── */
function updateNavForLoggedIn() {
  const user = Auth.getUser();
  if (!user) return;
  const btn = document.querySelector('.nav-cta');
  if (!btn) return;
  const name = user.name?.split(' ')[0] || 'Account';
  btn.textContent = `👤 ${name}`;
  btn.onclick = showUserMenu;
}

function showUserMenu() {
  const old = document.getElementById('user-menu');
  if (old) { old.remove(); return; }
  const menu = document.createElement('div');
  menu.id = 'user-menu';
  const user = Auth.getUser();
  menu.style.cssText = `
    position:fixed;top:66px;right:48px;z-index:9998;
    background:#080e1c;border:1px solid rgba(0,200,150,0.2);
    border-radius:8px;overflow:hidden;min-width:200px;
    box-shadow:0 8px 32px rgba(0,0,0,.5);
  `;
  menu.innerHTML = `
    <div style="padding:12px 16px;font-size:.75rem;color:#6b7a99;
      border-bottom:1px solid rgba(0,200,150,0.1);">${user?.email || ''}</div>
    <div style="padding:10px 16px;font-size:.78rem;color:#6b7a99;
      border-bottom:1px solid rgba(0,200,150,0.1);">
      Role: <span style="color:#00e8a2;">${user?.role || 'viewer'}</span>
    </div>
    <button onclick="AuthAPI.logout();document.getElementById('user-menu')?.remove();"
      style="width:100%;padding:12px 16px;background:transparent;
        color:#ff4d6d;border:none;cursor:pointer;text-align:left;
        font-family:'DM Mono',monospace;font-size:.82rem;">
      🚪 Sign Out
    </button>
  `;
  document.body.appendChild(menu);
  setTimeout(() => {
    document.addEventListener('click', function handler(e) {
      if (!menu.contains(e.target)) {
        menu.remove();
        document.removeEventListener('click', handler);
      }
    });
  }, 100);
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
  let cur = 0;
  const inc   = Math.ceil(target / 60);
  const timer = setInterval(() => {
    cur = Math.min(cur + inc, target);
    el.textContent = cur.toLocaleString('en-IN');
    if (cur >= target) clearInterval(timer);
  }, 30);
}

/* ══════════════════════════════════════════════════════════
   UI — LIVE TX FEED (INR)
   ══════════════════════════════════════════════════════════ */
function buildTxFeed(transactions) {
  const feed = document.getElementById('live-feed');
  if (!feed) return;
  feed.innerHTML = '';

  const staticData = [
    { txnId: 'TXN-99142', amount: 1254000, verdict: 'block'  },
    { txnId: 'TXN-99143', amount: 23400,   verdict: 'clear'  },
    { txnId: 'TXN-99144', amount: 320000,  verdict: 'review' },
    { txnId: 'TXN-99145', amount: 89000,   verdict: 'clear'  },
    { txnId: 'TXN-99146', amount: 810000,  verdict: 'block'  },
  ];

  const rows = transactions?.length ? transactions : staticData;
  rows.slice(0, 6).forEach((tx, i) => {
    const row     = document.createElement('div');
    const isBlock = tx.verdict === 'block';
    const isClear = tx.verdict === 'clear';
    row.className = 'tx-row ' + (isBlock ? 'flagged' : isClear ? 'safe-tx' : '');
    row.style.animationDelay = (i * 0.15) + 's';
    const badgeCls = isBlock ? 'badge-fraud' : isClear ? 'badge-ok' : 'badge-review';
    const label    = isBlock ? 'FRAUD' : isClear ? 'CLEAR' : 'REVIEW';
    row.innerHTML  = `
      <div>
        <div class="tx-id">${tx.txnId || tx.id}</div>
        <div class="tx-amount">${formatINR(tx.amount)}</div>
      </div>
      <span class="tx-badge ${badgeCls}">${label}</span>`;
    feed.appendChild(row);
  });
}

/* ══════════════════════════════════════════════════════════
   UI — TICKER (INR)
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
      return `<div class="tick-item">${tx.txnId} ${label} · ${formatINR(tx.amount)} <div class="tick-sep">|</div></div>`;
    });
    wrap.innerHTML = [...items, ...items].join('');
  } catch { /* keep static ticker */ }
}

/* ══════════════════════════════════════════════════════════
   SCROLL TO ANALYZER
   ══════════════════════════════════════════════════════════ */
function scrollToAnalyzer() {
  const el = document.getElementById('analyzer-section');
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/* ══════════════════════════════════════════════════════════
   FRAUD ANALYZER
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
    country:         document.getElementById('tx-country')?.value             || 'India',
    hourOfDay:       parseInt(document.getElementById('tx-hour')?.value)      || 14,
    deviceRisk:      deviceMap[document.getElementById('tx-device')?.value]   || 'trusted',
    velocity:        parseInt(document.getElementById('tx-velocity')?.value)  || 1,
  };
}

function _renderResult(score, signals) {
  document.getElementById('result-idle').style.display    = 'none';
  const disp = document.getElementById('result-display');
  disp.style.display = 'block';
  disp.classList.add('visible');

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
      const cls = s.cls || (s.type === 'warning' ? 'warn' : 'ok');
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
    _renderResult(result.score ?? result.riskScore, result.signals ?? []);
  } catch (err) {
    console.error('Analysis error:', err);
    showSuccessToast('❌ Analysis failed: ' + err.message);
  } finally {
    if (btn) { btn.textContent = '⚡ Run Fraud Analysis'; btn.disabled = false; }
  }
}

/* ══════════════════════════════════════════════════════════
   DASHBOARD LOADER (INR)
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

    // Alert badge
    const alertCount = summary.unreadAlerts || 0;
    if (alertCount > 0 && !Auth.getUser()) {
      const navCta = document.querySelector('.nav-cta');
      if (navCta) navCta.textContent = `🔔 ${alertCount} Alerts`;
    }
  } catch (err) {
    console.warn('Dashboard upgrade skipped:', err.message);
  }
}

/* ══════════════════════════════════════════════════════════
   LOCAL FALLBACK FRAUD ENGINE (INR amounts)
   ══════════════════════════════════════════════════════════ */
function _localAnalyze({ amount, transactionType, country, hourOfDay, deviceRisk, velocity }) {
  let score = 10;
  const signals = [];

  // Amount thresholds adjusted for INR
  if (amount > 800000)      { score += 35; signals.push({ cls: 'warn', msg: `High value transaction (${formatINR(amount)}) — above ₹8L threshold` }); }
  else if (amount > 250000) { score += 18; signals.push({ cls: 'warn', msg: `Above-average amount (${formatINR(amount)})` }); }
  else if (amount > 50000)  { score += 5;  signals.push({ cls: 'info', msg: `Moderate amount (${formatINR(amount)}) — within normal range` }); }
  else                       { signals.push({ cls: 'ok', msg: `Amount within low-risk range (${formatINR(amount)})` }); }

  const highRisk = ['Nigeria','Russia','Brazil','Iran','Venezuela','Myanmar','North Korea'];
  const medRisk  = ['Pakistan','Romania','Ukraine','Vietnam','Bangladesh'];
  if (highRisk.includes(country))      { score += 28; signals.push({ cls: 'warn', msg: `High-risk jurisdiction: ${country} — FATF monitored` }); }
  else if (medRisk.includes(country))  { score += 12; signals.push({ cls: 'info', msg: `Medium-risk jurisdiction: ${country} — elevated monitoring` }); }
  else                                  { signals.push({ cls: 'ok', msg: `Country risk low: ${country}` }); }

  if (hourOfDay >= 1 && hourOfDay <= 4)  { score += 20; signals.push({ cls: 'warn', msg: `Transaction at ${hourOfDay}:00 AM — deep off-hours (1–4 AM)` }); }
  else if (hourOfDay === 0 || hourOfDay >= 22) { score += 8; signals.push({ cls: 'info', msg: `Late/early hour: ${hourOfDay}:00 — minor anomaly` }); }
  else                                    { signals.push({ cls: 'ok', msg: `Transaction at ${hourOfDay}:00 — within normal business hours` }); }

  if (deviceRisk === 'flagged')         { score += 30; signals.push({ cls: 'warn', msg: 'Device matches known fraud registry — immediate flag' }); }
  else if (deviceRisk === 'vpn_proxy') { score += 22; signals.push({ cls: 'warn', msg: 'VPN/Proxy detected — identity obfuscation risk' }); }
  else if (deviceRisk === 'new')        { score += 10; signals.push({ cls: 'info', msg: 'First transaction from this device — monitoring' }); }
  else                                  { signals.push({ cls: 'ok', msg: 'Trusted device — fingerprint verified' }); }

  if (velocity >= 8)      { score += 30; signals.push({ cls: 'warn', msg: `Critical velocity: ${velocity} txns/hr — possible card testing` }); }
  else if (velocity >= 5) { score += 25; signals.push({ cls: 'warn', msg: `Velocity breach: ${velocity} txns/hr — above threshold` }); }
  else if (velocity >= 3) { score += 10; signals.push({ cls: 'info', msg: `Elevated velocity: ${velocity} txns/hr — monitoring` }); }
  else                     { signals.push({ cls: 'ok', msg: `Normal velocity: ${velocity} transaction(s) this hour` }); }

  if (transactionType === 'crypto_exchange')  { score += 15; signals.push({ cls: 'warn', msg: 'Crypto exchange — common money laundering vector' }); }
  else if (transactionType === 'wire_transfer') { score += 8; signals.push({ cls: 'info', msg: 'Wire transfer — irreversible, extra verification recommended' }); }
  else if (transactionType === 'atm_withdrawal') { score += 5; signals.push({ cls: 'info', msg: 'ATM withdrawal — monitoring for card-not-present fraud' }); }
  else                                           { signals.push({ cls: 'ok', msg: `Transaction type "${transactionType}" — standard risk` }); }

  // Multi-factor compounding
  const warnCount = signals.filter(s => s.cls === 'warn').length;
  if (warnCount >= 3) {
    const bonus = Math.round(score * 0.15);
    score += bonus;
    signals.push({ cls: 'warn', msg: `Multi-factor risk compounding: ${warnCount} high-risk signals (+${bonus} pts)` });
  }

  return {
    score:   Math.min(score, 100),
    signals,
    verdict: score >= 70 ? 'block' : score >= 40 ? 'review' : 'clear',
  };
}

/* ══════════════════════════════════════════════════════════
   WIRE ALL BUTTONS
   ══════════════════════════════════════════════════════════ */
function wireButtons() {
  // Nav CTA
  const navCta = document.querySelector('.nav-cta');
  if (navCta && !Auth.getUser()) navCta.onclick = showTrialModal;

  // Hero primary
  const heroP = document.querySelector('.btn-primary');
  if (heroP) heroP.onclick = showTrialModal;

  // Hero ghost "View Live Demo"
  const heroG = document.querySelector('.btn-ghost');
  if (heroG) heroG.onclick = showDemoModal;

  // Nav links smooth scroll
  document.querySelectorAll('.nav-links a').forEach(a => {
    a.addEventListener('click', e => {
      e.preventDefault();
      const href = a.getAttribute('href');
      if (href && href.startsWith('#')) {
        const target = document.getElementById(href.slice(1));
        if (target) target.scrollIntoView({ behavior: 'smooth' });
      }
    });
  });

  // Pricing buttons (already have onclick in HTML — skip if already set)
}

/* ══════════════════════════════════════════════════════════
   AUTO-LOGIN VIEWER
   ══════════════════════════════════════════════════════════ */
async function autoLoginViewer() {
  if (Auth.getToken()) return; // already logged in
  try {
    await AuthAPI.login('viewer@backhackers.ai', 'Viewer@1234');
    console.log('✅ Auto-logged in as viewer for dashboard data');
  } catch (e) {
    console.warn('Auto viewer login failed (seed not run?):', e.message);
  }
}

/* ══════════════════════════════════════════════════════════
   BOOT
   ══════════════════════════════════════════════════════════ */
window.addEventListener('load', async () => {
  // Wire buttons
  wireButtons();

  // Update nav if already logged in
  if (Auth.getUser()) updateNavForLoggedIn();

  // Static charts (instant, offline-safe)
  buildChart('fraud-chart', 16, [3,7,11,15],
    [30,40,35,90,50,40,60,95,45,55,70,88,50,60,45,100]);
  buildChart('safe-chart', 16, [],
    [60,70,65,80,75,70,90,85,80,88,95,92,85,90,88,100]);
  buildChart('volume-chart', 24, [2,8,17,22],
    [40,35,80,50,60,70,65,55,85,90,88,95,92,85,80,75,70,98,65,60,90,55,85,70]);

  // Static TX feed
  buildTxFeed();

  // Static counters
  animateCounter(document.getElementById('fraud-count'), 1247);
  animateCounter(document.getElementById('safe-count'), 98341);

  // Auto-login viewer then load live data
  await autoLoginViewer();
  await Promise.allSettled([loadDashboard(), loadTicker()]);
});

/* ── Exports ── */
if (typeof module !== 'undefined') {
  module.exports = { AuthAPI, TransactionAPI, DashboardAPI, AlertAPI };
}
