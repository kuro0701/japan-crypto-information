document.addEventListener('DOMContentLoaded', () => {
  const WINDOW_LABELS = {
    '1d': '24h',
    '7d': '7日',
    '30d': '30日',
  };
  let allRows = [];
  let filterText = '';

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

  function rowMatchesFilter(row) {
    if (!filterText) return true;
    const needle = filterText.toLowerCase();
    return [
      row.instrumentLabel,
      row.baseCurrency,
      row.currencyFullName,
      row.exchangeLabel,
    ].some(value => String(value || '').toLowerCase().includes(needle));
  }

  function renderRows() {
    const tbody = $('sales-spread-tbody');
    if (!tbody) return;

    const rows = allRows.filter(rowMatchesFilter);
    if (rows.length === 0) {
      tbody.innerHTML = '<tr><td colspan="8" class="text-center text-gray-500 py-4">記録待ち</td></tr>';
      return;
    }

    tbody.innerHTML = rows.map(row => {
      const latest = row.latest || {};
      const precision = latest.quotePrecision ?? null;
      return `
        <tr class="border-b border-gray-800/60">
          <td class="px-3 py-3">
            <div class="font-bold text-gray-200">${escapeHtml(row.instrumentLabel)}</div>
            <div class="text-[10px] text-gray-500">${escapeHtml(row.currencyFullName || row.baseCurrency)}</div>
          </td>
          <td class="px-3 py-3 text-gray-300">${escapeHtml(row.exchangeLabel)}</td>
          <td class="px-3 py-3 text-right font-mono text-red-300">${fmtJpyPrice(latest.buyPrice, precision)}</td>
          <td class="px-3 py-3 text-right font-mono text-green-300">${fmtJpyPrice(latest.sellPrice, precision)}</td>
          <td class="px-3 py-3 text-right">${latestSpreadCell(row)}</td>
          <td class="px-3 py-3 text-right">${spreadCell(row.averages['1d'], precision)}</td>
          <td class="px-3 py-3 text-right">${spreadCell(row.averages['7d'], precision)}</td>
          <td class="px-3 py-3 text-right">${spreadCell(row.averages['30d'], precision)}</td>
        </tr>
      `;
    }).join('');
  }

  function render(data) {
    const meta = data.meta || {};
    allRows = data.rows || [];
    const rowsWith24h = allRows.filter(row => row.averages && row.averages['1d']);
    const avg24hPct = rowsWith24h.length > 0
      ? rowsWith24h.reduce((sum, row) => sum + row.averages['1d'].spreadPct, 0) / rowsWith24h.length
      : null;
    const widest = rowsWith24h.slice().sort((a, b) => b.averages['1d'].spreadPct - a.averages['1d'].spreadPct)[0];
    const status = meta.refreshStatus || {};
    const windows = meta.windows || {};
    const range30d = windows['30d'] && windows['30d'].earliestSpreadDateJst && windows['30d'].latestSpreadDateJst
      ? `${windows['30d'].earliestSpreadDateJst} - ${windows['30d'].latestSpreadDateJst}`
      : '最新収集値';

    setText('avg-spread-24h', fmtPct(avg24hPct));
    setText('widest-spread', widest ? `${widest.instrumentLabel} ${fmtPct(widest.averages['1d'].spreadPct)}` : '-');
    setText('spread-count', allRows.length);
    setText('spread-status', status.running ? '更新中' : (allRows.length > 0 ? '集計済み' : '記録待ち'));
    setText('spread-updated-at', fmtDateTime(meta.latestCapturedAt || meta.generatedAt));
    setText(
      'spread-meta',
      `${Object.keys(WINDOW_LABELS).map(key => `${WINDOW_LABELS[key]} ${sourceLabel(windows[key])}`).join(' | ')} | ${range30d} | ${allRows.length}件`
    );

    renderRows();
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
      renderRows();
    });
  }

  loadSpread();
  setInterval(loadSpread, 60000);
});
