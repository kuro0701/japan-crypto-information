const test = require('node:test');
const assert = require('node:assert/strict');
const zlib = require('zlib');

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

function zipCsv(csv) {
  const fileName = Buffer.from('data.csv');
  const compressed = zlib.deflateRawSync(Buffer.from(csv));
  const header = Buffer.alloc(30);
  header.writeUInt32LE(0x04034b50, 0);
  header.writeUInt16LE(20, 4);
  header.writeUInt16LE(8, 8);
  header.writeUInt32LE(compressed.length, 18);
  header.writeUInt32LE(Buffer.byteLength(csv), 22);
  header.writeUInt16LE(fileName.length, 26);
  return Buffer.concat([header, fileName, compressed]);
}

function binaryResponse(buffer, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async arrayBuffer() {
      return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
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

test('Binance Japan reconstructs a JST day from official hourly archives while API access is blocked', async () => {
  const micros = value => String(Date.parse(value) * 1000);
  const previousUtcCsv = [
    `${micros('2026-07-15T14:00:00Z')},80,90,70,85,1,${micros('2026-07-15T14:59:59.999Z')},85,1,0,0,0`,
    `${micros('2026-07-15T15:00:00Z')},100,110,90,105,2,${micros('2026-07-15T15:59:59.999Z')},200,1,0,0,0`,
  ].join('\n');
  const currentUtcCsv = [
    `${micros('2026-07-16T14:00:00Z')},105,120,95,115,3,${micros('2026-07-16T14:59:59.999Z')},345,1,0,0,0`,
    `${micros('2026-07-16T15:00:00Z')},115,125,100,120,4,${micros('2026-07-16T15:59:59.999Z')},480,1,0,0,0`,
  ].join('\n');
  const restoreFetch = mockFetch((url) => {
    if (url.includes('data.binance.vision') && url.includes('2026-07-15')) {
      return binaryResponse(zipCsv(previousUtcCsv));
    }
    if (url.includes('data.binance.vision') && url.includes('2026-07-16')) {
      return binaryResponse(zipCsv(currentUtcCsv));
    }
    return jsonResponse({}, 418);
  });

  try {
    const client = new BinanceJapanClient(500, {
      baseUrls: ['https://blocked.example/api/v3'],
    });
    const ticker = await client.fetchDailyTicker('BTC-JPY', '2026-07-16');

    assert.equal(ticker.open24h, '100');
    assert.equal(ticker.high24h, 120);
    assert.equal(ticker.low24h, 90);
    assert.equal(ticker.last, '115');
    assert.equal(ticker.baseVolume24h, 5);
    assert.equal(ticker.quoteVolume24h, 545);
    assert.equal(ticker.timestamp, '2026-07-16T14:59:59.999Z');
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
