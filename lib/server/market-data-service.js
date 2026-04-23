function createMarketDataService({
  calculateImpact,
  clientsByExchange,
  defaultInstrumentId,
  getMarketInfo,
  getPublicExchanges,
  salesSpreadStore,
  staleAfterMs,
  volumeShareStore,
  wsManager,
}) {
  function marketDataStatusRank(status) {
    return {
      fresh: 0,
      stale: 1,
      waiting: 2,
      error: 3,
      unsupported: 4,
    }[status] ?? 5;
  }

  function buildWaitingOrderbookState(baseFields, message = '板データ待機中') {
    return {
      ...baseFields,
      status: 'waiting',
      freshnessStatus: 'waiting',
      message,
      updatedAt: null,
      ageMs: null,
      ageSeconds: null,
      staleAfterMs,
      timestamp: null,
      receivedAt: null,
      source: null,
    };
  }

  function buildOrderbookStateRow(book, baseFields, options = {}) {
    if (!book) {
      return buildWaitingOrderbookState(baseFields, options.waitingMessage);
    }

    const summary = book.toSummary({
      now: options.now,
      staleAfterMs,
    });
    const status = summary.freshnessStatus === 'stale' ? 'stale' : 'fresh';

    return {
      ...summary,
      ...baseFields,
      status,
      freshnessStatus: status,
      message: status === 'stale' ? (options.staleMessage || '板データが古い') : null,
    };
  }

  function buildMarketOrderbookRows(market) {
    const now = Date.now();
    return market.exchanges
      .map((exchange) => {
        const client = clientsByExchange.get(exchange.id);
        if (client && typeof client.activateInstrument === 'function') {
          client.activateInstrument(market.instrumentId);
        }

        const book = wsManager.latestBooks.get(wsManager.marketKey(exchange.id, market.instrumentId));
        return buildOrderbookStateRow(book, {
          exchangeId: exchange.id,
          exchangeLabel: exchange.label,
          instrumentId: market.instrumentId,
          instrumentLabel: market.label,
        }, {
          now,
          staleMessage: '板データが古い',
        });
      })
      .sort((a, b) => {
        const statusDiff = marketDataStatusRank(a.status) - marketDataStatusRank(b.status);
        if (statusDiff !== 0) return statusDiff;
        const spreadDiff = Number(a.spreadPct ?? Infinity) - Number(b.spreadPct ?? Infinity);
        if (spreadDiff !== 0) return spreadDiff;
        return String(a.exchangeLabel).localeCompare(String(b.exchangeLabel), 'ja');
      });
  }

  function buildMarketPageReport(instrumentId) {
    const market = getMarketInfo(instrumentId);
    if (!market) return null;

    const volumeShare = volumeShareStore.getShare('1d');
    const volumeQualityByExchange = new Map((volumeShare.quality || []).map(row => [row.exchangeId, row]));
    const volumeRows = (volumeShare.rows || [])
      .filter(row => row.instrumentId === market.instrumentId)
      .map(row => ({
        ...row,
        lastFetchedAt: volumeQualityByExchange.get(row.exchangeId)?.lastFetchedAt || null,
        dataKind: volumeQualityByExchange.get(row.exchangeId)?.dataKind || null,
      }));

    const salesReport = salesSpreadStore.getReport();
    const salesRows = (salesReport.rows || [])
      .filter(row => row.instrumentId === market.instrumentId);

    return {
      meta: {
        generatedAt: new Date().toISOString(),
      },
      market: {
        instrumentId: market.instrumentId,
        label: market.label,
        baseCurrency: market.baseCurrency,
        quoteCurrency: market.quoteCurrency,
      },
      exchanges: market.exchanges.map(exchange => ({
        id: exchange.id,
        label: exchange.label,
        fullName: exchange.fullName,
        dataSourceLabel: exchange.dataSourceLabel,
        market: exchange.market,
      })),
      orderbooks: buildMarketOrderbookRows(market),
      volume: {
        meta: volumeShare.meta,
        rows: volumeRows,
        quality: (volumeShare.quality || []).filter(row => market.exchanges.some(exchange => exchange.id === row.exchangeId)),
      },
      sales: {
        meta: salesReport.meta,
        rows: salesRows,
        quality: (salesReport.quality || []).filter(row => salesRows.some(salesRow => salesRow.exchangeId === row.exchangeId)),
      },
    };
  }

  function parseRequestNumber(value) {
    const parsed = parseFloat(String(value ?? '').replace(/,/g, ''));
    return Number.isFinite(parsed) ? parsed : null;
  }

  function normalizeComparisonAmountType(value) {
    const amountType = value === 'btc' ? 'base' : value;
    return amountType === 'jpy' ? 'jpy' : 'base';
  }

  function readComparisonRequest(query = {}) {
    const side = query.side === 'sell' ? 'sell' : 'buy';
    const amountType = normalizeComparisonAmountType(query.amountType);
    const amount = parseRequestNumber(query.amount);
    const hasFeeRate = query.feeRate != null && query.feeRate !== '';
    const feeRate = hasFeeRate ? parseRequestNumber(query.feeRate) : null;
    const instrumentId = String(query.instrumentId || defaultInstrumentId).toUpperCase();

    if (amount == null || amount <= 0) {
      return { error: 'amount は正の数値を指定してください' };
    }

    if (hasFeeRate && (feeRate == null || feeRate < 0 || feeRate > 1)) {
      return { error: 'feeRate は0以上1以下を指定してください' };
    }

    return {
      params: {
        amount,
        amountType,
        feeRate,
        instrumentId,
        side,
      },
    };
  }

  function compareExecutionStatusRank(row) {
    if (!row || row.status !== 'fresh' || !row.result) return 5;
    if (row.result.executionStatus === 'executable') return 0;
    if (row.result.executionStatus === 'invalid_constraints') return 1;
    if (row.result.executionStatus === 'insufficient_liquidity') return 2;
    if (row.result.executionStatus === 'auto_cancel') return 3;
    return 4;
  }

  function isFreshComparisonRow(row) {
    return Boolean(row && row.status === 'fresh' && row.result && !row.result.error);
  }

  function comparisonSortValue(row, side, amountType) {
    if (!row || !row.result) {
      return side === 'sell' ? -Infinity : Infinity;
    }

    const field = amountType === 'jpy' ? 'effectiveVWAP' : 'effectiveCostJPY';
    const value = Number(row.result[field]);
    if (!Number.isFinite(value)) return null;
    return value;
  }

  function sortComparisonRows(rows, side, amountType) {
    return rows.sort((a, b) => {
      const aFresh = isFreshComparisonRow(a);
      const bFresh = isFreshComparisonRow(b);
      if (aFresh && !bFresh) return -1;
      if (!aFresh && bFresh) return 1;
      if (!aFresh && !bFresh) {
        const stateDiff = marketDataStatusRank(a && a.status) - marketDataStatusRank(b && b.status);
        if (stateDiff !== 0) return stateDiff;
        return String(a.exchangeLabel || a.exchangeId).localeCompare(String(b.exchangeLabel || b.exchangeId), 'ja');
      }

      const statusDiff = compareExecutionStatusRank(a) - compareExecutionStatusRank(b);
      if (statusDiff !== 0) return statusDiff;

      const aValue = comparisonSortValue(a, side, amountType);
      const bValue = comparisonSortValue(b, side, amountType);
      if (aValue == null && bValue == null) return 0;
      if (aValue == null) return 1;
      if (bValue == null) return -1;

      const valueDiff = side === 'sell' ? bValue - aValue : aValue - bValue;
      if (valueDiff !== 0) return valueDiff;

      return String(a.exchangeLabel || a.exchangeId).localeCompare(String(b.exchangeLabel || b.exchangeId), 'ja');
    });
  }

  function getBestFreshComparisonRow(comparison) {
    return (comparison.rows || []).find(row => (
      row.status === 'fresh' && row.result && !row.result.error && row.rank === 1
    )) || null;
  }

  function resultSummary(result) {
    if (!result || result.error) {
      return result && result.error ? { error: result.error } : null;
    }

    return {
      side: result.side,
      amountType: result.amountType,
      totalBTCFilled: result.totalBTCFilled,
      totalJPYSpent: result.totalJPYSpent,
      vwap: result.vwap,
      effectiveCostJPY: result.effectiveCostJPY,
      effectiveVWAP: result.effectiveVWAP,
      feesJPY: result.feesJPY,
      feeLabel: result.feeLabel,
      feeRatePct: result.feeRatePct,
      marketImpactPct: result.marketImpactPct,
      slippageFromBestPct: result.slippageFromBestPct,
      slippageFromMidPct: result.slippageFromMidPct,
      spreadPct: result.spreadPct,
      levelsConsumed: result.levelsConsumed,
      totalLevelsAvailable: result.totalLevelsAvailable,
      executionStatus: result.executionStatus,
      executionStatusLabel: result.executionStatusLabel,
      recommendedAction: result.recommendedAction,
      executableUnderGuards: result.executableUnderGuards,
      insufficient: result.insufficient,
      shortfallBTC: result.shortfallBTC,
      shortfallJPY: result.shortfallJPY,
      constraintAdjusted: result.constraintAdjusted,
      quantityRounded: result.quantityRounded,
      priceAdjustedToTick: result.priceAdjustedToTick,
      requestedBaseQuantity: result.requestedBaseQuantity,
      roundedBaseQuantity: result.roundedBaseQuantity,
      sizeRoundingDeltaBase: result.sizeRoundingDeltaBase,
      sizeRoundingDeltaJPY: result.sizeRoundingDeltaJPY,
      unusedQuoteJPY: result.unusedQuoteJPY,
      blockingReasons: result.blockingReasons,
      constraintNotes: result.constraintNotes,
      constraintSummary: result.constraintSummary,
      bookTimestamp: result.bookTimestamp,
    };
  }

  function buildMarketImpactComparison({ instrumentId, side, amount, amountType, feeRate }) {
    const generatedAt = new Date().toISOString();
    const now = Date.now();
    const rows = [];
    const publicExchanges = getPublicExchanges();

    for (const exchange of publicExchanges) {
      const market = (exchange.markets || []).find(item => (
        item.instrumentId === instrumentId && (!item.status || item.status === 'active')
      ));

      if (!market) {
        rows.push({
          exchangeId: exchange.id,
          exchangeLabel: exchange.label || exchange.id,
          instrumentId,
          instrumentLabel: instrumentId,
          status: 'unsupported',
          message: '未対応銘柄',
        });
        continue;
      }

      const client = clientsByExchange.get(exchange.id);
      if (client && typeof client.activateInstrument === 'function') {
        client.activateInstrument(instrumentId);
      }

      const book = wsManager.latestBooks.get(wsManager.marketKey(exchange.id, instrumentId));
      const bookRow = buildOrderbookStateRow(book, {
        exchangeId: exchange.id,
        exchangeLabel: exchange.label || exchange.id,
        instrumentId,
        instrumentLabel: market.label || instrumentId,
        baseCurrency: market.baseCurrency || null,
        quoteCurrency: market.quoteCurrency || 'JPY',
      }, {
        now,
        staleMessage: '板データが古いため比較から除外',
      });

      if (bookRow.status !== 'fresh') {
        rows.push(bookRow);
        continue;
      }

      const result = calculateImpact(side, amount, amountType, book, {
        feeRate,
        market,
      });
      rows.push({
        ...bookRow,
        status: result && result.error ? 'error' : 'fresh',
        message: result && result.error ? result.error : null,
        result: resultSummary(result),
      });
    }

    const sortedRows = sortComparisonRows(rows, side, amountType);
    let rank = 0;
    for (const row of sortedRows) {
      if (
        row.status === 'fresh'
        && row.result
        && !row.result.error
        && row.result.executionStatus === 'executable'
      ) {
        rank += 1;
        row.rank = rank;
      } else {
        row.rank = null;
      }
    }

    const freshCount = sortedRows.filter(row => row.status === 'fresh').length;
    const readyCount = sortedRows.filter(row => (
      row.status === 'fresh'
      && row.result
      && !row.result.error
      && row.result.executionStatus === 'executable'
    )).length;
    const staleCount = sortedRows.filter(row => row.status === 'stale').length;
    const waitingCount = sortedRows.filter(row => row.status === 'waiting').length;
    const unsupportedCount = sortedRows.filter(row => row.status === 'unsupported').length;

    return {
      meta: {
        generatedAt,
        instrumentId,
        side,
        amount,
        amountType,
        feeRate,
        freshCount,
        staleCount,
        waitingCount,
        unsupportedCount,
        readyCount,
      },
      rows: sortedRows,
    };
  }

  function buildSalesReferenceResult(record, { side, amount, amountType }) {
    const price = side === 'buy' ? Number(record.buyPrice) : Number(record.sellPrice);
    if (!Number.isFinite(price) || price <= 0) {
      return null;
    }

    const isBaseAmount = amountType === 'base';
    const totalBase = isBaseAmount ? amount : amount / price;
    const grossQuote = totalBase * price;
    const effectiveQuote = grossQuote;

    return {
      side,
      amountType,
      price,
      priceSide: side === 'buy' ? 'buyPrice' : 'sellPrice',
      requestedAmount: amount,
      totalBase,
      grossQuote,
      effectiveQuote,
      effectiveVWAP: price,
      feesJPY: 0,
      spreadPct: record.spreadPct,
      capturedAt: record.capturedAt,
      priceTimestamp: record.priceTimestamp,
    };
  }

  function buildSalesDelta(salesResult, baselineResult, side, amountType) {
    if (!salesResult || !baselineResult) return null;

    if (amountType === 'base') {
      const disadvantageJpy = side === 'buy'
        ? salesResult.effectiveQuote - baselineResult.effectiveCostJPY
        : baselineResult.effectiveCostJPY - salesResult.effectiveQuote;
      return {
        type: 'quote',
        disadvantageJpy,
        quoteDelta: side === 'buy'
          ? salesResult.effectiveQuote - baselineResult.effectiveCostJPY
          : salesResult.effectiveQuote - baselineResult.effectiveCostJPY,
        baseDelta: 0,
      };
    }

    const baseDelta = salesResult.totalBase - baselineResult.totalBTCFilled;
    const disadvantageJpy = side === 'buy'
      ? (baselineResult.totalBTCFilled - salesResult.totalBase) * salesResult.price
      : (salesResult.totalBase - baselineResult.totalBTCFilled) * salesResult.price;

    return {
      type: 'base',
      disadvantageJpy,
      baseDelta,
      quoteDelta: 0,
    };
  }

  function saleReferenceSortValue(row) {
    if (!row || row.status !== 'ready' || !row.delta) return Infinity;
    const value = Number(row.delta.disadvantageJpy);
    return Number.isFinite(value) ? value : Infinity;
  }

  function sortSalesReferenceRows(rows) {
    return rows.sort((a, b) => {
      if (a.status === 'ready' && b.status !== 'ready') return -1;
      if (a.status !== 'ready' && b.status === 'ready') return 1;

      const valueDiff = saleReferenceSortValue(a) - saleReferenceSortValue(b);
      if (valueDiff !== 0) return valueDiff;

      return String(a.exchangeLabel || a.exchangeId).localeCompare(String(b.exchangeLabel || b.exchangeId), 'ja');
    });
  }

  function buildSalesReferenceComparison({ instrumentId, side, amount, amountType, feeRate }) {
    const generatedAt = new Date().toISOString();
    const venueComparison = buildMarketImpactComparison({
      instrumentId,
      side,
      amount,
      amountType,
      feeRate,
    });
    const baseline = getBestFreshComparisonRow(venueComparison);
    const latestSalesRecords = salesSpreadStore.getLatestRecords()
      .filter(record => record.instrumentId === instrumentId);

    const rows = latestSalesRecords.map((record) => {
      const result = buildSalesReferenceResult(record, { side, amount, amountType });
      const delta = baseline && result
        ? buildSalesDelta(result, baseline.result, side, amountType)
        : null;

      return {
        exchangeId: record.exchangeId,
        exchangeLabel: record.exchangeLabel,
        instrumentId: record.instrumentId,
        instrumentLabel: record.instrumentLabel,
        baseCurrency: record.baseCurrency,
        quoteCurrency: record.quoteCurrency || 'JPY',
        currencyFullName: record.currencyFullName,
        status: result ? 'ready' : 'error',
        message: result ? null : '販売所価格を計算できません',
        buyPrice: record.buyPrice,
        sellPrice: record.sellPrice,
        quotePrecision: record.quotePrecision,
        spread: record.spread,
        spreadPct: record.spreadPct,
        isOnline: record.isOnline,
        isWidgetOpen: record.isWidgetOpen,
        capturedAt: record.capturedAt,
        priceTimestamp: record.priceTimestamp,
        result,
        delta,
        riskLabel: '価格再提示リスクあり',
        assumption: '販売所の表示価格が全数量に適用されると仮定した参考値です。',
      };
    });

    const sortedRows = sortSalesReferenceRows(rows);
    let rank = 0;
    for (const row of sortedRows) {
      if (row.status === 'ready') {
        rank += 1;
        row.rank = rank;
      } else {
        row.rank = null;
      }
    }

    return {
      meta: {
        generatedAt,
        instrumentId,
        side,
        amount,
        amountType,
        feeRate,
        saleRecordCount: sortedRows.length,
        baselineExchangeId: baseline ? baseline.exchangeId : null,
        baselineExchangeLabel: baseline ? baseline.exchangeLabel : null,
        baselineFresh: Boolean(baseline),
        baselineReady: Boolean(baseline),
        venueFreshCount: venueComparison.meta.freshCount,
        venueReadyCount: venueComparison.meta.readyCount,
        venueStaleCount: venueComparison.meta.staleCount,
        refreshStatus: salesSpreadStore.refreshStatus,
        assumption: '販売所は板情報がないため、表示価格が全数量に適用されると仮定した参考値です。実際の発注時には価格再提示、数量制限、約定拒否が発生する場合があります。',
      },
      baseline,
      rows: sortedRows,
    };
  }

  return {
    buildMarketImpactComparison,
    buildMarketPageReport,
    buildOrderbookStateRow,
    buildSalesReferenceComparison,
    normalizeComparisonAmountType,
    parseRequestNumber,
    readComparisonRequest,
    sortComparisonRows,
    sortSalesReferenceRows,
  };
}

module.exports = {
  createMarketDataService,
};
