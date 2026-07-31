const DEFAULT_BASE_URL = 'https://api.llama.fi';
const DEFAULT_CACHE_TTL_MS = 5 * 60 * 1000;
const DEFAULT_REQUEST_TIMEOUT_MS = 8 * 1000;

function finiteNumber(value) {
  if (value == null || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function unixDay(value) {
  const number = finiteNumber(value);
  if (number != null && number > 0) {
    return number > 1e12 ? Math.floor(number / 1000) : Math.floor(number);
  }
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? Math.floor(parsed / 1000) : null;
}

function normalizeSeries(rows, valueForRow) {
  const byDay = new Map();
  (Array.isArray(rows) ? rows : []).forEach((row) => {
    const date = unixDay(row && row.date);
    const value = finiteNumber(valueForRow(row || {}));
    if (date == null || value == null || value < 0) return;
    byDay.set(date, { date, value });
  });
  return Array.from(byDay.values()).sort((a, b) => a.date - b.date);
}

function normalizeTvlSeries(payload) {
  return normalizeSeries(payload, row => row.tvl);
}

function normalizeStablecoinSeries(payload) {
  return normalizeSeries(payload, (row) => (
    row.totalCirculatingUSD && row.totalCirculatingUSD.peggedUSD
  ) || (
    row.totalCirculating && row.totalCirculating.peggedUSD
  ));
}

function createTronOnchainClient(options = {}) {
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  const baseUrl = String(options.baseUrl || DEFAULT_BASE_URL).replace(/\/+$/, '');
  const cacheTtlMs = Number.isFinite(Number(options.cacheTtlMs))
    ? Math.max(0, Number(options.cacheTtlMs))
    : DEFAULT_CACHE_TTL_MS;
  const requestTimeoutMs = Number.isFinite(Number(options.requestTimeoutMs))
    ? Math.max(1, Number(options.requestTimeoutMs))
    : DEFAULT_REQUEST_TIMEOUT_MS;
  const now = typeof options.now === 'function' ? options.now : Date.now;
  let cache = null;

  async function fetchJson(pathname, label) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), requestTimeoutMs);
    if (typeof timer.unref === 'function') timer.unref();
    try {
      const response = await fetchImpl(`${baseUrl}${pathname}`, {
        headers: {
          Accept: 'application/json',
          'User-Agent': 'get-crypto.org TRON onchain dashboard',
        },
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`${label} request failed with HTTP ${response.status}`);
      return await response.json();
    } catch (error) {
      if (error && error.name === 'AbortError') throw new Error(`${label} request timed out`);
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }

  async function getSnapshot() {
    const currentTime = now();
    if (cache && currentTime - cache.cachedAt < cacheTtlMs) return cache.value;
    if (typeof fetchImpl !== 'function') throw new Error('TRON onchain fetch is unavailable');

    try {
      const [tvlPayload, stablecoinPayload] = await Promise.all([
        fetchJson('/v2/historicalChainTvl/Tron', 'DefiLlama TRON TVL'),
        fetchJson('/stablecoincharts/Tron', 'DefiLlama TRON stablecoin supply'),
      ]);
      const tvl = normalizeTvlSeries(tvlPayload);
      const stablecoins = normalizeStablecoinSeries(stablecoinPayload);
      if (!tvl.length || !stablecoins.length) throw new Error('DefiLlama returned incomplete TRON history');

      const value = {
        chain: 'Tron',
        updatedAt: new Date(currentTime).toISOString(),
        stale: false,
        source: {
          label: 'DefiLlama',
          url: 'https://defillama.com/chain/tron',
          methodologyUrl: 'https://api-docs.defillama.com/',
        },
        metrics: {
          tvl: {
            label: 'DeFi TVL',
            unit: 'USD',
            definition: 'Liquid stakingと二重計上分を除くDefiLlamaのチェーンTVL',
            points: tvl,
          },
          stablecoins: {
            label: 'Stablecoin supply',
            unit: 'USD',
            definition: 'TRON上で流通するステーブルコインの米ドル換算供給量',
            points: stablecoins,
          },
        },
      };
      cache = { cachedAt: currentTime, value };
      return value;
    } catch (error) {
      if (cache && cache.value) return { ...cache.value, stale: true };
      throw error;
    }
  }

  return { getSnapshot };
}

module.exports = {
  createTronOnchainClient,
  normalizeStablecoinSeries,
  normalizeTvlSeries,
};
