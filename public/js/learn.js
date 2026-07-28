(() => {
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

  function normalize(value) {
    return String(value || '').normalize('NFKC').trim().toLowerCase();
  }

  function initLearnFilters() {
    const cards = $$('[data-learn-card]');
    const buttons = $$('[data-learn-filter]');
    const searchInput = $('[data-learn-search]');
    const count = $('[data-learn-result-count]');
    const empty = $('[data-learn-empty]');
    const grid = $('[data-learn-card-grid]');
    const sortSelect = $('[data-article-sort]');
    if (!cards.length) return;

    let activeFilter = 'all';

    function matchesFilter(card) {
      if (activeFilter === 'all') return true;
      return String(card.dataset.learnTags || '').split(/\s+/).includes(activeFilter);
    }

    function matchesSearch(card, query) {
      if (!query) return true;
      return normalize(card.dataset.learnSearchText).includes(query);
    }

    function syncButtons() {
      buttons.forEach((button) => {
        const isActive = button.dataset.learnFilter === activeFilter;
        button.classList.toggle('is-active', isActive);
        button.setAttribute('aria-pressed', isActive ? 'true' : 'false');
      });
    }

    function cardDate(card) {
      const value = Date.parse(card.dataset.articleDate || '');
      return Number.isFinite(value) ? value : 0;
    }

    function cardNumber(card, key) {
      const value = Number(card.dataset[key]);
      return Number.isFinite(value) ? value : 0;
    }

    function sortCards() {
      if (!grid || !sortSelect) return;
      const mode = sortSelect.value || 'latest';
      const ordered = cards.slice().sort((a, b) => {
        if (mode === 'popular') {
          const popularityDiff = cardNumber(b, 'articlePopularity') - cardNumber(a, 'articlePopularity');
          if (popularityDiff !== 0) return popularityDiff;
        }
        if (mode === 'shortest') {
          const readDiff = cardNumber(a, 'articleReadMinutes') - cardNumber(b, 'articleReadMinutes');
          if (readDiff !== 0) return readDiff;
        }
        return cardDate(b) - cardDate(a);
      });
      ordered.forEach(card => grid.appendChild(card));
    }

    function applyFilters() {
      const query = normalize(searchInput && searchInput.value);
      let visibleCount = 0;

      cards.forEach((card) => {
        const isVisible = matchesFilter(card) && matchesSearch(card, query);
        card.hidden = !isVisible;
        if (isVisible) visibleCount += 1;
      });

      if (count) count.textContent = `${visibleCount}件表示`;
      if (empty) empty.hidden = visibleCount !== 0;
      syncButtons();
      sortCards();
    }

    buttons.forEach((button) => {
      button.addEventListener('click', () => {
        activeFilter = button.dataset.learnFilter || 'all';
        applyFilters();
      });
    });

    if (searchInput) {
      searchInput.addEventListener('input', applyFilters);
    }

    if (sortSelect) {
      sortSelect.addEventListener('change', applyFilters);
    }

    applyFilters();
  }

  function initLogoFallbacks() {
    $$('[data-crypto-logo]').forEach((image) => {
      const mark = image.closest('.learn-asset-mark');
      if (!mark) return;
      const showFallback = () => mark.classList.add('is-fallback');
      image.addEventListener('error', showFallback, { once: true });
      if (image.complete && image.naturalWidth === 0) showFallback();
    });
  }

  function initArticleCommand() {
    const modal = $('[data-article-command]');
    if (!modal) return;

    const openers = $$('[data-article-command-open]');
    const closers = $$('[data-article-command-close]', modal);
    const input = $('[data-article-command-search]', modal);
    const items = $$('[data-article-command-item]', modal);
    const count = $('[data-article-command-count]', modal);
    const empty = $('[data-article-command-empty]', modal);
    const shortcutLabels = $$('[data-shortcut-label]');
    const isMac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent || '');
    let previousFocus = null;

    shortcutLabels.forEach(label => {
      label.textContent = isMac ? '⌘ K' : 'Ctrl K';
    });

    function visibleItems() {
      return items.filter(item => !item.hidden);
    }

    function syncResults() {
      const query = normalize(input && input.value);
      let visibleCount = 0;
      items.forEach((item) => {
        const isVisible = !query || normalize(item.dataset.commandSearchText).includes(query);
        item.hidden = !isVisible;
        if (isVisible) visibleCount += 1;
      });
      if (count) count.textContent = `${visibleCount}件の記事`;
      if (empty) empty.hidden = visibleCount !== 0;
    }

    function openModal() {
      if (!modal.hidden) return;
      previousFocus = document.activeElement;
      modal.hidden = false;
      document.body.classList.add('article-command-open');
      openers.forEach(opener => opener.setAttribute('aria-expanded', 'true'));
      syncResults();
      window.requestAnimationFrame(() => input && input.focus());
    }

    function closeModal() {
      if (modal.hidden) return;
      modal.hidden = true;
      document.body.classList.remove('article-command-open');
      openers.forEach(opener => opener.setAttribute('aria-expanded', 'false'));
      if (previousFocus && typeof previousFocus.focus === 'function') previousFocus.focus();
    }

    function focusResult(offset) {
      const visible = visibleItems();
      if (!visible.length) return;
      const activeIndex = visible.indexOf(document.activeElement);
      const nextIndex = activeIndex === -1
        ? (offset > 0 ? 0 : visible.length - 1)
        : (activeIndex + offset + visible.length) % visible.length;
      visible[nextIndex].focus();
    }

    openers.forEach((opener) => {
      opener.setAttribute('aria-expanded', 'false');
      opener.addEventListener('click', openModal);
    });
    closers.forEach(closer => closer.addEventListener('click', closeModal));
    if (input) {
      input.addEventListener('input', syncResults);
      input.addEventListener('keydown', (event) => {
        if (event.key === 'ArrowDown') {
          event.preventDefault();
          focusResult(1);
        } else if (event.key === 'ArrowUp') {
          event.preventDefault();
          focusResult(-1);
        } else if (event.key === 'Enter') {
          const first = visibleItems()[0];
          if (first) {
            event.preventDefault();
            window.location.assign(first.href);
          }
        }
      });
    }

    items.forEach((item) => {
      item.addEventListener('keydown', (event) => {
        if (event.key === 'ArrowDown') {
          event.preventDefault();
          focusResult(1);
        } else if (event.key === 'ArrowUp') {
          event.preventDefault();
          focusResult(-1);
        }
      });
    });

    document.addEventListener('keydown', (event) => {
      if ((event.metaKey || event.ctrlKey) && normalize(event.key) === 'k') {
        event.preventDefault();
        openModal();
        return;
      }
      if (modal.hidden) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        closeModal();
        return;
      }
      if (event.key !== 'Tab') return;

      const focusable = [input, ...visibleItems(), ...$$('button:not([disabled])', modal)]
        .filter(Boolean)
        .filter((element, index, list) => list.indexOf(element) === index);
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    });
  }

  function init() {
    initLearnFilters();
    initLogoFallbacks();
    initArticleCommand();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
