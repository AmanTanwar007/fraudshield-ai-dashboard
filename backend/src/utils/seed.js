'use strict';

require('dotenv').config();
const { sequelize, User, Transaction, Alert } = require('../models');
const { analyzeTransaction, generateTxnId } = require('../services/fraudEngine.service');

const COUNTRIES   = ['United States','United Kingdom','Germany','Canada','Australia','France','Japan','India','Nigeria','Russia','Brazil','Mexico','Romania','Ukraine','Vietnam'];
const TX_TYPES    = ['online_purchase','online_purchase','online_purchase','pos_payment','pos_payment','wire_transfer','atm_withdrawal','crypto_exchange'];
const DEV_RISKS   = ['trusted','trusted','trusted','new','flagged','vpn_proxy'];
const MERCHANTS   = ['Amazon','Shopify','eBay','Stripe','PayPal','Square',null];

const pick = arr => arr[Math.floor(Math.random() * arr.length)];
const rand = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a;
const randFloat = (a, b) => parseFloat((Math.random() * (b - a) + a).toFixed(2));
const randDate = days => { const d = new Date(); d.setDate(d.getDate() - rand(0, days)); d.setHours(rand(0,23), rand(0,59), rand(0,59)); return d; };

async function seed() {
  try {
    await sequelize.authenticate();
    console.log('✅  DB connected');

    await sequelize.sync({ force: true });
    console.log('✅  Tables created (force)');

    // ── Users ────────────────────────────────────────────
    const admin = await User.create({ name: 'Admin User', email: 'admin@backhackers.ai', password: 'Admin@1234', role: 'admin' });
    await User.create({ name: 'Security Analyst', email: 'analyst@backhackers.ai', password: 'Analyst@1234', role: 'analyst' });
    await User.create({ name: 'Dashboard Viewer', email: 'viewer@backhackers.ai',  password: 'Viewer@1234',  role: 'viewer'  });
    console.log('✅  Users seeded');

    // ── Transactions ─────────────────────────────────────
    const txRecords = [];
    const alertBatch = [];

    for (let i = 0; i < 200; i++) {
      const amount          = randFloat(10, 25000);
      const transactionType = pick(TX_TYPES);
      const country         = pick(COUNTRIES);
      const hourOfDay       = rand(0, 23);
      const deviceRisk      = pick(DEV_RISKS);
      const velocity        = rand(1, 10);
      const createdAt       = randDate(30);

      const { score, verdict, signals, alertsToCreate } = analyzeTransaction({ amount, transactionType, country, hourOfDay, deviceRisk, velocity });
      const txnId  = generateTxnId();
      const status = verdict === 'block' ? pick(['pending','reviewed','escalated','resolved']) : pick(['pending','reviewed']);

      txRecords.push({ txnId, amount, currency: 'USD', transactionType, country, hourOfDay, deviceRisk, velocity, riskScore: score, verdict, signals, status, merchantId: pick(MERCHANTS), accountId: `ACC-${rand(1000,9999)}`, ipAddress: `${rand(1,254)}.${rand(1,254)}.${rand(1,254)}.${rand(1,254)}`, createdAt, updatedAt: createdAt });
      alertsToCreate.forEach(a => alertBatch.push({ ...a, _txnId: txnId, createdAt, updatedAt: createdAt }));
    }

    await Transaction.bulkCreate(txRecords);
    console.log(`✅  ${txRecords.length} transactions seeded`);

    // Map txnId → id for alerts
    const allTx  = await Transaction.findAll({ attributes: ['id','txnId'] });
    const txMap  = {};
    allTx.forEach(t => { txMap[t.txnId] = t.id; });

    const alerts = alertBatch.filter(a => txMap[a._txnId]).map(({ _txnId, ...a }) => ({ ...a, transactionId: txMap[_txnId] }));
    if (alerts.length) await Alert.bulkCreate(alerts);
    console.log(`✅  ${alerts.length} alerts seeded`);

    console.log('\n══════════════════════════════════════');
    console.log('  Seed complete! Credentials:');
    console.log('  Admin   → admin@backhackers.ai   / Admin@1234');
    console.log('  Analyst → analyst@backhackers.ai / Analyst@1234');
    console.log('  Viewer  → viewer@backhackers.ai  / Viewer@1234');
    console.log('══════════════════════════════════════\n');
    process.exit(0);
  } catch (err) {
    console.error('❌  Seed failed:', err.message);
    process.exit(1);
  }
}

seed();
