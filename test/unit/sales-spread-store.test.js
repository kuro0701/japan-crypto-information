const path = require('path');
const test = require('node:test');
const assert = require('node:assert/strict');

const SalesSpreadStore = require('../../lib/sales-spread-store');
const { createTempDir, removeTempDir } = require('../helpers/temp-dir');

function spreadRecord(exchangeId, spreadPct, capturedAt, overrides = {}) {
  const midPrice = 100;
  const spread = midPrice * (spreadPct / 100);
  return {
    exchangeId,
    exchangeLabel: overrides.exchangeLabel || exchangeId.toUpperCase(),
    instrumentId: overrides.instrumentId || 'BTC-JPY',
    instrumentLabel: overrides.instrumentLabel || 'BTC/JPY',
    baseCurrency: overrides.baseCurrency || 'BTC',
    quoteCurrency: overrides.quoteCurrency || 'JPY',
    currencyFullName: overrides.currencyFullName || 'Bitcoin',
    buyPrice: midPrice + spread / 2,
    sellPrice: midPrice - spread / 2,
    midPrice,
    spread,
    spreadPct,
    quotePrecision: 0,
    capturedAt,
    priceTimestamp: capturedAt,
    dataSource: 'rest',
    isEstimated: false,
  };
}

test('SalesSpreadStore aggregates latest and historical snapshots by window', (t) => {
  const tempDir = createTempDir('okj-sales-store-');
  t.after(() => removeTempDir(tempDir));

  const store = new SalesSpreadStore({
    dataFilePath: path.join(tempDir, 'sales-spread-history.json'),
  });

  store.captureDaily([
    spreadRecord('okj', 1.0, '2026-04-21T00:00:00.000Z'),
    spreadRecord('coincheck', 0.4, '2026-04-21T00:00:00.000Z'),
  ], {
    capturedAt: '2026-04-21T00:00:00.000Z',
    spreadDateJst: '2026-04-21',
    reason: 'test',
  });
  store.captureDaily([
    spreadRecord('okj', 3.0, '2026-04-22T00:00:00.000Z'),
    spreadRecord('coincheck', 0.6, '2026-04-22T00:00:00.000Z'),
  ], {
    capturedAt: '2026-04-22T00:00:00.000Z',
    spreadDateJst: '2026-04-22',
    reason: 'test',
  });
  store.replaceLatest([
    spreadRecord('okj', 2.0, '2026-04-23T00:00:00.000Z'),
    spreadRecord('coincheck', 0.5, '2026-04-23T00:00:00.000Z'),
  ], 'refresh', {
    capturedAt: '2026-04-23T00:00:00.000Z',
  });

  const report = store.getReport();
  assert.equal(report.meta.windows['1d'].source, 'latest');
  assert.equal(report.meta.windows['7d'].source, 'daily-snapshots');
  assert.equal(report.rows[0].exchangeId, 'okj');
  assert.equal(report.rows[0].latest.exchangeId, 'okj');
  assert.equal(report.rows[0].averages['1d'].spreadPct, 2);
  assert.equal(report.rows[0].averages['7d'].spreadPct, 2);
  assert.equal(report.rows[0].averages['7d'].sampleCount, 2);

  const history = store.getHistory('30d');
  assert.equal(history.meta.historySnapshotCount, 2);
  assert.equal(history.rows.length, 4);
  assert.deepEqual(history.rows.map(row => row.date), [
    '2026-04-21',
    '2026-04-21',
    '2026-04-22',
    '2026-04-22',
  ]);
});
