(function attachMarketDataUtils(global) {
  const { parseTimeValue } = global.AppUtils;
  const { time } = global.AppFormatters;

  function statusRank(status) {
    return {
      fresh: 0,
      stale: 1,
      waiting: 2,
      error: 3,
      unsupported: 4,
    }[status] ?? 5;
  }

  function rowUpdatedAtMs(row) {
    return parseTimeValue(row && (row.updatedAt ?? row.receivedAt ?? row.timestamp));
  }

  function rowAgeMs(row) {
    const updatedAt = rowUpdatedAtMs(row);
    return updatedAt == null ? null : Math.max(0, Date.now() - updatedAt);
  }

  function rowAgeSeconds(row) {
    const ageMs = rowAgeMs(row);
    return ageMs == null ? null : Math.floor(ageMs / 1000);
  }

  function liveRowStatus(row) {
    const baseStatus = String((row && row.status) || 'waiting');
    if (baseStatus !== 'fresh' && baseStatus !== 'stale') return baseStatus;
    if (baseStatus === 'stale') return 'stale';
    const ageMs = rowAgeMs(row);
    const staleAfterMs = Number(row && row.staleAfterMs);
    if (ageMs != null && Number.isFinite(staleAfterMs) && staleAfterMs > 0 && ageMs > staleAfterMs) {
      return 'stale';
    }
    return 'fresh';
  }

  function ageLabel(row) {
    const seconds = rowAgeSeconds(row);
    return seconds == null ? '-' : `${seconds}秒前`;
  }

  function updatedAtLabel(row) {
    return time((row && row.timestamp) || rowUpdatedAtMs(row));
  }

  function summarizeStatuses(rows) {
    return (rows || []).reduce((acc, row) => {
      const status = liveRowStatus(row);
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, { fresh: 0, stale: 0, waiting: 0, error: 0, unsupported: 0 });
  }

  function freshnessBadge(status) {
    return status === 'stale'
      ? '<span class="freshness-badge freshness-badge--stale">STALE</span>'
      : '';
  }

  global.MarketDataUtils = Object.freeze({
    ageLabel,
    freshnessBadge,
    liveRowStatus,
    rowAgeMs,
    rowAgeSeconds,
    rowUpdatedAtMs,
    statusRank,
    summarizeStatuses,
    updatedAtLabel,
  });
})(window);
