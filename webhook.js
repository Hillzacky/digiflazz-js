'use strict';

const crypto = require('crypto');
const { CFG } = require('./config');
const logger  = require('./logger');

/**
 * Verifikasi signature webhook Digiflazz.
 * Header: X-Hub-Signature: sha1=<hmac>
 */
function verifySignature(rawBody, signatureHeader) {
  if (!CFG.webhookSecret) return true; // skip jika secret tidak diset
  if (!signatureHeader)   return false;
  const computed = 'sha1=' + crypto.createHmac('sha1', CFG.webhookSecret).update(rawBody).digest('hex');
  // timing-safe compare
  try {
    return crypto.timingSafeEqual(Buffer.from(signatureHeader), Buffer.from(computed));
  } catch (_) {
    return false;
  }
}

/**
 * Handler webhook Digiflazz.
 * Dipanggil dari router setelah raw body dikumpulkan.
 */
function handleWebhook(rawBody, headers, res) {
  const sigHeader = headers['x-hub-signature'] || '';
  const event     = headers['x-digiflazz-event'] || 'unknown';
  const userAgent = headers['user-agent'] || '';

  // Deteksi tipe transaksi dari User-Agent
  let trxType = 'prepaid';
  if (userAgent.includes('Pasca'))  trxType = 'postpaid';
  if (userAgent.includes('Hotel'))  trxType = 'hotel';

  // Verifikasi signature
  if (!verifySignature(rawBody, sigHeader)) {
    logger.warn('WEBHOOK_INVALID_SIGNATURE', { event, user_agent: userAgent });
    return sendJson(res, 403, { status: 'error', message: 'Invalid signature' });
  }

  // Parse body
  let payload;
  try {
    payload = JSON.parse(rawBody);
  } catch (e) {
    logger.error('WEBHOOK_PARSE_ERROR', { error: e.message });
    return sendJson(res, 400, { status: 'error', message: 'Invalid JSON body' });
  }

  // Handle ping event
  if (event === 'ping' || payload.sed) {
    logger.info('WEBHOOK_PING', { hook_id: payload.hook_id });
    return sendJson(res, 200, { status: 'ok', event: 'ping' });
  }

  const data = payload.data;
  if (!data) {
    logger.warn('WEBHOOK_NO_DATA', { event, payload });
    return sendJson(res, 400, { status: 'error', message: 'Payload data kosong' });
  }

  logger.info('WEBHOOK_RECEIVED', {
    event,
    trx_type    : trxType,
    ref_id      : data.ref_id       || null,
    status      : data.status       || null,
    rc          : data.rc           || null,
    message     : data.message      || null,
    sn          : data.sn           || null,
    buyer_sku   : data.buyer_sku_code || null,
    customer_no : data.customer_no  || null,
    price       : data.price        || null,
    saldo_akhir : data.buyer_last_saldo || null,
  });

  // ── Aksi berdasarkan status ───────────────────────────────────────────────
  const status = (data.status || '').toLowerCase();

  if (status === 'sukses') {
    logger.info('WEBHOOK_TRX_SUCCESS', { ref_id: data.ref_id, sn: data.sn });
    // TODO: update database, kirim notifikasi ke customer, dll.
  } else if (status === 'gagal') {
    logger.warn('WEBHOOK_TRX_FAILED', { ref_id: data.ref_id, rc: data.rc, message: data.message });
    // TODO: refund, notifikasi, dll.
  } else if (status === 'pending') {
    logger.warn('WEBHOOK_TRX_PENDING', { ref_id: data.ref_id });
    // TODO: simpan ke antrian monitoring.
  }

  return sendJson(res, 200, { status: 'ok', event, trx_type: trxType, received: data });
}

function sendJson(res, code, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(code, { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) });
  res.end(body);
}

module.exports = { handleWebhook };