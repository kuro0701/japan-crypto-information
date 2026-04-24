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
  const CHART_COLORS = ['#35e0a5', '#ff6b70', '#35c8d2', '#f4c95d', '#dbe7df', '#ff9f7e', '#9ad46a'];
  const SPREAD_REFRESH_MS = 60000;
  const SPREAD_HISTORY_REFRESH_MS = 600000;

  const $ = AppUtil.byId;
  const setText = AppUtil.setText;
  const escapeHtml = AppUtil.escapeHtml;
  const marketPageUrl = AppUtil.marketPageUrl;
  const cssVar = AppUtil.cssVar;
  const fmtPct = AppFmt.pct;
  const fmtDateTime = AppFmt.dateTime;
  const fmtJpyPrice = AppFmt.jpyPrice;
  const shortDate = AppFmt.shortDate;
  const HISTORY_WINDOW_VALUES = new Set(Object.keys(WINDOW_LABELS));

  function normalizeHistoryWindow(value) {
    return HISTORY_WINDOW_VALUES.has(value) ? value : '30d';
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

  const initialState = readInitialState();
  filterText = initialState.filterText;
  selectedExchange = initialState.exchangeId;
  selectedHistoryWindow = initialState.historyWindow;
  selectedHistoryInstrument = initialState.historyInstrumentId;

  function sourceLabel(windowMeta) {
    if (!windowMeta) return '記録待ち';
    if (windowMeta.source === 'daily-snapshots') return `スプレッドスナップショット ${windowMeta.sampleSnapshotCount}件`;
    if (windowMeta.source === 'daily-snapshot') return 'スプレッドスナップショット';
    if (windowMeta.source === 'latest-fallback') return '最新収集値';
    if (windowMeta.source === 'latest') return '最新収集値';
    return '記録待ち';
  }

  const API_STATUS_LABELS = {
    success: '成功',
    partial: '一部失敗',
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
    if (!meta) return '記録待ち';
    if (meta.source === 'daily-snapshots') return `日次 ${meta.historySnapshotCount}件`;
    if (meta.source === 'latest-fallback') return '最新収集値';
    return '記録待ち';
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
    if (!select) return;

    const options = uniqueHistoryInstrumentOptions();
    const values = new Set(options.map(option => option.value));
    if (!values.has(selectedHistoryInstrument)) {
      selectedHistoryInstrument = values.has('BTC-JPY') ? 'BTC-JPY' : (options[0] && options[0].value) || 'BTC-JPY';
    }

    select.innerHTML = options.length > 0
      ? options.map(option => `<option value="${escapeHtml(option.value)}">${escapeHtml(option.label)}</option>`).join('')
      : '<option value="BTC-JPY">BTC/JPY</option>';
    select.value = selectedHistoryInstrument;
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

  function getSummarySpread(row) {
    const latest = row.latest || null;
    if (latest && Number.isFinite(Number(latest.spreadPct))) {
      return {
        spreadPct: Number(latest.spreadPct),
      };
    }

    const average24h = row.averages && row.averages['1d'];
    if (average24h && Number.isFinite(Number(average24h.spreadPct))) {
      return {
        spreadPct: Number(average24h.spreadPct),
      };
    }

    return null;
  }

  function spreadHighlightLabel(row) {
    const summary = getSummarySpread(row);
    if (!summary) return '-';
    return `${row.instrumentLabel} / ${row.exchangeLabel} ${fmtPct(summary.spreadPct)}`;
  }

  function renderRows(rows) {
    const tbody = $('sales-spread-tbody');
    if (!tbody) return;

    if (rows.length === 0) {
      const message = hasActiveFilters() ? '該当なし' : '記録待ち';
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
      tbody.innerHTML = '<tr><td colspan="6" class="text-center text-gray-500 py-4">記録待ち</td></tr>';
      setText('spread-quality-meta', '取得状況の記録待ち');
      return;
    }

    const successCount = rows.filter(row => row.apiStatus === 'success').length;
    const issueCount = rows.filter(row => row.apiStatus === 'partial' || row.apiStatus === 'failed').length;
    const measuredCount = rows.reduce((sum, row) => sum + (Number(row.measuredCount) || 0), 0);
    const estimatedCount = rows.reduce((sum, row) => sum + (Number(row.estimatedCount) || 0), 0);
    setText(
      'spread-quality-meta',
      `${rows.length}販売所 | 成功 ${successCount} | 要確認 ${issueCount} | 実測 ${measuredCount} / 推定 ${estimatedCount}`
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
    setText('spread-status', status.running ? '更新中' : (allRows.length > 0 ? '集計済み' : '記録待ち'));
    setText('spread-updated-at', fmtDateTime(latestMeta.latestCapturedAt || latestMeta.generatedAt));
  }

  function renderMeta(rows) {
    const windows = latestMeta.windows || {};
    const range30d = windows['30d'] && windows['30d'].earliestSpreadDateJst && windows['30d'].latestSpreadDateJst
      ? `${windows['30d'].earliestSpreadDateJst} - ${windows['30d'].latestSpreadDateJst}`
      : '最新収集値';
    const visibleCountLabel = hasActiveFilters() ? `${rows.length}/${allRows.length}件` : `${allRows.length}件`;

    setText(
      'spread-meta',
      `${Object.keys(WINDOW_LABELS).map(key => `${WINDOW_LABELS[key]} ${sourceLabel(windows[key])}`).join(' | ')} | ${range30d} | ${visibleCountLabel}`
    );
  }

  function renderView() {
    const rows = getFilteredRows();
    renderSummary(rows);
    renderMeta(rows);
    renderRows(rows);
    renderQualityRows(latestMeta.quality || []);
    writeUrlState();
  }

  function render(data) {
    latestMeta = data.meta || {};
    latestMeta.quality = data.quality || [];
    allRows = data.rows || [];
    populateExchangeFilter();
    populateHistoryInstrumentFilter();
    renderView();
    renderSpreadHistory();
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
    setText(
      'spread-history-meta',
      `${instrumentLabel} | ${range} | ${series.length > 0 ? `${series.length}系列` : '該当なし'} | ${historySourceLabel(spreadHistoryMeta)}`
    );
    writeUrlState();
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
      setText('spread-status', '取得失敗');
      setText('spread-meta', err.message);
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
      setText('spread-history-meta', err.message);
    } finally {
      if (spreadHistoryAbortController === controller) {
        spreadHistoryAbortController = null;
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

  const filterInput = $('spread-filter');
  if (filterInput) {
    filterInput.value = filterText;
    filterInput.addEventListener('input', () => {
      filterText = filterInput.value.trim();
      renderView();
    });
  }

  const exchangeFilter = $('spread-exchange-filter');
  if (exchangeFilter) {
    exchangeFilter.addEventListener('change', () => {
      selectedExchange = exchangeFilter.value || ALL_VALUE;
      renderView();
      renderSpreadHistory();
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
    });
  }

  syncHistoryWindowButtons();
  writeUrlState();
  initSpreadHistoryChart();
  loadSpread();
  loadSpreadHistory();
  spreadRefreshTask.start({ immediate: false });
  spreadHistoryRefreshTask.start({ immediate: false });
  window.addEventListener('beforeunload', () => {
    pagePoller.dispose();
    if (spreadAbortController) spreadAbortController.abort();
    if (spreadHistoryAbortController) spreadHistoryAbortController.abort();
  });
});
