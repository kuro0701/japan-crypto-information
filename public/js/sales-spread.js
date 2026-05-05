document.addEventListener('DOMContentLoaded', () => {
  const Api = window.AppApi;
  const AppFmt = window.AppFormatters;
  const AppUtil = window.AppUtils;
  const pagePoller = window.PagePoller.create();
  const WINDOW_LABELS = {
    '1d': '24h',
    '7d': '7日',
    '30d': '30日',
  };
  const ALL_VALUE = '__all__';
  let allRows = [];
  let filterText = '';
  let selectedExchange = ALL_VALUE;
  let latestMeta = {};
  let selectedHistoryWindow = '30d';
  let selectedHistoryInstrument = 'BTC-JPY';
  let spreadHistoryRows = [];
  let spreadHistoryMeta = {};
  let spreadHistoryChart = null;
  let spreadAbortController = null;
  let spreadHistoryAbortController = null;
  let spreadInsightsAbortController = null;
  let selectedInsightPeriod = '24h';
  const CHART_COLORS = ['#35e0a5', '#ff6b70', '#35c8d2', '#f4c95d', '#dbe7df', '#ff9f7e', '#9ad46a'];
  const SPREAD_REFRESH_MS = 60000;
  const SPREAD_HISTORY_REFRESH_MS = 600000;
  const SPREAD_INSIGHTS_REFRESH_MS = 600000;
  const EMPTY_FILTER_MESSAGE = '条件に合う販売所スプレッドデータがありません。銘柄名や取引所フィルターを変更してください。';
  const WAITING_DATA_MESSAGE = '販売所価格を取得中です。取得できた販売所から順に比較します。';
  const PARTIAL_DATA_FAILURE_MESSAGE = '一部の取引所APIからデータを取得できていません。取得できた取引所のみで比較しています。';

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
    top_narrowing: '改善',
    top_widening: '注意',
    spread_narrowing: '改善',
    spread_widening: '拡大',
    narrowest_change: '最狭更新',
    narrowest_hold: '最狭',
    narrowest_gap_change: '差分変化',
    rank_up: '順位改善',
    rank_down: '順位悪化',
    narrowest_gap_narrow: '差分縮小',
    narrowest_gap_widen: '差分拡大',
    above_gap_narrow: '差分縮小',
    above_gap_widen: '差分拡大',
    narrowing_streak: '連続改善',
    widening_streak: '連続拡大',
    zscore_outlier: '外れ値',
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
    return /^[A-Z0-9]+-[A-Z0-9]+$/.test(normalized) ? normalized : '';
  }

  function normalizeExchangeId(value) {
    const normalized = String(value || '').trim().toLowerCase();
    return normalized || ALL_VALUE;
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
  selectedHistoryWindow = initialState.historyWindow;
  selectedInsightPeriod = initialState.insightPeriod;
  selectedHistoryInstrument = initialState.historyInstrumentId;

  function sourceLabel(windowMeta) {
    if (!windowMeta) return 'データ取得中';
    if (windowMeta.source === 'daily-snapshots') return `スプレッドスナップショット ${windowMeta.sampleSnapshotCount}件`;
    if (windowMeta.source === 'daily-snapshot') return 'スプレッドスナップショット';
    if (windowMeta.source === 'latest-fallback') return '最新収集値';
    if (windowMeta.source === 'latest') return '最新収集値';
    return 'データ取得中';
  }

  function provisionalSnapshotNote(meta, latestKey, countKey) {
    if (!meta) return '';
    const latestDate = meta[latestKey];
    const count = Number(meta[countKey]) || 0;
    if (!latestDate) return '';
    return count > 1
      ? `暫定 ${latestDate} を含む ${count}件あり`
      : `暫定 ${latestDate} あり`;
  }

  function partialSnapshotNote(meta, latestKey, countKey) {
    if (!meta) return '';
    const latestDate = meta[latestKey];
    const count = Number(meta[countKey]) || 0;
    if (!latestDate || count < 1) return '';
    return count > 1
      ? `欠損あり ${latestDate} まで ${count}件`
      : `欠損あり ${latestDate}`;
  }

  const API_STATUS_LABELS = {
    success: '成功',
    partial: '一部API未取得',
    failed: '失敗',
    waiting: '待機中',
  };

  const DATA_KIND_LABELS = {
    measured: '実測',
    estimated: '推定',
    mixed: '推定含む',
    unknown: '-',
  };

  const TRANSPORT_LABELS = {
    websocket: 'WebSocket',
    rest: 'REST',
    web: 'Web',
  };

  function transportLabel(sources) {
    const labels = (sources || [])
      .map(source => TRANSPORT_LABELS[source] || source)
      .filter(Boolean);
    return labels.length > 0 ? labels.join(' + ') : '-';
  }

  function qualityStatusCell(row) {
    const status = row.apiStatus || 'waiting';
    const label = API_STATUS_LABELS[status] || status;
    const note = row.message ? `<div class="quality-note" title="${escapeHtml(row.message)}">${escapeHtml(row.message)}</div>` : '';
    return `<span class="quality-badge quality-badge--${escapeHtml(status)}">${escapeHtml(label)}</span>${note}`;
  }

  function historySourceLabel(meta) {
    if (!meta) return 'データ取得中';
    if (meta.source === 'daily-snapshots') return `日次 ${meta.historySnapshotCount}件`;
    if (meta.source === 'latest-fallback') return '最新収集値';
    return 'データ取得中';
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

  function spreadCell(summary, precision) {
    if (!summary) return '<span class="text-gray-600">-</span>';
    return `
      <div class="font-mono text-yellow-300">${fmtJpyPrice(summary.spread, precision)}</div>
      <div class="text-[10px] text-gray-500">${fmtPct(summary.spreadPct)} / n=${summary.sampleCount}</div>
    `;
  }

  function latestSpreadCell(row) {
    const latest = row.latest;
    if (!latest) return '<span class="text-gray-600">-</span>';
    return `
      <div class="font-mono text-gray-200">${fmtJpyPrice(latest.spread, latest.quotePrecision)}</div>
      <div class="text-[10px] text-gray-500">${fmtPct(latest.spreadPct)}</div>
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
    return Boolean(filterText) || selectedExchange !== ALL_VALUE;
  }

  function rowMatchesFilter(row) {
    const matchesExchange = selectedExchange === ALL_VALUE || row.exchangeId === selectedExchange;
    if (!matchesExchange) return false;
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
    const rows = allRows.filter(rowMatchesFilter);
    if (filterText || selectedExchange !== ALL_VALUE) rows.sort(sortNarrowestSpread);
    return rows;
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

  function formatPointDelta(value, { signed = true } = {}) {
    const number = Number(value);
    if (!Number.isFinite(number)) return '-';
    const prefix = signed && number > 0 ? '+' : '';
    return `${prefix}${number.toFixed(2)}pt`;
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
      container.innerHTML = '<p class="spread-orderbook-empty">板比較に進める候補はまだありません。</p>';
      setText('spread-orderbook-meta', '現在値の比較データが揃うと、板比較に進みやすい銘柄を表示します。');
      if (badge) {
        badge.className = 'decision-summary-badge decision-summary-badge--loading';
        badge.textContent = '候補待ち';
      }
      return;
    }

    const suggestions = items.slice(0, ORDERBOOK_SUGGESTION_LIMIT);
    container.innerHTML = suggestions.map((item) => {
      const widestLabel = item.widestExchange
        ? `${item.widestExchange.exchangeLabel} ${fmtPct(item.widestExchange.spreadPct)}`
        : null;
      const description = widestLabel
        ? `販売所平均 ${fmtPct(item.current.spreadPct)}。最も広い販売所は ${widestLabel} です。取引所板と成行コストも続けて確認できます。`
        : `販売所平均 ${fmtPct(item.current.spreadPct)}。取引所板と成行コストも続けて確認できます。`;
      return [
        `<a class="market-context-card" href="${marketPageUrl(item.instrumentId)}">`,
        '  <span class="market-context-card__eyebrow">Order Book</span>',
        `  <strong class="market-context-card__title">${escapeHtml(item.instrumentLabel)} の取引所板へ</strong>`,
        `  <span class="market-context-card__description">${escapeHtml(description)}</span>`,
        '  <span class="market-context-card__cta">板比較へ</span>',
        '</a>',
      ].join('\n');
    }).join('');

    setText('spread-orderbook-meta', `${suggestions.length}銘柄をピックアップしました。広めの販売所スプレッドを見つけたら、板のBid/Askとシミュレーターも合わせて確認できます。`);
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
        actionLabel: '取引所板を見る',
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
        actionLabel: '取引所板を見る',
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
        value: formatPointDelta(diff),
        valueClass: 'spread-ranking-item__value--danger',
        note: `現在 ${fmtPct(item.current.spreadPct)}`,
        delta: `7日平均 ${fmtPct(item.averages['7d'].spreadPct)}`,
        actionHref: marketPageUrl(item.instrumentId),
        actionLabel: '取引所板を見る',
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
        value: formatPointDelta(diff, { signed: false }),
        valueClass: 'spread-ranking-item__value--positive',
        note: `現在 ${fmtPct(item.current.spreadPct)}`,
        delta: `30日平均 ${fmtPct(item.averages['30d'].spreadPct)}`,
        actionHref: marketPageUrl(item.instrumentId),
        actionLabel: '取引所板を見る',
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
      actionLabel: '取引所詳細へ',
    }));
  }

  function renderRankings(rows) {
    const instrumentSummaries = buildInstrumentSummaries(rows);
    const exchangeSummaries = buildExchangeSummaries(rows);
    const instrumentItems = buildInstrumentRankingItems(instrumentSummaries);
    const exchangeItems = buildExchangeRankingItems(exchangeSummaries);
    const scopeLabel = hasActiveFilters() ? 'フィルター反映' : '全体';

    setText(
      'spread-ranking-summary',
      `${scopeLabel} | 銘柄 ${instrumentItems.currentItemCount}件 | 取引所平均 ${exchangeItems.length}社`
    );
    setText('spread-ranking-narrow-meta', `${instrumentItems.currentItemCount}銘柄から表示`);
    setText('spread-ranking-wide-meta', `${instrumentItems.currentItemCount}銘柄から表示`);
    setText('spread-ranking-wider7-meta', `上位${instrumentItems.widerThan7d.length}件を表示`);
    setText('spread-ranking-improved30-meta', `上位${instrumentItems.improvedFrom30d.length}件を表示`);
    setText('spread-ranking-exchange-meta', `${exchangeItems.length}販売所を表示`);

    renderRankingList('spread-ranking-narrow-list', instrumentItems.narrow, '現在値を比較できる銘柄がありません。');
    renderRankingList('spread-ranking-wide-list', instrumentItems.wide, '現在値を比較できる銘柄がありません。');
    renderRankingList('spread-ranking-wider7-list', instrumentItems.widerThan7d, '7日平均より広がっている銘柄はありません。');
    renderRankingList('spread-ranking-improved30-list', instrumentItems.improvedFrom30d, '30日平均より改善している銘柄はありません。');
    renderRankingList('spread-ranking-exchange-list', exchangeItems, '取引所別平均の計算対象がありません。');
    renderOrderbookSuggestions(instrumentItems.wideSources);
  }

  function renderRows(rows) {
    const tbody = $('sales-spread-tbody');
    if (!tbody) return;

    if (rows.length === 0) {
      const message = hasActiveFilters() ? EMPTY_FILTER_MESSAGE : WAITING_DATA_MESSAGE;
      tbody.innerHTML = `<tr><td colspan="8" class="text-center text-gray-500 py-4">${message}</td></tr>`;
      return;
    }

    tbody.innerHTML = rows.map(row => {
      const latest = row.latest || {};
      const averages = row.averages || {};
      const precision = latest.quotePrecision ?? null;
      return `
        <tr class="border-b border-gray-800/60">
          <td data-label="銘柄">
            <a class="market-link" href="${marketPageUrl(row.instrumentId)}">${escapeHtml(row.instrumentLabel)}</a>
            <div class="text-[10px] text-gray-500">${escapeHtml(row.currencyFullName || row.baseCurrency)}</div>
          </td>
          <td class="text-gray-300" data-label="取引所">${escapeHtml(row.exchangeLabel)}</td>
          <td class="is-num text-right font-mono text-red-300" data-label="買値">${fmtJpyPrice(latest.buyPrice, precision)}</td>
          <td class="is-num text-right font-mono text-green-300" data-label="売値">${fmtJpyPrice(latest.sellPrice, precision)}</td>
          <td class="is-num text-right" data-label="現在">${latestSpreadCell(row)}</td>
          <td class="is-num text-right" data-label="24h平均">${spreadCell(averages['1d'], precision)}</td>
          <td class="is-num text-right" data-label="7日平均">${spreadCell(averages['7d'], precision)}</td>
          <td class="is-num text-right" data-label="30日平均">${spreadCell(averages['30d'], precision)}</td>
        </tr>
      `;
    }).join('');
  }

  function renderQualityRows(qualityRows) {
    const tbody = $('spread-quality-tbody');
    if (!tbody) return;

    const rows = (qualityRows || []).filter(row => (
      selectedExchange === ALL_VALUE || row.exchangeId === selectedExchange
    ));
    if (rows.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" class="text-center text-gray-500 py-4">${WAITING_DATA_MESSAGE}</td></tr>`;
      setText('spread-quality-meta', '販売所APIの取得状況を確認中です。');
      return;
    }

    const successCount = rows.filter(row => row.apiStatus === 'success').length;
    const issueCount = rows.filter(row => row.apiStatus === 'partial' || row.apiStatus === 'failed').length;
    const measuredCount = rows.reduce((sum, row) => sum + (Number(row.measuredCount) || 0), 0);
    const estimatedCount = rows.reduce((sum, row) => sum + (Number(row.estimatedCount) || 0), 0);
    setText(
      'spread-quality-meta',
      `${rows.length}販売所 | 成功 ${successCount} | 要確認 ${issueCount} | 実測 ${measuredCount} / 推定 ${estimatedCount}${issueCount > 0 ? ` | ${PARTIAL_DATA_FAILURE_MESSAGE}` : ''}`
    );

    tbody.innerHTML = rows.map(row => `
      <tr class="border-b border-gray-800/60">
        <td class="font-bold text-gray-200" data-label="販売所">${escapeHtml(row.exchangeLabel || row.exchangeId)}</td>
        <td class="text-gray-300" data-label="API">${qualityStatusCell(row)}</td>
        <td class="text-gray-300" data-label="経路">${escapeHtml(transportLabel(row.transportSources))}</td>
        <td class="is-num text-right font-mono text-gray-300" data-label="サンプル">${Number(row.sampleCount) || 0}</td>
        <td class="text-gray-300" data-label="種別">${escapeHtml(DATA_KIND_LABELS[row.dataKind] || row.dataKind || '-')}</td>
        <td class="is-num text-right font-mono text-gray-300" data-label="最終取得">
          ${escapeHtml(fmtDateTime(row.lastFetchedAt))}
          <div class="text-[10px] text-gray-500">元データ ${escapeHtml(fmtDateTime(row.lastSourceAt))}</div>
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
        cta.textContent = '板シミュレーターで確認';
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
      wideSummary ? `最大 ${fmtPct(wideSummary.spreadPct)} | 板比較も確認` : '表示価格は参考値です'
    );
    setText(
      'spread-top-note',
      widest
        ? `${widest.row.instrumentLabel} のようにスプレッドが広い候補は、販売所だけで判断せず取引所板の実効コストも確認してください。`
        : 'スプレッドが広い場合は、同じ銘柄を取引所板でも比較してください。'
    );

    if (cta) {
      const instrumentId = narrowest && narrowest.row.instrumentId ? narrowest.row.instrumentId : 'BTC-JPY';
      const label = narrowest && narrowest.row.instrumentLabel ? narrowest.row.instrumentLabel : instrumentId.replace('-', '/');
      cta.href = `/simulator?market=${encodeURIComponent(instrumentId)}&side=buy&amountType=jpy&amount=100000`;
      cta.textContent = `${label}を板で確認`;
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
    setText('spread-status', status.running ? '更新中' : (allRows.length > 0 ? '集計済み' : '取得中'));
    setText('spread-updated-at', fmtDateTime(latestMeta.latestCapturedAt || latestMeta.generatedAt));
  }

  function renderMeta(rows) {
    const windows = latestMeta.windows || {};
    const range30d = windows['30d'] && windows['30d'].earliestSpreadDateJst && windows['30d'].latestSpreadDateJst
      ? `${windows['30d'].earliestSpreadDateJst} - ${windows['30d'].latestSpreadDateJst}`
      : '最新収集値';
    const visibleCountLabel = hasActiveFilters() ? `${rows.length}/${allRows.length}件` : `${allRows.length}件`;
    const provisionalNote = provisionalSnapshotNote(latestMeta, 'latestProvisionalSpreadDateJst', 'provisionalDailySnapshotCount');
    const partialNote = partialSnapshotNote(latestMeta, 'latestPartialSpreadDateJst', 'partialDailySnapshotCount');

    setText(
      'spread-meta',
      [
        `${Object.keys(WINDOW_LABELS).map(key => `${WINDOW_LABELS[key]} ${sourceLabel(windows[key])}`).join(' | ')}`,
        range30d,
        visibleCountLabel,
        provisionalNote,
        partialNote,
      ].filter(Boolean).join(' | ')
    );
  }

  function renderView() {
    const rows = getFilteredRows();
    renderSummary(rows);
    renderMeta(rows);
    renderRankings(rows);
    renderRows(rows);
    renderQualityRows(latestMeta.quality || []);
    writeUrlState();
  }

  function render(data) {
    latestMeta = data.meta || {};
    latestMeta.quality = data.quality || [];
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

    const selectedOption = $('spread-history-instrument')?.selectedOptions?.[0];
    const instrumentLabel = selectedOption ? selectedOption.textContent : selectedHistoryInstrument;
    const range = spreadHistoryMeta.earliestSpreadDateJst && spreadHistoryMeta.latestSpreadDateJst
      ? `${spreadHistoryMeta.earliestSpreadDateJst} - ${spreadHistoryMeta.latestSpreadDateJst}`
      : '履歴データ待ち';
    const provisionalNote = provisionalSnapshotNote(spreadHistoryMeta, 'latestProvisionalSpreadDateJst', 'provisionalDailySnapshotCount');
    const partialNote = partialSnapshotNote(spreadHistoryMeta, 'latestPartialSpreadDateJst', 'partialDailySnapshotCount');
    setText(
      'spread-history-meta',
      [instrumentLabel, range, series.length > 0 ? `${series.length}系列` : '該当なし', historySourceLabel(spreadHistoryMeta), provisionalNote, partialNote].filter(Boolean).join(' | ')
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
    const range = meta.earliestDate && meta.latestDate ? `${meta.earliestDate} - ${meta.latestDate}` : '履歴データ待ち';
    const provisionalNote = provisionalSnapshotNote(meta, 'latestProvisionalSpreadDateJst', 'provisionalDailySnapshotCount');
    const partialNote = partialSnapshotNote(meta, 'latestPartialSpreadDateJst', 'partialDailySnapshotCount');

    setText(
      'sales-spread-insights-meta',
      [
        periodConfig.label,
        period.comparisonLabel || '前回比',
        instrumentLabel,
        exchangeLabel,
        range,
        provisionalNote,
        partialNote,
      ].filter(Boolean).join(' | ')
    );

    if (insights.length === 0) {
      list.innerHTML = '<li class="volume-insight-item volume-insight-item--empty">有意な変化は検出されませんでした。</li>';
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
    setText('spread-status', '読み込み中');
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
    setText('spread-history-meta', '日次スナップショットを読み込み中');
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
      list.innerHTML = '<li class="volume-insight-item volume-insight-item--loading">インサイトを生成中です。</li>';
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
      setText('sales-spread-insights-meta', 'インサイトを取得できませんでした。');
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

  syncHistoryWindowButtons();
  syncInsightPeriodButtons();
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
  });
});
