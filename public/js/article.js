(() => {
  const THEME_STORAGE_KEY = 'okj.theme.v1';
  const EXCHANGE_CHECKLIST_STORAGE_KEY = 'okj.exchangeChecklist.v1';
  const BEGINNER_GUIDE_STORAGE_KEY = 'okj.articleBeginnerGuide.v1';
  const ARTICLE_READER_STORAGE_KEY = 'okj.articleReader.v1';
  const ARTICLE_MEMO_STORAGE_KEY = 'okj.articleMemos.v1';
  const ARTICLE_LIVE_SERIES_STORAGE_KEY = 'okj.articleLiveSeries.v1';
  const ARTICLE_TERM_SELECTOR = '.article-term[data-term-key]';
  const EXTERNAL_MARKET_REFERENCE_TICKERS = new Set(['CANTON', 'XLM']);

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

  function assignSectionReadingMinutes(headings) {
    const article = $('.article-main');
    const total = Number($('.article-reading-time', article || document)?.textContent.match(/\d+/)?.[0]) || headings.length;
    const weights = headings.map((heading) => {
      const section = heading.closest('[data-article-reading-section]');
      const text = (section || heading.parentElement || heading).textContent.replace(/\s+/g, '');
      return Math.max(80, text.length);
    });
    const weightTotal = weights.reduce((sum, value) => sum + value, 0) || 1;
    headings.forEach((heading, index) => {
      heading.dataset.articleSectionMinutes = String(Math.max(1, Math.round((weights[index] / weightTotal) * total)));
    });
  }

  function buildTocLinks(headings) {
    return headings.map((heading, index) => {
      const className = [
        'article-toc__link',
        index >= 4 ? 'article-toc__link--extra' : '',
      ].filter(Boolean).join(' ');
      return `<a class="${className}" href="#${heading.id}" data-article-toc-link="${heading.id}"><span>${escapeHtml(heading.textContent.trim())}</span><small>約${escapeHtml(heading.dataset.articleSectionMinutes || '1')}分</small></a>`;
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
    $$('[data-article-toc-collapse]', container).forEach((button) => {
      button.hidden = !expanded;
    });
  }

  function wireTocExpansion(container) {
    if (!container) return;
    $$('[data-article-toc-link]', container).forEach((link) => {
      link.addEventListener('click', () => {
        const heading = document.getElementById(link.dataset.articleTocLink || '');
        let details = heading && heading.closest('details');
        while (details) {
          details.open = true;
          details = details.parentElement && details.parentElement.closest('details');
        }
      });
    });
    $$('[data-article-toc-more]', container).forEach((button) => {
      button.addEventListener('click', () => {
        setTocExpanded(container, !container.classList.contains('is-expanded'));
      });
    });
    $$('[data-article-toc-collapse]', container).forEach((button) => {
      button.addEventListener('click', () => {
        setTocExpanded(container, false);
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
    assignSectionReadingMinutes(headings);

    const linksHtml = `${buildTocLinks(headings)}${buildTocMoreButton(headings)}`;
    tocList.innerHTML = linksHtml;
    toc.hidden = false;
    setTocExpanded(toc, true);
    wireTocExpansion(toc);
    if (mobileToc && mobileTocList) {
      mobileTocList.innerHTML = linksHtml;
      mobileToc.hidden = false;
      setTocExpanded(mobileToc, false);
      wireTocExpansion(mobileToc);
    }

    const links = $$('[data-article-toc-link]');
    let activeTocId = '';
    const setActive = (id) => {
      const changed = id !== activeTocId;
      activeTocId = id;
      links.forEach((link) => {
        const active = link.dataset.articleTocLink === id;
        link.classList.toggle('is-active', active);
        if (active) link.setAttribute('aria-current', 'true');
        else link.removeAttribute('aria-current');
        if (active && link.classList.contains('article-toc__link--extra')) {
          setTocExpanded(link.closest('[data-article-toc], [data-article-mobile-toc]'), true);
        }
      });
      if (changed) {
        const smartSection = $('[data-article-smart-section]');
        if (smartSection) smartSection.textContent = currentHeadingText(headings, id);
        const sideLink = links.find(link => link.dataset.articleTocLink === id && link.closest('[data-article-toc]'));
        if (sideLink) {
          const linkTop = sideLink.offsetTop;
          const linkBottom = linkTop + sideLink.offsetHeight;
          const visibleTop = toc.scrollTop;
          const visibleBottom = visibleTop + toc.clientHeight;
          if (linkTop < visibleTop + 12 || linkBottom > visibleBottom - 12) {
            const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
            toc.scrollTo({
              top: Math.max(0, linkTop - (toc.clientHeight - sideLink.offsetHeight) / 2),
              behavior: reduceMotion ? 'auto' : 'smooth',
            });
          }
        }
      }
    };

    let scrollSpyFrame = 0;
    const updateActiveFromScroll = () => {
      scrollSpyFrame = 0;
      const marker = Math.min(220, Math.max(112, window.innerHeight * 0.24));
      let current = headings[0];

      headings.forEach((heading) => {
        if (heading.getBoundingClientRect().top <= marker) {
          current = heading;
        }
      });

      setActive(current.id);
    };
    const queueScrollSpyUpdate = () => {
      if (scrollSpyFrame) return;
      scrollSpyFrame = window.requestAnimationFrame(updateActiveFromScroll);
    };

    updateActiveFromScroll();
    window.addEventListener('scroll', queueScrollSpyUpdate, { passive: true });
    window.addEventListener('resize', queueScrollSpyUpdate);
    window.addEventListener('hashchange', () => {
      window.requestAnimationFrame(queueScrollSpyUpdate);
    });
    window.addEventListener('load', queueScrollSpyUpdate, { once: true });
  }

  function currentHeadingText(headings, id) {
    const heading = headings.find(item => item.id === id);
    return heading ? heading.textContent.trim() : '記事の先頭';
  }

  function initReadingProgress() {
    const bar = $('[data-reading-progress]');
    const article = $('.article-main');
    if (!bar || !article) return;
    const labels = $$('[data-reading-progress-label]');
    const rings = $$('[data-reading-progress-ring]');

    const update = () => {
      const rect = article.getBoundingClientRect();
      const start = window.scrollY + rect.top;
      const end = start + article.offsetHeight - window.innerHeight;
      const progress = end <= start ? 1 : (window.scrollY - start) / (end - start);
      const clamped = Math.max(0, Math.min(1, progress));
      bar.style.transform = `scaleX(${clamped})`;
      rings.forEach((ring) => {
        ring.style.setProperty('--reading-progress', `${clamped * 360}deg`);
      });
      const percentage = `${Math.round(clamped * 100)}%`;
      labels.forEach((label) => {
        label.value = percentage;
        label.textContent = percentage;
      });
      const smartProgress = $('[data-article-smart-progress]');
      if (smartProgress) {
        const value = Math.round(clamped * 100);
        smartProgress.setAttribute('aria-valuenow', String(value));
        smartProgress.style.setProperty('--article-smart-progress', `${value}%`);
        const output = $('output', smartProgress);
        if (output) output.textContent = `${value}%`;
      }
    };

    update();
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
  }

  function syncArticleSmartHeaderPrice(value, tone = 'steady') {
    const header = $('[data-article-smart-header]');
    const price = $('[data-article-smart-price]', header || document);
    if (!header || !price || !Number.isFinite(value)) return;
    price.textContent = formatJpy(value);
    header.classList.remove('is-price-up', 'is-price-down', 'is-price-steady');
    void header.offsetWidth;
    header.classList.add(tone === 'up' ? 'is-price-up' : tone === 'down' ? 'is-price-down' : 'is-price-steady');
    window.setTimeout(() => header.classList.remove('is-price-up', 'is-price-down', 'is-price-steady'), 720);
  }

  function initArticleSmartHeader() {
    const header = $('[data-article-smart-header]');
    const article = $('.article-main[data-article-kind="market"]');
    const hero = article && $('.article-hero', article);
    if (!header || !article || !hero || !articleInstrumentId()) return;
    header.hidden = false;
    const update = () => {
      const heroBottom = window.scrollY + hero.getBoundingClientRect().bottom;
      const articleBottom = window.scrollY + article.getBoundingClientRect().bottom;
      const visible = window.scrollY > heroBottom + 40 && window.scrollY < articleBottom - window.innerHeight * 0.35;
      header.classList.toggle('is-visible', visible);
      document.body.classList.toggle('article-smart-header-visible', visible);
      header.setAttribute('aria-hidden', visible ? 'false' : 'true');
    };
    update();
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
  }

  function initArticleSummaryTabs() {
    $$('[data-article-summary-tabs]').forEach((root) => {
      const tabs = $$('[data-summary-tab]', root);
      const panels = $$('[data-summary-panel]', root);
      if (!tabs.length || !panels.length) return;

      const selectTab = (key, options = {}) => {
        const activeTab = tabs.find(tab => tab.dataset.summaryTab === key) || tabs[0];
        tabs.forEach((tab) => {
          const active = tab === activeTab;
          tab.setAttribute('aria-selected', active ? 'true' : 'false');
          tab.tabIndex = active ? 0 : -1;
        });
        panels.forEach((panel) => {
          panel.hidden = panel.dataset.summaryPanel !== activeTab.dataset.summaryTab;
        });
        root.dataset.activeSummary = activeTab.dataset.summaryTab;
        root.dispatchEvent(new CustomEvent('article:summary-mode-change', {
          bubbles: true,
          detail: { key: activeTab.dataset.summaryTab },
        }));
        if (options.focus) activeTab.focus();
      };

      tabs.forEach((tab, index) => {
        tab.addEventListener('click', () => selectTab(tab.dataset.summaryTab));
        tab.addEventListener('keydown', (event) => {
          if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
          event.preventDefault();
          let nextIndex = index;
          if (event.key === 'ArrowLeft') nextIndex = (index - 1 + tabs.length) % tabs.length;
          if (event.key === 'ArrowRight') nextIndex = (index + 1) % tabs.length;
          if (event.key === 'Home') nextIndex = 0;
          if (event.key === 'End') nextIndex = tabs.length - 1;
          selectTab(tabs[nextIndex].dataset.summaryTab, { focus: true });
        });
      });

      root.addEventListener('click', (event) => {
        const jump = event.target.closest('[data-summary-jump]');
        if (!jump) return;
        const body = root.closest('.article-body');
        const headings = body ? $$('h2', body) : [];
        const heading = headings[Number(jump.dataset.summaryJump)];
        if (!heading) return;
        let parentDetails = heading.closest('details');
        while (parentDetails) {
          parentDetails.open = true;
          parentDetails = parentDetails.parentElement && parentDetails.parentElement.closest('details');
        }
        heading.scrollIntoView({ behavior: 'smooth', block: 'start' });
        heading.focus({ preventScroll: true });
      });

      if (window.BeginnerMode && window.BeginnerMode.isEnabled && window.BeginnerMode.isEnabled()) {
        selectTab('quick');
      } else {
        selectTab(root.dataset.activeSummary || 'full');
      }
      window.addEventListener('okj:beginner-mode-change', (event) => {
        if (event.detail && event.detail.enabled) selectTab('quick');
      });
    });
  }

  function initArticleEndDisclaimer() {
    const article = $('.article-main[data-article-kind="market"]');
    const body = article && $('.article-body', article);
    if (!body) return;

    const headings = $$('h2', body);
    const heading = headings[headings.length - 1];
    if (!heading || !/免責事項|重要事項/.test(heading.textContent.trim())) return;
    const content = [];
    let cursor = heading.nextSibling;
    while (cursor) {
      const next = cursor.nextSibling;
      content.push(cursor);
      cursor = next;
    }
    if (!content.some(node => node.nodeType === 1 || String(node.textContent || '').trim())) return;

    const details = document.createElement('details');
    details.className = 'article-section-disclaimer article-section-disclaimer--shared';
    details.dataset.sharedEndDisclaimer = 'true';
    details.innerHTML = `
      <summary><span aria-hidden="true">!</span><strong>${escapeHtml(heading.textContent.trim())}</strong><small>開いて確認</small></summary>
      <div></div>
    `;
    heading.replaceWith(details);
    const container = $('div', details);
    content.forEach(node => container.appendChild(node));
  }

  function dogeSectionAudiences(label) {
    const audiences = new Set();
    if (/エグゼクティブ|歴史|供給|手数料|規制|リスク|チェックリスト|まとめ/.test(label)) audiences.add('beginner');
    if (/エグゼクティブ|供給|市場データ|上場商品|規制|競争環境|リスク|シナリオ|チェックリスト/.test(label)) audiences.add('trader');
    if (/技術|手数料|ソフトウェア|リスク|まとめ/.test(label)) audiences.add('developer');
    if (!audiences.size) audiences.add('beginner');
    return Array.from(audiences);
  }

  function syncArticleTocVisibility() {
    const article = $('.article-main');
    if (!article) return;
    $$('[data-article-toc-link]').forEach((link) => {
      const heading = document.getElementById(link.dataset.articleTocLink || '');
      const section = heading && heading.closest('[data-article-reading-section]');
      link.hidden = Boolean(section && section.classList.contains('is-reading-mode-hidden'));
    });
  }

  function collapseArticleChangelog(body) {
    const source = $('.article-changelog', body);
    if (!source || source.tagName === 'DETAILS') return;
    const title = $('h3', source)?.textContent.trim() || 'この記事の更新履歴';
    const details = document.createElement('details');
    details.className = `${source.className} article-changelog--collapsible`;
    details.dataset.sharedArticleChangelog = source.dataset.sharedArticleChangelog || 'true';
    details.innerHTML = `<summary><span>Changelog</span><strong>${escapeHtml(title)}</strong><i aria-hidden="true">＋</i></summary><div class="article-changelog__collapsible-body"></div>`;
    const host = $('.article-changelog__collapsible-body', details);
    const timeline = $('.article-changelog__timeline', source);
    if (timeline) host.appendChild(timeline);
    details.addEventListener('toggle', () => {
      const icon = $('summary i', details);
      if (icon) icon.textContent = details.open ? '−' : '＋';
    });
    source.replaceWith(details);
  }

  function collapseArticleSupplementSection(heading) {
    if (!heading || heading.closest('details')) return;
    const details = document.createElement('details');
    details.className = 'article-supplement-section';
    details.dataset.articleSupplementSection = 'true';
    details.innerHTML = `
      <summary><span>Supporting information</span><strong>${escapeHtml(heading.textContent.trim())}</strong><small>開いて確認</small><i aria-hidden="true">＋</i></summary>
      <div class="article-supplement-section__body"></div>
    `;
    const host = $('.article-supplement-section__body', details);
    heading.parentNode.insertBefore(details, heading);
    host.appendChild(heading);
    let cursor = details.nextSibling;
    while (cursor) {
      if (cursor.nodeType === 1 && (cursor.tagName === 'H2' || cursor.matches('.article-section-disclaimer'))) break;
      const next = cursor.nextSibling;
      host.appendChild(cursor);
      cursor = next;
    }
    details.addEventListener('toggle', () => {
      const icon = $('summary i', details);
      const state = $('summary small', details);
      if (icon) icon.textContent = details.open ? '−' : '＋';
      if (state) state.textContent = details.open ? '閉じる' : '開いて確認';
    });
  }

  function initArticleSupportingAccordions() {
    const body = $('.article-main .article-body');
    if (!body) return;
    collapseArticleChangelog(body);
    $$(':scope > h2', body)
      .filter(heading => /主要情報源|参考文献|参考資料|出典|ソース/i.test(heading.textContent.trim()))
      .forEach(collapseArticleSupplementSection);
  }

  function initArticleReadingModes() {
    const article = $('.article-main');
    const body = article && $('.article-body', article);
    if (!article || !body) return;

    $$(':scope > h2', body).forEach((heading) => {
      if (heading.closest('[data-article-reading-section]')) return;
      const label = heading.textContent.trim();
      const section = document.createElement('section');
      section.className = 'article-reading-section';
      section.dataset.articleReadingSection = label;
      heading.parentNode.insertBefore(section, heading);
      section.appendChild(heading);
      let cursor = section.nextSibling;
      while (cursor) {
        if (cursor.nodeType === 1 && (cursor.tagName === 'H2' || cursor.matches('.article-section-disclaimer, .article-supplement-section'))) break;
        const next = cursor.nextSibling;
        section.appendChild(cursor);
        cursor = next;
      }
    });

    const sections = $$('[data-article-reading-section]', body);
    if (!sections.length) return;
    const measureSections = () => {
      sections.forEach((section) => {
        if (section.classList.contains('is-reading-mode-hidden')) return;
        section.style.setProperty('--article-section-height', `${Math.max(120, section.scrollHeight + 32)}px`);
      });
    };
    measureSections();
    const quickPattern = /エグゼクティブ|要約|全体像|概要|歴史|コミュニティ|技術|アーキテクチャ|供給|トークノミクス|市場|価格|主要リスク|まとめ|結論/i;
    const focusPattern = /価格|市場|取引|手数料|コスト|流動性|供給|希薄化|インフレ|上場商品|規制|税|リスク|シナリオ|チェックリスト|まとめ|結論/i;
    const setReadingMode = (mode) => {
      const normalized = ['quick', 'focus'].includes(mode) ? mode : 'full';
      const pattern = normalized === 'quick' ? quickPattern : focusPattern;
      const matches = normalized === 'full'
        ? sections
        : sections.filter(section => pattern.test(section.dataset.articleReadingSection || ''));
      const visibleSections = matches.length ? matches : sections;
      article.dataset.articleReadingMode = normalized;
      sections.forEach((section) => {
        const visible = normalized === 'full' || visibleSections.includes(section);
        if (visible && section.classList.contains('is-reading-mode-hidden')) {
          section.classList.remove('is-reading-mode-hidden');
          section.style.setProperty('--article-section-height', `${Math.max(120, section.scrollHeight + 32)}px`);
          section.animate(
            [{ opacity: 0, transform: 'translateY(-8px)' }, { opacity: 1, transform: 'translateY(0)' }],
            { duration: 300, easing: 'cubic-bezier(.22,1,.36,1)' }
          );
        }
        section.classList.toggle('is-reading-mode-hidden', !visible);
        section.setAttribute('aria-hidden', visible ? 'false' : 'true');
      });
      window.requestAnimationFrame(syncArticleTocVisibility);
      window.setTimeout(() => window.dispatchEvent(new Event('resize')), 380);
    };
    body.addEventListener('article:summary-mode-change', event => setReadingMode(event.detail && event.detail.key));
    setReadingMode('full');
    window.addEventListener('resize', measureSections);
  }

  function initDogeArticleExperience() {
    const article = $('.article-main[data-article-slug="doge"]');
    const body = article && $('.article-body', article);
    if (!article || !body) return;

    $$('[data-article-reading-section]', body).forEach((section) => {
      const heading = $('h2', section);
      if (!heading) return;
      const label = section.dataset.articleReadingSection || heading.textContent.trim();
      section.classList.add('doge-section');
      section.dataset.dogeSection = label;
      const audiences = dogeSectionAudiences(label);
      section.dataset.dogeAudiences = audiences.join(' ');
      const badge = document.createElement('span');
      badge.className = 'doge-section__audience-badge';
      badge.textContent = audiences.map(item => ({ beginner: '初心者', trader: 'トレーダー', developer: '技術' }[item])).join(' / ');
      heading.appendChild(badge);
    });

    const controls = $$('[data-doge-persona]', body);
    const status = $('[data-doge-persona-status]', body);
    let activePersona = '';
    const labels = { beginner: '初心者', trader: 'トレーダー', developer: '技術・開発者' };
    controls.forEach((button) => {
      button.addEventListener('click', () => {
        const requested = button.dataset.dogePersona || '';
        activePersona = activePersona === requested ? '' : requested;
        controls.forEach((item) => {
          const active = item.dataset.dogePersona === activePersona;
          item.classList.toggle('is-active', active);
          item.setAttribute('aria-pressed', active ? 'true' : 'false');
        });
        $$('[data-doge-section]', body).forEach((section) => {
          const matches = !activePersona || String(section.dataset.dogeAudiences || '').split(/\s+/).includes(activePersona);
          section.classList.toggle('is-persona-muted', !matches);
        });
        if (status) status.textContent = activePersona
          ? `${labels[activePersona]}向けの章を強調しています。もう一度押すと解除できます。`
          : 'すべての章を表示しています';
      });
    });
  }

  function initMarketBeginnerSections() {
    const article = $('.article-main[data-article-kind="market"]');
    const body = article && $('.article-body', article);
    if (!body) return;

    const technicalPattern = /技術|仕組み|アーキテクチャ|プロトコル|コンセンサス|トークノミクス|供給|ステーキング|ガバナンス|セキュリティ|オンチェーン|スマートコントラクト|性能|パフォーマンス|実装|ネットワーク/i;
    const keepVisiblePattern = /エグゼクティブサマリー|要約|結論|リスク|規制|参考|ソース|免責/i;
    const technicalHeadings = $$('h2', body).filter((heading) => {
      const label = heading.textContent.trim();
      return technicalPattern.test(label) && !keepVisiblePattern.test(label) && !heading.closest('details');
    });
    technicalHeadings.forEach((heading) => {
      if (heading.dataset.beginnerFoldReady === 'true') return;
      const details = document.createElement('details');
      details.className = 'article-beginner-section';
      details.open = true;
      details.innerHTML = `
        <summary>
          <span>Technical detail</span>
          <strong>${escapeHtml(heading.textContent.trim())}の詳細を読む</strong>
          <small>専門的な説明と図表を開きます</small>
        </summary>
        <div class="article-beginner-section__body"></div>
      `;
      heading.insertAdjacentElement('afterend', details);
      const sectionBody = $('.article-beginner-section__body', details);
      let cursor = details.nextSibling;
      while (cursor && !(cursor.nodeType === 1 && cursor.tagName === 'H2')) {
        const next = cursor.nextSibling;
        sectionBody.appendChild(cursor);
        cursor = next;
      }
      heading.dataset.beginnerFoldReady = 'true';
    });

    const sync = (enabled) => {
      $$('.article-beginner-section', body).forEach((details) => {
        details.open = !enabled;
      });
    };
    sync(Boolean(window.BeginnerMode && window.BeginnerMode.isEnabled && window.BeginnerMode.isEnabled()));
    window.addEventListener('okj:beginner-mode-change', (event) => {
      sync(Boolean(event.detail && event.detail.enabled));
    });
  }

  function initArticleSearch() {
    const dialog = $('[data-article-search-dialog]');
    const input = $('[data-article-search-input]', dialog || document);
    const results = $('[data-article-search-results]', dialog || document);
    const body = $('.article-body');
    if (!dialog || !input || !results || !body) return;

    const searchable = $$('h2, h3, p, li, td', body)
      .filter(node => !node.closest('[hidden], .article-flow-notes'))
      .map((node, index) => ({
        node,
        index,
        text: node.textContent.replace(/\s+/g, ' ').trim(),
      }))
      .filter(item => item.text.length >= 2);

    const openDialog = () => {
      if (typeof dialog.showModal === 'function') {
        if (!dialog.open) dialog.showModal();
      } else {
        dialog.setAttribute('open', '');
      }
      window.setTimeout(() => input.focus(), 0);
      if (!input.value) {
        results.innerHTML = '<p class="article-search-dialog__empty">検索語を入力すると、本文中の候補を表示します。</p>';
      }
    };
    const closeDialog = () => {
      if (typeof dialog.close === 'function' && dialog.open) dialog.close();
      else dialog.removeAttribute('open');
    };
    const excerptFor = (text, query) => {
      const lower = text.toLocaleLowerCase('ja');
      const at = lower.indexOf(query.toLocaleLowerCase('ja'));
      const start = Math.max(0, at - 42);
      const end = Math.min(text.length, at + query.length + 70);
      return `${start ? '…' : ''}${text.slice(start, end)}${end < text.length ? '…' : ''}`;
    };
    const search = () => {
      const query = input.value.trim();
      if (!query) {
        results.innerHTML = '<p class="article-search-dialog__empty">検索語を入力すると、本文中の候補を表示します。</p>';
        return;
      }
      const normalized = query.toLocaleLowerCase('ja');
      const matches = searchable.filter(item => item.text.toLocaleLowerCase('ja').includes(normalized)).slice(0, 14);
      if (!matches.length) {
        results.innerHTML = `<p class="article-search-dialog__empty">「${escapeHtml(query)}」に一致する箇所はありません。</p>`;
        return;
      }
      results.innerHTML = matches.map(item => `
        <button type="button" role="option" data-article-search-result="${item.index}">
          <span>${escapeHtml(item.node.tagName === 'H2' || item.node.tagName === 'H3' ? '見出し' : '本文')}</span>
          <strong>${escapeHtml(excerptFor(item.text, query))}</strong>
        </button>
      `).join('');
    };

    $$('[data-article-search-open]').forEach(button => button.addEventListener('click', openDialog));
    input.addEventListener('input', search);
    results.addEventListener('click', (event) => {
      const button = event.target.closest('[data-article-search-result]');
      if (!button) return;
      const item = searchable.find(candidate => candidate.index === Number(button.dataset.articleSearchResult));
      if (!item) return;
      let parentDetails = item.node.closest('details');
      while (parentDetails) {
        parentDetails.open = true;
        parentDetails = parentDetails.parentElement && parentDetails.parentElement.closest('details');
      }
      const summaryPanel = item.node.closest('[data-summary-panel]');
      if (summaryPanel && summaryPanel.hidden) {
        const tab = $(`[data-summary-tab="${summaryPanel.dataset.summaryPanel}"]`, summaryPanel.closest('[data-article-summary-tabs]'));
        if (tab) tab.click();
      }
      closeDialog();
      item.node.scrollIntoView({ behavior: 'smooth', block: 'center' });
      item.node.classList.add('article-search-hit');
      window.setTimeout(() => item.node.classList.remove('article-search-hit'), 2600);
    });
    dialog.addEventListener('click', (event) => {
      if (event.target === dialog) closeDialog();
    });
    document.addEventListener('keydown', (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLocaleLowerCase() === 'k') {
        event.preventDefault();
        openDialog();
      }
    });
  }

  function initArticleSourcePopovers() {
    const body = $('.article-body');
    if (!body) return;
    $$('a[href]', body).forEach((source) => {
      if (source.matches('.article-source-link[data-source-title][data-source-summary]')) return;
      if (source.closest('[data-article-summary-tabs], .article-live-market-card, .article-next-actions')) return;
      if (String(source.rel || '').split(/\s+/).includes('sponsored')) return;
      let url;
      try {
        url = new URL(source.href, window.location.href);
      } catch (_) {
        return;
      }
      if (!/^https?:$/.test(url.protocol) || url.origin === window.location.origin) return;
      const host = url.hostname.replace(/^www\./, '');
      source.classList.add('article-source-link', 'article-source-link--shared');
      source.dataset.sourceTitle = source.title || source.textContent.replace(/\s+/g, ' ').trim() || host;
      source.dataset.sourceSummary = `${host} の参照ページです。本文から参照している内容と更新時点をリンク先で確認できます。`;
    });

    const sources = $$('.article-source-link[data-source-title][data-source-summary]');
    if (!sources.length) return;
    const popover = document.createElement('aside');
    popover.className = 'article-source-popover';
    popover.hidden = true;
    popover.setAttribute('role', 'dialog');
    popover.setAttribute('aria-label', '参照ソースの概要');
    document.body.appendChild(popover);
    let active = null;
    let pinned = false;

    const position = (source) => {
      const rect = source.getBoundingClientRect();
      const margin = 12;
      const width = Math.min(360, window.innerWidth - margin * 2);
      popover.style.width = `${width}px`;
      const left = Math.max(margin, Math.min(rect.left, window.innerWidth - width - margin));
      let top = rect.bottom + 10;
      if (top + popover.offsetHeight > window.innerHeight - margin) {
        top = Math.max(margin, rect.top - popover.offsetHeight - 10);
      }
      popover.style.left = `${left}px`;
      popover.style.top = `${top}px`;
    };
    const show = (source, pin = false) => {
      active = source;
      pinned = pin;
      popover.innerHTML = `
        <span>Source preview</span>
        <strong>${escapeHtml(source.dataset.sourceTitle)}</strong>
        <p>${escapeHtml(source.dataset.sourceSummary)}</p>
        <a href="${escapeHtml(source.href)}" target="_blank" rel="noopener noreferrer">参照ページを開く ↗</a>
      `;
      popover.hidden = false;
      source.setAttribute('aria-expanded', 'true');
      position(source);
    };
    const hide = () => {
      if (active) active.setAttribute('aria-expanded', 'false');
      active = null;
      pinned = false;
      popover.hidden = true;
    };

    sources.forEach((source) => {
      source.setAttribute('aria-haspopup', 'dialog');
      source.setAttribute('aria-expanded', 'false');
      source.addEventListener('mouseenter', () => show(source));
      source.addEventListener('focus', () => show(source));
      source.addEventListener('mouseleave', () => {
        if (!pinned) hide();
      });
      source.addEventListener('click', (event) => {
        event.preventDefault();
        if (active === source && pinned) hide();
        else show(source, true);
      });
    });
    popover.addEventListener('mouseleave', () => {
      if (!pinned) hide();
    });
    document.addEventListener('click', (event) => {
      if (!pinned || event.target.closest('.article-source-link, .article-source-popover')) return;
      hide();
    });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && !popover.hidden) hide();
    });
    window.addEventListener('resize', () => {
      if (active && !popover.hidden) position(active);
    });
    window.addEventListener('scroll', () => {
      if (active && !popover.hidden) position(active);
    }, true);
  }

  function formatJpy(value) {
    const number = Number(value);
    const maximumFractionDigits = Number.isFinite(number) && Math.abs(number) < 100 ? 2 : 0;
    return new Intl.NumberFormat('ja-JP', {
      style: 'currency',
      currency: 'JPY',
      maximumFractionDigits,
    }).format(number || 0);
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

  function initDogeSupplySimulator() {
    $$('[data-doge-supply-simulator]').forEach((root) => {
      const input = $('[data-doge-supply-years]', root);
      const yearOutput = $('[data-doge-supply-year]', root);
      const totalOutput = $('[data-doge-supply-total]', root);
      const addedOutput = $('[data-doge-supply-added]', root);
      const inflationOutput = $('[data-doge-supply-inflation]', root);
      const chart = $('[data-doge-supply-chart]', root);
      const baseSupply = Number(root.dataset.baseSupply);
      const annualIssuance = Number(root.dataset.annualIssuance);
      if (!input || !chart || !Number.isFinite(baseSupply) || !Number.isFinite(annualIssuance)) return;

      const supplyLabel = value => `${(value / 100000000).toLocaleString('ja-JP', { maximumFractionDigits: 1 })}億 DOGE`;
      const update = () => {
        const years = Math.max(1, Math.min(10, Number(input.value) || 1));
        const total = baseSupply + annualIssuance * years;
        const inflation = annualIssuance / total * 100;
        const progress = (years - 1) / 9 * 100;
        root.style.setProperty('--doge-supply-progress', `${progress}%`);
        if (yearOutput) yearOutput.textContent = `${years}年後`;
        if (totalOutput) totalOutput.textContent = supplyLabel(total);
        if (addedOutput) addedOutput.textContent = `基準時点から +${supplyLabel(annualIssuance * years)}`;
        if (inflationOutput) inflationOutput.textContent = `${inflation.toFixed(2)}% / 年`;

        const width = 720;
        const height = 220;
        const padX = 34;
        const padY = 26;
        const points = Array.from({ length: years + 1 }, (_, index) => {
          const supply = baseSupply + annualIssuance * index;
          return { year: index, supply, inflation: annualIssuance / supply * 100 };
        });
        const supplyMin = baseSupply;
        const supplyMax = total;
        const inflationMax = points[0].inflation;
        const inflationMin = points[points.length - 1].inflation;
        const x = year => padX + (year / Math.max(1, years)) * (width - padX * 2);
        const ySupply = value => height - padY - ((value - supplyMin) / Math.max(1, supplyMax - supplyMin)) * (height - padY * 2);
        const yInflation = value => height - padY - ((value - inflationMin) / Math.max(0.0001, inflationMax - inflationMin)) * (height - padY * 2);
        const supplyPath = points.map(point => `${x(point.year).toFixed(1)},${ySupply(point.supply).toFixed(1)}`).join(' ');
        const inflationPath = points.map(point => `${x(point.year).toFixed(1)},${yInflation(point.inflation).toFixed(1)}`).join(' ');
        chart.innerHTML = `
          <svg viewBox="0 0 ${width} ${height}" aria-hidden="true" focusable="false">
            <defs><linearGradient id="doge-supply-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f5c451" stop-opacity=".34"/><stop offset="1" stop-color="#f5c451" stop-opacity="0"/></linearGradient></defs>
            <path class="doge-supply-grid" d="M${padX} ${padY}H${width - padX}M${padX} ${height / 2}H${width - padX}M${padX} ${height - padY}H${width - padX}"/>
            <polygon class="doge-supply-area" points="${supplyPath} ${x(years).toFixed(1)},${height - padY} ${x(0).toFixed(1)},${height - padY}"/>
            <polyline class="doge-supply-line" points="${supplyPath}"/>
            <polyline class="doge-inflation-line" points="${inflationPath}"/>
            ${points.map(point => `<circle class="doge-supply-point" cx="${x(point.year).toFixed(1)}" cy="${ySupply(point.supply).toFixed(1)}" r="3"><title>${point.year}年後 ${supplyLabel(point.supply)}</title></circle>`).join('')}
            ${points.map(point => `<circle class="doge-inflation-point" cx="${x(point.year).toFixed(1)}" cy="${yInflation(point.inflation).toFixed(1)}" r="3"><title>${point.year}年後 ${point.inflation.toFixed(2)}%</title></circle>`).join('')}
            <text x="${padX}" y="${height - 6}">現在</text><text x="${width - padX}" y="${height - 6}" text-anchor="end">${years}年後</text>
          </svg>
        `;
        chart.setAttribute('aria-label', `${years}年後の推定総供給量は${supplyLabel(total)}、その時点の単純年間増加率は${inflation.toFixed(2)}%です。`);
      };
      input.addEventListener('input', update);
      update();
    });
  }

  function dogeCostAction(row) {
    const actions = row && row.actions ? row.actions : {};
    return actions.referralUrl || actions.signupUrl || actions.detailPath || '/markets/DOGE-JPY';
  }

  function renderDogeCostRow(row, amount) {
    const labels = { gmo: 'GMOコイン', bitbank: 'bitbank' };
    const id = row && row.exchangeId ? row.exchangeId : '';
    const label = labels[id] || buyingRowExchangeLabel(row);
    const ready = row && row.status === 'fresh' && row.result && !row.result.error && row.result.executionStatus === 'executable';
    if (!ready) {
      return `
        <article class="doge-cost-row is-waiting" data-exchange-id="${escapeHtml(id)}">
          <div><span>${escapeHtml(label)}</span><strong>板データ取得待ち</strong></div>
          <p>${escapeHtml((row && row.message) || '新鮮な板を取得でき次第、自動で比較します。')}</p>
          <a href="${escapeHtml(dogeCostAction(row))}">公式条件を確認 ↗</a>
        </article>
      `;
    }
    const result = row.result;
    const filled = finiteNumber(result.totalBTCFilled) || 0;
    const fees = Math.max(0, finiteNumber(result.feesJPY) || 0);
    const friction = Math.max(0, buyingVenueCost(row) || 0);
    const impact = finiteNumber(result.marketImpactPct);
    const effectiveVwap = finiteNumber(result.effectiveVWAP);
    return `
      <article class="doge-cost-row" data-exchange-id="${escapeHtml(id)}" data-doge-filled="${filled}" data-doge-friction="${friction}">
        <div class="doge-cost-row__title"><span>${escapeHtml(label)}</span><strong>${escapeHtml(formatBaseAmount(filled, 'DOGE'))}</strong><small>${escapeHtml(formatJpy(amount))}での取得目安</small></div>
        <dl>
          <div><dt>板＋手数料の推定コスト</dt><dd>${escapeHtml(formatJpy(friction))}</dd></div>
          <div><dt>取引手数料</dt><dd>${escapeHtml(formatJpy(fees))}</dd></div>
          <div><dt>実効VWAP</dt><dd>${effectiveVwap == null ? '—' : escapeHtml(formatJpy(effectiveVwap))}</dd></div>
          <div><dt>Impact</dt><dd>${impact == null ? '—' : escapeHtml(formatPct(impact, 3))}</dd></div>
        </dl>
        <a href="${escapeHtml(dogeCostAction(row))}">口座開設 / 取引へ ↗</a>
      </article>
    `;
  }

  function initDogeCostCalculator() {
    const root = $('[data-doge-cost-calculator]');
    if (!root) return;
    const input = $('[data-doge-cost-amount]', root);
    const rowsHost = $('[data-doge-cost-rows]', root);
    const summary = $('[data-doge-cost-summary]', root);
    if (!input || !rowsHost) return;
    let abortController = null;
    let debounceTimer = null;

    const load = async () => {
      const amount = Math.max(1000, Math.min(10000000, Number(input.value) || 100000));
      input.value = String(Math.round(amount));
      if (abortController) abortController.abort();
      abortController = new AbortController();
      const controller = abortController;
      root.setAttribute('aria-busy', 'true');
      const params = new URLSearchParams({ instrumentId: 'DOGE-JPY', side: 'buy', amountType: 'jpy', amount: String(Math.round(amount)) });
      try {
        const response = await fetch(`/api/market-impact-comparison?${params.toString()}`, { cache: 'no-store', signal: controller.signal });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        if (abortController !== controller) return;
        const byId = new Map((Array.isArray(data.rows) ? data.rows : []).map(row => [row.exchangeId, row]));
        const rows = ['gmo', 'bitbank'].map(id => byId.get(id) || { exchangeId: id, status: 'waiting' });
        rowsHost.innerHTML = rows.map(row => renderDogeCostRow(row, amount)).join('');
        const ready = rows
          .filter(row => row.status === 'fresh' && row.result && !row.result.error && row.result.executionStatus === 'executable')
          .map(row => ({ row, filled: finiteNumber(row.result.totalBTCFilled) || 0, friction: Math.max(0, buyingVenueCost(row) || 0) }));
        if (summary && ready.length === 2) {
          const winner = ready.slice().sort((a, b) => b.filled - a.filled)[0];
          const other = ready.find(item => item !== winner);
          const dogeDiff = Math.abs(winner.filled - other.filled);
          const costDiff = Math.abs(winner.friction - other.friction);
          const headline = dogeDiff < 0.00001
            ? '2社の取得量差はほぼありません'
            : `${buyingRowExchangeLabel(winner.row)}の取得量が約${formatBaseAmount(dogeDiff, 'DOGE')}多い`;
          summary.innerHTML = `<span>現時点の参考結果</span><strong>${escapeHtml(headline)}</strong><small>推定コスト差は約${escapeHtml(formatJpy(costDiff))}。最終注文前に両社の公式画面で確認してください。</small>`;
        } else if (summary) {
          summary.textContent = `板を取得できた${ready.length}社を表示中です。2社そろうと差額を自動計算します。`;
        }
      } catch (error) {
        if (error && error.name === 'AbortError') return;
        rowsHost.innerHTML = '<p>板データを取得できませんでした。時間をおいて再度お試しください。</p>';
        if (summary) summary.textContent = '比較ツールでDOGE/JPYの最新板を確認してください。';
      } finally {
        if (abortController === controller) root.setAttribute('aria-busy', 'false');
      }
    };
    const schedule = () => {
      if (debounceTimer) window.clearTimeout(debounceTimer);
      debounceTimer = window.setTimeout(load, 220);
    };
    input.addEventListener('input', schedule);
    input.addEventListener('change', load);
    load();
    window.setInterval(load, 30000);
  }

  function wrapArticleCanvasText(context, text, x, y, maxWidth, lineHeight, maxLines) {
    const characters = Array.from(String(text || ''));
    const lines = [];
    let line = '';
    characters.forEach((character) => {
      const candidate = line + character;
      if (context.measureText(candidate).width > maxWidth && line) {
        lines.push(line);
        line = character;
      } else {
        line = candidate;
      }
    });
    if (line) lines.push(line);
    lines.slice(0, maxLines).forEach((item, index) => {
      const clipped = index === maxLines - 1 && lines.length > maxLines ? `${item.slice(0, -1)}…` : item;
      context.fillText(clipped, x, y + index * lineHeight);
    });
  }

  function saveArticleSectionCard(title, summary, slug) {
    const article = $('.article-main');
    const articleSlug = String(article && article.dataset.articleSlug || 'article').replace(/[^a-z0-9-]/gi, '-') || 'article';
    const ticker = String(article && article.dataset.articleTicker || '').trim().toUpperCase();
    const articleTitle = $('.article-hero__title', article || document)?.textContent.replace(/\s+/g, ' ').trim() || document.title;
    const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#35c8d2';
    const canvas = document.createElement('canvas');
    canvas.width = 1200;
    canvas.height = 630;
    const context = canvas.getContext('2d');
    if (!context) return;
    const gradient = context.createLinearGradient(0, 0, 1200, 630);
    gradient.addColorStop(0, '#070b0e');
    gradient.addColorStop(0.65, '#111a1d');
    gradient.addColorStop(1, '#0b2930');
    context.fillStyle = gradient;
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = 'rgba(53,200,210,.14)';
    context.beginPath();
    context.arc(1050, 80, 280, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = accent;
    context.font = '800 26px sans-serif';
    context.fillText(`${ticker || 'CRYPTO'} RESEARCH`, 70, 82);
    context.fillStyle = '#f7faf9';
    context.font = '800 54px sans-serif';
    wrapArticleCanvasText(context, title, 70, 180, 1030, 72, 3);
    context.fillStyle = '#c5d0cf';
    context.font = '400 30px sans-serif';
    wrapArticleCanvasText(context, summary, 70, 390, 1040, 46, 3);
    context.fillStyle = accent;
    context.font = '700 24px sans-serif';
    context.fillText(`${articleTitle} — ${window.location.host}${window.location.pathname}`, 70, 574);
    const download = (url) => {
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `${articleSlug}-${slug || 'section'}.png`;
      anchor.click();
    };
    if (canvas.toBlob) {
      canvas.toBlob((blob) => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        download(url);
        window.setTimeout(() => URL.revokeObjectURL(url), 1200);
      }, 'image/png');
    } else {
      download(canvas.toDataURL('image/png'));
    }
  }

  function articleHeadingText(heading) {
    if (!heading) return '';
    const clone = heading.cloneNode(true);
    $$('.doge-section__audience-badge', clone).forEach(node => node.remove());
    return clone.textContent.replace(/\s+/g, ' ').trim();
  }

  function initArticleSectionShareTools() {
    const article = $('.article-main');
    if (!article) return;
    const articleTitle = articleHeadingText($('.article-hero__title', article)) || document.title;
    $$('[data-article-reading-section]', article).forEach((section) => {
      const heading = $('h2', section);
      if (!heading || !heading.id || /主要情報源|参考文献|参考資料|出典|ソース/i.test(heading.textContent)) return;
      const summary = $('p', section)?.textContent.replace(/\s+/g, ' ').trim().slice(0, 180) || `${articleTitle}の要点を確認します。`;
      const tools = document.createElement('div');
      tools.className = 'article-section-share';
      tools.setAttribute('aria-label', `${articleHeadingText(heading)}を共有`);
      tools.innerHTML = '<button type="button" data-article-section-share="x">X</button><button type="button" data-article-section-share="image">画像保存</button><button type="button" data-article-section-share="copy">リンク</button>';
      heading.insertAdjacentElement('afterend', tools);
      tools.addEventListener('click', async (event) => {
        const button = event.target.closest('[data-article-section-share]');
        if (!button) return;
        const url = new URL(window.location.href);
        url.hash = heading.id;
        const title = articleHeadingText(heading);
        if (button.dataset.articleSectionShare === 'x') {
          const intent = new URL('https://twitter.com/intent/tweet');
          intent.searchParams.set('text', `${title}｜${articleTitle}`);
          intent.searchParams.set('url', url.href);
          window.open(intent.href, '_blank', 'noopener,noreferrer,width=640,height=560');
        } else if (button.dataset.articleSectionShare === 'image') {
          saveArticleSectionCard(title, summary, heading.id);
          showArticleToast('共有カード画像を保存しました');
        } else {
          await copyTextToClipboard(url.href);
          showArticleToast('この章のリンクをコピーしました');
        }
      });
    });
  }

  function initArticleSmartMobileBar() {
    const article = $('.article-main');
    const actions = $('[data-article-mobile-actions]');
    if (!article || !actions) return;
    const hasLivePrice = Boolean(String(article.dataset.articleInstrumentId || '').trim());
    const readingTime = $('.article-reading-time', article)?.textContent.match(/\d+/)?.[0] || '';
    actions.classList.add('article-mobile-actions--smart');
    actions.innerHTML = `
      <button type="button" data-mobile-toc-button><span aria-hidden="true">☰</span><strong>目次</strong></button>
      ${hasLivePrice
        ? '<button type="button" data-article-mobile-price><span data-article-mobile-price-value>取得中</span><strong>価格</strong></button>'
        : '<button type="button" data-mobile-top-button><span aria-hidden="true">↑</span><strong>上へ</strong></button>'}
      <button type="button" data-article-mobile-mode><span data-article-mobile-mode-value>${escapeHtml(readingTime ? `${readingTime}分` : '全体')}</span><strong>モード</strong></button>
      <button type="button" data-article-mobile-share><span aria-hidden="true">↗</span><strong>シェア</strong></button>
    `;
    const priceButton = $('[data-article-mobile-price]', actions);
    const priceValue = $('[data-article-mobile-price-value]', actions);
    const modeButton = $('[data-article-mobile-mode]', actions);
    const modeValue = $('[data-article-mobile-mode-value]', actions);
    const shareButton = $('[data-article-mobile-share]', actions);
    const livePrice = $('[data-live-market-price]');
    const syncPrice = () => {
      if (priceValue && livePrice) priceValue.textContent = livePrice.textContent.trim() || '取得中';
    };
    syncPrice();
    if (livePrice) new MutationObserver(syncPrice).observe(livePrice, { childList: true, subtree: true, characterData: true });
    if (priceButton) priceButton.addEventListener('click', () => {
      const card = $('[data-article-live-market-card]');
      if (card) card.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    const summaryRoot = $('[data-article-summary-tabs]');
    const syncMode = () => {
      const key = summaryRoot && summaryRoot.dataset.activeSummary;
      const tab = key && $(`[data-summary-tab="${key}"]`, summaryRoot);
      const compact = tab && tab.textContent.match(/\d+分/)?.[0];
      if (modeValue) modeValue.textContent = compact || (key === 'full' && readingTime ? `${readingTime}分` : '全体');
    };
    syncMode();
    if (summaryRoot) new MutationObserver(syncMode).observe(summaryRoot, { attributes: true, attributeFilter: ['data-active-summary'] });
    if (modeButton) modeButton.addEventListener('click', () => {
      const tabs = summaryRoot ? $$('[data-summary-tab]', summaryRoot) : [];
      const activeIndex = tabs.findIndex(tab => tab.getAttribute('aria-selected') === 'true');
      if (tabs.length) tabs[(activeIndex + 1 + tabs.length) % tabs.length].click();
    });
    if (shareButton) shareButton.addEventListener('click', () => {
      const trigger = $('[data-reader-share]');
      if (trigger) trigger.click();
    });
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

  function articleReaderSettings() {
    try {
      const parsed = JSON.parse(localStorage.getItem(ARTICLE_READER_STORAGE_KEY) || '{}');
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch (_) {
      return {};
    }
  }

  function writeArticleReaderSettings(settings) {
    try {
      localStorage.setItem(ARTICLE_READER_STORAGE_KEY, JSON.stringify(settings));
    } catch (_) {
      // Keep the current session usable when storage is unavailable.
    }
  }

  function articleInlineMarkdown(node) {
    const clone = node.cloneNode(true);
    $$('button, script, style, [hidden]', clone).forEach(item => item.remove());
    $$('a[href]', clone).forEach((link) => {
      const href = link.getAttribute('href') || '';
      const text = link.textContent.trim() || href;
      link.replaceWith(document.createTextNode(`[${text}](${href})`));
    });
    $$('strong, b', clone).forEach((strong) => {
      strong.replaceWith(document.createTextNode(`**${strong.textContent.trim()}**`));
    });
    $$('br', clone).forEach(br => br.replaceWith(document.createTextNode('\n')));
    return clone.textContent.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
  }

  function articleMarkdownFromDom() {
    const article = $('.article-main');
    const body = $('.article-body');
    if (!article || !body) return '';
    const title = $('.article-hero__title', article)?.textContent.trim() || document.title;
    const description = $('.article-hero__copy > p:last-child', article)?.textContent.trim() || '';
    const lines = [`# ${title}`, '', description, '', `Source: ${window.location.href}`, ''];

    Array.from(body.children).forEach((node) => {
      if (node.matches('.article-live-market-card, .article-changelog, .article-toast')) return;
      if (/^H[2-4]$/.test(node.tagName)) {
        lines.push(`${'#'.repeat(Number(node.tagName.slice(1)))} ${node.textContent.trim()}`, '');
        return;
      }
      if (node.tagName === 'P' || node.tagName === 'BLOCKQUOTE') {
        const text = articleInlineMarkdown(node);
        if (text) lines.push(node.tagName === 'BLOCKQUOTE' ? `> ${text}` : text, '');
        return;
      }
      if (node.matches('UL, OL')) {
        $$(':scope > li', node).forEach((item, index) => {
          lines.push(`${node.tagName === 'OL' ? `${index + 1}.` : '-'} ${articleInlineMarkdown(item)}`);
        });
        lines.push('');
        return;
      }
      if (node.tagName === 'TABLE') {
        const rows = $$('tr', node).map(row => $$('th, td', row).map(cell => cell.textContent.replace(/\|/g, '\\|').trim()));
        if (rows.length) {
          lines.push(`| ${rows[0].join(' | ')} |`);
          lines.push(`| ${rows[0].map(() => '---').join(' | ')} |`);
          rows.slice(1).forEach(row => lines.push(`| ${row.join(' | ')} |`));
          lines.push('');
        }
        return;
      }
      if (node.tagName === 'DETAILS') {
        const text = articleInlineMarkdown(node);
        if (text) lines.push(text, '');
      }
    });
    return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n';
  }

  function initArticleReaderTools() {
    const tools = $('[data-article-reader-tools]');
    const article = $('.article-main');
    const body = $('.article-body');
    if (!tools || !article || !body) return;
    const menu = $('[data-reader-tools-menu]', tools);
    const menuToggle = $('[data-reader-tools-toggle]', tools);
    const menuToggleLabel = $('[data-reader-tools-toggle-label]', tools);
    const dialog = $('[data-reader-settings-dialog]');
    const sizeRange = $('[data-reader-size-range]', dialog || document);
    const sizeOutput = $('[data-reader-size-output]', dialog || document);
    const lineHeightRange = $('[data-reader-line-height-range]', dialog || document);
    const lineHeightOutput = $('[data-reader-line-height-output]', dialog || document);
    const settings = articleReaderSettings();
    let fontScale = Number(settings.fontScale);
    if (!Number.isFinite(fontScale)) fontScale = 1;
    fontScale = Math.max(0.9, Math.min(1.3, fontScale));
    let lineHeight = Number(settings.lineHeight);
    if (!Number.isFinite(lineHeight)) lineHeight = 1.8;
    lineHeight = Math.max(1.5, Math.min(2.2, lineHeight));
    let readerTheme = ['dark', 'sepia', 'light', 'oled'].includes(settings.readerTheme)
      ? settings.readerTheme
      : readStoredTheme();
    let readerFamily = settings.readerFamily === 'serif' ? 'serif' : 'sans';
    let readerHighlights = settings.readerHighlights !== false;
    let utterance = null;

    const syncFont = () => {
      article.style.setProperty('--article-reader-scale', String(fontScale));
      article.style.setProperty('--article-reader-line-height', String(lineHeight));
      article.dataset.readerTheme = readerTheme;
      article.dataset.readerFamily = readerFamily;
      article.classList.toggle('article-reader-highlights', readerHighlights);
      tools.dataset.fontScale = fontScale.toFixed(2);
      if (sizeRange) sizeRange.value = String(Math.round(fontScale * 100));
      if (sizeOutput) sizeOutput.textContent = `${Math.round(fontScale * 100)}%`;
      if (lineHeightRange) lineHeightRange.value = String(Math.round(lineHeight * 100));
      if (lineHeightOutput) lineHeightOutput.textContent = lineHeight.toFixed(2);
      $$('[data-reader-theme]', dialog || document).forEach((button) => {
        button.setAttribute('aria-pressed', button.dataset.readerTheme === readerTheme ? 'true' : 'false');
      });
      $$('[data-reader-family]', dialog || document).forEach((button) => {
        button.setAttribute('aria-pressed', button.dataset.readerFamily === readerFamily ? 'true' : 'false');
      });
      const highlightsButton = $('[data-reader-highlights]', dialog || document);
      if (highlightsButton) {
        highlightsButton.setAttribute('aria-pressed', readerHighlights ? 'true' : 'false');
        highlightsButton.textContent = `重要ハイライト ${readerHighlights ? 'ON' : 'OFF'}`;
      }
    };
    const syncFocus = (enabled) => {
      document.body.classList.toggle('article-focus-mode', enabled);
      const button = $('[data-reader-focus]', tools);
      if (button) button.setAttribute('aria-pressed', enabled ? 'true' : 'false');
      if (menuToggleLabel) menuToggleLabel.textContent = enabled ? '通常表示へ' : '読書ツール';
      if (enabled && menu) menu.hidden = true;
      if (enabled && dialog && dialog.open) dialog.close();
      if (menuToggle) menuToggle.setAttribute('aria-expanded', 'false');
    };
    const setMenuOpen = (open) => {
      if (!menu || !menuToggle) return;
      const nextOpen = Boolean(open) && !document.body.classList.contains('article-focus-mode');
      menu.hidden = !nextOpen;
      menuToggle.setAttribute('aria-expanded', nextOpen ? 'true' : 'false');
      tools.classList.toggle('is-open', nextOpen);
      if (nextOpen) {
        const first = $('button', menu);
        if (first) first.focus({ preventScroll: true });
      }
    };
    const setSettingsOpen = (open) => {
      if (!dialog || !menuToggle) return;
      if (open) {
        if (typeof dialog.showModal === 'function') {
          if (!dialog.open) dialog.showModal();
        } else {
          dialog.setAttribute('open', '');
        }
        menuToggle.setAttribute('aria-expanded', 'true');
        const first = $('input, button', dialog);
        if (first) window.setTimeout(() => first.focus({ preventScroll: true }), 0);
      } else {
        if (typeof dialog.close === 'function' && dialog.open) dialog.close();
        else dialog.removeAttribute('open');
        menuToggle.setAttribute('aria-expanded', 'false');
      }
    };
    if (menuToggle) {
      menuToggle.addEventListener('click', () => {
        if (document.body.classList.contains('article-focus-mode')) {
          settings.focus = false;
          writeArticleReaderSettings(settings);
          syncFocus(false);
          showArticleToast('通常レイアウトに戻しました');
          return;
        }
        setSettingsOpen(!dialog || !dialog.open);
      });
    }
    if (dialog) {
      dialog.addEventListener('close', () => {
        if (menuToggle) menuToggle.setAttribute('aria-expanded', 'false');
      });
      dialog.addEventListener('click', (event) => {
        if (event.target === dialog) setSettingsOpen(false);
      });
    }
    document.addEventListener('click', (event) => {
      if (!tools.contains(event.target)) setMenuOpen(false);
    });
    document.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape') return;
      if (document.body.classList.contains('article-focus-mode')) {
        settings.focus = false;
        writeArticleReaderSettings(settings);
        syncFocus(false);
        showArticleToast('通常レイアウトに戻しました');
      } else {
        setMenuOpen(false);
      }
    });
    syncFont();
    syncFocus(Boolean(settings.focus));

    if (sizeRange) {
      sizeRange.addEventListener('input', () => {
        fontScale = Math.max(0.9, Math.min(1.3, Number(sizeRange.value) / 100 || 1));
        settings.fontScale = fontScale;
        writeArticleReaderSettings(settings);
        syncFont();
      });
    }
    if (lineHeightRange) {
      lineHeightRange.addEventListener('input', () => {
        lineHeight = Math.max(1.5, Math.min(2.2, Number(lineHeightRange.value) / 100 || 1.8));
        settings.lineHeight = lineHeight;
        writeArticleReaderSettings(settings);
        syncFont();
      });
    }
    $$('[data-reader-theme]', dialog || document).forEach((button) => {
      button.addEventListener('click', () => {
        readerTheme = button.dataset.readerTheme || 'dark';
        settings.readerTheme = readerTheme;
        writeArticleReaderSettings(settings);
        syncFont();
      });
    });
    $$('[data-reader-family]', dialog || document).forEach((button) => {
      button.addEventListener('click', () => {
        readerFamily = button.dataset.readerFamily === 'serif' ? 'serif' : 'sans';
        settings.readerFamily = readerFamily;
        writeArticleReaderSettings(settings);
        syncFont();
      });
    });
    const highlightsButton = $('[data-reader-highlights]', dialog || document);
    if (highlightsButton) {
      highlightsButton.addEventListener('click', () => {
        readerHighlights = !readerHighlights;
        settings.readerHighlights = readerHighlights;
        writeArticleReaderSettings(settings);
        syncFont();
      });
    }
    $$('[data-reader-command]', dialog || document).forEach((button) => {
      button.addEventListener('click', () => {
        const selectors = {
          search: '[data-article-search-open]',
          focus: '[data-reader-focus]',
          speech: '[data-reader-speech]',
          print: '[data-reader-print]',
          markdown: '[data-reader-markdown]',
          share: '[data-reader-share]',
        };
        const target = selectors[button.dataset.readerCommand]
          ? $(selectors[button.dataset.readerCommand], tools)
          : null;
        setSettingsOpen(false);
        if (target) target.click();
      });
    });

    $$('[data-reader-font]', tools).forEach((button) => {
      button.addEventListener('click', () => {
        fontScale += button.dataset.readerFont === 'up' ? 0.05 : -0.05;
        fontScale = Math.round(Math.max(0.9, Math.min(1.3, fontScale)) * 100) / 100;
        settings.fontScale = fontScale;
        writeArticleReaderSettings(settings);
        syncFont();
        showArticleToast(`文字サイズ ${Math.round(fontScale * 100)}%`);
      });
    });

    const focusButton = $('[data-reader-focus]', tools);
    if (focusButton) {
      focusButton.addEventListener('click', () => {
        settings.focus = !document.body.classList.contains('article-focus-mode');
        writeArticleReaderSettings(settings);
        syncFocus(settings.focus);
        showArticleToast(settings.focus ? '集中読書モードをONにしました' : '通常レイアウトに戻しました');
      });
    }

    const speechButton = $('[data-reader-speech]', tools);
    const stopSpeech = () => {
      if ('speechSynthesis' in window) window.speechSynthesis.cancel();
      utterance = null;
      if (speechButton) {
        speechButton.setAttribute('aria-pressed', 'false');
        speechButton.classList.remove('is-active');
      }
    };
    if (speechButton) {
      speechButton.addEventListener('click', () => {
        if (!('speechSynthesis' in window) || !('SpeechSynthesisUtterance' in window)) {
          showArticleToast('このブラウザは音声読み上げに対応していません');
          return;
        }
        if (utterance || window.speechSynthesis.speaking) {
          stopSpeech();
          showArticleToast('読み上げを停止しました');
          return;
        }
        const readable = $$('h2, h3, p, li', body)
          .filter(node => !node.closest('[hidden], .article-live-market-card, .article-flow-notes'))
          .map(node => node.textContent.replace(/\s+/g, ' ').trim())
          .filter(Boolean)
          .join('。');
        utterance = new SpeechSynthesisUtterance(readable);
        utterance.lang = 'ja-JP';
        utterance.rate = 0.95;
        utterance.onend = stopSpeech;
        utterance.onerror = stopSpeech;
        speechButton.setAttribute('aria-pressed', 'true');
        speechButton.classList.add('is-active');
        window.speechSynthesis.speak(utterance);
        showArticleToast('記事の読み上げを開始しました');
      });
    }

    const printButton = $('[data-reader-print]', tools);
    if (printButton) printButton.addEventListener('click', () => window.print());

    const markdownButton = $('[data-reader-markdown]', tools);
    if (markdownButton) {
      markdownButton.addEventListener('click', () => {
        const markdown = articleMarkdownFromDom();
        if (!markdown) return;
        const slug = article.dataset.articleSlug || 'article';
        const url = URL.createObjectURL(new Blob([markdown], { type: 'text/markdown;charset=utf-8' }));
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = `${slug}.md`;
        anchor.click();
        window.setTimeout(() => URL.revokeObjectURL(url), 1000);
        showArticleToast('Markdownを保存しました');
      });
    }

    const shareButton = $('[data-reader-share]', tools);
    if (shareButton) {
      shareButton.addEventListener('click', async () => {
        const shareData = { title: document.title, text: document.title, url: window.location.href };
        try {
          if (navigator.share) await navigator.share(shareData);
          else {
            await copyTextToClipboard(window.location.href);
            showArticleToast('記事URLをコピーしました');
          }
        } catch (error) {
          if (!error || error.name !== 'AbortError') showArticleToast('共有できませんでした');
        }
      });
    }
    window.addEventListener('beforeunload', stopSpeech);
  }

  function initArticleSelectionTools() {
    const body = $('.article-body');
    if (!body) return;
    const tools = document.createElement('div');
    tools.className = 'article-selection-tools';
    tools.hidden = true;
    tools.innerHTML = `
      <button type="button" data-selection-action="x">Xで引用</button>
      <button type="button" data-selection-action="copy">コピー</button>
      <button type="button" data-selection-action="memo">メモ</button>
    `;
    document.body.appendChild(tools);
    let quote = '';

    const hide = () => {
      tools.hidden = true;
      quote = '';
    };
    const show = () => {
      const selection = window.getSelection();
      const text = selection ? selection.toString().replace(/\s+/g, ' ').trim() : '';
      if (!selection || selection.rangeCount === 0 || text.length < 2 || text.length > 280) {
        hide();
        return;
      }
      const range = selection.getRangeAt(0);
      const container = range.commonAncestorContainer.nodeType === Node.ELEMENT_NODE
        ? range.commonAncestorContainer
        : range.commonAncestorContainer.parentElement;
      if (!container || !body.contains(container)) {
        hide();
        return;
      }
      quote = text;
      const rect = range.getBoundingClientRect();
      tools.hidden = false;
      const width = tools.offsetWidth;
      tools.style.left = `${Math.max(8, Math.min(window.innerWidth - width - 8, rect.left + rect.width / 2 - width / 2))}px`;
      tools.style.top = `${Math.max(8, rect.top - tools.offsetHeight - 10)}px`;
    };
    body.addEventListener('mouseup', () => window.setTimeout(show, 0));
    body.addEventListener('touchend', () => window.setTimeout(show, 80), { passive: true });
    tools.addEventListener('pointerdown', event => event.preventDefault());
    tools.addEventListener('click', async (event) => {
      const button = event.target.closest('[data-selection-action]');
      if (!button || !quote) return;
      const action = button.dataset.selectionAction;
      if (action === 'x') {
        const intent = new URL('https://twitter.com/intent/tweet');
        intent.searchParams.set('text', `「${quote}」`);
        intent.searchParams.set('url', window.location.href);
        window.open(intent.href, '_blank', 'noopener,noreferrer,width=640,height=560');
      } else if (action === 'copy') {
        await copyTextToClipboard(`${quote}\n${window.location.href}`);
        showArticleToast('引用文とURLをコピーしました');
      } else if (action === 'memo') {
        try {
          const current = JSON.parse(localStorage.getItem(ARTICLE_MEMO_STORAGE_KEY) || '[]');
          const memos = Array.isArray(current) ? current : [];
          memos.unshift({ quote, url: window.location.href, title: document.title, savedAt: new Date().toISOString() });
          localStorage.setItem(ARTICLE_MEMO_STORAGE_KEY, JSON.stringify(memos.slice(0, 50)));
          showArticleToast('このブラウザのメモに保存しました');
        } catch (_) {
          showArticleToast('メモを保存できませんでした');
        }
      }
      hide();
    });
    document.addEventListener('mousedown', (event) => {
      if (!tools.hidden && !tools.contains(event.target)) hide();
    });
    window.addEventListener('scroll', hide, { passive: true });
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

  function markArticleTableNumericColumns(table) {
    const rows = Array.from(table.tBodies || []).flatMap(tbody => Array.from(tbody.rows || []));
    const columnCount = table.rows && table.rows[0] ? table.rows[0].cells.length : 0;
    for (let index = 0; index < columnCount; index += 1) {
      const cells = rows.map(row => row.cells[index]).filter(Boolean);
      const numericCells = cells.filter((cell) => {
        const value = cell.textContent.trim().replace(/[,\s]/g, '');
        return value && /^(?:[¥$€£]?[-+]?[\d.]+(?:億|万|千)?(?:円|CC|%|倍|年|日|月)?|—|-)$/.test(value);
      });
      if (!cells.length || numericCells.length / cells.length < 0.6) continue;
      const header = table.tHead && table.tHead.rows[0] && table.tHead.rows[0].cells[index];
      if (header) header.classList.add('is-num');
      cells.forEach((cell) => {
        cell.classList.add('is-num');
        cell.dataset.align = 'number';
      });
    }
  }

  function syncArticleTableScrollState(wrapper, hint) {
    if (!wrapper) return;
    const scrollable = wrapper.scrollWidth - wrapper.clientWidth > 4;
    const atEnd = !scrollable || wrapper.scrollLeft + wrapper.clientWidth >= wrapper.scrollWidth - 4;
    wrapper.classList.toggle('is-scrollable', scrollable);
    wrapper.classList.toggle('is-at-end', atEnd);
    if (wrapper.parentElement) {
      wrapper.parentElement.classList.toggle('is-scrollable', scrollable);
      wrapper.parentElement.classList.toggle('is-at-end', atEnd);
    }
    if (hint) hint.hidden = !scrollable;
  }

  function wrapArticleTable(table) {
    if (!table || table.closest('.article-table-shell')) return;
    const shell = document.createElement('div');
    shell.className = 'article-table-shell';
    const wrapper = document.createElement('div');
    wrapper.className = 'article-table-scroll';
    wrapper.setAttribute('role', 'region');
    wrapper.setAttribute('aria-label', '横スクロールできる表');
    wrapper.tabIndex = 0;
    const hint = document.createElement('p');
    hint.className = 'article-table-scroll-hint';
    hint.textContent = '左右にスクロールできます';
    hint.hidden = true;
    const controls = document.createElement('div');
    controls.className = 'article-table-view-toggle';
    controls.setAttribute('role', 'group');
    controls.setAttribute('aria-label', 'スマートフォンでの表の表示形式');
    controls.innerHTML = `
      <span>表示</span>
      <button type="button" data-article-table-view="table" aria-pressed="false">表形式</button>
      <button type="button" data-article-table-view="cards" aria-pressed="true">カード形式</button>
    `;
    table.parentNode.insertBefore(shell, table);
    shell.append(controls, hint, wrapper);
    wrapper.appendChild(table);
    $$('[data-article-table-view]', controls).forEach((button) => {
      button.addEventListener('click', () => {
        const cards = button.dataset.articleTableView === 'cards';
        table.classList.toggle('data-table--cards', cards);
        controls.dataset.tableView = cards ? 'cards' : 'table';
        $$('[data-article-table-view]', controls).forEach((item) => {
          item.setAttribute('aria-pressed', item === button ? 'true' : 'false');
        });
        window.requestAnimationFrame(() => syncArticleTableScrollState(wrapper, hint));
      });
    });
    const sync = () => syncArticleTableScrollState(wrapper, hint);
    wrapper.addEventListener('scroll', sync, { passive: true });
    window.addEventListener('resize', sync);
    window.requestAnimationFrame(sync);
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

  function buildKeyMetricsFromTable(table, headingText) {
    const body = table && table.closest('.article-body');
    if (!body || body.querySelector('.article-key-metrics') || table.dataset.articleKeyMetrics === 'true') return;
    if (!/供給|トークノミクス|市場データ|主要指標|性能指標|手数料|コスト|経済構造/i.test(String(headingText || ''))) return;
    if (/基本データ|市場データの現在地/.test(String(headingText || ''))) return;

    const rows = Array.from(table.tBodies && table.tBodies[0] ? table.tBodies[0].rows : []);
    const items = rows.map((row) => {
      const cells = Array.from(row.cells);
      if (cells.length < 2) return null;
      const label = cells[0].textContent.replace(/\s+/g, ' ').trim();
      const value = cells[1].textContent.replace(/\s+/g, ' ').trim();
      if (!label || label.length > 38 || !/\d/.test(value) || value.length > 48) return null;
      return {
        label,
        valueHtml: cells[1].innerHTML.trim(),
        noteHtml: cells[2] ? cells[2].innerHTML.trim() : '',
      };
    }).filter(Boolean).slice(0, 4);
    if (items.length < 3) return;

    const section = document.createElement('section');
    section.className = 'article-key-metrics article-key-metrics--auto';
    section.dataset.sharedKeyMetrics = 'true';
    section.setAttribute('aria-label', `${headingText}の重要数値`);
    section.innerHTML = `
      <header>
        <span>Key metrics</span>
        <h3>重要数値を先に確認</h3>
        <p>本文の表から、比較の起点になる数値を抽出しています。定義と注意点は元の表もあわせて確認してください。</p>
      </header>
      <div class="article-key-metrics__grid">
        ${items.map(item => `
          <article>
            <span>${escapeHtml(item.label)}</span>
            <strong>${item.valueHtml}</strong>
            ${item.noteHtml ? `<p>${item.noteHtml}</p>` : ''}
          </article>
        `).join('')}
      </div>
    `;
    table.parentNode.insertBefore(section, table);
    table.dataset.articleKeyMetrics = 'true';
  }

  function initArticleTables() {
    $$('.article-body table').forEach((table) => {
      if (!shouldEnhanceArticleTable(table)) return;
      const labels = articleTableHeaderLabels(table);
      const heading = previousSectionHeading(table);
      applyMobileTableLabels(table, labels);
      table.classList.add('data-table', 'data-table--cards', 'article-data-table');
      markArticleTableNumericColumns(table);
      buildKeyMetricsFromTable(table, heading ? heading.textContent.trim() : '');
      buildStatCardsFromTable(table, heading ? heading.textContent.trim() : '');
      if (!table.hidden) wrapArticleTable(table);
      table.dataset.articleTableReady = 'true';
    });
  }

  function initInteractiveArticleFlows() {
    $$('[data-article-flow]').forEach((wrapper) => {
      if (wrapper.dataset.articleFlowReady === 'true') return;
      const nodes = $$('svg .node', wrapper);
      if (!nodes.length) return;

      let notesRoot = $('.article-flow-notes', wrapper);
      if (!notesRoot) {
        notesRoot = document.createElement('div');
        notesRoot.className = 'article-flow-notes';
        notesRoot.hidden = true;
        wrapper.appendChild(notesRoot);
      }
      let detail = $('[data-article-flow-detail]', wrapper);
      if (!detail) {
        detail = document.createElement('div');
        detail.className = 'article-flow-detail';
        detail.dataset.articleFlowDetail = 'true';
        detail.setAttribute('aria-live', 'polite');
        detail.innerHTML = '<span>図のステップを選ぶと、前後のつながりを確認できます。</span>';
        wrapper.appendChild(detail);
      }

      const normalize = value => String(value || '').replace(/\s+/g, '').replace(/[?？]/g, '').trim();
      const notes = $$('.article-flow-notes [data-flow-label]', wrapper);
      const steps = [];
      const controls = document.createElement('div');
      controls.className = 'article-flow-controls';
      controls.innerHTML = '<button type="button" data-flow-step="prev" aria-label="前のステップ">← 前へ</button><output aria-live="polite">1 / 1</output><button type="button" data-flow-step="next">次へ →</button>';
      detail.insertAdjacentElement('afterend', controls);
      const show = (node, note) => {
        nodes.forEach(item => item.classList.toggle('is-active', item === node));
        const index = Math.max(0, steps.findIndex(step => step.node === node));
        detail.innerHTML = `<span>Step ${index + 1}</span><strong>${escapeHtml(note.dataset.flowTitle || note.dataset.flowLabel)}</strong><p>${escapeHtml(note.textContent.trim())}</p>`;
        const output = $('output', controls);
        if (output) output.textContent = `${index + 1} / ${steps.length}`;
        controls.dataset.activeFlowStep = String(index);
      };
      nodes.forEach((node) => {
        const readableLabel = String(node.textContent || '').replace(/\s+/g, ' ').trim();
        const label = normalize(readableLabel);
        let note = notes.find(item => label.includes(normalize(item.dataset.flowLabel)) || normalize(item.dataset.flowLabel).includes(label));
        if (!note && readableLabel) {
          note = document.createElement('span');
          note.dataset.flowLabel = readableLabel;
          note.dataset.flowTitle = readableLabel;
          note.textContent = `「${readableLabel}」が図の中で担う役割です。前後の矢印と本文の説明を合わせて確認できます。`;
          notesRoot.appendChild(note);
          wrapper.dataset.articleFlowAuto = 'true';
        }
        if (!note) return;
        node.classList.add('is-interactive');
        node.setAttribute('tabindex', '0');
        node.setAttribute('role', 'button');
        node.setAttribute('aria-label', `${note.dataset.flowTitle || note.dataset.flowLabel}の解説を表示`);
        steps.push({ node, note });
        node.addEventListener('click', () => show(node, note));
        node.addEventListener('mouseenter', () => show(node, note));
        node.addEventListener('keydown', (event) => {
          if (event.key !== 'Enter' && event.key !== ' ') return;
          event.preventDefault();
          show(node, note);
        });
      });
      $$('[data-flow-step]', controls).forEach((button) => {
        button.addEventListener('click', () => {
          if (!steps.length) return;
          const active = Number(controls.dataset.activeFlowStep) || 0;
          const delta = button.dataset.flowStep === 'prev' ? -1 : 1;
          const next = (active + delta + steps.length) % steps.length;
          show(steps[next].node, steps[next].note);
          steps[next].node.focus({ preventScroll: true });
        });
      });
      if (steps.length) show(steps[0].node, steps[0].note);
      wrapper.dataset.articleFlowReady = 'true';
    });
  }

  function loadArticleChartRuntime() {
    if (window.Chart) return Promise.resolve(window.Chart);
    if (loadArticleChartRuntime.promise) return loadArticleChartRuntime.promise;
    loadArticleChartRuntime.promise = new Promise((resolve, reject) => {
      const existing = document.querySelector('script[data-article-chart-runtime]');
      if (existing) {
        existing.addEventListener('load', () => resolve(window.Chart), { once: true });
        existing.addEventListener('error', reject, { once: true });
        return;
      }
      const script = document.createElement('script');
      script.src = '/vendor/chart.umd.min.js';
      script.async = true;
      script.dataset.articleChartRuntime = 'true';
      script.addEventListener('load', () => resolve(window.Chart), { once: true });
      script.addEventListener('error', reject, { once: true });
      document.head.appendChild(script);
    });
    return loadArticleChartRuntime.promise;
  }

  function initArticleDataCharts() {
    const roots = $$('[data-article-chart]');
    if (!roots.length) return;
    roots.forEach(root => root.classList.add('is-loading'));
    loadArticleChartRuntime().then((Chart) => {
      if (!Chart) throw new Error('Chart runtime unavailable');
      roots.forEach((root) => {
        const canvas = $('canvas', root);
        const labels = String(root.dataset.chartLabels || '').split('|').filter(Boolean);
        const values = String(root.dataset.chartValues || '').split('|').map(Number).filter(Number.isFinite);
        const unit = root.dataset.chartUnit || '';
        const type = root.dataset.chartType === 'line' ? 'line' : 'bar';
        if (!canvas || !labels.length || labels.length !== values.length) {
          root.classList.remove('is-loading');
          root.classList.add('is-error');
          return;
        }
        const styles = getComputedStyle(document.documentElement);
        const accent = styles.getPropertyValue('--accent').trim() || '#35c8d2';
        const text = styles.getPropertyValue('--text-3').trim() || '#aeb9bc';
        const line = styles.getPropertyValue('--line-weak').trim() || 'rgba(255,255,255,.1)';
        new Chart(canvas, {
          type,
          data: {
            labels,
            datasets: [{
              label: root.dataset.chartLabel || 'Data',
              data: values,
              borderColor: accent,
              backgroundColor: type === 'line' ? 'rgba(53, 200, 210, 0.16)' : 'rgba(53, 200, 210, 0.58)',
              pointBackgroundColor: '#f4c95d',
              pointBorderColor: accent,
              pointRadius: 5,
              pointHoverRadius: 7,
              borderWidth: 2,
              borderRadius: 8,
              tension: 0.3,
              fill: type === 'line',
            }],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'nearest', intersect: false },
            plugins: {
              legend: { display: false },
              tooltip: {
                displayColors: false,
                callbacks: {
                  label(context) {
                    return `${Number(context.raw).toLocaleString('ja-JP')} ${unit}`.trim();
                  },
                },
              },
            },
            scales: {
              x: { ticks: { color: text }, grid: { display: false } },
              y: {
                beginAtZero: true,
                ticks: {
                  color: text,
                  callback(value) { return Number(value).toLocaleString('ja-JP'); },
                },
                grid: { color: line },
              },
            },
          },
        });
        root.classList.remove('is-loading');
        root.classList.add('is-ready');
      });
    }).catch((error) => {
      console.warn('[article] Chart rendering failed', error);
      roots.forEach((root) => {
        root.classList.remove('is-loading');
        root.classList.add('is-error');
      });
    });
  }

  function formatCompactUsd(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) return '—';
    if (Math.abs(number) >= 1e12) return `$${(number / 1e12).toFixed(2)}T`;
    if (Math.abs(number) >= 1e9) return `$${(number / 1e9).toFixed(2)}B`;
    if (Math.abs(number) >= 1e6) return `$${(number / 1e6).toFixed(1)}M`;
    return `$${number.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
  }

  function sampleArticleSeries(points, limit = 180) {
    if (points.length <= limit) return points;
    const step = (points.length - 1) / (limit - 1);
    return Array.from({ length: limit }, (_, index) => points[Math.round(index * step)]);
  }

  function initTronOnchainDashboard() {
    const root = $('[data-tron-onchain-dashboard]');
    if (!root) return;
    const canvas = $('canvas', root);
    const status = $('[data-tron-onchain-status]', root);
    const current = $('[data-tron-onchain-current]', root);
    const change = $('[data-tron-onchain-change]', root);
    const definition = $('[data-tron-onchain-definition]', root);
    const updated = $('[data-tron-onchain-updated]', root);
    const metricButtons = $$('[data-onchain-metric]', root);
    const rangeButtons = $$('[data-onchain-range]', root);
    if (!canvas || !metricButtons.length || !rangeButtons.length) return;

    let payload = null;
    let chart = null;
    let activeMetric = 'tvl';
    let activeRange = '1y';

    const render = (Chart) => {
      const metric = payload && payload.metrics && payload.metrics[activeMetric];
      const allPoints = metric && Array.isArray(metric.points) ? metric.points : [];
      const latest = allPoints[allPoints.length - 1];
      const latestDate = latest ? latest.date : Math.floor(Date.now() / 1000);
      const cutoff = activeRange === '1m'
        ? latestDate - (31 * 86400)
        : activeRange === '1y'
        ? latestDate - (366 * 86400)
        : 0;
      const points = sampleArticleSeries(allPoints.filter(point => Number(point.date) >= cutoff));
      if (!metric || points.length < 2) throw new Error('TRON onchain series is incomplete');

      metricButtons.forEach((button) => button.setAttribute('aria-pressed', button.dataset.onchainMetric === activeMetric ? 'true' : 'false'));
      rangeButtons.forEach((button) => button.setAttribute('aria-pressed', button.dataset.onchainRange === activeRange ? 'true' : 'false'));
      const first = points[0];
      const last = points[points.length - 1];
      const changePct = first.value > 0 ? ((last.value - first.value) / first.value) * 100 : 0;
      if (current) current.textContent = formatCompactUsd(last.value);
      if (change) {
        change.textContent = `${changePct >= 0 ? '+' : ''}${changePct.toFixed(1)}%`;
        change.dataset.trend = changePct >= 0 ? 'up' : 'down';
      }
      if (definition) definition.textContent = metric.definition || '';
      if (updated) updated.textContent = `最終系列日 ${new Date(last.date * 1000).toLocaleDateString('ja-JP')}${payload.stale ? ' / キャッシュ値' : ''}`;

      const styles = getComputedStyle(document.documentElement);
      const accent = styles.getPropertyValue('--accent').trim() || '#35c8d2';
      const text = styles.getPropertyValue('--text-3').trim() || '#aeb9bc';
      const line = styles.getPropertyValue('--line-weak').trim() || 'rgba(255,255,255,.1)';
      if (chart) chart.destroy();
      chart = new Chart(canvas, {
        type: 'line',
        data: {
          labels: points.map(point => new Date(point.date * 1000)),
          datasets: [{
            label: metric.label,
            data: points.map(point => point.value),
            borderColor: accent,
            backgroundColor: 'rgba(53, 200, 210, 0.14)',
            pointRadius: points.length > 90 ? 0 : 2,
            pointHoverRadius: 5,
            borderWidth: 2.2,
            tension: 0.24,
            fill: true,
          }],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: { mode: 'index', intersect: false },
          plugins: {
            legend: { display: false },
            tooltip: {
              displayColors: false,
              callbacks: {
                title(items) { return items[0] ? items[0].raw == null ? '' : new Date(points[items[0].dataIndex].date * 1000).toLocaleDateString('ja-JP') : ''; },
                label(context) { return `${metric.label}: ${formatCompactUsd(context.raw)}`; },
              },
            },
          },
          scales: {
            x: {
              ticks: {
                color: text,
                maxTicksLimit: 6,
                callback(_value, index) { return new Date(points[index].date * 1000).toLocaleDateString('ja-JP', { year: '2-digit', month: 'short' }); },
              },
              grid: { display: false },
            },
            y: {
              beginAtZero: false,
              ticks: { color: text, callback(value) { return formatCompactUsd(value); } },
              grid: { color: line },
            },
          },
        },
      });
      root.classList.remove('is-loading', 'is-error');
      root.classList.add('is-ready');
      if (status) status.textContent = '';
    };

    root.classList.add('is-loading');
    Promise.all([
      fetch('/api/article-onchain/tron', { cache: 'no-store' }).then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json();
      }),
      loadArticleChartRuntime(),
    ]).then(([data, Chart]) => {
      payload = data;
      metricButtons.forEach((button) => button.addEventListener('click', () => {
        activeMetric = button.dataset.onchainMetric;
        render(Chart);
      }));
      rangeButtons.forEach((button) => button.addEventListener('click', () => {
        activeRange = button.dataset.onchainRange;
        render(Chart);
      }));
      render(Chart);
    }).catch((error) => {
      console.warn('[article] TRON onchain dashboard failed', error);
      root.classList.remove('is-loading');
      root.classList.add('is-error');
      if (status) status.textContent = 'オンチェーン推移を取得できませんでした。直下の表と出典リンクから確認できます。';
    });
  }

  function initArticleDiffHighlight() {
    const buttons = $$('[data-article-diff-toggle]');
    const updates = $$('[data-article-update]');
    if (!buttons.length || !updates.length) return;
    const sync = (enabled) => {
      document.body.classList.toggle('article-show-updates', enabled);
      buttons.forEach((button) => {
        button.setAttribute('aria-pressed', enabled ? 'true' : 'false');
        const label = $('[data-article-diff-label]', button);
        if (label) label.textContent = enabled ? '更新箇所を表示中' : '今回の更新箇所を表示';
      });
      if (enabled) updates[0].scrollIntoView({ behavior: 'smooth', block: 'center' });
    };
    buttons.forEach((button) => button.addEventListener('click', () => sync(!document.body.classList.contains('article-show-updates'))));
    sync(false);
  }

  function initMermaidDiagrams() {
    const nodes = $$('.article-body .mermaid');
    if (!nodes.length) return;

    const wrappers = nodes.map(node => node.closest('.article-mermaid')).filter(Boolean);
    wrappers.forEach((wrapper) => {
      wrapper.classList.add('is-loading');
      if (!wrapper.hasAttribute('data-article-flow')) wrapper.dataset.articleFlow = 'auto';
    });

    const render = async () => {
      if (!window.mermaid) return;
      window.mermaid.initialize({
        startOnLoad: false,
        securityLevel: 'strict',
        theme: readStoredTheme() === 'light' ? 'neutral' : 'dark',
        fontFamily: 'Inter, "Noto Sans JP", sans-serif',
      });
      try {
        await window.mermaid.run({ nodes, suppressErrors: true });
        wrappers.forEach(wrapper => wrapper.classList.add('is-rendered'));
        initInteractiveArticleFlows();
      } catch (error) {
        console.warn('[article] Mermaid diagram rendering failed', error);
        wrappers.forEach(wrapper => wrapper.classList.add('is-error'));
      } finally {
        wrappers.forEach(wrapper => wrapper.classList.remove('is-loading'));
      }
    };

    if (window.mermaid) {
      render();
      return;
    }

    const existingScript = document.querySelector('script[data-mermaid-runtime]');
    if (existingScript) {
      existingScript.addEventListener('load', render, { once: true });
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js';
    script.async = true;
    script.dataset.mermaidRuntime = 'true';
    script.addEventListener('load', render, { once: true });
    script.addEventListener('error', () => {
      wrappers.forEach((wrapper) => {
        wrapper.classList.remove('is-loading');
        wrapper.classList.add('is-error');
      });
    }, { once: true });
    document.head.appendChild(script);
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
    const article = $('.article-main');
    const hero = article && $('.article-hero', article);
    const slot = article && $('[data-article-live-market-slot]', article);
    if (!body || !instrumentId) return null;

    const anchor = findArticleHeading(/市場データの現在地/) || findArticleHeading(/基本データ/);
    card = document.createElement('section');
    card.className = 'article-live-market-card article-live-market-card--ticker';
    card.dataset.articleLiveMarketCard = 'true';
    card.setAttribute('aria-live', 'polite');
    card.innerHTML = `
      <header class="article-live-market-card__copy">
        <span>Live reference</span>
        <h3>${escapeHtml(ticker || instrumentId)} / JPY</h3>
      </header>
      <div class="article-live-market-card__quote">
        <span data-live-market-venue>国内板を取得中</span>
        <strong data-live-market-price>取得中</strong>
        <small data-live-market-price-note>最良買気配と最良売気配の仲値</small>
        <div class="article-live-market-card__mini-chart" data-live-market-mini-chart aria-label="直近24時間の価格推移"><span>24h推移を取得中</span></div>
      </div>
      <div class="article-live-market-card__sides" data-live-market-sparkline aria-label="売却と購入の最良気配を取得中"></div>
      <div class="article-live-market-card__meta">
        <span data-live-market-trend>比較対象を確認中</span>
        <span data-live-market-spread>最良気配差を確認中</span>
        <span class="article-live-market-card__live-status">
          <i class="article-live-market-card__live-dot" aria-hidden="true"></i>
          <span data-live-market-updated>最新取得を確認中</span>
        </span>
      </div>
      <button class="article-live-market-card__expand" type="button" data-live-market-expand aria-expanded="false">詳細<span aria-hidden="true">＋</span></button>
      <div class="article-live-market-card__details" data-live-market-details hidden>
        <p data-live-market-copy>国内取引所の板を優先し、国内未取扱いの場合のみ海外取引所の板を参照します。注文前は取引所の公式画面で最終確認してください。</p>
        <div class="article-live-market-card__trend-chart" data-live-market-trend-chart>
          <header>
            <div><span>Price trend</span><strong>このブラウザで取得した価格推移</strong></div>
            <div role="group" aria-label="価格推移の期間">
              <button type="button" data-live-series-range="1h" aria-pressed="true">1H</button>
              <button type="button" data-live-series-range="24h" aria-pressed="false">24H</button>
              <button type="button" data-live-series-range="7d" aria-pressed="false">7D</button>
            </div>
          </header>
          <div data-live-market-series><span>最初の価格を記録中です</span></div>
        </div>
        <div class="article-live-market-card__spread-gauge" data-live-market-spread-gauge aria-live="polite"></div>
        <a class="article-live-market-card__source" data-live-market-source target="_blank" rel="noopener noreferrer" hidden>データ元を確認 ↗</a>
      </div>
      <div class="article-live-market-card__status" data-live-market-status hidden></div>
      <button class="article-live-market-card__retry" type="button" data-live-market-retry hidden>再取得</button>
    `;

    const expand = $('[data-live-market-expand]', card);
    const details = $('[data-live-market-details]', card);
    if (expand && details) {
      expand.addEventListener('click', () => {
        const open = expand.getAttribute('aria-expanded') !== 'true';
        expand.setAttribute('aria-expanded', open ? 'true' : 'false');
        expand.lastElementChild.textContent = open ? '−' : '＋';
        details.hidden = !open;
        card.classList.toggle('is-expanded', open);
      });
    }

    if (slot) {
      slot.replaceWith(card);
    } else if (hero) {
      hero.insertAdjacentElement('beforebegin', card);
    } else if (anchor) {
      anchor.insertAdjacentElement('afterend', card);
    } else {
      body.insertBefore(card, body.firstElementChild);
    }
    if (article) article.classList.add('article-main--live-ticker');
    return card;
  }

  function setLiveMarketCardState(card, state, message = '') {
    if (!card) return;
    ['is-loading', 'is-ready', 'is-error', 'is-unavailable'].forEach(className => card.classList.remove(className));
    card.classList.add(`is-${state}`);
    card.setAttribute('aria-busy', state === 'loading' ? 'true' : 'false');
    card.dataset.liveState = state;
    const retry = $('[data-live-market-retry]', card);
    if (retry) retry.hidden = !['error', 'unavailable'].includes(state);
    const status = $('[data-live-market-status]', card);
    if (status) {
      status.textContent = message || (state === 'loading' ? '参考データを取得中です' : '');
      status.hidden = !status.textContent;
    }
  }

  function setAnimatedJpy(node, value) {
    if (!node || !Number.isFinite(value)) return 'steady';
    const previous = Number(node.dataset.liveValue);
    const tone = !Number.isFinite(previous) || previous === value
      ? 'steady'
      : value > previous
      ? 'up'
      : 'down';
    node.dataset.liveValue = String(value);
    if ((window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) || !window.requestAnimationFrame) {
      node.textContent = formatJpy(value);
      return tone;
    }
    const start = Number.isFinite(previous) ? previous : value * 0.985;
    const startedAt = performance.now();
    const duration = 560;
    const tick = (now) => {
      const ratio = Math.min(1, (now - startedAt) / duration);
      const eased = 1 - ((1 - ratio) ** 3);
      node.textContent = formatJpy(start + (value - start) * eased);
      if (ratio < 1) window.requestAnimationFrame(tick);
    };
    window.requestAnimationFrame(tick);
    return tone;
  }

  function flashLiveMarketPrice(card, tone = 'steady') {
    if (!card) return;
    const classes = ['is-price-up', 'is-price-down', 'is-price-steady'];
    classes.forEach(className => card.classList.remove(className));
    void card.offsetWidth;
    const className = tone === 'up'
      ? 'is-price-up'
      : tone === 'down'
      ? 'is-price-down'
      : 'is-price-steady';
    card.classList.add(className);
    window.setTimeout(() => card.classList.remove(className), 720);
  }

  function safeHttpsUrl(value) {
    try {
      const rawValue = String(value || '').trim();
      if (!rawValue) return '';
      const url = new URL(rawValue);
      return url.protocol === 'https:' ? url.href : '';
    } catch (_) {
      return '';
    }
  }

  function articleExchangeActions(report, exchangeId) {
    const normalizedId = String(exchangeId || '').trim().toLowerCase();
    if (!normalizedId) return {};

    const exchanges = report && Array.isArray(report.exchanges) ? report.exchanges : [];
    const exchange = exchanges.find(item => String(item && item.id || '').trim().toLowerCase() === normalizedId);
    if (exchange && exchange.actions) return exchange.actions;

    const rows = report
      && report.domesticComparison
      && Array.isArray(report.domesticComparison.rows)
      ? report.domesticComparison.rows
      : [];
    const row = rows.find(item => String(item && item.exchangeId || '').trim().toLowerCase() === normalizedId);
    return row && row.actions ? row.actions : {};
  }

  function articleExchangeAffiliateLink(report, exchangeId, exchangeLabel, variant = 'label') {
    const label = String(exchangeLabel || exchangeId || '国内取引所').trim();
    const actions = articleExchangeActions(report, exchangeId);
    const href = safeHttpsUrl(actions.referralUrl);
    if (!href) return variant === 'cta' ? '' : escapeHtml(label);

    const attributes = [
      `href="${escapeHtml(href)}"`,
      `data-live-market-exchange="${escapeHtml(String(exchangeId || '').trim().toLowerCase())}"`,
    ];
    const target = Object.prototype.hasOwnProperty.call(actions, 'referralTarget')
      ? actions.referralTarget
      : '_blank';
    if (target) attributes.push(`target="${escapeHtml(target)}"`);
    attributes.push(`rel="${escapeHtml(actions.referralRel || 'sponsored noopener')}"`);
    if (actions.referralReferrerPolicy) {
      attributes.push(`referrerpolicy="${escapeHtml(actions.referralReferrerPolicy)}"`);
    }

    const trackingPixelUrl = safeHttpsUrl(actions.referralTrackingPixelUrl);
    const trackingPixel = trackingPixelUrl
      ? `<img src="${escapeHtml(trackingPixelUrl)}" width="1" height="1" alt="" aria-hidden="true">`
      : '';

    const className = variant === 'cta'
      ? 'article-live-market-card__venue-link article-live-market-card__venue-cta'
      : 'article-live-market-card__venue-link';
    const linkLabel = variant === 'cta' ? '口座開設 / 取引へ' : label;
    return `<a class="${className}" ${attributes.join(' ')}>${escapeHtml(linkLabel)}<span aria-hidden="true">↗</span>${trackingPixel}</a>`;
  }

  function articleExchangeToken(exchangeId, exchangeLabel) {
    const normalized = String(exchangeId || exchangeLabel || '').trim().toLowerCase();
    if (normalized.includes('okcoin') || normalized === 'okj') return 'okj';
    if (normalized.includes('coincheck')) return 'coincheck';
    if (normalized.includes('bitflyer')) return 'bitflyer';
    if (normalized.includes('bitbank')) return 'bitbank';
    if (normalized.includes('gmo')) return 'gmo';
    if (normalized.includes('binance')) return 'binance-japan';
    if (normalized.includes('bittrade') || normalized.includes('huobi')) return 'bittrade';
    return normalized.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'more';
  }

  function articleExchangeShortLabel(exchangeId, exchangeLabel) {
    const token = articleExchangeToken(exchangeId, exchangeLabel);
    const labels = {
      okj: 'OKJ',
      coincheck: 'CC',
      bitflyer: 'BF',
      bitbank: 'BB',
      gmo: 'GMO',
      'binance-japan': 'BN',
      bittrade: 'BT',
    };
    return labels[token] || String(exchangeLabel || exchangeId || '?').trim().slice(0, 3).toUpperCase();
  }

  function articleExchangeIdentity(report, exchangeId, exchangeLabel) {
    const label = String(exchangeLabel || exchangeId || '取引所').trim();
    const token = articleExchangeToken(exchangeId, label);
    return `
      <span class="article-live-market-card__venue">
        <span class="article-live-market-card__exchange-logo market-exchange-logo market-exchange-logo--${escapeHtml(token)}" role="img" aria-label="${escapeHtml(label)}">${escapeHtml(articleExchangeShortLabel(exchangeId, label))}</span>
        <span class="article-live-market-card__venue-actions">
          ${articleExchangeAffiliateLink(report, exchangeId, label)}
          ${articleExchangeAffiliateLink(report, exchangeId, label, 'cta')}
        </span>
      </span>
    `;
  }

  function readArticleLiveSeries(instrumentId) {
    try {
      const stored = JSON.parse(localStorage.getItem(ARTICLE_LIVE_SERIES_STORAGE_KEY) || '{}');
      const rows = stored && Array.isArray(stored[instrumentId]) ? stored[instrumentId] : [];
      const cutoff = Date.now() - (7 * 24 * 60 * 60 * 1000);
      return rows
        .map(item => ({ at: Number(item.at), value: Number(item.value) }))
        .filter(item => Number.isFinite(item.at) && Number.isFinite(item.value) && item.at >= cutoff && item.value > 0);
    } catch (_) {
      return [];
    }
  }

  function appendArticleLiveSeries(instrumentId, value) {
    if (!instrumentId || !Number.isFinite(value) || value <= 0) return [];
    const rows = readArticleLiveSeries(instrumentId);
    const now = Date.now();
    const last = rows[rows.length - 1];
    if (!last || last.value !== value || now - last.at >= 120000) {
      rows.push({ at: now, value });
    }
    const trimmed = rows.slice(-20000);
    try {
      const stored = JSON.parse(localStorage.getItem(ARTICLE_LIVE_SERIES_STORAGE_KEY) || '{}');
      const next = stored && typeof stored === 'object' ? stored : {};
      next[instrumentId] = trimmed;
      localStorage.setItem(ARTICLE_LIVE_SERIES_STORAGE_KEY, JSON.stringify(next));
    } catch (_) {
      // The chart remains available for the current render when storage is unavailable.
    }
    return trimmed;
  }

  function renderArticleLiveSeries(card, instrumentId, value) {
    const root = $('[data-live-market-trend-chart]', card);
    const chart = $('[data-live-market-series]', card);
    if (!root || !chart) return;
    const allRows = appendArticleLiveSeries(instrumentId, value);
    const selectedRange = root.dataset.liveSeriesRange || '1h';
    const duration = selectedRange === '7d'
      ? 7 * 24 * 60 * 60 * 1000
      : selectedRange === '24h'
      ? 24 * 60 * 60 * 1000
      : 60 * 60 * 1000;
    const cutoff = Date.now() - duration;
    const rows = allRows.filter(item => item.at >= cutoff);
    $$('[data-live-series-range]', root).forEach((button) => {
      const active = button.dataset.liveSeriesRange === selectedRange;
      button.setAttribute('aria-pressed', active ? 'true' : 'false');
      if (button.dataset.liveSeriesReady !== 'true') {
        button.addEventListener('click', () => {
          root.dataset.liveSeriesRange = button.dataset.liveSeriesRange;
          renderArticleLiveSeries(card, instrumentId, value);
        });
        button.dataset.liveSeriesReady = 'true';
      }
    });

    if (!rows.length) {
      chart.innerHTML = '<span>価格履歴を取得中です</span>';
      return;
    }
    const width = 640;
    const height = 112;
    const pad = 8;
    const values = rows.map(item => item.value);
    let min = Math.min(...values);
    let max = Math.max(...values);
    if (min === max) {
      min *= 0.9995;
      max *= 1.0005;
    }
    const firstAt = rows[0].at;
    const lastAt = rows[rows.length - 1].at;
    const timeSpan = Math.max(1, lastAt - firstAt);
    const points = rows.map((item, index) => {
      const x = rows.length === 1 ? width / 2 : pad + ((item.at - firstAt) / timeSpan) * (width - pad * 2);
      const y = height - pad - ((item.value - min) / (max - min)) * (height - pad * 2);
      return { x, y, ...item, index };
    });
    const path = points.map(point => `${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(' ');
    const change = values.length > 1 ? ((values[values.length - 1] - values[0]) / values[0]) * 100 : 0;
    const tone = change > 0 ? 'up' : change < 0 ? 'down' : 'flat';
    chart.innerHTML = `
      <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${selectedRange === '7d' ? '7日間' : selectedRange === '24h' ? '24時間' : '1時間'}の記録価格推移、${change >= 0 ? '+' : ''}${formatPct(change, 3)}">
        <defs><linearGradient id="article-live-fill-${escapeHtml(instrumentId.toLowerCase())}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="currentColor" stop-opacity=".28"/><stop offset="1" stop-color="currentColor" stop-opacity="0"/></linearGradient></defs>
        ${points.length > 1 ? `<polygon points="${path} ${points[points.length - 1].x.toFixed(1)},${height - pad} ${points[0].x.toFixed(1)},${height - pad}" fill="url(#article-live-fill-${escapeHtml(instrumentId.toLowerCase())})"/>` : ''}
        <polyline points="${path}" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
        ${points.map(point => `<circle cx="${point.x.toFixed(1)}" cy="${point.y.toFixed(1)}" r="${point.index === points.length - 1 ? 4.5 : 2.5}"><title>${new Date(point.at).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })} ${formatJpy(point.value)}</title></circle>`).join('')}
      </svg>
      <div class="article-live-market-card__trend-legend" data-trend="${tone}"><span>${rows.length < 2 ? '次回更新から線で表示' : `${rows.length}件の取得値`}</span><strong>${change >= 0 ? '+' : ''}${formatPct(change, 3)}</strong></div>
    `;
  }

  function renderArticleMiniSparkline(card, rows, options = {}) {
    const root = $('[data-live-market-mini-chart]', card);
    if (!root || !Array.isArray(rows) || rows.length < 2) return false;
    const normalizedRows = rows
      .map(item => ({ at: Number(item && item.at), value: Number(item && item.value) }))
      .filter(item => Number.isFinite(item.at) && Number.isFinite(item.value) && item.at > 0 && item.value > 0)
      .sort((a, b) => a.at - b.at);
    if (normalizedRows.length < 2) return false;
    const width = 180;
    const height = 48;
    const pad = 3;
    const values = normalizedRows.map(item => item.value);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const spread = Math.max(max - min, Math.max(0.000001, max * 0.0005));
    const firstAt = normalizedRows[0].at;
    const timeSpan = Math.max(1, normalizedRows[normalizedRows.length - 1].at - firstAt);
    const points = normalizedRows.map(item => {
      const x = pad + ((item.at - firstAt) / timeSpan) * (width - pad * 2);
      const y = height - pad - ((item.value - min) / spread) * (height - pad * 2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');
    const change = ((values[values.length - 1] - values[0]) / values[0]) * 100;
    const tone = change > 0 ? 'up' : change < 0 ? 'down' : 'flat';
    const sourceLabel = options.sourceLabel || 'ブラウザ記録値';
    const ticker = options.ticker || articleTicker() || articleInstrumentId().split('-')[0];
    root.dataset.trend = tone;
    root.dataset.miniChartSource = options.source || 'local';
    root.setAttribute('aria-label', `${sourceLabel}による直近24時間の${ticker}/JPY推移、${change >= 0 ? '+' : ''}${formatPct(change, 2)}`);
    root.innerHTML = `
      <svg viewBox="0 0 ${width} ${height}" role="img" aria-hidden="true"><polyline points="${points}" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
      <span>${escapeHtml(options.shortLabel || '記録 24h')} <strong>${change >= 0 ? '+' : ''}${escapeHtml(formatPct(change, 2))}</strong></span>
    `;
    return true;
  }

  function renderArticleLocalMiniSparkline(card, instrumentId) {
    const root = $('[data-live-market-mini-chart]', card);
    if (!root || root.dataset.miniChartSource === 'remote') return false;
    const cutoff = Date.now() - (24 * 60 * 60 * 1000);
    const rows = readArticleLiveSeries(instrumentId).filter(item => item.at >= cutoff);
    if (renderArticleMiniSparkline(card, rows, {
      source: 'local',
      sourceLabel: 'このブラウザの記録値',
      shortLabel: '記録 24h',
    })) return true;
    root.dataset.miniChartSource = 'local-pending';
    root.setAttribute('aria-label', '直近24時間の価格推移をこのブラウザに記録中');
    root.innerHTML = '<span>24h推移を記録中</span>';
    return false;
  }

  function renderArticleRemoteSparkline(card, reference) {
    const rows = reference && Array.isArray(reference.sparkline24h)
      ? reference.sparkline24h.map(item => ({ at: item && item.at, value: item && item.jpy }))
      : [];
    return renderArticleMiniSparkline(card, rows, {
      source: 'remote',
      sourceLabel: 'CoinGecko',
      shortLabel: '24h',
      ticker: reference && reference.ticker,
    });
  }

  function renderArticleSpreadGauge(card, spreadPct) {
    const root = $('[data-live-market-spread-gauge]', card);
    if (!root || !Number.isFinite(spreadPct)) return;
    const absolute = Math.abs(spreadPct);
    const position = Math.max(0, Math.min(100, (absolute / 1) * 100));
    const level = absolute <= 0.1
      ? { tone: 'low', label: '小さい' }
      : absolute <= 0.3
      ? { tone: 'moderate', label: 'やや小さい' }
      : absolute <= 0.8
      ? { tone: 'watch', label: '要確認' }
      : { tone: 'high', label: '大きい' };
    root.dataset.spreadTone = level.tone;
    root.innerHTML = `
      <div class="article-live-market-card__spread-copy">
        <span>Best bid / ask gap</span>
        <strong>気配差 ${formatPct(absolute, 3)} <small>${level.label}</small></strong>
      </div>
      <div class="article-live-market-card__spread-meter" role="meter" aria-label="最良気配差" aria-valuemin="0" aria-valuemax="1" aria-valuenow="${absolute.toFixed(4)}" aria-valuetext="${formatPct(absolute, 3)}、${level.label}">
        <span style="--spread-position:${position}%"></span>
      </div>
      <p>板の最良気配差だけを示します。取引手数料と注文量によるスリッページは含みません。</p>
    `;
  }

  function ensureSharedContextualMarketCta() {
    const article = $('.article-main[data-article-kind="market"]');
    const body = article && $('.article-body', article);
    const instrumentId = articleInstrumentId();
    if (!article || !body || !instrumentId || $('[data-article-market-cta]', body)) return;

    const headings = $$('h2', body);
    const heading = headings.find(item => /市場|価格|流動性|取引所|売買|取引実務|取扱/i.test(item.textContent))
      || headings.find(item => !/まとめ|参考|免責/i.test(item.textContent));
    if (!heading) return;

    const ticker = articleTicker() || instrumentId.split('-')[0];
    const root = document.createElement('section');
    root.className = 'article-context-market-cta article-context-market-cta--shared';
    root.dataset.articleMarketCta = 'true';
    root.dataset.sharedMarketCta = 'true';
    root.hidden = true;
    root.setAttribute('aria-label', `${ticker}の国内取引所比較`);
    root.innerHTML = `
      <header>
        <span>Live market context</span>
        <strong>${escapeHtml(ticker)}/JPYの国内Best bid / ask</strong>
        <small>この章の内容に沿って、国内取引所の現在気配と公式条件を確認できます。</small>
      </header>
      <div>
        <article data-article-market-cta-bid><span>売却側 Best bid</span><strong>国内板を取得中</strong><small>最も高い買気配を確認します</small></article>
        <article data-article-market-cta-ask><span>購入側 Best ask</span><strong>国内板を取得中</strong><small>最も安い売気配を確認します</small></article>
      </div>
    `;
    const readingSection = heading.closest('[data-article-reading-section]');
    if (readingSection) readingSection.appendChild(root);
    else heading.insertAdjacentElement('afterend', root);
  }

  function renderArticleContextualMarketCtas(report, bestBid, bestAsk) {
    $$('[data-article-market-cta]').forEach((root) => {
      const bidTarget = $('[data-article-market-cta-bid]', root);
      const askTarget = $('[data-article-market-cta-ask]', root);
      const render = (target, quote, actionLabel) => {
        if (!target || !quote) return;
        const exchangeId = quote.exchangeId || '';
        const exchangeLabel = quote.exchangeLabel || exchangeId || '国内取引所';
        const link = articleExchangeAffiliateLink(report, exchangeId, exchangeLabel, 'cta');
        target.innerHTML = `
          <span>${escapeHtml(actionLabel)}</span>
          <strong>${escapeHtml(exchangeLabel)}</strong>
          <small>${escapeHtml(formatJpy(Number(quote.price)))} / 最新の公式条件を確認</small>
          ${link || `<a class="article-context-market-cta__fallback" href="/markets/${encodeURIComponent(articleInstrumentId())}">国内板比較を見る →</a>`}
        `;
      };
      render(bidTarget, bestBid, '売却側 Best bid');
      render(askTarget, bestAsk, '購入側 Best ask');
      root.hidden = false;
      root.classList.add('is-ready');
    });
  }

  function renderDomesticMarketReference(card, report, instrumentId) {
    const snapshot = report && report.snapshot;
    const bestBid = snapshot && snapshot.bestBid;
    const bestAsk = snapshot && snapshot.bestAsk;
    const bidJpy = Number(bestBid && bestBid.price);
    const askJpy = Number(bestAsk && bestAsk.price);
    if (
      !Number.isFinite(bidJpy)
      || !Number.isFinite(askJpy)
      || bidJpy <= 0
      || askJpy <= 0
    ) {
      return false;
    }

    const midpointJpy = (bidJpy + askJpy) / 2;
    const spreadPct = midpointJpy > 0 ? ((askJpy - bidJpy) / midpointJpy) * 100 : NaN;
    const bidVenue = bestBid.exchangeLabel || bestBid.exchangeId || '国内取引所';
    const askVenue = bestAsk.exchangeLabel || bestAsk.exchangeId || '国内取引所';
    const venueCount = new Set([bestBid.exchangeId || bidVenue, bestAsk.exchangeId || askVenue]).size;
    const bidVenueIdentity = articleExchangeIdentity(report, bestBid.exchangeId, bidVenue);
    const askVenueIdentity = articleExchangeIdentity(report, bestAsk.exchangeId, askVenue);
    const timestamps = [bestBid.updatedAt, bestAsk.updatedAt]
      .map(value => (Number.isFinite(Number(value)) ? Number(value) : Date.parse(value)))
      .filter(Number.isFinite);
    const updatedAt = timestamps.length ? new Date(Math.min(...timestamps)).toISOString() : '';
    const isStale = [bestBid.freshnessStatus, bestAsk.freshnessStatus].includes('stale');

    const priceNode = $('[data-live-market-price]', card);
    const venueNode = $('[data-live-market-venue]', card);
    const spreadNode = $('[data-live-market-spread]', card);
    const trendNode = $('[data-live-market-trend]', card);
    const updatedNode = $('[data-live-market-updated]', card);
    const sparklineNode = $('[data-live-market-sparkline]', card);
    const sourceNode = $('[data-live-market-source]', card);
    const copyNode = $('[data-live-market-copy]', card);

    const priceTone = priceNode ? setAnimatedJpy(priceNode, midpointJpy) : 'steady';
    syncArticleSmartHeaderPrice(midpointJpy, priceTone);
    if (venueNode) venueNode.textContent = '仲値（国内取引所ベストレート）';
    if (spreadNode) {
      spreadNode.textContent = Number.isFinite(spreadPct)
        ? `最良気配差 ${formatPct(Math.abs(spreadPct), 3)}`
        : '最良気配差を確認中';
    }
    if (trendNode) {
      trendNode.textContent = `国内${venueCount}取引所の最良気配を比較`;
      trendNode.removeAttribute('data-trend');
    }
    if (updatedNode) {
      updatedNode.textContent = updatedAt ? `板更新 ${formatCompactDateTime(updatedAt)}` : '板更新時刻なし';
    }
    if (sparklineNode) {
      sparklineNode.setAttribute('aria-label', `売却 ${formatJpy(bidJpy)} ${bidVenue}、購入 ${formatJpy(askJpy)} ${askVenue}`);
      sparklineNode.innerHTML = `
        <article class="article-live-market-card__side article-live-market-card__side--sell">
          <span>売却 / Best bid</span>
          <strong>${escapeHtml(formatJpy(bidJpy))}</strong>
          <small>${bidVenueIdentity}</small>
        </article>
        <article class="article-live-market-card__side article-live-market-card__side--buy">
          <span>購入 / Best ask</span>
          <strong>${escapeHtml(formatJpy(askJpy))}</strong>
          <small>${askVenueIdentity}</small>
        </article>
      `;
    }
    if (copyNode) {
      copyNode.textContent = '国内取引所だけを比較した最良買気配・最良売気配です。中央の価格は両レートの仲値で、販売所価格は使用していません。';
    }
    renderArticleLiveSeries(card, instrumentId, midpointJpy);
    renderArticleLocalMiniSparkline(card, instrumentId);
    renderArticleSpreadGauge(card, spreadPct);
    renderArticleContextualMarketCtas(report, bestBid, bestAsk);
    const smartCta = $('[data-article-smart-cta]');
    const smartActions = articleExchangeActions(report, bestAsk.exchangeId);
    const smartHref = safeHttpsUrl(smartActions.referralUrl);
    if (smartCta) {
      smartCta.href = `/markets/${encodeURIComponent(instrumentId)}`;
      if (smartHref) {
        smartCta.href = smartHref;
        smartCta.target = smartActions.referralTarget || '_blank';
        smartCta.rel = smartActions.referralRel || 'sponsored noopener';
        smartCta.textContent = `${askVenue}で比較・購入 ↗`;
      }
    }
    if (sourceNode) {
      sourceNode.hidden = false;
      sourceNode.href = `/markets/${encodeURIComponent(instrumentId)}`;
      sourceNode.textContent = '国内取引所の板比較を見る →';
    }

    setLiveMarketCardState(
      card,
      'ready',
      isStale ? '一部に直近取得の板データを含みます。' : ''
    );
    flashLiveMarketPrice(card, priceTone);
    return true;
  }

  function renderExternalMarketReference(card, reference) {
    const rawPriceJpy = reference && reference.price && reference.price.jpy;
    const rawQuotePrice = reference && reference.price && reference.price.quote;
    const rawChange24h = reference && reference.change24hPct && reference.change24hPct.quote;
    const priceJpy = rawPriceJpy == null ? NaN : Number(rawPriceJpy);
    if (!Number.isFinite(priceJpy) || priceJpy <= 0) return false;

    const change24h = rawChange24h == null ? NaN : Number(rawChange24h);
    const quotePrice = rawQuotePrice == null ? NaN : Number(rawQuotePrice);
    const rawBidJpy = reference && reference.bestBid && reference.bestBid.jpy;
    const rawAskJpy = reference && reference.bestAsk && reference.bestAsk.jpy;
    const rawSpreadPct = reference && reference.spreadPct;
    const bidJpy = rawBidJpy == null ? NaN : Number(rawBidJpy);
    const askJpy = rawAskJpy == null ? NaN : Number(rawAskJpy);
    const spreadPct = rawSpreadPct == null ? NaN : Number(rawSpreadPct);
    const isOrderbook = reference && reference.kind === 'orderbook'
      && Number.isFinite(bidJpy)
      && Number.isFinite(askJpy)
      && bidJpy > 0
      && askJpy > 0;
    const priceNode = $('[data-live-market-price]', card);
    const venueNode = $('[data-live-market-venue]', card);
    const spreadNode = $('[data-live-market-spread]', card);
    const trendNode = $('[data-live-market-trend]', card);
    const updatedNode = $('[data-live-market-updated]', card);
    const sparklineNode = $('[data-live-market-sparkline]', card);
    const sourceNode = $('[data-live-market-source]', card);
    const copyNode = $('[data-live-market-copy]', card);

    const priceTone = priceNode ? setAnimatedJpy(priceNode, priceJpy) : 'steady';
    syncArticleSmartHeaderPrice(priceJpy, priceTone);
    if (venueNode) {
      venueNode.textContent = isOrderbook
        ? `仲値（${reference.source || '海外取引所'} ${reference.pair || ''}）`.trim()
        : `${reference.source || '公開市場'} 集計`;
    }
    if (spreadNode) {
      spreadNode.textContent = isOrderbook
        ? Number.isFinite(spreadPct)
          ? `最良気配差 ${formatPct(Math.abs(spreadPct), 3)}`
          : '最良気配差を確認中'
        : Number.isFinite(change24h)
        ? `24時間 ${change24h >= 0 ? '+' : ''}${formatPct(change24h, 2)}`
        : '24時間変動は集計中';
      if (!isOrderbook && Number.isFinite(change24h)) {
        spreadNode.dataset.trend = change24h >= 0 ? 'up' : 'down';
      }
      else spreadNode.removeAttribute('data-trend');
    }
    if (trendNode) {
      trendNode.textContent = isOrderbook
        ? '国内未取扱いのため海外板を参照'
        : Number.isFinite(change24h)
        ? `24時間 ${change24h >= 0 ? '+' : ''}${formatPct(change24h, 2)}`
        : Number.isFinite(quotePrice)
        ? `${reference.price.quoteCurrency || 'USD'} ${quotePrice.toLocaleString('en-US', { maximumFractionDigits: 6 })}`
        : 'グローバル参考価格';
      trendNode.removeAttribute('data-trend');
    }
    if (updatedNode) {
      const updated = formatCompactDateTime(reference.updatedAt);
      updatedNode.textContent = updated ? `価格更新 ${updated}` : '価格更新時刻なし';
    }
    if (sparklineNode) {
      if (isOrderbook) {
        const sourceLabel = reference.source || '海外取引所';
        const sourceIdentity = articleExchangeIdentity(null, sourceLabel, sourceLabel);
        sparklineNode.setAttribute('aria-label', `売却 ${formatJpy(bidJpy)}、購入 ${formatJpy(askJpy)}、${sourceLabel}`);
        sparklineNode.innerHTML = `
          <article class="article-live-market-card__side article-live-market-card__side--sell">
            <span>売却 / Best bid</span>
            <strong>${escapeHtml(formatJpy(bidJpy))}</strong>
            <small>${sourceIdentity}</small>
          </article>
          <article class="article-live-market-card__side article-live-market-card__side--buy">
            <span>購入 / Best ask</span>
            <strong>${escapeHtml(formatJpy(askJpy))}</strong>
            <small>${sourceIdentity}</small>
          </article>
        `;
      } else {
        const tone = !Number.isFinite(change24h) ? 'flat' : change24h >= 0 ? 'up' : 'down';
        const changeLabel = Number.isFinite(change24h)
          ? `${change24h >= 0 ? '+' : ''}${formatPct(change24h, 2)}`
          : '集計中';
        sparklineNode.setAttribute('aria-label', `24時間変動 ${changeLabel}`);
        sparklineNode.innerHTML = `
          <div class="article-live-market-card__reference" data-trend="${tone}">
            <span>24h change</span>
            <strong>${escapeHtml(changeLabel)}</strong>
            <small>海外板を取得できない場合の集計値</small>
          </div>
        `;
      }
    }
    if (sourceNode) {
      const sourceUrl = safeHttpsUrl(reference.sourceUrl);
      sourceNode.hidden = !sourceUrl;
      if (sourceUrl) {
        sourceNode.href = sourceUrl;
        sourceNode.textContent = isOrderbook
          ? `${reference.source || '海外取引所'}の板を確認 ↗`
          : '集計データ元を確認 ↗';
      }
      else sourceNode.removeAttribute('href');
    }
    if (copyNode) {
      copyNode.textContent = isOrderbook
        ? '国内取引所で未取扱いのため、海外取引所の最良買気配・最良売気配を表示しています。中央の価格は両レートの仲値です。'
        : '国内取引所で未取扱いかつ海外板を取得できないため、公開市場の集計参考値を表示しています。';
    }
    renderArticleLiveSeries(card, articleInstrumentId(), priceJpy);
    renderArticleLocalMiniSparkline(card, articleInstrumentId());
    renderArticleRemoteSparkline(card, reference);
    if (isOrderbook) renderArticleSpreadGauge(card, spreadPct);

    setLiveMarketCardState(
      card,
      'ready',
      reference.stale ? '直近に取得した参考値を表示しています。' : ''
    );
    flashLiveMarketPrice(card, priceTone);
    return true;
  }

  async function fetchExternalMarketReference(ticker, signal) {
    if (!EXTERNAL_MARKET_REFERENCE_TICKERS.has(ticker)) return null;
    const response = await fetch(`/api/article-market-reference/${encodeURIComponent(ticker)}`, {
      cache: 'no-store',
      signal,
    });
    if (response.status === 404) return null;
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  }

  function initArticleLiveMarketCard() {
    const instrumentId = articleInstrumentId();
    if (!instrumentId) return;
    const ticker = articleTicker();
    const card = ensureLiveMarketCard(instrumentId, ticker);
    if (!card) return;

    let abortController = null;
    let domesticRetryTimer = null;
    let domesticRetryCount = 0;
    const load = async () => {
      if (domesticRetryTimer) {
        window.clearTimeout(domesticRetryTimer);
        domesticRetryTimer = null;
      }
      if (abortController) abortController.abort();
      abortController = new AbortController();
      const controller = abortController;
      if (card.dataset.liveState !== 'ready') {
        setLiveMarketCardState(card, 'loading');
      }
      try {
        const domesticResponse = await fetch(`/api/markets/${encodeURIComponent(instrumentId)}`, {
          cache: 'no-store',
          signal: controller.signal,
        });
        if (abortController !== controller) return;
        if (domesticResponse.ok) {
          const domesticReport = await domesticResponse.json();
          if (abortController !== controller) return;
          if (renderDomesticMarketReference(card, domesticReport, instrumentId)) {
            domesticRetryCount = 0;
            fetchExternalMarketReference(ticker, controller.signal)
              .then(reference => renderArticleRemoteSparkline(card, reference))
              .catch(() => false);
            return;
          }
          domesticRetryCount += 1;
          if (domesticRetryCount >= 4) {
            setLiveMarketCardState(
              card,
              'unavailable',
              '国内取引所で取扱いがありますが、現在は板データを取得できません。時間をおいて再取得してください。'
            );
            return;
          }
          setLiveMarketCardState(card, 'loading', '国内取引所の板データを取得中です。');
          domesticRetryTimer = window.setTimeout(load, 3000);
          return;
        } else if (domesticResponse.status !== 404) {
          throw new Error(`HTTP ${domesticResponse.status}`);
        }

        domesticRetryCount = 0;
        const reference = await fetchExternalMarketReference(ticker, controller.signal);
        if (abortController !== controller) return;
        if (renderExternalMarketReference(card, reference)) return;
        setLiveMarketCardState(card, 'unavailable', `現在、${ticker || instrumentId}の参考価格を取得できません。時間をおいて再取得してください。`);
      } catch (err) {
        if (err && err.name === 'AbortError') return;
        setLiveMarketCardState(card, 'error', '参考データを取得できませんでした。通信状況を確認して再取得してください。');
        const priceNode = $('[data-live-market-price]', card);
        const venueNode = $('[data-live-market-venue]', card);
        const spreadNode = $('[data-live-market-spread]', card);
        const updatedNode = $('[data-live-market-updated]', card);
        if (priceNode) priceNode.textContent = '—';
        if (venueNode) venueNode.textContent = '取得エラー';
        if (spreadNode) spreadNode.textContent = 'データを表示できません';
        if (updatedNode) updatedNode.textContent = '最終取得を確認できません';
      }
    };

    const retry = $('[data-live-market-retry]', card);
    if (retry) {
      retry.addEventListener('click', () => {
        domesticRetryCount = 0;
        load();
      });
    }
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

  function initArticleBeginnerGuide() {
    const article = $('.article-main[data-article-kind="market"]');
    if (!article) return;
    const toggle = $('.topbar [data-beginner-toggle]');
    if (!toggle) return;
    const storageKey = `${BEGINNER_GUIDE_STORAGE_KEY}:shared-reading-mode`;
    try {
      if (localStorage.getItem(storageKey) === 'seen') return;
    } catch (_) {
      // Show the guide when storage is unavailable.
    }

    const guide = document.createElement('aside');
    guide.className = 'article-beginner-guide';
    guide.hidden = true;
    guide.setAttribute('role', 'status');
    guide.setAttribute('aria-label', '初心者モードの案内');
    guide.innerHTML = `
      <span>初めての方へ</span>
      <strong>初心者モードで読み方が変わります</strong>
      <p>要点ナビを先に表示し、専門用語はタップ解説、技術的な節は折りたたみで整理します。いつでも通常表示へ戻せます。</p>
      <button type="button" data-beginner-guide-dismiss>わかりました</button>
    `;
    document.body.appendChild(guide);

    const position = () => {
      const rect = toggle.getBoundingClientRect();
      const margin = 12;
      const width = Math.min(340, window.innerWidth - margin * 2);
      const left = Math.max(margin, Math.min(rect.right - width, window.innerWidth - width - margin));
      guide.style.width = `${width}px`;
      guide.style.left = `${left}px`;
      guide.style.top = `${Math.max(margin, Math.min(window.innerHeight - guide.offsetHeight - margin, rect.bottom + 10))}px`;
    };
    const dismiss = () => {
      guide.hidden = true;
      try {
        localStorage.setItem(storageKey, 'seen');
      } catch (_) {
        // noop
      }
    };

    $('[data-beginner-guide-dismiss]', guide).addEventListener('click', dismiss);
    toggle.addEventListener('click', dismiss, { once: true });
    window.addEventListener('resize', position);
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && !guide.hidden) dismiss();
    });
    window.setTimeout(() => {
      guide.hidden = false;
      position();
      guide.classList.add('is-visible');
    }, 700);
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
      const alwaysVisible = (navLinks.length > 0 || actions.classList.contains('article-mobile-actions--smart'))
        && window.matchMedia && window.matchMedia('(max-width: 767px)').matches;
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
    initArticleEndDisclaimer();
    initMarketBeginnerSections();
    initArticleSupportingAccordions();
    initArticleReadingModes();
    initDogeArticleExperience();
    initArticleSummaryTabs();
    initToc();
    syncArticleTocVisibility();
    initReadingProgress();
    initArticleSmartHeader();
    initArticleTables();
    initDogeSupplySimulator();
    initArticleDataCharts();
    initTronOnchainDashboard();
    initArticleDiffHighlight();
    initMermaidDiagrams();
    ensureSharedContextualMarketCta();
    initArticleLiveMarketCard();
    initDogeCostCalculator();
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
    initArticleBeginnerGuide();
    initExchangeChecklist();
    initArticleSectionShareTools();
    initArticleSmartMobileBar();
    initArticleMobileActions();
    initArticleCopyToast();
    initArticleSearch();
    initArticleSourcePopovers();
    initArticleReaderTools();
    initArticleSelectionTools();
  });
})();
