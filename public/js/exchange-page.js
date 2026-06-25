(function () {
  'use strict';

  const root = document.querySelector('[data-exchange-page]');
  if (!root) return;

  const exchangeId = String(root.getAttribute('data-exchange-id') || '').trim();
  const instrumentId = String(root.getAttribute('data-default-instrument-id') || '').trim();

  const waitingClass = 'is-waiting';
  const staleClass = 'is-stale';
  const errorClass = 'is-error';
  const refreshIntervalMs = 10000;
  const costDebounceMs = 220;
  const slotCostFields = new Set([
    'salesReceive',
    'boardReceive',
    'deltaJpy',
    'deltaBase',
    'salesBarLabel',
    'boardBarLabel',
    'proAmount',
    'proSalesSpread',
    'proImpact',
    'proFee',
  ]);
  const slotTimers = new WeakMap();
  let latestReport = null;
  let latestExchangeRow = null;
  let refreshTimeoutId = null;
  let countdownIntervalId = null;
  let nextRefreshAt = 0;
  let lastUpdateLabel = '-';
  let lastMarketApiLatencyMs = null;
  let latestBoardSpreadPct = null;
  let latestSalesSpreadPct = null;

  function numberOrNull(value) {
    if (value == null || value === '') return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  function priceDecimals(value) {
    const abs = Math.abs(Number(value));
    if (!Number.isFinite(abs)) return 0;
    if (abs >= 1000) return 0;
    if (abs >= 100) return 1;
    if (abs >= 1) return 2;
    return 4;
  }

  function formatJpyPrice(value) {
    const numeric = numberOrNull(value);
    if (numeric == null) return '-';
    return new Intl.NumberFormat('ja-JP', {
      style: 'currency',
      currency: 'JPY',
      maximumFractionDigits: priceDecimals(numeric),
    }).format(numeric);
  }

  function formatJpyCompact(value) {
    const numeric = numberOrNull(value);
    if (numeric == null) return '-';
    const compact = new Intl.NumberFormat('ja-JP', {
      notation: 'compact',
      maximumFractionDigits: Math.abs(numeric) >= 1e8 ? 1 : 0,
    }).format(numeric);
    return `¥${compact}`;
  }

  function formatJpyAmount(value) {
    const numeric = numberOrNull(value);
    if (numeric == null) return '-';
    return new Intl.NumberFormat('ja-JP', {
      style: 'currency',
      currency: 'JPY',
      maximumFractionDigits: 0,
    }).format(numeric);
  }

  function formatBaseAmount(value, currency) {
    const numeric = numberOrNull(value);
    if (numeric == null) return '-';
    const decimals = Math.abs(numeric) >= 1 ? 5 : 8;
    return `${new Intl.NumberFormat('ja-JP', {
      maximumFractionDigits: decimals,
    }).format(numeric)} ${currency || 'BTC'}`;
  }

  function formatSignedBaseAmount(value, currency) {
    const numeric = numberOrNull(value);
    if (numeric == null) return '-';
    const sign = numeric > 0 ? '+' : '';
    return `${sign}${formatBaseAmount(numeric, currency)}`;
  }

  function formatSignedJpy(value) {
    const numeric = numberOrNull(value);
    if (numeric == null) return '-';
    const sign = numeric > 0 ? '+' : '';
    return `${sign}${formatJpyAmount(numeric)}`;
  }

  function formatPct(value, decimals = 3) {
    const numeric = numberOrNull(value);
    if (numeric == null) return '-';
    return `${numeric.toFixed(decimals)}%`;
  }

  function formatDateTime(value) {
    const date = value ? new Date(value) : null;
    if (!date || Number.isNaN(date.getTime())) return '-';
    return new Intl.DateTimeFormat('ja-JP', {
      month: 'numeric',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  }

  function nowMs() {
    return window.performance && typeof window.performance.now === 'function'
      ? window.performance.now()
      : Date.now();
  }

  function formatLatencyMs(value) {
    const numeric = numberOrNull(value);
    if (numeric == null) return '-';
    if (numeric < 1000) return `${Math.max(0, Math.round(numeric))}ms`;
    return `${(numeric / 1000).toFixed(numeric < 10000 ? 1 : 0)}s`;
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, char => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    }[char]));
  }

  function setLiveField(field, text, state) {
    document.querySelectorAll(`[data-exchange-live-field="${field}"]`).forEach((node) => {
      const label = node.querySelector('[data-exchange-refresh-label]');
      const previous = label ? label.textContent : node.textContent;
      if (label) label.textContent = text;
      else node.textContent = text;
      node.classList.toggle(waitingClass, state === 'waiting');
      node.classList.toggle(staleClass, state === 'stale');
      node.classList.toggle(errorClass, state === 'error');
      node.setAttribute('data-state', state || 'ready');
      if (previous && previous !== text && state !== 'waiting') {
        node.classList.remove('is-live-tick');
        void node.offsetWidth;
        node.classList.add('is-live-tick');
      }
    });
  }

  function setText(selector, text) {
    document.querySelectorAll(selector).forEach((node) => {
      node.textContent = text;
    });
  }

  function setDataField(rootNode, field, text) {
    if (!rootNode) return;
    const nextText = String(text == null ? '' : text);
    rootNode.querySelectorAll(`[data-cost-field="${field}"]`).forEach((node) => {
      const previous = node.textContent;
      const shouldSlot = slotCostFields.has(field)
        && previous
        && previous !== nextText
        && !/待ち|計算中|確認中|失敗/.test(previous)
        && !/待ち|計算中|確認中|失敗/.test(nextText);
      node.classList.toggle('is-slot-number', slotCostFields.has(field));
      if (shouldSlot) {
        node.dataset.slotPrev = previous;
        node.dataset.slotNext = nextText;
        node.classList.remove('is-slotting');
        void node.offsetWidth;
        node.classList.add('is-slotting');
        window.clearTimeout(slotTimers.get(node));
        slotTimers.set(node, window.setTimeout(() => {
          node.classList.remove('is-slotting');
        }, 460));
      }
      node.textContent = nextText;
      node.classList.remove('is-live-tick');
      void node.offsetWidth;
      node.classList.add('is-live-tick');
    });
  }

  function setStickyField(field, text, tone) {
    document.querySelectorAll(`[data-exchange-sticky-field="${field}"]`).forEach((node) => {
      const nextText = String(text == null ? '' : text);
      const previous = node.textContent;
      node.textContent = nextText;
      if (tone) node.dataset.tone = tone;
      else delete node.dataset.tone;
      if (previous && previous !== nextText) {
        node.classList.remove('is-live-tick');
        void node.offsetWidth;
        node.classList.add('is-live-tick');
      }
    });
  }

  function setMetaField(field, text, tone) {
    document.querySelectorAll(`[data-exchange-meta-field="${field}"]`).forEach((node) => {
      const nextText = String(text == null ? '' : text);
      const previous = node.textContent;
      node.textContent = nextText;
      if (tone) node.dataset.tone = tone;
      else delete node.dataset.tone;
      if (previous && previous !== nextText) {
        node.classList.remove('is-live-tick');
        void node.offsetWidth;
        node.classList.add('is-live-tick');
      }
    });
  }

  function updateStickySpread() {
    const text = [
      latestSalesSpreadPct != null ? `販売所 ${formatPct(latestSalesSpreadPct, 2)}` : '',
      latestBoardSpreadPct != null ? `板 ${formatPct(latestBoardSpreadPct, 3)}` : '',
    ].filter(Boolean).join(' / ') || '比較待ち';
    const tone = latestSalesSpreadPct == null
      ? (latestBoardSpreadPct != null && latestBoardSpreadPct < 0.1 ? 'calm' : 'neutral')
      : (latestSalesSpreadPct <= 3 ? 'calm' : 'warning');
    setStickyField('spread', text, tone);
  }

  function clampPercent(value) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return 0;
    return Math.max(0, Math.min(100, numeric));
  }

  function impactGaugePercent(value) {
    const impact = numberOrNull(value);
    if (impact == null) return 0;
    return clampPercent(Math.max(4, impact * 100));
  }

  function impactTone(value) {
    const impact = numberOrNull(value);
    if (impact == null) return 'neutral';
    if (impact >= 1) return 'danger';
    if (impact >= 0.35) return 'warning';
    return 'calm';
  }

  function depthGaugePercent(value) {
    const depth = numberOrNull(value);
    if (depth == null || depth <= 0) return 0;
    return clampPercent(Math.max(6, (depth / 1000000000) * 100));
  }

  function depthTone(value) {
    const depth = numberOrNull(value);
    if (depth == null || depth <= 0) return 'neutral';
    if (depth >= 100000000) return 'calm';
    if (depth >= 10000000) return 'warning';
    return 'danger';
  }

  function setGaugeField(field, options = {}) {
    document.querySelectorAll(`[data-exchange-gauge-field="${field}"]`).forEach((node) => {
      const valueNode = node.querySelector('[data-exchange-gauge-value]');
      const fillNode = node.querySelector('[data-exchange-gauge-fill]');
      const state = options.state || 'ready';
      const tone = options.tone || 'neutral';
      if (valueNode) valueNode.textContent = options.value || 'データ待ち';
      if (fillNode) fillNode.style.width = `${clampPercent(options.percent).toFixed(2)}%`;
      node.classList.toggle(waitingClass, state === 'waiting');
      node.classList.toggle(staleClass, state === 'stale');
      node.classList.toggle(errorClass, state === 'error');
      node.dataset.state = state;
      node.dataset.tone = tone;
      node.setAttribute('aria-label', `${node.querySelector('.exchange-visual-meter__topline span')?.textContent || field}: ${options.value || 'データ待ち'}`);
    });
  }

  function tabForHash(hash) {
    if (!hash || hash.length < 2) return null;
    const target = document.querySelector(hash);
    return target ? target.getAttribute('data-exchange-tab-panel') : null;
  }

  function initTabs() {
    const buttons = Array.from(document.querySelectorAll('[data-exchange-tab]'));
    const panels = Array.from(document.querySelectorAll('[data-exchange-tab-panel]'));
    if (buttons.length === 0 || panels.length === 0) return;

    function activate(tab) {
      const nextTab = buttons.some(button => button.getAttribute('data-exchange-tab') === tab) ? tab : 'simple';
      buttons.forEach((button) => {
        const active = button.getAttribute('data-exchange-tab') === nextTab;
        button.classList.toggle('is-active', active);
        button.setAttribute('aria-selected', active ? 'true' : 'false');
      });
      panels.forEach((panel) => {
        panel.hidden = panel.getAttribute('data-exchange-tab-panel') !== nextTab;
      });
    }

    function setActiveNavLink(hash) {
      const links = Array.from(document.querySelectorAll('.exchange-sticky-nav__links a[href^="#"]'));
      links.forEach((link) => {
        const active = Boolean(hash) && link.getAttribute('href') === hash;
        link.classList.toggle('is-active', active);
        if (active) link.setAttribute('aria-current', 'true');
        else link.removeAttribute('aria-current');
      });
    }

    buttons.forEach((button) => {
      button.addEventListener('click', () => activate(button.getAttribute('data-exchange-tab')));
    });

    document.addEventListener('click', (event) => {
      const link = event.target.closest('a[href^="#"]');
      if (!link) return;
      const tab = tabForHash(link.getAttribute('href'));
      if (tab) activate(tab);
      setActiveNavLink(link.getAttribute('href'));
    });

    window.addEventListener('hashchange', () => {
      const tab = tabForHash(window.location.hash);
      if (tab) activate(tab);
      setActiveNavLink(window.location.hash);
    });

    activate(tabForHash(window.location.hash) || 'simple');
    setActiveNavLink(window.location.hash);
  }

  function initStickyNavProgress() {
    const progressNode = document.querySelector('[data-exchange-scroll-progress]');
    const links = Array.from(document.querySelectorAll('.exchange-sticky-nav__links a[href^="#"]'));
    if (!progressNode && links.length === 0) return;

    function sectionForLink(link) {
      const hash = link.getAttribute('href');
      if (!hash || hash.length < 2) return null;
      try {
        return document.querySelector(hash);
      } catch (_err) {
        return null;
      }
    }

    function sync() {
      if (progressNode) {
        const maxScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
        const percent = clampPercent((window.scrollY / maxScroll) * 100);
        progressNode.style.width = `${percent.toFixed(2)}%`;
      }

      const visibleSections = links
        .map(link => ({ link, section: sectionForLink(link) }))
        .filter(item => item.section && !item.section.hidden && item.section.offsetParent !== null);
      if (visibleSections.length === 0) return;

      const anchorY = window.scrollY + 132;
      let active = visibleSections[0];
      visibleSections.forEach((item) => {
        if (item.section.offsetTop <= anchorY) active = item;
      });

      links.forEach((link) => {
        const isActive = link === active.link;
        link.classList.toggle('is-active', isActive);
        if (isActive) link.setAttribute('aria-current', 'true');
        else link.removeAttribute('aria-current');
      });
    }

    window.addEventListener('scroll', sync, { passive: true });
    window.addEventListener('resize', sync);
    document.addEventListener('click', (event) => {
      if (event.target.closest('.exchange-sticky-nav__links a[href^="#"], .exchange-mobile-tabbar a[href^="#"]')) {
        window.setTimeout(sync, 180);
      }
    });
    sync();
  }

  function initCoverageTool() {
    const tool = document.querySelector('[data-exchange-coverage-tool]');
    const dataNode = document.getElementById('exchange-coverage-data');
    if (!tool || !dataNode) return;

    let markets = [];
    try {
      markets = JSON.parse(dataNode.textContent || '[]');
    } catch (_err) {
      markets = [];
    }
    if (!Array.isArray(markets) || markets.length === 0) return;

    const search = tool.querySelector('[data-exchange-coverage-search]');
    const resultNode = tool.querySelector('[data-exchange-coverage-results]');
    const countNode = tool.querySelector('[data-exchange-coverage-count]');
    const showAllButton = tool.querySelector('[data-exchange-coverage-show-all]');
    const detailNode = tool.querySelector('[data-exchange-coverage-detail]');
    const filters = Array.from(tool.querySelectorAll('[data-exchange-coverage-filter]'));
    const tagButtons = Array.from(tool.querySelectorAll('[data-exchange-coverage-tag]'));
    const activeFilters = new Set();
    const activeTags = new Set();
    let query = '';
    let showAll = false;
    let selectedInstrumentId = null;

    function marketHref(market) {
      if (market.href) return market.href;
      const encodedInstrumentId = encodeURIComponent(market.instrumentId || '');
      if (market.hasBoard) {
        return `/simulator?exchange=${encodeURIComponent(exchangeId)}&market=${encodedInstrumentId}`;
      }
      return `/sales-spread?instrumentId=${encodedInstrumentId}`;
    }

    function marketToken(value) {
      return String(value || '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '') || 'asset';
    }

    function assetMarkHtml(market) {
      const symbol = String(market.baseCurrency || (market.instrumentId || '').split('-')[0] || '?').toUpperCase();
      const label = symbol.slice(0, 4);
      return `<span class="market-asset-mark market-asset-mark--xs market-asset-mark--${escapeHtml(marketToken(symbol))}" aria-hidden="true">${escapeHtml(label)}</span>`;
    }

    function matchesFilter(market) {
      if (activeFilters.has('board') && !market.hasBoard) return false;
      if (activeFilters.has('sales') && !market.hasSales) return false;
      if (activeFilters.has('spread') && !market.hasSpread) return false;
      return true;
    }

    function matchesTags(market) {
      if (activeTags.size === 0) return true;
      const tags = Array.isArray(market.tags) ? market.tags : [];
      return tags.some(tag => activeTags.has(tag));
    }

    function matchesQuery(market) {
      if (!query) return true;
      const haystack = `${market.label || ''} ${market.instrumentId || ''}`.toLowerCase();
      return haystack.includes(query);
    }

    function tagLabel(tag) {
      return {
        major3: '主要3銘柄',
        staking: 'ステーキング候補',
        l1l2: 'L1/L2',
        meme: 'ミーム',
      }[tag] || tag;
    }

    function statusPill(label, active) {
      return `<span class="${active ? 'is-supported' : 'is-muted'}">${escapeHtml(label)}</span>`;
    }

    function renderCoverageDetail(market) {
      if (!detailNode || !market) return;
      const tags = Array.isArray(market.tags) ? market.tags : [];
      const boardHref = market.hasBoard
        ? `/simulator?exchange=${encodeURIComponent(exchangeId)}&market=${encodeURIComponent(market.instrumentId || '')}`
        : null;
      const salesHref = `/sales-spread?instrumentId=${encodeURIComponent(market.instrumentId || '')}`;
      detailNode.hidden = false;
      detailNode.innerHTML = [
        '<div class="exchange-coverage-detail__header">',
        '  <div>',
        `    <span>${escapeHtml(market.instrumentId || '')}</span>`,
        `    <strong>${escapeHtml(market.label || market.instrumentId)}</strong>`,
        '  </div>',
        '  <button type="button" data-exchange-coverage-detail-close aria-label="詳細を閉じる">x</button>',
        '</div>',
        '<div class="exchange-coverage-detail__status">',
        statusPill('板取引', market.hasBoard),
        statusPill('販売所', market.hasSales),
        statusPill('スプレッド取得', market.hasSpread),
        '</div>',
        tags.length > 0
          ? `<div class="exchange-coverage-detail__tags">${tags.map(tag => `<span>${escapeHtml(tagLabel(tag))}</span>`).join('')}</div>`
          : '',
        '<div class="exchange-coverage-detail__actions">',
        boardHref ? `<a href="${escapeHtml(boardHref)}">板シミュレーター</a>` : '',
        `<a href="${escapeHtml(salesHref)}">販売所スプレッド</a>`,
        '</div>',
      ].filter(Boolean).join('');

      const closeButton = detailNode.querySelector('[data-exchange-coverage-detail-close]');
      if (closeButton) {
        closeButton.addEventListener('click', () => {
          selectedInstrumentId = null;
          detailNode.hidden = true;
          detailNode.innerHTML = '';
          resultNode.querySelectorAll('[data-exchange-coverage-market]').forEach((button) => {
            button.classList.remove('is-selected');
            button.setAttribute('aria-pressed', 'false');
          });
        });
      }
    }

    function renderMarket(market) {
      const badges = [
        market.hasBoard ? '<span>板</span>' : '',
        market.hasSales ? '<span>販売所</span>' : '',
        market.hasSpread ? '<span>スプレッド</span>' : '',
      ].filter(Boolean).join('');
      const selected = selectedInstrumentId === market.instrumentId;
      return [
        `<button class="exchange-coverage-chip${selected ? ' is-selected' : ''}" type="button" data-exchange-coverage-market="${escapeHtml(market.instrumentId || '')}" aria-pressed="${selected ? 'true' : 'false'}">`,
        `  ${assetMarkHtml(market)}`,
        '  <span class="exchange-coverage-chip__body">',
        `    <strong>${escapeHtml(market.label || market.instrumentId)}</strong>`,
        `    <small>${escapeHtml(market.instrumentId)}</small>`,
        `    <span class="exchange-coverage-chip__badges">${badges}</span>`,
        '  </span>',
        '</button>',
      ].join('');
    }

    function render() {
      const hasSearchOrFilter = Boolean(query || activeFilters.size > 0 || activeTags.size > 0);
      let rows = markets.filter(market => matchesQuery(market) && matchesFilter(market) && matchesTags(market));
      if (!hasSearchOrFilter && !showAll) rows = rows.filter(market => market.featured);
      if (!hasSearchOrFilter && !showAll && rows.length === 0) rows = markets.slice(0, 5);

      resultNode.classList.remove('is-rendered');
      resultNode.innerHTML = rows.length > 0
        ? rows.map(renderMarket).join('')
        : '<p class="exchange-coverage-empty">該当する銘柄はありません。</p>';
      void resultNode.offsetWidth;
      resultNode.classList.add('is-rendered');
      resultNode.querySelectorAll('[data-exchange-coverage-market]').forEach((button) => {
        button.addEventListener('click', () => {
          selectedInstrumentId = button.getAttribute('data-exchange-coverage-market');
          resultNode.querySelectorAll('[data-exchange-coverage-market]').forEach((item) => {
            const selected = item === button;
            item.classList.toggle('is-selected', selected);
            item.setAttribute('aria-pressed', selected ? 'true' : 'false');
          });
          renderCoverageDetail(markets.find(market => market.instrumentId === selectedInstrumentId));
        });
      });

      if (countNode) {
        const mode = hasSearchOrFilter || showAll ? '条件に一致' : '主要銘柄';
        countNode.textContent = `${mode}: ${rows.length}件 / 全${markets.length}件`;
      }
      if (showAllButton) {
        showAllButton.hidden = showAll || hasSearchOrFilter;
      }
    }

    if (search) {
      search.addEventListener('input', () => {
        query = String(search.value || '').trim().toLowerCase();
        render();
      });
    }

    filters.forEach((button) => {
      button.addEventListener('click', () => {
        const key = button.getAttribute('data-exchange-coverage-filter');
        if (activeFilters.has(key)) activeFilters.delete(key);
        else activeFilters.add(key);
        const active = activeFilters.has(key);
        button.classList.toggle('is-active', active);
        button.setAttribute('aria-pressed', active ? 'true' : 'false');
        render();
      });
    });

    tagButtons.forEach((button) => {
      button.addEventListener('click', () => {
        const key = button.getAttribute('data-exchange-coverage-tag');
        if (activeTags.has(key)) activeTags.delete(key);
        else activeTags.add(key);
        const active = activeTags.has(key);
        button.classList.toggle('is-active', active);
        button.setAttribute('aria-pressed', active ? 'true' : 'false');
        render();
      });
    });

    if (showAllButton) {
      showAllButton.addEventListener('click', () => {
        showAll = true;
        render();
      });
    }

    render();
  }

  function orderbookState(orderbook) {
    if (!orderbook || orderbook.status === 'waiting' || orderbook.status === 'unsupported') return 'waiting';
    return orderbook.status === 'stale' ? 'stale' : 'ready';
  }

  function stateSuffix(state) {
    if (state === 'stale') return '（古い板データ）';
    if (state === 'waiting') return '（データ待ち）';
    return '';
  }

  function flashIfChanged(node, nextText, flashTone) {
    if (!node) return;
    const previous = node.textContent;
    node.textContent = nextText;
    if (previous && previous !== nextText) {
      node.classList.remove('is-live-tick', 'is-live-up', 'is-live-down');
      void node.offsetWidth;
      node.classList.add('is-live-tick');
      if (flashTone) node.classList.add(`is-live-${flashTone}`);
    }
  }

  function quoteFlashTone(field, previousValue, nextValue) {
    const previous = numberOrNull(previousValue);
    const next = numberOrNull(nextValue);
    if (previous == null || next == null || previous === next) return null;
    if (field === 'spread') return next > previous ? 'down' : 'up';
    return next > previous ? 'up' : 'down';
  }

  function setQuoteField(field, text, rawValue) {
    document.querySelectorAll(`[data-quote-field="${field}"]`).forEach((node) => {
      const tone = quoteFlashTone(field, node.dataset.quoteNumeric, rawValue);
      flashIfChanged(node, text, tone);
      if (rawValue == null || rawValue === '') delete node.dataset.quoteNumeric;
      else node.dataset.quoteNumeric = String(rawValue);
    });
  }

  function setDepthField(field, text) {
    document.querySelectorAll(`[data-depth-field="${field}"]`).forEach(node => flashIfChanged(node, text));
  }

  function setDepthBar(field, percent) {
    document.querySelectorAll(`[data-depth-bar="${field}"]`).forEach((node) => {
      node.style.width = `${clampPercent(percent).toFixed(2)}%`;
    });
  }

  function depthLevelValue(level) {
    const depthJpy = numberOrNull(level && level.depthJPY);
    if (depthJpy != null) return depthJpy;
    const price = numberOrNull(level && level.price);
    const quantity = numberOrNull(level && level.quantity);
    return price != null && quantity != null ? price * quantity : null;
  }

  function renderDepthHistogramSide(levels, side, maxDepth) {
    const rows = Array.isArray(levels) ? levels.slice(0, 8) : [];
    if (rows.length === 0 || !Number.isFinite(maxDepth) || maxDepth <= 0) {
      return '<span class="exchange-depth-histogram__empty">待機中</span>';
    }
    return rows.map((level) => {
      const depth = depthLevelValue(level) || 0;
      const height = clampPercent(Math.max(8, (depth / maxDepth) * 100));
      const price = numberOrNull(level && level.price);
      return [
        `<span class="exchange-depth-histogram__bar exchange-depth-histogram__bar--${escapeHtml(side)}" style="--depth-height:${height.toFixed(2)}%" title="${escapeHtml(price != null ? formatJpyPrice(price) : side)}">`,
        '  <i></i>',
        '</span>',
      ].join('');
    }).join('');
  }

  function updateDepthHistogram(orderbook) {
    const askLevels = Array.isArray(orderbook && orderbook.askDepthLevels) ? orderbook.askDepthLevels : [];
    const bidLevels = Array.isArray(orderbook && orderbook.bidDepthLevels) ? orderbook.bidDepthLevels : [];
    const maxDepth = Math.max(
      0,
      ...askLevels.map(level => depthLevelValue(level) || 0),
      ...bidLevels.map(level => depthLevelValue(level) || 0)
    );
    document.querySelectorAll('[data-depth-histogram-side="ask"]').forEach((node) => {
      node.innerHTML = renderDepthHistogramSide(askLevels.slice().reverse(), 'ask', maxDepth);
    });
    document.querySelectorAll('[data-depth-histogram-side="bid"]').forEach((node) => {
      node.innerHTML = renderDepthHistogramSide(bidLevels, 'bid', maxDepth);
    });
  }

  function updateMicroQuote(orderbook, state) {
    const bestBid = numberOrNull(orderbook && orderbook.bestBid);
    const bestAsk = numberOrNull(orderbook && orderbook.bestAsk);
    const spreadPct = numberOrNull(orderbook && orderbook.spreadPct);
    const bidDepth = numberOrNull(orderbook && orderbook.totalBidDepthJPY);
    const askDepth = numberOrNull(orderbook && orderbook.totalAskDepthJPY);
    const maxDepth = Math.max(bidDepth || 0, askDepth || 0);

    setQuoteField('bid', bestBid != null ? formatJpyPrice(bestBid) : '-', bestBid);
    setQuoteField('ask', bestAsk != null ? formatJpyPrice(bestAsk) : '-', bestAsk);
    setQuoteField('spread', spreadPct != null ? formatPct(spreadPct, 3) : '-', spreadPct);
    setQuoteField('age', state === 'ready' ? 'live' : state === 'stale' ? 'stale' : 'waiting');
    document.querySelectorAll('[data-exchange-micro-quote]').forEach((node) => {
      node.dataset.state = state || 'waiting';
      node.style.setProperty('--quote-bid-depth', `${maxDepth > 0 ? clampPercent((bidDepth || 0) / maxDepth * 100).toFixed(2) : '0'}%`);
      node.style.setProperty('--quote-ask-depth', `${maxDepth > 0 ? clampPercent((askDepth || 0) / maxDepth * 100).toFixed(2) : '0'}%`);
    });
  }

  function updateDepthMiniChart(orderbook) {
    const bidDepth = numberOrNull(orderbook && orderbook.totalBidDepthJPY);
    const askDepth = numberOrNull(orderbook && orderbook.totalAskDepthJPY);
    const totalDepth = numberOrNull(orderbook && orderbook.visibleDepthJPY);
    const maxSide = Math.max(bidDepth || 0, askDepth || 0);

    setDepthField('bid', bidDepth != null ? formatJpyCompact(bidDepth) : '-');
    setDepthField('ask', askDepth != null ? formatJpyCompact(askDepth) : '-');
    setDepthField('total', totalDepth != null ? formatJpyCompact(totalDepth) : '読み込み中');
    setDepthBar('bid', maxSide > 0 ? ((bidDepth || 0) / maxSide) * 100 : 0);
    setDepthBar('ask', maxSide > 0 ? ((askDepth || 0) / maxSide) * 100 : 0);
    updateDepthHistogram(orderbook);
  }

  function updateSourceMetadata(row) {
    const orderbook = row && row.orderbook ? row.orderbook : null;
    const source = String((orderbook && orderbook.source) || (row && row.source) || 'api').toUpperCase();
    const updatedAt = numberOrNull(orderbook && (orderbook.updatedAt || orderbook.receivedAt));
    const ageMs = updatedAt != null ? Math.max(0, Date.now() - updatedAt) : null;
    const ageTone = ageMs == null ? 'neutral' : ageMs > 15000 ? 'warning' : 'calm';

    setMetaField('source', source, source === 'WEBSOCKET' ? 'calm' : 'neutral');
    setMetaField('dataAge', ageMs != null ? formatLatencyMs(ageMs) : '-', ageTone);
    setMetaField('pageApi', lastMarketApiLatencyMs != null ? formatLatencyMs(lastMarketApiLatencyMs) : '-', lastMarketApiLatencyMs != null && lastMarketApiLatencyMs < 500 ? 'calm' : 'neutral');
  }

  function updateOrderbookFields(report, row) {
    const marketLabel = (report.market && report.market.label) || instrumentId.replace(/-/g, '/');
    const orderbook = row && row.orderbook ? row.orderbook : null;
    const state = orderbookState(orderbook);
    const bestBid = numberOrNull(orderbook && orderbook.bestBid);
    const bestAsk = numberOrNull(orderbook && orderbook.bestAsk);
    const spreadPct = numberOrNull(orderbook && orderbook.spreadPct);
    const visibleDepth = numberOrNull(orderbook && orderbook.visibleDepthJPY);
    latestBoardSpreadPct = spreadPct;

    if (bestBid != null && bestAsk != null) {
      setLiveField('bidAsk', `${marketLabel}: Bid ${formatJpyPrice(bestBid)} / Ask ${formatJpyPrice(bestAsk)}${stateSuffix(state)}`, state);
      setStickyField('price', `Ask ${formatJpyPrice(bestAsk).replace('￥', '¥')}`, state === 'ready' ? 'calm' : state);
      updateStickySpread();
    } else {
      setLiveField('bidAsk', `${marketLabel}: Bid / Ask は公式画面で確認してください。`, 'stale');
      setStickyField('price', '公式確認', 'warning');
      updateStickySpread();
    }

    if (visibleDepth != null && visibleDepth > 0) {
      setLiveField('depth', `${marketLabel}: 可視板厚 ${formatJpyCompact(visibleDepth)}（Bid+Ask）${stateSuffix(state)}`, state);
      setGaugeField('depth', {
        value: formatJpyCompact(visibleDepth),
        percent: depthGaugePercent(visibleDepth),
        tone: depthTone(visibleDepth),
        state,
      });
    } else {
      setLiveField('depth', `${marketLabel}: 可視板厚は公式画面で確認してください。`, 'stale');
      setGaugeField('depth', { value: '公式確認', percent: 0, tone: 'neutral', state: 'stale' });
    }

    updateMicroQuote(orderbook, state);
    updateDepthMiniChart(orderbook);
    updateSourceMetadata(row);
  }

  function updateCostFields(report, row) {
    const marketLabel = (report.market && report.market.label) || instrumentId.replace(/-/g, '/');
    const cost = row && row.cost100k ? row.cost100k : null;
    const impact = numberOrNull(cost && cost.marketImpactPct);
    const vwap = numberOrNull(cost && cost.effectiveVWAP);
    const feeLabel = cost && cost.feeLabel ? String(cost.feeLabel) : '既定手数料';
    const statusLabel = cost && cost.executionStatusLabel ? String(cost.executionStatusLabel) : '';

    if (impact == null) {
      setLiveField('effectiveCost', `${marketLabel}: 10万円買いの実質コストは公式画面で確認してください。`, 'stale');
      setLiveField('slippage', `${marketLabel}: スリッページ傾向は公式画面で確認してください。`, 'stale');
      setGaugeField('impact', { value: '公式確認', percent: 0, tone: 'neutral', state: 'stale' });
      setGaugeField('slippage', { value: '公式確認', percent: 0, tone: 'neutral', state: 'stale' });
      return;
    }

    const vwapText = vwap != null ? ` / VWAP ${formatJpyPrice(vwap)}` : '';
    const statusText = statusLabel ? ` / ${statusLabel}` : '';
    setLiveField('effectiveCost', `${marketLabel}: 10万円買い参考 Impact ${formatPct(impact)}${vwapText} / 手数料 ${feeLabel}${statusText}`, 'ready');
    setLiveField('slippage', `${marketLabel}: 10万円買いの価格影響 ${formatPct(impact)}${statusText}`, 'ready');
    setGaugeField('impact', {
      value: formatPct(impact),
      percent: impactGaugePercent(impact),
      tone: impactTone(impact),
      state: 'ready',
    });
    setGaugeField('slippage', {
      value: formatPct(impact),
      percent: impactGaugePercent(impact),
      tone: impactTone(impact),
      state: 'ready',
    });
  }

  async function fetchJson(path) {
    const response = await fetch(path, { headers: { Accept: 'application/json' } });
    if (!response.ok) throw new Error(`API failed: ${response.status}`);
    return response.json();
  }

  function selectedRow(rows) {
    return (rows || []).find(item => item && item.exchangeId === exchangeId) || null;
  }

  function resultBaseCurrency(row, fallback = 'BTC') {
    return row && (row.baseCurrency || (row.instrumentId || '').split('-')[0]) || fallback;
  }

  function updateCostBars(simulator, salesBase, boardBase, deltaBase) {
    const maxBase = Math.max(Number(salesBase) || 0, Number(boardBase) || 0);
    const salesPercent = maxBase > 0 ? (Number(salesBase) || 0) / maxBase * 100 : 0;
    const boardPercent = maxBase > 0 ? (Number(boardBase) || 0) / maxBase * 100 : 0;
    const deltaPercent = maxBase > 0 ? Math.abs(Number(deltaBase) || 0) / maxBase * 100 : 0;
    simulator.querySelectorAll('[data-cost-bar="sales"]').forEach((node) => {
      node.style.width = `${clampPercent(salesPercent).toFixed(2)}%`;
    });
    simulator.querySelectorAll('[data-cost-bar="board"]').forEach((node) => {
      node.style.width = `${clampPercent(boardPercent).toFixed(2)}%`;
    });
    simulator.querySelectorAll('[data-cost-bar="delta"]').forEach((node) => {
      node.style.width = `${clampPercent(Math.max(5, deltaPercent)).toFixed(2)}%`;
    });
  }

  function simulatorRiskTone(impact, result) {
    const tone = impactTone(impact);
    if (tone === 'danger' || tone === 'warning') return tone;
    const levelsConsumed = numberOrNull(result && result.levelsConsumed);
    const slippageFromBestPct = Math.abs(numberOrNull(result && result.slippageFromBestPct) || 0);
    if (result && (result.insufficient || result.executionStatus === 'guard_rejected')) return 'danger';
    if ((levelsConsumed != null && levelsConsumed >= 4) || slippageFromBestPct >= 0.02) return 'warning';
    return tone;
  }

  function syncSimulatorTone(simulator, impact, result) {
    const tone = simulatorRiskTone(impact, result);
    simulator.dataset.impactTone = tone;
    simulator.querySelectorAll('[data-cost-field="proImpact"], [data-cost-field="boardMeta"]').forEach((node) => {
      node.dataset.tone = tone;
    });
  }

  function renderCostSimulatorResult(simulator, amount, boardRow, salesRow) {
    simulator.classList.remove('is-loading', 'is-error');
    simulator.classList.add('is-ready');
    simulator.setAttribute('aria-busy', 'false');
    const boardResult = boardRow && boardRow.result && !boardRow.result.error ? boardRow.result : null;
    const salesResult = salesRow && salesRow.result ? salesRow.result : null;
    const baseCurrency = resultBaseCurrency(boardRow || salesRow);
    const boardBase = numberOrNull(boardResult && boardResult.totalBTCFilled);
    const salesBase = numberOrNull(salesResult && salesResult.totalBase);
    const salesPrice = numberOrNull(salesResult && salesResult.price);
    const impact = numberOrNull(boardResult && boardResult.marketImpactPct);
    const feeRatePct = numberOrNull(boardResult && boardResult.feeRatePct);
    const salesSpreadPct = numberOrNull(salesRow && salesRow.spreadPct);
    const deltaBase = boardBase != null && salesBase != null ? boardBase - salesBase : null;
    const deltaJpy = deltaBase != null && salesPrice != null ? deltaBase * salesPrice : null;
    const impactRiskTone = simulatorRiskTone(impact, boardResult);
    const levelsConsumed = numberOrNull(boardResult && boardResult.levelsConsumed);
    const levelsText = levelsConsumed != null && levelsConsumed > 1 ? ` / 板${levelsConsumed}段消費` : '';
    const hasFullComparison = boardBase != null && salesBase != null;

    setDataField(simulator, 'status', hasFullComparison ? '再計算済み' : '一部取得');
    setDataField(simulator, 'proAmount', formatJpyAmount(amount).replace('￥', '¥'));
    setDataField(simulator, 'salesReceive', salesBase != null ? formatBaseAmount(salesBase, baseCurrency) : '公式確認');
    setDataField(simulator, 'salesBarLabel', salesBase != null ? formatBaseAmount(salesBase, baseCurrency) : '公式確認');
    setDataField(
      simulator,
      'salesMeta',
      salesSpreadPct != null
        ? `スプレッド ${formatPct(salesSpreadPct, 2)} / 価格再提示リスクあり`
        : (salesRow && salesRow.message) || '販売所価格は公式画面で確認'
    );
    setDataField(simulator, 'boardReceive', boardBase != null ? formatBaseAmount(boardBase, baseCurrency) : '板データ待ち');
    setDataField(simulator, 'boardBarLabel', boardBase != null ? formatBaseAmount(boardBase, baseCurrency) : '板データ待ち');
    setDataField(
      simulator,
      'boardMeta',
      impact != null
        ? `Impact ${formatPct(impact, 3)} / ${boardResult.executionStatusLabel || '参考値'}${levelsText}`
        : (boardRow && boardRow.message) || '板データを確認中'
    );
    setDataField(
      simulator,
      'deltaJpy',
      deltaJpy != null ? formatSignedJpy(deltaJpy) : '公式確認'
    );
    setDataField(
      simulator,
      'deltaBase',
      deltaBase != null ? formatSignedBaseAmount(deltaBase, baseCurrency) : '公式確認'
    );
    setDataField(
      simulator,
      'deltaMeta',
      deltaJpy != null && deltaJpy > 0
        ? '取引所形式のほうが受取数量が多い目安'
        : hasFullComparison
          ? '販売所価格は注文直前に再提示される場合があります'
          : '比較に足りない価格は公式画面で確認してください'
    );
    setDataField(
      simulator,
      'beginnerLoss',
      deltaJpy != null && deltaJpy > 0
        ? `販売所だと約${formatJpyAmount(deltaJpy).replace('￥', '¥')}分だけ受取が少ない目安です`
        : hasFullComparison
          ? '同じ金額で受け取れる数量を比較しています'
          : '板データと販売所価格がそろう銘柄で差額を比較できます'
    );
    setDataField(simulator, 'proSalesSpread', salesSpreadPct != null ? formatPct(salesSpreadPct, 3) : '-');
    setDataField(simulator, 'proImpact', impact != null ? formatPct(impact, 4) : '-');
    setDataField(simulator, 'proFee', feeRatePct != null ? `${formatPct(feeRatePct, 4)} / ${boardResult.feeLabel || '既定'}` : '-');
    syncSimulatorTone(simulator, impact, boardResult);
    updateCostBars(simulator, salesBase, boardBase, deltaBase);
    latestSalesSpreadPct = salesSpreadPct;
    updateStickySpread();
    setStickyField('delta', deltaJpy != null ? formatSignedJpy(deltaJpy).replace('￥', '¥') : '公式確認', deltaJpy != null && deltaJpy > 0 ? 'calm' : 'neutral');
    setStickyField('amount', `${formatJpyAmount(amount).replace('￥', '¥')}買い`, impactRiskTone);
  }

  function initCostSimulator() {
    const simulators = Array.from(document.querySelectorAll('[data-exchange-cost-simulator]'));
    if (simulators.length === 0 || !exchangeId || !instrumentId) return;
    simulators.forEach(initSingleCostSimulator);
  }

  function initSingleCostSimulator(simulator) {
    const range = simulator.querySelector('[data-cost-amount-range]');
    const input = simulator.querySelector('[data-cost-amount-input]');
    const quickButtons = Array.from(simulator.querySelectorAll('[data-cost-quick-amount]'));
    let debounceId = null;
    let requestId = 0;

    function amountFrom(value) {
      const min = Number(range && range.min) || 10000;
      const max = Number(range && range.max) || 1000000;
      const step = Number(range && range.step) || 10000;
      const numeric = numberOrNull(String(value).replace(/,/g, '')) || 100000;
      const clamped = Math.max(min, Math.min(max, numeric));
      return Math.round(clamped / step) * step;
    }

    function syncAmount(nextAmount) {
      const amount = amountFrom(nextAmount);
      if (range) range.value = String(amount);
      if (input) input.value = String(amount);
      quickButtons.forEach((button) => {
        const active = amountFrom(button.getAttribute('data-cost-quick-amount')) === amount;
        button.classList.toggle('is-active', active);
        button.setAttribute('aria-pressed', active ? 'true' : 'false');
      });
      return amount;
    }

    async function refreshCost(amount) {
      const currentRequestId = ++requestId;
      const params = new URLSearchParams({
        instrumentId,
        side: 'buy',
        amountType: 'jpy',
        amount: String(amount),
      });
      simulator.classList.add('is-loading');
      simulator.classList.remove('is-ready', 'is-error');
      simulator.setAttribute('aria-busy', 'true');
      setDataField(simulator, 'status', '再計算中');

      try {
        const [board, sales] = await Promise.all([
          fetchJson(`/api/market-impact-comparison?${params.toString()}`),
          fetchJson(`/api/sales-reference-comparison?${params.toString()}`),
        ]);
        if (currentRequestId !== requestId) return;
        renderCostSimulatorResult(
          simulator,
          amount,
          selectedRow(board && board.rows),
          selectedRow(sales && sales.rows)
        );
      } catch (_err) {
        if (currentRequestId !== requestId) return;
        simulator.classList.remove('is-loading');
        simulator.classList.add('is-error');
        simulator.setAttribute('aria-busy', 'false');
        setDataField(simulator, 'status', '取得失敗');
        setDataField(simulator, 'salesReceive', '公式確認');
        setDataField(simulator, 'salesMeta', '販売所価格を取得できませんでした');
        setDataField(simulator, 'boardReceive', '公式確認');
        setDataField(simulator, 'boardMeta', '板データを取得できませんでした');
        setDataField(simulator, 'deltaJpy', '公式確認');
        setDataField(simulator, 'deltaBase', '公式確認');
        setDataField(simulator, 'salesBarLabel', '取得失敗');
        setDataField(simulator, 'boardBarLabel', '取得失敗');
        setDataField(simulator, 'deltaMeta', 'データ取得に失敗しました。注文前は公式画面を確認してください。');
        setDataField(simulator, 'beginnerLoss', 'データ取得に失敗しました。公式画面で最新条件を確認してください。');
        updateCostBars(simulator, 0, 0, 0);
      }
    }

    function queueRefresh(value) {
      const amount = syncAmount(value);
      window.clearTimeout(debounceId);
      debounceId = window.setTimeout(() => refreshCost(amount), costDebounceMs);
    }

    if (range) {
      range.addEventListener('input', () => queueRefresh(range.value));
    }
    if (input) {
      input.addEventListener('input', () => queueRefresh(input.value));
      input.addEventListener('blur', () => syncAmount(input.value));
    }
    quickButtons.forEach((button) => {
      button.addEventListener('click', () => queueRefresh(button.getAttribute('data-cost-quick-amount')));
    });

    refreshCost(syncAmount(simulator.getAttribute('data-default-amount') || 100000));
  }

  function updateRefreshRing() {
    const remainingMs = Math.max(0, nextRefreshAt - Date.now());
    const remainingSeconds = Math.ceil(remainingMs / 1000);
    const progress = refreshIntervalMs > 0
      ? ((refreshIntervalMs - remainingMs) / refreshIntervalMs) * 100
      : 0;
    document.querySelectorAll('[data-exchange-refresh-ring]').forEach((node) => {
      node.style.setProperty('--progress', `${clampPercent(progress).toFixed(2)}%`);
    });
    if (nextRefreshAt > 0) {
      setLiveField(
        'dataTimestamp',
        `データは自動更新されています（最終更新 ${lastUpdateLabel} / 次の更新まであと ${remainingSeconds}秒）`,
        'ready'
      );
    }
  }

  function scheduleExchangeRefresh() {
    window.clearTimeout(refreshTimeoutId);
    window.clearInterval(countdownIntervalId);
    nextRefreshAt = Date.now() + refreshIntervalMs;
    updateRefreshRing();
    countdownIntervalId = window.setInterval(updateRefreshRing, 1000);
    refreshTimeoutId = window.setTimeout(() => {
      loadExchangeMarket({ silent: true })
        .then(scheduleExchangeRefresh)
        .catch(handleExchangeMarketError);
    }, refreshIntervalMs);
  }

  function compactRawReport(report, row) {
    return {
      meta: report && report.meta ? report.meta : null,
      market: report && report.market ? report.market : null,
      exchange: row || null,
      source: {
        siteEndpoint: `/api/markets/${instrumentId}`,
        note: 'ページ表示用に整形したレスポンスです。公式APIリンクと合わせて確認してください。',
      },
    };
  }

  function updateRawViewer() {
    const viewer = document.querySelector('[data-exchange-raw-viewer]');
    if (!viewer || viewer.hidden || !latestReport) return;
    viewer.textContent = JSON.stringify(compactRawReport(latestReport, latestExchangeRow), null, 2);
  }

  function initSourceVerifier() {
    const verifier = document.querySelector('[data-exchange-source-verifier]');
    if (!verifier) return;
    const button = verifier.querySelector('[data-exchange-raw-toggle]');
    const viewer = verifier.querySelector('[data-exchange-raw-viewer]');
    if (!button || !viewer) return;

    button.addEventListener('click', async () => {
      const nextHidden = !viewer.hidden ? true : false;
      viewer.hidden = nextHidden;
      button.textContent = nextHidden ? '生データを見る' : '閉じる';
      if (nextHidden) return;

      if (!latestReport) {
        viewer.textContent = 'JSONを読み込み中...';
        try {
          await loadExchangeMarket({ silent: true });
        } catch (_err) {
          viewer.textContent = 'データを取得できませんでした。';
          return;
        }
      }
      updateRawViewer();
    });
  }

  async function copyExchangeValue(value) {
    if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      try {
        await navigator.clipboard.writeText(value);
        return;
      } catch (_err) {
        // Fall through to the selection-based copy path for restricted browser contexts.
      }
    }
    const textarea = document.createElement('textarea');
    textarea.value = value;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.left = '-9999px';
    document.body.appendChild(textarea);
    textarea.select();
    const copied = document.execCommand('copy');
    textarea.remove();
    if (!copied) throw new Error('copy failed');
  }

  function showCopyFeedback(button, message) {
    const panel = button.closest('.exchange-referral-copy-panel') || document;
    const feedback = panel.querySelector('[data-exchange-copy-feedback]');
    if (!feedback) return;
    feedback.textContent = message;
    feedback.classList.remove('is-visible');
    void feedback.offsetWidth;
    feedback.classList.add('is-visible');
    window.clearTimeout(Number(feedback.dataset.hideTimer || 0));
    const timer = window.setTimeout(() => {
      feedback.classList.remove('is-visible');
      feedback.textContent = '';
      delete feedback.dataset.hideTimer;
    }, 1800);
    feedback.dataset.hideTimer = String(timer);
  }

  function initCopyButtons() {
    document.addEventListener('click', (event) => {
      const button = event.target && event.target.closest
        ? event.target.closest('[data-exchange-copy-value]')
        : null;
      if (!button) return;
      event.preventDefault();
      const value = button.getAttribute('data-exchange-copy-value') || '';
      const label = button.getAttribute('data-exchange-copy-label') || '値';
      copyExchangeValue(value)
        .then(() => showCopyFeedback(button, `${label}をコピーしました`))
        .catch(() => showCopyFeedback(button, 'コピーできませんでした'));
    });
  }

  function initMobileDetailLists() {
    document.querySelectorAll('[data-exchange-mobile-detail-list]').forEach((shell) => {
      const button = shell.querySelector('[data-exchange-mobile-detail-toggle]');
      if (!button) return;
      button.addEventListener('click', () => {
        const expanded = !shell.classList.contains('is-expanded');
        shell.classList.toggle('is-expanded', expanded);
        button.setAttribute('aria-expanded', expanded ? 'true' : 'false');
        button.textContent = expanded ? '詳細を隠す' : '詳細を表示';
      });
    });
  }

  async function loadExchangeMarket(options = {}) {
    if (!exchangeId || !instrumentId) return;

    if (!options.silent) {
      setLiveField('dataTimestamp', 'データ取得時刻: 読み込み中', 'waiting');
      setLiveField('bidAsk', '代表銘柄のBid / Askを読み込み中', 'waiting');
      setLiveField('depth', '代表銘柄の板厚を読み込み中', 'waiting');
      setLiveField('effectiveCost', '代表銘柄の10万円買い参考値を読み込み中', 'waiting');
      setLiveField('slippage', '代表銘柄のスリッページ傾向を読み込み中', 'waiting');
      setGaugeField('depth', { value: '読み込み中', percent: 0, tone: 'neutral', state: 'waiting' });
      setGaugeField('impact', { value: '読み込み中', percent: 0, tone: 'neutral', state: 'waiting' });
      setGaugeField('slippage', { value: '読み込み中', percent: 0, tone: 'neutral', state: 'waiting' });
    }

    const requestStartedAt = nowMs();
    const report = await fetchJson(`/api/markets/${encodeURIComponent(instrumentId)}`);
    lastMarketApiLatencyMs = Math.max(0, nowMs() - requestStartedAt);
    latestReport = report;
    lastUpdateLabel = formatDateTime(report && report.meta && report.meta.generatedAt);
    const rows = report && report.domesticComparison && Array.isArray(report.domesticComparison.rows)
      ? report.domesticComparison.rows
      : [];
    const row = rows.find(item => item && item.exchangeId === exchangeId) || null;
    latestExchangeRow = row;

    if (!row) {
      const marketLabel = (report.market && report.market.label) || instrumentId.replace(/-/g, '/');
      setLiveField('bidAsk', `${marketLabel}: この取引所の板データは対象外です。公式画面で確認してください。`, 'stale');
      setLiveField('depth', `${marketLabel}: この取引所の板厚データは対象外です。公式画面で確認してください。`, 'stale');
      setLiveField('effectiveCost', `${marketLabel}: この取引所の実質コストは対象外です。公式画面で確認してください。`, 'stale');
      setLiveField('slippage', `${marketLabel}: この取引所のスリッページ傾向は対象外です。公式画面で確認してください。`, 'stale');
      setGaugeField('depth', { value: '対象外', percent: 0, tone: 'neutral', state: 'stale' });
      setGaugeField('impact', { value: '対象外', percent: 0, tone: 'neutral', state: 'stale' });
      setGaugeField('slippage', { value: '対象外', percent: 0, tone: 'neutral', state: 'stale' });
      updateRawViewer();
      return;
    }

    updateOrderbookFields(report, row);
    updateCostFields(report, row);
    updateRawViewer();
    updateRefreshRing();
  }

  function handleExchangeMarketError() {
    setLiveField('dataTimestamp', 'データ取得に失敗しました。公式画面で確認してください。', 'error');
    setLiveField('bidAsk', 'Bid / Ask を取得できませんでした。公式画面で確認してください。', 'error');
    setLiveField('depth', '板厚を取得できませんでした。公式画面で確認してください。', 'error');
    setLiveField('effectiveCost', '実質コストを取得できませんでした。公式画面で確認してください。', 'error');
    setLiveField('slippage', 'スリッページ傾向を取得できませんでした。公式画面で確認してください。', 'error');
    setGaugeField('depth', { value: '取得失敗', percent: 0, tone: 'neutral', state: 'error' });
    setGaugeField('impact', { value: '取得失敗', percent: 0, tone: 'neutral', state: 'error' });
    setGaugeField('slippage', { value: '取得失敗', percent: 0, tone: 'neutral', state: 'error' });
  }

  function initPressFeedback() {
    document.addEventListener('click', (event) => {
      const target = event.target.closest('button, .btn, .exchange-mobile-tabbar a, .exchange-floating-cta a');
      if (!target) return;
      if (navigator && typeof navigator.vibrate === 'function') {
        navigator.vibrate(8);
      }
    });
  }

  initTabs();
  initStickyNavProgress();
  initCoverageTool();
  initCostSimulator();
  initSourceVerifier();
  initCopyButtons();
  initMobileDetailLists();
  initPressFeedback();

  loadExchangeMarket()
    .then(scheduleExchangeRefresh)
    .catch(handleExchangeMarketError);
}());
