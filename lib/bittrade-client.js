const EventEmitter = require('events');

const BASE_URL = 'https://api-cloud.bittrade.co.jp';
const SYMBOLS_URL = `${BASE_URL}/v1/common/symbols`;
const DEPTH_URL = `${BASE_URL}/market/depth`;
const TICKERS_URL = `${BASE_URL}/market/tickers`;
const DEFAULT_INSTRUMENT_ID = 'BTC-JPY';
const DEFAULT_SYMBOLS = [
  'BTC-JPY',
  'ETH-JPY',
  'XRP-JPY',
  'ADA-JPY',
  'FLR-JPY',
  'XYM-JPY',
  'OP-JPY',
  'ONT-JPY',
  'BCH-JPY',
  'IOST-JPY',
  'BSV-JPY',
  'TRUMP-JPY',
  'AXS-JPY',
  'DAI-JPY',
  'A-JPY',
  'APT-JPY',
  'MATIC-JPY',
  'SUI-JPY',
  'WBTC-JPY',
  'PEPE-JPY',
  'LINK-JPY',
  'ARB-JPY',
  'SXP-JPY',
  'HBAR-JPY',
  'XLM-JPY',
  'BAT-JPY',
  'TON-JPY',
  'QTUM-JPY',
  'TRX-JPY',
  'DOGE-JPY',
  'LTC-JPY',
  'COT-JPY',
  'BNB-JPY',
  'XTZ-JPY',
  'JOC-JPY',
  'CRTS-JPY',
  'ASTR-JPY',
  'SHIB-JPY',
  'SOL-JPY',
  'SAND-JPY',
  'JASMY-JPY',
  'BOBA-JPY',
  'DOT-JPY',
  'DEP-JPY',
  'ATOM-JPY',
  'UPC-JPY',
  'ETC-JPY',
  'SKY-JPY',
];

function symbolToInstrumentId(symbol, raw = {}) {
  const baseCurrency = String(raw['base-currency'] || '').toUpperCase();
  const quoteCurrency = String(raw['quote-currency'] || '').toUpperCase();
  if (baseCurrency && quoteCurrency) return `${baseCurrency}-${quoteCurrency}`;

  const normalized = String(symbol || '').toUpperCase();
  if (normalized.endsWith('JPY')) return `${normalized.slice(0, -3)}-JPY`;
  return normalized.replace(/([A-Z0-9]+)([A-Z]{3})$/, '$1-$2');
}

function instrumentIdToSymbol(instrumentId) {
  return String(instrumentId || '').toLowerCase().replace(/-/g, '');
}

function decimalIncrement(precision) {
  const digits = Number(precision);
  if (!Number.isInteger(digits) || digits <= 0) return '1';
  return `0.${'0'.repeat(digits - 1)}1`;
}

function normalizeTimestamp(value) {
  if (value == null || value === '') return new Date().toISOString();

  const numeric = Number(value);
  if (Number.isFinite(numeric)) {
    const ms = numeric < 1e12 ? numeric * 1000 : numeric;
    return new Date(ms).toISOString();
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
}

function symbolToMarket(symbolOrRaw) {
  const raw = typeof symbolOrRaw === 'string' ? { symbol: symbolOrRaw, 'quote-currency': 'jpy' } : (symbolOrRaw || {});
  const symbol = String(raw.symbol || '').toLowerCase();
  const instrumentId = symbolToInstrumentId(symbol, raw);
  const [splitBase, splitQuote] = instrumentId.split('-');
  const baseCurrency = String(raw['base-currency'] || splitBase || '').toUpperCase();
  const quoteCurrency = String(raw['quote-currency'] || splitQuote || '').toUpperCase();
  if (!symbol || quoteCurrency !== 'JPY') return null;

  const amountPrecision = raw['amount-precision'];
  const pricePrecision = raw['price-precision'];
  return {
    instrumentId,
    label: `${baseCurrency}/${quoteCurrency}`,
    baseCurrency,
    quoteCurrency,
    minSize: raw['min-order-amt'] || null,
    sizeIncrement: amountPrecision == null ? null : decimalIncrement(amountPrecision),
    tickSize: pricePrecision == null ? null : decimalIncrement(pricePrecision),
    status: raw.state === 'online' || raw.state == null ? 'active' : 'disabled',
  };
}

class BitTradeClient extends EventEmitter {
  constructor(pollIntervalMs = 500, options = {}) {
    super();
    this.pollIntervalMs = pollIntervalMs;
    this.defaultInstrumentId = options.defaultInstrumentId || DEFAULT_INSTRUMENT_ID;
    this.instrumentIds = new Set(DEFAULT_SYMBOLS);
    this.activeInstrumentIds = new Set();
    this.bookStates = new Map();
    this.bookTimer = null;
    this.tickerTimer = null;
    this.marketTimer = null;
    this.tickerCache = null;
    this.tickerCacheAt = 0;
    this.tickerCacheTtlMs = options.tickerCacheTtlMs ?? 15000;
    this.stopped = false;
  }

  async start() {
    this.stopped = false;

    const tryRefresh = async () => {
      if (this.stopped) return;
      try {
        await this.refreshMarkets();
      } catch (err) {
        this.emit('error', `Market list error: ${err.message}`);
      }
    };

    await tryRefresh();
    this.emit('connected', 'BitTrade REST polling active');
    this.activateInstrument(this.defaultInstrumentId);
    this.marketTimer = setInterval(tryRefresh, 300000);
    this.bookTimer = setInterval(() => {
      this.fetchActiveBooks();
    }, Math.max(3000, this.pollIntervalMs));
    this.tickerTimer = setInterval(() => {
      this.fetchActiveTickers();
    }, 5000);
  }

  stop() {
    this.stopped = true;
    if (this.bookTimer) clearInterval(this.bookTimer);
    if (this.tickerTimer) clearInterval(this.tickerTimer);
    if (this.marketTimer) clearInterval(this.marketTimer);
    this.bookTimer = null;
    this.tickerTimer = null;
    this.marketTimer = null;
  }

  async refreshMarkets() {
    const markets = await this.fetchMarkets();
    this.instrumentIds = new Set(markets.map(item => item.instrumentId).filter(Boolean));
    this.emit('instruments', markets);
    return markets;
  }

  async fetchMarkets() {
    const res = await fetch(SYMBOLS_URL, {
      signal: AbortSignal.timeout(10000),
      headers: { 'Accept': 'application/json' },
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    const body = await res.json();
    if (body.status !== 'ok' || !Array.isArray(body.data)) {
      throw new Error('Unexpected BitTrade symbols response');
    }

    const markets = body.data
      .map(symbolToMarket)
      .filter(Boolean)
      .sort((a, b) => {
        if (a.instrumentId === DEFAULT_INSTRUMENT_ID) return -1;
        if (b.instrumentId === DEFAULT_INSTRUMENT_ID) return 1;
        if (a.status !== b.status) return a.status === 'active' ? -1 : 1;
        return a.instrumentId.localeCompare(b.instrumentId);
      });

    return markets.length > 0 ? markets : DEFAULT_SYMBOLS.map(symbolToMarket).filter(Boolean);
  }

  isKnownInstrument(instrumentId) {
    return this.instrumentIds.size === 0 || this.instrumentIds.has(instrumentId);
  }

  activateInstrument(instrumentId) {
    if (!instrumentId || !this.isKnownInstrument(instrumentId)) return false;

    this.activeInstrumentIds.add(instrumentId);
    this.ensureBookState(instrumentId);
    this.fetchBook(instrumentId);
    this.fetchTicker(instrumentId);
    return true;
  }

  ensureBookState(instrumentId) {
    if (!this.bookStates.has(instrumentId)) {
      this.bookStates.set(instrumentId, {
        backoffMs: 0,
        consecutiveErrors: 0,
        fetchingBook: false,
      });
    }

    return this.bookStates.get(instrumentId);
  }

  fetchActiveBooks() {
    for (const instrumentId of this.activeInstrumentIds) {
      this.fetchBook(instrumentId);
    }
  }

  fetchActiveTickers() {
    for (const instrumentId of this.activeInstrumentIds) {
      this.fetchTicker(instrumentId);
    }
  }

  async fetchBook(instrumentId) {
    const state = this.ensureBookState(instrumentId);
    if (state.fetchingBook) return;

    if (state.backoffMs > 0) {
      state.backoffMs = Math.max(0, state.backoffMs - this.pollIntervalMs);
      return;
    }

    state.fetchingBook = true;
    try {
      const url = new URL(DEPTH_URL);
      url.searchParams.set('symbol', instrumentIdToSymbol(instrumentId));
      url.searchParams.set('type', 'step0');
      const res = await fetch(url, {
        signal: AbortSignal.timeout(5000),
        headers: { 'Accept': 'application/json' },
      });

      if (res.status === 429) {
        state.backoffMs = Math.min(30000, Math.max(5000, state.backoffMs * 2 || 5000));
        this.emit('rateLimit', { instrumentId, backoffMs: state.backoffMs });
        return;
      }

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      const body = await res.json();
      if (body.status !== 'ok' || !body.tick) {
        throw new Error(body['err-msg'] || `API status=${body.status}`);
      }

      state.consecutiveErrors = 0;
      state.backoffMs = 0;
      this.emit('orderbook', {
        asks: body.tick.asks || [],
        bids: body.tick.bids || [],
        timestamp: normalizeTimestamp(body.tick.ts || body.ts),
        source: 'rest',
        instrument_id: instrumentId,
      });
    } catch (err) {
      state.consecutiveErrors++;
      if (state.consecutiveErrors >= 5) {
        this.emit('disconnected', err.message);
      } else {
        this.emit('error', err.message);
      }
    } finally {
      state.fetchingBook = false;
    }
  }

  async fetchTickerMap() {
    const now = Date.now();
    if (this.tickerCache && now - this.tickerCacheAt < this.tickerCacheTtlMs) {
      return this.tickerCache;
    }

    const res = await fetch(TICKERS_URL, {
      signal: AbortSignal.timeout(10000),
      headers: { 'Accept': 'application/json' },
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    const body = await res.json();
    if (body.status !== 'ok' || !Array.isArray(body.data)) {
      throw new Error('Unexpected BitTrade tickers response');
    }

    const tickerMap = new Map();
    for (const item of body.data) {
      const instrumentId = symbolToInstrumentId(item.symbol);
      tickerMap.set(instrumentId, {
        item,
        timestamp: body.ts,
      });
    }
    this.tickerCache = tickerMap;
    this.tickerCacheAt = now;
    return tickerMap;
  }

  async fetchTicker(instrumentId) {
    try {
      const tickerMap = await this.fetchTickerMap();
      const tickerEntry = tickerMap.get(instrumentId);
      if (!tickerEntry) return null;

      const ticker = this.normalizeTicker(instrumentId, tickerEntry.item, tickerEntry.timestamp);
      this.emit('ticker', ticker);
      return ticker;
    } catch (_) {
      return null;
    }
  }

  normalizeTicker(instrumentId, data = {}, timestamp = Date.now()) {
    return {
      instrument_id: instrumentId,
      last: data.close,
      open24h: data.open,
      high24h: data.high,
      low24h: data.low,
      bestAsk: data.ask,
      bestBid: data.bid,
      baseVolume24h: data.amount,
      quoteVolume24h: data.vol,
      quoteVolume24hEstimated: false,
      timestamp: normalizeTimestamp(timestamp),
      source: 'rest',
    };
  }
}

BitTradeClient.symbolToInstrumentId = symbolToInstrumentId;
BitTradeClient.instrumentIdToSymbol = instrumentIdToSymbol;
BitTradeClient.symbolToMarket = symbolToMarket;

module.exports = BitTradeClient;
