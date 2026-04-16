let depthChart = null;
let lastSimulation = null;
let chartBaseCurrency = 'BTC';

function initDepthChart() {
  const ctx = document.getElementById('depth-chart');
  if (!ctx) return;

  depthChart = new Chart(ctx, {
    type: 'line',
    data: {
      datasets: [
        {
          label: 'Bid (買い板)',
          data: [],
          borderColor: 'rgba(62, 224, 161, 0.95)',
          backgroundColor: 'rgba(62, 224, 161, 0.16)',
          fill: true,
          pointRadius: 0,
          borderWidth: 2,
          tension: 0.1,
        },
        {
          label: 'Ask (売り板)',
          data: [],
          borderColor: 'rgba(255, 107, 97, 0.95)',
          backgroundColor: 'rgba(255, 107, 97, 0.16)',
          fill: true,
          pointRadius: 0,
          borderWidth: 2,
          tension: 0.1,
        },
        {
          label: '消費範囲',
          data: [],
          borderColor: 'rgba(244, 201, 93, 0.95)',
          backgroundColor: 'rgba(244, 201, 93, 0.26)',
          fill: true,
          pointRadius: 0,
          borderWidth: 2,
          tension: 0.1,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 0 },
      interaction: { mode: 'nearest', intersect: false },
      plugins: {
        legend: {
          labels: {
            color: '#b4bdaa',
            boxWidth: 14,
            boxHeight: 8,
            font: { size: 11, weight: 700 },
          },
        },
        tooltip: {
          backgroundColor: 'rgba(8, 11, 8, 0.94)',
          borderColor: 'rgba(205, 222, 190, 0.2)',
          borderWidth: 1,
          titleColor: '#eef5eb',
          bodyColor: '#b4bdaa',
          callbacks: {
            label: (ctx) => {
              const p = ctx.parsed;
              return `${ctx.dataset.label}: ${Fmt.jpy(p.x)} / ${Fmt.btcShort(p.y)} ${chartBaseCurrency}`;
            },
          },
        },
      },
      scales: {
        x: {
          type: 'linear',
          title: { display: true, text: '価格 (JPY)', color: '#8f9a8c' },
          ticks: {
            color: '#687266',
            callback: (v) => (v / 1e6).toFixed(1) + 'M',
          },
          grid: { color: 'rgba(205, 222, 190, 0.08)' },
        },
        y: {
          title: { display: true, text: `累積数量 (${chartBaseCurrency})`, color: '#8f9a8c' },
          ticks: { color: '#687266' },
          grid: { color: 'rgba(205, 222, 190, 0.08)' },
        },
      },
    },
  });
}

function updateDepthChart(depthData, midPrice) {
  if (!depthChart || !depthData) return;

  // Filter to reasonable range around mid price (within 10%)
  const low = midPrice * 0.9;
  const high = midPrice * 1.1;

  const bidPoints = depthData.bidPoints
    .filter(p => p.price >= low)
    .map(p => ({ x: p.price, y: p.cumulative }))
    .reverse();

  const askPoints = depthData.askPoints
    .filter(p => p.price <= high)
    .map(p => ({ x: p.price, y: p.cumulative }));

  depthChart.data.datasets[0].data = bidPoints;
  depthChart.data.datasets[1].data = askPoints;

  // Update consumed region if simulation exists
  if (lastSimulation && !lastSimulation.error) {
    updateConsumedRegion(lastSimulation, depthData);
  } else {
    depthChart.data.datasets[2].data = [];
  }

  depthChart.update('none');
}

function setChartBaseCurrency(currency) {
  chartBaseCurrency = currency || 'BTC';
  if (depthChart) {
    depthChart.options.scales.y.title.text = `累積数量 (${chartBaseCurrency})`;
    depthChart.update('none');
  }
}

function updateConsumedRegion(sim, depthData) {
  if (!depthChart || !sim || sim.error) {
    if (depthChart) depthChart.data.datasets[2].data = [];
    return;
  }

  const source = sim.side === 'buy' ? depthData.askPoints : depthData.bidPoints;
  const worstPrice = sim.worstPrice;
  let consumed;

  if (sim.side === 'buy') {
    consumed = source
      .filter(p => p.price <= worstPrice)
      .map(p => ({ x: p.price, y: p.cumulative }));
  } else {
    consumed = source
      .filter(p => p.price >= worstPrice)
      .map(p => ({ x: p.price, y: p.cumulative }))
      .reverse();
  }

  depthChart.data.datasets[2].data = consumed;
}

function setSimulationForChart(sim) {
  lastSimulation = sim;
}
