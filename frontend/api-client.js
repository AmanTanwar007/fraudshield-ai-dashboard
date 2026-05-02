/* ══════════════════════════════════════════════════════════
   BackHackers AI — Frontend API Client v6.0
   Fixes: Failed to fetch, 403, real-time updates after analysis
   ══════════════════════════════════════════════════════════ */
'use strict';

/* ── CONFIG ──────────────────────────────────────────────── */
const BACKEND_URL = (() => {
  const h = window.location.hostname;
  if (h === 'localhost' || h === '127.0.0.1') return 'http://localhost:5000';
  // Same-domain deployment — API is served from /api/* on same origin
  return '';
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
  const url = `${BACKEND_URL}${path}`;
  try {
    const res = await fetch(url, { headers: Auth.getHeaders(), ...options });
    let body;
    try { body = await res.json(); } catch { body = { message: `HTTP ${res.status}` }; }
    if (res.status === 401) Auth.clearToken();
    if (!res.ok) throw new Error(body.message || `HTTP ${res.status}`);
    return body;
  } catch (err) {
    if (err.message === 'Failed to fetch') {
      throw new Error('Cannot reach backend. Check your internet connection.');
    }
    throw err;
  }
}

/* ══════════════════════════════════════════════════════════
   API MODULES
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
  async trend(days = 7)        { const b = await apiFetch(`/api/analytics/trend?days=${days}`); return b.data?.trend || b.trend || []; },
  async countryHeatmap(d = 30) { const b = await apiFetch(`/api/analytics/country-heatmap?days=${d}`); return b.data?.heatmap || b.heatmap || []; },
  async deviceBreakdown()      { const b = await apiFetch('/api/analytics/device-breakdown'); return b.data?.breakdown || b.breakdown || []; },
  async typeBreakdown()        { const b = await apiFetch('/api/analytics/type-breakdown'); return b.data?.breakdown || b.breakdown || []; },
  async riskDistribution()     { const b = await apiFetch('/api/analytics/risk-distribution'); return b.data?.distribution || b.distribution || []; },
};

/* ══════════════════════════════════════════════════════════
   CHART REGISTRY
   ══════════════════════════════════════════════════════════ */
const Charts = {};
function destroyChart(id) { if (Charts[id]) { Charts[id].destroy(); delete Charts[id]; } }

// Shared Chart.js defaults
const CHART_DEFAULTS = {
  plugins: { legend: { display: false } },
  animation: { duration: 600 },
};

function chartAxes(xColor = '#6b7a99', yColor = '#6b7a99') {
  return {
    x: { ticks: { color: xColor, font: { size: 10 } }, grid: { color: 'rgba(255,255,255,0.04)' } },
    y: { ticks: { color: yColor, font: { size: 10 } }, grid: { color: 'rgba(255,255,255,0.06)' } },
  };
}

/* ══════════════════════════════════════════════════════════
   RENDER CHARTS
   ══════════════════════════════════════════════════════════ */
function renderVolumeChart(hourlyData) {
  destroyChart('volumeChart');
  const ctx = document.getElementById('volumeChart'); if (!ctx) return;
  const safeD = Array(24).fill(0), fraudD = Array(24).fill(0), reviewD = Array(24).fill(0);
  (hourlyData || []).forEach(h => {
    const i = parseInt(h.hour);
    if (i >= 0 && i < 24) { safeD[i] = (h.total || 0) - (h.blocked || 0); fraudD[i] = h.blocked || 0; }
  });
  if (!hourlyData?.length) {
    [2,5,8,12,15,18,20,22].forEach(i => safeD[i]   = Math.floor(Math.random()*800+200));
    [3,7,14,19,23].forEach(i        => fraudD[i]  = Math.floor(Math.random()*80+10));
    [4,11,16,21].forEach(i          => reviewD[i] = Math.floor(Math.random()*30+5));
  }
  Charts.volumeChart = new Chart(ctx, {
    type: 'bar',
    data: { labels: Array.from({length:24},(_,i)=>`${i}:00`), datasets: [
      { label:'Safe',   data:safeD,   backgroundColor:'rgba(0,232,162,0.7)',  borderRadius:2 },
      { label:'Fraud',  data:fraudD,  backgroundColor:'rgba(255,77,109,0.85)',borderRadius:2 },
      { label:'Review', data:reviewD, backgroundColor:'rgba(255,184,48,0.7)', borderRadius:2 },
    ]},
    options: { ...CHART_DEFAULTS, responsive:true, maintainAspectRatio:false,
      scales: { x:{...chartAxes().x,stacked:true,ticks:{...chartAxes().x.ticks,maxTicksLimit:12}}, y:{...chartAxes().y,stacked:true} } },
  });
}

function renderVerdictChart(verdictData) {
  destroyChart('verdictChart');
  const ctx = document.getElementById('verdictChart'); if (!ctx) return;
  let clear=7900, review=1300, block=800;
  (verdictData||[]).forEach(v => {
    if (v.verdict==='clear')  clear  = parseInt(v.count);
    if (v.verdict==='review') review = parseInt(v.count);
    if (v.verdict==='block')  block  = parseInt(v.count);
  });
  Charts.verdictChart = new Chart(ctx, {
    type:'doughnut',
    data:{ labels:['Clear','Review','Block'], datasets:[{ data:[clear,review,block], backgroundColor:['#00e8a2','#ffb830','#ff4d6d'], borderWidth:0, hoverOffset:6 }] },
    options:{ responsive:true, maintainAspectRatio:false, cutout:'68%',
      animation:{ duration:600 },
      plugins:{ legend:{ display:false }, tooltip:{ callbacks:{ label:c=>` ${c.label}: ${c.parsed.toLocaleString('en-IN')}` } } } },
  });
}

function renderRiskDistChart(distData) {
  destroyChart('riskDistChart');
  const ctx = document.getElementById('riskDistChart'); if (!ctx) return;
  const sample = [{range:'0-9',count:1200},{range:'10-19',count:2800},{range:'20-29',count:3400},{range:'30-39',count:1900},{range:'40-49',count:980},{range:'50-59',count:640},{range:'60-69',count:420},{range:'70-79',count:280},{range:'80-89',count:180},{range:'90-100',count:120}];
  const data   = distData?.length ? distData : sample;
  Charts.riskDistChart = new Chart(ctx, {
    type:'bar',
    data:{ labels:data.map(d=>d.range), datasets:[{ label:'Txns', data:data.map(d=>d.count), backgroundColor:data.map((_,i)=>i<=3?'rgba(0,232,162,0.75)':i<=6?'rgba(255,184,48,0.75)':'rgba(255,77,109,0.85)'), borderRadius:3 }] },
    options:{ ...CHART_DEFAULTS, responsive:true, maintainAspectRatio:false, scales:chartAxes() },
  });
}

function renderTrendChart(trendData) {
  destroyChart('trendChart');
  const ctx = document.getElementById('trendChart'); if (!ctx) return;
  const days7 = Array.from({length:7},(_,i)=>{ const d=new Date(); d.setDate(d.getDate()-(6-i)); return d.toLocaleDateString('en-IN',{month:'short',day:'numeric'}); });
  const fraudV = trendData?.length ? trendData.slice(-7).map(d=>parseInt(d.blocked||0))  : [45,62,38,71,55,89,67];
  const safeV  = trendData?.length ? trendData.slice(-7).map(d=>parseInt(d.total||0)-parseInt(d.blocked||0)) : [1200,980,1450,1100,1380,920,1560];
  const labels = trendData?.length ? trendData.slice(-7).map(d=>new Date(d.date).toLocaleDateString('en-IN',{month:'short',day:'numeric'})) : days7;
  Charts.trendChart = new Chart(ctx, {
    type:'line',
    data:{ labels, datasets:[
      { label:'Fraud', data:fraudV, borderColor:'#ff4d6d', backgroundColor:'rgba(255,77,109,0.12)', tension:0.4, fill:true, borderWidth:2, pointBackgroundColor:'#ff4d6d', pointRadius:4 },
      { label:'Safe',  data:safeV,  borderColor:'#00e8a2', backgroundColor:'rgba(0,232,162,0.08)',  tension:0.4, fill:true, borderWidth:2, pointBackgroundColor:'#00e8a2', pointRadius:4, yAxisID:'y2' },
    ]},
    options:{ responsive:true, maintainAspectRatio:false,
      animation:{ duration:600 },
      plugins:{ legend:{ display:false } },
      scales:{
        x: { ticks:{color:'#6b7a99',font:{size:10}}, grid:{color:'rgba(255,255,255,0.04)'} },
        y: { ticks:{color:'#ff4d6d',font:{size:10}}, grid:{color:'rgba(255,255,255,0.06)'}, title:{display:true,text:'Fraud',color:'#ff4d6d',font:{size:10}} },
        y2:{ position:'right', ticks:{color:'#00e8a2',font:{size:10}}, grid:{display:false}, title:{display:true,text:'Safe',color:'#00e8a2',font:{size:10}} },
      },
    },
  });
}

function renderDeviceChart(deviceData) {
  destroyChart('deviceChart');
  const ctx = document.getElementById('deviceChart'); if (!ctx) return;
  const labelMap = {trusted:'Trusted',new:'New Device',flagged:'Flagged',vpn_proxy:'VPN/Proxy'};
  const labels = deviceData?.length ? deviceData.map(d=>labelMap[d.deviceRisk]||d.deviceRisk) : ['Trusted','New Device','VPN/Proxy','Flagged'];
  const totals = deviceData?.length ? deviceData.map(d=>parseInt(d.total))  : [8200,1400,320,80];
  const fraudC = deviceData?.length ? deviceData.map(d=>parseInt(d.blocked)) : [120,280,180,72];
  Charts.deviceChart = new Chart(ctx, {
    type:'bar',
    data:{ labels, datasets:[
      { label:'Total', data:totals, backgroundColor:'rgba(0,232,162,0.3)',  borderRadius:3 },
      { label:'Fraud', data:fraudC, backgroundColor:'rgba(255,77,109,0.8)', borderRadius:3 },
    ]},
    options:{ ...CHART_DEFAULTS, indexAxis:'y', responsive:true, maintainAspectRatio:false,
      scales:{ x:{...chartAxes().x}, y:{ticks:{color:'#6b7a99',font:{size:10}},grid:{display:false}} } },
  });
}

function renderCountryChart(countryData) {
  destroyChart('countryChart');
  const ctx = document.getElementById('countryChart'); if (!ctx) return;
  const sample = [{country:'Nigeria',blocked:420},{country:'Russia',blocked:380},{country:'Brazil',blocked:290},{country:'Pakistan',blocked:210},{country:'Romania',blocked:180},{country:'Ukraine',blocked:150},{country:'China',blocked:120},{country:'Bangladesh',blocked:95}];
  const top8   = countryData?.length ? countryData.slice(0,8) : sample;
  Charts.countryChart = new Chart(ctx, {
    type:'bar',
    data:{ labels:top8.map(d=>d.country), datasets:[{ label:'Fraud Blocks', data:top8.map(d=>parseInt(d.blocked||d.total||0)), backgroundColor:top8.map((_,i)=>`rgba(255,${Math.round(77+i*8)},${Math.round(109-i*4)},${0.9-i*0.07})`), borderRadius:4 }] },
    options:{ ...CHART_DEFAULTS, responsive:true, maintainAspectRatio:false,
      scales:{ x:{ticks:{color:'#6b7a99',font:{size:10},maxRotation:30},grid:{color:'rgba(255,255,255,0.04)'}}, y:{...chartAxes().y} } },
  });
}

function renderTxTypeChart(typeData) {
  destroyChart('txTypeChart');
  const ctx = document.getElementById('txTypeChart'); if (!ctx) return;
  const labelMap = {online_purchase:'Online',wire_transfer:'Wire',atm_withdrawal:'ATM',pos_payment:'POS',crypto_exchange:'Crypto'};
  const sample = [{transactionType:'crypto_exchange',blocked:280},{transactionType:'wire_transfer',blocked:195},{transactionType:'online_purchase',blocked:145},{transactionType:'atm_withdrawal',blocked:90},{transactionType:'pos_payment',blocked:40}];
  const data   = typeData?.length ? typeData : sample;
  Charts.txTypeChart = new Chart(ctx, {
    type:'pie',
    data:{ labels:data.map(d=>labelMap[d.transactionType]||d.transactionType), datasets:[{ data:data.map(d=>parseInt(d.blocked||0)), backgroundColor:['#ff4d6d','#ffb830','#00e8a2','#7b5ea7','#00bfff'], borderWidth:0, hoverOffset:8 }] },
    options:{ responsive:true, maintainAspectRatio:false, animation:{duration:600},
      plugins:{ legend:{ display:true, position:'right', labels:{color:'#6b7a99',font:{size:10},boxWidth:10,padding:8} } } },
  });
}

/* ══════════════════════════════════════════════════════════
   TRANSACTION LOGS
   ══════════════════════════════════════════════════════════ */
let allLogs      = [];
let filteredLogs = [];
let currentPage  = 1;
const LOGS_PER_PAGE = 10;
let sortKey = 'createdAt', sortDir = 'desc';

function generateSampleLogs(count = 60) {
  const types    = ['online_purchase','wire_transfer','atm_withdrawal','pos_payment','crypto_exchange'];
  const countries = ['India','United States','Nigeria','Russia','Germany','Brazil','China','United Kingdom','Pakistan','France'];
  const devices  = ['trusted','trusted','trusted','new','flagged','vpn_proxy'];
  return Array.from({length: count}, (_, idx) => {
    const amount  = Math.floor(Math.random()*500000)+1000;
    const score   = Math.floor(Math.random()*100)+1;
    const verdict = score>=70?'block':score>=40?'review':'clear';
    const date    = new Date(Date.now() - Math.random()*7*24*60*60*1000);
    const txnId   = `TXN-${(Date.now()-idx*1000).toString(36).toUpperCase().slice(-5)}-${Math.random().toString(36).slice(2,5).toUpperCase()}`;
    return { txnId, amount, currency:'INR',
      transactionType: types[Math.floor(Math.random()*types.length)],
      country: countries[Math.floor(Math.random()*countries.length)],
      deviceRisk: devices[Math.floor(Math.random()*devices.length)],
      velocity: Math.floor(Math.random()*10)+1,
      riskScore: score, verdict,
      signals: score>=70
        ? [{cls:'warn',msg:'High-risk pattern detected'},{cls:'warn',msg:'Suspicious device activity'}]
        : score>=40
          ? [{cls:'info',msg:'Moderate risk factors present'},{cls:'ok',msg:'No critical signals'}]
          : [{cls:'ok',msg:'Normal transaction pattern'},{cls:'ok',msg:'Trusted credentials'}],
      createdAt: date.toISOString(),
    };
  }).sort((a,b) => new Date(b.createdAt)-new Date(a.createdAt));
}

async function loadTransactionLogs() {
  try {
    const result = await TransactionAPI.list({ limit:100, page:1 });
    const rows   = result.data || result || [];
    allLogs      = rows.length > 0 ? rows.map(t => ({...t, amount:parseFloat(t.amount)})) : generateSampleLogs();
  } catch {
    allLogs = generateSampleLogs();
  }
  filteredLogs = [...allLogs];
  renderLogsTable();
}

/* ── Add a new transaction to the top of the logs ── */
function prependToLogs(txData) {
  const entry = {
    txnId:           txData.txnId || ('TXN-LIVE-' + Date.now().toString(36).toUpperCase()),
    amount:          parseFloat(document.getElementById('tx-amount')?.value) || 500,
    currency:        'INR',
    transactionType: document.getElementById('tx-type')?.value || 'online_purchase',
    country:         document.getElementById('tx-country')?.value || 'India',
    deviceRisk:      txData.deviceRisk || 'trusted',
    velocity:        parseInt(document.getElementById('tx-velocity')?.value) || 1,
    riskScore:       txData.score,
    verdict:         txData.verdict,
    signals:         txData.signals || [],
    createdAt:       new Date().toISOString(),
    isNew:           true,
  };
  allLogs.unshift(entry);
  filteredLogs = [...allLogs];
  // Re-apply current filters
  filterLogs();
  // Flash the first row
  setTimeout(() => {
    const firstRow = document.querySelector('#logs-tbody tr');
    if (firstRow) { firstRow.style.background = 'rgba(0,232,162,0.12)'; setTimeout(() => { firstRow.style.background = ''; }, 2000); }
  }, 100);
}

function filterLogs() {
  const verdict  = document.getElementById('filter-verdict')?.value  || '';
  const minScore = parseInt(document.getElementById('filter-score')?.value) || 0;
  const search   = (document.getElementById('filter-search')?.value  || '').toLowerCase();
  filteredLogs   = allLogs.filter(tx => {
    if (verdict   && tx.verdict   !== verdict)           return false;
    if (minScore  && tx.riskScore  < minScore)           return false;
    if (search    && !tx.txnId.toLowerCase().includes(search)) return false;
    return true;
  });
  currentPage = 1;
  renderLogsTable();
}

function resetFilters() {
  const fv = document.getElementById('filter-verdict');  if (fv) fv.value = '';
  const fs = document.getElementById('filter-score');   if (fs) fs.value = '';
  const fq = document.getElementById('filter-search');  if (fq) fq.value = '';
  filteredLogs = [...allLogs]; currentPage = 1; renderLogsTable();
}

function sortLogs(key) {
  sortDir  = sortKey === key ? (sortDir==='asc'?'desc':'asc') : 'desc';
  sortKey  = key;
  filteredLogs.sort((a,b) => {
    let av=a[key], bv=b[key];
    if (key==='amount'||key==='riskScore')   { av=parseFloat(av); bv=parseFloat(bv); }
    if (key==='createdAt')                    { av=new Date(av); bv=new Date(bv); }
    if (av<bv) return sortDir==='asc'?-1:1;
    if (av>bv) return sortDir==='asc'?1:-1;
    return 0;
  });
  renderLogsTable();
}

function changePage(dir) {
  const total = Math.ceil(filteredLogs.length / LOGS_PER_PAGE);
  currentPage = Math.max(1, Math.min(currentPage+dir, total));
  renderLogsTable();
}

function renderLogsTable() {
  const tbody   = document.getElementById('logs-tbody');   if (!tbody) return;
  const countEl = document.getElementById('filter-count');
  const pageEl  = document.getElementById('page-info');
  const prevBtn = document.getElementById('page-prev');
  const nextBtn = document.getElementById('page-next');

  const total      = filteredLogs.length;
  const totalPages = Math.max(1, Math.ceil(total/LOGS_PER_PAGE));
  const start      = (currentPage-1)*LOGS_PER_PAGE;
  const pageData   = filteredLogs.slice(start, start+LOGS_PER_PAGE);

  if (countEl) countEl.textContent = `Showing ${total} transaction${total!==1?'s':''}`;
  if (pageEl)  pageEl.textContent  = `Page ${currentPage} of ${totalPages}`;
  if (prevBtn) prevBtn.disabled    = currentPage<=1;
  if (nextBtn) nextBtn.disabled    = currentPage>=totalPages;

  if (!pageData.length) { tbody.innerHTML='<tr><td colspan="9" class="logs-loading">No transactions match your filters.</td></tr>'; return; }

  const devL = {trusted:'Trusted',new:'New',flagged:'Flagged',vpn_proxy:'VPN/Proxy'};
  const typL = {online_purchase:'Online',wire_transfer:'Wire',atm_withdrawal:'ATM',pos_payment:'POS',crypto_exchange:'Crypto'};

  tbody.innerHTML = pageData.map((tx, idx) => {
    const vc = tx.verdict==='block'?'verdict-block':tx.verdict==='review'?'verdict-review':'verdict-clear';
    const vt = tx.verdict==='block'?'🚫 Block':tx.verdict==='review'?'⚠️ Review':'✅ Clear';
    const sc = tx.riskScore>=70?'#ff4d6d':tx.riskScore>=40?'#ffb830':'#00e8a2';
    const wc = (tx.signals||[]).filter(s=>s.cls==='warn').length;
    const oc = (tx.signals||[]).filter(s=>s.cls==='ok').length;
    const tm = new Date(tx.createdAt).toLocaleString('en-IN',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'});
    const isNew = tx.isNew ? 'class="log-row log-new"' : 'class="log-row"';
    const sigsJson = JSON.stringify(tx.signals||[]).replace(/"/g,'&quot;');
    return `
      <tr ${isNew} onclick="expandLogRow(this,'${sigsJson}')">
        <td class="log-txnid">${tx.txnId}</td>
        <td class="log-amount">${formatINR(tx.amount)}</td>
        <td>${typL[tx.transactionType]||tx.transactionType}</td>
        <td>${tx.country}</td>
        <td>${devL[tx.deviceRisk]||tx.deviceRisk}</td>
        <td><span class="score-pill" style="color:${sc};border-color:${sc}40;">${tx.riskScore}</span></td>
        <td><span class="verdict-badge ${vc}">${vt}</span></td>
        <td><span class="signals-count">${wc}⚠ ${oc}✓</span></td>
        <td class="log-time">${tm}</td>
      </tr>`;
  }).join('');

  // Clear isNew flags after render
  allLogs.forEach(t => delete t.isNew);
}

function expandLogRow(row, sigsStr) {
  document.querySelector('.log-expanded')?.remove();
  let sigs; try { sigs = JSON.parse(sigsStr.replace(/&quot;/g,'"')); } catch { sigs=[]; }
  const exp = document.createElement('tr');
  exp.className = 'log-expanded';
  exp.innerHTML = `
    <td colspan="9" style="padding:0;">
      <div class="log-expand-body">
        <div class="log-expand-title">Signal Analysis</div>
        <div class="log-expand-signals">
          ${sigs.length===0
            ? '<span style="color:#6b7a99;font-size:.78rem;">No signals recorded</span>'
            : sigs.map(s=>`<div class="log-signal log-signal-${s.cls}">${s.cls==='warn'?'⚠':s.cls==='ok'?'✓':'ℹ'} ${s.msg||s.message||''}</div>`).join('')}
        </div>
      </div>
    </td>`;
  row.insertAdjacentElement('afterend', exp);
}

/* ══════════════════════════════════════════════════════════
   MODAL SYSTEM
   ══════════════════════════════════════════════════════════ */
function closeModal() { document.getElementById('bh-modal')?.remove(); }

const IS = `width:100%;background:#0c1428;border:1px solid rgba(0,200,150,0.15);color:#e8f0ff;padding:12px 16px;border-radius:6px;font-family:'DM Mono',monospace;font-size:0.85rem;outline:none;margin-bottom:14px;box-sizing:border-box;`;
const BS = (c='#00e8a2') => `width:100%;background:${c};color:${c==='#00e8a2'?'#04070f':'#fff'};border:none;padding:13px;border-radius:6px;font-family:'Syne',sans-serif;font-weight:700;font-size:0.9rem;cursor:pointer;margin-top:6px;letter-spacing:.03em;transition:transform .15s;`;

function createModal(title, content) {
  closeModal();
  const o = document.createElement('div'); o.id='bh-modal';
  o.style.cssText='position:fixed;inset:0;z-index:9999;background:rgba(4,7,15,0.93);backdrop-filter:blur(14px);display:flex;align-items:center;justify-content:center;padding:20px;';
  o.innerHTML=`<div style="background:#080e1c;border:1px solid rgba(0,232,162,0.25);border-radius:14px;padding:40px;max-width:460px;width:100%;position:relative;animation:fadeInUp .3s ease;"><button onclick="closeModal()" style="position:absolute;top:14px;right:14px;background:transparent;border:1px solid rgba(0,200,150,0.2);color:#6b7a99;width:30px;height:30px;border-radius:6px;cursor:pointer;font-size:1rem;display:flex;align-items:center;justify-content:center;">✕</button><h2 style="font-family:'Syne',sans-serif;color:#00e8a2;margin-bottom:8px;font-size:1.4rem;">${title}</h2>${content}</div>`;
  o.addEventListener('click',e=>{if(e.target===o)closeModal();});
  document.body.appendChild(o);
}

function showTrialModal() {
  createModal('Start Free Trial',`
    <p style="color:#6b7a99;font-size:.85rem;margin-bottom:20px;">14-day free trial. No credit card required.</p>
    <input id="t-name" type="text" placeholder="Your Name" style="${IS}"/>
    <input id="t-email" type="email" placeholder="Work Email" style="${IS}"/>
    <input id="t-pass" type="password" placeholder="Password (min 8 chars)" style="${IS}"/>
    <div id="t-msg" style="color:#ff4d6d;font-size:.8rem;min-height:18px;margin-bottom:8px;"></div>
    <button onclick="handleTrialSignup()" style="${BS()}">🚀 Start Free Trial</button>
    <p style="text-align:center;margin-top:14px;font-size:.78rem;color:#6b7a99;">Already have an account? <a href="#" onclick="showLoginModal()" style="color:#00e8a2;text-decoration:none;">Sign In</a></p>
  `);
  setTimeout(()=>document.getElementById('t-name')?.focus(),80);
}

async function handleTrialSignup() {
  const name=document.getElementById('t-name')?.value.trim(), email=document.getElementById('t-email')?.value.trim(), pass=document.getElementById('t-pass')?.value, msg=document.getElementById('t-msg');
  if(!name){msg.textContent='Name is required';return;}
  if(!email){msg.textContent='Email is required';return;}
  if(!pass||pass.length<8){msg.textContent='Password must be at least 8 characters';return;}
  const btn=document.querySelector('#bh-modal button[onclick="handleTrialSignup()"]');
  if(btn){btn.textContent='⏳ Creating account…';btn.disabled=true;}
  msg.textContent='';
  try {
    await AuthAPI.register(name,email,pass,'viewer');
    closeModal(); showSuccessToast(`🎉 Welcome, ${name}! Account created.`);
    updateNavForLoggedIn(); setTimeout(scrollToAnalyzer,600);
  } catch(err) {
    msg.textContent=err.message||'Registration failed.';
    if(btn){btn.textContent='🚀 Start Free Trial';btn.disabled=false;}
  }
}

function showLoginModal() {
  createModal('Sign In',`
    <p style="color:#6b7a99;font-size:.85rem;margin-bottom:20px;">Sign in to access your dashboard.</p>
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
  setTimeout(()=>document.getElementById('l-email')?.focus(),80);
}

async function handleLogin() {
  const email=document.getElementById('l-email')?.value.trim(), pass=document.getElementById('l-pass')?.value, msg=document.getElementById('l-msg');
  if(!email||!pass){msg.textContent='Email and password required';return;}
  const btn=document.querySelector('#bh-modal button[onclick="handleLogin()"]');
  if(btn){btn.textContent='⏳ Signing in…';btn.disabled=true;}
  msg.textContent='';
  try {
    await AuthAPI.login(email,pass);
    closeModal(); showSuccessToast('✅ Signed in successfully!');
    updateNavForLoggedIn(); await loadAllData();
  } catch(err) {
    msg.textContent=err.message||'Login failed. Check credentials.';
    if(btn){btn.textContent='🔐 Sign In';btn.disabled=false;}
  }
}

function showDemoModal() {
  createModal('Live Demo',`
    <p style="color:#6b7a99;font-size:.85rem;margin-bottom:18px;">Run a real fraud analysis. Pick a scenario:</p>
    <button onclick="runDemoScenario('high')" style="width:100%;background:#1a0810;color:#ff4d6d;border:1px solid rgba(255,77,109,0.35);padding:13px;border-radius:6px;font-family:'Syne',sans-serif;font-weight:700;font-size:.88rem;cursor:pointer;margin-bottom:10px;text-align:left;">🚫 HIGH RISK — ₹15,00,000 · Crypto · Nigeria · 3 AM · Flagged Device</button>
    <button onclick="runDemoScenario('medium')" style="width:100%;background:#1a1408;color:#ffb830;border:1px solid rgba(255,184,48,0.35);padding:13px;border-radius:6px;font-family:'Syne',sans-serif;font-weight:700;font-size:.88rem;cursor:pointer;margin-bottom:10px;text-align:left;">⚠️ MEDIUM RISK — ₹3,50,000 · Wire Transfer · Brazil · 10 PM</button>
    <button onclick="runDemoScenario('low')" style="width:100%;background:#001a10;color:#00e8a2;border:1px solid rgba(0,232,162,0.3);padding:13px;border-radius:6px;font-family:'Syne',sans-serif;font-weight:700;font-size:.88rem;cursor:pointer;margin-bottom:10px;text-align:left;">✅ LOW RISK — ₹25,000 · Online Purchase · India · 2 PM</button>
    <button onclick="closeModal();scrollToAnalyzer()" style="${BS()} margin-top:4px;">⚡ Open Live Analyzer →</button>
  `);
}

function showContactModal(plan) {
  createModal(plan+' Plan',`
    <p style="color:#6b7a99;font-size:.85rem;margin-bottom:20px;">${plan==='Enterprise'?'Get a custom enterprise quote.':'Get started with '+plan+' — 14-day free trial.'}</p>
    <input id="c-name" type="text" placeholder="Your Name" style="${IS}"/>
    <input id="c-email" type="email" placeholder="Work Email" style="${IS}"/>
    <input id="c-org" type="text" placeholder="Organisation" style="${IS}"/>
    <div id="c-msg" style="color:#ff4d6d;font-size:.8rem;min-height:18px;margin-bottom:8px;"></div>
    <button onclick="handleContact('${plan}')" style="${BS()}">${plan==='Enterprise'?'📞 Request Demo Call':'🚀 Get Started — '+plan}</button>
  `);
  setTimeout(()=>document.getElementById('c-name')?.focus(),80);
}

function handleContact(plan) {
  const name=document.getElementById('c-name')?.value.trim(), email=document.getElementById('c-email')?.value.trim(), msg=document.getElementById('c-msg');
  if(!name||!email){msg.textContent='Name and email required';return;}
  closeModal(); showSuccessToast(`✅ Thanks ${name}! We'll contact you about ${plan} within 24 hours.`);
}

/* ── TOAST ── */
function showSuccessToast(message, duration=4000) {
  document.getElementById('bh-toast')?.remove();
  const t=document.createElement('div'); t.id='bh-toast';
  t.style.cssText="position:fixed;bottom:28px;right:28px;z-index:99999;background:#080e1c;border:1px solid rgba(0,232,162,0.35);color:#e8f0ff;padding:14px 20px;border-radius:8px;font-family:'DM Mono',monospace;font-size:.82rem;box-shadow:0 8px 32px rgba(0,0,0,.5);max-width:360px;line-height:1.5;animation:slideInRight .3s ease;";
  t.textContent=message; document.body.appendChild(t);
  setTimeout(()=>t.remove(),duration);
}

/* ── NAV UPDATE ── */
function updateNavForLoggedIn() {
  const user=Auth.getUser(); if(!user) return;
  const btn=document.querySelector('.nav-cta'); if(!btn) return;
  btn.textContent=`👤 ${user.name?.split(' ')[0]||'Account'}`;
  btn.onclick=()=>{
    const old=document.getElementById('user-menu'); if(old){old.remove();return;}
    const menu=document.createElement('div'); menu.id='user-menu';
    menu.style.cssText='position:fixed;top:66px;right:48px;z-index:9998;background:#080e1c;border:1px solid rgba(0,200,150,0.2);border-radius:8px;overflow:hidden;min-width:200px;box-shadow:0 8px 32px rgba(0,0,0,.5);';
    menu.innerHTML=`<div style="padding:12px 16px;font-size:.75rem;color:#6b7a99;border-bottom:1px solid rgba(0,200,150,0.1);">${user.email}</div><div style="padding:10px 16px;font-size:.78rem;color:#6b7a99;border-bottom:1px solid rgba(0,200,150,0.1);">Role: <span style="color:#00e8a2;">${user.role}</span></div><button onclick="AuthAPI.logout();document.getElementById('user-menu')?.remove();" style="width:100%;padding:12px 16px;background:transparent;color:#ff4d6d;border:none;cursor:pointer;text-align:left;font-family:'DM Mono',monospace;font-size:.82rem;">🚪 Sign Out</button>`;
    document.body.appendChild(menu);
    setTimeout(()=>{document.addEventListener('click',function h(e){if(!menu.contains(e.target)){menu.remove();document.removeEventListener('click',h);}});},100);
  };
}

/* ══════════════════════════════════════════════════════════
   DASHBOARD LOADER
   ══════════════════════════════════════════════════════════ */
async function loadDashboard() {
  try {
    const stats=await DashboardAPI.getStats(), summary=stats.summary||stats;
    const fc=document.getElementById('fraud-count'), sc=document.getElementById('safe-count');
    const rc=document.getElementById('review-count'), as=document.getElementById('avg-score');
    if(fc&&summary.fraudBlocked!=null) animateCounter(fc,summary.fraudBlocked);
    if(sc&&summary.safePassed  !=null) animateCounter(sc,summary.safePassed);
    if(rc&&summary.underReview !=null) animateCounter(rc,summary.underReview);
    if(as&&summary.avgRiskScore!=null) animateCounter(as,Math.round(summary.avgRiskScore));
    const gl=document.getElementById('gauge-score'), gp=document.getElementById('gauge-path'), gs=document.getElementById('gauge-status');
    if(gl&&summary.avgRiskScore!=null){
      const s=Math.round(summary.avgRiskScore); gl.textContent=s;
      if(gp) gp.style.strokeDashoffset=251-(s/100)*251;
      if(gs) gs.textContent=s>=70?'HIGH':s>=40?'ELEVATED':'NORMAL';
    }
    buildTxFeed(stats.recentTransactions);
    renderVolumeChart(stats.hourlyVolume);
    renderVerdictChart(stats.verdictBreakdown);
  } catch(err) {
    console.warn('Dashboard data unavailable:', err.message);
    renderVolumeChart([]); renderVerdictChart([]);
  }
}

/* ══════════════════════════════════════════════════════════
   ANALYTICS LOADER
   ══════════════════════════════════════════════════════════ */
async function loadAnalytics() {
  try {
    const [trend,countries,devices,types,dist] = await Promise.allSettled([
      AnalyticsAPI.trend(7), AnalyticsAPI.countryHeatmap(30),
      AnalyticsAPI.deviceBreakdown(), AnalyticsAPI.typeBreakdown(), AnalyticsAPI.riskDistribution(),
    ]);
    renderTrendChart(trend.status==='fulfilled'?trend.value:[]);
    renderCountryChart(countries.status==='fulfilled'?countries.value:[]);
    renderDeviceChart(devices.status==='fulfilled'?devices.value:[]);
    renderTxTypeChart(types.status==='fulfilled'?types.value:[]);
    renderRiskDistChart(dist.status==='fulfilled'?dist.value:[]);
  } catch(err) {
    console.warn('Analytics unavailable:', err.message);
    renderTrendChart([]); renderCountryChart([]); renderDeviceChart([]); renderTxTypeChart([]); renderRiskDistChart([]);
  }
}

/* ── Ticker ── */
async function loadTicker() {
  try {
    const ticker=await DashboardAPI.getTicker(); if(!ticker?.length) return;
    const wrap=document.querySelector('.ticker'); if(!wrap) return;
    const items=ticker.slice(0,7).map(tx=>{
      const isB=tx.status==='BLOCKED'||tx.verdict==='block';
      return `<div class="tick-item">${tx.txnId} ${isB?'<span>BLOCKED</span>':'<span style="color:var(--accent)">CLEARED</span>'} · ${formatINR(tx.amount)} <div class="tick-sep">|</div></div>`;
    });
    wrap.innerHTML=[...items,...items].join('');
  } catch { }
}

/* ── TX Feed ── */
function buildTxFeed(transactions) {
  const feed=document.getElementById('live-feed'); if(!feed) return;
  const staticD=[
    {txnId:'TXN-99142',amount:1254000,verdict:'block'},
    {txnId:'TXN-99143',amount:23400,verdict:'clear'},
    {txnId:'TXN-99144',amount:320000,verdict:'review'},
    {txnId:'TXN-99145',amount:89000,verdict:'clear'},
    {txnId:'TXN-99146',amount:810000,verdict:'block'},
  ];
  const rows=transactions?.length?transactions:staticD;
  feed.innerHTML='';
  rows.slice(0,6).forEach((tx,i)=>{
    const isB=tx.verdict==='block', isC=tx.verdict==='clear';
    const row=document.createElement('div');
    row.className='tx-row '+(isB?'flagged':isC?'safe-tx':'');
    row.style.animationDelay=(i*0.15)+'s';
    row.innerHTML=`<div><div class="tx-id">${tx.txnId||tx.id}</div><div class="tx-amount">${formatINR(tx.amount)}</div></div><span class="tx-badge ${isB?'badge-fraud':isC?'badge-ok':'badge-review'}">${isB?'FRAUD':isC?'CLEAR':'REVIEW'}</span>`;
    feed.appendChild(row);
  });
}

/* ── Counter ── */
function animateCounter(el, target) {
  if(!el||target==null) return;
  let cur=0; const inc=Math.ceil(target/60);
  const t=setInterval(()=>{cur=Math.min(cur+inc,target);el.textContent=cur.toLocaleString('en-IN');if(cur>=target)clearInterval(t);},30);
}

/* ══════════════════════════════════════════════════════════
   FRAUD ANALYZER — WITH REAL-TIME UPDATES
   ══════════════════════════════════════════════════════════ */
function scrollToAnalyzer() {
  document.getElementById('analyzer-section')?.scrollIntoView({behavior:'smooth'});
}

function readFormParams() {
  const typeMap   = {'Online Purchase':'online_purchase','Wire Transfer':'wire_transfer','ATM Withdrawal':'atm_withdrawal','POS Payment':'pos_payment','Crypto Exchange':'crypto_exchange'};
  const deviceMap = {'New Device':'new','Trusted Device':'trusted','Flagged Device':'flagged','VPN / Proxy':'vpn_proxy'};
  return {
    amount:          parseFloat(document.getElementById('tx-amount')?.value)||500,
    transactionType: typeMap[document.getElementById('tx-type')?.value]||'online_purchase',
    country:         document.getElementById('tx-country')?.value||'India',
    hourOfDay:       parseInt(document.getElementById('tx-hour')?.value)||14,
    deviceRisk:      deviceMap[document.getElementById('tx-device')?.value]||'trusted',
    velocity:        parseInt(document.getElementById('tx-velocity')?.value)||1,
  };
}

function _renderResult(score, signals) {
  document.getElementById('result-idle').style.display='none';
  const d=document.getElementById('result-display');
  d.style.display='block'; d.classList.add('visible');
  const scoreEl=document.getElementById('risk-score-display'), barEl=document.getElementById('risk-bar'), vEl=document.getElementById('risk-verdict'), sigEl=document.getElementById('signals-list');
  if(scoreEl){scoreEl.textContent=score;scoreEl.style.color=score>=70?'var(--accent2)':score>=40?'#ffb830':'var(--accent)';}
  if(barEl) setTimeout(()=>{barEl.style.width=score+'%';},50);
  if(vEl){
    if(score>=70){vEl.textContent='🚫 HIGH RISK — BLOCK RECOMMENDED';vEl.style.color='var(--accent2)';}
    else if(score>=40){vEl.textContent='⚠️ MEDIUM RISK — REVIEW REQUIRED';vEl.style.color='#ffb830';}
    else{vEl.textContent='✅ LOW RISK — CLEAR TO PROCEED';vEl.style.color='var(--accent)';}
  }
  const sb=document.getElementById('score-breakdown');
  if(sb){
    const wc=(signals||[]).filter(s=>s.cls==='warn').length, oc=(signals||[]).filter(s=>s.cls==='ok').length, ic=(signals||[]).filter(s=>s.cls==='info').length;
    sb.innerHTML=`<div class="score-breakdown-grid"><div class="sb-item sb-warn"><div class="sb-num">${wc}</div><div class="sb-lab">Warnings</div></div><div class="sb-item sb-info"><div class="sb-num">${ic}</div><div class="sb-lab">Alerts</div></div><div class="sb-item sb-ok"><div class="sb-num">${oc}</div><div class="sb-lab">Clear</div></div><div class="sb-item sb-total"><div class="sb-num">${score}</div><div class="sb-lab">Score</div></div></div>`;
  }
  if(sigEl){
    sigEl.innerHTML='';
    (signals||[]).forEach(s=>{
      const li=document.createElement('li');
      li.className='signal-item '+(s.cls||'ok');
      li.textContent=(s.cls==='warn'?'⚠ ':s.cls==='ok'?'✓ ':'ℹ ')+(s.msg||s.message||'');
      sigEl.appendChild(li);
    });
  }
}

/* ── Real-time update after each analysis ── */
async function _updateDashboardAfterAnalysis(result, params) {
  // 1. Add to transaction logs (instant)
  prependToLogs(result);

  // 2. Update KPI counters (+1 to whichever bucket)
  const verdict = result.verdict;
  if (verdict === 'block') {
    const el = document.getElementById('fraud-count');
    if (el) {
      const cur = parseInt(el.textContent.replace(/,/g, '')) + 1;
      el.textContent = cur.toLocaleString('en-IN');
      el.style.animation = 'none'; el.offsetHeight; el.style.animation = 'countFlash .5s ease';
    }
  } else if (verdict === 'clear') {
    const el = document.getElementById('safe-count');
    if (el) {
      const cur = parseInt(el.textContent.replace(/,/g, '')) + 1;
      el.textContent = cur.toLocaleString('en-IN');
    }
  } else if (verdict === 'review') {
    const el = document.getElementById('review-count');
    if (el) {
      const cur = parseInt(el.textContent.replace(/,/g, '')) + 1;
      el.textContent = cur.toLocaleString('en-IN');
    }
  }

  // 3. Add this txn to the live feed
  buildTxFeed([
    { txnId: result.txnId || 'TXN-LIVE-NOW', amount: params.amount, verdict: result.verdict },
    ...Array.from({ length: 4 }, (_, i) => ({
      txnId:   `TXN-PRV-${i}`,
      amount:  Math.floor(Math.random() * 200000) + 5000,
      verdict: Math.random() > 0.2 ? 'clear' : 'block',
    })),
  ]);

  // 4. Update gauge with new avg (simple estimate)
  const gaugeEl = document.getElementById('gauge-score');
  const gaugeP  = document.getElementById('gauge-path');
  if (gaugeEl) {
    const prev   = parseInt(gaugeEl.textContent) || 34;
    const newAvg = Math.round((prev * 0.9) + (result.score * 0.1)); // rolling avg
    gaugeEl.textContent = newAvg;
    if (gaugeP) gaugeP.style.strokeDashoffset = 251 - (newAvg / 100) * 251;
  }

  // 5. Update avg risk score KPI
  const avgEl = document.getElementById('avg-score');
  if (avgEl) {
    const prev = parseInt(avgEl.textContent.replace(/,/g,'')) || 34;
    avgEl.textContent = Math.round((prev * 0.9) + (result.score * 0.1));
  }

  // 6. Refresh charts silently from backend (if logged in)
  if (Auth.getToken()) {
    try {
      // Quick refresh: just reload analytics + dist chart
      const [dist, types] = await Promise.allSettled([
        AnalyticsAPI.riskDistribution(),
        AnalyticsAPI.typeBreakdown(),
      ]);
      if (dist.status   === 'fulfilled') renderRiskDistChart(dist.value);
      if (types.status  === 'fulfilled') renderTxTypeChart(types.value);
    } catch { /* silent */ }
  }

  // 7. Scroll logs section to show it updated
  const logsSection = document.getElementById('txn-logs-section');
  if (logsSection) {
    // Flash the logs section header
    const logsTitle = logsSection.querySelector('.section-title');
    if (logsTitle) {
      logsTitle.style.color = 'var(--accent)';
      setTimeout(() => { logsTitle.style.color = ''; }, 1500);
    }
  }

  showSuccessToast(
    verdict === 'block'  ? `🚫 Transaction blocked! Score: ${result.score}/100` :
    verdict === 'review' ? `⚠️ Flagged for review. Score: ${result.score}/100` :
                           `✅ Transaction cleared. Score: ${result.score}/100`,
    3000
  );
}

async function analyzeTransaction() {
  const btn=document.querySelector('.analyze-btn');
  if(btn){btn.textContent='⏳ Analyzing…';btn.disabled=true;}
  try {
    const params=readFormParams();
    const result=await TransactionAPI.analyze(params);
    _renderResult(result.score??result.riskScore, result.signals??[]);
    // 🔴 KEY: update dashboard + logs after every analysis
    await _updateDashboardAfterAnalysis(result, params);
  } catch(err) {
    showSuccessToast('❌ Analysis failed: '+err.message);
  } finally {
    if(btn){btn.textContent='⚡ Run Fraud Analysis';btn.disabled=false;}
  }
}

async function runDemoScenario(level) {
  closeModal(); scrollToAnalyzer();
  await new Promise(r=>setTimeout(r,700));
  const s={high:{amount:15000,type:'Crypto Exchange',country:'Nigeria',hour:3,device:'Flagged Device',velocity:8},medium:{amount:3500,type:'Wire Transfer',country:'Brazil',hour:22,device:'New Device',velocity:3},low:{amount:250,type:'Online Purchase',country:'India',hour:14,device:'Trusted Device',velocity:1}}[level];
  const sv=(id,v)=>{const el=document.getElementById(id);if(el)el.value=v;};
  const ss=(id,t)=>{const el=document.getElementById(id);if(!el)return;[...el.options].forEach((o,i)=>{if(o.text===t)el.selectedIndex=i;});};
  sv('tx-amount',s.amount);sv('tx-hour',s.hour);sv('tx-velocity',s.velocity);
  ss('tx-type',s.type);ss('tx-country',s.country);ss('tx-device',s.device);
  await analyzeTransaction();
}

/* ── Local Fallback Engine ── */
function _localAnalyze({amount,transactionType,country,hourOfDay,deviceRisk,velocity}){
  let score=10;const signals=[];
  if(amount>800000){score+=35;signals.push({cls:'warn',msg:`High value (${formatINR(amount)}) — above ₹8L threshold`});}
  else if(amount>250000){score+=18;signals.push({cls:'warn',msg:`Above-average amount (${formatINR(amount)})`});}
  else if(amount>50000){score+=5;signals.push({cls:'info',msg:`Moderate amount (${formatINR(amount)})`});}
  else{signals.push({cls:'ok',msg:`Amount within low-risk range (${formatINR(amount)})`});}
  const highR=['Nigeria','Russia','Brazil','Iran','Venezuela','Myanmar','North Korea'], medR=['Pakistan','Romania','Ukraine','Vietnam','Bangladesh'];
  if(highR.includes(country)){score+=28;signals.push({cls:'warn',msg:`High-risk jurisdiction: ${country} — FATF monitored`});}
  else if(medR.includes(country)){score+=12;signals.push({cls:'info',msg:`Medium-risk: ${country} — elevated monitoring`});}
  else{signals.push({cls:'ok',msg:`Country risk low: ${country}`});}
  if(hourOfDay>=1&&hourOfDay<=4){score+=20;signals.push({cls:'warn',msg:`Off-hours: ${hourOfDay}:00 AM (1–4 AM)`});}
  else if(hourOfDay===0||hourOfDay>=22){score+=8;signals.push({cls:'info',msg:`Late/early hour: ${hourOfDay}:00`});}
  else{signals.push({cls:'ok',msg:`Normal hour: ${hourOfDay}:00`});}
  if(deviceRisk==='flagged'){score+=30;signals.push({cls:'warn',msg:'Device in fraud registry — immediate flag'});}
  else if(deviceRisk==='vpn_proxy'){score+=22;signals.push({cls:'warn',msg:'VPN/Proxy — identity obfuscation'});}
  else if(deviceRisk==='new'){score+=10;signals.push({cls:'info',msg:'New device — monitoring'});}
  else{signals.push({cls:'ok',msg:'Trusted device — verified'});}
  if(velocity>=8){score+=30;signals.push({cls:'warn',msg:`Critical velocity: ${velocity} txns/hr`});}
  else if(velocity>=5){score+=25;signals.push({cls:'warn',msg:`Velocity breach: ${velocity} txns/hr`});}
  else if(velocity>=3){score+=10;signals.push({cls:'info',msg:`Elevated velocity: ${velocity}/hr`});}
  else{signals.push({cls:'ok',msg:`Normal velocity: ${velocity}/hr`});}
  if(transactionType==='crypto_exchange'){score+=15;signals.push({cls:'warn',msg:'Crypto — money laundering vector'});}
  else if(transactionType==='wire_transfer'){score+=8;signals.push({cls:'info',msg:'Wire transfer — extra verification recommended'});}
  else{signals.push({cls:'ok',msg:`Type "${transactionType}" — standard risk`});}
  const wc=signals.filter(s=>s.cls==='warn').length;
  if(wc>=3){const b=Math.round(score*0.15);score+=b;signals.push({cls:'warn',msg:`Multi-factor compounding: ${wc} signals (+${b} pts)`});}
  const txnId='TXN-'+Date.now().toString(36).toUpperCase().slice(-6)+'-'+Math.random().toString(36).slice(2,4).toUpperCase();
  return{score:Math.min(score,100),signals,txnId,verdict:score>=70?'block':score>=40?'review':'clear'};
}

/* ══════════════════════════════════════════════════════════
   LOAD ALL DATA
   ══════════════════════════════════════════════════════════ */
async function loadAllData() {
  await Promise.allSettled([loadDashboard(), loadAnalytics(), loadTicker(), loadTransactionLogs()]);
}

/* ══════════════════════════════════════════════════════════
   BOOT
   ══════════════════════════════════════════════════════════ */
window.addEventListener('load', async () => {
  // Nav smooth scroll
  document.querySelectorAll('.nav-links a').forEach(a => {
    a.addEventListener('click', e => {
      e.preventDefault();
      const id=a.getAttribute('href')?.slice(1);
      document.getElementById(id)?.scrollIntoView({behavior:'smooth'});
    });
  });

  // Restore session
  if (Auth.getUser()) updateNavForLoggedIn();

  // Static counters
  animateCounter(document.getElementById('fraud-count'),  1247);
  animateCounter(document.getElementById('safe-count'),   98341);
  animateCounter(document.getElementById('review-count'), 342);
  animateCounter(document.getElementById('avg-score'),    34);

  // Render all charts with sample data immediately
  renderVolumeChart([]); renderVerdictChart([]); renderRiskDistChart([]);
  renderTrendChart([]); renderCountryChart([]); renderDeviceChart([]); renderTxTypeChart([]);

  // Static TX feed + sample logs
  buildTxFeed([]);
  allLogs = generateSampleLogs();
  filteredLogs = [...allLogs];
  renderLogsTable();

  // Auto-login as viewer
  try {
    if (!Auth.getToken()) {
      await AuthAPI.login('viewer@backhackers.ai', 'Viewer@1234');
      console.log('✅ Auto-logged in as viewer');
    }
  } catch(e) {
    console.warn('Auto viewer login skipped (run npm run seed):', e.message);
  }

  // Load real data from backend
  await Promise.allSettled([loadDashboard(), loadAnalytics(), loadTicker(), loadTransactionLogs()]);
});

if (typeof module !== 'undefined') {
  module.exports = { AuthAPI, TransactionAPI, DashboardAPI, AnalyticsAPI };
}
