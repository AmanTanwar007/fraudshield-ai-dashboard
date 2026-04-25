'use strict';

/**
 * BackHackers AI — Fraud Detection Engine
 * ══════════════════════════════════════════
 * Multi-factor risk scoring engine that evaluates transactions
 * across 6 feature dimensions, producing:
 *   - A risk score (0–100)
 *   - A verdict (clear / review / block)
 *   - An ordered list of SHAP-style signal explanations
 *   - Auto-generated alerts for high-risk signals
 */

// ── Country risk classification ───────────────────────────
const HIGH_RISK_COUNTRIES = new Set([
  'Nigeria', 'Russia', 'Brazil', 'Iran', 'North Korea',
  'Venezuela', 'Myanmar', 'Belarus', 'Syria', 'Afghanistan',
]);

const MEDIUM_RISK_COUNTRIES = new Set([
  'Pakistan', 'Bangladesh', 'Indonesia', 'Philippines', 'Ukraine',
  'Romania', 'Bulgaria', 'Vietnam', 'Mexico', 'Egypt',
]);

// ── Transaction type risk multipliers ─────────────────────
const TX_RISK = {
  online_purchase: 0,
  pos_payment:     0,
  atm_withdrawal:  5,
  wire_transfer:   8,
  crypto_exchange: 15,
};

// ── Device risk increments ────────────────────────────────
const DEVICE_RISK = {
  trusted:   0,
  new:       10,
  vpn_proxy: 22,
  flagged:   30,
};

/**
 * Core scoring function.
 * @param {Object} params - Transaction parameters
 * @returns {{ score, verdict, signals, alertsToCreate }}
 */
function analyzeTransaction(params) {
  const {
    amount,
    transactionType,
    country,
    hourOfDay,
    deviceRisk,
    velocity,
  } = params;

  let score = 10; // baseline inherent risk
  const signals = [];
  const alertsToCreate = [];

  // ── FEATURE 1: Transaction Amount ──────────────────────
  const amt = parseFloat(amount);
  if (amt > 50000) {
    score += 40;
    signals.push({ cls: 'warn', msg: `Extremely high transaction value ($${amt.toLocaleString()}) — 10× average ticket` });
    alertsToCreate.push({
      severity: 'critical',
      category: 'high_value',
      title: 'Extremely High Value Transaction',
      message: `Transaction of $${amt.toLocaleString()} exceeds the critical threshold of $50,000.`,
    });
  } else if (amt > 10000) {
    score += 35;
    signals.push({ cls: 'warn', msg: `High value transaction ($${amt.toLocaleString()}) — 3× average ticket` });
    alertsToCreate.push({
      severity: 'high',
      category: 'high_value',
      title: 'High Value Transaction Detected',
      message: `Transaction of $${amt.toLocaleString()} exceeds the $10,000 monitoring threshold.`,
    });
  } else if (amt > 3000) {
    score += 18;
    signals.push({ cls: 'warn', msg: `Above-average transaction amount ($${amt.toLocaleString()})` });
  } else if (amt > 500) {
    score += 5;
    signals.push({ cls: 'info', msg: `Moderate transaction amount ($${amt.toLocaleString()}) — within normal range` });
  } else {
    signals.push({ cls: 'ok', msg: `Transaction amount within low-risk range ($${amt.toLocaleString()})` });
  }

  // ── FEATURE 2: Geographic / Jurisdiction Risk ──────────
  if (HIGH_RISK_COUNTRIES.has(country)) {
    score += 28;
    signals.push({ cls: 'warn', msg: `High-risk jurisdiction detected: ${country} — FATF-monitored region` });
    alertsToCreate.push({
      severity: 'high',
      category: 'high_risk_country',
      title: 'High-Risk Jurisdiction',
      message: `Transaction originated from ${country}, a FATF-monitored high-risk jurisdiction.`,
    });
  } else if (MEDIUM_RISK_COUNTRIES.has(country)) {
    score += 12;
    signals.push({ cls: 'info', msg: `Medium-risk jurisdiction: ${country} — elevated monitoring applied` });
  } else {
    signals.push({ cls: 'ok', msg: `Jurisdiction risk low: ${country} — standard processing` });
  }

  // ── FEATURE 3: Temporal Anomaly (Hour of Day) ──────────
  const hour = parseInt(hourOfDay);
  if (hour >= 1 && hour <= 4) {
    score += 20;
    signals.push({ cls: 'warn', msg: `Transaction at ${hour}:00 AM — deep off-hours window (01:00–04:59)` });
    alertsToCreate.push({
      severity: 'medium',
      category: 'off_hours',
      title: 'Off-Hours Transaction',
      message: `Transaction submitted at ${hour}:00 AM — outside normal operating hours.`,
    });
  } else if (hour === 0 || (hour >= 5 && hour < 7)) {
    score += 10;
    signals.push({ cls: 'info', msg: `Transaction at ${hour}:00 — early morning, slightly unusual` });
  } else if (hour >= 22) {
    score += 8;
    signals.push({ cls: 'info', msg: `Transaction at ${hour}:00 — late evening, minor anomaly` });
  } else {
    signals.push({ cls: 'ok', msg: `Transaction at ${hour}:00 — within normal business hours` });
  }

  // ── FEATURE 4: Device Risk ─────────────────────────────
  const deviceIncrement = DEVICE_RISK[deviceRisk] ?? 10;
  score += deviceIncrement;

  if (deviceRisk === 'flagged') {
    signals.push({ cls: 'warn', msg: 'Device fingerprint matches known fraud registry — immediate flag' });
    alertsToCreate.push({
      severity: 'critical',
      category: 'device_flagged',
      title: 'Flagged Device Detected',
      message: 'Transaction submitted from a device previously associated with fraudulent activity.',
    });
  } else if (deviceRisk === 'vpn_proxy') {
    signals.push({ cls: 'warn', msg: 'VPN/Proxy detected — identity obfuscation attempt identified' });
    alertsToCreate.push({
      severity: 'high',
      category: 'vpn_detected',
      title: 'VPN/Proxy Usage Detected',
      message: 'Transaction routed through VPN or anonymizing proxy — possible identity concealment.',
    });
  } else if (deviceRisk === 'new') {
    signals.push({ cls: 'info', msg: 'First transaction from this device — behavioural baseline being established' });
  } else {
    signals.push({ cls: 'ok', msg: 'Trusted device — fingerprint verified against account history' });
  }

  // ── FEATURE 5: Transaction Velocity ───────────────────
  const vel = parseInt(velocity);
  if (vel >= 8) {
    score += 30;
    signals.push({ cls: 'warn', msg: `Critical velocity breach: ${vel} transactions in last hour — card testing pattern` });
    alertsToCreate.push({
      severity: 'critical',
      category: 'velocity_breach',
      title: 'Critical Velocity Breach',
      message: `${vel} transactions in the last hour exceeds the critical threshold of 8. Possible card testing attack.`,
    });
  } else if (vel >= 5) {
    score += 25;
    signals.push({ cls: 'warn', msg: `Velocity breach: ${vel} transactions/hr — well above normal threshold of 3` });
    alertsToCreate.push({
      severity: 'high',
      category: 'velocity_breach',
      title: 'Transaction Velocity Breach',
      message: `${vel} transactions in the last hour exceeds the high-risk threshold.`,
    });
  } else if (vel >= 3) {
    score += 10;
    signals.push({ cls: 'info', msg: `Elevated velocity: ${vel} transactions/hr — approaching threshold, monitoring` });
  } else {
    signals.push({ cls: 'ok', msg: `Velocity normal: ${vel} transaction(s) this hour — within acceptable range` });
  }

  // ── FEATURE 6: Transaction Type ────────────────────────
  const typeIncrement = TX_RISK[transactionType] ?? 0;
  score += typeIncrement;

  if (transactionType === 'crypto_exchange') {
    signals.push({ cls: 'warn', msg: 'Cryptocurrency exchange — common money laundering vector, enhanced scrutiny applied' });
    alertsToCreate.push({
      severity: 'medium',
      category: 'crypto_transaction',
      title: 'Cryptocurrency Exchange Detected',
      message: 'Transaction is a cryptocurrency exchange — a common vector for money laundering.',
    });
  } else if (transactionType === 'wire_transfer') {
    signals.push({ cls: 'info', msg: 'Wire transfer — irreversible instrument, additional verification recommended' });
  } else if (transactionType === 'atm_withdrawal') {
    signals.push({ cls: 'info', msg: 'ATM withdrawal — physical card presence expected, monitoring for card-not-present fraud' });
  } else {
    signals.push({ cls: 'ok', msg: `Transaction type "${transactionType}" — standard risk level` });
  }

  // ── MULTI-FACTOR COMPOUNDING ────────────────────────────
  // If 3+ warn signals, apply a 15% compounding multiplier
  const warnCount = signals.filter(s => s.cls === 'warn').length;
  if (warnCount >= 3) {
    const compound = Math.round(score * 0.15);
    score += compound;
    signals.push({
      cls: 'warn',
      msg: `Multi-factor risk compounding: ${warnCount} high-risk signals detected simultaneously (+${compound} pts)`,
    });
    alertsToCreate.push({
      severity: 'critical',
      category: 'multi_factor',
      title: 'Multi-Factor Risk Event',
      message: `${warnCount} simultaneous high-risk signals detected. Immediate review required.`,
    });
  }

  // ── CLAMP SCORE ────────────────────────────────────────
  score = Math.min(Math.max(score, 0), 100);

  // ── VERDICT ────────────────────────────────────────────
  let verdict;
  if (score >= 70)      verdict = 'block';
  else if (score >= 40) verdict = 'review';
  else                  verdict = 'clear';

  return { score, verdict, signals, alertsToCreate };
}

/**
 * Generate a unique TXN ID.
 * @returns {string}
 */
function generateTxnId() {
  const ts  = Date.now().toString(36).toUpperCase();
  const rnd = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `TXN-${ts}-${rnd}`;
}

module.exports = { analyzeTransaction, generateTxnId };
