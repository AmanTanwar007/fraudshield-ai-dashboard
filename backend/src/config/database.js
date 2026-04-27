'use strict';

require('dotenv').config();

const { Sequelize } = require('sequelize');
const pg = require('pg');

const sequelize = new Sequelize(
  process.env.DB_NAME || 'neondb',
  process.env.DB_USER || 'neondb_owner',
  process.env.DB_PASSWORD || '',
  {
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT) || 5432,
    dialect: 'postgres',
    dialectModule: pg,
    logging: false,

    pool: {
      max: 3,
      min: 0,
      acquire: 60000,
      idle: 10000
    },

    dialectOptions: {
      ssl: {
        require: true,
        rejectUnauthorized: false
      }
    }
  }
);

module.exports = { sequelize };