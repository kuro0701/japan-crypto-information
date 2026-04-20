document.addEventListener('DOMContentLoaded', () => {
  const config = window.MARKETS_INDEX || {};
  const cards = Array.from(document.querySelectorAll('.market-index-card'));
  const searchInput = document.getElementById('market-index-search');
  const exchangeSelect = document.getElementById('market-index-exchange');
  const visibleCount = document.getElementById('market-index-visible-count');
  const status = document.getElementById('market-index-status');
  const meta = document.getElementById('market-index-meta');
  const empty = document.getElementById('market-index-empty');
  const allValue = '__all__';

  function readInitialParams() {
    const params = new URLSearchParams(window.location.search);
    if (searchInput && params.get('q')) searchInput.value = params.get('q');
    if (exchangeSelect && params.get('exchange')) {
      const value = params.get('exchange');
      if (Array.from(exchangeSelect.options).some(option => option.value === value)) {
        exchangeSelect.value = value;
      }
    }
  }

  function writeParams(query, exchangeId) {
    const params = new URLSearchParams();
    if (query) params.set('q', query);
    if (exchangeId && exchangeId !== allValue) params.set('exchange', exchangeId);
    const nextUrl = params.toString()
      ? `${window.location.pathname}?${params.toString()}`
      : window.location.pathname;
    window.history.replaceState(null, '', nextUrl);
  }

  function updateVisibility() {
    const query = String(searchInput && searchInput.value || '').trim().toLowerCase();
    const exchangeId = String(exchangeSelect && exchangeSelect.value || allValue);
    let count = 0;

    for (const card of cards) {
      const searchText = card.dataset.marketSearch || '';
      const exchanges = ` ${card.dataset.exchanges || ''} `;
      const matchesQuery = !query || searchText.includes(query);
      const matchesExchange = exchangeId === allValue || exchanges.includes(` ${exchangeId} `);
      const visible = matchesQuery && matchesExchange;
      card.hidden = !visible;
      if (visible) count += 1;
    }

    if (visibleCount) visibleCount.textContent = String(count);
    if (status) status.textContent = count === cards.length ? '全銘柄' : '絞り込み中';
    if (meta) {
      const total = config.meta && Number(config.meta.marketCount) ? Number(config.meta.marketCount) : cards.length;
      meta.textContent = `${count} / ${total} 銘柄`;
    }
    if (empty) empty.classList.toggle('hidden', count > 0);
    writeParams(query, exchangeId);
  }

  readInitialParams();
  updateVisibility();
  if (searchInput) searchInput.addEventListener('input', updateVisibility);
  if (exchangeSelect) exchangeSelect.addEventListener('change', updateVisibility);
});
