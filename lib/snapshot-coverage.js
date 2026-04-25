const CORE_VOLUME_SNAPSHOT_EXCHANGE_IDS = Object.freeze([
  'okj',
  'coincheck',
  'bitflyer',
  'bitbank',
  'gmo',
]);

const CORE_SALES_SNAPSHOT_EXCHANGE_IDS = Object.freeze([
  'okj',
  'coincheck',
  'bitflyer',
  'bitbank',
  'gmo',
]);

function summarizeExchangeCoverage(records) {
  const byExchange = new Map();

  for (const record of records || []) {
    if (!record || !record.exchangeId) continue;
    byExchange.set(record.exchangeId, (byExchange.get(record.exchangeId) || 0) + 1);
  }

  return byExchange;
}

function missingExchangeIds(records, requiredExchangeIds = []) {
  const coverage = summarizeExchangeCoverage(records);
  return (requiredExchangeIds || []).filter((exchangeId) => !coverage.has(exchangeId));
}

function buildSnapshotCoverage(records, requiredExchangeIds = []) {
  const coverage = summarizeExchangeCoverage(records);
  const missingRequiredExchangeIds = missingExchangeIds(records, requiredExchangeIds);
  return {
    coverage,
    capturedExchangeIds: Array.from(coverage.keys()).sort(),
    missingRequiredExchangeIds,
    isComplete: missingRequiredExchangeIds.length === 0,
  };
}

function shouldCaptureSnapshot(result, requiredExchangeIds = []) {
  if (!result || !Array.isArray(result.records) || result.records.length === 0) {
    return {
      allowed: false,
      missingRequiredExchangeIds: [...(requiredExchangeIds || [])],
    };
  }

  const snapshotCoverage = buildSnapshotCoverage(result.records, requiredExchangeIds);
  return {
    allowed: snapshotCoverage.isComplete,
    missingRequiredExchangeIds: snapshotCoverage.missingRequiredExchangeIds,
  };
}

module.exports = {
  CORE_SALES_SNAPSHOT_EXCHANGE_IDS,
  CORE_VOLUME_SNAPSHOT_EXCHANGE_IDS,
  buildSnapshotCoverage,
  missingExchangeIds,
  shouldCaptureSnapshot,
  summarizeExchangeCoverage,
};
