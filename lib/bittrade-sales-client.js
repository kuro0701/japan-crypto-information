const WebSocket = require('ws');
const zlib = require('zlib');

const RETAIL_WS_URL = 'wss://api-cloud.bittrade.co.jp/retail/ws';

function parseNumber(value) {
  const parsed = parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function countDecimals(value) {
  const match = String(value || '').match(/\.(\d+)/);
  return match ? match[1].length : 0;
}

function decodeFrame(data) {
  const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data);
  for (const inflate of [zlib.gunzipSync, zlib.inflateSync, zlib.inflateRawSync]) {
    try {
      return inflate(buffer).toString('utf8');
    } catch (_) {
      // Try the next compression format.
    }
  }
  return buffer.toString('utf8');
}

function symbolToBaseCurrency(symbol) {
  return String(symbol || '').toUpperCase().replace(/JPY$/, '');
}

function normalizeOffers(payload, capturedAt = Date.now()) {
  const data = payload && payload.data ? payload.data : payload;
  const offers = data && Array.isArray(data.offer) ? data.offer : [];
  if (!Array.isArray(offers) || offers.length === 0) {
    throw new Error('Unexpected BitTrade retail feed response');
  }

  const priceTimestamp = data && data.ts ? Number(data.ts) * 1000 : capturedAt;
  const currencies = [];
  for (const item of offers) {
    const baseCurrencySymbol = symbolToBaseCurrency(item.symbol);
    const buyPrice = parseNumber(item.buy_price);
    const sellPrice = parseNumber(item.sell_price);
    let midPrice = parseNumber(item.market_price);
    if (midPrice == null && buyPrice != null && sellPrice != null) {
      midPrice = (buyPrice + sellPrice) / 2;
    }

    if (!baseCurrencySymbol || buyPrice == null || sellPrice == null || midPrice == null) continue;

    currencies.push({
      baseCurrencySymbol,
      currencyFullName: baseCurrencySymbol,
      buyPrice,
      sellPrice,
      midPrice,
      quotePrecision: Math.max(countDecimals(item.buy_price), countDecimals(item.sell_price)),
      change24h: item.market_ratio == null ? null : `${item.market_ratio}%`,
      isOnline: true,
      isWidgetOpen: true,
      createdDate: priceTimestamp,
      dataSource: 'websocket',
      offerId: item.id || null,
      buyMinAmount: item.buy_min_amount || null,
      buyMaxAmount: item.buy_max_amount || null,
      sellMinAmount: item.sell_min_amount || null,
      sellMaxAmount: item.sell_max_amount || null,
    });
  }

  if (currencies.length === 0) {
    throw new Error('BitTrade retail feed did not contain rates');
  }

  return currencies;
}

class BitTradeSalesClient {
  constructor(options = {}) {
    this.wsUrl = options.wsUrl || RETAIL_WS_URL;
    this.timeoutMs = options.timeoutMs || 10000;
  }

  fetchCurrencies() {
    return new Promise((resolve, reject) => {
      const capturedAt = Date.now();
      const ws = new WebSocket(this.wsUrl);
      let settled = false;
      let pingTimer = null;
      let timeout = null;

      const finish = (err, currencies) => {
        if (settled) return;
        settled = true;
        if (timeout) clearTimeout(timeout);
        if (pingTimer) clearInterval(pingTimer);
        try {
          ws.close();
        } catch (_) {
          // The socket may already be closing.
        }
        if (err) {
          reject(err);
        } else {
          resolve(currencies);
        }
      };

      timeout = setTimeout(() => {
        finish(new Error('BitTrade retail feed timed out'));
      }, this.timeoutMs);

      ws.on('open', () => {
        ws.send(JSON.stringify({ action: 1, topic: 1 }));
        pingTimer = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ action: 4, ts: Math.floor(Date.now() / 1000) }));
          }
        }, 50000);
      });

      ws.on('message', (data) => {
        try {
          const payload = JSON.parse(decodeFrame(data));
          const offers = payload && payload.data && payload.data.offer;
          if (!Array.isArray(offers) || offers.length === 0) return;

          finish(null, normalizeOffers(payload, capturedAt));
        } catch (err) {
          finish(err);
        }
      });

      ws.on('error', (err) => {
        finish(err);
      });

      ws.on('close', () => {
        if (!settled) finish(new Error('BitTrade retail feed closed before prices arrived'));
      });
    });
  }
}

BitTradeSalesClient.normalizeOffers = normalizeOffers;

module.exports = BitTradeSalesClient;
