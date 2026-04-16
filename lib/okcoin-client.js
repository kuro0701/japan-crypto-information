const EventEmitter = require('events');
const WebSocket = require('ws');
const zlib = require('zlib');

const BASE_URL = 'https://www.okcoin.jp/api/spot/v3';
const INSTRUMENTS_URL = `${BASE_URL}/instruments`;
const WS_URL = 'wss://connect.okcoin.jp:443/ws/v3';
const DEFAULT_INSTRUMENT_ID = 'BTC-JPY';

class OKCoinClient extends EventEmitter {
  constructor(pollIntervalMs = 500, options = {}) {
    super();
    this.pollIntervalMs = pollIntervalMs;
    this.defaultInstrumentId = options.defaultInstrumentId || DEFAULT_INSTRUMENT_ID;
    this.instrumentIds = new Set([this.defaultInstrumentId]);
    this.activeInstrumentIds = new Set();
    this.bookStates = new Map();
    this.bookTimer = null;
    this.tickerTimer = null;
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
        await this.refreshInstruments();
      } catch (err) {
        this.emit('error', `Instrument list error: ${err.message}`);
        setTimeout(tryRefresh, 5000);
      }
    };
    tryRefresh();

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
    if (this.wsReconnectTimer) clearTimeout(this.wsReconnectTimer);
    if (this.ws) this.ws.close();
    this.bookTimer = null;
    this.tickerTimer = null;
    this.wsReconnectTimer = null;
    this.ws = null;
    this.wsReady = false;
    this.subscribedInstrumentIds.clear();
  }

  async refreshInstruments() {
    const instruments = await this.fetchInstruments();
    this.instrumentIds = new Set(instruments.map(item => item.instrument_id).filter(Boolean));
    this.emit('instruments', instruments);
    return instruments;
  }

  async fetchInstruments() {
    const res = await fetch(INSTRUMENTS_URL, {
      signal: AbortSignal.timeout(10000),
      headers: { 'Accept': 'application/json' },
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    return res.json();
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
      this.emit('connected', 'OKJ WebSocket connected');
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
        this.emit('disconnected', 'OKJ WebSocket disconnected. REST fallback is active.');
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

    this.ws.send(JSON.stringify({
      op: 'subscribe',
      args: [`spot/depth:${instrumentId}`, `spot/ticker:${instrumentId}`],
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
    const text = this.decodeWebSocketData(data);
    if (text === 'ping') {
      if (this.wsReady && this.ws) this.ws.send('pong');
      return;
    }

    const msg = JSON.parse(text);

    if (msg.event) {
      this.emit('status', msg);
      return;
    }

    if (msg.table === 'spot/ticker') {
      for (const item of msg.data || []) {
        if (this.activeInstrumentIds.has(item.instrument_id)) {
          this.emit('ticker', item);
        }
      }
      return;
    }

    if (msg.table !== 'spot/depth') return;

    for (const item of msg.data || []) {
      const instrumentId = item.instrument_id;
      if (!this.activeInstrumentIds.has(instrumentId)) continue;

      const state = this.ensureBookState(instrumentId);
      if (msg.action === 'partial') {
        state.asks = this.levelsToMap(item.asks || []);
        state.bids = this.levelsToMap(item.bids || []);
      } else {
        this.applyLevelUpdates(state.asks, item.asks || []);
        this.applyLevelUpdates(state.bids, item.bids || []);
      }

      state.lastBookAt = Date.now();
      state.consecutiveErrors = 0;
      this.emit('orderbook', this.buildBookSnapshot(instrumentId, item.timestamp));
    }
  }

  decodeWebSocketData(data) {
    if (!Buffer.isBuffer(data)) return String(data);

    const rawText = data.toString('utf8');
    if (rawText === 'ping' || rawText.startsWith('{') || rawText.startsWith('[')) {
      return rawText;
    }

    const decompressors = [zlib.inflateRawSync, zlib.inflateSync, zlib.gunzipSync];
    for (const decompress of decompressors) {
      try {
        return decompress(data).toString('utf8');
      } catch (_) {
        // Try the next compression envelope.
      }
    }

    return rawText;
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
    const orders = String(level[2] ?? 0);

    if (!Number.isFinite(parseFloat(price)) || !Number.isFinite(parseFloat(quantity))) {
      return null;
    }

    return [price, quantity, orders];
  }

  buildBookSnapshot(instrumentId, timestamp) {
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
      timestamp: timestamp || new Date().toISOString(),
      source: 'websocket',
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
      const res = await fetch(`${BASE_URL}/instruments/${instrumentId}/book?size=200`, {
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
      state.consecutiveErrors = 0;
      state.backoffMs = 0;
      state.lastBookAt = Date.now();
      data.instrument_id = instrumentId;
      data.source = 'rest';
      this.emit('orderbook', data);
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
      const res = await fetch(`${BASE_URL}/instruments/${instrumentId}/ticker`, {
        signal: AbortSignal.timeout(5000),
        headers: { 'Accept': 'application/json' },
      });
      if (!res.ok) return;

      const data = await res.json();
      data.instrument_id = instrumentId;
      this.emit('ticker', data);
    } catch (_) {}
  }
}

module.exports = OKCoinClient;
