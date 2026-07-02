document.addEventListener('DOMContentLoaded', () => {
  const Api = window.AppApi;
  const AppFmt = window.AppFormatters;
  const AppUtil = window.AppUtils;
  const MarketData = window.MarketDataUtils;
  const config = window.MARKET_PAGE || {};
  const instrumentId = String(config.instrumentId || '').toUpperCase();
  const THEME_STORAGE_KEY = 'okj.theme.v1';
  const AMOUNT_RANGE_MIN = 10000;
  const AMOUNT_RANGE_MAX = 1000000;
  const AMOUNT_RANGE_STEP = 10000;
  const ws = new WSClient();
  const pagePoller = window.PagePoller.create();
  let summary = null;
  let selectedExchangeId = '';
  let comparisonTimer = null;
  let summaryAbortController = null;
  let comparisonAbortController = null;
  let lastComparisonData = null;
  let volumeDonutChart = null;
  let volumeDonutRows = [];
  let lastSelectedDepthData = null;
  let lastSelectedMidPrice = null;
  let orderbookViewMode = 'depth';
  const SUMMARY_REFRESH_MS = 60000;
  const CELL_FLASH_MS = 900;
  const ORDERBOOK_WAITING_MESSAGE = '取引所から板データを取得中です。接続に数秒かかる場合があります。';
  const PARTIAL_DATA_FAILURE_MESSAGE = '一部の取引所APIからデータを取得できていません。取得できた取引所のみで比較しています。';
  const LOADING_MESSAGE_PATTERN = /(取得中|読み込み中|データ待ち|集計中|待機中|接続に数秒)/;
  const MARKET_BEGINNER_TOUR_STEPS = Object.freeze([
    {
      selector: '#market-conclusion',
      title: 'まず3秒サマリー',
      body: '最安候補、販売所スプレッド、流動性の偏りだけ先に見ます。価格予想ではなく、買う場所の比較です。',
    },
    {
      selector: '[data-market-beginner-simple]',
      title: '販売所より板を先に',
      body: '販売所は操作が簡単ですが、買値と売値の差がコストになります。板で買える銘柄は、実質コストを先に比べるのが基本です。',
    },
    {
      selector: '#market-pretrade-check',
      title: '最後にチェック',
      body: '注文方式、板の厚み、入出金条件を確認してから公式サイトへ進みます。大きい注文は金額を下げて再確認すると安全です。',
    },
  ]);
  const EXCHANGE_ACCENTS = Object.freeze({
    okj: { color: '#35c8d2' },
    coincheck: { color: '#2ed47a' },
    bitflyer: { color: '#1e88ff' },
    bitbank: { color: '#f4c95d' },
    gmo: { color: '#44b9ff' },
    binance_japan: { color: '#f0b90b' },
    bittrade: { color: '#ff5f6d' },
  });
  const EXCHANGE_SLUGS = Object.freeze({
    okj: 'okj',
    coincheck: 'coincheck',
    bitflyer: 'bitflyer',
    bitbank: 'bitbank',
    gmo: 'gmo-coin',
    binance_japan: 'binance-japan',
    bittrade: 'bittrade',
  });
  const EXCHANGE_INITIALS = Object.freeze({
    okj: 'OKJ',
    coincheck: 'CC',
    bitflyer: 'BF',
    bitbank: 'BB',
    gmo: 'GMO',
    binance_japan: 'BJ',
    bittrade: 'BT',
  });
  const DEFAULT_EXCHANGE_ACCENT = Object.freeze({ color: '#8fb0ff' });
  const animatedValueCache = new Map();
  const prefersReducedMotion = window.matchMedia
    ? window.matchMedia('(prefers-reduced-motion: reduce)')
    : { matches: false };
  let copyToastTimer = null;

  const $ = AppUtil.byId;
  const setText = AppUtil.setText;
  const escapeHtml = AppUtil.escapeHtml;
  const marketPageUrl = AppUtil.marketPageUrl;
  const parseNumberInput = AppUtil.parseNumberInput;
  const fmtPct = AppFmt.pct;
  const fmtDateTime = AppFmt.dateTime;
  const fmtTime = AppFmt.time;
  const fmtJpyPrice = AppFmt.jpyPrice;
  const statusRank = MarketData.statusRank;
  const liveRowStatus = MarketData.liveRowStatus;
  const ageLabel = MarketData.ageLabel;
  const updatedAtLabel = MarketData.updatedAtLabel;
  const summarizeStatuses = MarketData.summarizeStatuses;
  const freshnessBadge = MarketData.freshnessBadge;
  const normalizeExchangeId = exchangeId => String(exchangeId || '').trim().toLowerCase();
  const storageKey = suffix => `okj.market.${instrumentId || 'default'}.${suffix}.v1`;
  const MY_EXCHANGES_STORAGE_KEY = storageKey('myExchanges');
  const MY_EXCHANGES_ONLY_STORAGE_KEY = storageKey('myExchangesOnly');
  const PRETRADE_CHECKLIST_STORAGE_KEY = storageKey('pretradeChecklist');

  function setHtml(id, html) {
    const node = $(id);
    if (node) node.innerHTML = html;
    return node;
  }

  const readStoredExchangeSet = () => {
    try {
      const parsed = JSON.parse(localStorage.getItem(MY_EXCHANGES_STORAGE_KEY) || '[]');
      return new Set((Array.isArray(parsed) ? parsed : []).map(normalizeExchangeId).filter(Boolean));
    } catch (_) {
      return new Set();
    }
  };
  const readStoredBoolean = (key) => {
    try {
      return localStorage.getItem(key) === 'true';
    } catch (_) {
      return false;
    }
  };
  const writeStoredExchangeSet = (value) => {
    try {
      localStorage.setItem(MY_EXCHANGES_STORAGE_KEY, JSON.stringify([...value]));
    } catch (_) {
      // noop
    }
  };
  const writeStoredBoolean = (key, value) => {
    try {
      localStorage.setItem(key, value ? 'true' : 'false');
    } catch (_) {
      // noop
    }
  };
  let myExchangeIds = readStoredExchangeSet();
  let showOnlyMyExchanges = readStoredBoolean(MY_EXCHANGES_ONLY_STORAGE_KEY);
  const rowFlashUntilByExchange = new Map();
  const cellFlashUntilByKey = new Map();
  const mobileExpandedDomesticRows = new Set();
  const domesticSortState = {
    key: 'cost',
    direction: 'asc',
  };
  let summaryLoadedAt = 0;
  let beginnerTourIndex = -1;
  let beginnerTourActive = false;

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

    document.querySelectorAll('[data-theme-toggle]').forEach((button) => {
      const icon = button.querySelector('[data-theme-toggle-icon]');
      const label = button.querySelector('[data-theme-toggle-label]');
      button.classList.toggle('is-light', isLight);
      button.setAttribute('aria-pressed', isLight ? 'true' : 'false');
      button.setAttribute('aria-label', isLight ? 'ダークモードに切り替え' : 'ライトモードに切り替え');
      if (icon) icon.textContent = isLight ? '☾' : '☀';
      if (label) label.textContent = isLight ? 'ダーク' : 'ライト';
    });

    applyVolumeDonutTheme();
    window.dispatchEvent(new CustomEvent('okj:theme-change', { detail: { theme } }));
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

  function switchMarketOptions() {
    const defaults = [
      { instrumentId: 'BTC-JPY', label: 'BTC/JPY' },
      { instrumentId: 'ETH-JPY', label: 'ETH/JPY' },
      { instrumentId: 'SOL-JPY', label: 'SOL/JPY' },
      { instrumentId: 'XRP-JPY', label: 'XRP/JPY' },
    ];
    const configured = Array.isArray(config.switchMarkets) && config.switchMarkets.length > 0
      ? config.switchMarkets
      : defaults;
    const options = [
      { instrumentId, label: config.label || instrumentId },
      ...configured,
    ];
    const seen = new Set();
    return options
      .map(option => ({
        instrumentId: String(option.instrumentId || '').toUpperCase(),
        label: option.label || option.instrumentId,
      }))
      .filter((option) => {
        if (!option.instrumentId || seen.has(option.instrumentId)) return false;
        seen.add(option.instrumentId);
        return true;
      });
  }

  function initPairSwitcher() {
    const select = $('market-pair-switcher');
    if (!select) return;
    const options = switchMarketOptions();
    select.innerHTML = options.map(option => `
      <option value="${escapeHtml(option.instrumentId)}">${escapeHtml(option.label || option.instrumentId)}</option>
    `).join('');
    select.value = instrumentId;
    select.addEventListener('change', () => {
      if (!select.value || select.value === instrumentId) return;
      window.location.href = marketPageUrl(select.value);
    });

    const combo = document.querySelector('[data-market-pair-combobox]');
    const input = $('market-pair-combobox-input');
    const list = $('market-pair-combobox-list');
    const current = $('market-pair-combobox-current');
    const activeOption = options.find(option => option.instrumentId === instrumentId) || options[0];
    if (current && activeOption) current.textContent = String(activeOption.instrumentId || '').split('-')[0] || 'PAIR';
    if (input && activeOption) input.value = activeOption.label || activeOption.instrumentId;

    const setComboOpen = (open) => {
      if (!combo || !input || !list) return;
      combo.classList.toggle('is-open', open);
      input.setAttribute('aria-expanded', open ? 'true' : 'false');
      list.hidden = !open;
    };
    const chooseOption = (option) => {
      if (!option) return;
      if (option.instrumentId === instrumentId) {
        if (input) input.value = option.label || option.instrumentId;
        setComboOpen(false);
        return;
      }
      window.location.href = marketPageUrl(option.instrumentId);
    };
    const renderComboOptions = (query = '') => {
      if (!list) return;
      const needle = String(query || '').trim().toUpperCase();
      const filtered = options.filter(option => {
        const haystack = `${option.instrumentId} ${option.label || ''}`.toUpperCase();
        return !needle || haystack.includes(needle.replace('/', '-')) || haystack.includes(needle);
      });
      list.innerHTML = (filtered.length > 0 ? filtered : options).slice(0, 8).map((option, index) => {
        const active = option.instrumentId === instrumentId;
        return `
          <button class="${active ? 'is-active' : ''}" type="button" role="option" data-market-pair-option="${escapeHtml(option.instrumentId)}" aria-selected="${active ? 'true' : 'false'}" ${index === 0 ? 'data-first-option="true"' : ''}>
            <span>${escapeHtml(option.label || option.instrumentId)}</span>
            <small>${escapeHtml(option.instrumentId)}</small>
          </button>
        `;
      }).join('');
    };
    if (combo && input && list) {
      renderComboOptions(input.value);
      input.addEventListener('focus', () => {
        renderComboOptions(input.value);
        setComboOpen(true);
        input.select();
      });
      input.addEventListener('input', () => {
        renderComboOptions(input.value);
        setComboOpen(true);
      });
      input.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
          setComboOpen(false);
          input.value = activeOption ? (activeOption.label || activeOption.instrumentId) : instrumentId;
          return;
        }
        if (event.key !== 'Enter') return;
        event.preventDefault();
        const first = list.querySelector('[data-first-option]');
        const selectedId = first ? first.getAttribute('data-market-pair-option') : '';
        chooseOption(options.find(option => option.instrumentId === selectedId));
      });
      list.addEventListener('click', (event) => {
        const button = event.target && event.target.closest ? event.target.closest('[data-market-pair-option]') : null;
        if (!button) return;
        event.preventDefault();
        chooseOption(options.find(option => option.instrumentId === button.dataset.marketPairOption));
      });
      document.addEventListener('click', (event) => {
        const target = event.target;
        if (target && combo.contains(target)) return;
        setComboOpen(false);
      });
    }

    const existingTabs = document.querySelector('[data-market-pair-tabs]');
    const tabHost = existingTabs || document.createElement('div');
    tabHost.className = 'market-pair-tabs';
    tabHost.dataset.marketPairTabs = 'true';
    tabHost.setAttribute('aria-label', '通貨ペア切り替え');
    tabHost.innerHTML = options.map(option => {
      const active = option.instrumentId === instrumentId;
      return `<a class="${active ? 'is-active' : ''}" href="${escapeHtml(marketPageUrl(option.instrumentId))}" ${active ? 'aria-current="page"' : ''}>${escapeHtml(option.label || option.instrumentId)}</a>`;
    }).join('');
    if (!existingTabs) select.closest('.market-pair-switcher')?.after(tabHost);
  }

  function beginnerModeEnabled() {
    return Boolean(window.BeginnerMode && window.BeginnerMode.isEnabled && window.BeginnerMode.isEnabled());
  }

  function termText(expert, beginner) {
    return beginnerModeEnabled() ? beginner : expert;
  }

  function isMyExchange(exchangeId) {
    return myExchangeIds.has(normalizeExchangeId(exchangeId));
  }

  function myExchangeOrder() {
    return [...myExchangeIds].map(normalizeExchangeId).filter(Boolean);
  }

  function myExchangeOrderIndex(exchangeId) {
    const index = myExchangeOrder().indexOf(normalizeExchangeId(exchangeId));
    return index >= 0 ? index : Number.MAX_SAFE_INTEGER;
  }

  function pinnedSupportedExchanges() {
    return supportedExchanges()
      .filter(exchange => isMyExchange(exchange.id))
      .sort((a, b) => myExchangeOrderIndex(a.id) - myExchangeOrderIndex(b.id));
  }

  function exchangeAccent(exchangeId) {
    return EXCHANGE_ACCENTS[normalizeExchangeId(exchangeId)] || DEFAULT_EXCHANGE_ACCENT;
  }

  function exchangeInitials(exchangeId, label) {
    const id = normalizeExchangeId(exchangeId);
    if (EXCHANGE_INITIALS[id]) return EXCHANGE_INITIALS[id];
    const words = String(label || exchangeId || '')
      .replace(/[^A-Za-z0-9\s]/g, ' ')
      .trim()
      .split(/\s+/)
      .filter(Boolean);
    if (words.length >= 2) return words.slice(0, 2).map(word => word[0]).join('').toUpperCase();
    return String(words[0] || id || '?').slice(0, 3).toUpperCase();
  }

  function fallbackExchangeDetailPath(exchangeId) {
    const id = normalizeExchangeId(exchangeId);
    return `/exchanges/${encodeURIComponent(EXCHANGE_SLUGS[id] || id || exchangeId || '')}`;
  }

  function findExchangeActionSource(exchangeId) {
    const id = normalizeExchangeId(exchangeId);
    const exchanges = (summary && Array.isArray(summary.exchanges)) ? summary.exchanges : [];
    const exchange = exchanges.find(item => normalizeExchangeId(item.id) === id);
    if (exchange && exchange.actions) return exchange.actions;
    const domesticRows = summary && summary.domesticComparison && Array.isArray(summary.domesticComparison.rows)
      ? summary.domesticComparison.rows
      : [];
    const domesticRow = domesticRows.find(item => normalizeExchangeId(item.exchangeId) === id);
    if (domesticRow && domesticRow.actions) return domesticRow.actions;
    const supported = supportedExchanges().find(item => normalizeExchangeId(item.id) === id);
    return (supported && supported.actions) || null;
  }

  function exchangeActionMeta(exchangeId) {
    const id = normalizeExchangeId(exchangeId);
    const actions = findExchangeActionSource(id) || {};
    const detailPath = actions.detailPath || fallbackExchangeDetailPath(id);
    const officialUrl = actions.officialUrl || '';
    const signupUrl = actions.signupUrl || officialUrl || '';
    const referralUrl = actions.referralUrl || '';
    return {
      detailPath,
      officialUrl,
      signupUrl,
      referralUrl,
      referralRel: actions.referralRel || null,
      referralReferrerPolicy: actions.referralReferrerPolicy || null,
      referralTarget: Object.prototype.hasOwnProperty.call(actions, 'referralTarget') ? actions.referralTarget : undefined,
      referralTrackingPixelUrl: actions.referralTrackingPixelUrl || null,
      hasReferral: Boolean(referralUrl),
      primaryHref: referralUrl || signupUrl || officialUrl || detailPath,
    };
  }

  function isExternalHref(href) {
    return /^https?:\/\//i.test(String(href || ''));
  }

  function actionLinkAttrs(href, options = {}) {
    const safeHref = escapeHtml(href || '#');
    if (!isExternalHref(href)) return `href="${safeHref}"`;
    const attrs = [`href="${safeHref}"`];
    const target = Object.prototype.hasOwnProperty.call(options, 'referralTarget') && options.referralTarget !== undefined
      ? options.referralTarget
      : '_blank';
    if (target) attrs.push(`target="${escapeHtml(target)}"`);
    attrs.push(`rel="${escapeHtml(options.referralRel || (options.hasReferral ? 'sponsored noopener' : 'noopener noreferrer'))}"`);
    if (options.referralReferrerPolicy) attrs.push(`referrerpolicy="${escapeHtml(options.referralReferrerPolicy)}"`);
    return attrs.join(' ');
  }

  function actionTrackingPixelHtml(actions) {
    if (!actions || !actions.hasReferral || !actions.referralTrackingPixelUrl) return '';
    return `<img src="${escapeHtml(actions.referralTrackingPixelUrl)}" width="1" height="1" border="0" alt="">`;
  }

  function exchangeNameLinkHtml(exchangeId, label, className = 'market-exchange-name-link') {
    const actions = exchangeActionMeta(exchangeId);
    const href = actions.hasReferral ? actions.primaryHref : actions.detailPath;
    const attrs = actions.hasReferral ? actionLinkAttrs(href, actions) : actionLinkAttrs(href);
    return `<a class="${escapeHtml(className)}" ${attrs}>${escapeHtml(label || exchangeId || '取引所')}${actionTrackingPixelHtml(actions)}</a>`;
  }

  function exchangeActionHtml(exchangeId, label, options = {}) {
    const actions = exchangeActionMeta(exchangeId);
    const safeLabel = label || exchangeId || '取引所';
    const isExternal = isExternalHref(actions.primaryHref);
    const isRecommended = Boolean(options.primary);
    const primaryLabel = isExternal
      ? (isRecommended ? '口座開設・ログイン' : '公式サイト')
      : `${safeLabel}の詳細`;
    const primaryContent = isExternal
      ? `<span class="market-row-action__main">${escapeHtml(primaryLabel)}</span><span class="market-row-action__meta">${escapeHtml(isRecommended ? `${safeLabel}公式サイト` : '条件を確認')}</span>`
      : escapeHtml(primaryLabel);
    const primaryClass = isRecommended ? 'market-row-action--primary market-row-action--recommended' : 'market-row-action--ghost';
    return `
      <div class="market-row-actions">
        <a class="market-row-action market-row-action--secondary" ${actionLinkAttrs(actions.detailPath)}>詳細</a>
        <a class="market-row-action ${primaryClass} ${isExternal ? 'market-row-action--external' : ''}" ${actionLinkAttrs(actions.primaryHref, actions)}>${primaryContent}${actionTrackingPixelHtml(actions)}</a>
      </div>
    `;
  }

  function exchangeInlineCtaHtml(exchangeId, label, options = {}) {
    const actions = exchangeActionMeta(exchangeId);
    const href = actions.primaryHref || actions.detailPath || '#market-exchange-comparison';
    const safeLabel = label || exchangeId || '取引所';
    const isExternal = isExternalHref(href);
    const text = options.text || (isExternal ? '購入へ進む' : '詳細を見る');
    const meta = options.meta || (isExternal ? `${safeLabel}公式` : `${safeLabel}の詳細`);
    return `
      <a class="market-inline-cta ${options.primary ? 'market-inline-cta--primary' : ''} ${isExternal ? 'market-inline-cta--external' : ''}" ${actionLinkAttrs(href, actions)} aria-label="${escapeHtml(`${safeLabel} ${text}`)}">
        <span>${escapeHtml(text)}</span>
        <small>${escapeHtml(meta)}</small>
        ${actionTrackingPixelHtml(actions)}
      </a>
    `;
  }

  function shouldShowExchange(exchangeId) {
    return !showOnlyMyExchanges || myExchangeIds.size === 0 || isMyExchange(exchangeId);
  }

  function orderRowsForMyExchanges(rows) {
    return (rows || [])
      .filter(row => shouldShowExchange(row.exchangeId))
      .map((row, index) => ({ row, index }))
      .sort((a, b) => {
        const aMine = isMyExchange(a.row.exchangeId);
        const bMine = isMyExchange(b.row.exchangeId);
        if (aMine && bMine) {
          return myExchangeOrderIndex(a.row.exchangeId) - myExchangeOrderIndex(b.row.exchangeId) || a.index - b.index;
        }
        return Number(bMine) - Number(aMine) || a.index - b.index;
      })
      .map(item => item.row);
  }

  function domesticSortDefaultDirection(key) {
    return key === 'depth' ? 'desc' : 'asc';
  }

  function domesticSortValue(row, key) {
    if (!row) return null;
    if (key === 'depth') return visibleDepthFromOrderbook(row.orderbook);
    if (key === 'spread') {
      const sales = row.salesSpread || {};
      return sales.status === 'ready' ? finiteNumber(sales.spreadPct) : null;
    }
    if (key === 'exchange') return String(row.exchangeLabel || row.exchangeId || '');
    const cost = row.cost100k || {};
    if (cost.status !== 'fresh') return null;
    return finiteNumber(cost.effectiveVWAP);
  }

  function compareDomesticSortItems(a, b) {
    const pinnedDiff = Number(isMyExchange(b.row.exchangeId)) - Number(isMyExchange(a.row.exchangeId));
    if (pinnedDiff !== 0) return pinnedDiff;
    const key = domesticSortState.key || 'cost';
    const direction = domesticSortState.direction === 'desc' ? 'desc' : 'asc';
    const aValue = domesticSortValue(a.row, key);
    const bValue = domesticSortValue(b.row, key);
    const aMissing = aValue == null || (typeof aValue === 'number' && !Number.isFinite(aValue));
    const bMissing = bValue == null || (typeof bValue === 'number' && !Number.isFinite(bValue));
    if (aMissing && bMissing) return a.index - b.index;
    if (aMissing) return 1;
    if (bMissing) return -1;
    const raw = typeof aValue === 'string' || typeof bValue === 'string'
      ? String(aValue).localeCompare(String(bValue), 'ja')
      : Number(aValue) - Number(bValue);
    if (raw !== 0) return direction === 'desc' ? -raw : raw;
    return a.index - b.index;
  }

  function sortDomesticRows(rows) {
    return (rows || [])
      .map((row, index) => ({ row, index }))
      .sort(compareDomesticSortItems)
      .map(item => item.row);
  }

  function syncDomesticSortControls() {
    document.querySelectorAll('[data-market-domestic-sort]').forEach((button) => {
      const active = button.dataset.marketDomesticSort === domesticSortState.key;
      const direction = active ? domesticSortState.direction : domesticSortDefaultDirection(button.dataset.marketDomesticSort);
      const th = button.closest('th');
      button.classList.toggle('is-active', active);
      button.dataset.sortDirection = direction;
      button.setAttribute('aria-pressed', active ? 'true' : 'false');
      if (th) {
        th.setAttribute('aria-sort', active ? (direction === 'desc' ? 'descending' : 'ascending') : 'none');
      }
    });
  }

  function liveFlashClass(exchangeId) {
    const id = normalizeExchangeId(exchangeId);
    const until = rowFlashUntilByExchange.get(id);
    if (!until) return '';
    if (Date.now() > until) {
      rowFlashUntilByExchange.delete(id);
      return '';
    }
    return 'data-table__row--live-flash';
  }

  function markExchangeUpdated(exchangeId) {
    const id = normalizeExchangeId(exchangeId);
    if (id) rowFlashUntilByExchange.set(id, Date.now() + 900);
  }

  function cellFlashKey(exchangeId, field) {
    return `${normalizeExchangeId(exchangeId)}:${field}`;
  }

  function cellFlashClass(exchangeId, field) {
    const key = cellFlashKey(exchangeId, field);
    const state = cellFlashUntilByKey.get(key);
    if (!state) return '';
    if (Date.now() > state.until) {
      cellFlashUntilByKey.delete(key);
      return '';
    }
    return `market-cell-flash market-cell-flash--${state.direction}`;
  }

  function markCellChanged(exchangeId, field, previousValue, nextValue, options = {}) {
    const id = normalizeExchangeId(exchangeId);
    const previous = finiteNumber(previousValue);
    const next = finiteNumber(nextValue);
    if (!id || previous == null || next == null || Math.abs(previous - next) <= 1e-9) return;
    const rose = next > previous;
    const direction = options.inverse ? (rose ? 'down' : 'up') : (rose ? 'up' : 'down');
    cellFlashUntilByKey.set(cellFlashKey(id, field), {
      direction,
      until: Date.now() + CELL_FLASH_MS,
    });
  }

  function visibleDepthFromOrderbook(orderbook) {
    if (!orderbook) return null;
    const explicit = finiteNumber(orderbook.visibleDepthJPY);
    if (explicit != null) return explicit;
    const bid = finiteNumber(orderbook.totalBidDepthJPY) || 0;
    const ask = finiteNumber(orderbook.totalAskDepthJPY) || 0;
    return bid + ask;
  }

  function markOrderbookCellChanges(exchangeId, previousOrderbook, nextOrderbook) {
    if (!previousOrderbook || !nextOrderbook) return;
    markCellChanged(exchangeId, 'bestBid', previousOrderbook.bestBid, nextOrderbook.bestBid);
    markCellChanged(exchangeId, 'bestAsk', previousOrderbook.bestAsk, nextOrderbook.bestAsk);
    markCellChanged(exchangeId, 'spreadPct', previousOrderbook.spreadPct, nextOrderbook.spreadPct, { inverse: true });
    markCellChanged(exchangeId, 'visibleDepthJPY', visibleDepthFromOrderbook(previousOrderbook), visibleDepthFromOrderbook(nextOrderbook));
  }

  function exchangeIdentityHtml(exchangeId, label, subtext = '') {
    const id = normalizeExchangeId(exchangeId);
    const accent = exchangeAccent(id);
    const isPinned = isMyExchange(id);
    const safeColor = escapeHtml(accent.color);
    const safeLabel = escapeHtml(label || exchangeId || '-');
    const nameLink = exchangeNameLinkHtml(id, label || exchangeId || '-', 'exchange-identity__name market-exchange-name-link');
    return `
      <div class="exchange-identity" style="--exchange-accent:${safeColor}">
        <span class="exchange-identity__logo" aria-hidden="true">${escapeHtml(exchangeInitials(id, label))}</span>
        <span class="exchange-identity__copy">
          ${nameLink}
          ${subtext ? `<span class="exchange-identity__meta">${escapeHtml(subtext)}</span>` : ''}
        </span>
        <button class="exchange-identity__pin ${isPinned ? 'is-active' : ''}" type="button" data-market-star-exchange="${escapeHtml(id)}" aria-pressed="${isPinned ? 'true' : 'false'}" aria-label="${safeLabel}${isPinned ? 'の固定を解除' : 'を上に固定'}" title="${safeLabel}${isPinned ? 'の固定を解除' : 'を上に固定'}"><span class="exchange-identity__pin-icon" aria-hidden="true"></span></button>
      </div>
    `;
  }

  function setExchangeMark(nodeId, exchangeId, label) {
    const node = $(nodeId);
    if (!node) return;
    const id = normalizeExchangeId(exchangeId);
    if (!id) {
      node.textContent = '--';
      node.classList.add('is-waiting');
      node.style.removeProperty('--exchange-accent');
      return;
    }
    node.textContent = exchangeInitials(id, label);
    node.classList.remove('is-waiting');
    node.style.setProperty('--exchange-accent', exchangeAccent(id).color);
  }

  function winnerBadge(label, tone = 'gold') {
    return `<span class="market-winner-badge market-winner-badge--${escapeHtml(tone)}">${escapeHtml(label)}</span>`;
  }

  function finiteNumber(value) {
    const num = Number(value);
    return Number.isFinite(num) ? num : null;
  }

  function finiteRank(value) {
    if (value == null) return null;
    const rank = finiteNumber(value);
    return rank != null && rank > 0 ? rank : null;
  }

  function formatAnimatedValue(format, value, suffix = '') {
    const numeric = finiteNumber(value);
    if (numeric == null) return '-';
    if (format === 'jpy') return fmtJpyPrice(numeric);
    if (format === 'pct') return fmtPct(numeric);
    if (format === 'base') {
      const unit = String(suffix || '').trim();
      return `${Fmt.baseCompact(numeric)}${unit ? ` ${unit}` : ''}`;
    }
    return Fmt.num(numeric);
  }

  function animatedNumberHtml(key, value, format, suffix = '') {
    const numeric = finiteNumber(value);
    const text = numeric == null ? '-' : formatAnimatedValue(format, numeric, suffix);
    if (numeric == null) return escapeHtml(text);
    return `<span class="market-animated-number" data-animate-key="${escapeHtml(key)}" data-animate-value="${escapeHtml(String(numeric))}" data-animate-format="${escapeHtml(format)}" data-animate-suffix="${escapeHtml(suffix)}">${escapeHtml(text)}</span>`;
  }

  function copyButtonHtml(value, label) {
    const text = String(value == null ? '' : value).trim();
    if (!text || text === '-') return '';
    return `
      <button class="market-copy-button" type="button" data-market-copy-value="${escapeHtml(text)}" data-market-copy-label="${escapeHtml(label || '値')}" aria-label="${escapeHtml(label || '値')}をコピー">
        <span class="market-copy-button__icon" aria-hidden="true"></span>
      </button>
    `;
  }

  function copyableMetricHtml(key, value, format, suffix, label, options = {}) {
    const numeric = finiteNumber(value);
    const text = numeric == null ? '-' : formatAnimatedValue(format, numeric, suffix);
    return `
      <span class="market-copyable">
        ${animatedNumberHtml(key, value, format, suffix)}
        ${copyButtonHtml(options.copyText || text, label)}
      </span>
    `;
  }

  function animateNumberSpans(root) {
    if (!root) return;
    root.querySelectorAll('[data-animate-key]').forEach((node) => {
      const key = node.dataset.animateKey;
      const target = finiteNumber(node.dataset.animateValue);
      if (!key || target == null) return;
      const previous = animatedValueCache.get(key);
      const format = node.dataset.animateFormat || 'number';
      const suffix = node.dataset.animateSuffix || '';
      if (previous == null || prefersReducedMotion.matches || Math.abs(previous - target) <= 1e-10) {
        node.textContent = formatAnimatedValue(format, target, suffix);
        animatedValueCache.set(key, target);
        return;
      }
      const start = Number(previous);
      const delta = target - start;
      const startedAt = performance.now();
      const duration = 420;
      node.classList.add('is-counting');
      const tick = (now) => {
        const progress = Math.min(1, (now - startedAt) / duration);
        const eased = 1 - Math.pow(1 - progress, 3);
        node.textContent = formatAnimatedValue(format, start + (delta * eased), suffix);
        if (progress < 1) {
          window.requestAnimationFrame(tick);
          return;
        }
        node.textContent = formatAnimatedValue(format, target, suffix);
        node.classList.remove('is-counting');
        animatedValueCache.set(key, target);
      };
      window.requestAnimationFrame(tick);
    });
  }

  function showCopyToast(label, options = {}) {
    let toast = document.querySelector('[data-market-copy-toast]');
    if (!toast) {
      toast = document.createElement('div');
      toast.className = 'market-copy-toast';
      toast.dataset.marketCopyToast = 'true';
      toast.setAttribute('role', 'status');
      toast.setAttribute('aria-live', 'polite');
      document.body.appendChild(toast);
    }
    toast.textContent = options.error ? 'コピーできませんでした' : `${label || '値'}をコピーしました`;
    toast.hidden = false;
    toast.classList.remove('is-visible');
    void toast.offsetWidth;
    toast.classList.add('is-visible');
    if (copyToastTimer) window.clearTimeout(copyToastTimer);
    copyToastTimer = window.setTimeout(() => {
      toast.classList.remove('is-visible');
      copyToastTimer = window.setTimeout(() => {
        toast.hidden = true;
      }, 180);
    }, 1300);
  }

  async function copyMarketValue(value, label) {
    const text = String(value == null ? '' : value).trim();
    if (!text) return;
    let copied = false;
    if (navigator.clipboard && window.isSecureContext) {
      try {
        await navigator.clipboard.writeText(text);
        copied = true;
      } catch (_) {
        copied = false;
      }
    }
    if (!copied) {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.setAttribute('readonly', '');
      textarea.style.position = 'fixed';
      textarea.style.top = '-1000px';
      document.body.appendChild(textarea);
      textarea.select();
      copied = document.execCommand('copy');
      textarea.remove();
    }
    if (!copied) throw new Error('copy failed');
    showCopyToast(label);
  }

  function bestIds(rows, valueSelector, direction = 'min') {
    const values = (rows || [])
      .map(row => ({ row, value: finiteNumber(valueSelector(row)) }))
      .filter(item => item.value != null);
    if (values.length === 0) return new Set();
    const target = direction === 'max'
      ? Math.max(...values.map(item => item.value))
      : Math.min(...values.map(item => item.value));
    return new Set(values
      .filter(item => item.value === target)
      .map(item => normalizeExchangeId(item.row.exchangeId)));
  }

  function heatCellClass(value, min, max, direction = 'min') {
    const numeric = finiteNumber(value);
    const low = finiteNumber(min);
    const high = finiteNumber(max);
    if (numeric == null || low == null || high == null || high < low) return '';
    if (Math.abs(high - low) <= 1e-9) return 'market-heat-cell market-heat-cell--best';
    const normalized = Math.max(0, Math.min(1, (numeric - low) / (high - low)));
    const riskScore = direction === 'max' ? 1 - normalized : normalized;
    if (riskScore <= 0.24) return 'market-heat-cell market-heat-cell--best';
    if (riskScore <= 0.52) return 'market-heat-cell market-heat-cell--good';
    if (riskScore <= 0.76) return 'market-heat-cell market-heat-cell--watch';
    return 'market-heat-cell market-heat-cell--risk';
  }

  function isRiskExecution(result) {
    if (!result) return false;
    const impact = Math.abs(Number(result.marketImpactPct));
    return result.executionStatus === 'auto_cancel'
      || result.executionStatus === 'circuit_breaker'
      || (Number.isFinite(impact) && impact >= 5);
  }

  function receiveComparisonBarHtml(value, min, max, baseCurrency, options = {}) {
    const numeric = finiteNumber(value);
    const low = finiteNumber(min);
    const high = finiteNumber(max);
    if (numeric == null || low == null || high == null || high <= 0) return '';
    const normalized = Math.abs(high - low) <= 1e-12 ? 1 : (numeric - low) / (high - low);
    const width = Math.max(18, Math.min(100, Math.round(54 + (normalized * 46))));
    const delta = Math.max(0, high - numeric);
    const deltaLabel = delta > 0
      ? `${Fmt.baseCompact(delta)} ${baseCurrency}差`
      : (options.best ? '受取量 最大' : 'ほぼ同水準');
    const yenDelta = finiteNumber(options.yenDelta);
    return `
      <div class="market-receive-bar ${options.best ? 'market-receive-bar--best' : ''}" style="--receive-width:${width}%">
        <span class="market-receive-bar__track" aria-hidden="true"><span></span></span>
        <span class="market-receive-bar__label">${escapeHtml(deltaLabel)}</span>
        ${yenDelta != null && yenDelta > 0 ? `<span class="market-receive-bar__yen">最良より約${Fmt.jpy(yenDelta)}分少ない</span>` : ''}
      </div>
    `;
  }

  function effectiveCostBreakdownHtml(result, options = {}) {
    if (!result) return '';
    const fees = finiteNumber(result.feesJPY);
    const slippagePerBase = finiteNumber(result.slippageFromBestJPY);
    const filledBase = finiteNumber(result.totalBTCFilled || result.totalBaseFilled);
    const slippageCost = slippagePerBase != null && filledBase != null
      ? Math.abs(slippagePerBase * filledBase)
      : null;
    const total = (fees != null ? Math.abs(fees) : 0) + (slippageCost != null ? slippageCost : 0);
    if (!(total > 0) && fees == null && slippageCost == null) return '';
    const parts = [];
    if (fees != null) parts.push(`手数料 ${Fmt.jpy(Math.abs(fees))}`);
    if (slippageCost != null) parts.push(`価格差 ${Fmt.jpy(slippageCost)}`);
    const feeCost = fees != null ? Math.abs(fees) : 0;
    const priceCost = slippageCost != null ? Math.abs(slippageCost) : 0;
    const feeShare = total > 0 ? Math.round((feeCost / total) * 100) : 0;
    const priceShare = Math.max(0, 100 - feeShare);
    const className = [
      'market-yen-cost-note',
      options.compact ? 'market-yen-cost-note--compact' : '',
    ].filter(Boolean).join(' ');
    return `
      <div class="${className}" style="--fee-share:${feeShare}%; --price-share:${priceShare}%">
        <span>実質コスト 約${Fmt.jpy(total)}</span>
        <span class="market-yen-cost-note__bar" aria-hidden="true"><i></i><b></b></span>
        ${parts.length > 0 ? `<small>${escapeHtml(parts.join(' / '))}</small>` : ''}
      </div>
    `;
  }

  function costMetricDetailsHtml(result, options = {}) {
    if (!result) return '';
    const rows = [];
    const keyPrefix = options.keyPrefix || 'cost';
    if (options.includeVwap !== false && finiteNumber(result.effectiveVWAP) != null) {
      rows.push(`
        <div>
          <span>${escapeHtml(termText('VWAP', '実質購入価格'))}</span>
          <strong>${copyableMetricHtml(`${keyPrefix}:vwap`, result.effectiveVWAP, 'jpy', '', termText('VWAP', '実質購入価格'))}</strong>
        </div>
      `);
    }
    if (options.includeImpact !== false && finiteNumber(result.marketImpactPct) != null) {
      rows.push(`
        <div>
          <span>${escapeHtml(termText('Impact', '影響度'))}</span>
          <strong>${animatedNumberHtml(`${keyPrefix}:impact`, result.marketImpactPct, 'pct')}</strong>
        </div>
      `);
    }
    const breakdown = options.includeBreakdown === false ? '' : effectiveCostBreakdownHtml(result);
    if (rows.length === 0 && !breakdown) return '';
    return `
      <details class="market-metric-details">
        <summary>${escapeHtml(options.summaryLabel || '内訳')}</summary>
        <div class="market-metric-details__body">
          ${rows.join('')}
          ${breakdown ? `<div class="market-metric-details__breakdown">${breakdown}</div>` : ''}
        </div>
      </details>
    `;
  }

  function spreadTone(value, min, max) {
    const spread = finiteNumber(value);
    if (spread == null) return 'neutral';
    if (spread <= 2) return 'low';
    if (spread <= 5) return 'medium';
    return 'high';
  }

  function spreadCostHtml(value, options = {}) {
    const spread = finiteNumber(value);
    const tone = spreadTone(spread, options.min, options.max);
    const label = tone === 'low' ? '安全' : (tone === 'high' ? '警戒' : '注意');
    const best = options.best ? winnerBadge('最狭', 'green') : '';
    const score = spread == null
      ? 0
      : Math.max(0, Math.min(100, (spread / 8) * 100));
    return `
      <div class="spread-cost-cell spread-cost-cell--${tone}" style="--spread-score:${score}%">
        <span class="spread-cost-cell__rate">${tone === 'high' ? '<span class="spread-cost-cell__risk-dot" aria-hidden="true"></span>' : ''}${options.copyKey ? copyableMetricHtml(options.copyKey, spread, 'pct', '', '販売所スプレッド') : (spread == null ? '-' : fmtPct(spread))}</span>
        <span class="spread-cost-cell__meter" aria-hidden="true"><span></span></span>
        <span class="spread-cost-cell__label">${label}</span>
        ${best}
      </div>
    `;
  }

  function depthPct(value, maxValue) {
    const depth = finiteNumber(value);
    const max = finiteNumber(maxValue);
    if (depth == null || max == null || max <= 0) return '0%';
    return `${Math.max(6, Math.min(100, Math.round((depth / max) * 100)))}%`;
  }

  function depthPriceHtml(exchangeId, field, price, side, depth, maxDepth, label) {
    const termKey = side === 'ask' ? 'ask' : 'bid';
    const readableLabel = termKey === 'ask'
      ? termText(label, '売り手最安値')
      : termText(label, '買い手最高値');
    return `
      <div class="market-depth-value market-depth-value--${escapeHtml(side)} ${cellFlashClass(exchangeId, field)}" style="--depth-pct:${depthPct(depth, maxDepth)}" title="${escapeHtml(`${label} depth ${Fmt.jpyLarge(depth)}`)}">
        <span class="market-depth-value__label market-term" data-term-key="${termKey}" tabindex="0">${escapeHtml(readableLabel)}</span>
        <span>${fmtJpyPrice(price)}</span>
      </div>
    `;
  }

  function depthMiniChartHtml(orderbook) {
    const bid = finiteNumber(orderbook && orderbook.totalBidDepthJPY);
    const ask = finiteNumber(orderbook && orderbook.totalAskDepthJPY);
    const total = (bid || 0) + (ask || 0);
    if (!bid && !ask) return '';
    const bidPct = total > 0 ? Math.max(3, Math.round((bid / total) * 100)) : 0;
    const askPct = total > 0 ? Math.max(3, Math.round((ask / total) * 100)) : 0;
    return `
      <div class="market-depth-mini" aria-label="板厚比率 Bid ${Fmt.jpyLarge(bid)} Ask ${Fmt.jpyLarge(ask)}">
        <span class="market-depth-mini__side market-depth-mini__side--bid" style="--depth-width:${bidPct}%"></span>
        <span class="market-depth-mini__axis" aria-hidden="true"></span>
        <span class="market-depth-mini__side market-depth-mini__side--ask" style="--depth-width:${askPct}%"></span>
      </div>
    `;
  }

  function shareBarHtml(value, exchangeId) {
    const pct = Math.max(0, Math.min(100, finiteNumber(value) || 0));
    const accent = exchangeId ? exchangeAccent(exchangeId).color : DEFAULT_EXCHANGE_ACCENT.color;
    return `
      <div class="market-share-cell" style="--share-width:${pct}%; --share-accent:${escapeHtml(accent)}">
        <span class="market-share-cell__value">${fmtPct(value)}</span>
        <span class="market-share-cell__track" aria-hidden="true"><span></span></span>
      </div>
    `;
  }

  function isLoadingMessage(message) {
    return LOADING_MESSAGE_PATTERN.test(String(message || ''));
  }

  function skeletonStackHtml(label = 'データを取得中') {
    return `
      <div class="market-skeleton-stack" aria-label="${escapeHtml(label)}">
        <span></span>
        <span></span>
        <span></span>
      </div>
    `;
  }

  function waitingCellHtml(label = 'データを取得中') {
    return `
      <div class="market-skeleton-cell" aria-label="${escapeHtml(label)}">
        <span></span>
        <span></span>
      </div>
    `;
  }

  function freshnessBadgeHtml(status, row = null) {
    if (status !== 'stale') return freshnessBadge(status);
    const age = row ? ageLabel(row) : '古い';
    return `
      <button class="market-stale-refresh" type="button" data-market-refresh aria-label="データを再読み込み">
        <span aria-hidden="true">!</span>
        <span>${escapeHtml(age)}のデータ</span>
        <small>タップで再読み込み</small>
      </button>
    `;
  }

  function chartCssVar(name, fallback) {
    return AppUtil.cssVar ? AppUtil.cssVar(name, fallback) : fallback;
  }

  function applyVolumeDonutTheme() {
    if (!volumeDonutChart) return;
    const textColor = chartCssVar('--text-2', '#c9d3cd');
    const mutedColor = chartCssVar('--text-4', '#6f7b76');
    const surfaceColor = document.documentElement.classList.contains('theme-light')
      ? 'rgba(255, 255, 255, 0.96)'
      : 'rgba(8, 11, 12, 0.94)';
    volumeDonutChart.options.plugins.tooltip.backgroundColor = surfaceColor;
    volumeDonutChart.options.plugins.tooltip.titleColor = textColor;
    volumeDonutChart.options.plugins.tooltip.bodyColor = mutedColor;
    volumeDonutChart.update('none');
  }

  function initVolumeDonutChart() {
    const canvas = $('market-volume-donut-chart');
    if (!canvas || volumeDonutChart || typeof Chart === 'undefined') return;
    volumeDonutChart = new Chart(canvas, {
      type: 'doughnut',
      data: {
        labels: [],
        datasets: [{
          data: [],
          backgroundColor: [],
          borderColor: document.documentElement.classList.contains('theme-light') ? '#ffffff' : '#0d1214',
          borderWidth: 2,
          hoverOffset: 8,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '66%',
        animation: { duration: 420, easing: 'easeOutQuart' },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: 'rgba(8, 11, 12, 0.94)',
            borderColor: 'rgba(200, 220, 210, 0.18)',
            borderWidth: 1,
            displayColors: true,
            callbacks: {
              label: (ctx) => {
                const row = volumeDonutRows[ctx.dataIndex] || {};
                return `${row.exchangeLabel || ctx.label}: ${Fmt.jpyLarge(row.quoteVolume)} / ${fmtPct(row.instrumentSharePct)}`;
              },
            },
          },
        },
      },
    });
    applyVolumeDonutTheme();
  }

  function renderVolumeDonutLegend(rows) {
    const host = $('market-volume-donut-legend');
    const center = $('market-volume-donut-center');
    if (!host) return;
    if (!rows.length) {
      host.textContent = '出来高データを取得中';
      if (center) center.textContent = 'Share';
      return;
    }
    if (center) center.textContent = fmtPct(rows[0].instrumentSharePct);
    host.innerHTML = rows.slice(0, 5).map((row, index) => {
      const accent = exchangeAccent(row.exchangeId);
      return `
        <div class="market-volume-legend-row" data-exchange-id="${escapeHtml(normalizeExchangeId(row.exchangeId))}" style="--exchange-accent:${escapeHtml(accent.color)}">
          <span class="market-volume-legend-row__rank">${index + 1}</span>
          <span class="market-volume-legend-row__name">${exchangeNameLinkHtml(row.exchangeId, row.exchangeLabel || row.exchangeId, 'market-volume-legend-row__name-link')}</span>
          <span class="market-volume-legend-row__value">${fmtPct(row.instrumentSharePct)}</span>
        </div>
      `;
    }).join('');
  }

  function updateVolumeDonutChart(rows) {
    const usableRows = (rows || [])
      .filter(row => Number.isFinite(Number(row.quoteVolume)) && Number(row.quoteVolume) > 0)
      .sort((a, b) => Number(b.quoteVolume || 0) - Number(a.quoteVolume || 0))
      .slice(0, 8);
    volumeDonutRows = usableRows;
    renderVolumeDonutLegend(usableRows);
    initVolumeDonutChart();
    if (!volumeDonutChart) {
      updateVolumeCssDonut(usableRows);
      return;
    }
    updateVolumeCssDonut([]);
    const dataset = volumeDonutChart.data.datasets[0];
    volumeDonutChart.data.labels = usableRows.map(row => row.exchangeLabel || row.exchangeId || '-');
    dataset.data = usableRows.map(row => Number(row.quoteVolume));
    dataset.backgroundColor = usableRows.map(row => exchangeAccent(row.exchangeId).color);
    dataset.borderColor = document.documentElement.classList.contains('theme-light') ? '#ffffff' : '#0d1214';
    volumeDonutChart.update('none');
  }

  function updateVolumeCssDonut(rows) {
    const donut = $('market-volume-css-donut');
    const label = $('market-volume-css-donut-label');
    const canvas = $('market-volume-donut-chart');
    if (!donut) return;
    const hasRows = Array.isArray(rows) && rows.length > 0;
    donut.hidden = !hasRows;
    if (canvas) canvas.hidden = hasRows;
    if (!hasRows) return;

    const total = rows.reduce((sum, row) => sum + Number(row.quoteVolume || 0), 0);
    let cursor = 0;
    const stops = rows.map((row) => {
      const share = total > 0 ? (Number(row.quoteVolume || 0) / total) * 100 : 0;
      const start = cursor;
      cursor += share;
      return `${exchangeAccent(row.exchangeId).color} ${start.toFixed(2)}% ${cursor.toFixed(2)}%`;
    });
    donut.style.background = `conic-gradient(${stops.join(', ')})`;
    donut.title = rows
      .map(row => `${row.exchangeLabel || row.exchangeId}: ${Fmt.jpyLarge(row.quoteVolume)} / ${fmtPct(row.instrumentSharePct)}`)
      .join('\n');
    if (label) {
      const top = rows[0];
      label.textContent = top ? `${fmtPct(top.instrumentSharePct)}` : 'Share';
    }
  }

  function activeQuickAmount() {
    const amountType = $('market-amount-type')?.value === 'base' ? 'base' : 'jpy';
    if (amountType !== 'jpy') return null;
    return parseNumberInput($('market-amount')?.value);
  }

  function clampRangeAmount(value) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return AMOUNT_RANGE_MIN;
    const stepped = Math.round(parsed / AMOUNT_RANGE_STEP) * AMOUNT_RANGE_STEP;
    return Math.max(AMOUNT_RANGE_MIN, Math.min(AMOUNT_RANGE_MAX, stepped));
  }

  function amountRangeLabel(value) {
    const amount = Number(value);
    if (!Number.isFinite(amount)) return '-';
    if (amount >= 10000) return `${Fmt.num(amount / 10000, amount % 10000 === 0 ? 0 : 1)}万円`;
    return Fmt.jpy(amount);
  }

  function syncAmountRange() {
    const slider = $('market-amount-range');
    const label = $('market-amount-range-label');
    const bubble = $('market-amount-range-bubble');
    const shell = $('market-amount-slider');
    if (!slider) return;
    const amountType = $('market-amount-type')?.value === 'base' ? 'base' : 'jpy';
    const isJpy = amountType === 'jpy';
    const active = activeQuickAmount();
    const value = clampRangeAmount(active == null ? Number(slider.value) : active);
    slider.disabled = !isJpy;
    slider.value = String(value);
    const pct = ((value - AMOUNT_RANGE_MIN) / (AMOUNT_RANGE_MAX - AMOUNT_RANGE_MIN)) * 100;
    const clampedPct = `${Math.max(0, Math.min(100, pct))}%`;
    slider.style.setProperty('--range-pct', clampedPct);
    if (shell) {
      shell.style.setProperty('--range-pct', clampedPct);
      shell.classList.toggle('is-disabled', !isJpy);
    }
    const text = isJpy ? amountRangeLabel(value) : '数量入力中';
    [label, bubble].forEach((node) => {
      if (!node) return;
      if (node.textContent !== text) {
        node.textContent = text;
        node.classList.remove('market-number-tick');
        void node.offsetWidth;
        node.classList.add('market-number-tick');
      }
    });
    renderStickySimulator();
  }

  function syncQuickAmountButtons() {
    const active = activeQuickAmount();
    document.querySelectorAll('[data-market-quick-amount]').forEach((button) => {
      const value = Number(button.dataset.marketQuickAmount);
      button.classList.toggle('is-active', active != null && value === active);
    });
    syncAmountRange();
    syncAmountTypeToggle();
  }

  function setQuickAmount(value) {
    const amountType = $('market-amount-type');
    const amount = $('market-amount');
    if (amountType) amountType.value = 'jpy';
    if (amount) amount.value = String(value);
    syncQuickAmountButtons();
    if (comparisonTimer) clearTimeout(comparisonTimer);
    comparisonTimer = setTimeout(loadComparison, 80);
  }

  function setAmountFromRange(value) {
    const amountType = $('market-amount-type');
    const amount = $('market-amount');
    const nextValue = clampRangeAmount(value);
    if (amountType) amountType.value = 'jpy';
    if (amount) amount.value = String(nextValue);
    syncQuickAmountButtons();
    if (comparisonTimer) clearTimeout(comparisonTimer);
    comparisonTimer = setTimeout(loadComparison, 80);
  }

  function stepAmountRange(delta) {
    const current = activeQuickAmount();
    const slider = $('market-amount-range');
    const baseValue = current == null ? Number(slider && slider.value) : current;
    setAmountFromRange(clampRangeAmount((Number.isFinite(baseValue) ? baseValue : AMOUNT_RANGE_MIN) + Number(delta || 0)));
  }

  function amountTypeValue() {
    return $('market-amount-type')?.value === 'base' ? 'base' : 'jpy';
  }

  function syncAmountTypeToggle() {
    const toggle = document.querySelector('.market-amount-type-toggle');
    if (!toggle) return;
    const value = amountTypeValue();
    toggle.dataset.state = value;
    toggle.querySelectorAll('[data-market-amount-type-toggle]').forEach((button) => {
      const active = button.dataset.marketAmountTypeToggle === value;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
  }

  function initAmountTypeToggle() {
    const select = $('market-amount-type');
    const toggle = document.querySelector('.market-amount-type-toggle');
    if (!select || !toggle) return;
    toggle.addEventListener('click', (event) => {
      const button = event.target && event.target.closest ? event.target.closest('[data-market-amount-type-toggle]') : null;
      if (!button) return;
      const value = button.dataset.marketAmountTypeToggle === 'base' ? 'base' : 'jpy';
      if (select.value === value) return;
      select.value = value;
      select.dispatchEvent(new Event('change', { bubbles: true }));
    });
    syncAmountTypeToggle();
  }

  function tableRowPositionMap() {
    const positions = new Map();
    [
      'market-domestic-comparison-tbody',
      'market-orderbook-tbody',
      'market-volume-tbody',
      'market-sales-tbody',
      'market-comparison-tbody',
    ].forEach((tbodyId) => {
      const tbody = $(tbodyId);
      if (!tbody) return;
      tbody.querySelectorAll('tr[data-exchange-id]').forEach((row) => {
        const id = row.getAttribute('data-exchange-id');
        if (!id) return;
        positions.set(`${tbodyId}:${id}`, row.getBoundingClientRect());
      });
    });
    return positions;
  }

  function animateTableReorder(renderFn) {
    const before = tableRowPositionMap();
    renderFn();
    window.requestAnimationFrame(() => {
      [
        'market-domestic-comparison-tbody',
        'market-orderbook-tbody',
        'market-volume-tbody',
        'market-sales-tbody',
        'market-comparison-tbody',
      ].forEach((tbodyId) => {
        const tbody = $(tbodyId);
        if (!tbody) return;
        tbody.querySelectorAll('tr[data-exchange-id]').forEach((row) => {
          const id = row.getAttribute('data-exchange-id');
          const first = before.get(`${tbodyId}:${id}`);
          if (!first) return;
          const last = row.getBoundingClientRect();
          const dx = first.left - last.left;
          const dy = first.top - last.top;
          if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) return;
          row.animate([
            { transform: `translate(${dx}px, ${dy}px)`, opacity: 0.88 },
            { transform: 'translate(0, 0)', opacity: 1 },
          ], {
            duration: 360,
            easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
          });
        });
      });
    });
  }

  let activeLinkedExchangeId = '';
  let linkedExchangeTapTimer = 0;

  function syncLinkedExchangeHighlight() {
    const activeId = normalizeExchangeId(activeLinkedExchangeId);
    document.body.classList.toggle('has-exchange-highlight', Boolean(activeId));
    document.querySelectorAll('[data-exchange-id]').forEach((node) => {
      const id = normalizeExchangeId(node.getAttribute('data-exchange-id'));
      node.classList.toggle('is-exchange-linked', Boolean(activeId && id === activeId));
    });
  }

  function setLinkedExchangeHighlight(exchangeId) {
    const id = normalizeExchangeId(exchangeId);
    if (activeLinkedExchangeId === id) return;
    activeLinkedExchangeId = id;
    syncLinkedExchangeHighlight();
  }

  function initExchangeCrossHighlight() {
    const targetSelector = 'tr[data-exchange-id], .market-volume-legend-row[data-exchange-id]';

    const handleEnter = (event) => {
      const target = event.target && event.target.closest ? event.target.closest(targetSelector) : null;
      if (!target) return;
      setLinkedExchangeHighlight(target.getAttribute('data-exchange-id'));
    };
    const handleLeave = (event) => {
      const target = event.target && event.target.closest ? event.target.closest(targetSelector) : null;
      if (!target) return;
      const related = event.relatedTarget && event.relatedTarget.closest ? event.relatedTarget.closest(targetSelector) : null;
      if (related && related.getAttribute('data-exchange-id') === target.getAttribute('data-exchange-id')) return;
      setLinkedExchangeHighlight('');
    };

    document.addEventListener('pointerover', handleEnter);
    document.addEventListener('pointerout', handleLeave);
    document.addEventListener('mouseover', handleEnter);
    document.addEventListener('mouseout', handleLeave);
    document.addEventListener('click', (event) => {
      const target = event.target && event.target.closest ? event.target.closest(targetSelector) : null;
      if (!target) return;
      window.clearTimeout(linkedExchangeTapTimer);
      setLinkedExchangeHighlight(target.getAttribute('data-exchange-id'));
      linkedExchangeTapTimer = window.setTimeout(() => {
        setLinkedExchangeHighlight('');
      }, 1800);
    });
    document.addEventListener('focusin', (event) => {
      const target = event.target && event.target.closest ? event.target.closest(targetSelector) : null;
      if (target) setLinkedExchangeHighlight(target.getAttribute('data-exchange-id'));
    });
    document.addEventListener('focusout', (event) => {
      const related = event.relatedTarget && event.relatedTarget.closest ? event.relatedTarget.closest(targetSelector) : null;
      if (related) return;
      setLinkedExchangeHighlight('');
    });
  }

  function highlightMarketTarget(id) {
    const section = document.getElementById(id);
    if (!section) return;
    section.classList.remove('market-target-highlight');
    void section.offsetWidth;
    section.classList.add('market-target-highlight');
    window.setTimeout(() => {
      section.classList.remove('market-target-highlight');
    }, 2200);
  }

  function initSectionNavigation() {
    const links = Array.from(document.querySelectorAll('[data-market-section-target]'))
      .filter(link => link.hash);
    if (links.length === 0) return;
    const ids = [...new Set(links.map(link => decodeURIComponent(link.hash.slice(1))).filter(Boolean))];
    const sections = ids
      .map(id => document.getElementById(id))
      .filter(Boolean);
    if (sections.length === 0) return;

    const setActive = (id) => {
      links.forEach((link) => {
        const active = decodeURIComponent(link.hash.slice(1)) === id;
        link.classList.toggle('is-active', active);
        if (active) link.setAttribute('aria-current', 'true');
        else link.removeAttribute('aria-current');
      });
      document.querySelectorAll('.market-section-nav__track').forEach((track) => {
        const trackLinks = Array.from(track.querySelectorAll('[data-market-section-target]'));
        const index = Math.max(0, trackLinks.findIndex(link => decodeURIComponent(link.hash.slice(1)) === id));
        track.style.setProperty('--active-index', String(index));
      });
    };

    let ticking = false;
    const update = () => {
      ticking = false;
      const offset = window.innerWidth < 768 ? 108 : 118;
      let activeId = sections[0].id;
      sections.forEach((section) => {
        const rect = section.getBoundingClientRect();
        if (rect.top - offset <= 0) activeId = section.id;
      });
      setActive(activeId);
    };

    const schedule = () => {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(update);
    };

    links.forEach((link) => {
      link.addEventListener('click', () => {
        const id = decodeURIComponent(link.hash.slice(1));
        if (id) {
          setActive(id);
          highlightMarketTarget(id);
        }
      });
    });
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    update();
  }

  function initIntentNavigation() {
    document.querySelectorAll('[data-market-intent-target]').forEach((link) => {
      link.addEventListener('click', (event) => {
        const id = link.hash ? decodeURIComponent(link.hash.slice(1)) : '';
        if (!id) return;
        const section = document.getElementById(id);
        if (!section) return;
        event.preventDefault();
        section.scrollIntoView({
          behavior: prefersReducedMotion.matches ? 'auto' : 'smooth',
          block: 'start',
        });
        if (window.history && window.history.pushState) {
          window.history.pushState(null, '', link.hash);
        } else {
          window.location.hash = link.hash;
        }
        highlightMarketTarget(id);
        window.setTimeout(() => highlightMarketTarget(id), 480);
        window.setTimeout(() => highlightMarketTarget(id), 1600);
        window.setTimeout(() => highlightMarketTarget(id), 3000);
      });
    });
  }

  function syncReadmoreSection(section, expanded) {
    const button = section.querySelector('[data-market-readmore-toggle]');
    const label = button && button.querySelector('[data-readmore-label]');
    section.classList.toggle('is-expanded', expanded);
    if (button) button.setAttribute('aria-expanded', expanded ? 'true' : 'false');
    if (label) label.textContent = expanded ? '閉じる' : 'もっと見る';
  }

  function initReadmoreSections() {
    document.querySelectorAll('[data-market-readmore]').forEach((section) => {
      const button = section.querySelector('[data-market-readmore-toggle]');
      const body = section.querySelector('.market-readmore__body');
      if (!button || !body) return;
      syncReadmoreSection(section, section.classList.contains('is-expanded'));
      button.addEventListener('click', () => {
        syncReadmoreSection(section, !section.classList.contains('is-expanded'));
      });
    });
  }

  function syncBeginnerCollapsibleSection(section, collapsed) {
    const button = section.querySelector('[data-market-collapse-toggle]');
    const label = button && button.querySelector('[data-collapse-label]');
    section.classList.toggle('is-collapsed', collapsed);
    if (button) button.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
    if (label) label.textContent = collapsed ? '詳しく見る' : '折りたたむ';
  }

  function syncBeginnerCollapses() {
    document.querySelectorAll('[data-beginner-collapse]').forEach((section) => {
      const shouldCollapse = beginnerModeEnabled() && section.dataset.userExpanded !== 'true';
      syncBeginnerCollapsibleSection(section, shouldCollapse);
    });
  }

  function initBeginnerCollapses() {
    document.querySelectorAll('[data-beginner-collapse]').forEach((section) => {
      const button = section.querySelector('[data-market-collapse-toggle]');
      if (!button) return;
      button.addEventListener('click', () => {
        const willCollapse = !section.classList.contains('is-collapsed');
        section.dataset.userExpanded = willCollapse ? 'false' : 'true';
        syncBeginnerCollapsibleSection(section, willCollapse);
      });
    });
    syncBeginnerCollapses();
  }

  function readPretradeChecklistState() {
    try {
      const parsed = JSON.parse(localStorage.getItem(PRETRADE_CHECKLIST_STORAGE_KEY) || '[]');
      return new Set((Array.isArray(parsed) ? parsed : []).map(value => String(value)));
    } catch (_) {
      return new Set();
    }
  }

  function writePretradeChecklistState(checked) {
    try {
      localStorage.setItem(PRETRADE_CHECKLIST_STORAGE_KEY, JSON.stringify([...checked]));
    } catch (_) {
      // noop
    }
  }

  function bestPretradeExchange() {
    const snapshotBest = summary && summary.snapshot && summary.snapshot.cheapestBuy
      ? summary.snapshot.cheapestBuy
      : null;
    if (snapshotBest) return snapshotBest;
    const rows = summary && summary.domesticComparison && Array.isArray(summary.domesticComparison.rows)
      ? summary.domesticComparison.rows
      : [];
    return rows
      .filter(row => row && row.cost100k && row.cost100k.status === 'fresh' && finiteRank(row.cost100k.rank) != null)
      .sort((a, b) => finiteRank(a.cost100k.rank) - finiteRank(b.cost100k.rank))[0] || null;
  }

  function isPretradeChecklistComplete() {
    const list = document.querySelector('[data-market-pretrade-checklist]');
    if (!list) return false;
    const checked = readPretradeChecklistState();
    const buttons = Array.from(list.querySelectorAll('[data-pretrade-check]'));
    return buttons.length > 0 && buttons.every(button => checked.has(String(button.dataset.pretradeCheck)));
  }

  function updatePretradeCta(enabled = false) {
    const cta = $('market-pretrade-primary-cta');
    if (!cta) return;
    const best = bestPretradeExchange();
    const label = best && (best.exchangeLabel || best.exchangeId) ? (best.exchangeLabel || best.exchangeId) : '最安候補';
    const actions = best ? exchangeActionMeta(best.exchangeId) : { primaryHref: '#market-exchange-comparison' };
    const href = actions.primaryHref || '#market-exchange-comparison';
    cta.textContent = isExternalHref(href) ? `${label}公式で口座開設・ログイン` : `${label}の詳細を見る`;
    cta.href = href;
    if (isExternalHref(href)) {
      cta.target = '_blank';
      cta.rel = 'noopener noreferrer';
    } else {
      cta.removeAttribute('target');
      cta.removeAttribute('rel');
    }
    cta.classList.toggle('is-disabled', !enabled);
    cta.setAttribute('aria-disabled', enabled ? 'false' : 'true');
  }

  function syncPretradeChecklist(list, options = {}) {
    if (!list) return;
    const checked = readPretradeChecklistState();
    const buttons = Array.from(list.querySelectorAll('[data-pretrade-check]'));
    buttons.forEach((button) => {
      const active = checked.has(String(button.dataset.pretradeCheck));
      button.classList.toggle('is-checked', active);
      button.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
    const allDone = buttons.length > 0 && buttons.every(button => checked.has(String(button.dataset.pretradeCheck)));
    const ready = document.querySelector('[data-pretrade-ready]');
    if (ready) {
      ready.hidden = !allDone;
      ready.classList.toggle('is-celebrating', allDone && options.celebrate);
      if (allDone && options.celebrate) {
        window.setTimeout(() => ready.classList.remove('is-celebrating'), 900);
      }
    }
    updatePretradeCta(allDone);
  }

  function initPretradeChecklist() {
    const list = document.querySelector('[data-market-pretrade-checklist]');
    if (!list) return;
    syncPretradeChecklist(list);
    list.addEventListener('click', (event) => {
      const button = event.target && event.target.closest ? event.target.closest('[data-pretrade-check]') : null;
      if (!button) return;
      const checked = readPretradeChecklistState();
      const id = String(button.dataset.pretradeCheck);
      const wasComplete = Array.from(list.querySelectorAll('[data-pretrade-check]'))
        .every(item => checked.has(String(item.dataset.pretradeCheck)));
      if (checked.has(id)) checked.delete(id);
      else checked.add(id);
      writePretradeChecklistState(checked);
      const nowComplete = Array.from(list.querySelectorAll('[data-pretrade-check]'))
        .every(item => checked.has(String(item.dataset.pretradeCheck)));
      syncPretradeChecklist(list, { celebrate: !wasComplete && nowComplete });
    });
  }

  function renderExchangePreferences() {
    const host = $('market-exchange-preferences');
    if (!host) return;
    const exchanges = supportedExchanges();
    if (exchanges.length === 0) {
      host.hidden = true;
      renderFloatingMyExchanges([]);
      return;
    }
    host.hidden = false;
    const selectedCount = exchanges.filter(exchange => isMyExchange(exchange.id)).length;
    const onlyDisabled = selectedCount === 0;
    if (onlyDisabled && showOnlyMyExchanges) {
      showOnlyMyExchanges = false;
      writeStoredBoolean(MY_EXCHANGES_ONLY_STORAGE_KEY, false);
    }
    const pinned = pinnedSupportedExchanges();
    host.innerHTML = `
      <div class="market-exchange-preferences__header">
        <div>
          <p class="market-exchange-preferences__eyebrow">My Exchanges</p>
          <strong>ピン留めした取引所を上に固定</strong>
          <span>${selectedCount > 0 ? `${selectedCount}社を固定中` : '取引所名横のピンで固定できます'}</span>
        </div>
        <div class="market-exchange-preferences__actions">
          <button class="market-preference-button ${showOnlyMyExchanges ? 'is-active' : ''}" type="button" data-market-my-only ${onlyDisabled ? 'disabled' : ''}>選択だけ表示</button>
          <button class="market-preference-button" type="button" data-market-my-clear ${onlyDisabled ? 'disabled' : ''}>クリア</button>
        </div>
      </div>
      <div class="market-pinned-strip" aria-live="polite">
        ${pinned.length > 0
          ? pinned.map(exchange => `
            <button class="market-pinned-strip__item" type="button" draggable="true" data-market-drag-exchange="${escapeHtml(normalizeExchangeId(exchange.id))}" aria-label="${escapeHtml(exchange.label || exchange.id)}を並び替え">
              <span class="market-drag-grip" aria-hidden="true"></span>
              <span>${escapeHtml(exchange.label || exchange.id)}</span>
            </button>
          `).join('')
          : '<span class="market-pinned-strip__empty">未固定</span>'}
      </div>
    `;
    renderFloatingMyExchanges(pinned);
  }

  function renderFloatingMyExchanges(pinnedExchanges = null) {
    const host = $('market-floating-my-exchanges');
    if (!host) return;
    const exchanges = Array.isArray(pinnedExchanges)
      ? pinnedExchanges.slice().sort((a, b) => myExchangeOrderIndex(a.id) - myExchangeOrderIndex(b.id))
      : pinnedSupportedExchanges();
    if (exchanges.length === 0) {
      host.hidden = true;
      host.innerHTML = '';
      return;
    }
    const domesticRows = summary && summary.domesticComparison && Array.isArray(summary.domesticComparison.rows)
      ? summary.domesticComparison.rows
      : [];
    host.hidden = false;
    host.innerHTML = `
      <span class="market-floating-my-exchanges__label">My Exchanges</span>
      <div class="market-floating-my-exchanges__items">
        ${exchanges.map((exchange) => {
          const row = domesticRows.find(item => normalizeExchangeId(item.exchangeId) === normalizeExchangeId(exchange.id));
          const cost = row && row.cost100k;
          const sales = row && row.salesSpread;
          const primary = cost && cost.status === 'fresh' && finiteRank(cost.rank) != null
            ? `#${cost.rank} ${fmtJpyPrice(cost.effectiveVWAP)}`
            : (sales && sales.status === 'ready' && Number.isFinite(Number(sales.spreadPct)) ? `Spread ${fmtPct(sales.spreadPct)}` : '比較中');
          return `<span class="market-floating-my-exchanges__item" style="--exchange-accent:${escapeHtml(exchangeAccent(exchange.id).color)}"><b>${escapeHtml(exchange.label || exchange.id)}</b><small>${escapeHtml(primary)}</small></span>`;
        }).join('')}
      </div>
    `;
  }

  function moveMyExchangeBefore(sourceExchangeId, targetExchangeId) {
    const source = normalizeExchangeId(sourceExchangeId);
    const target = normalizeExchangeId(targetExchangeId);
    if (!source || !target || source === target || !myExchangeIds.has(source) || !myExchangeIds.has(target)) return false;
    const order = myExchangeOrder().filter(id => id !== source);
    const targetIndex = order.indexOf(target);
    order.splice(targetIndex >= 0 ? targetIndex : order.length, 0, source);
    myExchangeIds = new Set(order);
    writeStoredExchangeSet(myExchangeIds);
    return true;
  }

  function clearExchangeDragState() {
    document.querySelectorAll('.is-dragging, .is-drag-over').forEach((node) => {
      node.classList.remove('is-dragging', 'is-drag-over');
    });
  }

  function initExchangeDragSorting() {
    let draggedExchangeId = '';
    document.addEventListener('dragstart', (event) => {
      const handle = event.target && event.target.closest ? event.target.closest('[data-market-drag-exchange]') : null;
      if (!handle) return;
      const id = normalizeExchangeId(handle.dataset.marketDragExchange || handle.getAttribute('data-exchange-id'));
      if (!id || !myExchangeIds.has(id)) {
        event.preventDefault();
        return;
      }
      draggedExchangeId = id;
      handle.classList.add('is-dragging');
      if (event.dataTransfer) {
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', id);
      }
    });

    document.addEventListener('dragover', (event) => {
      if (!draggedExchangeId) return;
      const target = event.target && event.target.closest ? event.target.closest('[data-market-drag-exchange], tr[data-exchange-id]') : null;
      const targetId = target ? normalizeExchangeId(target.dataset.marketDragExchange || target.getAttribute('data-exchange-id')) : '';
      if (!target || !targetId || targetId === draggedExchangeId || !myExchangeIds.has(targetId)) return;
      event.preventDefault();
      document.querySelectorAll('.is-drag-over').forEach(node => {
        if (node !== target) node.classList.remove('is-drag-over');
      });
      target.classList.add('is-drag-over');
      if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
    });

    document.addEventListener('drop', (event) => {
      if (!draggedExchangeId) return;
      const target = event.target && event.target.closest ? event.target.closest('[data-market-drag-exchange], tr[data-exchange-id]') : null;
      const targetId = target ? normalizeExchangeId(target.dataset.marketDragExchange || target.getAttribute('data-exchange-id')) : '';
      if (!targetId) return;
      event.preventDefault();
      const moved = moveMyExchangeBefore(draggedExchangeId, targetId);
      clearExchangeDragState();
      draggedExchangeId = '';
      if (moved) animateTableReorder(rerenderMarketTables);
    });

    document.addEventListener('dragend', () => {
      draggedExchangeId = '';
      clearExchangeDragState();
    });
  }

  function comparisonBestRow(data) {
    const rows = orderRowsForMyExchanges(Array.isArray(data && data.rows) ? data.rows : []);
    return rows
      .filter(row => liveRowStatus(row) === 'fresh' && row.result && !row.result.error && finiteRank(row.rank) != null)
      .slice()
      .sort((a, b) => finiteRank(a.rank) - finiteRank(b.rank))[0] || null;
  }

  function domesticBestCostRow() {
    const rows = summary && summary.domesticComparison && Array.isArray(summary.domesticComparison.rows)
      ? orderRowsForMyExchanges(summary.domesticComparison.rows)
      : [];
    return rows
      .filter(row => row && row.cost100k && row.cost100k.status === 'fresh' && finiteRank(row.cost100k.rank) != null)
      .slice()
      .sort((a, b) => finiteRank(a.cost100k.rank) - finiteRank(b.cost100k.rank))[0] || null;
  }

  function stickyAmountLabel() {
    if (lastComparisonData && lastComparisonData.meta) return comparisonAmountLabel(lastComparisonData.meta);
    const active = activeQuickAmount();
    return active == null ? '数量入力中' : amountRangeLabel(active);
  }

  function renderStickySimulator() {
    const host = $('market-sticky-simulator');
    if (!host) return;
    const amount = $('market-sticky-amount');
    const best = $('market-sticky-best');
    const action = $('market-sticky-action');
    const bestComparison = comparisonBestRow(lastComparisonData);
    const bestDomestic = domesticBestCostRow();
    let label = 'データ待ち';
    let meta = ORDERBOOK_WAITING_MESSAGE;
    let actionHref = '#market-cost-comparison';
    let actionLabel = '比較';
    let actionExternal = false;

    if (bestComparison && bestComparison.result) {
      const result = bestComparison.result;
      label = bestComparison.exchangeLabel || bestComparison.exchangeId || '最安候補';
      meta = `VWAP ${fmtJpyPrice(result.effectiveVWAP)}`;
      const actionMeta = exchangeActionMeta(bestComparison.exchangeId);
      actionHref = actionMeta.primaryHref || actionHref;
    } else if (bestDomestic && bestDomestic.cost100k) {
      label = bestDomestic.exchangeLabel || bestDomestic.exchangeId || '最安候補';
      meta = `10万円買い VWAP ${fmtJpyPrice(bestDomestic.cost100k.effectiveVWAP)}`;
      const actionMeta = exchangeActionMeta(bestDomestic.exchangeId);
      actionHref = actionMeta.primaryHref || actionHref;
    } else {
      const snapshotBest = summary && summary.snapshot && summary.snapshot.cheapestBuy;
      if (snapshotBest) {
        label = snapshotBest.exchangeLabel || snapshotBest.exchangeId || '最安候補';
        meta = `10万円買い VWAP ${fmtJpyPrice(snapshotBest.effectiveVWAP)}`;
        const actionMeta = exchangeActionMeta(snapshotBest.exchangeId);
        actionHref = actionMeta.primaryHref || actionHref;
      }
    }
    actionExternal = isExternalHref(actionHref);
    actionLabel = actionExternal ? '購入へ進む' : '詳細';

    if (amount) amount.textContent = stickyAmountLabel();
    if (best) {
      best.textContent = label;
      best.title = meta;
    }
    if (action) {
      action.href = actionHref;
      action.textContent = actionLabel;
      action.setAttribute('aria-label', actionExternal ? `${label}公式サイトを開く` : `${label}の詳細を開く`);
      if (actionExternal) {
        action.target = '_blank';
        action.rel = 'noopener noreferrer';
      } else {
        action.removeAttribute('target');
        action.removeAttribute('rel');
      }
    }
    host.hidden = false;
    host.classList.toggle('is-ready', label !== 'データ待ち');
    syncStickySimulatorVisibility();
  }

  function syncStickySimulatorVisibility() {
    const host = $('market-sticky-simulator');
    if (!host || host.hidden) return;
    const threshold = window.innerWidth < 768 ? 360 : 520;
    host.classList.toggle('is-visible', window.scrollY > threshold);
  }

  function rerenderMarketTables() {
    renderExchangePreferences();
    syncQuickAmountButtons();
    if (summary) {
      renderHero();
      renderDomesticComparisonRows();
      renderOrderbookRows();
      renderVolumeRows();
      renderSalesRows();
      updateSelectedOrderbookMeta();
    }
    if (lastComparisonData) renderComparison(lastComparisonData);
    renderStickySimulator();
  }

  function orderbookRowsByExchange(data) {
    const rows = [];
    if (data && Array.isArray(data.orderbooks)) rows.push(...data.orderbooks);
    const domesticRows = data && data.domesticComparison && Array.isArray(data.domesticComparison.rows)
      ? data.domesticComparison.rows
      : [];
    domesticRows.forEach((row) => {
      if (row && row.orderbook) rows.push({ ...row.orderbook, exchangeId: row.exchangeId, instrumentId: row.instrumentId });
    });
    const byKey = new Map();
    rows.forEach((row) => {
      const key = `${normalizeExchangeId(row.exchangeId)}:${String(row.instrumentId || instrumentId).toUpperCase()}`;
      if (!normalizeExchangeId(row.exchangeId)) return;
      byKey.set(key, row);
    });
    return byKey;
  }

  function markSummaryCellChanges(previousSummary, nextSummary) {
    if (!previousSummary || !nextSummary) return;
    const previousRows = orderbookRowsByExchange(previousSummary);
    const nextRows = orderbookRowsByExchange(nextSummary);
    nextRows.forEach((nextRow, key) => {
      const previousRow = previousRows.get(key);
      if (previousRow) markOrderbookCellChanges(nextRow.exchangeId, previousRow, nextRow);
    });
  }

  const readOptionalFeeRatePct = (input) => {
    const raw = input && input.value != null ? String(input.value).trim() : '';
    if (!raw) return null;
    const parsed = parseNumberInput(raw);
    return Number.isFinite(parsed) ? parsed : NaN;
  };
  const marketLabel = () => (summary && summary.market && summary.market.label) || config.label || instrumentId;
  const sortedOrderbookRows = () => ((summary && summary.orderbooks) || [])
    .slice()
    .sort((a, b) => {
      const statusDiff = statusRank(liveRowStatus(a)) - statusRank(liveRowStatus(b));
      if (statusDiff !== 0) return statusDiff;
      const spreadDiff = Number(a.spreadPct ?? Infinity) - Number(b.spreadPct ?? Infinity);
      if (spreadDiff !== 0) return spreadDiff;
      return String(a.exchangeLabel || a.exchangeId).localeCompare(String(b.exchangeLabel || b.exchangeId), 'ja');
    });

  function updateFeePresetHint() {
    const hint = $('market-fee-preset-hint');
    const input = $('market-fee-rate');
    if (!hint || !input) return;
    const feeRatePct = readOptionalFeeRatePct(input);
    if (feeRatePct == null) {
      hint.textContent = beginnerModeEnabled()
        ? '未入力なら各取引所の成行手数料を自動で使います。入力すると全取引所を同じ手数料率で比較します。'
        : '未入力なら各取引所の既定 taker 手数料を使って比較します。入力すると全取引所を同じ手数料率で比較します。';
      return;
    }
    if (Number.isNaN(feeRatePct)) {
      hint.textContent = '手数料率は0%以上100%以下で入力してください。';
      return;
    }
    hint.textContent = beginnerModeEnabled()
      ? `現在は ${feeRatePct}% を全取引所に手動適用しています。空に戻すと各社の成行手数料に戻ります。`
      : `現在は ${feeRatePct}% を全取引所に手動適用しています。空に戻すと各取引所の既定手数料に戻ります。`;
  }

  function shouldShowLoadingSkeleton(message) {
    return isLoadingMessage(message);
  }

  function setEmpty(tbodyId, colspan, message) {
    const tbody = $(tbodyId);
    if (!tbody) return;
    tbody.innerHTML = shouldShowLoadingSkeleton(message)
      ? `<tr class="market-skeleton-row"><td colspan="${colspan}">${skeletonStackHtml(message)}</td></tr>`
      : `<tr><td colspan="${colspan}" class="text-center text-gray-500 py-4">${escapeHtml(message)}</td></tr>`;
  }

  function supportedExchanges() {
    return (summary && summary.exchanges) || [];
  }

  function selectedExchange() {
    return supportedExchanges().find(exchange => exchange.id === selectedExchangeId) || supportedExchanges()[0] || null;
  }

  function selectedOrderbookRow() {
    return ((summary && summary.orderbooks) || []).find(row => row.exchangeId === selectedExchangeId) || null;
  }

  function updatePageLabels() {
    const label = marketLabel();
    const navLink = $('market-page-nav-link');
    document.title = `${label} 結論・国内取引所比較・銘柄特徴｜国内暗号資産取引所ナビ`;
    setText('market-page-title', `${label} 銘柄深掘り`);
    setText('market-page-subtitle', '結論・国内取引所比較・銘柄特徴');
    setText('market-mega-summary-title', `${label} 銘柄深掘り`);
    setText('market-hero-title', `${label} 国内取引所データ`);
    setText('market-footer-label', `${label} 銘柄深掘り`);
    setText('market-summary-title', `${label} 比較サマリー`);
    if (navLink) {
      navLink.href = marketPageUrl(instrumentId);
      navLink.title = `${label} 銘柄深掘り`;
    }
  }

  function populateBoardExchangeSelect() {
    const select = $('market-board-exchange');
    if (!select) return;
    const exchanges = supportedExchanges();
    if (exchanges.length === 0) return;

    if (!selectedExchangeId || !exchanges.some(exchange => exchange.id === selectedExchangeId)) {
      const rows = sortedOrderbookRows();
      const fresh = rows.find(row => liveRowStatus(row) === 'fresh');
      const stale = rows.find(row => liveRowStatus(row) === 'stale');
      selectedExchangeId = fresh ? fresh.exchangeId : (stale ? stale.exchangeId : exchanges[0].id);
    }

    select.innerHTML = exchanges.map(exchange => `
      <option value="${escapeHtml(exchange.id)}">${escapeHtml(exchange.label || exchange.id)}</option>
    `).join('');
    select.value = selectedExchangeId;
  }

  function updateSelectedOrderbookMeta() {
    const exchange = selectedExchange();
    if (!exchange) return;
    const row = selectedOrderbookRow();
    const status = liveRowStatus(row);
    const source = row && row.source ? ` / ${String(row.source).toUpperCase()}` : '';
    const stale = status === 'stale' ? ' / STALE' : '';
    const updated = row && (status === 'fresh' || status === 'stale')
      ? ` / 最終更新 ${ageLabel(row)}`
      : '';
    setText('orderbook-meta', `${exchange.label || exchange.id} / ${marketLabel()} の板${source}${stale}${updated}`);
  }

  function connectSelectedOrderbook() {
    const exchange = selectedExchange();
    if (!exchange) return;
    selectedExchangeId = exchange.id;
    ws.setMarket(exchange.id, instrumentId);
    if (typeof setChartBaseCurrency === 'function') {
      setChartBaseCurrency((summary.market && summary.market.baseCurrency) || instrumentId.split('-')[0] || 'BTC');
    }
    updateSelectedOrderbookMeta();
  }

  function setOrderbookViewMode(mode) {
    orderbookViewMode = mode === 'ladder' ? 'ladder' : 'depth';
    document.querySelectorAll('[data-market-orderbook-view]').forEach((button) => {
      const active = button.dataset.marketOrderbookView === orderbookViewMode;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
    document.querySelectorAll('[data-market-orderbook-view-panel]').forEach((panel) => {
      panel.hidden = panel.dataset.marketOrderbookViewPanel !== orderbookViewMode;
    });
    if (orderbookViewMode === 'ladder') renderOrderbookLadder();
  }

  function levelsFromDepthPoints(points) {
    let previous = 0;
    return (Array.isArray(points) ? points : [])
      .map((point) => {
        const price = finiteNumber(point && point.price);
        const cumulative = finiteNumber(point && point.cumulative);
        const quantity = cumulative == null ? null : Math.max(0, cumulative - previous);
        if (cumulative != null) previous = cumulative;
        return { price, cumulative, quantity };
      })
      .filter(level => level.price != null && level.quantity != null && level.quantity > 0);
  }

  function orderbookLadderRowHtml(level, side, maxDepthJpy) {
    const depthJpy = Math.max(0, Number(level.price || 0) * Number(level.quantity || 0));
    const width = maxDepthJpy > 0 ? Math.max(8, Math.min(100, Math.round((depthJpy / maxDepthJpy) * 100))) : 8;
    return `
      <div class="market-orderbook-ladder__row market-orderbook-ladder__row--${escapeHtml(side)}" style="--ladder-depth:${width}%">
        <span class="market-orderbook-ladder__price">${fmtJpyPrice(level.price)}</span>
        <span class="market-orderbook-ladder__qty">${Fmt.baseCompact(level.quantity)}</span>
        <span class="market-orderbook-ladder__depth">${Fmt.jpyLarge(depthJpy)}</span>
      </div>
    `;
  }

  function renderOrderbookLadder() {
    const host = $('market-orderbook-ladder');
    if (!host) return;
    const exchange = selectedExchange();
    const row = selectedOrderbookRow();
    const depthData = lastSelectedDepthData;
    if (!depthData || !Array.isArray(depthData.askPoints) || !Array.isArray(depthData.bidPoints)) {
      host.innerHTML = `<div class="market-orderbook-ladder__empty">${escapeHtml(ORDERBOOK_WAITING_MESSAGE)}</div>`;
      return;
    }
    const askLevels = levelsFromDepthPoints(depthData.askPoints).slice(0, 8).reverse();
    const bidLevels = levelsFromDepthPoints(depthData.bidPoints).slice(0, 8);
    const allLevels = [...askLevels, ...bidLevels];
    const maxDepthJpy = Math.max(0, ...allLevels.map(level => Number(level.price || 0) * Number(level.quantity || 0)));
    const midPrice = finiteNumber(lastSelectedMidPrice)
      || (row && finiteNumber(row.midPrice))
      || (row && finiteNumber(row.bestAsk) != null && finiteNumber(row.bestBid) != null
        ? (Number(row.bestAsk) + Number(row.bestBid)) / 2
        : null);
    const baseCurrency = (summary && summary.market && summary.market.baseCurrency) || instrumentId.split('-')[0] || '';
    host.innerHTML = `
      <div class="market-orderbook-ladder__head">
        <span>${escapeHtml(exchange ? (exchange.label || exchange.id) : '選択中の取引所')}</span>
        <strong>${midPrice != null ? fmtJpyPrice(midPrice) : '-'}</strong>
        <small>${escapeHtml(baseCurrency)} / JPY</small>
      </div>
      <div class="market-orderbook-ladder__book" aria-label="縦型リアルタイム板">
        <div class="market-orderbook-ladder__side market-orderbook-ladder__side--ask">
          ${askLevels.length ? askLevels.map(level => orderbookLadderRowHtml(level, 'ask', maxDepthJpy)).join('') : '<span class="market-orderbook-ladder__empty">Ask待機中</span>'}
        </div>
        <div class="market-orderbook-ladder__mid">
          <span>現在値</span>
          <strong>${midPrice != null ? fmtJpyPrice(midPrice) : '-'}</strong>
        </div>
        <div class="market-orderbook-ladder__side market-orderbook-ladder__side--bid">
          ${bidLevels.length ? bidLevels.map(level => orderbookLadderRowHtml(level, 'bid', maxDepthJpy)).join('') : '<span class="market-orderbook-ladder__empty">Bid待機中</span>'}
        </div>
      </div>
    `;
  }

  function renderHero() {
    const rows = sortedOrderbookRows();
    const counts = summarizeStatuses(rows);
    const freshRows = rows.filter(row => liveRowStatus(row) === 'fresh');
    const bestBid = freshRows
      .filter(row => Number.isFinite(Number(row.bestBid)))
      .sort((a, b) => Number(b.bestBid) - Number(a.bestBid))[0];
    const bestAsk = freshRows
      .filter(row => Number.isFinite(Number(row.bestAsk)))
      .sort((a, b) => Number(a.bestAsk) - Number(b.bestAsk))[0];
    let statusText = '板データ取得中';
    let statusTone = 'waiting';
    if (counts.fresh > 0 && counts.stale > 0) statusText = '鮮度注意';
    if (counts.fresh > 0 && counts.stale > 0) statusTone = 'warning';
    else if (counts.fresh > 0) {
      statusText = '集計済み';
      statusTone = 'fresh';
    } else if (counts.stale > 0) {
      statusText = '鮮度切れ';
      statusTone = 'stale';
    }
    setText('market-status', statusText);
    const statusNode = $('market-status');
    if (statusNode) statusNode.dataset.statusTone = statusTone;
    updateFreshnessProgress();
    setText('market-exchange-count', `${supportedExchanges().length}社`);
    setHtml('market-best-bid', bestBid ? `${exchangeNameLinkHtml(bestBid.exchangeId, bestBid.exchangeLabel, 'market-inline-exchange-link')} ${escapeHtml(fmtJpyPrice(bestBid.bestBid))}` : '-');
    setHtml('market-best-ask', bestAsk ? `${exchangeNameLinkHtml(bestAsk.exchangeId, bestAsk.exchangeLabel, 'market-inline-exchange-link')} ${escapeHtml(fmtJpyPrice(bestAsk.bestAsk))}` : '-');
    setText('market-hero-meta', `板 新鮮 ${counts.fresh}社 / stale ${counts.stale}社 / 待機 ${counts.waiting}社 | 出来高 ${summary.volume.rows.length}件 | 販売所 ${summary.sales.rows.length}件`);
  }

  function relativeSecondsLabel(ms) {
    if (!Number.isFinite(ms) || ms <= 0) return '-';
    const seconds = Math.max(0, Math.floor((Date.now() - ms) / 1000));
    if (seconds < 60) return `${seconds}秒前`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}分前`;
    return `${Math.floor(minutes / 60)}時間前`;
  }

  function updateFreshnessProgress() {
    const ring = $('market-refresh-progress');
    const label = $('market-updated-at');
    if (!summaryLoadedAt) {
      if (label) label.textContent = '最終更新 -';
      if (ring) ring.style.setProperty('--refresh-progress', '0deg');
      return;
    }
    const elapsed = Math.max(0, Date.now() - summaryLoadedAt);
    const progress = Math.max(0, Math.min(1, elapsed / SUMMARY_REFRESH_MS));
    const remaining = Math.max(0, Math.ceil((SUMMARY_REFRESH_MS - elapsed) / 1000));
    if (ring) {
      ring.style.setProperty('--refresh-progress', `${Math.round(progress * 360)}deg`);
      ring.title = `次のREST更新まで約${remaining}秒`;
      ring.setAttribute('aria-label', `次のREST更新まで約${remaining}秒`);
    }
    if (label) {
      const sourceTime = summary && summary.meta && summary.meta.generatedAt ? ` / ${fmtDateTime(summary.meta.generatedAt)}` : '';
      label.textContent = `最終更新 ${relativeSecondsLabel(summaryLoadedAt)}（REST）`;
      if (sourceTime) label.title = `生成時刻 ${sourceTime.replace(/^ \/ /, '')}`;
    }
  }

  function setSnapshotMetric(key, value, meta, options = {}) {
    const valueNode = $(`market-summary-${key}`);
    if (valueNode) {
      valueNode.innerHTML = options.valueExchangeId
        ? exchangeNameLinkHtml(options.valueExchangeId, value, 'market-summary-exchange-link')
        : escapeHtml(value || '-');
    }
    const metaNode = $(`market-summary-${key}-meta`);
    if (metaNode) {
      metaNode.innerHTML = options.metaExchangeId
        ? exchangeNameLinkHtml(options.metaExchangeId, meta, 'market-summary-exchange-link')
        : escapeHtml(meta || '');
    }
  }

  function setConclusionMetric(key, value, meta, exchangeId = '') {
    const node = $(`market-conclusion-${key}`);
    if (node) {
      const shouldSignal = ['best-board', 'best-sales', 'top-volume'].includes(key)
        && value
        && value !== 'データ待ち';
      const valueHtml = exchangeId
        ? exchangeNameLinkHtml(exchangeId, value, 'market-conclusion-exchange-link')
        : escapeHtml(value || '-');
      node.innerHTML = shouldSignal
        ? `<span class="market-signal-badge">${valueHtml}</span>`
        : valueHtml;
    }
    setText(`market-conclusion-${key}-meta`, meta);
  }

  function bestSalesFromSummary() {
    const rows = summary && summary.domesticComparison && Array.isArray(summary.domesticComparison.rows)
      ? summary.domesticComparison.rows
      : [];
    return rows
      .filter(row => row && row.salesSpread && row.salesSpread.status === 'ready' && Number.isFinite(Number(row.salesSpread.spreadPct)))
      .sort((a, b) => Number(a.salesSpread.spreadPct) - Number(b.salesSpread.spreadPct))[0] || null;
  }

  function topVolumeFromSummary() {
    const rows = summary && summary.volume && Array.isArray(summary.volume.rows)
      ? summary.volume.rows
      : [];
    return rows
      .filter(row => Number.isFinite(Number(row.quoteVolume)))
      .sort((a, b) => Number(b.quoteVolume) - Number(a.quoteVolume))[0] || null;
  }

  function renderMegaSummary(snapshotData) {
    const snapshot = snapshotData && typeof snapshotData === 'object' ? snapshotData : {};
    const domesticBest = domesticBestCostRow();
    const salesBest = bestSalesFromSummary();
    const volumeBest = topVolumeFromSummary();
    const cheapest = snapshot.cheapestBuy || (domesticBest && domesticBest.cost100k ? {
      exchangeId: domesticBest.exchangeId,
      exchangeLabel: domesticBest.exchangeLabel || domesticBest.exchangeId,
      effectiveVWAP: domesticBest.cost100k.effectiveVWAP,
      executionStatusLabel: domesticBest.cost100k.executionStatusLabel,
    } : null);
    const tightestSales = snapshot.tightestSalesSpread || (salesBest && salesBest.salesSpread ? {
      exchangeId: salesBest.exchangeId,
      exchangeLabel: salesBest.exchangeLabel || salesBest.exchangeId,
      spreadPct: salesBest.salesSpread.spreadPct,
    } : null);
    const topVolume = snapshot.topVolume || (volumeBest ? {
      exchangeId: volumeBest.exchangeId,
      exchangeLabel: volumeBest.exchangeLabel || volumeBest.exchangeId,
      quoteVolume: volumeBest.quoteVolume,
    } : null);

    setHtml('market-mega-best-board', cheapest ? exchangeNameLinkHtml(cheapest.exchangeId, cheapest.exchangeLabel, 'market-mega-exchange-link') : 'データ待ち');
    setHtml('market-mega-best-sales', tightestSales ? exchangeNameLinkHtml(tightestSales.exchangeId, tightestSales.exchangeLabel, 'market-mega-exchange-link') : 'データ待ち');
    setHtml('market-mega-top-volume', topVolume ? exchangeNameLinkHtml(topVolume.exchangeId, topVolume.exchangeLabel, 'market-mega-exchange-link') : 'データ待ち');
    setExchangeMark('market-mega-best-board-icon', cheapest && cheapest.exchangeId, cheapest && cheapest.exchangeLabel);
    setExchangeMark('market-mega-best-sales-icon', tightestSales && tightestSales.exchangeId, tightestSales && tightestSales.exchangeLabel);
    setExchangeMark('market-mega-top-volume-icon', topVolume && topVolume.exchangeId, topVolume && topVolume.exchangeLabel);

    const noteParts = [];
    if (cheapest && Number.isFinite(Number(cheapest.effectiveVWAP))) {
      noteParts.push(`最安候補は ${cheapest.exchangeLabel} / 実効VWAP ${fmtJpyPrice(cheapest.effectiveVWAP)}`);
    }
    if (tightestSales && Number.isFinite(Number(tightestSales.spreadPct))) {
      noteParts.push(`販売所最小 ${fmtPct(tightestSales.spreadPct)}`);
    }
    if (topVolume && Number.isFinite(Number(topVolume.quoteVolume))) {
      noteParts.push(`出来高 ${Fmt.jpyLarge(topVolume.quoteVolume)}`);
    }
    setText(
      'market-mega-summary-note',
      noteParts.length > 0
        ? `${marketLabel()} | ${noteParts.join(' | ')}`
        : '板、販売所、出来高を同じ銘柄で集計中です。'
    );
  }

  function renderBeginnerSimpleCard() {
    const bestExchange = $('market-beginner-best-exchange');
    const receive = $('market-beginner-receive');
    const bestSales = $('market-beginner-best-sales');
    const salesNote = $('market-beginner-sales-note');
    const note = $('market-beginner-note');
    if (!bestExchange || !receive || !bestSales || !salesNote || !note || !summary) return;

    const rows = Array.isArray(summary.domesticComparison && summary.domesticComparison.rows)
      ? summary.domesticComparison.rows
      : [];
    const baseCurrency = (summary && summary.market && summary.market.baseCurrency) || instrumentId.split('-')[0] || '';
    const ranked = rows
      .filter(row => row && row.cost100k && row.cost100k.status === 'fresh' && finiteRank(row.cost100k.rank) != null && Number.isFinite(Number(row.cost100k.totalBaseFilled)))
      .slice()
      .sort((a, b) => finiteRank(a.cost100k.rank) - finiteRank(b.cost100k.rank));
    const best = ranked[0] || null;
    if (!best) {
      bestExchange.innerHTML = summary.snapshot && summary.snapshot.cheapestBuy
        ? exchangeNameLinkHtml(summary.snapshot.cheapestBuy.exchangeId, summary.snapshot.cheapestBuy.exchangeLabel, 'market-beginner-exchange-link')
        : 'データ待ち';
      receive.textContent = '実質受取量 -';
      note.textContent = ORDERBOOK_WAITING_MESSAGE;
    } else {
      const cost = best.cost100k;
      const status = cost.executionStatusLabel || '発注可能';
      bestExchange.innerHTML = exchangeNameLinkHtml(best.exchangeId, best.exchangeLabel || best.exchangeId || 'データ待ち', 'market-beginner-exchange-link');
      receive.textContent = `${Fmt.baseCompact(cost.totalBaseFilled)} ${baseCurrency} / 平均 ${fmtJpyPrice(cost.effectiveVWAP)}`;
      note.textContent = `${status}。まずは取引所形式で実質コストを確認すると迷いにくいです。`;
    }

    const sales = bestSalesFromSummary();
    if (sales && sales.salesSpread) {
      const buyPrice = finiteNumber(sales.salesSpread.buyPrice);
      bestSales.innerHTML = exchangeNameLinkHtml(sales.exchangeId, sales.exchangeLabel || sales.exchangeId || 'データ待ち', 'market-beginner-exchange-link');
      salesNote.textContent = buyPrice == null
        ? `スプレッド ${fmtPct(sales.salesSpread.spreadPct)} / 買値は公式画面で確認`
        : `スプレッド ${fmtPct(sales.salesSpread.spreadPct)} / 買 ${fmtJpyPrice(buyPrice)}`;
      if (best) {
        note.textContent = '販売所は簡単ですが、安さ優先なら取引所形式の最安候補から確認してください。';
      }
      return;
    }

    bestSales.innerHTML = summary.snapshot && summary.snapshot.tightestSalesSpread
      ? exchangeNameLinkHtml(summary.snapshot.tightestSalesSpread.exchangeId, summary.snapshot.tightestSalesSpread.exchangeLabel, 'market-beginner-exchange-link')
      : 'データ待ち';
    salesNote.textContent = summary.snapshot && summary.snapshot.tightestSalesSpread
      ? `スプレッド ${fmtPct(summary.snapshot.tightestSalesSpread.spreadPct)}`
      : '販売所データを取得中';
    if (!best) note.textContent = ORDERBOOK_WAITING_MESSAGE;
  }

  function ensureBeginnerTour() {
    let node = document.querySelector('[data-market-beginner-tour]');
    if (node) return node;
    node = document.createElement('div');
    node.className = 'market-beginner-tour';
    node.dataset.marketBeginnerTour = 'true';
    node.hidden = true;
    node.setAttribute('role', 'dialog');
    node.setAttribute('aria-live', 'polite');
    document.body.appendChild(node);
    return node;
  }

  function clearBeginnerTourTarget() {
    document.querySelectorAll('.market-beginner-tour-target').forEach((node) => {
      node.classList.remove('market-beginner-tour-target');
    });
  }

  function visibleTourStep(index) {
    for (let i = index; i < MARKET_BEGINNER_TOUR_STEPS.length; i += 1) {
      const step = MARKET_BEGINNER_TOUR_STEPS[i];
      const target = document.querySelector(step.selector);
      if (!target || target.hidden) continue;
      const style = window.getComputedStyle(target);
      if (style.display === 'none' || style.visibility === 'hidden') continue;
      return { step, index: i, target };
    }
    return null;
  }

  function positionBeginnerTour(node, target) {
    if (!node || !target) return;
    const rect = target.getBoundingClientRect();
    const margin = 12;
    const width = Math.min(330, window.innerWidth - (margin * 2));
    node.style.width = `${width}px`;
    const left = Math.max(margin, Math.min(rect.left + 12, window.innerWidth - width - margin));
    let top = rect.top + Math.min(82, Math.max(12, rect.height * 0.28));
    if (top + node.offsetHeight > window.innerHeight - margin) {
      top = Math.max(margin, rect.bottom - node.offsetHeight - 12);
    }
    node.style.left = `${left}px`;
    node.style.top = `${top}px`;
  }

  function closeBeginnerTour() {
    beginnerTourActive = false;
    beginnerTourIndex = -1;
    clearBeginnerTourTarget();
    const node = document.querySelector('[data-market-beginner-tour]');
    if (node) node.hidden = true;
  }

  function renderBeginnerTourStep(index = beginnerTourIndex) {
    if (!beginnerModeEnabled()) {
      closeBeginnerTour();
      return;
    }
    const match = visibleTourStep(Math.max(0, index));
    if (!match) {
      closeBeginnerTour();
      return;
    }
    beginnerTourIndex = match.index;
    beginnerTourActive = true;
    clearBeginnerTourTarget();
    match.target.classList.add('market-beginner-tour-target');
    match.target.scrollIntoView({ block: 'center', behavior: prefersReducedMotion.matches ? 'auto' : 'smooth' });
    const node = ensureBeginnerTour();
    const isLast = beginnerTourIndex >= MARKET_BEGINNER_TOUR_STEPS.length - 1;
    node.innerHTML = `
      <div class="market-beginner-tour__step">Step ${beginnerTourIndex + 1} / ${MARKET_BEGINNER_TOUR_STEPS.length}</div>
      <strong>${escapeHtml(match.step.title)}</strong>
      <p>${escapeHtml(match.step.body)}</p>
      <div class="market-beginner-tour__actions">
        <button type="button" data-market-tour-close>終了</button>
        <button type="button" data-market-tour-next>${isLast ? '完了' : '次へ'}</button>
      </div>
    `;
    node.hidden = false;
    window.setTimeout(() => positionBeginnerTour(node, match.target), prefersReducedMotion.matches ? 0 : 180);
  }

  function startBeginnerTour() {
    if (!beginnerModeEnabled()) return;
    renderBeginnerTourStep(0);
  }

  function fundingSupportSummary() {
    const exchanges = supportedExchanges();
    const supportedCount = exchanges.filter(exchange => (
      exchange
      && exchange.funding
      && exchange.funding.fiatDeposit
      && exchange.funding.fiatWithdrawal
      && exchange.funding.cryptoDeposit
      && exchange.funding.cryptoWithdrawal
    )).length;
    return {
      exchangeCount: exchanges.length,
      supportedCount,
      summary: supportedCount === exchanges.length && exchanges.length > 0
        ? `${supportedCount}社すべて`
        : `${supportedCount}/${exchanges.length}社`,
      note: 'JPY入出金・暗号資産入出庫は銀行、銘柄、ネットワークごとの条件を公式確認',
    };
  }

  function renderSnapshot(snapshotData) {
    const snapshot = snapshotData && typeof snapshotData === 'object' ? snapshotData : null;
    const defaultExchangeCount = supportedExchanges().length;
    const funding = (snapshot && snapshot.fundingSupport)
      || (summary && summary.domesticComparison && summary.domesticComparison.meta && summary.domesticComparison.meta.fundingSupport)
      || fundingSupportSummary();
    const amount = snapshot && snapshot.comparisonAmount ? Number(snapshot.comparisonAmount.amount) : NaN;
    const freshnessNote = snapshot && snapshot.boardFreshness === 'stale'
      ? '現在は stale 板を含む参考値です'
      : '板は fresh データを優先して集計しています';
    const assumption = Number.isFinite(amount)
      ? `${fmtJpyPrice(amount)}買い / 各取引所既定 taker / ${freshnessNote}`
      : `10万円買い / 各取引所既定 taker / ${freshnessNote}`;
    setText('market-summary-assumption', assumption);

    setSnapshotMetric('exchange-count', `${snapshot && Number.isFinite(Number(snapshot.exchangeCount)) ? Number(snapshot.exchangeCount) : defaultExchangeCount}社`, '国内現物の対応数');
    setSnapshotMetric(
      'best-ask',
      snapshot && snapshot.bestAsk ? fmtJpyPrice(snapshot.bestAsk.price) : 'データ待ち',
      snapshot && snapshot.bestAsk ? snapshot.bestAsk.exchangeLabel : ORDERBOOK_WAITING_MESSAGE,
      { metaExchangeId: snapshot && snapshot.bestAsk ? snapshot.bestAsk.exchangeId : '' }
    );
    setSnapshotMetric(
      'best-bid',
      snapshot && snapshot.bestBid ? fmtJpyPrice(snapshot.bestBid.price) : 'データ待ち',
      snapshot && snapshot.bestBid ? snapshot.bestBid.exchangeLabel : ORDERBOOK_WAITING_MESSAGE,
      { metaExchangeId: snapshot && snapshot.bestBid ? snapshot.bestBid.exchangeId : '' }
    );
    setSnapshotMetric(
      'thickest-book',
      snapshot && snapshot.thickestBook ? snapshot.thickestBook.exchangeLabel : 'データ待ち',
      snapshot && snapshot.thickestBook ? `可視板厚 ${Fmt.jpyLarge(snapshot.thickestBook.visibleDepthJPY)}` : 'Bid + Ask 可視深さ',
      { valueExchangeId: snapshot && snapshot.thickestBook ? snapshot.thickestBook.exchangeId : '' }
    );
    setSnapshotMetric(
      'cheapest-buy',
      snapshot && snapshot.cheapestBuy ? snapshot.cheapestBuy.exchangeLabel : 'データ待ち',
      snapshot && snapshot.cheapestBuy
        ? `${snapshot.cheapestBuy.executionStatusLabel || '参考値'} / 実効VWAP ${fmtJpyPrice(snapshot.cheapestBuy.effectiveVWAP)}`
        : '買い / 100,000円 / 既定手数料',
      { valueExchangeId: snapshot && snapshot.cheapestBuy ? snapshot.cheapestBuy.exchangeId : '' }
    );
    setSnapshotMetric(
      'tightest-sales',
      snapshot && snapshot.tightestSalesSpread ? snapshot.tightestSalesSpread.exchangeLabel : 'データ待ち',
      snapshot && snapshot.tightestSalesSpread ? fmtPct(snapshot.tightestSalesSpread.spreadPct) : '販売所データ待ち',
      { valueExchangeId: snapshot && snapshot.tightestSalesSpread ? snapshot.tightestSalesSpread.exchangeId : '' }
    );
    setSnapshotMetric(
      'funding-support',
      funding ? funding.summary : '公式確認',
      funding ? funding.note : 'JPY入出金・暗号資産入出庫は公式条件確認'
    );
    setSnapshotMetric(
      'top-volume',
      snapshot && snapshot.topVolume ? snapshot.topVolume.exchangeLabel : 'データ待ち',
      snapshot && snapshot.topVolume ? `24h出来高 ${Fmt.jpyLarge(snapshot.topVolume.quoteVolume)}` : '出来高データを取得中です',
      { valueExchangeId: snapshot && snapshot.topVolume ? snapshot.topVolume.exchangeId : '' }
    );
    setConclusionMetric(
      'best-board',
      snapshot && snapshot.cheapestBuy ? snapshot.cheapestBuy.exchangeLabel : 'データ待ち',
      snapshot && snapshot.cheapestBuy
        ? `10万円買い / 実効VWAP ${fmtJpyPrice(snapshot.cheapestBuy.effectiveVWAP)}`
        : `${defaultExchangeCount}社の板を集計`,
      snapshot && snapshot.cheapestBuy ? snapshot.cheapestBuy.exchangeId : ''
    );
    setConclusionMetric(
      'best-sales',
      snapshot && snapshot.tightestSalesSpread ? snapshot.tightestSalesSpread.exchangeLabel : 'データ待ち',
      snapshot && snapshot.tightestSalesSpread ? `販売所スプレッド ${fmtPct(snapshot.tightestSalesSpread.spreadPct)}` : '販売所スプレッドを確認中',
      snapshot && snapshot.tightestSalesSpread ? snapshot.tightestSalesSpread.exchangeId : ''
    );
    setConclusionMetric(
      'top-volume',
      snapshot && snapshot.topVolume ? snapshot.topVolume.exchangeLabel : 'データ待ち',
      snapshot && snapshot.topVolume ? `24h出来高 ${Fmt.jpyLarge(snapshot.topVolume.quoteVolume)}` : '24h売買代金ベース',
      snapshot && snapshot.topVolume ? snapshot.topVolume.exchangeId : ''
    );
    renderMegaSummary(snapshot);
    updatePretradeCta(isPretradeChecklistComplete());
  }

  function fundingLabel(funding) {
    if (!funding) return '公式条件確認';
    const summaryText = funding.summary || 'JPY入出金 / 暗号資産入出庫';
    const statusText = funding.statusLabel || '公式条件確認';
    return `${summaryText} (${statusText})`;
  }

  function fundingCompactHtml(funding) {
    const summary = fundingLabel(funding);
    const status = (funding && funding.statusLabel) || '公式確認';
    const note = (funding && funding.note) || '銀行・銘柄・ネットワーク別の条件は公式確認';
    const fiatReady = Boolean(funding && funding.fiatDeposit && funding.fiatWithdrawal);
    const cryptoReady = Boolean(funding && funding.cryptoDeposit && funding.cryptoWithdrawal);
    return `
      <div class="market-funding-compact" tabindex="0" aria-label="${escapeHtml(`${summary}。${note}`)}">
        <span class="market-funding-chip ${fiatReady ? 'is-ready' : ''}">JPY</span>
        <span class="market-funding-chip ${cryptoReady ? 'is-ready' : ''}">Crypto</span>
        <strong>${escapeHtml(status)}</strong>
        <span class="market-funding-tooltip" role="tooltip">${escapeHtml(summary)}<br>${escapeHtml(note)}</span>
      </div>
    `;
  }

  function renderDomesticComparisonRows() {
    const tbody = $('market-domestic-comparison-tbody');
    if (!tbody) return;
    const domestic = summary && summary.domesticComparison ? summary.domesticComparison : null;
    const rawRows = Array.isArray(domestic && domestic.rows) ? domestic.rows : [];
    const rows = sortDomesticRows(orderRowsForMyExchanges(rawRows));
    const meta = domestic && domestic.meta ? domestic.meta : {};
    const baseCurrency = (summary && summary.market && summary.market.baseCurrency) || instrumentId.split('-')[0] || '';
    const counts = summarizeStatuses(rawRows.map(row => row.orderbook || {}));
    setText(
      'market-domestic-comparison-meta',
      `${marketLabel()} | 10万円買い / ${termText('各取引所既定 taker', '各社の成行手数料')} | 対応 ${meta.exchangeCount || rawRows.length || supportedExchanges().length}社${showOnlyMyExchanges && myExchangeIds.size > 0 ? ` / マイ取引所 ${rows.length}社表示` : ''} | 板 fresh ${counts.fresh || 0}社 / 待機 ${counts.waiting || 0}社`
    );
    syncDomesticSortControls();

    if (rawRows.length === 0) {
      setEmpty('market-domestic-comparison-tbody', 7, '国内取引所比較データを取得中です。');
      return;
    }
    if (rows.length === 0) {
      setEmpty('market-domestic-comparison-tbody', 7, 'マイ取引所に一致する行がありません。選択だけ表示を解除してください。');
      return;
    }

    const readySalesRows = rows.filter(row => row.salesSpread && row.salesSpread.status === 'ready' && Number.isFinite(Number(row.salesSpread.spreadPct)));
    const salesValues = readySalesRows.map(row => Number(row.salesSpread.spreadPct));
    const minSales = salesValues.length > 0 ? Math.min(...salesValues) : null;
    const maxSales = salesValues.length > 0 ? Math.max(...salesValues) : null;
    const readyCostRows = rows.filter(row => row.cost100k && row.cost100k.status === 'fresh' && Number.isFinite(Number(row.cost100k.effectiveVWAP)));
    const costVwapValues = readyCostRows.map(row => Number(row.cost100k.effectiveVWAP));
    const minCostVwap = costVwapValues.length > 0 ? Math.min(...costVwapValues) : null;
    const maxCostVwap = costVwapValues.length > 0 ? Math.max(...costVwapValues) : null;
    const bestSalesIds = bestIds(readySalesRows, row => row.salesSpread.spreadPct, 'min');
    const bestDepthIds = bestIds(rows.filter(row => row.orderbook && (row.orderbook.status === 'fresh' || row.orderbook.status === 'stale')), row => row.orderbook.visibleDepthJPY, 'max');
    const depthRows = rows
      .map(row => row.orderbook || {})
      .filter(orderbook => liveRowStatus(orderbook) === 'fresh' || liveRowStatus(orderbook) === 'stale');
    const visibleDepthValues = depthRows
      .map(orderbook => finiteNumber(visibleDepthFromOrderbook(orderbook)))
      .filter(value => value != null);
    const minVisibleDepth = visibleDepthValues.length > 0 ? Math.min(...visibleDepthValues) : null;
    const maxVisibleDepth = visibleDepthValues.length > 0 ? Math.max(...visibleDepthValues) : null;
    const maxBidDepth = Math.max(0, ...depthRows.map(orderbook => finiteNumber(orderbook.totalBidDepthJPY) || 0));
    const maxAskDepth = Math.max(0, ...depthRows.map(orderbook => finiteNumber(orderbook.totalAskDepthJPY) || 0));

    tbody.innerHTML = rows.map((row) => {
      const rowId = normalizeExchangeId(row.exchangeId);
      const orderbook = row.orderbook || {};
      const orderbookStatus = liveRowStatus(orderbook);
      const hasBook = orderbookStatus === 'fresh' || orderbookStatus === 'stale';
      const cost = row.cost100k || {};
      const costReady = cost.status === 'fresh' && cost.executionStatus && Number.isFinite(Number(cost.totalBaseFilled));
      const sales = row.salesSpread || {};
      const salesReady = sales.status === 'ready' && Number.isFinite(Number(sales.spreadPct));
      const rowClass = [
        mobileExpandedDomesticRows.has(rowId) ? 'is-mobile-expanded' : '',
        cost.rank === 1 && costReady ? 'data-table__row--rank-1' : '',
        isMyExchange(row.exchangeId) ? 'data-table__row--my-exchange' : '',
        orderbookStatus === 'stale' ? 'data-table__row--stale' : '',
        liveFlashClass(row.exchangeId),
      ].filter(Boolean).join(' ');
      const costStatus = costReady
        ? (cost.executionStatusLabel || '参考値')
        : (cost.status === 'stale' ? '板データが古い' : (cost.message || ORDERBOOK_WAITING_MESSAGE));
      const costRisk = costReady && isRiskExecution(cost);
      const isBestSales = bestSalesIds.has(normalizeExchangeId(row.exchangeId));
      const isBestDepth = bestDepthIds.has(normalizeExchangeId(row.exchangeId));
      const costCellClass = [
        costReady && cost.rank === 1 ? 'market-cell-highlight market-cell-highlight--gold' : '',
        costReady ? heatCellClass(cost.effectiveVWAP, minCostVwap, maxCostVwap, 'min') : '',
        costRisk ? 'market-risk-cell' : '',
      ].filter(Boolean).join(' ');
      const depthCellClass = [
        hasBook && isBestDepth ? 'market-cell-highlight market-cell-highlight--green' : '',
        hasBook ? heatCellClass(visibleDepthFromOrderbook(orderbook), minVisibleDepth, maxVisibleDepth, 'max') : '',
      ].filter(Boolean).join(' ');
      const salesCellClass = [
        salesReady && isBestSales ? 'market-cell-highlight market-cell-highlight--green' : '',
        salesReady ? heatCellClass(sales.spreadPct, minSales, maxSales, 'min') : '',
      ].filter(Boolean).join(' ');
      const mobileExpanded = mobileExpandedDomesticRows.has(rowId);
      const visibleDepth = visibleDepthFromOrderbook(orderbook);

      return `
        <tr class="border-b border-gray-800/60 ${rowClass} ${costRisk ? 'data-table__row--risk-warning' : ''}" data-exchange-id="${escapeHtml(rowId)}" data-market-drag-exchange="${escapeHtml(rowId)}" draggable="${isMyExchange(row.exchangeId) ? 'true' : 'false'}">
          <td class="text-left" data-label="対応取引所">
            ${exchangeIdentityHtml(row.exchangeId, row.exchangeLabel || row.exchangeId, `対応銘柄 / ${row.instrumentLabel || instrumentId}`)}
            <button class="market-mobile-row-toggle" type="button" data-market-mobile-row-toggle="${escapeHtml(rowId)}" aria-expanded="${mobileExpanded ? 'true' : 'false'}">
              <span>${mobileExpanded ? '詳細を閉じる' : '詳細を見る'}</span>
            </button>
          </td>
          <td class="is-num text-right font-mono" data-label="${escapeHtml(termText('最良Bid / Ask', '買い手最高値 / 売り手最安値'))}">
            ${hasBook ? `
              <div class="text-green-300">${depthPriceHtml(row.exchangeId, 'bestBid', orderbook.bestBid, 'bid', orderbook.totalBidDepthJPY, maxBidDepth, 'Bid')}</div>
              <div class="text-red-300">${depthPriceHtml(row.exchangeId, 'bestAsk', orderbook.bestAsk, 'ask', orderbook.totalAskDepthJPY, maxAskDepth, 'Ask')}</div>
              <div class="text-[10px] text-gray-500 ${cellFlashClass(row.exchangeId, 'spreadPct')}">Spread ${fmtPct(orderbook.spreadPct)}</div>
              ${freshnessBadgeHtml(orderbookStatus, orderbook)}
            ` : waitingCellHtml(orderbook.message || ORDERBOOK_WAITING_MESSAGE)}
          </td>
          <td class="is-num text-right font-mono market-depth-cell ${depthCellClass} ${cellFlashClass(row.exchangeId, 'visibleDepthJPY')}" style="--depth-cell-width:${depthPct(visibleDepth, maxVisibleDepth)}" data-label="板厚">
            <div class="text-gray-200">${hasBook ? Fmt.jpyLarge(visibleDepth) : waitingCellHtml(orderbook.message || ORDERBOOK_WAITING_MESSAGE)}</div>
            <div class="text-[10px] text-gray-500">${hasBook ? 'Bid + Ask可視深さ' : ''}</div>
            ${hasBook ? depthMiniChartHtml(orderbook) : ''}
            ${hasBook && isBestDepth ? winnerBadge('最大板厚', 'green') : ''}
          </td>
          <td class="is-num text-right font-mono ${costCellClass}" data-label="10万円買い">
            <div class="market-primary-metric ${costReady ? 'text-green-300' : 'text-gray-500'}">${costReady ? `${cost.rank ? `<span class="market-rank-prefix">#${escapeHtml(cost.rank)}</span> ` : ''}${animatedNumberHtml(`domestic:${rowId}:filled`, cost.totalBaseFilled, 'base', baseCurrency)}` : (isLoadingMessage(costStatus) ? waitingCellHtml(costStatus) : '-')}</div>
            ${costReady ? effectiveCostBreakdownHtml({ ...cost, totalBTCFilled: cost.totalBaseFilled }, { compact: true }) : ''}
            ${costReady ? costMetricDetailsHtml({ ...cost, totalBTCFilled: cost.totalBaseFilled }, { keyPrefix: `domestic:${rowId}`, summaryLabel: `${termText('VWAP', '実質購入価格')} / ${termText('Impact', '影響度')}`, includeBreakdown: false }) : `<div class="text-[10px] text-gray-500">${isLoadingMessage(costStatus) ? '' : escapeHtml(costStatus)}</div>`}
            ${costRisk ? `<div class="market-risk-note">${escapeHtml(cost.executionStatusLabel || '自動キャンセル対象')} / Impact ${fmtPct(cost.marketImpactPct)}</div>` : ''}
            ${costReady && cost.rank === 1 ? winnerBadge('最安 Low Cost', 'green') : ''}
            ${costReady && cost.rank === 1 ? exchangeInlineCtaHtml(row.exchangeId, row.exchangeLabel || row.exchangeId, { primary: true, meta: '最安候補' }) : ''}
          </td>
          <td class="is-num text-right font-mono ${salesCellClass}" data-label="販売所Spread">
            ${salesReady ? spreadCostHtml(sales.spreadPct, { min: minSales, max: maxSales, best: isBestSales, copyKey: `domestic:${rowId}:sales-spread` }) : '<div class="text-gray-500">-</div>'}
            <div class="text-[10px] text-gray-500">${salesReady ? `買 ${fmtJpyPrice(sales.buyPrice)} / 売 ${fmtJpyPrice(sales.sellPrice)}` : escapeHtml(sales.message || '販売所データなし')}</div>
          </td>
          <td class="text-left" data-label="入出金対応">
            ${fundingCompactHtml(row.funding)}
          </td>
          <td class="text-right market-action-cell" data-label="アクション">
            ${exchangeActionHtml(row.exchangeId, row.exchangeLabel || row.exchangeId, { primary: costReady && cost.rank === 1 })}
          </td>
        </tr>
      `;
    }).join('');
    animateNumberSpans(tbody);
    renderFloatingMyExchanges();
    renderStickySimulator();
    syncLinkedExchangeHighlight();
  }

  function renderOrderbookRows() {
    const tbody = $('market-orderbook-tbody');
    if (!tbody) return;
    const rawRows = sortedOrderbookRows();
    const rows = orderRowsForMyExchanges(rawRows);
    if (rawRows.length === 0) {
      setEmpty('market-orderbook-tbody', 5, 'この銘柄の板を取得できる取引所がまだありません。');
      return;
    }
    if (rows.length === 0) {
      setEmpty('market-orderbook-tbody', 5, 'マイ取引所に一致する板データがありません。選択だけ表示を解除してください。');
      return;
    }
    const depthRows = rows.filter(row => liveRowStatus(row) === 'fresh' || liveRowStatus(row) === 'stale');
    const maxBidDepth = Math.max(0, ...depthRows.map(row => finiteNumber(row.totalBidDepthJPY) || 0));
    const maxAskDepth = Math.max(0, ...depthRows.map(row => finiteNumber(row.totalAskDepthJPY) || 0));

    tbody.innerHTML = rows.map(row => {
      const status = liveRowStatus(row);
      const hasBook = status === 'fresh' || status === 'stale';
      const rowClass = [
        status === 'stale' ? 'data-table__row--stale' : '',
        isMyExchange(row.exchangeId) ? 'data-table__row--my-exchange' : '',
        liveFlashClass(row.exchangeId),
      ].filter(Boolean).join(' ');
      return `
        <tr class="border-b border-gray-800/60 ${rowClass}" data-exchange-id="${escapeHtml(normalizeExchangeId(row.exchangeId))}" data-market-drag-exchange="${escapeHtml(normalizeExchangeId(row.exchangeId))}" draggable="${isMyExchange(row.exchangeId) ? 'true' : 'false'}">
          <td class="text-left" data-label="取引所">
            ${exchangeIdentityHtml(row.exchangeId, row.exchangeLabel || row.exchangeId, hasBook ? String(row.source || '-').toUpperCase() : (row.message || ORDERBOOK_WAITING_MESSAGE))}
          </td>
          <td class="is-num text-right font-mono text-green-300" data-label="${escapeHtml(termText('Bid', '買い手最高値'))}">${hasBook ? depthPriceHtml(row.exchangeId, 'bestBid', row.bestBid, 'bid', row.totalBidDepthJPY, maxBidDepth, 'Bid') : waitingCellHtml(row.message || ORDERBOOK_WAITING_MESSAGE)}</td>
          <td class="is-num text-right font-mono text-red-300" data-label="${escapeHtml(termText('Ask', '売り手最安値'))}">${hasBook ? depthPriceHtml(row.exchangeId, 'bestAsk', row.bestAsk, 'ask', row.totalAskDepthJPY, maxAskDepth, 'Ask') : waitingCellHtml(row.message || ORDERBOOK_WAITING_MESSAGE)}</td>
          <td class="is-num text-right font-mono text-yellow-300 ${cellFlashClass(row.exchangeId, 'spreadPct')}" data-label="Spread">${hasBook ? fmtPct(row.spreadPct) : waitingCellHtml(row.message || ORDERBOOK_WAITING_MESSAGE)}</td>
          <td class="text-right font-mono text-gray-400" data-label="更新">
            <div>${hasBook ? escapeHtml(updatedAtLabel(row)) : '-'}</div>
            <div class="text-[10px] text-gray-500">${hasBook ? escapeHtml(ageLabel(row)) : escapeHtml(row.message || ORDERBOOK_WAITING_MESSAGE)}</div>
            ${freshnessBadgeHtml(status, row)}
          </td>
        </tr>
      `;
    }).join('');
    syncLinkedExchangeHighlight();
  }

  function renderVolumeRows() {
    const rawRows = ((summary.volume && summary.volume.rows) || [])
      .slice()
      .sort((a, b) => Number(b.quoteVolume || 0) - Number(a.quoteVolume || 0));
    const rows = orderRowsForMyExchanges(rawRows);
    if (rawRows.length === 0) {
      updateVolumeDonutChart([]);
      setEmpty('market-volume-tbody', 4, '出来高データを取得中です。取得でき次第、取引所ごとの流動性を表示します。');
      return;
    }
    if (rows.length === 0) {
      updateVolumeDonutChart([]);
      setEmpty('market-volume-tbody', 4, 'マイ取引所に一致する出来高データがありません。選択だけ表示を解除してください。');
      return;
    }

    const tbody = $('market-volume-tbody');
    updateVolumeDonutChart(rows);
    const topVolumeIds = bestIds(rows, row => row.quoteVolume, 'max');
    tbody.innerHTML = rows.map(row => `
      <tr class="border-b border-gray-800/60 ${isMyExchange(row.exchangeId) ? 'data-table__row--my-exchange' : ''}" data-exchange-id="${escapeHtml(normalizeExchangeId(row.exchangeId))}" data-market-drag-exchange="${escapeHtml(normalizeExchangeId(row.exchangeId))}" draggable="${isMyExchange(row.exchangeId) ? 'true' : 'false'}">
        <td class="font-bold text-gray-200" data-label="取引所">${exchangeIdentityHtml(row.exchangeId, row.exchangeLabel || row.exchangeId)}</td>
        <td class="is-num text-right font-mono text-gray-300" data-label="出来高">${Fmt.jpyLarge(row.quoteVolume)}</td>
        <td class="is-num text-right font-mono" data-label="銘柄内シェア">
          ${shareBarHtml(row.instrumentSharePct, row.exchangeId)}
          ${topVolumeIds.has(normalizeExchangeId(row.exchangeId)) ? winnerBadge('首位', 'green') : ''}
        </td>
        <td class="text-right font-mono text-gray-400" data-label="取得">${fmtDateTime(row.lastFetchedAt || row.capturedAt)}</td>
      </tr>
    `).join('');
    syncLinkedExchangeHighlight();
  }

  function renderSalesRows() {
    const rawRows = ((summary.sales && summary.sales.rows) || [])
      .slice()
      .sort((a, b) => {
        const aPct = a.latest && Number(a.latest.spreadPct);
        const bPct = b.latest && Number(b.latest.spreadPct);
        if (Number.isFinite(aPct) && Number.isFinite(bPct)) return aPct - bPct;
        return String(a.exchangeLabel).localeCompare(String(b.exchangeLabel), 'ja');
      });
    const rows = orderRowsForMyExchanges(rawRows);
    if (rawRows.length === 0) {
      setEmpty('market-sales-tbody', 5, '販売所価格を取得中です。取得できた販売所から順に比較します。');
      return;
    }
    if (rows.length === 0) {
      setEmpty('market-sales-tbody', 5, 'マイ取引所に一致する販売所データがありません。選択だけ表示を解除してください。');
      return;
    }

    const tbody = $('market-sales-tbody');
    const spreadValues = rows
      .map(row => finiteNumber(row.latest && row.latest.spreadPct))
      .filter(value => value != null);
    const minSales = spreadValues.length > 0 ? Math.min(...spreadValues) : null;
    const maxSales = spreadValues.length > 0 ? Math.max(...spreadValues) : null;
    const bestSalesIds = bestIds(rows, row => row.latest && row.latest.spreadPct, 'min');
    tbody.innerHTML = rows.map(row => {
      const latest = row.latest || {};
      const isBestSales = bestSalesIds.has(normalizeExchangeId(row.exchangeId));
      return `
        <tr class="border-b border-gray-800/60 ${isMyExchange(row.exchangeId) ? 'data-table__row--my-exchange' : ''}" data-exchange-id="${escapeHtml(normalizeExchangeId(row.exchangeId))}" data-market-drag-exchange="${escapeHtml(normalizeExchangeId(row.exchangeId))}" draggable="${isMyExchange(row.exchangeId) ? 'true' : 'false'}">
          <td class="font-bold text-gray-200" data-label="販売所">${exchangeIdentityHtml(row.exchangeId, row.exchangeLabel || row.exchangeId)}</td>
          <td class="is-num text-right font-mono text-red-300" data-label="買値">${fmtJpyPrice(latest.buyPrice)}</td>
          <td class="is-num text-right font-mono text-green-300" data-label="売値">${fmtJpyPrice(latest.sellPrice)}</td>
          <td class="is-num text-right font-mono ${isBestSales ? 'market-cell-highlight market-cell-highlight--green' : ''}" data-label="Spread">${spreadCostHtml(latest.spreadPct, { min: minSales, max: maxSales, best: isBestSales })}</td>
          <td class="text-right font-mono text-gray-400" data-label="取得">${fmtDateTime(latest.priceTimestamp || latest.capturedAt)}</td>
        </tr>
      `;
    }).join('');
    syncLinkedExchangeHighlight();
  }

  function comparisonStatusClass(status) {
    return {
      executable: 'text-green-300',
      invalid_constraints: 'text-red-300',
      insufficient_liquidity: 'text-yellow-300',
      auto_cancel: 'text-yellow-300',
      circuit_breaker: 'text-red-300',
    }[status] || 'text-gray-300';
  }

  function comparisonReasonText(result) {
    if (!result) return '';
    const firstBlockingReason = Array.isArray(result.blockingReasons) ? result.blockingReasons[0] : '';
    if (firstBlockingReason) return firstBlockingReason;
    const firstConstraintNote = Array.isArray(result.constraintNotes) ? result.constraintNotes[0] : '';
    if (firstConstraintNote) return firstConstraintNote;
    return result.recommendedAction || '';
  }

  function comparisonAmountLabel(meta) {
    if (!meta) return '-';
    if (meta.amountType === 'jpy') return Fmt.jpy(meta.amount);
    return `${Fmt.baseCompact(meta.amount)} ${(summary && summary.market && summary.market.baseCurrency) || instrumentId.split('-')[0] || ''}`;
  }

  async function loadComparison() {
    const side = $('market-side')?.value === 'sell' ? 'sell' : 'buy';
    const amountType = $('market-amount-type')?.value === 'base' ? 'base' : 'jpy';
    const amount = parseNumberInput($('market-amount')?.value);
    const feeRatePct = readOptionalFeeRatePct($('market-fee-rate'));
    if (comparisonAbortController) {
      comparisonAbortController.abort();
      comparisonAbortController = null;
    }
    if (!Number.isFinite(amount) || amount <= 0 || Number.isNaN(feeRatePct) || (feeRatePct != null && (feeRatePct < 0 || feeRatePct > 100))) {
      lastComparisonData = null;
      setEmpty('market-comparison-tbody', 7, '数量または金額、手数料率を確認してください。');
      renderStickySimulator();
      return;
    }

    const params = new URLSearchParams({
      instrumentId,
      side,
      amountType,
      amount: String(amount),
    });
    if (feeRatePct != null) {
      params.set('feeRate', String(feeRatePct / 100));
    }
    const controller = new AbortController();
    comparisonAbortController = controller;
    try {
      const data = await Api.fetchJson(`/api/market-impact-comparison?${params.toString()}`, {
        signal: controller.signal,
      });
      if (lastComparisonData) animateTableReorder(() => renderComparison(data));
      else renderComparison(data);
    } catch (err) {
      if (err.name === 'AbortError') return;
      lastComparisonData = null;
      setText('market-comparison-meta', '比較データを取得できませんでした。');
      setEmpty('market-comparison-tbody', 7, '比較データを取得できませんでした。時間をおいて再度お試しください。');
      renderStickySimulator();
    } finally {
      if (comparisonAbortController === controller) {
        comparisonAbortController = null;
      }
    }
  }

  function renderComparison(data) {
    lastComparisonData = data && typeof data === 'object' ? data : null;
    const rawRows = Array.isArray(data && data.rows) ? data.rows : [];
    const rows = orderRowsForMyExchanges(rawRows);
    const meta = data.meta || {};
    const counts = summarizeStatuses(rawRows);
    setText('market-comparison-meta', `${marketLabel()} | ${meta.side === 'sell' ? '売り' : '買い'} | ${comparisonAmountLabel(meta)} | ${termText('手数料', '成行手数料')} ${meta.feeRate == null ? termText('各取引所既定', '各社の既定値') : fmtPct(meta.feeRate * 100)}${showOnlyMyExchanges && myExchangeIds.size > 0 ? ` | マイ取引所 ${rows.length}件表示` : ''} | 新鮮 ${counts.fresh || 0}件 / stale ${counts.stale || 0}件 / 待機 ${counts.waiting || 0}件${counts.waiting > 0 ? ` | ${PARTIAL_DATA_FAILURE_MESSAGE}` : ''}`);
    if (rawRows.length === 0) {
      setEmpty('market-comparison-tbody', 7, '比較できる取引所がありません。別の銘柄または条件で確認してください。');
      return;
    }
    if (rows.length === 0) {
      setEmpty('market-comparison-tbody', 7, 'マイ取引所に一致する比較行がありません。選択だけ表示を解除してください。');
      return;
    }

    const isSell = meta.side === 'sell';
    const tbody = $('market-comparison-tbody');
    const fixedQuote = meta.amountType === 'jpy';
    const baseCurrency = (summary && summary.market && summary.market.baseCurrency) || instrumentId.split('-')[0] || '';
    const readyRows = rows.filter(row => liveRowStatus(row) === 'fresh' && row.result && !row.result.error);
    const resultScoreDirection = (!isSell && fixedQuote) ? 'max' : (isSell ? 'max' : 'min');
    const resultScoreValue = (row) => {
      const result = row && row.result;
      if (!result || result.error) return null;
      if (!isSell && fixedQuote) return result.totalBTCFilled;
      return result.effectiveCostJPY;
    };
    const resultScoreValues = readyRows
      .map(resultScoreValue)
      .map(finiteNumber)
      .filter(value => value != null);
    const minResultScore = resultScoreValues.length > 0 ? Math.min(...resultScoreValues) : null;
    const maxResultScore = resultScoreValues.length > 0 ? Math.max(...resultScoreValues) : null;
    const vwapValues = readyRows
      .map(row => finiteNumber(row.result && row.result.effectiveVWAP))
      .filter(value => value != null);
    const minVwap = vwapValues.length > 0 ? Math.min(...vwapValues) : null;
    const maxVwap = vwapValues.length > 0 ? Math.max(...vwapValues) : null;
    const impactValues = readyRows
      .map(row => finiteNumber(row.result && Math.abs(Number(row.result.marketImpactPct))))
      .filter(value => value != null);
    const minImpact = impactValues.length > 0 ? Math.min(...impactValues) : null;
    const maxImpact = impactValues.length > 0 ? Math.max(...impactValues) : null;
    const receiveValues = (!isSell && fixedQuote)
      ? readyRows
        .map(row => finiteNumber(row.result && row.result.totalBTCFilled))
        .filter(value => value != null)
      : [];
    const minReceive = receiveValues.length > 0 ? Math.min(...receiveValues) : null;
    const maxReceive = receiveValues.length > 0 ? Math.max(...receiveValues) : null;
    tbody.innerHTML = rows.map(row => {
      const rowId = normalizeExchangeId(row.exchangeId);
      const result = row.result || null;
      const status = liveRowStatus(row);
      const ready = status === 'fresh' && result && !result.error;
      const value = ready
        ? (fixedQuote
          ? animatedNumberHtml(`comparison:${rowId}:result-base`, result.totalBTCFilled, 'base', (row.baseCurrency || baseCurrency || '').toUpperCase())
          : animatedNumberHtml(`comparison:${rowId}:result-jpy`, result.effectiveCostJPY, 'jpy'))
        : '-';
      const vwap = ready
        ? copyableMetricHtml(`comparison:${rowId}:vwap`, result.effectiveVWAP, 'jpy', '', 'VWAP')
        : '-';
      const statusText = ready
        ? (result.executionStatusLabel || '発注可能')
        : (status === 'stale' ? '板データが古いため比較停止' : (row.message || ORDERBOOK_WAITING_MESSAGE));
      const statusSub = ready
        ? comparisonReasonText(result)
        : (status === 'fresh' || status === 'stale' ? `最終更新 ${ageLabel(row)}` : '');
      const valueClass = ready ? 'text-green-300' : 'text-gray-500';
      const statusClass = ready
        ? comparisonStatusClass(result.executionStatus)
        : (status === 'stale' ? 'text-yellow-300' : 'text-gray-500');
      const resultRisk = ready && isRiskExecution(result);
      const rowClass = [
        'data-table__row--comparison-refresh',
        row.rank === 1 && ready ? 'data-table__row--rank-1' : '',
        isMyExchange(row.exchangeId) ? 'data-table__row--my-exchange' : '',
        status === 'stale' ? 'data-table__row--stale' : '',
        resultRisk ? 'data-table__row--risk-warning' : '',
        liveFlashClass(row.exchangeId),
      ].filter(Boolean).join(' ');
      const resultCellClass = [
        ready && row.rank === 1 ? 'market-cell-highlight market-cell-highlight--gold' : '',
        ready ? heatCellClass(resultScoreValue(row), minResultScore, maxResultScore, resultScoreDirection) : '',
        resultRisk ? 'market-risk-cell' : '',
      ].filter(Boolean).join(' ');
      const vwapCellClass = ready ? heatCellClass(result.effectiveVWAP, minVwap, maxVwap, isSell ? 'max' : 'min') : '';
      const impactCellClass = ready ? heatCellClass(Math.abs(Number(result.marketImpactPct)), minImpact, maxImpact, 'min') : '';
      const receiveYenDelta = ready && fixedQuote && !isSell && maxReceive != null
        ? Math.max(0, (Number(maxReceive) - Number(result.totalBTCFilled)) * Number(result.effectiveVWAP || 0))
        : null;
      return `
        <tr class="border-b border-gray-800/60 ${rowClass}" data-exchange-id="${escapeHtml(rowId)}" data-market-drag-exchange="${escapeHtml(rowId)}" draggable="${isMyExchange(row.exchangeId) ? 'true' : 'false'}">
          <td class="is-num text-right font-mono text-gray-300" data-label="順位">${ready && row.rank ? `#${row.rank}` : '-'}</td>
          <td class="text-left" data-label="取引所">
            ${exchangeIdentityHtml(row.exchangeId, row.exchangeLabel || row.exchangeId, String(row.source || '-').toUpperCase())}
          </td>
          <td class="is-num text-right font-mono ${valueClass} ${resultCellClass}" data-label="結果">
            <div>${ready ? value : (isLoadingMessage(statusText) ? waitingCellHtml(statusText) : value)}</div>
            ${ready && fixedQuote && !isSell ? receiveComparisonBarHtml(result.totalBTCFilled, minReceive, maxReceive, (row.baseCurrency || baseCurrency || '').toUpperCase(), { best: row.rank === 1, yenDelta: receiveYenDelta }) : ''}
            ${ready ? effectiveCostBreakdownHtml(result, { compact: true }) : ''}
            ${ready ? costMetricDetailsHtml(result, { keyPrefix: `comparison:${rowId}:details`, summaryLabel: '手数料・価格差', includeVwap: false, includeImpact: false, includeBreakdown: false }) : ''}
            ${ready && row.rank === 1 ? winnerBadge(isSell ? '売却最良' : '最安 Low Cost', 'green') : ''}
            ${ready && row.rank === 1 ? exchangeInlineCtaHtml(row.exchangeId, row.exchangeLabel || row.exchangeId, { primary: true, meta: isSell ? '売却最良' : '最安候補' }) : ''}
          </td>
          <td class="is-num text-right font-mono text-gray-300 market-soft-metric beginner-optional ${vwapCellClass}" data-label="${termText('VWAP', '実質購入価格')}">${vwap}</td>
          <td class="is-num text-right font-mono text-yellow-300 market-soft-metric beginner-optional ${impactCellClass} ${resultRisk ? 'market-risk-cell' : ''}" data-label="${termText('Impact', '値幅への影響度')}">${ready ? animatedNumberHtml(`comparison:${rowId}:impact`, result.marketImpactPct, 'pct') : '-'}</td>
          <td class="${statusClass} ${resultRisk ? 'market-risk-cell' : ''}" data-label="判定">
            <div class="font-bold">${escapeHtml(statusText)}</div>
            ${statusSub ? `<div class="text-[10px] text-gray-500">${escapeHtml(statusSub)}</div>` : ''}
            ${resultRisk ? `<div class="market-risk-note">${escapeHtml(result.executionStatusLabel || '自動キャンセル対象')} / Impact ${fmtPct(result.marketImpactPct)}</div>` : ''}
            ${freshnessBadgeHtml(status, row)}
          </td>
          <td class="text-right market-action-cell" data-label="アクション">
            ${exchangeActionHtml(row.exchangeId, row.exchangeLabel || row.exchangeId, { primary: ready && row.rank === 1 })}
          </td>
        </tr>
      `;
    }).join('');
    animateNumberSpans(tbody);
    renderStickySimulator();
    syncLinkedExchangeHighlight();
  }

  function renderSummary(data) {
    markSummaryCellChanges(summary, data);
    summary = data;
    summaryLoadedAt = Date.now();
    updatePageLabels();
    updateFeePresetHint();
    populateBoardExchangeSelect();
    renderSnapshot(summary && summary.snapshot);
    renderHero();
    renderExchangePreferences();
    renderDomesticComparisonRows();
    renderOrderbookRows();
    renderVolumeRows();
    renderSalesRows();
    renderBeginnerSimpleCard();
    updateFreshnessProgress();
    syncQuickAmountButtons();
    renderStickySimulator();
    connectSelectedOrderbook();
  }

  async function loadSummary() {
    if (summaryAbortController) {
      summaryAbortController.abort();
      summaryAbortController = null;
    }
    const controller = new AbortController();
    summaryAbortController = controller;
    try {
      const data = await Api.fetchJson(`/api/markets/${encodeURIComponent(instrumentId)}`, {
        signal: controller.signal,
      });
      renderSummary(data);
      void loadComparison();
    } catch (err) {
      if (err.name === 'AbortError') return;
      setText('market-status', '取得できませんでした');
      setText('market-hero-meta', '銘柄データを取得できませんでした。時間をおいて再読み込みしてください。');
    } finally {
      if (summaryAbortController === controller) {
        summaryAbortController = null;
      }
    }
  }

  const summaryRefreshTask = pagePoller.createTask({
    intervalMs: SUMMARY_REFRESH_MS,
    callback: loadSummary,
  });

  const freshnessTask = pagePoller.createTask({
    intervalMs: 1000,
    callback: () => {
      if (summary) {
        renderHero();
        renderDomesticComparisonRows();
        renderOrderbookRows();
        updateSelectedOrderbookMeta();
        renderBeginnerSimpleCard();
      }
      updateFreshnessProgress();
      if (lastComparisonData) renderComparison(lastComparisonData);
    },
  });

  const boardSelect = $('market-board-exchange');
  if (boardSelect) {
    boardSelect.addEventListener('change', () => {
      selectedExchangeId = boardSelect.value;
      lastSelectedDepthData = null;
      lastSelectedMidPrice = null;
      renderOrderbookLadder();
      connectSelectedOrderbook();
    });
  }

  document.querySelectorAll('[data-market-orderbook-view]').forEach((button) => {
    button.addEventListener('click', () => {
      setOrderbookViewMode(button.dataset.marketOrderbookView);
    });
  });

  ['market-side', 'market-amount-type', 'market-amount', 'market-fee-rate'].forEach((id) => {
    const el = $(id);
    if (!el) return;
    const eventName = el.tagName === 'SELECT' ? 'change' : 'input';
    el.addEventListener(eventName, () => {
      if (id === 'market-fee-rate') updateFeePresetHint();
      if (id === 'market-amount-type') syncAmountTypeToggle();
      syncQuickAmountButtons();
      if (comparisonTimer) clearTimeout(comparisonTimer);
      comparisonTimer = setTimeout(loadComparison, 250);
    });
  });

  document.querySelectorAll('[data-market-quick-amount]').forEach((button) => {
    button.addEventListener('click', () => {
      const value = Number(button.dataset.marketQuickAmount);
      if (!Number.isFinite(value)) return;
      button.classList.remove('market-quick-amount--pulse');
      void button.offsetWidth;
      button.classList.add('market-quick-amount--pulse');
      setQuickAmount(value);
    });
  });

  const amountRange = $('market-amount-range');
  if (amountRange) {
    amountRange.addEventListener('input', () => {
      setAmountFromRange(amountRange.value);
    });
  }

  document.querySelectorAll('[data-market-amount-step]').forEach((button) => {
    button.addEventListener('click', () => {
      stepAmountRange(Number(button.dataset.marketAmountStep));
    });
  });

  document.addEventListener('click', (event) => {
    const tourNext = event.target && event.target.closest ? event.target.closest('[data-market-tour-next]') : null;
    if (tourNext) {
      event.preventDefault();
      if (beginnerTourIndex >= MARKET_BEGINNER_TOUR_STEPS.length - 1) closeBeginnerTour();
      else renderBeginnerTourStep(beginnerTourIndex + 1);
      return;
    }
    const tourClose = event.target && event.target.closest ? event.target.closest('[data-market-tour-close]') : null;
    if (tourClose) {
      event.preventDefault();
      closeBeginnerTour();
      return;
    }
    const sortButton = event.target && event.target.closest ? event.target.closest('[data-market-domestic-sort]') : null;
    if (sortButton) {
      event.preventDefault();
      const key = sortButton.dataset.marketDomesticSort || 'cost';
      if (domesticSortState.key === key) {
        domesticSortState.direction = domesticSortState.direction === 'asc' ? 'desc' : 'asc';
      } else {
        domesticSortState.key = key;
        domesticSortState.direction = domesticSortDefaultDirection(key);
      }
      animateTableReorder(renderDomesticComparisonRows);
      return;
    }
    const mobileRowToggle = event.target && event.target.closest ? event.target.closest('[data-market-mobile-row-toggle]') : null;
    if (mobileRowToggle) {
      event.preventDefault();
      event.stopPropagation();
      const rowId = normalizeExchangeId(mobileRowToggle.dataset.marketMobileRowToggle);
      if (!rowId) return;
      if (mobileExpandedDomesticRows.has(rowId)) mobileExpandedDomesticRows.delete(rowId);
      else mobileExpandedDomesticRows.add(rowId);
      renderDomesticComparisonRows();
      return;
    }
    const copyButton = event.target && event.target.closest ? event.target.closest('[data-market-copy-value]') : null;
    if (copyButton) {
      event.preventDefault();
      event.stopPropagation();
      const value = copyButton.dataset.marketCopyValue;
      const label = copyButton.dataset.marketCopyLabel || '値';
      copyMarketValue(value, label).catch(() => {
        showCopyToast(label, { error: true });
      });
      return;
    }
    const stickyAmountButton = event.target && event.target.closest ? event.target.closest('[data-market-sticky-amount]') : null;
    if (stickyAmountButton) {
      event.preventDefault();
      const value = Number(stickyAmountButton.dataset.marketStickyAmount);
      if (Number.isFinite(value)) setQuickAmount(value);
      return;
    }
    const refreshButton = event.target && event.target.closest ? event.target.closest('[data-market-refresh]') : null;
    if (refreshButton) {
      event.preventDefault();
      void loadSummary();
      return;
    }
    const disabledCta = event.target && event.target.closest ? event.target.closest('.market-pretrade-ready__cta[aria-disabled="true"]') : null;
    if (disabledCta) {
      event.preventDefault();
      return;
    }
    const button = event.target && event.target.closest ? event.target.closest('[data-market-star-exchange]') : null;
    if (!button) return;
    event.preventDefault();
    event.stopPropagation();
    const id = normalizeExchangeId(button.dataset.marketStarExchange);
    if (!id) return;
    if (myExchangeIds.has(id)) myExchangeIds.delete(id);
    else myExchangeIds.add(id);
    writeStoredExchangeSet(myExchangeIds);
    if (myExchangeIds.size === 0) {
      showOnlyMyExchanges = false;
      writeStoredBoolean(MY_EXCHANGES_ONLY_STORAGE_KEY, false);
    }
    animateTableReorder(rerenderMarketTables);
  });

  const preferenceHost = $('market-exchange-preferences');
  if (preferenceHost) {
    preferenceHost.addEventListener('change', (event) => {
      const input = event.target && event.target.closest ? event.target.closest('[data-market-my-exchange]') : null;
      if (!input) return;
      const id = normalizeExchangeId(input.value);
      if (!id) return;
      if (input.checked) myExchangeIds.add(id);
      else myExchangeIds.delete(id);
      writeStoredExchangeSet(myExchangeIds);
      if (myExchangeIds.size === 0) {
        showOnlyMyExchanges = false;
        writeStoredBoolean(MY_EXCHANGES_ONLY_STORAGE_KEY, false);
      }
      animateTableReorder(rerenderMarketTables);
    });
    preferenceHost.addEventListener('click', (event) => {
      const target = event.target && event.target.closest ? event.target : null;
      if (!target) return;
      const onlyButton = target.closest('[data-market-my-only]');
      const clearButton = target.closest('[data-market-my-clear]');
      if (onlyButton) {
        showOnlyMyExchanges = !showOnlyMyExchanges;
        writeStoredBoolean(MY_EXCHANGES_ONLY_STORAGE_KEY, showOnlyMyExchanges);
        animateTableReorder(rerenderMarketTables);
      } else if (clearButton) {
        myExchangeIds = new Set();
        showOnlyMyExchanges = false;
        writeStoredExchangeSet(myExchangeIds);
        writeStoredBoolean(MY_EXCHANGES_ONLY_STORAGE_KEY, false);
        animateTableReorder(rerenderMarketTables);
      }
    });
  }

  window.addEventListener('okj:beginner-mode-change', (event) => {
    updateFeePresetHint();
    rerenderMarketTables();
    renderBeginnerSimpleCard();
    syncBeginnerCollapses();
    if (event.detail && event.detail.enabled) {
      window.setTimeout(startBeginnerTour, 120);
    } else {
      closeBeginnerTour();
    }
  });

  window.addEventListener('scroll', syncStickySimulatorVisibility, { passive: true });
  window.addEventListener('resize', syncStickySimulatorVisibility);
  window.addEventListener('resize', () => {
    if (!beginnerTourActive) return;
    const match = visibleTourStep(beginnerTourIndex);
    const node = document.querySelector('[data-market-beginner-tour]');
    if (match && node && !node.hidden) positionBeginnerTour(node, match.target);
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && beginnerTourActive) closeBeginnerTour();
  });

  ws.on('connected', () => {
    connectSelectedOrderbook();
  });
  ws.on('orderbook', (data) => {
    if (!data || data.instrumentId !== instrumentId || data.exchangeId !== selectedExchangeId) return;
    markExchangeUpdated(data.exchangeId);
    if (summary && Array.isArray(summary.orderbooks)) {
      const index = summary.orderbooks.findIndex(row => row.exchangeId === data.exchangeId && row.instrumentId === data.instrumentId);
      if (index >= 0) {
        markOrderbookCellChanges(data.exchangeId, summary.orderbooks[index], data);
        summary.orderbooks[index] = {
          ...summary.orderbooks[index],
          ...data,
          exchangeLabel: summary.orderbooks[index].exchangeLabel || data.exchange?.label || data.exchangeId,
          instrumentLabel: summary.orderbooks[index].instrumentLabel || data.market?.label || data.instrumentId,
          status: 'fresh',
          freshnessStatus: 'fresh',
          message: null,
        };
      }
      const domesticRows = summary.domesticComparison && Array.isArray(summary.domesticComparison.rows)
        ? summary.domesticComparison.rows
        : [];
      const domesticRow = domesticRows.find(row => row.exchangeId === data.exchangeId && row.instrumentId === data.instrumentId);
      if (domesticRow) {
        markOrderbookCellChanges(data.exchangeId, domesticRow.orderbook, data);
        domesticRow.orderbook = {
          ...domesticRow.orderbook,
          status: 'fresh',
          message: null,
          bestBid: data.bestBid,
          bestAsk: data.bestAsk,
          spreadPct: data.spreadPct,
          totalAskDepthJPY: data.totalAskDepthJPY,
          totalBidDepthJPY: data.totalBidDepthJPY,
          visibleDepthJPY: Number(data.totalAskDepthJPY || 0) + Number(data.totalBidDepthJPY || 0),
          updatedAt: data.updatedAt || data.timestamp || data.receivedAt || null,
          staleAfterMs: data.staleAfterMs || null,
          source: data.source || null,
        };
      }
    }
    updateSelectedOrderbookMeta();
    setChartBaseCurrency(data.market?.baseCurrency || (summary.market && summary.market.baseCurrency) || 'BTC');
    updateDepthChart(data.depthChart, data.midPrice);
    lastSelectedDepthData = data.depthChart || null;
    lastSelectedMidPrice = finiteNumber(data.midPrice);
    renderOrderbookLadder();
    if (summary) {
      renderHero();
      renderDomesticComparisonRows();
      renderOrderbookRows();
      renderBeginnerSimpleCard();
    }
  });

  initThemeToggle();
  initPairSwitcher();
  initSectionNavigation();
  initIntentNavigation();
  initReadmoreSections();
  initBeginnerCollapses();
  initAmountTypeToggle();
  initExchangeDragSorting();
  initExchangeCrossHighlight();
  initPretradeChecklist();
  initDepthChart();
  initVolumeDonutChart();
  updateFeePresetHint();
  syncAmountRange();
  setOrderbookViewMode(orderbookViewMode);
  if (beginnerModeEnabled()) window.setTimeout(startBeginnerTour, 420);
  loadSummary();
  ws.connect();
  summaryRefreshTask.start({ immediate: false });
  freshnessTask.start({ immediate: false });
  window.addEventListener('beforeunload', () => {
    pagePoller.dispose();
    if (comparisonTimer) clearTimeout(comparisonTimer);
    if (summaryAbortController) summaryAbortController.abort();
    if (comparisonAbortController) comparisonAbortController.abort();
  });
});
