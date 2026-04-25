const path = require('path');
const test = require('node:test');
const assert = require('node:assert/strict');

const VolumeShareStore = require('../../lib/volume-share-store');
const { createTempDir, removeTempDir } = require('../helpers/temp-dir');

function volumeRecord(exchangeId, instrumentId, quoteVolume24h, capturedAt, overrides = {}) {
  const baseCurrency = instrumentId.split('-')[0];
  return {
    exchangeId,
    exchangeLabel: overrides.exchangeLabel || exchangeId.toUpperCase(),
    instrumentId,
    instrumentLabel: overrides.instrumentLabel || instrumentId.replace('-', '/'),
    baseCurrency,
    quoteCurrency: 'JPY',
    baseVolume24h: overrides.baseVolume24h || quoteVolume24h / 100,
    quoteVolume24h,
    quoteVolume24hEstimated: Boolean(overrides.quoteVolume24hEstimated),
    last: overrides.last || 100,
    tickerTimestamp: overrides.tickerTimestamp || capturedAt,
    capturedAt,
    dataSource: overrides.dataSource || 'rest',
  };
}

test('VolumeShareStore aggregates exchange and instrument share from daily snapshots', (t) => {
  const tempDir = createTempDir('okj-volume-store-');
  t.after(() => removeTempDir(tempDir));

  const store = new VolumeShareStore({
    dataFilePath: path.join(tempDir, 'volume-share-history.json'),
  });

  store.captureDaily([
    volumeRecord('okj', 'BTC-JPY', 100, '2026-04-21T00:00:00.000Z'),
    volumeRecord('coincheck', 'BTC-JPY', 300, '2026-04-21T00:00:00.000Z'),
    volumeRecord('okj', 'ETH-JPY', 400, '2026-04-21T00:00:00.000Z'),
  ], {
    capturedAt: '2026-04-21T00:00:00.000Z',
    volumeDateJst: '2026-04-21',
    reason: 'test',
  });
  store.captureDaily([
    volumeRecord('okj', 'BTC-JPY', 200, '2026-04-22T00:00:00.000Z'),
    volumeRecord('coincheck', 'BTC-JPY', 100, '2026-04-22T00:00:00.000Z'),
    volumeRecord('okj', 'ETH-JPY', 500, '2026-04-22T00:00:00.000Z'),
  ], {
    capturedAt: '2026-04-22T00:00:00.000Z',
    volumeDateJst: '2026-04-22',
    reason: 'test',
  });

  const share = store.getShare('7d');
  assert.equal(share.meta.source, 'daily-snapshots');
  assert.equal(share.meta.totalQuoteVolume, 1_600);
  assert.equal(share.exchanges[0].exchangeId, 'okj');
  assert.equal(share.instruments[0].instrumentId, 'ETH-JPY');

  const btcOkj = share.rows.find(row => row.exchangeId === 'okj' && row.instrumentId === 'BTC-JPY');
  assert.equal(btcOkj.quoteVolume, 300);
  assert.equal(btcOkj.instrumentTotalQuoteVolume, 700);
  assert.equal(Number(btcOkj.instrumentSharePct.toFixed(6)), Number((300 / 700 * 100).toFixed(6)));
});

test('VolumeShareStore falls back to latest records when no history snapshots exist', (t) => {
  const tempDir = createTempDir('okj-volume-store-fallback-');
  t.after(() => removeTempDir(tempDir));

  const store = new VolumeShareStore({
    dataFilePath: path.join(tempDir, 'volume-share-history.json'),
  });

  store.replaceLatest([
    volumeRecord('okj', 'BTC-JPY', 250, '2026-04-23T00:00:00.000Z'),
  ], 'refresh', {
    capturedAt: '2026-04-23T00:00:00.000Z',
  });

  const history = store.getHistory('30d');
  assert.equal(history.meta.source, 'latest-fallback');
  assert.equal(history.rows.length, 1);
  assert.equal(history.rows[0].quoteVolume, 250);
});

test('VolumeShareStore supports extended history windows for longer comparisons', (t) => {
  const tempDir = createTempDir('okj-volume-store-90d-');
  t.after(() => removeTempDir(tempDir));

  const store = new VolumeShareStore({
    dataFilePath: path.join(tempDir, 'volume-share-history.json'),
  });

  store.captureDaily([
    volumeRecord('okj', 'BTC-JPY', 100, '2026-04-20T00:00:00.000Z'),
  ], {
    capturedAt: '2026-04-20T00:00:00.000Z',
    volumeDateJst: '2026-04-20',
    reason: 'test',
  });
  store.captureDaily([
    volumeRecord('okj', 'BTC-JPY', 200, '2026-04-21T00:00:00.000Z'),
  ], {
    capturedAt: '2026-04-21T00:00:00.000Z',
    volumeDateJst: '2026-04-21',
    reason: 'test',
  });

  const history = store.getHistory('90d');
  assert.equal(history.meta.windowKey, '90d');
  assert.equal(history.meta.windowDays, 90);
  assert.equal(history.meta.historySnapshotCount, 2);
  assert.equal(history.rows.length, 2);
});

test('VolumeShareStore excludes provisional current-day snapshots from history windows', (t) => {
  const tempDir = createTempDir('okj-volume-store-provisional-');
  t.after(() => removeTempDir(tempDir));

  const store = new VolumeShareStore({
    dataFilePath: path.join(tempDir, 'volume-share-history.json'),
  });

  store.captureDaily([
    volumeRecord('okj', 'BTC-JPY', 100, '2026-04-24T15:05:00.000Z'),
  ], {
    capturedAt: '2026-04-24T15:05:00.000Z',
    volumeDateJst: '2026-04-24',
    reason: 'early-morning-catchup',
  });
  store.captureDaily([
    volumeRecord('okj', 'BTC-JPY', 999, '2026-04-25T03:00:00.000Z'),
  ], {
    capturedAt: '2026-04-25T03:00:00.000Z',
    volumeDateJst: '2026-04-25',
    reason: 'startup-snapshot',
  });

  const history = store.getHistory('30d', { now: '2026-04-25T12:00:00.000+09:00' });
  assert.equal(history.meta.availableDailySnapshotCount, 1);
  assert.equal(history.meta.totalDailySnapshotCount, 2);
  assert.equal(history.meta.provisionalDailySnapshotCount, 1);
  assert.equal(history.meta.latestRecordedVolumeDateJst, '2026-04-25');
  assert.equal(history.meta.latestProvisionalVolumeDateJst, '2026-04-25');
  assert.equal(history.meta.historySnapshotCount, 1);
  assert.deepEqual(history.rows.map(row => row.date), ['2026-04-24']);

  const share = store.getShare('7d', { now: '2026-04-25T12:00:00.000+09:00' });
  assert.equal(share.meta.dailySnapshotCount, 1);
  assert.equal(share.meta.availableDailySnapshotCount, 1);
  assert.equal(share.meta.totalDailySnapshotCount, 2);
  assert.equal(share.meta.provisionalDailySnapshotCount, 1);
  assert.equal(share.meta.latestRecordedVolumeDateJst, '2026-04-25');
  assert.equal(share.meta.latestProvisionalVolumeDateJst, '2026-04-25');
  assert.equal(share.meta.totalQuoteVolume, 100);
});

test('VolumeShareStore tracks partial snapshot coverage without dropping history', (t) => {
  const tempDir = createTempDir('okj-volume-store-partial-');
  t.after(() => removeTempDir(tempDir));

  const store = new VolumeShareStore({
    dataFilePath: path.join(tempDir, 'volume-share-history.json'),
  });

  store.captureDaily([
    volumeRecord('okj', 'BTC-JPY', 100, '2026-04-24T15:05:00.000Z'),
    volumeRecord('coincheck', 'BTC-JPY', 200, '2026-04-24T15:05:00.000Z'),
  ], {
    capturedAt: '2026-04-24T15:05:00.000Z',
    volumeDateJst: '2026-04-24',
    reason: 'jst-midnight',
    capturedExchangeIds: ['coincheck', 'okj'],
  });
  store.captureDaily([
    volumeRecord('okj', 'BTC-JPY', 150, '2026-04-25T15:05:00.000Z'),
  ], {
    capturedAt: '2026-04-25T15:05:00.000Z',
    volumeDateJst: '2026-04-25',
    reason: 'jst-midnight',
    capturedExchangeIds: ['okj'],
    missingRequiredExchangeIds: ['coincheck'],
  });

  const history = store.getHistory('30d', { now: '2026-04-26T12:00:00.000+09:00' });
  assert.equal(history.meta.historySnapshotCount, 2);
  assert.equal(history.meta.partialDailySnapshotCount, 1);
  assert.equal(history.meta.latestPartialVolumeDateJst, '2026-04-25');
  assert.deepEqual(history.rows.map(row => row.date), ['2026-04-24', '2026-04-24', '2026-04-25']);
});
