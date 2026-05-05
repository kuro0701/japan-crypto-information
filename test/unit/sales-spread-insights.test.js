const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildSalesSpreadFrame,
  generateSalesSpreadInsights,
  renderSalesSpreadInsightsJa,
} = require('../../lib/sales-spread-insights');

function row(date, exchangeId, spreadPct, overrides = {}) {
  return {
    date,
    exchangeId,
    exchangeLabel: overrides.exchangeLabel || exchangeId.toUpperCase(),
    instrumentId: overrides.instrumentId || 'BTC-JPY',
    instrumentLabel: overrides.instrumentLabel || 'BTC/JPY',
    spread: spreadPct,
    spreadPct,
  };
}

test('buildSalesSpreadFrame aggregates daily instrument spreads by default', () => {
  const frame = buildSalesSpreadFrame([
    row('2026-04-01', 'a', 1.0),
    row('2026-04-01', 'b', 3.0),
    row('2026-04-01', 'a', 0.5, { instrumentId: 'ETH-JPY', instrumentLabel: 'ETH/JPY' }),
  ]);

  assert.equal(frame.rows.length, 2);
  const btc = frame.rows.find(item => item.instrumentId === 'BTC-JPY');
  assert.equal(btc.entityType, 'instrument');
  assert.equal(btc.spreadPct, 2);
  assert.equal(btc.venueCount, 2);
});

test('buildSalesSpreadFrame switches to exchange rows when filtering an instrument', () => {
  const frame = buildSalesSpreadFrame([
    row('2026-04-01', 'a', 1.0),
    row('2026-04-01', 'b', 3.0),
    row('2026-04-01', 'a', 0.5, { instrumentId: 'ETH-JPY', instrumentLabel: 'ETH/JPY' }),
  ], {
    instrumentId: 'BTC-JPY',
  });

  assert.equal(frame.rows.length, 2);
  assert.equal(frame.filters.entityType, 'exchange');
  assert.deepEqual(frame.rows.map(item => item.exchangeId).sort(), ['a', 'b']);
});

test('generateSalesSpreadInsights emits narrowing and widening insights', () => {
  const result = generateSalesSpreadInsights([
    row('2026-04-01', 'a', 2.0),
    row('2026-04-01', 'b', 2.0),
    row('2026-04-02', 'a', 0.8),
    row('2026-04-02', 'b', 3.5),
  ], {
    filters: { instrumentId: 'BTC-JPY' },
    config: { window: 2, maxInsights: 8, minSpreadChange: 0.1 },
  });

  const types = new Set(result.insights.map(insight => insight.type));
  assert.equal(types.has('top_narrowing'), true);
  assert.equal(types.has('top_widening'), true);
  assert.match(result.insights.find(insight => insight.type === 'top_narrowing').messageJa, /% → /);
});

test('generateSalesSpreadInsights can compare seven days back', () => {
  const rows = [];
  for (let index = 1; index <= 8; index += 1) {
    const date = `2026-04-${String(index).padStart(2, '0')}`;
    rows.push(row(date, 'a', index === 8 ? 1.0 : 2.0));
    rows.push(row(date, 'b', index === 8 ? 4.0 : 2.0));
  }

  const result = generateSalesSpreadInsights(rows, {
    filters: { instrumentId: 'BTC-JPY' },
    config: { periods: 7, periodLabel: '7d', window: 2, maxInsights: 8, minSpreadChange: 0.1 },
  });

  assert.equal(result.meta.previousDate, '2026-04-01');
  assert.equal(result.meta.period.comparisonLabel, '7日前比');
  assert.equal(result.insights.some(insight => insight.type === 'top_narrowing'), true);
});

test('zscore and streak insights are generated with enough spread history', () => {
  const rows = [];
  for (let index = 0; index < 9; index += 1) {
    const date = `2026-04-${String(index + 1).padStart(2, '0')}`;
    rows.push(row(date, 'a', 3.0 - index * 0.1));
    rows.push(row(date, 'b', 1.0 + index * 0.1));
  }
  rows.push(row('2026-04-10', 'a', 0.5));
  rows.push(row('2026-04-10', 'b', 4.0));

  const result = generateSalesSpreadInsights(rows, {
    filters: { instrumentId: 'BTC-JPY' },
    config: { window: 8, maxInsights: 8, zscoreThreshold: 2.0, minSpreadChange: 0.1 },
  });
  const types = new Set(result.insights.map(insight => insight.type));

  assert.equal(types.has('zscore_outlier'), true);
  assert.equal(types.has('narrowing_streak') || types.has('widening_streak'), true);
});

test('renderSalesSpreadInsightsJa returns non-empty report', () => {
  const result = generateSalesSpreadInsights([
    row('2026-04-01', 'a', 2.0),
    row('2026-04-02', 'a', 1.0),
  ], {
    filters: { instrumentId: 'BTC-JPY' },
  });

  const report = renderSalesSpreadInsightsJa(result.insights);
  assert.match(report, /・/);
  assert.ok(report.length > 0);
});
