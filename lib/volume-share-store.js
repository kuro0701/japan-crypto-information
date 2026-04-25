const { readJsonFileIfExists, writeJsonFileAtomic } = require('./data-storage');

const JST_TIME_ZONE = 'Asia/Tokyo';
const WINDOW_DAYS = {
  '1d': 1,
  '24h': 1,
  '7d': 7,
  '30d': 30,
  '90d': 90,
};
const HISTORY_RETENTION_DAYS = 120;
const STABLE_DAILY_SNAPSHOT_REASONS = new Set(['jst-midnight', 'early-morning-catchup']);

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

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

function getSnapshotDateJst(snapshot) {
  if (!snapshot) return null;
  if (snapshot.volumeDateJst) return snapshot.volumeDateJst;
  if (snapshot.jstDate) return snapshot.jstDate;
  if (snapshot.capturedAt) return getJstDate(new Date(snapshot.capturedAt));
  return null;
}

function isCurrentDayProvisionalSnapshot(snapshot, currentJstDate) {
  const snapshotDateJst = getSnapshotDateJst(snapshot);
  if (!snapshotDateJst || snapshotDateJst !== currentJstDate) return false;
  return !STABLE_DAILY_SNAPSHOT_REASONS.has(snapshot.reason);
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

class VolumeShareStore {
  constructor({ dataFilePath, seedFilePath = dataFilePath, persistence = null, persistenceKey = null }) {
    this.dataFilePath = dataFilePath || null;
    this.seedFilePath = seedFilePath || null;
    this.persistence = persistence && persistenceKey
      ? { key: persistenceKey, client: persistence }
      : null;
    this.persistenceWriteChain = Promise.resolve();
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
    if (!this.seedFilePath) return;
    try {
      const parsed = readJsonFileIfExists(this.seedFilePath);
      if (!parsed) return;
      this.hydrate(parsed);
    } catch (err) {
      console.warn('[Volume Share] Could not load history:', err.message);
    }
  }

  save() {
    if (this.dataFilePath) {
      writeJsonFileAtomic(this.dataFilePath, this.data);
    }
    this.queuePersistence();
  }

  hydrate(parsed) {
    this.data = {
      version: 1,
      latest: parsed && parsed.latest ? parsed.latest : null,
      dailySnapshots: Array.isArray(parsed && parsed.dailySnapshots) ? parsed.dailySnapshots : [],
    };
    this.liveRecords.clear();
    for (const record of (this.data.latest && this.data.latest.records) || []) {
      this.liveRecords.set(marketKey(record.exchangeId, record.instrumentId), record);
    }
  }

  hasStoredState() {
    return Boolean(this.data.latest) || this.data.dailySnapshots.length > 0;
  }

  queuePersistence() {
    if (!this.persistence) return this.persistenceWriteChain;
    const snapshot = cloneJson(this.data);
    this.persistenceWriteChain = this.persistenceWriteChain
      .catch(() => {})
      .then(() => this.persistence.client.save(this.persistence.key, snapshot))
      .catch((err) => {
        console.warn('[Volume Share] Could not persist history to Neon:', err.message);
      });
    return this.persistenceWriteChain;
  }

  async initializePersistence() {
    if (!this.persistence) return;
    const parsed = await this.persistence.client.load(this.persistence.key);
    if (parsed) {
      this.hydrate(parsed);
      return;
    }

    if (this.hasStoredState()) {
      await this.persistence.client.save(this.persistence.key, cloneJson(this.data));
    }
  }

  flushPersistence() {
    return this.persistenceWriteChain.catch(() => {});
  }

  buildRecord(ticker, exchange, market, capturedAt = new Date()) {
    if (!ticker || !exchange || !market) return null;
    const baseVolume24h = parseNumber(ticker.baseVolume24h);
    let quoteVolume24h = parseNumber(ticker.quoteVolume24h);
    let quoteVolume24hEstimated = ticker.quoteVolume24hEstimated === true;
    const last = parseNumber(ticker.last);

    if (quoteVolume24h == null && baseVolume24h != null && last != null) {
      quoteVolume24h = baseVolume24h * last;
      quoteVolume24hEstimated = true;
    }

    return {
      exchangeId: exchange.id,
      exchangeLabel: exchange.label || exchange.id,
      instrumentId: market.instrumentId,
      instrumentLabel: market.label || market.instrumentId,
      baseCurrency: market.baseCurrency || null,
      quoteCurrency: market.quoteCurrency || 'JPY',
      baseVolume24h,
      quoteVolume24h,
      quoteVolume24hEstimated,
      last,
      tickerTimestamp: ticker.timestamp || null,
      capturedAt: capturedAt.toISOString(),
      dataSource: normalizeDataSource(ticker.dataSource || ticker.source || 'rest'),
    };
  }

  upsertTicker(ticker, exchange, market) {
    const record = this.buildRecord(ticker, exchange, market);
    if (!record) return;
    this.liveRecords.set(marketKey(record.exchangeId, record.instrumentId), record);
  }

  replaceLatest(records, source = 'refresh', meta = {}) {
    const capturedAt = meta.capturedAt || new Date().toISOString();
    this.liveRecords.clear();
    for (const record of records) {
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
    const volumeDateJst = meta.volumeDateJst || getPreviousJstDate(capturedDate);
    const snapshot = {
      capturedAt,
      jstDate: getJstDate(capturedDate),
      volumeDateJst,
      reason: meta.reason || 'jst-midnight',
      records,
    };

    this.data.dailySnapshots = this.data.dailySnapshots
      .filter(item => item.volumeDateJst !== volumeDateJst)
      .concat(snapshot)
      .sort((a, b) => String(a.volumeDateJst).localeCompare(String(b.volumeDateJst)))
      .slice(-HISTORY_RETENTION_DAYS);
    this.save();
    return snapshot;
  }

  setRefreshStatus(status) {
    this.refreshStatus = {
      ...this.refreshStatus,
      ...status,
    };
  }

  getDailySnapshot(volumeDateJst) {
    return this.data.dailySnapshots.find(item => item.volumeDateJst === volumeDateJst) || null;
  }

  hasDailySnapshot(volumeDateJst) {
    return this.getDailySnapshot(volumeDateJst) !== null;
  }

  getHistoricalSnapshots(windowDays, options = {}) {
    const now = options.now ? new Date(options.now) : new Date();
    const currentJstDate = getJstDate(now);
    const snapshots = this.data.dailySnapshots
      .filter(snapshot => !isCurrentDayProvisionalSnapshot(snapshot, currentJstDate));

    if (!windowDays || windowDays < 1) return snapshots;
    return snapshots.slice(-windowDays);
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
      quality.lastSourceAt = maxIso(quality.lastSourceAt, record.tickerTimestamp || record.capturedAt);
      quality.transportSources.add(normalizeDataSource(record.dataSource || record.source || 'rest'));
      if (record.quoteVolume24hEstimated === true) {
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

  getShare(windowKey = '1d', options = {}) {
    const normalizedWindow = WINDOW_DAYS[windowKey] ? windowKey : '1d';
    const windowDays = WINDOW_DAYS[normalizedWindow];
    const generatedAt = options.now ? new Date(options.now).toISOString() : new Date().toISOString();
    let source = 'latest';
    let snapshots = [];
    let records = [];

    if (windowDays === 1) {
      records = this.getLatestRecords();
      if ((!records || records.length === 0) && this.data.dailySnapshots.length > 0) {
        const latestSnapshot = this.data.dailySnapshots[this.data.dailySnapshots.length - 1];
        snapshots = [latestSnapshot];
        records = latestSnapshot.records || [];
        source = 'daily-snapshot';
      }
    } else {
      snapshots = this.getHistoricalSnapshots(windowDays, options);
      records = snapshots.flatMap(snapshot => snapshot.records || []);
      source = 'daily-snapshots';

      if (records.length === 0) {
        records = this.getLatestRecords();
        source = 'latest-fallback';
      }
    }

    return this.buildShareResponse({
      windowKey: normalizedWindow,
      windowDays,
      records,
      snapshots,
      source,
      generatedAt,
    });
  }

  buildShareResponse({ windowKey, windowDays, records, snapshots, source, generatedAt }) {
    const byMarket = new Map();
    const exchangeTotals = new Map();
    const instrumentTotals = new Map();
    let totalQuoteVolume = 0;

    for (const record of records) {
      const quoteVolume = parseNumber(record.quoteVolume24h);
      if (quoteVolume == null || quoteVolume < 0) continue;

      const key = marketKey(record.exchangeId, record.instrumentId);
      const existing = byMarket.get(key) || {
        exchangeId: record.exchangeId,
        exchangeLabel: record.exchangeLabel,
        instrumentId: record.instrumentId,
        instrumentLabel: record.instrumentLabel,
        baseCurrency: record.baseCurrency,
        quoteCurrency: record.quoteCurrency || 'JPY',
        quoteVolume: 0,
        baseVolume: 0,
        quoteVolumeEstimated: false,
        sampleCount: 0,
      };

      existing.quoteVolume += quoteVolume;
      const baseVolume = parseNumber(record.baseVolume24h);
      if (baseVolume != null) existing.baseVolume += baseVolume;
      existing.quoteVolumeEstimated = existing.quoteVolumeEstimated || record.quoteVolume24hEstimated === true;
      existing.sampleCount += 1;
      byMarket.set(key, existing);

      exchangeTotals.set(
        record.exchangeId,
        (exchangeTotals.get(record.exchangeId) || {
          exchangeId: record.exchangeId,
          exchangeLabel: record.exchangeLabel,
          quoteVolume: 0,
        })
      );
      exchangeTotals.get(record.exchangeId).quoteVolume += quoteVolume;

      instrumentTotals.set(
        record.instrumentId,
        (instrumentTotals.get(record.instrumentId) || {
          instrumentId: record.instrumentId,
          instrumentLabel: record.instrumentLabel,
          quoteVolume: 0,
        })
      );
      instrumentTotals.get(record.instrumentId).quoteVolume += quoteVolume;

      totalQuoteVolume += quoteVolume;
    }

    const rows = Array.from(byMarket.values()).map(row => {
      const instrumentTotal = instrumentTotals.get(row.instrumentId);
      return {
        ...row,
        instrumentTotalQuoteVolume: instrumentTotal ? instrumentTotal.quoteVolume : 0,
        instrumentSharePct: instrumentTotal && instrumentTotal.quoteVolume > 0
          ? (row.quoteVolume / instrumentTotal.quoteVolume) * 100
          : 0,
        totalSharePct: totalQuoteVolume > 0 ? (row.quoteVolume / totalQuoteVolume) * 100 : 0,
      };
    }).sort((a, b) => {
      if (a.instrumentId !== b.instrumentId) return a.instrumentId.localeCompare(b.instrumentId);
      return b.quoteVolume - a.quoteVolume;
    });

    const exchanges = Array.from(exchangeTotals.values())
      .map(exchange => ({
        ...exchange,
        sharePct: totalQuoteVolume > 0 ? (exchange.quoteVolume / totalQuoteVolume) * 100 : 0,
      }))
      .sort((a, b) => b.quoteVolume - a.quoteVolume);

    const instruments = Array.from(instrumentTotals.values())
      .map(instrument => ({
        ...instrument,
        sharePct: totalQuoteVolume > 0 ? (instrument.quoteVolume / totalQuoteVolume) * 100 : 0,
      }))
      .sort((a, b) => b.quoteVolume - a.quoteVolume);

    return {
      meta: {
        windowKey,
        windowDays,
        source,
        generatedAt,
        latestCapturedAt: this.data.latest ? this.data.latest.capturedAt : null,
        dailySnapshotCount: snapshots.length,
        availableDailySnapshotCount: this.getHistoricalSnapshots(0, { now: generatedAt }).length,
        earliestVolumeDateJst: snapshots[0] ? getSnapshotDateJst(snapshots[0]) : null,
        latestVolumeDateJst: snapshots[snapshots.length - 1] ? getSnapshotDateJst(snapshots[snapshots.length - 1]) : null,
        recordCount: rows.length,
        totalQuoteVolume,
        refreshStatus: this.refreshStatus,
      },
      exchanges,
      instruments,
      rows,
      quality: this.buildQualityRows(records),
    };
  }

  getHistory(windowKey = '30d', options = {}) {
    const normalizedWindow = WINDOW_DAYS[windowKey] ? windowKey : '30d';
    const windowDays = WINDOW_DAYS[normalizedWindow];
    const generatedAt = options.now ? new Date(options.now).toISOString() : new Date().toISOString();
    let snapshots = this.getHistoricalSnapshots(windowDays, options);
    let source = 'daily-snapshots';

    if (snapshots.length === 0 && this.data.latest && Array.isArray(this.data.latest.records)) {
      snapshots = [{
        capturedAt: this.data.latest.capturedAt,
        jstDate: this.data.latest.jstDate,
        volumeDateJst: this.data.latest.jstDate || getJstDate(new Date(this.data.latest.capturedAt)),
        reason: this.data.latest.source || 'latest',
        records: this.data.latest.records,
      }];
      source = 'latest-fallback';
    }

    const rows = [];
    for (const snapshot of snapshots) {
      const date = snapshot.volumeDateJst || snapshot.jstDate || getJstDate(new Date(snapshot.capturedAt));
      const grouped = new Map();

      for (const record of snapshot.records || []) {
        const quoteVolume = parseNumber(record.quoteVolume24h);
        if (quoteVolume == null || quoteVolume < 0) continue;

        const key = marketKey(record.exchangeId, record.instrumentId);
        const existing = grouped.get(key) || {
          date,
          capturedAt: snapshot.capturedAt || null,
          exchangeId: record.exchangeId,
          exchangeLabel: record.exchangeLabel,
          instrumentId: record.instrumentId,
          instrumentLabel: record.instrumentLabel,
          baseCurrency: record.baseCurrency,
          quoteCurrency: record.quoteCurrency || 'JPY',
          quoteVolume: 0,
          baseVolume: 0,
          quoteVolumeEstimated: false,
          sampleCount: 0,
        };

        existing.quoteVolume += quoteVolume;
        const baseVolume = parseNumber(record.baseVolume24h);
        if (baseVolume != null) existing.baseVolume += baseVolume;
        existing.quoteVolumeEstimated = existing.quoteVolumeEstimated || record.quoteVolume24hEstimated === true;
        existing.sampleCount += 1;
        grouped.set(key, existing);
      }

      rows.push(...grouped.values());
    }

    return {
      meta: {
        windowKey: normalizedWindow,
        windowDays,
        source,
        generatedAt,
        availableDailySnapshotCount: this.getHistoricalSnapshots(0, { now: generatedAt }).length,
        historySnapshotCount: snapshots.length,
        earliestVolumeDateJst: snapshots[0] ? getSnapshotDateJst(snapshots[0]) : null,
        latestVolumeDateJst: snapshots[snapshots.length - 1]
          ? getSnapshotDateJst(snapshots[snapshots.length - 1])
          : null,
        recordCount: rows.length,
      },
      rows,
    };
  }
}

VolumeShareStore.getJstParts = getJstParts;
VolumeShareStore.getJstDate = getJstDate;
VolumeShareStore.getPreviousJstDate = getPreviousJstDate;

module.exports = VolumeShareStore;
