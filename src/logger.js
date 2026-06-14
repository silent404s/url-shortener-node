'use strict';
const pino = require('pino');
const config = require('./config');

module.exports = pino({
  level: config.logLevel,
  redact: {
    paths: ['license', 'token', 'authorization', 'req.headers.cookie'],
    censor: '[REDACTED]',
  },
  transport:
    config.env === 'development'
      ? { target: 'pino-pretty', options: { colorize: true } }
      : undefined,
});
