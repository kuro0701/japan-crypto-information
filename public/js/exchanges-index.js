document.addEventListener('DOMContentLoaded', () => {
  const config = window.EXCHANGES_INDEX || {};
  const exchanges = Array.isArray(config.exchanges) ? config.exchanges : [];
  const exchangeById = new Map(exchanges.map(exchange => [exchange.id, exchange]));
  const cards = Array.from(document.querySelectorAll('[data-exchange-card]'));
  const rows = Array.from(document.querySelectorAll('[data-exchange-row]'));
  const searchInput = document.getElementById('exchange-index-search');
  const sortSelect = document.getElementById('exchange-index-sort');
  const clearButton = document.getElementById('exchange-index-clear');
  const grid = document.getElementById('exchange-index-grid');
  const tableWrap = document.getElementById('exchange-index-table-wrap');
  const table = document.getElementById('exchange-index-table');
  const tableBody = table ? table.querySelector('tbody') : null;
  const visibleCount = document.getElementById('exchange-index-visible-count');
  const status = document.getElementById('exchange-index-status');
  const meta = document.getElementById('exchange-index-meta');
  const empty = document.getElementById('exchange-index-empty');
  const viewButtons = Array.from(document.querySelectorAll('[data-exchange-view]'));
  const filterInputs = Array.from(document.querySelectorAll('[data-exchange-filter]'));
  const generatedLabel = document.querySelector('[data-exchange-generated-label]');
  const maxCompare = 3;
  const storageKeys = {
    view: 'okj.exchangesIndex.view.v1',
  };

  const state = {
    view: readStoredValue(storageKeys.view) === 'table' ? 'table' : 'cards',
    sort: 'rank',
    filters: {
      board: false,
      sales: false,
      leverage: false,
      zeroFee: false,
    },
    compare: new Set(),
  };

  const items = exchanges.map((exchange, index) => {
    const card = cards.find(node => node.dataset.exchangeId === exchange.id) || null;
    const row = rows.find(node => node.dataset.exchangeId === exchange.id) || null;
    return { exchange, card, row, index };
  });

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

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function formatCount(value) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return '-';
    return new Intl.NumberFormat('ja-JP').format(Math.round(numeric));
  }

  function numberOrNull(value) {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : null;
  }

  function getQuery() {
    return String(searchInput && searchInput.value || '').trim().toLowerCase();
  }

  function nodeFlag(node, key) {
    return String(node && node.dataset ? node.dataset[key] || '' : '') === 'true';
  }

  function matchesFilters(node) {
    if (!node) return false;
    if (state.filters.board && !nodeFlag(node, 'hasBoard')) return false;
    if (state.filters.sales && !nodeFlag(node, 'hasSales')) return false;
    if (state.filters.leverage && !nodeFlag(node, 'hasLeverage')) return false;
    if (state.filters.zeroFee && !nodeFlag(node, 'hasZeroFee')) return false;
    return true;
  }

  function matchesQuery(node, query) {
    if (!query) return true;
    return String(node && node.dataset ? node.dataset.exchangeSearch || '' : '').includes(query);
  }

  function activeFilterCount() {
    return Object.values(state.filters).filter(Boolean).length;
  }

  function hasActiveFilters() {
    return Boolean(getQuery()) || activeFilterCount() > 0 || state.sort !== 'rank';
  }

  function sortValue(node, key) {
    if (key === 'label') return String(node.dataset.exchangeLabel || '').toLowerCase();
    if (key === 'fee') return numberOrNull(node.dataset.feeRate);
    if (key === 'coverage') return numberOrNull(node.dataset.coverageCount);
    if (key === 'board') return numberOrNull(node.dataset.boardCount);
    if (key === 'sales') return numberOrNull(node.dataset.salesCount);
    if (key === 'volume') return numberOrNull(node.dataset.volumeCount);
    return numberOrNull(node.dataset.originalIndex) || 0;
  }

  function compareNodes(a, b) {
    if (state.sort === 'rank') {
      return Number(a.dataset.originalIndex || 0) - Number(b.dataset.originalIndex || 0);
    }

    const sortMap = {
      feeAsc: { key: 'fee', direction: 'asc' },
      coverageDesc: { key: 'coverage', direction: 'desc' },
      boardDesc: { key: 'board', direction: 'desc' },
      salesDesc: { key: 'sales', direction: 'desc' },
      volumeDesc: { key: 'volume', direction: 'desc' },
      nameAsc: { key: 'label', direction: 'asc' },
    };
    const sort = sortMap[state.sort] || sortMap.nameAsc;
    const direction = sort.direction === 'desc' ? -1 : 1;
    const aValue = sortValue(a, sort.key);
    const bValue = sortValue(b, sort.key);
    const aMissing = aValue == null || aValue === '';
    const bMissing = bValue == null || bValue === '';
    if (aMissing && bMissing) return Number(a.dataset.originalIndex || 0) - Number(b.dataset.originalIndex || 0);
    if (aMissing) return 1;
    if (bMissing) return -1;
    if (typeof aValue === 'string' || typeof bValue === 'string') {
      return String(aValue).localeCompare(String(bValue), 'ja') * direction;
    }
    if (aValue === bValue) return Number(a.dataset.originalIndex || 0) - Number(b.dataset.originalIndex || 0);
    return aValue > bValue ? direction : -direction;
  }

  function applyOrdering() {
    if (grid) {
      [...cards].sort(compareNodes).forEach(card => grid.appendChild(card));
    }
    if (tableBody) {
      [...rows].sort(compareNodes).forEach(row => tableBody.appendChild(row));
    }
  }

  function updateFreshnessLabel() {
    if (!generatedLabel || !config.meta || !config.meta.generatedAt) return;
    const generatedAt = new Date(config.meta.generatedAt);
    if (Number.isNaN(generatedAt.getTime())) return;
    const ageMs = Date.now() - generatedAt.getTime();
    const ageMinutes = Math.max(0, Math.round(ageMs / 60000));
    const label = ageMinutes < 1 ? '一覧データ更新済み（生成: 1分未満）' : `一覧データ更新済み（生成: ${ageMinutes}分前）`;
    generatedLabel.textContent = label;
  }

  function syncFilterControls() {
    filterInputs.forEach((input) => {
      const key = input.dataset.exchangeFilter;
      input.checked = Boolean(state.filters[key]);
    });
    if (sortSelect) sortSelect.value = state.sort;
    if (clearButton) clearButton.disabled = !hasActiveFilters();
  }

  function syncView() {
    const tableMode = state.view === 'table';
    if (grid) grid.hidden = tableMode;
    if (tableWrap) tableWrap.hidden = !tableMode;
    viewButtons.forEach((button) => {
      const active = button.dataset.exchangeView === state.view;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
    writeStoredValue(storageKeys.view, state.view);
  }

  function updateVisibility() {
    const query = getQuery();
    let count = 0;

    for (const item of items) {
      const node = item.card || item.row;
      const visible = matchesQuery(node, query) && matchesFilters(node);
      if (item.card) item.card.hidden = !visible;
      if (item.row) item.row.hidden = !visible;
      if (visible) count += 1;
    }

    if (visibleCount) visibleCount.textContent = String(count);
    if (status) {
      const prefix = hasActiveFilters() ? '絞り込み: ' : '掲載: ';
      if (visibleCount && visibleCount.parentNode === status) {
        if (status.firstChild) status.firstChild.nodeValue = prefix;
      } else {
        status.textContent = `${prefix}${count}社`;
      }
    }
    if (meta) {
      const total = config.meta && Number(config.meta.exchangeCount) ? Number(config.meta.exchangeCount) : items.length;
      const filterText = activeFilterCount() > 0 ? ` / 条件 ${activeFilterCount()}件` : '';
      meta.textContent = `${count} / ${total} 社${filterText}`;
    }
    if (empty) empty.classList.toggle('hidden', count > 0);
    syncFilterControls();
    applyOrdering();
  }

  function selectedExchanges() {
    return Array.from(state.compare).map(id => exchangeById.get(id)).filter(Boolean);
  }

  function ensureCompareBar() {
    let bar = document.getElementById('exchange-compare-bar');
    if (bar) return bar;
    bar = document.createElement('aside');
    bar.id = 'exchange-compare-bar';
    bar.className = 'exchange-compare-bar';
    bar.hidden = true;
    bar.setAttribute('aria-live', 'polite');
    document.body.appendChild(bar);
    return bar;
  }

  function ensureCompareDialog() {
    let dialog = document.getElementById('exchange-compare-dialog');
    if (dialog) return dialog;
    dialog = document.createElement('dialog');
    dialog.id = 'exchange-compare-dialog';
    dialog.className = 'exchange-compare-dialog';
    dialog.setAttribute('aria-labelledby', 'exchange-compare-dialog-title');
    document.body.appendChild(dialog);
    return dialog;
  }

  function renderCompareBar() {
    const bar = ensureCompareBar();
    const selected = selectedExchanges();
    if (selected.length === 0) {
      bar.hidden = true;
      bar.innerHTML = '';
      return;
    }

    bar.hidden = false;
    bar.innerHTML = [
      '<div class="exchange-compare-bar__summary">',
      `  <strong>${selected.length}/${maxCompare} 社を比較リストに追加</strong>`,
      `  <div class="exchange-compare-bar__chips">${selected.map(exchange => [
        `<span class="exchange-compare-chip" style="--exchange-accent:${escapeHtml(exchange.accent)}">`,
        `  <span>${escapeHtml(exchange.label)}</span>`,
        `  <button type="button" data-exchange-compare-remove="${escapeHtml(exchange.id)}" aria-label="${escapeHtml(exchange.label)}を比較から外す">×</button>`,
        '</span>',
      ].join('')).join('')}</div>`,
      '</div>',
      '<div class="exchange-compare-bar__actions">',
      '  <button type="button" data-exchange-compare-clear>クリア</button>',
      '  <button type="button" data-exchange-compare-open>比較する</button>',
      '</div>',
    ].join('');
  }

  function bestValues(selected) {
    const finiteFees = selected.map(exchange => exchange.feeRate).filter(value => Number.isFinite(Number(value)));
    const coverages = selected.map(exchange => Number(exchange.coverageCount)).filter(Number.isFinite);
    const boards = selected.map(exchange => Number(exchange.boardCount)).filter(Number.isFinite);
    const volumes = selected.map(exchange => Number(exchange.volumeCount)).filter(Number.isFinite);
    return {
      fee: finiteFees.length > 0 ? Math.min(...finiteFees) : null,
      coverage: coverages.length > 0 ? Math.max(...coverages) : null,
      board: boards.length > 0 ? Math.max(...boards) : null,
      volume: volumes.length > 0 ? Math.max(...volumes) : null,
    };
  }

  function compareCell(value, isBest = false) {
    return `<td class="${isBest ? 'is-best' : ''}">${escapeHtml(value)}</td>`;
  }

  function exchangeActionAttrs(link) {
    const href = String(link && link.href || '/');
    const isExternal = /^https?:\/\//i.test(href);
    const hasTarget = Object.prototype.hasOwnProperty.call(link || {}, 'target');
    const target = hasTarget ? link.target : (isExternal ? '_blank' : null);
    const rel = link && link.rel ? link.rel : (isExternal ? 'noopener noreferrer' : null);
    const referrerPolicy = link && link.referrerPolicy ? link.referrerPolicy : null;
    return [
      `href="${escapeHtml(href)}"`,
      target ? `target="${escapeHtml(target)}"` : '',
      rel ? `rel="${escapeHtml(rel)}"` : '',
      referrerPolicy ? `referrerpolicy="${escapeHtml(referrerPolicy)}"` : '',
    ].filter(Boolean).join(' ');
  }

  function referralLinkForExchange(exchange) {
    if (!exchange || !exchange.referralUrl) return null;
    return {
      href: exchange.referralUrl,
      target: Object.prototype.hasOwnProperty.call(exchange, 'referralTarget')
        ? exchange.referralTarget
        : '_blank',
      rel: exchange.referralRel || 'sponsored noopener noreferrer',
      referrerPolicy: exchange.referralReferrerPolicy || null,
      trackingPixelUrl: exchange.referralTrackingPixelUrl || null,
    };
  }

  function referralCell(exchange) {
    const link = referralLinkForExchange(exchange);
    if (!link) return compareCell('-');
    const pixel = link.trackingPixelUrl
      ? `<img src="${escapeHtml(link.trackingPixelUrl)}" width="1" height="1" border="0" alt="">`
      : '';
    return `<td><a class="exchange-compare-dialog__link" ${exchangeActionAttrs(link)}>PR 公式で確認${pixel}</a></td>`;
  }

  function renderCompareDialog() {
    const selected = selectedExchanges();
    const dialog = ensureCompareDialog();
    if (selected.length === 0) return;
    const best = bestValues(selected);
    const headerCells = selected.map(exchange => (
      `<th style="--exchange-accent:${escapeHtml(exchange.accent)}"><span class="exchange-index-row__identity"><span class="exchange-index-logo exchange-index-logo--sm" aria-hidden="true">${escapeHtml(exchange.shortLabel)}</span><span>${escapeHtml(exchange.label)}</span></span></th>`
    )).join('');
    const row = (label, cells) => `<tr><th scope="row">${escapeHtml(label)}</th>${cells.join('')}</tr>`;

    dialog.innerHTML = [
      '<div class="exchange-compare-dialog__header">',
      '  <div>',
      '    <h3 id="exchange-compare-dialog-title">クイック比較</h3>',
      '    <p>選んだ取引所だけを横並びで確認できます。最良値は淡い緑で表示しています。</p>',
      '  </div>',
      '  <button class="exchange-compare-dialog__close" type="button" data-exchange-compare-dialog-close>閉じる</button>',
      '</div>',
      '<div class="exchange-compare-dialog__body">',
      '  <table class="exchange-compare-dialog__table">',
      '    <thead><tr><th>項目</th>' + headerCells + '</tr></thead>',
      '    <tbody>',
      row('取引所手数料', selected.map(exchange => compareCell(exchange.feeLabel, best.fee != null && Number(exchange.feeRate) === best.fee))),
      row('取扱銘柄数', selected.map(exchange => compareCell(`${formatCount(exchange.coverageCount)}銘柄`, Number(exchange.coverageCount) === best.coverage))),
      row('板取引対応', selected.map(exchange => compareCell(`${formatCount(exchange.boardCount)}銘柄`, Number(exchange.boardCount) === best.board))),
      row('販売所スプレッド', selected.map(exchange => compareCell(exchange.salesCount > 0 ? `${formatCount(exchange.salesCount)}銘柄` : 'データ待ち'))),
      row('出来高データ', selected.map(exchange => compareCell(exchange.volumeCount > 0 ? `${formatCount(exchange.volumeCount)}銘柄` : 'データ待ち', Number(exchange.volumeCount) === best.volume))),
      row('レバレッジ', selected.map(exchange => compareCell(exchange.hasLeverage ? '対応あり' : '現物中心'))),
      row('詳細ページ', selected.map(exchange => `<td><a class="exchange-compare-dialog__link" href="${escapeHtml(exchange.path)}">${escapeHtml(exchange.label)}の詳細へ</a></td>`)),
      row('PRリンク', selected.map(referralCell)),
      '    </tbody>',
      '  </table>',
      '</div>',
    ].join('');
  }

  function openCompareDialog() {
    const dialog = ensureCompareDialog();
    renderCompareDialog();
    if (typeof dialog.showModal === 'function') {
      dialog.showModal();
    } else {
      dialog.setAttribute('open', '');
    }
  }

  function closeCompareDialog() {
    const dialog = ensureCompareDialog();
    if (typeof dialog.close === 'function') {
      dialog.close();
    } else {
      dialog.removeAttribute('open');
    }
  }

  function syncCompare() {
    document.querySelectorAll('[data-exchange-compare]').forEach((input) => {
      const exchangeId = input.dataset.exchangeCompare;
      const active = state.compare.has(exchangeId);
      input.checked = active;
      input.disabled = !active && state.compare.size >= maxCompare;
      const label = input.closest('.market-compare-toggle');
      if (label) label.classList.toggle('is-active', active);
    });
    renderCompareBar();
  }

  function setCompare(exchangeId, active) {
    if (!exchangeById.has(exchangeId)) return;
    if (active) {
      if (state.compare.size >= maxCompare && !state.compare.has(exchangeId)) return;
      state.compare.add(exchangeId);
    } else {
      state.compare.delete(exchangeId);
    }
    syncCompare();
  }

  function clearFilters() {
    if (searchInput) searchInput.value = '';
    state.sort = 'rank';
    Object.keys(state.filters).forEach((key) => {
      state.filters[key] = false;
    });
    updateVisibility();
  }

  updateFreshnessLabel();
  syncView();
  updateVisibility();
  syncCompare();
  window.setInterval(updateFreshnessLabel, 30000);

  if (searchInput) {
    searchInput.addEventListener('input', updateVisibility);
  }

  if (sortSelect) {
    sortSelect.addEventListener('change', () => {
      state.sort = sortSelect.value || 'rank';
      updateVisibility();
    });
  }

  filterInputs.forEach((input) => {
    input.addEventListener('change', () => {
      const key = input.dataset.exchangeFilter;
      if (Object.prototype.hasOwnProperty.call(state.filters, key)) {
        state.filters[key] = input.checked;
      }
      updateVisibility();
    });
  });

  viewButtons.forEach((button) => {
    button.addEventListener('click', () => {
      state.view = button.dataset.exchangeView === 'table' ? 'table' : 'cards';
      syncView();
    });
  });

  if (clearButton) clearButton.addEventListener('click', clearFilters);

  document.addEventListener('change', (event) => {
    const input = event.target && event.target.closest ? event.target.closest('[data-exchange-compare]') : null;
    if (!input) return;
    setCompare(input.dataset.exchangeCompare, input.checked);
  });

  document.addEventListener('click', (event) => {
    const target = event.target && event.target.closest ? event.target : null;
    if (!target) return;

    const remove = target.closest('[data-exchange-compare-remove]');
    if (remove) {
      setCompare(remove.dataset.exchangeCompareRemove, false);
      return;
    }

    if (target.closest('[data-exchange-compare-clear]')) {
      state.compare.clear();
      syncCompare();
      return;
    }

    if (target.closest('[data-exchange-compare-open]')) {
      openCompareDialog();
      return;
    }

    if (target.closest('[data-exchange-compare-dialog-close]')) {
      closeCompareDialog();
    }
  });
});
