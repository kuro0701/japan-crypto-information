const EventEmitter = require('events');
const WebSocket = require('ws');

const PUBLIC_BASE_URL = 'https://public.bitbank.cc';
const PAIRS_URL = 'https://api.bitbank.cc/v1/spot/pairs';
const WS_URL = 'wss://stream.bitbank.cc/socket.io/?EIO=4&transport=websocket';
const DEFAULT_INSTRUMENT_ID = 'BTC-JPY';
const DEFAULT_PAIRS = [
  'btc_jpy',
  'xrp_jpy',
  'eth_jpy',
  'sol_jpy',
  'dot_jpy',
  'doge_jpy',
  'ltc_jpy',
  'bcc_jpy',
  'mona_jpy',
  'xlm_jpy',
  'qtum_jpy',
  'bat_jpy',
  'omg_jpy',
  'xym_jpy',
  'link_jpy',
  'mkr_jpy',
  'boba_jpy',
  'enj_jpy',
  'astr_jpy',
  'ada_jpy',
  'avax_jpy',
  'axs_jpy',
  'flr_jpy',
  'sand_jpy',
  'gala_jpy',
  'chz_jpy',
  'ape_jpy',
  'oas_jpy',
  'mana_jpy',
  'grt_jpy',
  'rndr_jpy',
  'bnb_jpy',
  'dai_jpy',
  'op_jpy',
  'arb_jpy',
  'klay_jpy',
  'imx_jpy',
  'mask_jpy',
  'pol_jpy',
  'cyber_jpy',
  'render_jpy',
  'trx_jpy',
  'lpt_jpy',
  'atom_jpy',
  'sui_jpy',
  'sky_jpy',
  'matic_jpy',
];

function pairToInstrumentId(pair) {
  return String(pair || '').toUpperCase().replace(/_/g, '-');
}

function instrumentIdToPair(instrumentId) {
  return String(instrumentId || '').toLowerCase().replace(/-/g, '_');
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

function priceIncrement(priceDigits) {
  const digits = Number(priceDigits);
  if (!Number.isInteger(digits) || digits <= 0) return '1';
  return `0.${'0'.repeat(digits - 1)}1`;
}

function pairToMarket(pairOrRaw) {
  const raw = typeof pairOrRaw === 'string' ? { name: pairOrRaw } : (pairOrRaw || {});
  const pair = raw.name || raw.pair;
  const instrumentId = pairToInstrumentId(pair);
  const [splitBase, splitQuote] = instrumentId.split('-');
  const baseCurrency = String(raw.base_asset || splitBase || '').toUpperCase();
  const quoteCurrency = String(raw.quote_asset || splitQuote || '').toUpperCase();

  if (!instrumentId || quoteCurrency !== 'JPY') return null;

  return {
    instrumentId,
    label: `${baseCurrency}/${quoteCurrency}`,
    baseCurrency,
    quoteCurrency,
    minSize: raw.unit_amount || null,
    sizeIncrement: raw.unit_amount || null,
    tickSize: raw.price_digits == null ? null : priceIncrement(raw.price_digits),
    status: raw.is_enabled === false ? 'disabled' : 'active',
  };
}

function normalizeSequence(value) {
  if (value == null || value === '') return null;

  try {
    return BigInt(String(value));
  } catch (_) {
    return null;
  }
}

function compareSequence(a, b) {
  if (a === b) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  return a < b ? -1 : 1;
}

class BitbankClient extends EventEmitter {
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
    this.marketTimer = setInterval(tryRefresh, 300000);
    this.connectWebSocket();
    this.activateInstrument(this.defaultInstrumentId);

    this.bookTimer = setInterval(() => {
      this.fetchStaleActiveBooks();
    }, Math.max(3000, this.pollIntervalMs));

    this.tickerTimer = setInterval(() => {
      if (!this.wsReady) this.fetchActiveTickers();
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
    const res = await fetch(PAIRS_URL, {
      signal: AbortSignal.timeout(10000),
      headers: { 'Accept': 'application/json' },
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    const body = await res.json();
    const pairs = body && body.data && Array.isArray(body.data.pairs) ? body.data.pairs : [];
    const markets = pairs
      .map(pairToMarket)
      .filter(Boolean);

    return markets.length > 0 ? markets : DEFAULT_PAIRS.map(pairToMarket).filter(Boolean);
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
        sequenceId: null,
        diffBuffer: [],
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
        this.emit('disconnected', 'bitbank WebSocket disconnected. REST fallback is active.');
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
    [
      `ticker_${pair}`,
      `depth_whole_${pair}`,
      `depth_diff_${pair}`,
    ].forEach(room => {
      this.ws.send(`42${JSON.stringify(['join-room', room])}`);
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

    if (text === '2') {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) this.ws.send('3');
      return;
    }

    if (text.startsWith('0')) {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) this.ws.send('40');
      return;
    }

    if (text.startsWith('40')) {
      this.wsReady = true;
      this.wsReconnectDelay = 1000;
      this.subscribedInstrumentIds.clear();
      this.emit('connected', 'bitbank WebSocket connected');
      for (const instrumentId of this.activeInstrumentIds) {
        this.subscribeInstrument(instrumentId);
      }
      return;
    }

    if (text.startsWith('44')) {
      this.emit('error', `Socket.IO error: ${text.slice(2)}`);
      return;
    }

    if (!text.startsWith('42')) return;

    const payload = JSON.parse(text.slice(2));
    if (!Array.isArray(payload) || payload[0] !== 'message') return;
    this.handleSocketIoMessage(payload[1]);
  }

  handleSocketIoMessage(frame = {}) {
    const roomName = frame.room_name || '';
    const message = frame.message || {};
    const data = message.data || {};

    if (roomName.startsWith('ticker_')) {
      const pair = roomName.slice('ticker_'.length);
      this.handleTickerMessage(pair, data);
      return;
    }

    if (roomName.startsWith('depth_whole_')) {
      const pair = roomName.slice('depth_whole_'.length);
      this.handleBookSnapshot(pair, data, 'websocket');
      return;
    }

    if (roomName.startsWith('depth_diff_')) {
      const pair = roomName.slice('depth_diff_'.length);
      this.handleBookDiff(pair, data);
    }
  }

  levelsToMap(levels) {
    const map = new Map();
    for (const level of levels) {
      const parsed = this.normalizeLevel(level);
      if (parsed && parseFloat(parsed[1]) > 0) map.set(parsed[0], parsed);
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

    if (
      !Number.isFinite(parseFloat(price))
      || !Number.isFinite(parseFloat(quantity))
      || parseFloat(price) <= 0
    ) {
      return null;
    }

    return [price, quantity, '0'];
  }

  handleBookSnapshot(pair, data = {}, source) {
    const instrumentId = pairToInstrumentId(pair);
    if (!this.activeInstrumentIds.has(instrumentId)) return;

    const state = this.ensureBookState(instrumentId);
    state.asks = this.levelsToMap(data.asks || []);
    state.bids = this.levelsToMap(data.bids || []);
    state.sequenceId = normalizeSequence(data.sequenceId ?? data.s) ?? state.sequenceId;
    state.initialized = true;
    this.applyBufferedDiffs(state);
    state.consecutiveErrors = 0;
    state.backoffMs = 0;
    state.lastBookAt = Date.now();
    this.emit('orderbook', this.buildBookSnapshot(instrumentId, data.timestamp ?? data.t, source));
  }

  handleBookDiff(pair, data = {}) {
    const instrumentId = pairToInstrumentId(pair);
    if (!this.activeInstrumentIds.has(instrumentId)) return;

    const state = this.ensureBookState(instrumentId);
    const diff = {
      sequenceId: normalizeSequence(data.s ?? data.sequenceId),
      asks: data.a || data.asks || [],
      bids: data.b || data.bids || [],
      timestamp: data.t ?? data.timestamp,
    };

    if (!state.initialized) {
      this.bufferDiff(state, diff);
      if (!state.fetchingBook) this.fetchBook(instrumentId);
      return;
    }

    if (
      state.sequenceId != null
      && diff.sequenceId != null
      && diff.sequenceId <= state.sequenceId
    ) {
      return;
    }

    this.applyDiff(state, diff);
    state.lastBookAt = Date.now();
    state.consecutiveErrors = 0;
    this.emit('orderbook', this.buildBookSnapshot(instrumentId, diff.timestamp, 'websocket'));
  }

  bufferDiff(state, diff) {
    state.diffBuffer.push(diff);
    if (state.diffBuffer.length > 1000) {
      state.diffBuffer.splice(0, state.diffBuffer.length - 1000);
    }
  }

  applyBufferedDiffs(state) {
    if (state.diffBuffer.length === 0) return;

    const buffered = state.diffBuffer.sort((a, b) => compareSequence(a.sequenceId, b.sequenceId));
    state.diffBuffer = [];

    for (const diff of buffered) {
      if (
        state.sequenceId != null
        && diff.sequenceId != null
        && diff.sequenceId <= state.sequenceId
      ) {
        continue;
      }

      this.applyDiff(state, diff);
    }
  }

  applyDiff(state, diff) {
    this.applyLevelUpdates(state.asks, diff.asks);
    this.applyLevelUpdates(state.bids, diff.bids);
    if (diff.sequenceId != null) state.sequenceId = diff.sequenceId;
  }

  handleTickerMessage(pair, data = {}) {
    const instrumentId = pairToInstrumentId(pair);
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
      const pair = instrumentIdToPair(instrumentId);
      const res = await fetch(`${PUBLIC_BASE_URL}/${encodeURIComponent(pair)}/depth`, {
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
      if (body.success !== 1) {
        throw new Error(`API success=${body.success}`);
      }

      this.handleBookSnapshot(pair, body.data || {}, 'rest');
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
      const pair = instrumentIdToPair(instrumentId);
      const res = await fetch(`${PUBLIC_BASE_URL}/${encodeURIComponent(pair)}/ticker`, {
        signal: AbortSignal.timeout(5000),
        headers: { 'Accept': 'application/json' },
      });
      if (!res.ok) return;

      const body = await res.json();
      if (body.success !== 1) return;

      const ticker = this.normalizeTicker(instrumentId, body.data || {});
      this.emit('ticker', ticker);
      return ticker;
    } catch (_) {
      return null;
    }
  }

  normalizeTicker(instrumentId, data = {}) {
    const last = Number(data.last);
    const baseVolume24h = Number(data.vol);
    const quoteVolume24h = Number.isFinite(last) && Number.isFinite(baseVolume24h)
      ? last * baseVolume24h
      : null;

    return {
      instrument_id: instrumentId,
      last: data.last,
      open24h: data.open,
      high24h: data.high,
      low24h: data.low,
      baseVolume24h: data.vol,
      quoteVolume24h,
      quoteVolume24hEstimated: quoteVolume24h !== null,
      timestamp: normalizeTimestamp(data.timestamp),
    };
  }
}

module.exports = BitbankClient;
