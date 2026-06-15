'use strict';
/**
 * Runtime (mutable) configuration for the Node panel.
 *
 * License credentials can be supplied two ways:
 *  1. Environment (.env): LICENSE_KEY / LICENSE_SECRET — wins if present.
 *  2. The web setup wizard, which writes them to data/config.json at runtime.
 *
 * This lets users finish setup in the browser instead of editing .env by hand,
 * while staying backward-compatible with installs that set the env vars.
 */
const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, '..', 'data', 'config.json');
let cache = null;

function loadFile() {
  if (cache) return cache;
  try { cache = JSON.parse(fs.readFileSync(FILE, 'utf8')); }
  catch { cache = {}; }
  return cache;
}

/** Effective config: env overrides the saved file. */
function get() {
  const f = loadFile();
  return {
    licenseKey: process.env.LICENSE_KEY || f.licenseKey || null,
    licenseSecret: process.env.LICENSE_SECRET || f.licenseSecret || null,
  };
}

/** Persist license credentials to data/config.json. */
function save(data) {
  const dir = path.dirname(FILE);
  fs.mkdirSync(dir, { recursive: true });
  const merged = { ...loadFile(), ...data };
  fs.writeFileSync(FILE, JSON.stringify(merged, null, 2));
  cache = merged;
}

function isConfigured() {
  const c = get();
  return !!(c.licenseKey && c.licenseSecret);
}

module.exports = { get, save, isConfigured };
