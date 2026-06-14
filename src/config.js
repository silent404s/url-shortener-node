'use strict';
require('dotenv').config();

function required(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

module.exports = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3000', 10),
  logLevel: process.env.LOG_LEVEL || 'info',

  // The Master this Node forwards to.
  master: {
    baseUrl: required('MASTER_URL').replace(/\/$/, ''),
    timeoutMs: parseInt(process.env.MASTER_TIMEOUT_MS || '20000', 10),
  },

  // License credentials issued at registration (stored ONLY here).
  license: {
    key: required('LICENSE_KEY'),
    secret: required('LICENSE_SECRET'),
  },

  // Secret used to sign the local session cookie for the panel UI.
  session: {
    secret: required('SESSION_SECRET'),
    cookieName: process.env.SESSION_COOKIE || 'node_sid',
    ttlHours: parseInt(process.env.SESSION_TTL_HOURS || '24', 10),
  },

  // Offline tolerance: how long a cached license snapshot stays valid if the
  // Master is unreachable.
  offlineToleranceHours: parseInt(process.env.OFFLINE_TOLERANCE_HOURS || '24', 10),
};
