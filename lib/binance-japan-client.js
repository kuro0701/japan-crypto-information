const EventEmitter = require('events');

const BASE_URL = 'https://api.binance.com/api/v3';
const EXCHANGE_INFO_URL = `${BASE_URL}/exchangeInfo`;
const DEPTH_URL = `${BASE_URL}/depth`;
const TICKER_24H_URL = `${BASE_URL}/ticker/24hr`;
const DEFAULT_INSTRUMENT_ID = 'BTC-JPY';
const DEFAULT_SYMBOLS = [
  'BTCJPY',
  'ETHJPY',
  'BNBJPY',
  'XRPJPY',
  'SOLJPY',
  'ADAJPY',
  'DOGEJPY',
  'SHIBJPY',
  'NEARJPY',
  'POLJPY',
  'APTJPY',
  'SUIJPY',
  'XLMJPY',
  'PEPEJPY',
  'IOTXJPY',
  'SEIJPY',
  'LTCJPY',
  'BCHJPY',
  'LINKJPY',
  'TRXJPY',
  'LPTJPY',
  'TRUMPJPY',
  'FETJPY',
  'TAOJPY',
];

function symbolToInstrumentId(symbol, raw = {}) {
  const baseCurrency = raw.baseAsset || String(symbol || '').replace(/JPY$/, '');
  const quoteCurrency = raw.quoteAsset || 'JPY';
  return `${baseCurrency}-${quoteCurrency}`;
}

function instrumentIdToSymbol(instrumentId) {
  return String(instrumentId || '').toUpperCase().replace(/-/g, '');
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

function getFilter(raw, filterType) {
  return (raw.filters || []).find(filter => filter.filterType === filterType) || {};
}

function symbolToMarket(symbolOrRaw) {
  const raw = typeof symbolOrRaw === 'string' ? { symbol: symbolOrRaw, quoteAsset: 'JPY' } : (symbolOrRaw || {});
  const symbol = String(raw.symbol || '').toUpperCase();
  if (!symbol || raw.quoteAsset !== 'JPY') return null;

  const baseCurrency = raw.baseAsset || symbol.replace(/JPY$/, '');
  const quoteCurrency = raw.quoteAsset || 'JPY';
  const priceFilter = getFilter(raw, 'PRICE_FILTER');
  const lotFilter = getFilter(raw, 'LOT_SIZE');

  return {
    instrumentId: symbolToInstrumentId(symbol, { baseAsset: baseCurrency, quoteAsset: quoteCurrency }),
    label: `${baseCurrency}/${quoteCurrency}`,
    baseCurrency,
    quoteCurrency,
    minSize: lotFilter.minQty || null,
    sizeIncrement: lotFilter.stepSize || null,
    tickSize: priceFilter.tickSize || null,
    status: raw.status === 'TRADING' ? 'active' : 'disabled',
  };
}

class BinanceJapanClient extends EventEmitter {
  constructor(pollIntervalMs = 500, options = {}) {
    super();
    this.pollIntervalMs = pollIntervalMs;
    this.defaultInstrumentId = options.defaultInstrumentId || DEFAULT_INSTRUMENT_ID;
    this.instrumentIds = new Set(DEFAULT_SYMBOLS.map(symbol => symbolToInstrumentId(symbol)));
    this.activeInstrumentIds = new Set();
    this.bookStates = new Map();
    this.bookTimer = null;
    this.tickerTimer = null;
    this.marketTimer = null;
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
    this.emit('connected', 'Binance Japan REST polling active');
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
    const res = await fetch(EXCHANGE_INFO_URL, {
      signal: AbortSignal.timeout(10000),
      headers: { 'Accept': 'application/json' },
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    const body = await res.json();
    const symbols = Array.isArray(body.symbols) ? body.symbols : [];
    const markets = symbols
      .filter(item => item && item.quoteAsset === 'JPY')
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
      const symbol = instrumentIdToSymbol(instrumentId);
      const res = await fetch(`${DEPTH_URL}?symbol=${encodeURIComponent(symbol)}&limit=100`, {
        signal: AbortSignal.timeout(5000),
        headers: { 'Accept': 'application/json' },
      });

      if (res.status === 418 || res.status === 429) {
        state.backoffMs = Math.min(30000, Math.max(5000, state.backoffMs * 2 || 5000));
        this.emit('rateLimit', { instrumentId, backoffMs: state.backoffMs });
        return;
      }

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      const body = await res.json();
      state.consecutiveErrors = 0;
      state.backoffMs = 0;
      this.emit('orderbook', {
        asks: body.asks || [],
        bids: body.bids || [],
        timestamp: new Date().toISOString(),
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

  async fetchTicker(instrumentId) {
    try {
      const symbol = instrumentIdToSymbol(instrumentId);
      const res = await fetch(`${TICKER_24H_URL}?symbol=${encodeURIComponent(symbol)}`, {
        signal: AbortSignal.timeout(5000),
        headers: { 'Accept': 'application/json' },
      });
      if (!res.ok) return null;

      const data = await res.json();
      const ticker = this.normalizeTicker(instrumentId, data);
      this.emit('ticker', ticker);
      return ticker;
    } catch (_) {
      return null;
    }
  }

  normalizeTicker(instrumentId, data = {}) {
    return {
      instrument_id: instrumentId,
      last: data.lastPrice,
      open24h: data.openPrice,
      high24h: data.highPrice,
      low24h: data.lowPrice,
      bestAsk: data.askPrice,
      bestBid: data.bidPrice,
      baseVolume24h: data.volume,
      quoteVolume24h: data.quoteVolume,
      quoteVolume24hEstimated: false,
      timestamp: normalizeTimestamp(data.closeTime),
    };
  }
}

module.exports = BinanceJapanClient;
