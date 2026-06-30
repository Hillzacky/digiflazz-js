'use strict';

const crypto = require('crypto');
const fs     = require('fs');
const path   = require('path');

// ── Load .env manual (zero dependency) ───────────────────────────────────────
const envPath = path.resolve(__dirname, '.env');
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
    const t = line.trim();
    if (!t || t.startsWith('#')) return;
    const idx = t.indexOf('=');
    if (idx < 0) return;
    const key = t.slice(0, idx).trim();
    const val = t.slice(idx + 1).trim();
    if (key && !(key in process.env)) process.env[key] = val;
  });
}

const CFG = {
  username      : process.env.DF_USERNAME       || '',
  apiKey        : process.env.DF_API_KEY        || '',
  webhookSecret : process.env.DF_WEBHOOK_SECRET || '',
  port          : parseInt(process.env.PORT           || '3000', 10),
  retryDelay    : parseInt(process.env.RETRY_DELAY_MS || '2000', 10),
  maxRetry      : parseInt(process.env.MAX_RETRY      || '10',   10),
  cacheTtl      : parseInt(process.env.CACHE_TTL_MIN  || '10',   10) * 60 * 1000,
  baseUrl       : 'https://api.digiflazz.com/v1',
};

if (!CFG.username || !CFG.apiKey) {
  process.stderr.write(JSON.stringify({
    status: 'fatal', message: 'DF_USERNAME dan DF_API_KEY wajib diisi di .env'
  }) + '\n');
  process.exit(1);
}

const md5           = s => crypto.createHash('md5').update(s).digest('hex');
const generateRefId = () => `TRX-${Date.now()}-${Math.random().toString(36).slice(2,7).toUpperCase()}`;
const delay         = ms => new Promise(r => setTimeout(r, ms));

module.exports = { CFG, md5, generateRefId, delay };