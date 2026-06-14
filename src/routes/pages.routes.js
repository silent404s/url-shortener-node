'use strict';
const express = require('express');
const { requireSession } = require('../session');

const router = express.Router();

router.get('/login', (req, res) => res.render('login'));

// Persistent tutorial / TOS — available without a session.
router.get('/help', (req, res) => res.render('help'));
router.get('/agreement', (req, res) => res.render('agreement'));

// Authenticated panel pages.
router.get('/', requireSession, (req, res) =>
  res.render('dashboard', { user: req.session })
);
router.get('/urls', requireSession, (req, res) => res.render('urls', { user: req.session }));
router.get('/domains', requireSession, (req, res) => res.render('domains', { user: req.session }));
router.get('/referral', requireSession, (req, res) => res.render('referral', { user: req.session }));

module.exports = router;
