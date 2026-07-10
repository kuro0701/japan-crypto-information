const path = require('path');
const http = require('http');
const test = require('node:test');
const assert = require('node:assert/strict');

const OrderBook = require('../../lib/orderbook');
const { createTempDir, removeTempDir } = require('../helpers/temp-dir');

const SERVER_PATH = path.resolve(__dirname, '../../server.js');
const TEST_ENV_KEYS = [
  'ANALYTICS_ADMIN_TOKEN',
  'ANALYTICS_ADMIN_TOKEN_HASH',
  'BINANCE_JAPAN_REFERRAL_URL',
  'BITBANK_REFERRAL_URL',
  'BITFLYER_REFERRAL_URL',
  'BITTRADE_REFERRAL_URL',
  'COINCHECK_REFERRAL_URL',
  'DATA_DIR',
  'DATABASE_URL',
  'GMO_COIN_REFERRAL_URL',
  'GOOGLE_CLIENT_EMAIL',
  'GOOGLE_PRIVATE_KEY',
  'GOOGLE_SERVICE_ACCOUNT_EMAIL',
  'GOOGLE_SHEETS_PRIVATE_KEY',
  'GOOGLE_SHEETS_SERVICE_ACCOUNT_EMAIL',
  'GOOGLE_SHEETS_SERVICE_ACCOUNT_JSON',
  'GOOGLE_SHEETS_SERVICE_ACCOUNT_JSON_BASE64',
  'GOOGLE_SHEETS_SHEET_NAME',
  'GOOGLE_SHEETS_SPREADSHEET_ID',
  'LEGACY_HOSTS',
  'NODE_ENV',
  'OKJ_REFERRAL_URL',
  'SITE_ORIGIN',
  'SNAPSHOT_STORAGE',
];
const COINCHECK_AFFILIATE_URL = 'https://h.accesstrade.net/sp/cc?rk=0100nerr00osx0';
const COINCHECK_TRACKING_PIXEL_URL = 'https://h.accesstrade.net/sp/rr?rk=0100nerr00osx0';
const GMO_COIN_AFFILIATE_URL = 'https://h.accesstrade.net/sp/cc?rk=0100mtgp00osx0';
const GMO_COIN_TRACKING_PIXEL_URL = 'https://h.accesstrade.net/sp/rr?rk=0100mtgp00osx0';
const OKJ_REFERRAL_URL_ESCAPED = 'https://www.okcoin.jp/account/join?invitation=C250678&amp;type=0';
const BITFLYER_REFERRAL_URL_ESCAPED = 'https://bitflyer.com/invitation?id=ml1wjtkl&amp;lang=ja-JP';
const BINANCE_JAPAN_REFERRAL_URL = 'https://s.binance.com/OKkHnAGC?ref=GRO_55250_0VBAH';
const BITTRADE_REFERRAL_URL = 'https://www.bittrade.co.jp/ja-jp/register/?invite_code=tHc3p';

function volumeRecord(exchangeId, exchangeLabel, instrumentId, quoteVolume24h, capturedAt, overrides = {}) {
  return {
    exchangeId,
    exchangeLabel,
    instrumentId,
    instrumentLabel: overrides.instrumentLabel || instrumentId.replace('-', '/'),
    baseCurrency: overrides.baseCurrency || instrumentId.split('-')[0],
    quoteCurrency: 'JPY',
    marketType: overrides.marketType || 'spot',
    marketTypeLabel: overrides.marketTypeLabel || null,
    derivativeType: overrides.derivativeType || null,
    underlyingInstrumentId: overrides.underlyingInstrumentId || null,
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

async function fetchJson(baseUrl, route, init) {
  const response = await fetch(new URL(route, baseUrl), init);
  const body = await response.json();
  return {
    headers: response.headers,
    status: response.status,
    body,
  };
}

async function fetchText(baseUrl, route, init) {
  const response = await fetch(new URL(route, baseUrl), init);
  const body = await response.text();
  return {
    headers: response.headers,
    status: response.status,
    body,
  };
}

function requestWithHost(baseUrl, route, host) {
  const url = new URL(route, baseUrl);
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: url.hostname,
      port: url.port,
      path: `${url.pathname}${url.search}`,
      method: 'GET',
      headers: {
        Host: host,
      },
    }, (res) => {
      res.resume();
      res.on('end', () => resolve({
        headers: res.headers,
        status: res.statusCode,
      }));
    });
    req.on('error', reject);
    req.end();
  });
}

function assertCommonDisclosure(body) {
  assert.ok(body.includes('サイトのご利用にあたって（免責事項・PR表記）'));
  assert.ok(body.includes('投資助言ではありません'));
  assert.ok(body.includes('暗号資産は価格変動リスクがあり'));
  assert.ok(body.includes('公開API / WebSocket の取得失敗'));
  assert.ok(body.includes('広告・PR・アフィリエイトリンクが含まれる場合があります'));
  assert.ok(body.includes('各取引所の公式サイトで最新の手数料、本人確認、対象サービス、注意事項を確認してください'));
}

function assertExchangeDetailReferralCtas(body, href) {
  assert.ok(body.includes('class="exchange-hero-referral"'));
  assert.ok(body.includes(`class="exchange-hero-referral__button" href="${href}"`));
  assert.ok(body.includes('紹介条件を見る'));
  assert.ok(body.includes(`class="exchange-check-order__link exchange-check-order__link--pr" href="${href}"`));
  assert.ok(body.includes('PRリンクで確認'));
}

function assertHomeDisclosure(body) {
  assert.ok(body.includes('サイトのご利用にあたって（免責事項・PR表記）'));
  assert.ok(body.includes('投資判断について'));
  assert.ok(body.includes('当サイトの情報は比較・情報提供を目的としており、投資助言ではありません。'));
  assert.ok(body.includes('データについて'));
  assert.ok(body.includes('実際の約定価格を保証するものではありません。'));
  assert.ok(body.includes('広告・PRについて'));
  assert.ok(body.includes('広告の有無によって比較ロジックや掲載順位を変更することはありません。'));
}

function assertGoogleTag(body) {
  assert.equal((body.match(/gtag\/js\?id=G-567R0GYNVQ/g) || []).length, 1);
  assert.ok(body.includes("gtag('config', 'G-567R0GYNVQ')"));
  assert.ok(body.indexOf('<head>') < body.indexOf('gtag/js?id=G-567R0GYNVQ'));
}

test('major public APIs return seeded test data over HTTP', async (t) => {
  const tempDir = createTempDir('okj-smoke-');
  const previousEnv = new Map(TEST_ENV_KEYS.map((key) => [key, process.env[key]]));

  for (const key of TEST_ENV_KEYS) {
    delete process.env[key];
  }
  process.env.ANALYTICS_ADMIN_TOKEN = 'test-token';
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
  const latestVolumeRecords = [
    volumeRecord('okj', 'OKJ', 'BTC-JPY', 150, capturedAt),
    volumeRecord('coincheck', 'Coincheck', 'BTC-JPY', 100, capturedAt),
    volumeRecord('bitflyer', 'bitFlyer', 'BTC-CFD-JPY', 400, capturedAt, {
      instrumentLabel: 'BTC-CFD/JPY',
      marketType: 'derivative',
      marketTypeLabel: 'Crypto CFD',
      derivativeType: 'cfd',
      underlyingInstrumentId: 'BTC-JPY',
    }),
    volumeRecord('gmo', 'GMOコイン', 'ETH-CFD-JPY', 300, capturedAt, {
      instrumentLabel: 'ETH-CFD/JPY',
      marketType: 'derivative',
      marketTypeLabel: '暗号資産FX',
      derivativeType: 'cfd',
      underlyingInstrumentId: 'ETH-JPY',
    }),
  ];
  runtime.stores.volumeShareStore.replaceLatest(latestVolumeRecords, 'test', {
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
  assert.equal(health.headers.get('cache-control'), 'no-store');

  const legacyRedirect = await requestWithHost(baseUrl, '/learn/spread?utm_source=old-host', 'japan-crypto-information.onrender.com');
  assert.equal(legacyRedirect.status, 301);
  assert.equal(legacyRedirect.headers.location, 'https://get-crypto.org/learn/spread?utm_source=old-host');
  assert.equal(legacyRedirect.headers['cache-control'], 'public, max-age=3600');

  const cloudflareHomePage = await fetchText(baseUrl, '/', {
    headers: {
      'x-forwarded-host': 'get-crypto.org',
      'x-forwarded-proto': 'https',
    },
  });
  assert.equal(cloudflareHomePage.status, 200);
  assert.equal(cloudflareHomePage.headers.get('cache-control'), 'public, max-age=0, s-maxage=300, stale-while-revalidate=86400');
  assert.equal(cloudflareHomePage.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(cloudflareHomePage.headers.get('referrer-policy'), 'strict-origin-when-cross-origin');
  assert.equal(cloudflareHomePage.headers.get('strict-transport-security'), 'max-age=15552000');
  assert.equal(cloudflareHomePage.headers.get('x-powered-by'), null);
  assert.ok(cloudflareHomePage.body.includes('<link rel="canonical" href="https://get-crypto.org/">'));

  const homePage = await fetchText(baseUrl, '/');
  assert.equal(homePage.status, 200);
  [
    '取引所（板）のコスト計算',
    '販売所のスプレッド比較',
    '出来高・流動性（取引の活発さ）',
    'レバレッジ（FX・CFD）比較',
    '財務・安全性データの比較',
    '取引手数料の比較',
    '日本円の入出金手数料',
    '暗号資産の送金（出金）コスト',
    '銘柄深掘り一覧',
    'ビットコイン（BTC）',
    'イーサリアム（ETH）',
    'リップル（XRP）',
    'ソラナ（SOL）',
    '出来高が多い銘柄',
    'スプレッドが広い銘柄',
    'すべての取引所を見る',
    'bitFlyer（ビットフライヤー）',
    'Coincheck（コインチェック）',
    'bitbank（ビットバンク）',
    '初心者ガイド トップ',
    '【重要】販売所と取引所の違い',
    'スプレッド（実質手数料）とは？',
    '板取引の仕組みとやり方',
    '失敗しない！10万円分の買い方',
    'なぜ販売所は損しやすいのか？',
    '失敗しない取引所の選び方と口座開設ガイド',
    'PR・広告表記について',
    '免責事項・利用規約',
  ].forEach((label) => {
    assert.ok(homePage.body.includes(label), `home navigation includes ${label}`);
  });
  assert.ok(homePage.body.includes('/markets?q={search_term_string}'));
  assert.ok(homePage.body.includes('国内暗号資産取引所の'));
  assert.ok(homePage.body.includes('「実質コスト」を比較'));
  assert.ok(homePage.body.includes('取引所の板情報・スプレッド・各種手数料のデータを総合し'));
  assert.ok(homePage.body.includes('比較ツール'));
  assert.ok(homePage.body.includes('10万円分のBTC比較を見る'));
  assert.ok(homePage.body.includes('販売所のスプレッド（手数料）を比較'));
  assert.ok(homePage.body.includes('銘柄から探す'));
  assert.ok(homePage.body.includes('その場で試す'));
  assert.ok(homePage.body.includes('いくら分を買うと？'));
  assert.ok(homePage.body.includes('BTC販売所スプレッド最安'));
  assert.ok(homePage.body.includes('専門用語をやさしく表示'));
  assert.ok(homePage.body.includes('初心者モードをONにする'));
  assert.ok(homePage.body.includes('目的から選ぶ'));
  assert.ok(homePage.body.includes('コストを比較'));
  assert.ok(homePage.body.includes('基礎を学ぶ'));
  assert.ok(homePage.body.includes('銘柄を調べる'));
  assert.ok(homePage.body.includes('リサーチ総合ページ'));
  assert.ok(homePage.body.includes('取引所・銘柄をくわしく調べる'));
  assert.ok(homePage.body.includes('取引所や銘柄の詳細、初心者ガイドなどをまとめて確認'));
  assert.ok(homePage.body.includes('/research#research-exchanges'));
  assert.ok(homePage.body.includes('販売所と取引所の違い、スプレッドの仕組みなどを基礎から学ぶ'));
  assert.ok(homePage.body.includes('サイトのご利用にあたって（免責事項・PR表記）'));
  assert.ok(homePage.body.includes('ビットコイン（BTC）'));
  assert.ok(homePage.body.includes('イーサリアム（ETH）'));
  assert.ok(homePage.body.includes('/simulator?market=BTC-JPY&side=buy&amountType=jpy&amount=100000'));
  assert.ok(homePage.body.includes('/learn/exchange-vs-broker'));
  assert.ok(homePage.body.includes('/learn/crypto-fees'));
  assert.ok(homePage.body.includes('/markets/BTC-JPY'));
  assert.ok(homePage.body.includes('/markets/ETH-JPY'));
  assertHomeDisclosure(homePage.body);
  assertGoogleTag(homePage.body);

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
  assert.ok(researchPage.body.includes('/learn/crypto-withdrawal-fees'));
  assertCommonDisclosure(researchPage.body);
  assertGoogleTag(researchPage.body);

  const learnIndex = await fetchText(baseUrl, '/learn');
  assert.equal(learnIndex.status, 200);
  assert.ok(learnIndex.body.includes('初心者向け暗号資産取引ガイド'));
  assert.ok(learnIndex.body.includes('/learn/exchange-company-analysis'));
  assert.ok(learnIndex.body.includes('/learn/market-order-risk'));
  assert.ok(learnIndex.body.includes('/learn/buying-100k-points'));
  assert.ok(learnIndex.body.includes('/learn/broker-loss-reasons'));
  assert.ok(learnIndex.body.includes('/learn/exchange-checklist'));
  assert.ok(learnIndex.body.includes('暗号資産の手数料の見方'));
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

  const articleIndex = await fetchText(baseUrl, '/articles');
  assert.equal(articleIndex.status, 200);
  assert.ok(articleIndex.body.includes('銘柄記事ライブラリ'));
  assert.ok(articleIndex.body.includes('/articles/btc'));
  assert.ok(articleIndex.body.includes('/articles/eth'));
  assert.ok(articleIndex.body.includes('ビットコインとは？仕組み・歴史・税金・リスクを初心者向けに解説'));
  assertCommonDisclosure(articleIndex.body);

  const btcArticle = await fetchText(baseUrl, '/articles/btc');
  assert.equal(btcArticle.status, 200);
  assert.ok(btcArticle.body.includes('ビットコインとは？仕組み・歴史・税金・リスクを初心者向けに解説'));
  assert.ok(btcArticle.body.includes('調査前提とデータの見方'));
  assert.ok(btcArticle.body.includes('鍵・ウォレット・保管方法'));
  assert.ok(btcArticle.body.includes('環境負荷の論点'));
  assert.ok(btcArticle.body.includes('主要法域の比較'));
  assert.ok(btcArticle.body.includes('/markets/BTC-JPY'));
  assert.ok(btcArticle.body.includes('/articles">記事</a>'));
  assertCommonDisclosure(btcArticle.body);

  const ethArticle = await fetchText(baseUrl, '/articles/eth');
  assert.equal(ethArticle.status, 200);
  assert.ok(ethArticle.body.includes('イーサリアム（ETH）総合分析'));
  assert.ok(ethArticle.body.includes('エグゼクティブサマリー'));
  assert.ok(ethArticle.body.includes('技術的基盤'));
  assert.ok(ethArticle.body.includes('経済設計'));
  assert.ok(ethArticle.body.includes('投資・運用上の示唆'));
  assert.ok(ethArticle.body.includes('class="article-mermaid"'));
  assert.ok(ethArticle.body.includes('https://ethereum.org/en/roadmap/'));
  assert.ok(ethArticle.body.includes('/markets/ETH-JPY'));
  assert.ok(!ethArticle.body.includes('cite'));
  assertCommonDisclosure(ethArticle.body);

  const simulatorPage = await fetchText(baseUrl, '/simulator?market=BTC-JPY&side=buy&amountType=jpy&amount=100000');
  assert.equal(simulatorPage.status, 200);
  assert.ok(simulatorPage.body.includes('取引コスト計算（板シミュレーター）'));
  assert.ok(simulatorPage.body.includes('app.js?v='));
  assert.ok(simulatorPage.body.includes('/learn/order-book-trading'));
  assert.ok(simulatorPage.body.includes('/learn/buying-100k-points'));
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
  assert.equal(marketPage.body.snapshot.fundingSupport.supportedCount, 7);
  assert.ok(Array.isArray(marketPage.body.domesticComparison.rows));
  assert.ok(marketPage.body.domesticComparison.rows.some((row) => (
    row.exchangeId === 'okj'
    && row.cost100k
    && row.salesSpread
    && row.funding
  )));

  const marketHtml = await fetchText(baseUrl, '/markets/BTC-JPY');
  assert.equal(marketHtml.status, 200);
  assert.ok(marketHtml.body.includes('1. 銘柄の結論カード'));
  assert.ok(marketHtml.body.includes('data-info-layer="top"'));
  assert.ok(marketHtml.body.includes('data-info-layer="middle"'));
  assert.ok(marketHtml.body.includes('data-info-layer="bottom"'));
  assert.ok(marketHtml.body.includes('BTCの要点'));
  assert.ok(marketHtml.body.includes('BTCは国内取引所で流動性が高い一方、販売所で購入する場合はスプレッドに注意が必要です。'));
  assert.ok(marketHtml.body.includes('2. 国内取引所での比較'));
  assert.ok(marketHtml.body.includes('3. 銘柄記事への導線'));
  assert.ok(marketHtml.body.includes('ビットコインとは？仕組み・歴史・税金・リスクを初心者向けに解説'));
  assert.ok(marketHtml.body.includes('/articles/btc'));
  assert.ok(marketHtml.body.includes('このページでは国内取引所比較に集中し、銘柄の仕組み・歴史・税金・リスクは記事タブへ分けています。'));
  assert.ok(marketHtml.body.includes('4. 銘柄深掘り'));
  assert.ok(marketHtml.body.includes('BTCを深掘りする'));
  assert.ok(marketHtml.body.includes('調べる観点'));
  assert.ok(marketHtml.body.includes('見る順番'));
  assert.ok(marketHtml.body.includes('確認シグナル'));
  assert.ok(marketHtml.body.includes('BTCとは'));
  assert.ok(marketHtml.body.includes('1. 何のための銘柄か'));
  assert.ok(marketHtml.body.includes('2. 主な用途'));
  assert.ok(marketHtml.body.includes('3. 仕組み'));
  assert.ok(marketHtml.body.includes('4. 国内取引所での扱われ方'));
  assert.ok(marketHtml.body.includes('5. 注意点'));
  assert.ok(marketHtml.body.includes('6. 関連銘柄'));
  assert.ok(marketHtml.body.includes('販売所で購入する場合はスプレッドによって実質コストが高くなることがあります。'));
  assert.ok(marketHtml.body.includes('BTC/JPY は何に使われる？'));
  assert.ok(marketHtml.body.includes('ティッカー'));
  assert.ok(marketHtml.body.includes('名称'));
  assert.ok(marketHtml.body.includes('ネットワーク'));
  assert.ok(marketHtml.body.includes('発行上限'));
  assert.ok(marketHtml.body.includes('コンセンサス方式'));
  assert.ok(marketHtml.body.includes('関連するリスク'));
  assert.ok(marketHtml.body.includes('国内取扱状況'));
  assert.ok(marketHtml.body.includes('2,100万 BTC'));
  assert.ok(marketHtml.body.includes('Proof of Work'));
  assert.ok(marketHtml.body.includes('5. 取引前チェック'));
  assert.ok(marketHtml.body.includes('BTC/JPY 比較サマリー'));
  assert.ok(marketHtml.body.includes('10万円購入時の最安候補'));
  assert.ok(marketHtml.body.includes('国内取引所 比較一覧'));
  assert.ok(marketHtml.body.includes('入出金対応'));
  assert.ok(marketHtml.body.includes('6. 関連ページ'));
  assert.ok(marketHtml.body.includes('/simulator?market=BTC-JPY'));
  assert.ok(marketHtml.body.includes('/volume-share?instrumentId=BTC-JPY'));
  assert.ok(marketHtml.body.includes('/sales-spread?instrumentId=BTC-JPY'));
  assert.ok(marketHtml.body.includes('/articles/btc'));
  assert.ok(marketHtml.body.includes('#market-exchange-comparison'));
  assert.ok(marketHtml.body.includes('/learn/exchange-vs-broker'));
  assert.ok(marketHtml.body.includes('/learn/buying-100k-points'));
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
  assert.ok(exchangesHtml.body.includes(`class="exchange-index-card__pr-link" href="${OKJ_REFERRAL_URL_ESCAPED}"`));
  assert.ok(exchangesHtml.body.includes(`class="exchange-index-row__link exchange-index-row__link--pr" href="${OKJ_REFERRAL_URL_ESCAPED}"`));
  assert.ok(exchangesHtml.body.includes(COINCHECK_AFFILIATE_URL));
  assert.ok(exchangesHtml.body.includes(COINCHECK_TRACKING_PIXEL_URL));
  assert.ok(exchangesHtml.body.includes(GMO_COIN_TRACKING_PIXEL_URL));
  assert.ok(exchangesHtml.body.includes('referrerpolicy="no-referrer-when-downgrade"'));
  assertCommonDisclosure(exchangesHtml.body);

  const financialComparisonHtml = await fetchText(baseUrl, '/financial-comparison');
  assert.equal(financialComparisonHtml.status, 200);
  assert.ok(financialComparisonHtml.body.includes('財務比較ダッシュボード'));
  assert.ok(financialComparisonHtml.body.includes('financial-comparison-data'));
  assert.ok(financialComparisonHtml.body.includes('営業収益 / 売上高'));
  assert.ok(financialComparisonHtml.body.includes('強み・弱みヒートマップ'));
  assert.ok(financialComparisonHtml.body.includes('ランキングと開示元'));
  assert.ok(financialComparisonHtml.body.includes('顧客預かり・自己保有暗号資産'));
  assert.ok(financialComparisonHtml.body.includes('cryptoAssetBalances'));
  assert.ok(financialComparisonHtml.body.includes('顧客銘柄別 / 自己銘柄別'));
  assert.ok(financialComparisonHtml.body.includes('自己保有銘柄別 / 顧客合計'));
  assert.ok(financialComparisonHtml.body.includes('https://cdn.okcoin.jp/cdn/assets/pdf/common/2025_balance_sheet.pdf'));
  assert.ok(financialComparisonHtml.body.includes('https://bitbank.cc/assets/images/corporate/docs/kessan_2025_12th.pdf'));
  assert.ok(financialComparisonHtml.body.includes('https://blog.btcbox.jp/wp2/wp-content/uploads/2025/07/%E7%AC%AC12%E6%9C%9F-%E8%A8%88%E7%AE%97%E6%9B%B8%E9%A1%9E.pdf'));
  assert.ok(financialComparisonHtml.body.includes('Coincheck'));
  assert.ok(financialComparisonHtml.body.includes('bitFlyer'));
  assert.ok(financialComparisonHtml.body.includes('GMOコイン'));
  assert.ok(financialComparisonHtml.body.includes('Custodiem'));
  assert.ok(financialComparisonHtml.body.includes('https://www.custodiem.com/'));
  assert.ok(financialComparisonHtml.body.includes('Crypto Garage'));
  assert.ok(financialComparisonHtml.body.includes('https://cryptogarage.co.jp/wp-content/uploads/2025/07/Crypto-Garage_%E7%AC%AC7%E6%9C%9F_%E5%85%AC%E8%A1%A8%E7%94%A8.pdf'));
  assert.ok(financialComparisonHtml.body.includes('SBI VCトレード'));
  assert.ok(financialComparisonHtml.body.includes('https://www.sbivc.co.jp/company-profile'));
  assert.ok(financialComparisonHtml.body.includes('S.BLOX'));
  assert.ok(financialComparisonHtml.body.includes('https://www.sblox.jp/ja-jp/company/'));
  assert.ok(financialComparisonHtml.body.includes('https://static.sblox.jp/history/%E8%B2%A1%E5%8B%99%E8%AB%B8%E8%A1%A8_%E7%AC%AC8%E6%9C%9F'));
  assert.ok(financialComparisonHtml.body.includes('Digital Asset Markets'));
  assert.ok(financialComparisonHtml.body.includes('https://corp.digiasset.co.jp/disclosure'));
  assert.ok(financialComparisonHtml.body.includes('https://www.digiasset.co.jp/pdf/report/8th_report.pdf'));
  assert.ok(financialComparisonHtml.body.includes('BTCBOX'));
  assert.ok(financialComparisonHtml.body.includes('https://blog.btcbox.jp/financial-data'));
  assert.ok(financialComparisonHtml.body.includes('マネーパートナーズ'));
  assert.ok(financialComparisonHtml.body.includes('https://www.moneypartners.co.jp/aboutus/disclosure.html'));
  assert.ok(financialComparisonHtml.body.includes('Zaif'));
  assert.ok(financialComparisonHtml.body.includes('https://corp.zaif.jp/business-report/'));
  assert.ok(financialComparisonHtml.body.includes('楽天ウォレット'));
  assert.ok(financialComparisonHtml.body.includes('https://www.rakuten-wallet.co.jp/irpress/statement.html'));
  assert.ok(financialComparisonHtml.body.includes('Gate Japan'));
  assert.ok(financialComparisonHtml.body.includes('https://www.gate.com/ja-jp/about-us#Company'));
  assert.ok(financialComparisonHtml.body.includes('https://gimg2.staticimgs.com/docs/10_20260318_162037_b7114d6d9c458d66fa17b83343b0567d.pdf'));
  assert.ok(financialComparisonHtml.body.includes('OSL Japan'));
  assert.ok(financialComparisonHtml.body.includes('https://www.osl.com/jp/cms/report'));
  assert.ok(financialComparisonHtml.body.includes('https://www.osl.com/jp/public/cdn/public_file/2025/11/99bdfd54c4ab97867b8fc5596c772b24.pdf'));
  assert.ok(financialComparisonHtml.body.includes('CoinTrade'));
  assert.ok(financialComparisonHtml.body.includes('https://coin-trade.cc/about/company/disclosure/'));
  assert.ok(financialComparisonHtml.body.includes('https://coin-trade.cc/assets/pdf/about/company/disclosure/balancesheet_202512.pdf'));
  assert.ok(financialComparisonHtml.body.includes('BACKSEAT Exchange'));
  assert.ok(financialComparisonHtml.body.includes('https://www.backseat-exchange.com/about'));
  assert.ok(financialComparisonHtml.body.includes('https://www.backseat-exchange.com/_files/ugd/e89f1d_c8f3ceb6fdec47da9d6e995559e1fa1c.pdf'));
  assert.ok(financialComparisonHtml.body.includes('Tokyo Hash'));
  assert.ok(financialComparisonHtml.body.includes('https://www.tokyohash.co.jp/company/profile/'));
  assert.ok(financialComparisonHtml.body.includes('https://www.tokyohash.co.jp/wp-content/uploads/2026/03/financial-statement-8th.pdf'));
  assert.ok(financialComparisonHtml.body.includes('GAIA BTM'));
  assert.ok(financialComparisonHtml.body.includes('https://www.gaia-btm.com/company/'));
  assert.ok(financialComparisonHtml.body.includes('https://www.gaia-btm.com/financial_statements_18.pdf'));
  assert.ok(financialComparisonHtml.body.includes('/js/financial-comparison.js'));
  assertCommonDisclosure(financialComparisonHtml.body);

  const exchangeHtml = await fetchText(baseUrl, '/exchanges/okj');
  assert.equal(exchangeHtml.status, 200);
  assert.ok(exchangeHtml.body.includes('取引所詳細'));
  assert.ok(exchangeHtml.body.includes('OKCoin Japan'));
  assert.ok(exchangeHtml.body.includes('運営会社・信頼性'));
  assert.ok(exchangeHtml.body.includes('公開資料で見る信頼性の要点'));
  assert.ok(exchangeHtml.body.includes('売上・利益の推移'));
  assert.ok(exchangeHtml.body.includes('自己資本比率'));
  assert.ok(exchangeHtml.body.includes('営業収益は2021年3月期'));
  assert.ok(exchangeHtml.body.includes('2025年3月期 2,485百万円'));
  assert.ok(exchangeHtml.body.includes('純資産 2,145百万円'));
  assert.ok(exchangeHtml.body.includes('自己資本比率は約5.46%'));
  assert.ok(exchangeHtml.body.includes('公式開示資料で第4期（2020年3月期）から第9期（2025年3月期）までの決算公告'));
  assert.ok(exchangeHtml.body.includes('https://www.okcoin.jp/pages/company/documents.html