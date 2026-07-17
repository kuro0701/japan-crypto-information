const EventEmitter = require('events');
const zlib = require('zlib');

const DEFAULT_BASE_URLS = Object.freeze([
  'https://www.binance.com/api/v3',
  'https://api.binance.com/api/v3',
  'https://api-gcp.binance.com/api/v3',
  'https://data-api.binance.vision/api/v3',
  'https://api1.binance.com/api/v3',
  'https://api2.binance.com/api/v3',
  'https://api3.binance.com/api/v3',
  'https://api4.binance.com/api/v3',
]);
const WEB_PRODUCTS_URL = 'https://www.binance.com/bapi/asset/v2/public/asset-service/product/get-products?includeEtf=true';
const PUBLIC_DATA_BASE_URL = 'https://data.binance.vision/data/spot/daily/klines';
const RATE_LIMIT_BACKOFF_MS = 60 * 1000;
const IP_BLOCK_BACKOFF_MS = 5 * 60 * 1000;
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
    const ms = numeric > 1e14 ? numeric / 1000 : (numeric < 1e12 ? numeric * 1000 : numeric);
    return new Date(ms).toISOString();
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
}

function epochMilliseconds(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;
  if (numeric > 1e14) return numeric / 1000;
  return numeric < 1e12 ? numeric * 1000 : numeric;
}

function extractFirstZipEntry(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 30 || buffer.readUInt32LE(0) !== 0x04034b50) {
    throw new Error('Invalid ZIP archive');
  }
  const compressionMethod = buffer.readUInt16LE(8);
  const compressedSize = buffer.readUInt32LE(18);
  const fileNameLength = buffer.readUInt16LE(26);
  const extraLength = buffer.readUInt16LE(28);
  const dataStart = 30 + fileNameLength + extraLength;
  const compressed = buffer.subarray(dataStart, dataStart + compressedSize);
  if (compressionMethod === 0) return compressed.toString('utf8');
  if (compressionMethod === 8) return zlib.inflateRawSync(compressed).toString('utf8');
  throw new Error(`Unsupported ZIP compression method ${compressionMethod}`);
}

function normalizeBaseUrls(values) {
  const urls = (Array.isArray(values) ? values : DEFAULT_BASE_URLS)
    .map(value => String(value || '').trim().replace(/\/+$/, ''))
    .filter(Boolean);
  return urls.length > 0 ? Array.from(new Set(urls)) : [...DEFAULT_BASE_URLS];
}

function jstDateRange(dateString) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(dateString || ''))) return null;
  const startTime = Date.parse(`${dateString}T00:00:00+09:00`);
  if (!Number.isFinite(startTime)) return null;
  return {
    startTime,
    endTime: startTime + (24 * 60 * 60 * 1000) - 1,
  };
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
    this.baseUrls = normalizeBaseUrls(options.baseUrls);
    this.preferredBaseUrlIndex = 0;
    this.lastMarketDataError = null;
    this.marketDataBlockedUntil = 0;
    this.lastFailureStatuses = [];
    this.instrumentIds = new Set(DEFAULT_SYMBOLS.map(symbol => symbolToInstrumentId(symbol)));
    this.activeInstrumentIds = new Set();
    this.bookStates = new Map();
    this.bookTimer = null;
    this.tickerTimer = null;
    this.marketTimer = null;
    this.stopped = false;
  }

  async fetchJson(path, timeoutMs = 5000) {
    if (Date.now() < this.marketDataBlockedUntil) {
      const retryInSeconds = Math.ceil((this.marketDataBlockedUntil - Date.now()) / 1000);
      const error = new Error(`Binance market-data requests are paused for ${retryInSeconds}s after rate limiting.`);
      error.statuses = [...this.lastFailureStatuses];
      this.lastMarketDataError = error.message;
      throw error;
    }

    const attempts = [];
    const statuses = [];
    let retryAfterMs = 0;

    for (let offset = 0; offset < this.baseUrls.length; offset += 1) {
      const index = (this.preferredBaseUrlIndex + offset) % this.baseUrls.length;
      const baseUrl = this.baseUrls[index];
      const url = `${baseUrl}/${String(path || '').replace(/^\/+/, '')}`;

      try {
        const res = await fetch(url, {
          signal: AbortSignal.timeout(timeoutMs),
          headers: { 'Accept': 'application/json' },
        });
        if (!res.ok) {
          statuses.push(res.status);
          const retryAfter = res.headers && typeof res.headers.get === 'function'
            ? Number(res.headers.get('retry-after'))
            : 0;
          if (Number.isFinite(retryAfter) && retryAfter > 0) {
            retryAfterMs = Math.max(retryAfterMs, retryAfter * 1000);
          }
          attempts.push(`${new URL(baseUrl).host}: HTTP ${res.status}`);
          continue;
        }

        const data = await res.json();
        this.preferredBaseUrlIndex = index;
        this.lastMarketDataError = null;
        this.marketDataBlockedUntil = 0;
        this.lastFailureStatuses = [];
        return data;
      } catch (err) {
        attempts.push(`${new URL(baseUrl).host}: ${err.message}`);
      }
    }

    const error = new Error(`All Binance market-data endpoints failed (${attempts.join('; ')})`);
    error.statuses = statuses;
    this.lastMarketDataError = error.message;
    this.lastFailureStatuses = statuses;
    if (statuses.includes(418)) {
      this.marketDataBlockedUntil = Date.now() + Math.max(retryAfterMs, IP_BLOCK_BACKOFF_MS);
    } else if (statuses.includes(429)) {
      this.marketDataBlockedUntil = Date.now() + Math.max(retryAfterMs, RATE_LIMIT_BACKOFF_MS);
    }
    throw error;
  }

  getLastMarketDataError() {
    return this.lastMarketDataError;
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
    const body = await this.fetchJson('exchangeInfo', 10000);
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
      const body = await this.fetchJson(`depth?symbol=${encodeURIComponent(symbol)}&limit=100`, 5000);
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
      if (Array.isArray(err.statuses) && err.statuses.some(status => status === 418 || status === 429)) {
        state.backoffMs = Math.min(30000, Math.max(5000, state.backoffMs * 2 || 5000));
        this.emit('rateLimit', { instrumentId, backoffMs: state.backoffMs });
        return;
      }
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
      const data = await this.fetchJson(`ticker/24hr?symbol=${encodeURIComponent(symbol)}`, 12000);
      const ticker = this.normalizeTicker(instrumentId, data);
      this.emit('ticker', ticker);
      return ticker;
    } catch (_) {
      return null;
    }
  }

  async fetchTickers(instrumentIds = []) {
    const symbols = Array.from(new Set((instrumentIds || [])
      .map(instrumentIdToSymbol)
      .filter(Boolean)));
    if (symbols.length === 0) return [];

    const query = new URLSearchParams({ symbols: JSON.stringify(symbols) });
    let rows;
    try {
      rows = await this.fetchJson(`ticker/24hr?${query.toString()}`, 15000);
    } catch (apiError) {
      try {
        rows = await this.fetchWebProductTickers(symbols);
      } catch (webError) {
        throw new Error(`${apiError.message} Web product fallback failed: ${webError.message}`);
      }
    }
    const instrumentIdBySymbol = new Map(symbols.map(symbol => [symbol, symbolToInstrumentId(symbol)]));
    return (Array.isArray(rows) ? rows : [])
      .map(row => {
        const instrumentId = instrumentIdBySymbol.get(String(row && row.symbol || '').toUpperCase());
        return instrumentId ? this.normalizeTicker(instrumentId, row) : null;
      })
      .filter(Boolean);
  }

  async fetchWebProductTickers(symbols) {
    const res = await fetch(WEB_PRODUCTS_URL, {
      signal: AbortSignal.timeout(20000),
      headers: { 'Accept': 'application/json' },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const body = await res.json();
    const requestedSymbols = new Set(symbols);
    this.lastMarketDataError = null;
    return (Array.isArray(body && body.data) ? body.data : [])
      .filter(row => requestedSymbols.has(String(row && row.s || '').toUpperCase()))
      .map(row => ({
        symbol: row.s,
        openPrice: row.o,
        highPrice: row.h,
        lowPrice: row.l,
        lastPrice: row.c,
        volume: row.v,
        quoteVolume: row.qv,
        closeTime: Date.now(),
      }));
  }

  async fetchDailyTicker(instrumentId, volumeDateJst) {
    const range = jstDateRange(volumeDateJst);
    if (!range) return null;

    try {
      const symbol = instrumentIdToSymbol(instrumentId);
      const query = new URLSearchParams({
        symbol,
        interval: '1d',
        startTime: String(range.startTime),
        endTime: String(range.endTime),
        timeZone: '9',
        limit: '1',
      });
      let rows;
      try {
        rows = await this.fetchJson(`klines?${query.toString()}`, 15000);
      } catch (_) {
        return this.fetchDailyTickerFromArchive(instrumentId, volumeDateJst);
      }
      const row = Array.isArray(rows) ? rows[0] : null;
      if (!Array.isArray(row)) return null;

      return this.normalizeTicker(instrumentId, {
        openPrice: row[1],
        highPrice: row[2],
        lowPrice: row[3],
        lastPrice: row[4],
        volume: row[5],
        closeTime: row[6],
        quoteVolume: row[7],
      });
    } catch (_) {
      return null;
    }
  }

  async fetchDailyTickerFromArchive(instrumentId, volumeDateJst) {
    const range = jstDateRange(volumeDateJst);
    if (!range) return null;
    const symbol = instrumentIdToSymbol(instrumentId);
    const utcDates = Array.from(new Set([
      new Date(range.startTime).toISOString().slice(0, 10),
      new Date(range.endTime).toISOString().slice(0, 10),
    ]));

    try {
      const csvFiles = await Promise.all(utcDates.map(async utcDate => {
        const fileName = `${symbol}-1h-${utcDate}.zip`;
        const url = `${PUBLIC_DATA_BASE_URL}/${symbol}/1h/${fileName}`;
        const res = await fetch(url, {
          signal: AbortSignal.timeout(20000),
          headers: { 'Accept': 'application/zip' },
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return extractFirstZipEntry(Buffer.from(await res.arrayBuffer()));
      }));

      const rows = csvFiles
        .flatMap(csv => csv.trim().split(/\r?\n/))
        .map(line => line.split(','))
        .filter(row => {
          const openTime = epochMilliseconds(row[0]);
          return openTime != null && openTime >= range.startTime && openTime <= range.endTime;
        })
        .sort((left, right) => epochMilliseconds(left[0]) - epochMilliseconds(right[0]));
      if (rows.length === 0) return null;

      const first = rows[0];
      const last = rows[rows.length - 1];
      const baseVolume = rows.reduce((sum, row) => sum + (Number(row[5]) || 0), 0);
      const quoteVolume = rows.reduce((sum, row) => sum + (Number(row[7]) || 0), 0);
      return this.normalizeTicker(instrumentId, {
        openPrice: first[1],
        highPrice: Math.max(...rows.map(row => Number(row[2]) || 0)),
        lowPrice: Math.min(...rows.map(row => Number(row[3]) || Number.POSITIVE_INFINITY)),
        lastPrice: last[4],
        volume: baseVolume,
        closeTime: epochMilliseconds(last[6]),
        quoteVolume,
      });
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
