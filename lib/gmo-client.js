const EventEmitter = require('events');
const WebSocket = require('ws');

const BASE_URL = 'https://api.coin.z.com/public/v1';
const SYMBOLS_URL = `${BASE_URL}/symbols`;
const TICKER_URL = `${BASE_URL}/ticker`;
const ORDERBOOKS_URL = `${BASE_URL}/orderbooks`;
const WS_URL = 'wss://api.coin.z.com/ws/public/v1';
const DEFAULT_INSTRUMENT_ID = 'BTC-JPY';
const DEFAULT_SYMBOLS = [
  'BTC',
  'ETH',
  'BCH',
  'LTC',
  'XRP',
  'XLM',
  'XTZ',
  'DOT',
  'ATOM',
  'DAI',
  'FCR',
  'ADA',
  'LINK',
  'DOGE',
  'SOL',
  'ASTR',
  'NAC',
  'WILD',
  'SUI',
];

function symbolToInstrumentId(symbol) {
  const text = String(symbol || '').toUpperCase();
  if (!text) return '';
  if (text.includes('_')) return text.replace(/_/g, '-');
  return `${text}-JPY`;
}

function instrumentIdToSymbol(instrumentId) {
  return String(instrumentId || '').toUpperCase().split('-')[0] || '';
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
  const raw = typeof symbolOrRaw === 'string' ? { symbol: symbolOrRaw } : (symbolOrRaw || {});
  const symbol = String(raw.symbol || '').toUpperCase();
  if (!symbol || symbol.includes('_')) return null;

  const instrumentId = symbolToInstrumentId(symbol);
  return {
    instrumentId,
    label: `${symbol}/JPY`,
    baseCurrency: symbol,
    quoteCurrency: 'JPY',
    minSize: raw.minOrderSize || null,
    sizeIncrement: raw.sizeStep || null,
    tickSize: raw.tickSize || null,
    status: 'active',
  };
}

class GMOClient extends EventEmitter {
  constructor(pollIntervalMs = 500, options = {}) {
    super();
    this.pollIntervalMs = pollIntervalMs;
    this.defaultInstrumentId = options.defaultInstrumentId || DEFAULT_INSTRUMENT_ID;
    this.instrumentIds = new Set(DEFAULT_SYMBOLS.map(symbolToInstrumentId));
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
    this.subscriptionQueue = [];
    this.subscriptionTimer = null;
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
    if (this.subscriptionTimer) clearTimeout(this.subscriptionTimer);
    if (this.ws) this.ws.close();
    this.bookTimer = null;
    this.tickerTimer = null;
    this.marketTimer = null;
    this.wsReconnectTimer = null;
    this.subscriptionTimer = null;
    this.ws = null;
    this.wsReady = false;
    this.subscribedInstrumentIds.clear();
    this.subscriptionQueue = [];
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
    const symbols = body && Array.isArray(body.data) ? body.data : [];
    const markets = symbols
      .map(symbolToMarket)
      .filter(Boolean);

    return markets.length > 0 ? markets : DEFAULT_SYMBOLS.map(symbolToMarket).filter(Boolean);
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
      this.subscriptionQueue = [];
      this.emit('connected', 'GMO Coin WebSocket connected');
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
      this.subscriptionQueue = [];
      if (this.subscriptionTimer) clearTimeout(this.subscriptionTimer);
      this.subscriptionTimer = null;
      if (!this.stopped) {
        this.emit('disconnected', 'GMO Coin WebSocket disconnected. REST fallback is active.');
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

    const symbol = instrumentIdToSymbol(instrumentId);
    ['ticker', 'orderbooks'].forEach(channel => {
      this.enqueueSubscription({
        command: 'subscribe',
        channel,
        symbol,
      });
    });
    this.subscribedInstrumentIds.add(instrumentId);
  }

  enqueueSubscription(message) {
    this.subscriptionQueue.push(message);
    this.processSubscriptionQueue();
  }

  processSubscriptionQueue() {
    if (this.subscriptionTimer || !this.wsReady || !this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    const message = this.subscriptionQueue.shift();
    if (!message) return;

    this.ws.send(JSON.stringify(message));
    this.subscriptionTimer = setTimeout(() => {
      this.subscriptionTimer = null;
      this.processSubscriptionQueue();
    }, 1100);
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
    if (text === 'ping') {
      if (this.wsReady && this.ws) this.ws.send('pong');
      return;
    }

    const msg = JSON.parse(text);
    if (msg.error) {
      this.emit('error', msg.error);
      return;
    }

    if (msg.status !== undefined && msg.status !== 0) {
      this.emit('error', msg.messages ? JSON.stringify(msg.messages) : JSON.stringify(msg));
      return;
    }

    if (msg.channel === 'ticker') {
      this.handleTickerMessage(msg);
      return;
    }

    if (msg.channel === 'orderbooks') {
      this.handleBookSnapshot(msg.symbol, msg, 'websocket');
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

  handleBookSnapshot(symbol, data = {}, source) {
    const instrumentId = symbolToInstrumentId(symbol);
    if (!this.activeInstrumentIds.has(instrumentId)) return;

    const state = this.ensureBookState(instrumentId);
    state.asks = this.levelsToMap(data.asks || []);
    state.bids = this.levelsToMap(data.bids || []);
    state.consecutiveErrors = 0;
    state.backoffMs = 0;
    state.lastBookAt = Date.now();
    state.initialized = true;
    this.emit('orderbook', this.buildBookSnapshot(instrumentId, data.timestamp, source));
  }

  handleTickerMessage(data = {}) {
    const instrumentId = symbolToInstrumentId(data.symbol);
    if (!this.activeInstrumentIds.has(instrumentId)) return;
    this.emit('ticker', this.normalizeTicker(instrumentId, data));
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
      if (!this.wsReady || !state.initialized || Date.now() - state.lastBookAt > 10000) {
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
      const symbol = instrumentIdToSymbol(instrumentId);
      const res = await fetch(`${ORDERBOOKS_URL}?symbol=${encodeURIComponent(symbol)}`, {
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

      const body = await res.json();
      if (body.status !== 0) {
        throw new Error(`API status=${body.status}`);
      }

      this.handleBookSnapshot(symbol, {
        ...(body.data || {}),
        timestamp: (body.data && body.data.timestamp) || body.responsetime,
      }, 'rest');
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
      const res = await fetch(`${TICKER_URL}?symbol=${encodeURIComponent(symbol)}`, {
        signal: AbortSignal.timeout(5000),
        headers: { 'Accept': 'application/json' },
      });
      if (!res.ok) return;

      const body = await res.json();
      if (body.status !== 0 || !Array.isArray(body.data) || !body.data[0]) return;

      this.emit('ticker', this.normalizeTicker(instrumentId, body.data[0]));
    } catch (_) {}
  }

  normalizeTicker(instrumentId, data = {}) {
    const last = Number(data.last);
    const baseVolume24h = Number(data.volume);
    const quoteVolume24h = Number.isFinite(last) && Number.isFinite(baseVolume24h)
      ? last * baseVolume24h
      : null;

    return {
      instrument_id: instrumentId,
      last: data.last,
      bestAsk: data.ask,
      bestBid: data.bid,
      high24h: data.high,
      low24h: data.low,
      baseVolume24h: data.volume,
      quoteVolume24h,
      quoteVolume24hEstimated: quoteVolume24h !== null,
      timestamp: normalizeTimestamp(data.timestamp),
    };
  }
}

module.exports = GMOClient;
