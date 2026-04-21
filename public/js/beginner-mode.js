(() => {
  const STORAGE_KEY = 'okj.beginnerMode.v1';
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
  };

  let beginnerMode = false;
  let tooltip = null;
  let activeButton = null;

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

  function ensureBanner() {
    const main = document.querySelector('main');
    if (!main) return null;
    let banner = main.querySelector('[data-beginner-banner]');
    if (!banner) {
      banner = document.createElement('section');
      banner.className = 'beginner-banner';
      banner.dataset.beginnerBanner = 'true';
      banner.innerHTML = `
        <div class="beginner-banner__title">初心者モード</div>
        <div class="beginner-banner__body">? ボタンから用語の短い説明を開けます。数値は、まず比較の目安として見るのがおすすめです。</div>
      `;
      main.insertBefore(banner, main.firstChild);
    }
    return banner;
  }

  function syncBanner() {
    const banner = ensureBanner();
    if (!banner) return;
    banner.hidden = !beginnerMode;
  }

  function syncToggleButtons() {
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
    syncToggleButtons();
    syncBanner();
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

  document.addEventListener('DOMContentLoaded', () => {
    beginnerMode = readMode();
    syncMode();
  });
})();
