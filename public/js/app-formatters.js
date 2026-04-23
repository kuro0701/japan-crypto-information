(function attachAppFormatters(global) {
  const JST_TIME_ZONE = 'Asia/Tokyo';

  function toDate(value) {
    if (value == null || value === '') return null;
    const date = value instanceof Date ? value : new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  function dateTime(value, options = {}) {
    const date = toDate(value);
    if (!date) return '-';
    return date.toLocaleString('ja-JP', {
      timeZone: JST_TIME_ZONE,
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      ...options,
    });
  }

  function time(value, options = {}) {
    const date = toDate(value);
    if (!date) return '-';
    const { includeSeconds = true, ...rest } = options;
    return date.toLocaleTimeString('ja-JP', {
      timeZone: JST_TIME_ZONE,
      hour: '2-digit',
      minute: '2-digit',
      ...(includeSeconds ? { second: '2-digit' } : {}),
      ...rest,
    });
  }

  function pct(value, decimals = 2) {
    const num = Number(value);
    if (!Number.isFinite(num)) return '-';
    return `${num.toFixed(decimals)}%`;
  }

  function priceDecimals(value, precision) {
    const abs = Math.abs(Number(value));
    if (!Number.isFinite(abs)) return 0;
    if (abs >= 1000) return 0;
    if (abs >= 100) return Math.min(Math.max(precision ?? 1, 1), 2);
    if (abs >= 1) return Math.min(Math.max(precision ?? 2, 2), 4);
    return Math.min(Math.max(precision ?? 4, 4), 8);
  }

  function jpyPrice(value, precision) {
    if (value == null || Number.isNaN(Number(value))) return '-';
    return new Intl.NumberFormat('ja-JP', {
      style: 'currency',
      currency: 'JPY',
      minimumFractionDigits: 0,
      maximumFractionDigits: priceDecimals(value, precision),
    }).format(value);
  }

  function shortDate(value) {
    if (!value) return '-';
    const parts = String(value).split('-');
    if (parts.length === 3) return `${parts[1]}/${parts[2]}`;
    return String(value);
  }

  global.AppFormatters = Object.freeze({
    dateTime,
    jpyPrice,
    pct,
    priceDecimals,
    shortDate,
    time,
  });
})(window);
