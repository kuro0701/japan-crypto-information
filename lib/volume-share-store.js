const fs = require('fs');
const path = require('path');

const JST_TIME_ZONE = 'Asia/Tokyo';
const WINDOW_DAYS = {
  '1d': 1,
  '24h': 1,
  '7d': 7,
  '30d': 30,
};

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

class VolumeShareStore {
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
      console.warn('[Volume Share] Could not load history:', err.message);
    }
  }

  save() {
    const dir = path.dirname(this.dataFilePath);
    fs.mkdirSync(dir, { recursive: true });
    const tmpPath = `${this.dataFilePath}.tmp`;
    fs.writeFileSync(tmpPath, JSON.stringify(this.data, null, 2));
    fs.renameSync(tmpPath, this.dataFilePath);
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

  getDailySnapshot(volumeDateJst) {
    return this.data.dailySnapshots.find(item => item.volumeDateJst === volumeDateJst) || null;
  }

  hasDailySnapshot(volumeDateJst) {
    return this.getDailySnapshot(volumeDateJst) !== null;
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

  getShare(windowKey = '1d') {
    const normalizedWindow = WINDOW_DAYS[windowKey] ? windowKey : '1d';
    const windowDays = WINDOW_DAYS[normalizedWindow];
    const generatedAt = new Date().toISOString();
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
      snapshots = this.data.dailySnapshots.slice(-windowDays);
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
        availableDailySnapshotCount: this.data.dailySnapshots.length,
        earliestVolumeDateJst: snapshots[0] ? snapshots[0].volumeDateJst : null,
        latestVolumeDateJst: snapshots[snapshots.length - 1] ? snapshots[snapshots.length - 1].volumeDateJst : null,
        recordCount: rows.length,
        totalQuoteVolume,
        refreshStatus: this.refreshStatus,
      },
      exchanges,
      instruments,
      rows,
    };
  }
}

VolumeShareStore.getJstParts = getJstParts;
VolumeShareStore.getJstDate = getJstDate;
VolumeShareStore.getPreviousJstDate = getPreviousJstDate;

module.exports = VolumeShareStore;
