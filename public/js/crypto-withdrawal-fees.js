(function () {
  const root = document.querySelector('[data-crypto-withdrawal-tool]');
  if (!root) return;

  const state = {
    data: null,
    view: 'matrix',
    query: new URLSearchParams(window.location.search).get('asset') || '',
    exchange: 'all',
    network: 'all',
  };

  const priority = ['BTC', 'ETH', 'XRP', 'SOL', 'ADA', 'DOGE', 'BNB', 'BCH', 'LTC', 'XLM', 'DOT', 'LINK', 'DAI', 'SHIB', 'PEPE'];

  function escapeHtml(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, (char) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    }[char]));
  }

  function compareAssets(a, b) {
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
    const af = a.feeMin == null ? Number.POSITIVE_INFINITY : a.feeMin;
    const bf = b.feeMin == null ? Number.POSITIVE_INFINITY : b.feeMin;
    if (af !== bf) return af - bf;
    return String(a.network).localeCompare(String(b.network), 'ja');
  }

  function exchangeIndex(exchangeId) {
    return state.data.exchanges.findIndex(exchange => exchange.id === exchangeId);
  }

  function isFree(row) {
    return row.feeMin === 0 || row.fee === '無料';
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
    if (state.exchange !== 'all' && row.exchangeId !== state.exchange) return false;
    if (state.network !== 'all' && row.network !== state.network) return false;
    return true;
  }

  function filteredRows() {
    return state.data.rows.filter(rowMatches).sort(compareRows);
  }

  function allNetworks() {
    return Array.from(new Set(state.data.rows.map(row => row.network))).sort((a, b) => a.localeCompare(b, 'ja'));
  }

  function renderFee(row, options = {}) {
    if (!row) return '<span class="cw-empty">-</span>';
    const network = options.hideNetwork ? '' : `<span class="cw-network">${escapeHtml(row.network)}</span>`;
    const min = row.minWithdrawal ? `<span class="cw-min">最小 ${escapeHtml(row.minWithdrawal)} ${escapeHtml(row.currency)}</span>` : '';
    const note = row.note && !options.hideNote ? `<span class="cw-note">${escapeHtml(row.note)}</span>` : '';
    return [
      `<span class="cw-fee ${feeClass(row)}">${escapeHtml(row.fee)}</span>`,
      network,
      min,
      note,
    ].filter(Boolean).join('');
  }

  function renderMatrix(rows) {
    const exchanges = state.data.exchanges.filter(exchange => state.exchange === 'all' || exchange.id === state.exchange);
    const assets = Array.from(new Set(rows.map(row => row.asset))).sort(compareAssets);
    const byAssetExchange = new Map();
    for (const row of rows) {
      const key = `${row.asset}::${row.exchangeId}`;
      if (!byAssetExchange.has(key)) byAssetExchange.set(key, []);
      byAssetExchange.get(key).push(row);
    }

    const body = assets.map((asset) => {
      const cells = exchanges.map((exchange) => {
        const entries = (byAssetExchange.get(`${asset}::${exchange.id}`) || []).sort(compareRows);
        if (entries.length === 0) {
          return `<td data-label="${escapeHtml(exchange.label)}"><span class="cw-empty">-</span></td>`;
        }
        const best = entries[0];
        const networks = entries.slice(0, 3).map(row => `<span class="cw-network-chip">${escapeHtml(row.network)}</span>`).join('');
        const more = entries.length > 3 ? `<span class="cw-network-chip is-more">+${entries.length - 3}</span>` : '';
        return [
          `<td data-label="${escapeHtml(exchange.label)}">`,
          `<div class="cw-cell-fee">${renderFee(best, { hideNetwork: true })}</div>`,
          `<div class="cw-network-list">${networks}${more}</div>`,
          '</td>',
        ].join('');
      }).join('');
      return [
        '<tr>',
        `<th scope="row" class="cw-asset-cell"><button type="button" data-asset-filter="${escapeHtml(asset)}">${escapeHtml(asset)}</button></th>`,
        cells,
        '</tr>',
      ].join('');
    }).join('');

    return [
      '<div class="cw-table-shell" tabindex="0">',
      '<table class="cw-table cw-table--matrix">',
      '<thead><tr>',
      '<th class="cw-asset-head">銘柄</th>',
      exchanges.map(exchange => `<th>${escapeHtml(exchange.label)}</th>`).join(''),
      '</tr></thead>',
      `<tbody>${body || emptyRow(exchanges.length + 1)}</tbody>`,
      '</table>',
      '</div>',
    ].join('');
  }

  function renderExchange(rows) {
    const exchanges = state.data.exchanges.filter(exchange => state.exchange === 'all' || exchange.id === state.exchange);
    const sections = exchanges.map((exchange) => {
      const exchangeRows = rows.filter(row => row.exchangeId === exchange.id);
      if (exchangeRows.length === 0) return '';
      return [
        '<section class="cw-exchange-section">',
        `<div class="cw-exchange-heading"><h3>${escapeHtml(exchange.label)}</h3><a href="${escapeHtml(exchange.sourceUrl)}" target="_blank" rel="noopener">公式</a></div>`,
        '<div class="cw-table-shell" tabindex="0">',
        '<table class="cw-table cw-table--detail">',
        '<thead><tr><th>銘柄</th><th>ネットワーク</th><th>出金手数料</th><th>最小出金</th><th>補足</th></tr></thead>',
        '<tbody>',
        exchangeRows.sort(compareRows).map(row => [
          '<tr>',
          `<th scope="row">${escapeHtml(row.asset)}${row.currency !== row.asset ? `<span class="cw-subsymbol">${escapeHtml(row.currency)}</span>` : ''}</th>`,
          `<td data-label="ネットワーク">${escapeHtml(row.network)}</td>`,
          `<td data-label="出金手数料">${renderFee(row, { hideNetwork: true, hideNote: true })}</td>`,
          `<td data-label="最小出金">${row.minWithdrawal ? `${escapeHtml(row.minWithdrawal)} ${escapeHtml(row.currency)}` : '<span class="cw-empty">-</span>'}</td>`,
          `<td data-label="補足">${row.note ? escapeHtml(row.note) : '<span class="cw-empty">-</span>'}</td>`,
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
        `<th scope="row">${escapeHtml(row.asset)}${row.currency !== row.asset ? `<span class="cw-subsymbol">${escapeHtml(row.currency)}</span>` : ''}</th>`,
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

  function emptyState() {
    return '<div class="cw-empty-panel">該当する行がありません</div>';
  }

  function renderAssetRail(rows) {
    const assets = Array.from(new Set(rows.map(row => row.asset))).sort(compareAssets).slice(0, 18);
    if (assets.length === 0) return '';
    return [
      '<div class="cw-asset-rail" aria-label="銘柄ショートカット">',
      '<button type="button" data-asset-filter="">全て</button>',
      assets.map(asset => `<button type="button" data-asset-filter="${escapeHtml(asset)}">${escapeHtml(asset)}</button>`).join(''),
      '</div>',
    ].join('');
  }

  function renderStats(rows) {
    const assetCount = new Set(rows.map(row => row.asset)).size;
    const exchangeCount = new Set(rows.map(row => row.exchangeId)).size;
    const freeCount = rows.filter(isFree).length;
    return [
      '<div class="cw-stats">',
      statCard('銘柄', assetCount),
      statCard('取引所', exchangeCount),
      statCard('ネットワーク行', rows.length),
      statCard('無料表示', freeCount),
      '</div>',
    ].join('');
  }

  function statCard(label, value) {
    return `<div class="cw-stat"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`;
  }

  function renderControls() {
    const exchanges = state.data.exchanges;
    const networks = allNetworks();
    return [
      '<div class="cw-controls">',
      '<label class="cw-field"><span>銘柄検索</span><input type="search" data-cw-query value="' + escapeHtml(state.query) + '" placeholder="BTC, ETH, Solana"></label>',
      '<label class="cw-field"><span>取引所</span><select data-cw-exchange>',
      '<option value="all">全取引所</option>',
      exchanges.map(exchange => `<option value="${escapeHtml(exchange.id)}"${state.exchange === exchange.id ? ' selected' : ''}>${escapeHtml(exchange.label)}</option>`).join(''),
      '</select></label>',
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
    ].join('');
  }

  function viewButton(view, label) {
    return `<button type="button" data-cw-view="${view}" class="${state.view === view ? 'is-active' : ''}">${label}</button>`;
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
      '</div>',
      renderStats(rows),
      renderControls(),
      renderAssetRail(rows),
      table,
      '<div class="cw-source-row">',
      state.data.exchanges.map(exchange => `<a href="${escapeHtml(exchange.sourceUrl)}" target="_blank" rel="noopener">${escapeHtml(exchange.label)}</a>`).join(''),
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
    root.querySelector('[data-cw-exchange]')?.addEventListener('change', (event) => {
      state.exchange = event.target.value;
      render();
    });
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
  }

  fetch('/data/crypto-withdrawal-fees.json')
    .then((res) => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    })
    .then((data) => {
      state.data = data;
      render();
    })
    .catch(() => {
      root.innerHTML = '<div class="cw-empty-panel">比較データを読み込めませんでした</div>';
    });
}());
