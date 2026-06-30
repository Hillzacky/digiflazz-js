'use strict';

const { doTransaction, RC }    = require('./digiflazz');
const { findProducts }         = require('./priceList');
const { generateRefId, delay, CFG } = require('./config');
const logger                   = require('./logger');

const isSuccess  = r => r && r.rc === RC.SUCCESS;
const isPending  = r => r && r.rc === RC.PENDING;
const noRetry    = r => r && RC.NO_RETRY.has(r.rc);

/**
 * Transaksi + auto retry ke seller/produk termurah berikutnya.
 * Return: object JSON terstruktur (tidak ada console.log di sini).
 */
async function transactionWithRetry(keyword, customerNo, opts = {}) {
  const maxRetry   = opts.maxRetry   ?? CFG.maxRetry;
  const retryDelay = opts.retryDelay ?? CFG.retryDelay;

  logger.info('TRANSACTION_START', { keyword, customer_no: customerNo, maxRetry, retryDelay });

  const alternatives = await findProducts(keyword);

  if (alternatives.length === 0) {
    logger.warn('NO_PRODUCT_FOUND', { keyword });
    return {
      success : false,
      message : `Tidak ada produk aktif untuk keyword: "${keyword}"`,
      attempts: [],
    };
  }

  const limit    = Math.min(maxRetry, alternatives.length);
  const attempts = [];

  logger.info('ALTERNATIVES_FOUND', {
    keyword,
    total       : alternatives.length,
    limit,
    alternatives: alternatives.slice(0, limit).map(p => ({
      sku   : p.buyer_sku_code,
      name  : p.product_name,
      price : p.price,
      seller: p.seller_name,
      seller_status: p.seller_product_status,
    })),
  });

  for (let i = 0; i < limit; i++) {
    const product = alternatives[i];
    const refId   = generateRefId();

    const attemptBase = {
      attempt      : i + 1,
      sku          : product.buyer_sku_code,
      product_name : product.product_name,
      seller       : product.seller_name,
      price        : product.price,
      ref_id       : refId,
    };

    // Pre-check seller_product_status dari price list
    if (product.seller_product_status === false) {
      logger.warn('SELLER_GANGGUAN_SKIP', { ...attemptBase });
      attempts.push({ ...attemptBase, success: false, skipped: true, reason: 'seller_product_status=false' });
      continue;
    }

    let result = null;
    try {
      result = await doTransaction(product.buyer_sku_code, customerNo, refId);
    } catch (err) {
      logger.error('TRANSACTION_HTTP_ERROR', { ...attemptBase, error: err.message });
      attempts.push({ ...attemptBase, success: false, error: err.message });
      if (i < limit - 1) await delay(retryDelay);
      continue;
    }

    const attemptLog = {
      ...attemptBase,
      rc      : result.rc,
      status  : result.status,
      message : result.message,
      sn      : result.sn || null,
    };

    // ✅ SUKSES
    if (isSuccess(result)) {
      logger.info('TRANSACTION_SUCCESS', { ...attemptLog });
      attempts.push({ ...attemptLog, success: true });
      return {
        success       : true,
        final_product : { sku: product.buyer_sku_code, name: product.product_name, price: product.price, seller: product.seller_name },
        final_result  : result,
        total_attempts: i + 1,
        attempts,
      };
    }

    // ⏳ PENDING
    if (isPending(result)) {
      logger.warn('TRANSACTION_PENDING', { ...attemptLog });
      attempts.push({ ...attemptLog, success: false, pending: true });
      return {
        success       : false,
        pending       : true,
        final_product : { sku: product.buyer_sku_code, name: product.product_name, price: product.price, seller: product.seller_name },
        final_result  : result,
        total_attempts: i + 1,
        attempts,
      };
    }

    // 🚫 NO-RETRY
    if (noRetry(result)) {
      logger.error('TRANSACTION_NO_RETRY', { ...attemptLog });
      attempts.push({ ...attemptLog, success: false, no_retry: true });
      return {
        success       : false,
        no_retry      : true,
        message       : result.message,
        final_product : { sku: product.buyer_sku_code, name: product.product_name, price: product.price, seller: product.seller_name },
        final_result  : result,
        total_attempts: i + 1,
        attempts,
      };
    }

    // ❌ GAGAL retryable
    logger.warn('TRANSACTION_RETRY', { ...attemptLog, next: i + 2 });
    attempts.push({ ...attemptLog, success: false });
    if (i < limit - 1) await delay(retryDelay);
  }

  logger.error('ALL_ALTERNATIVES_FAILED', { keyword, customer_no: customerNo, total_attempts: limit });
  return {
    success        : false,
    message        : 'Semua alternatif telah dicoba, tidak ada yang berhasil',
    total_attempts : limit,
    attempts,
  };
}

module.exports = { transactionWithRetry };