'use strict';
const express = require('express');
const { requireSession } = require('../session');
const { getBranding } = require('../masterClient');

const router = express.Router();

// Make the Master-controlled footer attribution available to every view.
router.use(async (req, res, next) => {
  try {
    res.locals.branding = await getBranding();
  } catch {
    res.locals.branding = { attributionText: 'silent404s', attributionUrl: '#' };
  }
  next();
});

// Public pages.
router.get('/login', (req, res) => res.render('login'));
router.get('/agreement', (req, res) => res.render('agreement'));

// Authenticated SPA shell — client-side hash routing handles the sections.
router.get('/', requireSession, (req, res) => res.render('app', { user: req.session }));

// Backwards-compatible deep links -> SPA hash routes.
['/dashboard', '/domains', '/urls', '/referral', '/help', '/changelog', '/contact'].forEach((p) =>
  router.get(p, (req, res) => res.redirect('/#' + p))
);

module.exports = router;
