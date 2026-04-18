document.addEventListener('DOMContentLoaded', () => {
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

  const $ = (id) => document.getElementById(id);
  const setText = (id, value) => {
    const el = $(id);
    if (el) el.textContent = value ?? '-';
  };

  const fmtPct = (value, decimals = 2) => value == null || isNaN(value) ? '-' : `${value.toFixed(decimals)}%`;
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

  function priceDecimals(value, precision) {
    const abs = Math.abs(Number(value));
    if (!Number.isFinite(abs)) return 0;
    if (abs >= 1000) return 0;
    if (abs >= 100) return Math.min(Math.max(precision ?? 1, 1), 2);
    if (abs >= 1) return Math.min(Math.max(precision ?? 2, 2), 4);
    return Math.min(Math.max(precision ?? 4, 4), 8);
  }

  function fmtJpyPrice(value, precision) {
    if (value == null || isNaN(value)) return '-';
    const decimals = priceDecimals(value, precision);
    return new Intl.NumberFormat('ja-JP', {
      style: 'currency',
      currency: 'JPY',
      minimumFractionDigits: 0,
      maximumFractionDigits: decimals,
    }).format(value);
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function sourceLabel(windowMeta) {
    if (!windowMeta) return '記録待ち';
    if (windowMeta.source === 'daily-snapshots') return `JST日次記録 ${windowMeta.sampleSnapshotCount}件`;
    if (windowMeta.source === 'daily-snapshot') return 'JST日次記録';
    if (windowMeta.source === 'latest-fallback') return '最新収集値';
    if (windowMeta.source === 'latest') return '最新収集値';
    return '記録待ち';
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
            <div class="font-bold text-gray-200">${escapeHtml(row.instrumentLabel)}</div>
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

  function renderSummary(rows) {
    const rowsWith24h = rows.filter(row => row.averages && row.averages['1d']);
    const avg24hPct = rowsWith24h.length > 0
      ? rowsWith24h.reduce((sum, row) => sum + row.averages['1d'].spreadPct, 0) / rowsWith24h.length
      : null;
    const widest = rowsWith24h.slice().sort((a, b) => b.averages['1d'].spreadPct - a.averages['1d'].spreadPct)[0];
    const status = latestMeta.refreshStatus || {};

    setText('avg-spread-24h', fmtPct(avg24hPct));
    setText('widest-spread', widest ? `${widest.instrumentLabel} ${fmtPct(widest.averages['1d'].spreadPct)}` : '-');
    setText('spread-count', hasActiveFilters() ? `${rows.length}/${allRows.length}` : allRows.length);
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
  }

  function render(data) {
    latestMeta = data.meta || {};
    allRows = data.rows || [];
    populateExchangeFilter();
    renderView();
  }

  async function loadSpread() {
    setText('spread-status', '読み込み中');
    try {
      const res = await fetch('/api/sales-spread', {
        cache: 'no-store',
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      render(await res.json());
    } catch (err) {
      setText('spread-status', '取得失敗');
      setText('spread-meta', err.message);
    }
  }

  const filterInput = $('spread-filter');
  if (filterInput) {
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
    });
  }

  loadSpread();
  setInterval(loadSpread, 60000);
});
