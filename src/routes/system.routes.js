'use strict';
const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { execFile, spawn } = require('child_process');
const { requireSession } = require('../session');
const logger = require('../logger');

const router = express.Router();

const APP_DIR = process.env.APP_DIR || path.join(__dirname, '..', '..');
const PM2_NAME = process.env.PM2_NAME || 'node-panel';
const OTA_ENABLED = (process.env.OTA_ENABLED || 'true') !== 'false';
const OTA_LOG = path.join(APP_DIR, 'ota.log');
// Unique per process start — lets the client detect when the panel has restarted.
const BOOT_ID = crypto.randomBytes(8).toString('hex');

// PUBLIC (no session): tiny boot-id ping so the OTA overlay can detect the
// restart even though the restart invalidates the session.
router.get('/system/ping', (req, res) => res.json({ bootId: BOOT_ID }));

// Everything below requires a session.
router.use(requireSession);

/** GET /api/system/version — git commit, OTA flag, and this process's boot id. */
router.get('/system/version', (req, res) => {
  execFile('git', ['-C', APP_DIR, 'rev-parse', '--short', 'HEAD'], { timeout: 5000 }, (err, out) => {
    res.json({ version: err ? 'unknown' : String(out).trim(), otaEnabled: OTA_ENABLED, bootId: BOOT_ID });
  });
});

/** GET /api/system/ota-log — last lines of the OTA log (for diagnosing). */
router.get('/system/ota-log', (req, res) => {
  let log = '';
  try { log = fs.readFileSync(OTA_LOG, 'utf8').split('\n').slice(-40).join('\n'); } catch { /* none */ }
  res.json({ log });
});

/**
 * POST /api/system/update — pull latest code, install deps, restart via PM2.
 * Runs detached so it survives the restart it triggers. Output goes to ota.log.
 * GIT_TERMINAL_PROMPT=0 makes git fail fast (instead of hanging) if the repo is
 * private and credentials aren't cached.
 */
router.post('/system/update', (req, res) => {
  if (!OTA_ENABLED) return res.status(403).json({ error: { message: 'OTA dinonaktifkan.' } });
  // Only run npm install when dependency files actually changed in the pull —
  // otherwise OTA is just a fast pull + restart.
  const cmd = `cd "${APP_DIR}" && echo "=== OTA $(date) ===" && git pull --ff-only && ` +
    `( git diff --name-only HEAD@{1} HEAD | grep -qE 'package(-lock)?\\.json$' ` +
    `&& echo 'deps changed -> npm install' && npm install --omit=dev ` +
    `|| echo 'no dependency changes -> skip npm install' ) && ` +
    `pm2 restart ${PM2_NAME} && echo "=== OTA done ==="`;
  logger.info({ APP_DIR, PM2_NAME }, 'OTA update triggered');
  try {
    const out = fs.openSync(OTA_LOG, 'a');
    const child = spawn('bash', ['-lc', cmd], {
      detached: true,
      stdio: ['ignore', out, out],
      env: { ...process.env, GIT_TERMINAL_PROMPT: '0', GIT_ASKPASS: 'echo' },
    });
    child.unref();
    res.json({ ok: true, message: 'Pembaruan dimulai. Panel akan dimuat ulang sebentar lagi.' });
  } catch (err) {
    logger.error({ err }, 'OTA spawn failed');
    res.status(500).json({ error: { message: 'Gagal memulai pembaruan.' } });
  }
});

module.exports = router;
