'use strict';
const axios = require('axios');
const config = require('./config');
const logger = require('./logger');
const { cache } = require('./cache');
const runtime = require('./runtimeConfig');

/**
 * API client/forwarder to the Master. License credentials are injected per
 * request from runtimeConfig (env or the web setup wizard), so the panel can
 * start unconfigured and be set up from the browser.
 */
const http = axios.create({
  baseURL: `${config.master.baseUrl}/api`,
  timeout: config.master.timeoutMs,
});

// Attach license headers from runtime config unless the caller set them.
http.interceptors.request.use((cfg) => {
  if (!cfg.headers['x-license-key']) {
    const c = runtime.get();
    if (c.licenseKey) {
      cfg.headers['x-license-key'] = c.licenseKey;
      cfg.headers['x-license-secret'] = c.licenseSecret;
    }
  }
  return cfg;
});

/** Normalize an axios call to { status, data }. */
async function call(fn) {
  try { const res = await fn(); return { status: res.status, data: res.data }; }
  catch (err) {
    if (err.response) return { status: err.response.status, data: err.response.data };
    logger.error({ err: err.message }, 'Master unreachable');
    return { status: 503, data: { error: { code: 'MASTER_UNREACHABLE', message: 'Master tidak dapat dihubungi.' } } };
  }
}
const bearer = (t) => ({ headers: { Authorization: `Bearer ${t}` } });

/** Generic forwarder used by proxy routes. Returns { status, data }. */
async function forward(method, path, { data, params } = {}) {
  const r = await call(() => http.request({ method, url: path, data, params }));
  if (r.status === 503) r.offline = true;
  return r;
}

// ---- 2FA login flow (Model A: email+password then TOTP) ------------------
const authPassword = (email, password) => call(() => http.post('/node/auth/password', { email, password }));
const authTotp = (preauth, code) => call(() => http.post('/node/auth/totp', { code }, bearer(preauth)));
const setup2fa = (preauth) => call(() => http.get('/node/2fa/setup', bearer(preauth)));
const enable2fa = (preauth, code) => call(() => http.post('/node/2fa/enable', { code }, bearer(preauth)));

// ---- Branding (Master-controlled footer attribution) ---------------------
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

// ---- Setup wizard helpers ------------------------------------------------
/** Validate a license pair by calling an authenticated endpoint with it. */
async function validateLicense(licenseKey, licenseSecret) {
  return call(() => http.get('/node/me', {
    headers: { 'x-license-key': licenseKey, 'x-license-secret': licenseSecret },
  }));
}

/** Register a new account on the Master (used by the "daftar baru" install mode). */
const registerOnMaster = (body) => call(() => http.post('/auth/register', body));

module.exports = {
  forward, http, getBranding,
  authPassword, authTotp, setup2fa, enable2fa,
  validateLicense, registerOnMaster,
};
