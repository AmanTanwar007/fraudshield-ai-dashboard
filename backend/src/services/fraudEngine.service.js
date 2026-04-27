'use strict';

const HIGH_RISK_COUNTRIES = new Set([
  'Nigeria','Russia','Brazil','Iran','North Korea',
  'Venezuela','Myanmar','Belarus','Syria','Afghanistan',
]);

const MEDIUM_RISK_COUNTRIES = new Set([
  'Pakistan','Bangladesh','Indonesia','Philippines','Ukraine',
  'Romania','Bulgaria','Vietnam','Mexico','Egypt',
]);

const TX_RISK = {
  online_purchase: 0,
  pos_payment:     0,
  atm_withdrawal:  5,
  wire_transfer:   8,
  crypto_exchange: 15,
};

const DEVICE_RISK = {
  trusted:   0,
  new:       10,
  vpn_proxy: 22,
  flagged:   30,
};

function analyzeTransaction(params) {
  const { amount, transactionType, country, hourOfDay, deviceRisk, velocity } = params;

  let score = 10;
  const signals = [];
  const alertsToCreate = [];

  // ── Amount ──────────────────────────────────────────────
  const amt = parseFloat(amount);
  if (amt > 50000) {
    score += 40;
    signals.push({ cls: 'warn', msg: `Extremely high transaction value ($${amt.toLocaleString()}) — 10× average ticket` });
    alertsToCreate.push({ severity: 'critical', category: 'high_value', title: 'Extremely High Value Transaction', message: `Transaction of $${amt.toLocaleString()} exceeds $50,000 critical threshold.` });
  } else if (amt > 10000) {
    score += 35;
    signals.push({ cls: 'warn', msg: `High value transaction ($${amt.toLocaleString()}) — above $10,000 threshold` });
    alertsToCreate.push({ severity: 'high', category: 'high_value', title: 'High Value Transaction', message: `Transaction of $${amt.toLocaleString()} exceeds $10,000 monitoring threshold.` });
  } else if (amt > 3000) {
    score += 18;
    signals.push({ cls: 'warn', msg: `Above-average transaction amount ($${amt.toLocaleString()})` });
  } else if (amt > 500) {
    score += 5;
    signals.push({ cls: 'info', msg: `Moderate amount ($${amt.toLocaleString()}) — within normal range` });
  } else {
    signals.push({ cls: 'ok', msg: `Amount within low-risk range ($${amt.toLocaleString()})` });
  }

  // ── Country ─────────────────────────────────────────────
  if (HIGH_RISK_COUNTRIES.has(country)) {
    score += 28;
    signals.push({ cls: 'warn', msg: `High-risk jurisdiction: ${country} — FATF-monitored region` });
    alertsToCreate.push({ severity: 'high', category: 'high_risk_country', title: 'High-Risk Jurisdiction', message: `Transaction from ${country}, a FATF-monitored high-risk jurisdiction.` });
  } else if (MEDIUM_RISK_COUNTRIES.has(country)) {
    score += 12;
    signals.push({ cls: 'info', msg: `Medium-risk jurisdiction: ${country} — elevated monitoring` });
  } else {
    signals.push({ cls: 'ok', msg: `Country risk low: ${country}` });
  }

  // ── Hour ────────────────────────────────────────────────
  const hour = parseInt(hourOfDay);
  if (hour >= 1 && hour <= 4) {
    score += 20;
    signals.push({ cls: 'warn', msg: `Transaction at ${hour}:00 AM — deep off-hours (01:00–04:59)` });
    alertsToCreate.push({ severity: 'medium', category: 'off_hours', title: 'Off-Hours Transaction', message: `Transaction at ${hour}:00 AM — outside normal operating hours.` });
  } else if (hour === 0 || (hour >= 5 && hour < 7)) {
    score += 10;
    signals.push({ cls: 'info', msg: `Transaction at ${hour}:00 — early morning, slightly unusual` });
  } else if (hour >= 22) {
    score += 8;
    signals.push({ cls: 'info', msg: `Transaction at ${hour}:00 — late evening, minor anomaly` });
  } else {
    signals.push({ cls: 'ok', msg: `Transaction at ${hour}:00 — within normal business hours` });
  }

  // ── Device ──────────────────────────────────────────────
  score += (DEVICE_RISK[deviceRisk] || 10);
  if (deviceRisk === 'flagged') {
    signals.push({ cls: 'warn', msg: 'Device fingerprint matches known fraud registry' });
    alertsToCreate.push({ severity: 'critical', category: 'device_flagged', title: 'Flagged Device Detected', message: 'Transaction from a device previously linked to fraud.' });
  } else if (deviceRisk === 'vpn_proxy') {
    signals.push({ cls: 'warn', msg: 'VPN/Proxy detected — identity obfuscation attempt' });
    alertsToCreate.push({ severity: 'high', category: 'vpn_detected', title: 'VPN/Proxy Detected', message: 'Transaction routed through VPN/Proxy — possible identity concealment.' });
  } else if (deviceRisk === 'new') {
    signals.push({ cls: 'info', msg: 'First transaction from this device — monitoring' });
  } else {
    signals.push({ cls: 'ok', msg: 'Trusted device — fingerprint verified' });
  }

  // ── Velocity ────────────────────────────────────────────
  const vel = parseInt(velocity);
  if (vel >= 8) {
    score += 30;
    signals.push({ cls: 'warn', msg: `Critical velocity: ${vel} transactions/hr — card testing pattern` });
    alertsToCreate.push({ severity: 'critical', category: 'velocity_breach', title: 'Critical Velocity Breach', message: `${vel} transactions/hr — possible card testing attack.` });
  } else if (vel >= 5) {
    score += 25;
    signals.push({ cls: 'warn', msg: `Velocity breach: ${vel} transactions/hr` });
    alertsToCreate.push({ severity: 'high', category: 'velocity_breach', title: 'Velocity Breach', message: `${vel} transactions/hr exceeds high-risk threshold.` });
  } else if (vel >= 3) {
    score += 10;
    signals.push({ cls: 'info', msg: `Elevated velocity: ${vel}/hr — approaching threshold` });
  } else {
    signals.push({ cls: 'ok', msg: `Normal velocity: ${vel} transaction(s) this hour` });
  }

  // ── Transaction Type ─────────────────────────────────────
  score += (TX_RISK[transactionType] || 0);
  if (transactionType === 'crypto_exchange') {
    signals.push({ cls: 'warn', msg: 'Cryptocurrency exchange — common money laundering vector' });
    alertsToCreate.push({ severity: 'medium', category: 'crypto_transaction', title: 'Crypto Exchange', message: 'Cryptocurrency exchange detected — enhanced scrutiny applied.' });
  } else if (transactionType === 'wire_transfer') {
    signals.push({ cls: 'info', msg: 'Wire transfer — irreversible, additional verification recommended' });
  } else if (transactionType === 'atm_withdrawal') {
    signals.push({ cls: 'info', msg: 'ATM withdrawal — monitoring for card-not-present fraud' });
  } else {
    signals.push({ cls: 'ok', msg: `Transaction type "${transactionType}" — standard risk` });
  }

  // ── Multi-factor compounding ─────────────────────────────
  const warnCount = signals.filter(s => s.cls === 'warn').length;
  if (warnCount >= 3) {
    const bonus = Math.round(score * 0.15);
    score += bonus;
    signals.push({ cls: 'warn', msg: `Multi-factor risk: ${warnCount} high-risk signals simultaneously (+${bonus} pts)` });
    alertsToCreate.push({ severity: 'critical', category: 'multi_factor', title: 'Multi-Factor Risk Event', message: `${warnCount} simultaneous high-risk signals — immediate review required.` });
  }

  score = Math.min(Math.max(score, 0), 100);

  const verdict =
    score >= 70 ? 'block' :
    score >= 40 ? 'review' : 'clear';

  return { score, verdict, signals, alertsToCreate };
}

function generateTxnId() {
  const ts  = Date.now().toString(36).toUpperCase();
  const rnd = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `TXN-${ts}-${rnd}`;
}

module.exports = { analyzeTransaction, generateTxnId };
