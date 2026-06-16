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

  // License credentials are resolved at runtime (env or the web setup wizard).
  // See src/runtimeConfig.js — no longer required at boot so the panel can
  // start unconfigured and be set up from the browser.

  // Secret used to sign the local session cookie for the panel UI.
  session: {
    secret: required('SESSION_SECRET'),
    cookieName: process.env.SESSION_COOKIE || 'node_sid',
    ttlHours: parseInt(process.env.SESSION_TTL_HOURS || '8', 10),
    // Auto-logout after this many minutes of inactivity (client-enforced).
    idleMinutes: parseInt(process.env.SESSION_IDLE_MINUTES || '30', 10),
  },

  // Offline tolerance: how long a cached license snapshot stays valid if the
  // Master is unreachable.
  offlineToleranceHours: parseInt(process.env.OFFLINE_TOLERANCE_HOURS || '24', 10),

  // Secret/obscure login path to deter drive-by access to the login page.
  // Set LOGIN_PATH to something unguessable, e.g. /masuk-7f3a9c21.
  // Must start with "/". Defaults to /login for backward compatibility.
  loginPath: (() => {
    let p = process.env.LOGIN_PATH || '/login';
    if (!p.startsWith('/')) p = '/' + p;
    return p;
  })(),
};
