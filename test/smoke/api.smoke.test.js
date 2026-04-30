const path = require('path');
const test = require('node:test');
const assert = require('node:assert/strict');

const OrderBook = require('../../lib/orderbook');
const { createTempDir, removeTempDir } = require('../helpers/temp-dir');

const SERVER_PATH = path.resolve(__dirname, '../../server.js');
const TEST_ENV_KEYS = ['ANALYTICS_ADMIN_TOKEN', 'ANALYTICS_ADMIN_TOKEN_HASH', 'DATA_DIR', 'DATABASE_URL', 'NODE_ENV'];

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

function assertCommonDisclosure(body) {
  assert.ok(body.includes('重要な注意事項 / PR表記'));
  assert.ok(body.includes('投資助言ではありません'));
  assert.ok(body.includes('暗号資産は価格変動リスクがあり'));
  assert.ok(body.includes('公開API / WebSocket の取得失敗'));
  assert.ok(body.includes('広告・PR・アフィリエイトリンクが含まれる場合があります'));
  assert.ok(body.includes('キャンペーン情報の最終確認日は'));
}

test('major public APIs return seeded test data over HTTP', async (t) => {
  const tempDir = createTempDir('okj-smoke-');
  const previousEnv = new Map(TEST_ENV_KEYS.map((key) => [key, process.env[key]]));

  process.env.ANALYTICS_ADMIN_TOKEN = 'test-token';
  delete process.env.ANALYTICS_ADMIN_TOKEN_HASH;
  process.env.DATA_DIR = tempDir;
  delete process.env.DATABASE_URL;
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
  assert.ok(homePage.body.includes('国内暗号資産取引所の板・スプレッド・手数料・出来高を横断し'));
  assert.ok(homePage.body.includes('比較ツール'));
  assert.ok(homePage.body.includes('販売所スプレッドを見る'));
  assert.ok(homePage.body.includes('銘柄から探す'));
  assert.ok(homePage.body.includes('調べるハブ'));
  assert.ok(homePage.body.includes('リサーチ導線'));
  assert.ok(homePage.body.includes('取引所リサーチ、銘柄リサーチ、初心者ガイドをまとめて確認'));
  assert.ok(homePage.body.includes('/research#research-exchanges'));
  assert.ok(homePage.body.includes('販売所と取引所の違い、スプレッド、板取引を学ぶ'));
  assert.ok(homePage.body.includes('人気ページ'));
  assert.ok(homePage.body.includes('データ・免責・PR表記'));
  assert.ok(homePage.body.includes('/simulator?market=BTC-JPY&side=buy&amountType=jpy&amount=100000'));
  assert.ok(homePage.body.includes('/learn/exchange-vs-broker'));
  assert.ok(homePage.body.includes('/learn/crypto-fees'));
  assertCommonDisclosure(homePage.body);

  const researchPage = await fetchText(baseUrl, '/research');
  assert.equal(researchPage.status, 200);
  assert.ok(researchPage.body.includes('取引所や銘柄を理解する'));
  assert.ok(researchPage.body.includes('3. リサーチ導線'));
  assert.ok(researchPage.body.includes('取引所リサーチ'));
  assert.ok(researchPage.body.includes('手数料、取扱銘柄、運営会社、財務情報を確認'));
  assert.ok(researchPage.body.includes('銘柄リサーチ'));
  assert.ok(researchPage.body.includes('銘柄の特徴、用途、リスク、対応取引所を確認'));
  assert.ok(researchPage.body.includes('初心者ガイド'));
  assert.ok(researchPage.body.includes('販売所と取引所の違い、スプレッド、板取引を学ぶ'));
  assert.ok(researchPage.body.includes('href="#research-exchanges"'));
  assert.ok(researchPage.body.includes('id="research-markets"'));
  assert.ok(researchPage.body.includes('/learn/spread'));
  assert.ok(researchPage.body.includes('/learn/slippage'));
  assert.ok(researchPage.body.includes('/learn/exchange-company-analysis'));
  assertCommonDisclosure(researchPage.body);

  const learnIndex = await fetchText(baseUrl, '/learn');
  assert.equal(learnIndex.status, 200);
  assert.ok(learnIndex.body.includes('初心者向け暗号資産取引ガイド'));
  assert.ok(learnIndex.body.includes('/learn/exchange-company-analysis'));
  assert.ok(learnIndex.body.includes('/learn/market-order-risk'));
  assert.ok(learnIndex.body.includes('/sales-spread?instrumentId=BTC-JPY'));
  assertCommonDisclosure(learnIndex.body);

  const learnSlippage = await fetchText(baseUrl, '/learn/slippage');
  assert.equal(learnSlippage.status, 200);
  assert.ok(learnSlippage.body.includes('スリッページとは？'));
  assert.ok(learnSlippage.body.includes('/simulator?market=BTC-JPY'));
  assert.ok(learnSlippage.body.includes('/learn/market-order-risk'));
  assertCommonDisclosure(learnSlippage.body);

  const learnLegacy = await fetch(new URL('/articles/slippage', baseUrl), { redirect: 'manual' });
  assert.equal(learnLegacy.status, 301);
  assert.equal(learnLegacy.headers.get('location'), '/learn/slippage');

  const simulatorPage = await fetchText(baseUrl, '/simulator?market=BTC-JPY&side=buy&amountType=jpy&amount=100000');
  assert.equal(simulatorPage.status, 200);
  assert.ok(simulatorPage.body.includes('成行取引リアルタイム板シミュレーター'));
  assert.ok(simulatorPage.body.includes('app.js?v='));
  assertCommonDisclosure(simulatorPage.body);

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
  assert.equal(marketPage.body.snapshot.exchangeCount, 7);
  assert.equal(marketPage.body.snapshot.bestAsk.exchangeLabel, 'OKJ');
  assert.equal(marketPage.body.snapshot.tightestSalesSpread.exchangeLabel, 'Coincheck');

  const marketHtml = await fetchText(baseUrl, '/markets/BTC-JPY');
  assert.equal(marketHtml.status, 200);
  assert.ok(marketHtml.body.includes('1. 銘柄の結論カード'));
  assert.ok(marketHtml.body.includes('BTCの要点'));
  assert.ok(marketHtml.body.includes('BTCは国内取引所で流動性が高い一方、販売所で購入する場合はスプレッドに注意が必要です。'));
  assert.ok(marketHtml.body.includes('2. 国内取引所での比較'));
  assert.ok(marketHtml.body.includes('BTC/JPY は何に使われる？'));
  assert.ok(marketHtml.body.includes('3. 銘柄プロフィール'));
  assert.ok(marketHtml.body.includes('4. 取引前チェック'));
  assert.ok(marketHtml.body.includes('BTC/JPY 比較サマリー'));
  assert.ok(marketHtml.body.includes('10万円購入時の最安候補'));
  assert.ok(marketHtml.body.includes('5. 関連ページ'));
  assert.ok(marketHtml.body.includes('/simulator?market=BTC-JPY'));
  assert.ok(marketHtml.body.includes('/volume-share?instrumentId=BTC-JPY'));
  assert.ok(marketHtml.body.includes('/sales-spread?instrumentId=BTC-JPY'));
  assert.ok(marketHtml.body.includes('#market-exchange-comparison'));
  assert.ok(marketHtml.body.includes('/exchanges/okj'));
  assert.ok(marketHtml.body.includes('/about'));
  assert.ok(marketHtml.body.includes('データ定義と免責'));
  assert.ok(marketHtml.body.includes('免責とデータ取得'));
  assertCommonDisclosure(marketHtml.body);

  const marketsHtml = await fetchText(baseUrl, '/markets');
  assert.equal(marketsHtml.status, 200);
  assert.ok(marketsHtml.body.includes('国内取引所で買える暗号資産を、対応取引所数・板の有無・販売所スプレッド・出来高の観点で比較できます。'));
  assert.ok(marketsHtml.body.includes('カテゴリから探す'));
  assert.ok(marketsHtml.body.includes('主要銘柄'));
  assert.ok(marketsHtml.body.includes('コスト比較を見る'));
  assert.ok(marketsHtml.body.includes('購入前に実効コストを確認することが重要です。'));
  assertCommonDisclosure(marketsHtml.body);

  const exchangesHtml = await fetchText(baseUrl, '/exchanges');
  assert.equal(exchangesHtml.status, 200);
  assert.ok(exchangesHtml.body.includes('取引所一覧'));
  assert.ok(exchangesHtml.body.includes('nav-menu--grouped'));
  assert.ok(exchangesHtml.body.includes('/exchanges/bitflyer'));
  assert.ok(exchangesHtml.body.includes('/exchanges/gmo-coin'));
  assertCommonDisclosure(exchangesHtml.body);

  const exchangeHtml = await fetchText(baseUrl, '/exchanges/okj');
  assert.equal(exchangeHtml.status, 200);
  assert.ok(exchangeHtml.body.includes('取引所詳細'));
  assert.ok(exchangeHtml.body.includes('OKCoin Japan'));
  assert.ok(exchangeHtml.body.includes('信頼性・運営会社分析'));
  assert.ok(exchangeHtml.body.includes('この取引所は信頼できる？'));
  assert.ok(exchangeHtml.body.includes('財務・運営会社分析'));
  assert.ok(exchangeHtml.body.includes('板取引対応銘柄'));
  assert.ok(exchangeHtml.body.includes('販売所対応銘柄'));
  assert.ok(exchangeHtml.body.includes('公式リンク / 紹介リンク'));
  assert.ok(exchangeHtml.body.includes('/simulator?exchange=okj&amp;market=BTC-JPY'));
  assert.ok(exchangeHtml.body.includes('/campaigns'));
  assertCommonDisclosure(exchangeHtml.body);

  const gmoLegacy = await fetch(new URL('/exchanges/gmo', baseUrl), { redirect: 'manual' });
  assert.equal(gmoLegacy.status, 301);
  assert.equal(gmoLegacy.headers.get('location'), '/exchanges/gmo-coin');

  const gmoHtml = await fetchText(baseUrl, '/exchanges/gmo-coin');
  assert.equal(gmoHtml.status, 200);
  assert.ok(gmoHtml.body.includes('GMO Coin'));
  assert.ok(gmoHtml.body.includes('キャンペーン・プログラム一覧を公式で確認'));

  const aboutHtml = await fetchText(baseUrl, '/about');
  assert.equal(aboutHtml.status, 200);
  assert.ok(aboutHtml.body.includes('id="data-sources"'));
  assert.ok(aboutHtml.body.includes('id="pr-disclosure"'));
  assert.ok(aboutHtml.body.includes('id="disclaimer"'));
  assertCommonDisclosure(aboutHtml.body);

  const orderBookGuide = await fetchText(baseUrl, '/learn/order-book-trading');
  assert.equal(orderBookGuide.status, 200);
  assert.ok(orderBookGuide.body.includes('板取引とは？'));
  assert.ok(orderBookGuide.body.includes('注文板'));
  assert.ok(orderBookGuide.body.includes('/simulator?market=BTC-JPY'));
  assertCommonDisclosure(orderBookGuide.body);

  const volumeSharePage = await fetchText(baseUrl, '/volume-share?instrumentId=BTC-JPY');
  assert.equal(volumeSharePage.status, 200);
  assertCommonDisclosure(volumeSharePage.body);

  const salesSpreadPage = await fetchText(baseUrl, '/sales-spread?instrumentId=BTC-JPY');
  assert.equal(salesSpreadPage.status, 200);
  assert.ok(salesSpreadPage.body.includes('販売所スプレッドとは？'));
  assert.ok(salesSpreadPage.body.includes('現在スプレッドが狭い銘柄TOP10'));
  assert.ok(salesSpreadPage.body.includes('BTC/JPYの取引所コストを確認する'));
  assertCommonDisclosure(salesSpreadPage.body);

  const campaignsPage = await fetchText(baseUrl, '/campaigns');
  assert.equal(campaignsPage.status, 200);
  assert.ok(campaignsPage.body.includes('キャンペーン一覧'));
  assert.ok(campaignsPage.body.includes('GMOコイン'));
  assert.ok(campaignsPage.body.includes('紹介リンク/アフィリエイトリンク'));
  assert.ok(campaignsPage.body.includes('PR / アフィリエイト表記'));
  assert.ok(campaignsPage.body.includes('/campaigns/gmo-coin'));
  assertCommonDisclosure(campaignsPage.body);

  const gmoCampaignLegacy = await fetch(new URL('/campaigns/gmo', baseUrl), { redirect: 'manual' });
  assert.equal(gmoCampaignLegacy.status, 301);
  assert.equal(gmoCampaignLegacy.headers.get('location'), '/campaigns/gmo-coin');

  const gmoCampaignPage = await fetchText(baseUrl, '/campaigns/gmo-coin');
  assert.equal(gmoCampaignPage.status, 200);
  assert.ok(gmoCampaignPage.body.includes('キャンペーン詳細'));
  assert.ok(gmoCampaignPage.body.includes('1. キャンペーン概要'));
  assert.ok(gmoCampaignPage.body.includes('6. この取引所のコスト比較'));
  assert.ok(gmoCampaignPage.body.includes('キャンペーン内容だけでなく、手数料・スプレッド・板の厚みも確認した上で利用を検討してください。'));
  assert.ok(gmoCampaignPage.body.includes('/simulator?exchange=gmo&amp;market=BTC-JPY'));
  assertCommonDisclosure(gmoCampaignPage.body);

  const adminAnalyticsPage = await fetchText(baseUrl, '/admin-analytics.html');
  assert.equal(adminAnalyticsPage.status, 200);
  assert.ok(adminAnalyticsPage.body.includes('アクセス解析'));
  assertCommonDisclosure(adminAnalyticsPage.body);

  const sitemap = await fetchText(baseUrl, '/sitemap.xml');
  assert.equal(sitemap.status, 200);
  assert.ok(sitemap.body.includes('/research'));
  assert.ok(sitemap.body.includes('/learn/how-to-compare-exchanges'));

  const rss = await fetchText(baseUrl, '/rss.xml');
  assert.equal(rss.status, 200);
  assert.ok(rss.body.includes('/learn/crypto-fees'));

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
  assert.equal(impactComparison.body.rows[0].status, 'fresh');
  assert.equal(impactComparison.body.rows[0].rank, 1);
  assert.ok(impactComparison.body.meta.readyCount >= 2);

  const salesReference = await fetchJson(
    baseUrl,
    '/api/sales-reference-comparison?instrumentId=BTC-JPY&side=buy&amountType=base&amount=0.4'
  );
  assert.equal(salesReference.status, 200);
  assert.ok(salesReference.body.meta.baselineExchangeId);
  assert.equal(salesReference.body.rows.length, 2);
});
