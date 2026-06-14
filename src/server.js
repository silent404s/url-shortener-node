'use strict';
const { createApp } = require('./app');
const config = require('./config');
const logger = require('./logger');

const app = createApp();
const server = app.listen(config.port, () => {
  logger.info(`Node panel listening on :${config.port} -> Master ${config.master.baseUrl}`);
});

const shutdown = () => server.close(() => process.exit(0));
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
