const test = require('node:test');
const assert = require('node:assert/strict');

const BinanceJapanClient = require('../../lib/binance-japan-client');

function jsonResponse(body, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async json() {
      return body;
    },
  };
}

function mockFetch(handler) {
  const originalFetch = global.fetch;
  global.fetch = async (url) => handler(String(url));
  return () => {
    global.fetch = originalFetch;
  };
}

test('Binance Japan ticker falls back to a secondary public market-data endpoint', async () => {
  const requestedUrls = [];
  const restoreFetch = mockFetch((url) => {
    requestedUrls.push(url);
    if (url.startsWith('https://primary.example')) return jsonResponse({}, 503);
    return jsonResponse({
      lastPrice: '100',
      openPrice: '90',
      highPrice: '110',
      lowPrice: '80',
      volume: '2',
      quoteVolume: '200',
      closeTime: 1_784_255_895_000,
    });
  });

  try {
    const client = new BinanceJapanClient(500, {
      baseUrls: [
        'https://primary.example/api/v3',
        'https://fallback.example/api/v3',
      ],
    });

    const first = await client.fetchTicker('BTC-JPY');
    const second = await client.fetchTicker('ETH-JPY');

    assert.equal(first.quoteVolume24h, '200');
    assert.equal(second.last, '100');
    assert.ok(requestedUrls[0].startsWith('https://primary.example'));
    assert.ok(requestedUrls[1].startsWith('https://fallback.example'));
    assert.ok(requestedUrls[2].startsWith('https://fallback.example'));
    assert.equal(requestedUrls.length, 3);
    assert.equal(client.getLastMarketDataError(), null);
  } finally {
    restoreFetch();
  }
});

test('Binance Japan daily ticker requests a JST-aligned daily kline', async () => {
  let requestedUrl = '';
  const restoreFetch = mockFetch((url) => {
    requestedUrl = url;
    return jsonResponse([[
      Date.parse('2026-07-15T15:00:00.000Z'),
      '100',
      '120',
      '90',
      '110',
      '3',
      Date.parse('2026-07-16T14:59:59.999Z'),
      '330',
    ]]);
  });

  try {
    const client = new BinanceJapanClient(500, {
      baseUrls: ['https://market-data.example/api/v3'],
    });
    const ticker = await client.fetchDailyTicker('BTC-JPY', '2026-07-16');
    const url = new URL(requestedUrl);

    assert.equal(url.pathname, '/api/v3/klines');
    assert.equal(url.searchParams.get('symbol'), 'BTCJPY');
    assert.equal(url.searchParams.get('interval'), '1d');
    assert.equal(url.searchParams.get('timeZone'), '9');
    assert.equal(url.searchParams.get('startTime'), String(Date.parse('2026-07-16T00:00:00+09:00')));
    assert.equal(ticker.baseVolume24h, '3');
    assert.equal(ticker.quoteVolume24h, '330');
    assert.equal(ticker.last, '110');
  } finally {
    restoreFetch();
  }
});

test('Binance Japan batches multiple JPY tickers into one request', async () => {
  let requestedUrl = '';
  let requestCount = 0;
  const restoreFetch = mockFetch((url) => {
    requestedUrl = url;
    requestCount += 1;
    return jsonResponse([
      { symbol: 'BTCJPY', lastPrice: '100', volume: '2', quoteVolume: '200', closeTime: 1_784_255_895_000 },
      { symbol: 'ETHJPY', lastPrice: '50', volume: '3', quoteVolume: '150', closeTime: 1_784_255_895_000 },
    ]);
  });

  try {
    const client = new BinanceJapanClient(500, {
      baseUrls: ['https://market-data.example/api/v3'],
    });
    const tickers = await client.fetchTickers(['BTC-JPY', 'ETH-JPY']);
    const symbols = JSON.parse(new URL(requestedUrl).searchParams.get('symbols'));

    assert.equal(requestCount, 1);
    assert.deepEqual(symbols, ['BTCJPY', 'ETHJPY']);
    assert.deepEqual(tickers.map(ticker => ticker.instrument_id), ['BTC-JPY', 'ETH-JPY']);
    assert.deepEqual(tickers.map(ticker => ticker.quoteVolume24h), ['200', '150']);
  } finally {
    restoreFetch();
  }
});

test('Binance Japan uses the official web product feed when API hosts return HTTP 418', async () => {
  const requestedUrls = [];
  const restoreFetch = mockFetch((url) => {
    requestedUrls.push(url);
    if (url.includes('/bapi/asset/')) {
      return jsonResponse({
        data: [{
          s: 'BTCJPY',
          o: '90',
          h: '110',
          l: '80',
          c: '100',
          v: '2',
          qv: '200',
        }],
      });
    }
    return jsonResponse({}, 418);
  });

  try {
    const client = new BinanceJapanClient(500, {
      baseUrls: ['https://blocked.example/api/v3'],
    });
    const tickers = await client.fetchTickers(['BTC-JPY']);

    assert.equal(requestedUrls.length, 2);
    assert.ok(requestedUrls[1].includes('/bapi/asset/'));
    assert.equal(tickers.length, 1);
    assert.equal(tickers[0].quoteVolume24h, '200');
    assert.equal(client.getLastMarketDataError(), null);
  } finally {
    restoreFetch();
  }
});

test('Binance Japan retains endpoint failure detail when every fallback fails', async () => {
  let requestCount = 0;
  const restoreFetch = mockFetch((url) => {
    requestCount += 1;
    return jsonResponse({}, url.includes('primary') ? 429 : 503);
  });

  try {
    const client = new BinanceJapanClient(500, {
      baseUrls: [
        'https://primary.example/api/v3',
        'https://fallback.example/api/v3',
      ],
    });
    const ticker = await client.fetchTicker('BTC-JPY');

    assert.equal(ticker, null);
    assert.match(client.getLastMarketDataError(), /primary\.example: HTTP 429/);
    assert.match(client.getLastMarketDataError(), /fallback\.example: HTTP 503/);

    const blockedTicker = await client.fetchTicker('ETH-JPY');
    assert.equal(blockedTicker, null);
    assert.equal(requestCount, 2);
    assert.match(client.getLastMarketDataError(), /requests are paused/);
  } finally {
    restoreFetch();
  }
});
