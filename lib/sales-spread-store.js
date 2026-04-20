const fs = require('fs');
const path = require('path');

const JST_TIME_ZONE = 'Asia/Tokyo';
const WINDOW_DAYS = {
  '1d': 1,
  '24h': 1,
  '7d': 7,
  '30d': 30,
};
const REPORT_WINDOWS = ['1d', '7d', '30d'];

function parseNumber(value) {
  const parsed = parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function getJstParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: JST_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date).reduce((acc, part) => {
    if (part.type !== 'literal') acc[part.type] = part.value;
    return acc;
  }, {});

  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    second: Number(parts.second),
  };
}

function getJstDate(date = new Date()) {
  return getJstParts(date).date;
}

function getPreviousJstDate(date = new Date()) {
  return getJstDate(new Date(date.getTime() - 24 * 60 * 60 * 1000));
}

function marketKey(exchangeId, instrumentId) {
  return `${exchangeId}:${instrumentId}`;
}

function normalizeDataSource(value) {
  const text = String(value || '').toLowerCase();
  if (text.includes('websocket') || text === 'ws' || text.includes('stream') || text.includes('realtime')) return 'websocket';
  if (text.includes('rest') || text.includes('api') || text.includes('poll')) return 'rest';
  if (text.includes('web') || text.includes('html')) return 'web';
  return text || 'unknown';
}

function maxIso(current, value) {
  if (!value) return current || null;
  const time = Date.parse(value);
  if (Number.isNaN(time)) return current || null;
  if (!current) return new Date(time).toISOString();
  return time > Date.parse(current) ? new Date(time).toISOString() : current;
}

function summarizeRecords(records) {
  const summary = {
    spread: 0,
    spreadPct: 0,
    buyPrice: 0,
    sellPrice: 0,
    midPrice: 0,
    sampleCount: 0,
  };

  for (const record of records || []) {
    const spread = parseNumber(record.spread);
    const spreadPct = parseNumber(record.spreadPct);
    const buyPrice = parseNumber(record.buyPrice);
    const sellPrice = parseNumber(record.sellPrice);
    const midPrice = parseNumber(record.midPrice);
    if (spread == null || spreadPct == null || buyPrice == null || sellPrice == null || midPrice == null) {
      continue;
    }

    summary.spread += spread;
    summary.spreadPct += spreadPct;
    summary.buyPrice += buyPrice;
    summary.sellPrice += sellPrice;
    summary.midPrice += midPrice;
    summary.sampleCount += 1;
  }

  if (summary.sampleCount === 0) return null;

  return {
    spread: summary.spread / summary.sampleCount,
    spreadPct: summary.spreadPct / summary.sampleCount,
    buyPrice: summary.buyPrice / summary.sampleCount,
    sellPrice: summary.sellPrice / summary.sampleCount,
    midPrice: summary.midPrice / summary.sampleCount,
    sampleCount: summary.sampleCount,
  };
}

class SalesSpreadStore {
  constructor({ dataFilePath }) {
    this.dataFilePath = dataFilePath;
    this.data = {
      version: 1,
      latest: null,
      dailySnapshots: [],
    };
    this.liveRecords = new Map();
    this.refreshStatus = {
      running: false,
      startedAt: null,
      finishedAt: null,
      source: null,
      errors: [],
    };

    this.load();
  }

  load() {
    try {
      if (!fs.existsSync(this.dataFilePath)) return;
      const parsed = JSON.parse(fs.readFileSync(this.dataFilePath, 'utf8'));
      this.data = {
        version: 1,
        latest: parsed.latest || null,
        dailySnapshots: Array.isArray(parsed.dailySnapshots) ? parsed.dailySnapshots : [],
      };

      for (const record of (this.data.latest && this.data.latest.records) || []) {
        this.liveRecords.set(marketKey(record.exchangeId, record.instrumentId), record);
      }
    } catch (err) {
      console.warn('[Sales Spread] Could not load history:', err.message);
    }
  }

  save() {
    const dir = path.dirname(this.dataFilePath);
    fs.mkdirSync(dir, { recursive: true });
    const tmpPath = `${this.dataFilePath}.tmp`;
    fs.writeFileSync(tmpPath, JSON.stringify(this.data, null, 2));
    fs.renameSync(tmpPath, this.dataFilePath);
  }

  buildRecord(raw, exchange, capturedAt = new Date()) {
    if (!raw || !exchange) return null;

    const baseCurrency = String(raw.baseCurrencySymbol || '').toUpperCase();
    if (!baseCurrency) return null;

    const buyPrice = parseNumber(raw.buyPrice);
    const sellPrice = parseNumber(raw.sellPrice);
    let midPrice = parseNumber(raw.midPrice);
    if (midPrice == null && buyPrice != null && sellPrice != null) {
      midPrice = (buyPrice + sellPrice) / 2;
    }

    if (buyPrice == null || sellPrice == null || midPrice == null || midPrice <= 0) return null;

    const spread = buyPrice - sellPrice;
    if (spread < 0) return null;

    const capturedIso = capturedAt.toISOString();
    const priceTimestamp = raw.createdDate ? new Date(Number(raw.createdDate)).toISOString() : null;
    const instrumentId = `${baseCurrency}-JPY`;

    return {
      exchangeId: exchange.id,
      exchangeLabel: exchange.label || exchange.id,
      instrumentId,
      instrumentLabel: `${baseCurrency}/JPY`,
      baseCurrency,
      quoteCurrency: 'JPY',
      currencyFullName: raw.currencyFullName || '',
      buyPrice,
      sellPrice,
      midPrice,
      spread,
      spreadPct: (spread / midPrice) * 100,
      quotePrecision: Number.isFinite(Number(raw.quotePrecision)) ? Number(raw.quotePrecision) : null,
      change24h: raw.change24h || null,
      isOnline: raw.isOnline === true,
      isWidgetOpen: raw.isWidgetOpen === true,
      priceTimestamp,
      capturedAt: capturedIso,
      dataSource: normalizeDataSource(raw.dataSource || raw.source || 'rest'),
      isEstimated: raw.isEstimated === true || raw.estimated === true,
    };
  }

  replaceLatest(records, source = 'refresh', meta = {}) {
    const capturedAt = meta.capturedAt || new Date().toISOString();
    this.liveRecords.clear();
    for (const record of records || []) {
      if (!record) continue;
      this.liveRecords.set(marketKey(record.exchangeId, record.instrumentId), {
        ...record,
        capturedAt,
      });
    }

    this.data.latest = {
      capturedAt,
      jstDate: getJstDate(new Date(capturedAt)),
      source,
      errors: Array.isArray(meta.errors) ? meta.errors : [],
      records: Array.from(this.liveRecords.values()),
    };
    this.save();
  }

  captureDaily(records, meta = {}) {
    if (!Array.isArray(records) || records.length === 0) return null;
    const capturedAt = meta.capturedAt || new Date().toISOString();
    const capturedDate = new Date(capturedAt);
    const spreadDateJst = meta.spreadDateJst || getPreviousJstDate(capturedDate);
    const snapshot = {
      capturedAt,
      jstDate: getJstDate(capturedDate),
      spreadDateJst,
      reason: meta.reason || 'jst-midnight',
      records,
    };

    this.data.dailySnapshots = this.data.dailySnapshots
      .filter(item => item.spreadDateJst !== spreadDateJst)
      .concat(snapshot)
      .sort((a, b) => String(a.spreadDateJst).localeCompare(String(b.spreadDateJst)))
      .slice(-45);
    this.save();
    return snapshot;
  }

  setRefreshStatus(status) {
    this.refreshStatus = {
      ...this.refreshStatus,
      ...status,
    };
  }

  getDailySnapshot(spreadDateJst) {
    return this.data.dailySnapshots.find(item => item.spreadDateJst === spreadDateJst) || null;
  }

  hasDailySnapshot(spreadDateJst) {
    return this.getDailySnapshot(spreadDateJst) !== null;
  }

  getLatestRecords() {
    const records = new Map();
    for (const record of (this.data.latest && this.data.latest.records) || []) {
      records.set(marketKey(record.exchangeId, record.instrumentId), record);
    }
    for (const [key, record] of this.liveRecords) {
      records.set(key, record);
    }
    return Array.from(records.values());
  }

  getQualityErrors() {
    const byExchange = new Map();
    const addError = (error) => {
      if (!error || !error.exchangeId) return;
      const existing = byExchange.get(error.exchangeId) || {
        exchangeId: error.exchangeId,
        exchangeLabel: error.exchangeLabel || error.exchangeId,
        messages: [],
      };
      if (error.message && !existing.messages.includes(error.message)) {
        existing.messages.push(error.message);
      }
      byExchange.set(error.exchangeId, existing);
    };

    for (const error of (this.data.latest && this.data.latest.errors) || []) addError(error);
    for (const error of this.refreshStatus.errors || []) addError(error);
    return Array.from(byExchange.values());
  }

  buildQualityRows(records) {
    const byExchange = new Map();
    const ensureQuality = (exchangeId, exchangeLabel) => {
      if (!byExchange.has(exchangeId)) {
        byExchange.set(exchangeId, {
          exchangeId,
          exchangeLabel: exchangeLabel || exchangeId,
          apiStatus: 'waiting',
          lastFetchedAt: null,
          lastSourceAt: null,
          transportSources: new Set(),
          sampleCount: 0,
          measuredCount: 0,
          estimatedCount: 0,
          errorCount: 0,
          messages: [],
        });
      }
      return byExchange.get(exchangeId);
    };

    for (const record of records || []) {
      if (!record || !record.exchangeId) continue;
      const quality = ensureQuality(record.exchangeId, record.exchangeLabel);
      quality.sampleCount += 1;
      quality.lastFetchedAt = maxIso(quality.lastFetchedAt, record.capturedAt);
      quality.lastSourceAt = maxIso(quality.lastSourceAt, record.priceTimestamp || record.capturedAt);
      quality.transportSources.add(normalizeDataSource(record.dataSource || record.source || 'rest'));
      if (record.isEstimated === true) {
        quality.estimatedCount += 1;
      } else {
        quality.measuredCount += 1;
      }
    }

    for (const error of this.getQualityErrors()) {
      const quality = ensureQuality(error.exchangeId, error.exchangeLabel);
      quality.errorCount += 1;
      for (const message of error.messages) {
        if (message && !quality.messages.includes(message)) quality.messages.push(message);
      }
    }

    return Array.from(byExchange.values())
      .map((quality) => {
        const apiStatus = quality.errorCount > 0
          ? (quality.sampleCount > 0 ? 'partial' : 'failed')
          : (quality.sampleCount > 0 ? 'success' : 'waiting');
        const dataKind = quality.estimatedCount > 0
          ? (quality.measuredCount > 0 ? 'mixed' : 'estimated')
          : (quality.measuredCount > 0 ? 'measured' : 'unknown');

        return {
          exchangeId: quality.exchangeId,
          exchangeLabel: quality.exchangeLabel,
          apiStatus,
          lastFetchedAt: quality.lastFetchedAt,
          lastSourceAt: quality.lastSourceAt,
          transportSources: Array.from(quality.transportSources).filter(source => source !== 'unknown').sort(),
          sampleCount: quality.sampleCount,
          measuredCount: quality.measuredCount,
          estimatedCount: quality.estimatedCount,
          dataKind,
          errorCount: quality.errorCount,
          message: quality.messages[0] || null,
        };
      })
      .sort((a, b) => {
        if (a.apiStatus !== b.apiStatus) return a.apiStatus === 'success' ? -1 : 1;
        return String(a.exchangeLabel).localeCompare(String(b.exchangeLabel), 'ja');
      });
  }

  getWindowRecords(windowKey) {
    const normalizedWindow = WINDOW_DAYS[windowKey] ? windowKey : '1d';
    const windowDays = WINDOW_DAYS[normalizedWindow];

    if (windowDays === 1) {
      const latestRecords = this.getLatestRecords();
      if (latestRecords.length > 0) {
        return {
          records: latestRecords,
          snapshots: [],
          source: 'latest',
        };
      }

      const latestSnapshot = this.data.dailySnapshots[this.data.dailySnapshots.length - 1];
      return {
        records: latestSnapshot ? latestSnapshot.records || [] : [],
        snapshots: latestSnapshot ? [latestSnapshot] : [],
        source: latestSnapshot ? 'daily-snapshot' : 'none',
      };
    }

    const snapshots = this.data.dailySnapshots.slice(-windowDays);
    const records = snapshots.flatMap(snapshot => snapshot.records || []);
    if (records.length > 0) {
      return {
        records,
        snapshots,
        source: 'daily-snapshots',
      };
    }

    return {
      records: this.getLatestRecords(),
      snapshots: [],
      source: 'latest-fallback',
    };
  }

  getReport() {
    const generatedAt = new Date().toISOString();
    const windows = {};
    const rowsByMarket = new Map();

    for (const windowKey of REPORT_WINDOWS) {
      const windowData = this.getWindowRecords(windowKey);
      windows[windowKey] = {
        source: windowData.source,
        sampleSnapshotCount: windowData.snapshots.length,
        earliestSpreadDateJst: windowData.snapshots[0] ? windowData.snapshots[0].spreadDateJst : null,
        latestSpreadDateJst: windowData.snapshots[windowData.snapshots.length - 1]
          ? windowData.snapshots[windowData.snapshots.length - 1].spreadDateJst
          : null,
      };

      const grouped = new Map();
      for (const record of windowData.records) {
        const key = marketKey(record.exchangeId, record.instrumentId);
        if (!grouped.has(key)) grouped.set(key, []);
        grouped.get(key).push(record);

        if (!rowsByMarket.has(key)) {
          rowsByMarket.set(key, {
            exchangeId: record.exchangeId,
            exchangeLabel: record.exchangeLabel,
            instrumentId: record.instrumentId,
            instrumentLabel: record.instrumentLabel,
            baseCurrency: record.baseCurrency,
            quoteCurrency: record.quoteCurrency || 'JPY',
            currencyFullName: record.currencyFullName || '',
            latest: null,
            averages: {},
          });
        }
      }

      for (const [key, records] of grouped) {
        const row = rowsByMarket.get(key);
        row.averages[windowKey] = summarizeRecords(records);
      }
    }

    const latestRecordsByKey = new Map();
    for (const record of this.getLatestRecords()) {
      latestRecordsByKey.set(marketKey(record.exchangeId, record.instrumentId), record);
      if (!rowsByMarket.has(marketKey(record.exchangeId, record.instrumentId))) {
        rowsByMarket.set(marketKey(record.exchangeId, record.instrumentId), {
          exchangeId: record.exchangeId,
          exchangeLabel: record.exchangeLabel,
          instrumentId: record.instrumentId,
          instrumentLabel: record.instrumentLabel,
          baseCurrency: record.baseCurrency,
          quoteCurrency: record.quoteCurrency || 'JPY',
          currencyFullName: record.currencyFullName || '',
          latest: null,
          averages: {},
        });
      }
    }

    const rows = Array.from(rowsByMarket.entries()).map(([key, row]) => {
      const latest = latestRecordsByKey.get(key) || null;
      return {
        ...row,
        latest,
        averages: REPORT_WINDOWS.reduce((acc, windowKey) => {
          acc[windowKey] = row.averages[windowKey] || null;
          return acc;
        }, {}),
      };
    }).sort((a, b) => {
      const aPct = (a.averages['1d'] && a.averages['1d'].spreadPct) || -1;
      const bPct = (b.averages['1d'] && b.averages['1d'].spreadPct) || -1;
      if (bPct !== aPct) return bPct - aPct;
      if (a.exchangeId !== b.exchangeId) return a.exchangeId.localeCompare(b.exchangeId);
      return a.instrumentId.localeCompare(b.instrumentId);
    });

    return {
      meta: {
        generatedAt,
        latestCapturedAt: this.data.latest ? this.data.latest.capturedAt : null,
        availableDailySnapshotCount: this.data.dailySnapshots.length,
        recordCount: rows.length,
        refreshStatus: this.refreshStatus,
        windows,
      },
      quality: this.buildQualityRows(this.getWindowRecords('1d').records),
      rows,
    };
  }

  getHistory(windowKey = '30d') {
    const normalizedWindow = WINDOW_DAYS[windowKey] ? windowKey : '30d';
    const windowDays = WINDOW_DAYS[normalizedWindow];
    const generatedAt = new Date().toISOString();
    let snapshots = this.data.dailySnapshots.slice(-windowDays);
    let source = 'daily-snapshots';

    if (snapshots.length === 0 && this.data.latest && Array.isArray(this.data.latest.records)) {
      snapshots = [{
        capturedAt: this.data.latest.capturedAt,
        jstDate: this.data.latest.jstDate,
        spreadDateJst: this.data.latest.jstDate || getJstDate(new Date(this.data.latest.capturedAt)),
        reason: this.data.latest.source || 'latest',
        records: this.data.latest.records,
      }];
      source = 'latest-fallback';
    }

    const rows = [];
    for (const snapshot of snapshots) {
      const date = snapshot.spreadDateJst || snapshot.jstDate || getJstDate(new Date(snapshot.capturedAt));
      const grouped = new Map();

      for (const record of snapshot.records || []) {
        const key = marketKey(record.exchangeId, record.instrumentId);
        if (!grouped.has(key)) grouped.set(key, []);
        grouped.get(key).push(record);
      }

      for (const records of grouped.values()) {
        const first = records[0] || {};
        const summary = summarizeRecords(records);
        if (!summary) continue;

        rows.push({
          date,
          capturedAt: snapshot.capturedAt || null,
          exchangeId: first.exchangeId,
          exchangeLabel: first.exchangeLabel,
          instrumentId: first.instrumentId,
          instrumentLabel: first.instrumentLabel,
          baseCurrency: first.baseCurrency,
          quoteCurrency: first.quoteCurrency || 'JPY',
          currencyFullName: first.currencyFullName || '',
          spread: summary.spread,
          spreadPct: summary.spreadPct,
          buyPrice: summary.buyPrice,
          sellPrice: summary.sellPrice,
          midPrice: summary.midPrice,
          sampleCount: summary.sampleCount,
          quotePrecision: Number.isFinite(Number(first.quotePrecision)) ? Number(first.quotePrecision) : null,
        });
      }
    }

    return {
      meta: {
        windowKey: normalizedWindow,
        windowDays,
        source,
        generatedAt,
        availableDailySnapshotCount: this.data.dailySnapshots.length,
        historySnapshotCount: snapshots.length,
        earliestSpreadDateJst: snapshots[0] ? snapshots[0].spreadDateJst || snapshots[0].jstDate || null : null,
        latestSpreadDateJst: snapshots[snapshots.length - 1]
          ? snapshots[snapshots.length - 1].spreadDateJst || snapshots[snapshots.length - 1].jstDate || null
          : null,
        recordCount: rows.length,
      },
      rows,
    };
  }
}

SalesSpreadStore.getJstParts = getJstParts;
SalesSpreadStore.getJstDate = getJstDate;
SalesSpreadStore.getPreviousJstDate = getPreviousJstDate;

module.exports = SalesSpreadStore;
