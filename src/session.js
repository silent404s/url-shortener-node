'use strict';
const jwt = require('jsonwebtoken');
const config = require('./config');

/** Issue a signed session cookie after a successful license validation. */
function issueSession(res, snapshot) {
  const token = jwt.sign(
    { uid: snapshot.userId, lid: snapshot.licenseId, name: snapshot.displayName },
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

/** Gate panel pages/API behind a valid local session cookie. */
function requireSession(req, res, next) {
  const token = req.cookies?.[config.session.cookieName];
  if (!token) return redirectOrJson(req, res);
  try {
    req.session = jwt.verify(token, config.session.secret);
    next();
  } catch {
    return redirectOrJson(req, res);
  }
}

function redirectOrJson(req, res) {
  if (req.path.startsWith('/api/')) {
    return res.status(401).json({ error: { code: 'NO_SESSION', message: 'Login required' } });
  }
  return res.redirect('/login');
}

module.exports = { issueSession, clearSession, requireSession };
