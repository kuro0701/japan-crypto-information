const crypto = require('crypto');
const { readJsonFileIfExists, writeJsonFileAtomic } = require('./data-storage');

const JST_TIME_ZONE = 'Asia/Tokyo';
const DEFAULT_RETENTION_DAYS = 120;
const DEFAULT_FLUSH_DELAY_MS = 5000;
const WINDOW_DAYS = {
  '1d': 1,
  today: 1,
  '7d': 7,
  '30d': 30,
};

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
    hour: parts.hour,
    minute: parts.minute,
    second: parts.second,
  };
}

function emptyDay(dateKey) {
  return {
    date: dateKey,
    pageViews: 0,
    routes: {},
    hours: {},
    referrers: {},
    devices: {},
    visitorHashes: {},
    ws: {
      connections: 0,
      peakConcurrent: 0,
    },
    firstAccessAt: null,
    lastAccessAt: null,
  };
}

function incrementBucket(bucket, key, amount = 1) {
  const safeKey = key || 'unknown';
  bucket[safeKey] = (bucket[safeKey] || 0) + amount;
}

function sortObjectEntries(bucket) {
  return Object.entries(bucket || {})
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));
}

function normalizeDay(raw, dateKey) {
  const base = emptyDay(dateKey || raw.date);
  const day = {
    ...base,
    ...raw,
    routes: raw.routes && typeof raw.routes === 'object' ? raw.routes : {},
    hours: raw.hours && typeof raw.hours === 'object' ? raw.hours : {},
    referrers: raw.referrers && typeof raw.referrers === 'object' ? raw.referrers : {},
    devices: raw.devices && typeof raw.devices === 'object' ? raw.devices : {},
    visitorHashes: raw.visitorHashes && typeof raw.visitorHashes === 'object' ? raw.visitorHashes : {},
    ws: {
      ...base.ws,
      ...(raw.ws && typeof raw.ws === 'object' ? raw.ws : {}),
    },
  };

  day.uniqueVisitors = Object.keys(day.visitorHashes).length;
  return day;
}

class AnalyticsStore {
  constructor({ dataFilePath, salt, retentionDays, flushDelayMs } = {}) {
    this.dataFilePath = dataFilePath;
    this.salt = salt || process.env.ANALYTICS_SALT || 'local-dev-analytics-salt';
    this.retentionDays = retentionDays || DEFAULT_RETENTION_DAYS;
    this.flushDelayMs = Number.isFinite(Number(flushDelayMs))
      ? Math.max(0, Number(flushDelayMs))
      : DEFAULT_FLUSH_DELAY_MS;
    this.currentWsConnections = 0;
    this.isDirty = false;
    this.pendingSaveTimer = null;
    this.data = {
      version: 1,
      days: {},
    };
    this.boundFlushSafely = () => this.flushSafely();

    this.load();
    process.once('beforeExit', this.boundFlushSafely);
    process.once('exit', this.boundFlushSafely);
  }

  load() {
    try {
      if (!this.dataFilePath) return;
      const parsed = readJsonFileIfExists(this.dataFilePath);
      if (!parsed) return;
      const days = {};
      for (const [dateKey, rawDay] of Object.entries(parsed.days || {})) {
        days[dateKey] = normalizeDay(rawDay || {}, dateKey);
      }

      this.data = {
        version: 1,
        days,
      };
      this.isDirty = false;
    } catch (err) {
      console.warn('[Analytics] Could not load history:', err.message);
    }
  }

  clearPendingSave() {
    if (!this.pendingSaveTimer) return;
    clearTimeout(this.pendingSaveTimer);
    this.pendingSaveTimer = null;
  }

  save() {
    this.flush();
  }

  scheduleSave() {
    if (!this.dataFilePath) return;
    this.isDirty = true;
    if (this.flushDelayMs === 0) {
      this.flushSafely();
      return;
    }
    if (this.pendingSaveTimer) return;
    this.pendingSaveTimer = setTimeout(() => {
      this.pendingSaveTimer = null;
      this.flushSafely();
    }, this.flushDelayMs);
    if (typeof this.pendingSaveTimer.unref === 'function') {
      this.pendingSaveTimer.unref();
    }
  }

  flush() {
    if (!this.dataFilePath || !this.isDirty) return;
    this.clearPendingSave();
    this.prune();
    writeJsonFileAtomic(this.dataFilePath, this.data);
    this.isDirty = false;
  }

  flushSafely() {
    try {
      this.flush();
    } catch (err) {
      console.warn('[Analytics] Could not persist history:', err.message);
    }
  }

  dispose() {
    this.clearPendingSave();
    this.flushSafely();
    process.removeListener('beforeExit', this.boundFlushSafely);
    process.removeListener('exit', this.boundFlushSafely);
  }

  prune() {
    const keys = Object.keys(this.data.days).sort();
    const deleteCount = Math.max(0, keys.length - this.retentionDays);
    for (const key of keys.slice(0, deleteCount)) {
      delete this.data.days[key];
    }
  }

  getDay(date = new Date()) {
    const { date: dateKey } = getJstParts(date);
    if (!this.data.days[dateKey]) {
      this.data.days[dateKey] = emptyDay(dateKey);
    }
    return this.data.days[dateKey];
  }

  getClientIp(req) {
    const forwardedFor = req.headers && req.headers['x-forwarded-for'];
    if (typeof forwardedFor === 'string' && forwardedFor.trim()) {
      return forwardedFor.split(',')[0].trim();
    }

    return req.ip
      || (req.socket && req.socket.remoteAddress)
      || (req.connection && req.connection.remoteAddress)
      || 'unknown';
  }

  getVisitorHash(req, dateKey) {
    const userAgent = (req.headers && req.headers['user-agent']) || 'unknown';
    const ip = this.getClientIp(req);
    return crypto
      .createHash('sha256')
      .update(`${this.salt}|${dateKey}|${ip}|${userAgent}`)
      .digest('hex')
      .slice(0, 24);
  }

  getReferrer(req) {
    const value = (req.headers && (req.headers.referer || req.headers.referrer)) || '';
    if (!value) return 'direct';

    try {
      const referrer = new URL(value);
      const host = referrer.hostname.replace(/^www\./, '');
      const requestHost = String(req.headers.host || '').split(':')[0].replace(/^www\./, '');
      return host === requestHost ? 'internal' : host;
    } catch (_) {
      return 'unknown';
    }
  }

  getDevice(req) {
    const userAgent = String((req.headers && req.headers['user-agent']) || '').toLowerCase();
    if (/bot|crawl|spider|slurp|headless|preview|facebookexternalhit|twitterbot/.test(userAgent)) {
      return 'bot';
    }
    if (/mobile|iphone|android|ipad|tablet/.test(userAgent)) {
      return 'mobile';
    }
    return 'desktop';
  }

  trackPageView(req, route) {
    const now = new Date();
    const parts = getJstParts(now);
    const day = this.getDay(now);
    const visitorHash = this.getVisitorHash(req, parts.date);

    day.pageViews += 1;
    day.visitorHashes[visitorHash] = true;
    day.uniqueVisitors = Object.keys(day.visitorHashes).length;
    day.firstAccessAt = day.firstAccessAt || now.toISOString();
    day.lastAccessAt = now.toISOString();

    incrementBucket(day.routes, route);
    incrementBucket(day.hours, parts.hour);
    incrementBucket(day.referrers, this.getReferrer(req));
    incrementBucket(day.devices, this.getDevice(req));

    this.scheduleSave();
  }

  trackWebSocketOpen(req) {
    const now = new Date();
    const day = this.getDay(now);
    this.currentWsConnections += 1;
    day.ws.connections += 1;
    day.ws.peakConcurrent = Math.max(day.ws.peakConcurrent || 0, this.currentWsConnections);
    day.firstAccessAt = day.firstAccessAt || now.toISOString();
    day.lastAccessAt = now.toISOString();

    this.scheduleSave();
  }

  trackWebSocketClose() {
    this.currentWsConnections = Math.max(0, this.currentWsConnections - 1);
  }

  getSelectedDays(windowKey = '7d') {
    const normalizedWindow = WINDOW_DAYS[windowKey] ? windowKey : '7d';
    const windowDays = WINDOW_DAYS[normalizedWindow];
    const keys = Object.keys(this.data.days).sort().slice(-windowDays);
    return {
      normalizedWindow,
      windowDays,
      days: keys.map(key => normalizeDay(this.data.days[key], key)),
    };
  }

  getReport(windowKey = '7d') {
    const { normalizedWindow, windowDays, days } = this.getSelectedDays(windowKey);
    const routeTotals = {};
    const hourTotals = {};
    const referrerTotals = {};
    const deviceTotals = {};
    const uniqueHashes = new Set();
    const ws = {
      connections: 0,
      peakConcurrent: 0,
      currentConcurrent: this.currentWsConnections,
    };
    let totalPageViews = 0;
    let lastAccessAt = null;
    const hourKeys = Array.from({ length: 24 }, (_value, hour) => String(hour).padStart(2, '0'));

    for (const hour of hourKeys) {
      hourTotals[hour] = 0;
    }

    for (const day of days) {
      totalPageViews += day.pageViews || 0;
      ws.connections += day.ws.connections || 0;
      ws.peakConcurrent = Math.max(ws.peakConcurrent, day.ws.peakConcurrent || 0);
      if (day.lastAccessAt && (!lastAccessAt || day.lastAccessAt > lastAccessAt)) {
        lastAccessAt = day.lastAccessAt;
      }

      for (const visitorHash of Object.keys(day.visitorHashes || {})) {
        uniqueHashes.add(visitorHash);
      }
      for (const [key, value] of Object.entries(day.routes || {})) {
        incrementBucket(routeTotals, key, value);
      }
      for (const [key, value] of Object.entries(day.hours || {})) {
        incrementBucket(hourTotals, key, value);
      }
      for (const [key, value] of Object.entries(day.referrers || {})) {
        incrementBucket(referrerTotals, key, value);
      }
      for (const [key, value] of Object.entries(day.devices || {})) {
        incrementBucket(deviceTotals, key, value);
      }
    }

    return {
      meta: {
        windowKey: normalizedWindow,
        windowDays,
        generatedAt: new Date().toISOString(),
        availableDayCount: Object.keys(this.data.days).length,
        totalPageViews,
        uniqueVisitors: uniqueHashes.size,
        lastAccessAt,
      },
      routes: sortObjectEntries(routeTotals),
      hours: hourKeys.map(hour => ({ hour, count: hourTotals[hour] || 0 })),
      referrers: sortObjectEntries(referrerTotals).slice(0, 12),
      devices: sortObjectEntries(deviceTotals),
      ws,
      days: days.map(day => ({
        date: day.date,
        pageViews: day.pageViews || 0,
        uniqueVisitors: Object.keys(day.visitorHashes || {}).length,
        routes: sortObjectEntries(day.routes),
        referrers: sortObjectEntries(day.referrers).slice(0, 5),
        devices: sortObjectEntries(day.devices),
        ws: {
          connections: day.ws.connections || 0,
          peakConcurrent: day.ws.peakConcurrent || 0,
        },
        firstAccessAt: day.firstAccessAt,
        lastAccessAt: day.lastAccessAt,
      })),
    };
  }
}

module.exports = AnalyticsStore;
