'use strict';

const logger = {
  info:  (...args) => console.log('[INFO]',  ...args),
  error: (...args) => console.error('[ERROR]', ...args),
  warn:  (...args) => console.warn('[WARN]',  ...args),
  debug: (...args) => {}, // silent in production
};

module.exports = logger;
