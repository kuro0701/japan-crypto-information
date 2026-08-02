const DEFAULT_BYBIT_BASE_URL = 'https://api.bybit.com';
const DEFAULT_COINGECKO_BASE_URL = 'https://api.coingecko.com/api/v3';
const DEFAULT_CACHE_TTL_MS = 15 * 1000;
const DEFAULT_REQUEST_TIMEOUT_MS = 5 * 1000;

const MARKET_CONFIG = Object.freeze({
  CANTON: Object.freeze({
    bybitSymbol: 'CCUSDT',
    coinGeckoId: 'canton-network',
    pair: 'CC/USDT',
    sourceUrl: 'https://www.bybit.com/trade/spot/CC/USDT',
    fallbackSourceUrl: 'https://www.coingecko.com/en/coins/canton',
  }),
  XLM: Object.freeze({
    coinGeckoId: 'stellar',
    fallbackSourceUrl: 'https://www.coingecko.com/en/coins/stellar',
    sparkline24h: true,
  }),
});

function finiteNumber(value) {
  if (value == null || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function normalizeTicker(value) {
  return String(value || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function createMarketReferenceClient(options = {}) {
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  const bybitBaseUrl = String(options.bybitBaseUrl || DEFAULT_BYBIT_BASE_URL).replace(/\/+$/, '');
  const coinGeckoBaseUrl = String(options.coinGeckoBaseUrl || DEFAULT_COINGECKO_BASE_URL).replace(/\/+$/, '');
  const cacheTtlMs = Number.isFinite(Number(options.cacheTtlMs))
    ? Math.max(0, Number(options.cacheTtlMs))
    : DEFAULT_CACHE_TTL_MS;
  const requestTimeoutMs = Number.isFinite(Number(options.requestTimeoutMs))
    ? Math.max(1, Number(options.requestTimeoutMs))
    : DEFAULT_REQUEST_TIMEOUT_MS;
  const now = typeof options.now === 'function' ? options.now : Date.now;
  const cache = new Map();

  function supports(ticker) {
    return Boolean(MARKET_CONFIG[normalizeTicker(ticker)]);
  }

  async function fetchJson(url, label) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), requestTimeoutMs);
    if (typeof timer.unref === 'function') timer.unref();

    try {
      const response = await fetchImpl(url, {
        headers: {
          Accept: 'application/json',
          'User-Agent': 'get-crypto.org market reference',
        },
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new Error(`${label} request failed with HTTP ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      if (error && error.name === 'AbortError') {
        throw new Error(`${label} request timed out`);
      }
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }

  async function fetchUsdtJpyRate() {
    const params = new URLSearchParams({
      ids: 'tether',
      vs_currencies: 'jpy',
      include_last_updated_at: 'true',
    });
    const payload = await fetchJson(
      `${coinGeckoBaseUrl}/simple/price?${params.toString()}`,
      'USDT/JPY conversion'
    );
    const row = payload && payload.tether;
    const jpy = finiteNumber(row && row.jpy);
    if (jpy == null || jpy <= 0) {
      throw new Error('USDT/JPY conversion returned no valid price');
    }
    return {
      jpy,
      updatedAt: finiteNumber(row.last_updated_at),
    };
  }

  async function fetchBybitBestRate(config, normalizedTicker, currentTime) {
    const params = new URLSearchParams({
      category: 'spot',
      symbol: config.bybitSymbol,
    });
    const [payload, usdtJpy] = await Promise.all([
      fetchJson(`${bybitBaseUrl}/v5/market/tickers?${params.toString()}`, 'Bybit ticker'),
      fetchUsdtJpyRate(),
    ]);
    const row = payload
      && payload.result
      && Array.isArray(payload.result.list)
      && payload.result.list[0];
    const bidQuote = finiteNumber(row && row.bid1Price);
    const askQuote = finiteNumber(row && row.ask1Price);
    if (
      finiteNumber(payload && payload.retCode) !== 0
      || bidQuote == null
      || askQuote == null
      || bidQuote <= 0
      || askQuote < bidQuote
    ) {
      throw new Error(`Bybit returned no valid best bid/ask for ${normalizedTicker}`);
    }

    const midpointQuote = (bidQuote + askQuote) / 2;
    const spreadPct = midpointQuote > 0 ? ((askQuote - bidQuote) / midpointQuote) * 100 : null;
    const responseTime = finiteNumber(payload.time);
    const conversionTime = usdtJpy.updatedAt ? usdtJpy.updatedAt * 1000 : null;
    const updatedAtMs = Math.min(
      responseTime || currentTime,
      conversionTime || responseTime || currentTime
    );

    return {
      ticker: normalizedTicker,
      kind: 'orderbook',
      source: 'Bybit',
      sourceUrl: config.sourceUrl,
      pair: config.pair,
      price: {
        jpy: midpointQuote * usdtJpy.jpy,
        quote: midpointQuote,
        quoteCurrency: 'USDT',
      },
      bestBid: {
        jpy: bidQuote * usdtJpy.jpy,
        quote: bidQuote,
        size: finiteNumber(row.bid1Size),
      },
      bestAsk: {
        jpy: askQuote * usdtJpy.jpy,
        quote: askQuote,
        size: finiteNumber(row.ask1Size),
      },
      spreadPct,
      change24hPct: {
        quote: finiteNumber(row.price24hPcnt) == null
          ? null
          : finiteNumber(row.price24hPcnt) * 100,
      },
      updatedAt: new Date(updatedAtMs).toISOString(),
      stale: false,
    };
  }

  async function fetchCoinGeckoFallback(config, normalizedTicker, currentTime) {
    const params = new URLSearchParams({
      ids: config.coinGeckoId,
      vs_currencies: 'jpy,usd',
      include_24hr_change: 'true',
      include_last_updated_at: 'true',
    });
    const payload = await fetchJson(
      `${coinGeckoBaseUrl}/simple/price?${params.toString()}`,
      'CoinGecko fallback'
    );
    const row = payload && payload[config.coinGeckoId];
    const priceJpy = finiteNumber(row && row.jpy);
    if (priceJpy == null || priceJpy <= 0) {
      throw new Error(`CoinGecko returned no JPY price for ${normalizedTicker}`);
    }

    const lastUpdatedAt = finiteNumber(row.last_updated_at);
    return {
      ticker: normalizedTicker,
      kind: 'aggregate',
      source: 'CoinGecko',
      sourceUrl: config.fallbackSourceUrl,
      price: {
        jpy: priceJpy,
        quote: finiteNumber(row.usd),
        quoteCurrency: 'USD',
      },
      change24hPct: {
        quote: finiteNumber(row.usd_24h_change),
      },
      updatedAt: lastUpdatedAt
        ? new Date(lastUpdatedAt * 1000).toISOString()
        : new Date(currentTime).toISOString(),
      stale: false,
    };
  }

  async function fetchCoinGeckoSparkline(config) {
    if (!config.sparkline24h) return [];
    const params = new URLSearchParams({ vs_currency: 'jpy', days: '1' });
    const payload = await fetchJson(
      `${coinGeckoBaseUrl}/coins/${encodeURIComponent(config.coinGeckoId)}/market_chart?${params.toString()}`,
      'CoinGecko 24h sparkline'
    );
    const prices = payload && Array.isArray(payload.prices) ? payload.prices : [];
    const normalized = prices
      .map(row => ({ at: finiteNumber(row && row[0]), jpy: finiteNumber(row && row[1]) }))
      .filter(row => row.at != null && row.jpy != null && row.at > 0 && row.jpy > 0);
    if (normalized.length <= 48) return normalized;
    const stride = Math.ceil(normalized.length / 48);
    const sampled = normalized.filter((_, index) => index % stride === 0);
    const last = normalized[normalized.length - 1];
    if (sampled[sampled.length - 1] !== last) sampled.push(last);
    return sampled;
  }

  async function getMarketReference(ticker) {
    const normalizedTicker = normalizeTicker(ticker);
    const config = MARKET_CONFIG[normalizedTicker];
    if (!config) return null;
    if (typeof fetchImpl !== 'function') {
      throw new Error('Market reference fetch is unavailable');
    }

    const currentTime = now();
    const cached = cache.get(normalizedTicker);
    if (cached && currentTime - cached.cachedAt < cacheTtlMs) {
      return cached.value;
    }

    try {
      let value;
      if (config.bybitSymbol) {
        try {
          value = await fetchBybitBestRate(config, normalizedTicker, currentTime);
        } catch (_) {
          value = await fetchCoinGeckoFallback(config, normalizedTicker, currentTime);
        }
      } else {
        value = await fetchCoinGeckoFallback(config, normalizedTicker, currentTime);
      }
      if (config.sparkline24h) {
        try {
          value = { ...value, sparkline24h: await fetchCoinGeckoSparkline(config) };
        } catch (_) {
          value = { ...value, sparkline24h: [] };
        }
      }
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
  MARKET_CONFIG,
  createMarketReferenceClient,
  normalizeTicker,
};
