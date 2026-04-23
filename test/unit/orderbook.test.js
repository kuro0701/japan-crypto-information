const test = require('node:test');
const assert = require('node:assert/strict');

const OrderBook = require('../../lib/orderbook');

test('OrderBook sorts price levels and exposes a consistent summary', () => {
  const book = new OrderBook({
    asks: [['101', '0.4', '2'], ['100', '0.6', '1']],
    bids: [['98.5', '0.4', '1'], ['99', '0.3', '3']],
    timestamp: '2026-04-23T00:00:00.000Z',
    source: 'test',
    exchangeId: 'okj',
    instrumentId: 'BTC-JPY',
  });
  book.receivedAt = 1_710_000_000_000;

  assert.deepEqual(book.asks.map(level => level.price), [100, 101]);
  assert.deepEqual(book.bids.map(level => level.price), [99, 98.5]);
  assert.equal(book.bestAsk, 100);
  assert.equal(book.bestBid, 99);
  assert.equal(book.midPrice, 99.5);
  assert.equal(book.spread, 1);
  assert.equal(book.totalAskVolume, 1);
  assert.equal(book.totalBidVolume, 0.7);

  const summary = book.toSummary({
    now: 1_710_000_005_000,
    staleAfterMs: 15_000,
  });
  assert.equal(summary.freshnessStatus, 'fresh');
  assert.equal(summary.source, 'test');
  assert.equal(summary.exchangeId, 'okj');

  assert.deepEqual(book.toDepthChart(), {
    bidPoints: [
      { price: 99, cumulative: 0.3 },
      { price: 98.5, cumulative: 0.7 },
    ],
    askPoints: [
      { price: 100, cumulative: 0.6 },
      { price: 101, cumulative: 1 },
    ],
  });
});

test('OrderBook freshness falls back to receivedAt for future timestamps', () => {
  const now = 1_710_000_100_000;
  const book = new OrderBook({
    asks: [['101', '1', '1']],
    bids: [['99', '1', '1']],
    timestamp: now + 120_000,
  });
  book.receivedAt = now - 2_000;

  assert.equal(OrderBook.parseTime('1710000000'), 1_710_000_000_000);
  assert.equal(book.updatedAtMs(now), book.receivedAt);

  const freshness = book.getFreshness({
    now: now + 20_000,
    staleAfterMs: 15_000,
  });
  assert.equal(freshness.ageMs, 22_000);
  assert.equal(freshness.freshnessStatus, 'stale');
});
