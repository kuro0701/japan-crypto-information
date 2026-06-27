(() => {
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

  function normalize(value) {
    return String(value || '').trim().toLowerCase();
  }

  function initLearnFilters() {
    const cards = $$('[data-learn-card]');
    const buttons = $$('[data-learn-filter]');
    const searchInput = $('[data-learn-search]');
    const count = $('[data-learn-result-count]');
    const empty = $('[data-learn-empty]');
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

    applyFilters();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initLearnFilters, { once: true });
  } else {
    initLearnFilters();
  }
})();
