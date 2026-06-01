(() => {
  const THEME_STORAGE_KEY = 'okj.theme.v1';
  const TARGET_TICKERS = [
    { instrumentId: 'BTC-JPY', label: 'BTC' },
    { instrumentId: 'ETH-JPY', label: 'ETH' },
    { instrumentId: 'XRP-JPY', label: 'XRP' },
    { instrumentId: 'SOL-JPY', label: 'SOL' },
  ];

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const isFiniteNumber = (value) => Number.isFinite(Number(value));

  function readStoredTheme() {
    try {
      return localStorage.getItem(THEME_STORAGE_KEY) === 'light' ? 'light' : 'dark';
    } catch (_) {
      return document.documentElement.classList.contains('theme-light') ? 'light' : 'dark';
    }
  }

  function writeStoredTheme(theme) {
    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch (_) {
      // noop
    }
  }

  function syncTheme(theme) {
    const isLight = theme === 'light';
    document.documentElement.classList.toggle('theme-light', isLight);
    document.body.classList.toggle('theme-light', isLight);

    $$('[data-theme-toggle]').forEach((button) => {
      const icon = $('[data-theme-toggle-icon]', button);
      const label = $('[data-theme-toggle-label]', button);
      button.setAttribute('aria-pressed', isLight ? 'true' : 'false');
      button.setAttribute('aria-label', isLight ? 'ダークモードに切り替え' : 'ライトモードに切り替え');
      if (icon) icon.textContent = isLight ? '☾' : '☀';
      if (label) label.textContent = isLight ? 'ダーク' : 'ライト';
    });
  }

  function initThemeToggle() {
    let currentTheme = readStoredTheme();
    syncTheme(currentTheme);

    document.addEventListener('click', (event) => {
      const button = event.target && event.target.closest ? event.target.closest('[data-theme-toggle]') : null;
      if (!button) return;
      event.preventDefault();
      currentTheme = currentTheme === 'light' ? 'dark' : 'light';
      writeStoredTheme(currentTheme);
      syncTheme(currentTheme);
    });
  }

  function initQuickForm() {
    const form = $('[data-home-quick-form]');
    if (!form) return;
    const amountInput = $('[data-home-amount]', form);
    const marketSelect = $('[data-home-market]', form);

    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const amountManYen = Math.max(1, Math.min(9999, Number(amountInput && amountInput.value) || 10));
      const amountJpy = Math.round(amountManYen * 10000);
      const market = marketSelect && marketSelect.value ? marketSelect.value : 'BTC-JPY';
      const params = new URLSearchParams({
        market,
        side: 'buy',
        amountType: 'jpy',
        amount: String(amountJpy),
      });
      window.location.href = `/simulator?${params.toString()}`;
    });
  }

  function setActiveTab(tabName, options = {}) {
    const tabs = $$('[data-home-tab]');
    const panels = $$('[data-home-tab-panel]');
    if (!tabs.length || !panels.length) return;

    tabs.forEach((tab) => {
      const isActive = tab.dataset.homeTab === tabName;
      tab.classList.toggle('is-active', isActive);
      tab.setAttribute('aria-selected', isActive ? 'true' : 'false');
      tab.tabIndex = isActive ? 0 : -1;
      if (isActive && options.focus) tab.focus();
    });

    panels.forEach((panel) => {
      const isActive = panel.dataset.homeTabPanel === tabName;
      panel.classList.toggle('is-active', isActive);
      panel.hidden = !isActive;
    });
  }

  function initTabs() {
    const tabs = $$('[data-home-tab]');
    if (!tabs.length) return;

    tabs.forEach((tab) => {
      tab.addEventListener('click', () => setActiveTab(tab.dataset.homeTab));
      tab.addEventListener('keydown', (event) => {
        const currentIndex = tabs.indexOf(tab);
        let nextIndex = currentIndex;
        if (event.key === 'ArrowRight') nextIndex = (currentIndex + 1) % tabs.length;
        if (event.key === 'ArrowLeft') nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
        if (event.key === 'Home') nextIndex = 0;
        if (event.key === 'End') nextIndex = tabs.length - 1;
        if (nextIndex === currentIndex) return;
        event.preventDefault();
        setActiveTab(tabs[nextIndex].dataset.homeTab, { focus: true });
      });
    });

    const activeTab = tabs.find(tab => tab.classList.contains('is-active')) || tabs[0];
    setActiveTab(activeTab.dataset.homeTab);
  }

  function formatPct(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) return '-';
    return `${number.toFixed(number < 1 ? 2 : 1)}%`;
  }

  function formatUpdatedAt(value) {
    const time = Date.parse(value || '');
    if (!Number.isFinite(time)) return '更新時刻を確認中';

    const diffMs = Date.now() - time;
    if (diffMs >= 0 && diffMs < 60 * 1000) return 'たった今更新';
    if (diffMs >= 0 && diffMs < 60 * 60 * 1000) return `${Math.max(1, Math.floor(diffMs / 60000))}分前更新`;
    if (diffMs >= 0 && diffMs < 24 * 60 * 60 * 1000) return `${Math.floor(diffMs / 3600000)}時間前更新`;

    return `最終取得 ${new Intl.DateTimeFormat('ja-JP', {
      month: 'numeric',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(time))}`;
  }

  function bestTickerFor(rows, instrumentId) {
    return rows
      .filter(row => row && row.instrumentId === instrumentId)
      .filter(row => row.latest && isFiniteNumber(row.latest.spreadPct))
      .sort((left, right) => Number(left.latest.spreadPct) - Number(right.latest.spreadPct))[0] || null;
  }

  function renderTickerQuote(quote) {
    const label = $('[data-home-ticker-label]');
    const value = $('[data-home-ticker-value]');
    const meta = $('[data-home-ticker-meta]');
    if (!label || !value || !meta) return;

    label.textContent = `${quote.label}販売所スプレッド最安`;
    value.textContent = `${quote.exchangeLabel} ${formatPct(quote.spreadPct)}`;
    meta.textContent = formatUpdatedAt(quote.updatedAt);
  }

  async function initSpreadTicker() {
    if (!$('[data-home-spread-ticker]')) return;
    const label = $('[data-home-ticker-label]');
    const value = $('[data-home-ticker-value]');
    const meta = $('[data-home-ticker-meta]');

    try {
      const api = window.AppApi && window.AppApi.fetchJson
        ? window.AppApi
        : { fetchJson: url => fetch(url, { cache: 'no-store' }).then((res) => {
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          return res.json();
        }) };
      const data = await api.fetchJson('/api/sales-spread');
      const rows = Array.isArray(data && data.rows) ? data.rows : [];
      const quotes = TARGET_TICKERS
        .map((target) => {
          const row = bestTickerFor(rows, target.instrumentId);
          if (!row) return null;
          const latest = row.latest || {};
          return {
            label: target.label,
            exchangeLabel: row.exchangeLabel || latest.exchangeLabel || '取引所',
            spreadPct: latest.spreadPct,
            updatedAt: latest.priceTimestamp || latest.capturedAt || (data.meta && data.meta.latestCapturedAt),
          };
        })
        .filter(Boolean);

      if (!quotes.length) throw new Error('No ticker rows');

      let index = 0;
      renderTickerQuote(quotes[index]);
      if (quotes.length > 1) {
        window.setInterval(() => {
          index = (index + 1) % quotes.length;
          renderTickerQuote(quotes[index]);
        }, 5200);
      }
    } catch (_) {
      if (label) label.textContent = 'データ更新状況';
      if (value) value.textContent = '確認できませんでした';
      if (meta) meta.textContent = '時間をおいて再読み込みしてください';
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    initThemeToggle();
    initQuickForm();
    initTabs();
    initSpreadTicker();
  });
})();
