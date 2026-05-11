(function () {
  'use strict';

  const root = document.querySelector('[data-exchange-page]');
  if (!root) return;

  const exchangeId = String(root.getAttribute('data-exchange-id') || '').trim();
  const instrumentId = String(root.getAttribute('data-default-instrument-id') || '').trim();

  const waitingClass = 'is-waiting';
  const staleClass = 'is-stale';
  const errorClass = 'is-error';

  function numberOrNull(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  function priceDecimals(value) {
    const abs = Math.abs(Number(value));
    if (!Number.isFinite(abs)) return 0;
    if (abs >= 1000) return 0;
    if (abs >= 100) return 1;
    if (abs >= 1) return 2;
    return 4;
  }

  function formatJpyPrice(value) {
    const numeric = numberOrNull(value);
    if (numeric == null) return '-';
    return new Intl.NumberFormat('ja-JP', {
      style: 'currency',
      currency: 'JPY',
      maximumFractionDigits: priceDecimals(numeric),
    }).format(numeric);
  }

  function formatJpyCompact(value) {
    const numeric = numberOrNull(value);
    if (numeric == null) return '-';
    const compact = new Intl.NumberFormat('ja-JP', {
      notation: 'compact',
      maximumFractionDigits: Math.abs(numeric) >= 1e8 ? 1 : 0,
    }).format(numeric);
    return `¥${compact}`;
  }

  function formatPct(value, decimals = 3) {
    const numeric = numberOrNull(value);
    if (numeric == null) return '-';
    return `${numeric.toFixed(decimals)}%`;
  }

  function formatDateTime(value) {
    const date = value ? new Date(value) : null;
    if (!date || Number.isNaN(date.getTime())) return '-';
    return new Intl.DateTimeFormat('ja-JP', {
      month: 'numeric',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, char => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    }[char]));
  }

  function setLiveField(field, text, state) {
    document.querySelectorAll(`[data-exchange-live-field="${field}"]`).forEach((node) => {
      node.textContent = text;
      node.classList.toggle(waitingClass, state === 'waiting');
      node.classList.toggle(staleClass, state === 'stale');
      node.classList.toggle(errorClass, state === 'error');
      node.setAttribute('data-state', state || 'ready');
    });
  }

  function tabForHash(hash) {
    if (!hash || hash.length < 2) return null;
    const target = document.querySelector(hash);
    return target ? target.getAttribute('data-exchange-tab-panel') : null;
  }

  function initTabs() {
    const buttons = Array.from(document.querySelectorAll('[data-exchange-tab]'));
    const panels = Array.from(document.querySelectorAll('[data-exchange-tab-panel]'));
    if (buttons.length === 0 || panels.length === 0) return;

    function activate(tab) {
      const nextTab = buttons.some(button => button.getAttribute('data-exchange-tab') === tab) ? tab : 'simple';
      buttons.forEach((button) => {
        const active = button.getAttribute('data-exchange-tab') === nextTab;
        button.classList.toggle('is-active', active);
        button.setAttribute('aria-selected', active ? 'true' : 'false');
      });
      panels.forEach((panel) => {
        panel.hidden = panel.getAttribute('data-exchange-tab-panel') !== nextTab;
      });
    }

    buttons.forEach((button) => {
      button.addEventListener('click', () => activate(button.getAttribute('data-exchange-tab')));
    });

    document.addEventListener('click', (event) => {
      const link = event.target.closest('a[href^="#"]');
      if (!link) return;
      const tab = tabForHash(link.getAttribute('href'));
      if (tab) activate(tab);
    });

    window.addEventListener('hashchange', () => {
      const tab = tabForHash(window.location.hash);
      if (tab) activate(tab);
    });

    activate(tabForHash(window.location.hash) || 'simple');
  }

  function initCoverageTool() {
    const tool = document.querySelector('[data-exchange-coverage-tool]');
    const dataNode = document.getElementById('exchange-coverage-data');
    if (!tool || !dataNode) return;

    let markets = [];
    try {
      markets = JSON.parse(dataNode.textContent || '[]');
    } catch (_err) {
      markets = [];
    }
    if (!Array.isArray(markets) || markets.length === 0) return;

    const search = tool.querySelector('[data-exchange-coverage-search]');
    const resultNode = tool.querySelector('[data-exchange-coverage-results]');
    const countNode = tool.querySelector('[data-exchange-coverage-count]');
    const showAllButton = tool.querySelector('[data-exchange-coverage-show-all]');
    const filters = Array.from(tool.querySelectorAll('[data-exchange-coverage-filter]'));
    const activeFilters = new Set();
    let query = '';
    let showAll = false;

    function marketHref(market) {
      const encodedInstrumentId = encodeURIComponent(market.instrumentId || '');
      if (market.hasBoard) {
        return `/simulator?exchange=${encodeURIComponent(exchangeId)}&market=${encodedInstrumentId}`;
      }
      return `/sales-spread?instrumentId=${encodedInstrumentId}`;
    }

    function matchesFilter(market) {
      if (activeFilters.has('board') && !market.hasBoard) return false;
      if (activeFilters.has('sales') && !market.hasSales) return false;
      if (activeFilters.has('spread') && !market.hasSpread) return false;
      return true;
    }

    function matchesQuery(market) {
      if (!query) return true;
      const haystack = `${market.label || ''} ${market.instrumentId || ''}`.toLowerCase();
      return haystack.includes(query);
    }

    function renderMarket(market) {
      const badges = [
        market.hasBoard ? '<span>板</span>' : '',
        market.hasSales ? '<span>販売所</span>' : '',
        market.hasSpread ? '<span>スプレッド</span>' : '',
      ].filter(Boolean).join('');
      return [
        `<a class="exchange-coverage-chip" href="${escapeHtml(marketHref(market))}">`,
        `  <strong>${escapeHtml(market.label || market.instrumentId)}</strong>`,
        `  <small>${escapeHtml(market.instrumentId)}</small>`,
        `  <span class="exchange-coverage-chip__badges">${badges}</span>`,
        '</a>',
      ].join('');
    }

    function render() {
      const hasSearchOrFilter = Boolean(query || activeFilters.size > 0);
      let rows = markets.filter(market => matchesQuery(market) && matchesFilter(market));
      if (!hasSearchOrFilter && !showAll) rows = rows.filter(market => market.featured);
      if (!hasSearchOrFilter && !showAll && rows.length === 0) rows = markets.slice(0, 5);

      resultNode.innerHTML = rows.length > 0
        ? rows.map(renderMarket).join('')
        : '<p class="exchange-coverage-empty">該当する銘柄はありません。</p>';

      if (countNode) {
        const mode = hasSearchOrFilter || showAll ? '条件に一致' : '主要銘柄';
        countNode.textContent = `${mode}: ${rows.length}件 / 全${markets.length}件`;
      }
      if (showAllButton) {
        showAllButton.hidden = showAll || hasSearchOrFilter;
      }
    }

    if (search) {
      search.addEventListener('input', () => {
        query = String(search.value || '').trim().toLowerCase();
        render();
      });
    }

    filters.forEach((button) => {
      button.addEventListener('click', () => {
        const key = button.getAttribute('data-exchange-coverage-filter');
        if (activeFilters.has(key)) activeFilters.delete(key);
        else activeFilters.add(key);
        const active = activeFilters.has(key);
        button.classList.toggle('is-active', active);
        button.setAttribute('aria-pressed', active ? 'true' : 'false');
        render();
      });
    });

    if (showAllButton) {
      showAllButton.addEventListener('click', () => {
        showAll = true;
        render();
      });
    }

    render();
  }

  function orderbookState(orderbook) {
    if (!orderbook || orderbook.status === 'waiting' || orderbook.status === 'unsupported') return 'waiting';
    return orderbook.status === 'stale' ? 'stale' : 'ready';
  }

  function stateSuffix(state) {
    if (state === 'stale') return '（古い板データ）';
    if (state === 'waiting') return '（データ待ち）';
    return '';
  }

  function updateOrderbookFields(report, row) {
    const marketLabel = (report.market && report.market.label) || instrumentId.replace(/-/g, '/');
    const orderbook = row && row.orderbook ? row.orderbook : null;
    const state = orderbookState(orderbook);
    const bestBid = numberOrNull(orderbook && orderbook.bestBid);
    const bestAsk = numberOrNull(orderbook && orderbook.bestAsk);
    const visibleDepth = numberOrNull(orderbook && orderbook.visibleDepthJPY);

    if (bestBid != null && bestAsk != null) {
      setLiveField('bidAsk', `${marketLabel}: Bid ${formatJpyPrice(bestBid)} / Ask ${formatJpyPrice(bestAsk)}${stateSuffix(state)}`, state);
    } else {
      setLiveField('bidAsk', `${marketLabel}: Bid / Ask は公式画面で確認してください。`, 'stale');
    }

    if (visibleDepth != null && visibleDepth > 0) {
      setLiveField('depth', `${marketLabel}: 可視板厚 ${formatJpyCompact(visibleDepth)}（Bid+Ask）${stateSuffix(state)}`, state);
    } else {
      setLiveField('depth', `${marketLabel}: 可視板厚は公式画面で確認してください。`, 'stale');
    }
  }

  function updateCostFields(report, row) {
    const marketLabel = (report.market && report.market.label) || instrumentId.replace(/-/g, '/');
    const cost = row && row.cost100k ? row.cost100k : null;
    const impact = numberOrNull(cost && cost.marketImpactPct);
    const vwap = numberOrNull(cost && cost.effectiveVWAP);
    const feeLabel = cost && cost.feeLabel ? String(cost.feeLabel) : '既定手数料';
    const statusLabel = cost && cost.executionStatusLabel ? String(cost.executionStatusLabel) : '';

    if (impact == null) {
      setLiveField('effectiveCost', `${marketLabel}: 10万円買いの実質コストは公式画面で確認してください。`, 'stale');
      setLiveField('slippage', `${marketLabel}: スリッページ傾向は公式画面で確認してください。`, 'stale');
      return;
    }

    const vwapText = vwap != null ? ` / VWAP ${formatJpyPrice(vwap)}` : '';
    const statusText = statusLabel ? ` / ${statusLabel}` : '';
    setLiveField('effectiveCost', `${marketLabel}: 10万円買い参考 Impact ${formatPct(impact)}${vwapText} / 手数料 ${feeLabel}${statusText}`, 'ready');
    setLiveField('slippage', `${marketLabel}: 10万円買いの価格影響 ${formatPct(impact)}${statusText}`, 'ready');
  }

  async function loadExchangeMarket() {
    if (!exchangeId || !instrumentId) return;

    setLiveField('dataTimestamp', 'データ取得時刻: 読み込み中', 'waiting');
    setLiveField('bidAsk', '代表銘柄のBid / Askを読み込み中', 'waiting');
    setLiveField('depth', '代表銘柄の板厚を読み込み中', 'waiting');
    setLiveField('effectiveCost', '代表銘柄の10万円買い参考値を読み込み中', 'waiting');
    setLiveField('slippage', '代表銘柄のスリッページ傾向を読み込み中', 'waiting');

    const response = await fetch(`/api/markets/${encodeURIComponent(instrumentId)}`, {
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) throw new Error(`Market API failed: ${response.status}`);

    const report = await response.json();
    setLiveField('dataTimestamp', `データ取得時刻: ${formatDateTime(report && report.meta && report.meta.generatedAt)}`, 'ready');
    const rows = report && report.domesticComparison && Array.isArray(report.domesticComparison.rows)
      ? report.domesticComparison.rows
      : [];
    const row = rows.find(item => item && item.exchangeId === exchangeId) || null;

    if (!row) {
      const marketLabel = (report.market && report.market.label) || instrumentId.replace(/-/g, '/');
      setLiveField('bidAsk', `${marketLabel}: この取引所の板データは対象外です。公式画面で確認してください。`, 'stale');
      setLiveField('depth', `${marketLabel}: この取引所の板厚データは対象外です。公式画面で確認してください。`, 'stale');
      setLiveField('effectiveCost', `${marketLabel}: この取引所の実質コストは対象外です。公式画面で確認してください。`, 'stale');
      setLiveField('slippage', `${marketLabel}: この取引所のスリッページ傾向は対象外です。公式画面で確認してください。`, 'stale');
      return;
    }

    updateOrderbookFields(report, row);
    updateCostFields(report, row);
  }

  initTabs();
  initCoverageTool();

  loadExchangeMarket().catch(() => {
    setLiveField('dataTimestamp', 'データ取得に失敗しました。公式画面で確認してください。', 'error');
    setLiveField('bidAsk', 'Bid / Ask を取得できませんでした。公式画面で確認してください。', 'error');
    setLiveField('depth', '板厚を取得できませんでした。公式画面で確認してください。', 'error');
    setLiveField('effectiveCost', '実質コストを取得できませんでした。公式画面で確認してください。', 'error');
    setLiveField('slippage', 'スリッページ傾向を取得できませんでした。公式画面で確認してください。', 'error');
  });
}());
