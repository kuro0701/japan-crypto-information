const test = require('node:test');
const assert = require('node:assert/strict');

const OrderBook = require('../../lib/orderbook');
const {
  calculateImpact,
  calculateImpactThresholds,
} = require('../../lib/impact-calculator');

function approximatelyEqual(actual, expected, epsilon = 1e-9) {
  assert.ok(Math.abs(actual - expected) <= epsilon, `expected ${actual} to be within ${epsilon} of ${expected}`);
}

test('calculateImpact applies size and tick constraints before summarizing execution', () => {
  const book = new OrderBook({
    asks: [['100.12', '0.4', '1'], ['100.23', '0.6', '2'], ['100.35', '1.0', '1']],
    bids: [['99.88', '0.5', '1'], ['99.75', '1.0', '2']],
    timestamp: '2026-04-23T00:00:00.000Z',
  });

  const result = calculateImpact('buy', 0.55, 'base', book, {
    market: {
      baseCurrency: 'BTC',
      quoteCurrency: 'JPY',
      minSize: 0.1,
      sizeIncrement: 0.1,
      tickSize: 0.05,
      takerFeeRate: 0.0012,
      takerFeeNote: '通常',
    },
  });

  assert.equal(result.executionStatus, 'executable');
  assert.equal(result.quantityRounded, true);
  assert.equal(result.priceAdjustedToTick, true);
  approximatelyEqual(result.roundedBaseQuantity, 0.5);
  approximatelyEqual(result.totalBTCFilled, 0.5);
  approximatelyEqual(result.totalJPYSpent, 50.085);
  approximatelyEqual(result.effectiveVWAP, 100.290204);
  assert.equal(result.feeLabel, '通常');
  assert.equal(result.fills.length, 2);
  approximatelyEqual(result.fills[1].quantity, 0.1);
  assert.match(result.constraintNotes[0], /数量刻み/);
  assert.match(result.constraintNotes[1], /価格刻み/);
});

test('calculateImpact reports insufficient visible liquidity for large quote orders', () => {
  const book = new OrderBook({
    asks: [['100', '0.1', '1']],
    bids: [['99', '0.1', '1']],
    timestamp: '2026-04-23T00:00:00.000Z',
  });

  const result = calculateImpact('buy', 5_000, 'jpy', book);

  assert.equal(result.executionStatus, 'insufficient_liquidity');
  assert.equal(result.insufficient, true);
  assert.ok(result.shortfallJPY > 4_900);
  approximatelyEqual(result.totalBTCFilled, 0.1);
});

test('calculateImpactThresholds preserves breach boundaries on both sides of the book', () => {
  const book = new OrderBook({
    asks: [['101', '0.2', '1'], ['102', '0.3', '2']],
    bids: [['99', '0.4', '2'], ['98', '0.6', '1']],
    timestamp: '2026-04-23T00:00:00.000Z',
  });

  const thresholds = calculateImpactThresholds(book, [1, 2]);

  approximatelyEqual(thresholds.buy[0].maxBTCBeforeBreach, 0.2);
  assert.equal(thresholds.buy[0].breachPrice, 102);
  assert.equal(thresholds.buy[1].limitedByVisibleDepth, true);
  approximatelyEqual(thresholds.sell[0].maxBTCBeforeBreach, 0.4);
  assert.equal(thresholds.sell[0].breachPrice, 98);
});
