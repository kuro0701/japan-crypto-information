class OrderBook {
  static STALE_AFTER_MS = 15 * 1000;

  constructor(raw) {
    this.asks = raw.asks.map(OrderBook.parseLevel).sort((a, b) => a.price - b.price);
    this.bids = raw.bids.map(OrderBook.parseLevel).sort((a, b) => b.price - a.price);
    this.timestamp = raw.timestamp;
    this.receivedAt = Date.now();
    this.source = raw.source || 'rest';
    this.exchangeId = raw.exchangeId || 'okj';
    this.instrumentId = raw.instrumentId || raw.instrument_id || 'BTC-JPY';

    this.bestAsk = this.asks.length > 0 ? this.asks[0].price : null;
    this.bestBid = this.bids.length > 0 ? this.bids[0].price : null;
    this.midPrice = (this.bestBid !== null && this.bestAsk !== null)
      ? (this.bestBid + this.bestAsk) / 2
      : null;
    this.spread = (this.bestAsk !== null && this.bestBid !== null)
      ? this.bestAsk - this.bestBid
      : null;
    this.spreadPct = (this.spread !== null && this.midPrice > 0)
      ? (this.spread / this.midPrice) * 100
      : null;

    this.totalAskVolume = this.asks.reduce((s, l) => s + l.quantity, 0);
    this.totalBidVolume = this.bids.reduce((s, l) => s + l.quantity, 0);
    this.totalAskDepthJPY = this.asks.reduce((s, l) => s + l.price * l.quantity, 0);
    this.totalBidDepthJPY = this.bids.reduce((s, l) => s + l.price * l.quantity, 0);
  }

  static parseLevel(arr) {
    return {
      price: parseFloat(arr[0]),
      quantity: parseFloat(arr[1]),
      orders: parseInt(arr[2] ?? 0, 10) || 0,
    };
  }

  static parseTime(value) {
    if (value == null || value === '') return null;

    if (typeof value === 'number' && Number.isFinite(value)) {
      if (value >= 1e12) return value;
      if (value >= 1e9) return value * 1000;
      return value;
    }

    const raw = String(value).trim();
    if (!raw) return null;

    if (/^\d+(?:\.\d+)?$/.test(raw)) {
      const numeric = Number(raw);
      if (!Number.isFinite(numeric)) return null;
      if (numeric >= 1e12) return numeric;
      if (numeric >= 1e9) return numeric * 1000;
      return numeric;
    }

    const parsed = Date.parse(raw);
    return Number.isFinite(parsed) ? parsed : null;
  }

  updatedAtMs(now = Date.now()) {
    const timestampMs = OrderBook.parseTime(this.timestamp);
    if (!Number.isFinite(timestampMs)) return this.receivedAt;
    if (timestampMs > now + 60 * 1000) return this.receivedAt;
    return Math.min(this.receivedAt, timestampMs);
  }

  ageMs(now = Date.now()) {
    return Math.max(0, now - this.updatedAtMs(now));
  }

  getFreshness(options = {}) {
    const now = Number.isFinite(options.now) ? options.now : Date.now();
    const staleAfterMs = Number.isFinite(options.staleAfterMs)
      ? Number(options.staleAfterMs)
      : OrderBook.STALE_AFTER_MS;
    const updatedAt = this.updatedAtMs(now);
    const ageMs = Math.max(0, now - updatedAt);

    return {
      updatedAt,
      ageMs,
      ageSeconds: Math.floor(ageMs / 1000),
      staleAfterMs,
      freshnessStatus: ageMs > staleAfterMs ? 'stale' : 'fresh',
    };
  }

  toSummary(options = {}) {
    const freshness = this.getFreshness(options);
    return {
      bestBid: this.bestBid,
      bestAsk: this.bestAsk,
      midPrice: this.midPrice,
      spread: this.spread,
      spreadPct: this.spreadPct,
      totalAskVolume: this.totalAskVolume,
      totalBidVolume: this.totalBidVolume,
      totalAskDepthJPY: this.totalAskDepthJPY,
      totalBidDepthJPY: this.totalBidDepthJPY,
      askLevels: this.asks.length,
      bidLevels: this.bids.length,
      timestamp: this.timestamp,
      receivedAt: this.receivedAt,
      source: this.source,
      exchangeId: this.exchangeId,
      instrumentId: this.instrumentId,
      updatedAt: freshness.updatedAt,
      ageMs: freshness.ageMs,
      ageSeconds: freshness.ageSeconds,
      staleAfterMs: freshness.staleAfterMs,
      freshnessStatus: freshness.freshnessStatus,
    };
  }

  toDepthChart() {
    let cumBid = 0;
    const bidPoints = this.bids.map(l => {
      cumBid += l.quantity;
      return { price: l.price, cumulative: cumBid };
    });

    let cumAsk = 0;
    const askPoints = this.asks.map(l => {
      cumAsk += l.quantity;
      return { price: l.price, cumulative: cumAsk };
    });

    return { bidPoints, askPoints };
  }
}

module.exports = OrderBook;
