const DEFAULT_BASE_URL = 'https://api.coingecko.com/api/v3';
const DEFAULT_CACHE_TTL_MS = 60 * 1000;

const COIN_CONFIG = Object.freeze({
  CANTON: Object.freeze({
    id: 'canton-network',
    sourceUrl: 'https://www.coingecko.com/en/coins/canton',
  }),
});

function finiteNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function normalizeTicker(value) {
  return String(value || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function createCoinGeckoPriceClient(options = {}) {
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  const baseUrl = String(options.baseUrl || DEFAULT_BASE_URL).replace(/\/+$/, '');
  const cacheTtlMs = Number.isFinite(Number(options.cacheTtlMs))
    ? Math.max(0, Number(options.cacheTtlMs))
    : DEFAULT_CACHE_TTL_MS;
  const now = typeof options.now === 'function' ? options.now : Date.now;
  const cache = new Map();

  function supports(ticker) {
    return Boolean(COIN_CONFIG[normalizeTicker(ticker)]);
  }

  async function getMarketReference(ticker) {
    const normalizedTicker = normalizeTicker(ticker);
    const config = COIN_CONFIG[normalizedTicker];
    if (!config) return null;
    if (typeof fetchImpl !== 'function') {
      throw new Error('CoinGecko price fetch is unavailable');
    }

    const currentTime = now();
    const cached = cache.get(normalizedTicker);
    if (cached && currentTime - cached.cachedAt < cacheTtlMs) {
      return cached.value;
    }

    const params = new URLSearchParams({
      ids: config.id,
      vs_currencies: 'jpy,usd',
      include_24hr_change: 'true',
      include_last_updated_at: 'true',
    });

    try {
      const response = await fetchImpl(`${baseUrl}/simple/price?${params.toString()}`, {
        headers: {
          Accept: 'application/json',
          'User-Agent': 'get-crypto.org market reference',
        },
      });
      if (!response.ok) {
        throw new Error(`CoinGecko price request failed with HTTP ${response.status}`);
      }

      const payload = await response.json();
      const row = payload && payload[config.id];
      const priceJpy = finiteNumber(row && row.jpy);
      if (priceJpy == null || priceJpy <= 0) {
        throw new Error(`CoinGecko returned no JPY price for ${normalizedTicker}`);
      }

      const lastUpdatedAt = finiteNumber(row.last_updated_at);
      const value = {
        ticker: normalizedTicker,
        source: 'CoinGecko',
        sourceUrl: config.sourceUrl,
        price: {
          jpy: priceJpy,
          usd: finiteNumber(row.usd),
        },
        change24hPct: {
          jpy: finiteNumber(row.jpy_24h_change),
          usd: finiteNumber(row.usd_24h_change),
        },
        updatedAt: lastUpdatedAt
          ? new Date(lastUpdatedAt * 1000).toISOString()
          : new Date(currentTime).toISOString(),
        stale: false,
      };
      cache.set(normalizedTicker, { cachedAt: currentTime, value });
      return value;
    } catch (error) {
      if (cached && cached.value) {
        return {
          ...cached.value,
          stale: true,
        };
      }
      throw error;
    }
  }

  return {
    getMarketReference,
    supports,
  };
}

module.exports = {
  COIN_CONFIG,
  createCoinGeckoPriceClient,
  normalizeTicker,
};
