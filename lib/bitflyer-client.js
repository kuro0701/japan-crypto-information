const EventEmitter = require('events');
const WebSocket = require('ws');

const BASE_URL = 'https://api.bitflyer.com/v1';
const MARKETS_URL = `${BASE_URL}/getmarkets`;
const WS_URL = 'wss://ws.lightstream.bitflyer.com/json-rpc';
const DEFAULT_INSTRUMENT_ID = 'BTC-JPY';
const DEFAULT_MARKETS = [
  'BTC-JPY',
  'XRP-JPY',
  'ETH-JPY',
  'XLM-JPY',
  'MONA-JPY',
  'ELF-JPY',
];

function productCodeToInstrumentId(productCode) {
  return String(productCode || '').replace(/_/g, '-');
}

function instrumentIdToProductCode(instrumentId) {
  return String(instrumentId || '').replace(/-/g, '_');
}

function normalizeTimestamp(value) {
  if (value == null || value === '') return new Date().toISOString();

  const numeric = Number(value);
  if (Number.isFinite(numeric)) {
    const ms = numeric < 1e12 ? numeric * 1000 : numeric;
    return new Date(ms).toISOString();
  }

  const text = String(value);
  const hasTimezone = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(text);
  const parsed = new Date(hasTimezone ? text : `${text}Z`);
  return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
}

function instrumentIdToMarket(instrumentId, raw = {}) {
  const [baseCurrency, quoteCurrency] = String(instrumentId || '').split('-');
  return {
    instrumentId,
    label: `${baseCurrency}/${quoteCurrency}`,
    baseCurrency,
    quoteCurrency,
    status: raw.market_type === 'Spot' || !raw.market_type ? 'active' : String(raw.market_type).toLowerCase(),
  };
}

function productToMarket(raw = {}) {
  const productCode = raw.product_code;
  const instrumentId = productCodeToInstrumentId(productCode);
  if (!productCode || raw.market_type !== 'Spot' || !instrumentId.endsWith('-JPY')) return null;
  return instrumentIdToMarket(instrumentId, raw);
}

class BitflyerClient extends EventEmitter {
  constructor(pollIntervalMs = 500, options = {}) {
    super();
    this.pollIntervalMs = pollIntervalMs;
    this.defaultInstrumentId = options.defaultInstrumentId || DEFAULT_INSTRUMENT_ID;
    this.instrumentIds = new Set(DEFAULT_MARKETS);
    this.activeInstrumentIds = new Set();
    this.bookStates = new Map();
    this.bookTimer = null;
    this.tickerTimer = null;
    this.marketTimer = null;
    this.ws = null;
    this.wsReconnectTimer = null;
    this.wsReconnectDelay = 1000;
    this.wsReady = false;
    this.stopped = false;
    this.subscribedInstrumentIds = new Set();
    this.subscriptionId = 1;
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
    this.marketTimer = setInterval(tryRefresh, 300000);
    this.connectWebSocket();
    this.activateInstrument(this.defaultInstrumentId);

    this.bookTimer = setInterval(() => {
      this.fetchStaleActiveBooks();
    }, Math.max(5000, this.pollIntervalMs));

    this.tickerTimer = setInterval(() => {
      if (!this.wsReady) this.fetchActiveTickers();
    }, 10000);
  }

  stop() {
    this.stopped = true;
    if (this.bookTimer) clearInterval(this.bookTimer);
    if (this.tickerTimer) clearInterval(this.tickerTimer);
    if (this.marketTimer) clearInterval(this.marketTimer);
    if (this.wsReconnectTimer) clearTimeout(this.wsReconnectTimer);
    if (this.ws) this.ws.close();
    this.bookTimer = null;
    this.tickerTimer = null;
    this.marketTimer = null;
    this.wsReconnectTimer = null;
    this.ws = null;
    this.wsReady = false;
    this.subscribedInstrumentIds.clear();
  }

  async refreshMarkets() {
    const markets = await this.fetchMarkets();
    this.instrumentIds = new Set(markets.map(item => item.instrumentId).filter(Boolean));
    this.emit('instruments', markets);
    return markets;
  }

  async fetchMarkets() {
    const res = await fetch(MARKETS_URL, {
      signal: AbortSignal.timeout(10000),
      headers: { 'Accept': 'application/json' },
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    const data = await res.json();
    const markets = (Array.isArray(data) ? data : [])
      .map(productToMarket)
      .filter(Boolean);

    return markets.length > 0 ? markets : DEFAULT_MARKETS.map(instrumentId => instrumentIdToMarket(instrumentId));
  }

  isKnownInstrument(instrumentId) {
    return this.instrumentIds.size === 0 || this.instrumentIds.has(instrumentId);
  }

  activateInstrument(instrumentId) {
    if (!instrumentId || !this.isKnownInstrument(instrumentId)) return false;

    this.activeInstrumentIds.add(instrumentId);
    this.ensureBookState(instrumentId);

    if (this.wsReady) {
      this.subscribeInstrument(instrumentId);
    }

    this.fetchBook(instrumentId);
    this.fetchTicker(instrumentId);
    return true;
  }

  ensureBookState(instrumentId) {
    if (!this.bookStates.has(instrumentId)) {
      this.bookStates.set(instrumentId, {
        asks: new Map(),
        bids: new Map(),
        lastBookAt: 0,
        backoffMs: 0,
        consecutiveErrors: 0,
        initialized: false,
        fetchingBook: false,
      });
    }

    return this.bookStates.get(instrumentId);
  }

  connectWebSocket() {
    if (this.stopped) return;

    try {
      this.ws = new WebSocket(WS_URL);
    } catch (err) {
      this.scheduleWebSocketReconnect(err.message);
      return;
    }

    this.ws.on('open', () => {
      this.wsReady = true;
      this.wsReconnectDelay = 1000;
      this.subscribedInstrumentIds.clear();
      this.emit('connected', 'bitFlyer WebSocket connected');
      for (const instrumentId of this.activeInstrumentIds) {
        this.subscribeInstrument(instrumentId);
      }
    });

    this.ws.on('message', (data) => {
      try {
        this.handleWebSocketMessage(data);
      } catch (err) {
        this.emit('error', `WebSocket parse error: ${err.message}`);
      }
    });

    this.ws.on('close', () => {
      this.wsReady = false;
      this.subscribedInstrumentIds.clear();
      if (!this.stopped) {
        this.emit('disconnected', 'bitFlyer WebSocket disconnected. REST fallback is active.');
        this.scheduleWebSocketReconnect();
      }
    });

    this.ws.on('error', (err) => {
      this.wsReady = false;
      this.emit('error', `WebSocket error: ${err.message}`);
    });
  }

  subscribeInstrument(instrumentId) {
    if (!this.wsReady || !this.ws || this.subscribedInstrumentIds.has(instrumentId)) return;

    const productCode = instrumentIdToProductCode(instrumentId);
    [
      `lightning_board_snapshot_${productCode}`,
      `lightning_board_${productCode}`,
      `lightning_ticker_${productCode}`,
    ].forEach(channel => {
      this.ws.send(JSON.stringify({
        jsonrpc: '2.0',
        method: 'subscribe',
        params: { channel },
        id: this.subscriptionId++,
      }));
    });
    this.subscribedInstrumentIds.add(instrumentId);
  }

  scheduleWebSocketReconnect(reason) {
    if (this.stopped || this.wsReconnectTimer) return;
    if (reason) this.emit('error', reason);

    const delay = this.wsReconnectDelay;
    this.wsReconnectTimer = setTimeout(() => {
      this.wsReconnectTimer = null;
      this.wsReconnectDelay = Math.min(this.wsReconnectDelay * 2, 30000);
      this.connectWebSocket();
    }, delay);
  }

  handleWebSocketMessage(data) {
    const text = Buffer.isBuffer(data) ? data.toString('utf8') : String(data);
    const msg = JSON.parse(text);

    if (msg.error) {
      this.emit('error', msg.error.message || JSON.stringify(msg.error));
      return;
    }

    if (msg.result !== undefined) {
      this.emit('status', msg);
      return;
    }

    if (msg.method !== 'channelMessage' || !msg.params) return;

    const channel = msg.params.channel || '';
    const message = msg.params.message;
    if (!message || typeof message !== 'object') return;

    if (channel.startsWith('lightning_ticker_')) {
      this.handleTickerMessage(message);
      return;
    }

    if (channel.startsWith('lightning_board_snapshot_')) {
      const productCode = channel.slice('lightning_board_snapshot_'.length);
      this.handleBookSnapshot(productCode, message, 'websocket');
      return;
    }

    if (channel.startsWith('lightning_board_')) {
      const productCode = channel.slice('lightning_board_'.length);
      this.handleBookDelta(productCode, message);
    }
  }

  levelsToMap(levels) {
    const map = new Map();
    for (const level of levels) {
      const parsed = this.normalizeLevel(level);
      if (parsed) map.set(parsed[0], parsed);
    }
    return map;
  }

  applyLevelUpdates(map, levels) {
    for (const level of levels) {
      const parsed = this.normalizeLevel(level);
      if (!parsed) continue;

      if (parseFloat(parsed[1]) <= 0) {
        map.delete(parsed[0]);
      } else {
        map.set(parsed[0], parsed);
      }
    }
  }

  normalizeLevel(level) {
    if (!level || typeof level !== 'object') return null;

    const rawPrice = Array.isArray(level) ? level[0] : level.price;
    const rawQuantity = Array.isArray(level) ? level[1] : level.size;
    const price = String(rawPrice);
    const quantity = String(rawQuantity);

    if (
      !Number.isFinite(parseFloat(price))
      || !Number.isFinite(parseFloat(quantity))
      || parseFloat(price) <= 0
    ) {
      return null;
    }

    return [price, quantity, '0'];
  }

  handleBookSnapshot(productCode, data, source) {
    const instrumentId = productCodeToInstrumentId(productCode);
    if (!this.activeInstrumentIds.has(instrumentId)) return;

    const state = this.ensureBookState(instrumentId);
    state.asks = this.levelsToMap(data.asks || []);
    state.bids = this.levelsToMap(data.bids || []);
    state.consecutiveErrors = 0;
    state.backoffMs = 0;
    state.lastBookAt = Date.now();
    state.initialized = true;
    this.emit('orderbook', this.buildBookSnapshot(instrumentId, new Date().toISOString(), source));
  }

  handleBookDelta(productCode, data) {
    const instrumentId = productCodeToInstrumentId(productCode);
    if (!this.activeInstrumentIds.has(instrumentId)) return;

    const state = this.ensureBookState(instrumentId);
    if (!state.initialized) {
      if (!state.fetchingBook) this.fetchBook(instrumentId);
      return;
    }

    this.applyLevelUpdates(state.asks, data.asks || []);
    this.applyLevelUpdates(state.bids, data.bids || []);
    state.lastBookAt = Date.now();
    state.consecutiveErrors = 0;
    this.emit('orderbook', this.buildBookSnapshot(instrumentId, new Date().toISOString(), 'websocket'));
  }

  handleTickerMessage(data) {
    const instrumentId = productCodeToInstrumentId(data.product_code);
    if (!this.activeInstrumentIds.has(instrumentId)) return;
    this.emit('ticker', this.normalizeTicker(data));
  }

  buildBookSnapshot(instrumentId, timestamp, source) {
    const state = this.ensureBookState(instrumentId);
    const asks = Array.from(state.asks.values())
      .sort((a, b) => parseFloat(a[0]) - parseFloat(b[0]))
      .slice(0, 200);
    const bids = Array.from(state.bids.values())
      .sort((a, b) => parseFloat(b[0]) - parseFloat(a[0]))
      .slice(0, 200);

    return {
      instrument_id: instrumentId,
      asks,
      bids,
      timestamp: normalizeTimestamp(timestamp),
      source,
    };
  }

  fetchStaleActiveBooks() {
    for (const instrumentId of this.activeInstrumentIds) {
      const state = this.ensureBookState(instrumentId);
      if (state.fetchingBook) continue;
      if (!this.wsReady || !state.initialized || Date.now() - state.lastBookAt > 5000) {
        this.fetchBook(instrumentId);
      }
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
      const productCode = instrumentIdToProductCode(instrumentId);
      const res = await fetch(`${BASE_URL}/getboard?product_code=${encodeURIComponent(productCode)}`, {
        signal: AbortSignal.timeout(5000),
        headers: { 'Accept': 'application/json' },
      });

      if (res.status === 429) {
        state.backoffMs = Math.min(15000, Math.max(3000, state.backoffMs * 2 || 3000));
        this.emit('rateLimit', { instrumentId, backoffMs: state.backoffMs });
        return;
      }

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      const data = await res.json();
      this.handleBookSnapshot(productCode, data, 'rest');
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
      const productCode = instrumentIdToProductCode(instrumentId);
      const res = await fetch(`${BASE_URL}/getticker?product_code=${encodeURIComponent(productCode)}`, {
        signal: AbortSignal.timeout(5000),
        headers: { 'Accept': 'application/json' },
      });
      if (!res.ok) return;

      const data = await res.json();
      this.emit('ticker', this.normalizeTicker(data));
    } catch (_) {}
  }

  normalizeTicker(data = {}) {
    const instrumentId = productCodeToInstrumentId(data.product_code);
    const last = Number(data.ltp);
    const baseVolume24h = Number(data.volume_by_product ?? data.volume);
    const quoteVolume24h = Number.isFinite(last) && Number.isFinite(baseVolume24h)
      ? last * baseVolume24h
      : null;

    return {
      instrument_id: instrumentId,
      last: data.ltp,
      baseVolume24h: data.volume_by_product ?? data.volume,
      quoteVolume24h,
      quoteVolume24hEstimated: quoteVolume24h !== null,
      timestamp: normalizeTimestamp(data.timestamp),
    };
  }
}

module.exports = BitflyerClient;
