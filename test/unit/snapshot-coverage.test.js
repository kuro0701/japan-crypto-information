const test = require('node:test');
const assert = require('node:assert/strict');

const {
  CORE_SALES_SNAPSHOT_EXCHANGE_IDS,
  CORE_VOLUME_SNAPSHOT_EXCHANGE_IDS,
  buildSnapshotCoverage,
  shouldCaptureSnapshot,
} = require('../../lib/snapshot-coverage');

function record(exchangeId, instrumentId = 'BTC-JPY') {
  return {
    exchangeId,
    instrumentId,
  };
}

test('buildSnapshotCoverage reports missing required exchanges', () => {
  const result = buildSnapshotCoverage([
    record('okj'),
    record('coincheck'),
    record('bitflyer'),
  ], CORE_VOLUME_SNAPSHOT_EXCHANGE_IDS);

  assert.deepEqual(result.capturedExchangeIds, ['bitflyer', 'coincheck', 'okj']);
  assert.deepEqual(result.missingRequiredExchangeIds, ['bitbank', 'gmo']);
  assert.equal(result.isComplete, false);
});

test('shouldCaptureSnapshot allows snapshots only when required sales exchanges are present', () => {
  const completeResult = shouldCaptureSnapshot({
    records: CORE_SALES_SNAPSHOT_EXCHANGE_IDS.map(exchangeId => record(exchangeId)),
  }, CORE_SALES_SNAPSHOT_EXCHANGE_IDS);
  assert.equal(completeResult.allowed, true);
  assert.deepEqual(completeResult.missingRequiredExchangeIds, []);

  const incompleteResult = shouldCaptureSnapshot({
    records: CORE_SALES_SNAPSHOT_EXCHANGE_IDS
      .filter(exchangeId => exchangeId !== 'okj')
      .map(exchangeId => record(exchangeId)),
  }, CORE_SALES_SNAPSHOT_EXCHANGE_IDS);
  assert.equal(incompleteResult.allowed, false);
  assert.deepEqual(incompleteResult.missingRequiredExchangeIds, ['okj']);
});

test('shouldCaptureSnapshot rejects empty refresh results', () => {
  const decision = shouldCaptureSnapshot({ records: [] }, CORE_VOLUME_SNAPSHOT_EXCHANGE_IDS);
  assert.equal(decision.allowed, false);
  assert.deepEqual(decision.missingRequiredExchangeIds, CORE_VOLUME_SNAPSHOT_EXCHANGE_IDS);
});
