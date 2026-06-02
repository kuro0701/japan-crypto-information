document.addEventListener('DOMContentLoaded', () => {
  const Api = window.AppApi;
  const AppFmt = window.AppFormatters;
  const AppUtil = window.AppUtils;
  const pagePoller = window.PagePoller.create();
  const ALL_VALUE = '__all__';
  let allRows = [];
  let filterText = '';
  let selectedExchange = ALL_VALUE;
  let latestMeta = {};
  let selectedHistoryWindow = '30d';
  let selectedHistoryInstrument = 'BTC-JPY';
  let selectedCategory = 'all';
  let spreadHistoryRows = [];
  let spreadHistoryMeta = {};
  let spreadHistoryChart = null;
  let spreadAbortController = null;
  let spreadHistoryAbortController = null;
  let spreadInsightsAbortController = null;
  let selectedInsightPeriod = '24h';
  let pinnedInstrumentIds = new Set();
  let sortState = { key: 'currentSpreadPct', direction: 'asc' };
  let previousValueSnapshot = new Map();
  const flashCells = new Map();
  const CHART_COLORS = ['#35e0a5', '#ff6b70', '#35c8d2', '#f4c95d', '#dbe7df', '#ff9f7e', '#9ad46a'];
  const SPREAD_REFRESH_MS = 60000;
  const SPREAD_HISTORY_REFRESH_MS = 600000;
  const SPREAD_INSIGHTS_REFRESH_MS = 600000;
  const EMPTY_FILTER_MESSAGE = '条件に合う販売所スプレッドデータがありません。銘柄名や取引所フィルターを変更してください。';
  const WAITING_DATA_MESSAGE = '販売所価格を取得中です。取得できた販売所から順に比較します。';
  const THEME_STORAGE_KEY = 'okj.theme.v1';
  const PINNED_STORAGE_KEY = 'okj.salesSpread.pinnedInstruments.v1';
  const FLASH_DURATION_MS = 1800;
  const FLASH_EPSILON = 0.000001;
  const MAIN_INSTRUMENT_IDS = ['BTC-JPY', 'ETH-JPY', 'XRP-JPY'];
  const ALL_CATEGORY = 'all';
  const QUICK_FILTERS = {
    all: { label: 'すべて', currencies: null },
    major: { label: '主要通貨', currencies: new Set(['BTC', 'ETH', 'XRP']) },
    stable: { label: 'ステーブルコイン', currencies: new Set(['DAI', 'USDC', 'USDT', 'JPYC']) },
    meme: { label: 'ミームコイン', currencies: new Set(['PEPE', 'SHIB', 'DOGE', 'MONA']) },
  };
  const SORT_ACCESSORS = {
    instrument: {
      type: 'text',
      get: row => row.instrumentLabel || row.instrumentId || '',
    },
    exchange: {
      type: 'text',
      get: row => row.exchangeLabel || row.exchangeId || '',
    },
    buyPrice: {
      type: 'number',
      get: row => row.latest && row.latest.buyPrice,
    },
    sellPrice: {
      type: 'number',
      get: row => row.latest && row.latest.sellPrice,
    },
    currentSpreadPct: {
      type: 'number',
      get: row => (row.latest && row.latest.spreadPct) || (row.averages && row.averages['1d'] && row.averages['1d'].spreadPct),
    },
    avg1dSpreadPct: {
      type: 'number',
      get: row => row.averages && row.averages['1d'] && row.averages['1d'].spreadPct,
    },
    avg7dSpreadPct: {
      type: 'number',
      get: row => row.averages && row.averages['7d'] && row.averages['7d'].spreadPct,
    },
    avg30dSpreadPct: {
      type: 'number',
      get: row => row.averages && row.averages['30d'] && row.averages['30d'].spreadPct,
    },
  };

  const $ = AppUtil.byId;
  const setText = AppUtil.setText;
  const escapeHtml = AppUtil.escapeHtml;
  const exchangePageUrl = AppUtil.exchangePageUrl;
  const marketPageUrl = AppUtil.marketPageUrl;
  const cssVar = AppUtil.cssVar;
  const fmtPct = AppFmt.pct;
  const fmtDateTime = AppFmt.dateTime;
  const fmtJpyPrice = AppFmt.jpyPrice;
  const shortDate = AppFmt.shortDate;
  const HISTORY_WINDOW_VALUES = new Set(['24h', '7d', '30d']);
  const INSIGHT_PERIODS = {
    '24h': { label: '24h', periods: 1, periodLabel: '24h' },
    '7d': { label: '7日', periods: 7, periodLabel: '7d' },
    '30d': { label: '30日', periods: 30, periodLabel: '30d' },
  };
  const INSIGHT_TYPE_LABELS = {
    top_narrowing: '🟢 コスト低下（スプレッド改善）',
    top_widening: '🔴 コスト上昇に注意（スプレッド拡大）',
    spread_narrowing: '🟢 コスト低下（スプレッド改善）',
    spread_widening: '🔴 コスト上昇に注意（スプレッド拡大）',
    narrowest_change: '🟢 コスト低下（最安候補の変化）',
    narrowest_hold: '🟢 コスト低めを維持',
    narrowest_gap_change: '今日の注目ポイント',
    rank_up: '🟢 コスト順位が改善',
    rank_down: '🔴 コスト順位の悪化に注意',
    narrowest_gap_narrow: '🟢 最安候補との差が縮小',
    narrowest_gap_widen: '🔴 最安候補との差が拡大',
    above_gap_narrow: '🟢 上位との差が縮小',
    above_gap_widen: '🔴 上位との差が拡大',
    narrowing_streak: '🟢 コスト低下が継続',
    widening_streak: '🔴 コスト上昇が継続',
    zscore_outlier: '要注意（コスト急変動）',
  };
  const INSIGHT_PERIOD_VALUES = new Set(Object.keys(INSIGHT_PERIODS));
  const TOP_RANKING_LIMIT = 10;
  const ORDERBOOK_SUGGESTION_LIMIT = 3;

  function normalizeHistoryWindow(value) {
    if (value === '1d') return '24h';
    return HISTORY_WINDOW_VALUES.has(value) ? value : '30d';
  }

  function normalizeInsightPeriod(value) {
    if (value === '1d') return '24h';
    return INSIGHT_PERIOD_VALUES.has(value) ? value : '24h';
  }

  function normalizeInstrumentId(value) {
    const normalized = String(value || '').trim().toUpperCase();
    return /^[A-Z0-9]+(?:-[A-Z0-9]+)+$/.test(normalized) ? normalized : '';
  }

  function normalizeExchangeId(value) {
    const normalized = String(value || '').trim().toLowerCase();
    return normalized || ALL_VALUE;
  }

  function normalizeCategory(value) {
    const normalized = String(value || '').trim().toLowerCase();
    return Object.prototype.hasOwnProperty.call(QUICK_FILTERS, normalized) ? normalized : ALL_CATEGORY;
  }

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
      button.setAttribute('aria-pressed', isLight ? 'true' : 'false');
      button.setAttribute('aria-label', isLight ? 'ダークモードに切り替え' : 'ライトモードに切り替え');
      if (icon) icon.textContent = isLight ? '☾' : '☀';
      if (label) label.textContent = isLight ? 'ダーク' : 'ライト';
    });
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
      if (spreadHistoryChart) {
        initChartTheme();
        spreadHistoryChart.update('none');
      }
    });
  }

  function readPinnedInstrumentIds() {
    try {
      const parsed = JSON.parse(localStorage.getItem(PINNED_STORAGE_KEY) || '[]');
      return new Set(Array.isArray(parsed) ? parsed.map(normalizeInstrumentId).filter(Boolean) : []);
    } catch (_) {
      return new Set();
    }
  }

  function writePinnedInstrumentIds() {
    try {
      localStorage.setItem(PINNED_STORAGE_KEY, JSON.stringify(Array.from(pinnedInstrumentIds)));
    } catch (_) {
      // noop
    }
  }

  function isPinnedInstrument(instrumentId) {
    return pinnedInstrumentIds.has(normalizeInstrumentId(instrumentId));
  }

  function togglePinnedInstrument(instrumentId) {
    const normalized = normalizeInstrumentId(instrumentId);
    if (!normalized) return;
    if (pinnedInstrumentIds.has(normalized)) pinnedInstrumentIds.delete(normalized);
    else pinnedInstrumentIds.add(normalized);
    writePinnedInstrumentIds();
    renderView();
  }

  function syncStickyOffset() {
    const topbar = document.querySelector('.topbar');
    const topbarPosition = topbar ? window.getComputedStyle(topbar).position : '';
    const topbarIsFixed = topbarPosition === 'sticky' || topbarPosition === 'fixed';
    const topbarHeight = topbar && topbarIsFixed ? Math.ceil(topbar.getBoundingClientRect().height) : 0;
    document.documentElement.style.setProperty('--sales-spread-sticky-offset', `${topbarHeight + 8}px`);
  }

  function instrumentIdFromText(value) {
    return normalizeInstrumentId(String(value || '').replace(/\//g, '-'));
  }

  function readInitialState() {
    const params = new URLSearchParams(window.location.search);
    const instrumentId = normalizeInstrumentId(params.get('instrumentId') || params.get('instrument') || params.get('market'));
    const historyInstrumentId = normalizeInstrumentId(params.get('historyInstrument'));
    const query = String(params.get('q') || '').trim();

    return {
      filterText: query || instrumentId,
      exchangeId: normalizeExchangeId(params.get('exchange') || params.get('exchangeId')),
      category: normalizeCategory(params.get('category')),
      historyWindow: normalizeHistoryWindow(params.get('historyWindow')),
      insightPeriod: normalizeInsightPeriod(params.get('insightPeriod') || params.get('insightWindow')),
      historyInstrumentId: historyInstrumentId || instrumentId || 'BTC-JPY',
    };
  }

  function writeUrlState() {
    const params = new URLSearchParams();
    const filterInstrumentId = instrumentIdFromText(filterText);
    if (filterInstrumentId) params.set('instrumentId', filterInstrumentId);
    else if (filterText) params.set('q', filterText);
    if (selectedExchange !== ALL_VALUE) params.set('exchange', selectedExchange);
    if (selectedCategory !== ALL_CATEGORY) params.set('category', selectedCategory);
    if (selectedHistoryInstrument && selectedHistoryInstrument !== 'BTC-JPY') {
      params.set('historyInstrument', selectedHistoryInstrument);
    }
    if (selectedHistoryWindow !== '30d') params.set('historyWindow', selectedHistoryWindow);
    if (selectedInsightPeriod !== '24h') params.set('insightPeriod', selectedInsightPeriod);
    const nextUrl = params.toString()
      ? `${window.location.pathname}?${params.toString()}`
      : window.location.pathname;
    window.history.replaceState(null, '', nextUrl);
  }

  function syncHistoryWindowButtons() {
    document.querySelectorAll('[data-spread-history-window]').forEach((button) => {
      const isActive = (button.dataset.spreadHistoryWindow || '') === selectedHistoryWindow;
      button.classList.toggle('active', isActive);
      button.setAttribute('aria-selected', isActive ? 'true' : 'false');
    });
  }

  function syncInsightPeriodButtons() {
    document.querySelectorAll('[data-spread-insight-period]').forEach((button) => {
      const isActive = (button.dataset.spreadInsightPeriod || '') === selectedInsightPeriod;
      button.classList.toggle('active', isActive);
      button.setAttribute('aria-selected', isActive ? 'true' : 'false');
    });
  }

  const initialState = readInitialState();
  filterText = initialState.filterText;
  selectedExchange = initialState.exchangeId;
  selectedCategory = initialState.category;
  selectedHistoryWindow = initialState.historyWindow;
  selectedInsightPeriod = initialState.insightPeriod;
  selectedHistoryInstrument = initialState.historyInstrumentId;
  pinnedInstrumentIds = readPinnedInstrumentIds();

  function formatDateForRange(value, { includeYear = false } = {}) {
    const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!match) return '';
    const [, year, month, day] = match;
    return includeYear ? `${year}/${month}/${day}` : `${month}/${day}`;
  }

  function laterDate(left, right) {
    const leftTime = Date.parse(left || '');
    const rightTime = Date.parse(right || '');
    if (!Number.isFinite(leftTime)) return right || left || '';
    if (!Number.isFinite(rightTime)) return left || right || '';
    return rightTime > leftTime ? right : left;
  }

  function dateRangeLabel(startDate, endDate) {
    if (!startDate || !endDate) return '';
    return `${formatDateForRange(startDate, { includeYear: true })} - ${formatDateForRange(endDate)}`;
  }

  const API_STATUS_LABELS = {
    success: '🟢 正常',
    partial: '🟡 確認中',
    failed: '🔴 取得できません',
    waiting: '🟡 確認中',
  };

  function qualityStatusCell(row) {
    const status = row.apiStatus || 'waiting';
    const label = API_STATUS_LABELS[status] || status;
    const note = status === 'success'
      ? ''
      : '<div class="quality-note">最新データを確認中です</div>';
    return `<span class="quality-badge quality-badge--${escapeHtml(status)}">${escapeHtml(label)}</span>${note}`;
  }

  function selectedOptionLabel(selectId, fallback) {
    const select = $(selectId);
    if (!select) return fallback;
    const option = select.selectedOptions && select.selectedOptions[0];
    return option ? option.textContent : fallback;
  }

  function chartColor(index) {
    return CHART_COLORS[index % CHART_COLORS.length];
  }

  function spreadTone(spreadPct) {
    const value = Number(spreadPct);
    if (!Number.isFinite(value)) return 'unknown';
    if (value <= 1.5) return 'low';
    if (value <= 3) return 'medium';
    return 'high';
  }

  function spreadMeterWidth(spreadPct) {
    const value = Number(spreadPct);
    if (!Number.isFinite(value)) return 0;
    return Math.max(6, Math.min(100, (value / 12) * 100));
  }

  function spreadMeterHtml(spreadPct) {
    const value = Number(spreadPct);
    if (!Number.isFinite(value)) return '';
    const width = spreadMeterWidth(value).toFixed(1);
    const tone = spreadTone(value);
    return `<span class="spread-meter spread-meter--${tone}" aria-hidden="true"><span class="spread-meter__bar" style="--spread-meter-width: ${width}%"></span></span>`;
  }

  function spreadCell(summary, precision) {
    if (!summary) return '<span class="text-gray-600">-</span>';
    return `
      <div class="spread-cost-cell">
        <div class="spread-cost-cell__amount spread-cost-cell__amount--main">${fmtJpyPrice(summary.spread, precision)}</div>
        <div class="spread-cost-cell__rate"><span>（${fmtPct(summary.spreadPct)}）</span>${spreadMeterHtml(summary.spreadPct)}</div>
      </div>
    `;
  }

  function latestSpreadCell(row) {
    const latest = row.latest;
    if (!latest) return '<span class="text-gray-600">-</span>';
    return `
      <div class="spread-cost-cell spread-cost-cell--current">
        <div class="spread-cost-cell__amount spread-cost-cell__amount--main">${fmtJpyPrice(latest.spread, latest.quotePrecision)}</div>
        <div class="spread-cost-cell__rate"><span>（${fmtPct(latest.spreadPct)}）</span>${spreadMeterHtml(latest.spreadPct)}</div>
      </div>
    `;
  }

  function rowKey(row) {
    return `${row.exchangeId || ''}|${row.instrumentId || ''}`;
  }

  function cellKey(row, field) {
    return `${rowKey(row)}:${field}`;
  }

  function numberOrNull(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  }

  function collectRowValues(row) {
    const latest = row.latest || {};
    const averages = row.averages || {};
    return {
      buyPrice: { value: numberOrNull(latest.buyPrice), positiveWhen: 'up' },
      sellPrice: { value: numberOrNull(latest.sellPrice), positiveWhen: 'up' },
      currentSpreadPct: { value: numberOrNull(latest.spreadPct), positiveWhen: 'down' },
      avg1dSpreadPct: { value: numberOrNull(averages['1d'] && averages['1d'].spreadPct), positiveWhen: 'down' },
      avg7dSpreadPct: { value: numberOrNull(averages['7d'] && averages['7d'].spreadPct), positiveWhen: 'down' },
      avg30dSpreadPct: { value: numberOrNull(averages['30d'] && averages['30d'].spreadPct), positiveWhen: 'down' },
    };
  }

  function updateFlashState(rows) {
    const nextSnapshot = new Map();
    const firstRun = previousValueSnapshot.size === 0;
    const now = Date.now();

    for (const row of rows || []) {
      const values = collectRowValues(row);
      Object.entries(values).forEach(([field, config]) => {
        const key = cellKey(row, field);
        if (config.value == null) return;
        nextSnapshot.set(key, config.value);
        const previous = previousValueSnapshot.get(key);
        if (firstRun || previous == null) return;
        const diff = config.value - previous;
        if (Math.abs(diff) <= FLASH_EPSILON) return;
        const positive = config.positiveWhen === 'up' ? diff > 0 : diff < 0;
        flashCells.set(key, {
          className: positive ? 'sales-spread-cell--flash-positive' : 'sales-spread-cell--flash-negative',
          expiresAt: now + FLASH_DURATION_MS,
        });
      });
    }

    previousValueSnapshot = nextSnapshot;
  }

  function cellFlashClass(row, field) {
    const flash = flashCells.get(cellKey(row, field));
    if (!flash) return '';
    if (flash.expiresAt < Date.now()) {
      flashCells.delete(cellKey(row, field));
      return '';
    }
    return flash.className;
  }

  function pinButtonHtml(row) {
    const instrumentId = normalizeInstrumentId(row.instrumentId);
    const pinned = isPinnedInstrument(instrumentId);
    const label = `${row.instrumentLabel || instrumentId}を${pinned ? 'ピン留め解除' : 'ピン留め'}`;
    return `
      <button class="sales-spread-pin ${pinned ? 'is-pinned' : ''}" type="button" data-spread-pin="${escapeHtml(instrumentId)}" aria-pressed="${pinned ? 'true' : 'false'}" aria-label="${escapeHtml(label)}">
        <span aria-hidden="true">${pinned ? '★' : '☆'}</span>
      </button>
    `;
  }

  function instrumentCellHtml(row) {
    return `
      <div class="sales-spread-instrument-cell">
        ${pinButtonHtml(row)}
        <div class="sales-spread-instrument-cell__copy">
          <a class="market-link" href="${marketPageUrl(row.instrumentId)}">${escapeHtml(row.instrumentLabel)}</a>
          <div class="text-[10px] text-gray-500">${escapeHtml(row.currencyFullName || row.baseCurrency)}</div>
        </div>
      </div>
    `;
  }

  function uniqueExchangeOptions(rows) {
    const byValue = new Map();
    for (const row of rows || []) {
      if (!row.exchangeId || byValue.has(row.exchangeId)) continue;
      byValue.set(row.exchangeId, {
        value: row.exchangeId,
        label: row.exchangeLabel || row.exchangeId,
      });
    }
    return Array.from(byValue.values())
      .sort((a, b) => String(a.label).localeCompare(String(b.label), 'ja'));
  }

  function populateExchangeFilter() {
    const select = $('spread-exchange-filter');
    if (!select) return;

    const options = uniqueExchangeOptions(allRows);
    const values = new Set(options.map(option => option.value));
    selectedExchange = values.has(selectedExchange) ? selectedExchange : ALL_VALUE;
    select.innerHTML = [
      `<option value="${ALL_VALUE}">すべて</option>`,
      ...options.map(option => `<option value="${escapeHtml(option.value)}">${escapeHtml(option.label)}</option>`),
    ].join('');
    select.value = selectedExchange;
  }

  function uniqueHistoryInstrumentOptions() {
    const byValue = new Map();
    for (const row of spreadHistoryRows.concat(allRows)) {
      if (!row.instrumentId || byValue.has(row.instrumentId)) continue;
      byValue.set(row.instrumentId, {
        value: row.instrumentId,
        label: row.instrumentLabel || row.instrumentId,
      });
    }

    return Array.from(byValue.values())
      .sort((a, b) => {
        if (a.value === 'BTC-JPY') return -1;
        if (b.value === 'BTC-JPY') return 1;
        return String(a.label).localeCompare(String(b.label), 'ja');
      });
  }

  function populateHistoryInstrumentFilter() {
    const select = $('spread-history-instrument');
    if (!select) return false;

    const options = uniqueHistoryInstrumentOptions();
    const values = new Set(options.map(option => option.value));
    const previousValue = selectedHistoryInstrument;
    if (!values.has(selectedHistoryInstrument)) {
      selectedHistoryInstrument = values.has('BTC-JPY') ? 'BTC-JPY' : (options[0] && options[0].value) || 'BTC-JPY';
    }

    select.innerHTML = options.length > 0
      ? options.map(option => `<option value="${escapeHtml(option.value)}">${escapeHtml(option.label)}</option>`).join('')
      : '<option value="BTC-JPY">BTC/JPY</option>';
    select.value = selectedHistoryInstrument;
    return previousValue !== selectedHistoryInstrument;
  }

  function hasActiveFilters() {
    return Boolean(filterText) || selectedExchange !== ALL_VALUE || selectedCategory !== ALL_CATEGORY;
  }

  function rowBaseCurrency(row) {
    const baseCurrency = String(row.baseCurrency || '').trim().toUpperCase();
    if (baseCurrency) return baseCurrency;
    return String(row.instrumentId || '').split('-')[0].trim().toUpperCase();
  }

  function rowMatchesCategory(row) {
    const category = QUICK_FILTERS[selectedCategory] || QUICK_FILTERS[ALL_CATEGORY];
    if (!category.currencies) return true;
    return category.currencies.has(rowBaseCurrency(row));
  }

  function rowMatchesFilter(row) {
    const matchesExchange = selectedExchange === ALL_VALUE || row.exchangeId === selectedExchange;
    if (!matchesExchange) return false;
    if (!rowMatchesCategory(row)) return false;
    if (!filterText) return true;

    const needle = filterText.toLowerCase();
    return [
      row.instrumentLabel,
      row.instrumentId,
      row.baseCurrency,
      row.currencyFullName,
      row.exchangeLabel,
    ].some(value => String(value || '').toLowerCase().includes(needle));
  }

  function getFilteredRows() {
    return sortRowsForView(allRows.filter(rowMatchesFilter));
  }

  function sortSpreadValue(row) {
    const average24h = row.averages && row.averages['1d'];
    const value = average24h ? average24h.spreadPct : row.latest && row.latest.spreadPct;
    return Number.isFinite(Number(value)) ? Number(value) : Infinity;
  }

  function sortNarrowestSpread(a, b) {
    const spreadDiff = sortSpreadValue(a) - sortSpreadValue(b);
    if (spreadDiff !== 0) return spreadDiff;
    if (a.instrumentId !== b.instrumentId) return a.instrumentId.localeCompare(b.instrumentId);
    return a.exchangeId.localeCompare(b.exchangeId);
  }

  function compareText(left, right) {
    return String(left || '').localeCompare(String(right || ''), 'ja', { numeric: true, sensitivity: 'base' });
  }

  function numberForSort(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  }

  function compareByActiveSort(a, b) {
    const accessor = SORT_ACCESSORS[sortState.key] || SORT_ACCESSORS.currentSpreadPct;
    let result = 0;

    if (accessor.type === 'number') {
      const left = numberForSort(accessor.get(a));
      const right = numberForSort(accessor.get(b));
      if (left == null && right != null) result = 1;
      else if (left != null && right == null) result = -1;
      else if (left != null && right != null) result = left - right;
    } else {
      result = compareText(accessor.get(a), accessor.get(b));
    }

    if (result !== 0) return sortState.direction === 'desc' ? -result : result;
    if (a.instrumentId !== b.instrumentId) return compareText(a.instrumentId, b.instrumentId);
    return compareText(a.exchangeId, b.exchangeId);
  }

  function sortRowsForView(rows) {
    return rows.slice().sort((a, b) => {
      const aPinned = isPinnedInstrument(a.instrumentId);
      const bPinned = isPinnedInstrument(b.instrumentId);
      if (aPinned !== bPinned) return aPinned ? -1 : 1;
      return compareByActiveSort(a, b);
    });
  }

  function sortDirectionForNext(key) {
    if (sortState.key !== key) return key === 'instrument' || key === 'exchange' ? 'asc' : 'asc';
    return sortState.direction === 'asc' ? 'desc' : 'asc';
  }

  function syncSortHeaders() {
    document.querySelectorAll('[data-sales-spread-sort]').forEach((button) => {
      const key = button.dataset.salesSpreadSort;
      const isActive = key === sortState.key;
      const indicator = button.querySelector('.sales-spread-sort-indicator');
      const th = button.closest('th');
      button.classList.toggle('is-active', isActive);
      button.setAttribute('aria-pressed', isActive ? 'true' : 'false');
      if (indicator) indicator.textContent = isActive ? (sortState.direction === 'asc' ? '↑' : '↓') : '↕';
      if (th) {
        th.setAttribute('aria-sort', isActive ? (sortState.direction === 'asc' ? 'ascending' : 'descending') : 'none');
      }
    });
  }

  function syncQuickFilterButtons() {
    document.querySelectorAll('[data-spread-category]').forEach((button) => {
      const isActive = normalizeCategory(button.dataset.spreadCategory) === selectedCategory;
      button.classList.toggle('is-active', isActive);
      button.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    });
  }

  function averageNumber(values) {
    let total = 0;
    let count = 0;

    for (const value of values || []) {
      const number = Number(value);
      if (!Number.isFinite(number)) continue;
      total += number;
      count += 1;
    }

    return count > 0 ? total / count : null;
  }

  function formatVenueCount(count) {
    const value = Number(count) || 0;
    return `${value}販売所`;
  }

  function formatSignedPct(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) return '-';
    const sign = number > 0 ? '+' : '';
    return `${sign}${number.toFixed(2)}%`;
  }

  function simulatorUrl(instrumentId) {
    const normalized = String(instrumentId || 'BTC-JPY').trim().toUpperCase() || 'BTC-JPY';
    return `/simulator?market=${encodeURIComponent(normalized)}&side=buy&amountType=jpy&amount=100000`;
  }

  function currentSpreadValueClass(spreadPct) {
    const value = Number(spreadPct);
    if (!Number.isFinite(value)) return '';
    if (value <= 1.5) return 'spread-ranking-item__value--positive';
    if (value <= 3) return 'spread-ranking-item__value--caution';
    return 'spread-ranking-item__value--danger';
  }

  function getCurrentSpread(row) {
    const latest = row && row.latest;
    if (!latest) return null;

    const spreadPct = Number(latest.spreadPct);
    if (!Number.isFinite(spreadPct)) return null;

    const spread = Number(latest.spread);
    return {
      spread: Number.isFinite(spread) ? spread : null,
      spreadPct,
      quotePrecision: Number.isFinite(Number(latest.quotePrecision)) ? Number(latest.quotePrecision) : null,
    };
  }

  function getAverageSpread(row, windowKey) {
    const summary = row && row.averages && row.averages[windowKey];
    if (!summary) return null;

    const spreadPct = Number(summary.spreadPct);
    if (!Number.isFinite(spreadPct)) return null;

    const spread = Number(summary.spread);
    return {
      spread: Number.isFinite(spread) ? spread : null,
      spreadPct,
      sampleCount: Number(summary.sampleCount) || 0,
    };
  }

  function getSummarySpread(row) {
    return getCurrentSpread(row) || getAverageSpread(row, '1d');
  }

  function spreadHighlightLabel(row) {
    const summary = getSummarySpread(row);
    if (!summary) return '-';
    return `${row.instrumentLabel} / ${row.exchangeLabel} ${fmtPct(summary.spreadPct)}`;
  }

  function buildInstrumentSummaries(rows) {
    const grouped = new Map();

    for (const row of rows || []) {
      if (!row.instrumentId) continue;

      if (!grouped.has(row.instrumentId)) {
        grouped.set(row.instrumentId, {
          instrumentId: row.instrumentId,
          instrumentLabel: row.instrumentLabel || row.instrumentId,
          baseCurrency: row.baseCurrency,
          currencyFullName: row.currencyFullName,
          currentEntries: [],
          averageEntries7d: [],
          averageEntries30d: [],
        });
      }

      const item = grouped.get(row.instrumentId);
      const current = getCurrentSpread(row);
      if (current) {
        item.currentEntries.push({
          exchangeId: row.exchangeId,
          exchangeLabel: row.exchangeLabel || row.exchangeId,
          spread: current.spread,
          spreadPct: current.spreadPct,
        });
      }

      const average7d = getAverageSpread(row, '7d');
      if (average7d) item.averageEntries7d.push(average7d);

      const average30d = getAverageSpread(row, '30d');
      if (average30d) item.averageEntries30d.push(average30d);
    }

    return Array.from(grouped.values())
      .map((item) => {
        const currentEntries = item.currentEntries
          .slice()
          .sort((a, b) => a.spreadPct - b.spreadPct);
        const currentSpreadPct = averageNumber(currentEntries.map(entry => entry.spreadPct));
        const average7dSpreadPct = averageNumber(item.averageEntries7d.map(entry => entry.spreadPct));
        const average30dSpreadPct = averageNumber(item.averageEntries30d.map(entry => entry.spreadPct));

        return {
          instrumentId: item.instrumentId,
          instrumentLabel: item.instrumentLabel,
          baseCurrency: item.baseCurrency,
          currencyFullName: item.currencyFullName,
          current: Number.isFinite(currentSpreadPct)
            ? {
              spread: averageNumber(currentEntries.map(entry => entry.spread)),
              spreadPct: currentSpreadPct,
              venueCount: currentEntries.length,
            }
            : null,
          averages: {
            '7d': Number.isFinite(average7dSpreadPct)
              ? {
                spread: averageNumber(item.averageEntries7d.map(entry => entry.spread)),
                spreadPct: average7dSpreadPct,
                venueCount: item.averageEntries7d.length,
              }
              : null,
            '30d': Number.isFinite(average30dSpreadPct)
              ? {
                spread: averageNumber(item.averageEntries30d.map(entry => entry.spread)),
                spreadPct: average30dSpreadPct,
                venueCount: item.averageEntries30d.length,
              }
              : null,
          },
          narrowestExchange: currentEntries[0] || null,
          widestExchange: currentEntries[currentEntries.length - 1] || null,
        };
      })
      .sort((a, b) => String(a.instrumentLabel || a.instrumentId).localeCompare(String(b.instrumentLabel || b.instrumentId), 'ja'));
  }

  function buildExchangeSummaries(rows) {
    const grouped = new Map();

    for (const row of rows || []) {
      const current = getCurrentSpread(row);
      if (!current || !row.exchangeId) continue;

      if (!grouped.has(row.exchangeId)) {
        grouped.set(row.exchangeId, {
          exchangeId: row.exchangeId,
          exchangeLabel: row.exchangeLabel || row.exchangeId,
          currentEntries: [],
        });
      }

      grouped.get(row.exchangeId).currentEntries.push({
        instrumentId: row.instrumentId,
        instrumentLabel: row.instrumentLabel || row.instrumentId,
        spread: current.spread,
        spreadPct: current.spreadPct,
      });
    }

    return Array.from(grouped.values())
      .map((item) => {
        const currentEntries = item.currentEntries
          .slice()
          .sort((a, b) => a.spreadPct - b.spreadPct);
        const currentSpreadPct = averageNumber(currentEntries.map(entry => entry.spreadPct));

        if (!Number.isFinite(currentSpreadPct)) return null;

        return {
          exchangeId: item.exchangeId,
          exchangeLabel: item.exchangeLabel,
          current: {
            spread: averageNumber(currentEntries.map(entry => entry.spread)),
            spreadPct: currentSpreadPct,
            instrumentCount: currentEntries.length,
          },
          narrowestInstrument: currentEntries[0] || null,
          widestInstrument: currentEntries[currentEntries.length - 1] || null,
        };
      })
      .filter(Boolean)
      .sort((a, b) => {
        const spreadDiff = a.current.spreadPct - b.current.spreadPct;
        if (spreadDiff !== 0) return spreadDiff;
        return String(a.exchangeLabel || a.exchangeId).localeCompare(String(b.exchangeLabel || b.exchangeId), 'ja');
      });
  }

  function renderRankingList(listId, items, emptyMessage) {
    const list = $(listId);
    if (!list) return;

    if (!items || items.length === 0) {
      list.innerHTML = `<li class="spread-ranking-empty">${escapeHtml(emptyMessage)}</li>`;
      return;
    }

    list.innerHTML = items.map((item, index) => `
      <li class="spread-ranking-item">
        <div class="spread-ranking-item__rank">${index + 1}</div>
        <div class="spread-ranking-item__copy">
          <div class="spread-ranking-item__topline">
            <div>
              <div class="spread-ranking-item__title">
                ${item.titleHref
                  ? `<a href="${item.titleHref}">${escapeHtml(item.title)}</a>`
                  : escapeHtml(item.title)}
              </div>
              <div class="spread-ranking-item__subtitle">${escapeHtml(item.subtitle || '')}</div>
            </div>
            <div class="spread-ranking-item__metric">
              <div class="spread-ranking-item__value ${escapeHtml(item.valueClass || '')}">${escapeHtml(item.value || '-')}</div>
              <div class="spread-ranking-item__note">${escapeHtml(item.note || '')}</div>
            </div>
          </div>
          <div class="spread-ranking-item__footer">
            <span class="spread-ranking-item__delta">${escapeHtml(item.delta || '')}</span>
            ${item.actionHref
              ? `<a class="comparison-row-link" href="${item.actionHref}">${escapeHtml(item.actionLabel || '詳細を見る')}</a>`
              : ''}
          </div>
        </div>
      </li>
    `).join('');
  }

  function renderOrderbookSuggestions(items) {
    const container = $('spread-orderbook-links');
    const badge = $('spread-orderbook-badge');
    if (!container) return;

    if (!items || items.length === 0) {
      container.innerHTML = '<p class="spread-orderbook-empty">取引所（ユーザー間取引）の比較に進める候補はまだありません。</p>';
      setText('spread-orderbook-meta', '現在値の比較データが揃うと、取引所（板取引）の価格も確認したい銘柄を表示します。');
      if (badge) {
        badge.className = 'decision-summary-badge decision-summary-badge--loading';
        badge.textContent = '候補待ち';
      }
      return;
    }

    const suggestions = items.slice(0, ORDERBOOK_SUGGESTION_LIMIT);
    container.innerHTML = suggestions.map((item) => {
      const widestPct = item.widestExchange ? fmtPct(item.widestExchange.spreadPct) : null;
      const widestExchangeLabel = item.widestExchange ? item.widestExchange.exchangeLabel : null;
      const description = widestPct
        ? `販売所のスプレッドが非常に広いため（最大 ${widestPct}）、取引所（板取引）の価格と比べてみましょう。`
        : `販売所平均は ${fmtPct(item.current.spreadPct)} です。取引所（板取引）の価格と比べてみましょう。`;
      const note = widestExchangeLabel
        ? `最も広い販売所: ${widestExchangeLabel} / 販売所平均 ${fmtPct(item.current.spreadPct)}`
        : `販売所平均 ${fmtPct(item.current.spreadPct)}`;
      const href = simulatorUrl(item.instrumentId);
      return [
        '<article class="market-context-card spread-orderbook-suggestion">',
        '  <span class="market-context-card__eyebrow">購入前チェック</span>',
        `  <a class="market-context-card__title spread-orderbook-suggestion__title" href="${href}">${escapeHtml(item.instrumentLabel)} の板取引価格を見る</a>`,
        `  <p class="market-context-card__description">${escapeHtml(description)}</p>`,
        `  <span class="spread-orderbook-suggestion__note">${escapeHtml(note)}</span>`,
        '  <span class="market-context-card__cta">板取引の価格を見る</span>',
        '</article>',
      ].join('\n');
    }).join('');

    setText('spread-orderbook-meta', `スプレッドが広い銘柄は、ユーザー同士で売買する「取引所（板取引）」を使うことでコストを抑えられる可能性があります。以下の${suggestions.length}銘柄で価格差を確認できます。`);
    if (badge) {
      badge.className = 'decision-summary-badge decision-summary-badge--ready';
      badge.textContent = `${suggestions.length}銘柄`;
    }
  }

  function buildInstrumentRankingItems(instrumentSummaries) {
    const currentItems = instrumentSummaries
      .filter(item => item.current && Number.isFinite(Number(item.current.spreadPct)));
    const narrowSources = currentItems
      .slice()
      .sort((a, b) => a.current.spreadPct - b.current.spreadPct)
      .slice(0, TOP_RANKING_LIMIT);
    const narrow = narrowSources.map(item => ({
        title: item.instrumentLabel,
        titleHref: marketPageUrl(item.instrumentId),
        subtitle: `${formatVenueCount(item.current.venueCount)}平均`,
        value: fmtPct(item.current.spreadPct),
        valueClass: currentSpreadValueClass(item.current.spreadPct),
        note: '現在平均',
        delta: item.narrowestExchange && item.widestExchange
          ? `最狭 ${item.narrowestExchange.exchangeLabel} ${fmtPct(item.narrowestExchange.spreadPct)} / 最広 ${item.widestExchange.exchangeLabel} ${fmtPct(item.widestExchange.spreadPct)}`
          : '現在値ベース',
        actionHref: marketPageUrl(item.instrumentId),
        actionLabel: '板取引の価格を見る',
      }));

    const wideSources = currentItems
      .slice()
      .sort((a, b) => b.current.spreadPct - a.current.spreadPct)
      .slice(0, TOP_RANKING_LIMIT);
    const wide = wideSources.map(item => ({
        title: item.instrumentLabel,
        titleHref: marketPageUrl(item.instrumentId),
        subtitle: `${formatVenueCount(item.current.venueCount)}平均`,
        value: fmtPct(item.current.spreadPct),
        valueClass: 'spread-ranking-item__value--danger',
        note: '現在平均',
        delta: item.widestExchange
          ? `最も広い販売所 ${item.widestExchange.exchangeLabel} ${fmtPct(item.widestExchange.spreadPct)}`
          : '現在値ベース',
        actionHref: marketPageUrl(item.instrumentId),
        actionLabel: '板取引の価格を見る',
      }));

    const widerThan7dSources = currentItems
      .filter(item => item.averages['7d'] && Number.isFinite(Number(item.averages['7d'].spreadPct)))
      .map(item => ({
        item,
        diff: item.current.spreadPct - item.averages['7d'].spreadPct,
      }))
      .filter(entry => entry.diff > 0)
      .sort((a, b) => b.diff - a.diff)
      .slice(0, TOP_RANKING_LIMIT);
    const widerThan7d = widerThan7dSources.map(({ item, diff }) => ({
        title: item.instrumentLabel,
        titleHref: marketPageUrl(item.instrumentId),
        subtitle: `${formatVenueCount(item.current.venueCount)}平均`,
        value: formatSignedPct(diff),
        valueClass: 'spread-ranking-item__value--danger',
        note: `現在 ${fmtPct(item.current.spreadPct)}（7日平均 ${fmtPct(item.averages['7d'].spreadPct)}）`,
        delta: '7日平均より広がっています',
        actionHref: marketPageUrl(item.instrumentId),
        actionLabel: '板取引の価格を見る',
      }));

    const improvedFrom30dSources = currentItems
      .filter(item => item.averages['30d'] && Number.isFinite(Number(item.averages['30d'].spreadPct)))
      .map(item => ({
        item,
        diff: item.averages['30d'].spreadPct - item.current.spreadPct,
      }))
      .filter(entry => entry.diff > 0)
      .sort((a, b) => b.diff - a.diff)
      .slice(0, TOP_RANKING_LIMIT);
    const improvedFrom30d = improvedFrom30dSources.map(({ item, diff }) => ({
        title: item.instrumentLabel,
        titleHref: marketPageUrl(item.instrumentId),
        subtitle: `${formatVenueCount(item.current.venueCount)}平均`,
        value: formatSignedPct(item.current.spreadPct - item.averages['30d'].spreadPct),
        valueClass: 'spread-ranking-item__value--positive',
        note: `現在 ${fmtPct(item.current.spreadPct)}（30日平均 ${fmtPct(item.averages['30d'].spreadPct)}）`,
        delta: '30日平均より改善しています',
        actionHref: marketPageUrl(item.instrumentId),
        actionLabel: '板取引の価格を見る',
      }));

    return {
      narrow,
      wide,
      widerThan7d,
      improvedFrom30d,
      wideSources,
      currentItemCount: currentItems.length,
    };
  }

  function buildExchangeRankingItems(exchangeSummaries) {
    return exchangeSummaries.map(item => ({
      title: item.exchangeLabel,
      titleHref: exchangePageUrl(item.exchangeId),
      subtitle: `${item.current.instrumentCount}銘柄平均`,
      value: fmtPct(item.current.spreadPct),
      valueClass: currentSpreadValueClass(item.current.spreadPct),
      note: '現在平均',
      delta: item.narrowestInstrument && item.widestInstrument
        ? `最狭 ${item.narrowestInstrument.instrumentLabel} ${fmtPct(item.narrowestInstrument.spreadPct)} / 最広 ${item.widestInstrument.instrumentLabel} ${fmtPct(item.widestInstrument.spreadPct)}`
        : '集計中',
      actionHref: exchangePageUrl(item.exchangeId),
      actionLabel: 'この取引所の詳細を見る',
    }));
  }

  function renderRankings(rows) {
    const instrumentSummaries = buildInstrumentSummaries(rows);
    const exchangeSummaries = buildExchangeSummaries(rows);
    const instrumentItems = buildInstrumentRankingItems(instrumentSummaries);
    const exchangeItems = buildExchangeRankingItems(exchangeSummaries);
    const scopeLabel = hasActiveFilters() ? 'フィルター内 ' : '国内';

    setText(
      'spread-ranking-summary',
      `（対象: ${scopeLabel}${exchangeItems.length}取引所 / ${instrumentItems.currentItemCount}銘柄）`
    );

    renderRankingList('spread-ranking-narrow-list', instrumentItems.narrow, '現在値を比較できる銘柄がありません。');
    renderRankingList('spread-ranking-wide-list', instrumentItems.wide, '現在値を比較できる銘柄がありません。');
    renderRankingList('spread-ranking-wider7-list', instrumentItems.widerThan7d, '7日平均より広がっている銘柄はありません。');
    renderRankingList('spread-ranking-improved30-list', instrumentItems.improvedFrom30d, '30日平均より改善している銘柄はありません。');
    renderRankingList('spread-ranking-exchange-list', exchangeItems, '取引所別平均の計算対象がありません。');
    renderOrderbookSuggestions(instrumentItems.wideSources);
  }

  function renderMajorDashboard() {
    const container = $('spread-major-cards');
    if (!container) return;

    const scopedRows = allRows.filter(row => selectedExchange === ALL_VALUE || row.exchangeId === selectedExchange);
    const cards = MAIN_INSTRUMENT_IDS.map((instrumentId) => {
      const rows = scopedRows
        .filter(row => row.instrumentId === instrumentId)
        .map(row => ({ row, summary: getSummarySpread(row) }))
        .filter(item => item.summary)
        .sort((a, b) => a.summary.spreadPct - b.summary.spreadPct);
      const best = rows[0] || null;
      const widest = rows[rows.length - 1] || null;
      const label = best ? best.row.instrumentLabel : instrumentId.replace(/-/g, '/');
      const average = averageNumber(rows.map(item => item.summary.spreadPct));
      const href = simulatorUrl(instrumentId);

      if (!best) {
        return `
          <article class="spread-major-card">
            <div class="spread-major-card__head">
              <span class="spread-major-card__symbol">${escapeHtml(label)}</span>
              <span class="spread-major-card__badge">データ待ち</span>
            </div>
            <div class="spread-major-card__value">-</div>
            <p class="spread-major-card__meta">販売所価格を確認中です。</p>
            <a class="comparison-row-link" href="${href}">板取引の価格を見る</a>
          </article>
        `;
      }

      return `
        <article class="spread-major-card spread-major-card--${spreadTone(best.summary.spreadPct)}">
          <div class="spread-major-card__head">
            <span class="spread-major-card__symbol">${escapeHtml(label)}</span>
            <span class="spread-major-card__badge">最狭 ${escapeHtml(best.row.exchangeLabel)}</span>
          </div>
          <div class="spread-major-card__value">${fmtPct(best.summary.spreadPct)}</div>
          <div class="spread-major-card__meter">${spreadMeterHtml(best.summary.spreadPct)}</div>
          <p class="spread-major-card__meta">
            平均 ${Number.isFinite(Number(average)) ? fmtPct(average) : '-'} / 最広 ${widest ? `${escapeHtml(widest.row.exchangeLabel)} ${fmtPct(widest.summary.spreadPct)}` : '-'}
          </p>
          <a class="comparison-row-link" href="${href}">板取引の価格を見る</a>
        </article>
      `;
    });

    container.innerHTML = cards.join('');
    setText(
      'spread-major-dashboard-badge',
      selectedExchange === ALL_VALUE ? '主要3銘柄' : selectedOptionLabel('spread-exchange-filter', selectedExchange)
    );
  }

  function renderMobileRows(rows) {
    const container = $('sales-spread-mobile-list');
    if (!container) return;

    if (rows.length === 0) {
      const message = hasActiveFilters() ? EMPTY_FILTER_MESSAGE : WAITING_DATA_MESSAGE;
      container.innerHTML = `<p class="spread-ranking-empty">${escapeHtml(message)}</p>`;
      return;
    }

    container.innerHTML = rows.map((row) => {
      const latest = row.latest || {};
      const averages = row.averages || {};
      const precision = latest.quotePrecision ?? null;
      const currentPct = Number(latest.spreadPct);
      const currentLabel = Number.isFinite(currentPct) ? fmtPct(currentPct) : '-';
      const pinned = isPinnedInstrument(row.instrumentId);
      return `
        <details class="sales-spread-mobile-card ${pinned ? 'is-pinned' : ''}">
          <summary class="sales-spread-mobile-card__summary">
            <span class="sales-spread-mobile-card__asset">
              ${pinButtonHtml(row)}
              <span>
                <span class="sales-spread-mobile-card__name">${escapeHtml(row.instrumentLabel)}</span>
                <span class="sales-spread-mobile-card__currency">${escapeHtml(row.currencyFullName || row.baseCurrency || '')}</span>
              </span>
            </span>
            <span class="sales-spread-mobile-card__exchange">${escapeHtml(row.exchangeLabel)}</span>
            <span class="sales-spread-mobile-card__current ${cellFlashClass(row, 'currentSpreadPct')}">
              <span>${currentLabel}</span>
              ${spreadMeterHtml(latest.spreadPct)}
            </span>
          </summary>
          <div class="sales-spread-mobile-card__detail">
            <div class="sales-spread-mobile-card__metrics">
              <div class="${cellFlashClass(row, 'buyPrice')}"><span>買値</span><strong>${fmtJpyPrice(latest.buyPrice, precision)}</strong></div>
              <div class="${cellFlashClass(row, 'sellPrice')}"><span>売値</span><strong>${fmtJpyPrice(latest.sellPrice, precision)}</strong></div>
              <div class="${cellFlashClass(row, 'avg1dSpreadPct')}"><span>24時間平均</span><div class="sales-spread-mobile-card__metric-value">${spreadCell(averages['1d'], precision)}</div></div>
              <div class="${cellFlashClass(row, 'avg7dSpreadPct')}"><span>7日間平均</span><div class="sales-spread-mobile-card__metric-value">${spreadCell(averages['7d'], precision)}</div></div>
              <div class="${cellFlashClass(row, 'avg30dSpreadPct')}"><span>30日間平均</span><div class="sales-spread-mobile-card__metric-value">${spreadCell(averages['30d'], precision)}</div></div>
            </div>
            <a class="btn btn-secondary sales-spread-mobile-card__action" href="${simulatorUrl(row.instrumentId)}">板取引の価格を見る</a>
          </div>
        </details>
      `;
    }).join('');
  }

  function renderRows(rows) {
    const tbody = $('sales-spread-tbody');
    if (!tbody) {
      renderMobileRows(rows);
      return;
    }

    if (rows.length === 0) {
      const message = hasActiveFilters() ? EMPTY_FILTER_MESSAGE : WAITING_DATA_MESSAGE;
      tbody.innerHTML = `<tr><td colspan="8" class="text-center text-gray-500 py-4">${escapeHtml(message)}</td></tr>`;
      renderMobileRows(rows);
      return;
    }

    tbody.innerHTML = rows.map(row => {
      const latest = row.latest || {};
      const averages = row.averages || {};
      const precision = latest.quotePrecision ?? null;
      const pinned = isPinnedInstrument(row.instrumentId);
      return `
        <tr class="border-b border-gray-800/60 ${pinned ? 'sales-spread-row--pinned' : ''}">
          <td data-label="銘柄">
            ${instrumentCellHtml(row)}
          </td>
          <td class="text-gray-300" data-label="取引所">${escapeHtml(row.exchangeLabel)}</td>
          <td class="is-num text-right font-mono text-red-300 ${cellFlashClass(row, 'buyPrice')}" data-label="買値">${fmtJpyPrice(latest.buyPrice, precision)}</td>
          <td class="is-num text-right font-mono text-green-300 ${cellFlashClass(row, 'sellPrice')}" data-label="売値">${fmtJpyPrice(latest.sellPrice, precision)}</td>
          <td class="is-num text-right ${cellFlashClass(row, 'currentSpreadPct')}" data-label="現在のスプレッド">${latestSpreadCell(row)}</td>
          <td class="is-num text-right ${cellFlashClass(row, 'avg1dSpreadPct')}" data-label="24時間平均">${spreadCell(averages['1d'], precision)}</td>
          <td class="is-num text-right ${cellFlashClass(row, 'avg7dSpreadPct')}" data-label="7日間平均">${spreadCell(averages['7d'], precision)}</td>
          <td class="is-num text-right ${cellFlashClass(row, 'avg30dSpreadPct')}" data-label="30日間平均">${spreadCell(averages['30d'], precision)}</td>
        </tr>
      `;
    }).join('');
    renderMobileRows(rows);
  }

  function renderQualityRows(qualityRows) {
    const tbody = $('spread-quality-tbody');
    if (!tbody) return;

    const rows = (qualityRows || []).filter(row => (
      selectedExchange === ALL_VALUE || row.exchangeId === selectedExchange
    ));
    if (rows.length === 0) {
      tbody.innerHTML = `<tr><td colspan="3" class="text-center text-gray-500 py-4">${WAITING_DATA_MESSAGE}</td></tr>`;
      setText('spread-quality-meta', '公式の最新データを確認中です。');
      return;
    }

    const issueCount = rows.filter(row => row.apiStatus === 'partial' || row.apiStatus === 'failed').length;
    const statusLabel = issueCount > 0
      ? (selectedExchange === ALL_VALUE
        ? `全${rows.length}取引所のうち、${issueCount}取引所のデータ取得を確認中です。取得できた公式データをもとに表示しています。`
        : '選択中の取引所のデータ取得を確認中です。取得できた公式データをもとに表示しています。')
      : (selectedExchange === ALL_VALUE
        ? `全${rows.length}取引所から、公式の最新データを正常に取得しています。`
        : '選択中の取引所から、公式の最新データを正常に取得しています。');
    setText(
      'spread-quality-meta',
      statusLabel
    );

    tbody.innerHTML = rows.map(row => `
      <tr class="border-b border-gray-800/60">
        <td class="font-bold text-gray-200" data-label="取引所">${escapeHtml(row.exchangeLabel || row.exchangeId)}</td>
        <td class="text-gray-300" data-label="ステータス">${qualityStatusCell(row)}</td>
        <td class="is-num text-right font-mono text-gray-300" data-label="データ取得日時">
          ${escapeHtml(fmtDateTime(row.lastFetchedAt || row.lastSourceAt))}
        </td>
      </tr>
    `).join('');
  }

  function renderTopDecision(narrowest, widest, comparableCount) {
    const badge = $('spread-decision-badge');
    const cta = $('spread-top-cta');
    const hasComparableRows = comparableCount > 0;

    if (badge) {
      badge.className = `decision-summary-badge decision-summary-badge--${hasComparableRows ? 'ready' : 'loading'}`;
      badge.textContent = hasComparableRows
        ? (hasActiveFilters() ? 'フィルター反映' : '比較済み')
        : '読み込み中';
    }

    if (!hasComparableRows) {
      setText('spread-top-candidate', 'データ待ち');
      setText('spread-top-candidate-meta', hasActiveFilters() ? EMPTY_FILTER_MESSAGE : WAITING_DATA_MESSAGE);
      setText('spread-top-caution', '広い銘柄も確認');
      setText('spread-top-caution-meta', '表示価格は参考値です');
      setText('spread-top-note', 'スプレッドデータを取得できた販売所から順に比較します。');
      if (cta) {
        cta.href = '/simulator?market=BTC-JPY&side=buy&amountType=jpy&amount=100000';
        cta.textContent = 'BTC/JPYの板取引価格を見る';
      }
      return;
    }

    const narrowSummary = narrowest && narrowest.summary;
    const wideSummary = widest && widest.summary;
    setText(
      'spread-top-candidate',
      narrowest ? `${narrowest.row.instrumentLabel} / ${narrowest.row.exchangeLabel}` : 'データ待ち'
    );
    setText(
      'spread-top-candidate-meta',
      narrowSummary ? `現在 ${fmtPct(narrowSummary.spreadPct)} | ${narrowSummary.spread != null ? fmtJpyPrice(narrowSummary.spread, narrowSummary.quotePrecision) : '差額未取得'}` : '販売所価格を集計中'
    );
    setText(
      'spread-top-caution',
      widest ? `${widest.row.instrumentLabel} / ${widest.row.exchangeLabel}` : '広い銘柄も確認'
    );
    setText(
      'spread-top-caution-meta',
      wideSummary ? `最大 ${fmtPct(wideSummary.spreadPct)} | 板取引の価格も比較` : '表示価格は参考値です'
    );
    setText(
      'spread-top-note',
      widest
        ? `${widest.row.instrumentLabel} などのコストが高い銘柄は、「取引所（ユーザー間取引）」も検討してみてください。`
        : 'コストが高い銘柄は、「取引所（ユーザー間取引）」も検討してみてください。'
    );

    if (cta) {
      const instrumentId = narrowest && narrowest.row.instrumentId ? narrowest.row.instrumentId : 'BTC-JPY';
      const label = narrowest && narrowest.row.instrumentLabel ? narrowest.row.instrumentLabel : instrumentId.replace(/-/g, '/');
      cta.href = simulatorUrl(instrumentId);
      cta.textContent = `${label}の板取引価格を見る`;
    }
  }

  function renderSummary(rows) {
    const rowsWithSpread = rows
      .map(row => ({ row, summary: getSummarySpread(row) }))
      .filter(item => item.summary);
    const narrowest = rowsWithSpread
      .slice()
      .sort((a, b) => a.summary.spreadPct - b.summary.spreadPct)[0];
    const widest = rowsWithSpread
      .slice()
      .sort((a, b) => b.summary.spreadPct - a.summary.spreadPct)[0];
    const status = latestMeta.refreshStatus || {};

    setText('narrowest-spread', narrowest ? spreadHighlightLabel(narrowest.row) : '-');
    setText('widest-spread', widest ? spreadHighlightLabel(widest.row) : '-');
    renderTopDecision(narrowest, widest, rowsWithSpread.length);
    setText('spread-status', status.running || allRows.length > 0 ? 'リアルタイムデータ' : 'データ取得中');
    setText('spread-updated-at', fmtDateTime(latestMeta.latestCapturedAt || latestMeta.generatedAt));
  }

  function renderMeta() {
    const windows = latestMeta.windows || {};
    const window30d = windows['30d'] || {};
    const rangeLabel = dateRangeLabel(window30d.earliestSpreadDateJst, window30d.latestSpreadDateJst);

    setText(
      'spread-meta',
      rangeLabel
        ? `📊 集計対象期間：過去30日間（${rangeLabel}）`
        : '📊 集計対象期間：過去30日間を確認中'
    );
  }

  function renderView() {
    const rows = getFilteredRows();
    renderMajorDashboard();
    renderSummary(rows);
    renderMeta();
    renderRankings(rows);
    renderRows(rows);
    renderQualityRows(latestMeta.quality || []);
    syncSortHeaders();
    syncQuickFilterButtons();
    writeUrlState();
  }

  function render(data) {
    latestMeta = data.meta || {};
    latestMeta.quality = data.quality || [];
    updateFlashState(data.rows || []);
    allRows = data.rows || [];
    populateExchangeFilter();
    const historyInstrumentChanged = populateHistoryInstrumentFilter();
    renderView();
    renderSpreadHistory();
    if (historyInstrumentChanged) loadSalesSpreadInsights();
  }

  function initSpreadHistoryChart() {
    const canvas = $('spread-history-chart');
    if (!canvas || typeof Chart === 'undefined') return;

    spreadHistoryChart = new Chart(canvas, {
      type: 'line',
      data: {
        labels: [],
        datasets: [],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 0 },
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              color: cssVar('--text-2', '#c9d3cd'),
              boxWidth: 14,
              boxHeight: 8,
              font: { size: 11, weight: 700 },
            },
          },
          tooltip: {
            backgroundColor: 'rgba(8, 11, 8, 0.94)',
            borderColor: 'rgba(205, 222, 190, 0.2)',
            borderWidth: 1,
            titleColor: cssVar('--text-1', '#f2f7f4'),
            bodyColor: cssVar('--text-2', '#c9d3cd'),
            callbacks: {
              label: (ctx) => `${ctx.dataset.label}: ${fmtPct(ctx.parsed.y)}`,
            },
          },
        },
        scales: {
          x: {
            ticks: { color: cssVar('--text-4', '#6f7b76') },
            grid: { color: 'rgba(205, 222, 190, 0.08)' },
          },
          y: {
            beginAtZero: true,
            title: { display: true, text: 'スプレッド率 (%)', color: cssVar('--text-3', '#9aa6a1') },
            ticks: {
              color: cssVar('--text-4', '#6f7b76'),
              callback: (value) => `${value}%`,
            },
            grid: { color: 'rgba(205, 222, 190, 0.08)' },
          },
        },
      },
    });
  }

  function initChartTheme() {
    if (!spreadHistoryChart) return;
    const options = spreadHistoryChart.options || {};
    if (options.plugins && options.plugins.legend && options.plugins.legend.labels) {
      options.plugins.legend.labels.color = cssVar('--text-2', '#c9d3cd');
    }
    if (options.plugins && options.plugins.tooltip) {
      options.plugins.tooltip.titleColor = cssVar('--text-1', '#f2f7f4');
      options.plugins.tooltip.bodyColor = cssVar('--text-2', '#c9d3cd');
    }
    if (options.scales && options.scales.x) {
      options.scales.x.ticks.color = cssVar('--text-4', '#6f7b76');
    }
    if (options.scales && options.scales.y) {
      options.scales.y.title.color = cssVar('--text-3', '#9aa6a1');
      options.scales.y.ticks.color = cssVar('--text-4', '#6f7b76');
    }
  }

  function latestSeriesValue(dates, byDate) {
    for (let index = dates.length - 1; index >= 0; index -= 1) {
      const value = byDate.get(dates[index]);
      if (Number.isFinite(Number(value))) return Number(value);
    }
    return Infinity;
  }

  function renderSpreadHistory() {
    populateHistoryInstrumentFilter();

    if (!spreadHistoryChart) return;

    const dates = Array.from(new Set(spreadHistoryRows.map(row => row.date).filter(Boolean))).sort();
    const scopedRows = spreadHistoryRows.filter(row => {
      if (row.instrumentId !== selectedHistoryInstrument) return false;
      return selectedExchange === ALL_VALUE || row.exchangeId === selectedExchange;
    });
    const byExchange = new Map();

    for (const row of scopedRows) {
      const value = Number(row.spreadPct);
      if (!row.date || !Number.isFinite(value)) continue;
      const key = row.exchangeId;
      if (!byExchange.has(key)) {
        byExchange.set(key, {
          exchangeId: row.exchangeId,
          label: row.exchangeLabel || row.exchangeId,
          byDate: new Map(),
        });
      }
      byExchange.get(key).byDate.set(row.date, value);
    }

    const series = Array.from(byExchange.values())
      .sort((a, b) => {
        const valueDiff = latestSeriesValue(dates, a.byDate) - latestSeriesValue(dates, b.byDate);
        if (valueDiff !== 0) return valueDiff;
        return String(a.label).localeCompare(String(b.label), 'ja');
      });

    spreadHistoryChart.data.labels = dates.map(shortDate);
    spreadHistoryChart.data.datasets = series.map((item, index) => {
      const color = chartColor(index);
      return {
        label: item.label,
        data: dates.map(date => item.byDate.get(date) ?? null),
        borderColor: color,
        backgroundColor: `${color}24`,
        borderWidth: 2,
        pointRadius: 3,
        pointHoverRadius: 5,
        tension: 0.25,
        spanGaps: true,
      };
    });
    spreadHistoryChart.update('none');

    const targetLabel = selectedExchange === ALL_VALUE
      ? `対象: 国内${series.length || ''}取引所`
      : `対象: ${selectedOptionLabel('spread-exchange-filter', selectedExchange)}`;
    setText(
      'spread-history-meta',
      targetLabel
    );
    writeUrlState();
  }

  function insightTone(insight) {
    const direction = insight && insight.direction;
    if (direction === 'narrow' || direction === 'up') return 'is-positive';
    if (direction === 'widen' || direction === 'down') return 'is-danger';
    return '';
  }

  function renderSalesSpreadInsights(data) {
    const list = $('sales-spread-insights-list');
    if (!list) return;

    const meta = data && data.meta ? data.meta : {};
    const insights = Array.isArray(data && data.insights) ? data.insights : [];
    const period = meta.period || {};
    const periodConfig = INSIGHT_PERIODS[selectedInsightPeriod] || INSIGHT_PERIODS['24h'];
    const instrumentLabel = selectedOptionLabel('spread-history-instrument', selectedHistoryInstrument);
    const exchangeLabel = selectedExchange !== ALL_VALUE
      ? selectedOptionLabel('spread-exchange-filter', selectedExchange)
      : '全販売所';

    setText(
      'sales-spread-insights-meta',
      `${instrumentLabel} / ${exchangeLabel} / ${period.comparisonLabel || `${periodConfig.label}の変化`}`
    );

    if (insights.length === 0) {
      list.innerHTML = '<li class="volume-insight-item volume-insight-item--empty">大きな変化は検出されませんでした。</li>';
      return;
    }

    list.innerHTML = insights.map((insight) => {
      const label = INSIGHT_TYPE_LABELS[insight.type] || 'Insight';
      const tone = insightTone(insight);
      const message = insight.messageJa || insight.message_ja || '';
      return `
        <li class="volume-insight-item ${tone ? `volume-insight-item--${tone}` : ''}">
          <span class="volume-insight-item__label">${escapeHtml(label)}</span>
          <p class="volume-insight-item__message">${escapeHtml(message)}</p>
        </li>
      `;
    }).join('');
  }

  async function loadSpread() {
    setText('spread-status', 'データ取得中');
    if (spreadAbortController) {
      spreadAbortController.abort();
      spreadAbortController = null;
    }
    const controller = new AbortController();
    spreadAbortController = controller;
    try {
      const data = await Api.fetchJson('/api/sales-spread', {
        signal: controller.signal,
      });
      render(data);
    } catch (err) {
      if (err.name === 'AbortError') return;
      setText('spread-status', '取得できませんでした');
      setText('spread-meta', '販売所スプレッドを取得できませんでした。時間をおいて再読み込みしてください。');
    } finally {
      if (spreadAbortController === controller) {
        spreadAbortController = null;
      }
    }
  }

  async function loadSpreadHistory() {
    setText('spread-history-meta', 'コスト推移を読み込み中');
    if (spreadHistoryAbortController) {
      spreadHistoryAbortController.abort();
      spreadHistoryAbortController = null;
    }
    const controller = new AbortController();
    spreadHistoryAbortController = controller;
    try {
      const data = await Api.fetchJson(`/api/sales-spread/history?window=${encodeURIComponent(selectedHistoryWindow)}`, {
        signal: controller.signal,
      });
      spreadHistoryRows = data.rows || [];
      spreadHistoryMeta = data.meta || {};
      renderSpreadHistory();
    } catch (err) {
      if (err.name === 'AbortError') return;
      setText('spread-history-meta', '販売所スプレッド履歴を取得できませんでした。時間をおいて再読み込みしてください。');
    } finally {
      if (spreadHistoryAbortController === controller) {
        spreadHistoryAbortController = null;
      }
    }
  }

  async function loadSalesSpreadInsights() {
    const list = $('sales-spread-insights-list');
    if (list) {
      list.innerHTML = '<li class="volume-insight-item volume-insight-item--loading">注目ポイントを生成中です。</li>';
    }
    if (spreadInsightsAbortController) {
      spreadInsightsAbortController.abort();
      spreadInsightsAbortController = null;
    }
    const controller = new AbortController();
    spreadInsightsAbortController = controller;
    try {
      const periodConfig = INSIGHT_PERIODS[selectedInsightPeriod] || INSIGHT_PERIODS['24h'];
      const params = new URLSearchParams({
        window: '30d',
        periods: String(periodConfig.periods),
        periodLabel: periodConfig.periodLabel,
        zscoreWindow: '8',
        maxInsights: '6',
      });
      if (selectedHistoryInstrument) params.set('instrumentId', selectedHistoryInstrument);
      if (selectedExchange !== ALL_VALUE) params.set('exchangeId', selectedExchange);

      const data = await Api.fetchJson(`/api/sales-spread/insights?${params.toString()}`, {
        signal: controller.signal,
      });
      renderSalesSpreadInsights(data);
    } catch (err) {
      if (err.name === 'AbortError') return;
      setText('sales-spread-insights-meta', '注目ポイントを取得できませんでした。');
      if (list) {
        list.innerHTML = '<li class="volume-insight-item volume-insight-item--empty">時間をおいて再読み込みしてください。</li>';
      }
    } finally {
      if (spreadInsightsAbortController === controller) {
        spreadInsightsAbortController = null;
      }
    }
  }

  const spreadRefreshTask = pagePoller.createTask({
    intervalMs: SPREAD_REFRESH_MS,
    callback: loadSpread,
  });

  const spreadHistoryRefreshTask = pagePoller.createTask({
    intervalMs: SPREAD_HISTORY_REFRESH_MS,
    callback: loadSpreadHistory,
  });

  const spreadInsightsRefreshTask = pagePoller.createTask({
    intervalMs: SPREAD_INSIGHTS_REFRESH_MS,
    callback: loadSalesSpreadInsights,
  });

  const filterInput = $('spread-filter');
  if (filterInput) {
    filterInput.value = filterText;
    filterInput.addEventListener('input', () => {
      filterText = filterInput.value.trim();
      const nextInstrument = instrumentIdFromText(filterText);
      if (
        nextInstrument
        && nextInstrument !== selectedHistoryInstrument
        && allRows.some(row => row.instrumentId === nextInstrument)
      ) {
        selectedHistoryInstrument = nextInstrument;
        populateHistoryInstrumentFilter();
        renderSpreadHistory();
        loadSalesSpreadInsights();
      }
      renderView();
    });
  }

  const exchangeFilter = $('spread-exchange-filter');
  if (exchangeFilter) {
    exchangeFilter.addEventListener('change', () => {
      selectedExchange = exchangeFilter.value || ALL_VALUE;
      renderView();
      renderSpreadHistory();
      loadSalesSpreadInsights();
    });
  }

  document.querySelectorAll('[data-spread-category]').forEach(button => {
    button.addEventListener('click', () => {
      selectedCategory = normalizeCategory(button.dataset.spreadCategory);
      renderView();
    });
  });

  document.querySelectorAll('[data-sales-spread-sort]').forEach(button => {
    button.addEventListener('click', () => {
      const key = button.dataset.salesSpreadSort;
      if (!SORT_ACCESSORS[key]) return;
      sortState = {
        key,
        direction: sortDirectionForNext(key),
      };
      renderView();
    });
  });

  const handlePinClick = (event) => {
    const button = event.target && event.target.closest ? event.target.closest('[data-spread-pin]') : null;
    if (!button) return;
    event.preventDefault();
    event.stopPropagation();
    togglePinnedInstrument(button.dataset.spreadPin);
  };

  const tableBody = $('sales-spread-tbody');
  if (tableBody) tableBody.addEventListener('click', handlePinClick);
  const mobileList = $('sales-spread-mobile-list');
  if (mobileList) mobileList.addEventListener('click', handlePinClick);

  document.querySelectorAll('[data-spread-history-window]').forEach(button => {
    button.addEventListener('click', () => {
      selectedHistoryWindow = normalizeHistoryWindow(button.dataset.spreadHistoryWindow);
      syncHistoryWindowButtons();
      loadSpreadHistory();
    });
  });

  const historyInstrumentFilter = $('spread-history-instrument');
  if (historyInstrumentFilter) {
    historyInstrumentFilter.addEventListener('change', () => {
      selectedHistoryInstrument = historyInstrumentFilter.value || 'BTC-JPY';
      renderSpreadHistory();
      loadSalesSpreadInsights();
    });
  }

  document.querySelectorAll('[data-spread-insight-period]').forEach(button => {
    button.addEventListener('click', () => {
      selectedInsightPeriod = normalizeInsightPeriod(button.dataset.spreadInsightPeriod);
      syncInsightPeriodButtons();
      writeUrlState();
      loadSalesSpreadInsights();
    });
  });

  initThemeToggle();
  syncStickyOffset();
  window.addEventListener('resize', syncStickyOffset);
  syncHistoryWindowButtons();
  syncInsightPeriodButtons();
  syncSortHeaders();
  syncQuickFilterButtons();
  writeUrlState();
  initSpreadHistoryChart();
  loadSpread();
  loadSpreadHistory();
  loadSalesSpreadInsights();
  spreadRefreshTask.start({ immediate: false });
  spreadHistoryRefreshTask.start({ immediate: false });
  spreadInsightsRefreshTask.start({ immediate: false });
  window.addEventListener('beforeunload', () => {
    pagePoller.dispose();
    if (spreadAbortController) spreadAbortController.abort();
    if (spreadHistoryAbortController) spreadHistoryAbortController.abort();
    if (spreadInsightsAbortController) spreadInsightsAbortController.abort();
    window.removeEventListener('resize', syncStickyOffset);
  });
});
