'use strict';

const https   = require('https');
const { URL } = require('url');
const { CFG, md5 } = require('./config');
const logger  = require('./logger');

/** Generic POST ke Digiflazz — vanilla https */
function post(endpoint, body) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const url     = new URL(CFG.baseUrl + endpoint);

    const options = {
      hostname : url.hostname,
      path     : url.pathname,
      method   : 'POST',
      headers  : {
        'Content-Type'   : 'application/json',
        'Content-Length' : Buffer.byteLength(payload),
      },
    };

    const req = https.request(options, res => {
      let raw = '';
      res.on('data', c => { raw += c; });
      res.on('end', () => {
        try {
          resolve(JSON.parse(raw));
        } catch (e) {
          reject(new Error(`Parse JSON gagal: ${raw}`));
        }
      });
    });

    req.on('error', reject);
    req.setTimeout(30000, () => req.destroy(new Error('Request timeout 30s')));
    req.write(payload);
    req.end();
  });
}

// ── RC Reference (dari dokumentasi resmi Digiflazz) ──────────────────────────
const RC = {
  SUCCESS : '00',
  PENDING : '03',
  RETRYABLE : new Set([
    '01','02','53','55','62','66','68','70','71'
  ]),
  NO_RETRY  : new Set([
    '40','41','42','43','44','45','49',
    '51','52','54','57','80','82','84','85'
  ]),
};

async function getPriceList() {
  const sign = md5(CFG.username + CFG.apiKey + 'pricelist');
  const res  = await post('/price-list', { cmd: 'prepaid', username: CFG.username, sign });
  if (!res.data) throw new Error(`Price list error: ${JSON.stringify(res)}`);
  logger.info('PRICELIST_FETCHED', { count: res.data.length });
  return res.data;
}

async function doTransaction(skuCode, customerNo, refId) {
  const sign = md5(CFG.username + CFG.apiKey + refId);
  const body = { username: CFG.username, buyer_sku_code: skuCode, customer_no: customerNo, ref_id: refId, sign };
  logger.info('TRANSACTION_REQUEST', { sku: skuCode, customer_no: customerNo, ref_id: refId });
  const res  = await post('/transaction', body);
  if (!res.data) throw new Error(`Transaction error: ${JSON.stringify(res)}`);
  logger.info('TRANSACTION_RESPONSE', { ref_id: refId, rc: res.data.rc, status: res.data.status, message: res.data.message, sn: res.data.sn || null });
  return res.data;
}

module.exports = { getPriceList, doTransaction, RC };