'use strict';
const express = require('express');
const { forward } = require('../masterClient');
const { requireSession } = require('../session');

const router = express.Router();
router.use(requireSession);

/**
 * Whitelist of Node→Master proxy endpoints. The Node forwards the request body
 * verbatim and relays the Master's response (including "QUEUED" statuses).
 * Nothing here touches Cloudflare — all execution lives on the Master.
 */
const relay = (method, masterPath, getPath) => async (req, res) => {
  const path = getPath ? getPath(req) : masterPath;
  const { status, data } = await forward(method, path, {
    data: req.body,
    params: req.query,
  });
  res.status(status).json(data);
};

// Account + dashboard
router.get('/me', relay('GET', '/node/me'));
router.get('/referral', relay('GET', '/node/referral'));
router.get('/jobs', relay('GET', '/node/jobs'));

// Master-controlled help/contact/changelog/broadcast content.
router.get('/site-content', relay('GET', '/public/site-content'));

// Cloudflare onboarding (token + zones) — body forwarded, never inspected.
router.post('/cloudflare/token', relay('POST', '/node/cloudflare/token'));
router.get('/cloudflare/zones', relay('GET', '/node/cloudflare/zones'));

// Domains
router.get('/domains', relay('GET', '/node/domains'));
router.post('/domains', relay('POST', '/node/domains'));
router.post('/domains/:id/activate', relay('POST', null, (r) => `/node/domains/${r.params.id}/activate`));
router.post('/domains/:id/rebuild', relay('POST', null, (r) => `/node/domains/${r.params.id}/rebuild`));

// Categories
router.get('/categories', relay('GET', '/node/categories'));
router.post('/categories', relay('POST', '/node/categories'));

// URLs (single + bulk + edit + delete)
router.get('/urls', relay('GET', '/node/urls'));
router.post('/urls', relay('POST', '/node/urls'));
router.post('/urls/bulk', relay('POST', '/node/urls/bulk'));
router.patch('/urls/:id', relay('PATCH', null, (r) => `/node/urls/${r.params.id}`));
router.delete('/urls/:id', relay('DELETE', null, (r) => `/node/urls/${r.params.id}`));

module.exports = router;
