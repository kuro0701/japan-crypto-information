const DEALER_FEED_URL = 'https://public.bitbank.cc/dealer/feed';

function parseNumber(value) {
  const parsed = parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function countDecimals(value) {
  const match = String(value || '').match(/\.(\d+)/);
  return match ? match[1].length : 0;
}

function normalizeAsset(value) {
  return String(value || '').trim().toUpperCase();
}

function normalizeFeed(payload, capturedAt = Date.now()) {
  if (!payload || payload.success !== 1 || !payload.data || !Array.isArray(payload.data.prices)) {
    throw new Error('Unexpected bitbank dealer feed response');
  }

  const settingsByAsset = new Map();
  for (const setting of payload.data.settings || []) {
    const asset = normalizeAsset(setting.asset);
    if (asset) settingsByAsset.set(asset, setting);
  }

  const currencies = [];
  for (const item of payload.data.prices) {
    const symbol = normalizeAsset(item.asset);
    const ask = parseNumber(item.ask);
    const bid = parseNumber(item.bid);
    if (!symbol || ask == null || bid == null) continue;

    const setting = settingsByAsset.get(symbol) || {};
    currencies.push({
      baseCurrencySymbol: symbol,
      currencyFullName: symbol,
      buyPrice: ask,
      sellPrice: bid,
      midPrice: (ask + bid) / 2,
      quotePrecision: Math.max(countDecimals(item.ask), countDecimals(item.bid)),
      isOnline: true,
      isWidgetOpen: true,
      createdDate: capturedAt,
      maxOrderAmount: setting.maxOrderAmount || null,
    });
  }

  if (currencies.length === 0) {
    throw new Error('bitbank dealer feed did not contain rates');
  }

  return currencies;
}

class BitbankSalesClient {
  constructor(options = {}) {
    this.feedUrl = options.feedUrl || DEALER_FEED_URL;
  }

  async fetchCurrencies() {
    const capturedAt = Date.now();
    const res = await fetch(this.feedUrl, {
      signal: AbortSignal.timeout(10000),
      headers: { 'Accept': 'application/json' },
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    return normalizeFeed(await res.json(), capturedAt);
  }
}

BitbankSalesClient.normalizeFeed = normalizeFeed;

module.exports = BitbankSalesClient;
