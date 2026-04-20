document.addEventListener('DOMContentLoaded', () => {
  const config = window.MARKET_PAGE || {};
  const instrumentId = String(config.instrumentId || '').toUpperCase();
  const ws = new WSClient();
  let summary = null;
  let selectedExchangeId = '';
  let comparisonTimer = null;
  let summaryTimer = null;

  const $ = (id) => document.getElementById(id);
  const setText = (id, value) => {
    const el = $(id);
    if (el) el.textContent = value ?? '-';
  };
  const parseNumberInput = (value) => parseFloat(String(value || '').replace(/,/g, ''));
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
      const ready = (summary.orderbooks || []).find(row => row.status === 'ready');
      selectedExchangeId = ready ? ready.exchangeId : exchanges[0].id;
    }

    select.innerHTML = exchanges.map(exchange => `
      <option value="${escapeHtml(exchange.id)}">${escapeHtml(exchange.label || exchange.id)}</option>
    `).join('');
    select.value = selectedExchangeId;
  }

  function connectSelectedOrderbook() {
    const exchange = selectedExchange();
    if (!exchange) return;
    selectedExchangeId = exchange.id;
    ws.setMarket(exchange.id, instrumentId);
    if (typeof setChartBaseCurrency === 'function') {
      setChartBaseCurrency((summary.market && summary.market.baseCurrency) || instrumentId.split('-')[0] || 'BTC');
    }
    setText('orderbook-meta', `${exchange.label || exchange.id} / ${marketLabel()} の板`);
  }

  function renderHero() {
    const rows = summary.orderbooks || [];
    const readyRows = rows.filter(row => row.status === 'ready');
    const bestBid = readyRows
      .filter(row => Number.isFinite(Number(row.bestBid)))
      .sort((a, b) => Number(b.bestBid) - Number(a.bestBid))[0];
    const bestAsk = readyRows
      .filter(row => Number.isFinite(Number(row.bestAsk)))
      .sort((a, b) => Number(a.bestAsk) - Number(b.bestAsk))[0];
    setText('market-status', readyRows.length > 0 ? '集計済み' : '板データ待機中');
    setText('market-updated-at', fmtDateTime(summary.meta && summary.meta.generatedAt));
    setText('market-exchange-count', `${supportedExchanges().length}社`);
    setText('market-best-bid', bestBid ? `${bestBid.exchangeLabel} ${fmtJpyPrice(bestBid.bestBid)}` : '-');
    setText('market-best-ask', bestAsk ? `${bestAsk.exchangeLabel} ${fmtJpyPrice(bestAsk.bestAsk)}` : '-');
    setText('market-hero-meta', `板 ${readyRows.length}/${supportedExchanges().length}社 | 出来高 ${summary.volume.rows.length}件 | 販売所 ${summary.sales.rows.length}件`);
  }

  function renderOrderbookRows() {
    const tbody = $('market-orderbook-tbody');
    if (!tbody) return;
    const rows = summary.orderbooks || [];
    if (rows.length === 0) {
      setEmpty('market-orderbook-tbody', 5, '対応取引所がありません');
      return;
    }

    tbody.innerHTML = rows.map(row => {
      const ready = row.status === 'ready';
      return `
        <tr class="border-b border-gray-800/60">
          <td class="text-left" data-label="取引所">
            <div class="font-bold text-gray-200">${escapeHtml(row.exchangeLabel || row.exchangeId)}</div>
            <div class="text-[10px] text-gray-500">${ready ? escapeHtml(String(row.source || '-').toUpperCase()) : escapeHtml(row.message || '板データ待機中')}</div>
          </td>
          <td class="is-num text-right font-mono text-green-300" data-label="Bid">${ready ? fmtJpyPrice(row.bestBid) : '-'}</td>
          <td class="is-num text-right font-mono text-red-300" data-label="Ask">${ready ? fmtJpyPrice(row.bestAsk) : '-'}</td>
          <td class="is-num text-right font-mono text-yellow-300" data-label="Spread">${ready ? fmtPct(row.spreadPct) : '-'}</td>
          <td class="text-right font-mono text-gray-400" data-label="更新">${ready ? fmtTime(row.timestamp || row.receivedAt) : '-'}</td>
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
      insufficient_liquidity: 'text-yellow-300',
      auto_cancel: 'text-yellow-300',
      circuit_breaker: 'text-red-300',
    }[status] || 'text-gray-300';
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
    const feeRatePct = parseNumberInput($('market-fee-rate')?.value);
    if (!Number.isFinite(amount) || amount <= 0 || !Number.isFinite(feeRatePct) || feeRatePct < 0 || feeRatePct > 100) {
      setEmpty('market-comparison-tbody', 6, '比較条件を確認してください');
      return;
    }

    const params = new URLSearchParams({
      instrumentId,
      side,
      amountType,
      amount: String(amount),
      feeRate: String(feeRatePct / 100),
    });
    try {
      const res = await fetch(`/api/market-impact-comparison?${params.toString()}`, { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      renderComparison(await res.json());
    } catch (err) {
      setText('market-comparison-meta', err.message);
      setEmpty('market-comparison-tbody', 6, '比較の取得に失敗しました');
    }
  }

  function renderComparison(data) {
    const rows = Array.isArray(data && data.rows) ? data.rows : [];
    const meta = data.meta || {};
    setText('market-comparison-meta', `${marketLabel()} | ${meta.side === 'sell' ? '売り' : '買い'} | ${comparisonAmountLabel(meta)} | 有効 ${meta.readyCount || 0}件 / 待機 ${meta.waitingCount || 0}件`);
    if (rows.length === 0) {
      setEmpty('market-comparison-tbody', 6, '比較できる取引所がありません');
      return;
    }

    const isSell = meta.side === 'sell';
    const tbody = $('market-comparison-tbody');
    tbody.innerHTML = rows.map(row => {
      const result = row.result || null;
      const ready = row.status === 'ready' && result && !result.error;
      const fixedQuote = meta.amountType === 'jpy';
      const value = ready
        ? (fixedQuote ? `${Fmt.baseCompact(result.totalBTCFilled)} ${(row.baseCurrency || '').toUpperCase()}` : Fmt.jpy(result.effectiveCostJPY))
        : '-';
      const vwap = ready ? Fmt.jpy(result.effectiveVWAP) : '-';
      const statusText = ready ? (result.executionStatusLabel || '発注可能') : (row.message || '板データ待機中');
      const valueClass = ready ? (isSell ? 'text-green-300' : 'text-red-300') : 'text-gray-500';
      return `
        <tr class="border-b border-gray-800/60 ${row.rank === 1 && ready ? 'data-table__row--rank-1' : ''}">
          <td class="is-num text-right font-mono text-gray-300" data-label="順位">${row.rank ? `#${row.rank}` : '-'}</td>
          <td class="text-left" data-label="取引所">
            <div class="font-bold text-gray-200">${escapeHtml(row.exchangeLabel || row.exchangeId)}</div>
            <div class="text-[10px] text-gray-500">${escapeHtml(String(row.source || '-').toUpperCase())}</div>
          </td>
          <td class="is-num text-right font-mono ${valueClass}" data-label="結果">${value}</td>
          <td class="is-num text-right font-mono text-gray-300" data-label="VWAP">${vwap}</td>
          <td class="is-num text-right font-mono text-yellow-300" data-label="Impact">${ready ? fmtPct(result.marketImpactPct) : '-'}</td>
          <td class="${ready ? comparisonStatusClass(result.executionStatus) : 'text-gray-500'}" data-label="判定">${escapeHtml(statusText)}</td>
        </tr>
      `;
    }).join('');
  }

  function renderSummary(data) {
    summary = data;
    updatePageLabels();
    populateBoardExchangeSelect();
    renderHero();
    renderOrderbookRows();
    renderVolumeRows();
    renderSalesRows();
    connectSelectedOrderbook();
  }

  async function loadSummary() {
    try {
      const res = await fetch(`/api/markets/${encodeURIComponent(instrumentId)}`, { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      renderSummary(await res.json());
      loadComparison();
    } catch (err) {
      setText('market-status', '取得失敗');
      setText('market-hero-meta', err.message);
    }
  }

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
      if (comparisonTimer) clearTimeout(comparisonTimer);
      comparisonTimer = setTimeout(loadComparison, 250);
    });
  });

  ws.on('connected', () => {
    connectSelectedOrderbook();
  });
  ws.on('orderbook', (data) => {
    if (!data || data.instrumentId !== instrumentId || data.exchangeId !== selectedExchangeId) return;
    setText('orderbook-meta', `${data.exchange?.label || selectedExchangeId} / ${marketLabel()} / ${String(data.source || '').toUpperCase()}`);
    setChartBaseCurrency(data.market?.baseCurrency || (summary.market && summary.market.baseCurrency) || 'BTC');
    updateDepthChart(data.depthChart, data.midPrice);
  });

  initDepthChart();
  loadSummary();
  ws.connect();
  summaryTimer = setInterval(loadSummary, 30000);
  window.addEventListener('beforeunload', () => {
    if (summaryTimer) clearInterval(summaryTimer);
    if (comparisonTimer) clearTimeout(comparisonTimer);
  });
});
