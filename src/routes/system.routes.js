'use strict';
const express = require('express');
const path = require('path');
const crypto = require('crypto');
const { execFile, spawn } = require('child_process');
const { requireSession } = require('../session');
const logger = require('../logger');

const router = express.Router();
router.use(requireSession);

const APP_DIR = process.env.APP_DIR || path.join(__dirname, '..', '..');
const PM2_NAME = process.env.PM2_NAME || 'node-panel';
const OTA_ENABLED = (process.env.OTA_ENABLED || 'true') !== 'false';
// Unique per process start — lets the client detect when the panel has restarted.
const BOOT_ID = crypto.randomBytes(8).toString('hex');

/** GET /api/system/version — git commit, OTA flag, and this process's boot id. */
router.get('/system/version', (req, res) => {
  execFile('git', ['-C', APP_DIR, 'rev-parse', '--short', 'HEAD'], { timeout: 5000 }, (err, out) => {
    res.json({ version: err ? 'unknown' : String(out).trim(), otaEnabled: OTA_ENABLED, bootId: BOOT_ID });
  });
});

/**
 * POST /api/system/update — pull latest code, install deps, restart via PM2.
 * Runs detached so it survives the restart it triggers. Session-gated.
 */
router.post('/system/update', (req, res) => {
  if (!OTA_ENABLED) return res.status(403).json({ error: { message: 'OTA dinonaktifkan.' } });
  const cmd = `cd "${APP_DIR}" && git pull --ff-only && npm install --omit=dev && pm2 restart ${PM2_NAME}`;
  logger.info({ APP_DIR, PM2_NAME }, 'OTA update triggered');
  try {
    const child = spawn('bash', ['-lc', cmd], { detached: true, stdio: 'ignore' });
    child.unref();
    res.json({ ok: true, message: 'Pembaruan dimulai. Panel akan dimuat ulang sebentar lagi.' });
  } catch (err) {
    logger.error({ err }, 'OTA spawn failed');
    res.status(500).json({ error: { message: 'Gagal memulai pembaruan.' } });
  }
});

module.exports = router;
