'use strict';
const path = require('path');
const express = require('express');
const helmet = require('helmet');
const compression = require('compression');
const cookieParser = require('cookie-parser');
const pinoHttp = require('pino-http');
const rateLimit = require('express-rate-limit');
const logger = require('./logger');

const pages = require('./routes/pages.routes');
const auth = require('./routes/auth.routes');
const proxy = require('./routes/proxy.routes');

function createApp() {
  const app = express();

  app.set('view engine', 'ejs');
  app.set('views', path.join(__dirname, '..', 'views'));
  app.set('trust proxy', 1);

  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:'],
          connectSrc: ["'self'"],
        },
      },
    })
  );
  app.use(compression());
  app.use(express.json({ limit: '512kb' }));
  app.use(express.urlencoded({ extended: false }));
  app.use(cookieParser());
  app.use(pinoHttp({ logger }));
  app.use('/static', express.static(path.join(__dirname, '..', 'public')));

  // Keep the entire Node panel out of search engines.
  app.get('/robots.txt', (req, res) =>
    res.type('text/plain').send('User-agent: *\nDisallow: /\n')
  );
  app.get('/favicon.ico', (req, res) => res.redirect(301, '/static/favicon.svg'));

  // Rate-limit login attempts.
  const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 30 });

  app.use('/', pages);
  app.use('/api', loginLimiter, auth);
  app.use('/api', proxy);

  app.use((req, res) => res.status(404).render('404'));
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    logger.error({ err }, 'Node error');
    res.status(500).json({ error: { code: 'INTERNAL', message: 'Internal error' } });
  });

  return app;
}

module.exports = { createApp };
