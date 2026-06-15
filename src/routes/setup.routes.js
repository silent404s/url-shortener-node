'use strict';
const express = require('express');
const rateLimit = require('express-rate-limit');
const config = require('../config');
const runtime = require('../runtimeConfig');
const mc = require('../masterClient');

const router = express.Router();
const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20, standardHeaders: true, legacyHeaders: false });

// Setup page (redirects away once configured).
router.get('/setup', (req, res) => {
  if (runtime.isConfigured()) return res.redirect('/');
  res.render('setup', { masterUrl: config.master.baseUrl });
});

// Configure using an existing license.
router.post('/api/setup', limiter, async (req, res) => {
  if (runtime.isConfigured()) return res.status(409).json({ error: { message: 'Sudah dikonfigurasi.' } });
  const { licenseKey, licenseSecret } = req.body || {};
  if (!licenseKey || !licenseSecret) return res.status(400).json({ error: { message: 'Lisensi wajib diisi.' } });
  const { status } = await mc.validateLicense(licenseKey, licenseSecret);
  if (status !== 200) return res.status(400).json({ error: { message: 'Lisensi tidak valid atau tidak aktif.' } });
  runtime.save({ licenseKey, licenseSecret });
  res.json({ ok: true });
});

// Register a new account on the Master, then auto-configure (referral optional).
router.post('/api/setup/register', limiter, async (req, res) => {
  if (runtime.isConfigured()) return res.status(409).json({ error: { message: 'Sudah dikonfigurasi.' } });
  const { email, password, referralCode, acceptAgreement } = req.body || {};
  const { status, data } = await mc.registerOnMaster({
    email, password, referralCode: referralCode || undefined, acceptAgreement,
  });
  if (status !== 201) return res.status(status).json(data);
  runtime.save({ licenseKey: data.license.licenseKey, licenseSecret: data.license.licenseSecret });
  res.json({ ok: true, referralCode: data.referralCode });
});

module.exports = router;
