const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildExchangeShareFrame,
  generateVolumeShareInsights,
  renderVolumeShareInsightsJa,
} = require('../../lib/volume-share-insights');

function row(date, exchangeId, quoteVolume, overrides = {}) {
  return {
    date,
    exchangeId,
    exchangeLabel: overrides.exchangeLabel || exchangeId.toUpperCase(),
    instrumentId: overrides.instrumentId || 'BTC-JPY',
    instrumentLabel: overrides.instrumentLabel || 'BTC/JPY',
    quoteVolume,
  };
}

test('buildExchangeShareFrame aggregates daily exchange shares', () => {
  const frame = buildExchangeShareFrame([
    row('2026-04-01', 'a', 300),
    row('2026-04-01', 'b', 200),
    row('2026-04-01', 'a', 500, { instrumentId: 'ETH-JPY' }),
  ]);

  assert.equal(frame.rows.length, 2);
  const exchangeA = frame.rows.find(item => item.exchangeId === 'a');
  assert.equal(exchangeA.quoteVolume, 800);
  assert.equal(Number(exchangeA.volumeShare.toFixed(6)), Number((800 / 1000).toFixed(6)));
});

test('generateVolumeShareInsights emits top gainer and loser', () => {
  const result = generateVolumeShareInsights([
    row('2026-04-01', 'a', 500),
    row('2026-04-01', 'b', 300),
    row('2026-04-01', 'c', 200),
    row('2026-04-02', 'a', 400),
    row('2026-04-02', 'b', 450),
    row('2026-04-02', 'c', 150),
  ], {
    config: { window: 2, maxInsights: 8 },
  });

  const types = new Set(result.insights.map(insight => insight.type));
  assert.equal(types.has('top_gainer'), true);
  assert.equal(types.has('top_loser'), true);
});

test('generateVolumeShareInsights emits leader change', () => {
  const result = generateVolumeShareInsights([
    row('2026-04-01', 'a', 500),
    row('2026-04-01', 'b', 300),
    row('2026-04-01', 'c', 200),
    row('2026-04-02', 'a', 400),
    row('2026-04-02', 'b', 450),
    row('2026-04-02', 'c', 150),
  ], {
    config: { window: 2, maxInsights: 8 },
  });

  const leaderChange = result.insights.find(insight => insight.type === 'leader_change');
  assert.ok(leaderChange);
  assert.equal(leaderChange.exchangeId, 'b');
});

test('small share changes under threshold are suppressed', () => {
  const result = generateVolumeShareInsights([
    row('2026-04-01', 'a', 501),
    row('2026-04-01', 'b', 499),
    row('2026-04-02', 'a', 501.5),
    row('2026-04-02', 'b', 498.5),
  ], {
    config: {
      window: 2,
      maxInsights: 8,
      minShareChange: 0.002,
      gapChangeThreshold: 0.002,
      concentrationChangeThreshold: 0.002,
    },
  });

  const types = new Set(result.insights.map(insight => insight.type));
  assert.equal(types.has('top_gainer'), false);
  assert.equal(types.has('top_loser'), false);
});

test('zscore outlier and streak insights are generated with enough history', () => {
  const rows = [];
  for (let index = 0; index < 9; index += 1) {
    const date = `2026-04-${String(index + 1).padStart(2, '0')}`;
    rows.push(row(date, 'a', 500 + index * 5));
    rows.push(row(date, 'b', 500 - index * 5));
  }
  rows.push(row('2026-04-10', 'a', 800));
  rows.push(row('2026-04-10', 'b', 200));

  const result = generateVolumeShareInsights(rows, {
    config: { window: 8, maxInsights: 8, zscoreThreshold: 2.0 },
  });
  const types = new Set(result.insights.map(insight => insight.type));

  assert.equal(types.has('zscore_outlier'), true);
  assert.equal(types.has('increase_streak') || types.has('decrease_streak'), true);
});

test('renderVolumeShareInsightsJa returns non-empty report', () => {
  const result = generateVolumeShareInsights([
    row('2026-04-01', 'a', 500),
    row('2026-04-01', 'b', 300),
    row('2026-04-02', 'a', 400),
    row('2026-04-02', 'b', 600),
  ]);

  const report = renderVolumeShareInsightsJa(result.insights);
  assert.match(report, /・/);
  assert.ok(report.length > 0);
});
