const test = require('node:test');
const assert = require('node:assert/strict');

const {
  createTronOnchainClient,
  normalizeStablecoinSeries,
  normalizeTvlSeries,
} = require('../../lib/tron-onchain-client');

test('normalizes DefiLlama TRON histories and rejects malformed points', () => {
  assert.deepEqual(normalizeTvlSeries([
    { date: 100, tvl: 20 },
    { date: 200, tvl: '30' },
    { date: 300, tvl: null },
  ]), [
    { date: 100, value: 20 },
    { date: 200, value: 30 },
  ]);

  assert.deepEqual(normalizeStablecoinSeries([
    { date: 100, totalCirculatingUSD: { peggedUSD: 40 } },
    { date: 200, totalCirculating: { peggedUSD: '50' } },
  ]), [
    { date: 100, value: 40 },
    { date: 200, value: 50 },
  ]);
});

test('loads and caches source-defined TRON TVL and stablecoin histories', async () => {
  let calls = 0;
  const client = createTronOnchainClient({
    now: () => 10_000,
    fetchImpl: async (url) => {
      calls += 1;
      if (url.endsWith('/v2/historicalChainTvl/Tron')) {
        return { ok: true, json: async () => [{ date: 100, tvl: 20 }, { date: 200, tvl: 30 }] };
      }
      if (url.endsWith('/stablecoincharts/Tron')) {
        return {
          ok: true,
          json: async () => [
            { date: 100, totalCirculatingUSD: { peggedUSD: 40 } },
            { date: 200, totalCirculatingUSD: { peggedUSD: 50 } },
          ],
        };
      }
      throw new Error(`Unexpected URL ${url}`);
    },
  });

  const first = await client.getSnapshot();
  const second = await client.getSnapshot();
  assert.equal(calls, 2);
  assert.equal(first.chain, 'Tron');
  assert.equal(first.metrics.tvl.points.length, 2);
  assert.equal(first.metrics.stablecoins.points[1].value, 50);
  assert.equal(first.source.label, 'DefiLlama');
  assert.deepEqual(second, first);
});
