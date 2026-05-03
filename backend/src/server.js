'use strict';

require('dotenv').config();

const app = require('./app');
const { sequelize } = require('./models');

let isConnected = false;

async function connectDB() {
  if (isConnected) return;

  try {
    console.log('Connecting to DB...');

    await sequelize.authenticate();
    console.log('✅ Database connected');

    await sequelize.sync({ alter: true });
    console.log('✅ Models synced');

    isConnected = true;
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    throw error;
  }
}

module.exports = async (req, res) => {
  await connectDB();
  return app(req, res);
};