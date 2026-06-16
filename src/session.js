'use strict';
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const config = require('./config');

// In-memory single-active-session registry: uid -> current sid.
// A new login supersedes older sessions; cleared on restart (re-login).
const activeSessions = new Map();

/** Issue a signed session cookie after a successful login. */
function issueSession(res, snapshot) {
  const sid = crypto.randomBytes(12).toString('hex');
  activeSessions.set(String(snapshot.userId), sid);
  const token = jwt.sign(
    { uid: snapshot.userId, lid: snapshot.licenseId, name: snapshot.displayName, sid },
    config.session.secret,
    { expiresIn: `${config.session.ttlHours}h` }
  );
  res.cookie(config.session.cookieName, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.env === 'production',
    maxAge: config.session.ttlHours * 3600 * 1000,
  });
}

function clearSession(res) {
  res.clearCookie(config.session.cookieName);
}

// ---- Pre-auth cookie (between the password step and the 2FA step) --------
const PRE_COOKIE = 'node_pre';
function setPreauth(res, token) {
  res.cookie(PRE_COOKIE, token, {
    httpOnly: true, sameSite: 'lax', secure: config.env === 'production', maxAge: 10 * 60 * 1000,
  });
}
function getPreauth(req) { return req.cookies?.[PRE_COOKIE]; }
function clearPreauth(res) { res.clearCookie(PRE_COOKIE); }

/** Gate panel pages/API behind a valid local session cookie. */
function requireSession(req, res, next) {
  const token = req.cookies?.[config.session.cookieName];
  if (!token) return redirectOrJson(req, res);
  try {
    const payload = jwt.verify(token, config.session.secret);
    // Single active session: only the most recent login's sid is valid.
    if (activeSessions.get(String(payload.uid)) !== payload.sid) return redirectOrJson(req, res);
    req.session = payload;
    next();
  } catch {
    return redirectOrJson(req, res);
  }
}

function redirectOrJson(req, res) {
  if (req.path.startsWith('/api/')) {
    return res.status(401).json({ error: { code: 'NO_SESSION', message: 'Login required' } });
  }
  return res.redirect(config.loginPath);
}

module.exports = {
  issueSession, clearSession, requireSession,
  setPreauth, getPreauth, clearPreauth,
};
