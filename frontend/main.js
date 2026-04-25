/* ══════════════════════════════════════════
   SentinelAI — Fraud Detection Platform
   main.js
   ══════════════════════════════════════════ */

'use strict';

/* ══════════════════════════════════════════
   1. MINI CHART BUILDER
   ══════════════════════════════════════════ */

/**
 * Builds an animated bar chart inside a container element.
 * @param {string} id            - DOM element ID
 * @param {number} count         - Number of bars
 * @param {number[]} alertIdxs   - Indexes that should be styled as alerts
 * @param {number[]} heights     - Height percentages for each bar (0–100)
 */
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

/* ── Chart data ── */
buildChart(
  'fraud-chart', 16,
  [3, 7, 11, 15],
  [30, 40, 35, 90, 50, 40, 60, 95, 45, 55, 70, 88, 50, 60, 45, 100]
);

buildChart(
  'safe-chart', 16,
  [],
  [60, 70, 65, 80, 75, 70, 90, 85, 80, 88, 95, 92, 85, 90, 88, 100]
);

buildChart(
  'volume-chart', 24,
  [2, 8, 17, 22],
  [40, 35, 80, 50, 60, 70, 65, 55, 85, 90, 88, 95, 92, 85, 80, 75, 70, 98, 65, 60, 90, 55, 85, 70]
);

/* ══════════════════════════════════════════
   2. LIVE TRANSACTION FEED
   ══════════════════════════════════════════ */

const txData = [
  { id: 'TXN-99142', amount: '$12,540', type: 'fraud',  label: 'FRAUD',  cls: 'flagged' },
  { id: 'TXN-99143', amount: '$234',    type: 'ok',     label: 'CLEAR',  cls: 'safe-tx' },
  { id: 'TXN-99144', amount: '$3,200',  type: 'review', label: 'REVIEW', cls: ''        },
  { id: 'TXN-99145', amount: '$890',    type: 'ok',     label: 'CLEAR',  cls: 'safe-tx' },
  { id: 'TXN-99146', amount: '$8,100',  type: 'fraud',  label: 'FRAUD',  cls: 'flagged' },
];

/**
 * Renders the live transaction feed inside #live-feed.
 */
function buildTxFeed() {
  const feed = document.getElementById('live-feed');
  if (!feed) return;

  txData.forEach((tx, i) => {
    const row = document.createElement('div');
    row.className = 'tx-row ' + tx.cls;
    row.style.animationDelay = (i * 0.15) + 's';

    const badgeCls =
      tx.type === 'fraud'  ? 'badge-fraud'  :
      tx.type === 'ok'     ? 'badge-ok'     :
                             'badge-review';

    row.innerHTML = `
      <div>
        <div class="tx-id">${tx.id}</div>
        <div class="tx-amount">${tx.amount}</div>
      </div>
      <span class="tx-badge ${badgeCls}">${tx.label}</span>
    `;

    feed.appendChild(row);
  });
}

buildTxFeed();

/* ══════════════════════════════════════════
   3. COUNTER ANIMATION
   ══════════════════════════════════════════ */

/**
 * Animates a numeric counter from 0 to target.
 * @param {HTMLElement} el  - Target element
 * @param {number}      target - Final number
 * @param {string}      [suffix] - Optional suffix (e.g. '%')
 */
function animateCounter(el, target, suffix = '') {
  if (!el) return;
  let current = 0;
  const increment = Math.ceil(target / 60);

  const timer = setInterval(() => {
    current += increment;
    if (current >= target) {
      current = target;
      clearInterval(timer);
    }
    el.textContent = current.toLocaleString() + suffix;
  }, 1800 / (target / increment));
}

/* ══════════════════════════════════════════
   4. TRANSACTION RISK ANALYZER
   ══════════════════════════════════════════ */

/**
 * Reads form inputs, computes a fraud risk score using heuristic
 * ML-style rules, and renders the result in the output panel.
 */
function analyzeTransaction() {
  /* ── Read inputs ── */
  const amount   = parseFloat(document.getElementById('tx-amount').value)   || 500;
  const type     = document.getElementById('tx-type').value;
  const country  = document.getElementById('tx-country').value;
  const hour     = parseInt(document.getElementById('tx-hour').value)        || 14;
  const device   = document.getElementById('tx-device').value;
  const velocity = parseInt(document.getElementById('tx-velocity').value)    || 1;

  let score = 10;
  const signals = [];

  /* ── Feature: Transaction Amount ── */
  if (amount > 10000) {
    score += 35;
    signals.push({ cls: 'warn', msg: `High value transaction ($${amount.toLocaleString()}) — 3× average ticket` });
  } else if (amount > 3000) {
    score += 18;
    signals.push({ cls: 'warn', msg: `Above-average amount detected ($${amount.toLocaleString()})` });
  } else {
    signals.push({ cls: 'ok', msg: `Amount within normal range ($${amount.toLocaleString()})` });
  }

  /* ── Feature: Country / Jurisdiction Risk ── */
  const highRiskCountries = ['Nigeria', 'Russia', 'Brazil'];
  if (highRiskCountries.includes(country)) {
    score += 28;
    signals.push({ cls: 'warn', msg: `High-risk jurisdiction: ${country} — elevated monitoring` });
  } else {
    signals.push({ cls: 'ok', msg: `Country risk low: ${country}` });
  }

  /* ── Feature: Off-Hours Activity ── */
  if (hour >= 1 && hour <= 5) {
    score += 20;
    signals.push({ cls: 'warn', msg: `Transaction at ${hour}:00 — unusual off-hours activity` });
  } else {
    signals.push({ cls: 'ok', msg: `Transaction hour ${hour}:00 — within normal activity window` });
  }

  /* ── Feature: Device Risk ── */
  if (device === 'Flagged Device') {
    score += 30;
    signals.push({ cls: 'warn', msg: 'Device fingerprint matches known fraud registry' });
  } else if (device === 'VPN / Proxy') {
    score += 22;
    signals.push({ cls: 'warn', msg: 'VPN/Proxy detected — identity obfuscation risk' });
  } else if (device === 'New Device') {
    score += 10;
    signals.push({ cls: 'info', msg: 'First transaction from this device — monitoring' });
  } else {
    signals.push({ cls: 'ok', msg: 'Trusted device — verified fingerprint' });
  }

  /* ── Feature: Transaction Velocity ── */
  if (velocity >= 5) {
    score += 25;
    signals.push({ cls: 'warn', msg: `Velocity breach: ${velocity} transactions in last hour` });
  } else if (velocity >= 3) {
    score += 10;
    signals.push({ cls: 'info', msg: `Elevated velocity: ${velocity} transactions/hr — watch` });
  } else {
    signals.push({ cls: 'ok', msg: `Velocity normal: ${velocity} transaction(s) this hour` });
  }

  /* ── Feature: Transaction Type ── */
  if (type === 'Crypto Exchange') {
    score += 15;
    signals.push({ cls: 'warn', msg: 'Crypto exchange — money laundering vector flagged' });
  } else if (type === 'Wire Transfer') {
    score += 8;
    signals.push({ cls: 'info', msg: 'Wire transfer — additional verification recommended' });
  }

  /* ── Clamp score ── */
  score = Math.min(score, 100);

  /* ── Render result ── */
  _renderResult(score, signals);
}

/**
 * Updates the output panel with score, bar, verdict, and signals.
 * @param {number}   score
 * @param {Array}    signals
 */
function _renderResult(score, signals) {
  document.getElementById('result-idle').style.display = 'none';

  const display = document.getElementById('result-display');
  display.style.display = 'block';
  display.classList.add('visible');

  const scoreEl    = document.getElementById('risk-score-display');
  const barEl      = document.getElementById('risk-bar');
  const verdictEl  = document.getElementById('risk-verdict');
  const sigListEl  = document.getElementById('signals-list');

  /* Score number + colour */
  scoreEl.textContent  = score;
  scoreEl.style.color  =
    score >= 70 ? 'var(--accent2)' :
    score >= 40 ? '#ffb830'        :
                  'var(--accent)';

  /* Animate bar fill */
  setTimeout(() => { barEl.style.width = score + '%'; }, 50);

  /* Verdict text */
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

  /* Signal list */
  sigListEl.innerHTML = '';
  signals.forEach(s => {
    const li = document.createElement('li');
    li.className = 'signal-item ' + s.cls;
    const icon = s.cls === 'warn' ? '⚠' : s.cls === 'ok' ? '✓' : 'ℹ';
    li.textContent = icon + ' ' + s.msg;
    sigListEl.appendChild(li);
  });
}

/* ══════════════════════════════════════════
   5. INIT ON LOAD
   ══════════════════════════════════════════ */

window.addEventListener('load', () => {
  animateCounter(document.getElementById('fraud-count'), 1247);
  animateCounter(document.getElementById('safe-count'),  98341);
});
