'use strict';

require('dotenv').config();
const app = require('./app');
const { sequelize } = require('./models');

let initialized = false;

module.exports = async (req, res) => {
  try {
    if (!initialized) {
      await sequelize.authenticate();
      await sequelize.sync();
      initialized = true;
      console.log("DB Connected");
    }

    return app(req, res);
  } catch (err) {
    console.error(err);
    res.status(500).send("Server Error");
  }
};