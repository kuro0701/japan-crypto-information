const CURRENT_RATE_URL = 'https://coin.z.com/api/v1/master/getCurrentRate.json';

const PRODUCT_META = new Map([
  [1001, { symbol: 'BTC', name: 'ビットコイン' }],
  [1002, { symbol: 'ETH', name: 'イーサリアム' }],
  [1003, { symbol: 'BCH', name: 'ビットコインキャッシュ' }],
  [1004, { symbol: 'LTC', name: 'ライトコイン' }],
  [1005, { symbol: 'XRP', name: 'エックスアールピー' }],
  [1007, { symbol: 'XLM', name: 'ステラルーメン' }],
  [1010, { symbol: 'XTZ', name: 'テゾス' }],
  [1013, { symbol: 'DOT', name: 'ポルカドット' }],
  [1014, { symbol: 'ATOM', name: 'コスモス' }],
  [1016, { symbol: 'DAI', name: 'ダイ' }],
  [1020, { symbol: 'ADA', name: 'カルダノ' }],
  [1021, { symbol: 'LINK', name: 'チェーンリンク' }],
  [1022, { symbol: 'DOGE', name: 'ドージコイン' }],
  [1023, { symbol: 'SOL', name: 'ソラナ' }],
  [1026, { symbol: 'FIL', name: 'ファイルコイン' }],
  [1027, { symbol: 'SAND', name: 'ザ・サンドボックス' }],
  [1028, { symbol: 'CHZ', name: 'チリーズ' }],
  [1030, { symbol: 'AVAX', name: 'アバランチ' }],
  [1032, { symbol: 'SUI', name: 'スイ' }],
]);

function parseNumber(value) {
  const parsed = parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function countDecimals(value) {
  const match = String(value || '').match(/\.(\d+)/);
  return match ? match[1].length : 0;
}

function parseTimestamp(value, fallback = Date.now()) {
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? fallback : parsed;
}

function normalizeRates(payload, capturedAt = Date.now()) {
  if (!payload || !Array.isArray(payload.data)) {
    throw new Error('Unexpected GMO Coin sales rate response');
  }

  const currencies = [];
  for (const item of payload.data) {
    const productId = Number(item && item.productId);
    const meta = PRODUCT_META.get(productId);
    if (!meta) continue;

    const ask = parseNumber(item.ask);
    const bid = parseNumber(item.bid);
    if (ask == null || bid == null) continue;

    currencies.push({
      baseCurrencySymbol: meta.symbol,
      currencyFullName: meta.name,
      buyPrice: ask,
      sellPrice: bid,
      midPrice: (ask + bid) / 2,
      quotePrecision: Math.max(countDecimals(item.ask), countDecimals(item.bid)),
      isOnline: item.bidValidFlag === 1 && item.askValidFlag === 1,
      isWidgetOpen: item.bidValidFlag === 1 && item.askValidFlag === 1,
      createdDate: parseTimestamp(item.createDatetime, capturedAt),
    });
  }

  if (currencies.length === 0) {
    throw new Error('GMO Coin sales rates did not contain spot rates');
  }

  return currencies;
}

class GMOSalesClient {
  constructor(options = {}) {
    this.currentRateUrl = options.currentRateUrl || CURRENT_RATE_URL;
  }

  async fetchCurrencies() {
    const capturedAt = Date.now();
    const res = await fetch(this.currentRateUrl, {
      signal: AbortSignal.timeout(10000),
      headers: {
        'Accept': 'application/json',
        'Accept-Language': 'ja-JP,ja;q=0.9',
        'Referer': 'https://coin.z.com/jp/corp/product/info/spot/',
      },
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    return normalizeRates(await res.json(), capturedAt);
  }
}

GMOSalesClient.normalizeRates = normalizeRates;
GMOSalesClient.PRODUCT_META = PRODUCT_META;

module.exports = GMOSalesClient;
