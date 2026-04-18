document.addEventListener('DOMContentLoaded', () => {
  const ws = new WSClient();
  let latestDepthData = null;
  let latestMidPrice = null;
  let autoUpdate = true;
  const defaultMarket = {
    instrumentId: 'BTC-JPY',
    label: 'BTC/JPY',
    baseCurrency: 'BTC',
    quoteCurrency: 'JPY',
    status: 'active',
  };
  let exchanges = [{
    id: 'okj',
    label: 'OKJ',
    defaultInstrumentId: 'BTC-JPY',
    instrumentLabel: 'BTC/JPY',
    dataSourceLabel: 'OKCoin Japan WebSocket + REST fallback',
    status: 'active',
    markets: [defaultMarket],
  }];

  // DOM elements
  const exchangeSelect = document.getElementById('exchange-select');
  const marketSelect = document.getElementById('market-select');
  const sideSelect = document.getElementById('side-select');
  const amountTypeSelect = document.getElementById('amount-type');
  const amountInput = document.getElementById('amount-input');
  const feeRateInput = document.getElementById('fee-rate');
  const simulateBtn = document.getElementById('simulate-btn');
  const clearBtn = document.getElementById('clear-btn');
  const autoUpdateCheck = document.getElementById('auto-update');
  const amountUnit = document.getElementById('amount-unit');

  const parseNumberInput = (value) => parseFloat(String(value || '').replace(/,/g, ''));
  const getMarkets = (exchange) => (exchange && Array.isArray(exchange.markets) && exchange.markets.length > 0)
    ? exchange.markets
    : [defaultMarket];
  const getSelectedExchange = () => {
    const selectedId = exchangeSelect ? exchangeSelect.value : ws.exchangeId;
    return exchanges.find(exchange => exchange.id === selectedId) || exchanges[0];
  };
  const getSelectedMarket = (exchange = getSelectedExchange()) => {
    const markets = getMarkets(exchange);
    const selectedId = marketSelect ? marketSelect.value : ws.instrumentId;
    return markets.find(market => market.instrumentId === selectedId)
      || markets.find(market => market.instrumentId === exchange.defaultInstrumentId)
      || markets[0];
  };

  function updateAmountUnit() {
    const market = getSelectedMarket();
    const base = market.baseCurrency || 'BTC';
    amountUnit.textContent = amountTypeSelect.value === 'base' ? base : 'JPY';
    amountInput.placeholder = amountTypeSelect.value === 'base' ? '1.0' : '10000000';
    
    // Update the dropdown option text itself
    const baseOption = document.getElementById('amount-type-base-option');
    if (baseOption) {
      baseOption.textContent = `数量 (${base})`;
    }
  }

  function setMarketDisplay(exchange, market = getSelectedMarket(exchange)) {
    if (!exchange) return;
    UI.setText('instrument-label', market.label || market.instrumentId || '-');
    UI.setText('footer-exchange-label', exchange.label || '-');
    UI.setText('footer-instrument-label', market.label || market.instrumentId || '-');
    UI.setText('footer-source-label', exchange.dataSourceLabel || '-');
    UI.setMarketMeta(market);
    if (typeof setChartBaseCurrency === 'function') {
      setChartBaseCurrency(market.baseCurrency || 'BTC');
    }
    updateAmountUnit();
  }

  function clearMarketState() {
    latestDepthData = null;
    latestMidPrice = null;
    setSimulationForChart(null);
    UI.clearMarketView();
    UI.clearSimulationView();
    ws.clearSimulation();
    if (depthChart) {
      depthChart.data.datasets.forEach(dataset => {
        dataset.data = [];
      });
      depthChart.update('none');
    }
  }

  function populateExchangeSelect(nextExchanges, defaultExchangeId = 'okj') {
    if (!Array.isArray(nextExchanges) || nextExchanges.length === 0) return;
    exchanges = nextExchanges;

    if (!exchangeSelect) {
      setMarketDisplay(exchanges[0]);
      return;
    }

    const previousValue = exchangeSelect.value || defaultExchangeId;
    exchangeSelect.innerHTML = exchanges.map(exchange => `
      <option value="${exchange.id}" ${exchange.status !== 'active' ? 'disabled' : ''}>
        ${exchange.label}
      </option>
    `).join('');
    exchangeSelect.value = exchanges.some(exchange => exchange.id === previousValue)
      ? previousValue
      : defaultExchangeId;
    populateMarketSelect(getSelectedExchange());
    setMarketDisplay(getSelectedExchange());
  }

  function populateMarketSelect(exchange = getSelectedExchange(), preferredInstrumentId) {
    if (!marketSelect) return;

    const markets = getMarkets(exchange);
    const previousValue = preferredInstrumentId || marketSelect.value || exchange.defaultInstrumentId;
    marketSelect.innerHTML = markets.map(market => `
      <option value="${market.instrumentId}" ${market.status !== 'active' ? 'disabled' : ''}>
        ${market.label || market.instrumentId}
      </option>
    `).join('');
    marketSelect.value = markets.some(market => market.instrumentId === previousValue)
      ? previousValue
      : (markets.find(market => market.instrumentId === exchange.defaultInstrumentId) || markets[0]).instrumentId;
  }

  async function loadExchangesFromApi() {
    try {
      const res = await fetch('/api/exchanges', { cache: 'no-store' });
      if (!res.ok) return;

      const data = await res.json();
      populateExchangeSelect(data.exchanges, data.defaultExchangeId);
      const exchange = getSelectedExchange();
      populateMarketSelect(exchange, ws.instrumentId || exchange.defaultInstrumentId);
      const market = getSelectedMarket(exchange);
      ws.setMarket(exchange.id, market.instrumentId);
      setMarketDisplay(exchange, market);
    } catch (err) {
      console.warn('Exchange list fetch failed:', err);
    }
  }

  // Update unit label on amount type change
  amountTypeSelect.addEventListener('change', () => {
    updateAmountUnit();
  });

  // Side button toggle
  document.querySelectorAll('[data-side]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-side]').forEach(b => {
        b.classList.remove('is-active');
        b.setAttribute('aria-pressed', 'false');
      });
      btn.classList.add('is-active');
      btn.setAttribute('aria-pressed', 'true');
      sideSelect.value = btn.dataset.side;
    });
  });

  // Simulate
  function runSimulation() {
    const side = sideSelect.value;
    const amountType = amountTypeSelect.value;
    const amount = parseNumberInput(amountInput.value);

    if (isNaN(amount) || amount <= 0) {
      document.getElementById('simulation-results').innerHTML =
        '<div class="text-yellow-400 text-center py-4">正の数値を入力してください</div>';
      return;
    }

    const feeRatePct = parseNumberInput(feeRateInput.value);
    if (isNaN(feeRatePct) || feeRatePct < 0 || feeRatePct > 100) {
      document.getElementById('simulation-results').innerHTML =
        '<div class="text-yellow-400 text-center py-4">手数料率は0%以上100%以下で入力してください</div>';
      return;
    }

    ws.simulate(side, amount, amountType, feeRatePct / 100, autoUpdate);
  }

  simulateBtn.addEventListener('click', runSimulation);

  amountInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') runSimulation();
  });

  clearBtn.addEventListener('click', () => {
    ws.clearSimulation();
    setSimulationForChart(null);
    UI.clearSimulationView();
    if (depthChart) {
      depthChart.data.datasets[2].data = [];
      depthChart.update('none');
    }
  });

  if (autoUpdateCheck) {
    autoUpdateCheck.addEventListener('change', () => {
      autoUpdate = autoUpdateCheck.checked;
      if (!autoUpdate) {
        ws.clearSimulation();
      } else if (amountInput.value) {
        runSimulation();
      }
    });
  }

  if (exchangeSelect) {
    populateExchangeSelect(exchanges, 'okj');
    exchangeSelect.addEventListener('change', () => {
      const exchange = getSelectedExchange();
      populateMarketSelect(exchange, exchange.defaultInstrumentId);
      const market = getSelectedMarket(exchange);
      ws.setMarket(exchange.id, market.instrumentId);
      setMarketDisplay(exchange, market);
      clearMarketState();
    });
  }

  if (marketSelect) {
    marketSelect.addEventListener('change', () => {
      const exchange = getSelectedExchange();
      const market = getSelectedMarket(exchange);
      ws.setMarket(exchange.id, market.instrumentId);
      setMarketDisplay(exchange, market);
      clearMarketState();
    });
  }

  // WebSocket handlers
  ws.on('connected', () => UI.setConnectionStatus('connected'));
  ws.on('disconnected', () => UI.setConnectionStatus('disconnected'));
  ws.on('reconnecting', () => UI.setConnectionStatus('reconnecting'));

  ws.on('orderbook', (data) => {
    if (data.exchange && exchangeSelect) exchangeSelect.value = data.exchange.id;
    if (data.market && marketSelect) marketSelect.value = data.market.instrumentId;
    if (data.exchange || data.market) {
      setMarketDisplay(data.exchange || getSelectedExchange(), data.market || getSelectedMarket());
    }
    UI.updateMarketOverview(data);
    latestDepthData = data.depthChart;
    latestMidPrice = data.midPrice;
    updateDepthChart(data.depthChart, data.midPrice);
  });

  ws.on('ticker', (data) => {
    if (!data) return;
    const exchange = getSelectedExchange();
    const market = getSelectedMarket(exchange);
    if (data.exchangeId && data.exchangeId !== exchange.id) return;
    if (data.instrumentId && data.instrumentId !== market.instrumentId) return;
    UI.updateTicker(data);
  });

  ws.on('exchanges', (data) => {
    populateExchangeSelect(data.exchanges, data.defaultExchangeId);
    const exchange = getSelectedExchange();
    populateMarketSelect(exchange, ws.instrumentId || exchange.defaultInstrumentId);
    const market = getSelectedMarket(exchange);
    ws.setMarket(exchange.id, market.instrumentId);
    setMarketDisplay(exchange, market);
  });

  ws.on('simulation', (data) => {
    setSimulationForChart(data);
    UI.updateSimulationResults(data);
    UI.updateFillTable(data.fills || [], data.side);
    if (latestDepthData) {
      updateDepthChart(latestDepthData, latestMidPrice);
    }
  });

  ws.on('error', (data) => {
    if (data && data.message) {
      console.warn('Server error:', data.message);
    }
  });

  // Initialize
  initDepthChart();
  ws.connect();
  loadExchangesFromApi();
});
