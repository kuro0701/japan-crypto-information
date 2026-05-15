const path = require('path');
const test = require('node:test');
const assert = require('node:assert/strict');

const OrderBook = require('../../lib/orderbook');
const { createTempDir, removeTempDir } = require('../helpers/temp-dir');

const SERVER_PATH = path.resolve(__dirname, '../../server.js');
const TEST_ENV_KEYS = ['ANALYTICS_ADMIN_TOKEN', 'ANALYTICS_ADMIN_TOKEN_HASH', 'DATA_DIR', 'DATABASE_URL', 'NODE_ENV'];

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
  assert.ok(homePage.body.includes('/learn/crypto-withdrawal-fees'));
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
  assert.ok(researchPage.body.includes('/learn/crypto-withdrawal-fees'));
  assertCommonDisclosure(researchPage.body);

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

  const simulatorPage = await fetchText(baseUrl, '/simulator?market=BTC-JPY&side=buy&amountType=jpy&amount=100000');
  assert.equal(simulatorPage.status, 200);
  assert.ok(simulatorPage.body.includes('成行取引リアルタイム板シミュレーター'));
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
  assert.ok(marketHtml.body.includes('3. この銘柄について'));
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
  assert.ok(marketHtml.body.includes('4. 取引前チェック'));
  assert.ok(marketHtml.body.includes('BTC/JPY 比較サマリー'));
  assert.ok(marketHtml.body.includes('10万円購入時の最安候補'));
  assert.ok(marketHtml.body.includes('国内取引所 比較一覧'));
  assert.ok(marketHtml.body.includes('入出金対応'));
  assert.ok(marketHtml.body.includes('5. 関連ページ'));
  assert.ok(marketHtml.body.includes('/simulator?market=BTC-JPY'));
  assert.ok(marketHtml.body.includes('/volume-share?instrumentId=BTC-JPY'));
  assert.ok(marketHtml.body.includes('/sales-spread?instrumentId=BTC-JPY'));
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
  assertCommonDisclosure(exchangesHtml.body);

  const financialComparisonHtml = await fetchText(baseUrl, '/financial-comparison');
  assert.equal(financialComparisonHtml.status, 200);
  assert.ok(financialComparisonHtml.body.includes('財務比較ダッシュボード'));
  assert.ok(financialComparisonHtml.body.includes('financial-comparison-data'));
  assert.ok(financialComparisonHtml.body.includes('営業収益 / 売上高'));
  assert.ok(financialComparisonHtml.body.includes('強み・弱みヒートマップ'));
  assert.ok(financialComparisonHtml.body.includes('ランキングと開示元'));
  assert.ok(financialComparisonHtml.body.includes('Coincheck'));
  assert.ok(financialComparisonHtml.body.includes('bitFlyer'));
  assert.ok(financialComparisonHtml.body.includes('GMOコイン'));
  assert.ok(financialComparisonHtml.body.includes('Custodiem'));
  assert.ok(financialComparisonHtml.body.includes('https://www.custodiem.com/'));
  assert.ok(financialComparisonHtml.body.includes('SBI VCトレード'));
  assert.ok(financialComparisonHtml.body.includes('https://www.sbivc.co.jp/company-profile'));
  assert.ok(financialComparisonHtml.body.includes('S.BLOX'));
  assert.ok(financialComparisonHtml.body.includes('https://www.sblox.jp/ja-jp/company/'));
  assert.ok(financialComparisonHtml.body.includes('https://static.sblox.jp/history/%E8%B2%A1%E5%8B%99%E8%AB%B8%E8%A1%A8_%E7%AC%AC8%E6%9C%9F'));
  assert.ok(financialComparisonHtml.body.includes('BTCBOX'));
  assert.ok(financialComparisonHtml.body.includes('https://blog.btcbox.jp/financial-data'));
  assert.ok(financialComparisonHtml.body.includes('マネーパートナーズ'));
  assert.ok(financialComparisonHtml.body.includes('https://www.moneypartners.co.jp/aboutus/disclosure.html'));
  assert.ok(financialComparisonHtml.body.includes('Zaif'));
  assert.ok(financialComparisonHtml.body.includes('https://corp.zaif.jp/business-report/'));
  assert.ok(financialComparisonHtml.body.includes('楽天ウォレット'));
  assert.ok(financialComparisonHtml.body.includes('https://www.rakuten-wallet.co.jp/irpress/statement.html'));
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
  assert.ok(exchangeHtml.body.includes('https://www.okcoin.jp/pages/company/documents.html'));
  assert.ok(exchangeHtml.body.includes('https://cdn.okcoin.jp/cdn/assets/pdf/common/2025_kessan_koukoku.pdf'));
  assert.ok(exchangeHtml.body.includes('https://cdn.okcoin.jp/cdn/assets/pdf/common/2025_balance_sheet.pdf'));
	  assert.ok(exchangeHtml.body.includes('行政処分歴'));
	  assert.ok(exchangeHtml.body.includes('この情報は公開資料をもとにした参考情報'));
	  assert.ok(exchangeHtml.body.includes('板取引対応銘柄'));
	  assert.ok(exchangeHtml.body.includes('銘柄検索・対応形式フィルタ'));
	  assert.ok(exchangeHtml.body.includes('次に見るべきページ'));
	  assert.ok(exchangeHtml.body.includes('詳しく知る'));
	  assert.ok(exchangeHtml.body.includes('申込前に確認'));
	  assert.ok(exchangeHtml.body.includes('/simulator?exchange=okj&amp;market=BTC-JPY'));
	  assert.ok(exchangeHtml.body.includes('キャンペーン条件'));
	  assertCommonDisclosure(exchangeHtml.body);

  const bitflyerHtml = await fetchText(baseUrl, '/exchanges/bitflyer');
	  assert.equal(bitflyerHtml.status, 200);
	  assert.ok(bitflyerHtml.body.includes('bitFlyerの特徴まとめ'));
	  assert.ok(bitflyerHtml.body.includes('BTC・ETH・XRPなど主要銘柄を板取引で比較したい人'));
	  assert.ok(bitflyerHtml.body.includes('10万円分買うときの実質コストを見る'));
	  assert.ok(bitflyerHtml.body.includes('銘柄検索・対応形式フィルタ'));
	  assert.ok(bitflyerHtml.body.includes('全銘柄を表示'));
	  assert.ok(bitflyerHtml.body.includes('入出金・送金条件'));
  assert.ok(bitflyerHtml.body.includes('営業収益は2022年度'));
  assert.ok(bitflyerHtml.body.includes('2025年度 13,567百万円'));
  assert.ok(bitflyerHtml.body.includes('あり（bitFlyer Crypto CFD）'));
  assert.ok(bitflyerHtml.body.includes('純資産 29,750百万円'));
  assert.ok(bitflyerHtml.body.includes('株式会社 bitFlyer Holdings が議決権比率100%を保有'));
  assert.ok(bitflyerHtml.body.includes('https://bitflyer.com/pub/financial-statement-12th.pdf'));
  assert.ok(bitflyerHtml.body.includes('https://bitflyer.com/pub/business-report-12th.pdf'));

  const binanceHtml = await fetchText(baseUrl, '/exchanges/binance-japan');
  assert.equal(binanceHtml.status, 200);
  assert.ok(binanceHtml.body.includes('Binance Japanの特徴まとめ'));
  assert.ok(binanceHtml.body.includes('PayPay が40%出資'));
  assert.ok(binanceHtml.body.includes('PayPayマネー事前入金は110円'));
  assert.ok(binanceHtml.body.includes('販売所ではBinance Japanが取引の相手方となり'));
  assert.ok(binanceHtml.body.includes('営業収益は2022年12月期'));
  assert.ok(binanceHtml.body.includes('2025年12月期 1,862百万円'));
  assert.ok(binanceHtml.body.includes('純資産 17,321百万円'));
  assert.ok(binanceHtml.body.includes('自己資本比率は約13.40%'));
  assert.ok(binanceHtml.body.includes('公式サイトで第6期（2022年12月期）から第9期（2025年12月期）までの財務諸表を公開'));
  assert.ok(binanceHtml.body.includes('https://www.binance.com/ja/about-legal/financial-statements-JP'));
  assert.ok(binanceHtml.body.includes('https://www.binance.com/ja/about-legal/financial-statement-9-2025-jp'));
  assert.ok(binanceHtml.body.includes('https://www.fsa.go.jp/menkyo/menkyoj/kasoutuka.pdf'));
  assert.ok(binanceHtml.body.includes('https://about.paypay.ne.jp/pr/20251009/01/'));
  assert.ok(binanceHtml.body.includes('https://public.bnbstatic.com/static/terms_doc/Announcement_Capital_Reduction_Nov_14_ja.pdf'));

  const gmoLegacy = await fetch(new URL('/exchanges/gmo', baseUrl), { redirect: 'manual' });
  assert.equal(gmoLegacy.status, 301);
  assert.equal(gmoLegacy.headers.get('location'), '/exchanges/gmo-coin');

  const gmoHtml = await fetchText(baseUrl, '/exchanges/gmo-coin');
  assert.equal(gmoHtml.status, 200);
  assert.ok(gmoHtml.body.includes('GMO Coin'));
  assert.ok(gmoHtml.body.includes('GMOコインの特徴まとめ'));
  assert.ok(gmoHtml.body.includes('キャンペーン・プログラム一覧を公式で確認'));
  assert.ok(gmoHtml.body.includes('営業収益は2021年12月期'));
  assert.ok(gmoHtml.body.includes('2025年12月期 7,398百万円'));
  assert.ok(gmoHtml.body.includes('純資産 12,354百万円'));
  assert.ok(gmoHtml.body.includes('自己資本比率は約2.64%'));
  assert.ok(gmoHtml.body.includes('GMOフィナンシャルホールディングス株式会社が直接100%を保有'));
  assert.ok(gmoHtml.body.includes('公式開示情報で第6期（2021年12月期）から第10期（2025年12月期）までの決算公告・事業報告を公開'));
  assert.ok(gmoHtml.body.includes('https://coin.z.com/jp/corp/about/kaiji/'));
  assert.ok(gmoHtml.body.includes('https://coin.z.com/corp_imgs/about/kaiji/kessan_koukoku_2026_03.pdf'));
  assert.ok(gmoHtml.body.includes('https://coin.z.com/corp_imgs/about/kaiji/jigyou_houkoku_2026_03.pdf'));
  assert.ok(gmoHtml.body.includes('https://coin.z.com/corp_imgs/about/kaiji/capital_ratio_2026_03.pdf?ver=202603'));
  assert.ok(gmoHtml.body.includes('https://coin.z.com/corp_imgs/about/kaiji/disclosure_2025_12.pdf?ver=202512'));
  assert.ok(gmoHtml.body.includes('https://www.gmofh.com/ir/stock/memo.html'));

  const bittradeHtml = await fetchText(baseUrl, '/exchanges/bittrade');
  assert.equal(bittradeHtml.status, 200);
  assert.ok(bittradeHtml.body.includes('BitTrade'));
  assert.ok(bittradeHtml.body.includes('売上高は2022年3月期'));
  assert.ok(bittradeHtml.body.includes('2025年3月期 2,187百万円'));
  assert.ok(bittradeHtml.body.includes('純資産 3,094百万円'));
  assert.ok(bittradeHtml.body.includes('自己資本比率は約12.96%'));
  assert.ok(bittradeHtml.body.includes('SINOHOPE SG PTE. LTD.'));
  assert.ok(bittradeHtml.body.includes('公式開示資料で第6期（2022年3月期）から第9期（2025年3月期）までの決算公告を公開'));
  assert.ok(bittradeHtml.body.includes('https://www.bittrade.co.jp/ja-jp/disclosure/'));
  assert.ok(bittradeHtml.body.includes('https://static.bittrade.co.jp/pdf/2024%E5%B9%B4%E5%BA%A6%E6%B1%BA%E7%AE%97%E5%85%AC%E5%91%8A%28%E7%AC%AC9%E6%9C%9F%29_01.pdf'));
  assert.ok(bittradeHtml.body.includes('https://static.bittrade.co.jp/pdf/20241231Capital-Adequacy-Ratio.pdf'));
  assert.ok(bittradeHtml.body.includes('https://www.fsa.go.jp/menkyo/menkyoj/kasoutuka.pdf'));

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
  assert.ok(orderBookGuide.body.includes('/learn/buying-100k-points'));
  assertCommonDisclosure(orderBookGuide.body);

  const cryptoFeesGuide = await fetchText(baseUrl, '/learn/crypto-fees');
  assert.equal(cryptoFeesGuide.status, 200);
  assert.ok(cryptoFeesGuide.body.includes('暗号資産の手数料の見方'));
  assert.ok(cryptoFeesGuide.body.includes('/learn/jpy-withdrawal-fees'));
  assert.ok(cryptoFeesGuide.body.includes('/learn/crypto-withdrawal-fees'));
  assertCommonDisclosure(cryptoFeesGuide.body);

  const cryptoWithdrawalGuide = await fetchText(baseUrl, '/learn/crypto-withdrawal-fees');
  assert.equal(cryptoWithdrawalGuide.status, 200);
  assert.ok(cryptoWithdrawalGuide.body.includes('暗号資産出金手数料の比較'));
  assert.ok(cryptoWithdrawalGuide.body.includes('全銘柄・ネットワーク別'));
  assert.ok(cryptoWithdrawalGuide.body.includes('/js/crypto-withdrawal-fees.js'));
  assert.ok(cryptoWithdrawalGuide.body.includes('Binance Japan'));
  assert.ok(cryptoWithdrawalGuide.body.includes('GMOコイン'));
  assert.ok(cryptoWithdrawalGuide.body.includes('/learn/jpy-withdrawal-fees'));
  assertCommonDisclosure(cryptoWithdrawalGuide.body);

  const cryptoWithdrawalData = await fetchJson(baseUrl, '/data/crypto-withdrawal-fees.json');
  assert.equal(cryptoWithdrawalData.status, 200);
  assert.ok(cryptoWithdrawalData.body.assets.includes('BTC'));
  assert.ok(cryptoWithdrawalData.body.assets.includes('ETH'));
  assert.ok(cryptoWithdrawalData.body.rows.some(row => row.exchangeId === 'binance-japan' && row.asset === 'BTC'));
  assert.ok(cryptoWithdrawalData.body.rows.some(row => row.exchangeId === 'gmo' && row.fee === '無料'));

  const buying100kGuide = await fetchText(baseUrl, '/learn/buying-100k-points');
  assert.equal(buying100kGuide.status, 200);
  assert.ok(buying100kGuide.body.includes('10万円分買うときに見るべきポイント'));
  assert.ok(buying100kGuide.body.includes('/simulator?market=BTC-JPY'));
  assert.ok(buying100kGuide.body.includes('/sales-spread?instrumentId=BTC-JPY'));
  assertCommonDisclosure(buying100kGuide.body);

  const brokerLossGuide = await fetchText(baseUrl, '/learn/broker-loss-reasons');
  assert.equal(brokerLossGuide.status, 200);
  assert.ok(brokerLossGuide.body.includes('初心者が販売所で損しやすい理由'));
  assert.ok(brokerLossGuide.body.includes('/learn/spread'));
  assert.ok(brokerLossGuide.body.includes('/sales-spread?instrumentId=BTC-JPY'));
  assertCommonDisclosure(brokerLossGuide.body);

  const exchangeChecklistGuide = await fetchText(baseUrl, '/learn/exchange-checklist');
  assert.equal(exchangeChecklistGuide.status, 200);
  assert.ok(exchangeChecklistGuide.body.includes('取引所選びのチェックリスト'));
  assert.ok(exchangeChecklistGuide.body.includes('/markets'));
  assert.ok(exchangeChecklistGuide.body.includes('/learn/crypto-fees'));
  assert.ok(exchangeChecklistGuide.body.includes('/learn/crypto-withdrawal-fees'));
  assertCommonDisclosure(exchangeChecklistGuide.body);

  const volumeSharePage = await fetchText(baseUrl, '/volume-share?instrumentId=BTC-JPY');
  assert.equal(volumeSharePage.status, 200);
  assert.ok(volumeSharePage.body.includes('流動性サマリー'));
  assert.ok(volumeSharePage.body.includes('自動インサイト'));
  assert.ok(volumeSharePage.body.includes('data-info-layer="top"'));
  assert.ok(volumeSharePage.body.includes('data-info-layer="middle"'));
  assert.ok(volumeSharePage.body.includes('data-info-layer="bottom"'));
  assertCommonDisclosure(volumeSharePage.body);

  const derivativesPage = await fetchText(baseUrl, '/derivatives');
  assert.equal(derivativesPage.status, 200);
  assert.ok(derivativesPage.body.includes('デリバティブ流動性サマリー'));
  assert.ok(derivativesPage.body.includes('data-volume-api-base="/api/derivatives/volume-share"'));
  assert.ok(derivativesPage.body.includes('自動インサイト'));
  assert.ok(derivativesPage.body.includes('nav-menu--grouped'));
  assert.ok(derivativesPage.body.includes('/derivatives'));
  assertCommonDisclosure(derivativesPage.body);

  const salesSpreadPage = await fetchText(baseUrl, '/sales-spread?instrumentId=BTC-JPY');
  assert.equal(salesSpreadPage.status, 200);
  assert.ok(salesSpreadPage.body.includes('販売所で買う前に見る結論'));
  assert.ok(salesSpreadPage.body.includes('data-info-layer="top"'));
  assert.ok(salesSpreadPage.body.includes('data-info-layer="middle"'));
  assert.ok(salesSpreadPage.body.includes('data-info-layer="bottom"'));
  assert.ok(salesSpreadPage.body.includes('販売所スプレッドとは？'));
  assert.ok(salesSpreadPage.body.includes('/learn/spread'));
  assert.ok(salesSpreadPage.body.includes('/learn/broker-loss-reasons'));
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
  assert.ok(sitemap.body.includes('/derivatives'));
  assert.ok(sitemap.body.includes('/learn/how-to-compare-exchanges'));
  assert.ok(sitemap.body.includes('/learn/exchange-checklist'));
  assert.ok(sitemap.body.includes('/learn/crypto-withdrawal-fees'));

  const rss = await fetchText(baseUrl, '/rss.xml');
  assert.equal(rss.status, 200);
  assert.ok(rss.body.includes('/learn/crypto-fees'));
  assert.ok(rss.body.includes('/learn/crypto-withdrawal-fees'));
  assert.ok(rss.body.includes('/learn/buying-100k-points'));

  const volumeShare = await fetchJson(baseUrl, '/api/volume-share?window=7d');
  assert.equal(volumeShare.status, 200);
  assert.equal(volumeShare.body.meta.source, 'daily-snapshots');
  assert.equal(volumeShare.body.rows.length, 2);

  runtime.stores.volumeShareStore.replaceLatest(latestVolumeRecords, 'test', {
    capturedAt,
  });
  const spotVolumeShareLatest = await fetchJson(baseUrl, '/api/volume-share?window=1d');
  assert.equal(spotVolumeShareLatest.status, 200);
  assert.equal(spotVolumeShareLatest.body.meta.totalQuoteVolume, 250);
  assert.ok(spotVolumeShareLatest.body.rows.every(row => !row.instrumentId.includes('-CFD-')));

  const volumeHistory = await fetchJson(baseUrl, '/api/volume-share/history?window=30d');
  assert.equal(volumeHistory.status, 200);
  assert.equal(volumeHistory.body.rows.length, 2);

  const volumeInsights = await fetchJson(baseUrl, '/api/volume-share/insights?window=90d&maxInsights=6');
  assert.equal(volumeInsights.status, 200);
  assert.ok(Array.isArray(volumeInsights.body.insights));
  assert.ok(volumeInsights.body.reportJa.includes('・'));

  const derivativeVolumeShare = await fetchJson(baseUrl, '/api/derivatives/volume-share?window=1d');
  assert.equal(derivativeVolumeShare.status, 200);
  assert.equal(derivativeVolumeShare.body.meta.totalQuoteVolume, 700);
  assert.deepEqual(derivativeVolumeShare.body.rows.map(row => row.instrumentId).sort(), ['BTC-CFD-JPY', 'ETH-CFD-JPY']);

  const derivativeVolumeHistory = await fetchJson(baseUrl, '/api/derivatives/volume-share/history?window=30d');
  assert.equal(derivativeVolumeHistory.status, 200);
  assert.equal(derivativeVolumeHistory.body.meta.source, 'latest-fallback');
  assert.equal(derivativeVolumeHistory.body.rows.length, 2);

  const derivativeVolumeInsights = await fetchJson(baseUrl, '/api/derivatives/volume-share/insights?window=90d&maxInsights=6');
  assert.equal(derivativeVolumeInsights.status, 200);
  assert.ok(Array.isArray(derivativeVolumeInsights.body.insights));

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
