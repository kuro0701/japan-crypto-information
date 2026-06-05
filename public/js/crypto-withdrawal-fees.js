(function () {
  const root = document.querySelector('[data-crypto-withdrawal-tool]');
  if (!root) return;

  const STORAGE_KEYS = {
    exchanges: 'okj.cryptoWithdrawal.selectedExchanges.v1',
    pinnedAssets: 'okj.cryptoWithdrawal.pinnedAssets.v1',
  };
  const params = new URLSearchParams(window.location.search);
  const priority = ['BTC', 'ETH', 'XRP', 'SOL', 'ADA', 'DOGE', 'BNB', 'BCH', 'LTC', 'XLM', 'DOT', 'LINK', 'DAI', 'SHIB', 'PEPE'];

  const state = {
    data: null,
    view: 'matrix',
    query: params.get('asset') || '',
    network: 'all',
    selectedExchanges: new Set(),
    pinnedAssets: new Set(readStoredList(STORAGE_KEYS.pinnedAssets).map(normalizeAsset).filter(Boolean)),
    rates: null,
    ratesMeta: null,
    ratesLoading: false,
  };

  function escapeHtml(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, (char) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    }[char]));
  }

  function normalizeAsset(value) {
    return String(value || '').trim().toUpperCase();
  }

  function readStoredList(key) {
    try {
      const parsed = JSON.parse(localStorage.getItem(key) || '[]');
      return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
    } catch (_err) {
      return [];
    }
  }

  function writeStoredList(key, list) {
    try {
      localStorage.setItem(key, JSON.stringify(Array.from(list).filter(Boolean)));
    } catch (_err) {
      // Local storage is optional.
    }
  }

  function initializeState(data) {
    state.data = data;
    const exchangeIds = data.exchanges.map(exchange => exchange.id);
    const validIds = new Set(exchangeIds);
    const paramExchange = params.get('exchange');
    const stored = readStoredList(STORAGE_KEYS.exchanges).filter(id => validIds.has(id));
    const initial = paramExchange && validIds.has(paramExchange)
      ? [paramExchange]
      : (stored.length > 0 ? stored : exchangeIds);
    state.selectedExchanges = new Set(initial);
  }

  function compareAssets(a, b) {
    const ap = state.pinnedAssets.has(a);
    const bp = state.pinnedAssets.has(b);
    if (ap !== bp) return ap ? -1 : 1;

    const ai = priority.indexOf(a);
    const bi = priority.indexOf(b);
    if (ai !== -1 || bi !== -1) {
      if (ai === -1) return 1;
      if (bi === -1) return -1;
      return ai - bi;
    }
    return String(a).localeCompare(String(b), 'en');
  }

  function compareRows(a, b) {
    const assetDiff = compareAssets(a.asset, b.asset);
    if (assetDiff !== 0) return assetDiff;
    const exDiff = exchangeIndex(a.exchangeId) - exchangeIndex(b.exchangeId);
    if (exDiff !== 0) return exDiff;
    const af = feeSortValue(a);
    const bf = feeSortValue(b);
    if (af !== bf) return af - bf;
    return String(a.network).localeCompare(String(b.network), 'ja');
  }

  function compareBestCells(a, b) {
    const af = feeSortValue(a.best);
    const bf = feeSortValue(b.best);
    if (af !== bf) return af - bf;
    return exchangeIndex(a.exchange.id) - exchangeIndex(b.exchange.id);
  }

  function exchangeIndex(exchangeId) {
    return state.data.exchanges.findIndex(exchange => exchange.id === exchangeId);
  }

  function selectedExchangeList() {
    return state.data.exchanges.filter(exchange => state.selectedExchanges.has(exchange.id));
  }

  function isFree(row) {
    return row && (row.feeMin === 0 || row.fee === '無料');
  }

  function feeSortValue(row) {
    if (!row || row.feeMin == null) return Number.POSITIVE_INFINITY;
    const value = Number(row.feeMin);
    return Number.isFinite(value) ? value : Number.POSITIVE_INFINITY;
  }

  function feeClass(row) {
    if (!row) return '';
    if (isFree(row)) return 'is-free';
    if (row.feeMin != null && row.feeMax != null && row.feeMin !== row.feeMax) return 'is-range';
    return 'is-paid';
  }

  function rowMatches(row) {
    const query = state.query.trim().toUpperCase();
    const haystack = [row.asset, row.currency, row.exchange, row.network, row.fee, row.note]
      .join(' ')
      .toUpperCase();
    if (query && !haystack.includes(query)) return false;
    if (!state.selectedExchanges.has(row.exchangeId)) return false;
    if (state.network !== 'all' && row.network !== state.network) return false;
    return true;
  }

  function filteredRows() {
    return state.data.rows.filter(rowMatches).sort(compareRows);
  }

  function allNetworks() {
    return Array.from(new Set(state.data.rows.map(row => row.network))).sort((a, b) => a.localeCompare(b, 'ja'));
  }

  function formatJpyAmount(value) {
    if (!Number.isFinite(value)) return '';
    if (value === 0) return '0円';
    if (value > 0 && value < 1) return '1円未満';
    if (value < 100) {
      return `${value.toLocaleString('ja-JP', { maximumFractionDigits: 1 })}円`;
    }
    return `${Math.round(value).toLocaleString('ja-JP')}円`;
  }

  function renderJpyEstimate(row) {
    if (!row || !state.rates) return '';
    const rate = state.rates[normalizeAsset(row.currency || row.asset)];
    const minFee = Number(row.feeMin);
    const maxFee = row.feeMax == null ? minFee : Number(row.feeMax);
    if (!rate || !Number.isFinite(rate.midPrice) || !Number.isFinite(minFee)) return '';

    const minJpy = minFee * rate.midPrice;
    const maxJpy = Number.isFinite(maxFee) ? maxFee * rate.midPrice : minJpy;
    const label = Math.abs(maxJpy - minJpy) > 0.5
      ? `約${formatJpyAmount(minJpy)}〜${formatJpyAmount(maxJpy)}`
      : `約${formatJpyAmount(minJpy)}`;
    return `<span class="cw-jpy">${escapeHtml(label)}</span>`;
  }

  function hintForRow(row) {
    if (!row || !row.note) return '';
    if (/変動手数料/.test(row.note)) {
      return `ネットワーク混雑状況などに応じて変動します。現在の表示目安: ${row.fee}`;
    }
    if (row.feeMin != null && row.feeMax != null && row.feeMin !== row.feeMax) {
      return `手数料は範囲または設定値で変わります。現在の表示範囲: ${row.fee}`;
    }
    if (/混雑/.test(row.note)) {
      return `公式データで混雑表示があります。出金前に公式画面で最新状態を確認してください。`;
    }
    return '';
  }

  function renderNote(row) {
    if (!row || !row.note) return '';
    const hint = hintForRow(row);
    if (!hint) return `<span class="cw-note">${escapeHtml(row.note)}</span>`;
    return [
      `<span class="cw-note cw-note--hint" tabindex="0" title="${escapeHtml(hint)}" aria-label="${escapeHtml(`${row.note}。${hint}`)}">`,
      escapeHtml(row.note),
      `<span class="cw-tooltip" aria-hidden="true">${escapeHtml(hint)}</span>`,
      '</span>',
    ].join('');
  }

  function renderFee(row, options = {}) {
    if (!row) return '<span class="cw-empty">-</span>';
    const network = options.hideNetwork ? '' : `<span class="cw-network">${escapeHtml(row.network)}</span>`;
    const min = row.minWithdrawal ? `<span class="cw-min">最小 ${escapeHtml(row.minWithdrawal)} ${escapeHtml(row.currency)}</span>` : '';
    const jpy = options.hideJpy ? '' : renderJpyEstimate(row);
    const note = row.note && !options.hideNote ? renderNote(row) : '';
    return [
      `<span class="cw-fee ${feeClass(row)}">${escapeHtml(row.fee)}</span>`,
      jpy,
      network,
      min,
      note,
    ].filter(Boolean).join('');
  }

  function renderBestBadge() {
    return '<span class="cw-best-badge">最安</span>';
  }

  function renderSourceLink(exchange, className = 'cw-source-link') {
    return [
      `<a class="${className}" href="${escapeHtml(exchange.sourceUrl)}" target="_blank" rel="noopener" aria-label="${escapeHtml(exchange.label)}の公式手数料表を開く">`,
      `<span>${escapeHtml(exchange.label)}</span><span aria-hidden="true">↗</span>`,
      '</a>',
    ].join('');
  }

  function renderAssetPin(asset) {
    const pinned = state.pinnedAssets.has(asset);
    return [
      `<button type="button" class="cw-pin ${pinned ? 'is-pinned' : ''}" data-cw-pin-asset="${escapeHtml(asset)}" aria-pressed="${pinned ? 'true' : 'false'}" aria-label="${escapeHtml(asset)}をお気に入り${pinned ? 'から外す' : 'に追加'}">`,
      pinned ? '★' : '☆',
      '</button>',
    ].join('');
  }

  function renderAssetCell(asset) {
    return [
      '<div class="cw-asset-action">',
      renderAssetPin(asset),
      `<button type="button" class="cw-asset-filter-button" data-asset-filter="${escapeHtml(asset)}">${escapeHtml(asset)}</button>`,
      '</div>',
    ].join('');
  }

  function renderNetworkDetails(entries) {
    if (entries.length <= 1) return '';
    const hidden = entries.slice(1);
    return [
      '<details class="cw-network-details">',
      `<summary>+他${hidden.length}ネットワーク</summary>`,
      '<div class="cw-network-detail-list">',
      hidden.map(row => [
        '<div class="cw-network-detail-row">',
        `<span class="cw-network-detail-name">${escapeHtml(row.network)}</span>`,
        `<span class="cw-network-detail-fee">${renderFee(row, { hideNetwork: true, hideNote: true })}</span>`,
        '</div>',
      ].join('')).join(''),
      '</div>',
      '</details>',
    ].join('');
  }

  function buildMatrixModel(rows, exchanges) {
    const assets = Array.from(new Set(rows.map(row => row.asset))).sort(compareAssets);
    const byAssetExchange = new Map();
    for (const row of rows) {
      const key = `${row.asset}::${row.exchangeId}`;
      if (!byAssetExchange.has(key)) byAssetExchange.set(key, []);
      byAssetExchange.get(key).push(row);
    }

    const bestFeeByAsset = new Map();
    for (const asset of assets) {
      const values = [];
      for (const exchange of exchanges) {
        const entries = (byAssetExchange.get(`${asset}::${exchange.id}`) || []).sort(compareRows);
        if (entries[0] && Number.isFinite(feeSortValue(entries[0]))) values.push(feeSortValue(entries[0]));
      }
      if (values.length > 0) bestFeeByAsset.set(asset, Math.min(...values));
    }

    return { assets, byAssetExchange, bestFeeByAsset };
  }

  function renderMatrix(rows) {
    const exchanges = selectedExchangeList();
    const { assets, byAssetExchange, bestFeeByAsset } = buildMatrixModel(rows, exchanges);

    const body = assets.map((asset) => {
      const rowBestFee = bestFeeByAsset.get(asset);
      const cells = exchanges.map((exchange) => {
        const entries = (byAssetExchange.get(`${asset}::${exchange.id}`) || []).sort(compareRows);
        if (entries.length === 0) {
          return `<td data-label="${escapeHtml(exchange.label)}"><span class="cw-empty">-</span></td>`;
        }
        const best = entries[0];
        const isBest = Number.isFinite(rowBestFee) && feeSortValue(best) === rowBestFee;
        const bestNetwork = `<span class="cw-network-chip">${escapeHtml(best.network)}</span>`;
        return [
          `<td class="${isBest ? 'is-best' : ''}" data-label="${escapeHtml(exchange.label)}">`,
          '<div class="cw-cell-topline">',
          isBest ? renderBestBadge() : '',
          renderSourceLink(exchange, 'cw-cell-source'),
          '</div>',
          `<div class="cw-cell-fee">${renderFee(best, { hideNetwork: true })}</div>`,
          `<div class="cw-network-list">${bestNetwork}</div>`,
          renderNetworkDetails(entries),
          '</td>',
        ].join('');
      }).join('');
      return [
        '<tr>',
        `<th scope="row" class="cw-asset-cell">${renderAssetCell(asset)}</th>`,
        cells,
        '</tr>',
      ].join('');
    }).join('');

    return [
      '<div class="cw-matrix-view">',
      '<div class="cw-table-shell cw-table-shell--matrix" tabindex="0">',
      '<table class="cw-table cw-table--matrix">',
      '<thead><tr>',
      '<th class="cw-asset-head">銘柄</th>',
      exchanges.map(exchange => `<th>${renderSourceLink(exchange)}</th>`).join(''),
      '</tr></thead>',
      `<tbody>${body || emptyRow(exchanges.length + 1)}</tbody>`,
      '</table>',
      '</div>',
      renderMobileCards(rows, exchanges, assets, byAssetExchange, bestFeeByAsset),
      '</div>',
    ].join('');
  }

  function renderMobileCards(rows, exchanges, assets, byAssetExchange, bestFeeByAsset) {
    if (rows.length === 0) return emptyState('cw-mobile-cards');
    const sections = assets.map((asset) => {
      const rowBestFee = bestFeeByAsset.get(asset);
      const cards = exchanges.map((exchange) => {
        const entries = (byAssetExchange.get(`${asset}::${exchange.id}`) || []).sort(compareRows);
        return { exchange, entries, best: entries[0] || null };
      }).sort(compareBestCells);

      return [
        '<section class="cw-mobile-asset-card">',
        '<div class="cw-mobile-asset-head">',
        `<div>${renderAssetPin(asset)}<strong>${escapeHtml(asset)}</strong></div>`,
        `<button type="button" data-asset-filter="${escapeHtml(asset)}">絞り込み</button>`,
        '</div>',
        '<div class="cw-mobile-exchange-list">',
        cards.map(({ exchange, entries, best }) => {
          if (!best) {
            return [
              '<article class="cw-mobile-exchange-card is-empty">',
              `<div class="cw-mobile-exchange-top">${renderSourceLink(exchange, 'cw-source-link')}</div>`,
              '<span class="cw-empty">対応なし</span>',
              '</article>',
            ].join('');
          }
          const isBest = Number.isFinite(rowBestFee) && feeSortValue(best) === rowBestFee;
          return [
            `<article class="cw-mobile-exchange-card ${isBest ? 'is-best' : ''}">`,
            '<div class="cw-mobile-exchange-top">',
            renderSourceLink(exchange, 'cw-source-link'),
            isBest ? renderBestBadge() : '',
            '</div>',
            `<div class="cw-cell-fee">${renderFee(best, { hideNetwork: true })}</div>`,
            `<div class="cw-network-list"><span class="cw-network-chip">${escapeHtml(best.network)}</span></div>`,
            renderNetworkDetails(entries),
            '</article>',
          ].join('');
        }).join(''),
        '</div>',
        '</section>',
      ].join('');
    }).join('');

    return `<div class="cw-mobile-cards">${sections}</div>`;
  }

  function renderExchange(rows) {
    const sections = selectedExchangeList().map((exchange) => {
      const exchangeRows = rows.filter(row => row.exchangeId === exchange.id);
      if (exchangeRows.length === 0) return '';
      return [
        '<section class="cw-exchange-section">',
        `<div class="cw-exchange-heading"><h3>${escapeHtml(exchange.label)}</h3>${renderSourceLink(exchange)}</div>`,
        '<div class="cw-table-shell" tabindex="0">',
        '<table class="cw-table cw-table--detail">',
        '<thead><tr><th>銘柄</th><th>ネットワーク</th><th>出金手数料</th><th>最小出金</th><th>補足</th></tr></thead>',
        '<tbody>',
        exchangeRows.sort(compareRows).map(row => [
          '<tr>',
          `<th scope="row">${renderAssetPin(row.asset)}${escapeHtml(row.asset)}${row.currency !== row.asset ? `<span class="cw-subsymbol">${escapeHtml(row.currency)}</span>` : ''}</th>`,
          `<td data-label="ネットワーク">${escapeHtml(row.network)}</td>`,
          `<td data-label="出金手数料">${renderFee(row, { hideNetwork: true, hideNote: true })}</td>`,
          `<td data-label="最小出金">${row.minWithdrawal ? `${escapeHtml(row.minWithdrawal)} ${escapeHtml(row.currency)}` : '<span class="cw-empty">-</span>'}</td>`,
          `<td data-label="補足">${row.note ? renderNote(row) : '<span class="cw-empty">-</span>'}</td>`,
          '</tr>',
        ].join('')).join(''),
        '</tbody></table></div></section>',
      ].join('');
    }).filter(Boolean).join('');
    return sections || emptyState();
  }

  function renderNetwork(rows) {
    return [
      '<div class="cw-table-shell" tabindex="0">',
      '<table class="cw-table cw-table--detail">',
      '<thead><tr><th>銘柄</th><th>取引所</th><th>ネットワーク</th><th>出金手数料</th><th>最小出金</th></tr></thead>',
      '<tbody>',
      rows.map(row => [
        '<tr>',
        `<th scope="row">${renderAssetPin(row.asset)}${escapeHtml(row.asset)}${row.currency !== row.asset ? `<span class="cw-subsymbol">${escapeHtml(row.currency)}</span>` : ''}</th>`,
        `<td data-label="取引所">${escapeHtml(row.exchange)}</td>`,
        `<td data-label="ネットワーク">${escapeHtml(row.network)}</td>`,
        `<td data-label="出金手数料">${renderFee(row, { hideNetwork: true, hideNote: true })}</td>`,
        `<td data-label="最小出金">${row.minWithdrawal ? `${escapeHtml(row.minWithdrawal)} ${escapeHtml(row.currency)}` : '<span class="cw-empty">-</span>'}</td>`,
        '</tr>',
      ].join('')).join('') || emptyRow(5),
      '</tbody></table></div>',
    ].join('');
  }

  function emptyRow(colspan) {
    return `<tr><td class="cw-empty-row" colspan="${colspan}">該当する行がありません</td></tr>`;
  }

  function emptyState(className = '') {
    return `<div class="cw-empty-panel ${className}">該当する行がありません</div>`;
  }

  function renderAssetRail(rows) {
    const assets = Array.from(new Set(rows.map(row => row.asset))).sort(compareAssets).slice(0, 22);
    if (assets.length === 0) return '';
    const queryAsset = normalizeAsset(state.query);
    return [
      '<div class="cw-asset-rail" aria-label="銘柄ショートカット">',
      `<button type="button" data-asset-filter="" class="${state.query ? '' : 'is-active'}">全て</button>`,
      assets.map(asset => [
        `<button type="button" data-asset-filter="${escapeHtml(asset)}" class="${queryAsset === asset ? 'is-active' : ''}">`,
        state.pinnedAssets.has(asset) ? '<span aria-hidden="true">★</span>' : '',
        `<span>${escapeHtml(asset)}</span>`,
        '</button>',
      ].join('')).join(''),
      '</div>',
    ].join('');
  }

  function renderStats(rows) {
    const assetCount = new Set(rows.map(row => row.asset)).size;
    const exchangeCount = state.selectedExchanges.size;
    const freeCount = rows.filter(isFree).length;
    const rateCount = state.rates ? Object.keys(state.rates).length : 0;
    return [
      '<div class="cw-stats">',
      statCard('銘柄', assetCount),
      statCard('表示取引所', exchangeCount),
      statCard('ネットワーク行', rows.length),
      statCard('JPY概算', state.ratesLoading ? '取得中' : rateCount || '-'),
      statCard('無料表示', freeCount),
      '</div>',
    ].join('');
  }

  function statCard(label, value) {
    return `<div class="cw-stat"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`;
  }

  function renderExchangeFilter() {
    const exchanges = state.data.exchanges;
    return [
      '<fieldset class="cw-exchange-filter">',
      `<legend>マイ取引所 <span>${state.selectedExchanges.size}/${exchanges.length}</span></legend>`,
      '<div class="cw-exchange-checks">',
      exchanges.map(exchange => [
        '<label class="cw-check">',
        `<input type="checkbox" data-cw-exchange-toggle value="${escapeHtml(exchange.id)}"${state.selectedExchanges.has(exchange.id) ? ' checked' : ''}>`,
        `<span>${escapeHtml(exchange.label)}</span>`,
        '</label>',
      ].join('')).join(''),
      '<button type="button" class="cw-filter-reset" data-cw-exchanges-reset>全社</button>',
      '</div>',
      '</fieldset>',
    ].join('');
  }

  function renderControls() {
    const networks = allNetworks();
    return [
      '<div class="cw-controls">',
      '<label class="cw-field cw-field--search"><span>銘柄検索</span><input type="search" data-cw-query value="' + escapeHtml(state.query) + '" placeholder="BTC, ETH, Solana"></label>',
      '<label class="cw-field"><span>ネットワーク</span><select data-cw-network>',
      '<option value="all">全ネットワーク</option>',
      networks.map(network => `<option value="${escapeHtml(network)}"${state.network === network ? ' selected' : ''}>${escapeHtml(network)}</option>`).join(''),
      '</select></label>',
      '<div class="cw-view-switch" role="group" aria-label="表示モード">',
      viewButton('matrix', '銘柄比較'),
      viewButton('exchange', '取引所別'),
      viewButton('network', 'ネットワーク一覧'),
      '</div>',
      '</div>',
      renderExchangeFilter(),
    ].join('');
  }

  function viewButton(view, label) {
    return `<button type="button" data-cw-view="${view}" class="${state.view === view ? 'is-active' : ''}">${label}</button>`;
  }

  function formatShortDateTime(value) {
    const time = Date.parse(value || '');
    if (!Number.isFinite(time)) return '';
    return new Intl.DateTimeFormat('ja-JP', {
      month: 'numeric',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(time));
  }

  function renderRateStatus() {
    if (state.ratesLoading) return '<span>JPY概算 取得中</span>';
    if (!state.ratesMeta || !state.ratesMeta.count) return '<span>JPY概算 取得不可</span>';
    const updated = formatShortDateTime(state.ratesMeta.updatedAt);
    return `<span>JPY概算 ${escapeHtml(state.ratesMeta.count)}銘柄${updated ? ` / ${escapeHtml(updated)}` : ''}</span>`;
  }

  function render() {
    const rows = filteredRows();
    const table = state.view === 'exchange'
      ? renderExchange(rows)
      : state.view === 'network'
        ? renderNetwork(rows)
        : renderMatrix(rows);

    root.innerHTML = [
      '<div class="cw-topline">',
      `<span>確認日 ${escapeHtml(state.data.checkedDate)}</span>`,
      '<span>外部アドレスへの出金手数料</span>',
      renderRateStatus(),
      '</div>',
      renderStats(rows),
      renderControls(),
      renderAssetRail(rows),
      table,
      '<div class="cw-source-row">',
      state.data.exchanges.map(exchange => renderSourceLink(exchange)).join(''),
      '</div>',
    ].join('');

    bind();
  }

  function bind() {
    const queryInput = root.querySelector('[data-cw-query]');
    if (queryInput) {
      queryInput.addEventListener('input', () => {
        state.query = queryInput.value;
        render();
        const nextInput = root.querySelector('[data-cw-query]');
        if (nextInput) {
          nextInput.focus();
          nextInput.setSelectionRange(nextInput.value.length, nextInput.value.length);
        }
      });
    }

    root.querySelector('[data-cw-network]')?.addEventListener('change', (event) => {
      state.network = event.target.value;
      render();
    });

    root.querySelectorAll('[data-cw-view]').forEach((button) => {
      button.addEventListener('click', () => {
        state.view = button.dataset.cwView;
        render();
      });
    });

    root.querySelectorAll('[data-asset-filter]').forEach((button) => {
      button.addEventListener('click', () => {
        state.query = button.dataset.assetFilter || '';
        render();
      });
    });

    root.querySelectorAll('[data-cw-pin-asset]').forEach((button) => {
      button.addEventListener('click', (event) => {
        event.stopPropagation();
        const asset = normalizeAsset(button.dataset.cwPinAsset);
        if (!asset) return;
        if (state.pinnedAssets.has(asset)) {
          state.pinnedAssets.delete(asset);
        } else {
          state.pinnedAssets.add(asset);
        }
        writeStoredList(STORAGE_KEYS.pinnedAssets, state.pinnedAssets);
        render();
      });
    });

    root.querySelectorAll('[data-cw-exchange-toggle]').forEach((input) => {
      input.addEventListener('change', () => {
        const checked = Array.from(root.querySelectorAll('[data-cw-exchange-toggle]:checked')).map(item => item.value);
        if (checked.length === 0) {
          input.checked = true;
          return;
        }
        state.selectedExchanges = new Set(checked);
        writeStoredList(STORAGE_KEYS.exchanges, state.selectedExchanges);
        render();
      });
    });

    root.querySelector('[data-cw-exchanges-reset]')?.addEventListener('click', () => {
      state.selectedExchanges = new Set(state.data.exchanges.map(exchange => exchange.id));
      writeStoredList(STORAGE_KEYS.exchanges, state.selectedExchanges);
      render();
    });
  }

  function buildRates(report) {
    const groups = new Map();
    for (const row of (report && report.rows) || []) {
      const symbol = normalizeAsset(row.baseCurrency);
      const latest = row.latest || {};
      const price = Number(latest.midPrice);
      if (!symbol || !Number.isFinite(price) || price <= 0) continue;
      if (!groups.has(symbol)) groups.set(symbol, []);
      groups.get(symbol).push({
        price,
        updatedAt: latest.priceTimestamp || latest.capturedAt || (report.meta && report.meta.latestCapturedAt) || null,
      });
    }

    const rates = {};
    let newest = report && report.meta && report.meta.latestCapturedAt;
    for (const [symbol, items] of groups.entries()) {
      const prices = items.map(item => item.price).sort((a, b) => a - b);
      const mid = prices[Math.floor(prices.length / 2)];
      rates[symbol] = {
        midPrice: mid,
        sampleCount: items.length,
      };
      for (const item of items) {
        if (!newest || Date.parse(item.updatedAt || '') > Date.parse(newest || '')) newest = item.updatedAt;
      }
    }

    return {
      rates,
      meta: {
        count: Object.keys(rates).length,
        updatedAt: newest || null,
      },
    };
  }

  function loadRates() {
    fetch('/api/sales-spread', { headers: { accept: 'application/json' } })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((report) => {
        const built = buildRates(report);
        state.rates = built.rates;
        state.ratesMeta = built.meta;
      })
      .catch(() => {
        state.rates = null;
        state.ratesMeta = { count: 0, updatedAt: null };
      })
      .finally(() => {
        state.ratesLoading = false;
        render();
      });
  }

  function renderLoading() {
    root.innerHTML = [
      '<div class="cw-skeleton-wrap" aria-hidden="true">',
      '<div class="cw-skeleton cw-skeleton--line"></div>',
      '<div class="cw-skeleton-grid">',
      Array.from({ length: 5 }).map(() => '<div class="cw-skeleton cw-skeleton--card"></div>').join(''),
      '</div>',
      '<div class="cw-skeleton-table">',
      Array.from({ length: 8 }).map(() => '<div class="cw-skeleton cw-skeleton--row"></div>').join(''),
      '</div>',
      '</div>',
      '<span class="sr-only">比較データを読み込んでいます</span>',
    ].join('');
  }

  renderLoading();
  fetch('/data/crypto-withdrawal-fees.json')
    .then((res) => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    })
    .then((data) => {
      initializeState(data);
      state.ratesLoading = true;
      render();
      loadRates();
    })
    .catch(() => {
      root.innerHTML = '<div class="cw-empty-panel">比較データを読み込めませんでした</div>';
    });
}());
