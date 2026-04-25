'use strict';

require('dotenv').config();
const { sequelize, User, Transaction, Alert, AuditLog } = require('../models');
const { analyzeTransaction, generateTxnId } = require('../services/fraudEngine.service');
const logger = require('./logger');

// ── Seed data pools ───────────────────────────────────────
const COUNTRIES = [
  'United States', 'United Kingdom', 'Germany', 'Canada', 'Australia',
  'France', 'Japan', 'India', 'China', 'Nigeria', 'Russia', 'Brazil',
  'Mexico', 'Indonesia', 'Pakistan', 'Romania', 'Ukraine', 'Vietnam',
];

const TX_TYPES = [
  'online_purchase', 'online_purchase', 'online_purchase', 'pos_payment',
  'pos_payment', 'wire_transfer', 'atm_withdrawal', 'crypto_exchange',
];

const DEVICE_RISKS = ['trusted', 'trusted', 'trusted', 'new', 'flagged', 'vpn_proxy'];

const MERCHANTS = [
  'Amazon', 'Shopify', 'eBay', 'Stripe', 'PayPal', 'Square',
  'WooCommerce', 'Magento', 'BigCommerce', null,
];

function pick(arr)  { return arr[Math.floor(Math.random() * arr.length)]; }
function rand(a, b) { return Math.floor(Math.random() * (b - a + 1)) + a; }
function randFloat(a, b) { return parseFloat((Math.random() * (b - a) + a).toFixed(2)); }

function randomDate(daysAgo) {
  const d = new Date();
  d.setDate(d.getDate() - rand(0, daysAgo));
  d.setHours(rand(0, 23), rand(0, 59), rand(0, 59));
  return d;
}

async function seed() {
  try {
    await sequelize.authenticate();
    await sequelize.sync({ force: true });   // ⚠️ drops + recreates tables
    logger.info('Database synced (fresh)');

    // ── 1. Admin user ────────────────────────────────────
    const admin = await User.create({
      name:     'Admin User',
      email:    'admin@backhackers.ai',
      password: 'Admin@1234',
      role:     'admin',
    });

    const analyst = await User.create({
      name:     'Security Analyst',
      email:    'analyst@backhackers.ai',
      password: 'Analyst@1234',
      role:     'analyst',
    });

    const viewer = await User.create({
      name:     'Dashboard Viewer',
      email:    'viewer@backhackers.ai',
      password: 'Viewer@1234',
      role:     'viewer',
    });

    logger.info('✅  Users seeded');

    // ── 2. Transactions ───────────────────────────────────
    const txRecords = [];
    const alertRecords = [];

    for (let i = 0; i < 200; i++) {
      const amount          = randFloat(10, 25000);
      const transactionType = pick(TX_TYPES);
      const country         = pick(COUNTRIES);
      const hourOfDay       = rand(0, 23);
      const deviceRisk      = pick(DEVICE_RISKS);
      const velocity        = rand(1, 10);

      const { score, verdict, signals, alertsToCreate } = analyzeTransaction({
        amount, transactionType, country, hourOfDay, deviceRisk, velocity,
      });

      const txnId = generateTxnId();
      const createdAt = randomDate(30);

      const statuses = verdict === 'block'
        ? ['pending', 'reviewed', 'escalated', 'resolved']
        : ['pending', 'reviewed'];
      const status = pick(statuses);

      txRecords.push({
        txnId,
        amount,
        currency: 'USD',
        transactionType,
        country,
        hourOfDay,
        deviceRisk,
        velocity,
        riskScore:  score,
        verdict,
        signals,
        status,
        reviewedBy: status !== 'pending' ? analyst.id : null,
        reviewedAt: status !== 'pending' ? new Date(createdAt.getTime() + 1000 * 60 * rand(5, 120)) : null,
        merchantId: pick(MERCHANTS),
        accountId:  `ACC-${rand(1000, 9999)}`,
        ipAddress:  `${rand(1,254)}.${rand(1,254)}.${rand(1,254)}.${rand(1,254)}`,
        createdAt,
        updatedAt:  createdAt,
      });

      // collect alerts to create after transactions
      for (const a of alertsToCreate) {
        alertRecords.push({ ...a, _txnId: txnId, createdAt, updatedAt: createdAt });
      }
    }

    // Bulk insert transactions (bypassing hooks for speed)
    await Transaction.bulkCreate(txRecords, {
      updateOnDuplicate: ['txnId'],
    });
    logger.info(`✅  ${txRecords.length} transactions seeded`);

    // Attach transactionId to alerts
    const txMap = {};
    const allTx = await Transaction.findAll({ attributes: ['id', 'txnId'] });
    allTx.forEach(t => { txMap[t.txnId] = t.id; });

    const finalAlerts = alertRecords
      .filter(a => txMap[a._txnId])
      .map(({ _txnId, ...a }) => ({ ...a, transactionId: txMap[_txnId] }));

    if (finalAlerts.length > 0) {
      await Alert.bulkCreate(finalAlerts);
    }
    logger.info(`✅  ${finalAlerts.length} alerts seeded`);

    // ── 3. Audit logs ─────────────────────────────────────
    await AuditLog.create({
      userId:    admin.id,
      action:    'SEED_DATABASE',
      details:   { transactions: txRecords.length, alerts: finalAlerts.length },
      success:   true,
    });
    logger.info('✅  Audit log seeded');

    logger.info('\n══════════════════════════════════════');
    logger.info('  Seed complete! Login credentials:');
    logger.info('  Admin   → admin@backhackers.ai   / Admin@1234');
    logger.info('  Analyst → analyst@backhackers.ai / Analyst@1234');
    logger.info('  Viewer  → viewer@backhackers.ai  / Viewer@1234');
    logger.info('══════════════════════════════════════\n');

    process.exit(0);
  } catch (err) {
    logger.error('Seed failed:', err);
    process.exit(1);
  }
}

seed();
