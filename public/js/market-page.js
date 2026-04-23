document.addEventListener('DOMContentLoaded', () => {
  const config = window.MARKET_PAGE || {};
  const instrumentId = String(config.instrumentId || '').toUpperCase();
  const ws = new WSClient();
  const pagePoller = window.PagePoller.create();
  let summary = null;
  let selectedExchangeId = '';
  let comparisonTimer = null;
  let summaryAbortController = null;
  let comparisonAbortController = null;
  let lastComparisonData = null;
  const SUMMARY_REFRESH_MS = 60000;

  const $ = (id) => document.getElementById(id);
  const setText = (id, value) => {
    const el = $(id);
    if (el) el.textContent = value ?? '-';
  };
  const parseNumberInput = (value) => parseFloat(String(value || '').replace(/,/g, ''));
  const readOptionalFeeRatePct = (input) => {
    const raw = input && input.value != null ? String(input.value).trim() : '';
    if (!raw) return null;
    const parsed = parseNumberInput(raw);
    return Number.isFinite(parsed) ? parsed : NaN;
  };
  const escapeHtml = (value) => String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
  const marketPageUrl = (value) => `/markets/${encodeURIComponent(String(value || instrumentId || 'BTC-JPY').toUpperCase())}`;
  const fmtPct = (value) => value == null || isNaN(value) ? '-' : `${Number(value).toFixed(2)}%`;
  const fmtDateTime = (value) => {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    return date.toLocaleString('ja-JP', {
      timeZone: 'Asia/Tokyo',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };
  const fmtTime = (value) => {
    if (!value) return '-';
    const date = typeof value === 'number' ? new Date(value) : new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    return date.toLocaleTimeString('ja-JP', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };
  const marketLabel = () => (summary && summary.market && summary.market.label) || config.label || instrumentId;
  const statusRank = (status) => ({
    fresh: 0,
    stale: 1,
    waiting: 2,
    error: 3,
    unsupported: 4,
  }[status] ?? 5);

  const parseTimeValue = (value) => {
    if (value == null || value === '') return null;
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    const parsed = Date.parse(String(value));
    return Number.isFinite(parsed) ? parsed : null;
  };

  const rowUpdatedAtMs = (row) => parseTimeValue(row && (row.updatedAt ?? row.receivedAt ?? row.timestamp));
  const rowAgeMs = (row) => {
    const updatedAt = rowUpdatedAtMs(row);
    return updatedAt == null ? null : Math.max(0, Date.now() - updatedAt);
  };
  const rowAgeSeconds = (row) => {
    const ageMs = rowAgeMs(row);
    return ageMs == null ? null : Math.floor(ageMs / 1000);
  };
  const liveRowStatus = (row) => {
    const baseStatus = String((row && row.status) || 'waiting');
    if (baseStatus !== 'fresh' && baseStatus !== 'stale') return baseStatus;
    if (baseStatus === 'stale') return 'stale';
    const ageMs = rowAgeMs(row);
    const staleAfterMs = Number(row && row.staleAfterMs);
    if (ageMs != null && Number.isFinite(staleAfterMs) && staleAfterMs > 0 && ageMs > staleAfterMs) {
      return 'stale';
    }
    return 'fresh';
  };
  const ageLabel = (row) => {
    const seconds = rowAgeSeconds(row);
    return seconds == null ? '-' : `${seconds}秒前`;
  };
  const updatedAtLabel = (row) => fmtTime((row && row.timestamp) || rowUpdatedAtMs(row));
  const freshnessBadge = (status) => (
    status === 'stale'
      ? '<span class="freshness-badge freshness-badge--stale">STALE</span>'
      : ''
  );
  const summarizeStatuses = (rows) => rows.reduce((acc, row) => {
    const status = liveRowStatus(row);
    acc[status] = (acc[status] || 0) + 1;
    return acc;
  }, { fresh: 0, stale: 0, waiting: 0, error: 0, unsupported: 0 });
  const sortedOrderbookRows = () => ((summary && summary.orderbooks) || [])
    .slice()
    .sort((a, b) => {
      const statusDiff = statusRank(liveRowStatus(a)) - statusRank(liveRowStatus(b));
      if (statusDiff !== 0) return statusDiff;
      const spreadDiff = Number(a.spreadPct ?? Infinity) - Number(b.spreadPct ?? Infinity);
      if (spreadDiff !== 0) return spreadDiff;
      return String(a.exchangeLabel || a.exchangeId).localeCompare(String(b.exchangeLabel || b.exchangeId), 'ja');
    });

  function updateFeePresetHint() {
    const hint = $('market-fee-preset-hint');
    const input = $('market-fee-rate');
    if (!hint || !input) return;
    const feeRatePct = readOptionalFeeRatePct(input);
    if (feeRatePct == null) {
      hint.textContent = '未入力なら各取引所の既定 taker 手数料を使って比較します。入力すると全取引所を同じ手数料率で比較します。';
      return;
    }
    if (Number.isNaN(feeRatePct)) {
      hint.textContent = '手数料率は0%以上100%以下で入力してください。';
      return;
    }
    hint.textContent = `現在は ${feeRatePct}% を全取引所に手動適用しています。空に戻すと各取引所の既定手数料に戻ります。`;
  }

  function priceDecimals(value) {
    const abs = Math.abs(Number(value));
    if (!Number.isFinite(abs)) return 0;
    if (abs >= 1000) return 0;
    if (abs >= 100) return 2;
    if (abs >= 1) return 4;
    return 8;
  }

  function fmtJpyPrice(value) {
    if (value == null || isNaN(value)) return '-';
    return new Intl.NumberFormat('ja-JP', {
      style: 'currency',
      currency: 'JPY',
      minimumFractionDigits: 0,
      maximumFractionDigits: priceDecimals(value),
    }).format(value);
  }

  function setEmpty(tbodyId, colspan, message) {
    const tbody = $(tbodyId);
    if (tbody) tbody.innerHTML = `<tr><td colspan="${colspan}" class="text-center text-gray-500 py-4">${escapeHtml(message)}</td></tr>`;
  }

  function supportedExchanges() {
    return (summary && summary.exchanges) || [];
  }

  function selectedExchange() {
    return supportedExchanges().find(exchange => exchange.id === selectedExchangeId) || supportedExchanges()[0] || null;
  }

  function selectedOrderbookRow() {
    return ((summary && summary.orderbooks) || []).find(row => row.exchangeId === selectedExchangeId) || null;
  }

  function updatePageLabels() {
    const label = marketLabel();
    const navLink = $('market-page-nav-link');
    document.title = `${label} 国内取引所データ｜Japan クリプト インフォメーション`;
    setText('market-page-title', `${label} 銘柄ページ`);
    setText('market-page-subtitle', '板・出来高シェア・販売所スプレッド');
    setText('market-hero-title', `${label} 国内取引所データ`);
    setText('market-footer-label', `${label} 銘柄ページ`);
    if (navLink) {
      navLink.href = marketPageUrl(instrumentId);
      navLink.title = `${label} 銘柄ページ`;
    }
  }

  function populateBoardExchangeSelect() {
    const select = $('market-board-exchange');
    if (!select) return;
    const exchanges = supportedExchanges();
    if (exchanges.length === 0) return;

    if (!selectedExchangeId || !exchanges.some(exchange => exchange.id === selectedExchangeId)) {
      const rows = sortedOrderbookRows();
      const fresh = rows.find(row => liveRowStatus(row) === 'fresh');
      const stale = rows.find(row => liveRowStatus(row) === 'stale');
      selectedExchangeId = fresh ? fresh.exchangeId : (stale ? stale.exchangeId : exchanges[0].id);
    }

    select.innerHTML = exchanges.map(exchange => `
      <option value="${escapeHtml(exchange.id)}">${escapeHtml(exchange.label || exchange.id)}</option>
    `).join('');
    select.value = selectedExchangeId;
  }

  function updateSelectedOrderbookMeta() {
    const exchange = selectedExchange();
    if (!exchange) return;
    const row = selectedOrderbookRow();
    const status = liveRowStatus(row);
    const source = row && row.source ? ` / ${String(row.source).toUpperCase()}` : '';
    const stale = status === 'stale' ? ' / STALE' : '';
    const updated = row && (status === 'fresh' || status === 'stale')
      ? ` / 最終更新 ${ageLabel(row)}`
      : '';
    setText('orderbook-meta', `${exchange.label || exchange.id} / ${marketLabel()} の板${source}${stale}${updated}`);
  }

  function connectSelectedOrderbook() {
    const exchange = selectedExchange();
    if (!exchange) return;
    selectedExchangeId = exchange.id;
    ws.setMarket(exchange.id, instrumentId);
    if (typeof setChartBaseCurrency === 'function') {
      setChartBaseCurrency((summary.market && summary.market.baseCurrency) || instrumentId.split('-')[0] || 'BTC');
    }
    updateSelectedOrderbookMeta();
  }

  function renderHero() {
    const rows = sortedOrderbookRows();
    const counts = summarizeStatuses(rows);
    const freshRows = rows.filter(row => liveRowStatus(row) === 'fresh');
    const bestBid = freshRows
      .filter(row => Number.isFinite(Number(row.bestBid)))
      .sort((a, b) => Number(b.bestBid) - Number(a.bestBid))[0];
    const bestAsk = freshRows
      .filter(row => Number.isFinite(Number(row.bestAsk)))
      .sort((a, b) => Number(a.bestAsk) - Number(b.bestAsk))[0];
    let statusText = '板データ待機中';
    if (counts.fresh > 0 && counts.stale > 0) statusText = '鮮度注意';
    else if (counts.fresh > 0) statusText = '集計済み';
    else if (counts.stale > 0) statusText = '鮮度切れ';
    setText('market-status', statusText);
    setText('market-updated-at', fmtDateTime(summary.meta && summary.meta.generatedAt));
    setText('market-exchange-count', `${supportedExchanges().length}社`);
    setText('market-best-bid', bestBid ? `${bestBid.exchangeLabel} ${fmtJpyPrice(bestBid.bestBid)}` : '-');
    setText('market-best-ask', bestAsk ? `${bestAsk.exchangeLabel} ${fmtJpyPrice(bestAsk.bestAsk)}` : '-');
    setText('market-hero-meta', `板 新鮮 ${counts.fresh}社 / stale ${counts.stale}社 / 待機 ${counts.waiting}社 | 出来高 ${summary.volume.rows.length}件 | 販売所 ${summary.sales.rows.length}件`);
  }

  function renderOrderbookRows() {
    const tbody = $('market-orderbook-tbody');
    if (!tbody) return;
    const rows = sortedOrderbookRows();
    if (rows.length === 0) {
      setEmpty('market-orderbook-tbody', 5, '対応取引所がありません');
      return;
    }

    tbody.innerHTML = rows.map(row => {
      const status = liveRowStatus(row);
      const hasBook = status === 'fresh' || status === 'stale';
      const rowClass = status === 'stale' ? 'data-table__row--stale' : '';
      return `
        <tr class="border-b border-gray-800/60 ${rowClass}">
          <td class="text-left" data-label="取引所">
            <div class="font-bold text-gray-200">${escapeHtml(row.exchangeLabel || row.exchangeId)}</div>
            <div class="text-[10px] text-gray-500">${hasBook ? escapeHtml(String(row.source || '-').toUpperCase()) : escapeHtml(row.message || '板データ待機中')}</div>
          </td>
          <td class="is-num text-right font-mono text-green-300" data-label="Bid">${hasBook ? fmtJpyPrice(row.bestBid) : '-'}</td>
          <td class="is-num text-right font-mono text-red-300" data-label="Ask">${hasBook ? fmtJpyPrice(row.bestAsk) : '-'}</td>
          <td class="is-num text-right font-mono text-yellow-300" data-label="Spread">${hasBook ? fmtPct(row.spreadPct) : '-'}</td>
          <td class="text-right font-mono text-gray-400" data-label="更新">
            <div>${hasBook ? escapeHtml(updatedAtLabel(row)) : '-'}</div>
            <div class="text-[10px] text-gray-500">${hasBook ? escapeHtml(ageLabel(row)) : escapeHtml(row.message || '板データ待機中')}</div>
            ${freshnessBadge(status)}
          </td>
        </tr>
      `;
    }).join('');
  }

  function renderVolumeRows() {
    const rows = ((summary.volume && summary.volume.rows) || [])
      .slice()
      .sort((a, b) => Number(b.quoteVolume || 0) - Number(a.quoteVolume || 0));
    if (rows.length === 0) {
      setEmpty('market-volume-tbody', 4, '出来高データ待ち');
      return;
    }

    const tbody = $('market-volume-tbody');
    tbody.innerHTML = rows.map(row => `
      <tr class="border-b border-gray-800/60">
        <td class="font-bold text-gray-200" data-label="取引所">${escapeHtml(row.exchangeLabel || row.exchangeId)}</td>
        <td class="is-num text-right font-mono text-gray-300" data-label="出来高">${Fmt.jpyLarge(row.quoteVolume)}</td>
        <td class="is-num text-right font-mono text-yellow-300" data-label="銘柄内シェア">${fmtPct(row.instrumentSharePct)}</td>
        <td class="text-right font-mono text-gray-400" data-label="取得">${fmtDateTime(row.lastFetchedAt || row.capturedAt)}</td>
      </tr>
    `).join('');
  }

  function renderSalesRows() {
    const rows = ((summary.sales && summary.sales.rows) || [])
      .slice()
      .sort((a, b) => {
        const aPct = a.latest && Number(a.latest.spreadPct);
        const bPct = b.latest && Number(b.latest.spreadPct);
        if (Number.isFinite(aPct) && Number.isFinite(bPct)) return aPct - bPct;
        return String(a.exchangeLabel).localeCompare(String(b.exchangeLabel), 'ja');
      });
    if (rows.length === 0) {
      setEmpty('market-sales-tbody', 5, '販売所スプレッド記録待ち');
      return;
    }

    const tbody = $('market-sales-tbody');
    tbody.innerHTML = rows.map(row => {
      const latest = row.latest || {};
      return `
        <tr class="border-b border-gray-800/60">
          <td class="font-bold text-gray-200" data-label="販売所">${escapeHtml(row.exchangeLabel || row.exchangeId)}</td>
          <td class="is-num text-right font-mono text-red-300" data-label="買値">${fmtJpyPrice(latest.buyPrice)}</td>
          <td class="is-num text-right font-mono text-green-300" data-label="売値">${fmtJpyPrice(latest.sellPrice)}</td>
          <td class="is-num text-right font-mono text-yellow-300" data-label="Spread">${fmtPct(latest.spreadPct)}</td>
          <td class="text-right font-mono text-gray-400" data-label="取得">${fmtDateTime(latest.priceTimestamp || latest.capturedAt)}</td>
        </tr>
      `;
    }).join('');
  }

  function comparisonStatusClass(status) {
    return {
      executable: 'text-green-300',
      invalid_constraints: 'text-red-300',
      insufficient_liquidity: 'text-yellow-300',
      auto_cancel: 'text-yellow-300',
      circuit_breaker: 'text-red-300',
    }[status] || 'text-gray-300';
  }

  function comparisonReasonText(result) {
    if (!result) return '';
    const firstBlockingReason = Array.isArray(result.blockingReasons) ? result.blockingReasons[0] : '';
    if (firstBlockingReason) return firstBlockingReason;
    const firstConstraintNote = Array.isArray(result.constraintNotes) ? result.constraintNotes[0] : '';
    if (firstConstraintNote) return firstConstraintNote;
    return result.recommendedAction || '';
  }

  function comparisonAmountLabel(meta) {
    if (!meta) return '-';
    if (meta.amountType === 'jpy') return Fmt.jpy(meta.amount);
    return `${Fmt.baseCompact(meta.amount)} ${(summary.market && summary.market.baseCurrency) || instrumentId.split('-')[0] || ''}`;
  }

  async function loadComparison() {
    const side = $('market-side')?.value === 'sell' ? 'sell' : 'buy';
    const amountType = $('market-amount-type')?.value === 'base' ? 'base' : 'jpy';
    const amount = parseNumberInput($('market-amount')?.value);
    const feeRatePct = readOptionalFeeRatePct($('market-fee-rate'));
    if (comparisonAbortController) {
      comparisonAbortController.abort();
      comparisonAbortController = null;
    }
    if (!Number.isFinite(amount) || amount <= 0 || Number.isNaN(feeRatePct) || (feeRatePct != null && (feeRatePct < 0 || feeRatePct > 100))) {
      lastComparisonData = null;
      setEmpty('market-comparison-tbody', 6, '比較条件を確認してください');
      return;
    }

    const params = new URLSearchParams({
      instrumentId,
      side,
      amountType,
      amount: String(amount),
    });
    if (feeRatePct != null) {
      params.set('feeRate', String(feeRatePct / 100));
    }
    const controller = new AbortController();
    comparisonAbortController = controller;
    try {
      const res = await fetch(`/api/market-impact-comparison?${params.toString()}`, {
        cache: 'no-store',
        signal: controller.signal,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      renderComparison(await res.json());
    } catch (err) {
      if (err.name === 'AbortError') return;
      lastComparisonData = null;
      setText('market-comparison-meta', err.message);
      setEmpty('market-comparison-tbody', 6, '比較の取得に失敗しました');
    } finally {
      if (comparisonAbortController === controller) {
        comparisonAbortController = null;
      }
    }
  }

  function renderComparison(data) {
    lastComparisonData = data && typeof data === 'object' ? data : null;
    const rows = Array.isArray(data && data.rows) ? data.rows : [];
    const meta = data.meta || {};
    const counts = summarizeStatuses(rows);
    setText('market-comparison-meta', `${marketLabel()} | ${meta.side === 'sell' ? '売り' : '買い'} | ${comparisonAmountLabel(meta)} | 手数料 ${meta.feeRate == null ? '各取引所既定' : fmtPct(meta.feeRate * 100)} | 新鮮 ${counts.fresh || 0}件 / stale ${counts.stale || 0}件 / 待機 ${counts.waiting || 0}件`);
    if (rows.length === 0) {
      setEmpty('market-comparison-tbody', 6, '比較できる取引所がありません');
      return;
    }

    const isSell = meta.side === 'sell';
    const tbody = $('market-comparison-tbody');
    tbody.innerHTML = rows.map(row => {
      const result = row.result || null;
      const status = liveRowStatus(row);
      const ready = status === 'fresh' && result && !result.error;
      const fixedQuote = meta.amountType === 'jpy';
      const value = ready
        ? (fixedQuote ? `${Fmt.baseCompact(result.totalBTCFilled)} ${(row.baseCurrency || '').toUpperCase()}` : Fmt.jpy(result.effectiveCostJPY))
        : '-';
      const vwap = ready ? Fmt.jpy(result.effectiveVWAP) : '-';
      const statusText = ready
        ? (result.executionStatusLabel || '発注可能')
        : (status === 'stale' ? '板データが古いため比較停止' : (row.message || '板データ待機中'));
      const statusSub = ready
        ? comparisonReasonText(result)
        : (status === 'fresh' || status === 'stale' ? `最終更新 ${ageLabel(row)}` : '');
      const valueClass = ready ? (isSell ? 'text-green-300' : 'text-red-300') : 'text-gray-500';
      const statusClass = ready
        ? comparisonStatusClass(result.executionStatus)
        : (status === 'stale' ? 'text-yellow-300' : 'text-gray-500');
      const rowClass = [
        row.rank === 1 && ready ? 'data-table__row--rank-1' : '',
        status === 'stale' ? 'data-table__row--stale' : '',
      ].filter(Boolean).join(' ');
      return `
        <tr class="border-b border-gray-800/60 ${rowClass}">
          <td class="is-num text-right font-mono text-gray-300" data-label="順位">${ready && row.rank ? `#${row.rank}` : '-'}</td>
          <td class="text-left" data-label="取引所">
            <div class="font-bold text-gray-200">${escapeHtml(row.exchangeLabel || row.exchangeId)}</div>
            <div class="text-[10px] text-gray-500">${escapeHtml(String(row.source || '-').toUpperCase())}</div>
          </td>
          <td class="is-num text-right font-mono ${valueClass}" data-label="結果">${value}</td>
          <td class="is-num text-right font-mono text-gray-300" data-label="VWAP">${vwap}</td>
          <td class="is-num text-right font-mono text-yellow-300" data-label="Impact">${ready ? fmtPct(result.marketImpactPct) : '-'}</td>
          <td class="${statusClass}" data-label="判定">
            <div class="font-bold">${escapeHtml(statusText)}</div>
            ${statusSub ? `<div class="text-[10px] text-gray-500">${escapeHtml(statusSub)}</div>` : ''}
            ${freshnessBadge(status)}
          </td>
        </tr>
      `;
    }).join('');
  }

  function renderSummary(data) {
    summary = data;
    updatePageLabels();
    updateFeePresetHint();
    populateBoardExchangeSelect();
    renderHero();
    renderOrderbookRows();
    renderVolumeRows();
    renderSalesRows();
    connectSelectedOrderbook();
  }

  async function loadSummary() {
    if (summaryAbortController) {
      summaryAbortController.abort();
      summaryAbortController = null;
    }
    const controller = new AbortController();
    summaryAbortController = controller;
    try {
      const res = await fetch(`/api/markets/${encodeURIComponent(instrumentId)}`, {
        cache: 'no-store',
        signal: controller.signal,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      renderSummary(await res.json());
      void loadComparison();
    } catch (err) {
      if (err.name === 'AbortError') return;
      setText('market-status', '取得失敗');
      setText('market-hero-meta', err.message);
    } finally {
      if (summaryAbortController === controller) {
        summaryAbortController = null;
      }
    }
  }

  const summaryRefreshTask = pagePoller.createTask({
    intervalMs: SUMMARY_REFRESH_MS,
    callback: loadSummary,
  });

  const freshnessTask = pagePoller.createTask({
    intervalMs: 1000,
    callback: () => {
      if (summary) {
        renderHero();
        renderOrderbookRows();
        updateSelectedOrderbookMeta();
      }
      if (lastComparisonData) renderComparison(lastComparisonData);
    },
  });

  const boardSelect = $('market-board-exchange');
  if (boardSelect) {
    boardSelect.addEventListener('change', () => {
      selectedExchangeId = boardSelect.value;
      connectSelectedOrderbook();
    });
  }

  ['market-side', 'market-amount-type', 'market-amount', 'market-fee-rate'].forEach((id) => {
    const el = $(id);
    if (!el) return;
    const eventName = el.tagName === 'SELECT' ? 'change' : 'input';
    el.addEventListener(eventName, () => {
      if (id === 'market-fee-rate') updateFeePresetHint();
      if (comparisonTimer) clearTimeout(comparisonTimer);
      comparisonTimer = setTimeout(loadComparison, 250);
    });
  });

  ws.on('connected', () => {
    connectSelectedOrderbook();
  });
  ws.on('orderbook', (data) => {
    if (!data || data.instrumentId !== instrumentId || data.exchangeId !== selectedExchangeId) return;
    if (summary && Array.isArray(summary.orderbooks)) {
      const index = summary.orderbooks.findIndex(row => row.exchangeId === data.exchangeId && row.instrumentId === data.instrumentId);
      if (index >= 0) {
        summary.orderbooks[index] = {
          ...summary.orderbooks[index],
          ...data,
          exchangeLabel: summary.orderbooks[index].exchangeLabel || data.exchange?.label || data.exchangeId,
          instrumentLabel: summary.orderbooks[index].instrumentLabel || data.market?.label || data.instrumentId,
          status: 'fresh',
          freshnessStatus: 'fresh',
          message: null,
        };
      }
    }
    updateSelectedOrderbookMeta();
    setChartBaseCurrency(data.market?.baseCurrency || (summary.market && summary.market.baseCurrency) || 'BTC');
    updateDepthChart(data.depthChart, data.midPrice);
    if (summary) {
      renderHero();
      renderOrderbookRows();
    }
  });

  initDepthChart();
  updateFeePresetHint();
  loadSummary();
  ws.connect();
  summaryRefreshTask.start({ immediate: false });
  freshnessTask.start({ immediate: false });
  window.addEventListener('beforeunload', () => {
    pagePoller.dispose();
    if (comparisonTimer) clearTimeout(comparisonTimer);
    if (summaryAbortController) summaryAbortController.abort();
    if (comparisonAbortController) comparisonAbortController.abort();
  });
});
