const test = require('node:test');
const assert = require('node:assert/strict');

const {
  createCoinGeckoPriceClient,
  normalizeTicker,
} = require('../../lib/coingecko-price-client');

test('normalizes supported tickers and caches CoinGecko market references', async () => {
  let calls = 0;
  const client = createCoinGeckoPriceClient({
    cacheTtlMs: 60_000,
    now: () => 1_000,
    fetchImpl: async (url, options) => {
      calls += 1;
      assert.match(url, /ids=canton-network/);
      assert.match(url, /vs_currencies=jpy%2Cusd/);
      assert.equal(options.headers.Accept, 'application/json');
      return {
        ok: true,
        async json() {
          return {
            'canton-network': {
              jpy: 19.72,
              jpy_24h_change: 0.8,
              usd: 0.1204,
              usd_24h_change: 0.7,
              last_updated_at: 1_785_288_890,
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
  assert.equal(calls, 1);
  assert.deepEqual(second, first);
  assert.equal(first.price.jpy, 19.72);
  assert.equal(first.change24hPct.jpy, 0.8);
  assert.equal(first.source, 'CoinGecko');
  assert.equal(first.stale, false);
});

test('returns the last cached value as stale when refresh fails', async () => {
  let currentTime = 1_000;
  let shouldFail = false;
  const client = createCoinGeckoPriceClient({
    cacheTtlMs: 10,
    now: () => currentTime,
    fetchImpl: async () => {
      if (shouldFail) throw new Error('network unavailable');
      return {
        ok: true,
        async json() {
          return {
            'canton-network': {
              jpy: 19.72,
              usd: 0.1204,
              last_updated_at: 1_785_288_890,
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
