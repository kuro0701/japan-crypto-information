document.addEventListener('DOMContentLoaded', () => {
  const ws = new WSClient();
  let latestDepthData = null;
  let latestMidPrice = null;
  let autoUpdate = true;
  let lastComparisonParams = null;
  let comparisonRefreshTimer = null;
  let comparisonAbortController = null;
  let salesReferenceAbortController = null;
  const COMPARISON_REFRESH_MS = 10000;
  const defaultMarket = {
    instrumentId: 'BTC-JPY',
    label: 'BTC/JPY',
    baseCurrency: 'BTC',
    quoteCurrency: 'JPY',
    status: 'active',
  };
  let exchanges = [{
    id: 'okj',
    label: 'OKJ',
    defaultInstrumentId: 'BTC-JPY',
    instrumentLabel: 'BTC/JPY',
    dataSourceLabel: 'OKCoin Japan WebSocket + REST fallback',
    status: 'active',
    markets: [defaultMarket],
  }];

  // DOM elements
  const exchangeSelect = document.getElementById('exchange-select');
  const marketSelect = document.getElementById('market-select');
  const sideSelect = document.getElementById('side-select');
  const amountTypeSelect = document.getElementById('amount-type');
  const amountInput = document.getElementById('amount-input');
  const feeRateInput = document.getElementById('fee-rate');
  const simulateBtn = document.getElementById('simulate-btn');
  const clearBtn = document.getElementById('clear-btn');
  const autoUpdateCheck = document.getElementById('auto-update');
  const amountUnit = document.getElementById('amount-unit');

  const parseNumberInput = (value) => parseFloat(String(value || '').replace(/,/g, ''));
  const escapeHtml = (value) => String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
  const getMarkets = (exchange) => (exchange && Array.isArray(exchange.markets) && exchange.markets.length > 0)
    ? exchange.markets
    : [defaultMarket];
  const getSelectedExchange = () => {
    const selectedId = exchangeSelect ? exchangeSelect.value : ws.exchangeId;
    return exchanges.find(exchange => exchange.id === selectedId) || exchanges[0];
  };
  const getSelectedMarket = (exchange = getSelectedExchange()) => {
    const markets = getMarkets(exchange);
    const selectedId = marketSelect ? marketSelect.value : ws.instrumentId;
    return markets.find(market => market.instrumentId === selectedId)
      || markets.find(market => market.instrumentId === exchange.defaultInstrumentId)
      || markets[0];
  };

  function updateAmountUnit() {
    const market = getSelectedMarket();
    const base = market.baseCurrency || 'BTC';
    amountUnit.textContent = amountTypeSelect.value === 'base' ? base : 'JPY';
    amountInput.placeholder = amountTypeSelect.value === 'base' ? '1.0' : '10000000';
    
    // Update the dropdown option text itself
    const baseOption = document.getElementById('amount-type-base-option');
    if (baseOption) {
      baseOption.textContent = `数量 (${base})`;
    }
  }

  function setMarketDisplay(exchange, market = getSelectedMarket(exchange)) {
    if (!exchange) return;
    UI.setText('instrument-label', market.label || market.instrumentId || '-');
    UI.setText('footer-exchange-label', exchange.label || '-');
    UI.setText('footer-instrument-label', market.label || market.instrumentId || '-');
    UI.setText('footer-source-label', exchange.dataSourceLabel || '-');
    UI.setMarketMeta(market);
    if (typeof setChartBaseCurrency === 'function') {
      setChartBaseCurrency(market.baseCurrency || 'BTC');
    }
    updateAmountUnit();
  }

  function clearMarketState() {
    latestDepthData = null;
    latestMidPrice = null;
    setSimulationForChart(null);
    UI.clearMarketView();
    UI.clearSimulationView();
    clearVenueComparison();
    ws.clearSimulation();
    if (depthChart) {
      depthChart.data.datasets.forEach(dataset => {
        dataset.data = [];
      });
      depthChart.update('none');
    }
  }

  function setVenueComparisonEmpty(message) {
    const tbody = document.getElementById('venue-comparison-tbody');
    if (tbody) {
      tbody.innerHTML = `<tr><td colspan="7" class="text-center text-gray-500 py-4">${escapeHtml(message)}</td></tr>`;
    }
  }

  function stopComparisonRefresh() {
    if (comparisonRefreshTimer) {
      clearInterval(comparisonRefreshTimer);
      comparisonRefreshTimer = null;
    }
  }

  function clearVenueComparison() {
    lastComparisonParams = null;
    stopComparisonRefresh();
    if (comparisonAbortController) {
      comparisonAbortController.abort();
      comparisonAbortController = null;
    }
    if (salesReferenceAbortController) {
      salesReferenceAbortController.abort();
      salesReferenceAbortController = null;
    }
    UI.setText('venue-comparison-meta', 'シミュレーション実行後に比較します');
    UI.setText('sales-reference-meta', '販売所は表示価格ベースの参考値です');
    setVenueComparisonEmpty('シミュレーション結果なし');
    setSalesReferenceEmpty('シミュレーション結果なし');
  }

  function scheduleComparisonRefresh() {
    stopComparisonRefresh();
    if (!autoUpdate || !lastComparisonParams) return;
    comparisonRefreshTimer = setInterval(() => {
      loadVenueComparison({ background: true });
      loadSalesReferenceComparison({ background: true });
    }, COMPARISON_REFRESH_MS);
  }

  function comparisonAmountLabel(params) {
    if (!params) return '-';
    if (params.amountType === 'jpy') return Fmt.jpy(params.amount);
    return UI.formatBase(params.amount, true);
  }

  function comparisonGeneratedAtLabel(value) {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    return date.toLocaleTimeString('ja-JP', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  }

  function comparisonUpdatedAtLabel(row) {
    const value = row && (row.timestamp || row.receivedAt);
    if (!value) return '-';
    const date = typeof value === 'number' ? new Date(value) : new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    return date.toLocaleTimeString('ja-JP', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  }

  function comparisonStatusClass(status) {
    return {
      executable: 'text-green-300',
      insufficient_liquidity: 'text-yellow-300',
      auto_cancel: 'text-yellow-300',
      circuit_breaker: 'text-red-300',
    }[status] || 'text-gray-300';
  }

  function renderVenueComparison(data) {
    const tbody = document.getElementById('venue-comparison-tbody');
    if (!tbody) return;

    const meta = data && data.meta ? data.meta : {};
    const rows = Array.isArray(data && data.rows) ? data.rows : [];
    const sideLabel = meta.side === 'sell' ? '売り' : '買い';
    const market = getSelectedMarket();
    const effectiveHeader = document.getElementById('venue-col-effective');
    if (effectiveHeader) {
      if (meta.amountType === 'jpy') {
        effectiveHeader.textContent = meta.side === 'sell' ? '必要数量' : '取得数量';
      } else {
        effectiveHeader.textContent = meta.side === 'sell' ? '実効受取' : '実効コスト';
      }
    }

    UI.setText(
      'venue-comparison-meta',
      `${market.label || meta.instrumentId || '-'} | ${sideLabel} | ${comparisonAmountLabel(meta)} | 取得 ${comparisonGeneratedAtLabel(meta.generatedAt)} | 有効 ${meta.readyCount || 0}件 / 待機 ${meta.waitingCount || 0}件`
    );

    if (rows.length === 0) {
      setVenueComparisonEmpty('比較できる取引所がありません');
      return;
    }

    const isSell = meta.side === 'sell';
    tbody.innerHTML = rows.map(row => {
      const result = row.result || null;
      const ready = row.status === 'ready' && result && !result.error;
      const rankLabel = row.rank ? `#${row.rank}` : '-';
      const rowClass = row.rank === 1 && ready ? 'data-table__row--rank-1' : '';
      const valueClass = isSell ? 'text-green-300' : 'text-red-300';
      const statusText = ready
        ? (result.executionStatusLabel || '発注可能')
        : (row.message || '板データ待機中');
      const statusClass = ready ? comparisonStatusClass(result.executionStatus) : 'text-gray-500';
      const fixedQuoteAmount = meta.amountType === 'jpy';
      const effectiveValue = ready
        ? (fixedQuoteAmount ? UI.formatBase(result.totalBTCFilled, true) : Fmt.jpy(result.effectiveCostJPY))
        : '-';
      const fixedQuoteSub = ready
        ? (isSell ? `受取 ${Fmt.jpy(result.effectiveCostJPY)}` : `支払 ${Fmt.jpy(result.effectiveCostJPY)}`)
        : '';
      const effectiveSub = ready
        ? (fixedQuoteAmount ? fixedQuoteSub : `手数料 ${Fmt.jpy(result.feesJPY)}`)
        : escapeHtml(row.status === 'unsupported' ? '未対応' : row.status === 'waiting' ? '取得待ち' : '計算不可');
      const vwapValue = ready ? Fmt.jpy(result.effectiveVWAP) : '-';
      const spreadLabel = row.spreadPct == null ? '-' : Fmt.pct(row.spreadPct);
      const impactValue = ready ? Fmt.pct(result.marketImpactPct) : '-';
      const impactSub = ready ? `Best比 ${Fmt.pct(result.slippageFromBestPct)}` : '-';
      const sourceLabel = row.source === 'websocket' ? 'WS' : row.source ? String(row.source).toUpperCase() : '-';
      const shortfall = ready && result.insufficient
        ? `<div class="text-[10px] text-yellow-500">流動性不足</div>`
        : '';

      return `
        <tr class="border-b border-gray-800/60 ${rowClass}">
          <td headers="venue-col-rank" class="is-num text-right font-mono text-gray-300" data-label="順位">${rankLabel}</td>
          <td headers="venue-col-exchange" class="text-left" data-label="取引所">
            <div class="font-bold text-gray-200">${escapeHtml(row.exchangeLabel || row.exchangeId)}</div>
            <div class="text-[10px] text-gray-500">${escapeHtml(row.instrumentLabel || row.instrumentId)} / ${escapeHtml(sourceLabel)}</div>
          </td>
          <td headers="venue-col-effective" class="is-num text-right font-mono ${ready ? valueClass : 'text-gray-500'}" data-label="${fixedQuoteAmount ? (isSell ? '必要数量' : '取得数量') : (isSell ? '実効受取' : '実効コスト')}">
            <div>${effectiveValue}</div>
            <div class="text-[10px] text-gray-500">${effectiveSub}</div>
          </td>
          <td headers="venue-col-vwap" class="is-num text-right font-mono text-gray-300" data-label="実効VWAP">
            <div>${vwapValue}</div>
            <div class="text-[10px] text-gray-500">Spread ${spreadLabel}</div>
          </td>
          <td headers="venue-col-impact" class="is-num text-right font-mono text-gray-300" data-label="Impact">
            <div>${impactValue}</div>
            <div class="text-[10px] text-gray-500">${impactSub}</div>
          </td>
          <td headers="venue-col-status" class="${statusClass}" data-label="判定">
            <div class="font-bold">${escapeHtml(statusText)}</div>
            ${shortfall}
          </td>
          <td headers="venue-col-updated" class="text-right font-mono text-gray-400" data-label="更新">${comparisonUpdatedAtLabel(row)}</td>
        </tr>
      `;
    }).join('');
  }

  async function loadVenueComparison(options = {}) {
    if (!lastComparisonParams) return;
    const { background = false } = options;
    const params = new URLSearchParams({
      exchangeId: lastComparisonParams.exchangeId,
      instrumentId: lastComparisonParams.instrumentId,
      side: lastComparisonParams.side,
      amountType: lastComparisonParams.amountType,
      amount: String(lastComparisonParams.amount),
      feeRate: String(lastComparisonParams.feeRate),
    });

    if (comparisonAbortController) comparisonAbortController.abort();
    const controller = new AbortController();
    comparisonAbortController = controller;

    if (!background) {
      UI.setText('venue-comparison-meta', '比較を取得中');
      setVenueComparisonEmpty('比較を取得中');
    }

    try {
      const res = await fetch(`/api/market-impact-comparison?${params.toString()}`, {
        cache: 'no-store',
        signal: controller.signal,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      renderVenueComparison(await res.json());
    } catch (err) {
      if (err.name === 'AbortError') return;
      if (!background) {
        UI.setText('venue-comparison-meta', err.message);
        setVenueComparisonEmpty('比較の取得に失敗しました');
      }
    } finally {
      if (comparisonAbortController === controller) {
        comparisonAbortController = null;
      }
    }
  }

  function setSalesReferenceEmpty(message) {
    const tbody = document.getElementById('sales-reference-tbody');
    if (tbody) {
      tbody.innerHTML = `<tr><td colspan="7" class="text-center text-gray-500 py-4">${escapeHtml(message)}</td></tr>`;
    }
  }

  function signedJpy(value) {
    if (value == null || isNaN(value)) return '-';
    const abs = Math.abs(value);
    if (Math.abs(value) < 0.5) return Fmt.jpy(0);
    return `${value > 0 ? '+' : '-'}${Fmt.jpy(abs)}`;
  }

  function referencePriceDecimals(value, precision) {
    const abs = Math.abs(Number(value));
    if (!Number.isFinite(abs)) return 0;
    if (abs >= 1000) return Math.min(Math.max(precision ?? 0, 0), 2);
    if (abs >= 100) return Math.min(Math.max(precision ?? 1, 1), 3);
    if (abs >= 1) return Math.min(Math.max(precision ?? 2, 2), 5);
    return Math.min(Math.max(precision ?? 6, 6), 10);
  }

  function formatReferencePrice(value, precision) {
    if (value == null || isNaN(value)) return '-';
    return new Intl.NumberFormat('ja-JP', {
      style: 'currency',
      currency: 'JPY',
      minimumFractionDigits: 0,
      maximumFractionDigits: referencePriceDecimals(value, precision),
    }).format(value);
  }

  function salesReferenceUpdatedAtLabel(row) {
    const value = row && (row.priceTimestamp || row.capturedAt);
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    return date.toLocaleTimeString('ja-JP', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  }

  function salesDeltaLabel(row, meta) {
    const delta = row.delta;
    if (!delta) {
      return {
        value: '-',
        sub: meta.baselineReady ? '比較不可' : '取引所板待機中',
        className: 'text-gray-500',
      };
    }

    const disadvantage = Number(delta.disadvantageJpy);
    const isWorse = Number.isFinite(disadvantage) && disadvantage > 0.5;
    const isBetter = Number.isFinite(disadvantage) && disadvantage < -0.5;
    const className = isWorse ? 'text-yellow-300' : isBetter ? 'text-green-300' : 'text-gray-300';
    const prefix = isWorse ? '不利' : isBetter ? '有利' : '同等';

    if (delta.type === 'base') {
      const baseDelta = Number(delta.baseDelta);
      const absBase = Math.abs(baseDelta);
      const movement = meta.side === 'sell'
        ? (baseDelta > 0 ? '多く必要' : '少なく必要')
        : (baseDelta > 0 ? '多く取得' : '少なく取得');
      return {
        value: absBase < 1e-10 ? '同等' : `${UI.formatBase(absBase, true)} ${movement}`,
        sub: `${prefix}換算 ${signedJpy(disadvantage)}`,
        className,
      };
    }

    return {
      value: `${prefix} ${signedJpy(disadvantage)}`,
      sub: meta.side === 'sell' ? '受取差' : '支払差',
      className,
    };
  }

  function salesReferenceResultLabel(row, meta) {
    const result = row.result;
    if (!result) {
      return { value: '-', sub: '計算不可' };
    }

    const fixedQuote = meta.amountType === 'jpy';
    if (fixedQuote) {
      return {
        value: `${meta.side === 'sell' ? '必要' : '取得'} ${UI.formatBase(result.totalBase, true)}`,
        sub: `${meta.side === 'sell' ? '受取' : '支払'} ${Fmt.jpy(result.effectiveQuote)}`,
      };
    }

    return {
      value: `${meta.side === 'sell' ? '受取' : '支払'} ${Fmt.jpy(result.effectiveQuote)}`,
      sub: `${meta.side === 'sell' ? '売却' : '取得'} ${UI.formatBase(result.totalBase, true)}`,
    };
  }

  function renderSalesReferenceComparison(data) {
    const tbody = document.getElementById('sales-reference-tbody');
    if (!tbody) return;

    const meta = data && data.meta ? data.meta : {};
    const rows = Array.isArray(data && data.rows) ? data.rows : [];
    const market = getSelectedMarket();
    const sideLabel = meta.side === 'sell' ? '売り' : '買い';
    const priceHeader = document.getElementById('sales-ref-col-price');
    if (priceHeader) priceHeader.textContent = meta.side === 'sell' ? '売値' : '買値';

    UI.setText(
      'sales-reference-meta',
      `${market.label || meta.instrumentId || '-'} | ${sideLabel} | ${comparisonAmountLabel(meta)} | 基準 ${meta.baselineExchangeLabel || '取引所板待機中'} | 販売所 ${meta.saleRecordCount || 0}件`
    );

    if (rows.length === 0) {
      setSalesReferenceEmpty('販売所価格の記録待ち');
      return;
    }

    tbody.innerHTML = rows.map(row => {
      const result = row.result || null;
      const ready = row.status === 'ready' && result;
      const rankLabel = row.rank ? `#${row.rank}` : '-';
      const rowClass = row.rank === 1 && ready ? 'data-table__row--rank-1' : '';
      const price = ready ? formatReferencePrice(result.price, row.quotePrecision) : '-';
      const spread = row.spreadPct == null ? '-' : Fmt.pct(row.spreadPct);
      const resultLabel = salesReferenceResultLabel(row, meta);
      const deltaLabel = salesDeltaLabel(row, meta);
      const onlineLabel = row.isOnline === false || row.isWidgetOpen === false ? '販売停止の可能性' : '表示価格ベース';

      return `
        <tr class="border-b border-gray-800/60 ${rowClass}">
          <td headers="sales-ref-col-rank" class="is-num text-right font-mono text-gray-300" data-label="順位">${rankLabel}</td>
          <td headers="sales-ref-col-exchange" class="text-left" data-label="販売所">
            <div class="font-bold text-gray-200">${escapeHtml(row.exchangeLabel || row.exchangeId)}</div>
            <div class="text-[10px] text-gray-500">${escapeHtml(row.instrumentLabel || row.instrumentId)}</div>
          </td>
          <td headers="sales-ref-col-price" class="is-num text-right font-mono text-gray-300" data-label="${meta.side === 'sell' ? '売値' : '買値'}">
            <div>${price}</div>
            <div class="text-[10px] text-gray-500">Spread ${spread}</div>
          </td>
          <td headers="sales-ref-col-result" class="is-num text-right font-mono text-gray-300" data-label="参考結果">
            <div>${escapeHtml(resultLabel.value)}</div>
            <div class="text-[10px] text-gray-500">${escapeHtml(resultLabel.sub)}</div>
          </td>
          <td headers="sales-ref-col-delta" class="is-num text-right font-mono ${deltaLabel.className}" data-label="最良取引所との差">
            <div>${escapeHtml(deltaLabel.value)}</div>
            <div class="text-[10px] text-gray-500">${escapeHtml(deltaLabel.sub)}</div>
          </td>
          <td headers="sales-ref-col-risk" class="text-yellow-300" data-label="注意">
            <div class="font-bold">${escapeHtml(row.riskLabel || '価格再提示リスクあり')}</div>
            <div class="text-[10px] text-gray-500">${escapeHtml(onlineLabel)}</div>
          </td>
          <td headers="sales-ref-col-updated" class="text-right font-mono text-gray-400" data-label="更新">${salesReferenceUpdatedAtLabel(row)}</td>
        </tr>
      `;
    }).join('');
  }

  async function loadSalesReferenceComparison(options = {}) {
    if (!lastComparisonParams) return;
    const { background = false } = options;
    const params = new URLSearchParams({
      instrumentId: lastComparisonParams.instrumentId,
      side: lastComparisonParams.side,
      amountType: lastComparisonParams.amountType,
      amount: String(lastComparisonParams.amount),
      feeRate: String(lastComparisonParams.feeRate),
    });

    if (salesReferenceAbortController) salesReferenceAbortController.abort();
    const controller = new AbortController();
    salesReferenceAbortController = controller;

    if (!background) {
      UI.setText('sales-reference-meta', '販売所参考比較を取得中');
      setSalesReferenceEmpty('販売所参考比較を取得中');
    }

    try {
      const res = await fetch(`/api/sales-reference-comparison?${params.toString()}`, {
        cache: 'no-store',
        signal: controller.signal,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      renderSalesReferenceComparison(await res.json());
    } catch (err) {
      if (err.name === 'AbortError') return;
      if (!background) {
        UI.setText('sales-reference-meta', err.message);
        setSalesReferenceEmpty('販売所参考比較の取得に失敗しました');
      }
    } finally {
      if (salesReferenceAbortController === controller) {
        salesReferenceAbortController = null;
      }
    }
  }

  function populateExchangeSelect(nextExchanges, defaultExchangeId = 'okj') {
    if (!Array.isArray(nextExchanges) || nextExchanges.length === 0) return;
    exchanges = nextExchanges;

    if (!exchangeSelect) {
      setMarketDisplay(exchanges[0]);
      return;
    }

    const previousValue = exchangeSelect.value || defaultExchangeId;
    exchangeSelect.innerHTML = exchanges.map(exchange => `
      <option value="${exchange.id}" ${exchange.status !== 'active' ? 'disabled' : ''}>
        ${exchange.label}
      </option>
    `).join('');
    exchangeSelect.value = exchanges.some(exchange => exchange.id === previousValue)
      ? previousValue
      : defaultExchangeId;
    populateMarketSelect(getSelectedExchange());
    setMarketDisplay(getSelectedExchange());
  }

  function populateMarketSelect(exchange = getSelectedExchange(), preferredInstrumentId) {
    if (!marketSelect) return;

    const markets = getMarkets(exchange);
    const previousValue = preferredInstrumentId || marketSelect.value || exchange.defaultInstrumentId;
    marketSelect.innerHTML = markets.map(market => `
      <option value="${market.instrumentId}" ${market.status !== 'active' ? 'disabled' : ''}>
        ${market.label || market.instrumentId}
      </option>
    `).join('');
    marketSelect.value = markets.some(market => market.instrumentId === previousValue)
      ? previousValue
      : (markets.find(market => market.instrumentId === exchange.defaultInstrumentId) || markets[0]).instrumentId;
  }

  async function loadExchangesFromApi() {
    try {
      const res = await fetch('/api/exchanges', { cache: 'no-store' });
      if (!res.ok) return;

      const data = await res.json();
      populateExchangeSelect(data.exchanges, data.defaultExchangeId);
      const exchange = getSelectedExchange();
      populateMarketSelect(exchange, ws.instrumentId || exchange.defaultInstrumentId);
      const market = getSelectedMarket(exchange);
      ws.setMarket(exchange.id, market.instrumentId);
      setMarketDisplay(exchange, market);
    } catch (err) {
      console.warn('Exchange list fetch failed:', err);
    }
  }

  // Update unit label on amount type change
  amountTypeSelect.addEventListener('change', () => {
    updateAmountUnit();
  });

  // Side button toggle
  document.querySelectorAll('[data-side]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-side]').forEach(b => {
        b.classList.remove('is-active');
        b.setAttribute('aria-pressed', 'false');
      });
      btn.classList.add('is-active');
      btn.setAttribute('aria-pressed', 'true');
      sideSelect.value = btn.dataset.side;
    });
  });

  // Simulate
  function runSimulation() {
    const side = sideSelect.value;
    const amountType = amountTypeSelect.value;
    const amount = parseNumberInput(amountInput.value);

    if (isNaN(amount) || amount <= 0) {
      document.getElementById('simulation-results').innerHTML =
        '<div class="text-yellow-400 text-center py-4">正の数値を入力してください</div>';
      return;
    }

    const feeRatePct = parseNumberInput(feeRateInput.value);
    if (isNaN(feeRatePct) || feeRatePct < 0 || feeRatePct > 100) {
      document.getElementById('simulation-results').innerHTML =
        '<div class="text-yellow-400 text-center py-4">手数料率は0%以上100%以下で入力してください</div>';
      return;
    }

    ws.simulate(side, amount, amountType, feeRatePct / 100, autoUpdate);
    const exchange = getSelectedExchange();
    const market = getSelectedMarket(exchange);
    lastComparisonParams = {
      exchangeId: exchange.id,
      instrumentId: market.instrumentId,
      side,
      amount,
      amountType,
      feeRate: feeRatePct / 100,
    };
    loadVenueComparison();
    loadSalesReferenceComparison();
    scheduleComparisonRefresh();
  }

  simulateBtn.addEventListener('click', runSimulation);

  amountInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') runSimulation();
  });

  clearBtn.addEventListener('click', () => {
    ws.clearSimulation();
    setSimulationForChart(null);
    UI.clearSimulationView();
    clearVenueComparison();
    if (depthChart) {
      depthChart.data.datasets[2].data = [];
      depthChart.update('none');
    }
  });

  if (autoUpdateCheck) {
    autoUpdateCheck.addEventListener('change', () => {
      autoUpdate = autoUpdateCheck.checked;
      if (!autoUpdate) {
        ws.clearSimulation();
        stopComparisonRefresh();
      } else if (amountInput.value) {
        runSimulation();
      } else {
        scheduleComparisonRefresh();
      }
    });
  }

  if (exchangeSelect) {
    populateExchangeSelect(exchanges, 'okj');
    exchangeSelect.addEventListener('change', () => {
      const exchange = getSelectedExchange();
      populateMarketSelect(exchange, exchange.defaultInstrumentId);
      const market = getSelectedMarket(exchange);
      ws.setMarket(exchange.id, market.instrumentId);
      setMarketDisplay(exchange, market);
      clearMarketState();
    });
  }

  if (marketSelect) {
    marketSelect.addEventListener('change', () => {
      const exchange = getSelectedExchange();
      const market = getSelectedMarket(exchange);
      ws.setMarket(exchange.id, market.instrumentId);
      setMarketDisplay(exchange, market);
      clearMarketState();
    });
  }

  // WebSocket handlers
  ws.on('connected', () => UI.setConnectionStatus('connected'));
  ws.on('disconnected', () => UI.setConnectionStatus('disconnected'));
  ws.on('reconnecting', () => UI.setConnectionStatus('reconnecting'));

  ws.on('orderbook', (data) => {
    if (data.exchange && exchangeSelect) exchangeSelect.value = data.exchange.id;
    if (data.market && marketSelect) marketSelect.value = data.market.instrumentId;
    if (data.exchange || data.market) {
      setMarketDisplay(data.exchange || getSelectedExchange(), data.market || getSelectedMarket());
    }
    UI.updateMarketOverview(data);
    latestDepthData = data.depthChart;
    latestMidPrice = data.midPrice;
    updateDepthChart(data.depthChart, data.midPrice);
  });

  ws.on('ticker', (data) => {
    if (!data) return;
    const exchange = getSelectedExchange();
    const market = getSelectedMarket(exchange);
    if (data.exchangeId && data.exchangeId !== exchange.id) return;
    if (data.instrumentId && data.instrumentId !== market.instrumentId) return;
    UI.updateTicker(data);
  });

  ws.on('exchanges', (data) => {
    populateExchangeSelect(data.exchanges, data.defaultExchangeId);
    const exchange = getSelectedExchange();
    populateMarketSelect(exchange, ws.instrumentId || exchange.defaultInstrumentId);
    const market = getSelectedMarket(exchange);
    ws.setMarket(exchange.id, market.instrumentId);
    setMarketDisplay(exchange, market);
  });

  ws.on('simulation', (data) => {
    setSimulationForChart(data);
    UI.updateSimulationResults(data);
    UI.updateFillTable(data.fills || [], data.side);
    if (latestDepthData) {
      updateDepthChart(latestDepthData, latestMidPrice);
    }
  });

  ws.on('error', (data) => {
    if (data && data.message) {
      console.warn('Server error:', data.message);
    }
  });

  // Initialize
  initDepthChart();
  ws.connect();
  loadExchangesFromApi();
});
