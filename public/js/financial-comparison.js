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
  const cryptoAssetBalances = model.cryptoAssetBalances || { entries: [], assetPriority: [], unit: '百万円' };
  const metricMap = new Map(metrics.map(metric => [metric.key, metric]));
  const DEFAULT_VISIBLE_COMPANY_LIMIT = 8;
  const CHART_SERIES_LIMIT = 10;
  const selectedIds = new Set(initialSelectedCompanyIds());
  let activeMetric = 'revenue';
  let activeAssetSymbol = defaultAssetSymbol();
  let focusId = Array.from(selectedIds)[0] || (companies[0] && companies[0].exchangeId);
  let barChart = null;
  let trendChart = null;
  let radarChart = null;
  let currentBarRows = [];
  let heatmapSort = { kind: '', key: '', direction: 'desc' };
  let companyFilterExpanded = false;
  let companyFilterQuery = '';
  let activeTooltipAnchor = null;
  let tooltipNode = null;
  const BENCHMARK_ID = '__financial_benchmark__';

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

  function metricHelpText(metricKey) {
    const metric = metricConfig(metricKey);
    return metric.help || metric.description || `${metric.label}の見方を確認します。`;
  }

  function renderMetricHelp(metric) {
    const help = metricHelpText(metric.key);
    return `<span class="financial-help" data-tooltip="${escapeHtml(help)}" aria-label="${escapeHtml(metric.label)}の説明" role="img" tabindex="0">?</span>`;
  }

  function companySearchText(company) {
    return [
      company.label,
      company.serviceName,
      company.companyName,
      company.fullName,
      company.exchangeId,
    ].filter(Boolean).join(' ').toLowerCase();
  }

  function latestValue(company, metricKey) {
    return numberOrNull(company && company.latest && company.latest[metricKey]);
  }

  function initialSelectedCompanyIds() {
    if (companies.length <= DEFAULT_VISIBLE_COMPANY_LIMIT) {
      return companies.map(company => company.exchangeId);
    }
    return companies
      .slice()
      .filter(company => latestValue(company, 'revenue') != null)
      .sort((a, b) => {
        const aValue = latestValue(a, 'revenue');
        const bValue = latestValue(b, 'revenue');
        if (aValue !== bValue) return bValue - aValue;
        return String(a.label || a.serviceName).localeCompare(String(b.label || b.serviceName));
      })
      .slice(0, DEFAULT_VISIBLE_COMPANY_LIMIT)
      .map(company => company.exchangeId);
  }

  function historyValue(company, row, metricKey, index) {
    const direct = numberOrNull(row && row[metricKey]);
    if (direct != null) return direct;
    const revenue = numberOrNull(row && row.revenue);
    if (metricKey === 'operatingMargin') {
      const operatingProfit = numberOrNull(row && row.operatingProfit);
      return revenue > 0 && operatingProfit != null ? (operatingProfit / revenue) * 100 : null;
    }
    if (metricKey === 'revenueYoY' && index > 0) {
      const previousRevenue = numberOrNull(company.history[index - 1] && company.history[index - 1].revenue);
      return revenue > 0 && previousRevenue > 0 ? ((revenue - previousRevenue) / Math.abs(previousRevenue)) * 100 : null;
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

  function formatAssetValue(value) {
    const numeric = numberOrNull(value);
    if (numeric == null) return '-';
    const digits = Math.abs(numeric) >= 100 ? 0 : Math.abs(numeric) >= 10 ? 1 : 3;
    return `${formatNumber(numeric, digits)}百万円`;
  }

  function formatAssetQuantity(value, unit) {
    const numeric = numberOrNull(value);
    if (numeric == null) return '-';
    const digits = Math.abs(numeric) >= 1000 ? 0 : 3;
    return `${formatNumber(numeric, digits)}${unit ? ` ${unit}` : ''}`;
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

  function findCompanyById(exchangeId) {
    return companies.find(company => company.exchangeId === exchangeId) || null;
  }

  function companyById(exchangeId) {
    return findCompanyById(exchangeId) || companies[0];
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

  function compareNullableValues(aValue, bValue, direction = 'desc') {
    const aMissing = aValue == null;
    const bMissing = bValue == null;
    if (aMissing && bMissing) return 0;
    if (aMissing) return 1;
    if (bMissing) return -1;
    const multiplier = direction === 'asc' ? 1 : -1;
    if (aValue !== bValue) return (aValue - bValue) * multiplier;
    return 0;
  }

  function sortedHeatmapCompanies() {
    const source = visibleCompanies();
    if (heatmapSort.kind !== 'metric' || !metricMap.has(heatmapSort.key)) return source;
    return source.slice().sort((a, b) => {
      const compared = compareNullableValues(
        latestValue(a, heatmapSort.key),
        latestValue(b, heatmapSort.key),
        heatmapSort.direction
      );
      if (compared !== 0) return compared;
      return String(a.label || a.serviceName).localeCompare(String(b.label || b.serviceName));
    });
  }

  function sortedHeatmapMetrics(sourceRows) {
    const company = findCompanyById(heatmapSort.key);
    if (heatmapSort.kind !== 'company' || !company) return sourceRows;
    return sourceRows.slice().sort((a, b) => {
      const compared = compareNullableValues(
        normalizedScore(latestValue(company, a.key), a.key, companies),
        normalizedScore(latestValue(company, b.key), b.key, companies),
        heatmapSort.direction
      );
      if (compared !== 0) return compared;
      return String(a.label).localeCompare(String(b.label));
    });
  }

  function heatmapSortArrow(kind, key) {
    if (heatmapSort.kind !== kind || heatmapSort.key !== key) return '↕';
    return heatmapSort.direction === 'asc' ? '↑' : '↓';
  }

  function toggleHeatmapSort(kind, key) {
    if (!key) return;
    const sameTarget = heatmapSort.kind === kind && heatmapSort.key === key;
    heatmapSort = {
      kind,
      key,
      direction: sameTarget && heatmapSort.direction === 'desc' ? 'asc' : 'desc',
    };
    if (kind === 'metric' && metricMap.has(key)) activeMetric = key;
    if (kind === 'company' && findCompanyById(key)) focusId = key;
    refresh();
  }

  function chartCompanies(metricKey = activeMetric) {
    const source = visibleCompanies();
    if (source.length <= CHART_SERIES_LIMIT) return source;
    const focused = companyById(focusId);
    const picked = new Map();
    if (focused && selectedIds.has(focused.exchangeId) && latestValue(focused, metricKey) != null) {
      picked.set(focused.exchangeId, focused);
    }
    sortedByMetric(metricKey, source).forEach((company) => {
      if (picked.size < CHART_SERIES_LIMIT) picked.set(company.exchangeId, company);
    });
    return Array.from(picked.values());
  }

  function isFeaturedSelection() {
    const featuredIds = initialSelectedCompanyIds();
    if (selectedIds.size !== featuredIds.length) return false;
    return featuredIds.every(companyId => selectedIds.has(companyId));
  }

  function cryptoAssetEntries() {
    return Array.isArray(cryptoAssetBalances.entries) ? cryptoAssetBalances.entries : [];
  }

  function visibleCryptoAssetEntries() {
    return cryptoAssetEntries();
  }

  function findCryptoAssetCompany(entry) {
    return entry && findCompanyById(entry.exchangeId);
  }

  function sortedCryptoAssetSymbols() {
    const priority = Array.isArray(cryptoAssetBalances.assetPriority) ? cryptoAssetBalances.assetPriority : [];
    const symbols = new Set();
    cryptoAssetEntries().forEach((entry) => {
      (entry.assets || []).forEach((asset) => {
        if (asset && asset.symbol && asset.symbol !== 'OTHER') symbols.add(asset.symbol);
      });
    });
    return Array.from(symbols).sort((a, b) => {
      const ai = priority.indexOf(a);
      const bi = priority.indexOf(b);
      if (ai !== -1 || bi !== -1) {
        if (ai === -1) return 1;
        if (bi === -1) return -1;
        return ai - bi;
      }
      return a.localeCompare(b);
    });
  }

  function defaultAssetSymbol() {
    const symbols = sortedCryptoAssetSymbols();
    return symbols.includes('BTC') ? 'BTC' : (symbols[0] || '__total__');
  }

  function assetLabel(symbol) {
    if (symbol === '__total__') return '総暗号資産';
    const entry = cryptoAssetEntries().find(item => (item.assets || []).some(asset => asset.symbol === symbol));
    const asset = entry && (entry.assets || []).find(item => item.symbol === symbol);
    return asset ? `${asset.symbol} / ${asset.name}` : symbol;
  }

  function assetRowForEntry(entry, symbol) {
    if (!entry) return null;
    if (symbol === '__total__') {
      const totals = entry.totals || {};
      return {
        symbol: '__total__',
        name: '総暗号資産',
        customerValueMJPY: totals.customerValueMJPY,
        companyValueMJPY: totals.companyValueMJPY,
        combinedValueMJPY: totals.combinedValueMJPY,
        isTotal: true,
      };
    }
    return (entry.assets || []).find(asset => asset.symbol === symbol) || null;
  }

  function ratioText(companyValue, customerValue) {
    const companyNumber = numberOrNull(companyValue);
    const customerNumber = numberOrNull(customerValue);
    if (companyNumber == null || customerNumber == null || customerNumber <= 0) return '-';
    return `${formatNumber((companyNumber / customerNumber) * 100, 2)}%`;
  }

  function missingAssetText(entry, kind) {
    if (!entry || !entry.coverage) return '未開示';
    if (kind === 'customer' && !entry.coverage.customerByAsset) return '銘柄別未開示';
    if (kind === 'company' && !entry.coverage.companyByAsset) return '銘柄別未開示';
    if (kind === 'combined' && !entry.coverage.combinedByAsset) return '銘柄別未開示';
    return '該当なし';
  }

  function assetValueCell(row, entry, kind) {
    if (!row) return missingAssetText(entry, kind);
    const key = `${kind}ValueMJPY`;
    const value = row[key];
    if (value != null) return formatAssetValue(value);
    if (kind === 'combined') {
      const customerValue = numberOrNull(row.customerValueMJPY);
      const companyValue = numberOrNull(row.companyValueMJPY);
      if (customerValue != null && companyValue != null) return formatAssetValue(customerValue + companyValue);
    }
    if (row.isTotal) return '-';
    return missingAssetText(entry, kind);
  }

  function assetQuantityCell(row) {
    if (!row || row.isTotal) return '-';
    if (row.customerQuantity != null) return formatAssetQuantity(row.customerQuantity, row.quantityUnit);
    if (row.companyQuantity != null) return formatAssetQuantity(row.companyQuantity, row.quantityUnit);
    if (row.combinedQuantity != null) return formatAssetQuantity(row.combinedQuantity, row.quantityUnit);
    return '-';
  }

  function disclosureLabel(entry, row) {
    if (!entry) return '未開示';
    if (row && row.isTotal) return '区分別合計';
    if (!row) return '銘柄別未開示';
    if (row.customerValueMJPY != null && row.companyValueMJPY != null) return '顧客/自己を銘柄別';
    if (row.companyValueMJPY != null) return '自己のみ銘柄別';
    if (row.customerValueMJPY != null) return '顧客のみ銘柄別';
    if (row.combinedValueMJPY != null) return '合計のみ銘柄別';
    return entry.disclosureBasis || '確認中';
  }

  function firstSourceLink(entry) {
    return entry && Array.isArray(entry.sourceLinks) && entry.sourceLinks.length > 0 ? entry.sourceLinks[0] : null;
  }

  function renderAssetBalanceSummary() {
    const target = $('financial-asset-balance-summary');
    if (!target) return;
    const entries = visibleCryptoAssetEntries();
    if (entries.length === 0) {
      target.innerHTML = '<p class="financial-asset-empty">暗号資産の預かり・自己保有データは準備中です。</p>';
      return;
    }
    const customerLeader = entries
      .slice()
      .filter(entry => numberOrNull(entry.totals && entry.totals.customerValueMJPY) != null)
      .sort((a, b) => Number(b.totals.customerValueMJPY) - Number(a.totals.customerValueMJPY))[0];
    const companyLeader = entries
      .slice()
      .filter(entry => numberOrNull(entry.totals && entry.totals.companyValueMJPY) != null)
      .sort((a, b) => Number(b.totals.companyValueMJPY) - Number(a.totals.companyValueMJPY))[0];
    const byAssetCount = entries.filter(entry => (entry.assets || []).length > 0).length;
    const combinedByAssetCount = entries.filter(entry => entry.coverage && entry.coverage.combinedByAsset).length;
    const summaryCards = [
      ['掲載社', `${entries.length}社`, `${byAssetCount}社で銘柄別表あり`],
      ['顧客預かり最大', customerLeader ? (findCryptoAssetCompany(customerLeader) || customerLeader).label || customerLeader.exchangeId : '-', customerLeader ? formatAssetValue(customerLeader.totals.customerValueMJPY) : '-'],
      ['自己保有最大', companyLeader ? (findCryptoAssetCompany(companyLeader) || companyLeader).label || companyLeader.exchangeId : '-', companyLeader ? formatAssetValue(companyLeader.totals.companyValueMJPY) : '-'],
      ['開示粒度', `${combinedByAssetCount}社`, '合計銘柄別まで確認'],
    ];
    target.innerHTML = summaryCards.map(([label, value, meta]) => [
      '<article class="financial-asset-summary-card">',
      `  <span>${escapeHtml(label)}</span>`,
      `  <strong>${escapeHtml(value)}</strong>`,
      `  <small>${escapeHtml(meta)}</small>`,
      '</article>',
    ].join('\n')).join('\n');
  }

  function renderAssetBalanceControls() {
    const target = $('financial-asset-filter');
    if (!target) return;
    const symbols = ['__total__'].concat(sortedCryptoAssetSymbols());
    if (!symbols.includes(activeAssetSymbol)) activeAssetSymbol = symbols[0] || '__total__';
    target.innerHTML = symbols.map((symbol) => [
      `<button type="button" class="financial-asset-chip${symbol === activeAssetSymbol ? ' is-active' : ''}" data-financial-asset="${escapeHtml(symbol)}" aria-pressed="${symbol === activeAssetSymbol ? 'true' : 'false'}">`,
      `  <span>${escapeHtml(symbol === '__total__' ? '総額' : symbol)}</span>`,
      '</button>',
    ].join('')).join('');
    target.querySelectorAll('[data-financial-asset]').forEach((button) => {
      button.addEventListener('click', () => {
        const symbol = button.getAttribute('data-financial-asset');
        if (!symbol) return;
        activeAssetSymbol = symbol;
        renderAssetBalances();
      });
    });
  }

  function renderAssetBalanceTable() {
    const target = $('financial-asset-balance-table');
    if (!target) return;
    const entries = visibleCryptoAssetEntries();
    if (entries.length === 0) {
      target.innerHTML = '<p class="financial-asset-empty">表示できるデータがありません。</p>';
      return;
    }
    const rows = entries
      .map((entry) => {
        const company = findCryptoAssetCompany(entry);
        const row = assetRowForEntry(entry, activeAssetSymbol);
        const source = firstSourceLink(entry);
        const companyLabel = company ? company.label : entry.exchangeId;
        const assetName = row ? `${row.symbol === '__total__' ? '総額' : row.symbol} ${row.name || ''}` : assetLabel(activeAssetSymbol);
        return {
          entry,
          row,
          source,
          companyLabel,
          assetName,
          sortValue: numberOrNull(row && (row.combinedValueMJPY || row.companyValueMJPY || row.customerValueMJPY)) || 0,
        };
      })
      .sort((a, b) => {
        if (a.sortValue !== b.sortValue) return b.sortValue - a.sortValue;
        return String(a.companyLabel).localeCompare(String(b.companyLabel));
      });
    target.innerHTML = [
      '<table class="financial-asset-table">',
      '  <thead>',
      '    <tr>',
      '      <th>取引所</th>',
      '      <th>銘柄</th>',
      '      <th>期末</th>',
      '      <th>顧客預かり</th>',
      '      <th>自己保有</th>',
      '      <th>銘柄合計</th>',
      '      <th>数量</th>',
      '      <th>自己/顧客</th>',
      '      <th>開示粒度</th>',
      '      <th>出典</th>',
      '    </tr>',
      '  </thead>',
      '  <tbody>',
      rows.map(({ entry, row, source, companyLabel, assetName }) => [
        '    <tr>',
        `      <th scope="row"><strong>${escapeHtml(companyLabel)}</strong><span>${escapeHtml(entry.statementName || '')}</span></th>`,
        `      <td data-label="銘柄"><strong>${escapeHtml(assetName)}</strong></td>`,
        `      <td data-label="期末">${escapeHtml(entry.reportingDate || entry.fiscalYearLabel || '')}</td>`,
        `      <td data-label="顧客預かり">${escapeHtml(assetValueCell(row, entry, 'customer'))}</td>`,
        `      <td data-label="自己保有">${escapeHtml(assetValueCell(row, entry, 'company'))}</td>`,
        `      <td data-label="銘柄合計">${escapeHtml(assetValueCell(row, entry, 'combined'))}</td>`,
        `      <td data-label="数量">${escapeHtml(assetQuantityCell(row))}</td>`,
        `      <td data-label="自己/顧客">${escapeHtml(ratioText(row && row.companyValueMJPY, row && row.customerValueMJPY))}</td>`,
        `      <td data-label="開示粒度"><span class="financial-asset-disclosure">${escapeHtml(disclosureLabel(entry, row))}</span></td>`,
        `      <td data-label="出典">${source ? `<a class="table-link" href="${escapeHtml(source.href)}" target="_blank" rel="noopener">${escapeHtml(source.title)}</a>` : '-'}</td>`,
        '    </tr>',
      ].join('\n')).join('\n'),
      '  </tbody>',
      '</table>',
    ].join('\n');
  }

  function renderAssetBalanceNote() {
    const target = $('financial-asset-balance-note');
    if (!target) return;
    const entries = visibleCryptoAssetEntries();
    const notes = new Set();
    entries.forEach((entry) => {
      (entry.notes || []).slice(0, 1).forEach(note => notes.add(note));
    });
    target.textContent = `表示中: ${assetLabel(activeAssetSymbol)}。${Array.from(notes).slice(0, 3).join(' ')}`;
  }

  function renderAssetBalances() {
    renderAssetBalanceSummary();
    renderAssetBalanceControls();
    renderAssetBalanceTable();
    renderAssetBalanceNote();
  }

  function setSelectedCompanies(companyIds) {
    selectedIds.clear();
    companyIds.forEach((companyId) => {
      if (findCompanyById(companyId)) selectedIds.add(companyId);
    });
    if (!selectedIds.has(focusId)) {
      focusId = Array.from(selectedIds)[0] || (companies[0] && companies[0].exchangeId);
    }
    refresh();
  }

  function metricValues(metricKey, source = visibleCompanies()) {
    return source
      .map(company => latestValue(company, metricKey))
      .filter(value => value != null);
  }

  function average(values) {
    const clean = values.filter(value => value != null);
    if (clean.length === 0) return null;
    return clean.reduce((sum, value) => sum + value, 0) / clean.length;
  }

  function averageValue(metricKey, source = companies) {
    return average(source.map(company => latestValue(company, metricKey)));
  }

  function metricValueForChartRow(row, metricKey) {
    if (row && row.isBenchmark) return numberOrNull(row.value);
    return latestValue(row, metricKey);
  }

  function benchmarkRow(metricKey) {
    const value = averageValue(metricKey, companies);
    if (value == null) return null;
    return {
      exchangeId: BENCHMARK_ID,
      label: '掲載社平均',
      serviceName: '掲載社平均',
      fiscalYearLabel: `${companies.length}社平均`,
      value,
      isBenchmark: true,
    };
  }

  function averageHistoryValue(year, metricKey, source = companies) {
    const values = source.map((company) => {
      let value = null;
      company.history.forEach((row, rowIndex) => {
        if (Number(row && row.fiscalYear) === Number(year)) {
          value = historyValue(company, row, metricKey, rowIndex);
        }
      });
      return value;
    });
    return average(values);
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
          const rows = currentBarRows;
          const company = rows[point.index];
          if (company && !company.isBenchmark) setFocus(company.exchangeId);
        },
        scales: {
          x: {
            ticks: {
              color: '#9aa6a1',
              autoSkip: true,
              maxRotation: 0,
              minRotation: 0,
              maxTicksLimit: 5,
              callback: value => compactMetricValue(value, activeMetric),
            },
            grid: { color: chartGridColor() },
          },
          y: {
            ticks: { color: chartTextColor(), font: { size: 11, weight: 800 } },
            grid: { display: false },
          },
        },
        plugins: {
          ...baseChartOptions().plugins,
          legend: { display: false },
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
            ticks: { color: '#9aa6a1', maxTicksLimit: 6 },
            grid: { color: chartGridColor() },
          },
          y: {
            ticks: {
              color: '#9aa6a1',
              autoSkip: true,
              maxRotation: 0,
              minRotation: 0,
              maxTicksLimit: 5,
              callback: value => compactMetricValue(value, activeMetric),
            },
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
    const companyRows = sortedByMetric(activeMetric, chartCompanies(activeMetric));
    const benchmark = benchmarkRow(activeMetric);
    const rows = benchmark ? companyRows.concat(benchmark) : companyRows;
    currentBarRows = rows;
    barChart.data.labels = rows.map(company => company.label || company.serviceName);
    barChart.data.datasets = [{
      label: metric.label,
      data: rows.map(company => metricValueForChartRow(company, activeMetric)),
      backgroundColor: rows.map((company, index) => {
        if (company.isBenchmark) return 'rgba(244, 201, 93, 0.64)';
        const value = metricValueForChartRow(company, activeMetric);
        return value != null && value < 0 ? 'rgba(255, 107, 112, 0.62)' : color(index, 0.72);
      }),
      borderColor: rows.map((company, index) => {
        if (company.isBenchmark) return 'rgba(244, 201, 93, 0.96)';
        const value = metricValueForChartRow(company, activeMetric);
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
    const rows = chartCompanies(activeMetric);
    trendChart.data.labels = years.map(year => String(year));
    const companyDatasets = rows.map((company, index) => {
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
        pointRadius: company.exchangeId === focusId ? 3 : 2,
      };
    });
    const benchmarkDataset = {
      label: '掲載社平均',
      data: years.map(year => averageHistoryValue(year, activeMetric, companies)),
      borderColor: 'rgba(244, 201, 93, 0.95)',
      backgroundColor: 'rgba(244, 201, 93, 0.12)',
      borderDash: [6, 5],
      spanGaps: true,
      tension: 0.28,
      borderWidth: 2,
      pointRadius: 0,
      pointHoverRadius: 4,
    };
    trendChart.data.datasets = companyDatasets.concat(benchmarkDataset);
    trendChart.options.scales.y.ticks.callback = value => compactMetricValue(value, activeMetric);
    trendChart.update();
  }

  function radarScoresFor(company) {
    const radarMetrics = ['revenue', 'operatingProfit', 'netIncome', 'netAssets', 'equityRatio', 'revenueYoY'];
    return radarMetrics.map(metricKey => normalizedScore(latestValue(company, metricKey), metricKey, companies) || 0);
  }

  function averageRadarScores() {
    const source = companies;
    if (source.length === 0) return [];
    const radarMetrics = ['revenue', 'operatingProfit', 'netIncome', 'netAssets', 'equityRatio', 'revenueYoY'];
    return radarMetrics.map((metricKey) => {
      const scores = source.map(company => normalizedScore(latestValue(company, metricKey), metricKey, companies)).filter(value => value != null);
      if (scores.length === 0) return 0;
      return scores.reduce((sum, value) => sum + value, 0) / scores.length;
    });
  }

  function radarCompanies() {
    const selected = visibleCompanies();
    if (selected.length === 0) return [];
    const picked = new Map();
    const focused = findCompanyById(focusId);
    if (focused && selectedIds.has(focused.exchangeId)) picked.set(focused.exchangeId, focused);
    sortedByMetric(activeMetric, selected).forEach((company) => {
      if (picked.size < 3) picked.set(company.exchangeId, company);
    });
    selected.forEach((company) => {
      if (picked.size < 3) picked.set(company.exchangeId, company);
    });
    return Array.from(picked.values());
  }

  function updateRadarChart() {
    if (!radarChart) return;
    const rows = radarCompanies();
    const labels = ['収益規模', '営業利益', '純利益', '純資産', '自己資本', '成長率'];
    radarChart.data.labels = labels;
    radarChart.data.datasets = rows.map((company, index) => ({
      label: company.label || company.serviceName,
      data: radarScoresFor(company),
      borderColor: color(index, 0.95),
      backgroundColor: color(index, 0.13),
      pointBackgroundColor: color(index, 0.95),
      borderWidth: company.exchangeId === focusId ? 3 : 2,
    })).concat({
      label: '掲載社平均',
      data: averageRadarScores(),
      borderColor: 'rgba(244, 201, 93, 0.92)',
      backgroundColor: 'rgba(244, 201, 93, 0.10)',
      pointBackgroundColor: 'rgba(244, 201, 93, 0.92)',
      borderDash: [5, 4],
      borderWidth: 2,
    });
    const note = $('financial-radar-note');
    if (note) {
      const labelsText = rows.map(company => company.label || company.serviceName).join('、');
      note.textContent = `${labelsText || '選択中の会社'} と掲載社平均を最大3社で比較します。`;
    }
    radarChart.update();
  }

  function renderCompanyFilter() {
    const target = $('financial-company-filter');
    if (!target) return;
    const featuredLabel = companies.length > DEFAULT_VISIBLE_COMPANY_LIMIT
      ? `主要${DEFAULT_VISIBLE_COMPANY_LIMIT}社`
      : '全社';
    const actionButtons = [
      `<button type="button" class="financial-company-chip financial-company-chip--action${isFeaturedSelection() ? ' is-active' : ''}" data-company-action="featured" aria-pressed="${isFeaturedSelection() ? 'true' : 'false'}">${escapeHtml(featuredLabel)}</button>`,
      `<button type="button" class="financial-company-chip financial-company-chip--action${selectedIds.size === companies.length ? ' is-active' : ''}" data-company-action="all" aria-pressed="${selectedIds.size === companies.length ? 'true' : 'false'}">全社</button>`,
      `<span class="financial-company-filter__count" aria-live="polite">${escapeHtml(String(selectedIds.size))}/${escapeHtml(String(companies.length))}</span>`,
    ];
    const companyButtons = companies.map((company) => {
      const active = selectedIds.has(company.exchangeId);
      const focused = company.exchangeId === focusId;
      return [
        `<button type="button" class="financial-company-chip${active ? ' is-active' : ''}${focused ? ' is-focused' : ''}" data-company-id="${escapeHtml(company.exchangeId)}" data-company-search="${escapeHtml(companySearchText(company))}" aria-pressed="${active ? 'true' : 'false'}">`,
        '  <span class="financial-company-chip__check" aria-hidden="true">✓</span>',
        `  <span>${escapeHtml(company.label || company.serviceName)}</span>`,
        '</button>',
      ].join('');
    });
    target.innerHTML = [
      '<div class="financial-company-filter__quick">',
      actionButtons.join(''),
      '</div>',
      `<details class="financial-company-customizer"${companyFilterExpanded ? ' open' : ''}>`,
      '  <summary>',
      '    <span>カスタマイズ</span>',
      '    <small>個別に選ぶ</small>',
      '  </summary>',
      '  <div class="financial-company-search">',
      '    <label class="sr-only" for="financial-company-search-input">会社名で絞り込み</label>',
      `    <input id="financial-company-search-input" type="search" value="${escapeHtml(companyFilterQuery)}" placeholder="会社名で絞り込み" autocomplete="off">`,
      '  </div>',
      '  <div class="financial-company-chip-list">',
      companyButtons.join(''),
      '  </div>',
      '</details>',
    ].join('');

    const details = target.querySelector('.financial-company-customizer');
    if (details) {
      details.addEventListener('toggle', () => {
        companyFilterExpanded = details.open;
      });
    }

    const searchInput = target.querySelector('#financial-company-search-input');
    const applySearch = () => {
      const query = companyFilterQuery.trim().toLowerCase();
      target.querySelectorAll('[data-company-id]').forEach((button) => {
        const haystack = button.getAttribute('data-company-search') || '';
        button.hidden = Boolean(query) && !haystack.includes(query);
      });
    };
    if (searchInput) {
      searchInput.addEventListener('input', () => {
        companyFilterQuery = searchInput.value;
        applySearch();
      });
    }
    applySearch();

    target.querySelectorAll('[data-company-action]').forEach((button) => {
      button.addEventListener('click', () => {
        const action = button.getAttribute('data-company-action');
        if (action === 'all') {
          setSelectedCompanies(companies.map(company => company.exchangeId));
        } else {
          setSelectedCompanies(initialSelectedCompanyIds());
        }
      });
    });

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
    const rows = sortedHeatmapMetrics(metrics.filter(metric => metric.key !== 'totalAssets' || visibleCompanies().some(company => latestValue(company, metric.key) != null)));
    const headers = sortedHeatmapCompanies();
    target.innerHTML = [
      '<table class="financial-heatmap-table">',
      '  <thead>',
      '    <tr>',
      '      <th>指標</th>',
      headers.map((company) => {
        const active = heatmapSort.kind === 'company' && heatmapSort.key === company.exchangeId;
        const arrow = heatmapSortArrow('company', company.exchangeId);
        return [
          '<th>',
          `  <button type="button" class="financial-heatmap-company-sort${active ? ' is-active' : ''}" data-heatmap-company-sort="${escapeHtml(company.exchangeId)}" aria-label="${escapeHtml(company.label || company.serviceName)}の強い指標順に並び替え">`,
          `    <span>${escapeHtml(company.label || company.serviceName)}</span>`,
          `    <span class="financial-heatmap-sort__arrow" aria-hidden="true">${escapeHtml(arrow)}</span>`,
          '  </button>',
          '</th>',
        ].join('');
      }).join(''),
      '<th class="financial-heatmap-benchmark-head">掲載社平均</th>',
      '    </tr>',
      '  </thead>',
      '  <tbody>',
      rows.map((metric) => [
        '    <tr>',
        '      <th scope="row">',
        '        <span class="financial-heatmap-metric-line">',
        `          <button type="button" class="financial-heatmap-sort${heatmapSort.kind === 'metric' && heatmapSort.key === metric.key ? ' is-active' : ''}" data-heatmap-metric-sort="${escapeHtml(metric.key)}" aria-label="${escapeHtml(metric.label)}で取引所を並び替え">`,
        `            <span>${escapeHtml(metric.label)}</span>`,
        `            <span class="financial-heatmap-sort__arrow" aria-hidden="true">${escapeHtml(heatmapSortArrow('metric', metric.key))}</span>`,
        '          </button>',
        `          ${renderMetricHelp(metric)}`,
        '        </span>',
        `        <small>${escapeHtml(metric.description || '')}</small>`,
        '      </th>',
        headers.map((company) => {
          const value = latestValue(company, metric.key);
          const negativeClass = value != null && value < 0 ? ' is-negative' : '';
          return `<td class="financial-heatmap-cell${negativeClass}" data-company="${escapeHtml(company.label || company.serviceName)}" style="background:${heatColor(value, metric.key)}"><strong>${escapeHtml(formatMetricValue(value, metric.key))}</strong><span>${escapeHtml(company.fiscalYearLabel || '')}</span></td>`;
        }).join(''),
        (() => {
          const value = averageValue(metric.key, companies);
          const negativeClass = value != null && value < 0 ? ' is-negative' : '';
          return `<td class="financial-heatmap-cell financial-heatmap-cell--benchmark${negativeClass}" data-company="掲載社平均" style="background:${heatColor(value, metric.key)}"><strong>${escapeHtml(formatMetricValue(value, metric.key))}</strong><span>${escapeHtml(companies.length)}社平均</span></td>`;
        })(),
        '    </tr>',
      ].join('\n')).join('\n'),
      '  </tbody>',
      '</table>',
    ].join('\n');
    target.querySelectorAll('[data-heatmap-metric-sort]').forEach((button) => {
      button.addEventListener('click', () => toggleHeatmapSort('metric', button.getAttribute('data-heatmap-metric-sort')));
    });
    target.querySelectorAll('[data-heatmap-company-sort]').forEach((button) => {
      button.addEventListener('click', () => toggleHeatmapSort('company', button.getAttribute('data-heatmap-company-sort')));
    });
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

  function ensureTooltipNode() {
    if (tooltipNode) return tooltipNode;
    tooltipNode = document.createElement('div');
    tooltipNode.id = 'financial-tooltip';
    tooltipNode.className = 'financial-tooltip';
    tooltipNode.setAttribute('role', 'tooltip');
    document.body.appendChild(tooltipNode);
    return tooltipNode;
  }

  function positionTooltip(anchor) {
    const tooltip = ensureTooltipNode();
    const rect = anchor.getBoundingClientRect();
    const margin = 12;
    const gap = 10;
    const tooltipWidth = tooltip.offsetWidth;
    const tooltipHeight = tooltip.offsetHeight;
    let left = rect.left + (rect.width / 2) - (tooltipWidth / 2);
    let top = rect.top - tooltipHeight - gap;

    if (top < margin) top = rect.bottom + gap;
    left = Math.max(margin, Math.min(left, window.innerWidth - tooltipWidth - margin));
    top = Math.max(margin, Math.min(top, window.innerHeight - tooltipHeight - margin));

    tooltip.style.left = `${left}px`;
    tooltip.style.top = `${top}px`;
  }

  function showTooltip(anchor) {
    const text = anchor && anchor.getAttribute('data-tooltip');
    if (!text) return;
    const tooltip = ensureTooltipNode();
    activeTooltipAnchor = anchor;
    tooltip.textContent = text;
    tooltip.classList.add('is-visible');
    anchor.setAttribute('aria-describedby', tooltip.id);
    positionTooltip(anchor);
  }

  function hideTooltip(anchor) {
    if (anchor && activeTooltipAnchor && anchor !== activeTooltipAnchor) return;
    if (activeTooltipAnchor) activeTooltipAnchor.removeAttribute('aria-describedby');
    activeTooltipAnchor = null;
    if (tooltipNode) tooltipNode.classList.remove('is-visible');
  }

  function initFinancialTooltips() {
    document.addEventListener('pointerover', (event) => {
      const anchor = event.target.closest && event.target.closest('.financial-help');
      if (!anchor || (event.relatedTarget && anchor.contains(event.relatedTarget))) return;
      showTooltip(anchor);
    });

    document.addEventListener('pointerout', (event) => {
      const anchor = event.target.closest && event.target.closest('.financial-help');
      if (!anchor || (event.relatedTarget && anchor.contains(event.relatedTarget))) return;
      hideTooltip(anchor);
    });

    document.addEventListener('mouseover', (event) => {
      const anchor = event.target.closest && event.target.closest('.financial-help');
      if (!anchor || (event.relatedTarget && anchor.contains(event.relatedTarget))) return;
      showTooltip(anchor);
    });

    document.addEventListener('mouseout', (event) => {
      const anchor = event.target.closest && event.target.closest('.financial-help');
      if (!anchor || (event.relatedTarget && anchor.contains(event.relatedTarget))) return;
      hideTooltip(anchor);
    });

    document.addEventListener('focusin', (event) => {
      const anchor = event.target.closest && event.target.closest('.financial-help');
      if (anchor) showTooltip(anchor);
    });

    document.addEventListener('focusout', (event) => {
      const anchor = event.target.closest && event.target.closest('.financial-help');
      if (anchor) hideTooltip(anchor);
    });

    document.addEventListener('click', (event) => {
      const anchor = event.target.closest && event.target.closest('.financial-help');
      if (!anchor) {
        hideTooltip();
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      showTooltip(anchor);
    }, true);

    window.addEventListener('scroll', () => {
      if (activeTooltipAnchor) positionTooltip(activeTooltipAnchor);
    }, { passive: true });

    window.addEventListener('resize', () => {
      if (activeTooltipAnchor) positionTooltip(activeTooltipAnchor);
    });
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
    if (note) {
      const selectedCount = visibleCompanies().length;
      const chartCount = chartCompanies(activeMetric).length;
      const subset = selectedCount > chartCount ? ` グラフは表示中${selectedCount}社のうち上位${chartCount}社に絞っています。` : '';
      note.textContent = `${metric.description || '選択中の指標'}を各社の最新開示期で比較します。掲載社平均もベンチマークとして表示します。${subset}`;
    }
  }

  function setMetric(metricKey) {
    if (!metricMap.has(metricKey)) return;
    activeMetric = metricKey;
    refresh();
  }

  function setFocus(companyId) {
    if (!companyId || !findCompanyById(companyId)) return;
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
    renderAssetBalances();
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
  initFinancialTooltips();
  buildBarChart();
  buildTrendChart();
  buildRadarChart();
  refresh();
})();
