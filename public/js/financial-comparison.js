(function () {
  'use strict';

  const dataNode = document.getElementById('financial-comparison-data');
  if (!dataNode) return;

  let model;
  try {
    model = JSON.parse(dataNode.textContent || '{}');
  } catch (_err) {
    model = null;
  }
  if (!model || !Array.isArray(model.companies) || !Array.isArray(model.metrics)) return;

  const companies = model.companies;
  const metrics = model.metrics;
  const metricMap = new Map(metrics.map(metric => [metric.key, metric]));
  const selectedIds = new Set(companies.map(company => company.exchangeId));
  let activeMetric = 'revenue';
  let focusId = companies[0] && companies[0].exchangeId;
  let barChart = null;
  let trendChart = null;
  let radarChart = null;

  const palette = [
    [53, 200, 210],
    [53, 224, 165],
    [244, 201, 93],
    [139, 197, 92],
    [255, 107, 112],
    [125, 160, 255],
    [205, 222, 190],
  ];

  function $(id) {
    return document.getElementById(id);
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, char => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    }[char]));
  }

  function numberOrNull(value) {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : null;
  }

  function metricConfig(metricKey) {
    return metricMap.get(metricKey) || metrics[0];
  }

  function latestValue(company, metricKey) {
    return numberOrNull(company && company.latest && company.latest[metricKey]);
  }

  function historyValue(company, row, metricKey, index) {
    const direct = numberOrNull(row && row[metricKey]);
    if (direct != null) return direct;
    const revenue = numberOrNull(row && row.revenue);
    if (metricKey === 'operatingMargin') {
      const operatingProfit = numberOrNull(row && row.operatingProfit);
      return revenue && operatingProfit != null ? (operatingProfit / revenue) * 100 : null;
    }
    if (metricKey === 'revenueYoY' && index > 0) {
      const previousRevenue = numberOrNull(company.history[index - 1] && company.history[index - 1].revenue);
      return revenue != null && previousRevenue ? ((revenue - previousRevenue) / Math.abs(previousRevenue)) * 100 : null;
    }
    if (metricKey === 'totalAssets' || metricKey === 'equityRatio') {
      return index === company.history.length - 1 ? latestValue(company, metricKey) : null;
    }
    return null;
  }

  function formatNumber(value, maximumFractionDigits = 0) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return '-';
    return new Intl.NumberFormat('ja-JP', { maximumFractionDigits }).format(numeric);
  }

  function formatMetricValue(value, metricKey) {
    const numeric = numberOrNull(value);
    if (numeric == null) return '開示なし';
    const metric = metricConfig(metricKey);
    if (metric.unit === '%') {
      const digits = Math.abs(numeric) >= 10 ? 1 : 2;
      return `${formatNumber(numeric, digits)}%`;
    }
    const sign = numeric < 0 ? '△' : '';
    return `${sign}${formatNumber(Math.abs(numeric), 0)}百万円`;
  }

  function compactMetricValue(value, metricKey) {
    const numeric = numberOrNull(value);
    if (numeric == null) return '-';
    const metric = metricConfig(metricKey);
    if (metric.unit === '%') return `${numeric.toFixed(Math.abs(numeric) >= 10 ? 1 : 2)}%`;
    const sign = numeric < 0 ? '△' : '';
    const abs = Math.abs(numeric);
    if (abs >= 1000000) return `${sign}${(abs / 1000000).toFixed(1)}兆円`;
    if (abs >= 100) return `${sign}${(abs / 100).toFixed(1)}億円`;
    return `${sign}${formatNumber(abs, 0)}百万円`;
  }

  function color(index, alpha = 1) {
    const selected = palette[index % palette.length];
    return `rgba(${selected[0]}, ${selected[1]}, ${selected[2]}, ${alpha})`;
  }

  function visibleCompanies() {
    return companies.filter(company => selectedIds.has(company.exchangeId));
  }

  function companyById(exchangeId) {
    return companies.find(company => company.exchangeId === exchangeId) || companies[0];
  }

  function sortedByMetric(metricKey, source = visibleCompanies()) {
    return source
      .slice()
      .filter(company => latestValue(company, metricKey) != null)
      .sort((a, b) => {
        const aValue = latestValue(a, metricKey);
        const bValue = latestValue(b, metricKey);
        if (aValue !== bValue) return bValue - aValue;
        return String(a.label || a.serviceName).localeCompare(String(b.label || b.serviceName));
      });
  }

  function metricValues(metricKey, source = visibleCompanies()) {
    return source
      .map(company => latestValue(company, metricKey))
      .filter(value => value != null);
  }

  function normalizedScore(value, metricKey, source = visibleCompanies()) {
    const numeric = numberOrNull(value);
    if (numeric == null) return null;
    const values = metricValues(metricKey, source);
    if (values.length === 0) return null;
    const min = Math.min(...values, metricConfig(metricKey).tone === 'profit' || metricConfig(metricKey).tone === 'growth' ? -1 : 0);
    const max = Math.max(...values);
    if (max === min) return 60;
    return Math.max(0, Math.min(100, ((numeric - min) / (max - min)) * 100));
  }

  function heatColor(value, metricKey) {
    const numeric = numberOrNull(value);
    const score = normalizedScore(numeric, metricKey) || 0;
    const intensity = 0.08 + (score / 100) * 0.32;
    if (numeric != null && numeric < 0) return `rgba(255, 107, 112, ${Math.max(0.16, 0.42 - intensity)})`;
    return `rgba(53, 224, 165, ${intensity})`;
  }

  function chartTextColor() {
    return '#c9d3cd';
  }

  function chartGridColor() {
    return 'rgba(200, 220, 210, 0.09)';
  }

  function baseChartOptions() {
    return {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          labels: {
            color: chartTextColor(),
            boxWidth: 12,
            boxHeight: 8,
            font: { size: 11, weight: 700 },
          },
        },
        tooltip: {
          backgroundColor: 'rgba(8, 12, 13, 0.95)',
          borderColor: 'rgba(200, 220, 210, 0.2)',
          borderWidth: 1,
          titleColor: '#f2f7f4',
          bodyColor: chartTextColor(),
        },
      },
    };
  }

  function buildBarChart() {
    const canvas = $('financial-bar-chart');
    if (!canvas || typeof Chart === 'undefined') return;
    barChart = new Chart(canvas, {
      type: 'bar',
      data: { labels: [], datasets: [] },
      options: {
        ...baseChartOptions(),
        indexAxis: 'y',
        animation: { duration: 260 },
        onClick: (event) => {
          const points = barChart.getElementsAtEventForMode(event, 'nearest', { intersect: true }, true);
          const point = points && points[0];
          if (!point) return;
          const rows = sortedByMetric(activeMetric);
          const company = rows[point.index];
          if (company) setFocus(company.exchangeId);
        },
        scales: {
          x: {
            ticks: { color: '#9aa6a1', callback: value => compactMetricValue(value, activeMetric) },
            grid: { color: chartGridColor() },
          },
          y: {
            ticks: { color: chartTextColor(), font: { weight: 800 } },
            grid: { display: false },
          },
        },
      },
    });
  }

  function buildTrendChart() {
    const canvas = $('financial-trend-chart');
    if (!canvas || typeof Chart === 'undefined') return;
    trendChart = new Chart(canvas, {
      type: 'line',
      data: { labels: [], datasets: [] },
      options: {
        ...baseChartOptions(),
        animation: { duration: 260 },
        interaction: { mode: 'nearest', intersect: false },
        elements: { point: { radius: 3, hoverRadius: 5 } },
        scales: {
          x: {
            ticks: { color: '#9aa6a1' },
            grid: { color: chartGridColor() },
          },
          y: {
            ticks: { color: '#9aa6a1', callback: value => compactMetricValue(value, activeMetric) },
            grid: { color: chartGridColor() },
          },
        },
      },
    });
  }

  function buildRadarChart() {
    const canvas = $('financial-radar-chart');
    if (!canvas || typeof Chart === 'undefined') return;
    radarChart = new Chart(canvas, {
      type: 'radar',
      data: { labels: [], datasets: [] },
      options: {
        ...baseChartOptions(),
        animation: { duration: 260 },
        scales: {
          r: {
            beginAtZero: true,
            suggestedMax: 100,
            pointLabels: { color: chartTextColor(), font: { size: 11, weight: 800 } },
            ticks: { display: false, stepSize: 25 },
            grid: { color: chartGridColor() },
            angleLines: { color: chartGridColor() },
          },
        },
      },
    });
  }

  function updateBarChart() {
    if (!barChart) return;
    const metric = metricConfig(activeMetric);
    const rows = sortedByMetric(activeMetric);
    barChart.data.labels = rows.map(company => company.label || company.serviceName);
    barChart.data.datasets = [{
      label: metric.label,
      data: rows.map(company => latestValue(company, activeMetric)),
      backgroundColor: rows.map((company, index) => {
        const value = latestValue(company, activeMetric);
        return value != null && value < 0 ? 'rgba(255, 107, 112, 0.62)' : color(index, 0.72);
      }),
      borderColor: rows.map((company, index) => {
        const value = latestValue(company, activeMetric);
        return value != null && value < 0 ? 'rgba(255, 107, 112, 0.95)' : color(index, 0.95);
      }),
      borderWidth: 1,
      borderRadius: 4,
    }];
    barChart.options.scales.x.ticks.callback = value => compactMetricValue(value, activeMetric);
    barChart.update();
  }

  function updateTrendChart() {
    if (!trendChart) return;
    const years = Array.from(new Set(companies.flatMap(company => company.history.map(row => row.fiscalYear))))
      .filter(year => Number.isFinite(Number(year)))
      .sort((a, b) => a - b);
    const rows = visibleCompanies();
    trendChart.data.labels = years.map(year => String(year));
    trendChart.data.datasets = rows.map((company, index) => {
      const byYear = new Map(company.history.map((row, rowIndex) => [
        Number(row.fiscalYear),
        historyValue(company, row, activeMetric, rowIndex),
      ]));
      return {
        label: company.label || company.serviceName,
        data: years.map(year => byYear.has(year) ? byYear.get(year) : null),
        borderColor: color(index, 0.95),
        backgroundColor: color(index, 0.14),
        spanGaps: true,
        tension: 0.28,
        borderWidth: company.exchangeId === focusId ? 3 : 2,
      };
    });
    trendChart.options.scales.y.ticks.callback = value => compactMetricValue(value, activeMetric);
    trendChart.update();
  }

  function radarScoresFor(company) {
    const radarMetrics = ['revenue', 'operatingProfit', 'netIncome', 'netAssets', 'equityRatio', 'revenueYoY'];
    return radarMetrics.map(metricKey => normalizedScore(latestValue(company, metricKey), metricKey, companies) || 0);
  }

  function averageRadarScores() {
    const source = visibleCompanies();
    if (source.length === 0) return [];
    const radarMetrics = ['revenue', 'operatingProfit', 'netIncome', 'netAssets', 'equityRatio', 'revenueYoY'];
    return radarMetrics.map((metricKey) => {
      const scores = source.map(company => normalizedScore(latestValue(company, metricKey), metricKey, companies)).filter(value => value != null);
      if (scores.length === 0) return 0;
      return scores.reduce((sum, value) => sum + value, 0) / scores.length;
    });
  }

  function updateRadarChart() {
    if (!radarChart) return;
    const company = companyById(focusId);
    const labels = ['収益規模', '営業利益', '純利益', '純資産', '自己資本', '成長率'];
    radarChart.data.labels = labels;
    radarChart.data.datasets = [
      {
        label: company.label || company.serviceName,
        data: radarScoresFor(company),
        borderColor: 'rgba(53, 224, 165, 0.95)',
        backgroundColor: 'rgba(53, 224, 165, 0.18)',
        pointBackgroundColor: 'rgba(53, 224, 165, 0.95)',
        borderWidth: 2,
      },
      {
        label: '掲載社平均',
        data: averageRadarScores(),
        borderColor: 'rgba(244, 201, 93, 0.92)',
        backgroundColor: 'rgba(244, 201, 93, 0.12)',
        pointBackgroundColor: 'rgba(244, 201, 93, 0.92)',
        borderWidth: 2,
      },
    ];
    const note = $('financial-radar-note');
    if (note) note.textContent = `${company.label || company.serviceName} と掲載社平均を比較します。`;
    radarChart.update();
  }

  function renderCompanyFilter() {
    const target = $('financial-company-filter');
    if (!target) return;
    target.innerHTML = companies.map((company) => {
      const active = selectedIds.has(company.exchangeId);
      const focused = company.exchangeId === focusId;
      return [
        `<button type="button" class="financial-company-chip${active ? ' is-active' : ''}${focused ? ' is-focused' : ''}" data-company-id="${escapeHtml(company.exchangeId)}" aria-pressed="${active ? 'true' : 'false'}">`,
        `  <span>${escapeHtml(company.label || company.serviceName)}</span>`,
        '</button>',
      ].join('');
    }).join('');

    target.querySelectorAll('[data-company-id]').forEach((button) => {
      button.addEventListener('click', () => {
        const companyId = button.getAttribute('data-company-id');
        if (!companyId) return;
        if (selectedIds.has(companyId) && selectedIds.size > 1) {
          selectedIds.delete(companyId);
          if (focusId === companyId) focusId = Array.from(selectedIds)[0];
        } else {
          selectedIds.add(companyId);
          focusId = companyId;
        }
        refresh();
      });
      button.addEventListener('dblclick', () => {
        const companyId = button.getAttribute('data-company-id');
        if (!companyId) return;
        selectedIds.clear();
        selectedIds.add(companyId);
        focusId = companyId;
        refresh();
      });
    });
  }

  function renderHeatmap() {
    const target = $('financial-heatmap');
    if (!target) return;
    const rows = metrics.filter(metric => metric.key !== 'totalAssets' || visibleCompanies().some(company => latestValue(company, metric.key) != null));
    const headers = visibleCompanies();
    target.innerHTML = [
      '<table class="financial-heatmap-table">',
      '  <thead>',
      '    <tr>',
      '      <th>指標</th>',
      headers.map(company => `<th>${escapeHtml(company.label || company.serviceName)}</th>`).join(''),
      '    </tr>',
      '  </thead>',
      '  <tbody>',
      rows.map((metric) => [
        '    <tr>',
        `      <th><span>${escapeHtml(metric.label)}</span><small>${escapeHtml(metric.description || '')}</small></th>`,
        headers.map((company) => {
          const value = latestValue(company, metric.key);
          const negativeClass = value != null && value < 0 ? ' is-negative' : '';
          return `<td class="financial-heatmap-cell${negativeClass}" style="background:${heatColor(value, metric.key)}"><strong>${escapeHtml(formatMetricValue(value, metric.key))}</strong><span>${escapeHtml(company.fiscalYearLabel || '')}</span></td>`;
        }).join(''),
        '    </tr>',
      ].join('\n')).join('\n'),
      '  </tbody>',
      '</table>',
    ].join('\n');
  }

  function renderRanking() {
    const target = $('financial-ranking');
    if (!target) return;
    const metric = metricConfig(activeMetric);
    const rows = sortedByMetric(activeMetric);
    const maxAbs = Math.max(...rows.map(company => Math.abs(latestValue(company, activeMetric) || 0)), 1);
    target.innerHTML = [
      `<h3 class="financial-ranking-list__title">${escapeHtml(metric.label)}ランキング</h3>`,
      rows.map((company, index) => {
        const value = latestValue(company, activeMetric);
        const width = Math.max(3, (Math.abs(value || 0) / maxAbs) * 100);
        const negativeClass = value != null && value < 0 ? ' is-negative' : '';
        return [
          `<button type="button" class="financial-ranking-row${company.exchangeId === focusId ? ' is-focused' : ''}" data-ranking-company="${escapeHtml(company.exchangeId)}">`,
          `  <span class="financial-ranking-row__rank">${index + 1}</span>`,
          '  <span class="financial-ranking-row__body">',
          `    <strong>${escapeHtml(company.label || company.serviceName)}</strong>`,
          `    <span class="financial-ranking-track${negativeClass}"><i style="width:${width.toFixed(2)}%"></i></span>`,
          '  </span>',
          `  <span class="financial-ranking-row__value">${escapeHtml(formatMetricValue(value, activeMetric))}</span>`,
          '</button>',
        ].join('\n');
      }).join('\n'),
    ].join('\n');
    target.querySelectorAll('[data-ranking-company]').forEach((button) => {
      button.addEventListener('click', () => setFocus(button.getAttribute('data-ranking-company')));
    });
  }

  function renderSpotlight() {
    const target = $('financial-spotlight');
    const company = companyById(focusId);
    if (!target || !company) return;
    const facts = [
      ['営業収益 / 売上高', formatMetricValue(latestValue(company, 'revenue'), 'revenue')],
      ['営業利益', formatMetricValue(latestValue(company, 'operatingProfit'), 'operatingProfit')],
      ['純利益', formatMetricValue(latestValue(company, 'netIncome'), 'netIncome')],
      ['純資産', formatMetricValue(latestValue(company, 'netAssets'), 'netAssets')],
      ['自己資本比率', formatMetricValue(latestValue(company, 'equityRatio'), 'equityRatio')],
      ['売上成長率', formatMetricValue(latestValue(company, 'revenueYoY'), 'revenueYoY')],
    ];
    target.innerHTML = [
      '<div class="financial-spotlight__header">',
      '  <div>',
      '    <p class="market-insight-card__eyebrow">Focus</p>',
      `    <h3>${escapeHtml(company.label || company.serviceName)}</h3>`,
      `    <p>${escapeHtml(company.companyName || '')}</p>`,
      '  </div>',
      `  <a class="btn btn-secondary financial-spotlight__link" href="${escapeHtml(company.path)}">詳細</a>`,
      '</div>',
      '<dl class="financial-spotlight__facts">',
      facts.map(([label, value]) => [
        '  <div>',
        `    <dt>${escapeHtml(label)}</dt>`,
        `    <dd>${escapeHtml(value)}</dd>`,
        '  </div>',
      ].join('\n')).join('\n'),
      '</dl>',
      '<div class="financial-hero-tags financial-spotlight__tags">',
      (company.tags || []).map(tag => `<span>${escapeHtml(tag)}</span>`).join(''),
      '</div>',
      company.cautions && company.cautions.length > 0 ? [
        '<ol class="financial-spotlight__notes">',
        company.cautions.map(item => `<li>${escapeHtml(item)}</li>`).join(''),
        '</ol>',
      ].join('') : '',
    ].join('\n');
  }

  function updateMetricControls() {
    document.querySelectorAll('[data-financial-metric]').forEach((button) => {
      const active = button.getAttribute('data-financial-metric') === activeMetric;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
    const metric = metricConfig(activeMetric);
    const current = $('financial-current-metric');
    if (current) current.textContent = metric.label;
    const title = $('financial-bar-title');
    if (title) title.textContent = `${metric.label}の横比較`;
    const note = $('financial-bar-note');
    if (note) note.textContent = `${metric.description || '選択中の指標'}を各社の最新開示期で比較します。`;
  }

  function setMetric(metricKey) {
    if (!metricMap.has(metricKey)) return;
    activeMetric = metricKey;
    refresh();
  }

  function setFocus(companyId) {
    if (!companyId || !companyById(companyId)) return;
    focusId = companyId;
    if (!selectedIds.has(companyId)) selectedIds.add(companyId);
    refresh();
  }

  function refresh() {
    if (!selectedIds.has(focusId)) focusId = Array.from(selectedIds)[0] || (companies[0] && companies[0].exchangeId);
    renderCompanyFilter();
    updateMetricControls();
    updateBarChart();
    updateTrendChart();
    updateRadarChart();
    renderHeatmap();
    renderRanking();
    renderSpotlight();
  }

  function initMetricTabs() {
    document.querySelectorAll('[data-financial-metric]').forEach((button) => {
      button.addEventListener('click', () => setMetric(button.getAttribute('data-financial-metric')));
    });
  }

  if (typeof Chart !== 'undefined') {
    Chart.defaults.font.family = '"Inter", "Noto Sans JP", system-ui, sans-serif';
    Chart.defaults.color = chartTextColor();
  }

  initMetricTabs();
  buildBarChart();
  buildTrendChart();
  buildRadarChart();
  refresh();
})();
