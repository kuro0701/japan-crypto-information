const test = require('node:test');
const assert = require('node:assert/strict');

const { createMarketDataService } = require('../../lib/server/market-data-service');

function createServiceWithSalesRows(salesRows) {
  const market = {
    instrumentId: 'BTC-JPY',
    label: 'BTC/JPY',
    baseCurrency: 'BTC',
    quoteCurrency: 'JPY',
    exchanges: [
      { id: 'coincheck', label: 'Coincheck', fullName: 'Coincheck' },
      { id: 'okj', label: 'OKJ', fullName: 'OKJ' },
    ],
  };
  const publicExchanges = market.exchanges.map(exchange => ({
    ...exchange,
    markets: [{
      instrumentId: market.instrumentId,
      label: market.label,
      baseCurrency: market.baseCurrency,
      quoteCurrency: market.quoteCurrency,
    }],
    funding: {
      fiatDeposit: true,
      fiatWithdrawal: true,
      cryptoDeposit: true,
      cryptoWithdrawal: true,
    },
  }));

  return createMarketDataService({
    calculateImpact: () => ({ error: 'unexpected impact calculation' }),
    clientsByExchange: new Map(),
    defaultInstrumentId: market.instrumentId,
    getMarketInfo: instrumentId => (instrumentId === market.instrumentId ? market : null),
    getPublicExchanges: () => publicExchanges,
    salesSpreadStore: {
      getReport: () => ({
        meta: {},
        rows: salesRows,
        quality: [],
      }),
      getLatestRecords: () => [],
      refreshStatus: {},
    },
    staleAfterMs: 15_000,
    volumeShareStore: {
      getShare: () => ({
        meta: {},
        rows: [],
        quality: [],
      }),
    },
    wsManager: {
      latestBooks: new Map(),
      marketKey: (exchangeId, instrumentId) => `${exchangeId}:${instrumentId}`,
    },
  });
}

test('market page sales spread ignores rows without numeric spread data', () => {
  const service = createServiceWithSalesRows([
    {
      exchangeId: 'coincheck',
      exchangeLabel: 'Coincheck',
      instrumentId: 'BTC-JPY',
      latest: null,
      averages: {
        '1d': { spreadPct: null },
        '7d': { spreadPct: null },
      },
    },
    {
      exchangeId: 'okj',
      exchangeLabel: 'OKJ',
      instrumentId: 'BTC-JPY',
      latest: {
        buyPrice: 10_010_000,
        sellPrice: 9_990_000,
        spreadPct: 0.2,
        capturedAt: '2026-07-02T00:00:00.000Z',
      },
      averages: {},
    },
  ]);

  const report = service.buildMarketPageReport('BTC-JPY');
  assert.equal(report.snapshot.tightestSalesSpread.exchangeId, 'okj');
  assert.equal(report.snapshot.tightestSalesSpread.spreadPct, 0.2);

  const coincheck = report.domesticComparison.rows.find(row => row.exchangeId === 'coincheck');
  assert.equal(coincheck.salesSpread.status, 'waiting');
  assert.equal(coincheck.salesSpread.spreadPct, null);
});
