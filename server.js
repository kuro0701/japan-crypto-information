const http = require('http');
const crypto = require('crypto');
const express = require('express');
const path = require('path');
const OKCoinClient = require('./lib/okcoin-client');
const CoincheckClient = require('./lib/coincheck-client');
const BitflyerClient = require('./lib/bitflyer-client');
const BitbankClient = require('./lib/bitbank-client');
const GMOClient = require('./lib/gmo-client');
const BinanceJapanClient = require('./lib/binance-japan-client');
const OKJSaleClient = require('./lib/okj-sale-client');
const CoincheckSalesClient = require('./lib/coincheck-sales-client');
const BitflyerSalesClient = require('./lib/bitflyer-sales-client');
const BitbankSalesClient = require('./lib/bitbank-sales-client');
const GMOSalesClient = require('./lib/gmo-sales-client');
const OrderBook = require('./lib/orderbook');
const WSManager = require('./lib/ws-manager');
const VolumeShareStore = require('./lib/volume-share-store');
const SalesSpreadStore = require('./lib/sales-spread-store');
const AnalyticsStore = require('./lib/analytics-store');
const {
  DEFAULT_EXCHANGE_ID,
  DEFAULT_OKJ_INSTRUMENT_ID,
  COINCHECK_EXCHANGE_ID,
  DEFAULT_COINCHECK_INSTRUMENT_ID,
  BITFLYER_EXCHANGE_ID,
  DEFAULT_BITFLYER_INSTRUMENT_ID,
  BITBANK_EXCHANGE_ID,
  DEFAULT_BITBANK_INSTRUMENT_ID,
  GMO_EXCHANGE_ID,
  DEFAULT_GMO_INSTRUMENT_ID,
  BINANCE_JAPAN_EXCHANGE_ID,
  DEFAULT_BINANCE_JAPAN_INSTRUMENT_ID,
  EXCHANGES,
  getPublicExchanges,
  setExchangeMarkets,
} = require('./lib/exchanges');

const app = express();
app.set('trust proxy', 1);

const volumeShareStore = new VolumeShareStore({
  dataFilePath: path.join(__dirname, 'data', 'volume-share-history.json'),
});
const salesSpreadStore = new SalesSpreadStore({
  dataFilePath: path.join(__dirname, 'data', 'sales-spread-history.json'),
});
const analyticsStore = new AnalyticsStore({
  dataFilePath: path.join(__dirname, 'data', 'analytics.json'),
  salt: process.env.ANALYTICS_SALT,
});
const analyticsAdminToken = process.env.ANALYTICS_ADMIN_TOKEN || '';
const analyticsAdminTokenHash = process.env.ANALYTICS_ADMIN_TOKEN_HASH
  || '59875027e31f7e785553fea0cbef84c4b36fa25b9c5d81c6bd1be2c53861c3b0';

function normalizeAnalyticsRoute(reqPath) {
  if (reqPath === '/' || reqPath === '/index.html') return '/';
  if (reqPath === '/volume-share' || reqPath === '/volume-share.html') return '/volume-share';
  if (reqPath === '/sales-spread' || reqPath === '/sales-spread.html') return '/sales-spread';
  return null;
}

function getRequestAdminToken(req) {
  const authorization = req.get('authorization') || '';
  if (authorization.toLowerCase().startsWith('bearer ')) {
    return authorization.slice(7).trim();
  }
  return req.get('x-admin-token') || req.query.token || '';
}

function sha256(value) {
  return crypto.createHash('sha256').update(String(value || '')).digest('hex');
}

function timingSafeEqualString(a, b) {
  const left = Buffer.from(String(a || ''), 'utf8');
  const right = Buffer.from(String(b || ''), 'utf8');
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

function requireAnalyticsAdmin(req, res, next) {
  const requestToken = getRequestAdminToken(req);
  if (!requestToken) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  if (analyticsAdminToken && timingSafeEqualString(requestToken, analyticsAdminToken)) {
    next();
    return;
  }

  if (analyticsAdminTokenHash && timingSafeEqualString(sha256(requestToken), analyticsAdminTokenHash)) {
    next();
    return;
  }

  res.status(401).json({ error: 'Unauthorized' });
}

app.use((req, res, next) => {
  if (req.method !== 'GET') {
    next();
    return;
  }

  const route = normalizeAnalyticsRoute(req.path);
  if (!route) {
    next();
    return;
  }

  res.on('finish', () => {
    if (res.statusCode >= 200 && res.statusCode < 400) {
      try {
        analyticsStore.trackPageView(req, route);
      } catch (err) {
        console.warn('[Analytics] Page view tracking failed:', err.message);
      }
    }
  });
  next();
});

app.get('/healthz', (_req, res) => {
  res.status(200).json({ status: 'ok' });
});
app.get('/volume-share', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'volume-share.html'));
});
app.get('/sales-spread', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'sales-spread.html'));
});
app.get('/admin/analytics', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin-analytics.html'));
});
app.get('/api/volume-share', (req, res) => {
  res.json(volumeShareStore.getShare(req.query.window || '1d'));
});
app.get('/api/sales-spread', (_req, res) => {
  res.json(salesSpreadStore.getReport());
});
app.get('/api/admin/analytics', requireAnalyticsAdmin, (req, res) => {
  res.json(analyticsStore.getReport(req.query.window || '7d'));
});
app.use(express.static(path.join(__dirname, 'public')));
app.get('/api/exchanges', (_req, res) => {
  res.json({
    defaultExchangeId: DEFAULT_EXCHANGE_ID,
    exchanges: getPublicExchanges(),
  });
});

const server = http.createServer(app);
const okjClient = new OKCoinClient(500, {
  defaultInstrumentId: DEFAULT_OKJ_INSTRUMENT_ID,
});
const coincheckClient = new CoincheckClient(500, {
  defaultInstrumentId: DEFAULT_COINCHECK_INSTRUMENT_ID,
});
const bitflyerClient = new BitflyerClient(500, {
  defaultInstrumentId: DEFAULT_BITFLYER_INSTRUMENT_ID,
});
const bitbankClient = new BitbankClient(500, {
  defaultInstrumentId: DEFAULT_BITBANK_INSTRUMENT_ID,
});
const gmoClient = new GMOClient(500, {
  defaultInstrumentId: DEFAULT_GMO_INSTRUMENT_ID,
});
const binanceJapanClient = new BinanceJapanClient(500, {
  defaultInstrumentId: DEFAULT_BINANCE_JAPAN_INSTRUMENT_ID,
});
const okjSaleClient = new OKJSaleClient();
const coincheckSaleClient = new CoincheckSalesClient();
const bitflyerSaleClient = new BitflyerSalesClient();
const bitbankSaleClient = new BitbankSalesClient();
const gmoSaleClient = new GMOSalesClient();
const clientsByExchange = new Map([
  [DEFAULT_EXCHANGE_ID, okjClient],
  [COINCHECK_EXCHANGE_ID, coincheckClient],
  [BITFLYER_EXCHANGE_ID, bitflyerClient],
  [BITBANK_EXCHANGE_ID, bitbankClient],
  [GMO_EXCHANGE_ID, gmoClient],
  [BINANCE_JAPAN_EXCHANGE_ID, binanceJapanClient],
]);
const defaultInstrumentIds = {
  [DEFAULT_EXCHANGE_ID]: DEFAULT_OKJ_INSTRUMENT_ID,
  [COINCHECK_EXCHANGE_ID]: DEFAULT_COINCHECK_INSTRUMENT_ID,
  [BITFLYER_EXCHANGE_ID]: DEFAULT_BITFLYER_INSTRUMENT_ID,
  [BITBANK_EXCHANGE_ID]: DEFAULT_BITBANK_INSTRUMENT_ID,
  [GMO_EXCHANGE_ID]: DEFAULT_GMO_INSTRUMENT_ID,
  [BINANCE_JAPAN_EXCHANGE_ID]: DEFAULT_BINANCE_JAPAN_INSTRUMENT_ID,
};
const wsManager = new WSManager(server, {
  exchanges: getPublicExchanges(),
  defaultExchangeId: DEFAULT_EXCHANGE_ID,
  onMarketSelected: ({ exchangeId, instrumentId }) => {
    const exchangeClient = clientsByExchange.get(exchangeId);
    if (exchangeClient) exchangeClient.activateInstrument(instrumentId);
  },
  onClientConnected: ({ request }) => {
    try {
      analyticsStore.trackWebSocketOpen(request);
    } catch (err) {
      console.warn('[Analytics] WebSocket tracking failed:', err.message);
    }
  },
  onClientDisconnected: () => {
    analyticsStore.trackWebSocketClose();
  },
});

function getFallbackInstrumentId(exchangeId) {
  return defaultInstrumentIds[exchangeId] || DEFAULT_OKJ_INSTRUMENT_ID;
}

function wireExchangeClient(exchangeId, client, label) {
  client.on('instruments', (instruments) => {
    const exchange = setExchangeMarkets(exchangeId, instruments);
    wsManager.setExchanges(getPublicExchanges());
    if (exchange) {
      client.activateInstrument(exchange.defaultInstrumentId || getFallbackInstrumentId(exchangeId));
    }
  });

  client.on('orderbook', (raw) => {
    try {
      const book = new OrderBook({
        ...raw,
        exchangeId,
        instrumentId: raw.instrument_id || raw.instrumentId || getFallbackInstrumentId(exchangeId),
      });
      wsManager.onOrderBook(book);
    } catch (err) {
      console.error(`[${label} OrderBook Parse Error]`, err.message);
    }
  });

  client.on('ticker', (data) => {
    const tickerInput = {
      ...data,
      exchangeId,
      instrumentId: data.instrument_id || data.instrumentId || getFallbackInstrumentId(exchangeId),
    };
    wsManager.onTicker(tickerInput);

    const exchange = getPublicExchanges().find(item => item.id === exchangeId);
    const market = exchange && exchange.markets.find(item => item.instrumentId === tickerInput.instrumentId);
    if (exchange && market) {
      volumeShareStore.upsertTicker(wsManager.normalizeTicker(tickerInput), exchange, market);
    }
  });

  client.on('connected', (message) => {
    wsManager.onStatus({ type: `${exchangeId}Connected`, exchangeId, message });
  });

  client.on('status', (data) => {
    wsManager.onStatus({ type: `${exchangeId}Status`, exchangeId, data });
  });

  client.on('error', (msg) => {
    console.warn(`[${label} API Error]`, msg);
    wsManager.onStatus({ type: 'apiError', exchangeId, message: msg });
  });

  client.on('rateLimit', (data) => {
    console.warn(`[${label} Rate Limit] instrument:`, data.instrumentId, 'backoff:', data.backoffMs, 'ms');
    wsManager.onStatus({ type: 'rateLimit', exchangeId, ...data });
  });

  client.on('disconnected', (msg) => {
    console.error(`[${label} Disconnected]`, msg);
    wsManager.onStatus({ type: 'disconnected', exchangeId, message: msg });
  });
}

wireExchangeClient(DEFAULT_EXCHANGE_ID, okjClient, 'OKJ');
wireExchangeClient(COINCHECK_EXCHANGE_ID, coincheckClient, 'Coincheck');
wireExchangeClient(BITFLYER_EXCHANGE_ID, bitflyerClient, 'bitFlyer');
wireExchangeClient(BITBANK_EXCHANGE_ID, bitbankClient, 'bitbank');
wireExchangeClient(GMO_EXCHANGE_ID, gmoClient, 'GMO Coin');
wireExchangeClient(BINANCE_JAPAN_EXCHANGE_ID, binanceJapanClient, 'Binance Japan');

const TICKER_FETCH_DELAY_MS = 120;
const VOLUME_REFRESH_INTERVAL_MS = 60 * 60 * 1000;
const SALES_SPREAD_REFRESH_INTERVAL_MS = 60 * 60 * 1000;
const JST_OFFSET_MS = 9 * 60 * 60 * 1000;
let volumeRefreshPromise = null;
let salesSpreadRefreshPromise = null;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function msUntilNextJstMidnight(now = new Date()) {
  const jstClock = new Date(now.getTime() + JST_OFFSET_MS);
  const nextJstMidnightAsUtc = Date.UTC(
    jstClock.getUTCFullYear(),
    jstClock.getUTCMonth(),
    jstClock.getUTCDate() + 1,
    0,
    0,
    5
  );
  return Math.max(1000, nextJstMidnightAsUtc - jstClock.getTime());
}

function getPublicExchangeById(exchangeId, label) {
  return getPublicExchanges().find(exchange => exchange.id === exchangeId) || {
    id: exchangeId,
    label,
  };
}

async function refreshAllVolumeTickers(source = 'scheduled') {
  if (volumeRefreshPromise) return volumeRefreshPromise;

  volumeRefreshPromise = (async () => {
    const capturedAt = new Date();
    const records = [];
    const errors = [];
    volumeShareStore.setRefreshStatus({
      running: true,
      startedAt: capturedAt.toISOString(),
      source,
      errors: [],
    });

    for (const exchange of getPublicExchanges()) {
      const client = clientsByExchange.get(exchange.id);
      if (!client || typeof client.fetchTicker !== 'function') continue;

      for (const market of exchange.markets || []) {
        if (market.status && market.status !== 'active') continue;

        try {
          const rawTicker = await client.fetchTicker(market.instrumentId);
          if (rawTicker) {
            const ticker = wsManager.normalizeTicker({
              ...rawTicker,
              exchangeId: exchange.id,
              instrumentId: rawTicker.instrument_id || rawTicker.instrumentId || market.instrumentId,
            });
            const record = volumeShareStore.buildRecord(ticker, exchange, market, capturedAt);
            if (record) records.push(record);
          }
        } catch (err) {
          errors.push({
            exchangeId: exchange.id,
            instrumentId: market.instrumentId,
            message: err.message,
          });
        }

        await sleep(TICKER_FETCH_DELAY_MS);
      }
    }

    if (records.length > 0) {
      volumeShareStore.replaceLatest(records, source, {
        capturedAt: capturedAt.toISOString(),
        errors,
      });
    }

    volumeShareStore.setRefreshStatus({
      running: false,
      finishedAt: new Date().toISOString(),
      source,
      errors,
    });

    return {
      capturedAt: capturedAt.toISOString(),
      records,
      errors,
    };
  })().finally(() => {
    volumeRefreshPromise = null;
  });

  return volumeRefreshPromise;
}

async function refreshSalesSpreadRecords(source = 'scheduled') {
  if (salesSpreadRefreshPromise) return salesSpreadRefreshPromise;

  salesSpreadRefreshPromise = (async () => {
    const capturedAt = new Date();
    const errors = [];
    salesSpreadStore.setRefreshStatus({
      running: true,
      startedAt: capturedAt.toISOString(),
      source,
      errors: [],
    });

    const records = [];
    const sources = [
      {
        exchangeId: DEFAULT_EXCHANGE_ID,
        label: 'OKJ',
        client: okjSaleClient,
      },
      {
        exchangeId: COINCHECK_EXCHANGE_ID,
        label: 'Coincheck',
        client: coincheckSaleClient,
      },
      {
        exchangeId: BITFLYER_EXCHANGE_ID,
        label: 'bitFlyer',
        client: bitflyerSaleClient,
      },
      {
        exchangeId: BITBANK_EXCHANGE_ID,
        label: 'bitbank',
        client: bitbankSaleClient,
      },
      {
        exchangeId: GMO_EXCHANGE_ID,
        label: 'GMO Coin',
        client: gmoSaleClient,
      },
    ];

    for (const sourceConfig of sources) {
      try {
        const exchange = getPublicExchangeById(sourceConfig.exchangeId, sourceConfig.label);
        const currencies = await sourceConfig.client.fetchCurrencies();
        for (const item of currencies) {
          const record = salesSpreadStore.buildRecord(item, exchange, capturedAt);
          if (record) records.push(record);
        }
      } catch (err) {
        errors.push({
          exchangeId: sourceConfig.exchangeId,
          message: err.message,
        });
      }
    }

    if (records.length > 0) {
      salesSpreadStore.replaceLatest(records, source, {
        capturedAt: capturedAt.toISOString(),
        errors,
      });
    }

    salesSpreadStore.setRefreshStatus({
      running: false,
      finishedAt: new Date().toISOString(),
      source,
      errors,
    });

    return {
      capturedAt: capturedAt.toISOString(),
      records,
      errors,
    };
  })().finally(() => {
    salesSpreadRefreshPromise = null;
  });

  return salesSpreadRefreshPromise;
}

async function captureDailyVolumeSnapshot(reason = 'jst-midnight') {
  const result = await refreshAllVolumeTickers(reason);
  if (result.records.length === 0) return null;

  return volumeShareStore.captureDaily(result.records, {
    capturedAt: result.capturedAt,
    reason,
    volumeDateJst: VolumeShareStore.getPreviousJstDate(new Date(result.capturedAt)),
  });
}

async function captureDailySalesSpreadSnapshot(reason = 'jst-midnight') {
  const result = await refreshSalesSpreadRecords(reason);
  if (result.records.length === 0) return null;

  return salesSpreadStore.captureDaily(result.records, {
    capturedAt: result.capturedAt,
    reason,
    spreadDateJst: SalesSpreadStore.getPreviousJstDate(new Date(result.capturedAt)),
  });
}

function maybeCaptureEarlyMorningCatchup(result) {
  if (!result || result.records.length === 0) return;
  const capturedAt = new Date(result.capturedAt);
  const parts = VolumeShareStore.getJstParts(capturedAt);
  if (parts.hour > 1) return;

  const volumeDateJst = VolumeShareStore.getPreviousJstDate(capturedAt);
  if (volumeShareStore.hasDailySnapshot(volumeDateJst)) return;

  volumeShareStore.captureDaily(result.records, {
    capturedAt: result.capturedAt,
    reason: 'early-morning-catchup',
    volumeDateJst,
  });
}

function maybeCaptureEarlyMorningSalesSpreadCatchup(result) {
  if (!result || result.records.length === 0) return;
  const capturedAt = new Date(result.capturedAt);
  const parts = SalesSpreadStore.getJstParts(capturedAt);
  if (parts.hour > 1) return;

  const spreadDateJst = SalesSpreadStore.getPreviousJstDate(capturedAt);
  if (salesSpreadStore.hasDailySnapshot(spreadDateJst)) return;

  salesSpreadStore.captureDaily(result.records, {
    capturedAt: result.capturedAt,
    reason: 'early-morning-catchup',
    spreadDateJst,
  });
}

function scheduleDailyVolumeSnapshot() {
  setTimeout(async () => {
    try {
      await captureDailyVolumeSnapshot('jst-midnight');
    } catch (err) {
      console.warn('[Volume Share] Daily snapshot failed:', err.message);
    } finally {
      scheduleDailyVolumeSnapshot();
    }
  }, msUntilNextJstMidnight());
}

function scheduleDailySalesSpreadSnapshot() {
  setTimeout(async () => {
    try {
      await captureDailySalesSpreadSnapshot('jst-midnight');
    } catch (err) {
      console.warn('[Sales Spread] Daily snapshot failed:', err.message);
    } finally {
      scheduleDailySalesSpreadSnapshot();
    }
  }, msUntilNextJstMidnight());
}

function scheduleVolumeShareJobs() {
  setTimeout(async () => {
    try {
      const result = await refreshAllVolumeTickers('startup');
      maybeCaptureEarlyMorningCatchup(result);
    } catch (err) {
      console.warn('[Volume Share] Startup refresh failed:', err.message);
    }
  }, 8000);

  setInterval(async () => {
    try {
      const result = await refreshAllVolumeTickers('hourly');
      maybeCaptureEarlyMorningCatchup(result);
    } catch (err) {
      console.warn('[Volume Share] Hourly refresh failed:', err.message);
    }
  }, VOLUME_REFRESH_INTERVAL_MS);

  scheduleDailyVolumeSnapshot();
}

function scheduleSalesSpreadJobs() {
  setTimeout(async () => {
    try {
      const result = await refreshSalesSpreadRecords('startup');
      maybeCaptureEarlyMorningSalesSpreadCatchup(result);
    } catch (err) {
      console.warn('[Sales Spread] Startup refresh failed:', err.message);
    }
  }, 5000);

  setInterval(async () => {
    try {
      const result = await refreshSalesSpreadRecords('hourly');
      maybeCaptureEarlyMorningSalesSpreadCatchup(result);
    } catch (err) {
      console.warn('[Sales Spread] Hourly refresh failed:', err.message);
    }
  }, SALES_SPREAD_REFRESH_INTERVAL_MS);

  scheduleDailySalesSpreadSnapshot();
}

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';
server.listen(PORT, HOST, () => {
  const displayHost = HOST === '0.0.0.0' ? 'localhost' : HOST;
  console.log(`成行取引リアルタイム板シュミレーター running on http://${displayHost}:${PORT} (${EXCHANGES.map(exchange => exchange.label).join(', ')})`);
  for (const client of clientsByExchange.values()) {
    client.start();
  }
  scheduleVolumeShareJobs();
  scheduleSalesSpreadJobs();
});
