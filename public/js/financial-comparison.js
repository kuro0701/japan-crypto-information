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
  const THEME_STORAGE_KEY = 'okj.theme.v1';
  const DEFAULT_VISIBLE_COMPANY_LIMIT = 8;
  const CHART_SERIES_LIMIT = 10;
  const selectedIds = new Set(initialSelectedCompanyIds());
  let activeMetric = 'revenue';
  let activeMetricGroup = 'pl';
  let activeShapeMode = 'bs';
  let activeAssetSymbol = defaultAssetSymbol();
  let focusId = Array.from(selectedIds)[0] || (companies[0] && companies[0].exchangeId);
  let barChart = null;
  let trendChart = null;
  let radarChart = null;
  let currentBarRows = [];
  let heatmapSort = { kind: '', key: '', direction: 'desc' };
  let companyFilterExpanded = false;
  let companyFilterQuery = '';
  let assetFilterExpanded = !(window.matchMedia && window.matchMedia('(max-width: 767px)').matches);
  let activeTooltipAnchor = null;
  let tooltipNode = null;
  const BENCHMARK_ID = '__financial_benchmark__';
  const metricGroups = [
    { key: 'pl', label: 'PL', metricKeys: ['revenue', 'operatingProfit', 'netIncome'] },
    { key: 'bs', label: 'BS', metricKeys: ['netAssets', 'totalAssets', 'equityRatio'] },
    { key: 'ratio', label: '利益率', metricKeys: ['operatingMargin'] },
    { key: 'growth', label: '成長率', metricKeys: ['revenueYoY'] },
  ];
  const financialGroupKeywords = [
    'SBI',
    'GMO',
    '楽天',
    'マネックス',
    '野村',
    '東海東京',
    'フィナンシャル',
    '金融',
    '証券',
    'PayPay',
    'bitFlyer Holdings',
    'Digital Garage',
    '東京短資',
    '三井物産',
    '日本取引所グループ',
  ];
  const independentPresetIds = new Set(['bitbank', 'gaia-btm']);

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

  function readStoredTheme() {
    try {
      return localStorage.getItem(THEME_STORAGE_KEY) === 'light' ? 'light' : 'dark';
    } catch (_err) {
      return document.documentElement.classList.contains('theme-light') ? 'light' : 'dark';
    }
  }

  function writeStoredTheme(theme) {
    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch (_err) {
      // noop
    }
  }

  function syncTheme(theme) {
    const isLight = theme === 'light';
    document.documentElement.classList.toggle('theme-light', isLight);
    document.body.classList.toggle('theme-light', isLight);
    document.querySelectorAll('[data-theme-toggle]').forEach((button) => {
      const icon = button.querySelector('[data-theme-toggle-icon]');
      const label = button.querySelector('[data-theme-toggle-label]');
      button.setAttribute('aria-pressed', isLight ? 'true' : 'false');
      button.setAttribute('aria-label', isLight ? 'ダークモードに切り替え' : 'ライトモードに切り替え');
      if (icon) icon.textContent = isLight ? '☾' : '☀';
      if (label) label.textContent = isLight ? 'ダーク' : 'ライト';
    });
    syncChartTheme();
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

  function cssVar(name, fallback) {
    const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return value || fallback;
  }

  function numberOrNull(value) {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : null;
  }

  function metricConfig(metricKey) {
    return metricMap.get(metricKey) || metrics[0];
  }

  function metricGroupFor(metricKey) {
    return metricGroups.find(group => group.metricKeys.includes(metricKey)) || metricGroups[0];
  }

  function activeMetricGroupConfig() {
    return metricGroups.find(group => group.key === activeMetricGroup) || metricGroups[0];
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

  function companyDescriptor(company) {
    return [
      company.label,
      company.serviceName,
      company.companyName,
      company.parentCompany,
      company.sourceSummary,
      ...(company.tags || []),
    ].filter(Boolean).join(' ');
  }

  function isFinancialGroupCompany(company) {
    const descriptor = companyDescriptor(company);
    return financialGroupKeywords.some(keyword => descriptor.includes(keyword));
  }

  function presetCompanyIds(action) {
    if (action === 'all') return companies.map(company => company.exchangeId);
    if (action === 'clear') return [];
    if (action === 'finance') return companies.filter(isFinancialGroupCompany).map(company => company.exchangeId);
    if (action === 'independent') return companies.filter(company => independentPresetIds.has(company.exchangeId)).map(company => company.exchangeId);
    return initialSelectedCompanyIds();
  }

  function fiscalCautionText(company) {
    if (!company) return '';
    const label = String(company.fiscalYearLabel || '');
    const period = String(company.latest && company.latest.fiscalPeriod || '');
    const monthMatch = period.match(/\/(\d{1,2})$/);
    const month = monthMatch ? Number(monthMatch[1]) : null;
    const durationMatch = label.match(/（([^）]*(?:か月|ヶ月)[^）]*)）/);
    if (durationMatch) {
      return `${label}は${durationMatch[1]}の変則決算です。12か月決算の会社と単純比較しすぎないよう注意します。`;
    }
    if (month && month !== 3) {
      return `${label}です。3月決算の会社とは対象期間がずれるため、直近期比較では期末月の違いも確認します。`;
    }
    return '';
  }

  function renderFiscalCautionBadge(company) {
    const text = fiscalCautionText(company);
    if (!text) return '';
    return `<span class="financial-fiscal-badge financial-tooltip-trigger" data-tooltip="${escapeHtml(text)}" tabindex="0">決算期注意</span>`;
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

  function assetDisplayName(row, symbol = activeAssetSymbol) {
    if (row && row.symbol === '__total__') return '総額';
    if (row && row.symbol) return `${row.symbol}${row.name ? ` / ${row.name}` : ''}`;
    return assetLabel(symbol);
  }

  function assetValueFor(row, kind) {
    if (!row) return null;
    return numberOrNull(row[`${kind}ValueMJPY`]);
  }

  function assetCombinedValue(row) {
    if (!row) return null;
    const combined = numberOrNull(row.combinedValueMJPY);
    if (combined != null) return combined;
    const customer = assetValueFor(row, 'customer');
    const company = assetValueFor(row, 'company');
    if (customer != null && company != null) return customer + company;
    return null;
  }

  function isFullAssetDisclosureRow(row) {
    if (!row) return false;
    return assetValueFor(row, 'customer') != null && assetValueFor(row, 'company') != null;
  }

  function assetButterflyRows() {
    return visibleCryptoAssetEntries()
      .map((entry) => {
        const row = assetRowForEntry(entry, activeAssetSymbol);
        const customerValue = assetValueFor(row, 'customer');
        const companyValue = assetValueFor(row, 'company');
        const company = findCryptoAssetCompany(entry);
        const companyLabel = company ? company.label : entry.exchangeId;
        return {
          entry,
          row,
          company,
          companyLabel,
          customerValue,
          companyValue,
          combinedValue: assetCombinedValue(row),
          source: firstSourceLink(entry),
        };
      })
      .filter(item => isFullAssetDisclosureRow(item.row))
      .sort((a, b) => {
        const aTotal = (a.customerValue || 0) + (a.companyValue || 0);
        const bTotal = (b.customerValue || 0) + (b.companyValue || 0);
        if (aTotal !== bTotal) return bTotal - aTotal;
        return String(a.companyLabel).localeCompare(String(b.companyLabel));
      });
  }

  function hiddenAssetDisclosureRows() {
    const primaryIds = new Set(assetButterflyRows().map(item => item.entry.exchangeId));
    return visibleCryptoAssetEntries()
      .filter(entry => !primaryIds.has(entry.exchangeId))
      .map((entry) => {
        const row = assetRowForEntry(entry, activeAssetSymbol);
        const company = findCryptoAssetCompany(entry);
        const companyLabel = company ? company.label : entry.exchangeId;
        const customerValue = assetValueFor(row, 'customer');
        const companyValue = assetValueFor(row, 'company');
        const combinedValue = assetCombinedValue(row);
        let status = '銘柄別未開示';
        let value = null;
        if (row && row.isTotal) {
          status = '区分別合計';
          value = combinedValue;
        } else if (row && row.combinedValueMJPY != null) {
          status = '銘柄合計のみ';
          value = combinedValue;
        } else if (row && companyValue != null) {
          status = '自己のみ銘柄別';
          value = companyValue;
        } else if (row && customerValue != null) {
          status = '顧客のみ銘柄別';
          value = customerValue;
        } else if (entry.totals && (entry.totals.combinedValueMJPY != null || entry.totals.customerValueMJPY != null || entry.totals.companyValueMJPY != null)) {
          value = numberOrNull(entry.totals.combinedValueMJPY)
            || [entry.totals.customerValueMJPY, entry.totals.companyValueMJPY].map(numberOrNull).filter(item => item != null).reduce((sum, item) => sum + item, 0);
        }
        return {
          entry,
          row,
          company,
          companyLabel,
          status,
          value,
          source: firstSourceLink(entry),
        };
      })
      .sort((a, b) => {
        const aValue = numberOrNull(a.value) || 0;
        const bValue = numberOrNull(b.value) || 0;
        if (aValue !== bValue) return bValue - aValue;
        return String(a.companyLabel).localeCompare(String(b.companyLabel));
      });
  }

  function assetDisclosureCounts() {
    const primaryCount = assetButterflyRows().length;
    const hiddenCount = hiddenAssetDisclosureRows().length;
    return { primaryCount, hiddenCount };
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
    const rows = assetButterflyRows();
    const hiddenRows = hiddenAssetDisclosureRows();
    const customerLeader = rows
      .slice()
      .sort((a, b) => (b.customerValue || 0) - (a.customerValue || 0))[0];
    const ratioLeader = rows
      .slice()
      .filter(item => item.customerValue > 0 && item.companyValue != null)
      .sort((a, b) => (b.companyValue / b.customerValue) - (a.companyValue / a.customerValue))[0];
    const summaryCards = [
      ['ミラー表示', `${rows.length}社`, `${assetLabel(activeAssetSymbol)}を顧客/自己で銘柄別開示`],
      ['顧客預かり最大', customerLeader ? customerLeader.companyLabel : '-', customerLeader ? formatAssetValue(customerLeader.customerValue) : '-'],
      ['自己/顧客比率', ratioLeader ? ratioLeader.companyLabel : '-', ratioLeader ? ratioText(ratioLeader.companyValue, ratioLeader.customerValue) : '-'],
      ['退避した開示', `${hiddenRows.length}社`, '未開示・片側開示・合計のみ'],
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
    target.innerHTML = [
      `<details class="financial-asset-filter-panel"${assetFilterExpanded ? ' open' : ''}>`,
      '  <summary>',
      '    <span>暗号資産を選ぶ</span>',
      `    <small>${escapeHtml(assetLabel(activeAssetSymbol))}</small>`,
      '  </summary>',
      '  <div class="financial-asset-filter__chips">',
      symbols.map((symbol) => [
        `<button type="button" class="financial-asset-chip${symbol === activeAssetSymbol ? ' is-active' : ''}" data-financial-asset="${escapeHtml(symbol)}" aria-pressed="${symbol === activeAssetSymbol ? 'true' : 'false'}">`,
        `  <span>${escapeHtml(symbol === '__total__' ? '総額' : symbol)}</span>`,
        '</button>',
      ].join('')).join(''),
      '  </div>',
      '</details>',
    ].join('\n');
    const details = target.querySelector('.financial-asset-filter-panel');
    if (details) {
      details.addEventListener('toggle', () => {
        assetFilterExpanded = details.open;
      });
    }
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

  function barWidthPercent(value, maxValue) {
    const numeric = numberOrNull(value);
    if (numeric == null || numeric <= 0 || !maxValue) return 0;
    return Math.max(2.5, Math.min(100, (numeric / maxValue) * 100));
  }

  function renderAssetDisclosureDrawer(rows) {
    if (!rows.length) {
      return '<p class="financial-asset-empty">この銘柄は、表示中の掲載社すべてで顧客/自己の銘柄別内訳を確認できます。</p>';
    }
    const label = assetLabel(activeAssetSymbol);
    return [
      '<details class="financial-asset-disclosure-drawer">',
      '  <summary>',
      `    <span>${escapeHtml(label)}の銘柄別内訳が揃っていない取引所</span>`,
      `    <strong>${escapeHtml(String(rows.length))}社</strong>`,
      '  </summary>',
      '  <div class="financial-asset-disclosure-list">',
      rows.map(({ entry, row, companyLabel, status, value, source }) => [
        '<article class="financial-asset-disclosure-row">',
        '  <div>',
        `    <strong>${escapeHtml(companyLabel)}</strong>`,
        `    <span>${escapeHtml(entry.reportingDate || entry.fiscalYearLabel || '')}</span>`,
        '  </div>',
        `  <span class="financial-asset-disclosure">${escapeHtml(status)}</span>`,
        `  <span class="financial-asset-disclosure-row__value">${escapeHtml(value == null ? (row ? '-' : '総額のみ') : formatAssetValue(value))}</span>`,
        source ? `  <a class="table-link" href="${escapeHtml(source.href)}" target="_blank" rel="noopener">${escapeHtml(source.title)}</a>` : '  <span class="financial-asset-disclosure-row__source">-</span>',
        '</article>',
      ].join('\n')).join('\n'),
      '  </div>',
      '</details>',
    ].join('\n');
  }

  function renderAssetButterflyChart() {
    const target = $('financial-asset-balance-table');
    if (!target) return;
    const rows = assetButterflyRows();
    const hiddenRows = hiddenAssetDisclosureRows();
    if (rows.length === 0) {
      target.innerHTML = [
        '<div class="financial-asset-butterfly financial-asset-butterfly--empty">',
        `  <p class="financial-asset-empty">${escapeHtml(assetLabel(activeAssetSymbol))}は、顧客預かりと自己保有の銘柄別内訳を両方確認できる掲載社がありません。</p>`,
        '</div>',
        renderAssetDisclosureDrawer(hiddenRows),
      ].join('\n');
      return;
    }
    const maxSideValue = Math.max(...rows.flatMap(item => [item.customerValue || 0, item.companyValue || 0]), 1);
    const leader = rows[0];
    target.innerHTML = [
      '<div class="financial-asset-butterfly" role="group" aria-label="顧客預かり暗号資産と自己保有暗号資産の左右対比グラフ">',
      '  <div class="financial-asset-butterfly__head">',
      '    <span>顧客預かり</span>',
      `    <strong>${escapeHtml(assetLabel(activeAssetSymbol))}</strong>`,
      '    <span>自己保有</span>',
      '  </div>',
      '  <div class="financial-asset-butterfly__rows">',
      rows.map(({ entry, row, companyLabel, customerValue, companyValue, source }) => {
        const customerWidth = barWidthPercent(customerValue, maxSideValue);
        const companyWidth = barWidthPercent(companyValue, maxSideValue);
        return [
          '<article class="financial-asset-butterfly-row">',
          '  <div class="financial-asset-butterfly-row__company">',
          `    <strong>${escapeHtml(companyLabel)}</strong>`,
          `    <span>${escapeHtml(entry.reportingDate || entry.fiscalYearLabel || '')}</span>`,
          '  </div>',
          '  <div class="financial-asset-butterfly-side financial-asset-butterfly-side--customer">',
          `    <span class="financial-asset-butterfly-bar financial-asset-butterfly-bar--customer" style="--asset-bar-width:${customerWidth.toFixed(2)}%">`,
          `      <b>${escapeHtml(formatAssetValue(customerValue))}</b>`,
          '    </span>',
          '  </div>',
          '  <div class="financial-asset-butterfly-axis" aria-hidden="true"></div>',
          '  <div class="financial-asset-butterfly-side financial-asset-butterfly-side--company">',
          `    <span class="financial-asset-butterfly-bar financial-asset-butterfly-bar--company" style="--asset-bar-width:${companyWidth.toFixed(2)}%">`,
          `      <b>${escapeHtml(formatAssetValue(companyValue))}</b>`,
          '    </span>',
          '  </div>',
          '  <div class="financial-asset-butterfly-row__ratio">',
          `    <strong>${escapeHtml(ratioText(companyValue, customerValue))}</strong>`,
          '    <span>自己/顧客</span>',
          '  </div>',
          '  <div class="financial-asset-butterfly-row__meta">',
          `    <span>${escapeHtml(assetDisplayName(row))}</span>`,
          source ? `    <a class="table-link" href="${escapeHtml(source.href)}" target="_blank" rel="noopener">${escapeHtml(source.title)}</a>` : '',
          '  </div>',
          '</article>',
        ].join('\n');
      }).join('\n'),
      '  </div>',
      leader ? `  <p class="financial-asset-butterfly__caption">最大値は${escapeHtml(leader.companyLabel)}の顧客預かり ${escapeHtml(formatAssetValue(leader.customerValue))}。左右のバーは同じ金額スケールです。</p>` : '',
      '</div>',
      renderAssetDisclosureDrawer(hiddenRows),
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
    const counts = assetDisclosureCounts();
    target.textContent = `表示中: ${assetLabel(activeAssetSymbol)}。ミラーチャートは顧客預かり・自己保有を同じ銘柄単位で確認できる${counts.primaryCount}社のみ。未開示・片側開示の${counts.hiddenCount}社は下部に格納しています。${Array.from(notes).slice(0, 2).join(' ')}`;
  }

  function renderAssetBalances() {
    renderAssetBalanceSummary();
    renderAssetBalanceControls();
    renderAssetButterflyChart();
    renderAssetBalanceNote();
  }

  function setSelectedCompanies(companyIds) {
    selectedIds.clear();
    companyIds.forEach((companyId) => {
      if (findCompanyById(companyId)) selectedIds.add(companyId);
    });
    if (selectedIds.size === 0) {
      focusId = null;
    } else if (!selectedIds.has(focusId)) {
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
    if (numeric == null) return 'rgba(154, 166, 161, 0.06)';
    const values = metricValues(metricKey, companies);
    if (numeric < 0) {
      const maxNegative = Math.max(...values.filter(item => item < 0).map(item => Math.abs(item)), Math.abs(numeric), 1);
      const intensity = 0.2 + (Math.abs(numeric) / maxNegative) * 0.5;
      return `linear-gradient(135deg, rgba(255, 107, 112, ${intensity}), rgba(255, 107, 112, ${Math.max(0.1, intensity * 0.42)}))`;
    }
    const score = normalizedScore(numeric, metricKey, companies) || 0;
    const intensity = 0.14 + (score / 100) * 0.52;
    const metric = metricConfig(metricKey);
    const toneColor = metric.tone === 'scale' || metric.key === 'totalAssets'
      ? '53, 200, 210'
      : '53, 224, 165';
    return `linear-gradient(135deg, rgba(${toneColor}, ${intensity}), rgba(${toneColor}, ${Math.max(0.08, intensity * 0.38)}))`;
  }

  function chartTextColor() {
    return cssVar('--text-2', '#c9d3cd');
  }

  function chartMutedColor() {
    return cssVar('--text-3', '#9aa6a1');
  }

  function chartGridColor() {
    return document.documentElement.classList.contains('theme-light')
      ? 'rgba(16, 46, 38, 0.12)'
      : 'rgba(200, 220, 210, 0.09)';
  }

  function syncChartTheme() {
    if (typeof Chart === 'undefined') return;
    Chart.defaults.color = chartTextColor();
    const textColor = chartTextColor();
    const mutedColor = chartMutedColor();
    const gridColor = chartGridColor();

    if (barChart) {
      barChart.options.scales.x.ticks.color = mutedColor;
      barChart.options.scales.y.ticks.color = textColor;
      barChart.options.scales.x.grid.color = gridColor;
      barChart.update('none');
    }
    if (trendChart) {
      trendChart.options.scales.x.ticks.color = mutedColor;
      trendChart.options.scales.y.ticks.color = mutedColor;
      trendChart.options.scales.x.grid.color = gridColor;
      trendChart.options.scales.y.grid.color = gridColor;
      trendChart.update('none');
    }
    if (radarChart) {
      radarChart.options.scales.r.pointLabels.color = textColor;
      radarChart.options.scales.r.grid.color = gridColor;
      radarChart.options.scales.r.angleLines.color = gridColor;
      radarChart.update('none');
    }
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
              color: chartMutedColor(),
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
            ticks: { color: chartMutedColor(), maxTicksLimit: 6 },
            grid: { color: chartGridColor() },
          },
          y: {
            ticks: {
              color: chartMutedColor(),
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

  function shapeCompanies() {
    const source = companies;
    const metricKey = activeShapeMode === 'bs' ? 'totalAssets' : 'revenue';
    const sortable = sortedByMetric(metricKey, source);
    const fallback = source.filter(company => !sortable.some(item => item.exchangeId === company.exchangeId));
    return sortable.concat(fallback);
  }

  function percentValue(value, total) {
    const numeric = numberOrNull(value);
    const base = numberOrNull(total);
    if (numeric == null || base == null || base <= 0) return 0;
    return Math.max(0, Math.min(100, (numeric / base) * 100));
  }

  function renderBalanceShapeCard(company, maxTotalAssets) {
    const totalAssets = latestValue(company, 'totalAssets');
    const netAssets = latestValue(company, 'netAssets');
    const liabilities = totalAssets != null && netAssets != null ? Math.max(0, totalAssets - netAssets) : null;
    const shapeScale = totalAssets != null && maxTotalAssets > 0 ? Math.max(0, totalAssets / maxTotalAssets) : 0;
    const sideScale = shapeScale > 0 ? Math.sqrt(shapeScale) : 0;
    const widthPct = Math.max(3.5, sideScale * 100);
    const heightPx = Math.max(18, sideScale * 246);
    const equityPct = percentValue(netAssets, totalAssets);
    const liabilityPct = liabilities != null ? Math.max(0, 100 - equityPct) : 0;
    return [
      '<article class="financial-shape-card">',
      '  <div class="financial-shape-card__head">',
      `    <strong>${escapeHtml(company.label || company.serviceName)}</strong>`,
      `    ${renderFiscalCautionBadge(company)}`,
      '  </div>',
      `  <div class="financial-shape-box financial-shape-box--bs" style="--shape-scale:${shapeScale.toFixed(5)}; --shape-width:${widthPct.toFixed(2)}%; --shape-height:${heightPx.toFixed(2)}px; --liability-pct:${liabilityPct.toFixed(2)}%; --equity-pct:${equityPct.toFixed(2)}%">`,
      totalAssets == null ? '    <span class="financial-shape-box__empty">総資産未開示</span>' : [
        '    <span class="financial-shape-box__value">',
        '      <b>総資産</b>',
        `      <small>${escapeHtml(compactMetricValue(totalAssets, 'totalAssets'))}</small>`,
        '    </span>',
        '    <span class="financial-shape-segment financial-shape-segment--liability">',
        '      <b>負債</b>',
        `      <small>${escapeHtml(formatMetricValue(liabilities, 'totalAssets'))}</small>`,
        '    </span>',
        '    <span class="financial-shape-segment financial-shape-segment--equity">',
        '      <b>純資産</b>',
        `      <small>${escapeHtml(formatMetricValue(netAssets, 'netAssets'))}</small>`,
        '    </span>',
      ].join('\n'),
      '  </div>',
      '  <dl class="financial-shape-card__facts">',
      `    <div><dt>総資産</dt><dd>${escapeHtml(formatMetricValue(totalAssets, 'totalAssets'))}</dd></div>`,
      `    <div><dt>自己資本比率</dt><dd>${escapeHtml(formatMetricValue(latestValue(company, 'equityRatio'), 'equityRatio'))}</dd></div>`,
      '  </dl>',
      '</article>',
    ].join('\n');
  }

  function renderProfitShapeCard(company, maxRevenue) {
    const revenue = latestValue(company, 'revenue');
    const operatingProfit = latestValue(company, 'operatingProfit');
    const positiveProfit = operatingProfit != null ? Math.max(0, operatingProfit) : null;
    const operatingCost = revenue != null && operatingProfit != null ? Math.max(0, revenue - operatingProfit) : null;
    const loss = operatingProfit != null ? Math.max(0, Math.abs(Math.min(0, operatingProfit))) : null;
    const revenueBase = revenue != null && revenue > 0 ? revenue : null;
    const shapeScale = revenueBase != null && maxRevenue > 0 ? Math.max(0, revenueBase / maxRevenue) : 0;
    const sideScale = shapeScale > 0 ? Math.sqrt(shapeScale) : 0;
    const widthPct = Math.max(3.5, sideScale * 100);
    const heightPx = Math.max(18, sideScale * 246);
    const profitPct = percentValue(positiveProfit, revenue);
    const lossPct = revenue != null && revenue > 0 && loss != null ? Math.min(42, Math.max(10, (loss / revenue) * 100)) : 0;
    const costPct = operatingCost != null
      ? Math.max(0, 100 - (operatingProfit != null && operatingProfit < 0 ? lossPct : profitPct))
      : 0;
    return [
      '<article class="financial-shape-card">',
      '  <div class="financial-shape-card__head">',
      `    <strong>${escapeHtml(company.label || company.serviceName)}</strong>`,
      `    ${renderFiscalCautionBadge(company)}`,
      '  </div>',
      `  <div class="financial-shape-box financial-shape-box--pl${operatingProfit != null && operatingProfit < 0 ? ' is-loss' : ''}" style="--shape-scale:${shapeScale.toFixed(5)}; --shape-width:${widthPct.toFixed(2)}%; --shape-height:${heightPx.toFixed(2)}px; --cost-pct:${costPct.toFixed(2)}%; --profit-pct:${profitPct.toFixed(2)}%; --loss-pct:${lossPct.toFixed(2)}%">`,
      revenue == null || revenue <= 0 ? `    <span class="financial-shape-box__empty">${escapeHtml(revenue == null ? '売上未開示' : '営業収益がマイナス')}</span>` : [
        '    <span class="financial-shape-box__value">',
        '      <b>営業収益</b>',
        `      <small>${escapeHtml(compactMetricValue(revenue, 'revenue'))}</small>`,
        '    </span>',
        '    <span class="financial-shape-segment financial-shape-segment--cost">',
        '      <b>費用</b>',
        `      <small>${escapeHtml(operatingCost == null ? '-' : formatMetricValue(operatingCost, 'revenue'))}</small>`,
        '    </span>',
        operatingProfit != null && operatingProfit >= 0 ? [
          '    <span class="financial-shape-segment financial-shape-segment--profit">',
          '      <b>営業益</b>',
          `      <small>${escapeHtml(formatMetricValue(operatingProfit, 'operatingProfit'))}</small>`,
          '    </span>',
        ].join('\n') : [
          '    <span class="financial-shape-segment financial-shape-segment--loss">',
          '      <b>営業損失</b>',
          `      <small>${escapeHtml(formatMetricValue(operatingProfit, 'operatingProfit'))}</small>`,
          '    </span>',
        ].join('\n'),
      ].join('\n'),
      '  </div>',
      '  <dl class="financial-shape-card__facts">',
      `    <div><dt>営業収益</dt><dd>${escapeHtml(formatMetricValue(revenue, 'revenue'))}</dd></div>`,
      `    <div><dt>営業利益率</dt><dd>${escapeHtml(formatMetricValue(latestValue(company, 'operatingMargin'), 'operatingMargin'))}</dd></div>`,
      '  </dl>',
      '</article>',
    ].join('\n');
  }

  function renderShapeComparison() {
    const target = $('financial-shape-comparison');
    if (!target) return;
    target.classList.add('is-morphing');
    const rows = shapeCompanies();
    const modeLabel = activeShapeMode === 'bs' ? 'B/Sボックス' : 'P/Lボックス';
    if (rows.length === 0) {
      target.innerHTML = '<p class="financial-shape-empty">会社を選択すると、財務諸表を面積と比率で比較できます。</p>';
    } else if (activeShapeMode === 'bs') {
      const maxTotalAssets = Math.max(...rows.map(company => latestValue(company, 'totalAssets') || 0), 1);
      const leader = rows.find(company => (latestValue(company, 'totalAssets') || 0) === maxTotalAssets);
      target.innerHTML = [
        '<div class="financial-shape-scale-guide">',
        '  <span><b>面積</b>総資産</span>',
        '  <span><b>ゴールド</b>純資産</span>',
        leader ? `  <span><b>最大</b>${escapeHtml(leader.label || leader.serviceName)} ${escapeHtml(compactMetricValue(maxTotalAssets, 'totalAssets'))}</span>` : '',
        '</div>',
        '<div class="financial-shape-board">',
        rows.map(company => renderBalanceShapeCard(company, maxTotalAssets)).join('\n'),
        '</div>',
      ].join('\n');
    } else {
      const maxRevenue = Math.max(...rows.map(company => Math.max(0, latestValue(company, 'revenue') || 0)), 1);
      const leader = rows.find(company => Math.max(0, latestValue(company, 'revenue') || 0) === maxRevenue);
      target.innerHTML = [
        '<div class="financial-shape-scale-guide">',
        '  <span><b>面積</b>営業収益</span>',
        '  <span><b>ゴールド</b>営業利益</span>',
        leader ? `  <span><b>最大</b>${escapeHtml(leader.label || leader.serviceName)} ${escapeHtml(compactMetricValue(maxRevenue, 'revenue'))}</span>` : '',
        '</div>',
        '<div class="financial-shape-board">',
        rows.map(company => renderProfitShapeCard(company, maxRevenue)).join('\n'),
        '</div>',
      ].join('\n');
    }
    window.requestAnimationFrame(() => {
      target.classList.remove('is-morphing');
    });
    const note = $('financial-shape-note');
    if (note) {
      const basisText = activeShapeMode === 'bs'
        ? '総資産の面積と、純資産のゴールド厚みを同時に見ます。'
        : '営業収益の面積と、営業利益のゴールド厚みを同時に見ます。';
      note.textContent = `${modeLabel}で、掲載${companies.length}社全体の${basisText}面積は掲載社全体の最大値を100として相対表示しています。`;
    }
    document.querySelectorAll('[data-financial-shape-mode]').forEach((button) => {
      const active = button.getAttribute('data-financial-shape-mode') === activeShapeMode;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
  }

  function renderCompanyFilter() {
    const target = $('financial-company-filter');
    if (!target) return;
    const featuredLabel = companies.length > DEFAULT_VISIBLE_COMPANY_LIMIT
      ? `主要${DEFAULT_VISIBLE_COMPANY_LIMIT}社`
      : '全社';
    const financePresetIds = presetCompanyIds('finance');
    const independentIds = presetCompanyIds('independent');
    const isPresetSelection = presetIds => presetIds.length > 0
      && selectedIds.size === presetIds.length
      && presetIds.every(companyId => selectedIds.has(companyId));
    const actionButtons = [
      `<button type="button" class="financial-company-chip financial-company-chip--action${isFeaturedSelection() ? ' is-active' : ''}" data-company-action="featured" aria-pressed="${isFeaturedSelection() ? 'true' : 'false'}">${escapeHtml(featuredLabel)}</button>`,
      `<button type="button" class="financial-company-chip financial-company-chip--action${selectedIds.size === companies.length ? ' is-active' : ''}" data-company-action="all" aria-pressed="${selectedIds.size === companies.length ? 'true' : 'false'}">全社</button>`,
      `<button type="button" class="financial-company-chip financial-company-chip--action${isPresetSelection(financePresetIds) ? ' is-active' : ''}" data-company-action="finance" aria-pressed="${isPresetSelection(financePresetIds) ? 'true' : 'false'}">金融グループ</button>`,
      `<button type="button" class="financial-company-chip financial-company-chip--action${isPresetSelection(independentIds) ? ' is-active' : ''}" data-company-action="independent" aria-pressed="${isPresetSelection(independentIds) ? 'true' : 'false'}">独立系</button>`,
      `<button type="button" class="financial-company-chip financial-company-chip--action${selectedIds.size === 0 ? ' is-active' : ''}" data-company-action="clear" aria-pressed="${selectedIds.size === 0 ? 'true' : 'false'}">解除</button>`,
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
        setSelectedCompanies(presetCompanyIds(action));
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
    const rows = sortedHeatmapCompanies();
    const headers = sortedHeatmapMetrics(metrics.filter(metric => metric.key !== 'totalAssets' || visibleCompanies().some(company => latestValue(company, metric.key) != null)));
    target.innerHTML = [
      '<table class="financial-heatmap-table">',
      '  <thead>',
      '    <tr>',
      '      <th>取引所</th>',
      headers.map((metric) => {
        const active = heatmapSort.kind === 'metric' && heatmapSort.key === metric.key;
        const arrow = heatmapSortArrow('metric', metric.key);
        return [
          '<th>',
          `  <button type="button" class="financial-heatmap-sort${active ? ' is-active' : ''}" data-heatmap-metric-sort="${escapeHtml(metric.key)}" aria-label="${escapeHtml(metric.label)}で取引所を並び替え">`,
          `    <span>${escapeHtml(metric.shortLabel || metric.label)}</span>`,
          `    <span class="financial-heatmap-sort__arrow" aria-hidden="true">${escapeHtml(arrow)}</span>`,
          '  </button>',
          `  <small>${escapeHtml(metric.description || '')}</small>`,
          '</th>',
        ].join('');
      }).join(''),
      '    </tr>',
      '  </thead>',
      '  <tbody>',
      rows.map((company) => [
        '    <tr>',
        '      <th scope="row">',
        '        <span class="financial-heatmap-metric-line">',
        `          <button type="button" class="financial-heatmap-company-sort${heatmapSort.kind === 'company' && heatmapSort.key === company.exchangeId ? ' is-active' : ''}" data-heatmap-company-sort="${escapeHtml(company.exchangeId)}" aria-label="${escapeHtml(company.label || company.serviceName)}の強い指標順に並び替え">`,
        `            <span>${escapeHtml(company.label || company.serviceName)}</span>`,
        `            <span class="financial-heatmap-sort__arrow" aria-hidden="true">${escapeHtml(heatmapSortArrow('company', company.exchangeId))}</span>`,
        '          </button>',
        `          ${renderFiscalCautionBadge(company)}`,
        '        </span>',
        `        <small>${escapeHtml(company.fiscalYearLabel || '')}</small>`,
        '      </th>',
        headers.map((metric) => {
          const value = latestValue(company, metric.key);
          const negativeClass = value != null && value < 0 ? ' is-negative' : '';
          return `<td class="financial-heatmap-cell${negativeClass}" data-label="${escapeHtml(metric.label)}" style="background:${heatColor(value, metric.key)}"><strong>${escapeHtml(formatMetricValue(value, metric.key))}</strong><span>${escapeHtml(metric.description || '')}</span></td>`;
        }).join(''),
        '    </tr>',
      ].join('\n')).join('\n'),
      headers.length > 0 ? [
        '    <tr class="financial-heatmap-benchmark-row">',
        '      <th scope="row"><span class="financial-heatmap-metric-line"><span class="financial-heatmap-benchmark-label">掲載社平均</span></span><small>全掲載社ベンチマーク</small></th>',
        headers.map((metric) => {
          const value = averageValue(metric.key, companies);
          const negativeClass = value != null && value < 0 ? ' is-negative' : '';
          return `<td class="financial-heatmap-cell financial-heatmap-cell--benchmark${negativeClass}" data-label="${escapeHtml(metric.label)}" style="background:${heatColor(value, metric.key)}"><strong>${escapeHtml(formatMetricValue(value, metric.key))}</strong><span>${escapeHtml(companies.length)}社平均</span></td>`;
        }).join(''),
        '    </tr>',
      ].join('\n') : '',
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
    const company = findCompanyById(focusId);
    if (!target) return;
    if (!company || !selectedIds.has(company.exchangeId)) {
      target.innerHTML = [
        '<div class="financial-spotlight__empty">',
        '  <p class="market-insight-card__eyebrow">Focus</p>',
        '  <h3>会社を選択してください</h3>',
        '  <p>会社フィルターで1社以上を選ぶと、ここに財務サマリーと注意点を表示します。</p>',
        '</div>',
      ].join('\n');
      return;
    }
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
      `    <h3>${escapeHtml(company.label || company.serviceName)}${renderFiscalCautionBadge(company)}</h3>`,
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
    const tooltipSelector = '.financial-help, .financial-tooltip-trigger';
    document.addEventListener('pointerover', (event) => {
      const anchor = event.target.closest && event.target.closest(tooltipSelector);
      if (!anchor || (event.relatedTarget && anchor.contains(event.relatedTarget))) return;
      showTooltip(anchor);
    });

    document.addEventListener('pointerout', (event) => {
      const anchor = event.target.closest && event.target.closest(tooltipSelector);
      if (!anchor || (event.relatedTarget && anchor.contains(event.relatedTarget))) return;
      hideTooltip(anchor);
    });

    document.addEventListener('mouseover', (event) => {
      const anchor = event.target.closest && event.target.closest(tooltipSelector);
      if (!anchor || (event.relatedTarget && anchor.contains(event.relatedTarget))) return;
      showTooltip(anchor);
    });

    document.addEventListener('mouseout', (event) => {
      const anchor = event.target.closest && event.target.closest(tooltipSelector);
      if (!anchor || (event.relatedTarget && anchor.contains(event.relatedTarget))) return;
      hideTooltip(anchor);
    });

    document.addEventListener('focusin', (event) => {
      const anchor = event.target.closest && event.target.closest(tooltipSelector);
      if (anchor) showTooltip(anchor);
    });

    document.addEventListener('focusout', (event) => {
      const anchor = event.target.closest && event.target.closest(tooltipSelector);
      if (anchor) hideTooltip(anchor);
    });

    document.addEventListener('click', (event) => {
      const anchor = event.target.closest && event.target.closest(tooltipSelector);
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
    const activeGroup = activeMetricGroupConfig();
    if (!activeGroup.metricKeys.includes(activeMetric)) {
      activeMetric = activeGroup.metricKeys.find(metricKey => metricMap.has(metricKey)) || activeMetric;
    }
    document.querySelectorAll('[data-financial-metric-group]').forEach((button) => {
      const active = button.getAttribute('data-financial-metric-group') === activeMetricGroup;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
    document.querySelectorAll('[data-financial-metric]').forEach((button) => {
      const metricKey = button.getAttribute('data-financial-metric');
      const visible = activeGroup.metricKeys.includes(metricKey);
      const active = metricKey === activeMetric;
      button.hidden = !visible;
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
    activeMetricGroup = metricGroupFor(metricKey).key;
    refresh();
  }

  function setMetricGroup(groupKey) {
    const group = metricGroups.find(item => item.key === groupKey);
    if (!group) return;
    activeMetricGroup = group.key;
    if (!group.metricKeys.includes(activeMetric)) {
      activeMetric = group.metricKeys.find(metricKey => metricMap.has(metricKey)) || activeMetric;
    }
    refresh();
  }

  function setShapeMode(mode) {
    if (mode !== 'bs' && mode !== 'pl') return;
    activeShapeMode = mode;
    renderShapeComparison();
  }

  function setFocus(companyId) {
    if (!companyId || !findCompanyById(companyId)) return;
    focusId = companyId;
    if (!selectedIds.has(companyId)) selectedIds.add(companyId);
    refresh();
  }

  function refresh() {
    if (selectedIds.size === 0) {
      focusId = null;
    } else if (!selectedIds.has(focusId)) {
      focusId = Array.from(selectedIds)[0] || (companies[0] && companies[0].exchangeId);
    }
    renderCompanyFilter();
    updateMetricControls();
    updateBarChart();
    updateTrendChart();
    updateRadarChart();
    renderShapeComparison();
    renderHeatmap();
    renderRanking();
    renderSpotlight();
    renderAssetBalances();
  }

  function initMetricGroups() {
    document.querySelectorAll('[data-financial-metric-group]').forEach((button) => {
      button.addEventListener('click', () => setMetricGroup(button.getAttribute('data-financial-metric-group')));
    });
  }

  function initMetricTabs() {
    document.querySelectorAll('[data-financial-metric]').forEach((button) => {
      button.addEventListener('click', () => setMetric(button.getAttribute('data-financial-metric')));
    });
  }

  function initShapeModeControls() {
    document.querySelectorAll('[data-financial-shape-mode]').forEach((button) => {
      button.addEventListener('click', () => setShapeMode(button.getAttribute('data-financial-shape-mode')));
    });
  }

  if (typeof Chart !== 'undefined') {
    Chart.defaults.font.family = '"Inter", "Noto Sans JP", system-ui, sans-serif';
    Chart.defaults.color = chartTextColor();
  }

  initThemeToggle();
  initMetricGroups();
  initMetricTabs();
  initShapeModeControls();
  initFinancialTooltips();
  buildBarChart();
  buildTrendChart();
  buildRadarChart();
  refresh();
})();
