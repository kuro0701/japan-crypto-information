(() => {
  const THEME_STORAGE_KEY = 'okj.theme.v1';
  const EXCHANGE_CHECKLIST_STORAGE_KEY = 'okj.exchangeChecklist.v1';
  const ARTICLE_TERM_SELECTOR = '.article-term[data-term-key]';

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const escapeHtml = (value) => String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

  const JPY_WITHDRAWAL_FEE_ROWS = [
    {
      id: 'gmo',
      name: 'GMOコイン',
      abbr: 'GMO',
      color: '#35e0a5',
      sourceLabel: 'GMOコイン 入出金',
      sourceUrl: 'https://coin.z.com/jp/corp/guide/deposit-withdrawal/',
      note: '通常出金は無料、大口出金は400円。',
      calculate(amount) {
        const fee = amount >= 30000001 ? 400 : 0;
        return {
          fee,
          feeLabel: fee === 0 ? '無料' : '400円',
          condition: fee === 0 ? '通常出金' : '大口出金: 30,000,001円/回以上',
          note: amount > 100000000 ? '1日上限などは公式画面で確認' : '大口出金は手数料返戻なしの注意あり',
        };
      },
    },
    {
      id: 'binance',
      name: 'Binance Japan',
      abbr: 'BN',
      color: '#f0b90b',
      sourceLabel: 'PayPay 発表',
      sourceUrl: 'https://about.paypay.ne.jp/pr/20260409/01/',
      note: 'PayPayマネー連携の出金手数料。',
      calculate(amount) {
        if (amount > 0 && amount < 1000) {
          return {
            fee: 110,
            feeLabel: '110円',
            condition: 'PayPayマネー連携',
            note: '出金下限 1,000円未満',
            eligible: false,
          };
        }
        if (amount > 1000000) {
          return {
            fee: 110,
            feeLabel: '110円',
            condition: 'PayPayマネー連携',
            note: '24時間上限 100万円超は公式確認',
            eligible: false,
          };
        }
        return {
          fee: 110,
          feeLabel: '110円',
          condition: 'PayPayマネー連携',
          note: '下限1,000円、24時間上限100万円',
        };
      },
    },
    {
      id: 'bitflyer',
      name: 'bitFlyer',
      abbr: 'BF',
      color: '#2f7df6',
      sourceLabel: 'bitFlyer 手数料',
      sourceUrl: 'https://bitflyer.com/ja-jp/s/commission',
      note: '三井住友銀行宛かどうかで変わります。',
      calculate(amount, bankMode) {
        const isSmbc = bankMode === 'smbc';
        const fee = amount < 30000
          ? (isSmbc ? 220 : 550)
          : (isSmbc ? 440 : 770);
        return {
          fee,
          feeLabel: `${fee.toLocaleString('ja-JP')}円`,
          condition: isSmbc ? '三井住友銀行宛' : '三井住友銀行以外',
          note: amount < 30000 ? '3万円未満' : '3万円以上',
        };
      },
    },
    {
      id: 'okj',
      name: 'OKJ',
      abbr: 'OKJ',
      color: '#25d366',
      sourceLabel: 'OKJ 手数料一覧',
      sourceUrl: 'https://www.okcoin.jp/pages/products/fees.html',
      note: '100万円、1,000万円で区分が変わります。',
      calculate(amount) {
        const fee = amount < 1000000 ? 400 : amount < 10000000 ? 770 : 1320;
        return {
          fee,
          feeLabel: `${fee.toLocaleString('ja-JP')}円`,
          condition: '出金額で変動',
          note: amount < 1000000 ? '100万円未満' : amount < 10000000 ? '100万円以上1,000万円未満' : '1,000万円以上',
        };
      },
    },
    {
      id: 'coincheck',
      name: 'Coincheck',
      abbr: 'CC',
      color: '#00d9b1',
      sourceLabel: 'Coincheck 手数料',
      sourceUrl: 'https://coincheck.com/ja/info/fee',
      note: '日本円出金は一律407円。',
      calculate() {
        return {
          fee: 407,
          feeLabel: '407円',
          condition: '一律',
          note: '金額による分岐なし',
        };
      },
    },
    {
      id: 'bitbank',
      name: 'bitbank',
      abbr: 'BB',
      color: '#e63b3f',
      sourceLabel: 'bitbank サポート',
      sourceUrl: 'https://support.bitbank.cc/hc/ja/articles/900000034263-%E6%97%A5%E6%9C%AC%E5%86%86%E3%81%AE%E5%87%BA%E9%87%91%E6%89%8B%E6%95%B0%E6%96%99%E3%81%AF%E3%81%84%E3%81%8F%E3%82%89%E3%81%A7%E3%81%99%E3%81%8B',
      note: '3万円を境に手数料が変わります。',
      calculate(amount) {
        const fee = amount < 30000 ? 550 : 770;
        return {
          fee,
          feeLabel: `${fee.toLocaleString('ja-JP')}円`,
          condition: '出金額で変動',
          note: amount < 30000 ? '3万円未満' : '3万円以上',
        };
      },
    },
    {
      id: 'bittrade',
      name: 'BitTrade',
      abbr: 'BT',
      color: '#3f78ff',
      sourceLabel: 'BitTrade 手数料',
      sourceUrl: 'https://www.bittrade.co.jp/ja-jp/support/fee/',
      note: '公式手数料表は日本円出金を「--」表示。',
      calculate() {
        return {
          fee: null,
          feeLabel: '公式確認',
          condition: '公式表は「--」表示',
          note: '出金画面で最終確認',
          eligible: false,
        };
      },
    },
  ];

  function readStoredTheme() {
    try {
      const stored = localStorage.getItem(THEME_STORAGE_KEY);
      if (stored === 'light' || stored === 'dark') return stored;
      if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) return 'light';
      return 'dark';
    } catch (_) {
      if (document.documentElement.classList.contains('theme-light')) return 'light';
      return window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
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
      button.classList.toggle('is-light', isLight);
      button.setAttribute('aria-pressed', isLight ? 'true' : 'false');
      button.setAttribute('aria-label', isLight ? 'ダークモードに切り替え' : 'ライトモードに切り替え');
      if (icon) icon.textContent = isLight ? '☾' : '☀';
      if (label) label.textContent = isLight ? 'ダーク' : 'ライト';
    });
  }

  function playThemeRipple(event, theme) {
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const target = event && event.target && event.target.closest ? event.target.closest('[data-theme-toggle]') : null;
    const rect = target ? target.getBoundingClientRect() : { left: window.innerWidth / 2, top: 0, width: 0, height: 0 };
    const eventX = Number(event && event.clientX);
    const eventY = Number(event && event.clientY);
    const x = Number.isFinite(eventX) && eventX > 0 ? eventX : rect.left + rect.width / 2;
    const y = Number.isFinite(eventY) && eventY > 0 ? eventY : rect.top + rect.height / 2;
    const ripple = document.createElement('span');
    ripple.className = `theme-ripple theme-ripple--${theme === 'light' ? 'light' : 'dark'}`;
    ripple.style.setProperty('--theme-ripple-x', `${x}px`);
    ripple.style.setProperty('--theme-ripple-y', `${y}px`);
    document.body.appendChild(ripple);
    window.requestAnimationFrame(() => ripple.classList.add('is-active'));
    window.setTimeout(() => ripple.remove(), 760);
  }

  function initThemeToggle() {
    let currentTheme = readStoredTheme();
    syncTheme(currentTheme);

    document.addEventListener('click', (event) => {
      const button = event.target && event.target.closest ? event.target.closest('[data-theme-toggle]') : null;
      if (!button) return;
      event.preventDefault();
      const nextTheme = currentTheme === 'light' ? 'dark' : 'light';
      playThemeRipple(event, nextTheme);
      currentTheme = nextTheme;
      writeStoredTheme(currentTheme);
      syncTheme(currentTheme);
    });
  }

  function slugify(value, index) {
    const slug = String(value || '')
      .trim()
      .toLowerCase()
      .replace(/[^\p{Letter}\p{Number}]+/gu, '-')
      .replace(/^-+|-+$/g, '');
    return slug || `section-${index + 1}`;
  }

  function buildTocLinks(headings) {
    return headings.map((heading, index) => {
      const className = [
        'article-toc__link',
        index >= 4 ? 'article-toc__link--extra' : '',
      ].filter(Boolean).join(' ');
      return `<a class="${className}" href="#${heading.id}" data-article-toc-link="${heading.id}">${heading.textContent.trim()}</a>`;
    }).join('');
  }

  function buildTocMoreButton(headings) {
    if (headings.length <= 4) return '';
    return '<button class="article-toc__more" type="button" data-article-toc-more aria-expanded="false">+ もっと見る</button>';
  }

  function setTocExpanded(container, expanded) {
    if (!container) return;
    container.classList.toggle('is-expanded', expanded);
    $$('[data-article-toc-more]', container).forEach((button) => {
      button.setAttribute('aria-expanded', expanded ? 'true' : 'false');
      button.textContent = expanded ? '閉じる' : '+ もっと見る';
    });
  }

  function wireTocExpansion(container) {
    if (!container) return;
    $$('[data-article-toc-more]', container).forEach((button) => {
      button.addEventListener('click', () => {
        setTocExpanded(container, !container.classList.contains('is-expanded'));
      });
    });
  }

  function initToc() {
    const body = $('.article-body');
    const toc = $('[data-article-toc]');
    const tocList = $('[data-article-toc-list]');
    const mobileToc = $('[data-article-mobile-toc]');
    const mobileTocList = $('[data-article-mobile-toc-list]');
    if (!body || !toc || !tocList) return;

    const headings = $$('h2', body).filter((heading) => heading.textContent.trim());
    if (headings.length < 2) return;

    const usedIds = new Set();
    headings.forEach((heading, index) => {
      const baseId = heading.id || slugify(heading.textContent, index);
      let id = baseId;
      let suffix = 2;
      while (usedIds.has(id) || (document.getElementById(id) && document.getElementById(id) !== heading)) {
        id = `${baseId}-${suffix}`;
        suffix += 1;
      }
      usedIds.add(id);
      heading.id = id;
      heading.tabIndex = -1;
    });

    const linksHtml = `${buildTocLinks(headings)}${buildTocMoreButton(headings)}`;
    tocList.innerHTML = linksHtml;
    toc.hidden = false;
    setTocExpanded(toc, false);
    wireTocExpansion(toc);
    if (mobileToc && mobileTocList) {
      mobileTocList.innerHTML = linksHtml;
      mobileToc.hidden = false;
      setTocExpanded(mobileToc, false);
      wireTocExpansion(mobileToc);
    }

    const links = $$('[data-article-toc-link]');
    const setActive = (id) => {
      links.forEach((link) => {
        const active = link.dataset.articleTocLink === id;
        link.classList.toggle('is-active', active);
        if (active) link.setAttribute('aria-current', 'true');
        else link.removeAttribute('aria-current');
        if (active && link.classList.contains('article-toc__link--extra')) {
          setTocExpanded(link.closest('[data-article-toc], [data-article-mobile-toc]'), true);
        }
      });
    };

    setActive(headings[0].id);
    if (!('IntersectionObserver' in window)) return;

    const observer = new IntersectionObserver((entries) => {
      const visible = entries
        .filter(entry => entry.isIntersecting)
        .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
      if (visible && visible.target && visible.target.id) {
        setActive(visible.target.id);
      }
    }, {
      rootMargin: '-24% 0px -64% 0px',
      threshold: [0, 1],
    });

    headings.forEach(heading => observer.observe(heading));
  }

  function initReadingProgress() {
    const bar = $('[data-reading-progress]');
    const article = $('.article-main');
    if (!bar || !article) return;

    const update = () => {
      const rect = article.getBoundingClientRect();
      const start = window.scrollY + rect.top;
      const end = start + article.offsetHeight - window.innerHeight;
      const progress = end <= start ? 1 : (window.scrollY - start) / (end - start);
      const clamped = Math.max(0, Math.min(1, progress));
      bar.style.transform = `scaleX(${clamped})`;
    };

    update();
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
  }

  function formatJpy(value) {
    return new Intl.NumberFormat('ja-JP', {
      style: 'currency',
      currency: 'JPY',
      maximumFractionDigits: 0,
    }).format(Math.round(Number(value) || 0));
  }

  function formatJpyNumber(value) {
    return `${new Intl.NumberFormat('ja-JP').format(Math.max(0, Math.round(Number(value) || 0)))}円`;
  }

  function formatBookPrice(value) {
    return new Intl.NumberFormat('ja-JP').format(Math.round(Number(value) || 0));
  }

  function formatBtc(value) {
    const number = Number(value) || 0;
    return `${number.toFixed(number >= 0.01 ? 3 : 4)} BTC`;
  }

  function initOrderbookLiveDemo() {
    const root = $('[data-orderbook-live-demo]');
    if (!root) return;
    const asksRoot = $('[data-orderbook-demo-asks]', root);
    const bidsRoot = $('[data-orderbook-demo-bids]', root);
    const spread = $('[data-orderbook-demo-spread]', root);
    if (!asksRoot || !bidsRoot) return;

    const asks = [
      { price: 10018000, qty: 0.019, depth: 58 },
      { price: 10012000, qty: 0.013, depth: 42 },
      { price: 10005000, qty: 0.008, depth: 28 },
    ];
    const bids = [
      { price: 9994500, qty: 0.011, depth: 35 },
      { price: 9989000, qty: 0.017, depth: 52 },
      { price: 9982000, qty: 0.024, depth: 68 },
    ];
    let tick = 0;

    const renderSide = (items, side) => items.map((item, index) => {
      const wave = Math.sin((tick + index + (side === 'ask' ? 0.6 : 1.2)) * 0.72);
      const qty = Math.max(0.001, item.qty * (1 + wave * 0.16));
      const depth = Math.max(14, Math.min(92, item.depth + wave * 12));
      return `
        <div class="orderbook-learning-row orderbook-learning-row--${side}" style="--depth: ${depth.toFixed(1)}%">
          <span>${side === 'ask' ? '売' : '買'} ${escapeHtml(formatBookPrice(item.price))}</span>
          <strong>${escapeHtml(formatBtc(qty))}</strong>
        </div>
      `;
    }).join('');

    const render = () => {
      asksRoot.innerHTML = renderSide(asks, 'ask');
      bidsRoot.innerHTML = renderSide(bids, 'bid');
      const bestAsk = asks[asks.length - 1].price;
      const bestBid = bids[0].price;
      if (spread) spread.textContent = formatJpyNumber(bestAsk - bestBid);
      root.classList.add('is-ticking');
      window.setTimeout(() => root.classList.remove('is-ticking'), 420);
      tick += 1;
    };

    render();
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    window.setInterval(render, 1400);
  }

  function initOrderbookExecutionSim() {
    $$('[data-orderbook-execution-sim]').forEach((root) => {
      const input = $('[data-orderbook-sim-amount]', root);
      const amountLabel = $('[data-orderbook-sim-amount-label]', root);
      const note = $('[data-orderbook-sim-note]', root);
      const levelsRoot = $('[data-orderbook-sim-levels]', root);
      const result = $('[data-orderbook-sim-result]', root);
      const detail = $('[data-orderbook-sim-detail]', root);
      const kicker = $('[data-orderbook-sim-kicker]', root);
      const buttons = $$('[data-orderbook-sim-mode]', root);
      if (!input || !levelsRoot) return;

      const levels = [
        { price: 10000000, qty: 0.006 },
        { price: 10010000, qty: 0.008 },
        { price: 10025000, qty: 0.010 },
        { price: 10050000, qty: 0.014 },
      ];
      let mode = buttons.find(button => button.getAttribute('aria-pressed') === 'true')?.dataset.orderbookSimMode || 'market';

      const calculateFill = (amount) => {
        let remaining = amount;
        let spent = 0;
        let acquired = 0;
        const fills = levels.map((level) => {
          if (remaining <= 0) return { ...level, consumedQty: 0, consumedJpy: 0 };
          const levelJpy = level.price * level.qty;
          const consumedJpy = Math.min(remaining, levelJpy);
          const consumedQty = consumedJpy / level.price;
          remaining -= consumedJpy;
          spent += consumedJpy;
          acquired += consumedQty;
          return { ...level, consumedQty, consumedJpy };
        });
        const avgPrice = acquired > 0 ? spent / acquired : levels[0].price;
        return {
          fills,
          spent,
          acquired,
          avgPrice,
          slippagePct: ((avgPrice - levels[0].price) / levels[0].price) * 100,
          levelCount: fills.filter(fill => fill.consumedQty > 0).length,
        };
      };

      const renderMarketLevels = (fill) => fill.fills.map((level) => {
        const consumedPct = level.qty > 0 ? (level.consumedQty / level.qty) * 100 : 0;
        const rowClass = [
          'orderbook-execution-level',
          consumedPct >= 99.5 ? 'is-filled' : '',
          consumedPct > 0 && consumedPct < 99.5 ? 'is-partial' : '',
        ].filter(Boolean).join(' ');
        return `
          <div class="${rowClass}" style="--fill: ${Math.min(100, consumedPct).toFixed(1)}%; --depth: ${Math.min(92, Math.max(18, level.qty * 3600)).toFixed(1)}%">
            <span><em>売</em><strong>${escapeHtml(formatBookPrice(level.price))}円</strong></span>
            <small>${escapeHtml(formatBtc(level.qty))}</small>
          </div>
        `;
      }).join('');

      const renderLimitLevels = (amount) => {
        const limitPrice = 9995000;
        const ownQty = amount / limitPrice;
        return [
          ...levels.map(level => `
            <div class="orderbook-execution-level" style="--fill: 0%; --depth: ${Math.min(92, Math.max(18, level.qty * 3600)).toFixed(1)}%">
              <span><em>売</em><strong>${escapeHtml(formatBookPrice(level.price))}円</strong></span>
              <small>${escapeHtml(formatBtc(level.qty))}</small>
            </div>
          `),
          `<div class="orderbook-execution-spread-line"><span>最良売気配まで 5,000円</span></div>`,
          `<div class="orderbook-execution-limit-line" style="--depth: ${Math.min(86, Math.max(24, ownQty * 3000)).toFixed(1)}%">
            <span><em>自分の指値買い</em><strong>${escapeHtml(formatBookPrice(limitPrice))}円</strong></span>
            <small>${escapeHtml(formatBtc(ownQty))}</small>
          </div>`,
        ].join('');
      };

      const update = () => {
        const min = Number(input.min) || 0;
        const max = Number(input.max) || 300000;
        const amount = Math.max(min, Math.min(max, Number(input.value) || min));
        const progress = max > min ? ((amount - min) / (max - min)) * 100 : 0;
        root.style.setProperty('--orderbook-sim-progress', `${progress}%`);
        if (amountLabel) amountLabel.textContent = formatJpyNumber(amount);

        if (mode === 'limit') {
          levelsRoot.innerHTML = renderLimitLevels(amount);
          if (kicker) kicker.textContent = '指値買いの状態';
          if (result) result.textContent = '板に置いて待つ';
          if (detail) detail.textContent = '希望価格を守りやすい一方、すぐ約定しない場合があります。';
          if (note) note.textContent = '指値買いは、指定した価格に相場が届くまで板の中で待ちます。';
          return;
        }

        const fill = calculateFill(amount);
        levelsRoot.innerHTML = renderMarketLevels(fill);
        if (kicker) kicker.textContent = '成行買いの平均約定価格';
        if (result) result.textContent = `${formatBookPrice(fill.avgPrice)}円`;
        if (detail) {
          detail.textContent = `最良売気配から +${formatPct(fill.slippagePct, 3)} / ${fill.levelCount}段目まで約定`;
        }
        if (note) note.textContent = '成行買いは、安い売り注文から順番に数量を消費します。';
      };

      buttons.forEach((button) => {
        button.addEventListener('click', () => {
          mode = button.dataset.orderbookSimMode === 'limit' ? 'limit' : 'market';
          buttons.forEach((item) => {
            const active = item === button;
            item.classList.toggle('is-active', active);
            item.setAttribute('aria-pressed', active ? 'true' : 'false');
          });
          update();
        });
      });

      input.addEventListener('input', update);
      update();
    });
  }

  function initOrderbookMiniQuiz() {
    $$('[data-orderbook-mini-quiz]').forEach((root) => {
      const buttons = $$('[data-quiz-answer]', root);
      const result = $('[data-quiz-result]', root);
      const cta = $('[data-quiz-cta]', root);
      if (!buttons.length || !result) return;

      buttons.forEach((button) => {
        button.addEventListener('click', () => {
          const isCorrect = button.dataset.quizAnswer === 'market';
          buttons.forEach((item) => {
            item.classList.remove('is-correct', 'is-wrong');
            item.setAttribute('aria-pressed', item === button ? 'true' : 'false');
          });
          button.classList.add(isCorrect ? 'is-correct' : 'is-wrong');
          result.textContent = isCorrect
            ? '正解です。すぐ買いたい時は成行注文。ただし、板が薄いとスリッページが出ます。'
            : '惜しいです。指値注文は価格を指定して待つ注文なので、すぐ約定しないことがあります。';
          if (cta) cta.hidden = !isCorrect;
        });
      });
    });
  }

  function initBeginnerSpotlight() {
    const target = $('[data-beginner-spotlight]');
    if (!target) return;
    let timer = null;
    let overlay = null;
    let callout = null;

    const remove = () => {
      if (timer) window.clearTimeout(timer);
      timer = null;
      document.body.classList.remove('beginner-spotlight-active');
      target.classList.remove('is-beginner-spotlight');
      if (overlay) overlay.remove();
      if (callout) callout.remove();
      overlay = null;
      callout = null;
    };

    const positionCallout = () => {
      if (!callout) return;
      const rect = target.getBoundingClientRect();
      const margin = 14;
      const width = Math.min(320, window.innerWidth - margin * 2);
      const left = Math.max(margin, Math.min(rect.left + 18, window.innerWidth - width - margin));
      const top = Math.max(84, Math.min(rect.top - 74, window.innerHeight - 132));
      callout.style.left = `${left}px`;
      callout.style.top = `${top}px`;
      callout.style.width = `${width}px`;
    };

    const show = () => {
      remove();
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      overlay = document.createElement('div');
      overlay.className = 'beginner-spotlight-overlay';
      callout = document.createElement('div');
      callout.className = 'beginner-spotlight-callout';
      callout.innerHTML = `
        <strong>まずはここを動かしてみましょう</strong>
        <span>成行と指値を切り替え、注文金額を動かすとスリッページの意味がつかみやすくなります。</span>
      `;
      document.body.append(overlay, callout);
      document.body.classList.add('beginner-spotlight-active');
      target.classList.add('is-beginner-spotlight');
      window.setTimeout(positionCallout, 260);
      timer = window.setTimeout(remove, 5600);
    };

    window.addEventListener('okj:beginner-mode-change', (event) => {
      if (event.detail && event.detail.enabled) show();
      else remove();
    });
    window.addEventListener('resize', positionCallout);
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') remove();
    });

    if (window.BeginnerMode && window.BeginnerMode.isEnabled && window.BeginnerMode.isEnabled()) {
      window.setTimeout(show, 650);
    }
  }

  function formatPct(value, digits = 2) {
    const number = Number(value);
    return Number.isFinite(number) ? `${number.toFixed(digits)}%` : '-';
  }

  function formatCompactDateTime(value) {
    const date = new Date(value || '');
    if (Number.isNaN(date.getTime())) return '';
    return new Intl.DateTimeFormat('ja-JP', {
      month: 'numeric',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  }

  function parseJpyAmount(value) {
    const digits = String(value || '').replace(/[^\d]/g, '');
    return digits ? Number(digits) : 0;
  }

  function comparisonRankValue(result) {
    if (!result || result.eligible === false || !Number.isFinite(result.fee)) return Number.POSITIVE_INFINITY;
    return result.fee;
  }

  function renderFeeBadge(result) {
    const label = result && result.feeLabel ? result.feeLabel : '公式確認';
    const isFree = Number(result && result.fee) === 0 && result.eligible !== false;
    const isUnknown = !Number.isFinite(result && result.fee) || result.eligible === false;
    const className = [
      'jpy-fee-badge',
      isFree ? 'is-free' : '',
      isUnknown ? 'is-unknown' : '',
      !isFree && !isUnknown && Number(result && result.fee) <= 220 ? 'is-low' : '',
    ].filter(Boolean).join(' ');
    return `<span class="${className}">${escapeHtml(label)}</span>`;
  }

  function resultStatusLabel(result) {
    if (!result) return '公式確認';
    if (!Number.isFinite(result.fee)) return '公式確認';
    if (result.eligible === false) return '条件確認';
    return '計算対象';
  }

  function renderJpyWithdrawalRows(items, amount) {
    let rank = 0;
    return items.map((item) => {
      const comparable = comparisonRankValue(item.result) < Number.POSITIVE_INFINITY;
      const rowRank = comparable ? String(rank += 1) : '要確認';
      const received = comparable ? formatJpyNumber(Math.max(0, amount - item.result.fee)) : '公式画面で確認';
      const rowClass = [
        comparable && rank === 1 ? 'is-best' : '',
        !comparable ? 'is-muted' : '',
      ].filter(Boolean).join(' ');
      return `
        <tr class="${rowClass}" style="--exchange-color: ${escapeHtml(item.color)}">
          <td data-label="順位"><span class="jpy-rank">${escapeHtml(rowRank)}</span></td>
          <td data-label="取引所">
            <span class="jpy-exchange">
              <span class="jpy-exchange-mark" aria-hidden="true">${escapeHtml(item.abbr)}</span>
              <span><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(resultStatusLabel(item.result))}</small></span>
            </span>
          </td>
          <td data-label="手数料">
            ${renderFeeBadge(item.result)}
            <small class="jpy-table-note">${escapeHtml(item.result.note || item.note || '')}</small>
          </td>
          <td data-label="受取目安">${escapeHtml(received)}</td>
          <td data-label="条件">
            <strong>${escapeHtml(item.result.condition || '')}</strong>
            <small class="jpy-table-note">${escapeHtml(item.note || '')}</small>
          </td>
          <td data-label="公式確認先">
            <a class="jpy-source-button" href="${escapeHtml(item.sourceUrl)}" target="_blank" rel="noopener">${escapeHtml(item.sourceLabel)} ↗</a>
          </td>
        </tr>
      `;
    }).join('');
  }

  function initJpyWithdrawalTool() {
    const root = $('[data-jpy-withdrawal-tool]');
    if (!root) return;

    const amountInput = $('[data-jpy-withdrawal-amount]', root);
    const bankButtons = $$('[data-jpy-withdrawal-bank]', root);
    const body = $('[data-jpy-withdrawal-body]', root);
    const summary = $('[data-jpy-withdrawal-summary]', root);
    let bankMode = bankButtons.find(button => button.getAttribute('aria-pressed') === 'true')?.dataset.jpyWithdrawalBank || 'smbc';

    const setBankMode = (nextMode) => {
      bankMode = nextMode === 'other' ? 'other' : 'smbc';
      bankButtons.forEach((button) => {
        const active = button.dataset.jpyWithdrawalBank === bankMode;
        button.classList.toggle('is-active', active);
        button.setAttribute('aria-pressed', active ? 'true' : 'false');
      });
    };

    const update = () => {
      const amount = parseJpyAmount(amountInput && amountInput.value);
      const items = JPY_WITHDRAWAL_FEE_ROWS
        .map(row => ({
          ...row,
          result: row.calculate(amount, bankMode),
        }))
        .sort((a, b) => {
          const rankDiff = comparisonRankValue(a.result) - comparisonRankValue(b.result);
          if (rankDiff !== 0) return rankDiff;
          return a.name.localeCompare(b.name, 'ja');
        });

      if (body) body.innerHTML = renderJpyWithdrawalRows(items, amount);

      const best = items.find(item => comparisonRankValue(item.result) < Number.POSITIVE_INFINITY);
      const runnerUp = items.find(item => item !== best && comparisonRankValue(item.result) < Number.POSITIVE_INFINITY);
      if (summary && best) {
        const diff = runnerUp ? Math.max(0, runnerUp.result.fee - best.result.fee) : 0;
        const bankLabel = bankMode === 'smbc' ? '三井住友銀行宛' : '三井住友銀行以外';
        summary.innerHTML = `
          <span>${escapeHtml(formatJpyNumber(amount || 0))}・${escapeHtml(bankLabel)}の場合</span>
          <strong>${escapeHtml(best.name)} が ${escapeHtml(best.result.feeLabel)}で最安</strong>
          <small>${runnerUp ? `次点との差は ${escapeHtml(formatJpyNumber(diff))} です。` : '公式確認が必要な取引所もあります。'}</small>
        `;
      }
    };

    setBankMode(bankMode);
    bankButtons.forEach((button) => {
      button.addEventListener('click', () => {
        setBankMode(button.dataset.jpyWithdrawalBank);
        update();
      });
    });
    if (amountInput) {
      amountInput.addEventListener('input', update);
      amountInput.addEventListener('blur', () => {
        const amount = parseJpyAmount(amountInput.value);
        amountInput.value = new Intl.NumberFormat('ja-JP').format(amount);
        update();
      });
    }
    update();
  }

  function initMiniSimulator() {
    const root = $('[data-fee-mini-sim]');
    if (!root) return;
    const amountInput = $('[data-fee-sim-amount]', root);
    const modeButtons = $$('[data-fee-sim-mode]', root);
    const label = $('[data-fee-sim-label]', root);
    const total = $('[data-fee-sim-total]', root);
    const note = $('[data-fee-sim-note]', root);
    const link = $('.fee-mini-sim__link', root);
    let mode = 'broker';

    const assumptions = {
      broker: {
        label: '販売所の概算',
        rate: 0.015,
        note: 'スプレッド目安 1.5% として試算',
      },
      exchange: {
        label: '取引所の概算',
        rate: 0.0017,
        note: 'taker 手数料 0.12% + スリッページ目安 0.05% として試算',
      },
    };

    modeButtons.forEach((button) => {
      const active = button.classList.contains('is-active') || button.dataset.feeSimMode === mode;
      if (active) mode = button.dataset.feeSimMode || mode;
      button.setAttribute('aria-pressed', active ? 'true' : 'false');
    });

    const update = () => {
      const amount = Math.max(0, Number(amountInput && amountInput.value) || 0);
      const preset = assumptions[mode] || assumptions.broker;
      const cost = amount * preset.rate;
      if (label) label.textContent = preset.label;
      if (total) total.textContent = `約 ${formatJpy(cost).replace(/[￥¥]/g, '')}円`;
      if (note) note.textContent = preset.note;
      if (link) {
        const params = new URLSearchParams({
          market: 'BTC-JPY',
          side: 'buy',
          amountType: 'jpy',
          amount: String(Math.max(1000, Math.round(amount || 100000))),
        });
        link.href = `/simulator?${params.toString()}`;
      }
    };

    modeButtons.forEach((button) => {
      button.addEventListener('click', () => {
        mode = button.dataset.feeSimMode || 'broker';
        modeButtons.forEach((item) => {
          const active = item === button;
          item.classList.toggl