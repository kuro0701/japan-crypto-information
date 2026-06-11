document.addEventListener('DOMContentLoaded', () => {
  const Api = window.AppApi;
  const AppFmt = window.AppFormatters;
  const AppUtil = window.AppUtils;
  const MarketData = window.MarketDataUtils;
  const config = window.MARKET_PAGE || {};
  const instrumentId = String(config.instrumentId || '').toUpperCase();
  const THEME_STORAGE_KEY = 'okj.theme.v1';
  const AMOUNT_RANGE_MIN = 10000;
  const AMOUNT_RANGE_MAX = 1000000;
  const AMOUNT_RANGE_STEP = 10000;
  const ws = new WSClient();
  const pagePoller = window.PagePoller.create();
  let summary = null;
  let selectedExchangeId = '';
  let comparisonTimer = null;
  let summaryAbortController = null;
  let comparisonAbortController = null;
  let lastComparisonData = null;
  let volumeDonutChart = null;
  let volumeDonutRows = [];
  const SUMMARY_REFRESH_MS = 60000;
  const CELL_FLASH_MS = 900;
  const ORDERBOOK_WAITING_MESSAGE = '取引所から板データを取得中です。接続に数秒かかる場合があります。';
  const PARTIAL_DATA_FAILURE_MESSAGE = '一部の取引所APIからデータを取得できていません。取得できた取引所のみで比較しています。';
  const LOADING_MESSAGE_PATTERN = /(取得中|読み込み中|データ待ち|集計中|待機中|接続に数秒)/;
  const EXCHANGE_ACCENTS = Object.freeze({
    okj: { color: '#35c8d2' },
    coincheck: { color: '#2ed47a' },
    bitflyer: { color: '#1e88ff' },
    bitbank: { color: '#f4c95d' },
    gmo: { color: '#44b9ff' },
    binance_japan: { color: '#f0b90b' },
    bittrade: { color: '#ff5f6d' },
  });
  const EXCHANGE_SLUGS = Object.freeze({
    okj: 'okj',
    coincheck: 'coincheck',
    bitflyer: 'bitflyer',
    bitbank: 'bitbank',
    gmo: 'gmo-coin',
    binance_japan: 'binance-japan',
    bittrade: 'bittrade',
  });
  const EXCHANGE_INITIALS = Object.freeze({
    okj: 'OKJ',
    coincheck: 'CC',
    bitflyer: 'BF',
    bitbank: 'BB',
    gmo: 'GMO',
    binance_japan: 'BJ',
    bittrade: 'BT',
  });
  const DEFAULT_EXCHANGE_ACCENT = Object.freeze({ color: '#8fb0ff' });

  const $ = AppUtil.byId;
  const setText = AppUtil.setText;
  const escapeHtml = AppUtil.escapeHtml;
  const marketPageUrl = AppUtil.marketPageUrl;
  const parseNumberInput = AppUtil.parseNumberInput;
  const fmtPct = AppFmt.pct;
  const fmtDateTime = AppFmt.dateTime;
  const fmtTime = AppFmt.time;
  const fmtJpyPrice = AppFmt.jpyPrice;
  const statusRank = MarketData.statusRank;
  const liveRowStatus = MarketData.liveRowStatus;
  const ageLabel = MarketData.ageLabel;
  const updatedAtLabel = MarketData.updatedAtLabel;
  const summarizeStatuses = MarketData.summarizeStatuses;
  const freshnessBadge = MarketData.freshnessBadge;
  const normalizeExchangeId = exchangeId => String(exchangeId || '').trim().toLowerCase();
  const storageKey = suffix => `okj.market.${instrumentId || 'default'}.${suffix}.v1`;
  const MY_EXCHANGES_STORAGE_KEY = storageKey('myExchanges');
  const MY_EXCHANGES_ONLY_STORAGE_KEY = storageKey('myExchangesOnly');
  const PRETRADE_CHECKLIST_STORAGE_KEY = storageKey('pretradeChecklist');
  const readStoredExchangeSet = () => {
    try {
      const parsed = JSON.parse(localStorage.getItem(MY_EXCHANGES_STORAGE_KEY) || '[]');
      return new Set((Array.isArray(parsed) ? parsed : []).map(normalizeExchangeId).filter(Boolean));
    } catch (_) {
      return new Set();
    }
  };
  const readStoredBoolean = (key) => {
    try {
      return localStorage.getItem(key) === 'true';
    } catch (_) {
      return false;
    }
  };
  const writeStoredExchangeSet = (value) => {
    try {
      localStorage.setItem(MY_EXCHANGES_STORAGE_KEY, JSON.stringify([...value]));
    } catch (_) {
      // noop
    }
  };
  const writeStoredBoolean = (key, value) => {
    try {
      localStorage.setItem(key, value ? 'true' : 'false');
    } catch (_) {
      // noop
    }
  };
  let myExchangeIds = readStoredExchangeSet();
  let showOnlyMyExchanges = readStoredBoolean(MY_EXCHANGES_ONLY_STORAGE_KEY);
  const rowFlashUntilByExchange = new Map();
  const cellFlashUntilByKey = new Map();
  let summaryLoadedAt = 0;

  function readStoredTheme() {
    try {
      return localStorage.getItem(THEME_STORAGE_KEY) === 'light' ? 'light' : 'dark';
    } catch (_) {
      return document.documentElement.classList.contains('theme-light') ? 'light' : 'dark';
    }
  }

  function writeStoredTheme(theme) {
    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch (_) {
      // noop
    }
  }

  function syncTheme(theme) {
    const isLight = theme === 'light';
    document.documentElement.classList.toggle('theme-light', isLight);
    document.body.classList.toggle('theme-light', isLight);

    document.querySelectorAll('[data-theme-toggle]').forEach((button) => {
      const icon = button.querySelector('[data-theme-toggle-icon]');
      const label = button.querySelector('[data-theme-toggle-label]');
      button.classList.toggle('is-light', isLight);
      button.setAttribute('aria-pressed', isLight ? 'true' : 'false');
      button.setAttribute('aria-label', isLight ? 'ダークモードに切り替え' : 'ライトモードに切り替え');
      if (icon) icon.textContent = isLight ? '☾' : '☀';
      if (label) label.textContent = isLight ? 'ダーク' : 'ライト';
    });

    applyVolumeDonutTheme();
    window.dispatchEvent(new CustomEvent('okj:theme-change', { detail: { theme } }));
  }

  function initThemeToggle() {
    let currentTheme = readStoredTheme();
    syncTheme(currentTheme);
    document.addEventListener('click', (event) => {
      const button = event.target && event.target.closest ? event.target.closest('[data-theme-toggle]') : null;
      if (!button) return;
      event.preventDefault();
      currentTheme = currentTheme === 'light' ? 'dark' : 'light';
      writeStoredTheme(currentTheme);
      syncTheme(currentTheme);
    });
  }

  function switchMarketOptions() {
    const defaults = [
      { instrumentId: 'BTC-JPY', label: 'BTC/JPY' },
      { instrumentId: 'ETH-JPY', label: 'ETH/JPY' },
      { instrumentId: 'SOL-JPY', label: 'SOL/JPY' },
      { instrumentId: 'XRP-JPY', label: 'XRP/JPY' },
    ];
    const configured = Array.isArray(config.switchMarkets) && config.switchMarkets.length > 0
      ? config.switchMarkets
      : defaults;
    const options = [
      { instrumentId, label: config.label || instrumentId },
      ...configured,
    ];
    const seen = new Set();
    return options
      .map(option => ({
        instrumentId: String(option.instrumentId || '').toUpperCase(),
        label: option.label || option.instrumentId,
      }))
      .filter((option) => {
        if (!option.instrumentId || seen.has(option.instrumentId)) return false;
        seen.add(option.instrumentId);
        return true;
      });
  }

  function initPairSwitcher() {
    const select = $('market-pair-switcher');
    if (!select) return;
    const options = switchMarketOptions();
    select.innerHTML = options.map(option => `
      <option value="${escapeHtml(option.instrumentId)}">${escapeHtml(option.label || option.instrumentId)}</option>
    `).join('');
    select.value = instrumentId;
    select.addEventListener('change', () => {
      if (!select.value || select.value === instrumentId) return;
      window.location.href = marketPageUrl(select.value);
    });

    const existingTabs = document.querySelector('[data-market-pair-tabs]');
    const tabHost = existingTabs || document.createElement('div');
    tabHost.className = 'market-pair-tabs';
    tabHost.dataset.marketPairTabs = 'true';
    tabHost.setAttribute('aria-label', '通貨ペア切り替え');
    tabHost.innerHTML = options.map(option => {
      const active = option.instrumentId === instrumentId;
      return `<a class="${active ? 'is-active' : ''}" href="${escapeHtml(marketPageUrl(option.instrumentId))}" ${active ? 'aria-current="page"' : ''}>${escapeHtml(option.label || option.instrumentId)}</a>`;
    }).join('');
    if (!existingTabs) select.closest('.market-pair-switcher')?.after(tabHost);
  }

  function beginnerModeEnabled() {
    return Boolean(window.BeginnerMode && window.BeginnerMode.isEnabled && window.BeginnerMode.isEnabled());
  }

  function termText(expert, beginner) {
    return beginnerModeEnabled() ? beginner : expert;
  }

  function isMyExchange(exchangeId) {
    return myExchangeIds.has(normalizeExchangeId(exchangeId));
  }

  function exchangeAccent(exchangeId) {
    return EXCHANGE_ACCENTS[normalizeExchangeId(exchangeId)] || DEFAULT_EXCHANGE_ACCENT;
  }

  function exchangeInitials(exchangeId, label) {
    const id = normalizeExchangeId(exchangeId);
    if (EXCHANGE_INITIALS[id]) return EXCHANGE_INITIALS[id];
    const words = String(label || exchangeId || '')
      .replace(/[^A-Za-z0-9\s]/g, ' ')
      .trim()
      .split(/\s+/)
      .filter(Boolean);
    if (words.length >= 2) return words.slice(0, 2).map(word => word[0]).join('').toUpperCase();
    return String(words[0] || id || '?').slice(0, 3).toUpperCase();
  }

  function fallbackExchangeDetailPath(exchangeId) {
    const id = normalizeExchangeId(exchangeId);
    return `/exchanges/${encodeURIComponent(EXCHANGE_SLUGS[id] || id || exchangeId || '')}`;
  }

  function findExchangeActionSource(exchangeId) {
    const id = normalizeExchangeId(exchangeId);
    const exchanges = (summary && Array.isArray(summary.exchanges)) ? summary.exchanges : [];
    const exchange = exchanges.find(item => normalizeExchangeId(item.id) === id);
    if (exchange && exchange.actions) return exchange.actions;
    const domesticRows = summary && summary.domesticComparison && Array.isArray(summary.domesticComparison.rows)
      ? summary.domesticComparison.rows
      : [];
    const domesticRow = domesticRows.find(item => normalizeExchangeId(item.exchangeId) === id);
    if (domesticRow && domesticRow.actions) return domesticRow.actions;
    const supported = supportedExchanges().find(item => normalizeExchangeId(item.id) === id);
    return (supported && supported.actions) || null;
  }

  function exchangeActionMeta(exchangeId) {
    const id = normalizeExchangeId(exchangeId);
    const actions = findExchangeActionSource(id) || {};
    const detailPath = actions.detailPath || fallbackExchangeDetailPath(id);
    const officialUrl = actions.officialUrl || '';
    const signupUrl = actions.signupUrl || officialUrl || '';
    return {
      detailPath,
      officialUrl,
      signupUrl,
      primaryHref: signupUrl || officialUrl || detailPath,
    };
  }

  function isExternalHref(href) {
    return /^https?:\/\//i.test(String(href || ''));
  }

  function actionLinkAttrs(href) {
    const safeHref = escapeHtml(href || '#');
    if (!isExternalHref(href)) return `href="${safeHref}"`;
    return `href="${safeHref}" target="_blank" rel="noopener noreferrer"`;
  }

  function exchangeActionHtml(exchangeId, label) {
    const actions = exchangeActionMeta(exchangeId);
    const safeLabel = label || exchangeId || '取引所';
    const primaryLabel = isExternalHref(actions.primaryHref)
      ? `${safeLabel}で取引する`
      : `${safeLabel}の詳細`;
    return `
      <div class="market-row-actions">
        <a class="market-row-action market-row-action--secondary" ${actionLinkAttrs(actions.detailPath)}>詳細</a>
        <a class="market-row-action market-row-action--primary" ${actionLinkAttrs(actions.primaryHref)}>${escapeHtml(primaryLabel)}</a>
      </div>
    `;
  }

  function shouldShowExchange(exchangeId) {
    return !showOnlyMyExchanges || myExchangeIds.size === 0 || isMyExchange(exchangeId);
  }

  function orderRowsForMyExchanges(rows) {
    return (rows || [])
      .filter(row => shouldShowExchange(row.exchangeId))
      .map((row, index) => ({ row, index }))
      .sort((a, b) => {
        const mineDiff = Number(isMyExchange(b.row.exchangeId)) - Number(isMyExchange(a.row.exchangeId));
        return mineDiff || a.index - b.index;
      })
      .map(item => item.row);
  }

  function liveFlashClass(exchangeId) {
    const id = normalizeExchangeId(exchangeId);
    const until = rowFlashUntilByExchange.get(id);
    if (!until) return '';
    if (Date.now() > until) {
      rowFlashUntilByExchange.delete(id);
      return '';
    }
    return 'data-table__row--live-flash';
  }

  function markExchangeUpdated(exchangeId) {
    const id = normalizeExchangeId(exchangeId);
    if (id) rowFlashUntilByExchange.set(id, Date.now() + 900);
  }

  function cellFlashKey(exchangeId, field) {
    return `${normalizeExchangeId(exchangeId)}:${field}`;
  }

  function cellFlashClass(exchangeId, field) {
    const key = cellFlashKey(exchangeId, field);
    const state = cellFlashUntilByKey.get(key);
    if (!state) return '';
    if (Date.now() > state.until) {
      cellFlashUntilByKey.delete(key);
      return '';
    }
    return `market-cell-flash market-cell-flash--${state.direction}`;
  }

  function markCellChanged(exchangeId, field, previousValue, nextValue, options = {}) {
    const id = normalizeExchangeId(exchangeId);
    const previous = finiteNumber(previousValue);
    const next = finiteNumber(nextValue);
    if (!id || previous == null || next == null || Math.abs(previous - next) <= 1e-9) return;
    const rose = next > previous;
    const direction = options.inverse ? (rose ? 'down' : 'up') : (rose ? 'up' : 'down');
    cellFlashUntilByKey.set(cellFlashKey(id, field), {
      direction,
      until: Date.now() + CELL_FLASH_MS,
    });
  }

  function visibleDepthFromOrderbook(orderbook) {
    if (!orderbook) return null;
    const explicit = finiteNumber(orderbook.visibleDepthJPY);
    if (explicit != null) return explicit;
    const bid = finiteNumber(orderbook.totalBidDepthJPY) || 0;
    const ask = finiteNumber(orderbook.totalAskDepthJPY) || 0;
    return bid + ask;
  }

  function markOrderbookCellChanges(exchangeId, previousOrderbook, nextOrderbook) {
    if (!previousOrderbook || !nextOrderbook) return;
    markCellChanged(exchangeId, 'bestBid', previousOrderbook.bestBid, nextOrderbook.bestBid);
    markCellChanged(exchangeId, 'bestAsk', previousOrderbook.bestAsk, nextOrderbook.bestAsk);
    markCellChanged(exchangeId, 'spreadPct', previousOrderbook.spreadPct, nextOrderbook.spreadPct, { inverse: true });
    markCellChanged(exchangeId, 'visibleDepthJPY', visibleDepthFromOrderbook(previousOrderbook), visibleDepthFromOrderbook(nextOrderbook));
  }

  function exchangeIdentityHtml(exchangeId, label, subtext = '') {
    const id = normalizeExchangeId(exchangeId);
    const accent = exchangeAccent(id);
    const isPinned = isMyExchange(id);
    const safeColor = escapeHtml(accent.color);
    const safeLabel = escapeHtml(label || exchangeId || '-');
    return `
      <div class="exchange-identity" style="--exchange-accent:${safeColor}">
        <span class="exchange-identity__logo" aria-hidden="true">${escapeHtml(exchangeInitials(id, label))}</span>
        <span class="exchange-identity__copy">
          <span class="exchange-identity__name">${safeLabel}</span>
          ${subtext ? `<span class="exchange-identity__meta">${escapeHtml(subtext)}</span>` : ''}
        </span>
        <button class="exchange-identity__pin ${isPinned ? 'is-active' : ''}" type="button" data-market-star-exchange="${escapeHtml(id)}" aria-pressed="${isPinned ? 'true' : 'false'}" aria-label="${safeLabel}${isPinned ? 'の固定を解除' : 'を上に固定'}"><span class="exchange-identity__pin-icon" aria-hidden="true"></span></button>
      </div>
    `;
  }

  function winnerBadge(label, tone = 'gold') {
    return `<span class="market-winner-badge market-winner-badge--${escapeHtml(tone)}">${escapeHtml(label)}</span>`;
  }

  function finiteNumber(value) {
    const num = Number(value);
    return Number.isFinite(num) ? num : null;
  }

  function bestIds(rows, valueSelector, direction = 'min') {
    const values = (rows || [])
      .map(row => ({ row, value: finiteNumber(valueSelector(row)) }))
      .filter(item => item.value != null);
    if (values.length === 0) return new Set();
    const target = direction === 'max'
      ? Math.max(...values.map(item => item.value))
      : Math.min(...values.map(item => item.value));
    return new Set(values
      .filter(item => item.value === target)
      .map(item => normalizeExchangeId(item.row.exchangeId)));
  }

  function spreadTone(value, min, max) {
    const spread = finiteNumber(value);
    if (spread == null) return 'neutral';
    if (spread <= 2) return 'low';
    if (spread <= 5) return 'medium';
    return 'high';
  }

  function spreadCostHtml(value, options = {}) {
    const spread = finiteNumber(value);
    const tone = spreadTone(spread, options.min, options.max);
    const label = tone === 'low' ? '安全' : (tone === 'high' ? '警戒' : '注意');
    const best = options.best ? winnerBadge('最狭', 'green') : '';
    const score = spread == null
      ? 0
      : Math.max(0, Math.min(100, (spread / 8) * 100));
    return `
      <div class="spread-cost-cell spread-cost-cell--${tone}" style="--spread-score:${score}%">
        <span class="spread-cost-cell__rate">${spread == null ? '-' : fmtPct(spread)}</span>
        <span class="spread-cost-cell__meter" aria-hidden="true"><span></span></span>
        <span class="spread-cost-cell__label">${label}</span>
        ${best}
      </div>
    `;
  }

  function depthPct(value, maxValue) {
    const depth = finiteNumber(value);
    const max = finiteNumber(maxValue);
    if (depth == null || max == null || max <= 0) return '0%';
    return `${Math.max(6, Math.min(100, Math.round((depth / max) * 100)))}%`;
  }

  function depthPriceHtml(exchangeId, field, price, side, depth, maxDepth, label) {
    const termKey = side === 'ask' ? 'ask' : 'bid';
    return `
      <div class="market-depth-value market-depth-value--${escapeHtml(side)} ${cellFlashClass(exchangeId, field)}" style="--depth-pct:${depthPct(depth, maxDepth)}" title="${escapeHtml(`${label} depth ${Fmt.jpyLarge(depth)}`)}">
        <span class="market-depth-value__label market-term" data-term-key="${termKey}" tabindex="0">${escapeHtml(label)}</span>
        <span>${fmtJpyPrice(price)}</span>
      </div>
    `;
  }

  function depthMiniChartHtml(orderbook) {
    const bid = finiteNumber(orderbook && orderbook.totalBidDepthJPY);
    const ask = finiteNumber(orderbook && orderbook.totalAskDepthJPY);
    const total = (bid || 0) + (ask || 0);
    if (!bid && !ask) return '';
    const bidPct = total > 0 ? Math.max(3, Math.round((bid / total) * 100)) : 0;
    const askPct = total > 0 ? Math.max(3, Math.round((ask / total) * 100)) : 0;
    return `
      <div class="market-depth-mini" aria-label="板厚比率 Bid ${Fmt.jpyLarge(bid)} Ask ${Fmt.jpyLarge(ask)}">
        <span class="market-depth-mini__side market-depth-mini__side--bid" style="--depth-width:${bidPct}%"></span>
        <span class="market-depth-mini__axis" aria-hidden="true"></span>
        <span class="market-depth-mini__side market-depth-mini__side--ask" style="--depth-width:${askPct}%"></span>
      </div>
    `;
  }

  function shareBarHtml(value) {
    const pct = Math.max(0, Math.min(100, finiteNumber(value) || 0));
    return `
      <div class="market-share-cell" style="--share-width:${pct}%">
        <span class="market-share-cell__value">${fmtPct(value)}</span>
        <span class="market-share-cell__track" aria-hidden="true"><span></span></span>
      </div>
    `;
  }

  function isLoadingMessage(message) {
    return LOADING_MESSAGE_PATTERN.test(String(message || ''));
  }

  function skeletonStackHtml(label = 'データを取得中') {
    return `
      <div class="market-skeleton-stack" aria-label="${escapeHtml(label)}">
        <span></span>
        <span></span>
        <span></span>
      </div>
    `;
  }

  function waitingCellHtml(label = 'データを取得中') {
    return `
      <div class="market-skeleton-cell" aria-label="${escapeHtml(label)}">
        <span></span>
        <span></span>
      </div>
    `;
  }

  function freshnessBadgeHtml(status, row = null) {
    if (status !== 'stale') return freshnessBadge(status);
    const age = row ? ageLabel(row) : '古い';
    return `
      <button class="market-stale-refresh" type="button" data-market-refresh aria-label="データを再読み込み">
        <span aria-hidden="true">!</span>
        <span>${escapeHtml(age)}のデータ</span>
        <small>タップで再読み込み</small>
      </button>
    `;
  }

  function chartCssVar(name, fallback) {
    return AppUtil.cssVar ? AppUtil.cssVar(name, fallback) : fallback;
  }

  function applyVolumeDonutTheme() {
    if (!volumeDonutChart) return;
    const textColor = chartCssVar('--text-2', '#c9d3cd');
    const mutedColor = chartCssVar('--text-4', '#6f7b76');
    const surfaceColor = document.documentElement.classList.contains('theme-light')
      ? 'rgba(255, 255, 255, 0.96)'
      : 'rgba(8, 11, 12, 0.94)';
    volumeDonutChart.options.plugins.tooltip.backgroundColor = surfaceColor;
    volumeDonutChart.options.plugins.tooltip.titleColor = textColor;
    volumeDonutChart.options.plugins.tooltip.bodyColor = mutedColor;
    volumeDonutChart.update('none');
  }

  function initVolumeDonutChart() {
    const canvas = $('market-volume-donut-chart');
    if (!canvas || volumeDonutChart || typeof Chart === 'undefined') return;
    volumeDonutChart = new Chart(canvas, {
      type: 'doughnut',
      data: {
        labels: [],
        datasets: [{
          data: [],
          backgroundColor: [],
          borderColor: document.documentElement.classList.contains('theme-light') ? '#ffffff' : '#0d1214',
          borderWidth: 2,
          hoverOffset: 8,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '66%',
        animation: { duration: 420, easing: 'easeOutQuart' },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: 'rgba(8, 11, 12, 0.94)',
            borderColor: 'rgba(200, 220, 210, 0.18)',
            borderWidth: 1,
            displayColors: true,
            callbacks: {
              label: (ctx) => {
                const row = volumeDonutRows[ctx.dataIndex] || {};
                return `${row.exchangeLabel || ctx.label}: ${Fmt.jpyLarge(row.quoteVolume)} / ${fmtPct(row.instrumentSharePct)}`;
              },
            },
          },
        },
      },
    });
    applyVolumeDonutTheme();
  }

  function renderVolumeDonutLegend(rows) {
    const host = $('market-volume-donut-legend');
    if (!host) return;
    if (!rows.length) {
      host.textContent = '出来高データを取得中';
      return;
    }
    host.innerHTML = rows.slice(0, 5).map((row, index) => {
      const accent = exchangeAccent(row.exchangeId);
      return `
        <div class="market-volume-legend-row" style="--exchange-accent:${escapeHtml(accent.color)}">
          <span class="market-volume-legend-row__rank">${index + 1}</span>
          <span class="market-volume-legend-row__name">${escapeHtml(row.exchangeLabel || row.exchangeId)}</span>
          <span class="market-volume-legend-row__value">${fmtPct(row.instrumentSharePct)}</span>
        </div>
      `;
    }).join('');
  }

  function updateVolumeDonutChart(rows) {
    const usableRows = (rows || [])
      .filter(row => Number.isFinite(Number(row.quoteVolume)) && Number(row.quoteVolume) > 0)
      .sort((a, b) => Number(b.quoteVolume || 0) - Number(a.quoteVolume || 0))
      .slice(0, 8);
    volumeDonutRows = usableRows;
    renderVolumeDonutLegend(usableRows);
    initVolumeDonutChart();
    if (!volumeDonutChart) {
      updateVolumeCssDonut(usableRows);
      return;
    }
    updateVolumeCssDonut([]);
    const dataset = volumeDonutChart.data.datasets[0];
    volumeDonutChart.data.labels = usableRows.map(row => row.exchangeLabel || row.exchangeId || '-');
    dataset.data = usableRows.map(row => Number(row.quoteVolume));
    dataset.backgroundColor = usableRows.map(row => exchangeAccent(row.exchangeId).color);
    dataset.borderColor = document.documentElement.classList.contains('theme-light') ? '#ffffff' : '#0d1214';
    volumeDonutChart.update('none');
  }

  function updateVolumeCssDonut(rows) {
    const donut = $('market-volume-css-donut');
    const label = $('market-volume-css-donut-label');
    const canvas = $('market-volume-donut-chart');
    if (!donut) return;
    const hasRows = Array.isArray(rows) && rows.length > 0;
    donut.hidden = !hasRows;
    if (canvas) canvas.hidden = hasRows;
    if (!hasRows) return;

    const total = rows.reduce((sum, row) => sum + Number(row.quoteVolume || 0), 0);
    let cursor = 0;
    const stops = rows.map((row) => {
      const share = total > 0 ? (Number(row.quoteVolume || 0) / total) * 100 : 0;
      const start = cursor;
      cursor += share;
      return `${exchangeAccent(row.exchangeId).color} ${start.toFixed(2)}% ${cursor.toFixed(2)}%`;
    });
    donut.style.background = `conic-gradient(${stops.join(', ')})`;
    donut.title = rows
      .map(row => `${row.exchangeLabel || row.exchangeId}: ${Fmt.jpyLarge(row.quoteVolume)} / ${fmtPct(row.instrumentSharePct)}`)
      .join('\n');
    if (label) {
      const top = rows[0];
      label.textContent = top ? `${fmtPct(top.instrumentSharePct)}` : 'Share';
    }
  }

  function activeQuickAmount() {
    const amountType = $('market-amount-type')?.value === 'base' ? 'base' : 'jpy';
    if (amountType !== 'jpy') return null;
    return parseNumberInput($('market-amount')?.value);
  }

  function clampRangeAmount(value) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return AMOUNT_RANGE_MIN;
    const stepped = Math.round(parsed / AMOUNT_RANGE_STEP) * AMOUNT_RANGE_STEP;
    return Math.max(AMOUNT_RANGE_MIN, Math.min(AMOUNT_RANGE_MAX, stepped));
  }

  function amountRangeLabel(value) {
    const amount = Number(value);
    if (!Number.isFinite(amount)) return '-';
    if (amount >= 10000) return `${Fmt.num(amount / 10000, amount % 10000 === 0 ? 0 : 1)}万円`;
    return Fmt.jpy(amount);
  }

  function syncAmountRange() {
    const slider = $('market-amount-range');
    const label = $('market-amount-range-label');
    const bubble = $('market-amount-range-bubble');
    const shell = $('market-amount-slider');
    if (!slider) return;
    const amountType = $('market-amount-type')?.value === 'base' ? 'base' : 'jpy';
    const isJpy = amountType === 'jpy';
    const active = activeQuickAmount();
    const value = clampRangeAmount(active == null ? Number(slider.value) : active);
    slider.disabled = !isJpy;
    slider.value = String(value);
    const pct = ((value - AMOUNT_RANGE_MIN) / (AMOUNT_RANGE_MAX - AMOUNT_RANGE_MIN)) * 100;
    const clampedPct = `${Math.max(0, Math.min(100, pct))}%`;
    slider.style.setProperty('--range-pct', clampedPct);
    if (shell) {
      shell.style.setProperty('--range-pct', clampedPct);
      shell.classList.toggle('is-disabled', !isJpy);
    }
    const text = isJpy ? amountRangeLabel(value) : '数量入力中';
    [label, bubble].forEach((node) => {
      if (!node) return;
      if (node.textContent !== text) {
        node.textContent = text;
        node.classList.remove('market-number-tick');
        void node.offsetWidth;
        node.classList.add('market-number-tick');
      }
    });
  }

  function syncQuickAmountButtons() {
    const active = activeQuickAmount();
    document.querySelectorAll('[data-market-quick-amount]').forEach((button) => {
      const value = Number(button.dataset.marketQuickAmount);
      button.classList.toggle('is-active', active != null && value === active);
    });
    syncAmountRange();
    syncAmountTypeToggle();
  }

  function setQuickAmount(value) {
    const amountType = $('market-amount-type');
    const amount = $('market-amount');
    if (amountType) amountType.value = 'jpy';
    if (amount) amount.value = String(value);
    syncQuickAmountButtons();
    if (comparisonTimer) clearTimeout(comparisonTimer);
    comparisonTimer = setTimeout(loadComparison, 80);
  }

  function setAmountFromRange(value) {
    const amountType = $('market-amount-type');
    const amount = $('market-amount');
    const nextValue = clampRangeAmount(value);
    if (amountType) amountType.value = 'jpy';
    if (amount) amount.value = String(nextValue);
    syncQuickAmountButtons();
    if (comparisonTimer) clearTimeout(comparisonTimer);
    comparisonTimer = setTimeout(loadComparison, 80);
  }

  function amountTypeValue() {
    return $('market-amount-type')?.value === 'base' ? 'base' : 'jpy';
  }

  function syncAmountTypeToggle() {
    const toggle = document.querySelector('.market-amount-type-toggle');
    if (!toggle) return;
    const value = amountTypeValue();
    toggle.dataset.state = value;
    toggle.querySelectorAll('[data-market-amount-type-toggle]').forEach((button) => {
      const active = button.dataset.marketAmountTypeToggle === value;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
  }

  function initAmountTypeToggle() {
    const select = $('market-amount-type');
    const toggle = document.querySelector('.market-amount-type-toggle');
    if (!select || !toggle) return;
    toggle.addEventListener('click', (event) => {
      const button = event.target && event.target.closest ? event.target.closest('[data-market-amount-type-toggle]') : null;
      if (!button) return;
      const value = button.dataset.marketAmountTypeToggle === 'base' ? 'base' : 'jpy';
      if (select.value === value) return;
      select.value = value;
      select.dispatchEvent(new Event('change', { bubbles: true }));
    });
    syncAmountTypeToggle();
  }

  function tableRowPositionMap() {
    const positions = new Map();
    [
      'market-domestic-comparison-tbody',
      'market-orderbook-tbody',
      'market-volume-tbody',
      'market-sales-tbody',
      'market-comparison-tbody',
    ].forEach((tbodyId) => {
      const tbody = $(tbodyId);
      if (!tbody) return;
      tbody.querySelectorAll('tr[data-exchange-id]').forEach((row) => {
        const id = row.getAttribute('data-exchange-id');
        if (!id) return;
        positions.set(`${tbodyId}:${id}`, row.getBoundingClientRect());
      });
    });
    return positions;
  }

  function animateTableReorder(renderFn) {
    const before = tableRowPositionMap();
    renderFn();
    window.requestAnimationFrame(() => {
      [
        'market-domestic-comparison-tbody',
        'market-orderbook-tbody',
        'market-volume-tbody',
        'market-sales-tbody',
        'market-comparison-tbody',
      ].forEach((tbodyId) => {
        const tbody = $(tbodyId);
        if (!tbody) return;
        tbody.querySelectorAll('tr[data-exchange-id]').forEach((row) => {
          const id = row.getAttribute('data-exchange-id');
          const first = before.get(`${tbodyId}:${id}`);
          if (!first) return;
          const last = row.getBoundingClientRect();
          const dx = first.left - last.left;
          const dy = first.top - last.top;
          if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) return;
          row.animate([
            { transform: `translate(${dx}px, ${dy}px)`, opacity: 0.88 },
            { transform: 'translate(0, 0)', opacity: 1 },
          ], {
            duration: 360,
            easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
          });
        });
      });
    });
  }

  function initSectionNavigation() {
    const links = Array.from(document.querySelectorAll('[data-market-section-target]'))
      .filter(link => link.hash);
    if (links.length === 0) return;
    const ids = [...new Set(links.map(link => decodeURIComponent(link.hash.slice(1))).filter(Boolean))];
    const sections = ids
      .map(id => document.getElementById(id))
      .filter(Boolean);
    if (sections.length === 0) return;

    const setActive = (id) => {
      links.forEach((link) => {
        const active = decodeURIComponent(link.hash.slice(1)) === id;
        link.classList.toggle('is-active', active);
        if (active) link.setAttribute('aria-current', 'true');
        else link.removeAttribute('aria-current');
      });
      document.querySelectorAll('.market-section-nav__track').forEach((track) => {
        const trackLinks = Array.from(track.querySelectorAll('[data-market-section-target]'));
        const index = Math.max(0, trackLinks.findIndex(link => decodeURIComponent(link.hash.slice(1)) === id));
        track.style.setProperty('--active-index', String(index));
      });
    };

    let ticking = false;
    const update = () => {
      ticking = false;
      const offset = window.innerWidth < 768 ? 108 : 118;
      let activeId = sections[0].id;
      sections.forEach((section) => {
        const rect = section.getBoundingClientRect();
        if (rect.top - offset <= 0) activeId = section.id;
      });
      setActive(activeId);
    };

    const schedule = () => {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(update);
    };

    links.forEach((link) => {
      link.addEventListener('click', () => {
        const id = decodeURIComponent(link.hash.slice(1));
        if (id) setActive(id);
      });
    });
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    update();
  }

  function syncReadmoreSection(section, expanded) {
    const button = section.querySelector('[data-market-readmore-toggle]');
    const label = button && button.querySelector('[data-readmore-label]');
    section.classList.toggle('is-expanded', expanded);
    if (button) button.setAttribute('aria-expanded', expanded ? 'true' : 'false');
    if (label) label.textContent = expanded ? '閉じる' : 'もっと見る';
  }

  function initReadmoreSections() {
    document.querySelectorAll('[data-market-readmore]').forEach((section) => {
      const button = section.querySelector('[data-market-readmore-toggle]');
      const body = section.querySelector('.market-readmore__body');
      if (!button || !body) return;
      syncReadmoreSection(section, section.classList.contains('is-expanded'));
      button.addEventListener('click', () => {
        syncReadmoreSection(section, !section.classList.contains('is-expanded'));
      });
    });
  }

  function syncBeginnerCollapsibleSection(section, collapsed) {
    const button = section.querySelector('[data-market-collapse-toggle]');
    const label = button && button.querySelector('[data-collapse-label]');
    section.classList.toggle('is-collapsed', collapsed);
    if (button) button.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
    if (label) label.textContent = collapsed ? '詳しく見る' : '折りたたむ';
  }

  function syncBeginnerCollapses() {
    document.querySelectorAll('[data-beginner-collapse]').forEach((section) => {
      const shouldCollapse = beginnerModeEnabled() && section.dataset.userExpanded !== 'true';
      syncBeginnerCollapsibleSection(section, shouldCollapse);
    });
  }

  function initBeginnerCollapses() {
    document.querySelectorAll('[data-beginner-collapse]').forEach((section) => {
      const button = section.querySelector('[data-market-collapse-toggle]');
      if (!button) return;
      button.addEventListener('click', () => {
        const willCollapse = !section.classList.contains('is-collapsed');
        section.dataset.userExpanded = willCollapse ? 'false' : 'true';
        syncBeginnerCollapsibleSection(section, willCollapse);
      });
    });
    syncBeginnerCollapses();
  }

  function readPretradeChecklistState() {
    try {
      const parsed = JSON.parse(localStorage.getItem(PRETRADE_CHECKLIST_STORAGE_KEY) || '[]');
      return new Set((Array.isArray(parsed) ? parsed : []).map(value => String(value)));
    } catch (_) {
      return new Set();
    }
  }

  function writePretradeChecklistState(checked) {
    try {
      localStorage.setItem(PRETRADE_CHECKLIST_STORAGE_KEY, JSON.stringify([...checked]));
    } catch (_) {
      // noop
    }
  }

  function bestPretradeExchange() {
    const snapshotBest = summary && summary.snapshot && summary.snapshot.cheapestBuy
      ? summary.snapshot.cheapestBuy
      : null;
    if (snapshotBest) return snapshotBest;
    const rows = summary && summary.domesticComparison && Array.isArray(summary.domesticComparison.rows)
      ? summary.domesticComparison.rows
      : [];
    return rows
      .filter(row => row && row.cost100k && row.cost100k.status === 'fresh' && Number.isFinite(Number(row.cost100k.rank)))
      .sort((a, b) => Number(a.cost100k.rank) - Number(b.cost100k.rank))[0] || null;
  }

  function isPretradeChecklistComplete() {
    const list = document.querySelector('[data-market-pretrade-checklist]');
    if (!list) return false;
    const checked = readPretradeChecklistState();
    const buttons = Array.from(list.querySelectorAll('[data-pretrade-check]'));
    return buttons.length > 0 && buttons.every(button => checked.has(String(button.dataset.pretradeCheck)));
  }

  function updatePretradeCta(enabled = false) {
    const cta = $('market-pretrade-primary-cta');
    if (!cta) return;
    const best = bestPretradeExchange();
    const label = best && (best.exchangeLabel || best.exchangeId) ? (best.exchangeLabel || best.exchangeId) : '最安候補';
    const actions = best ? exchangeActionMeta(best.exchangeId) : { primaryHref: '#market-exchange-comparison' };
    const href = actions.primaryHref || '#market-exchange-comparison';
    cta.textContent = isExternalHref(href) ? `${label}で取引する` : `${label}の詳細を見る`;
    cta.href = href;
    if (isExternalHref(href)) {
      cta.target = '_blank';
      cta.rel = 'noopener noreferrer';
    } else {
      cta.removeAttribute('target');
      cta.removeAttribute('rel');
    }
    cta.classList.toggle('is-disabled', !enabled);
    cta.setAttribute('aria-disabled', enabled ? 'false' : 'true');
  }

  function syncPretradeChecklist(list, options = {}) {
    if (!list) return;
    const checked = readPretradeChecklistState();
    const buttons = Array.from(list.querySelectorAll('[data-pretrade-check]'));
    buttons.forEach((button) => {
      const active = checked.has(String(button.dataset.pretradeCheck));
      button.classList.toggle('is-checked', active);
      button.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
    const allDone = buttons.length > 0 && buttons.every(button => checked.has(String(button.dataset.pretradeCheck)));
    const ready = document.querySelector('[data-pretrade-ready]');
    if (ready) {
      ready.hidden = !allDone;
      ready.classList.toggle('is-celebrating', allDone && options.celebrate);
      if (allDone && options.celebrate) {
        window.setTimeout(() => ready.classList.remove('is-celebrating'), 900);
      }
    }
    updatePretradeCta(allDone);
  }

  function initPretradeChecklist() {
    const list = document.querySelector('[data-market-pretrade-checklist]');
    if (!list) return;
    syncPretradeChecklist(list);
    list.addEventListener('click', (event) => {
      const button = event.target && event.target.closest ? event.target.closest('[data-pretrade-check]') : null;
      if (!button) return;
      const checked = readPretradeChecklistState();
      const id = String(button.dataset.pretradeCheck);
      const wasComplete = Array.from(list.querySelectorAll('[data-pretrade-check]'))
        .every(item => checked.has(String(item.dataset.pretradeCheck)));
      if (checked.has(id)) checked.delete(id);
      else checked.add(id);
      writePretradeChecklistState(checked);
      const nowComplete = Array.from(list.querySelectorAll('[data-pretrade-check]'))
        .every(item => checked.has(String(item.dataset.pretradeCheck)));
      syncPretradeChecklist(list, { celebrate: !wasComplete && nowComplete });
    });
  }

  function renderExchangePreferences() {
    const host = $('market-exchange-preferences');
    if (!host) return;
    const exchanges = supportedExchanges();
    if (exchanges.length === 0) {
      host.hidden = true;
      renderFloatingMyExchanges([]);
      return;
    }
    host.hidden = false;
    const selectedCount = exchanges.filter(exchange => isMyExchange(exchange.id)).length;
    const onlyDisabled = selectedCount === 0;
    if (onlyDisabled && showOnlyMyExchanges) {
      showOnlyMyExchanges = false;
      writeStoredBoolean(MY_EXCHANGES_ONLY_STORAGE_KEY, false);
    }
    const pinned = exchanges.filter(exchange => isMyExchange(exchange.id));
    host.innerHTML = `
      <div class="market-exchange-preferences__header">
        <div>
          <p class="market-exchange-preferences__eyebrow">My Exchanges</p>
          <strong>ピン留めした取引所を上に固定</strong>
          <span>${selectedCount > 0 ? `${selectedCount}社を固定中` : '取引所名横のピンで固定できます'}</span>
        </div>
        <div class="market-exchange-preferences__actions">
          <button class="market-preference-button ${showOnlyMyExchanges ? 'is-active' : ''}" type="button" data-market-my-only ${onlyDisabled ? 'disabled' : ''}>選択だけ表示</button>
          <button class="market-preference-button" type="button" data-market-my-clear ${onlyDisabled ? 'disabled' : ''}>クリア</button>
        </div>
      </div>
      <div class="market-pinned-strip" aria-live="polite">
        ${pinned.length > 0
          ? pinned.map(exchange => `<span class="market-pinned-strip__item">${escapeHtml(exchange.label || exchange.id)}</span>`).join('')
          : '<span class="market-pinned-strip__empty">未固定</span>'}
      </div>
    `;
    renderFloatingMyExchanges(pinned);
  }

  function renderFloatingMyExchanges(pinnedExchanges = null) {
    const host = $('market-floating-my-exchanges');
    if (!host) return;
    const exchanges = Array.isArray(pinnedExchanges)
      ? pinnedExchanges
      : supportedExchanges().filter(exchange => isMyExchange(exchange.id));
    if (exchanges.length === 0) {
      host.hidden = true;
      host.innerHTML = '';
      return;
    }
    const domesticRows = summary && summary.domesticComparison && Array.isArray(summary.domesticComparison.rows)
      ? summary.domesticComparison.rows
      : [];
    host.hidden = false;
    host.innerHTML = `
      <span class="market-floating-my-exchanges__label">My Exchanges</span>
      <div class="market-floating-my-exchanges__items">
        ${exchanges.map((exchange) => {
          const row = domesticRows.find(item => normalizeExchangeId(item.exchangeId) === normalizeExchangeId(exchange.id));
          const cost = row && row.cost100k;
          const sales = row && row.salesSpread;
          const primary = cost && cost.status === 'fresh' && Number.isFinite(Number(cost.rank))
            ? `#${cost.rank} ${fmtJpyPrice(cost.effectiveVWAP)}`
            : (sales && sales.status === 'ready' && Number.isFinite(Number(sales.spreadPct)) ? `Spread ${fmtPct(sales.spreadPct)}` : '比較中');
          return `<span class="market-floating-my-exchanges__item" style="--exchange-accent:${escapeHtml(exchangeAccent(exchange.id).color)}"><b>${escapeHtml(exchange.label || exchange.id)}</b><small>${escapeHtml(primary)}</small></span>`;
        }).join('')}
      </div>
    `;
  }

  function rerenderMarketTables() {
    renderExchangePreferences();
    syncQuickAmountButtons();
    if (summary) {
      renderHero();
      renderDomesticComparisonRows();
      renderOrderbookRows();
      renderVolumeRows();
      renderSalesRows();
      updateSelectedOrderbookMeta();
    }
    if (lastComparisonData) renderComparison(lastComparisonData);
  }

  function orderbookRowsByExchange(data) {
    const rows = [];
    if (data && Array.isArray(data.orderbooks)) rows.push(...data.orderbooks);
    const domesticRows = data && data.domesticComparison && Array.isArray(data.domesticComparison.rows)
      ? data.domesticComparison.rows
      : [];
    domesticRows.forEach((row) => {
      if (row && row.orderbook) rows.push({ ...row.orderbook, exchangeId: row.exchangeId, instrumentId: row.instrumentId });
    });
    const byKey = new Map();
    rows.forEach((row) => {
      const key = `${normalizeExchangeId(row.exchangeId)}:${String(row.instrumentId || instrumentId).toUpperCase()}`;
      if (!normalizeExchangeId(row.exchangeId)) return;
      byKey.set(key, row);
    });
    return byKey;
  }

  function markSummaryCellChanges(previousSummary, nextSummary) {
    if (!previousSummary || !nextSummary) return;
    const previousRows = orderbookRowsByExchange(previousSummary);
    const nextRows = orderbookRowsByExchange(nextSummary);
    nextRows.forEach((nextRow, key) => {
      const previousRow = previousRows.get(key);
      if (previousRow) markOrderbookCellChanges(nextRow.exchangeId, previousRow, nextRow);
    });
  }

  const readOptionalFeeRatePct = (input) => {
    const raw = input && input.value != null ? String(input.value).trim() : '';
    if (!raw) return null;
    const parsed = parseNumberInput(raw);
    return Number.isFinite(parsed) ? parsed : NaN;
  };
  const marketLabel = () => (summary && summary.market && summary.market.label) || config.label || instrumentId;
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
      hint.textContent = beginnerModeEnabled()
        ? '未入力なら各取引所の成行手数料を自動で使います。入力すると全取引所を同じ手数料率で比較します。'
        : '未入力なら各取引所の既定 taker 手数料を使って比較します。入力すると全取引所を同じ手数料率で比較します。';
      return;
    }
    if (Number.isNaN(feeRatePct)) {
      hint.textContent = '手数料率は0%以上100%以下で入力してください。';
      return;
    }
    hint.textContent = beginnerModeEnabled()
      ? `現在は ${feeRatePct}% を全取引所に手動適用しています。空に戻すと各社の成行手数料に戻ります。`
      : `現在は ${feeRatePct}% を全取引所に手動適用しています。空に戻すと各取引所の既定手数料に戻ります。`;
  }

  function shouldShowLoadingSkeleton(message) {
    return isLoadingMessage(message);
  }

  function setEmpty(tbodyId, colspan, message) {
    const tbody = $(tbodyId);
    if (!tbody) return;
    tbody.innerHTML = shouldShowLoadingSkeleton(message)
      ? `<tr class="market-skeleton-row"><td colspan="${colspan}">${skeletonStackHtml(message)}</td></tr>`
      : `<tr><td colspan="${colspan}" class="text-center text-gray-500 py-4">${escapeHtml(message)}</td></tr>`;
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
    document.title = `${label} 結論・国内取引所比較・銘柄特徴｜国内暗号資産取引所ナビ`;
    setText('market-page-title', `${label} 銘柄ページ`);
    setText('market-page-subtitle', '結論・国内取引所比較・銘柄特徴');
    setText('market-hero-title', `${label} 国内取引所データ`);
    setText('market-footer-label', `${label} 銘柄ページ`);
    setText('market-summary-title', `${label} 比較サマリー`);
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
    let statusText = '板データ取得中';
    if (counts.fresh > 0 && counts.stale > 0) statusText = '鮮度注意';
    else if (counts.fresh > 0) statusText = '集計済み';
    else if (counts.stale > 0) statusText = '鮮度切れ';
    setText('market-status', statusText);
    updateFreshnessProgress();
    setText('market-exchange-count', `${supportedExchanges().length}社`);
    setText('market-best-bid', bestBid ? `${bestBid.exchangeLabel} ${fmtJpyPrice(bestBid.bestBid)}` : '-');
    setText('market-best-ask', bestAsk ? `${bestAsk.exchangeLabel} ${fmtJpyPrice(bestAsk.bestAsk)}` : '-');
    setText('market-hero-meta', `板 新鮮 ${counts.fresh}社 / stale ${counts.stale}社 / 待機 ${counts.waiting}社 | 出来高 ${summary.volume.rows.length}件 | 販売所 ${summary.sales.rows.length}件`);
  }

  function relativeSecondsLabel(ms) {
    if (!Number.isFinite(ms) || ms <= 0) return '-';
    const seconds = Math.max(0, Math.floor((Date.now() - ms) / 1000));
    if (seconds < 60) return `${seconds}秒前`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}分前`;
    return `${Math.floor(minutes / 60)}時間前`;
  }

  function updateFreshnessProgress() {
    const ring = $('market-refresh-progress');
    const label = $('market-updated-at');
    if (!summaryLoadedAt) {
      if (label) label.textContent = '最終更新 -';
      if (ring) ring.style.setProperty('--refresh-progress', '0deg');
      return;
    }
    const elapsed = Math.max(0, Date.now() - summaryLoadedAt);
    const progress = Math.max(0, Math.min(1, elapsed / SUMMARY_REFRESH_MS));
    const remaining = Math.max(0, Math.ceil((SUMMARY_REFRESH_MS - elapsed) / 1000));
    if (ring) {
      ring.style.setProperty('--refresh-progress', `${Math.round(progress * 360)}deg`);
      ring.title = `次のREST更新まで約${remaining}秒`;
      ring.setAttribute('aria-label', `次のREST更新まで約${remaining}秒`);
    }
    if (label) {
      const sourceTime = summary && summary.meta && summary.meta.generatedAt ? ` / ${fmtDateTime(summary.meta.generatedAt)}` : '';
      label.textContent = `最終更新 ${relativeSecondsLabel(summaryLoadedAt)}（REST）`;
      if (sourceTime) label.title = `生成時刻 ${sourceTime.replace(/^ \/ /, '')}`;
    }
  }

  function setSnapshotMetric(key, value, meta) {
    setText(`market-summary-${key}`, value);
    setText(`market-summary-${key}-meta`, meta);
  }

  function setConclusionMetric(key, value, meta) {
    setText(`market-conclusion-${key}`, value);
    setText(`market-conclusion-${key}-meta`, meta);
  }

  function renderBeginnerSimpleCard() {
    const bestExchange = $('market-beginner-best-exchange');
    const receive = $('market-beginner-receive');
    const note = $('market-beginner-note');
    if (!bestExchange || !receive || !note || !summary) return;

    const rows = Array.isArray(summary.domesticComparison && summary.domesticComparison.rows)
      ? summary.domesticComparison.rows
      : [];
    const baseCurrency = (summary.market && summary.market.baseCurrency) || instrumentId.split('-')[0] || '';
    const ranked = rows
      .filter(row => row && row.cost100k && row.cost100k.status === 'fresh' && Number.isFinite(Number(row.cost100k.totalBaseFilled)))
      .slice()
      .sort((a, b) => Number(a.cost100k.rank || 999) - Number(b.cost100k.rank || 999));
    const best = ranked[0] || null;
    if (!best) {
      bestExchange.textContent = summary.snapshot && summary.snapshot.cheapestBuy
        ? summary.snapshot.cheapestBuy.exchangeLabel
        : 'データ待ち';
      receive.textContent = '-';
      note.textContent = ORDERBOOK_WAITING_MESSAGE;
      return;
    }
    const cost = best.cost100k;
    const status = cost.executionStatusLabel || '発注可能';
    bestExchange.textContent = best.exchangeLabel || best.exchangeId || 'データ待ち';
    receive.textContent = `${Fmt.baseCompact(cost.totalBaseFilled)} ${baseCurrency}`;
    note.textContent = `${status} / 平均価格 ${fmtJpyPrice(cost.effectiveVWAP)} / 影響度 ${fmtPct(cost.marketImpactPct)}`;
  }

  function fundingSupportSummary() {
    const exchanges = supportedExchanges();
    const supportedCount = exchanges.filter(exchange => (
      exchange
      && exchange.funding
      && exchange.funding.fiatDeposit
      && exchange.funding.fiatWithdrawal
      && exchange.funding.cryptoDeposit
      && exchange.funding.cryptoWithdrawal
    )).length;
    return {
      exchangeCount: exchanges.length,
      supportedCount,
      summary: supportedCount === exchanges.length && exchanges.length > 0
        ? `${supportedCount}社すべて`
        : `${supportedCount}/${exchanges.length}社`,
      note: 'JPY入出金・暗号資産入出庫は銀行、銘柄、ネットワークごとの条件を公式確認',
    };
  }

  function renderSnapshot(snapshotData) {
    const snapshot = snapshotData && typeof snapshotData === 'object' ? snapshotData : null;
    const defaultExchangeCount = supportedExchanges().length;
    const funding = (snapshot && snapshot.fundingSupport)
      || (summary && summary.domesticComparison && summary.domesticComparison.meta && summary.domesticComparison.meta.fundingSupport)
      || fundingSupportSummary();
    const amount = snapshot && snapshot.comparisonAmount ? Number(snapshot.comparisonAmount.amount) : NaN;
    const freshnessNote = snapshot && snapshot.boardFreshness === 'stale'
      ? '現在は stale 板を含む参考値です'
      : '板は fresh データを優先して集計しています';
    const assumption = Number.isFinite(amount)
      ? `${fmtJpyPrice(amount)}買い / 各取引所既定 taker / ${freshnessNote}`
      : `10万円買い / 各取引所既定 taker / ${freshnessNote}`;
    setText('market-summary-assumption', assumption);

    setSnapshotMetric('exchange-count', `${snapshot && Number.isFinite(Number(snapshot.exchangeCount)) ? Number(snapshot.exchangeCount) : defaultExchangeCount}社`, '国内現物の対応数');
    setSnapshotMetric(
      'best-ask',
      snapshot && snapshot.bestAsk ? fmtJpyPrice(snapshot.bestAsk.price) : 'データ待ち',
      snapshot && snapshot.bestAsk ? snapshot.bestAsk.exchangeLabel : ORDERBOOK_WAITING_MESSAGE
    );
    setSnapshotMetric(
      'best-bid',
      snapshot && snapshot.bestBid ? fmtJpyPrice(snapshot.bestBid.price) : 'データ待ち',
      snapshot && snapshot.bestBid ? snapshot.bestBid.exchangeLabel : ORDERBOOK_WAITING_MESSAGE
    );
    setSnapshotMetric(
      'thickest-book',
      snapshot && snapshot.thickestBook ? snapshot.thickestBook.exchangeLabel : 'データ待ち',
      snapshot && snapshot.thickestBook ? `可視板厚 ${Fmt.jpyLarge(snapshot.thickestBook.visibleDepthJPY)}` : 'Bid + Ask 可視深さ'
    );
    setSnapshotMetric(
      'cheapest-buy',
      snapshot && snapshot.cheapestBuy ? snapshot.cheapestBuy.exchangeLabel : 'データ待ち',
      snapshot && snapshot.cheapestBuy
        ? `${snapshot.cheapestBuy.executionStatusLabel || '参考値'} / 実効VWAP ${fmtJpyPrice(snapshot.cheapestBuy.effectiveVWAP)}`
        : '買い / 100,000円 / 既定手数料'
    );
    setSnapshotMetric(
      'tightest-sales',
      snapshot && snapshot.tightestSalesSpread ? snapshot.tightestSalesSpread.exchangeLabel : 'データ待ち',
      snapshot && snapshot.tightestSalesSpread ? fmtPct(snapshot.tightestSalesSpread.spreadPct) : '販売所データ待ち'
    );
    setSnapshotMetric(
      'funding-support',
      funding ? funding.summary : '公式確認',
      funding ? funding.note : 'JPY入出金・暗号資産入出庫は公式条件確認'
    );
    setSnapshotMetric(
      'top-volume',
      snapshot && snapshot.topVolume ? snapshot.topVolume.exchangeLabel : 'データ待ち',
      snapshot && snapshot.topVolume ? `24h出来高 ${Fmt.jpyLarge(snapshot.topVolume.quoteVolume)}` : '出来高データを取得中です'
    );
    setConclusionMetric(
      'best-board',
      snapshot && snapshot.cheapestBuy ? snapshot.cheapestBuy.exchangeLabel : 'データ待ち',
      snapshot && snapshot.cheapestBuy
        ? `10万円買い / 実効VWAP ${fmtJpyPrice(snapshot.cheapestBuy.effectiveVWAP)}`
        : `${defaultExchangeCount}社の板を集計`
    );
    setConclusionMetric(
      'best-sales',
      snapshot && snapshot.tightestSalesSpread ? snapshot.tightestSalesSpread.exchangeLabel : 'データ待ち',
      snapshot && snapshot.tightestSalesSpread ? `販売所スプレッド ${fmtPct(snapshot.tightestSalesSpread.spreadPct)}` : '販売所スプレッドを確認中'
    );
    setConclusionMetric(
      'top-volume',
      snapshot && snapshot.topVolume ? snapshot.topVolume.exchangeLabel : 'データ待ち',
      snapshot && snapshot.topVolume ? `24h出来高 ${Fmt.jpyLarge(snapshot.topVolume.quoteVolume)}` : '24h売買代金ベース'
    );
    updatePretradeCta(isPretradeChecklistComplete());
  }

  function fundingLabel(funding) {
    if (!funding) return '公式条件確認';
    const summaryText = funding.summary || 'JPY入出金 / 暗号資産入出庫';
    const statusText = funding.statusLabel || '公式条件確認';
    return `${summaryText} (${statusText})`;
  }

  function renderDomesticComparisonRows() {
    const tbody = $('market-domestic-comparison-tbody');
    if (!tbody) return;
    const domestic = summary && summary.domesticComparison ? summary.domesticComparison : null;
    const rawRows = Array.isArray(domestic && domestic.rows) ? domestic.rows : [];
    const rows = orderRowsForMyExchanges(rawRows);
    const meta = domestic && domestic.meta ? domestic.meta : {};
    const baseCurrency = (summary && summary.market && summary.market.baseCurrency) || instrumentId.split('-')[0] || '';
    const counts = summarizeStatuses(rawRows.map(row => row.orderbook || {}));
    setText(
      'market-domestic-comparison-meta',
      `${marketLabel()} | 10万円買い / ${termText('各取引所既定 taker', '各社の成行手数料')} | 対応 ${meta.exchangeCount || rawRows.length || supportedExchanges().length}社${showOnlyMyExchanges && myExchangeIds.size > 0 ? ` / マイ取引所 ${rows.length}社表示` : ''} | 板 fresh ${counts.fresh || 0}社 / 待機 ${counts.waiting || 0}社`
    );

    if (rawRows.length === 0) {
      setEmpty('market-domestic-comparison-tbody', 7, '国内取引所比較データを取得中です。');
      return;
    }
    if (rows.length === 0) {
      setEmpty('market-domestic-comparison-tbody', 7, 'マイ取引所に一致する行がありません。選択だけ表示を解除してください。');
      return;
    }

    const readySalesRows = rows.filter(row => row.salesSpread && row.salesSpread.status === 'ready' && Number.isFinite(Number(row.salesSpread.spreadPct)));
    const salesValues = readySalesRows.map(row => Number(row.salesSpread.spreadPct));
    const minSales = salesValues.length > 0 ? Math.min(...salesValues) : null;
    const maxSales = salesValues.length > 0 ? Math.max(...salesValues) : null;
    const bestSalesIds = bestIds(readySalesRows, row => row.salesSpread.spreadPct, 'min');
    const bestDepthIds = bestIds(rows.filter(row => row.orderbook && (row.orderbook.status === 'fresh' || row.orderbook.status === 'stale')), row => row.orderbook.visibleDepthJPY, 'max');
    const depthRows = rows
      .map(row => row.orderbook || {})
      .filter(orderbook => liveRowStatus(orderbook) === 'fresh' || liveRowStatus(orderbook) === 'stale');
    const maxBidDepth = Math.max(0, ...depthRows.map(orderbook => finiteNumber(orderbook.totalBidDepthJPY) || 0));
    const maxAskDepth = Math.max(0, ...depthRows.map(orderbook => finiteNumber(orderbook.totalAskDepthJPY) || 0));

    tbody.innerHTML = rows.map((row) => {
      const orderbook = row.orderbook || {};
      const orderbookStatus = liveRowStatus(orderbook);
      const hasBook = orderbookStatus === 'fresh' || orderbookStatus === 'stale';
      const cost = row.cost100k || {};
      const costReady = cost.status === 'fresh' && cost.executionStatus && Number.isFinite(Number(cost.totalBaseFilled));
      const sales = row.salesSpread || {};
      const salesReady = sales.status === 'ready' && Number.isFinite(Number(sales.spreadPct));
      const rowClass = [
        cost.rank === 1 && costReady ? 'data-table__row--rank-1' : '',
        isMyExchange(row.exchangeId) ? 'data-table__row--my-exchange' : '',
        orderbookStatus === 'stale' ? 'data-table__row--stale' : '',
        liveFlashClass(row.exchangeId),
      ].filter(Boolean).join(' ');
      const costStatus = costReady
        ? (cost.executionStatusLabel || '参考値')
        : (cost.status === 'stale' ? '板データが古い' : (cost.message || ORDERBOOK_WAITING_MESSAGE));
      const isBestSales = bestSalesIds.has(normalizeExchangeId(row.exchangeId));
      const isBestDepth = bestDepthIds.has(normalizeExchangeId(row.exchangeId));
      const costCellClass = costReady && cost.rank === 1 ? 'market-cell-highlight market-cell-highlight--gold' : '';
      const depthCellClass = hasBook && isBestDepth ? 'market-cell-highlight market-cell-highlight--green' : '';
      const salesCellClass = salesReady && isBestSales ? 'market-cell-highlight market-cell-highlight--green' : '';

      return `
        <tr class="border-b border-gray-800/60 ${rowClass}" data-exchange-id="${escapeHtml(normalizeExchangeId(row.exchangeId))}">
          <td class="text-left" data-label="対応取引所">
            ${exchangeIdentityHtml(row.exchangeId, row.exchangeLabel || row.exchangeId, `対応銘柄 / ${row.instrumentLabel || instrumentId}`)}
          </td>
          <td class="is-num text-right font-mono" data-label="最良Bid / Ask">
            ${hasBook ? `
              <div class="text-green-300">${depthPriceHtml(row.exchangeId, 'bestBid', orderbook.bestBid, 'bid', orderbook.totalBidDepthJPY, maxBidDepth, 'Bid')}</div>
              <div class="text-red-300">${depthPriceHtml(row.exchangeId, 'bestAsk', orderbook.bestAsk, 'ask', orderbook.totalAskDepthJPY, maxAskDepth, 'Ask')}</div>
              <div class="text-[10px] text-gray-500 ${cellFlashClass(row.exchangeId, 'spreadPct')}">Spread ${fmtPct(orderbook.spreadPct)}</div>
              ${freshnessBadgeHtml(orderbookStatus, orderbook)}
            ` : waitingCellHtml(orderbook.message || ORDERBOOK_WAITING_MESSAGE)}
          </td>
          <td class="is-num text-right font-mono ${depthCellClass} ${cellFlashClass(row.exchangeId, 'visibleDepthJPY')}" data-label="板厚">
            <div class="text-gray-200">${hasBook ? Fmt.jpyLarge(orderbook.visibleDepthJPY) : waitingCellHtml(orderbook.message || ORDERBOOK_WAITING_MESSAGE)}</div>
            <div class="text-[10px] text-gray-500">${hasBook ? 'Bid + Ask可視深さ' : ''}</div>
            ${hasBook ? depthMiniChartHtml(orderbook) : ''}
            ${hasBook && isBestDepth ? winnerBadge('最大板厚', 'green') : ''}
          </td>
          <td class="is-num text-right font-mono ${costCellClass}" data-label="10万円買い">
            <div class="${costReady ? 'text-red-300' : 'text-gray-500'}">${costReady ? `${cost.rank ? `#${cost.rank} ` : ''}${Fmt.baseCompact(cost.totalBaseFilled)} ${escapeHtml(baseCurrency)}` : (isLoadingMessage(costStatus) ? waitingCellHtml(costStatus) : '-')}</div>
            <div class="text-[10px] text-gray-500">${costReady ? `${termText('VWAP', '平均価格')} ${fmtJpyPrice(cost.effectiveVWAP)} / ${termText('Impact', '影響度')} ${fmtPct(cost.marketImpactPct)}` : (isLoadingMessage(costStatus) ? '' : escapeHtml(costStatus))}</div>
            ${costReady && cost.rank === 1 ? winnerBadge('最安 Low Cost') : ''}
          </td>
          <td class="is-num text-right font-mono ${salesCellClass}" data-label="販売所Spread">
            ${salesReady ? spreadCostHtml(sales.spreadPct, { min: minSales, max: maxSales, best: isBestSales }) : '<div class="text-gray-500">-</div>'}
            <div class="text-[10px] text-gray-500">${salesReady ? `買 ${fmtJpyPrice(sales.buyPrice)} / 売 ${fmtJpyPrice(sales.sellPrice)}` : escapeHtml(sales.message || '販売所データなし')}</div>
          </td>
          <td class="text-left" data-label="入出金対応">
            <div class="font-bold text-gray-200">${escapeHtml(fundingLabel(row.funding))}</div>
            <div class="text-[10px] text-gray-500">${escapeHtml((row.funding && row.funding.note) || '銀行・銘柄・ネットワーク別の条件は公式確認')}</div>
          </td>
          <td class="text-right market-action-cell" data-label="アクション">
            ${exchangeActionHtml(row.exchangeId, row.exchangeLabel || row.exchangeId)}
          </td>
        </tr>
      `;
    }).join('');
    renderFloatingMyExchanges();
  }

  function renderOrderbookRows() {
    const tbody = $('market-orderbook-tbody');
    if (!tbody) return;
    const rawRows = sortedOrderbookRows();
    const rows = orderRowsForMyExchanges(rawRows);
    if (rawRows.length === 0) {
      setEmpty('market-orderbook-tbody', 5, 'この銘柄の板を取得できる取引所がまだありません。');
      return;
    }
    if (rows.length === 0) {
      setEmpty('market-orderbook-tbody', 5, 'マイ取引所に一致する板データがありません。選択だけ表示を解除してください。');
      return;
    }
    const depthRows = rows.filter(row => liveRowStatus(row) === 'fresh' || liveRowStatus(row) === 'stale');
    const maxBidDepth = Math.max(0, ...depthRows.map(row => finiteNumber(row.totalBidDepthJPY) || 0));
    const maxAskDepth = Math.max(0, ...depthRows.map(row => finiteNumber(row.totalAskDepthJPY) || 0));

    tbody.innerHTML = rows.map(row => {
      const status = liveRowStatus(row);
      const hasBook = status === 'fresh' || status === 'stale';
      const rowClass = [
        status === 'stale' ? 'data-table__row--stale' : '',
        isMyExchange(row.exchangeId) ? 'data-table__row--my-exchange' : '',
        liveFlashClass(row.exchangeId),
      ].filter(Boolean).join(' ');
      return `
        <tr class="border-b border-gray-800/60 ${rowClass}" data-exchange-id="${escapeHtml(normalizeExchangeId(row.exchangeId))}">
          <td class="text-left" data-label="取引所">
            ${exchangeIdentityHtml(row.exchangeId, row.exchangeLabel || row.exchangeId, hasBook ? String(row.source || '-').toUpperCase() : (row.message || ORDERBOOK_WAITING_MESSAGE))}
          </td>
          <td class="is-num text-right font-mono text-green-300" data-label="Bid">${hasBook ? depthPriceHtml(row.exchangeId, 'bestBid', row.bestBid, 'bid', row.totalBidDepthJPY, maxBidDepth, 'Bid') : waitingCellHtml(row.message || ORDERBOOK_WAITING_MESSAGE)}</td>
          <td class="is-num text-right font-mono text-red-300" data-label="Ask">${hasBook ? depthPriceHtml(row.exchangeId, 'bestAsk', row.bestAsk, 'ask', row.totalAskDepthJPY, maxAskDepth, 'Ask') : waitingCellHtml(row.message || ORDERBOOK_WAITING_MESSAGE)}</td>
          <td class="is-num text-right font-mono text-yellow-300 ${cellFlashClass(row.exchangeId, 'spreadPct')}" data-label="Spread">${hasBook ? fmtPct(row.spreadPct) : waitingCellHtml(row.message || ORDERBOOK_WAITING_MESSAGE)}</td>
          <td class="text-right font-mono text-gray-400" data-label="更新">
            <div>${hasBook ? escapeHtml(updatedAtLabel(row)) : '-'}</div>
            <div class="text-[10px] text-gray-500">${hasBook ? escapeHtml(ageLabel(row)) : escapeHtml(row.message || ORDERBOOK_WAITING_MESSAGE)}</div>
            ${freshnessBadgeHtml(status, row)}
          </td>
        </tr>
      `;
    }).join('');
  }

  function renderVolumeRows() {
    const rawRows = ((summary.volume && summary.volume.rows) || [])
      .slice()
      .sort((a, b) => Number(b.quoteVolume || 0) - Number(a.quoteVolume || 0));
    const rows = orderRowsForMyExchanges(rawRows);
    if (rawRows.length === 0) {
      updateVolumeDonutChart([]);
      setEmpty('market-volume-tbody', 4, '出来高データを取得中です。取得でき次第、取引所ごとの流動性を表示します。');
      return;
    }
    if (rows.length === 0) {
      updateVolumeDonutChart([]);
      setEmpty('market-volume-tbody', 4, 'マイ取引所に一致する出来高データがありません。選択だけ表示を解除してください。');
      return;
    }

    const tbody = $('market-volume-tbody');
    updateVolumeDonutChart(rows);
    const topVolumeIds = bestIds(rows, row => row.quoteVolume, 'max');
    tbody.innerHTML = rows.map(row => `
      <tr class="border-b border-gray-800/60 ${isMyExchange(row.exchangeId) ? 'data-table__row--my-exchange' : ''}" data-exchange-id="${escapeHtml(normalizeExchangeId(row.exchangeId))}">
        <td class="font-bold text-gray-200" data-label="取引所">${exchangeIdentityHtml(row.exchangeId, row.exchangeLabel || row.exchangeId)}</td>
        <td class="is-num text-right font-mono text-gray-300" data-label="出来高">${Fmt.jpyLarge(row.quoteVolume)}</td>
        <td class="is-num text-right font-mono" data-label="銘柄内シェア">
          ${shareBarHtml(row.instrumentSharePct)}
          ${topVolumeIds.has(normalizeExchangeId(row.exchangeId)) ? winnerBadge('首位', 'green') : ''}
        </td>
        <td class="text-right font-mono text-gray-400" data-label="取得">${fmtDateTime(row.lastFetchedAt || row.capturedAt)}</td>
      </tr>
    `).join('');
  }

  function renderSalesRows() {
    const rawRows = ((summary.sales && summary.sales.rows) || [])
      .slice()
      .sort((a, b) => {
        const aPct = a.latest && Number(a.latest.spreadPct);
        const bPct = b.latest && Number(b.latest.spreadPct);
        if (Number.isFinite(aPct) && Number.isFinite(bPct)) return aPct - bPct;
        return String(a.exchangeLabel).localeCompare(String(b.exchangeLabel), 'ja');
      });
    const rows = orderRowsForMyExchanges(rawRows);
    if (rawRows.length === 0) {
      setEmpty('market-sales-tbody', 5, '販売所価格を取得中です。取得できた販売所から順に比較します。');
      return;
    }
    if (rows.length === 0) {
      setEmpty('market-sales-tbody', 5, 'マイ取引所に一致する販売所データがありません。選択だけ表示を解除してください。');
      return;
    }

    const tbody = $('market-sales-tbody');
    const spreadValues = rows
      .map(row => finiteNumber(row.latest && row.latest.spreadPct))
      .filter(value => value != null);
    const minSales = spreadValues.length > 0 ? Math.min(...spreadValues) : null;
    const maxSales = spreadValues.length > 0 ? Math.max(...spreadValues) : null;
    const bestSalesIds = bestIds(rows, row => row.latest && row.latest.spreadPct, 'min');
    tbody.innerHTML = rows.map(row => {
      const latest = row.latest || {};
      const isBestSales = bestSalesIds.has(normalizeExchangeId(row.exchangeId));
      return `
        <tr class="border-b border-gray-800/60 ${isMyExchange(row.exchangeId) ? 'data-table__row--my-exchange' : ''}" data-exchange-id="${escapeHtml(normalizeExchangeId(row.exchangeId))}">
          <td class="font-bold text-gray-200" data-label="販売所">${exchangeIdentityHtml(row.exchangeId, row.exchangeLabel || row.exchangeId)}</td>
          <td class="is-num text-right font-mono text-red-300" data-label="買値">${fmtJpyPrice(latest.buyPrice)}</td>
          <td class="is-num text-right font-mono text-green-300" data-label="売値">${fmtJpyPrice(latest.sellPrice)}</td>
          <td class="is-num text-right font-mono ${isBestSales ? 'market-cell-highlight market-cell-highlight--green' : ''}" data-label="Spread">${spreadCostHtml(latest.spreadPct, { min: minSales, max: maxSales, best: isBestSales })}</td>
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
      setEmpty('market-comparison-tbody', 7, '数量または金額、手数料率を確認してください。');
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
      const data = await Api.fetchJson(`/api/market-impact-comparison?${params.toString()}`, {
        signal: controller.signal,
      });
      if (lastComparisonData) animateTableReorder(() => renderComparison(data));
      else renderComparison(data);
    } catch (err) {
      if (err.name === 'AbortError') return;
      lastComparisonData = null;
      setText('market-comparison-meta', '比較データを取得できませんでした。');
      setEmpty('market-comparison-tbody', 7, '比較データを取得できませんでした。時間をおいて再度お試しください。');
    } finally {
      if (comparisonAbortController === controller) {
        comparisonAbortController = null;
      }
    }
  }

  function renderComparison(data) {
    lastComparisonData = data && typeof data === 'object' ? data : null;
    const rawRows = Array.isArray(data && data.rows) ? data.rows : [];
    const rows = orderRowsForMyExchanges(rawRows);
    const meta = data.meta || {};
    const counts = summarizeStatuses(rawRows);
    setText('market-comparison-meta', `${marketLabel()} | ${meta.side === 'sell' ? '売り' : '買い'} | ${comparisonAmountLabel(meta)} | ${termText('手数料', '成行手数料')} ${meta.feeRate == null ? termText('各取引所既定', '各社の既定値') : fmtPct(meta.feeRate * 100)}${showOnlyMyExchanges && myExchangeIds.size > 0 ? ` | マイ取引所 ${rows.length}件表示` : ''} | 新鮮 ${counts.fresh || 0}件 / stale ${counts.stale || 0}件 / 待機 ${counts.waiting || 0}件${counts.waiting > 0 ? ` | ${PARTIAL_DATA_FAILURE_MESSAGE}` : ''}`);
    if (rawRows.length === 0) {
      setEmpty('market-comparison-tbody', 7, '比較できる取引所がありません。別の銘柄または条件で確認してください。');
      return;
    }
    if (rows.length === 0) {
      setEmpty('market-comparison-tbody', 7, 'マイ取引所に一致する比較行がありません。選択だけ表示を解除してください。');
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
        : (status === 'stale' ? '板データが古いため比較停止' : (row.message || ORDERBOOK_WAITING_MESSAGE));
      const statusSub = ready
        ? comparisonReasonText(result)
        : (status === 'fresh' || status === 'stale' ? `最終更新 ${ageLabel(row)}` : '');
      const valueClass = ready ? (isSell ? 'text-green-300' : 'text-red-300') : 'text-gray-500';
      const statusClass = ready
        ? comparisonStatusClass(result.executionStatus)
        : (status === 'stale' ? 'text-yellow-300' : 'text-gray-500');
      const rowClass = [
        'data-table__row--comparison-refresh',
        row.rank === 1 && ready ? 'data-table__row--rank-1' : '',
        isMyExchange(row.exchangeId) ? 'data-table__row--my-exchange' : '',
        status === 'stale' ? 'data-table__row--stale' : '',
        liveFlashClass(row.exchangeId),
      ].filter(Boolean).join(' ');
      const resultCellClass = ready && row.rank === 1 ? 'market-cell-highlight market-cell-highlight--gold' : '';
      return `
        <tr class="border-b border-gray-800/60 ${rowClass}" data-exchange-id="${escapeHtml(normalizeExchangeId(row.exchangeId))}">
          <td class="is-num text-right font-mono text-gray-300" data-label="順位">${ready && row.rank ? `#${row.rank}` : '-'}</td>
          <td class="text-left" data-label="取引所">
            ${exchangeIdentityHtml(row.exchangeId, row.exchangeLabel || row.exchangeId, String(row.source || '-').toUpperCase())}
          </td>
          <td class="is-num text-right font-mono ${valueClass} ${resultCellClass}" data-label="結果">
            <div>${ready ? value : (isLoadingMessage(statusText) ? waitingCellHtml(statusText) : value)}</div>
            ${ready && row.rank === 1 ? winnerBadge(isSell ? '売却最良' : '最安 Low Cost') : ''}
          </td>
          <td class="is-num text-right font-mono text-gray-300" data-label="${termText('VWAP', '平均購入価格')}">${vwap}</td>
          <td class="is-num text-right font-mono text-yellow-300" data-label="${termText('Impact', '値幅への影響度')}">${ready ? fmtPct(result.marketImpactPct) : '-'}</td>
          <td class="${statusClass}" data-label="判定">
            <div class="font-bold">${escapeHtml(statusText)}</div>
            ${statusSub ? `<div class="text-[10px] text-gray-500">${escapeHtml(statusSub)}</div>` : ''}
            ${freshnessBadgeHtml(status, row)}
          </td>
          <td class="text-right market-action-cell" data-label="アクション">
            ${exchangeActionHtml(row.exchangeId, row.exchangeLabel || row.exchangeId)}
          </td>
        </tr>
      `;
    }).join('');
  }

  function renderSummary(data) {
    markSummaryCellChanges(summary, data);
    summary = data;
    summaryLoadedAt = Date.now();
    updatePageLabels();
    updateFeePresetHint();
    populateBoardExchangeSelect();
    renderSnapshot(summary && summary.snapshot);
    renderHero();
    renderExchangePreferences();
    renderDomesticComparisonRows();
    renderOrderbookRows();
    renderVolumeRows();
    renderSalesRows();
    renderBeginnerSimpleCard();
    updateFreshnessProgress();
    syncQuickAmountButtons();
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
      const data = await Api.fetchJson(`/api/markets/${encodeURIComponent(instrumentId)}`, {
        signal: controller.signal,
      });
      renderSummary(data);
      void loadComparison();
    } catch (err) {
      if (err.name === 'AbortError') return;
      setText('market-status', '取得できませんでした');
      setText('market-hero-meta', '銘柄データを取得できませんでした。時間をおいて再読み込みしてください。');
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
        renderDomesticComparisonRows();
        renderOrderbookRows();
        updateSelectedOrderbookMeta();
        renderBeginnerSimpleCard();
      }
      updateFreshnessProgress();
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
      if (id === 'market-amount-type') syncAmountTypeToggle();
      syncQuickAmountButtons();
      if (comparisonTimer) clearTimeout(comparisonTimer);
      comparisonTimer = setTimeout(loadComparison, 250);
    });
  });

  document.querySelectorAll('[data-market-quick-amount]').forEach((button) => {
    button.addEventListener('click', () => {
      const value = Number(button.dataset.marketQuickAmount);
      if (!Number.isFinite(value)) return;
      button.classList.remove('market-quick-amount--pulse');
      void button.offsetWidth;
      button.classList.add('market-quick-amount--pulse');
      setQuickAmount(value);
    });
  });

  const amountRange = $('market-amount-range');
  if (amountRange) {
    amountRange.addEventListener('input', () => {
      setAmountFromRange(amountRange.value);
    });
  }

  document.addEventListener('click', (event) => {
    const refreshButton = event.target && event.target.closest ? event.target.closest('[data-market-refresh]') : null;
    if (refreshButton) {
      event.preventDefault();
      void loadSummary();
      return;
    }
    const disabledCta = event.target && event.target.closest ? event.target.closest('.market-pretrade-ready__cta[aria-disabled="true"]') : null;
    if (disabledCta) {
      event.preventDefault();
      return;
    }
    const button = event.target && event.target.closest ? event.target.closest('[data-market-star-exchange]') : null;
    if (!button) return;
    event.preventDefault();
    event.stopPropagation();
    const id = normalizeExchangeId(button.dataset.marketStarExchange);
    if (!id) return;
    if (myExchangeIds.has(id)) myExchangeIds.delete(id);
    else myExchangeIds.add(id);
    writeStoredExchangeSet(myExchangeIds);
    if (myExchangeIds.size === 0) {
      showOnlyMyExchanges = false;
      writeStoredBoolean(MY_EXCHANGES_ONLY_STORAGE_KEY, false);
    }
    animateTableReorder(rerenderMarketTables);
  });

  const preferenceHost = $('market-exchange-preferences');
  if (preferenceHost) {
    preferenceHost.addEventListener('change', (event) => {
      const input = event.target && event.target.closest ? event.target.closest('[data-market-my-exchange]') : null;
      if (!input) return;
      const id = normalizeExchangeId(input.value);
      if (!id) return;
      if (input.checked) myExchangeIds.add(id);
      else myExchangeIds.delete(id);
      writeStoredExchangeSet(myExchangeIds);
      if (myExchangeIds.size === 0) {
        showOnlyMyExchanges = false;
        writeStoredBoolean(MY_EXCHANGES_ONLY_STORAGE_KEY, false);
      }
      animateTableReorder(rerenderMarketTables);
    });
    preferenceHost.addEventListener('click', (event) => {
      const target = event.target && event.target.closest ? event.target : null;
      if (!target) return;
      const onlyButton = target.closest('[data-market-my-only]');
      const clearButton = target.closest('[data-market-my-clear]');
      if (onlyButton) {
        showOnlyMyExchanges = !showOnlyMyExchanges;
        writeStoredBoolean(MY_EXCHANGES_ONLY_STORAGE_KEY, showOnlyMyExchanges);
        animateTableReorder(rerenderMarketTables);
      } else if (clearButton) {
        myExchangeIds = new Set();
        showOnlyMyExchanges = false;
        writeStoredExchangeSet(myExchangeIds);
        writeStoredBoolean(MY_EXCHANGES_ONLY_STORAGE_KEY, false);
        animateTableReorder(rerenderMarketTables);
      }
    });
  }

  window.addEventListener('okj:beginner-mode-change', () => {
    updateFeePresetHint();
    rerenderMarketTables();
    renderBeginnerSimpleCard();
    syncBeginnerCollapses();
  });

  ws.on('connected', () => {
    connectSelectedOrderbook();
  });
  ws.on('orderbook', (data) => {
    if (!data || data.instrumentId !== instrumentId || data.exchangeId !== selectedExchangeId) return;
    markExchangeUpdated(data.exchangeId);
    if (summary && Array.isArray(summary.orderbooks)) {
      const index = summary.orderbooks.findIndex(row => row.exchangeId === data.exchangeId && row.instrumentId === data.instrumentId);
      if (index >= 0) {
        markOrderbookCellChanges(data.exchangeId, summary.orderbooks[index], data);
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
      const domesticRows = summary.domesticComparison && Array.isArray(summary.domesticComparison.rows)
        ? summary.domesticComparison.rows
        : [];
      const domesticRow = domesticRows.find(row => row.exchangeId === data.exchangeId && row.instrumentId === data.instrumentId);
      if (domesticRow) {
        markOrderbookCellChanges(data.exchangeId, domesticRow.orderbook, data);
        domesticRow.orderbook = {
          ...domesticRow.orderbook,
          status: 'fresh',
          message: null,
          bestBid: data.bestBid,
          bestAsk: data.bestAsk,
          spreadPct: data.spreadPct,
          totalAskDepthJPY: data.totalAskDepthJPY,
          totalBidDepthJPY: data.totalBidDepthJPY,
          visibleDepthJPY: Number(data.totalAskDepthJPY || 0) + Number(data.totalBidDepthJPY || 0),
          updatedAt: data.updatedAt || data.timestamp || data.receivedAt || null,
          staleAfterMs: data.staleAfterMs || null,
          source: data.source || null,
        };
      }
    }
    updateSelectedOrderbookMeta();
    setChartBaseCurrency(data.market?.baseCurrency || (summary.market && summary.market.baseCurrency) || 'BTC');
    updateDepthChart(data.depthChart, data.midPrice);
    if (summary) {
      renderHero();
      renderDomesticComparisonRows();
      renderOrderbookRows();
      renderBeginnerSimpleCard();
    }
  });

  initThemeToggle();
  initPairSwitcher();
  initSectionNavigation();
  initReadmoreSections();
  initBeginnerCollapses();
  initAmountTypeToggle();
  initPretradeChecklist();
  initDepthChart();
  initVolumeDonutChart();
  updateFeePresetHint();
  syncAmountRange();
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
