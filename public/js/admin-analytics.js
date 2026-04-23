document.addEventListener('DOMContentLoaded', () => {
  const Api = window.AppApi;
  const AppFmt = window.AppFormatters;
  const AppUtil = window.AppUtils;
  const WINDOW_LABELS = {
    '1d': '今日',
    '7d': '7日間',
    '30d': '30日間',
  };
  const ROUTE_LABELS = {
    '/': '板シミュレーター',
    '/volume-share': '出来高シェア',
    '/sales-spread': '販売所スプレッド',
    '/markets': '銘柄ページ一覧',
  };
  const DEVICE_LABELS = {
    desktop: 'デスクトップ',
    mobile: 'モバイル',
    bot: 'Bot',
  };

  let selectedWindow = '7d';

  const $ = AppUtil.byId;
  const num = (value) => Fmt.num(value || 0);
  const escapeHtml = AppUtil.escapeHtml;
  const setText = AppUtil.setText;
  const fmtDateTime = AppFmt.dateTime;
  const fmtTime = (value) => AppFmt.time(value, { includeSeconds: false });
  const input = $('admin-token-input');
  const saveButton = $('save-token-btn');
  const clearButton = $('clear-token-btn');

  function labelFor(key, labels) {
    return labels[key] || key || '-';
  }

  function setStatus(text, ok = false) {
    setText('analytics-status', text);
    const dot = $('analytics-status-dot');
    if (dot) dot.className = `status-dot w-3 h-3 rounded-full ${ok ? 'bg-green-500' : 'bg-red-500'}`;
    setText('analytics-status-live-label', `接続状態: ${text}`);
  }

  function setAuthControlsDisabled(disabled) {
    if (input) input.disabled = disabled;
    if (saveButton) saveButton.disabled = disabled;
    if (clearButton) clearButton.disabled = disabled;
  }

  function showAuth(message) {
    const panel = $('auth-panel');
    if (panel) panel.classList.remove('hidden');
    setText('auth-message', message || 'アクセス解析を見るには管理トークンでログインしてください');
  }

  function hideAuth() {
    const panel = $('auth-panel');
    if (panel) panel.classList.add('hidden');
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
        <td class="font-mono text-gray-200" data-label="日付">${escapeHtml(day.date)}</td>
        <td class="is-num text-right font-mono text-yellow-300" data-label="PV">${num(day.pageViews)}</td>
        <td class="is-num text-right font-mono text-green-300" data-label="ユニーク">${num(day.uniqueVisitors)}</td>
        <td class="is-num text-right font-mono text-gray-300" data-label="WS接続">${num(day.ws && day.ws.connections)}</td>
        <td class="is-num text-right font-mono text-red-300" data-label="WSピーク">${num(day.ws && day.ws.peakConcurrent)}</td>
        <td class="is-num text-right font-mono text-gray-300" data-label="最終アクセス">${fmtTime(day.lastAccessAt)}</td>
      </tr>
    `).join('');
  }

  function clearDashboard(message = 'JST基準で集計中') {
    setText('metric-pageviews', '-');
    setText('metric-unique', '-');
    setText('metric-ws-current', '-');
    setText('metric-last-access', '-');
    setText('analytics-updated-at', '-');
    setText('analytics-meta', message);
    renderBars('daily-bars', [], { empty: '認証後に表示されます' });
    renderBars('hourly-bars', [], { empty: '認証後に表示されます' });
    renderBars('route-bars', [], { empty: '認証後に表示されます' });
    renderBars('device-bars', [], { empty: '認証後に表示されます' });
    renderBars('referrer-bars', [], { empty: '認証後に表示されます' });
    renderDailyTable([]);
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
      const res = await Api.request(`/api/admin/analytics?window=${encodeURIComponent(selectedWindow)}`, {
        credentials: 'same-origin',
      });

      if (res.status === 401) {
        clearDashboard('管理セッションを確認してください');
        setStatus('認証待ち');
        showAuth('管理トークンを入力してログインしてください');
        return;
      }
      if (res.status === 503) {
        const message = await Api.readError(res) || '管理認証が未設定です';
        clearDashboard(message);
        setStatus('未設定');
        showAuth(message);
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

  async function login() {
    const token = (input && input.value.trim()) || '';
    if (!token) {
      setStatus('認証待ち');
      showAuth('管理トークンを入力してください');
      if (input) input.focus();
      return;
    }

    setStatus('認証中');
    setAuthControlsDisabled(true);
    try {
      const res = await Api.request('/api/admin/session', {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token }),
      });

      if (res.status === 400) {
        setStatus('認証待ち');
        showAuth((await Api.readError(res)) || '管理トークンを入力してください');
        return;
      }
      if (res.status === 401) {
        setStatus('認証待ち');
        showAuth('トークンを確認してください');
        return;
      }
      if (res.status === 503) {
        const message = await Api.readError(res) || '管理認証が未設定です';
        clearDashboard(message);
        setStatus('未設定');
        showAuth(message);
        return;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      if (input) input.value = '';
      await loadAnalytics();
    } catch (err) {
      setStatus('認証失敗');
      setText('analytics-meta', err.message);
      showAuth('ログインに失敗しました');
    } finally {
      setAuthControlsDisabled(false);
    }
  }

  async function logout() {
    setStatus('認証解除中');
    setAuthControlsDisabled(true);
    try {
      await Api.request('/api/admin/session', {
        method: 'DELETE',
        credentials: 'same-origin',
      });
    } catch (_err) {
      // Session cleanup is best-effort; the UI state is cleared locally either way.
    } finally {
      if (input) input.value = '';
      clearDashboard('ログアウトしました');
      setStatus('認証待ち');
      showAuth('管理セッションを削除しました');
      setAuthControlsDisabled(false);
    }
  }

  document.querySelectorAll('[data-window]').forEach(button => {
    button.addEventListener('click', () => {
      selectedWindow = button.dataset.window || '7d';
      document.querySelectorAll('[data-window]').forEach(item => {
        const isActive = item === button;
        item.classList.toggle('active', isActive);
        item.setAttribute('aria-selected', isActive ? 'true' : 'false');
      });
      loadAnalytics();
    });
  });

  if (saveButton) saveButton.addEventListener('click', login);
  if (clearButton) clearButton.addEventListener('click', logout);
  if (input) {
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        login();
      }
    });
  }

  clearDashboard();
  showAuth('アクセス解析を見るには管理トークンでログインしてください');
  loadAnalytics();
  setInterval(loadAnalytics, 60000);
});
