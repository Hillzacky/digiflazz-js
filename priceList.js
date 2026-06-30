'use strict';

const { getPriceList }   = require('./digiflazz');
const { CFG }            = require('./config');
const logger             = require('./logger');

let _cache     = [];
let _lastFetch = 0;

async function fetchPriceList(forceRefresh = false) {
  const now = Date.now();
  if (!forceRefresh && _cache.length && (now - _lastFetch) < CFG.cacheTtl) {
    logger.info('PRICELIST_CACHE_HIT', { count: _cache.length });
    return _cache;
  }
  logger.info('PRICELIST_CACHE_MISS', {});
  _cache     = await getPriceList();
  _lastFetch = now;
  return _cache;
}

/**
 * Cari produk cocok → sortir termurah.
 * Jika harga sama: seller aktif (seller_product_status=true) didahulukan.
 */
async function findProducts(keyword, activeOnly = true) {
  const list = await fetchPriceList();
  const kw   = keyword.toLowerCase();

  const filtered = list.filter(p => {
    const match =
      p.buyer_sku_code.toLowerCase().includes(kw) ||
      p.product_name.toLowerCase().includes(kw)   ||
      (p.brand    && p.brand.toLowerCase().includes(kw))    ||
      (p.category && p.category.toLowerCase().includes(kw));
    const active = activeOnly ? p.buyer_product_status === true : true;
    return match && active;
  });

  return filtered.sort((a, b) => {
    if (a.price !== b.price) return a.price - b.price;
    return (b.seller_product_status ? 1 : 0) - (a.seller_product_status ? 1 : 0);
  });
}

async function findBySku(sku) {
  const list = await fetchPriceList();
  return list.find(p => p.buyer_sku_code === sku) || null;
}

module.exports = { fetchPriceList, findProducts, findBySku };