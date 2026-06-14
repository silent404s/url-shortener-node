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

module.exports = { forward, validateLicense, http };
