document.addEventListener('DOMContentLoaded', () => {
  const pagePoller = window.PagePoller.create();
  const WINDOW_LABELS = {
    '1d': '24時間',
    '7d': '7日間',
    '30d': '30日間',
  };
  const ALL_VALUE = '__all__';
  let selectedWindow = '1d';
  let selectedInstrument = ALL_VALUE;
  let selectedExchange = ALL_VALUE;
  let selectedHistoryWindow = '30d';
  let latestData = null;
  let volumeHistoryRows = [];
  let volumeHistoryMeta = {};
  let volumeShareHistoryChart = null;
  let volumeRankHistoryChart = null;
  let shareAbortController = null;
  let volumeHistoryAbortController = null;
  const CHART_COLORS = ['#35e0a5', '#ff6b70', '#35c8d2', '#f4c95d', '#dbe7df', '#ff9f7e', '#9ad46a'];
  const SHARE_REFRESH_MS = 60000;
  const VOLUME_HISTORY_REFRESH_MS = 600000;

  const $ = (id) => document.getElementById(id);
  const setText = (id, value) => {
    const el = $(id);
    if (el) el.textContent = value ?? '-';
  };

  const fmtJpy = (value) => Fmt.jpyLarge(value);
  const fmtPct = (value) => value == null || isNaN(value) ? '-' : `${value.toFixed(2)}%`;
  const fmtDateTime = (value) => {
    if (!value) return '-';
    return new Date(value).toLocaleString('ja-JP', {
      timeZone: 'Asia/Tokyo',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  function parseNumber(value) {
    const parsed = parseFloat(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function marketPageUrl(instrumentId) {
    const normalized = String(instrumentId || 'BTC-JPY').trim().toUpperCase();
    return `/markets/${encodeURIComponent(normalized)}`;
  }

  function shareBar(sharePct) {
    const width = Math.max(0, Math.min(100, sharePct || 0));
    return `<div class="share-bar mt-1"><span style="width: ${width}%"></span></div>`;
  }

  function sourceLabel(meta) {
    if (meta.source === 'daily-snapshots') return `24hスナップショット ${meta.dailySnapshotCount}件`;
    if (meta.source === 'daily-snapshot') return '24hスナップショット';
    if (meta.source === 'latest-fallback') return '最新24h収集値';
    return '最新24h収集値';
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
    if (meta.source === 'latest-fallback') return '最新24h収集値';
    return '記録待ち';
  }

  function chartColor(index) {
    return CHART_COLORS[index % CHART_COLORS.length];
  }

  function cssVar(name, fallback) {
    const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return value || fallback;
  }

  function shortDate(value) {
    if (!value) return '-';
    const parts = String(value).split('-');
    if (parts.length === 3) return `${parts[1]}/${parts[2]}`;
    return String(value);
  }

  function uniqueOptions(rows, valueKey, labelKey) {
    const byValue = new Map();
    for (const row of rows || []) {
      const value = row[valueKey];
      if (!value || byValue.has(value)) continue;
      byValue.set(value, {
        value,
        label: row[labelKey] || value,
      });
    }
    return Array.from(byValue.values())
      .sort((a, b) => String(a.label).localeCompare(String(b.label), 'ja'));
  }

  function populateFilter(selectId, options, selectedValue) {
    const select = $(selectId);
    if (!select) return ALL_VALUE;

    const values = new Set(options.map(option => option.value));
    const nextValue = values.has(selectedValue) ? selectedValue : ALL_VALUE;
    select.innerHTML = [
      `<option value="${ALL_VALUE}">すべて</option>`,
      ...options.map(option => `<option value="${escapeHtml(option.value)}">${escapeHtml(option.label)}</option>`),
    ].join('');
    select.value = nextValue;
    return nextValue;
  }

  function syncFilterOptions(data) {
    const rows = data.rows || [];
    selectedInstrument = populateFilter(
      'volume-instrument-filter',
      uniqueOptions(rows, 'instrumentId', 'instrumentLabel'),
      selectedInstrument
    );
    selectedExchange = populateFilter(
      'volume-exchange-filter',
      uniqueOptions(rows, 'exchangeId', 'exchangeLabel'),
      selectedExchange
    );
  }

  function hasActiveFilters() {
    return selectedInstrument !== ALL_VALUE || selectedExchange !== ALL_VALUE;
  }

  function rowMatchesFilters(row) {
    return (selectedInstrument === ALL_VALUE || row.instrumentId === selectedInstrument)
      && (selectedExchange === ALL_VALUE || row.exchangeId === selectedExchange);
  }

  function buildFilteredShare(data) {
    const byExchange = new Map();
    const byInstrument = new Map();
    const rows = [];
    let totalQuoteVolume = 0;

    for (const row of data.rows || []) {
      if (!rowMatchesFilters(row)) continue;
      const quoteVolume = parseNumber(row.quoteVolume);
      if (quoteVolume == null || quoteVolume < 0) continue;

      const normalizedRow = {
        ...row,
        quoteVolume,
      };
      rows.push(normalizedRow);
      totalQuoteVolume += quoteVolume;

      if (!byExchange.has(row.exchangeId)) {
        byExchange.set(row.exchangeId, {
          exchangeId: row.exchangeId,
          exchangeLabel: row.exchangeLabel,
          quoteVolume: 0,
        });
      }
      byExchange.get(row.exchangeId).quoteVolume += quoteVolume;

      if (!byInstrument.has(row.instrumentId)) {
        byInstrument.set(row.instrumentId, {
          instrumentId: row.instrumentId,
          instrumentLabel: row.instrumentLabel,
          quoteVolume: 0,
        });
      }
      byInstrument.get(row.instrumentId).quoteVolume += quoteVolume;
    }

    const filteredRows = rows.map(row => {
      const instrumentTotal = byInstrument.get(row.instrumentId);
      return {
        ...row,
        instrumentTotalQuoteVolume: instrumentTotal ? instrumentTotal.quoteVolume : 0,
        instrumentSharePct: instrumentTotal && instrumentTotal.quoteVolume > 0
          ? (row.quoteVolume / instrumentTotal.quoteVolume) * 100
          : 0,
        totalSharePct: totalQuoteVolume > 0 ? (row.quoteVolume / totalQuoteVolume) * 100 : 0,
      };
    }).sort((a, b) => {
      if (a.instrumentId !== b.instrumentId) return a.instrumentId.localeCompare(b.instrumentId);
      return b.quoteVolume - a.quoteVolume;
    });

    const exchanges = Array.from(byExchange.values())
      .map(exchange => ({
        ...exchange,
        sharePct: totalQuoteVolume > 0 ? (exchange.quoteVolume / totalQuoteVolume) * 100 : 0,
      }))
      .sort((a, b) => b.quoteVolume - a.quoteVolume);

    const instruments = Array.from(byInstrument.values())
      .map(instrument => ({
        ...instrument,
        sharePct: totalQuoteVolume > 0 ? (instrument.quoteVolume / totalQuoteVolume) * 100 : 0,
      }))
      .sort((a, b) => b.quoteVolume - a.quoteVolume);

    return {
      exchanges,
      instruments,
      rows: filteredRows,
      totalQuoteVolume,
    };
  }

  function renderExchangeRows(exchanges, emptyMessage = '記録待ち') {
    const tbody = $('exchange-share-tbody');
    if (!tbody) return;

    if (!exchanges || exchanges.length === 0) {
      tbody.innerHTML = `<tr><td colspan="3" class="text-center text-gray-500 py-4">${escapeHtml(emptyMessage)}</td></tr>`;
      return;
    }

    tbody.innerHTML = exchanges.map((exchange, index) => `
      <tr class="border-b border-gray-800/60 ${index === 0 ? 'data-table__row--rank-1' : ''}">
        <td class="font-bold text-gray-200" data-label="取引所">${escapeHtml(exchange.exchangeLabel)}</td>
        <td class="is-num text-right font-mono text-gray-300" data-label="出来高">${fmtJpy(exchange.quoteVolume)}</td>
        <td class="is-num text-right font-mono text-yellow-300" data-label="シェア">
          ${fmtPct(exchange.sharePct)}
          ${shareBar(exchange.sharePct)}
        </td>
      </tr>
    `).join('');
  }

  function renderInstrumentRows(rows, emptyMessage = '記録待ち') {
    const tbody = $('instrument-share-tbody');
    if (!tbody) return;

    if (!rows || rows.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" class="text-center text-gray-500 py-4">${escapeHtml(emptyMessage)}</td></tr>`;
      return;
    }

    tbody.innerHTML = rows.map((row, index) => `
      <tr class="border-b border-gray-800/60 ${index === 0 ? 'data-table__row--rank-1' : ''}">
        <td class="font-bold text-gray-200" data-label="銘柄">
          <a class="market-link" href="${marketPageUrl(row.instrumentId)}">${escapeHtml(row.instrumentLabel)}</a>
        </td>
        <td class="text-gray-300" data-label="取引所">${escapeHtml(row.exchangeLabel)}</td>
        <td class="is-num text-right font-mono text-gray-300" data-label="出来高">
          ${fmtJpy(row.quoteVolume)}
        </td>
        <td class="is-num text-right font-mono text-green-300" data-label="銘柄内シェア">
          ${fmtPct(row.instrumentSharePct)}
          ${shareBar(row.instrumentSharePct)}
        </td>
        <td class="is-num text-right font-mono text-yellow-300" data-label="全体シェア">${fmtPct(row.totalSharePct)}</td>
      </tr>
    `).join('');
  }

  function renderQualityRows(qualityRows) {
    const tbody = $('volume-quality-tbody');
    if (!tbody) return;

    const rows = (qualityRows || []).filter(row => (
      selectedExchange === ALL_VALUE || row.exchangeId === selectedExchange
    ));
    if (rows.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" class="text-center text-gray-500 py-4">記録待ち</td></tr>';
      setText('volume-quality-meta', '取得状況の記録待ち');
      return;
    }

    const successCount = rows.filter(row => row.apiStatus === 'success').length;
    const issueCount = rows.filter(row => row.apiStatus === 'partial' || row.apiStatus === 'failed').length;
    const measuredCount = rows.reduce((sum, row) => sum + (Number(row.measuredCount) || 0), 0);
    const estimatedCount = rows.reduce((sum, row) => sum + (Number(row.estimatedCount) || 0), 0);
    setText(
      'volume-quality-meta',
      `${rows.length}取引所 | 成功 ${successCount} | 要確認 ${issueCount} | 実測 ${measuredCount} / 推定 ${estimatedCount}`
    );

    tbody.innerHTML = rows.map(row => `
      <tr class="border-b border-gray-800/60">
        <td class="font-bold text-gray-200" data-label="取引所">${escapeHtml(row.exchangeLabel || row.exchangeId)}</td>
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

  function renderFilteredShare() {
    if (!latestData) return;

    const meta = latestData.meta || {};
    const filtered = buildFilteredShare(latestData);
    const topExchange = filtered.exchanges[0];
    const status = meta.refreshStatus || {};
    const label = WINDOW_LABELS[meta.windowKey] || WINDOW_LABELS[selectedWindow];
    const allRowCount = (latestData.rows || []).length;
    const visibleCountLabel = hasActiveFilters()
      ? `${filtered.rows.length}/${allRowCount}件`
      : `${filtered.rows.length}件`;
    const emptyMessage = hasActiveFilters() ? '該当なし' : '記録待ち';

    setText('total-volume', fmtJpy(filtered.totalQuoteVolume));
    setText('top-exchange', topExchange ? `${topExchange.exchangeLabel} ${fmtPct(topExchange.sharePct)}` : '-');
    setText('share-status', status.running ? '更新中' : (allRowCount > 0 ? '集計済み' : '記録待ち'));
    setText('share-updated-at', fmtDateTime(meta.latestCapturedAt || meta.generatedAt));

    const dateRange = meta.earliestVolumeDateJst && meta.latestVolumeDateJst
      ? `${meta.earliestVolumeDateJst} - ${meta.latestVolumeDateJst}`
      : '最新収集値';
    setText(
      'share-meta',
      `${label} | ${sourceLabel(meta)} | ${dateRange} | ${visibleCountLabel}`
    );

    renderExchangeRows(filtered.exchanges, emptyMessage);
    renderInstrumentRows(filtered.rows, emptyMessage);
    renderQualityRows(latestData.quality || []);
    renderVolumeHistory();
  }

  function render(data) {
    latestData = data;
    syncFilterOptions(data);
    renderFilteredShare();
  }

  function baseHistoryChartOptions({ yTitle, yTickCallback, reverseY = false, tooltipLabel }) {
    return {
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
            label: tooltipLabel,
          },
        },
      },
      scales: {
        x: {
          ticks: { color: cssVar('--text-4', '#6f7b76') },
          grid: { color: 'rgba(205, 222, 190, 0.08)' },
        },
        y: {
          beginAtZero: !reverseY,
          reverse: reverseY,
          title: { display: true, text: yTitle, color: cssVar('--text-3', '#9aa6a1') },
          ticks: {
            color: cssVar('--text-4', '#6f7b76'),
            callback: yTickCallback,
          },
          grid: { color: 'rgba(205, 222, 190, 0.08)' },
        },
      },
    };
  }

  function initVolumeHistoryCharts() {
    const shareCanvas = $('volume-share-history-chart');
    const rankCanvas = $('volume-rank-history-chart');
    if (typeof Chart === 'undefined') return;

    if (shareCanvas) {
      volumeShareHistoryChart = new Chart(shareCanvas, {
        type: 'line',
        data: { labels: [], datasets: [] },
        options: baseHistoryChartOptions({
          yTitle: 'シェア (%)',
          yTickCallback: (value) => `${value}%`,
          tooltipLabel: (ctx) => `${ctx.dataset.label}: ${fmtPct(ctx.parsed.y)}`,
        }),
      });
    }

    if (rankCanvas) {
      volumeRankHistoryChart = new Chart(rankCanvas, {
        type: 'line',
        data: { labels: [], datasets: [] },
        options: baseHistoryChartOptions({
          yTitle: '順位',
          reverseY: true,
          yTickCallback: (value) => `${value}位`,
          tooltipLabel: (ctx) => `${ctx.dataset.label}: ${ctx.parsed.y}位`,
        }),
      });
      volumeRankHistoryChart.options.scales.y.min = 1;
      volumeRankHistoryChart.options.scales.y.ticks.stepSize = 1;
      volumeRankHistoryChart.options.scales.y.ticks.precision = 0;
    }
  }

  function historyInstrumentMatches(row) {
    return selectedInstrument === ALL_VALUE || row.instrumentId === selectedInstrument;
  }

  function latestMapValue(dates, byDate, missingValue = null) {
    for (let index = dates.length - 1; index >= 0; index -= 1) {
      const value = byDate.get(dates[index]);
      if (Number.isFinite(Number(value))) return Number(value);
    }
    return missingValue;
  }

  function selectedOptionLabel(selectId, allLabel) {
    const select = $(selectId);
    if (!select || select.value === ALL_VALUE) return allLabel;
    const option = select.selectedOptions && select.selectedOptions[0];
    return option ? option.textContent : select.value;
  }

  function buildVolumeHistorySeries() {
    const dates = Array.from(new Set(volumeHistoryRows.map(row => row.date).filter(Boolean))).sort();
    const daily = new Map();

    for (const row of volumeHistoryRows) {
      if (!row.date || !historyInstrumentMatches(row)) continue;
      const quoteVolume = parseNumber(row.quoteVolume);
      if (quoteVolume == null || quoteVolume < 0) continue;

      if (!daily.has(row.date)) {
        daily.set(row.date, {
          totalQuoteVolume: 0,
          exchanges: new Map(),
        });
      }

      const day = daily.get(row.date);
      const existing = day.exchanges.get(row.exchangeId) || {
        exchangeId: row.exchangeId,
        exchangeLabel: row.exchangeLabel || row.exchangeId,
        quoteVolume: 0,
      };
      existing.quoteVolume += quoteVolume;
      day.exchanges.set(row.exchangeId, existing);
      day.totalQuoteVolume += quoteVolume;
    }

    const seriesByExchange = new Map();
    let maxRank = 1;

    for (const date of dates) {
      const day = daily.get(date);
      if (!day || day.totalQuoteVolume <= 0) continue;

      const ranked = Array.from(day.exchanges.values())
        .sort((a, b) => b.quoteVolume - a.quoteVolume);
      maxRank = Math.max(maxRank, ranked.length);

      ranked.forEach((exchange, index) => {
        if (!seriesByExchange.has(exchange.exchangeId)) {
          seriesByExchange.set(exchange.exchangeId, {
            exchangeId: exchange.exchangeId,
            label: exchange.exchangeLabel,
            shareByDate: new Map(),
            rankByDate: new Map(),
          });
        }

        const series = seriesByExchange.get(exchange.exchangeId);
        series.shareByDate.set(date, (exchange.quoteVolume / day.totalQuoteVolume) * 100);
        series.rankByDate.set(date, index + 1);
      });
    }

    let series = Array.from(seriesByExchange.values());
    if (selectedExchange !== ALL_VALUE) {
      series = series.filter(item => item.exchangeId === selectedExchange);
    } else {
      series = series
        .sort((a, b) => {
          const shareDiff = (latestMapValue(dates, b.shareByDate, -1) ?? -1) - (latestMapValue(dates, a.shareByDate, -1) ?? -1);
          if (shareDiff !== 0) return shareDiff;
          return String(a.label).localeCompare(String(b.label), 'ja');
        })
        .slice(0, 6);
    }

    return {
      dates,
      series,
      maxRank,
    };
  }

  function renderVolumeHistory() {
    if (!volumeShareHistoryChart || !volumeRankHistoryChart) return;

    const { dates, series, maxRank } = buildVolumeHistorySeries();
    const labels = dates.map(shortDate);
    const shareDatasets = series.map((item, index) => {
      const color = chartColor(index);
      return {
        label: item.label,
        data: dates.map(date => item.shareByDate.get(date) ?? null),
        borderColor: color,
        backgroundColor: `${color}24`,
        borderWidth: 2,
        pointRadius: 3,
        pointHoverRadius: 5,
        tension: 0.25,
        spanGaps: true,
      };
    });
    const rankDatasets = series.map((item, index) => {
      const color = chartColor(index);
      return {
        label: item.label,
        data: dates.map(date => item.rankByDate.get(date) ?? null),
        borderColor: color,
        backgroundColor: `${color}24`,
        borderWidth: 2,
        pointRadius: 3,
        pointHoverRadius: 5,
        tension: 0.2,
        spanGaps: true,
      };
    });

    volumeShareHistoryChart.data.labels = labels;
    volumeShareHistoryChart.data.datasets = shareDatasets;
    volumeShareHistoryChart.update('none');

    volumeRankHistoryChart.data.labels = labels;
    volumeRankHistoryChart.data.datasets = rankDatasets;
    volumeRankHistoryChart.options.scales.y.suggestedMax = Math.max(3, maxRank);
    volumeRankHistoryChart.update('none');

    const range = volumeHistoryMeta.earliestVolumeDateJst && volumeHistoryMeta.latestVolumeDateJst
      ? `${volumeHistoryMeta.earliestVolumeDateJst} - ${volumeHistoryMeta.latestVolumeDateJst}`
      : '履歴データ待ち';
    const instrumentLabel = selectedOptionLabel('volume-instrument-filter', '全銘柄');
    const exchangeLabel = selectedOptionLabel('volume-exchange-filter', '上位取引所');
    const seriesLabel = series.length > 0 ? `${series.length}系列` : '該当なし';

    setText(
      'volume-history-meta',
      `${instrumentLabel} | ${exchangeLabel} | ${range} | ${seriesLabel} | ${historySourceLabel(volumeHistoryMeta)}`
    );
    setText('volume-rank-meta', series.length > 0 ? `最大 ${maxRank}位までの日次順位` : '順位データ待ち');
  }

  async function loadShare() {
    setText('share-status', '読み込み中');
    if (shareAbortController) {
      shareAbortController.abort();
      shareAbortController = null;
    }
    const controller = new AbortController();
    shareAbortController = controller;
    try {
      const res = await fetch(`/api/volume-share?window=${encodeURIComponent(selectedWindow)}`, {
        cache: 'no-store',
        signal: controller.signal,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      render(await res.json());
    } catch (err) {
      if (err.name === 'AbortError') return;
      setText('share-status', '取得失敗');
      setText('share-meta', err.message);
    } finally {
      if (shareAbortController === controller) {
        shareAbortController = null;
      }
    }
  }

  async function loadVolumeHistory() {
    setText('volume-history-meta', '日次スナップショットを読み込み中');
    if (volumeHistoryAbortController) {
      volumeHistoryAbortController.abort();
      volumeHistoryAbortController = null;
    }
    const controller = new AbortController();
    volumeHistoryAbortController = controller;
    try {
      const res = await fetch(`/api/volume-share/history?window=${encodeURIComponent(selectedHistoryWindow)}`, {
        cache: 'no-store',
        signal: controller.signal,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      volumeHistoryRows = data.rows || [];
      volumeHistoryMeta = data.meta || {};
      renderVolumeHistory();
    } catch (err) {
      if (err.name === 'AbortError') return;
      setText('volume-history-meta', err.message);
      setText('volume-rank-meta', '取得失敗');
    } finally {
      if (volumeHistoryAbortController === controller) {
        volumeHistoryAbortController = null;
      }
    }
  }

  const shareRefreshTask = pagePoller.createTask({
    intervalMs: SHARE_REFRESH_MS,
    callback: loadShare,
  });

  const volumeHistoryRefreshTask = pagePoller.createTask({
    intervalMs: VOLUME_HISTORY_REFRESH_MS,
    callback: loadVolumeHistory,
  });

  document.querySelectorAll('[data-window]').forEach(button => {
    button.addEventListener('click', () => {
      selectedWindow = button.dataset.window || '1d';
      document.querySelectorAll('[data-window]').forEach(item => {
        const isActive = item === button;
        item.classList.toggle('active', isActive);
        item.setAttribute('aria-selected', isActive ? 'true' : 'false');
      });
      loadShare();
    });
  });

  const instrumentFilter = $('volume-instrument-filter');
  if (instrumentFilter) {
    instrumentFilter.addEventListener('change', () => {
      selectedInstrument = instrumentFilter.value || ALL_VALUE;
      renderFilteredShare();
    });
  }

  const exchangeFilter = $('volume-exchange-filter');
  if (exchangeFilter) {
    exchangeFilter.addEventListener('change', () => {
      selectedExchange = exchangeFilter.value || ALL_VALUE;
      renderFilteredShare();
    });
  }

  document.querySelectorAll('[data-volume-history-window]').forEach(button => {
    button.addEventListener('click', () => {
      selectedHistoryWindow = button.dataset.volumeHistoryWindow || '30d';
      document.querySelectorAll('[data-volume-history-window]').forEach(item => {
        const isActive = item === button;
        item.classList.toggle('active', isActive);
        item.setAttribute('aria-selected', isActive ? 'true' : 'false');
      });
      loadVolumeHistory();
    });
  });

  initVolumeHistoryCharts();
  loadShare();
  loadVolumeHistory();
  shareRefreshTask.start({ immediate: false });
  volumeHistoryRefreshTask.start({ immediate: false });
  window.addEventListener('beforeunload', () => {
    pagePoller.dispose();
    if (shareAbortController) shareAbortController.abort();
    if (volumeHistoryAbortController) volumeHistoryAbortController.abort();
  });
});
