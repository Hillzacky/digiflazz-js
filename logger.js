'use strict';

const fs   = require('fs');
const path = require('path');

const LOG_DIR  = path.resolve(__dirname, 'logs');
const LOG_FILE = path.join(LOG_DIR, 'app.log');

// Buat folder logs jika belum ada
if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });

/**
 * Tulis log sebagai JSON per baris ke logs/app.log
 * Sekaligus print ke stdout (sebagai JSON juga)
 */
function log(level, event, data = {}) {
  const entry = {
    timestamp : new Date().toISOString(),
    level,
    event,
    ...data,
  };
  const line = JSON.stringify(entry);
  // Append ke file
  fs.appendFileSync(LOG_FILE, line + '\n', 'utf8');
  // Stdout juga JSON
  process.stdout.write(line + '\n');
}

const logger = {
  info  : (event, data) => log('INFO',  event, data),
  warn  : (event, data) => log('WARN',  event, data),
  error : (event, data) => log('ERROR', event, data),
};

module.exports = logger;