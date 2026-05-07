const fs = require('fs');
const path = require('path');
const test = require('node:test');
const assert = require('node:assert/strict');

const VolumeShareStore = require('../../lib/volume-share-store');
const { createTempDir, removeTempDir } = require('../helpers/temp-dir');

class MemoryPersistence {
  constructor(initialState = {}) {
    this.state = JSON.parse(JSON.stringify(initialState));
    this.saved = [];
  }

  async load(key) {
    return this.state[key] || null;
  }

  async save(key, payload) {
    this.state[key] = JSON.parse(JSON.stringify(payload));
    this.saved.push({ key, payload: this.state[key] });
    return true;
  }
}

function volumeRecord(exchangeId, instrumentId, quoteVolume24h, capturedAt, overrides = {}) {
  const baseCurrency = instrumentId.split('-')[0];
  return {
    exchangeId,
    exchangeLabel: overrides.exchangeLabel || exchangeId.toUpperCase(),
    instrumentId,
    instrumentLabel: overrides.instrumentLabel || instrumentId.replace('-', '/'),
    baseCurrency,
    quoteCurrency: 'JPY',
    marketType: overrides.marketType || 'spot',
    marketTypeLabel: overrides.marketTypeLabel || null,
    derivativeType: overrides.derivativeType || null,
    underlyingInstrumentId: overrides.underlyingInstrumentId || null,
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

test('VolumeShareStore can filter derivative records for dedicated share and insights views', (t) => {
  const tempDir = createTempDir('okj-volume-store-derivatives-');
  t.after(() => removeTempDir(tempDir));

  const store = new VolumeShareStore({
    dataFilePath: path.join(tempDir, 'volume-share-history.json'),
  });
  const derivativeFilter = (record) => record.marketType === 'derivative' || /-CFD-/i.test(record.instrumentId || '');

  store.captureDaily([
    volumeRecord('okj', 'BTC-JPY', 100, '2026-04-21T00:00:00.000Z'),
    volumeRecord('bitflyer', 'BTC-CFD-JPY', 300, '2026-04-21T00:00:00.000Z', {
      exchangeLabel: 'bitFlyer',
      instrumentLabel: 'BTC-CFD/JPY',
      marketType: 'derivative',
      marketTypeLabel: 'Crypto CFD',
      derivativeType: 'cfd',
      underlyingInstrumentId: 'BTC-JPY',
    }),
    volumeRecord('gmo', 'ETH-CFD-JPY', 200, '2026-04-21T00:00:00.000Z', {
      exchangeLabel: 'GMOコイン',
      instrumentLabel: 'ETH-CFD/JPY',
      marketType: 'derivative',
      marketTypeLabel: '暗号資産FX',
      derivativeType: 'cfd',
      underlyingInstrumentId: 'ETH-JPY',
    }),
  ], {
    capturedAt: '2026-04-21T00:00:00.000Z',
    volumeDateJst: '2026-04-21',
    reason: 'test',
  });

  const share = store.getShare('7d', { recordFilter: derivativeFilter });
  assert.equal(share.meta.totalQuoteVolume, 500);
  assert.deepEqual(share.rows.map(row => row.instrumentId).sort(), ['BTC-CFD-JPY', 'ETH-CFD-JPY']);
  assert.ok(share.rows.every(row => row.marketType === 'derivative'));

  const history = store.getHistory('30d', { recordFilter: derivativeFilter });
  assert.equal(history.rows.length, 2);
  assert.ok(history.rows.every(row => row.instrumentId.includes('-CFD-')));

  const insights = store.getInsights('90d', {
    recordFilter: derivativeFilter,
    insightConfig: { periods: 1, maxInsights: 3 },
  });
  assert.ok(Array.isArray(insights.insights));
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

test('VolumeShareStore merges bundled seed snapshots into existing persistence', async (t) => {
  const tempDir = createTempDir('okj-volume-store-merge-');
  t.after(() => removeTempDir(tempDir));

  const seedFilePath = path.join(tempDir, 'volume-share-history.json');
  fs.writeFileSync(seedFilePath, JSON.stringify({
    version: 1,
    latest: {
      capturedAt: '2026-04-25T00:00:00.000Z',
      jstDate: '2026-04-25',
      source: 'seed',
      records: [
        volumeRecord('okj', 'BTC-JPY', 240, '2026-04-25T00:00:00.000Z'),
      ],
    },
    dailySnapshots: [
      {
        capturedAt: '2026-04-24T00:00:00.000Z',
        jstDate: '2026-04-24',
        volumeDateJst: '2026-04-24',
        reason: 'startup-snapshot',
        records: [
          volumeRecord('okj', 'BTC-JPY', 240, '2026-04-24T00:00:00.000Z'),
        ],
      },
    ],
  }));

  const persistence = new MemoryPersistence({
    'volume-share': {
      version: 1,
      latest: {
        capturedAt: '2026-04-26T00:00:00.000Z',
        jstDate: '2026-04-26',
        source: 'neon',
        records: [
          volumeRecord('okj', 'BTC-JPY', 260, '2026-04-26T00:00:00.000Z'),
        ],
      },
      dailySnapshots: [
        {
          capturedAt: '2026-04-19T00:00:00.000Z',
          jstDate: '2026-04-19',
          volumeDateJst: '2026-04-19',
          reason: 'jst-midnight',
          records: [
            volumeRecord('okj', 'BTC-JPY', 190, '2026-04-19T00:00:00.000Z'),
          ],
        },
      ],
    },
  });

  const store = new VolumeShareStore({
    dataFilePath: null,
    seedFilePath,
    persistence,
    persistenceKey: 'volume-share',
  });
  await store.initializePersistence();

  assert.equal(store.data.latest.capturedAt, '2026-04-26T00:00:00.000Z');
  assert.deepEqual(store.data.dailySnapshots.map(snapshot => snapshot.volumeDateJst), [
    '2026-04-19',
    '2026-04-24',
  ]);
  assert.equal(persistence.saved.length, 1);
  assert.deepEqual(persistence.state['volume-share'].dailySnapshots.map(snapshot => snapshot.volumeDateJst), [
    '2026-04-19',
    '2026-04-24',
  ]);

  const history = store.getHistory('30d', { now: '2026-04-26T12:00:00.000+09:00' });
  assert.deepEqual([...new Set(history.rows.map(row => row.date))], [
    '2026-04-19',
    '2026-04-24',
  ]);
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

  const historyWithProvisional = store.getHistory('30d', {
    now: '2026-04-25T12:00:00.000+09:00',
    includeProvisional: true,
  });
  assert.equal(historyWithProvisional.meta.historySnapshotCount, 2);
  assert.deepEqual(historyWithProvisional.rows.map(row => row.date), ['2026-04-24', '2026-04-25']);

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

test('VolumeShareStore keeps the best snapshot for a day instead of blindly overwriting', (t) => {
  const tempDir = createTempDir('okj-volume-store-best-');
  t.after(() => removeTempDir(tempDir));

  const store = new VolumeShareStore({
    dataFilePath: path.join(tempDir, 'volume-share-history.json'),
  });

  store.captureDaily([
    volumeRecord('okj', 'BTC-JPY', 100, '2026-04-25T10:00:00.000Z'),
    volumeRecord('coincheck', 'BTC-JPY', 200, '2026-04-25T10:00:00.000Z'),
  ], {
    capturedAt: '2026-04-25T10:00:00.000Z',
    volumeDateJst: '2026-04-25',
    reason: 'startup-snapshot',
    capturedExchangeIds: ['coincheck', 'okj'],
  });
  store.captureDaily([
    volumeRecord('okj', 'BTC-JPY', 150, '2026-04-25T15:00:00.000Z'),
  ], {
    capturedAt: '2026-04-25T15:00:00.000Z',
    volumeDateJst: '2026-04-25',
    reason: 'jst-midnight',
    capturedExchangeIds: ['okj'],
    missingRequiredExchangeIds: ['coincheck'],
  });

  const history = store.getHistory('30d', { now: '2026-04-26T12:00:00.000+09:00' });
  assert.equal(history.meta.historySnapshotCount, 1);
  assert.equal(history.meta.partialDailySnapshotCount, 0);
  assert.deepEqual(history.rows.map(row => row.exchangeId).sort(), ['coincheck', 'okj']);
});
