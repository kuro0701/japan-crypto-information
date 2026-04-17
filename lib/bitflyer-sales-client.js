const CONFIG_URL = 'https://bitflyer.com/api/web/config/with-auth';
const PRICE_URL = 'https://bitflyer.com/api/app/market/price2';
const REQUEST_DELAY_MS = 40;

function parseNumber(value) {
  const parsed = parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function countDecimals(value) {
  const match = String(value || '').replace(/,/g, '').match(/\.(\d+)/);
  return match ? match[1].length : 0;
}

function productCodeToInstrumentId(productCode) {
  return String(productCode || '').replace(/_/g, '-');
}

function normalizeConfig(payload) {
  const data = payload && payload.data ? payload.data : payload;
  if (!data || !Array.isArray(data.currencies) || !Array.isArray(data.marketplaces)) {
    throw new Error('Unexpected bitFlyer sales config response');
  }

  const currenciesByCode = new Map(data.currencies.map(currency => [currency.code, currency]));
  return data.marketplaces
    .filter(market => market.sub_currency === 'JPY')
    .map((market) => {
      const baseCurrency = currenciesByCode.get(market.base_currency) || {};
      const decimalPlace = market.decimal_place || {};
      return {
        productCode: market.code,
        instrumentId: productCodeToInstrumentId(market.code),
        baseCurrencySymbol: market.base_currency,
        currencyFullName: baseCurrency.name || baseCurrency.symbol || market.base_currency,
        quotePrecision: Number.isFinite(Number(decimalPlace.max)) ? Number(decimalPlace.max) : null,
      };
    })
    .filter(market => market.productCode && market.baseCurrencySymbol);
}

function normalizePrice(market, payload, capturedAt = Date.now()) {
  const data = payload && payload.data ? payload.data : payload;
  if (!data) return null;

  const ask = parseNumber(data.ask);
  const bid = parseNumber(data.bid);
  const mid = parseNumber(data.mid);
  if (ask == null || bid == null) return null;

  return {
    baseCurrencySymbol: market.baseCurrencySymbol,
    currencyFullName: market.currencyFullName,
    buyPrice: ask,
    sellPrice: bid,
    midPrice: mid != null ? mid : (ask + bid) / 2,
    quotePrecision: market.quotePrecision != null
      ? market.quotePrecision
      : Math.max(countDecimals(data.ask_str || data.ask), countDecimals(data.bid_str || data.bid)),
    isOnline: data.enable_bid === true && data.enable_ask === true,
    isWidgetOpen: data.enable_bid === true && data.enable_ask === true,
    createdDate: capturedAt,
  };
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

class BitflyerSalesClient {
  constructor(options = {}) {
    this.configUrl = options.configUrl || CONFIG_URL;
    this.priceUrl = options.priceUrl || PRICE_URL;
    this.requestDelayMs = options.requestDelayMs ?? REQUEST_DELAY_MS;
  }

  async fetchJson(url) {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(10000),
      headers: {
        'Accept': 'application/json',
        'Accept-Language': 'ja-JP,ja;q=0.9',
        'Cookie': 'language=ja-JP; region=JP',
        'Referer': 'https://bitflyer.com/ja-jp/ex/buysell/btc',
      },
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    return res.json();
  }

  async fetchMarkets() {
    const payload = await this.fetchJson(this.configUrl);
    const markets = normalizeConfig(payload);
    if (markets.length === 0) {
      throw new Error('bitFlyer sales config did not contain JPY marketplaces');
    }
    return markets;
  }

  async fetchCurrencies() {
    const markets = await this.fetchMarkets();
    const currencies = [];
    const errors = [];

    for (const market of markets) {
      try {
        const url = new URL(this.priceUrl);
        url.searchParams.set('product_code', market.productCode);
        const record = normalizePrice(market, await this.fetchJson(url), Date.now());
        if (record) currencies.push(record);
      } catch (err) {
        errors.push(`${market.productCode}: ${err.message}`);
      }

      if (this.requestDelayMs > 0) await sleep(this.requestDelayMs);
    }

    if (currencies.length === 0) {
      throw new Error(errors.length > 0
        ? `bitFlyer sales prices were not available (${errors.join(', ')})`
        : 'bitFlyer sales prices did not contain rates');
    }

    return currencies;
  }
}

BitflyerSalesClient.normalizeConfig = normalizeConfig;
BitflyerSalesClient.normalizePrice = normalizePrice;

module.exports = BitflyerSalesClient;
