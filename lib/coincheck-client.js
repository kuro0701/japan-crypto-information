const EventEmitter = require('events');
const WebSocket = require('ws');

const BASE_URL = 'https://coincheck.com/api';
const EXCHANGE_STATUS_URL = `${BASE_URL}/exchange_status`;
const WS_URL = 'wss://ws-api.coincheck.com';
const DEFAULT_INSTRUMENT_ID = 'BTC-JPY';
const DEFAULT_PAIRS = [
  'btc_jpy',
  'eth_jpy',
  'etc_jpy',
  'lsk_jpy',
  'xrp_jpy',
  'xem_jpy',
  'bch_jpy',
  'mona_jpy',
  'iost_jpy',
  'chz_jpy',
  'imx_jpy',
  'shib_jpy',
  'avax_jpy',
  'fnct_jpy',
  'dai_jpy',
  'wbtc_jpy',
  'bril_jpy',
  'bc_jpy',
  'doge_jpy',
  'pepe_jpy',
  'mask_jpy',
  'mana_jpy',
  'trx_jpy',
  'grt_jpy',
  'sol_jpy',
  'fpl_jpy',
];

function pairToInstrumentId(pair) {
  return String(pair || '').toUpperCase().replace('_', '-');
}

function instrumentIdToPair(instrumentId) {
  return String(instrumentId || '').toLowerCase().replace('-', '_');
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

function pairToMarket(pair, rawStatus = {}) {
  const instrumentId = pairToInstrumentId(pair);
  const [baseCurrency, quoteCurrency] = instrumentId.split('-');
  const marketStatus = rawStatus.status === 'available' || !rawStatus.status ? 'active' : rawStatus.status;

  return {
    instrumentId,
    label: `${baseCurrency}/${quoteCurrency}`,
    baseCurrency,
    quoteCurrency,
    status: marketStatus,
  };
}

class CoincheckClient extends EventEmitter {
  constructor(pollIntervalMs = 500, options = {}) {
    super();
    this.pollIntervalMs = pollIntervalMs;
    this.defaultInstrumentId = options.defaultInstrumentId || DEFAULT_INSTRUMENT_ID;
    this.instrumentIds = new Set(DEFAULT_PAIRS.map(pairToInstrumentId));
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
    this.marketTimer = setInterval(tryRefresh, 60000);
    this.connectWebSocket();
    this.activateInstrument(this.defaultInstrumentId);

    this.bookTimer = setInterval(() => {
      this.fetchStaleActiveBooks();
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
    const res = await fetch(EXCHANGE_STATUS_URL, {
      signal: AbortSignal.timeout(10000),
      headers: { 'Accept': 'application/json' },
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    const data = await res.json();
    const statuses = Array.isArray(data.exchange_status) ? data.exchange_status : [];
    const markets = statuses
      .filter(item => item && item.pair)
      .map(item => pairToMarket(item.pair, item));

    return markets.length > 0 ? markets : DEFAULT_PAIRS.map(pair => pairToMarket(pair));
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
      this.emit('connected', 'Coincheck WebSocket connected');
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
        this.emit('disconnected', 'Coincheck WebSocket disconnected. REST fallback is active.');
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

    const pair = instrumentIdToPair(instrumentId);
    this.ws.send(JSON.stringify({
      type: 'subscribe',
      channel: `${pair}-orderbook`,
    }));
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
    if (!Array.isArray(msg) || msg.length < 2) return;

    const [pair, update] = msg;
    if (!update || typeof update !== 'object') return;

    const instrumentId = pairToInstrumentId(pair);
    if (!this.activeInstrumentIds.has(instrumentId)) return;

    const state = this.ensureBookState(instrumentId);
    if (!state.initialized) {
      this.fetchBook(instrumentId);
      return;
    }

    this.applyLevelUpdates(state.asks, update.asks || []);
    this.applyLevelUpdates(state.bids, update.bids || []);
    state.lastBookAt = Date.now();
    state.consecutiveErrors = 0;
    this.emit('orderbook', this.buildBookSnapshot(instrumentId, update.last_update_at, 'websocket'));
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
    if (!Array.isArray(level) || level.length < 2) return null;
    const price = String(level[0]);
    const quantity = String(level[1]);

    if (!Number.isFinite(parseFloat(price)) || !Number.isFinite(parseFloat(quantity))) {
      return null;
    }

    return [price, quantity, '0'];
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
      if (!this.wsReady || Date.now() - state.lastBookAt > 3000) {
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
    if (state.backoffMs > 0) {
      state.backoffMs = Math.max(0, state.backoffMs - this.pollIntervalMs);
      return;
    }

    try {
      const pair = instrumentIdToPair(instrumentId);
      const res = await fetch(`${BASE_URL}/order_books?pair=${encodeURIComponent(pair)}`, {
        signal: AbortSignal.timeout(5000),
        headers: { 'Accept': 'application/json' },
      });

      if (res.status === 429) {
        state.backoffMs = Math.min(8000, Math.max(1000, state.backoffMs * 2 || 1000));
        this.emit('rateLimit', { instrumentId, backoffMs: state.backoffMs });
        return;
      }

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      const data = await res.json();
      state.asks = this.levelsToMap(data.asks || []);
      state.bids = this.levelsToMap(data.bids || []);
      state.consecutiveErrors = 0;
      state.backoffMs = 0;
      state.lastBookAt = Date.now();
      state.initialized = true;
      this.emit('orderbook', this.buildBookSnapshot(instrumentId, new Date().toISOString(), 'rest'));
    } catch (err) {
      state.consecutiveErrors++;
      if (state.consecutiveErrors >= 5) {
        this.emit('disconnected', err.message);
      } else {
        this.emit('error', err.message);
      }
    }
  }

  async fetchTicker(instrumentId) {
    try {
      const pair = instrumentIdToPair(instrumentId);
      const res = await fetch(`${BASE_URL}/ticker?pair=${encodeURIComponent(pair)}`, {
        signal: AbortSignal.timeout(5000),
        headers: { 'Accept': 'application/json' },
      });
      if (!res.ok) return;

      const data = await res.json();
      const last = Number(data.last);
      const baseVolume24h = Number(data.volume);
      const quoteVolume24h = Number.isFinite(last) && Number.isFinite(baseVolume24h)
        ? last * baseVolume24h
        : null;

      this.emit('ticker', {
        instrument_id: instrumentId,
        last: data.last,
        high24h: data.high,
        low24h: data.low,
        baseVolume24h: data.volume,
        quoteVolume24h,
        quoteVolume24hEstimated: quoteVolume24h !== null,
        timestamp: normalizeTimestamp(data.timestamp),
      });
    } catch (_) {}
  }
}

module.exports = CoincheckClient;
