(() => {
  const STORAGE_KEY = 'okj.beginnerMode.v1';
  const TABLE_OPTIONAL_LABELS = new Set([
    '#',
    '方向',
    '買値',
    '売値',
    '7日平均',
    '30日平均',
    '全体シェア',
    '実効VWAP',
    '実効VWAP?',
    'VWAP',
    'VWAP?',
    '更新',
    '取得',
    '最終取得',
    '経路',
    'サンプル',
    '種別',
    '小計',
    '小計(JPY)',
    '累計数量',
    '累計金額',
    '注文数',
    '表示価格',
    '対象者',
    '期間',
    '公式URL',
    '紹介リンク/アフィリエイトリンク',
    '最終確認日',
    '注意事項',
  ]);
  const TERMS = {
    orderbook: {
      title: '板',
      description: '取引所に並んでいる買い注文と売り注文の一覧です。板が厚いほど、大きめの注文でも価格が動きにくくなります。',
    },
    slippage: {
      title: 'スリッページ',
      description: '最良価格で約定できると思っていた値段と、実際の平均約定価格との差です。注文量が大きいほど広がりやすくなります。',
    },
    'sales-spread': {
      title: '販売所スプレッド',
      description: '販売所の買値と売値の差です。広いほど、売買にかかる実質コストが高くなります。',
    },
    vwap: {
      title: 'VWAP',
      description: '約定した価格を数量で平均した価格です。実際にどの水準で約定したかを見る基本指標です。',
    },
    impact: {
      title: 'Impact',
      description: 'その注文で市場価格がどれだけ動くかの目安です。大きいほど板への影響が強く、約定コストも重くなりやすいです。',
    },
    'volume-share': {
      title: '出来高シェア',
      description: 'その銘柄の売買が、どの取引所にどれだけ集まっているかを示す比率です。流動性の偏りを見るのに使えます。',
    },
    'indicative-cost': {
      title: '販売所参考値',
      description: '板がない販売所を、表示価格ベースで試算した参考コストです。実際の約定額とはずれる場合があります。',
    },
    'effective-cost': {
      title: '実効コスト',
      description: '価格差、スリッページ、手数料を含めて、実際に近い支払額や受取額として見たコストです。',
    },
    liquidity: {
      title: '流動性',
      description: '売買したい数量を無理なく約定できる厚みです。流動性が低いと、少し大きな注文でも価格が動きやすくなります。',
    },
    'taker-fee': {
      title: 'taker 手数料',
      description: '板にすでに並んでいる注文を成行などで消費したときにかかる取引手数料です。',
    },
    'order-size': {
      title: '注文サイズ',
      description: '注文する数量や金額の大きさです。同じ銘柄でも、注文サイズが大きいほどImpactや実効コストが悪化しやすくなります。',
    },
  };

  let beginnerMode = false;
  let tooltip = null;
  let activeButton = null;
  let tableScanTimer = null;
  let tableObserver = null;

  const escapeHtml = (value) => String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

  function readMode() {
    try {
      return localStorage.getItem(STORAGE_KEY) === 'true';
    } catch (_) {
      return false;
    }
  }

  function writeMode(value) {
    try {
      localStorage.setItem(STORAGE_KEY, value ? 'true' : 'false');
    } catch (_) {
      // noop
    }
  }

  function entryFor(key) {
    return TERMS[key] || null;
  }

  function normalizeColumnLabel(value) {
    return String(value || '')
      .replace(/\s+/g, '')
      .replace(/（/g, '(')
      .replace(/）/g, ')')
      .trim();
  }

  function isOptionalColumnLabel(label) {
    const normalized = normalizeColumnLabel(label);
    if (!normalized) return false;
    return TABLE_OPTIONAL_LABELS.has(normalized);
  }

  function currentPath() {
    const path = window.location.pathname.replace(/\/+$/, '');
    return path || '/';
  }

  function guideProfile() {
    const path = currentPath();
    if (path === '/simulator' || path === '/simulator.html') {
      return {
        eyebrow: 'Beginner Mode',
        title: 'まず見る場所を3つに絞ります',
        summary: 'まずは「実効コスト」「Impact」「販売所スプレッド」の3つを見ると判断しやすいです。Impactが高いときは、成行注文を分けるか指値注文も検討してください。',
        metrics: ['実効コスト', 'Impact', '販売所スプレッド'],
        terms: ['effective-cost', 'impact', 'sales-spread', 'slippage', 'order-size'],
        warning: 'Impactが1%以上、または流動性不足の表示が出る注文サイズは要注意です。注文を小さくして再計算すると、危険度の変化を確認できます。',
        links: [
          { href: '/learn/order-book-trading', label: '板取引とは？' },
          { href: '/learn/buying-100k-points', label: '10万円分買う前のポイント' },
          { href: '/sales-spread?instrumentId=BTC-JPY', label: '販売所スプレッドを見る' },
        ],
      };
    }
    if (path === '/sales-spread' || path === '/sales-spread.html') {
      return {
        eyebrow: 'Beginner Mode',
        title: '販売所はスプレッドから見ます',
        summary: '販売所では手数料が無料に見えても、買値と売値の差が実質コストになります。まず「現在スプレッド」と「24h平均」を見て、広い銘柄は板シミュレーターでも確認してください。',
        metrics: ['現在スプレッド', '24h平均', '板比較への候補'],
        terms: ['sales-spread', 'effective-cost', 'orderbook'],
        warning: 'スプレッドが大きい銘柄を販売所でまとめて買うと、取引所板より不利になる可能性があります。',
        links: [
          { href: '/learn/spread', label: 'スプレッドとは？' },
          { href: '/learn/broker-loss-reasons', label: '販売所で損しやすい理由' },
          { href: '/simulator?market=BTC-JPY&side=buy&amountType=jpy&amount=100000', label: '取引所板で10万円買いを比較' },
        ],
      };
    }
    if (path === '/volume-share' || path === '/volume-share.html') {
      return {
        eyebrow: 'Beginner Mode',
        title: '出来高は流動性の入口として見ます',
        summary: '出来高シェアは、どの取引所に売買が集まりやすいかを見る指標です。最初は「首位取引所」「上位3社集中度」「データ信頼度」を確認してください。',
        metrics: ['首位取引所', '上位3社集中度', 'データ信頼度'],
        terms: ['volume-share', 'liquidity', 'orderbook', 'effective-cost'],
        warning: '出来高が多くても、その瞬間の板が薄い場合は実効コストが悪化します。大きめの注文は必ず板シミュレーターで確認してください。',
        links: [
          { href: '/simulator?market=BTC-JPY&side=buy&amountType=jpy&amount=100000', label: '板シミュレーターで確認' },
          { href: '/sales-spread?instrumentId=BTC-JPY', label: '販売所スプレッドを見る' },
          { href: '/markets/BTC-JPY', label: '銘柄ページへ' },
        ],
      };
    }
    if (path === '/derivatives' || path === '/derivatives.html') {
      return {
        eyebrow: 'Beginner Mode',
        title: 'デリバティブは流動性と条件を分けて見ます',
        summary: 'Crypto CFDや暗号資産FXは、まず「首位取引所」「上位3社集中度」「データ信頼度」を確認し、その後に板、証拠金、ロスカット条件を公式情報で確認してください。',
        metrics: ['首位取引所', '上位3社集中度', 'データ信頼度'],
        terms: ['volume-share', 'liquidity', 'orderbook', 'effective-cost'],
        warning: 'レバレッジ取引は現物より損失が大きくなる場合があります。出来高が多くても、注文サイズや急変時の板で約定コストは変わります。',
        links: [
          { href: '/simulator?market=BTC-CFD-JPY&exchange=bitflyer&side=buy&amountType=jpy&amount=100000', label: 'デリバティブ板を確認' },
          { href: '/volume-share?instrumentId=BTC-JPY', label: '現物の出来高を見る' },
          { href: '/markets/BTC-CFD-JPY', label: 'BTC-CFDページへ' },
        ],
      };
    }
    if (path === '/markets' || path === '/markets.html') {
      return {
        eyebrow: 'Beginner Mode',
        title: '銘柄を選んだらコスト確認へ進みます',
        summary: '最初は「対応取引所数」と「銘柄ページへのリンク」を見て、買いたい銘柄を選びます。銘柄ページでは板、出来高、販売所スプレッドをまとめて確認できます。',
        metrics: ['対応取引所数', '銘柄検索', '銘柄ページリンク'],
        terms: ['orderbook', 'sales-spread', 'volume-share', 'effective-cost'],
        warning: '取扱取引所数が多い銘柄でも、板の厚みや手数料は取引所ごとに異なります。',
        links: [
          { href: '/markets/BTC-JPY', label: 'BTC/JPYを例に見る' },
          { href: '/simulator?market=BTC-JPY&side=buy&amountType=jpy&amount=100000', label: '10万円買いを比較' },
          { href: '/learn/how-to-compare-exchanges', label: '比較手順を読む' },
        ],
      };
    }
    if (path.startsWith('/markets/')) {
      return {
        eyebrow: 'Beginner Mode',
        title: 'この銘柄は要点から見ます',
        summary: 'まずページ上部の結論カードと比較サマリーを見てから、「取引所別コスト比較」「出来高シェア」「販売所スプレッド」の順に確認してください。',
        metrics: ['取引所別コスト比較', 'Impact', '販売所スプレッド'],
        terms: ['effective-cost', 'impact', 'volume-share', 'sales-spread'],
        warning: 'Impactが高い取引所や、販売所スプレッドが広い取引所は、注文サイズを下げて再確認すると判断しやすくなります。',
        links: [
          { href: '/learn/exchange-vs-broker', label: '販売所と取引所の違い' },
          { href: '/learn/buying-100k-points', label: '10万円分買う前のポイント' },
          { href: '/simulator?market=BTC-JPY&side=buy&amountType=jpy&amount=100000', label: '板シミュレーターで再計算' },
        ],
      };
    }
    if (path === '/campaigns' || path.startsWith('/campaigns/')) {
      return {
        eyebrow: 'Beginner Mode',
        title: 'キャンペーンは条件とコストを分けて見ます',
        summary: '特典だけで判断せず、「条件」「期間」「手数料・スプレッド」を順番に確認してください。申込前は公式ページの最新条件を優先します。',
        metrics: ['特典', '条件', '手数料・スプレッド'],
        terms: ['taker-fee', 'sales-spread', 'effective-cost'],
        warning: '特典額より、通常取引時のスプレッドや手数料が大きくなるケースがあります。',
        links: [
          { href: '/simulator?market=BTC-JPY&side=buy&amountType=jpy&amount=100000', label: 'コストをシミュレーション' },
          { href: '/sales-spread?instrumentId=BTC-JPY', label: '販売所スプレッドを見る' },
          { href: '/learn/crypto-fees', label: '手数料の見方を読む' },
        ],
      };
    }
    if (path.startsWith('/exchanges/')) {
      return {
        eyebrow: 'Beginner Mode',
        title: '取引所詳細は手数料から確認します',
        summary: 'まず「既定taker手数料」「取扱銘柄数」「次に見る」を確認し、実際に買う銘柄は板シミュレーターで実効コストまで見てください。',
        metrics: ['既定taker手数料', '取扱銘柄数', '板シミュレーター導線'],
        terms: ['taker-fee', 'orderbook', 'effective-cost', 'sales-spread'],
        warning: '手数料が低くても、板が薄い銘柄ではImpactで不利になることがあります。',
        links: [
          { href: '/simulator?market=BTC-JPY&side=buy&amountType=jpy&amount=100000', label: '板シミュレーターへ' },
          { href: '/markets', label: '銘柄一覧へ' },
          { href: '/campaigns', label: 'キャンペーン一覧へ' },
        ],
      };
    }
    return {
      eyebrow: 'Beginner Mode',
      title: '最初はコスト、流動性、スプレッドを見ます',
      summary: 'このサイトでは、買う前に「実効コスト」「Impact」「販売所スプレッド」を確認すると迷いにくくなります。',
      metrics: ['実効コスト', 'Impact', '販売所スプレッド'],
      terms: ['effective-cost', 'impact', 'sales-spread', 'orderbook'],
      warning: '大きめの成行注文は、板の厚み次第で想定より高く約定することがあります。',
      links: [
        { href: '/simulator?market=BTC-JPY&side=buy&amountType=jpy&amount=100000', label: '10万円BTCを比べる' },
        { href: '/sales-spread?instrumentId=BTC-JPY', label: '販売所スプレッドを見る' },
        { href: '/learn/exchange-vs-broker', label: '販売所と取引所の違い' },
      ],
    };
  }

  function renderBeginnerGuide() {
    if (document.querySelector('[data-beginner-guide]')) return;
    const main = document.querySelector('main#main') || document.querySelector('main');
    if (!main) return;
    const profile = guideProfile();
    const termsHtml = (profile.terms || [])
      .map(key => entryFor(key))
      .filter(Boolean)
      .map(entry => `
        <div class="beginner-guide-term">
          <dt>${escapeHtml(entry.title)}</dt>
          <dd>${escapeHtml(entry.description)}</dd>
        </div>
      `).join('');
    const metricsHtml = (profile.metrics || [])
      .map(metric => `<span class="beginner-guide-chip">${escapeHtml(metric)}</span>`)
      .join('');
    const linksHtml = (profile.links || [])
      .map(link => `<a class="beginner-guide-link" href="${escapeHtml(link.href)}">${escapeHtml(link.label)}</a>`)
      .join('');

    const guide = document.createElement('section');
    guide.className = 'beginner-guide-panel beginner-only';
    guide.dataset.beginnerGuide = 'true';
    guide.hidden = !beginnerMode;
    guide.innerHTML = `
      <div class="beginner-guide-panel__header">
        <div>
          <p class="beginner-guide-panel__eyebrow">${escapeHtml(profile.eyebrow)}</p>
          <h2 class="beginner-guide-panel__title">${escapeHtml(profile.title)}</h2>
        </div>
        <span class="beginner-guide-panel__badge">ON</span>
      </div>
      <p class="beginner-guide-panel__summary">${escapeHtml(profile.summary)}</p>
      ${metricsHtml ? `<div class="beginner-guide-section"><strong>最初に見る指標</strong><div class="beginner-guide-chip-row">${metricsHtml}</div></div>` : ''}
      ${termsHtml ? `<div class="beginner-guide-section"><strong>用語の意味</strong><dl class="beginner-guide-term-grid">${termsHtml}</dl></div>` : ''}
      ${profile.warning ? `<div class="beginner-guide-warning"><strong>注文サイズの注意</strong><span>${escapeHtml(profile.warning)}</span></div>` : ''}
      ${linksHtml ? `<div class="beginner-guide-section"><strong>次に見るページ</strong><div class="beginner-guide-link-row">${linksHtml}</div></div>` : ''}
    `;

    const first = main.firstElementChild;
    if (first && first.nextSibling) {
      main.insertBefore(guide, first.nextSibling);
    } else {
      main.appendChild(guide);
    }
  }

  function ensurePageToggle() {
    if (document.querySelector('[data-beginner-toggle]')) return;
    const host = document.querySelector('.status-cluster') || document.querySelector('.nav-menu');
    if (!host) return;
    const button = document.createElement('button');
    button.className = 'beginner-toggle';
    button.type = 'button';
    button.dataset.beginnerToggle = 'true';
    button.setAttribute('aria-pressed', 'false');
    button.textContent = '初心者モード OFF';
    host.appendChild(button);
  }

  function markBeginnerTables() {
    document.querySelectorAll('.beginner-auto-optional').forEach((node) => {
      node.classList.remove('beginner-auto-optional', 'beginner-optional');
    });

    document.querySelectorAll('.data-table').forEach((table) => {
      const headerRow = table.tHead && table.tHead.rows && table.tHead.rows[table.tHead.rows.length - 1];
      if (!headerRow) return;
      const optionalIndexes = [];
      Array.from(headerRow.cells).forEach((cell, index) => {
        if (!isOptionalColumnLabel(cell.textContent)) return;
        optionalIndexes.push(index);
        cell.classList.add('beginner-optional', 'beginner-auto-optional');
      });

      if (optionalIndexes.length === 0) return;
      Array.from(table.tBodies || []).forEach((tbody) => {
        Array.from(tbody.rows || []).forEach((row) => {
          optionalIndexes.forEach((index) => {
            const cell = row.cells[index];
            if (cell && Number(cell.colSpan || 1) === 1) {
              cell.classList.add('beginner-optional', 'beginner-auto-optional');
            }
          });
        });
      });
    });

    document.querySelectorAll('[data-label]').forEach((node) => {
      if (!isOptionalColumnLabel(node.getAttribute('data-label'))) return;
      node.classList.add('beginner-optional', 'beginner-auto-optional');
    });
  }

  function scheduleTableScan() {
    if (tableScanTimer) return;
    tableScanTimer = window.requestAnimationFrame(() => {
      tableScanTimer = null;
      markBeginnerTables();
    });
  }

  function observeTables() {
    if (tableObserver) return;
    tableObserver = new MutationObserver((mutations) => {
      if (mutations.some(mutation => mutation.addedNodes && mutation.addedNodes.length > 0)) {
        scheduleTableScan();
      }
    });
    tableObserver.observe(document.body, { childList: true, subtree: true });
  }

  function ensureTooltip() {
    if (tooltip) return tooltip;
    tooltip = document.createElement('div');
    tooltip.className = 'term-tooltip';
    tooltip.hidden = true;
    tooltip.setAttribute('role', 'tooltip');
    document.body.appendChild(tooltip);
    return tooltip;
  }

  function positionTooltip(button) {
    if (!tooltip || !button) return;
    const rect = button.getBoundingClientRect();
    const margin = 12;
    const maxLeft = window.innerWidth - tooltip.offsetWidth - margin;
    const left = Math.max(margin, Math.min(rect.left + rect.width / 2 - tooltip.offsetWidth / 2, maxLeft));
    let top = rect.bottom + 10;
    if (top + tooltip.offsetHeight > window.innerHeight - margin) {
      top = Math.max(margin, rect.top - tooltip.offsetHeight - 10);
    }
    tooltip.style.left = `${left}px`;
    tooltip.style.top = `${top}px`;
  }

  function hideTooltip() {
    if (activeButton) activeButton.classList.remove('is-open');
    activeButton = null;
    if (tooltip) tooltip.hidden = true;
  }

  function showTooltip(button) {
    const key = button && button.dataset ? button.dataset.termKey : '';
    const entry = entryFor(key);
    if (!button || !entry) return;

    const node = ensureTooltip();
    node.innerHTML = `
      <div class="term-tooltip__title">${escapeHtml(entry.title)}</div>
      <div class="term-tooltip__body">${escapeHtml(entry.description)}</div>
    `;
    node.hidden = false;
    if (activeButton && activeButton !== button) {
      activeButton.classList.remove('is-open');
    }
    activeButton = button;
    button.classList.add('is-open');
    positionTooltip(button);
  }

  function syncToggleButtons() {
    ensurePageToggle();
    document.querySelectorAll('[data-beginner-toggle]').forEach((button) => {
      button.classList.toggle('is-active', beginnerMode);
      button.setAttribute('aria-pressed', beginnerMode ? 'true' : 'false');
      button.textContent = beginnerMode ? '初心者モード ON' : '初心者モード OFF';
      button.title = beginnerMode
        ? '用語説明を表示しやすくしています'
        : '用語説明を見やすくする初心者モードを有効化';
    });
  }

  function syncMode() {
    document.body.classList.toggle('beginner-mode', beginnerMode);
    document.querySelectorAll('[data-beginner-guide]').forEach((guide) => {
      guide.hidden = !beginnerMode;
    });
    syncToggleButtons();
    markBeginnerTables();
    window.dispatchEvent(new CustomEvent('okj:beginner-mode-change', {
      detail: { enabled: beginnerMode },
    }));
  }

  function setMode(value) {
    beginnerMode = !!value;
    writeMode(beginnerMode);
    syncMode();
  }

  function toggleMode() {
    setMode(!beginnerMode);
  }

  document.addEventListener('click', (event) => {
    const target = event.target && event.target.closest ? event.target : null;
    if (!target) return;

    const toggle = target.closest('[data-beginner-toggle]');
    if (toggle) {
      event.preventDefault();
      toggleMode();
      return;
    }

    const button = target.closest('[data-term-key]');
    if (button) {
      event.preventDefault();
      if (activeButton === button && tooltip && !tooltip.hidden) {
        hideTooltip();
      } else {
        showTooltip(button);
      }
      return;
    }

    if (tooltip && !tooltip.hidden && !target.closest('.term-tooltip')) {
      hideTooltip();
    }
  });

  document.addEventListener('focusin', (event) => {
    const target = event.target && event.target.closest ? event.target : null;
    const button = target ? target.closest('[data-term-key]') : null;
    if (button) showTooltip(button);
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') hideTooltip();
  });

  window.addEventListener('resize', () => {
    if (activeButton && tooltip && !tooltip.hidden) positionTooltip(activeButton);
  });

  window.addEventListener('scroll', () => {
    if (activeButton && tooltip && !tooltip.hidden) positionTooltip(activeButton);
  }, true);

  window.TermHelp = {
    button(key, label) {
      const entry = entryFor(key);
      if (!entry) return '';
      const readable = escapeHtml(label || entry.title);
      return `<button class="term-help" type="button" data-term-key="${escapeHtml(key)}" aria-label="${readable} の説明を開く"><span aria-hidden="true">?</span></button>`;
    },
    inlineLabel(label, key) {
      const entry = entryFor(key);
      if (!entry) return escapeHtml(label);
      return `<span class="term-label">${escapeHtml(label)}${this.button(key, label)}</span>`;
    },
  };

  window.BeginnerMode = {
    isEnabled() {
      return beginnerMode;
    },
    setEnabled(value) {
      setMode(value);
    },
  };

  document.addEventListener('DOMContentLoaded', () => {
    beginnerMode = readMode();
    ensurePageToggle();
    renderBeginnerGuide();
    observeTables();
    syncMode();
  });
})();
