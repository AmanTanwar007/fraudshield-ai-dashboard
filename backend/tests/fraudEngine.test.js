'use strict';

const { analyzeTransaction, generateTxnId } = require('../src/services/fraudEngine.service');

describe('BackHackers AI — Fraud Engine', () => {

  // ── Score clamping ─────────────────────────────────────
  test('score is always between 0 and 100', () => {
    const { score } = analyzeTransaction({
      amount: 100000, transactionType: 'crypto_exchange',
      country: 'Nigeria', hourOfDay: 2, deviceRisk: 'flagged', velocity: 10,
    });
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });

  // ── LOW RISK scenario ──────────────────────────────────
  test('low-risk transaction produces "clear" verdict', () => {
    const { score, verdict } = analyzeTransaction({
      amount: 50, transactionType: 'online_purchase',
      country: 'United States', hourOfDay: 14, deviceRisk: 'trusted', velocity: 1,
    });
    expect(score).toBeLessThan(40);
    expect(verdict).toBe('clear');
  });

  // ── HIGH RISK scenario ─────────────────────────────────
  test('high-risk transaction produces "block" verdict', () => {
    const { score, verdict } = analyzeTransaction({
      amount: 15000, transactionType: 'crypto_exchange',
      country: 'Nigeria', hourOfDay: 3, deviceRisk: 'flagged', velocity: 8,
    });
    expect(score).toBeGreaterThanOrEqual(70);
    expect(verdict).toBe('block');
  });

  // ── MEDIUM RISK scenario ───────────────────────────────
  test('medium-risk transaction produces "review" verdict', () => {
    const { score, verdict } = analyzeTransaction({
      amount: 2500, transactionType: 'online_purchase',
      country: 'Brazil', hourOfDay: 10, deviceRisk: 'new', velocity: 3,
    });
    expect(score).toBeGreaterThanOrEqual(40);
    expect(score).toBeLessThan(70);
    expect(verdict).toBe('review');
  });

  // ── Signals array ──────────────────────────────────────
  test('signals array has an entry for each feature', () => {
    const { signals } = analyzeTransaction({
      amount: 500, transactionType: 'wire_transfer',
      country: 'Germany', hourOfDay: 22, deviceRisk: 'new', velocity: 2,
    });
    expect(Array.isArray(signals)).toBe(true);
    expect(signals.length).toBeGreaterThanOrEqual(6);
    signals.forEach(s => {
      expect(s).toHaveProperty('cls');
      expect(s).toHaveProperty('msg');
      expect(['ok', 'warn', 'info']).toContain(s.cls);
    });
  });

  // ── Alerts generated for critical scenarios ────────────
  test('flagged device generates a critical alert', () => {
    const { alertsToCreate } = analyzeTransaction({
      amount: 500, transactionType: 'online_purchase',
      country: 'United States', hourOfDay: 10, deviceRisk: 'flagged', velocity: 1,
    });
    const critical = alertsToCreate.find(a => a.category === 'device_flagged');
    expect(critical).toBeDefined();
    expect(critical.severity).toBe('critical');
  });

  test('velocity >= 8 triggers critical velocity alert', () => {
    const { alertsToCreate } = analyzeTransaction({
      amount: 100, transactionType: 'pos_payment',
      country: 'United States', hourOfDay: 12, deviceRisk: 'trusted', velocity: 9,
    });
    const velAlert = alertsToCreate.find(a => a.category === 'velocity_breach');
    expect(velAlert).toBeDefined();
    expect(velAlert.severity).toBe('critical');
  });

  // ── Multi-factor compounding ───────────────────────────
  test('3+ warn signals trigger multi-factor compounding signal', () => {
    const { signals } = analyzeTransaction({
      amount: 12000, transactionType: 'crypto_exchange',
      country: 'Russia', hourOfDay: 2, deviceRisk: 'flagged', velocity: 6,
    });
    const compound = signals.find(s => s.msg.includes('Multi-factor'));
    expect(compound).toBeDefined();
  });

  // ── TXN ID uniqueness ──────────────────────────────────
  test('generateTxnId produces unique IDs', () => {
    const ids = new Set(Array.from({ length: 100 }, () => generateTxnId()));
    expect(ids.size).toBe(100);
  });

  test('generateTxnId starts with TXN-', () => {
    expect(generateTxnId()).toMatch(/^TXN-/);
  });

  // ── Edge cases ─────────────────────────────────────────
  test('very low amount has no high-value signals', () => {
    const { signals } = analyzeTransaction({
      amount: 1, transactionType: 'online_purchase',
      country: 'United States', hourOfDay: 10, deviceRisk: 'trusted', velocity: 1,
    });
    const highVal = signals.find(s => s.msg.toLowerCase().includes('high value'));
    expect(highVal).toBeUndefined();
  });

  test('hour 0 is slightly off-hours and gets an info/warn signal', () => {
    const { signals, score } = analyzeTransaction({
      amount: 100, transactionType: 'pos_payment',
      country: 'United Kingdom', hourOfDay: 0, deviceRisk: 'trusted', velocity: 1,
    });
    // hour 0 adds +10 — should not reach block territory by itself
    const timeSignal = signals.find(s => s.msg.includes('early morning'));
    expect(timeSignal).toBeDefined();
    expect(score).toBeLessThan(70);
  });
});
