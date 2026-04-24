const path = require('path');
const test = require('node:test');
const assert = require('node:assert/strict');

const OrderBook = require('../../lib/orderbook');
const { createTempDir, removeTempDir } = require('../helpers/temp-dir');

const SERVER_PATH = path.resolve(__dirname, '../../server.js');
const TEST_ENV_KEYS = ['ANALYTICS_ADMIN_TOKEN', 'ANALYTICS_ADMIN_TOKEN_HASH', 'DATA_DIR', 'NODE_ENV'];

function volumeRecord(exchangeId, exchangeLabel, instrumentId, quoteVolume24h, capturedAt) {
  return {
    exchangeId,
    exchangeLabel,
    instrumentId,
    instrumentLabel: instrumentId.replace('-', '/'),
    baseCurrency: instrumentId.split('-')[0],
    quoteCurrency: 'JPY',
    baseVolume24h: quoteVolume24h / 100,
    quoteVolume24h,
    quoteVolume24hEstimated: false,
    last: 100,
    tickerTimestamp: capturedAt,
    capturedAt,
    dataSource: 'rest',
  };
}

function salesRecord(exchangeId, exchangeLabel, instrumentId, midPrice, spreadPct, capturedAt) {
  const spread = midPrice * (spreadPct / 100);
  return {
    exchangeId,
    exchangeLabel,
    instrumentId,
    instrumentLabel: instrumentId.replace('-', '/'),
    baseCurrency: instrumentId.split('-')[0],
    quoteCurrency: 'JPY',
    currencyFullName: instrumentId.split('-')[0],
    buyPrice: midPrice + spread / 2,
    sellPrice: midPrice - spread / 2,
    midPrice,
    spread,
    spreadPct,
    quotePrecision: 0,
    isOnline: true,
    isWidgetOpen: true,
    priceTimestamp: capturedAt,
    capturedAt,
    dataSource: 'rest',
    isEstimated: false,
  };
}

function createBook(exchangeId, instrumentId, asks, bids) {
  return new OrderBook({
    asks: asks.map(([price, quantity, orders = 1]) => [String(price), String(quantity), String(orders)]),
    bids: bids.map(([price, quantity, orders = 1]) => [String(price), String(quantity), String(orders)]),
    exchangeId,
    instrumentId,
    source: 'test',
    timestamp: new Date().toISOString(),
  });
}

function restoreEnv(previousEnv) {
  for (const [key, value] of previousEnv.entries()) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
}

async function fetchJson(baseUrl, route) {
  const response = await fetch(new URL(route, baseUrl));
  const body = await response.json();
  return {
    status: response.status,
    body,
  };
}

async function fetchText(baseUrl, route) {
  const response = await fetch(new URL(route, baseUrl));
  const body = await response.text();
  return {
    status: response.status,
    body,
  };
}

test('major public APIs return seeded test data over HTTP', async (t) => {
  const tempDir = createTempDir('okj-smoke-');
  const previousEnv = new Map(TEST_ENV_KEYS.map((key) => [key, process.env[key]]));

  process.env.ANALYTICS_ADMIN_TOKEN = 'test-token';
  delete process.env.ANALYTICS_ADMIN_TOKEN_HASH;
  process.env.DATA_DIR = tempDir;
  process.env.NODE_ENV = 'test';

  delete require.cache[SERVER_PATH];
  const runtime = require(SERVER_PATH);

  t.after(async () => {
    await runtime.stopRuntime().catch(() => {});
    delete require.cache[SERVER_PATH];
    restoreEnv(previousEnv);
    removeTempDir(tempDir);
  });

  const capturedAt = '2026-04-23T00:00:00.000Z';
  runtime.stores.volumeShareStore.captureDaily([
    volumeRecord('okj', 'OKJ', 'BTC-JPY', 120, '2026-04-22T00:00:00.000Z'),
    volumeRecord('coincheck', 'Coincheck', 'BTC-JPY', 80, '2026-04-22T00:00:00.000Z'),
  ], {
    capturedAt: '2026-04-22T00:00:00.000Z',
    volumeDateJst: '2026-04-22',
    reason: 'test',
  });
  runtime.stores.volumeShareStore.replaceLatest([
    volumeRecord('okj', 'OKJ', 'BTC-JPY', 150, capturedAt),
    volumeRecord('coincheck', 'Coincheck', 'BTC-JPY', 100, capturedAt),
  ], 'test', {
    capturedAt,
  });

  runtime.stores.salesSpreadStore.captureDaily([
    salesRecord('okj', 'OKJ', 'BTC-JPY', 100, 1.2, '2026-04-22T00:00:00.000Z'),
    salesRecord('coincheck', 'Coincheck', 'BTC-JPY', 101, 1.0, '2026-04-22T00:00:00.000Z'),
  ], {
    capturedAt: '2026-04-22T00:00:00.000Z',
    spreadDateJst: '2026-04-22',
    reason: 'test',
  });
  runtime.stores.salesSpreadStore.replaceLatest([
    salesRecord('okj', 'OKJ', 'BTC-JPY', 100, 1.1, capturedAt),
    salesRecord('coincheck', 'Coincheck', 'BTC-JPY', 101, 0.9, capturedAt),
  ], 'test', {
    capturedAt,
  });

  runtime.wsManager.latestBooks.set(
    runtime.wsManager.marketKey('okj', 'BTC-JPY'),
    createBook('okj', 'BTC-JPY', [[100, 0.5], [101, 1.0]], [[99, 0.5], [98, 1.0]])
  );
  runtime.wsManager.latestBooks.set(
    runtime.wsManager.marketKey('coincheck', 'BTC-JPY'),
    createBook('coincheck', 'BTC-JPY', [[100.5, 0.5], [101.5, 1.0]], [[99.5, 0.5], [98.5, 1.0]])
  );

  await runtime.startRuntime({
    host: '127.0.0.1',
    port: 0,
    startClients: false,
    startJobs: false,
    log: false,
  });

  const address = runtime.server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;

  const health = await fetchJson(baseUrl, '/healthz');
  assert.equal(health.status, 200);
  assert.equal(health.body.status, 'ok');

  const homePage = await fetchText(baseUrl, '/');
  assert.equal(homePage.status, 200);
  assert.ok(homePage.body.includes('/markets?q={search_term_string}'));
  assert.ok(homePage.body.includes('国内暗号資産取引所の板・スプレッド・手数料・キャンペーンを比較し'));
  assert.ok(homePage.body.includes('/simulator?market=BTC-JPY&side=buy&amountType=jpy&amount=100000'));

  const simulatorPage = await fetchText(baseUrl, '/simulator?market=BTC-JPY&side=buy&amountType=jpy&amount=100000');
  assert.equal(simulatorPage.status, 200);
  assert.ok(simulatorPage.body.includes('成行取引リアルタイム板シミュレーター'));
  assert.ok(simulatorPage.body.includes('app.js?v='));

  const exchanges = await fetchJson(baseUrl, '/api/exchanges');
  assert.equal(exchanges.status, 200);
  assert.equal(exchanges.body.defaultExchangeId, 'okj');
  assert.ok(Array.isArray(exchanges.body.exchanges));

  const marketIndex = await fetchJson(baseUrl, '/api/markets');
  assert.equal(marketIndex.status, 200);
  assert.ok(marketIndex.body.markets.some((market) => market.instrumentId === 'BTC-JPY'));

  const marketPage = await fetchJson(baseUrl, '/api/markets/BTC-JPY');
  assert.equal(marketPage.status, 200);
  assert.equal(marketPage.body.market.instrumentId, 'BTC-JPY');
  const okjOrderbook = marketPage.body.orderbooks.find((row) => row.exchangeId === 'okj');
  assert.equal(okjOrderbook.status, 'fresh');

  const marketHtml = await fetchText(baseUrl, '/markets/BTC-JPY');
  assert.equal(marketHtml.status, 200);
  assert.ok(marketHtml.body.includes('次に見る'));
  assert.ok(marketHtml.body.includes('/simulator?market=BTC-JPY'));
  assert.ok(marketHtml.body.includes('/volume-share?instrumentId=BTC-JPY'));
  assert.ok(marketHtml.body.includes('/sales-spread?instrumentId=BTC-JPY'));
  assert.ok(marketHtml.body.includes('/articles/about'));
  assert.ok(marketHtml.body.includes('データ定義と免責'));
  assert.ok(marketHtml.body.includes('免責とデータ取得'));

  const volumeSharePage = await fetchText(baseUrl, '/volume-share?instrumentId=BTC-JPY');
  assert.equal(volumeSharePage.status, 200);

  const salesSpreadPage = await fetchText(baseUrl, '/sales-spread?instrumentId=BTC-JPY');
  assert.equal(salesSpreadPage.status, 200);

  const volumeShare = await fetchJson(baseUrl, '/api/volume-share?window=7d');
  assert.equal(volumeShare.status, 200);
  assert.equal(volumeShare.body.meta.source, 'daily-snapshots');
  assert.equal(volumeShare.body.rows.length, 2);

  const volumeHistory = await fetchJson(baseUrl, '/api/volume-share/history?window=30d');
  assert.equal(volumeHistory.status, 200);
  assert.equal(volumeHistory.body.rows.length, 2);

  const salesSpread = await fetchJson(baseUrl, '/api/sales-spread');
  assert.equal(salesSpread.status, 200);
  assert.equal(salesSpread.body.rows.length, 2);

  const salesHistory = await fetchJson(baseUrl, '/api/sales-spread/history?window=30d');
  assert.equal(salesHistory.status, 200);
  assert.equal(salesHistory.body.rows.length, 2);

  const impactComparison = await fetchJson(
    baseUrl,
    '/api/market-impact-comparison?instrumentId=BTC-JPY&side=buy&amountType=base&amount=0.4'
  );
  assert.equal(impactComparison.status, 200);
  assert.equal(impactComparison.body.rows[0].exchangeId, 'okj');
  assert.equal(impactComparison.body.rows[0].rank, 1);
  assert.ok(impactComparison.body.meta.readyCount >= 2);

  const salesReference = await fetchJson(
    baseUrl,
    '/api/sales-reference-comparison?instrumentId=BTC-JPY&side=buy&amountType=base&amount=0.4'
  );
  assert.equal(salesReference.status, 200);
  assert.equal(salesReference.body.meta.baselineExchangeId, 'okj');
  assert.equal(salesReference.body.rows.length, 2);
});
