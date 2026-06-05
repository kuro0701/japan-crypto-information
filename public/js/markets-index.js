document.addEventListener('DOMContentLoaded', () => {
  const config = window.MARKETS_INDEX || {};
  const markets = Array.isArray(config.markets) ? config.markets : [];
  const marketById = new Map(markets.map(market => [market.instrumentId, market]));
  const cards = Array.from(document.querySelectorAll('[data-market-card]'));
  const rows = Array.from(document.querySelectorAll('[data-market-row]'));
  const searchInput = document.getElementById('market-index-search');
  const suggestions = document.getElementById('market-index-search-suggestions');
  const visibleCount = document.getElementById('market-index-visible-count');
  const exchangeState = document.getElementById('market-index-exchange-state');
  const status = document.getElementById('market-index-status');
  const meta = document.getElementById('market-index-meta');
  const empty = document.getElementById('market-index-empty');
  const clearButton = document.getElementById('market-index-clear');
  const grid = document.getElementById('market-index-grid');
  const tableWrap = document.getElementById('market-index-table-wrap');
  const table = document.getElementById('market-index-table');
  const tableBody = table ? table.querySelector('tbody') : null;
  const watchlist = document.getElementById('market-index-watchlist');
  const chips = Array.from(document.querySelectorAll('[data-market-exchange-chip]'));
  const modeButtons = Array.from(document.querySelectorAll('[data-market-filter-mode]'));
  const viewButtons = Array.from(document.querySelectorAll('[data-market-view]'));
  const sortButtons = Array.from(document.querySelectorAll('[data-market-sort]'));
  const allExchangeIds = new Set((config.exchanges || []).map(exchange => exchange.id));
  const allValue = '__all__';
  const maxCompare = 3;
  const storageKeys = {
    view: 'okj.marketsIndex.view.v1',
    favorites: 'okj.marketsIndex.favorites.v1',
  };

  const items = markets.map((market, index) => {
    const card = cards.find(node => node.dataset.marketId === market.instrumentId) || null;
    const row = rows.find(node => node.dataset.marketId === market.instrumentId) || null;
    return {
      market,
      card,
      row,
      index,
      live: {
        volume: Number(market.instrumentTotalQuoteVolume) || 0,
        spread: numberOrNull(market.bestSpreadPct),
        change: numberOrNull(market.change24hPct),
      },
    };
  });
  const itemById = new Map(items.map(item => [item.market.instrumentId, item]));

  const state = {
    selectedExchanges: new Set(),
    filterMode: 'or',
    view: readStoredValue(storageKeys.view) === 'table' ? 'table' : 'grid',
    favorites: readStoredSet(storageKeys.favorites),
    compare: new Set(),
    sort: { key: 'rank', direction: 'asc' },
  };

  function readStoredValue(key) {
    try {
      return localStorage.getItem(key) || '';
    } catch (_) {
      return '';
    }
  }

  function writeStoredValue(key, value) {
    try {
      localStorage.setItem(key, value);
    } catch (_) {
      // noop
    }
  }

  function readStoredSet(key) {
    try {
      const value = JSON.parse(localStorage.getItem(key) || '[]');
      return new Set(Array.isArray(value) ? value : []);
    } catch (_) {
      return new Set();
    }
  }

  function writeStoredSet(key, set) {
    try {
      localStorage.setItem(key, JSON.stringify(Array.from(set)));
    } catch (_) {
      // noop
    }
  }

  function numberOrNull(value) {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : null;
  }

  function parsePct(value) {
    if (value == null) return null;
    const numeric = Number(String(value).replace('%', '').replace(/[＋+]/g, '').trim());
    return Number.isFinite(numeric) ? numeric : null;
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function formatPct(value, decimals = 2) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return 'データ待ち';
    return `${numeric.toFixed(decimals)}%`;
  }

  function formatSignedPct(value, decimals = 2) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return 'データ待ち';
    return `${numeric > 0 ? '+' : ''}${numeric.toFixed(decimals)}%`;
  }

  function formatJpyCompact(value) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric <= 0) return 'データ待ち';
    return `¥${new Intl.NumberFormat('ja-JP', {
      notation: 'compact',
      maximumFractionDigits: numeric >= 1e8 ? 1 : 0,
    }).format(numeric)}`;
  }

  function trendTone(value) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric === 0) return 'flat';
    return numeric > 0 ? 'up' : 'down';
  }

  function assetMark(market, className = '') {
    const base = String(market.baseCurrency || market.instrumentId || '?').split('-')[0].slice(0, 4).toUpperCase();
    const token = base.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'market';
    return `<span class="market-asset-mark market-asset-mark--${escapeHtml(token)} ${escapeHtml(className)}" aria-hidden="true">${escapeHtml(base)}</span>`;
  }

  function getQuery() {
    return String(searchInput && searchInput.value || '').trim().toLowerCase();
  }

  function getNodeExchanges(node) {
    return String(node && node.dataset ? node.dataset.exchanges || '' : '')
      .split(/\s+/)
      .filter(Boolean);
  }

  function matchesExchangeFilter(node) {
    if (state.selectedExchanges.size === 0) return true;
    const nodeExchanges = new Set(getNodeExchanges(node));
    const selected = Array.from(state.selectedExchanges);
    if (state.filterMode === 'and') {
      return selected.every(exchangeId => nodeExchanges.has(exchangeId));
    }
    return selected.some(exchangeId => nodeExchanges.has(exchangeId));
  }

  function matchesQuery(node, query) {
    if (!query) return true;
    return String(node && node.dataset ? node.dataset.marketSearch || '' : '').includes(query);
  }

  function readInitialParams() {
    const params = new URLSearchParams(window.location.search);
    const query = params.get('q');
    if (searchInput && query) searchInput.value = query;

    const exchangeParam = params.get('exchanges') || params.get('exchange') || '';
    exchangeParam.split(',').map(value => value.trim()).filter(Boolean).forEach((exchangeId) => {
      if (exchangeId !== allValue && allExchangeIds.has(exchangeId)) {
        state.selectedExchanges.add(exchangeId);
      }
    });

    if (params.get('mode') === 'and') state.filterMode = 'and';
    if (params.get('view') === 'table' || params.get('view') === 'grid') {
      state.view = params.get('view');
    }
  }

  function writeParams() {
    const params = new URLSearchParams();
    const query = getQuery();
    const exchanges = Array.from(state.selectedExchanges).filter(exchangeId => allExchangeIds.has(exchangeId));
    if (query) params.set('q', query);
    if (exchanges.length > 0) params.set('exchanges', exchanges.join(','));
    if (exchanges.length > 1 && state.filterMode === 'and') params.set('mode', 'and');
    if (state.view === 'table') params.set('view', 'table');
    const nextUrl = params.toString()
      ? `${window.location.pathname}?${params.toString()}`
      : window.location.pathname;
    window.history.replaceState(null, '', nextUrl);
  }

  function hasActiveFilters() {
    return Boolean(getQuery()) || state.selectedExchanges.size > 0 || state.filterMode !== 'or';
  }

  function syncFilterControls() {
    chips.forEach((chip) => {
      const exchangeId = chip.dataset.marketExchangeChip;
      const active = state.selectedExchanges.has(exchangeId);
      chip.classList.toggle('is-active', active);
      chip.setAttribute('aria-pressed', active ? 'true' : 'false');
    });

    modeButtons.forEach((button) => {
      const active = button.dataset.marketFilterMode === state.filterMode;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', active ? 'true' : 'false');
    });

    if (exchangeState) {
      if (state.selectedExchanges.size === 0) {
        exchangeState.textContent = '全社';
      } else {
        const modeLabel = state.filterMode === 'and' ? 'すべて対応' : 'いずれか対応';
        exchangeState.textContent = `${state.selectedExchanges.size}社・${modeLabel}`;
      }
    }
    if (clearButton) clearButton.disabled = !hasActiveFilters();
  }

  function updateVisibility() {
    const query = getQuery();
    let count = 0;

    for (const item of items) {
      const referenceNode = item.card || item.row;
      const visible = matchesQuery(referenceNode, query) && matchesExchangeFilter(referenceNode);
      if (item.card) item.card.hidden = !visible;
      if (item.row) item.row.hidden = !visible;
      if (visible) count += 1;
    }

    if (visibleCount) visibleCount.textContent = String(count);
    if (status) status.textContent = count === items.length && !hasActiveFilters() ? '全銘柄' : '絞り込み中';
    if (meta) {
      const total = config.meta && Number(config.meta.marketCount) ? Number(config.meta.marketCount) : items.length;
      const favoriteText = state.favorites.size > 0 ? ` / お気に入り ${state.favorites.size}` : '';
      meta.textContent = `${count} / ${total} 銘柄${favoriteText}`;
    }
    if (empty) empty.classList.toggle('hidden', count > 0);
    syncFilterControls();
    applyFavoriteOrdering();
    applyTableSort();
    writeParams();
  }

  function syncView() {
    const tableMode = state.view === 'table';
    if (grid) grid.hidden = tableMode;
    if (tableWrap) tableWrap.hidden = !tableMode;
    viewButtons.forEach((button) => {
      const active = button.dataset.marketView === state.view;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
    writeStoredValue(storageKeys.view, state.view);
    writeParams();
  }

  function favoriteRank(id) {
    return state.favorites.has(id) ? 0 : 1;
  }

  function applyFavoriteOrdering() {
    if (grid) {
      const ordered = [...cards].sort((a, b) => {
        const favoriteDiff = favoriteRank(a.dataset.marketId) - favoriteRank(b.dataset.marketId);
        if (favoriteDiff !== 0) return favoriteDiff;
        return Number(a.dataset.originalIndex || 0) - Number(b.dataset.originalIndex || 0);
      });
      ordered.forEach(card => grid.appendChild(card));
    }
  }

  function syncFavorites() {
    cards.forEach((card, index) => {
      if (!card.dataset.originalIndex) card.dataset.originalIndex = String(index);
      card.classList.toggle('is-favorite', state.favorites.has(card.dataset.marketId));
    });
    rows.forEach((row, index) => {
      if (!row.dataset.originalIndex) row.dataset.originalIndex = String(index);
      row.classList.toggle('is-favorite', state.favorites.has(row.dataset.marketId));
    });

    document.querySelectorAll('[data-market-favorite]').forEach((button) => {
      const marketId = button.dataset.marketFavorite;
      const item = itemById.get(marketId);
      const active = state.favorites.has(marketId);
      button.textContent = active ? '★' : '☆';
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', active ? 'true' : 'false');
      if (item) {
        button.setAttribute('aria-label', active
          ? `${item.market.label}をお気に入りから外す`
          : `${item.market.label}をお気に入りに追加`);
      }
    });

    renderWatchlist();
    writeStoredSet(storageKeys.favorites, state.favorites);
    updateVisibility();
  }

  function renderWatchlist() {
    if (!watchlist) return;
    const favoriteMarkets = markets.filter(market => state.favorites.has(market.instrumentId));
    if (favoriteMarkets.length === 0) {
      watchlist.hidden = true;
      watchlist.innerHTML = '';
      return;
    }
    watchlist.hidden = false;
    watchlist.innerHTML = [
      '<div class="market-watchlist__header">',
      '  <span class="market-watchlist__title">お気に入り</span>',
      `  <span class="market-watchlist__count">${favoriteMarkets.length}件</span>`,
      '</div>',
      '<div class="market-watchlist__links">',
      favoriteMarkets.map(market => (
        `<a class="market-watchlist__link" href="${escapeHtml(market.path)}">${assetMark(market, 'market-asset-mark--xs')}<span>${escapeHtml(market.label)}</span></a>`
      )).join(''),
      '</div>',
    ].join('');
  }

  function sortValue(row, key) {
    if (key === 'label') return String(row.dataset.marketLabel || '').toLowerCase();
    if (key === 'exchangeCount') return numberOrNull(row.dataset.exchangeCount);
    if (key === 'volume') return numberOrNull(row.dataset.volume);
    if (key === 'spread') return numberOrNull(row.dataset.spread);
    if (key === 'change') return numberOrNull(row.dataset.change);
    return numberOrNull(row.dataset.originalIndex) || 0;
  }

  function compareRows(a, b) {
    if (state.sort.key === 'rank') {
      const favoriteDiff = favoriteRank(a.dataset.marketId) - favoriteRank(b.dataset.marketId);
      if (favoriteDiff !== 0) return favoriteDiff;
      return Number(a.dataset.originalIndex || 0) - Number(b.dataset.originalIndex || 0);
    }

    const aValue = sortValue(a, state.sort.key);
    const bValue = sortValue(b, state.sort.key);
    const direction = state.sort.direction === 'desc' ? -1 : 1;
    const aMissing = aValue == null || aValue === '';
    const bMissing = bValue == null || bValue === '';
    if (aMissing && bMissing) return 0;
    if (aMissing) return 1;
    if (bMissing) return -1;
    if (typeof aValue === 'string' || typeof bValue === 'string') {
      return String(aValue).localeCompare(String(bValue), 'ja') * direction;
    }
    if (aValue === bValue) return 0;
    return aValue > bValue ? direction : -direction;
  }

  function applyTableSort() {
    if (!tableBody) return;
    rows.sort(compareRows).forEach(row => tableBody.appendChild(row));
    sortButtons.forEach((button) => {
      const active = button.dataset.marketSort === state.sort.key;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', active ? 'true' : 'false');
      button.dataset.sortDirection = active ? state.sort.direction : '';
    });
  }

  function showSuggestions() {
    if (!suggestions || !searchInput) return;
    const query = getQuery();
    if (!query) {
      hideSuggestions();
      return;
    }

    const matches = markets
      .filter((market) => {
        const item = itemById.get(market.instrumentId);
        const node = item && (item.card || item.row);
        return node && matchesQuery(node, query);
      })
      .slice(0, 8);

    if (matches.length === 0) {
      suggestions.hidden = true;
      suggestions.innerHTML = '';
      return;
    }

    suggestions.innerHTML = matches.map((market) => [
      `<button class="market-search-suggestion" type="button" role="option" data-market-suggestion="${escapeHtml(market.instrumentId)}">`,
      `  ${assetMark(market, 'market-asset-mark--sm')}`,
      '  <span>',
      `    <strong>${escapeHtml(market.label)}</strong>`,
      `    <small>${escapeHtml(market.instrumentId)} / ${escapeHtml((market.exchangeCount || 0) + '社対応')}</small>`,
      '  </span>',
      '</button>',
    ].join('')).join('');
    suggestions.hidden = false;
  }

  function hideSuggestions() {
    if (!suggestions) return;
    suggestions.hidden = true;
  }

  function ensureCompareTray() {
    let tray = document.getElementById('market-compare-tray');
    if (tray) return tray;
    tray = document.createElement('aside');
    tray.id = 'market-compare-tray';
    tray.className = 'market-compare-tray';
    tray.hidden = true;
    tray.setAttribute('aria-live', 'polite');
    document.body.appendChild(tray);
    return tray;
  }

  function metricText(item, key) {
    const market = item.market;
    if (key === 'volume') {
      const label = market.topVolumeExchangeLabel || 'データ待ち';
      const amount = item.live.volume ? ` / ${formatJpyCompact(item.live.volume)}` : '';
      return `${label}${amount}`;
    }
    if (key === 'spread') {
      if (!market.bestSpreadExchangeLabel) return market.marketType === 'derivative' ? 'デリバティブ板' : '販売所データなし';
      return `${market.bestSpreadExchangeLabel}${item.live.spread != null ? ` ${formatPct(item.live.spread)}` : ''}`;
    }
    if (key === 'change') {
      return item.live.change != null ? formatSignedPct(item.live.change) : 'データ待ち';
    }
    return '';
  }

  function renderCompareTray() {
    const tray = ensureCompareTray();
    const selected = Array.from(state.compare).map(id => itemById.get(id)).filter(Boolean);
    if (selected.length === 0) {
      tray.hidden = true;
      tray.innerHTML = '';
      return;
    }

    tray.hidden = false;
    tray.innerHTML = [
      '<div class="market-compare-tray__header">',
      '  <div>',
      '    <span class="market-compare-tray__eyebrow">Quick Compare</span>',
      `    <strong>${selected.length}/${maxCompare} 銘柄を比較</strong>`,
      '  </div>',
      '  <div class="market-compare-tray__actions">',
      '    <button type="button" data-market-compare-clear>クリア</button>',
      '    <button type="button" data-market-compare-close aria-label="比較パネルを閉じる">×</button>',
      '  </div>',
      '</div>',
      '<div class="market-compare-tray__grid">',
      selected.map(({ market }, index) => {
        const item = itemById.get(market.instrumentId);
        return [
          '<article class="market-compare-card">',
          '  <div class="market-compare-card__top">',
          `    ${assetMark(market, 'market-asset-mark--sm')}`,
          '    <div>',
          `      <strong>${escapeHtml(market.label)}</strong>`,
          `      <span>${escapeHtml(market.instrumentId)}</span>`,
          '    </div>',
          `    <button type="button" data-market-compare-remove="${escapeHtml(market.instrumentId)}" aria-label="${escapeHtml(market.label)}を比較から外す">×</button>`,
          '  </div>',
          '  <dl class="market-compare-card__metrics">',
          `    <div><dt>対応数</dt><dd>${escapeHtml(String(market.exchangeCount || 0))}社</dd></div>`,
          `    <div><dt>出来高</dt><dd>${escapeHtml(metricText(item, 'volume'))}</dd></div>`,
          `    <div><dt>スプレッド</dt><dd>${escapeHtml(metricText(item, 'spread'))}</dd></div>`,
          `    <div><dt>24h</dt><dd class="market-trend market-trend--${escapeHtml(trendTone(item.live.change))}">${escapeHtml(metricText(item, 'change'))}</dd></div>`,
          '  </dl>',
          `  <a class="market-compare-card__link" href="${escapeHtml(market.path)}">${index === 0 ? '詳細を見る' : '詳細へ'}</a>`,
          '</article>',
        ].join('');
      }).join(''),
      '</div>',
    ].join('');
  }

  function syncCompare() {
    document.querySelectorAll('[data-market-compare]').forEach((input) => {
      const marketId = input.dataset.marketCompare;
      const active = state.compare.has(marketId);
      input.checked = active;
      input.disabled = !active && state.compare.size >= maxCompare;
      const label = input.closest('.market-compare-toggle');
      if (label) label.classList.toggle('is-active', active);
    });
    renderCompareTray();
  }

  function setCompare(marketId, active) {
    if (active) {
      if (state.compare.size >= maxCompare && !state.compare.has(marketId)) return;
      state.compare.add(marketId);
    } else {
      state.compare.delete(marketId);
    }
    syncCompare();
  }

  function flashNode(node, tone) {
    if (!node) return;
    node.classList.remove('is-live-up', 'is-live-down');
    void node.offsetWidth;
    node.classList.add(tone === 'down' ? 'is-live-down' : 'is-live-up');
    window.setTimeout(() => node.classList.remove('is-live-up', 'is-live-down'), 900);
  }

  function updateText(node, nextText, tone) {
    if (!node || node.textContent === nextText) return;
    node.textContent = nextText;
    flashNode(node, tone);
  }

  function updateMarketNode(item, updates) {
    const { market } = item;
    const nodes = [item.card, item.row].filter(Boolean);
    const prev = { ...item.live };
    if (updates.volume != null) item.live.volume = updates.volume;
    if (updates.spread != null) item.live.spread = updates.spread;
    if (updates.change != null) item.live.change = updates.change;

    if (updates.topVolumeExchangeLabel) market.topVolumeExchangeLabel = updates.topVolumeExchangeLabel;
    if (updates.bestSpreadExchangeLabel) market.bestSpreadExchangeLabel = updates.bestSpreadExchangeLabel;
    if (updates.change24hExchangeLabel) market.change24hExchangeLabel = updates.change24hExchangeLabel;

    nodes.forEach((node) => {
      if (updates.volume != null) node.dataset.volume = String(updates.volume);
      if (updates.spread != null) node.dataset.spread = String(updates.spread);
      if (updates.change != null) node.dataset.change = String(updates.change);
    });

    const volumeTone = prev.volume != null && updates.volume != null && updates.volume < prev.volume ? 'down' : 'up';
    const spreadTone = prev.spread != null && updates.spread != null && updates.spread > prev.spread ? 'down' : 'up';
    const changeTone = prev.change != null && updates.change != null && updates.change < prev.change ? 'down' : 'up';

    if (item.card) {
      updateText(item.card.querySelector('[data-market-top-volume]'), market.topVolumeExchangeLabel ? `出来高トップ：${market.topVolumeExchangeLabel}` : '出来高データ待ち', volumeTone);
      updateText(item.card.querySelector('[data-market-best-spread]'), metricText(item, 'spread').replace(/^/, 'スプレッド最小：'), spreadTone);
      const changeNode = item.card.querySelector('[data-market-change-text]');
      if (changeNode) {
        changeNode.className = `market-index-card__trend-value market-trend market-trend--${trendTone(item.live.change)}`;
        updateText(changeNode, `${metricText(item, 'change')}${market.change24hExchangeLabel ? ` / ${market.change24hExchangeLabel}` : ''}`, changeTone);
      }
    }
    if (item.row) {
      updateText(item.row.querySelector('[data-market-top-volume]'), market.topVolumeExchangeLabel || 'データ待ち', volumeTone);
      updateText(item.row.querySelector('[data-market-best-spread]'), metricText(item, 'spread'), spreadTone);
      const changeNode = item.row.querySelector('[data-market-change-text]');
      if (changeNode) {
        changeNode.className = `market-trend market-trend--${trendTone(item.live.change)}`;
        updateText(changeNode, metricText(item, 'change'), changeTone);
      }
    }
  }

  function buildLiveUpdates(volumeShare, salesReport) {
    const updates = new Map();
    const ensure = (instrumentId) => {
      if (!updates.has(instrumentId)) updates.set(instrumentId, {});
      return updates.get(instrumentId);
    };

    for (const row of volumeShare.rows || []) {
      const volume = numberOrNull(row.quoteVolume);
      if (volume == null) continue;
      const update = ensure(row.instrumentId);
      if (update.volume == null || volume > update.volume) {
        update.topVolumeExchangeLabel = row.exchangeLabel;
      }
    }
    for (const row of volumeShare.instruments || []) {
      const volume = numberOrNull(row.quoteVolume);
      if (volume != null) ensure(row.instrumentId).volume = volume;
    }
    for (const row of salesReport.rows || []) {
      const latest = row.latest || {};
      const spread = parsePct(row.averages && row.averages['1d'] && row.averages['1d'].spreadPct);
      const fallbackSpread = parsePct(latest.spreadPct);
      const spreadValue = spread != null ? spread : fallbackSpread;
      const change = parsePct(latest.change24h);
      const update = ensure(row.instrumentId);
      if (spreadValue != null && (update.spread == null || spreadValue < update.spread)) {
        update.spread = spreadValue;
        update.bestSpreadExchangeLabel = row.exchangeLabel;
      }
      if (change != null && (update.change == null || spreadValue === update.spread)) {
        update.change = change;
        update.change24hExchangeLabel = row.exchangeLabel;
      }
    }
    return updates;
  }

  async function refreshLiveMetrics() {
    const [volumeResponse, spreadResponse] = await Promise.all([
      fetch('/api/volume-share?window=1d', { headers: { accept: 'application/json' } }),
      fetch('/api/sales-spread', { headers: { accept: 'application/json' } }),
    ]);
    if (!volumeResponse.ok || !spreadResponse.ok) return;
    const [volumeShare, salesReport] = await Promise.all([
      volumeResponse.json(),
      spreadResponse.json(),
    ]);
    const updates = buildLiveUpdates(volumeShare || {}, salesReport || {});
    updates.forEach((update, instrumentId) => {
      const item = itemById.get(instrumentId);
      if (item) updateMarketNode(item, update);
    });
    applyTableSort();
    renderCompareTray();
  }

  function startLiveRefresh() {
    if (!window.PagePoller || typeof window.PagePoller.create !== 'function') return;
    const poller = window.PagePoller.create();
    const task = poller.createTask({
      intervalMs: 60000,
      callback: refreshLiveMetrics,
      visibleOnly: true,
    });
    task.start({ immediate: false });
  }

  function clearFilters() {
    if (searchInput) searchInput.value = '';
    state.selectedExchanges.clear();
    state.filterMode = 'or';
    hideSuggestions();
    updateVisibility();
  }

  cards.forEach((card, index) => {
    card.dataset.originalIndex = String(index);
  });
  rows.forEach((row, index) => {
    row.dataset.originalIndex = String(index);
  });

  readInitialParams();
  syncView();
  syncFilterControls();
  renderWatchlist();
  updateVisibility();
  syncFavorites();
  syncCompare();
  startLiveRefresh();

  if (searchInput) {
    searchInput.addEventListener('input', () => {
      updateVisibility();
      showSuggestions();
    });
    searchInput.addEventListener('focus', showSuggestions);
    searchInput.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') hideSuggestions();
    });
    searchInput.addEventListener('blur', () => {
      window.setTimeout(hideSuggestions, 120);
    });
  }

  document.addEventListener('click', (event) => {
    const target = event.target && event.target.closest ? event.target : null;
    if (!target) return;

    const suggestion = target.closest('[data-market-suggestion]');
    if (suggestion && searchInput) {
      const marketId = suggestion.dataset.marketSuggestion;
      const market = marketById.get(marketId);
      searchInput.value = market ? market.instrumentId : marketId;
      hideSuggestions();
      updateVisibility();
      searchInput.focus();
      return;
    }

    const chip = target.closest('[data-market-exchange-chip]');
    if (chip) {
      const exchangeId = chip.dataset.marketExchangeChip;
      if (state.selectedExchanges.has(exchangeId)) {
        state.selectedExchanges.delete(exchangeId);
      } else {
        state.selectedExchanges.add(exchangeId);
      }
      updateVisibility();
      return;
    }

    const modeButton = target.closest('[data-market-filter-mode]');
    if (modeButton) {
      state.filterMode = modeButton.dataset.marketFilterMode === 'and' ? 'and' : 'or';
      updateVisibility();
      return;
    }

    const viewButton = target.closest('[data-market-view]');
    if (viewButton) {
      state.view = viewButton.dataset.marketView === 'table' ? 'table' : 'grid';
      syncView();
      return;
    }

    const sortButton = target.closest('[data-market-sort]');
    if (sortButton) {
      const key = sortButton.dataset.marketSort;
      if (state.sort.key === key) {
        state.sort.direction = state.sort.direction === 'asc' ? 'desc' : 'asc';
      } else {
        state.sort = {
          key,
          direction: key === 'spread' ? 'asc' : 'desc',
        };
      }
      applyTableSort();
      return;
    }

    const favoriteButton = target.closest('[data-market-favorite]');
    if (favoriteButton) {
      const marketId = favoriteButton.dataset.marketFavorite;
      if (state.favorites.has(marketId)) {
        state.favorites.delete(marketId);
      } else {
        state.favorites.add(marketId);
      }
      syncFavorites();
      return;
    }

    const compareInput = target.closest('[data-market-compare]');
    if (compareInput) {
      setCompare(compareInput.dataset.marketCompare, compareInput.checked);
      return;
    }

    const compareRemove = target.closest('[data-market-compare-remove]');
    if (compareRemove) {
      setCompare(compareRemove.dataset.marketCompareRemove, false);
      return;
    }

    if (target.closest('[data-market-compare-clear]')) {
      state.compare.clear();
      syncCompare();
      return;
    }

    if (target.closest('[data-market-compare-close]')) {
      const tray = ensureCompareTray();
      tray.hidden = true;
      return;
    }
  });

  document.addEventListener('change', (event) => {
    const target = event.target && event.target.closest ? event.target : null;
    const compareInput = target ? target.closest('[data-market-compare]') : null;
    if (!compareInput) return;
    setCompare(compareInput.dataset.marketCompare, compareInput.checked);
  });

  if (clearButton) clearButton.addEventListener('click', clearFilters);
});
