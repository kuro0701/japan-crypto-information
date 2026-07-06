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
          item.classList.toggle('is-active', active);
          item.setAttribute('aria-pressed', active ? 'true' : 'false');
        });
        update();
      });
    });

    if (amountInput) amountInput.addEventListener('input', update);
    update();
  }

  function formatBaseAmount(value, unit = 'BTC') {
    const number = Number(value);
    if (!Number.isFinite(number) || number <= 0) return `- ${unit}`;
    const digits = number >= 0.01 ? 5 : 7;
    return `${number.toFixed(digits).replace(/0+$/, '').replace(/\.$/, '')} ${unit}`;
  }

  function finiteNumber(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  }

  function buyingRowExchangeLabel(row) {
    return (row && (row.exchangeLabel || row.exchangeId)) || '取引所';
  }

  function buyingVenueCost(row) {
    const result = row && row.result;
    if (!result || result.error) return null;
    const filled = finiteNumber(result.totalBTCFilled) || 0;
    const slippagePerBase = Math.max(0, finiteNumber(result.slippageFromBestJPY) || 0);
    const fees = Math.max(0, finiteNumber(result.feesJPY) || 0);
    return slippagePerBase * filled + fees;
  }

  function buyingSalesCost(row, amount) {
    const spread = finiteNumber(row && (row.spreadPct ?? (row.result && row.result.spreadPct)));
    if (spread == null) return null;
    return Math.max(0, amount * spread / 100);
  }

  function buyingSalesBase(row) {
    return finiteNumber(row && row.result && row.result.totalBase);
  }

  function buyingVenueBase(row) {
    return finiteNumber(row && row.result && row.result.totalBTCFilled);
  }

  function buyingReadySalesRows(data, amount) {
    return (Array.isArray(data && data.rows) ? data.rows : [])
      .filter(row => row && row.status === 'ready' && row.result)
      .map(row => ({
        row,
        cost: buyingSalesCost(row, amount),
        base: buyingSalesBase(row),
      }))
      .filter(item => item.cost != null || item.base != null)
      .sort((a, b) => {
        const costDiff = (a.cost ?? Number.POSITIVE_INFINITY) - (b.cost ?? Number.POSITIVE_INFINITY);
        if (costDiff !== 0) return costDiff;
        return String(buyingRowExchangeLabel(a.row)).localeCompare(String(buyingRowExchangeLabel(b.row)), 'ja');
      });
  }

  function buyingReadyVenueRows(data) {
    return (Array.isArray(data && data.rows) ? data.rows : [])
      .filter(row => row && row.status === 'fresh' && row.result && !row.result.error)
      .map(row => ({
        row,
        cost: buyingVenueCost(row),
        base: buyingVenueBase(row),
      }))
      .filter(item => item.cost != null || item.base != null)
      .sort((a, b) => {
        const rankDiff = (a.row.rank ?? Number.POSITIVE_INFINITY) - (b.row.rank ?? Number.POSITIVE_INFINITY);
        if (rankDiff !== 0) return rankDiff;
        const costDiff = (a.cost ?? Number.POSITIVE_INFINITY) - (b.cost ?? Number.POSITIVE_INFINITY);
        if (costDiff !== 0) return costDiff;
        return String(buyingRowExchangeLabel(a.row)).localeCompare(String(buyingRowExchangeLabel(b.row)), 'ja');
      });
  }

  function renderBuyingSimRow(item, kind, amount) {
    const row = item.row || {};
    const exchangeLabel = buyingRowExchangeLabel(row);
    const isSales = kind === 'sales';
    const spread = finiteNumber(row.spreadPct ?? (row.result && row.result.spreadPct));
    const impact = finiteNumber(row.result && row.result.marketImpactPct);
    const cost = item.cost;
    const base = item.base;
    const sourceLabel = isSales ? '販売所参考' : '取引所板';
    const detail = isSales
      ? `Spread ${spread == null ? '-' : formatPct(spread, 2)} / 取得 ${formatBaseAmount(base)}`
      : `Impact ${impact == null ? '-' : formatPct(impact, 3)} / 取得 ${formatBaseAmount(base)}`;
    const href = isSales
      ? `/sales-spread?instrumentId=BTC-JPY`
      : `/simulator?market=BTC-JPY&exchange=${encodeURIComponent(row.exchangeId || '')}&side=buy&amountType=jpy&amount=${encodeURIComponent(String(amount))}`;
    return `
      <a class="buying-sim-row buying-sim-row--${isSales ? 'sales' : 'venue'}" href="${escapeHtml(href)}">
        <span>${escapeHtml(sourceLabel)}</span>
        <strong>${escapeHtml(exchangeLabel)} <em>${cost == null ? '取得待ち' : `約${escapeHtml(formatJpyNumber(cost))}`}</em></strong>
        <small>${escapeHtml(detail)}</small>
      </a>
    `;
  }

  function renderBuyingWaitingRow(kind) {
    const isSales = kind === 'sales';
    return `
      <article class="buying-sim-row is-waiting buying-sim-row--${isSales ? 'sales' : 'venue'}">
        <span>${isSales ? '販売所参考' : '取引所板'}</span>
        <strong>${isSales ? '販売所価格を取得中' : '板データを取得中'}</strong>
        <small>${isSales ? '販売所スプレッド比較で取得できた価格だけ表示します。' : 'WebSocketの板が新鮮な取引所だけ表示します。'}</small>
      </article>
    `;
  }

  function updateBuyingMeter(root, salesItems, venueItems) {
    const brokerBar = $('[data-buying-meter-broker]', root);
    const exchangeBar = $('[data-buying-meter-exchange]', root);
    const brokerLabel = $('[data-buying-meter-broker-label]', root);
    const exchangeLabel = $('[data-buying-meter-exchange-label]', root);
    const note = $('[data-buying-meter-note]', root);
    const bestSales = salesItems.filter(item => item.base != null).sort((a, b) => b.base - a.base)[0] || null;
    const bestVenue = venueItems.filter(item => item.base != null).sort((a, b) => b.base - a.base)[0] || null;
    const maxBase = Math.max(bestSales ? bestSales.base : 0, bestVenue ? bestVenue.base : 0);

    const setBar = (bar, item) => {
      if (!bar) return;
      const pct = item && maxBase > 0 ? Math.max(12, Math.min(100, (item.base / maxBase) * 100)) : 8;
      bar.style.width = `${pct.toFixed(1)}%`;
    };

    setBar(brokerBar, bestSales);
    setBar(exchangeBar, bestVenue);
    if (brokerLabel) brokerLabel.textContent = bestSales ? `${buyingRowExchangeLabel(bestSales.row)} ${formatBaseAmount(bestSales.base)}` : '取得待ち';
    if (exchangeLabel) exchangeLabel.textContent = bestVenue ? `${buyingRowExchangeLabel(bestVenue.row)} ${formatBaseAmount(bestVenue.base)}` : '取得待ち';

    if (!note) return;
    if (bestSales && bestVenue) {
      const delta = bestVenue.base - bestSales.base;
      note.textContent = Math.abs(delta) < 0.00000001
        ? '取得数量はほぼ同じです。最終注文前は公式画面の見積もりを確認してください。'
        : `同じ金額なら、現時点の最良候補では取引所板が ${formatBaseAmount(Math.abs(delta))} ${delta >= 0 ? '多い' : '少ない'} 参考結果です。`;
    } else {
      note.textContent = '現在の販売所価格と板データを取得できた取引所だけで比較します。';
    }
  }

  function initBuyingAmountSimulator() {
    $$('[data-buying-amount-sim]').forEach((root) => {
      const range = $('[data-buying-amount-range]', root);
      const output = $('[data-buying-amount-output]', root);
      const rowsHost = $('[data-buying-sim-rows]', root);
      const meta = $('[data-buying-sim-meta]', root);
      const link = $('[data-buying-sim-link]', root);
      const presets = $$('[data-buying-amount-preset]', root);
      if (!range || !rowsHost) return;

      let abortController = null;
      let debounceTimer = null;

      const amountValue = () => {
        const min = Number(range.min) || 0;
        const max = Number(range.max) || 500000;
        return Math.max(min, Math.min(max, Number(range.value) || 100000));
      };

      const syncAmountUi = () => {
        const amount = amountValue();
        const min = Number(range.min) || 0;
        const max = Number(range.max) || 500000;
        const progress = max > min ? ((amount - min) / (max - min)) * 100 : 0;
        root.style.setProperty('--buying-amount-progress', `${progress}%`);
        if (output) output.textContent = formatJpyNumber(amount);
        if (link) {
          const params = new URLSearchParams({
            market: 'BTC-JPY',
            side: 'buy',
            amountType: 'jpy',
            amount: String(Math.round(amount)),
          });
          link.href = `/simulator?${params.toString()}`;
        }
        presets.forEach((button) => {
          const active = Number(button.dataset.buyingAmountPreset) === amount;
          button.classList.toggle('is-active', active);
          button.setAttribute('aria-pressed', active ? 'true' : 'false');
        });
      };

      const fetchJson = async (path, signal) => {
        const response = await fetch(path, { cache: 'no-store', signal });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json();
      };

      const render = (salesData, venueData, amount) => {
        const salesItems = buyingReadySalesRows(salesData, amount);
        const venueItems = buyingReadyVenueRows(venueData);
        const visibleRows = [
          ...salesItems.slice(0, 3).map(item => renderBuyingSimRow(item, 'sales', amount)),
          ...venueItems.slice(0, 3).map(item => renderBuyingSimRow(item, 'venue', amount)),
        ];

        if (visibleRows.length === 0) {
          rowsHost.innerHTML = `${renderBuyingWaitingRow('sales')}${renderBuyingWaitingRow('venue')}`;
        } else {
          rowsHost.innerHTML = visibleRows.join('');
        }

        updateBuyingMeter(root, salesItems, venueItems);
        const updatedAt = (salesData && salesData.meta && salesData.meta.generatedAt)
          || (venueData && venueData.meta && venueData.meta.generatedAt)
          || new Date().toISOString();
        if (meta) {
          const salesCount = salesItems.length;
          const venueCount = venueItems.length;
          meta.textContent = `${formatCompactDateTime(updatedAt)} 取得 / 販売所 ${salesCount}件・取引所板 ${venueCount}件の参考値`;
        }
        root.classList.add('is-fresh');
        window.setTimeout(() => root.classList.remove('is-fresh'), 560);
      };

      const load = async () => {
        const amount = amountValue();
        syncAmountUi();
        if (abortController) abortController.abort();
        abortController = new AbortController();
        const controller = abortController;
        const params = new URLSearchParams({
          instrumentId: 'BTC-JPY',
          side: 'buy',
          amountType: 'jpy',
          amount: String(Math.round(amount)),
        });
        try {
          const [salesResult, venueResult] = await Promise.allSettled([
            fetchJson(`/api/sales-reference-comparison?${params.toString()}`, controller.signal),
            fetchJson(`/api/market-impact-comparison?${params.toString()}`, controller.signal),
          ]);
          if (abortController !== controller) return;
          const salesData = salesResult.status === 'fulfilled' ? salesResult.value : null;
          const venueData = venueResult.status === 'fulfilled' ? venueResult.value : null;
          render(salesData, venueData, amount);
        } catch (err) {
          if (err && err.name === 'AbortError') return;
          rowsHost.innerHTML = `${renderBuyingWaitingRow('sales')}${renderBuyingWaitingRow('venue')}`;
          if (meta) meta.textContent = '参考値を取得できませんでした。リンク先の比較ツールで再確認してください。';
        }
      };

      const scheduleLoad = () => {
        syncAmountUi();
        if (debounceTimer) window.clearTimeout(debounceTimer);
        debounceTimer = window.setTimeout(load, 180);
      };

      presets.forEach((button) => {
        button.addEventListener('click', () => {
          const amount = Number(button.dataset.buyingAmountPreset);
          if (Number.isFinite(amount)) {
            range.value = String(amount);
            scheduleLoad();
          }
        });
      });
      range.addEventListener('input', scheduleLoad);
      window.addEventListener('okj:buying-amount-request', (event) => {
        const amount = Number(event.detail && event.detail.amount);
        if (!Number.isFinite(amount)) return;
        range.value = String(Math.max(Number(range.min) || 0, Math.min(Number(range.max) || amount, amount)));
        scheduleLoad();
      });

      syncAmountUi();
      load();
      window.setInterval(load, 30000);
    });
  }

  function initBuyingIntentFilters() {
    const triggers = $$('[data-buying-intent]');
    if (!triggers.length) return;
    let highlightTimer = null;

    const clearHighlights = () => {
      $$('[data-buying-highlight]').forEach(node => node.classList.remove('is-highlighted'));
    };

    triggers.forEach((trigger) => {
      trigger.addEventListener('click', (event) => {
        const targetId = trigger.dataset.buyingScrollTarget || String(trigger.getAttribute('href') || '').replace(/^#/, '');
        const target = targetId ? document.getElementById(targetId) : null;
        const intent = trigger.dataset.buyingIntent || '';
        const amount = Number(trigger.dataset.buyingAmount);

        if (target) {
          event.preventDefault();
          target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
        if (Number.isFinite(amount)) {
          window.dispatchEvent(new CustomEvent('okj:buying-amount-request', {
            detail: { amount },
          }));
        }

        triggers.forEach(item => item.classList.toggle('is-active', item === trigger));
        clearHighlights();
        $$('[data-buying-highlight]').filter(node => node.dataset.buyingHighlight === intent).forEach(node => node.classList.add('is-highlighted'));
        if (highlightTimer) window.clearTimeout(highlightTimer);
        highlightTimer = window.setTimeout(clearHighlights, 5200);
      });
    });
  }

  function showArticleToast(message) {
    let toast = $('[data-article-toast]');
    if (!toast) {
      toast = document.createElement('div');
      toast.className = 'article-toast';
      toast.dataset.articleToast = 'true';
      toast.setAttribute('role', 'status');
      toast.setAttribute('aria-live', 'polite');
      document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.classList.add('is-visible');
    window.clearTimeout(showArticleToast.timer);
    showArticleToast.timer = window.setTimeout(() => {
      toast.classList.remove('is-visible');
    }, 2200);
  }

  async function copyTextToClipboard(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      return;
    }
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.left = '-9999px';
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    textarea.remove();
  }

  function initArticleCopyToast() {
    document.addEventListener('click', async (event) => {
      const trigger = event.target && event.target.closest ? event.target.closest('[data-copy-text]') : null;
      if (!trigger) return;
      const text = trigger.dataset.copyText || trigger.textContent || '';
      if (!text.trim()) return;
      event.preventDefault();
      try {
        await copyTextToClipboard(text.trim());
        showArticleToast(trigger.dataset.copySuccessText || 'コピーしました');
      } catch (_) {
        showArticleToast('コピーできませんでした');
      }
    });
  }

  function initBeginnerModeToast() {
    window.addEventListener('okj:beginner-mode-change', (event) => {
      const enabled = Boolean(event.detail && event.detail.enabled);
      showArticleToast(enabled
        ? '初心者モードがONになりました。専門用語に解説が追加されます。'
        : '初心者モードをOFFにしました。通常表示に戻ります。');
    });
  }

  function previousSectionHeading(node) {
    let cursor = node ? node.previousElementSibling : null;
    while (cursor) {
      if (/^H[2-3]$/i.test(cursor.tagName)) return cursor;
      cursor = cursor.previousElementSibling;
    }
    return null;
  }

  function articleTableHeaderLabels(table) {
    const headerRow = table && table.tHead && table.tHead.rows ? table.tHead.rows[0] : null;
    return Array.from(headerRow ? headerRow.cells : [])
      .map(cell => cell.textContent.trim())
      .filter(Boolean);
  }

  function shouldEnhanceArticleTable(table) {
    if (!table || table.dataset.articleTableReady === 'true') return false;
    if (table.closest('.jpy-withdrawal-table-shell, [data-jpy-withdrawal-tool], [data-buying-amount-sim], [data-exchange-checklist]')) return false;
    return Boolean(table.closest('.article-body'));
  }

  function applyMobileTableLabels(table, labels) {
    if (!labels.length || !table.tBodies) return;
    Array.from(table.tBodies).forEach((tbody) => {
      Array.from(tbody.rows).forEach((row) => {
        Array.from(row.cells).forEach((cell, index) => {
          if (!cell.getAttribute('data-label') && labels[index]) {
            cell.setAttribute('data-label', labels[index]);
          }
        });
      });
    });
  }

  function wrapArticleTable(table) {
    if (!table || table.parentElement.classList.contains('article-table-scroll')) return;
    const wrapper = document.createElement('div');
    wrapper.className = 'article-table-scroll';
    table.parentNode.insertBefore(wrapper, table);
    wrapper.appendChild(table);
  }

  function buildStatCardsFromTable(table, headingText) {
    if (!table || table.dataset.articleStatCards === 'true') return;
    const title = String(headingText || '');
    if (!/基本データ|市場データの現在地/.test(title)) return;

    const rows = Array.from(table.tBodies && table.tBodies[0] ? table.tBodies[0].rows : []);
    const items = rows.map((row) => {
      const cells = Array.from(row.cells);
      if (cells.length < 2) return null;
      return {
        label: cells[0].textContent.trim(),
        valueHtml: cells[1].innerHTML.trim(),
        noteHtml: cells[2] ? cells[2].innerHTML.trim() : '',
      };
    }).filter(item => item && item.label && item.valueHtml);

    if (!items.length) return;

    const grid = document.createElement('div');
    grid.className = `article-stat-grid ${/市場データの現在地/.test(title) ? 'article-stat-grid--market' : 'article-stat-grid--basic'}`;
    grid.setAttribute('role', 'list');
    grid.innerHTML = items.map((item, index) => `
      <article class="article-stat-card${index < 2 ? ' article-stat-card--featured' : ''}" role="listitem">
        <span>${escapeHtml(item.label)}</span>
        <strong>${item.valueHtml}</strong>
        ${item.noteHtml ? `<small>${item.noteHtml}</small>` : ''}
      </article>
    `).join('');

    table.dataset.articleStatCards = 'true';
    table.hidden = true;
    table.parentNode.insertBefore(grid, table);
  }

  function initArticleTables() {
    $$('.article-body table').forEach((table) => {
      if (!shouldEnhanceArticleTable(table)) return;
      const labels = articleTableHeaderLabels(table);
      const heading = previousSectionHeading(table);
      applyMobileTableLabels(table, labels);
      table.classList.add('data-table', 'data-table--cards', 'article-data-table');
      buildStatCardsFromTable(table, heading ? heading.textContent.trim() : '');
      if (!table.hidden) wrapArticleTable(table);
      table.dataset.articleTableReady = 'true';
    });
  }

  function articleInstrumentId() {
    const article = $('.article-main');
    const id = article && article.dataset ? article.dataset.articleInstrumentId : '';
    return String(id || '').trim().toUpperCase();
  }

  function articleTicker() {
    const article = $('.article-main');
    const ticker = article && article.dataset ? article.dataset.articleTicker : '';
    return String(ticker || '').trim().toUpperCase();
  }

  function findArticleHeading(pattern) {
    return $$('.article-body h2').find(heading => pattern.test(heading.textContent.trim())) || null;
  }

  function ensureLiveMarketCard(instrumentId, ticker) {
    let card = $('[data-article-live-market-card]');
    if (card) return card;

    const body = $('.article-body');
    if (!body || !instrumentId) return null;

    const anchor = findArticleHeading(/市場データの現在地/) || findArticleHeading(/基本データ/);
    card = document.createElement('section');
    card.className = 'article-live-market-card';
    card.dataset.articleLiveMarketCard = 'true';
    card.setAttribute('aria-live', 'polite');
    card.innerHTML = `
      <div class="article-live-market-card__copy">
        <span>Live reference</span>
        <h3>${escapeHtml(ticker || instrumentId)} の現在地</h3>
        <p>販売所の表示価格から算出した参考仲値です。実際の注文前は取引所の公式画面で最終確認してください。</p>
      </div>
      <div class="article-live-market-card__quote">
        <span data-live-market-venue>取得中</span>
        <strong data-live-market-price>取得中</strong>
        <small data-live-market-spread>スプレッド確認中</small>
      </div>
      <div class="article-live-market-card__sparkline" data-live-market-sparkline aria-hidden="true"></div>
      <div class="article-live-market-card__meta">
        <span data-live-market-trend>履歴を確認中</span>
        <span data-live-market-updated>最新取得を確認中</span>
      </div>
    `;

    if (anchor) {
      anchor.insertAdjacentElement('afterend', card);
    } else {
      body.insertBefore(card, body.firstElementChild);
    }
    return card;
  }

  function latestPriceFromRow(row) {
    const latest = row && row.latest ? row.latest : row;
    const mid = Number(latest && latest.midPrice);
    if (Number.isFinite(mid) && mid > 0) return mid;
    const buy = Number(latest && latest.buyPrice);
    const sell = Number(latest && latest.sellPrice);
    if (Number.isFinite(buy) && Number.isFinite(sell) && buy > 0 && sell > 0) {
      return (buy + sell) / 2;
    }
    return null;
  }

  function bestLiveMarketRow(rows, instrumentId) {
    const matches = (rows || []).filter(row => row && row.instrumentId === instrumentId && latestPriceFromRow(row) != null);
    return matches
      .sort((a, b) => (rowLatestSpreadValue(a) ?? Number.POSITIVE_INFINITY) - (rowLatestSpreadValue(b) ?? Number.POSITIVE_INFINITY))[0]
      || null;
  }

  function historySeriesForInstrument(rows, instrumentId) {
    const byDate = new Map();
    (rows || []).forEach((row) => {
      if (!row || row.instrumentId !== instrumentId) return;
      const price = latestPriceFromRow(row);
      if (price == null) return;
      const date = row.date || row.capturedAt || '';
      const existing = byDate.get(date);
      const spread = Number(row.spreadPct);
      if (!existing || (Number.isFinite(spread) && spread < existing.spreadPct)) {
        byDate.set(date, {
          date,
          price,
          spreadPct: Number.isFinite(spread) ? spread : Number.POSITIVE_INFINITY,
        });
      }
    });
    return Array.from(byDate.values())
      .sort((a, b) => String(a.date).localeCompare(String(b.date)))
      .slice(-14);
  }

  function renderSparkline(points) {
    const prices = points.map(point => point.price).filter(price => Number.isFinite(price) && price > 0);
    if (prices.length < 2) {
      return '<div class="article-live-market-card__sparkline-empty">履歴待ち</div>';
    }
    const width = 260;
    const height = 74;
    const padding = 8;
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const span = max - min || 1;
    const step = (width - padding * 2) / Math.max(1, prices.length - 1);
    const path = prices.map((price, index) => {
      const x = padding + step * index;
      const y = height - padding - ((price - min) / span) * (height - padding * 2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');
    const areaPath = `${padding},${height - padding} ${path} ${width - padding},${height - padding}`;
    return `
      <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="直近の参考価格推移">
        <polyline class="article-live-market-card__area" points="${areaPath}"></polyline>
        <polyline class="article-live-market-card__line" points="${path}"></polyline>
      </svg>
    `;
  }

  function renderLiveMarketCard(card, report, history, instrumentId) {
    const rows = report && Array.isArray(report.rows) ? report.rows : [];
    const historyRows = history && Array.isArray(history.rows) ? history.rows : [];
    const row = bestLiveMarketRow(rows, instrumentId);
    const price = latestPriceFromRow(row);
    const latest = row && row.latest ? row.latest : null;
    const spread = rowLatestSpreadValue(row);
    const venue = row ? row.exchangeLabel || row.exchangeId || '販売所データ' : '販売所データ';
    const series = historySeriesForInstrument(historyRows, instrumentId);
    if (price != null) {
      const lastPoint = series[series.length - 1];
      if (!lastPoint || Math.abs(lastPoint.price - price) > 1) {
        series.push({ date: latest && (latest.priceTimestamp || latest.capturedAt) || new Date().toISOString(), price, spreadPct: spread ?? Number.POSITIVE_INFINITY });
      }
    }

    const priceNode = $('[data-live-market-price]', card);
    const venueNode = $('[data-live-market-venue]', card);
    const spreadNode = $('[data-live-market-spread]', card);
    const trendNode = $('[data-live-market-trend]', card);
    const updatedNode = $('[data-live-market-updated]', card);
    const sparklineNode = $('[data-live-market-sparkline]', card);

    if (priceNode) priceNode.textContent = price != null ? formatJpy(price) : '取得待ち';
    if (venueNode) venueNode.textContent = venue;
    if (spreadNode) spreadNode.textContent = spread != null ? `販売所スプレッド ${formatPct(spread, 2)}` : 'スプレッド確認中';
    if (sparklineNode) sparklineNode.innerHTML = renderSparkline(series);

    if (trendNode) {
      const first = series[0] && series[0].price;
      const last = price || (series[series.length - 1] && series[series.length - 1].price);
      if (Number.isFinite(first) && Number.isFinite(last) && first > 0 && series.length > 1) {
        const pct = ((last - first) / first) * 100;
        trendNode.textContent = `直近履歴 ${pct >= 0 ? '+' : ''}${formatPct(pct, 2)}`;
        trendNode.dataset.trend = pct >= 0 ? 'up' : 'down';
      } else {
        trendNode.textContent = '直近履歴を蓄積中';
        trendNode.removeAttribute('data-trend');
      }
    }

    const updatedAt = (latest && (latest.priceTimestamp || latest.capturedAt))
      || (report && report.meta && (report.meta.latestCapturedAt || report.meta.generatedAt));
    if (updatedNode) updatedNode.textContent = updatedAt ? `最新取得 ${formatCompactDateTime(updatedAt)}` : '最新取得を確認中';

    card.classList.add('is-fresh');
    window.setTimeout(() => card.classList.remove('is-fresh'), 640);
  }

  function initArticleLiveMarketCard() {
    const instrumentId = articleInstrumentId();
    if (!instrumentId) return;
    const card = ensureLiveMarketCard(instrumentId, articleTicker());
    if (!card) return;

    let abortController = null;
    const load = async () => {
      if (abortController) abortController.abort();
      abortController = new AbortController();
      const controller = abortController;
      try {
        const [reportResult, historyResult] = await Promise.allSettled([
          fetch('/api/sales-spread', { cache: 'no-store', signal: controller.signal }).then((response) => {
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            return response.json();
          }),
          fetch(`/api/sales-spread/history?window=30d&instrumentId=${encodeURIComponent(instrumentId)}`, { cache: 'no-store', signal: controller.signal }).then((response) => {
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            return response.json();
          }),
        ]);
        if (abortController !== controller) return;
        const report = reportResult.status === 'fulfilled' ? reportResult.value : null;
        const history = historyResult.status === 'fulfilled' ? historyResult.value : null;
        renderLiveMarketCard(card, report, history, instrumentId);
      } catch (err) {
        if (err && err.name === 'AbortError') return;
        const updatedNode = $('[data-live-market-updated]', card);
        if (updatedNode) updatedNode.textContent = '参考値を取得できませんでした';
      }
    };

    load();
    window.setInterval(load, 30000);
  }

  function initSpreadCostSlider() {
    $$('[data-spread-cost-slider]').forEach((root) => {
      const input = $('[data-spread-cost-amount]', root);
      const amountOutput = $('[data-spread-cost-amount-output]', root);
      const lossOutput = $('[data-spread-cost-loss]', root);
      const afterOutput = $('[data-spread-cost-after]', root);
      const rate = Number(root.dataset.spreadRate) || 0.02;
      if (!input) return;

      const update = () => {
        const min = Number(input.min) || 0;
        const max = Number(input.max) || 1000000;
        const amount = Math.max(min, Math.min(max, Number(input.value) || min));
        const progress = max > min ? ((amount - min) / (max - min)) * 100 : 0;
        const loss = amount * rate;
        root.style.setProperty('--spread-cost-progress', `${progress}%`);
        if (amountOutput) amountOutput.textContent = formatJpyNumber(amount);
        if (lossOutput) lossOutput.textContent = `-${formatJpyNumber(loss)}`;
        if (afterOutput) {
          afterOutput.textContent = `${formatPct(rate * 100, 1)}の差なら、同じ場所ですぐ売る前提で約${formatJpyNumber(loss)}分の不利なスタートです。`;
        }
      };

      input.addEventListener('input', update);
      update();
    });
  }

  function rowSpreadValue(row) {
    const latest = row && row.latest ? row.latest : null;
    const average = row && row.averages && row.averages['1d'] ? row.averages['1d'] : null;
    const value = latest && latest.spreadPct != null ? latest.spreadPct : average && average.spreadPct;
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  }

  function rowLatestSpreadValue(row) {
    const latest = row && row.latest ? row.latest : null;
    const number = Number(latest && latest.spreadPct);
    return Number.isFinite(number) && number > 0 ? number : null;
  }

  function bestTickerRow(rows, instrumentId) {
    return (rows || [])
      .filter(row => row && row.instrumentId === instrumentId && rowLatestSpreadValue(row) != null)
      .sort((a, b) => rowLatestSpreadValue(a) - rowLatestSpreadValue(b))[0] || null;
  }

  function tickerRowForExchange(rows, instrumentId, exchangeId) {
    return (rows || [])
      .filter(row => (
        row
        && row.instrumentId === instrumentId
        && row.exchangeId === exchangeId
        && rowLatestSpreadValue(row) != null
      ))
      .sort((a, b) => {
        const aTime = Date.parse(a.latest && (a.latest.capturedAt || a.latest.priceTimestamp) || a.capturedAt || '');
        const bTime = Date.parse(b.latest && (b.latest.capturedAt || b.latest.priceTimestamp) || b.capturedAt || '');
        return (Number.isFinite(bTime) ? bTime : 0) - (Number.isFinite(aTime) ? aTime : 0);
      })[0] || null;
  }

  function tickerItemHtml(row, fallback) {
    if (!row) {
      return `
        <span class="article-live-ticker__item is-waiting">
          <strong>${escapeHtml(fallback.label)}</strong>
          <span>取得待ち</span>
          <small>参考値</small>
        </span>
      `;
    }
    const spread = rowLatestSpreadValue(row);
    return `
      <span class="article-live-ticker__item">
        <strong>${escapeHtml(fallback.label)}</strong>
        <span>${escapeHtml(formatPct(spread, 2))}</span>
        <small>${escapeHtml(row.exchangeLabel || row.exchangeId || '販売所')}</small>
      </span>
    `;
  }

  function renderSpreadTicker(root, data) {
    const items = $('[data-spread-live-ticker-items]', root);
    const meta = $('[data-spread-live-ticker-meta]', root);
    const path = window.location.pathname.replace(/\/+$/, '') || '/';
    const rows = data && Array.isArray(data.rows) ? data.rows : [];
    if (items) {
      if (path === '/learn/buying-100k-points' || path === '/learn/buying-100k-points.html') {
        const exchanges = [
          { id: 'bitflyer', label: 'bitFlyer' },
          { id: 'coincheck', label: 'Coincheck' },
          { id: 'gmo', label: 'GMO' },
          { id: 'bittrade', label: 'BitTrade' },
        ];
        items.innerHTML = exchanges
          .map(exchange => tickerItemHtml(tickerRowForExchange(rows, 'BTC-JPY', exchange.id), exchange))
          .join('');
      } else {
        const markets = [
          { id: 'BTC-JPY', label: 'BTC' },
          { id: 'ETH-JPY', label: 'ETH' },
          { id: 'SOL-JPY', label: 'SOL' },
        ];
        items.innerHTML = markets
          .map(market => tickerItemHtml(bestTickerRow(rows, market.id), market))
          .join('');
      }
    }
    const updatedAt = data && data.meta && (data.meta.latestCapturedAt || data.meta.generatedAt);
    if (meta) meta.textContent = updatedAt ? `最新取得 ${formatCompactDateTime(updatedAt)} / 参考値` : '参考値';
    root.hidden = false;
    root.classList.remove('is-error');
    root.classList.add('is-fresh');
    window.setTimeout(() => root.classList.remove('is-fresh'), 520);
  }

  function initSpreadLiveTicker() {
    const root = $('[data-spread-live-ticker]');
    if (!root) return;
    const path = window.location.pathname.replace(/\/+$/, '') || '/';
    const enabledPaths = new Set([
      '/learn/spread',
      '/learn/spread.html',
      '/learn/broker-loss-reasons',
      '/learn/broker-loss-reasons.html',
      '/learn/buying-100k-points',
      '/learn/buying-100k-points.html',
    ]);
    if (!enabledPaths.has(path)) return;

    const meta = $('[data-spread-live-ticker-meta]', root);
    let abortController = null;

    const fetchTicker = async () => {
      if (abortController) abortController.abort();
      abortController = new AbortController();
      try {
        const response = await fetch('/api/sales-spread', {
          cache: 'no-store',
          signal: abortController.signal,
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        renderSpreadTicker(root, data);
      } catch (err) {
        if (err && err.name === 'AbortError') return;
        root.hidden = false;
        root.classList.add('is-error');
        if (meta) meta.textContent = '取得待ち / 参考値';
      }
    };

    fetchTicker();
    window.setInterval(fetchTicker, 30000);
  }

  function initBrokerChoiceTool() {
    const root = $('[data-broker-choice-tool]');
    if (!root) return;

    const buttons = $$('[data-broker-choice]', root);
    const result = $('[data-broker-choice-result]', root);
    const link = $('[data-broker-choice-link]', root);
    const choices = {
      easy: {
        eyebrow: '販売所寄り',
        title: '少額でまず慣れたいなら、販売所から確認しやすいです。',
        body: 'ただし、買う前にスプレッドを見て、同じ金額を取引所形式で買った場合のコストも比べてください。',
        href: '/simulator?market=BTC-JPY&side=buy&amountType=jpy&amount=100000',
        linkText: '10万円買いで板コストも計算する',
      },
      cost: {
        eyebrow: '取引所寄り',
        title: '実質コストを抑えたいなら、取引所形式を候補にします。',
        body: '板が薄いとスリッページが出るため、希望金額でどの価格帯まで約定しそうかを先に見ておくと判断しやすくなります。',
        href: '/simulator?market=BTC-JPY&side=buy&amountType=jpy&amount=100000',
        linkText: '成行コストを計算してみる',
      },
    };

    const setChoice = (choiceKey) => {
      const choice = choices[choiceKey] || choices.easy;
      buttons.forEach((button) => {
        const active = button.dataset.brokerChoice === choiceKey;
        button.classList.toggle('is-active', active);
        button.setAttribute('aria-pressed', active ? 'true' : 'false');
      });

      if (result) {
        result.innerHTML = `
          <span>${escapeHtml(choice.eyebrow)}</span>
          <strong>${escapeHtml(choice.title)}</strong>
          <small>${escapeHtml(choice.body)}</small>
        `;
      }

      if (link) {
        link.href = choice.href;
        link.textContent = choice.linkText;
      }
    };

    buttons.forEach((button) => {
      button.addEventListener('click', () => {
        setChoice(button.dataset.brokerChoice || 'easy');
      });
    });
  }

  function syncArticleTerms(enabled) {
    $$(ARTICLE_TERM_SELECTOR).forEach((term) => {
      const alwaysEnabled = term.dataset.termAlways === 'true' || term.classList.contains('article-term--always');
      const interactive = enabled || alwaysEnabled;
      term.tabIndex = interactive ? 0 : -1;
      term.setAttribute('role', interactive ? 'button' : 'text');
      term.setAttribute('aria-disabled', interactive ? 'false' : 'true');
    });
  }

  function initArticleTerms() {
    const enabled = Boolean(window.BeginnerMode && window.BeginnerMode.isEnabled && window.BeginnerMode.isEnabled());
    syncArticleTerms(enabled);
    window.addEventListener('okj:beginner-mode-change', (event) => {
      syncArticleTerms(Boolean(event.detail && event.detail.enabled));
    });
  }

  function initExchangeChecklist() {
    $$('[data-exchange-checklist]').forEach((root) => {
      const items = $$('[data-checklist-item]', root);
      const count = $('[data-checklist-count]', root);
      const progress = $('[data-checklist-progress]', root);
      const complete = $('[data-checklist-complete]', root);
      if (!items.length) return;

      const storageKey = `${EXCHANGE_CHECKLIST_STORAGE_KEY}:${window.location.pathname.replace(/\/+$/, '') || '/'}`;
      const readState = () => {
        try {
          const parsed = JSON.parse(localStorage.getItem(storageKey) || '[]');
          return Array.isArray(parsed) ? parsed : [];
        } catch (_) {
          return [];
        }
      };
      const writeState = () => {
        try {
          localStorage.setItem(storageKey, JSON.stringify(items.map(item => Boolean(item.checked))));
        } catch (_) {
          // noop
        }
      };

      const update = () => {
        const checked = items.filter(item => item.checked).length;
        const total = items.length;
        const ratio = total ? checked / total : 0;
        if (count) count.textContent = `${checked} / ${total}`;
        if (progress) progress.style.transform = `scaleX(${ratio})`;
        if (complete) complete.hidden = checked !== total;
        root.classList.toggle('is-complete', checked === total);
        items.forEach((item) => {
          const label = item.closest('label');
          if (label) label.classList.toggle('is-checked', item.checked);
        });
      };

      readState().forEach((checked, index) => {
        if (items[index]) items[index].checked = Boolean(checked);
      });

      items.forEach((item) => {
        item.addEventListener('change', () => {
          writeState();
          update();
        });
      });
      update();
    });
  }

  function initArticleMobileActions() {
    const actions = $('[data-article-mobile-actions]');
    if (!actions) return;
    const tocButton = $('[data-mobile-toc-button]', actions);
    const topButton = $('[data-mobile-top-button]', actions);
    const mobileToc = $('[data-article-mobile-toc]');
    const navLinks = $$('[data-mobile-nav-link]', actions);

    const normalizedPath = window.location.pathname.replace(/\/+$/, '') || '/';
    navLinks.forEach((link) => {
      const href = String(link.getAttribute('href') || '').replace(/\/+$/, '') || '/';
      const active = href === '/about'
        ? (normalizedPath === '/about' || normalizedPath === '/about.html')
        : (normalizedPath === href || normalizedPath.startsWith(`${href}/`));
      link.classList.toggle('is-active', active);
      if (active) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    });

    const updateVisibility = () => {
      const alwaysVisible = navLinks.length > 0 && window.matchMedia && window.matchMedia('(max-width: 767px)').matches;
      actions.classList.toggle('is-visible', alwaysVisible || window.scrollY > 360);
    };

    if (tocButton) {
      tocButton.setAttribute('aria-expanded', mobileToc && mobileToc.open ? 'true' : 'false');
      tocButton.addEventListener('click', () => {
        if (!mobileToc) return;
        mobileToc.open = true;
        tocButton.setAttribute('aria-expanded', 'true');
        const summary = $('summary', mobileToc);
        if (summary) summary.focus({ preventScroll: true });
      });
    }

    if (mobileToc) {
      mobileToc.addEventListener('toggle', () => {
        if (tocButton) tocButton.setAttribute('aria-expanded', mobileToc.open ? 'true' : 'false');
      });
      $$('[data-article-mobile-toc-list] a', mobileToc).forEach((link) => {
        link.addEventListener('click', () => {
          mobileToc.open = false;
        });
      });
      document.addEventListener('click', (event) => {
        if (!mobileToc.open) return;
        const target = event.target;
        if (mobileToc.contains(target) || actions.contains(target)) return;
        mobileToc.open = false;
      });
    }

    if (topButton) {
      topButton.addEventListener('click', () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    }

    updateVisibility();
    window.addEventListener('scroll', updateVisibility, { passive: true });
    window.addEventListener('resize', updateVisibility);
  }

  document.addEventListener('DOMContentLoaded', () => {
    initThemeToggle();
    initToc();
    initReadingProgress();
    initArticleTables();
    initArticleLiveMarketCard();
    initBeginnerModeToast();
    initMiniSimulator();
    initBuyingAmountSimulator();
    initBuyingIntentFilters();
    initSpreadCostSlider();
    initSpreadLiveTicker();
    initBrokerChoiceTool();
    initJpyWithdrawalTool();
    initOrderbookLiveDemo();
    initOrderbookExecutionSim();
    initOrderbookMiniQuiz();
    initBeginnerSpotlight();
    initArticleTerms();
    initExchangeChecklist();
    initArticleMobileActions();
    initArticleCopyToast();
  });
})();
