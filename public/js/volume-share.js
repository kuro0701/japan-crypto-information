document.addEventListener('DOMContentLoaded', () => {
  const WINDOW_LABELS = {
    '1d': '24時間',
    '7d': '7日間',
    '30d': '30日間',
  };
  let selectedWindow = '1d';

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
    if (meta.source === 'daily-snapshots') return `JST日次記録 ${meta.dailySnapshotCount}件`;
    if (meta.source === 'daily-snapshot') return 'JST日次記録';
    if (meta.source === 'latest-fallback') return '最新24h収集値';
    return '最新24h収集値';
  }

  function renderExchangeRows(exchanges) {
    const tbody = $('exchange-share-tbody');
    if (!tbody) return;

    if (!exchanges || exchanges.length === 0) {
      tbody.innerHTML = '<tr><td colspan="3" class="text-center text-gray-500 py-4">記録待ち</td></tr>';
      return;
    }

    tbody.innerHTML = exchanges.map(exchange => `
      <tr class="border-b border-gray-800/60">
        <td class="px-3 py-3 font-bold text-gray-200">${escapeHtml(exchange.exchangeLabel)}</td>
        <td class="px-3 py-3 text-right font-mono text-gray-300">${fmtJpy(exchange.quoteVolume)}</td>
        <td class="px-3 py-3 text-right font-mono text-yellow-300">
          ${fmtPct(exchange.sharePct)}
          ${shareBar(exchange.sharePct)}
        </td>
      </tr>
    `).join('');
  }

  function renderInstrumentRows(rows) {
    const tbody = $('instrument-share-tbody');
    if (!tbody) return;

    if (!rows || rows.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" class="text-center text-gray-500 py-4">記録待ち</td></tr>';
      return;
    }

    tbody.innerHTML = rows.map(row => `
      <tr class="border-b border-gray-800/60">
        <td class="px-3 py-3 font-bold text-gray-200">${escapeHtml(row.instrumentLabel)}</td>
        <td class="px-3 py-3 text-gray-300">${escapeHtml(row.exchangeLabel)}</td>
        <td class="px-3 py-3 text-right font-mono text-gray-300">
          ${fmtJpy(row.quoteVolume)}
          ${row.quoteVolumeEstimated ? '<span class="text-[10px] text-gray-500 ml-1">推定</span>' : ''}
        </td>
        <td class="px-3 py-3 text-right font-mono text-green-300">
          ${fmtPct(row.instrumentSharePct)}
          ${shareBar(row.instrumentSharePct)}
        </td>
        <td class="px-3 py-3 text-right font-mono text-yellow-300">${fmtPct(row.totalSharePct)}</td>
      </tr>
    `).join('');
  }

  function render(data) {
    const meta = data.meta || {};
    const exchanges = data.exchanges || [];
    const instruments = data.instruments || [];
    const rows = data.rows || [];
    const topExchange = exchanges[0];
    const status = meta.refreshStatus || {};
    const label = WINDOW_LABELS[meta.windowKey] || WINDOW_LABELS[selectedWindow];

    setText('total-volume', fmtJpy(meta.totalQuoteVolume));
    setText('top-exchange', topExchange ? `${topExchange.exchangeLabel} ${fmtPct(topExchange.sharePct)}` : '-');
    setText('instrument-count', instruments.length);
    setText('share-status', status.running ? '更新中' : (rows.length > 0 ? '集計済み' : '記録待ち'));
    setText('share-updated-at', fmtDateTime(meta.latestCapturedAt || meta.generatedAt));

    const dateRange = meta.earliestVolumeDateJst && meta.latestVolumeDateJst
      ? `${meta.earliestVolumeDateJst} - ${meta.latestVolumeDateJst}`
      : '最新収集値';
    setText(
      'share-meta',
      `${label} | ${sourceLabel(meta)} | ${dateRange} | ${rows.length}件`
    );

    renderExchangeRows(exchanges);
    renderInstrumentRows(rows);
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
        item.classList.toggle('active', item === button);
      });
      loadShare();
    });
  });

  loadShare();
  setInterval(loadShare, 60000);
});
