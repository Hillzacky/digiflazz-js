'use strict';

const http    = require('http');
const { CFG } = require('./config');
const { route } = require('./router');
const logger  = require('./logger');

const server = http.createServer((req, res) => route(req, res));

server.listen(CFG.port, () => {
  logger.info('SERVER_START', { port: CFG.port, env: process.env.NODE_ENV || 'development' });
});

server.on('error', err => {
  logger.error('SERVER_ERROR', { error: err.message });
  process.exit(1);
});

process.on('SIGTERM', () => {
  logger.info('SERVER_SHUTDOWN', { signal: 'SIGTERM' });
  server.close(() => process.exit(0));
});

process.on('SIGINT', () => {
  logger.info('SERVER_SHUTDOWN', { signal: 'SIGINT' });
  server.close(() => process.exit(0));
});