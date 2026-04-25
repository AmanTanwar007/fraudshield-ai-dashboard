'use strict';

require('dotenv').config();
const app      = require('./app');
const { sequelize } = require('./models');
const logger   = require('./utils/logger');

const PORT = process.env.PORT || 5000;

async function startServer() {
  try {
    // Authenticate DB connection
    await sequelize.authenticate();
    logger.info('✅  Database connection established');

    // Sync models (alter:true preserves data on schema changes)
    await sequelize.sync({ alter: true });
    logger.info('✅  Database models synchronized');

    app.listen(PORT, () => {
      logger.info(`🚀  BackHackers AI API running on port ${PORT} [${process.env.NODE_ENV}]`);
      logger.info(`📡  Health check → http://localhost:${PORT}/api/health`);
    });
  } catch (err) {
    logger.error('❌  Failed to start server:', err);
    process.exit(1);
  }
}

startServer();
