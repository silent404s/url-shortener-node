'use strict';
const express = require('express');
const { validateLicense } = require('../masterClient');
const { issueSession, clearSession } = require('../session');
const logger = require('../logger');

const router = express.Router();

/**
 * POST /api/login — the panel login validates the locally-configured license
 * against the Master, then sets a session cookie. There are no per-user
 * passwords on the Node; the license IS the credential.
 */
router.post('/login', async (req, res) => {
  const result = await validateLicense();
  if (!result.ok) {
    return res.status(403).json({
      error: { code: 'LICENSE_INVALID', message: result.reason || 'License validation failed' },
    });
  }
  issueSession(res, result.snapshot);
  res.json({
    ok: true,
    offline: !!result.offline,
    user: { name: result.snapshot.displayName, referralCode: result.snapshot.referralCode },
  });
});

router.post('/logout', (req, res) => {
  clearSession(res);
  res.json({ ok: true });
});

module.exports = router;
