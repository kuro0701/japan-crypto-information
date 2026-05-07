const test = require('node:test');
const assert = require('node:assert/strict');

const BitflyerClient = require('../../lib/bitflyer-client');
const GMOClient = require('../../lib/gmo-client');
const { BITFLYER_EXCHANGE_ID, GMO_EXCHANGE_ID, getPublicExchanges } = require('../../lib/exchanges');

function mockFetch(handler) {
  const originalFetch = global.fetch;
  global.fetch = async (url) => handler(String(url));
  return () => {
    global.fetch = originalFetch;
  };
}

function jsonResponse(body, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async json() {
      return body;
    },
  };
}

test('static exchange metadata exposes derivative markets separately from spot', () => {
  const exchanges = getPublicExchanges();
  const bitflyer = exchanges.find(exchange => exchange.id === BITFLYER_EXCHANGE_ID);
  const gmo = exchanges.find(exchange => exchange.id === GMO_EXCHANGE_ID);

  const bitflyerCfd = bitflyer.markets.find(market => market.instrumentId === 'BTC-CFD-JPY');
  const gmoCfd = gmo.markets.find(market => market.instrumentId === 'BTC-CFD-JPY');
  const gmoEthCfd = gmo.markets.find(market => market.instrumentId === 'ETH-CFD-JPY');

  assert.equal(bitflyer.defaultInstrumentId, 'BTC-JPY');
  assert.equal(bitflyerCfd.marketType, 'derivative');
  assert.equal(bitflyerCfd.underlyingInstrumentId, 'BTC-JPY');
  assert.equal(bitflyerCfd.takerFeeRate, 0);

  assert.equal(gmo.defaultInstrumentId, 'BTC-JPY');
  assert.equal(gmoCfd.marketType, 'derivative');
  assert.equal(gmoCfd.marketTypeLabel, '暗号資産FX');
  assert.equal(gmoEthCfd.baseCurrency, 'ETH');
});

test('bitFlyer public markets map FX_BTC_JPY to BTC-CFD-JPY', async () => {
  const restoreFetch = mockFetch(() => jsonResponse([
    { product_code: 'BTC_JPY', market_type: 'Spot' },
    { product_code: 'FX_BTC_JPY', market_type: 'FX' },
    { product_code: 'ETH_BTC', market_type: 'Spot' },
  ]));
  try {
    const client = new BitflyerClient();
    const markets = await client.fetchMarkets();
    const ids = markets.map(market => market.instrumentId);

    assert.deepEqual(ids, ['BTC-JPY', 'BTC-CFD-JPY']);
    const derivative = markets.find(market => market.instrumentId === 'BTC-CFD-JPY');
    assert.equal(derivative.label, 'BTC-CFD/JPY');
    assert.equal(derivative.marketType, 'derivative');
    assert.equal(derivative.takerFeeRate, 0);
  } finally {
    restoreFetch();
  }
});

test('GMO public symbols map underscore JPY symbols to CFD markets', async () => {
  const restoreFetch = mockFetch((url) => {
    if (url.includes('/symbols')) {
      return jsonResponse({
        status: 0,
        data: [
          { symbol: 'BTC', minOrderSize: '0.00001', sizeStep: '0.00001', tickSize: '1', takerFee: '0.0005' },
          { symbol: 'BTC_JPY', minOrderSize: '0.01', sizeStep: '0.01', tickSize: '1', takerFee: '0' },
        ],
      });
    }
    throw new Error(`unexpected URL ${url}`);
  });
  try {
    const client = new GMOClient();
    const markets = await client.fetchMarkets();
    const spot = markets.find(market => market.instrumentId === 'BTC-JPY');
    const derivative = markets.find(market => market.instrumentId === 'BTC-CFD-JPY');

    assert.equal(spot.marketType, 'spot');
    assert.equal(spot.takerFeeRate, 0.0005);
    assert.equal(derivative.label, 'BTC-CFD/JPY');
    assert.equal(derivative.marketType, 'derivative');
    assert.equal(derivative.underlyingInstrumentId, 'BTC-JPY');
    assert.equal(derivative.takerFeeRate, 0);
  } finally {
    restoreFetch();
  }
});

test('GMO ticker requests derivative instruments with underscore API symbols', async () => {
  let requestedUrl = '';
  const restoreFetch = mockFetch((url) => {
    requestedUrl = url;
    return jsonResponse({
      status: 0,
      data: [{
        ask: '1002',
        bid: '1000',
        last: '1001',
        symbol: 'BTC_JPY',
        timestamp: '2026-05-05T00:00:00.000Z',
        volume: '2',
      }],
    });
  });
  try {
    const client = new GMOClient();
    const ticker = await client.fetchTicker('BTC-CFD-JPY');

    assert.ok(requestedUrl.includes('symbol=BTC_JPY'));
    assert.equal(ticker.instrument_id, 'BTC-CFD-JPY');
    assert.equal(ticker.quoteVolume24h, 2002);
  } finally {
    restoreFetch();
  }
});
