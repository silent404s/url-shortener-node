'use strict';
const axios = require('axios');
const config = require('./config');
const logger = require('./logger');
const { cache } = require('./cache');

/**
 * Thin API client/forwarder to the Master. The Node holds NO Cloudflare logic;
 * it injects its license credentials as headers and relays the Master's reply.
 *
 * Includes a 24h offline-tolerance cache: the last successful license snapshot
 * is cached so the panel keeps working (read-only) if the Master is briefly down.
 */
const http = axios.create({
  baseURL: `${config.master.baseUrl}/api`,
  timeout: config.master.timeoutMs,
  headers: {
    'x-license-key': config.license.key,
    'x-license-secret': config.license.secret,
  },
});

/** Generic forwarder used by proxy routes. Returns { status, data }. */
async function forward(method, path, { data, params } = {}) {
  try {
    const res = await http.request({ method, url: path, data, params });
    return { status: res.status, data: res.data };
  } catch (err) {
    if (err.response) {
      // Relay the Master's structured error verbatim.
      return { status: err.response.status, data: err.response.data };
    }
    logger.error({ err: err.message, path }, 'Master unreachable');
    return {
      status: 503,
      data: { error: { code: 'MASTER_UNREACHABLE', message: 'Master server unreachable' } },
      offline: true,
    };
  }
}

/**
 * Validate the license against the Master and refresh the cached snapshot.
 * Falls back to the cached snapshot (within tolerance) when the Master is down.
 */
async function validateLicense() {
  try {
    const res = await http.post('/node/session', {
      licenseKey: config.license.key,
      licenseSecret: config.license.secret,
    });
    const snapshot = res.data.snapshot;
    cache.set('license:snapshot', snapshot, config.offlineToleranceHours * 3600);
    cache.set('license:token', res.data.token, 3600);
    return { ok: true, online: true, snapshot, token: res.data.token };
  } catch (err) {
    // Hard rejections from the Master must NOT be overridden by the cache.
    if (err.response && [401, 403].includes(err.response.status)) {
      cache.del('license:snapshot');
      return { ok: false, online: true, reason: err.response.data?.error?.message || 'rejected' };
    }
    // Master unreachable -> offline tolerance.
    const snapshot = cache.get('license:snapshot');
    if (snapshot && snapshot.validUntil > Date.now()) {
      logger.warn('Master unreachable — serving cached license (offline tolerance)');
      return { ok: true, online: false, snapshot, offline: true };
    }
    return { ok: false, online: false, reason: 'Master unreachable and no valid cache' };
  }
}

/**
 * Fetch centrally-controlled branding (footer attribution) from the Master.
 * Cached 5 minutes; falls back to a sane default if the Master is unreachable.
 */
async function getBranding() {
  const cached = cache.get('branding');
  if (cached) return cached;
  try {
    const res = await http.get('/public/branding');
    cache.set('branding', res.data, 300);
    return res.data;
  } catch {
    return { attributionText: 'silent404s', attributionUrl: '#' };
  }
}

/** Normalize an axios call to { status, data } (license headers auto-attached). */
async function call(fn) {
  try { const res = await fn(); return { status: res.status, data: res.data }; }
  catch (err) {
    if (err.response) return { status: err.response.status, data: err.response.data };
    return { status: 503, data: { error: { code: 'MASTER_UNREACHABLE', message: 'Master tidak dapat dihubungi.' } } };
  }
}
const bearer = (t) => ({ headers: { Authorization: `Bearer ${t}` } });

// ---- 2FA login flow (Model A: email+password then TOTP) ------------------
const authPassword = (email, password) => call(() => http.post('/node/auth/password', { email, password }));
const authTotp = (preauth, code) => call(() => http.post('/node/auth/totp', { code }, bearer(preauth)));
const setup2fa = (preauth) => call(() => http.get('/node/2fa/setup', bearer(preauth)));
const enable2fa = (preauth, code) => call(() => http.post('/node/2fa/enable', { code }, bearer(preauth)));

module.exports = {
  forward, validateLicense, getBranding, http,
  authPassword, authTotp, setup2fa, enable2fa,
};
