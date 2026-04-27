'use strict';

require('dotenv').config();
const app = require('./app');
const { sequelize } = require('./models');

const PORT = process.env.PORT || 5000;

async function startServer() {
  try {
    await sequelize.authenticate();
    console.log('✅  Database connected');

    await sequelize.sync({ alter: true });
    console.log('✅  Models synced');

    app.listen(PORT, () => {
      console.log(`🚀  Server running on port ${PORT}`);
      console.log(`📡  Health: http://localhost:${PORT}/api/health`);
    });
  } catch (err) {
    console.error('❌  Server failed to start:', err.message);
    process.exit(1);
  }
}

startServer();
