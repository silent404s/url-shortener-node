'use strict';
const express = require('express');
const rateLimit = require('express-rate-limit');
const mc = require('../masterClient');
const {
  issueSession, clearSession, setPreauth, getPreauth, clearPreauth,
} = require('../session');

const router = express.Router();

// Throttle login/2FA attempts (per IP). Applied only to these endpoints.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, max: 40, standardHeaders: true, legacyHeaders: false,
  handler: (req, res) => res.status(429).json({ error: { message: 'Terlalu banyak percobaan. Coba lagi nanti.' } }),
});

/**
 * Two-step login (Model A): email+password, then Google Authenticator (TOTP).
 * The Node holds the license (used as the API credential); the human proves
 * identity with their Master account password + 2FA. Accounts without 2FA yet
 * are guided through enrollment before a session is issued.
 */

// Step 1 — verify email + password against the license owner on the Master.
router.post('/login', loginLimiter, async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: { message: 'Email & kata sandi wajib diisi.' } });
  }
  const { status, data } = await mc.authPassword(email, password);
  if (status !== 200) return res.status(status).json(data);
  setPreauth(res, data.preauth);
  res.json({ ok: true, totpEnabled: data.totpEnabled });
});

// Step 2a — TOTP (or recovery code) for accounts that already have 2FA.
router.post('/login/totp', loginLimiter, async (req, res) => {
  const preauth = getPreauth(req);
  if (!preauth) return res.status(401).json({ error: { message: 'Sesi login kedaluwarsa. Ulangi.' } });
  const { status, data } = await mc.authTotp(preauth, (req.body || {}).code);
  if (status !== 200) return res.status(status).json(data);
  issueSession(res, data.snapshot);
  clearPreauth(res);
  res.json({ ok: true });
});

// Step 2b — enrollment for accounts without 2FA yet.
router.get('/2fa/setup', async (req, res) => {
  const preauth = getPreauth(req);
  if (!preauth) return res.status(401).json({ error: { message: 'Sesi login kedaluwarsa. Ulangi.' } });
  const { status, data } = await mc.setup2fa(preauth);
  res.status(status).json(data);
});

router.post('/2fa/enable', loginLimiter, async (req, res) => {
  const preauth = getPreauth(req);
  if (!preauth) return res.status(401).json({ error: { message: 'Sesi login kedaluwarsa. Ulangi.' } });
  const { status, data } = await mc.enable2fa(preauth, (req.body || {}).code);
  if (status !== 200) return res.status(status).json(data);
  issueSession(res, data.snapshot);
  clearPreauth(res);
  res.json({ ok: true, recoveryCodes: data.recoveryCodes });
});

router.post('/logout', (req, res) => {
  clearSession(res);
  clearPreauth(res);
  res.json({ ok: true });
});

module.exports = router;
