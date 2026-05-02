/* ══════════════════════════════════════════════════════════
   BackHackers AI — Frontend API Client v5.0
   Includes: Charts, Transaction Logs, Analytics, Graphs
   ══════════════════════════════════════════════════════════ */
'use strict';

/* ── CONFIG ─────────────────────────────────────────────── */
const BACKEND_URL = (() => {
  const h = window.location.hostname;
  if (h === 'localhost' || h === '127.0.0.1') return 'http://localhost:5000';
  return 'https://back-hackers-ai.vercel.app';
})();

/* ── INR FORMATTER ───────────────────────────────────────── */
function formatINR(amount) {
  const n = parseFloat(amount) || 0;
  return '₹' + n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

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
  const res = await fetch(`${BACKEND_URL}${path}`, { headers: Auth.getHeaders(), ...options });
  let body;
  try { body = await res.json(); } catch { body = { message: `HTTP ${res.status}` }; }
  if (res.status === 401) Auth.clearToken();
  if (!res.ok) throw new Error(body.message || `HTTP ${res.status}`);
  return body;
}

/* ══════════════════════════════════════════════════════════
   AUTH API
   ══════════════════════════════════════════════════════════ */
const AuthAPI = {
  async login(email, password) {
    const body = await apiFetch('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
    const token = body.data?.token || body.token;
    const user  = body.data?.user  || body.user;
    if (token) { Auth.setToken(token); Auth.setUser(user); }
    return body.data || body;
  },
  async register(name, email, password, role = 'viewer') {
    const body = await apiFetch('/api/auth/register', { method: 'POST', body: JSON.stringify({ name, email, password, role }) });
    const token = body.data?.token || body.token;
    const user  = body.data?.user  || body.user;
    if (token) { Auth.setToken(token); Auth.setUser(user); }
    return body.data || body;
  },
  logout() {
    Auth.clearToken(); localStorage.removeItem('bh_user');
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
      const body = await apiFetch('/api/transactions/analyze', { method: 'POST', body: JSON.stringify(params) });
      return body.data || body;
    } catch (err) {
      console.warn('Backend analyze failed, using local engine:', err.message);
      return _localAnalyze(params);
    }
  },
  async list(filters = {}) {
    const qs = new URLSearchParams(Object.fromEntries(Object.entries(filters).filter(([,v]) => v != null && v !== ''))).toString();
    const body = await apiFetch(`/api/transactions${qs ? '?' + qs : ''}`);
    return body.data || body;
  },
};

/* ══════════════════════════════════════════════════════════
   DASHBOARD & ANALYTICS API
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

const AnalyticsAPI = {
  async overview(days = 30) {
    const body = await apiFetch(`/api/analytics/overview?days=${days}`);
    return body.data || body;
  },
  async trend(days = 7) {
    const body = await apiFetch(`/api/analytics/trend?days=${days}`);
    return body.data?.trend || body.trend || [];
  },
  async countryHeatmap(days = 30) {
    const body = await apiFetch(`/api/analytics/country-heatmap?days=${days}`);
    return body.data?.heatmap || body.heatmap || [];
  },
  async deviceBreakdown() {
    const body = await apiFetch('/api/analytics/device-breakdown');
    return body.data?.breakdown || body.breakdown || [];
  },
  async typeBreakdown() {
    const body = await apiFetch('/api/analytics/type-breakdown');
    return body.data?.breakdown || body.breakdown || [];
  },
  async riskDistribution() {
    const body = await apiFetch('/api/analytics/risk-distribution');
    return body.data?.distribution || body.distribution || [];
  },
};

/* ══════════════════════════════════════════════════════════
   CHART INSTANCES (store refs for destroy on re-render)
   ══════════════════════════════════════════════════════════ */
const Charts = {};

function destroyChart(id) {
  if (Charts[id]) { Charts[id].destroy(); delete Charts[id]; }
}

/* ══════════════════════════════════════════════════════════
   CHART: 24H VOLUME BAR CHART
   ══════════════════════════════════════════════════════════ */
function renderVolumeChart(hourlyData) {
  destroyChart('volumeChart');
  const ctx = document.getElementById('volumeChart');
  if (!ctx) return;

  // Fill 24 hours
  const hours = Array.from({ length: 24 }, (_, i) => `${i}:00`);
  const safeData   = Array(24).fill(0);
  const fraudData  = Array(24).fill(0);
  const reviewData = Array(24).fill(0);

  (hourlyData || []).forEach(h => {
    const idx = parseInt(h.hour);
    if (idx >= 0 && idx < 24) {
      safeData[idx]   = h.total   - h.blocked || 0;
      fraudData[idx]  = h.blocked || 0;
    }
  });

  // If no real data, use sample
  if (!hourlyData || hourlyData.length === 0) {
    [2,5,8,12,15,18,20,22].forEach(i => { safeData[i]   = Math.floor(Math.random()*800)+200; });
    [3,7,14,19,23].forEach(i => { fraudData[i]  = Math.floor(Math.random()*80)+10; });
    [4,11,16,21].forEach(i => { reviewData[i] = Math.floor(Math.random()*40)+5; });
  }

  Charts.volumeChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: hours,
      datasets: [
        { label: 'Safe',   data: safeData,   backgroundColor: 'rgba(0,232,162,0.7)',  borderRadius: 2 },
        { label: 'Fraud',  data: fraudData,  backgroundColor: 'rgba(255,77,109,0.85)', borderRadius: 2 },
        { label: 'Review', data: reviewData, backgroundColor: 'rgba(255,184,48,0.7)', borderRadius: 2 },
      ],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: {
          stacked: true,
          ticks: { color: '#6b7a99', font: { size: 10 }, maxRotation: 0, autoSkip: true, maxTicksLimit: 12 },
          grid: { color: 'rgba(255,255,255,0.04)' },
        },
        y: {
          stacked: true,
          ticks: { color: '#6b7a99', font: { size: 10 } },
          grid: { color: 'rgba(255,255,255,0.06)' },
        },
      },
    },
  });
}

/* ══════════════════════════════════════════════════════════
   CHART: VERDICT DONUT
   ══════════════════════════════════════════════════════════ */
function renderVerdictChart(verdictData) {
  destroyChart('verdictChart');
  const ctx = document.getElementById('verdictChart');
  if (!ctx) return;

  let clear = 0, review = 0, block = 0;
  (verdictData || []).forEach(v => {
    if (v.verdict === 'clear')  clear  = parseInt(v.count);
    if (v.verdict === 'review') review = parseInt(v.count);
    if (v.verdict === 'block')  block  = parseInt(v.count);
  });

  if (clear + review + block === 0) { clear = 7900; review = 1300; block = 800; }

  Charts.verdictChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['Clear', 'Review', 'Block'],
      datasets: [{
        data: [clear, review, block],
        backgroundColor: ['#00e8a2', '#ffb830', '#ff4d6d'],
        borderWidth: 0,
        hoverOffset: 6,
      }],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      cutout: '68%',
      plugins: { legend: { display: false }, tooltip: { callbacks: {
        label: ctx => ` ${ctx.label}: ${ctx.parsed.toLocaleString('en-IN')}`
      }}},
    },
  });
}

/* ══════════════════════════════════════════════════════════
   CHART: RISK SCORE DISTRIBUTION
   ══════════════════════════════════════════════════════════ */
function renderRiskDistChart(distData) {
  destroyChart('riskDistChart');
  const ctx = document.getElementById('riskDistChart');
  if (!ctx) return;

  const sampleDist = [
    { range: '0-9', count: 1200 }, { range: '10-19', count: 2800 },
    { range: '20-29', count: 3400 }, { range: '30-39', count: 1900 },
    { range: '40-49', count: 980 },  { range: '50-59', count: 640 },
    { range: '60-69', count: 420 },  { range: '70-79', count: 280 },
    { range: '80-89', count: 180 },  { range: '90-100', count: 120 },
  ];

  const data = (distData && distData.length > 0) ? distData : sampleDist;
  const bgColors = data.map((d, i) => {
    if (i <= 3) return 'rgba(0,232,162,0.75)';
    if (i <= 6) return 'rgba(255,184,48,0.75)';
    return 'rgba(255,77,109,0.85)';
  });

  Charts.riskDistChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: data.map(d => d.range),
      datasets: [{
        label: 'Transactions',
        data: data.map(d => d.count),
        backgroundColor: bgColors,
        borderRadius: 3,
      }],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: '#6b7a99', font: { size: 9 } }, grid: { color: 'rgba(255,255,255,0.04)' } },
        y: { ticks: { color: '#6b7a99', font: { size: 9 } }, grid: { color: 'rgba(255,255,255,0.06)' } },
      },
    },
  });
}

/* ══════════════════════════════════════════════════════════
   CHART: 7-DAY TREND LINE
   ══════════════════════════════════════════════════════════ */
function renderTrendChart(trendData) {
  destroyChart('trendChart');
  const ctx = document.getElementById('trendChart');
  if (!ctx) return;

  const days7 = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (6 - i));
    return d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
  });

  const fraudVals = trendData?.length
    ? trendData.slice(-7).map(d => parseInt(d.blocked || 0))
    : [45, 62, 38, 71, 55, 89, 67];

  const safeVals = trendData?.length
    ? trendData.slice(-7).map(d => parseInt(d.total || 0) - parseInt(d.blocked || 0))
    : [1200, 980, 1450, 1100, 1380, 920, 1560];

  Charts.trendChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: trendData?.length
        ? trendData.slice(-7).map(d => new Date(d.date).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }))
        : days7,
      datasets: [
        {
          label: 'Fraud', data: fraudVals,
          borderColor: '#ff4d6d', backgroundColor: 'rgba(255,77,109,0.12)',
          tension: 0.4, fill: true, borderWidth: 2,
          pointBackgroundColor: '#ff4d6d', pointRadius: 4,
        },
        {
          label: 'Safe', data: safeVals,
          borderColor: '#00e8a2', backgroundColor: 'rgba(0,232,162,0.08)',
          tension: 0.4, fill: true, borderWidth: 2,
          pointBackgroundColor: '#00e8a2', pointRadius: 4,
          yAxisID: 'y2',
        },
      ],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: '#6b7a99', font: { size: 10 } }, grid: { color: 'rgba(255,255,255,0.04)' } },
        y:  { ticks: { color: '#ff4d6d', font: { size: 10 } }, grid: { color: 'rgba(255,255,255,0.06)' }, title: { display: true, text: 'Fraud', color: '#ff4d6d', font: { size: 10 } } },
        y2: { position: 'right', ticks: { color: '#00e8a2', font: { size: 10 } }, grid: { display: false }, title: { display: true, text: 'Safe', color: '#00e8a2', font: { size: 10 } } },
      },
    },
  });
}

/* ══════════════════════════════════════════════════════════
   CHART: DEVICE BREAKDOWN HORIZONTAL BAR
   ══════════════════════════════════════════════════════════ */
function renderDeviceChart(deviceData) {
  destroyChart('deviceChart');
  const ctx = document.getElementById('deviceChart');
  if (!ctx) return;

  const labels = deviceData?.length
    ? deviceData.map(d => ({ trusted: 'Trusted', new: 'New Device', flagged: 'Flagged', vpn_proxy: 'VPN/Proxy' }[d.deviceRisk] || d.deviceRisk))
    : ['Trusted', 'New Device', 'VPN/Proxy', 'Flagged'];

  const totals = deviceData?.length ? deviceData.map(d => parseInt(d.total)) : [8200, 1400, 320, 80];
  const fraudC = deviceData?.length ? deviceData.map(d => parseInt(d.blocked)) : [120, 280, 180, 72];

  Charts.deviceChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        { label: 'Total',    data: totals, backgroundColor: 'rgba(0,232,162,0.3)',  borderRadius: 3 },
        { label: 'Fraud',    data: fraudC, backgroundColor: 'rgba(255,77,109,0.8)', borderRadius: 3 },
      ],
    },
    options: {
      indexAxis: 'y',
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: '#6b7a99', font: { size: 9 } }, grid: { color: 'rgba(255,255,255,0.04)' } },
        y: { ticks: { color: '#6b7a99', font: { size: 10 } }, grid: { display: false } },
      },
    },
  });
}

/* ══════════════════════════════════════════════════════════
   CHART: COUNTRY FRAUD BAR
   ══════════════════════════════════════════════════════════ */
function renderCountryChart(countryData) {
  destroyChart('countryChart');
  const ctx = document.getElementById('countryChart');
  if (!ctx) return;

  const sample = [
    { country: 'Nigeria', blocked: 420 }, { country: 'Russia', blocked: 380 },
    { country: 'Brazil',  blocked: 290 }, { country: 'Pakistan', blocked: 210 },
    { country: 'Romania', blocked: 180 }, { country: 'Ukraine',  blocked: 150 },
    { country: 'China',   blocked: 120 }, { country: 'Bangladesh', blocked: 95 },
  ];

  const top8 = countryData?.length
    ? countryData.slice(0, 8)
    : sample;

  Charts.countryChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: top8.map(d => d.country),
      datasets: [{
        label: 'Fraud Blocks',
        data: top8.map(d => parseInt(d.blocked || d.total || 0)),
        backgroundColor: top8.map((_, i) => `rgba(255,${Math.round(77 + i * 8)},${Math.round(109 - i * 4)},${0.9 - i * 0.07})`),
        borderRadius: 4,
      }],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: '#6b7a99', font: { size: 10 }, maxRotation: 30 }, grid: { color: 'rgba(255,255,255,0.04)' } },
        y: { ticks: { color: '#6b7a99', font: { size: 10 } }, grid: { color: 'rgba(255,255,255,0.06)' } },
      },
    },
  });
}

/* ══════════════════════════════════════════════════════════
   CHART: TRANSACTION TYPE PIE
   ══════════════════════════════════════════════════════════ */
function renderTxTypeChart(typeData) {
  destroyChart('txTypeChart');
  const ctx = document.getElementById('txTypeChart');
  if (!ctx) return;

  const labelMap = {
    online_purchase: 'Online', wire_transfer: 'Wire', atm_withdrawal: 'ATM',
    pos_payment: 'POS', crypto_exchange: 'Crypto',
  };

  const sample = [
    { transactionType: 'crypto_exchange', blocked: 280 },
    { transactionType: 'wire_transfer',   blocked: 195 },
    { transactionType: 'online_purchase', blocked: 145 },
    { transactionType: 'atm_withdrawal',  blocked: 90 },
    { transactionType: 'pos_payment',     blocked: 40 },
  ];

  const data = typeData?.length ? typeData : sample;

  Charts.txTypeChart = new Chart(ctx, {
    type: 'pie',
    data: {
      labels: data.map(d => labelMap[d.transactionType] || d.transactionType),
      datasets: [{
        data: data.map(d => parseInt(d.blocked || 0)),
        backgroundColor: ['#ff4d6d', '#ffb830', '#00e8a2', '#7b5ea7', '#00bfff'],
        borderWidth: 0,
        hoverOffset: 8,
      }],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: {
          display: true, position: 'right',
          labels: { color: '#6b7a99', font: { size: 10 }, boxWidth: 10, padding: 8 },
        },
      },
    },
  });
}

/* ══════════════════════════════════════════════════════════
   TRANSACTION LOGS
   ══════════════════════════════════════════════════════════ */
let allLogs      = [];
let filteredLogs = [];
let currentPage  = 1;
const logsPerPage = 10;
let sortKey = 'createdAt';
let sortDir = 'desc';

// Generate 60 realistic sample transactions
function generateSampleLogs() {
  const types    = ['online_purchase', 'wire_transfer', 'atm_withdrawal', 'pos_payment', 'crypto_exchange'];
  const countries = ['India', 'United States', 'Nigeria', 'Russia', 'Germany', 'Brazil', 'China', 'UK', 'Pakistan', 'France'];
  const devices  = ['trusted', 'new', 'flagged', 'vpn_proxy'];
  const logs = [];
  for (let i = 0; i < 60; i++) {
    const amount  = Math.floor(Math.random() * 500000) + 1000;
    const score   = Math.floor(Math.random() * 100) + 1;
    const verdict = score >= 70 ? 'block' : score >= 40 ? 'review' : 'clear';
    const date    = new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000);
    const txnId   = 'TXN-' + Date.now().toString(36).toUpperCase().slice(-6) + '-' + Math.random().toString(36).slice(2, 5).toUpperCase();
    logs.push({
      txnId, amount, currency: 'INR',
      transactionType: types[Math.floor(Math.random() * types.length)],
      country: countries[Math.floor(Math.random() * countries.length)],
      deviceRisk: devices[Math.floor(Math.random() * devices.length)],
      velocity: Math.floor(Math.random() * 10) + 1,
      riskScore: score,
      verdict,
      signals: score >= 70
        ? [{ cls: 'warn', msg: 'High-risk pattern detected' }, { cls: 'warn', msg: 'Suspicious device activity' }]
        : [{ cls: 'ok', msg: 'Normal transaction pattern' }],
      createdAt: date.toISOString(),
    });
  }
  return logs.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

async function loadTransactionLogs() {
  try {
    const result = await TransactionAPI.list({ limit: 100, page: 1 });
    allLogs = (result.data || result || []).map(t => ({
      ...t,
      amount: parseFloat(t.amount),
    }));
    if (allLogs.length === 0) throw new Error('No data');
  } catch {
    allLogs = generateSampleLogs();
  }
  filteredLogs = [...allLogs];
  renderLogsTable();
}

function filterLogs() {
  const verdict = document.getElementById('filter-verdict')?.value || '';
  const minScore = parseInt(document.getElementById('filter-score')?.value) || 0;
  const search   = (document.getElementById('filter-search')?.value || '').toLowerCase();

  filteredLogs = allLogs.filter(tx => {
    if (verdict && tx.verdict !== verdict) return false;
    if (minScore && tx.riskScore < minScore) return false;
    if (search && !tx.txnId.toLowerCase().includes(search)) return false;
    return true;
  });

  currentPage = 1;
  renderLogsTable();
}

function resetFilters() {
  document.getElementById('filter-verdict').value = '';
  document.getElementById('filter-score').value   = '';
  document.getElementById('filter-search').value  = '';
  filteredLogs = [...allLogs];
  currentPage  = 1;
  renderLogsTable();
}

function sortLogs(key) {
  if (sortKey === key) {
    sortDir = sortDir === 'asc' ? 'desc' : 'asc';
  } else {
    sortKey = key;
    sortDir = 'desc';
  }
  filteredLogs.sort((a, b) => {
    let av = a[key], bv = b[key];
    if (key === 'amount' || key === 'riskScore') { av = parseFloat(av); bv = parseFloat(bv); }
    if (key === 'createdAt') { av = new Date(av); bv = new Date(bv); }
    if (av < bv) return sortDir === 'asc' ? -1 : 1;
    if (av > bv) return sortDir === 'asc' ? 1 : -1;
    return 0;
  });
  renderLogsTable();
}

function changePage(dir) {
  const total = Math.ceil(filteredLogs.length / logsPerPage);
  currentPage = Math.max(1, Math.min(currentPage + dir, total));
  renderLogsTable();
}

function renderLogsTable() {
  const tbody   = document.getElementById('logs-tbody');
  const countEl = document.getElementById('filter-count');
  const pageEl  = document.getElementById('page-info');
  const prevBtn = document.getElementById('page-prev');
  const nextBtn = document.getElementById('page-next');

  if (!tbody) return;

  const total     = filteredLogs.length;
  const totalPages = Math.max(1, Math.ceil(total / logsPerPage));
  const start     = (currentPage - 1) * logsPerPage;
  const pageData  = filteredLogs.slice(start, start + logsPerPage);

  if (countEl) countEl.textContent = `Showing ${total} transaction${total !== 1 ? 's' : ''}`;
  if (pageEl)  pageEl.textContent  = `Page ${currentPage} of ${totalPages}`;
  if (prevBtn) prevBtn.disabled    = currentPage <= 1;
  if (nextBtn) nextBtn.disabled    = currentPage >= totalPages;

  if (pageData.length === 0) {
    tbody.innerHTML = '<tr><td colspan="9" class="logs-loading">No transactions match your filters.</td></tr>';
    return;
  }

  const deviceLabel = { trusted: 'Trusted', new: 'New', flagged: 'Flagged', vpn_proxy: 'VPN/Proxy' };
  const typeLabel   = { online_purchase: 'Online', wire_transfer: 'Wire', atm_withdrawal: 'ATM', pos_payment: 'POS', crypto_exchange: 'Crypto' };

  tbody.innerHTML = pageData.map(tx => {
    const verdictClass = tx.verdict === 'block' ? 'verdict-block' : tx.verdict === 'review' ? 'verdict-review' : 'verdict-clear';
    const verdictText  = tx.verdict === 'block' ? '🚫 Block' : tx.verdict === 'review' ? '⚠️ Review' : '✅ Clear';
    const scoreColor   = tx.riskScore >= 70 ? '#ff4d6d' : tx.riskScore >= 40 ? '#ffb830' : '#00e8a2';
    const warnCount    = (tx.signals || []).filter(s => s.cls === 'warn').length;
    const time         = new Date(tx.createdAt).toLocaleString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

    return `
      <tr class="log-row" onclick="expandLogRow(this, ${JSON.stringify(tx.signals || []).replace(/"/g, '&quot;')})">
        <td class="log-txnid">${tx.txnId}</td>
        <td class="log-amount">${formatINR(tx.amount)}</td>
        <td>${typeLabel[tx.transactionType] || tx.transactionType}</td>
        <td>${tx.country}</td>
        <td>${deviceLabel[tx.deviceRisk] || tx.deviceRisk}</td>
        <td><span class="score-pill" style="color:${scoreColor};border-color:${scoreColor}40;">${tx.riskScore}</span></td>
        <td><span class="verdict-badge ${verdictClass}">${verdictText}</span></td>
        <td><span class="signals-count">${warnCount} ⚠ ${(tx.signals||[]).length - warnCount} ✓</span></td>
        <td class="log-time">${time}</td>
      </tr>`;
  }).join('');
}

function expandLogRow(row, signalsJson) {
  // Remove existing expanded row
  const existing = document.querySelector('.log-expanded');
  if (existing) {
    existing.remove();
    if (existing.previousElementSibling === row) return;
  }

  let signals;
  try { signals = typeof signalsJson === 'string' ? JSON.parse(signalsJson) : signalsJson; }
  catch { signals = []; }

  const expanded = document.createElement('tr');
  expanded.className = 'log-expanded';
  expanded.innerHTML = `
    <td colspan="9" style="padding:0;">
      <div class="log-expand-body">
        <div class="log-expand-title">Signal Analysis</div>
        <div class="log-expand-signals">
          ${signals.length === 0
            ? '<span style="color:#6b7a99;font-size:.78rem;">No signals recorded</span>'
            : signals.map(s => `
                <div class="log-signal log-signal-${s.cls}">
                  ${s.cls === 'warn' ? '⚠' : s.cls === 'ok' ? '✓' : 'ℹ'} ${s.msg || s.message || ''}
                </div>`).join('')}
        </div>
      </div>
    </td>`;
  row.insertAdjacentElement('afterend', expanded);
}

/* ══════════════════════════════════════════════════════════
   MODAL SYSTEM
   ══════════════════════════════════════════════════════════ */
function closeModal() { document.getElementById('bh-modal')?.remove(); }

const IS = `width:100%;background:#0c1428;border:1px solid rgba(0,200,150,0.15);
  color:#e8f0ff;padding:12px 16px;border-radius:6px;
  font-family:'DM Mono',monospace;font-size:0.85rem;outline:none;
  margin-bottom:14px;box-sizing:border-box;`;
const BS = (c='#00e8a2') => `width:100%;background:${c};
  color:${c==='#00e8a2'?'#04070f':'#fff'};
  border:none;padding:13px;border-radius:6px;
  font-family:'Syne',sans-serif;font-weight:700;font-size:0.9rem;
  cursor:pointer;margin-top:6px;letter-spacing:.03em;
  transition:transform .15s;`;

function createModal(title, content) {
  closeModal();
  const o = document.createElement('div');
  o.id = 'bh-modal';
  o.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(4,7,15,0.93);backdrop-filter:blur(14px);display:flex;align-items:center;justify-content:center;padding:20px;';
  o.innerHTML = `
    <div style="background:#080e1c;border:1px solid rgba(0,232,162,0.25);border-radius:14px;padding:40px;max-width:460px;width:100%;position:relative;animation:fadeInUp .3s ease;">
      <button onclick="closeModal()" style="position:absolute;top:14px;right:14px;background:transparent;border:1px solid rgba(0,200,150,0.2);color:#6b7a99;width:30px;height:30px;border-radius:6px;cursor:pointer;font-size:1rem;display:flex;align-items:center;justify-content:center;">✕</button>
      <h2 style="font-family:'Syne',sans-serif;color:#00e8a2;margin-bottom:8px;font-size:1.4rem;">${title}</h2>
      ${content}
    </div>`;
  o.addEventListener('click', e => { if (e.target === o) closeModal(); });
  document.body.appendChild(o);
}

function showTrialModal() {
  createModal('Start Free Trial', `
    <p style="color:#6b7a99;font-size:.85rem;margin-bottom:20px;">14-day free trial. No credit card required.</p>
    <input id="t-name" type="text" placeholder="Your Name" style="${IS}"/>
    <input id="t-email" type="email" placeholder="Work Email" style="${IS}"/>
    <input id="t-pass" type="password" placeholder="Password (min 8 chars)" style="${IS}"/>
    <div id="t-msg" style="color:#ff4d6d;font-size:.8rem;min-height:18px;margin-bottom:8px;"></div>
    <button onclick="handleTrialSignup()" style="${BS()}">🚀 Start Free Trial</button>
    <p style="text-align:center;margin-top:14px;font-size:.78rem;color:#6b7a99;">Already have an account? <a href="#" onclick="showLoginModal()" style="color:#00e8a2;text-decoration:none;">Sign In</a></p>
  `);
  setTimeout(() => document.getElementById('t-name')?.focus(), 80);
}

async function handleTrialSignup() {
  const name  = document.getElementById('t-name')?.value.trim();
  const email = document.getElementById('t-email')?.value.trim();
  const pass  = document.getElementById('t-pass')?.value;
  const msg   = document.getElementById('t-msg');
  if (!name)  { msg.textContent = 'Name is required'; return; }
  if (!email) { msg.textContent = 'Email is required'; return; }
  if (!pass || pass.length < 8) { msg.textContent = 'Password must be at least 8 characters'; return; }
  const btn = document.querySelector('#bh-modal button[onclick="handleTrialSignup()"]');
  if (btn) { btn.textContent = '⏳ Creating account…'; btn.disabled = true; }
  msg.textContent = '';
  try {
    await AuthAPI.register(name, email, pass, 'viewer');
    closeModal(); showSuccessToast(`🎉 Welcome, ${name}! Account created.`);
    updateNavForLoggedIn();
    setTimeout(scrollToAnalyzer, 600);
  } catch (err) {
    msg.textContent = err.message || 'Registration failed.';
    if (btn) { btn.textContent = '🚀 Start Free Trial'; btn.disabled = false; }
  }
}

function showLoginModal() {
  createModal('Sign In', `
    <p style="color:#6b7a99;font-size:.85rem;margin-bottom:20px;">Sign in to access your fraud detection dashboard.</p>
    <input id="l-email" type="email" placeholder="Email" style="${IS}"/>
    <input id="l-pass" type="password" placeholder="Password" style="${IS}"/>
    <div id="l-msg" style="color:#ff4d6d;font-size:.8rem;min-height:18px;margin-bottom:8px;"></div>
    <button onclick="handleLogin()" style="${BS()}">🔐 Sign In</button>
    <div style="margin-top:16px;padding:14px;background:#0a1020;border-radius:8px;border:1px solid rgba(0,232,162,0.12);cursor:pointer;"
         onclick="document.getElementById('l-email').value='admin@backhackers.ai';document.getElementById('l-pass').value='Admin@1234';">
      <p style="color:#6b7a99;font-size:.72rem;margin-bottom:4px;letter-spacing:.06em;">DEMO CREDENTIALS (click to fill)</p>
      <p style="color:#00e8a2;font-family:'DM Mono',monospace;font-size:.78rem;">admin@backhackers.ai / Admin@1234</p>
    </div>
    <p style="text-align:center;margin-top:14px;font-size:.78rem;color:#6b7a99;">No account? <a href="#" onclick="showTrialModal()" style="color:#00e8a2;text-decoration:none;">Start Free Trial</a></p>
  `);
  setTimeout(() => document.getElementById('l-email')?.focus(), 80);
}

async function handleLogin() {
  const email = document.getElementById('l-email')?.value.trim();
  const pass  = document.getElementById('l-pass')?.value;
  const msg   = document.getElementById('l-msg');
  if (!email || !pass) { msg.textContent = 'Email and password required'; return; }
  const btn = document.querySelector('#bh-modal button[onclick="handleLogin()"]');
  if (btn) { btn.textContent = '⏳ Signing in…'; btn.disabled = true; }
  msg.textContent = '';
  try {
    await AuthAPI.login(email, pass);
    closeModal(); showSuccessToast('✅ Signed in successfully!');
    updateNavForLoggedIn();
    await loadAllData();
  } catch (err) {
    msg.textContent = err.message || 'Login failed. Check credentials.';
    if (btn) { btn.textContent = '🔐 Sign In'; btn.disabled = false; }
  }
}

function showDemoModal() {
  createModal('Live Demo', `
    <p style="color:#6b7a99;font-size:.85rem;margin-bottom:18px;">Run a real fraud analysis. Pick a scenario:</p>
    <button onclick="runDemoScenario('high')" style="width:100%;background:#1a0810;color:#ff4d6d;border:1px solid rgba(255,77,109,0.35);padding:13px;border-radius:6px;font-family:'Syne',sans-serif;font-weight:700;font-size:.88rem;cursor:pointer;margin-bottom:10px;text-align:left;">
      🚫 HIGH RISK — ₹15,00,000 · Crypto · Nigeria · 3 AM · Flagged Device
    </button>
    <button onclick="runDemoScenario('medium')" style="width:100%;background:#1a1408;color:#ffb830;border:1px solid rgba(255,184,48,0.35);padding:13px;border-radius:6px;font-family:'Syne',sans-serif;font-weight:700;font-size:.88rem;cursor:pointer;margin-bottom:10px;text-align:left;">
      ⚠️ MEDIUM RISK — ₹3,50,000 · Wire Transfer · Brazil · 10 PM
    </button>
    <button onclick="runDemoScenario('low')" style="width:100%;background:#001a10;color:#00e8a2;border:1px solid rgba(0,232,162,0.3);padding:13px;border-radius:6px;font-family:'Syne',sans-serif;font-weight:700;font-size:.88rem;cursor:pointer;margin-bottom:10px;text-align:left;">
      ✅ LOW RISK — ₹25,000 · Online Purchase · India · 2 PM
    </button>
    <button onclick="closeModal();scrollToAnalyzer()" style="${BS()} margin-top:4px;">⚡ Open Live Analyzer →</button>
  `);
}

function showContactModal(plan) {
  createModal(plan + ' Plan', `
    <p style="color:#6b7a99;font-size:.85rem;margin-bottom:20px;">${plan === 'Enterprise' ? 'Get a custom enterprise quote.' : `Get started with ${plan} — 14-day free trial.`}</p>
    <input id="c-name"  type="text"  placeholder="Your Name"    style="${IS}"/>
    <input id="c-email" type="email" placeholder="Work Email"   style="${IS}"/>
    <input id="c-org"   type="text"  placeholder="Organisation" style="${IS}"/>
    <div id="c-msg" style="color:#ff4d6d;font-size:.8rem;min-height:18px;margin-bottom:8px;"></div>
    <button onclick="handleContact('${plan}')" style="${BS()}">${plan === 'Enterprise' ? '📞 Request Demo Call' : '🚀 Get Started — ' + plan}</button>
  `);
  setTimeout(() => document.getElementById('c-name')?.focus(), 80);
}

function handleContact(plan) {
  const name  = document.getElementById('c-name')?.value.trim();
  const email = document.getElementById('c-email')?.value.trim();
  const msg   = document.getElementById('c-msg');
  if (!name || !email) { msg.textContent = 'Name and email required'; return; }
  closeModal(); showSuccessToast(`✅ Thanks ${name}! We'll contact you about ${plan} within 24 hours.`);
}

/* ── TOAST ─────────────────────────────────────────────── */
function showSuccessToast(message, duration = 4000) {
  document.getElementById('bh-toast')?.remove();
  const t = document.createElement('div'); t.id = 'bh-toast';
  t.style.cssText = 'position:fixed;bottom:28px;right:28px;z-index:99999;background:#080e1c;border:1px solid rgba(0,232,162,0.35);color:#e8f0ff;padding:14px 20px;border-radius:8px;font-family:\'DM Mono\',monospace;font-size:.82rem;box-shadow:0 8px 32px rgba(0,0,0,.5);max-width:360px;line-height:1.5;animation:slideInRight .3s ease;';
  t.textContent = message;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), duration);
}

/* ── NAV UPDATE ────────────────────────────────────────── */
function updateNavForLoggedIn() {
  const user = Auth.getUser(); if (!user) return;
  const btn  = document.querySelector('.nav-cta'); if (!btn) return;
  btn.textContent = `👤 ${user.name?.split(' ')[0] || 'Account'}`;
  btn.onclick = () => {
    const old = document.getElementById('user-menu'); if (old) { old.remove(); return; }
    const menu = document.createElement('div'); menu.id = 'user-menu';
    menu.style.cssText = 'position:fixed;top:66px;right:48px;z-index:9998;background:#080e1c;border:1px solid rgba(0,200,150,0.2);border-radius:8px;overflow:hidden;min-width:200px;box-shadow:0 8px 32px rgba(0,0,0,.5);';
    menu.innerHTML = `
      <div style="padding:12px 16px;font-size:.75rem;color:#6b7a99;border-bottom:1px solid rgba(0,200,150,0.1);">${user.email}</div>
      <div style="padding:10px 16px;font-size:.78rem;color:#6b7a99;border-bottom:1px solid rgba(0,200,150,0.1);">Role: <span style="color:#00e8a2;">${user.role}</span></div>
      <button onclick="AuthAPI.logout();document.getElementById('user-menu')?.remove();" style="width:100%;padding:12px 16px;background:transparent;color:#ff4d6d;border:none;cursor:pointer;text-align:left;font-family:'DM Mono',monospace;font-size:.82rem;">🚪 Sign Out</button>`;
    document.body.appendChild(menu);
    setTimeout(() => { document.addEventListener('click', function h(e) { if (!menu.contains(e.target)) { menu.remove(); document.removeEventListener('click', h); } }); }, 100);
  };
}

/* ══════════════════════════════════════════════════════════
   DASHBOARD LOADER
   ══════════════════════════════════════════════════════════ */
async function loadDashboard() {
  try {
    const stats   = await DashboardAPI.getStats();
    const summary = stats.summary || stats;

    const fc = document.getElementById('fraud-count');
    const sc = document.getElementById('safe-count');
    const rc = document.getElementById('review-count');
    const as = document.getElementById('avg-score');

    if (fc && summary.fraudBlocked  != null) animateCounter(fc, summary.fraudBlocked);
    if (sc && summary.safePassed    != null) animateCounter(sc, summary.safePassed);
    if (rc && summary.underReview   != null) animateCounter(rc, summary.underReview);
    if (as && summary.avgRiskScore  != null) animateCounter(as, Math.round(summary.avgRiskScore));

    const gl = document.getElementById('gauge-score');
    const gp = document.getElementById('gauge-path');
    const gs = document.getElementById('gauge-status');
    if (gl && summary.avgRiskScore != null) {
      const s = Math.round(summary.avgRiskScore);
      gl.textContent = s;
      if (gp) gp.style.strokeDashoffset = 251 - (s / 100) * 251;
      if (gs) gs.textContent = s >= 70 ? 'HIGH' : s >= 40 ? 'ELEVATED' : 'NORMAL';
    }

    buildTxFeed(stats.recentTransactions);
    renderVolumeChart(stats.hourlyVolume);
    renderVerdictChart(stats.verdictBreakdown);
  } catch (err) {
    console.warn('Dashboard data unavailable:', err.message);
    renderVolumeChart([]);
    renderVerdictChart([]);
  }
}

/* ══════════════════════════════════════════════════════════
   ANALYTICS LOADER
   ══════════════════════════════════════════════════════════ */
async function loadAnalytics() {
  try {
    const [trend, countries, devices, types, dist] = await Promise.allSettled([
      AnalyticsAPI.trend(7),
      AnalyticsAPI.countryHeatmap(30),
      AnalyticsAPI.deviceBreakdown(),
      AnalyticsAPI.typeBreakdown(),
      AnalyticsAPI.riskDistribution(),
    ]);

    renderTrendChart(trend.status    === 'fulfilled' ? trend.value    : []);
    renderCountryChart(countries.status === 'fulfilled' ? countries.value : []);
    renderDeviceChart(devices.status  === 'fulfilled' ? devices.value  : []);
    renderTxTypeChart(types.status   === 'fulfilled' ? types.value    : []);
    renderRiskDistChart(dist.status  === 'fulfilled' ? dist.value     : []);
  } catch (err) {
    console.warn('Analytics unavailable:', err.message);
    renderTrendChart([]); renderCountryChart([]); renderDeviceChart([]);
    renderTxTypeChart([]); renderRiskDistChart([]);
  }
}

/* ══════════════════════════════════════════════════════════
   TICKER LOADER
   ══════════════════════════════════════════════════════════ */
async function loadTicker() {
  try {
    const ticker = await DashboardAPI.getTicker();
    if (!ticker?.length) return;
    const wrap = document.querySelector('.ticker'); if (!wrap) return;
    const items = ticker.slice(0, 7).map(tx => {
      const isBlock = tx.status === 'BLOCKED' || tx.verdict === 'block';
      const label   = isBlock ? `<span>BLOCKED</span>` : `<span style="color:var(--accent)">CLEARED</span>`;
      return `<div class="tick-item">${tx.txnId} ${label} · ${formatINR(tx.amount)} <div class="tick-sep">|</div></div>`;
    });
    wrap.innerHTML = [...items, ...items].join('');
  } catch { }
}

/* ── TX Feed ────────────────────────────────────────────── */
function buildTxFeed(transactions) {
  const feed = document.getElementById('live-feed'); if (!feed) return;
  const staticData = [
    { txnId:'TXN-99142', amount:1254000, verdict:'block' },
    { txnId:'TXN-99143', amount:23400,   verdict:'clear' },
    { txnId:'TXN-99144', amount:320000,  verdict:'review' },
    { txnId:'TXN-99145', amount:89000,   verdict:'clear' },
    { txnId:'TXN-99146', amount:810000,  verdict:'block' },
  ];
  const rows = transactions?.length ? transactions : staticData;
  feed.innerHTML = '';
  rows.slice(0, 6).forEach((tx, i) => {
    const isBlock = tx.verdict === 'block'; const isClear = tx.verdict === 'clear';
    const row = document.createElement('div');
    row.className = 'tx-row ' + (isBlock ? 'flagged' : isClear ? 'safe-tx' : '');
    row.style.animationDelay = (i * 0.15) + 's';
    const bc = isBlock ? 'badge-fraud' : isClear ? 'badge-ok' : 'badge-review';
    const lb = isBlock ? 'FRAUD' : isClear ? 'CLEAR' : 'REVIEW';
    row.innerHTML = `<div><div class="tx-id">${tx.txnId||tx.id}</div><div class="tx-amount">${formatINR(tx.amount)}</div></div><span class="tx-badge ${bc}">${lb}</span>`;
    feed.appendChild(row);
  });
}

/* ── Counter Animation ──────────────────────────────────── */
function animateCounter(el, target) {
  if (!el || target == null) return;
  let cur = 0; const inc = Math.ceil(target / 60);
  const t = setInterval(() => {
    cur = Math.min(cur + inc, target);
    el.textContent = cur.toLocaleString('en-IN');
    if (cur >= target) clearInterval(t);
  }, 30);
}

/* ══════════════════════════════════════════════════════════
   FRAUD ANALYZER
   ══════════════════════════════════════════════════════════ */
function scrollToAnalyzer() {
  document.getElementById('analyzer-section')?.scrollIntoView({ behavior: 'smooth' });
}

function readFormParams() {
  const typeMap   = { 'Online Purchase':'online_purchase','Wire Transfer':'wire_transfer','ATM Withdrawal':'atm_withdrawal','POS Payment':'pos_payment','Crypto Exchange':'crypto_exchange' };
  const deviceMap = { 'New Device':'new','Trusted Device':'trusted','Flagged Device':'flagged','VPN / Proxy':'vpn_proxy' };
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
  document.getElementById('result-idle').style.display = 'none';
  const d = document.getElementById('result-display');
  d.style.display = 'block'; d.classList.add('visible');

  const scoreEl = document.getElementById('risk-score-display');
  const barEl   = document.getElementById('risk-bar');
  const vEl     = document.getElementById('risk-verdict');
  const sigEl   = document.getElementById('signals-list');

  if (scoreEl) { scoreEl.textContent = score; scoreEl.style.color = score >= 70 ? 'var(--accent2)' : score >= 40 ? '#ffb830' : 'var(--accent)'; }
  if (barEl)   setTimeout(() => { barEl.style.width = score + '%'; }, 50);
  if (vEl) {
    if (score >= 70) { vEl.textContent = '🚫 HIGH RISK — BLOCK RECOMMENDED'; vEl.style.color = 'var(--accent2)'; }
    else if (score >= 40) { vEl.textContent = '⚠️ MEDIUM RISK — REVIEW REQUIRED'; vEl.style.color = '#ffb830'; }
    else { vEl.textContent = '✅ LOW RISK — CLEAR TO PROCEED'; vEl.style.color = 'var(--accent)'; }
  }

  // Score breakdown mini visual
  const sb = document.getElementById('score-breakdown');
  if (sb) {
    const warnCount = (signals||[]).filter(s => s.cls === 'warn').length;
    const okCount   = (signals||[]).filter(s => s.cls === 'ok').length;
    const infoCount = (signals||[]).filter(s => s.cls === 'info').length;
    sb.innerHTML = `
      <div class="score-breakdown-grid">
        <div class="sb-item sb-warn"><div class="sb-num">${warnCount}</div><div class="sb-lab">Warnings</div></div>
        <div class="sb-item sb-info"><div class="sb-num">${infoCount}</div><div class="sb-lab">Alerts</div></div>
        <div class="sb-item sb-ok"><div class="sb-num">${okCount}</div><div class="sb-lab">Clear</div></div>
        <div class="sb-item sb-total"><div class="sb-num">${score}</div><div class="sb-lab">Risk Score</div></div>
      </div>`;
  }

  if (sigEl) {
    sigEl.innerHTML = '';
    (signals || []).forEach(s => {
      const li = document.createElement('li');
      const cls = s.cls || 'ok';
      li.className = 'signal-item ' + cls;
      li.textContent = (cls === 'warn' ? '⚠ ' : cls === 'ok' ? '✓ ' : 'ℹ ') + (s.msg || s.message || '');
      sigEl.appendChild(li);
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
    showSuccessToast('❌ Analysis failed: ' + err.message);
  } finally {
    if (btn) { btn.textContent = '⚡ Run Fraud Analysis'; btn.disabled = false; }
  }
}

async function runDemoScenario(level) {
  closeModal(); scrollToAnalyzer();
  await new Promise(r => setTimeout(r, 700));
  const s = { high:{amount:15000,type:'Crypto Exchange',country:'Nigeria',hour:3,device:'Flagged Device',velocity:8}, medium:{amount:3500,type:'Wire Transfer',country:'Brazil',hour:22,device:'New Device',velocity:3}, low:{amount:250,type:'Online Purchase',country:'India',hour:14,device:'Trusted Device',velocity:1} }[level];
  const sv = (id, v) => { const el = document.getElementById(id); if (el) el.value = v; };
  const ss = (id, t) => { const el = document.getElementById(id); if (!el) return; [...el.options].forEach((o,i) => { if (o.text === t) el.selectedIndex = i; }); };
  sv('tx-amount', s.amount); sv('tx-hour', s.hour); sv('tx-velocity', s.velocity);
  ss('tx-type', s.type); ss('tx-country', s.country); ss('tx-device', s.device);
  await analyzeTransaction();
}

/* ══════════════════════════════════════════════════════════
   LOCAL FALLBACK ENGINE
   ══════════════════════════════════════════════════════════ */
function _localAnalyze({ amount, transactionType, country, hourOfDay, deviceRisk, velocity }) {
  let score = 10; const signals = [];
  if (amount > 800000)      { score+=35; signals.push({cls:'warn',msg:`High value (${formatINR(amount)}) — above ₹8L threshold`}); }
  else if (amount > 250000) { score+=18; signals.push({cls:'warn',msg:`Above-average amount (${formatINR(amount)})`}); }
  else if (amount > 50000)  { score+=5;  signals.push({cls:'info',msg:`Moderate amount (${formatINR(amount)})`}); }
  else                       { signals.push({cls:'ok',msg:`Amount within low-risk range (${formatINR(amount)})`}); }
  const highRisk = ['Nigeria','Russia','Brazil','Iran','Venezuela','Myanmar','North Korea'];
  const medRisk  = ['Pakistan','Romania','Ukraine','Vietnam','Bangladesh'];
  if (highRisk.includes(country))      { score+=28; signals.push({cls:'warn',msg:`High-risk jurisdiction: ${country} — FATF monitored`}); }
  else if (medRisk.includes(country))  { score+=12; signals.push({cls:'info',msg:`Medium-risk: ${country} — elevated monitoring`}); }
  else                                  { signals.push({cls:'ok',msg:`Country risk low: ${country}`}); }
  if (hourOfDay>=1&&hourOfDay<=4)       { score+=20; signals.push({cls:'warn',msg:`Off-hours: ${hourOfDay}:00 AM (1–4 AM window)`}); }
  else if (hourOfDay===0||hourOfDay>=22){ score+=8;  signals.push({cls:'info',msg:`Late/early hour: ${hourOfDay}:00`}); }
  else                                  { signals.push({cls:'ok',msg:`Normal business hour: ${hourOfDay}:00`}); }
  if (deviceRisk==='flagged')           { score+=30; signals.push({cls:'warn',msg:'Device in fraud registry — immediate flag'}); }
  else if (deviceRisk==='vpn_proxy')   { score+=22; signals.push({cls:'warn',msg:'VPN/Proxy — identity obfuscation'}); }
  else if (deviceRisk==='new')          { score+=10; signals.push({cls:'info',msg:'New device — monitoring'}); }
  else                                  { signals.push({cls:'ok',msg:'Trusted device — verified'}); }
  if (velocity>=8)      { score+=30; signals.push({cls:'warn',msg:`Critical velocity: ${velocity} txns/hr`}); }
  else if (velocity>=5) { score+=25; signals.push({cls:'warn',msg:`Velocity breach: ${velocity} txns/hr`}); }
  else if (velocity>=3) { score+=10; signals.push({cls:'info',msg:`Elevated velocity: ${velocity}/hr`}); }
  else                   { signals.push({cls:'ok',msg:`Normal velocity: ${velocity}/hr`}); }
  if (transactionType==='crypto_exchange')   { score+=15; signals.push({cls:'warn',msg:'Crypto — money laundering vector'}); }
  else if (transactionType==='wire_transfer'){ score+=8;  signals.push({cls:'info',msg:'Wire transfer — extra verification recommended'}); }
  else                                        { signals.push({cls:'ok',msg:`Type "${transactionType}" — standard risk`}); }
  const wc = signals.filter(s=>s.cls==='warn').length;
  if (wc>=3) { const b=Math.round(score*0.15); score+=b; signals.push({cls:'warn',msg:`Multi-factor compounding: ${wc} signals (+${b} pts)`}); }
  return { score:Math.min(score,100), signals, verdict:score>=70?'block':score>=40?'review':'clear' };
}

/* ══════════════════════════════════════════════════════════
   LOAD ALL DATA
   ══════════════════════════════════════════════════════════ */
async function loadAllData() {
  await Promise.allSettled([
    loadDashboard(),
    loadAnalytics(),
    loadTicker(),
    loadTransactionLogs(),
  ]);
}

/* ══════════════════════════════════════════════════════════
   BOOT
   ══════════════════════════════════════════════════════════ */
window.addEventListener('load', async () => {
  // Wire nav links smooth scroll
  document.querySelectorAll('.nav-links a').forEach(a => {
    a.addEventListener('click', e => {
      e.preventDefault();
      const id = a.getAttribute('href')?.slice(1);
      document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
    });
  });

  // Update nav if already logged in
  if (Auth.getUser()) updateNavForLoggedIn();

  // Animate static counters immediately
  animateCounter(document.getElementById('fraud-count'),  1247);
  animateCounter(document.getElementById('safe-count'),   98341);
  animateCounter(document.getElementById('review-count'), 342);
  animateCounter(document.getElementById('avg-score'),    34);

  // Render static charts immediately (no auth needed)
  renderVolumeChart([]);
  renderVerdictChart([]);
  renderRiskDistChart([]);
  renderTrendChart([]);
  renderCountryChart([]);
  renderDeviceChart([]);
  renderTxTypeChart([]);

  // Static TX feed
  buildTxFeed([]);

  // Load sample logs immediately
  loadTransactionLogs();

  // Auto-login as viewer to get real data
  try {
    if (!Auth.getToken()) {
      await AuthAPI.login('viewer@backhackers.ai', 'Viewer@1234');
    }
  } catch (e) {
    console.warn('Auto viewer login failed (run npm run seed):', e.message);
  }

  // Load real data from backend
  await Promise.allSettled([loadDashboard(), loadAnalytics(), loadTicker()]);
});

if (typeof module !== 'undefined') {
  module.exports = { AuthAPI, TransactionAPI, DashboardAPI, AnalyticsAPI };
}
