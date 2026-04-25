'use strict';

const { Sequelize } = require('sequelize');
const logger = require('../utils/logger');

const sequelize = new Sequelize(
  process.env.DB_NAME     || 'backhackers_db',
  process.env.DB_USER     || 'postgres',
  process.env.DB_PASSWORD || 'password',
  {
    host:    process.env.DB_HOST || 'localhost',
    port:    parseInt(process.env.DB_PORT) || 5432,
    dialect: 'postgres',
    logging: (sql) => logger.debug(sql),
    pool: {
      max:     10,
      min:     0,
      acquire: 30000,
      idle:    10000,
    },
    dialectOptions: {
      ssl: {
        require: true,
        rejectUnauthorized: false,
      },
    },
  }
);

module.exports = { sequelize };