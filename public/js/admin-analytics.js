document.addEventListener('DOMContentLoaded', () => {
  const TOKEN_STORAGE_KEY = 'okjAnalyticsAdminToken';
  const WINDOW_LABELS = {
    '1d': '今日',
    '7d': '7日間',
    '30d': '30日間',
  };
  const ROUTE_LABELS = {
    '/': '板シミュレーター',
    '/volume-share': '出来高シェア',
  };
  const DEVICE_LABELS = {
    desktop: 'デスクトップ',
    mobile: 'モバイル',
    bot: 'Bot',
  };

  let selectedWindow = '7d';
  let adminToken = localStorage.getItem(TOKEN_STORAGE_KEY) || '';

  const $ = (id) => document.getElementById(id);
  const num = (value) => Fmt.num(value || 0);
  const setText = (id, value) => {
    const el = $(id);
    if (el) el.textContent = value ?? '-';
  };

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function fmtDateTime(value) {
    if (!value) return '-';
    return new Date(value).toLocaleString('ja-JP', {
      timeZone: 'Asia/Tokyo',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  function fmtTime(value) {
    if (!value) return '-';
    return new Date(value).toLocaleTimeString('ja-JP', {
      timeZone: 'Asia/Tokyo',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  function labelFor(key, labels) {
    return labels[key] || key || '-';
  }

  function setStatus(text, ok = false) {
    setText('analytics-status', text);
    const dot = $('analytics-status-dot');
    if (!dot) return;
    dot.className = `w-3 h-3 rounded-full ${ok ? 'bg-green-500' : 'bg-red-500'}`;
  }

  function showAuth(message) {
    const panel = $('auth-panel');
    if (panel) panel.classList.remove('hidden');
    setText('auth-message', message || 'アクセス解析を見るにはトークンを入力してください');
  }

  function hideAuth() {
    const panel = $('auth-panel');
    if (panel) panel.classList.add('hidden');
  }

  function readTokenFromUrl() {
    const url = new URL(window.location.href);
    const token = url.searchParams.get('token');
    if (!token) return;

    adminToken = token;
    localStorage.setItem(TOKEN_STORAGE_KEY, token);
    url.searchParams.delete('token');
    window.history.replaceState({}, document.title, `${url.pathname}${url.search}${url.hash}`);
  }

  function barRow(label, count, maxCount) {
    const width = maxCount > 0 ? Math.max(2, Math.min(100, (count / maxCount) * 100)) : 0;
    return `
      <div class="analytics-bar-row">
        <div class="analytics-bar-label" title="${escapeHtml(label)}">${escapeHtml(label)}</div>
        <div class="analytics-bar-track"><span class="analytics-bar-fill" style="width: ${width}%"></span></div>
        <div class="analytics-bar-value">${num(count)}</div>
      </div>
    `;
  }

  function renderBars(targetId, rows, options = {}) {
    const target = $(targetId);
    if (!target) return;

    if (!rows || rows.length === 0) {
      target.innerHTML = `<div class="text-center text-gray-500 py-4">${escapeHtml(options.empty || '記録待ち')}</div>`;
      return;
    }

    const maxCount = Math.max(...rows.map(row => row.count || 0), 0);
    target.innerHTML = rows.map(row => {
      const label = typeof options.formatLabel === 'function'
        ? options.formatLabel(row)
        : row.label || row.key || row.hour || '-';
      return barRow(label, row.count || 0, maxCount);
    }).join('');
  }

  function renderDailyTable(days) {
    const tbody = $('daily-tbody');
    if (!tbody) return;

    if (!days || days.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" class="text-center text-gray-500 py-4">記録待ち</td></tr>';
      return;
    }

    tbody.innerHTML = [...days].reverse().map(day => `
      <tr class="border-b border-gray-800/60">
        <td class="px-3 py-3 font-mono text-gray-200">${escapeHtml(day.date)}</td>
        <td class="px-3 py-3 text-right font-mono text-yellow-300">${num(day.pageViews)}</td>
        <td class="px-3 py-3 text-right font-mono text-green-300">${num(day.uniqueVisitors)}</td>
        <td class="px-3 py-3 text-right font-mono text-gray-300">${num(day.ws && day.ws.connections)}</td>
        <td class="px-3 py-3 text-right font-mono text-red-300">${num(day.ws && day.ws.peakConcurrent)}</td>
        <td class="px-3 py-3 text-right font-mono text-gray-300">${fmtTime(day.lastAccessAt)}</td>
      </tr>
    `).join('');
  }

  function render(data) {
    const meta = data.meta || {};
    const ws = data.ws || {};
    const label = WINDOW_LABELS[meta.windowKey] || WINDOW_LABELS[selectedWindow];

    setText('metric-pageviews', num(meta.totalPageViews));
    setText('metric-unique', num(meta.uniqueVisitors));
    setText('metric-ws-current', num(ws.currentConcurrent));
    setText('metric-last-access', fmtDateTime(meta.lastAccessAt));
    setText('analytics-updated-at', fmtDateTime(meta.generatedAt));
    setText('analytics-meta', `${label} | 保存 ${num(meta.availableDayCount)}日 | WSピーク ${num(ws.peakConcurrent)}`);

    renderBars('daily-bars', (data.days || []).map(day => ({
      label: day.date,
      count: day.pageViews,
    })));
    renderBars('hourly-bars', data.hours || [], {
      formatLabel: row => `${row.hour}:00`,
    });
    renderBars('route-bars', data.routes || [], {
      formatLabel: row => labelFor(row.key, ROUTE_LABELS),
    });
    renderBars('device-bars', data.devices || [], {
      formatLabel: row => labelFor(row.key, DEVICE_LABELS),
    });
    renderBars('referrer-bars', data.referrers || [], {
      formatLabel: row => row.key,
      empty: '流入元なし',
    });
    renderDailyTable(data.days || []);
  }

  async function loadAnalytics() {
    setStatus('読み込み中');
    try {
      const headers = {};
      if (adminToken) headers['x-admin-token'] = adminToken;

      const res = await fetch(`/api/admin/analytics?window=${encodeURIComponent(selectedWindow)}`, {
        cache: 'no-store',
        headers,
      });

      if (res.status === 401) {
        setStatus('認証待ち');
        showAuth('トークンを確認してください');
        return;
      }
      if (res.status === 503) {
        const data = await res.json().catch(() => ({}));
        setStatus('未設定');
        showAuth(data.error || 'ANALYTICS_ADMIN_TOKEN が未設定です');
        return;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      render(await res.json());
      hideAuth();
      setStatus('接続中', true);
    } catch (err) {
      setStatus('取得失敗');
      setText('analytics-meta', err.message);
    }
  }

  document.querySelectorAll('[data-window]').forEach(button => {
    button.addEventListener('click', () => {
      selectedWindow = button.dataset.window || '7d';
      document.querySelectorAll('[data-window]').forEach(item => {
        item.classList.toggle('active', item === button);
      });
      loadAnalytics();
    });
  });

  const input = $('admin-token-input');
  if (input) input.value = adminToken;

  const saveButton = $('save-token-btn');
  if (saveButton) {
    saveButton.addEventListener('click', () => {
      adminToken = (input && input.value.trim()) || '';
      if (adminToken) localStorage.setItem(TOKEN_STORAGE_KEY, adminToken);
      loadAnalytics();
    });
  }

  const clearButton = $('clear-token-btn');
  if (clearButton) {
    clearButton.addEventListener('click', () => {
      adminToken = '';
      localStorage.removeItem(TOKEN_STORAGE_KEY);
      if (input) input.value = '';
      showAuth('保存済みトークンを削除しました');
      loadAnalytics();
    });
  }

  readTokenFromUrl();
  if (input) input.value = adminToken;
  loadAnalytics();
  setInterval(loadAnalytics, 60000);
});
