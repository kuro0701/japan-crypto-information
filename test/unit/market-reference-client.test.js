const test = require('node:test');
const assert = require('node:assert/strict');

const {
  createMarketReferenceClient,
  normalizeTicker,
} = require('../../lib/market-reference-client');

test('returns and caches the Bybit best bid/ask converted to JPY', async () => {
  let calls = 0;
  const client = createMarketReferenceClient({
    cacheTtlMs: 60_000,
    now: () => 1_000,
    fetchImpl: async (url, options) => {
      calls += 1;
      assert.equal(options.headers.Accept, 'application/json');
      if (url.includes('api.bybit.com')) {
        assert.match(url, /category=spot/);
        assert.match(url, /symbol=CCUSDT/);
        return {
          ok: true,
          async json() {
            return {
              retCode: 0,
              time: 1_000,
              result: {
                list: [{
                  symbol: 'CCUSDT',
                  bid1Price: '0.1192',
                  bid1Size: '1200',
                  ask1Price: '0.1194',
                  ask1Size: '900',
                  price24hPcnt: '0.008',
                }],
              },
            };
          },
        };
      }

      assert.match(url, /ids=tether/);
      return {
        ok: true,
        async json() {
          return {
            tether: {
              jpy: 165.5,
              last_updated_at: 1,
            },
          };
        },
      };
    },
  });

  assert.equal(normalizeTicker(' canton-jpy '), 'CANTONJPY');
  assert.equal(client.supports('canton'), true);
  assert.equal(client.supports('btc'), false);

  const first = await client.getMarketReference('canton');
  const second = await client.getMarketReference('CANTON');
  assert.equal(calls, 2);
  assert.deepEqual(second, first);
  assert.equal(first.kind, 'orderbook');
  assert.equal(first.source, 'Bybit');
  assert.equal(first.pair, 'CC/USDT');
  assert.equal(first.bestBid.jpy, 0.1192 * 165.5);
  assert.equal(first.bestAsk.jpy, 0.1194 * 165.5);
  assert.equal(first.price.jpy, ((0.1192 + 0.1194) / 2) * 165.5);
  assert.ok(Math.abs(first.spreadPct - 0.1676445935) < 0.000001);
  assert.equal(first.change24hPct.quote, 0.8);
  assert.equal(first.stale, false);
});

test('falls back to a clearly labeled CoinGecko aggregate when the orderbook is unavailable', async () => {
  const client = createMarketReferenceClient({
    now: () => 1_000,
    fetchImpl: async (url) => {
      if (url.includes('api.bybit.com')) throw new Error('Bybit unavailable');
      if (url.includes('ids=tether')) {
        return {
          ok: true,
          async json() {
            return { tether: { jpy: 165.5, last_updated_at: 1 } };
          },
        };
      }
      return {
        ok: true,
        async json() {
          return {
            'canton-network': {
              jpy: 19.72,
              usd: 0.1204,
              usd_24h_change: 0.7,
              last_updated_at: 1,
            },
          };
        },
      };
    },
  });

  const reference = await client.getMarketReference('CANTON');
  assert.equal(reference.kind, 'aggregate');
  assert.equal(reference.source, 'CoinGecko');
  assert.equal(reference.price.jpy, 19.72);
  assert.equal(reference.change24hPct.quote, 0.7);
});

test('returns the last cached value as stale when every refresh source fails', async () => {
  let currentTime = 1_000;
  let shouldFail = false;
  const client = createMarketReferenceClient({
    cacheTtlMs: 10,
    now: () => currentTime,
    fetchImpl: async (url) => {
      if (shouldFail) throw new Error('network unavailable');
      if (url.includes('api.bybit.com')) throw new Error('Bybit unavailable');
      if (url.includes('ids=tether')) {
        return {
          ok: true,
          async json() {
            return { tether: { jpy: 165.5, last_updated_at: 1 } };
          },
        };
      }
      return {
        ok: true,
        async json() {
          return {
            'canton-network': {
              jpy: 19.72,
              usd: 0.1204,
              last_updated_at: 1,
            },
          };
        },
      };
    },
  });

  await client.getMarketReference('CANTON');
  currentTime += 20;
  shouldFail = true;

  const stale = await client.getMarketReference('CANTON');
  assert.equal(stale.price.jpy, 19.72);
  assert.equal(stale.stale, true);
  assert.equal(await client.getMarketReference('BTC'), null);
});

test('returns a CoinGecko XLM reference with a downsampled 24-hour sparkline', async () => {
  const prices = Array.from({ length: 96 }, (_, index) => [1_000 + index * 60_000, 28 + index * 0.01]);
  const client = createMarketReferenceClient({
    now: () => 10_000,
    fetchImpl: async (url) => {
      if (url.includes('/market_chart?')) {
        return { ok: true, async json() { return { prices }; } };
      }
      assert.match(url, /ids=stellar/);
      return {
        ok: true,
        async json() {
          return {
            stellar: {
              jpy: 28.95,
              usd: 0.184,
              usd_24h_change: 1.25,
              last_updated_at: 10,
            },
          };
        },
      };
    },
  });

  assert.equal(client.supports('xlm'), true);
  const reference = await client.getMarketReference('XLM');
  assert.equal(reference.source, 'CoinGecko');
  assert.equal(reference.price.jpy, 28.95);
  assert.ok(reference.sparkline24h.length <= 49);
  assert.deepEqual(reference.sparkline24h[0], { at: 1_000, jpy: 28 });
  assert.deepEqual(reference.sparkline24h.at(-1), { at: prices.at(-1)[0], jpy: prices.at(-1)[1] });
});
