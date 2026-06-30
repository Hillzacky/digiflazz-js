'use strict';

const { transactionWithRetry }      = require('./transaction');
const { fetchPriceList, findProducts, findBySku } = require('./priceList');
const { handleWebhook }             = require('./webhook');
const logger                        = require('./logger');

function sendJson(res, code, obj) {
  const body = JSON.stringify(obj, null, 0);
  res.writeHead(code, { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) });
  res.end(body);
}

/** Kumpulkan raw body dari request */
function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', c => chunks.push(c));
    req.on('end',  () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

/** Parse query string sederhana */
function parseQuery(url) {
  const idx = url.indexOf('?');
  if (idx < 0) return {};
  return Object.fromEntries(new URLSearchParams(url.slice(idx + 1)));
}

async function route(req, res) {
  const method = req.method.toUpperCase();
  const url    = req.url.split('?')[0].replace(/\/+$/, '') || '/';

  logger.info('HTTP_REQUEST', { method, url });

  try {

    // ── GET /health ─────────────────────────────────────────────────────────
    if (method === 'GET' && url === '/health') {
      return sendJson(res, 200, { status: 'ok', timestamp: new Date().toISOString() });
    }

    // ── GET /price-list ─────────────────────────────────────────────────────
    // Query: ?refresh=true
    if (method === 'GET' && url === '/price-list') {
      const q       = parseQuery(req.url);
      const force   = q.refresh === 'true';
      const list    = await fetchPriceList(force);
      return sendJson(res, 200, { status: 'ok', count: list.length, data: list });
    }

    // ── GET /price-list/search ──────────────────────────────────────────────
    // Query: ?keyword=XL10&active=true
    if (method === 'GET' && url === '/price-list/search') {
      const q       = parseQuery(req.url);
      if (!q.keyword) return sendJson(res, 400, { status: 'error', message: 'Query ?keyword= wajib diisi' });
      const active  = q.active !== 'false';
      const results = await findProducts(q.keyword, active);
      return sendJson(res, 200, { status: 'ok', keyword: q.keyword, count: results.length, data: results });
    }

    // ── GET /price-list/:sku ────────────────────────────────────────────────
    if (method === 'GET' && url.startsWith('/price-list/')) {
      const sku     = url.replace('/price-list/', '');
      const product = await findBySku(sku);
      if (!product) return sendJson(res, 404, { status: 'error', message: `SKU "${sku}" tidak ditemukan` });
      return sendJson(res, 200, { status: 'ok', data: product });
    }

    // ── POST /transaction ───────────────────────────────────────────────────
    // Body: { "keyword": "XL 10.000", "customer_no": "08161234567", "max_retry": 5, "retry_delay": 2000 }
    if (method === 'POST' && url === '/transaction') {
      const raw  = await readBody(req);
      let body;
      try { body = JSON.parse(raw); } catch { return sendJson(res, 400, { status: 'error', message: 'Invalid JSON body' }); }

      const { keyword, customer_no, max_retry, retry_delay } = body;
      if (!keyword)     return sendJson(res, 400, { status: 'error', message: 'Field "keyword" wajib diisi' });
      if (!customer_no) return sendJson(res, 400, { status: 'error', message: 'Field "customer_no" wajib diisi' });

      const result = await transactionWithRetry(keyword, customer_no, {
        maxRetry   : max_retry   ?? undefined,
        retryDelay : retry_delay ?? undefined,
      });

      const httpCode = result.success ? 200 : result.pending ? 202 : 422;
      return sendJson(res, httpCode, { status: result.success ? 'ok' : result.pending ? 'pending' : 'error', ...result });
    }

    // ── POST /webhook ───────────────────────────────────────────────────────
    if (method === 'POST' && url === '/webhook') {
      const rawBuf = await readBody(req);
      return handleWebhook(rawBuf.toString('utf8'), req.headers, res);
    }

    // ── 404 ─────────────────────────────────────────────────────────────────
    return sendJson(res, 404, { status: 'error', message: `Route ${method} ${url} tidak ditemukan` });

  } catch (err) {
    logger.error('UNHANDLED_ERROR', { method, url, error: err.message, stack: err.stack });
    return sendJson(res, 500, { status: 'error', message: 'Internal server error', detail: err.message });
  }
}

module.exports = { route };