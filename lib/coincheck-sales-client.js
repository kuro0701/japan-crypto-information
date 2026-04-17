const PRICES_URL = 'https://coincheck.com/exchange/prices';

function decodeHtml(value) {
  return String(value || '')
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16)))
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function stripTags(value) {
  return decodeHtml(String(value || '').replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();
}

function parseYenRate(value) {
  const text = stripTags(value).replace(/,/g, '').replace(/\byen\b/i, '').trim();
  const match = text.match(/[+-]?\d+(?:\.\d+)?/);
  if (!match) return null;
  const parsed = parseFloat(match[0]);
  return Number.isFinite(parsed) ? parsed : null;
}

function countDecimals(value) {
  const match = stripTags(value).replace(/,/g, '').match(/\d+\.(\d+)/);
  return match ? match[1].length : 0;
}

function extractSymbol(rowHtml) {
  const altMatch = rowHtml.match(/<img\b[^>]*\balt=["']([^"']+)["']/i);
  if (altMatch) return decodeHtml(altMatch[1]).trim().toUpperCase();

  const coinMatch = rowHtml.match(/<div\b[^>]*class=["'][^"']*\bcoin-wrap\b[^"']*["'][^>]*>([\s\S]*?)<\/div>/i);
  if (!coinMatch) return '';

  return stripTags(coinMatch[1]).toUpperCase();
}

function parseCurrencies(html) {
  const sectionMatch = String(html || '').match(
    /<section\b[^>]*class=["'][^"']*\bbuy-coins\b[^"']*["'][^>]*>([\s\S]*?)<\/section>/i
  );
  if (!sectionMatch) {
    throw new Error('Coincheck sale prices table was not found');
  }

  const currencies = [];
  const rows = sectionMatch[1].matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi);
  for (const rowMatch of rows) {
    const rowHtml = rowMatch[1];
    const symbol = extractSymbol(rowHtml);
    if (!symbol) continue;

    const rates = Array.from(rowHtml.matchAll(
      /<td\b[^>]*class=["'][^"']*\brate\b[^"']*["'][^>]*>([\s\S]*?)<\/td>/gi
    ));
    if (rates.length < 2) continue;

    const buyPrice = parseYenRate(rates[0][1]);
    const sellPrice = parseYenRate(rates[1][1]);
    if (buyPrice == null || sellPrice == null) continue;

    currencies.push({
      baseCurrencySymbol: symbol,
      currencyFullName: symbol,
      buyPrice,
      sellPrice,
      midPrice: (buyPrice + sellPrice) / 2,
      quotePrecision: Math.max(countDecimals(rates[0][1]), countDecimals(rates[1][1])),
      isOnline: true,
      isWidgetOpen: true,
      createdDate: Date.now(),
    });
  }

  if (currencies.length === 0) {
    throw new Error('Coincheck sale prices table did not contain rates');
  }

  return currencies;
}

class CoincheckSalesClient {
  constructor(options = {}) {
    this.pricesUrl = options.pricesUrl || PRICES_URL;
  }

  async fetchCurrencies() {
    const res = await fetch(this.pricesUrl, {
      signal: AbortSignal.timeout(10000),
      headers: { 'Accept': 'text/html,application/xhtml+xml' },
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    return parseCurrencies(await res.text());
  }
}

CoincheckSalesClient.parseCurrencies = parseCurrencies;

module.exports = CoincheckSalesClient;
