const fs = require('fs');
const http = require('http');
const express = require('express');
const path = require('path');
const OKCoinClient = require('./lib/okcoin-client');
const CoincheckClient = require('./lib/coincheck-client');
const BitflyerClient = require('./lib/bitflyer-client');
const BitbankClient = require('./lib/bitbank-client');
const GMOClient = require('./lib/gmo-client');
const BinanceJapanClient = require('./lib/binance-japan-client');
const BitTradeClient = require('./lib/bittrade-client');
const OKJSaleClient = require('./lib/okj-sale-client');
const CoincheckSalesClient = require('./lib/coincheck-sales-client');
const BitflyerSalesClient = require('./lib/bitflyer-sales-client');
const BitbankSalesClient = require('./lib/bitbank-sales-client');
const GMOSalesClient = require('./lib/gmo-sales-client');
const BitTradeSalesClient = require('./lib/bittrade-sales-client');
const OrderBook = require('./lib/orderbook');
const WSManager = require('./lib/ws-manager');
const VolumeShareStore = require('./lib/volume-share-store');
const SalesSpreadStore = require('./lib/sales-spread-store');
const AnalyticsStore = require('./lib/analytics-store');
const { NeonStateStore } = require('./lib/neon-state-store');
const { ensureDataDirHealth, resolveDataDir } = require('./lib/data-storage');
const { calculateImpact } = require('./lib/impact-calculator');
const { renderHeadMeta } = require('./lib/head-meta');
const { getArticle, listArticles } = require('./lib/content');
const {
  CORE_SALES_SNAPSHOT_EXCHANGE_IDS,
  CORE_VOLUME_SNAPSHOT_EXCHANGE_IDS,
  buildSnapshotCoverage,
  shouldCaptureSnapshot,
} = require('./lib/snapshot-coverage');
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
  BITTRADE_EXCHANGE_ID,
  DEFAULT_BITTRADE_INSTRUMENT_ID,
  EXCHANGES,
  getPublicExchanges,
  setExchangeMarkets,
} = require('./lib/exchanges');
const { createAnalyticsAdminService } = require('./lib/server/analytics-admin-service');
const { createMarketDataService } = require('./lib/server/market-data-service');
const { registerApiRoutes } = require('./lib/server/register-api-routes');
const { registerPageRoutes } = require('./lib/server/register-page-routes');
const { createSiteContentService } = require('./lib/server/site-content-service');

const app = express();
app.set('trust proxy', 1);
const PUBLIC_DIR = path.join(__dirname, 'public');
const DATABASE_URL = String(process.env.DATABASE_URL || '').trim();
const USE_NEON_SNAPSHOT_STORAGE = Boolean(DATABASE_URL);
const DATA_DIR = resolveDataDir({ projectRoot: __dirname });
const DATA_DIR_CONFIGURED = Boolean(String(process.env.DATA_DIR || '').trim());
const DATA_FILES = Object.freeze({
  volumeShare: path.join(DATA_DIR, 'volume-share-history.json'),
  salesSpread: path.join(DATA_DIR, 'sales-spread-history.json'),
  analytics: path.join(DATA_DIR, 'analytics.json'),
});
const EXPECTED_DATA_FILES = USE_NEON_SNAPSHOT_STORAGE
  ? [DATA_FILES.analytics]
  : Object.values(DATA_FILES);

if (String(process.env.NODE_ENV || '').trim().toLowerCase() === 'production' && !DATA_DIR_CONFIGURED) {
  console.warn('[data-storage] DATA_DIR is not configured in production; falling back to the bundled data directory.');
}

ensureDataDirHealth({
  dataDirPath: DATA_DIR,
  projectRoot: __dirname,
  expectedFiles: EXPECTED_DATA_FILES,
});

function fileLastmod(filePath) {
  try {
    return fs.statSync(filePath).mtime.toISOString();
  } catch (_err) {
    return new Date().toISOString();
  }
}

const SITEMAP_PAGES = [
  {
    path: '/',
    lastmod: fileLastmod(path.join(PUBLIC_DIR, 'index.html')),
    priority: '1.0',
  },
  {
    path: '/simulator',
    lastmod: fileLastmod(path.join(PUBLIC_DIR, 'simulator.html')),
    priority: '0.9',
  },
  {
    path: '/volume-share',
    lastmod: fileLastmod(path.join(PUBLIC_DIR, 'volume-share.html')),
    priority: '0.8',
  },
  {
    path: '/sales-spread',
    lastmod: fileLastmod(path.join(PUBLIC_DIR, 'sales-spread.html')),
    priority: '0.8',
  },
  {
    path: '/markets',
    lastmod: fileLastmod(path.join(PUBLIC_DIR, 'markets.html')),
    priority: '0.8',
  },
];

const snapshotStateStore = USE_NEON_SNAPSHOT_STORAGE
  ? new NeonStateStore({ connectionString: DATABASE_URL })
  : null;
const volumeShareStore = new VolumeShareStore({
  dataFilePath: USE_NEON_SNAPSHOT_STORAGE ? null : DATA_FILES.volumeShare,
  seedFilePath: DATA_FILES.volumeShare,
  persistence: snapshotStateStore,
  persistenceKey: 'volume-share',
});
const salesSpreadStore = new SalesSpreadStore({
  dataFilePath: USE_NEON_SNAPSHOT_STORAGE ? null : DATA_FILES.salesSpread,
  seedFilePath: DATA_FILES.salesSpread,
  persistence: snapshotStateStore,
  persistenceKey: 'sales-spread',
});
const analyticsStore = new AnalyticsStore({
  dataFilePath: DATA_FILES.analytics,
  salt: process.env.ANALYTICS_SALT,
});
const storesReadyPromise = Promise.all([
  volumeShareStore.initializePersistence(),
  salesSpreadStore.initializePersistence(),
]);
const ANALYTICS_ADMIN_SESSION_COOKIE = 'okjAnalyticsAdminSession';
const ANALYTICS_ADMIN_SESSION_COOKIE_PATH = '/api/admin';
const ANALYTICS_ADMIN_SESSION_TTL_MS = 1000 * 60 * 60 * 12;
const analyticsAdminService = createAnalyticsAdminService({
  analyticsAdminToken: process.env.ANALYTICS_ADMIN_TOKEN,
  analyticsAdminTokenHash: process.env.ANALYTICS_ADMIN_TOKEN_HASH,
  analyticsSalt: process.env.ANALYTICS_SALT,
  cookieName: ANALYTICS_ADMIN_SESSION_COOKIE,
  cookiePath: ANALYTICS_ADMIN_SESSION_COOKIE_PATH,
  sessionTtlMs: ANALYTICS_ADMIN_SESSION_TTL_MS,
});
const siteContentService = createSiteContentService({
  getArticle,
  getPublicExchanges,
  listArticles,
  publicDir: PUBLIC_DIR,
  renderHeadMeta,
  salesSpreadStore,
  volumeShareStore,
});

function normalizeAnalyticsRoute(reqPath) {
  if (reqPath === '/' || reqPath === '/index.html') return '/';
  if (reqPath === '/simulator' || reqPath === '/simulator.html') return '/simulator';
  if (reqPath === '/volume-share' || reqPath === '/volume-share.html') return '/volume-share';
  if (reqPath === '/sales-spread' || reqPath === '/sales-spread.html') return '/sales-spread';
  if (reqPath === '/markets' || reqPath === '/markets.html') return '/markets';
  if (/^\/markets\/[A-Z0-9]+-[A-Z0-9]+$/i.test(reqPath)) return reqPath.toUpperCase();
  if (/^\/exchanges\/[a-z0-9-]+$/i.test(reqPath)) return reqPath.toLowerCase();
  return null;
}

app.use(express.json({ limit: '10kb' }));
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
const bittradeClient = new BitTradeClient(500, {
  defaultInstrumentId: DEFAULT_BITTRADE_INSTRUMENT_ID,
});
const okjSaleClient = new OKJSaleClient();
const coincheckSaleClient = new CoincheckSalesClient();
const bitflyerSaleClient = new BitflyerSalesClient();
const bitbankSaleClient = new BitbankSalesClient();
const gmoSaleClient = new GMOSalesClient();
const bittradeSaleClient = new BitTradeSalesClient();
const clientsByExchange = new Map([
  [DEFAULT_EXCHANGE_ID, okjClient],
  [COINCHECK_EXCHANGE_ID, coincheckClient],
  [BITFLYER_EXCHANGE_ID, bitflyerClient],
  [BITBANK_EXCHANGE_ID, bitbankClient],
  [GMO_EXCHANGE_ID, gmoClient],
  [BINANCE_JAPAN_EXCHANGE_ID, binanceJapanClient],
  [BITTRADE_EXCHANGE_ID, bittradeClient],
]);
const defaultInstrumentIds = {
  [DEFAULT_EXCHANGE_ID]: DEFAULT_OKJ_INSTRUMENT_ID,
  [COINCHECK_EXCHANGE_ID]: DEFAULT_COINCHECK_INSTRUMENT_ID,
  [BITFLYER_EXCHANGE_ID]: DEFAULT_BITFLYER_INSTRUMENT_ID,
  [BITBANK_EXCHANGE_ID]: DEFAULT_BITBANK_INSTRUMENT_ID,
  [GMO_EXCHANGE_ID]: DEFAULT_GMO_INSTRUMENT_ID,
  [BINANCE_JAPAN_EXCHANGE_ID]: DEFAULT_BINANCE_JAPAN_INSTRUMENT_ID,
  [BITTRADE_EXCHANGE_ID]: DEFAULT_BITTRADE_INSTRUMENT_ID,
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
const marketDataService = createMarketDataService({
  calculateImpact,
  clientsByExchange,
  defaultInstrumentId: DEFAULT_OKJ_INSTRUMENT_ID,
  getMarketInfo: siteContentService.getMarketInfo,
  getPublicExchanges,
  salesSpreadStore,
  staleAfterMs: OrderBook.STALE_AFTER_MS || 15 * 1000,
  volumeShareStore,
  wsManager,
});
siteContentService.setMarketPageSnapshotLoader((instrumentId) => marketDataService.buildMarketPageSnapshot(
  siteContentService.getMarketInfo(instrumentId)
));

registerPageRoutes(app, {
  publicDir: PUBLIC_DIR,
  siteContentService,
});
registerApiRoutes(app, {
  analyticsAdminService,
  analyticsStore,
  defaultExchangeId: DEFAULT_EXCHANGE_ID,
  getPublicExchanges,
  marketDataService,
  salesSpreadStore,
  siteContentService,
  volumeShareStore,
});
app.use(express.static(PUBLIC_DIR));

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
wireExchangeClient(BITTRADE_EXCHANGE_ID, bittradeClient, 'BitTrade');

const TICKER_FETCH_DELAY_MS = 120;
const VOLUME_REFRESH_INTERVAL_MS = 60 * 60 * 1000;
const STARTUP_VOLUME_REFRESH_DELAY_MS = 8000;
const SALES_SPREAD_REFRESH_INTERVAL_MS = 60 * 60 * 1000;
const STARTUP_SALES_SPREAD_REFRESH_DELAY_MS = 5000;
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
    const exchangeRecordCounts = new Map();
    volumeShareStore.setRefreshStatus({
      running: true,
      startedAt: capturedAt.toISOString(),
      source,
      errors: [],
    });

    for (const exchange of getPublicExchanges()) {
      const client = clientsByExchange.get(exchange.id);
      if (!client || typeof client.fetchTicker !== 'function') continue;

      let capturedCountForExchange = 0;
      for (const market of exchange.markets || []) {
        if (market.status && market.status !== 'active') continue;

        try {
          const rawTicker = await client.fetchTicker(market.instrumentId);
          if (rawTicker) {
            const ticker = wsManager.normalizeTicker({
              ...rawTicker,
              dataSource: rawTicker.dataSource || rawTicker.source || 'rest',
              exchangeId: exchange.id,
              instrumentId: rawTicker.instrument_id || rawTicker.instrumentId || market.instrumentId,
            });
            const record = volumeShareStore.buildRecord(ticker, exchange, market, capturedAt);
            if (record) {
              records.push(record);
              capturedCountForExchange += 1;
            }
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

      exchangeRecordCounts.set(exchange.id, capturedCountForExchange);
      if (capturedCountForExchange === 0) {
        errors.push({
          exchangeId: exchange.id,
          message: 'No ticker records captured for this refresh window.',
        });
      }
    }

    const snapshotCoverage = buildSnapshotCoverage(records, CORE_VOLUME_SNAPSHOT_EXCHANGE_IDS);

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
      exchangeRecordCounts: Object.fromEntries(exchangeRecordCounts),
      missingRequiredExchangeIds: snapshotCoverage.missingRequiredExchangeIds,
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
    const exchangeRecordCounts = new Map();
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
      {
        exchangeId: BITTRADE_EXCHANGE_ID,
        label: 'BitTrade',
        client: bittradeSaleClient,
      },
    ];

    for (const sourceConfig of sources) {
      try {
        const exchange = getPublicExchangeById(sourceConfig.exchangeId, sourceConfig.label);
        const currencies = await sourceConfig.client.fetchCurrencies();
        let capturedCountForExchange = 0;
        for (const item of currencies) {
          const record = salesSpreadStore.buildRecord(item, exchange, capturedAt);
          if (record) {
            records.push(record);
            capturedCountForExchange += 1;
          }
        }
        exchangeRecordCounts.set(sourceConfig.exchangeId, capturedCountForExchange);
        if (capturedCountForExchange === 0) {
          errors.push({
            exchangeId: sourceConfig.exchangeId,
            message: 'No sales spread records captured for this refresh window.',
          });
        }
      } catch (err) {
        exchangeRecordCounts.set(sourceConfig.exchangeId, 0);
        errors.push({
          exchangeId: sourceConfig.exchangeId,
          message: err.message,
        });
      }
    }

    const snapshotCoverage = buildSnapshotCoverage(records, CORE_SALES_SNAPSHOT_EXCHANGE_IDS);

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
      exchangeRecordCounts: Object.fromEntries(exchangeRecordCounts),
      missingRequiredExchangeIds: snapshotCoverage.missingRequiredExchangeIds,
    };
  })().finally(() => {
    salesSpreadRefreshPromise = null;
  });

  return salesSpreadRefreshPromise;
}

function captureVolumeSnapshotFromResult(result, reason, options = {}) {
  const snapshotDecision = shouldCaptureSnapshot(result, CORE_VOLUME_SNAPSHOT_EXCHANGE_IDS);
  if (!snapshotDecision.allowed) {
    if (!result || !Array.isArray(result.records) || result.records.length === 0) return null;
    console.warn(
      `[Volume Share] Skipped ${reason} snapshot because required exchanges were missing: ${snapshotDecision.missingRequiredExchangeIds.join(', ')}`
    );
    return null;
  }
  const capturedAt = new Date(result.capturedAt);
  const volumeDateJst = options.volumeDateJst || VolumeShareStore.getJstDate(capturedAt);

  if (options.skipIfExists && volumeShareStore.hasDailySnapshot(volumeDateJst)) {
    return null;
  }

  return volumeShareStore.captureDaily(result.records, {
    capturedAt: result.capturedAt,
    reason,
    volumeDateJst,
  });
}

async function captureDailyVolumeSnapshot(reason = 'jst-midnight') {
  const result = await refreshAllVolumeTickers(reason);

  return captureVolumeSnapshotFromResult(result, reason, {
    volumeDateJst: VolumeShareStore.getPreviousJstDate(new Date(result.capturedAt)),
  });
}

async function captureDailySalesSpreadSnapshot(reason = 'jst-midnight') {
  const result = await refreshSalesSpreadRecords(reason);

  return captureSalesSpreadSnapshotFromResult(result, reason, {
    spreadDateJst: SalesSpreadStore.getPreviousJstDate(new Date(result.capturedAt)),
  });
}

function captureSalesSpreadSnapshotFromResult(result, reason, options = {}) {
  const snapshotDecision = shouldCaptureSnapshot(result, CORE_SALES_SNAPSHOT_EXCHANGE_IDS);
  if (!snapshotDecision.allowed) {
    if (!result || !Array.isArray(result.records) || result.records.length === 0) return null;
    console.warn(
      `[Sales Spread] Skipped ${reason} snapshot because required exchanges were missing: ${snapshotDecision.missingRequiredExchangeIds.join(', ')}`
    );
    return null;
  }
  const capturedAt = new Date(result.capturedAt);
  const spreadDateJst = options.spreadDateJst || SalesSpreadStore.getJstDate(capturedAt);

  if (options.skipIfExists && salesSpreadStore.hasDailySnapshot(spreadDateJst)) {
    return null;
  }

  return salesSpreadStore.captureDaily(result.records, {
    capturedAt: result.capturedAt,
    reason,
    spreadDateJst,
  });
}

function captureRollingVolumeSnapshot(result, reason = 'refresh-snapshot') {
  if (!result || result.records.length === 0) return;
  const capturedAt = new Date(result.capturedAt);
  const parts = VolumeShareStore.getJstParts(capturedAt);
  // Before 02:00 JST, keep treating the first wake-up as a catch-up for yesterday.
  const isEarlyMorning = parts.hour <= 1;
  const volumeDateJst = isEarlyMorning
    ? VolumeShareStore.getPreviousJstDate(capturedAt)
    : parts.date;
  const existingSnapshot = isEarlyMorning ? volumeShareStore.getDailySnapshot(volumeDateJst) : null;
  const hasClosingSnapshot = existingSnapshot
    && ['jst-midnight', 'early-morning-catchup'].includes(existingSnapshot.reason);

  return captureVolumeSnapshotFromResult(result, isEarlyMorning ? 'early-morning-catchup' : reason, {
    volumeDateJst,
    skipIfExists: hasClosingSnapshot,
  });
}

function captureRollingSalesSpreadSnapshot(result, reason = 'refresh-snapshot') {
  if (!result || result.records.length === 0) return;
  const capturedAt = new Date(result.capturedAt);
  const parts = SalesSpreadStore.getJstParts(capturedAt);
  // Before 02:00 JST, keep treating the first wake-up as a catch-up for yesterday.
  const isEarlyMorning = parts.hour <= 1;
  const spreadDateJst = isEarlyMorning
    ? SalesSpreadStore.getPreviousJstDate(capturedAt)
    : parts.date;
  const existingSnapshot = isEarlyMorning ? salesSpreadStore.getDailySnapshot(spreadDateJst) : null;
  const hasClosingSnapshot = existingSnapshot
    && ['jst-midnight', 'early-morning-catchup'].includes(existingSnapshot.reason);

  return captureSalesSpreadSnapshotFromResult(result, isEarlyMorning ? 'early-morning-catchup' : reason, {
    spreadDateJst,
    skipIfExists: hasClosingSnapshot,
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
      captureRollingVolumeSnapshot(result, 'startup-snapshot');
    } catch (err) {
      console.warn('[Volume Share] Startup refresh failed:', err.message);
    }
  }, STARTUP_VOLUME_REFRESH_DELAY_MS);

  setInterval(async () => {
    try {
      const result = await refreshAllVolumeTickers('hourly');
      captureRollingVolumeSnapshot(result, 'hourly-snapshot');
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
      captureRollingSalesSpreadSnapshot(result, 'startup-snapshot');
    } catch (err) {
      console.warn('[Sales Spread] Startup refresh failed:', err.message);
    }
  }, STARTUP_SALES_SPREAD_REFRESH_DELAY_MS);

  setInterval(async () => {
    try {
      const result = await refreshSalesSpreadRecords('hourly');
      captureRollingSalesSpreadSnapshot(result, 'hourly-snapshot');
    } catch (err) {
      console.warn('[Sales Spread] Hourly refresh failed:', err.message);
    }
  }, SALES_SPREAD_REFRESH_INTERVAL_MS);

  scheduleDailySalesSpreadSnapshot();
}

let runtimeStartPromise = null;
let runtimeStarted = false;
let exchangeClientsStarted = false;
let backgroundJobsStarted = false;

function startRuntime(options = {}) {
  if (runtimeStarted && server.listening) {
    return Promise.resolve(server);
  }

  if (runtimeStartPromise) {
    return runtimeStartPromise;
  }

  const port = options.port ?? process.env.PORT ?? 3000;
  const host = options.host ?? process.env.HOST ?? '0.0.0.0';
  const startClients = options.startClients !== false;
  const startJobs = options.startJobs !== false;
  const shouldLog = options.log !== false;

  runtimeStartPromise = (async () => {
    await storesReadyPromise;

    return new Promise((resolve, reject) => {
      const handleError = (err) => {
        runtimeStartPromise = null;
        server.off('error', handleError);
        reject(err);
      };

      server.once('error', handleError);
      server.listen(port, host, () => {
        server.off('error', handleError);
        runtimeStarted = true;

        const address = server.address();
        const actualHost = typeof address === 'object' && address ? address.address : host;
        const actualPort = typeof address === 'object' && address ? address.port : port;
        const displayHost = actualHost === '0.0.0.0' || actualHost === '::' ? 'localhost' : actualHost;

        if (shouldLog) {
          const storageLabel = USE_NEON_SNAPSHOT_STORAGE ? 'snapshot history: Neon' : 'snapshot history: JSON';
          console.log(`成行取引リアルタイム板シミュレーター running on http://${displayHost}:${actualPort} (${EXCHANGES.map(exchange => exchange.label).join(', ')}; ${storageLabel})`);
        }

        if (startClients && !exchangeClientsStarted) {
          for (const client of clientsByExchange.values()) {
            client.start();
          }
          exchangeClientsStarted = true;
        }

        if (startJobs && !backgroundJobsStarted) {
          scheduleVolumeShareJobs();
          scheduleSalesSpreadJobs();
          backgroundJobsStarted = true;
        }

        resolve(server);
      });
    });
  })().catch((err) => {
    runtimeStartPromise = null;
    throw err;
  });

  return runtimeStartPromise;
}

function stopRuntime() {
  const stopExchangeClients = () => {
    if (!exchangeClientsStarted) return;
    for (const client of clientsByExchange.values()) {
      if (typeof client.stop === 'function') {
        client.stop();
      }
    }
    exchangeClientsStarted = false;
  };

  runtimeStarted = false;
  runtimeStartPromise = null;
  backgroundJobsStarted = false;
  stopExchangeClients();

  return Promise.all([
    volumeShareStore.flushPersistence(),
    salesSpreadStore.flushPersistence(),
  ]).then(() => new Promise((resolve, reject) => {
    wsManager.wss.close();

    if (!server.listening) {
      resolve();
      return;
    }

    server.close((err) => {
      if (err) {
        reject(err);
        return;
      }
      resolve();
    });
  }));
}

module.exports = {
  app,
  server,
  startRuntime,
  stopRuntime,
  stores: {
    analyticsStore,
    salesSpreadStore,
    volumeShareStore,
  },
  wsManager,
  helpers: {
    buildMarketImpactComparison: marketDataService.buildMarketImpactComparison,
    buildMarketPageReport: marketDataService.buildMarketPageReport,
    buildSalesReferenceComparison: marketDataService.buildSalesReferenceComparison,
    normalizeComparisonAmountType: marketDataService.normalizeComparisonAmountType,
    parseRequestNumber: marketDataService.parseRequestNumber,
    sortComparisonRows: marketDataService.sortComparisonRows,
    sortSalesReferenceRows: marketDataService.sortSalesReferenceRows,
  },
};

if (require.main === module) {
  startRuntime().catch((err) => {
    console.error('[server] Failed to start:', err);
    process.exitCode = 1;
  });
}
