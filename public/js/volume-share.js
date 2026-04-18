document.addEventListener('DOMContentLoaded', () => {
  const WINDOW_LABELS = {
    '1d': '24時間',
    '7d': '7日間',
    '30d': '30日間',
  };
  const ALL_VALUE = '__all__';
  let selectedWindow = '1d';
  let selectedInstrument = ALL_VALUE;
  let selectedExchange = ALL_VALUE;
  let latestData = null;

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
        <td class="font-bold text-gray-200" data-label="銘柄">${escapeHtml(row.instrumentLabel)}</td>
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
    setText('instrument-count', filtered.instruments.length);
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
  }

  function render(data) {
    latestData = data;
    syncFilterOptions(data);
    renderFilteredShare();
  }

  async function loadShare() {
    setText('share-status', '読み込み中');
    try {
      const res = await fetch(`/api/volume-share?window=${encodeURIComponent(selectedWindow)}`, {
        cache: 'no-store',
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      render(await res.json());
    } catch (err) {
      setText('share-status', '取得失敗');
      setText('share-meta', err.message);
    }
  }

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

  loadShare();
  setInterval(loadShare, 60000);
});
