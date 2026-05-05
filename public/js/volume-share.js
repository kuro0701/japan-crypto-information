document.addEventListener('DOMContentLoaded', () => {
  const Api = window.AppApi;
  const AppFmt = window.AppFormatters;
  const AppUtil = window.AppUtils;
  const pagePoller = window.PagePoller.create();
  const WINDOW_LABELS = {
    '1d': '24時間',
    '7d': '7日間',
    '30d': '30日間',
  };
  const WINDOW_GUIDES = {
    '1d': '直近の勢いを見る',
    '7d': '一時的なブレをならして見る',
    '30d': '普段の流動性を見る',
  };
  const PERIOD_COMPARISON_LABELS = {
    '1d': '前日比',
    '7d': '前7日比',
    '30d': '前30日比',
  };
  const ALL_VALUE = '__all__';
  const HISTORY_FETCH_WINDOW = '90d';
  const INSIGHTS_FETCH_WINDOW = '90d';
  let selectedWindow = '1d';
  let selectedInstrument = ALL_VALUE;
  let selectedExchange = ALL_VALUE;
  let selectedHistoryWindow = '30d';
  let latestData = null;
  let volumeHistoryRows = [];
  let volumeHistoryMeta = {};
  let volumeShareHistoryChart = null;
  let shareAbortController = null;
  let volumeHistoryAbortController = null;
  let volumeInsightsAbortController = null;
  const CHART_COLORS = ['#35e0a5', '#ff6b70', '#35c8d2', '#f4c95d', '#dbe7df', '#ff9f7e', '#9ad46a'];
  const SHARE_REFRESH_MS = 60000;
  const VOLUME_HISTORY_REFRESH_MS = 600000;
  const VOLUME_INSIGHTS_REFRESH_MS = 600000;
  const EMPTY_FILTER_MESSAGE = '条件に合う出来高データがありません。フィルターを変更してください。';
  const WAITING_DATA_MESSAGE = '出来高データを取得中です。集計に数秒かかる場合があります。';
  const PARTIAL_DATA_FAILURE_MESSAGE = '一部の取引所APIからデータを取得できていません。取得できた取引所のみで比較しています。';

  const $ = AppUtil.byId;
  const setText = AppUtil.setText;
  const escapeHtml = AppUtil.escapeHtml;
  const marketPageUrl = AppUtil.marketPageUrl;
  const cssVar = AppUtil.cssVar;
  const parseNumber = AppUtil.parseNumber;
  const setHtml = (id, html) => {
    const el = $(id);
    if (el) el.innerHTML = html;
    return el;
  };
  const fmtJpy = (value) => Fmt.jpyLarge(value);
  const fmtPct = AppFmt.pct;
  const fmtPctCompact = (value, digits = 1) => AppFmt.pct(value, digits);
  const fmtDateTime = AppFmt.dateTime;
  const shortDate = AppFmt.shortDate;
  const WINDOW_VALUES = new Set(Object.keys(WINDOW_LABELS));
  const HISTORY_WINDOW_VALUES = new Set(['7d', '30d']);
  const KPI_TONE_CLASSES = ['is-positive', 'is-caution', 'is-danger'];
  const INSIGHT_TYPE_LABELS = {
    top_gainer: '増加',
    top_loser: '低下',
    share_up: 'シェア増加',
    share_down: 'シェア低下',
    leader_change: '首位交代',
    leader_gap_change: '首位',
    leader_hold: '首位',
    rank_up: '順位上昇',
    rank_down: '順位低下',
    leader_gap_narrow: '差縮小',
    leader_gap_widen: '差拡大',
    above_gap_narrow: '直上差',
    above_gap_widen: '直上差',
    increase_streak: '連続上昇',
    decrease_streak: '連続低下',
    zscore_outlier: '異常値',
    market_concentration: '市場構造',
    hhi_change: '市場構造',
  };

  function normalizeWindow(value, fallback) {
    return WINDOW_VALUES.has(value) ? value : fallback;
  }

  function normalizeHistoryWindow(value, fallback) {
    return HISTORY_WINDOW_VALUES.has(value) ? value : fallback;
  }

  function normalizeInstrumentId(value) {
    const normalized = String(value || '').trim().toUpperCase();
    return /^[A-Z0-9]+-[A-Z0-9]+$/.test(normalized) ? normalized : ALL_VALUE;
  }

  function normalizeExchangeId(value) {
    const normalized = String(value || '').trim().toLowerCase();
    return normalized || ALL_VALUE;
  }

  function readInitialState() {
    const params = new URLSearchParams(window.location.search);
    return {
      window: normalizeWindow(params.get('window'), '1d'),
      instrumentId: normalizeInstrumentId(params.get('instrumentId') || params.get('instrument') || params.get('market')),
      exchangeId: normalizeExchangeId(params.get('exchange') || params.get('exchangeId')),
      historyWindow: normalizeHistoryWindow(params.get('historyWindow'), '30d'),
    };
  }

  function writeUrlState() {
    const params = new URLSearchParams();
    if (selectedWindow !== '1d') params.set('window', selectedWindow);
    if (selectedInstrument !== ALL_VALUE) params.set('instrumentId', selectedInstrument);
    if (selectedExchange !== ALL_VALUE) params.set('exchange', selectedExchange);
    if (selectedHistoryWindow !== '30d') params.set('historyWindow', selectedHistoryWindow);
    const nextUrl = params.toString()
      ? `${window.location.pathname}?${params.toString()}`
      : window.location.pathname;
    window.history.replaceState(null, '', nextUrl);
  }

  function syncTabButtons(selector, datasetKey, activeValue) {
    document.querySelectorAll(selector).forEach((button) => {
      const isActive = (button.dataset[datasetKey] || '') === activeValue;
      button.classList.toggle('active', isActive);
      button.setAttribute('aria-selected', isActive ? 'true' : 'false');
    });
  }

  function activateWindow(nextWindow) {
    selectedWindow = normalizeWindow(nextWindow, '1d');
    syncTabButtons('[data-window]', 'window', selectedWindow);
    updateWindowGuide();
    loadShare();
  }

  const initialState = readInitialState();
  selectedWindow = initialState.window;
  selectedInstrument = initialState.instrumentId;
  selectedExchange = initialState.exchangeId;
  selectedHistoryWindow = initialState.historyWindow;

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
    if (meta.source === 'latest-fallback') return '最新24h収集値';
    return 'データ取得中';
  }

  function chartColor(index) {
    return CHART_COLORS[index % CHART_COLORS.length];
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

  function renderExchangeRows(exchanges, emptyMessage = WAITING_DATA_MESSAGE) {
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

  function renderInstrumentRows(rows, emptyMessage = WAITING_DATA_MESSAGE) {
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
      tbody.innerHTML = `<tr><td colspan="6" class="text-center text-gray-500 py-4">${WAITING_DATA_MESSAGE}</td></tr>`;
      setText('volume-quality-meta', '取引所APIの取得状況を確認中です。');
      return;
    }

    const successCount = rows.filter(row => row.apiStatus === 'success').length;
    const issueCount = rows.filter(row => row.apiStatus === 'partial' || row.apiStatus === 'failed').length;
    const measuredCount = rows.reduce((sum, row) => sum + (Number(row.measuredCount) || 0), 0);
    const estimatedCount = rows.reduce((sum, row) => sum + (Number(row.estimatedCount) || 0), 0);
    setText(
      'volume-quality-meta',
      `${rows.length}取引所 | 成功 ${successCount} | 要確認 ${issueCount} | 実測 ${measuredCount} / 推定 ${estimatedCount}${issueCount > 0 ? ` | ${PARTIAL_DATA_FAILURE_MESSAGE}` : ''}`
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

  function setKpiValue(id, value, tone = '') {
    const el = $(id);
    if (!el) return;
    el.textContent = value ?? '-';
    el.classList.remove(...KPI_TONE_CLASSES);
    if (tone && KPI_TONE_CLASSES.includes(tone)) {
      el.classList.add(tone);
    }
  }

  function updateWindowGuide() {
    document.querySelectorAll('[data-window-guide]').forEach((card) => {
      const isActive = (card.dataset.windowGuide || '') === selectedWindow;
      card.classList.toggle('is-active', isActive);
      card.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    });
  }

  function formatCount(count, suffix) {
    return Number.isFinite(Number(count)) ? `${Number(count)}${suffix}` : '-';
  }

  function formatSignedPercent(value, digits = 1) {
    const num = Number(value);
    if (!Number.isFinite(num)) return '-';
    const abs = Math.abs(num).toFixed(digits);
    if (num > 0) return `+${abs}%`;
    if (num < 0) return `-${abs}%`;
    return `0.${'0'.repeat(digits)}%`;
  }

  function formatSignedJpy(value) {
    const num = Number(value);
    if (!Number.isFinite(num)) return '-';
    const absLabel = fmtJpy(Math.abs(num));
    if (num > 0) return `+${absLabel}`;
    if (num < 0) return `-${absLabel}`;
    return absLabel;
  }

  function dominantVolumeRow(rows) {
    return (rows || []).reduce((best, row) => {
      if (!best) return row;
      return Number(row.quoteVolume || 0) > Number(best.quoteVolume || 0) ? row : best;
    }, null);
  }

  function topThreeShare(exchanges) {
    return (exchanges || [])
      .slice(0, 3)
      .reduce((sum, exchange) => sum + (Number(exchange.sharePct) || 0), 0);
  }

  function concentrationMeta(sharePct, exchangeCount) {
    if (!exchangeCount) {
      return {
        label: 'データ待ち',
        detail: '比較対象の集計待ち',
        tone: 'is-danger',
      };
    }
    if (exchangeCount === 1) {
      return {
        label: '単独表示',
        detail: '1社のみ表示中',
        tone: 'is-caution',
      };
    }
    if (sharePct >= 85) {
      return {
        label: 'かなり集中',
        detail: '上位数社への偏りが強い状態です',
        tone: 'is-danger',
      };
    }
    if (sharePct >= 70) {
      return {
        label: '比較的集中',
        detail: '上位3社の影響が大きい状態です',
        tone: 'is-caution',
      };
    }
    if (sharePct >= 55) {
      return {
        label: 'やや分散',
        detail: '複数社に流動性が分かれています',
        tone: 'is-positive',
      };
    }
    return {
      label: '分散',
      detail: '複数社に流動性が広く分散しています',
      tone: 'is-positive',
    };
  }

  function concentrationSentence(label) {
    if (!label) return '判断待ちです。';
    if (label === '分散' || label === 'やや分散') return `${label}しています。`;
    if (label === '比較的集中' || label === 'かなり集中') return `${label}しています。`;
    return `${label}です。`;
  }

  function shareTone(sharePct) {
    const share = Number(sharePct);
    if (!Number.isFinite(share)) return '';
    if (share >= 50) return 'is-danger';
    if (share >= 35) return 'is-caution';
    return 'is-positive';
  }

  function qualityRowsForScope(qualityRows, filtered) {
    const exchangeIds = new Set((filtered.exchanges || []).map(exchange => exchange.exchangeId));
    return (qualityRows || []).filter((row) => {
      if (selectedExchange !== ALL_VALUE) return row.exchangeId === selectedExchange;
      if (exchangeIds.size === 0) return false;
      return exchangeIds.has(row.exchangeId);
    });
  }

  function reliabilityMeta(qualityRows, filtered, referenceTime) {
    const rows = qualityRowsForScope(qualityRows, filtered);
    if (rows.length === 0) {
      return {
        label: '-',
        detail: '取得状況を確認中',
        tone: '',
      };
    }

    const successCount = rows.filter(row => row.apiStatus === 'success').length;
    const partialCount = rows.filter(row => row.apiStatus === 'partial').length;
    const failedCount = rows.filter(row => row.apiStatus === 'failed').length;
    const measuredCount = rows.reduce((sum, row) => sum + (Number(row.measuredCount) || 0), 0);
    const estimatedCount = rows.reduce((sum, row) => sum + (Number(row.estimatedCount) || 0), 0);
    const observedCount = measuredCount + estimatedCount;
    const measuredRatio = observedCount > 0 ? measuredCount / observedCount : 0;

    const referenceMs = Date.parse(referenceTime || '');
    const freshCount = Number.isFinite(referenceMs)
      ? rows.filter((row) => {
        const fetchedMs = Date.parse(row.lastFetchedAt || '');
        return Number.isFinite(fetchedMs) && Math.abs(referenceMs - fetchedMs) <= 6 * 60 * 60 * 1000;
      }).length
      : 0;
    const successRatio = successCount / rows.length;
    const freshnessRatio = rows.length > 0 ? freshCount / rows.length : 0;
    const score = successRatio * 0.65 + measuredRatio * 0.25 + freshnessRatio * 0.10;

    let label = '高';
    let tone = 'is-positive';
    if (score < 0.55 || (failedCount > 0 && successRatio < 0.6)) {
      label = '要確認';
      tone = 'is-danger';
    } else if (score < 0.8 || partialCount > 0) {
      label = '中';
      tone = 'is-caution';
    }

    const detailParts = [
      `成功 ${successCount}/${rows.length}社`,
      `実測 ${observedCount > 0 ? Math.round(measuredRatio * 100) : 0}%`,
    ];
    if (failedCount > 0) detailParts.push(`失敗 ${failedCount}`);

    return {
      label,
      detail: detailParts.join(' | '),
      tone,
    };
  }

  function buildDailyTotals() {
    const byDate = new Map();

    for (const row of volumeHistoryRows) {
      if (!row.date || !rowMatchesFilters(row)) continue;
      const quoteVolume = parseNumber(row.quoteVolume);
      if (quoteVolume == null || quoteVolume < 0) continue;
      byDate.set(row.date, (byDate.get(row.date) || 0) + quoteVolume);
    }

    return Array.from(byDate.entries())
      .sort((a, b) => String(a[0]).localeCompare(String(b[0])))
      .map(([date, totalQuoteVolume]) => ({ date, totalQuoteVolume }));
  }

  function historyRowsForWindow(windowKey) {
    const targetDays = {
      '7d': 7,
      '30d': 30,
    }[windowKey];
    if (!targetDays) return volumeHistoryRows.slice();

    const dates = Array.from(new Set(volumeHistoryRows.map(row => row.date).filter(Boolean))).sort();
    const targetDateSet = new Set(dates.slice(-targetDays));
    return volumeHistoryRows.filter(row => targetDateSet.has(row.date));
  }

  function comparisonMetaForWindow(windowKey, filteredTotalQuoteVolume) {
    const totals = buildDailyTotals();
    const comparisonLabel = PERIOD_COMPARISON_LABELS[windowKey] || '前期間比';

    if (windowKey === '1d') {
      const previous = totals[totals.length - 1];
      if (!previous || !(previous.totalQuoteVolume > 0)) {
        return {
          label: comparisonLabel,
          value: '-',
          detail: '前日データ待ち',
          tone: '',
        };
      }

      const diff = Number(filteredTotalQuoteVolume || 0) - previous.totalQuoteVolume;
      return {
        label: comparisonLabel,
        value: formatSignedPercent((diff / previous.totalQuoteVolume) * 100),
        detail: `${formatSignedJpy(diff)} | 前日 ${shortDate(previous.date)} 比`,
        tone: diff > 0 ? 'is-positive' : diff < 0 ? 'is-danger' : '',
      };
    }

    const periodDays = {
      '7d': 7,
      '30d': 30,
    }[windowKey];

    if (!periodDays || totals.length < periodDays * 2) {
      return {
        label: comparisonLabel,
        value: '-',
        detail: `${comparisonLabel}の比較期間待ち`,
        tone: '',
      };
    }

    const previousPeriod = totals.slice(-(periodDays * 2), -periodDays);
    const currentPeriod = totals.slice(-periodDays);
    const previousTotal = previousPeriod.reduce((sum, row) => sum + (Number(row.totalQuoteVolume) || 0), 0);
    const currentTotal = Number.isFinite(Number(filteredTotalQuoteVolume))
      ? Number(filteredTotalQuoteVolume)
      : currentPeriod.reduce((sum, row) => sum + (Number(row.totalQuoteVolume) || 0), 0);

    if (!(previousTotal > 0)) {
      return {
        label: comparisonLabel,
        value: '-',
        detail: `${comparisonLabel}の比較期間待ち`,
        tone: 'is-caution',
      };
    }

    const diff = currentTotal - previousTotal;
    return {
      label: comparisonLabel,
      value: formatSignedPercent((diff / previousTotal) * 100),
      detail: `${formatSignedJpy(diff)} | ${shortDate(currentPeriod[0].date)} - ${shortDate(currentPeriod[currentPeriod.length - 1].date)} vs ${shortDate(previousPeriod[0].date)} - ${shortDate(previousPeriod[previousPeriod.length - 1].date)}`,
      tone: diff > 0 ? 'is-positive' : diff < 0 ? 'is-danger' : '',
    };
  }

  function simulatorUrlForSummary(primaryRow, topExchange) {
    const params = new URLSearchParams();
    const instrumentId = selectedInstrument !== ALL_VALUE
      ? selectedInstrument
      : (primaryRow && primaryRow.instrumentId ? primaryRow.instrumentId : '');
    const exchangeId = selectedExchange !== ALL_VALUE
      ? selectedExchange
      : (topExchange && topExchange.exchangeId
        ? topExchange.exchangeId
        : (primaryRow && primaryRow.exchangeId ? primaryRow.exchangeId : ''));

    if (instrumentId) params.set('market', instrumentId);
    if (exchangeId) params.set('exchange', exchangeId);
    return params.toString() ? `/simulator?${params.toString()}` : '/simulator';
  }

  function renderKpis(filtered, meta, qualityRows) {
    const label = WINDOW_LABELS[meta.windowKey] || WINDOW_LABELS[selectedWindow];
    const topExchange = filtered.exchanges[0] || null;
    const topShare = topExchange ? Number(topExchange.sharePct) || 0 : null;
    const top3 = topThreeShare(filtered.exchanges);
    const concentration = concentrationMeta(top3, filtered.exchanges.length);
    const reliability = reliabilityMeta(qualityRows, filtered, meta.latestCapturedAt || meta.generatedAt);
    const dailyChange = comparisonMetaForWindow(meta.windowKey || selectedWindow, filtered.totalQuoteVolume);
    const instrumentLabel = selectedOptionLabel('volume-instrument-filter', '全銘柄');
    const exchangeLabel = selectedOptionLabel('volume-exchange-filter', '全取引所');

    setKpiValue('total-volume', fmtJpy(filtered.totalQuoteVolume));
    setText('total-volume-meta', `${label}累計 | ${filtered.rows.length}件`);

    setKpiValue('top-exchange', topExchange ? topExchange.exchangeLabel : '-', topExchange ? 'is-positive' : '');
    setText('top-exchange-meta', topExchange ? `全体シェア ${fmtPctCompact(topShare, 1)}` : '首位データ待ち');

    setKpiValue('top-share', topExchange ? fmtPctCompact(topShare, 1) : '-', topExchange ? shareTone(topShare) : '');
    setText('top-share-meta', topExchange ? `${topExchange.exchangeLabel} が首位` : '比較対象待ち');

    setKpiValue('top3-share', filtered.exchanges.length > 0 ? fmtPctCompact(top3, 1) : '-', concentration.tone);
    setText('top3-share-meta', concentration.detail);

    setKpiValue('exchange-count', formatCount(filtered.exchanges.length, '社'));
    setText('exchange-count-meta', selectedInstrument !== ALL_VALUE ? `${instrumentLabel} の取引所数` : 'フィルター後の取引所数');

    setKpiValue('instrument-count', formatCount(filtered.instruments.length, '銘柄'));
    setText('instrument-count-meta', selectedExchange !== ALL_VALUE ? `${exchangeLabel} の取扱銘柄数` : 'フィルター後の銘柄数');

    setText('daily-change-label', dailyChange.label);
    setKpiValue('daily-change', dailyChange.value, dailyChange.tone);
    setText('daily-change-meta', dailyChange.detail);

    setKpiValue('data-reliability', reliability.label, reliability.tone);
    setText('data-reliability-meta', reliability.detail);

    return {
      concentration,
      dailyChange,
      reliability,
      topExchange,
      top3,
    };
  }

  function renderLiquiditySummary(filtered, meta, summaryParts) {
    const badge = $('volume-summary-badge');
    const topExchange = summaryParts.topExchange;
    const primaryRow = dominantVolumeRow(filtered.rows);
    const label = WINDOW_LABELS[meta.windowKey] || WINDOW_LABELS[selectedWindow];
    const instrumentLabel = selectedOptionLabel('volume-instrument-filter', '全銘柄');
    const exchangeLabel = selectedOptionLabel('volume-exchange-filter', '全取引所');

    if (badge) {
      badge.classList.remove('decision-summary-badge--idle', 'decision-summary-badge--loading', 'decision-summary-badge--ready', 'decision-summary-badge--error');
    }

    if (!primaryRow || !topExchange) {
      if (badge) {
        badge.classList.add('decision-summary-badge--error');
        badge.textContent = 'データ待ち';
      }
      setText('volume-summary-lead', '表示中の条件では、出来高データをまだ集計できていません。');
      setText('volume-summary-body', 'フィルター条件を変えるか、次回更新後にもう一度確認してください。');
      setText('volume-summary-note', '大きめの注文を出す前には、板シミュレーターで実効コストも確認してください。');
      setHtml('volume-summary-chips', '<span class="decision-summary-chip">集計待ち</span>');
      const link = $('volume-summary-link');
      if (link) {
        link.href = '/simulator';
        link.textContent = '板シミュレーターを開く';
      }
      return;
    }

    if (badge) {
      badge.classList.add('decision-summary-badge--ready');
      badge.textContent = summaryParts.concentration.label;
    }

    let lead = '';
    let body = '';
    if (selectedExchange !== ALL_VALUE && filtered.exchanges.length === 1) {
      if (selectedInstrument !== ALL_VALUE) {
        lead = `${label}では、${instrumentLabel} の出来高として ${exchangeLabel} のデータを表示しています。`;
        body = `${exchangeLabel} に絞り込んでいるため、取引所シェアは 100% 表示です。必要に応じてフィルターを解除し、取引所横断の集中度も確認してください。`;
      } else {
        lead = `${label}では、${exchangeLabel} の取扱銘柄の中で ${primaryRow.instrumentLabel} が最大出来高です。`;
        body = `${exchangeLabel} に絞り込んでいるため、取引所集中度は参考値です。銘柄の偏りと、取引所横断の比較は別々に確認すると判断しやすくなります。`;
      }
    } else if (selectedInstrument !== ALL_VALUE) {
      lead = `${label}では、${instrumentLabel} の出来高は ${topExchange.exchangeLabel} が首位です。`;
      body = `上位3取引所で全体の約${fmtPctCompact(summaryParts.top3, 1)}を占めており、流動性は${concentrationSentence(summaryParts.concentration.label)}`;
    } else {
      lead = `${label}では、表示中の全銘柄合計で ${topExchange.exchangeLabel} が首位です。`;
      body = `上位3取引所で全体の約${fmtPctCompact(summaryParts.top3, 1)}を占めており、流動性は${concentrationSentence(summaryParts.concentration.label)}`;
    }

    const dailyChangeText = summaryParts.dailyChange.value !== '-'
      ? `${summaryParts.dailyChange.label} は ${summaryParts.dailyChange.value} です。`
      : `${summaryParts.dailyChange.label} はまだ計算できません。`;
    const note = `${dailyChangeText} 大きめの注文を出す場合は、板シミュレーターで実効コストも確認してください。`;

    setText('volume-summary-lead', lead);
    setText('volume-summary-body', body);
    setText('volume-summary-note', note);

    setHtml(
      'volume-summary-chips',
      [
        `<span class="decision-summary-chip">${escapeHtml(label)}</span>`,
        `<span class="decision-summary-chip">${escapeHtml(WINDOW_GUIDES[selectedWindow] || '')}</span>`,
        `<span class="decision-summary-chip">信頼度 ${escapeHtml(summaryParts.reliability.label)}</span>`,
        `<span class="decision-summary-chip">${escapeHtml(
          selectedInstrument !== ALL_VALUE
            ? instrumentLabel
            : (selectedExchange !== ALL_VALUE ? exchangeLabel : '全銘柄')
        )}</span>`,
      ].join('')
    );

    const link = $('volume-summary-link');
    if (link) {
      link.href = simulatorUrlForSummary(primaryRow, topExchange);
      link.textContent = primaryRow && primaryRow.instrumentLabel
        ? `${primaryRow.instrumentLabel} を板シミュレーターで確認`
        : '板シミュレーターで確認';
    }
  }

  function insightTone(insight) {
    const direction = insight && insight.direction;
    if (direction === 'up' || direction === 'concentrating') return 'is-positive';
    if (direction === 'down') return 'is-danger';
    if (direction === 'narrow' || direction === 'dispersing') return 'is-caution';
    return '';
  }

  function renderInsights(data) {
    const list = $('volume-insights-list');
    if (!list) return;

    const meta = data && data.meta ? data.meta : {};
    const insights = Array.isArray(data && data.insights) ? data.insights : [];
    const period = meta.period || {};
    const filterParts = [];
    const instrumentLabel = selectedOptionLabel('volume-instrument-filter', '全銘柄');
    const exchangeLabel = selectedOptionLabel('volume-exchange-filter', '全取引所');
    if (selectedInstrument !== ALL_VALUE) filterParts.push(instrumentLabel);
    if (selectedExchange !== ALL_VALUE) filterParts.push(exchangeLabel);
    const range = meta.earliestDate && meta.latestDate ? `${meta.earliestDate} - ${meta.latestDate}` : '履歴データ待ち';
    setText(
      'volume-insights-meta',
      [
        period.comparisonLabel || '前回比',
        range,
        filterParts.length > 0 ? filterParts.join(' / ') : '全体',
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

  function renderFilteredShare() {
    if (!latestData) return;

    const meta = latestData.meta || {};
    const filtered = buildFilteredShare(latestData);
    const status = meta.refreshStatus || {};
    const label = WINDOW_LABELS[meta.windowKey] || WINDOW_LABELS[selectedWindow];
    const allRowCount = (latestData.rows || []).length;
    const visibleCountLabel = hasActiveFilters()
      ? `${filtered.rows.length}/${allRowCount}件`
      : `${filtered.rows.length}件`;
    const emptyMessage = hasActiveFilters() ? EMPTY_FILTER_MESSAGE : WAITING_DATA_MESSAGE;

    setText('share-status', status.running ? '更新中' : (allRowCount > 0 ? '集計済み' : '取得中'));
    setText('share-updated-at', fmtDateTime(meta.latestCapturedAt || meta.generatedAt));

    const dateRange = meta.earliestVolumeDateJst && meta.latestVolumeDateJst
      ? `${meta.earliestVolumeDateJst} - ${meta.latestVolumeDateJst}`
      : '最新収集値';
    const provisionalNote = provisionalSnapshotNote(meta, 'latestProvisionalVolumeDateJst', 'provisionalDailySnapshotCount');
    const partialNote = partialSnapshotNote(meta, 'latestPartialVolumeDateJst', 'partialDailySnapshotCount');
    setText(
      'share-meta',
      [label, sourceLabel(meta), dateRange, visibleCountLabel, provisionalNote, partialNote].filter(Boolean).join(' | ')
    );

    const summaryParts = renderKpis(filtered, meta, latestData.quality || []);
    renderLiquiditySummary(filtered, meta, summaryParts);
    renderExchangeRows(filtered.exchanges, emptyMessage);
    renderInstrumentRows(filtered.rows, emptyMessage);
    renderQualityRows(latestData.quality || []);
    updateWindowGuide();
    renderVolumeHistory();
    writeUrlState();
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
    const scopedRows = historyRowsForWindow(selectedHistoryWindow);
    const dates = Array.from(new Set(scopedRows.map(row => row.date).filter(Boolean))).sort();
    const daily = new Map();

    for (const row of scopedRows) {
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
    for (const date of dates) {
      const day = daily.get(date);
      if (!day || day.totalQuoteVolume <= 0) continue;

      const ranked = Array.from(day.exchanges.values())
        .sort((a, b) => b.quoteVolume - a.quoteVolume);

      ranked.forEach((exchange) => {
        if (!seriesByExchange.has(exchange.exchangeId)) {
          seriesByExchange.set(exchange.exchangeId, {
            exchangeId: exchange.exchangeId,
            label: exchange.exchangeLabel,
            shareByDate: new Map(),
          });
        }

        const series = seriesByExchange.get(exchange.exchangeId);
        series.shareByDate.set(date, (exchange.quoteVolume / day.totalQuoteVolume) * 100);
      });
    }

    let series = Array.from(seriesByExchange.values());
    if (selectedExchange !== ALL_VALUE) {
      series = series.filter(item => item.exchangeId === selectedExchange);
    } else {
      series = series.sort((a, b) => {
        const shareDiff = (latestMapValue(dates, b.shareByDate, -1) ?? -1) - (latestMapValue(dates, a.shareByDate, -1) ?? -1);
        if (shareDiff !== 0) return shareDiff;
        return String(a.label).localeCompare(String(b.label), 'ja');
      });
    }

    return {
      dates,
      series,
    };
  }

  function renderVolumeHistory() {
    if (!volumeShareHistoryChart) return;

    const { dates, series } = buildVolumeHistorySeries();
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

    volumeShareHistoryChart.data.labels = labels;
    volumeShareHistoryChart.data.datasets = shareDatasets;
    volumeShareHistoryChart.update('none');

    const range = dates.length > 0
      ? `${dates[0]} - ${dates[dates.length - 1]}`
      : '履歴データ待ち';
    const instrumentLabel = selectedOptionLabel('volume-instrument-filter', '全銘柄');
    const exchangeLabel = selectedOptionLabel('volume-exchange-filter', '全取引所');
    const seriesLabel = series.length > 0 ? `${series.length}系列` : '該当なし';
    const provisionalNote = provisionalSnapshotNote(volumeHistoryMeta, 'latestProvisionalVolumeDateJst', 'provisionalDailySnapshotCount');
    const partialNote = partialSnapshotNote(volumeHistoryMeta, 'latestPartialVolumeDateJst', 'partialDailySnapshotCount');

    setText(
      'volume-history-meta',
      [instrumentLabel, exchangeLabel, range, seriesLabel, historySourceLabel(volumeHistoryMeta), provisionalNote, partialNote].filter(Boolean).join(' | ')
    );
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
      const data = await Api.fetchJson(`/api/volume-share?window=${encodeURIComponent(selectedWindow)}`, {
        signal: controller.signal,
      });
      render(data);
    } catch (err) {
      if (err.name === 'AbortError') return;
      setText('share-status', '取得できませんでした');
      setText('share-meta', '出来高データを取得できませんでした。時間をおいて再読み込みしてください。');
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
      const data = await Api.fetchJson(`/api/volume-share/history?window=${encodeURIComponent(HISTORY_FETCH_WINDOW)}`, {
        signal: controller.signal,
      });
      volumeHistoryRows = data.rows || [];
      volumeHistoryMeta = data.meta || {};
      if (latestData) {
        renderFilteredShare();
      } else {
        renderVolumeHistory();
      }
    } catch (err) {
      if (err.name === 'AbortError') return;
      setText('volume-history-meta', '出来高履歴を取得できませんでした。時間をおいて再読み込みしてください。');
    } finally {
      if (volumeHistoryAbortController === controller) {
        volumeHistoryAbortController = null;
      }
    }
  }

  async function loadInsights() {
    const list = $('volume-insights-list');
    if (list) {
      list.innerHTML = '<li class="volume-insight-item volume-insight-item--loading">インサイトを生成中です。</li>';
    }
    if (volumeInsightsAbortController) {
      volumeInsightsAbortController.abort();
      volumeInsightsAbortController = null;
    }
    const controller = new AbortController();
    volumeInsightsAbortController = controller;
    try {
      const params = new URLSearchParams({
        window: INSIGHTS_FETCH_WINDOW,
        periods: '1',
        zscoreWindow: '8',
        maxInsights: '6',
      });
      if (selectedInstrument !== ALL_VALUE) params.set('instrumentId', selectedInstrument);
      if (selectedExchange !== ALL_VALUE) params.set('exchangeId', selectedExchange);
      const data = await Api.fetchJson(`/api/volume-share/insights?${params.toString()}`, {
        signal: controller.signal,
      });
      renderInsights(data);
    } catch (err) {
      if (err.name === 'AbortError') return;
      setText('volume-insights-meta', 'インサイトを取得できませんでした。');
      if (list) {
        list.innerHTML = '<li class="volume-insight-item volume-insight-item--empty">時間をおいて再読み込みしてください。</li>';
      }
    } finally {
      if (volumeInsightsAbortController === controller) {
        volumeInsightsAbortController = null;
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

  const volumeInsightsRefreshTask = pagePoller.createTask({
    intervalMs: VOLUME_INSIGHTS_REFRESH_MS,
    callback: loadInsights,
  });

  document.querySelectorAll('[data-window]').forEach(button => {
    button.addEventListener('click', () => {
      activateWindow(button.dataset.window);
    });
  });

  document.querySelectorAll('[data-window-guide]').forEach(button => {
    button.addEventListener('click', () => {
      activateWindow(button.dataset.windowGuide);
    });
  });

  const instrumentFilter = $('volume-instrument-filter');
  if (instrumentFilter) {
    instrumentFilter.addEventListener('change', () => {
      selectedInstrument = instrumentFilter.value || ALL_VALUE;
      renderFilteredShare();
      loadInsights();
    });
  }

  const exchangeFilter = $('volume-exchange-filter');
  if (exchangeFilter) {
    exchangeFilter.addEventListener('change', () => {
      selectedExchange = exchangeFilter.value || ALL_VALUE;
      renderFilteredShare();
      loadInsights();
    });
  }

  document.querySelectorAll('[data-volume-history-window]').forEach(button => {
    button.addEventListener('click', () => {
      selectedHistoryWindow = normalizeHistoryWindow(button.dataset.volumeHistoryWindow, '30d');
      syncTabButtons('[data-volume-history-window]', 'volumeHistoryWindow', selectedHistoryWindow);
      renderVolumeHistory();
      writeUrlState();
    });
  });

  syncTabButtons('[data-window]', 'window', selectedWindow);
  syncTabButtons('[data-volume-history-window]', 'volumeHistoryWindow', selectedHistoryWindow);
  updateWindowGuide();
  writeUrlState();
  initVolumeHistoryCharts();
  loadShare();
  loadVolumeHistory();
  loadInsights();
  shareRefreshTask.start({ immediate: false });
  volumeHistoryRefreshTask.start({ immediate: false });
  volumeInsightsRefreshTask.start({ immediate: false });
  window.addEventListener('beforeunload', () => {
    pagePoller.dispose();
    if (shareAbortController) shareAbortController.abort();
    if (volumeHistoryAbortController) volumeHistoryAbortController.abort();
    if (volumeInsightsAbortController) volumeInsightsAbortController.abort();
  });
});
