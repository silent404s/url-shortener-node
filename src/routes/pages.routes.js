'use strict';
const express = require('express');
const config = require('../config');
const { requireSession } = require('../session');
const { getBranding } = require('../masterClient');

const router = express.Router();

// Make the Master-controlled footer attribution + login path available to views.
router.use(async (req, res, next) => {
  res.locals.loginPath = config.loginPath;
  res.locals.idleMinutes = config.session.idleMinutes;
  try {
    res.locals.branding = await getBranding();
  } catch {
    res.locals.branding = { attributionText: 'silent404s', attributionUrl: '#' };
  }
  next();
});

// Public pages. Login is served at the configurable (secret) path.
router.get(config.loginPath, (req, res) => res.render('login'));
router.get('/agreement', (req, res) => res.render('agreement'));

// Authenticated SPA shell — client-side hash routing handles the sections.
router.get('/', requireSession, (req, res) => res.render('app', { user: req.session }));

// Backwards-compatible deep links -> SPA hash routes.
['/dashboard', '/domains', '/urls', '/referral', '/help', '/changelog', '/contact'].forEach((p) =>
  router.get(p, (req, res) => res.redirect('/#' + p))
);

module.exports = router;
