const fs = require('fs');
const path = require('path');
const test = require('node:test');
const assert = require('node:assert/strict');

const AnalyticsStore = require('../../lib/analytics-store');
const { createTempDir, removeTempDir } = require('../helpers/temp-dir');

test('AnalyticsStore aggregates route, visitor, referrer, device, and websocket stats', (t) => {
  const tempDir = createTempDir('okj-analytics-store-');

  const store = new AnalyticsStore({
    dataFilePath: path.join(tempDir, 'analytics.json'),
    salt: 'test-salt',
  });
  t.after(() => {
    store.dispose();
    removeTempDir(tempDir);
  });

  store.data.days = {
    '2026-04-21': {
      date: '2026-04-21',
      pageViews: 3,
      routes: { '/': 2, '/markets/BTC-JPY': 1 },
      hours: { '09': 2, '10': 1 },
      referrers: { direct: 2, 'google.com': 1 },
      devices: { desktop: 2, mobile: 1 },
      visitorHashes: { visitorA: true, visitorB: true },
      ws: { connections: 1, peakConcurrent: 1 },
      firstAccessAt: '2026-04-21T09:00:00.000Z',
      lastAccessAt: '2026-04-21T10:00:00.000Z',
    },
    '2026-04-22': {
      date: '2026-04-22',
      pageViews: 2,
      routes: { '/': 1, '/sales-spread': 1 },
      hours: { '11': 2 },
      referrers: { direct: 1, 'x.com': 1 },
      devices: { desktop: 1, bot: 1 },
      visitorHashes: { visitorB: true, visitorC: true },
      ws: { connections: 2, peakConcurrent: 2 },
      firstAccessAt: '2026-04-22T11:00:00.000Z',
      lastAccessAt: '2026-04-22T11:30:00.000Z',
    },
  };
  store.currentWsConnections = 1;

  const report = store.getReport('7d');

  assert.equal(report.meta.totalPageViews, 5);
  assert.equal(report.meta.uniqueVisitors, 3);
  assert.equal(report.meta.lastAccessAt, '2026-04-22T11:30:00.000Z');
  assert.equal(report.ws.connections, 3);
  assert.equal(report.ws.peakConcurrent, 2);
  assert.equal(report.ws.currentConcurrent, 1);
  assert.equal(report.routes[0].key, '/');
  assert.equal(report.routes[0].count, 3);
  assert.equal(report.devices[0].key, 'desktop');
  assert.equal(report.devices[0].count, 3);
  assert.equal(report.days.length, 2);
});

test('AnalyticsStore batches disk writes while keeping in-memory counters current', async (t) => {
  const tempDir = createTempDir('okj-analytics-store-batch-');

  const dataFilePath = path.join(tempDir, 'analytics.json');
  const store = new AnalyticsStore({
    dataFilePath,
    salt: 'test-salt',
    flushDelayMs: 20,
  });
  t.after(() => {
    store.dispose();
    removeTempDir(tempDir);
  });

  const req = {
    headers: {
      host: 'example.com',
      'user-agent': 'UnitTest/1.0',
      referer: '',
    },
    ip: '127.0.0.1',
  };

  store.trackPageView(req, '/');
  store.trackPageView(req, '/markets/BTC-JPY');

  const report = store.getReport('7d');
  assert.equal(report.meta.totalPageViews, 2);
  assert.equal(fs.existsSync(dataFilePath), false);

  await new Promise(resolve => setTimeout(resolve, 60));

  assert.equal(fs.existsSync(dataFilePath), true);
  const saved = JSON.parse(fs.readFileSync(dataFilePath, 'utf8'));
  const savedDay = Object.values(saved.days)[0];
  assert.equal(savedDay.pageViews, 2);
  assert.equal(savedDay.routes['/'], 1);
  assert.equal(savedDay.routes['/markets/BTC-JPY'], 1);
});
