'use strict';
const path = require('path');
const express = require('express');
const helmet = require('helmet');
const compression = require('compression');
const cookieParser = require('cookie-parser');
const pinoHttp = require('pino-http');
const logger = require('./logger');

const runtime = require('./runtimeConfig');
const pages = require('./routes/pages.routes');
const auth = require('./routes/auth.routes');
const proxy = require('./routes/proxy.routes');
const setup = require('./routes/setup.routes');
const system = require('./routes/system.routes');

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
          // FontAwesome (cdnjs) + Google Fonts (Sora/Inter).
          styleSrc: ["'self'", "'unsafe-inline'", 'https://cdnjs.cloudflare.com', 'https://fonts.googleapis.com'],
          fontSrc: ["'self'", 'https://cdnjs.cloudflare.com', 'https://fonts.gstatic.com'],
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

  // Web setup wizard (always reachable). When the panel is not yet configured,
  // everything else is redirected here.
  app.use(setup);
  app.use((req, res, next) => {
    if (runtime.isConfigured()) return next();
    const p = req.path;
    if (p === '/setup' || p.startsWith('/api/setup') || p.startsWith('/static') ||
        p === '/robots.txt' || p === '/favicon.ico') return next();
    if (p.startsWith('/api/')) {
      return res.status(503).json({ error: { code: 'NOT_CONFIGURED', message: 'Panel belum dikonfigurasi.' } });
    }
    return res.redirect('/setup');
  });

  app.use('/', pages);
  app.use('/api', auth);   // login limiter is applied per-endpoint inside auth.routes
  app.use('/api', system); // OTA update + version (session-gated inside)
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
