(() => {
  const THEME_STORAGE_KEY = 'okj.theme.v1';
  const ARTICLE_TERM_SELECTOR = '.article-term[data-term-key]';

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

  function readStoredTheme() {
    try {
      return localStorage.getItem(THEME_STORAGE_KEY) === 'light' ? 'light' : 'dark';
    } catch (_) {
      return document.documentElement.classList.contains('theme-light') ? 'light' : 'dark';
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
      button.setAttribute('aria-pressed', isLight ? 'true' : 'false');
      button.setAttribute('aria-label', isLight ? 'ダークモードに切り替え' : 'ライトモードに切り替え');
      if (icon) icon.textContent = isLight ? '☾' : '☀';
      if (label) label.textContent = isLight ? 'ダーク' : 'ライト';
    });
  }

  function initThemeToggle() {
    let currentTheme = readStoredTheme();
    syncTheme(currentTheme);

    document.addEventListener('click', (event) => {
      const button = event.target && event.target.closest ? event.target.closest('[data-theme-toggle]') : null;
      if (!button) return;
      event.preventDefault();
      currentTheme = currentTheme === 'light' ? 'dark' : 'light';
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
    return headings.map((heading) => (
      `<a class="article-toc__link" href="#${heading.id}" data-article-toc-link="${heading.id}">${heading.textContent.trim()}</a>`
    )).join('');
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
      while (usedIds.has(id) || document.getElementById(id)) {
        id = `${baseId}-${suffix}`;
        suffix += 1;
      }
      usedIds.add(id);
      heading.id = id;
      heading.tabIndex = -1;
    });

    const linksHtml = buildTocLinks(headings);
    tocList.innerHTML = linksHtml;
    toc.hidden = false;
    if (mobileToc && mobileTocList) {
      mobileTocList.innerHTML = linksHtml;
      mobileToc.hidden = false;
    }

    const links = $$('[data-article-toc-link]');
    const setActive = (id) => {
      links.forEach((link) => {
        const active = link.dataset.articleTocLink === id;
        link.classList.toggle('is-active', active);
        if (active) link.setAttribute('aria-current', 'true');
        else link.removeAttribute('aria-current');
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
        modeButtons.forEach(item => item.classList.toggle('is-active', item === button));
        update();
      });
    });

    if (amountInput) amountInput.addEventListener('input', update);
    update();
  }

  function syncArticleTerms(enabled) {
    $$(ARTICLE_TERM_SELECTOR).forEach((term) => {
      term.tabIndex = enabled ? 0 : -1;
      term.setAttribute('role', enabled ? 'button' : 'text');
      term.setAttribute('aria-disabled', enabled ? 'false' : 'true');
    });
  }

  function initArticleTerms() {
    const enabled = Boolean(window.BeginnerMode && window.BeginnerMode.isEnabled && window.BeginnerMode.isEnabled());
    syncArticleTerms(enabled);
    window.addEventListener('okj:beginner-mode-change', (event) => {
      syncArticleTerms(Boolean(event.detail && event.detail.enabled));
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    initThemeToggle();
    initToc();
    initReadingProgress();
    initMiniSimulator();
    initArticleTerms();
  });
})();
