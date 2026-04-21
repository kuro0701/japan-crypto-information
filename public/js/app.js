document.addEventListener('DOMContentLoaded', () => {
  const ws = new WSClient();
  let latestDepthData = null;
  let latestMidPrice = null;
  let autoUpdate = true;
  let lastComparisonParams = null;
  let comparisonRefreshTimer = null;
  let comparisonAbortController = null;
  let salesReferenceAbortController = null;
  let lastSimulationResult = null;
  let lastVenueComparisonData = null;
  let lastSalesReferenceData = null;
  const COMPARISON_REFRESH_MS = 10000;
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
  const copyShareUrlBtn = document.getElementById('copy-share-url-btn');
  const shareUrlStatus = document.getElementById('share-url-status');
  const marketPageNavLink = document.getElementById('market-page-nav-link');
  const favoriteMarketList = document.getElementById('favorite-market-list');
  const saveFavoriteBtn = document.getElementById('save-favorite-btn');
  const clearSettingsBtn = document.getElementById('clear-settings-btn');
  const settingsSaveStatus = document.getElementById('settings-save-status');
  const alertTypeSelect = document.getElementById('alert-type');
  const alertThresholdInput = document.getElementById('alert-threshold');
  const alertHelp = document.getElementById('alert-help');
  const addAlertBtn = document.getElementById('add-alert-btn');
  const refreshAlertsBtn = document.getElementById('refresh-alerts-btn');
  const alertTbody = document.getElementById('alert-tbody');
  const autoUpdateCheck = document.getElementById('auto-update');
  const amountUnit = document.getElementById('amount-unit');
  const SETTINGS_STORAGE_KEY = 'okj.simulatorSettings.v1';
  const FAVORITE_MARKETS_STORAGE_KEY = 'okj.favoriteMarkets.v1';
  const ALERT_STORAGE_KEY = 'okj.localAlerts.v1';
  const MAX_FAVORITE_MARKETS = 8;
  const ALERT_REFRESH_MS = 60000;
  let exchangeListLoaded = false;
  let initialUrlStateConsumed = false;
  let initialSimulationRun = false;
  let shareStatusTimer = null;
  let localAlerts = [];
  let alertRefreshTimer = null;
  let alertRefreshRunning = false;
  let lastAlertRefreshAt = null;
  let favoriteMarkets = [];
  let settingsStatusTimer = null;

  const parseNumberInput = (value) => parseFloat(String(value || '').replace(/,/g, ''));
  const formatNumberParam = (value) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? String(Number(parsed.toPrecision(12))) : null;
  };
  const escapeHtml = (value) => String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
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
  const normalizeAmountType = (value) => {
    const normalized = String(value || '').toLowerCase();
    if (normalized === 'jpy') return 'jpy';
    if (normalized === 'base' || normalized === 'btc') return 'base';
    return null;
  };
  const normalizeSide = (value) => {
    const normalized = String(value || '').toLowerCase();
    return normalized === 'sell' ? 'sell' : normalized === 'buy' ? 'buy' : null;
  };
  const normalizeInstrumentId = (value) => String(value || '').trim().toUpperCase();
  const normalizeExchangeId = (value) => String(value || '').trim().toLowerCase();

  function storageGet(key, fallback) {
    try {
      const value = localStorage.getItem(key);
      return value == null ? fallback : JSON.parse(value);
    } catch (_) {
      return fallback;
    }
  }

  function storageSet(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (_) {
      return false;
    }
  }

  function storageRemove(key) {
    try {
      localStorage.removeItem(key);
      return true;
    } catch (_) {
      return false;
    }
  }

  function normalizeFeeRatePct(value) {
    const parsed = parseNumberInput(value);
    return Number.isFinite(parsed) && parsed >= 0 && parsed <= 100 ? parsed : null;
  }

  function readSavedSettings() {
    const raw = storageGet(SETTINGS_STORAGE_KEY, {});
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};

    return {
      exchangeId: normalizeExchangeId(raw.exchangeId),
      instrumentId: normalizeInstrumentId(raw.instrumentId),
      side: normalizeSide(raw.side),
      amountType: normalizeAmountType(raw.amountType),
      feeRatePct: normalizeFeeRatePct(raw.feeRatePct),
    };
  }

  function normalizeFavoriteMarket(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const exchangeId = normalizeExchangeId(raw.exchangeId);
    const instrumentId = normalizeInstrumentId(raw.instrumentId);
    if (!exchangeId || !instrumentId) return null;

    return {
      exchangeId,
      instrumentId,
      exchangeLabel: String(raw.exchangeLabel || exchangeId),
      instrumentLabel: String(raw.instrumentLabel || instrumentId),
      baseCurrency: String(raw.baseCurrency || instrumentId.split('-')[0] || ''),
      quoteCurrency: String(raw.quoteCurrency || instrumentId.split('-')[1] || 'JPY'),
      savedAt: raw.savedAt || new Date().toISOString(),
    };
  }

  function readFavoriteMarkets() {
    const raw = storageGet(FAVORITE_MARKETS_STORAGE_KEY, []);
    if (!Array.isArray(raw)) return [];

    const seen = new Set();
    const favorites = [];
    for (const item of raw) {
      const favorite = normalizeFavoriteMarket(item);
      if (!favorite) continue;
      const key = favoriteKey(favorite.exchangeId, favorite.instrumentId);
      if (seen.has(key)) continue;
      seen.add(key);
      favorites.push(favorite);
    }
    return favorites.slice(0, MAX_FAVORITE_MARKETS);
  }

  function readUrlState() {
    const params = new URLSearchParams(window.location.search);
    const amount = parseNumberInput(params.get('amount'));
    const feeRatePct = parseNumberInput(params.get('feeRatePct') ?? params.get('feeRate'));
    const feeRateDecimal = parseNumberInput(params.get('feeRateDecimal'));

    return {
      exchangeId: normalizeExchangeId(params.get('exchange') || params.get('exchangeId')),
      instrumentId: normalizeInstrumentId(params.get('market') || params.get('instrument') || params.get('instrumentId')),
      side: normalizeSide(params.get('side')),
      amountType: normalizeAmountType(params.get('amountType')),
      amount: Number.isFinite(amount) && amount > 0 ? amount : null,
      feeRatePct: Number.isFinite(feeRatePct) && feeRatePct >= 0 && feeRatePct <= 100
        ? feeRatePct
        : (Number.isFinite(feeRateDecimal) && feeRateDecimal >= 0 && feeRateDecimal <= 1 ? feeRateDecimal * 100 : null),
      hasExchange: params.has('exchange') || params.has('exchangeId'),
      hasInstrument: params.has('market') || params.has('instrument') || params.has('instrumentId'),
      hasSide: params.has('side'),
      hasAmountType: params.has('amountType'),
      hasAmount: params.has('amount'),
      hasFeeRate: params.has('feeRatePct') || params.has('feeRate') || params.has('feeRateDecimal'),
    };
  }

  const initialUrlState = readUrlState();
  const savedSettings = readSavedSettings();
  const shouldRunInitialSimulation = initialUrlState.amount != null;

  function setShareStatus(message) {
    if (!shareUrlStatus) return;
    shareUrlStatus.textContent = message || '';
    if (shareStatusTimer) clearTimeout(shareStatusTimer);
    if (message) {
      shareStatusTimer = setTimeout(() => {
        shareUrlStatus.textContent = '';
      }, 2400);
    }
  }

  function ensureButtonDefaultLabel(button) {
    if (!button) return '';
    if (!button.dataset.defaultLabel) {
      button.dataset.defaultLabel = (button.textContent || '').trim();
    }
    return button.dataset.defaultLabel;
  }

  function resetButtonLabel(button) {
    if (!button) return;
    const defaultLabel = ensureButtonDefaultLabel(button);
    if (button.__labelTimer) clearTimeout(button.__labelTimer);
    button.disabled = false;
    button.textContent = defaultLabel;
  }

  function flashButtonLabel(button, label, duration = 1800) {
    if (!button) return;
    ensureButtonDefaultLabel(button);
    if (button.__labelTimer) clearTimeout(button.__labelTimer);
    button.disabled = false;
    button.textContent = label;
    button.__labelTimer = setTimeout(() => {
      button.textContent = button.dataset.defaultLabel;
    }, duration);
  }

  async function runExportAction(button, action) {
    if (!button) return;
    ensureButtonDefaultLabel(button);
    if (button.__labelTimer) clearTimeout(button.__labelTimer);
    button.disabled = true;
    button.textContent = '出力中...';
    try {
      const outcome = await action();
      flashButtonLabel(button, outcome === 'shared' ? '共有しました' : '保存しました');
    } catch (err) {
      if (err && err.name === 'AbortError') {
        resetButtonLabel(button);
        return;
      }
      console.warn('Export failed:', err);
      flashButtonLabel(button, '失敗', 2400);
    }
  }

  function safeFilenamePart(value) {
    return String(value || '')
      .trim()
      .replace(/[^A-Za-z0-9_-]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '') || 'export';
  }

  function exportTimestamp(date = new Date()) {
    const pad = (value) => String(value).padStart(2, '0');
    return [
      date.getFullYear(),
      pad(date.getMonth() + 1),
      pad(date.getDate()),
      '-',
      pad(date.getHours()),
      pad(date.getMinutes()),
      pad(date.getSeconds()),
    ].join('');
  }

  function exportBaseFilename(prefix) {
    const exchange = getSelectedExchange();
    const market = getSelectedMarket(exchange);
    const side = normalizeSide(sideSelect && sideSelect.value) || 'buy';
    return [
      safeFilenamePart(prefix),
      safeFilenamePart(market && market.instrumentId),
      safeFilenamePart(exchange && exchange.id),
      safeFilenamePart(side),
      exportTimestamp(),
    ].join('-');
  }

  function csvEscape(value) {
    if (value == null) return '';
    const normalized = value instanceof Date ? value.toISOString() : String(value);
    return /[",\r\n]/.test(normalized)
      ? `"${normalized.replace(/"/g, '""')}"`
      : normalized;
  }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function downloadCsv(filename, rows) {
    const content = `\uFEFF${rows.map(row => row.map(csvEscape).join(',')).join('\r\n')}`;
    downloadBlob(new Blob([content], { type: 'text/csv;charset=utf-8;' }), filename);
    return 'saved';
  }

  function exportTargetTitle(kind) {
    return {
      simulation: 'シミュレーション結果',
      'venue-comparison': '取引所横断コスト比較',
      'sales-reference': '販売所参考コスト比較',
    }[kind] || 'エクスポート';
  }

  function exportTargetElement(kind) {
    return {
      simulation: document.getElementById('simulation-export-panel'),
      'venue-comparison': document.getElementById('venue-comparison-panel'),
      'sales-reference': document.getElementById('sales-reference-panel'),
    }[kind] || null;
  }

  function simulationCsvRows(result) {
    const exchange = getSelectedExchange();
    const market = getSelectedMarket(exchange);
    const rows = [[
      'section',
      'key',
      'label',
      'value',
      'index',
      'price_jpy',
      'quantity_base',
      'subtotal_jpy',
      'cumulative_base',
      'cumulative_jpy',
      'cumulative_impact_pct',
      'orders',
      'note',
    ]];
    const pushSummary = (key, label, value, note = '') => {
      rows.push(['summary', key, label, value, '', '', '', '', '', '', '', '', note]);
    };

    pushSummary('generated_at', '生成日時', new Date().toISOString());
    pushSummary('exchange_id', '取引所ID', exchange && exchange.id);
    pushSummary('exchange', '取引所', exchange && exchange.label);
    pushSummary('instrument_id', '銘柄ID', market && market.instrumentId);
    pushSummary('instrument', '銘柄', market && market.label);
    pushSummary('side', '売買', result.side === 'sell' ? 'sell' : 'buy');
    pushSummary('amount_type', '入力タイプ', result.amountType);
    pushSummary('requested_amount', '注文数量/金額', result.requestedAmount);
    pushSummary('execution_status', '発注判定', result.executionStatus, result.executionStatusLabel || '');
    pushSummary('recommended_action', '推奨アクション', result.recommendedAction);
    pushSummary('book_timestamp', '板タイムスタンプ', result.bookTimestamp);
    pushSummary('mid_price_jpy', '仲値', result.midPrice);
    pushSummary('best_bid_jpy', '最良Bid', result.bestBid);
    pushSummary('best_ask_jpy', '最良Ask', result.bestAsk);
    pushSummary('spread_jpy', 'スプレッド', result.spread, result.spreadPct);
    pushSummary('filled_base', '約定数量', result.totalBTCFilled, UI.market.baseCurrency);
    pushSummary('filled_quote_jpy', result.side === 'buy' ? '支払総額' : '受取総額', result.totalJPYSpent, 'JPY');
    pushSummary('vwap_jpy', 'VWAP', result.vwap, 'JPY');
    pushSummary('worst_price_jpy', '最悪約定価格', result.worstPrice, 'JPY');
    pushSummary('effective_cost_jpy', result.side === 'buy' ? '手数料込み実効コスト' : '手数料込み実効受取額', result.effectiveCostJPY, 'JPY');
    pushSummary('effective_vwap_jpy', '実効VWAP', result.effectiveVWAP, 'JPY');
    pushSummary('fees_jpy', '手数料', result.feesJPY, `feeRatePct=${result.feeRatePct}`);
    pushSummary('slippage_from_best_pct', 'Best比スリッページ(%)', result.slippageFromBestPct);
    pushSummary('slippage_from_mid_pct', 'Mid比スリッページ(%)', result.slippageFromMidPct);
    pushSummary('market_impact_pct', 'マーケットインパクト(%)', result.marketImpactPct);
    pushSummary('levels_consumed', '消費レベル数', result.levelsConsumed, `totalLevels=${result.totalLevelsAvailable}`);
    pushSummary('orders_consumed', '消費注文数', result.ordersConsumed);
    pushSummary('remaining_liquidity_base', '残存流動性', result.remainingLiquidityBTC, UI.market.baseCurrency);
    pushSummary('remaining_liquidity_jpy', '残存流動性(JPY)', result.remainingLiquidityJPY, 'JPY');
    pushSummary('insufficient', '流動性不足', result.insufficient ? 'true' : 'false');
    pushSummary('shortfall_base', '不足数量', result.shortfallBTC, UI.market.baseCurrency);
    pushSummary('shortfall_jpy', '不足金額', result.shortfallJPY, 'JPY');

    (result.fills || []).forEach((fill, index) => {
      rows.push([
        'fills',
        '',
        '',
        '',
        index + 1,
        fill.price,
        fill.quantity,
        fill.subtotalJPY,
        fill.cumulativeBTC,
        fill.cumulativeJPY,
        fill.cumulativeImpactPct,
        fill.orders,
        fill.fullyConsumed ? 'fully_consumed' : 'partial_fill',
      ]);
    });

    return rows;
  }

  function venueComparisonCsvRows(data) {
    const meta = data && data.meta ? data.meta : {};
    const rows = [[
      'instrument_id',
      'instrument',
      'side',
      'amount_type',
      'amount',
      'fee_rate_pct',
      'generated_at',
      'rank',
      'exchange_id',
      'exchange',
      'status',
      'status_label',
      'source',
      'total_base',
      'effective_cost_jpy',
      'effective_vwap_jpy',
      'fees_jpy',
      'market_impact_pct',
      'slippage_from_best_pct',
      'spread_pct',
      'updated_at',
      'note',
    ]];

    (data.rows || []).forEach((row) => {
      const result = row.result || {};
      const ready = row.status === 'ready' && row.result && !row.result.error;
      rows.push([
        meta.instrumentId || '',
        getSelectedMarket().label || meta.instrumentId || '',
        meta.side || '',
        meta.amountType || '',
        meta.amount ?? '',
        Number.isFinite(Number(meta.feeRate)) ? Number(meta.feeRate) * 100 : '',
        meta.generatedAt || '',
        row.rank ?? '',
        row.exchangeId || '',
        row.exchangeLabel || '',
        row.status || '',
        ready ? (result.executionStatusLabel || '') : (row.message || ''),
        row.source || '',
        ready ? result.totalBTCFilled : '',
        ready ? result.effectiveCostJPY : '',
        ready ? result.effectiveVWAP : '',
        ready ? result.feesJPY : '',
        ready ? result.marketImpactPct : '',
        ready ? result.slippageFromBestPct : '',
        row.spreadPct ?? '',
        row.timestamp || row.receivedAt || '',
        ready ? (result.recommendedAction || '') : (row.message || ''),
      ]);
    });

    return rows;
  }

  function salesReferenceCsvRows(data) {
    const meta = data && data.meta ? data.meta : {};
    const rows = [[
      'instrument_id',
      'instrument',
      'side',
      'amount_type',
      'amount',
      'fee_rate_pct',
      'baseline_exchange',
      'rank',
      'exchange_id',
      'exchange',
      'status',
      'display_price_jpy',
      'total_base',
      'effective_quote_jpy',
      'disadvantage_jpy',
      'delta_type',
      'base_delta',
      'spread_pct',
      'risk_label',
      'is_online',
      'updated_at',
      'note',
    ]];

    (data.rows || []).forEach((row) => {
      const result = row.result || {};
      const delta = row.delta || {};
      const ready = row.status === 'ready' && row.result;
      rows.push([
        meta.instrumentId || '',
        getSelectedMarket().label || meta.instrumentId || '',
        meta.side || '',
        meta.amountType || '',
        meta.amount ?? '',
        Number.isFinite(Number(meta.feeRate)) ? Number(meta.feeRate) * 100 : '',
        meta.baselineExchangeLabel || '',
        row.rank ?? '',
        row.exchangeId || '',
        row.exchangeLabel || '',
        row.status || '',
        ready ? result.price : '',
        ready ? result.totalBase : '',
        ready ? result.effectiveQuote : '',
        delta.disadvantageJpy ?? '',
        delta.type || '',
        delta.baseDelta ?? '',
        row.spreadPct ?? '',
        row.riskLabel || '',
        row.isOnline === false || row.isWidgetOpen === false ? 'false' : 'true',
        row.priceTimestamp || row.capturedAt || '',
        ready ? '' : (row.message || ''),
      ]);
    });

    return rows;
  }

  async function exportImage(kind) {
    const target = exportTargetElement(kind);
    if (!target) {
      throw new Error('エクスポート対象が見つかりません');
    }
    if (typeof html2canvas !== 'function') {
      throw new Error('画像エクスポートのライブラリが読み込めていません');
    }

    const canvas = await html2canvas(target, {
      backgroundColor: '#050816',
      useCORS: true,
      logging: false,
      scale: Math.max(2, Math.min(3, window.devicePixelRatio || 1)),
      onclone: (clonedDocument) => {
        clonedDocument.querySelectorAll('[data-export-actions]').forEach((node) => {
          node.style.display = 'none';
        });
        clonedDocument.querySelectorAll('.overflow-auto').forEach((node) => {
          node.style.overflow = 'visible';
          node.style.maxHeight = 'none';
        });
      },
    });

    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
    if (!blob) {
      throw new Error('画像を書き出せませんでした');
    }

    const filename = `${exportBaseFilename(kind)}.png`;
    if (navigator.share && navigator.canShare) {
      const file = new File([blob], filename, { type: 'image/png' });
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({
          title: exportTargetTitle(kind),
          files: [file],
        });
        return 'shared';
      }
    }

    downloadBlob(blob, filename);
    return 'saved';
  }

  function exportCsv(kind) {
    if (kind === 'simulation') {
      if (!lastSimulationResult || lastSimulationResult.error) {
        throw new Error('シミュレーション結果がありません');
      }
      return downloadCsv(`${exportBaseFilename(kind)}.csv`, simulationCsvRows(lastSimulationResult));
    }

    if (kind === 'venue-comparison') {
      if (!lastVenueComparisonData || !Array.isArray(lastVenueComparisonData.rows) || lastVenueComparisonData.rows.length === 0) {
        throw new Error('比較表のデータがありません');
      }
      return downloadCsv(`${exportBaseFilename(kind)}.csv`, venueComparisonCsvRows(lastVenueComparisonData));
    }

    if (kind === 'sales-reference') {
      if (!lastSalesReferenceData || !Array.isArray(lastSalesReferenceData.rows) || lastSalesReferenceData.rows.length === 0) {
        throw new Error('販売所参考比較のデータがありません');
      }
      return downloadCsv(`${exportBaseFilename(kind)}.csv`, salesReferenceCsvRows(lastSalesReferenceData));
    }

    throw new Error('未対応のエクスポート種別です');
  }

  function setSettingsStatus(message) {
    if (!settingsSaveStatus) return;
    settingsSaveStatus.textContent = message || 'このブラウザに保存';
    if (settingsStatusTimer) clearTimeout(settingsStatusTimer);
    if (message) {
      settingsStatusTimer = setTimeout(() => {
        settingsSaveStatus.textContent = 'このブラウザに保存';
      }, 2400);
    }
  }

  function favoriteKey(exchangeId, instrumentId) {
    return `${normalizeExchangeId(exchangeId)}:${normalizeInstrumentId(instrumentId)}`;
  }

  function marketPageUrl(instrumentId) {
    const normalized = normalizeInstrumentId(instrumentId) || defaultMarket.instrumentId;
    return `/markets/${encodeURIComponent(normalized)}`;
  }

  function currentSettingsDraft() {
    const exchange = getSelectedExchange();
    const market = getSelectedMarket(exchange);
    const feeRatePct = normalizeFeeRatePct(feeRateInput && feeRateInput.value);
    const previous = readSavedSettings();

    return {
      ...previous,
      exchangeId: exchange && exchange.id,
      instrumentId: market && market.instrumentId,
      side: normalizeSide(sideSelect && sideSelect.value) || 'buy',
      amountType: normalizeAmountType(amountTypeSelect && amountTypeSelect.value) || 'base',
      feeRatePct: feeRatePct == null ? previous.feeRatePct : feeRatePct,
      savedAt: new Date().toISOString(),
    };
  }

  function saveCurrentSettings(options = {}) {
    const { statusMessage = null } = options;
    const settings = currentSettingsDraft();
    const ok = storageSet(SETTINGS_STORAGE_KEY, settings);
    if (statusMessage) {
      setSettingsStatus(ok ? statusMessage : '保存できませんでした');
    }
    return ok;
  }

  function saveFavoriteMarkets() {
    return storageSet(FAVORITE_MARKETS_STORAGE_KEY, favoriteMarkets);
  }

  function renderFavoriteMarkets() {
    if (!favoriteMarketList) return;
    if (!favoriteMarkets || favoriteMarkets.length === 0) {
      favoriteMarketList.innerHTML = '<span class="favorite-empty">お気に入り未登録</span>';
      return;
    }

    const current = favoriteKey(
      getSelectedExchange() && getSelectedExchange().id,
      getSelectedMarket() && getSelectedMarket().instrumentId
    );

    favoriteMarketList.innerHTML = favoriteMarkets.map((favorite) => {
      const key = favoriteKey(favorite.exchangeId, favorite.instrumentId);
      const activeClass = key === current ? ' is-active' : '';
      return `
        <span class="favorite-item">
          <button class="favorite-chip${activeClass}" type="button" data-favorite-key="${escapeHtml(key)}" title="${escapeHtml(favorite.exchangeLabel)} / ${escapeHtml(favorite.instrumentLabel)}">
            ${escapeHtml(favorite.instrumentLabel)}
            <span class="favorite-chip__exchange">${escapeHtml(favorite.exchangeLabel)}</span>
          </button>
          <button class="favorite-remove" type="button" data-favorite-remove="${escapeHtml(key)}" aria-label="${escapeHtml(favorite.instrumentLabel)} をお気に入りから削除">削除</button>
        </span>
      `;
    }).join('');
  }

  function saveCurrentFavorite() {
    const exchange = getSelectedExchange();
    const market = getSelectedMarket(exchange);
    if (!exchange || !market) return;

    const key = favoriteKey(exchange.id, market.instrumentId);
    const favorite = {
      exchangeId: exchange.id,
      instrumentId: market.instrumentId,
      exchangeLabel: exchange.label || exchange.id,
      instrumentLabel: market.label || market.instrumentId,
      baseCurrency: market.baseCurrency || '',
      quoteCurrency: market.quoteCurrency || 'JPY',
      savedAt: new Date().toISOString(),
    };
    favoriteMarkets = [favorite]
      .concat(favoriteMarkets.filter(item => favoriteKey(item.exchangeId, item.instrumentId) !== key))
      .slice(0, MAX_FAVORITE_MARKETS);
    saveFavoriteMarkets();
    renderFavoriteMarkets();
    saveCurrentSettings({ statusMessage: 'お気に入りに保存しました' });
  }

  function applyFavoriteMarket(key) {
    const favorite = favoriteMarkets.find(item => favoriteKey(item.exchangeId, item.instrumentId) === key);
    if (!favorite) return;

    const exchange = exchanges.find(item => item.id === favorite.exchangeId);
    if (!exchange || exchange.status !== 'active') {
      setSettingsStatus('この取引所は現在選べません');
      return;
    }

    if (exchangeSelect) exchangeSelect.value = exchange.id;
    populateMarketSelect(exchange, favorite.instrumentId);
    const market = getSelectedMarket(exchange);
    ws.setMarket(exchange.id, market.instrumentId);
    setMarketDisplay(exchange, market);
    clearMarketState();
    updateShareUrl();
    saveCurrentSettings({ statusMessage: '初期設定に保存しました' });
    renderFavoriteMarkets();
  }

  function setSide(side) {
    const normalized = normalizeSide(side) || 'buy';
    if (sideSelect) sideSelect.value = normalized;
    document.querySelectorAll('[data-side]').forEach(button => {
      const isActive = button.dataset.side === normalized;
      button.classList.toggle('is-active', isActive);
      button.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    });
  }

  function currentShareParams() {
    const exchange = getSelectedExchange();
    const market = getSelectedMarket(exchange);
    const params = new URLSearchParams();
    const amount = parseNumberInput(amountInput.value);
    const feeRatePct = parseNumberInput(feeRateInput.value);

    params.set('exchange', exchange.id);
    params.set('market', market.instrumentId);
    params.set('side', normalizeSide(sideSelect.value) || 'buy');
    params.set('amountType', normalizeAmountType(amountTypeSelect.value) || 'base');
    if (Number.isFinite(amount) && amount > 0) {
      params.set('amount', formatNumberParam(amount));
    }
    if (Number.isFinite(feeRatePct) && feeRatePct >= 0 && feeRatePct <= 100) {
      params.set('feeRate', formatNumberParam(feeRatePct));
    }

    return params;
  }

  function updateShareUrl() {
    const params = currentShareParams();
    const nextUrl = `${window.location.pathname}?${params.toString()}${window.location.hash}`;
    const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    if (nextUrl !== currentUrl) {
      window.history.replaceState({}, document.title, nextUrl);
    }
  }

  async function copyShareUrl() {
    updateShareUrl();
    const shareUrl = window.location.href;
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(shareUrl);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = shareUrl;
        textarea.setAttribute('readonly', '');
        textarea.style.position = 'fixed';
        textarea.style.top = '-1000px';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        textarea.remove();
      }
      setShareStatus('共有URLをコピーしました');
    } catch (err) {
      setShareStatus('コピーできませんでした。アドレスバーのURLを使ってください');
    }
  }

  function loadLocalAlerts() {
    try {
      const parsed = JSON.parse(localStorage.getItem(ALERT_STORAGE_KEY) || '[]');
      localAlerts = Array.isArray(parsed) ? parsed.filter(item => item && item.id && item.type) : [];
    } catch (_) {
      localAlerts = [];
    }
  }

  function saveLocalAlerts() {
    localStorage.setItem(ALERT_STORAGE_KEY, JSON.stringify(localAlerts));
  }

  function alertStatusText(alert) {
    if (alert.status === 'triggered') return '条件達成';
    if (alert.status === 'waiting') return '待機中';
    if (alert.status === 'error') return '取得失敗';
    return '未判定';
  }

  function alertStatusClass(alert) {
    if (alert.status === 'triggered') return 'text-green-300';
    if (alert.status === 'waiting') return 'text-gray-300';
    if (alert.status === 'error') return 'text-yellow-300';
    return 'text-gray-500';
  }

  function alertTypeLabel(type) {
    return type === 'slippage' ? '成行スリッページ' : '販売所スプレッド';
  }

  function formatAlertTime(value) {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    return date.toLocaleTimeString('ja-JP', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  }

  function alertAmountLabel(alert) {
    if (alert.amountType === 'jpy') return Fmt.jpy(alert.amount);
    const base = alert.baseCurrency || (alert.instrumentId || 'BTC-JPY').split('-')[0] || 'BTC';
    return `${Fmt.baseCompact(alert.amount)} ${base}`;
  }

  function alertConditionHtml(alert) {
    const marketLabel = alert.instrumentLabel || alert.instrumentId || '-';
    if (alert.type === 'slippage') {
      const sideLabel = alert.side === 'sell' ? '売り' : '買い';
      return `
        <div class="font-bold text-gray-200">${escapeHtml(alertTypeLabel(alert.type))}</div>
        <div class="text-[10px] text-gray-500">${escapeHtml(marketLabel)} / ${sideLabel} / ${escapeHtml(alertAmountLabel(alert))}</div>
        <div class="text-[10px] text-gray-600">Best比 ${Fmt.pct2(alert.thresholdPct)} 以下</div>
      `;
    }

    return `
      <div class="font-bold text-gray-200">${escapeHtml(alertTypeLabel(alert.type))}</div>
      <div class="text-[10px] text-gray-500">${escapeHtml(marketLabel)} / 全販売所</div>
      <div class="text-[10px] text-gray-600">スプレッド ${Fmt.pct2(alert.thresholdPct)} 以下</div>
    `;
  }

  function renderAlerts() {
    const countLabel = localAlerts.length > 0 ? `${localAlerts.length}件保存` : 'アラート未登録';
    const refreshLabel = lastAlertRefreshAt ? `最終判定 ${formatAlertTime(lastAlertRefreshAt)}` : '未判定';
    UI.setText('alert-meta', `${countLabel} | ${refreshLabel}`);

    if (!alertTbody) return;
    if (localAlerts.length === 0) {
      alertTbody.innerHTML = '<tr><td colspan="4" class="text-center text-gray-500 py-4">アラート未登録</td></tr>';
      return;
    }

    alertTbody.innerHTML = localAlerts.map(alert => {
      const latestValue = Number.isFinite(Number(alert.lastValuePct)) ? Fmt.pct2(Number(alert.lastValuePct)) : '-';
      const latestSub = alert.lastSourceLabel || (alert.lastCheckedAt ? `更新 ${formatAlertTime(alert.lastCheckedAt)}` : '判定待ち');
      const statusText = alertStatusText(alert);
      const statusClass = alertStatusClass(alert);
      return `
        <tr class="border-b border-gray-800/60">
          <td data-label="条件">${alertConditionHtml(alert)}</td>
          <td class="is-num text-right font-mono text-gray-300" data-label="最新">
            <div>${latestValue}</div>
            <div class="text-[10px] text-gray-500">${escapeHtml(latestSub)}</div>
          </td>
          <td class="${statusClass}" data-label="状態">
            <div class="font-bold">${statusText}</div>
            <div class="text-[10px] text-gray-500">${alert.lastTriggeredAt ? `達成 ${formatAlertTime(alert.lastTriggeredAt)}` : 'ローカル判定'}</div>
          </td>
          <td class="text-right" data-label="操作">
            <button class="btn btn-ghost alert-delete-btn px-2 py-1 text-xs" type="button" data-alert-id="${escapeHtml(alert.id)}">削除</button>
          </td>
        </tr>
      `;
    }).join('');
  }

  function syncAlertHelp() {
    if (!alertTypeSelect || !alertHelp) return;
    if (alertTypeSelect.value === 'slippage') {
      alertHelp.textContent = '現在の銘柄・売買方向・数量で、最小スリッページがしきい値以下になったら点灯します。';
      if (alertThresholdInput && (!alertThresholdInput.value || Number(alertThresholdInput.value) === 3)) {
        alertThresholdInput.value = '1';
      }
      return;
    }

    alertHelp.textContent = '現在の銘柄で、販売所スプレッドがしきい値以下になったら点灯します。';
    if (alertThresholdInput && (!alertThresholdInput.value || Number(alertThresholdInput.value) === 1)) {
      alertThresholdInput.value = '3';
    }
  }

  function currentAlertDraft() {
    const type = alertTypeSelect ? alertTypeSelect.value : 'spread';
    const thresholdPct = parseNumberInput(alertThresholdInput && alertThresholdInput.value);
    const exchange = getSelectedExchange();
    const market = getSelectedMarket(exchange);

    if (!Number.isFinite(thresholdPct) || thresholdPct < 0) {
      return { error: 'しきい値は0以上で入力してください' };
    }

    const alert = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      type: type === 'slippage' ? 'slippage' : 'spread',
      thresholdPct,
      instrumentId: market.instrumentId,
      instrumentLabel: market.label || market.instrumentId,
      baseCurrency: market.baseCurrency || 'BTC',
      quoteCurrency: market.quoteCurrency || 'JPY',
      createdAt: new Date().toISOString(),
      status: 'unknown',
      lastValuePct: null,
      lastSourceLabel: null,
      lastCheckedAt: null,
      lastTriggeredAt: null,
    };

    if (alert.type === 'slippage') {
      const amount = parseNumberInput(amountInput.value);
      const feeRatePct = parseNumberInput(feeRateInput.value);
      if (!Number.isFinite(amount) || amount <= 0) {
        return { error: '成行スリッページは数量または金額を入力してから追加してください' };
      }
      if (!Number.isFinite(feeRatePct) || feeRatePct < 0 || feeRatePct > 100) {
        return { error: '手数料率は0%以上100%以下で入力してください' };
      }

      alert.side = normalizeSide(sideSelect.value) || 'buy';
      alert.amountType = normalizeAmountType(amountTypeSelect.value) || 'base';
      alert.amount = amount;
      alert.feeRate = feeRatePct / 100;
    }

    return { alert };
  }

  function spreadValue(row) {
    const latest = row && row.latest;
    const average24h = row && row.averages && row.averages['1d'];
    const value = latest && Number.isFinite(Number(latest.spreadPct))
      ? Number(latest.spreadPct)
      : (average24h && Number.isFinite(Number(average24h.spreadPct)) ? Number(average24h.spreadPct) : null);
    return value;
  }

  function evaluateSpreadAlert(alert, spreadData) {
    const rows = (spreadData && spreadData.rows || [])
      .filter(row => row.instrumentId === alert.instrumentId)
      .map(row => ({
        row,
        value: spreadValue(row),
      }))
      .filter(item => Number.isFinite(item.value))
      .sort((a, b) => a.value - b.value);

    const best = rows[0] || null;
    if (!best) {
      return {
        ...alert,
        status: 'error',
        lastValuePct: null,
        lastSourceLabel: '販売所価格待ち',
        lastCheckedAt: new Date().toISOString(),
      };
    }

    const triggered = best.value <= alert.thresholdPct;
    const now = new Date().toISOString();
    return {
      ...alert,
      status: triggered ? 'triggered' : 'waiting',
      lastValuePct: best.value,
      lastSourceLabel: best.row.exchangeLabel || best.row.exchangeId,
      lastCheckedAt: now,
      lastTriggeredAt: triggered ? now : alert.lastTriggeredAt || null,
    };
  }

  async function evaluateSlippageAlert(alert) {
    const params = new URLSearchParams({
      instrumentId: alert.instrumentId,
      side: alert.side || 'buy',
      amountType: alert.amountType || 'base',
      amount: String(alert.amount),
      feeRate: String(alert.feeRate ?? 0),
    });
    const res = await fetch(`/api/market-impact-comparison?${params.toString()}`, { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const rows = (data.rows || [])
      .filter(row => row.status === 'ready' && row.result && !row.result.error)
      .map(row => ({
        row,
        value: Number(row.result.slippageFromBestPct),
      }))
      .filter(item => Number.isFinite(item.value))
      .sort((a, b) => a.value - b.value);
    const best = rows[0] || null;
    if (!best) {
      return {
        ...alert,
        status: 'error',
        lastValuePct: null,
        lastSourceLabel: '板データ待ち',
        lastCheckedAt: new Date().toISOString(),
      };
    }

    const triggered = best.value <= alert.thresholdPct;
    const now = new Date().toISOString();
    return {
      ...alert,
      status: triggered ? 'triggered' : 'waiting',
      lastValuePct: best.value,
      lastSourceLabel: best.row.exchangeLabel || best.row.exchangeId,
      lastCheckedAt: now,
      lastTriggeredAt: triggered ? now : alert.lastTriggeredAt || null,
    };
  }

  async function refreshAlerts() {
    if (alertRefreshRunning || localAlerts.length === 0) {
      renderAlerts();
      return;
    }

    alertRefreshRunning = true;
    UI.setText('alert-meta', `${localAlerts.length}件保存 | 判定中`);
    try {
      let spreadData = null;
      let spreadError = null;
      if (localAlerts.some(alert => alert.type === 'spread')) {
        try {
          const res = await fetch('/api/sales-spread', { cache: 'no-store' });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          spreadData = await res.json();
        } catch (err) {
          spreadError = err;
        }
      }

      localAlerts = await Promise.all(localAlerts.map(async (alert) => {
        try {
          if (alert.type === 'spread') {
            if (spreadError) throw spreadError;
            return evaluateSpreadAlert(alert, spreadData);
          }
          return await evaluateSlippageAlert(alert);
        } catch (err) {
          return {
            ...alert,
            status: 'error',
            lastValuePct: null,
            lastSourceLabel: err.message,
            lastCheckedAt: new Date().toISOString(),
          };
        }
      }));
      lastAlertRefreshAt = new Date().toISOString();
      saveLocalAlerts();
    } finally {
      alertRefreshRunning = false;
      renderAlerts();
    }
  }

  function addCurrentAlert() {
    const draft = currentAlertDraft();
    if (draft.error) {
      UI.setText('alert-meta', draft.error);
      return;
    }

    localAlerts.unshift(draft.alert);
    saveLocalAlerts();
    renderAlerts();
    refreshAlerts();
  }

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
    if (marketPageNavLink) {
      const label = market.label || market.instrumentId || defaultMarket.label;
      marketPageNavLink.href = marketPageUrl(market.instrumentId);
      marketPageNavLink.title = `${label} 銘柄ページ`;
    }
    if (typeof setChartBaseCurrency === 'function') {
      setChartBaseCurrency(market.baseCurrency || 'BTC');
    }
    updateAmountUnit();
  }

  function applyInitialUrlState() {
    const initialSide = initialUrlState.hasSide ? initialUrlState.side : savedSettings.side;
    const initialAmountType = initialUrlState.hasAmountType ? initialUrlState.amountType : savedSettings.amountType;
    const initialFeeRatePct = initialUrlState.hasFeeRate ? initialUrlState.feeRatePct : savedSettings.feeRatePct;
    const initialExchangeId = initialUrlState.hasExchange ? initialUrlState.exchangeId : savedSettings.exchangeId;
    const initialInstrumentId = initialUrlState.hasInstrument ? initialUrlState.instrumentId : savedSettings.instrumentId;

    if (initialSide) setSide(initialSide);
    if (initialAmountType && amountTypeSelect) amountTypeSelect.value = initialAmountType;
    if (initialUrlState.amount != null && amountInput) amountInput.value = formatNumberParam(initialUrlState.amount);
    if (initialFeeRatePct != null && feeRateInput) feeRateInput.value = formatNumberParam(initialFeeRatePct);

    const nextExchangeId = initialExchangeId || ws.exchangeId;
    const nextInstrumentId = initialInstrumentId || ws.instrumentId;
    if (nextExchangeId || nextInstrumentId) {
      ws.setMarket(nextExchangeId, nextInstrumentId);
    }

    updateAmountUnit();
  }

  function maybeRunInitialSimulation() {
    if (!shouldRunInitialSimulation || initialSimulationRun || !exchangeListLoaded) return;
    if (!ws.ws || ws.ws.readyState !== WebSocket.OPEN) return;
    initialSimulationRun = true;
    runSimulation();
  }

  function clearMarketState() {
    latestDepthData = null;
    latestMidPrice = null;
    lastSimulationResult = null;
    setSimulationForChart(null);
    UI.clearMarketView();
    UI.clearSimulationView();
    clearVenueComparison();
    ws.clearSimulation();
    if (depthChart) {
      depthChart.data.datasets.forEach(dataset => {
        dataset.data = [];
      });
      depthChart.update('none');
    }
  }

  function setVenueComparisonEmpty(message) {
    const tbody = document.getElementById('venue-comparison-tbody');
    if (tbody) {
      tbody.innerHTML = `<tr><td colspan="7" class="text-center text-gray-500 py-4">${escapeHtml(message)}</td></tr>`;
    }
  }

  function stopComparisonRefresh() {
    if (comparisonRefreshTimer) {
      clearInterval(comparisonRefreshTimer);
      comparisonRefreshTimer = null;
    }
  }

  function clearVenueComparison() {
    lastComparisonParams = null;
    lastVenueComparisonData = null;
    lastSalesReferenceData = null;
    stopComparisonRefresh();
    if (comparisonAbortController) {
      comparisonAbortController.abort();
      comparisonAbortController = null;
    }
    if (salesReferenceAbortController) {
      salesReferenceAbortController.abort();
      salesReferenceAbortController = null;
    }
    UI.setText('venue-comparison-meta', 'シミュレーション実行後に比較します');
    UI.setText('sales-reference-meta', '販売所は表示価格ベースの参考値です');
    setVenueComparisonEmpty('シミュレーション結果なし');
    setSalesReferenceEmpty('シミュレーション結果なし');
  }

  function scheduleComparisonRefresh() {
    stopComparisonRefresh();
    if (!autoUpdate || !lastComparisonParams) return;
    comparisonRefreshTimer = setInterval(() => {
      loadVenueComparison({ background: true });
      loadSalesReferenceComparison({ background: true });
    }, COMPARISON_REFRESH_MS);
  }

  function comparisonAmountLabel(params) {
    if (!params) return '-';
    if (params.amountType === 'jpy') return Fmt.jpy(params.amount);
    return UI.formatBase(params.amount, true);
  }

  function comparisonGeneratedAtLabel(value) {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    return date.toLocaleTimeString('ja-JP', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  }

  function comparisonUpdatedAtLabel(row) {
    const value = row && (row.timestamp || row.receivedAt);
    if (!value) return '-';
    const date = typeof value === 'number' ? new Date(value) : new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    return date.toLocaleTimeString('ja-JP', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  }

  function comparisonStatusClass(status) {
    return {
      executable: 'text-green-300',
      insufficient_liquidity: 'text-yellow-300',
      auto_cancel: 'text-yellow-300',
      circuit_breaker: 'text-red-300',
    }[status] || 'text-gray-300';
  }

  function renderVenueComparison(data) {
    const tbody = document.getElementById('venue-comparison-tbody');
    if (!tbody) return;

    lastVenueComparisonData = data && typeof data === 'object' ? data : null;
    const meta = data && data.meta ? data.meta : {};
    const rows = Array.isArray(data && data.rows) ? data.rows : [];
    const sideLabel = meta.side === 'sell' ? '売り' : '買い';
    const market = getSelectedMarket();
    const effectiveHeader = document.getElementById('venue-col-effective');
    if (effectiveHeader) {
      if (meta.amountType === 'jpy') {
        effectiveHeader.textContent = meta.side === 'sell' ? '必要数量' : '取得数量';
      } else {
        effectiveHeader.textContent = meta.side === 'sell' ? '実効受取' : '実効コスト';
      }
    }

    UI.setText(
      'venue-comparison-meta',
      `${market.label || meta.instrumentId || '-'} | ${sideLabel} | ${comparisonAmountLabel(meta)} | 取得 ${comparisonGeneratedAtLabel(meta.generatedAt)} | 有効 ${meta.readyCount || 0}件 / 待機 ${meta.waitingCount || 0}件`
    );

    if (rows.length === 0) {
      setVenueComparisonEmpty('比較できる取引所がありません');
      return;
    }

    const isSell = meta.side === 'sell';
    tbody.innerHTML = rows.map(row => {
      const result = row.result || null;
      const ready = row.status === 'ready' && result && !result.error;
      const rankLabel = row.rank ? `#${row.rank}` : '-';
      const rowClass = row.rank === 1 && ready ? 'data-table__row--rank-1' : '';
      const valueClass = isSell ? 'text-green-300' : 'text-red-300';
      const statusText = ready
        ? (result.executionStatusLabel || '発注可能')
        : (row.message || '板データ待機中');
      const statusClass = ready ? comparisonStatusClass(result.executionStatus) : 'text-gray-500';
      const fixedQuoteAmount = meta.amountType === 'jpy';
      const effectiveValue = ready
        ? (fixedQuoteAmount ? UI.formatBase(result.totalBTCFilled, true) : Fmt.jpy(result.effectiveCostJPY))
        : '-';
      const fixedQuoteSub = ready
        ? (isSell ? `受取 ${Fmt.jpy(result.effectiveCostJPY)}` : `支払 ${Fmt.jpy(result.effectiveCostJPY)}`)
        : '';
      const effectiveSub = ready
        ? (fixedQuoteAmount ? fixedQuoteSub : `手数料 ${Fmt.jpy(result.feesJPY)}`)
        : escapeHtml(row.status === 'unsupported' ? '未対応' : row.status === 'waiting' ? '取得待ち' : '計算不可');
      const vwapValue = ready ? Fmt.jpy(result.effectiveVWAP) : '-';
      const spreadLabel = row.spreadPct == null ? '-' : Fmt.pct(row.spreadPct);
      const impactValue = ready ? Fmt.pct(result.marketImpactPct) : '-';
      const impactSub = ready ? `Best比 ${Fmt.pct(result.slippageFromBestPct)}` : '-';
      const sourceLabel = row.source === 'websocket' ? 'WS' : row.source ? String(row.source).toUpperCase() : '-';
      const shortfall = ready && result.insufficient
        ? `<div class="text-[10px] text-yellow-500">流動性不足</div>`
        : '';

      return `
        <tr class="border-b border-gray-800/60 ${rowClass}">
          <td headers="venue-col-rank" class="is-num text-right font-mono text-gray-300" data-label="順位">${rankLabel}</td>
          <td headers="venue-col-exchange" class="text-left" data-label="取引所">
            <div class="font-bold text-gray-200">${escapeHtml(row.exchangeLabel || row.exchangeId)}</div>
            <div class="text-[10px] text-gray-500">${escapeHtml(row.instrumentLabel || row.instrumentId)} / ${escapeHtml(sourceLabel)}</div>
          </td>
          <td headers="venue-col-effective" class="is-num text-right font-mono ${ready ? valueClass : 'text-gray-500'}" data-label="${fixedQuoteAmount ? (isSell ? '必要数量' : '取得数量') : (isSell ? '実効受取' : '実効コスト')}">
            <div>${effectiveValue}</div>
            <div class="text-[10px] text-gray-500">${effectiveSub}</div>
          </td>
          <td headers="venue-col-vwap" class="is-num text-right font-mono text-gray-300" data-label="実効VWAP">
            <div>${vwapValue}</div>
            <div class="text-[10px] text-gray-500">Spread ${spreadLabel}</div>
          </td>
          <td headers="venue-col-impact" class="is-num text-right font-mono text-gray-300" data-label="Impact">
            <div>${impactValue}</div>
            <div class="text-[10px] text-gray-500">${impactSub}</div>
          </td>
          <td headers="venue-col-status" class="${statusClass}" data-label="判定">
            <div class="font-bold">${escapeHtml(statusText)}</div>
            ${shortfall}
          </td>
          <td headers="venue-col-updated" class="text-right font-mono text-gray-400" data-label="更新">${comparisonUpdatedAtLabel(row)}</td>
        </tr>
      `;
    }).join('');
  }

  async function loadVenueComparison(options = {}) {
    if (!lastComparisonParams) return;
    const { background = false } = options;
    const params = new URLSearchParams({
      exchangeId: lastComparisonParams.exchangeId,
      instrumentId: lastComparisonParams.instrumentId,
      side: lastComparisonParams.side,
      amountType: lastComparisonParams.amountType,
      amount: String(lastComparisonParams.amount),
      feeRate: String(lastComparisonParams.feeRate),
    });

    if (comparisonAbortController) comparisonAbortController.abort();
    const controller = new AbortController();
    comparisonAbortController = controller;

    if (!background) {
      UI.setText('venue-comparison-meta', '比較を取得中');
      setVenueComparisonEmpty('比較を取得中');
    }

    try {
      const res = await fetch(`/api/market-impact-comparison?${params.toString()}`, {
        cache: 'no-store',
        signal: controller.signal,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      renderVenueComparison(await res.json());
    } catch (err) {
      if (err.name === 'AbortError') return;
      if (!background) {
        UI.setText('venue-comparison-meta', err.message);
        setVenueComparisonEmpty('比較の取得に失敗しました');
      }
    } finally {
      if (comparisonAbortController === controller) {
        comparisonAbortController = null;
      }
    }
  }

  function setSalesReferenceEmpty(message) {
    const tbody = document.getElementById('sales-reference-tbody');
    if (tbody) {
      tbody.innerHTML = `<tr><td colspan="7" class="text-center text-gray-500 py-4">${escapeHtml(message)}</td></tr>`;
    }
  }

  function signedJpy(value) {
    if (value == null || isNaN(value)) return '-';
    const abs = Math.abs(value);
    if (Math.abs(value) < 0.5) return Fmt.jpy(0);
    return `${value > 0 ? '+' : '-'}${Fmt.jpy(abs)}`;
  }

  function referencePriceDecimals(value, precision) {
    const abs = Math.abs(Number(value));
    if (!Number.isFinite(abs)) return 0;
    if (abs >= 1000) return Math.min(Math.max(precision ?? 0, 0), 2);
    if (abs >= 100) return Math.min(Math.max(precision ?? 1, 1), 3);
    if (abs >= 1) return Math.min(Math.max(precision ?? 2, 2), 5);
    return Math.min(Math.max(precision ?? 6, 6), 10);
  }

  function formatReferencePrice(value, precision) {
    if (value == null || isNaN(value)) return '-';
    return new Intl.NumberFormat('ja-JP', {
      style: 'currency',
      currency: 'JPY',
      minimumFractionDigits: 0,
      maximumFractionDigits: referencePriceDecimals(value, precision),
    }).format(value);
  }

  function salesReferenceUpdatedAtLabel(row) {
    const value = row && (row.priceTimestamp || row.capturedAt);
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    return date.toLocaleTimeString('ja-JP', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  }

  function salesDeltaLabel(row, meta) {
    const delta = row.delta;
    if (!delta) {
      return {
        value: '-',
        sub: meta.baselineReady ? '比較不可' : '取引所板待機中',
        className: 'text-gray-500',
      };
    }

    const disadvantage = Number(delta.disadvantageJpy);
    const isWorse = Number.isFinite(disadvantage) && disadvantage > 0.5;
    const isBetter = Number.isFinite(disadvantage) && disadvantage < -0.5;
    const className = isWorse ? 'text-yellow-300' : isBetter ? 'text-green-300' : 'text-gray-300';
    const prefix = isWorse ? '不利' : isBetter ? '有利' : '同等';

    if (delta.type === 'base') {
      const baseDelta = Number(delta.baseDelta);
      const absBase = Math.abs(baseDelta);
      const movement = meta.side === 'sell'
        ? (baseDelta > 0 ? '多く必要' : '少なく必要')
        : (baseDelta > 0 ? '多く取得' : '少なく取得');
      return {
        value: absBase < 1e-10 ? '同等' : `${UI.formatBase(absBase, true)} ${movement}`,
        sub: `${prefix}換算 ${signedJpy(disadvantage)}`,
        className,
      };
    }

    return {
      value: `${prefix} ${signedJpy(disadvantage)}`,
      sub: meta.side === 'sell' ? '受取差' : '支払差',
      className,
    };
  }

  function salesReferenceResultLabel(row, meta) {
    const result = row.result;
    if (!result) {
      return { value: '-', sub: '計算不可' };
    }

    const fixedQuote = meta.amountType === 'jpy';
    if (fixedQuote) {
      return {
        value: `${meta.side === 'sell' ? '必要' : '取得'} ${UI.formatBase(result.totalBase, true)}`,
        sub: `${meta.side === 'sell' ? '受取' : '支払'} ${Fmt.jpy(result.effectiveQuote)}`,
      };
    }

    return {
      value: `${meta.side === 'sell' ? '受取' : '支払'} ${Fmt.jpy(result.effectiveQuote)}`,
      sub: `${meta.side === 'sell' ? '売却' : '取得'} ${UI.formatBase(result.totalBase, true)}`,
    };
  }

  function renderSalesReferenceComparison(data) {
    const tbody = document.getElementById('sales-reference-tbody');
    if (!tbody) return;

    lastSalesReferenceData = data && typeof data === 'object' ? data : null;
    const meta = data && data.meta ? data.meta : {};
    const rows = Array.isArray(data && data.rows) ? data.rows : [];
    const market = getSelectedMarket();
    const sideLabel = meta.side === 'sell' ? '売り' : '買い';
    const priceHeader = document.getElementById('sales-ref-col-price');
    if (priceHeader) priceHeader.textContent = meta.side === 'sell' ? '売値' : '買値';

    UI.setText(
      'sales-reference-meta',
      `${market.label || meta.instrumentId || '-'} | ${sideLabel} | ${comparisonAmountLabel(meta)} | 基準 ${meta.baselineExchangeLabel || '取引所板待機中'} | 販売所 ${meta.saleRecordCount || 0}件`
    );

    if (rows.length === 0) {
      setSalesReferenceEmpty('販売所価格の記録待ち');
      return;
    }

    tbody.innerHTML = rows.map(row => {
      const result = row.result || null;
      const ready = row.status === 'ready' && result;
      const rankLabel = row.rank ? `#${row.rank}` : '-';
      const rowClass = row.rank === 1 && ready ? 'data-table__row--rank-1' : '';
      const price = ready ? formatReferencePrice(result.price, row.quotePrecision) : '-';
      const spread = row.spreadPct == null ? '-' : Fmt.pct(row.spreadPct);
      const resultLabel = salesReferenceResultLabel(row, meta);
      const deltaLabel = salesDeltaLabel(row, meta);
      const onlineLabel = row.isOnline === false || row.isWidgetOpen === false ? '販売停止の可能性' : '表示価格ベース';

      return `
        <tr class="border-b border-gray-800/60 ${rowClass}">
          <td headers="sales-ref-col-rank" class="is-num text-right font-mono text-gray-300" data-label="順位">${rankLabel}</td>
          <td headers="sales-ref-col-exchange" class="text-left" data-label="販売所">
            <div class="font-bold text-gray-200">${escapeHtml(row.exchangeLabel || row.exchangeId)}</div>
            <div class="text-[10px] text-gray-500">${escapeHtml(row.instrumentLabel || row.instrumentId)}</div>
          </td>
          <td headers="sales-ref-col-price" class="is-num text-right font-mono text-gray-300" data-label="${meta.side === 'sell' ? '売値' : '買値'}">
            <div>${price}</div>
            <div class="text-[10px] text-gray-500">Spread ${spread}</div>
          </td>
          <td headers="sales-ref-col-result" class="is-num text-right font-mono text-gray-300" data-label="参考結果">
            <div>${escapeHtml(resultLabel.value)}</div>
            <div class="text-[10px] text-gray-500">${escapeHtml(resultLabel.sub)}</div>
          </td>
          <td headers="sales-ref-col-delta" class="is-num text-right font-mono ${deltaLabel.className}" data-label="最良取引所との差">
            <div>${escapeHtml(deltaLabel.value)}</div>
            <div class="text-[10px] text-gray-500">${escapeHtml(deltaLabel.sub)}</div>
          </td>
          <td headers="sales-ref-col-risk" class="text-yellow-300" data-label="注意">
            <div class="font-bold">${escapeHtml(row.riskLabel || '価格再提示リスクあり')}</div>
            <div class="text-[10px] text-gray-500">${escapeHtml(onlineLabel)}</div>
          </td>
          <td headers="sales-ref-col-updated" class="text-right font-mono text-gray-400" data-label="更新">${salesReferenceUpdatedAtLabel(row)}</td>
        </tr>
      `;
    }).join('');
  }

  async function loadSalesReferenceComparison(options = {}) {
    if (!lastComparisonParams) return;
    const { background = false } = options;
    const params = new URLSearchParams({
      instrumentId: lastComparisonParams.instrumentId,
      side: lastComparisonParams.side,
      amountType: lastComparisonParams.amountType,
      amount: String(lastComparisonParams.amount),
      feeRate: String(lastComparisonParams.feeRate),
    });

    if (salesReferenceAbortController) salesReferenceAbortController.abort();
    const controller = new AbortController();
    salesReferenceAbortController = controller;

    if (!background) {
      UI.setText('sales-reference-meta', '販売所参考比較を取得中');
      setSalesReferenceEmpty('販売所参考比較を取得中');
    }

    try {
      const res = await fetch(`/api/sales-reference-comparison?${params.toString()}`, {
        cache: 'no-store',
        signal: controller.signal,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      renderSalesReferenceComparison(await res.json());
    } catch (err) {
      if (err.name === 'AbortError') return;
      if (!background) {
        UI.setText('sales-reference-meta', err.message);
        setSalesReferenceEmpty('販売所参考比較の取得に失敗しました');
      }
    } finally {
      if (salesReferenceAbortController === controller) {
        salesReferenceAbortController = null;
      }
    }
  }

  function populateExchangeSelect(nextExchanges, defaultExchangeId = 'okj', preferredExchangeId) {
    if (!Array.isArray(nextExchanges) || nextExchanges.length === 0) return;
    exchanges = nextExchanges;

    if (!exchangeSelect) {
      setMarketDisplay(exchanges[0]);
      return;
    }

    const previousValue = preferredExchangeId || exchangeSelect.value || ws.exchangeId || defaultExchangeId;
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
      if (!res.ok) {
        exchangeListLoaded = true;
        maybeRunInitialSimulation();
        return;
      }

      const data = await res.json();
      const preferredExchangeId = initialUrlStateConsumed
        ? ws.exchangeId
        : ((initialUrlState.hasExchange ? initialUrlState.exchangeId : savedSettings.exchangeId) || ws.exchangeId);
      const preferredInstrumentId = initialUrlStateConsumed
        ? ws.instrumentId
        : ((initialUrlState.hasInstrument ? initialUrlState.instrumentId : savedSettings.instrumentId) || ws.instrumentId);
      populateExchangeSelect(data.exchanges, data.defaultExchangeId, preferredExchangeId);
      const exchange = getSelectedExchange();
      populateMarketSelect(exchange, preferredInstrumentId || exchange.defaultInstrumentId);
      const market = getSelectedMarket(exchange);
      ws.setMarket(exchange.id, market.instrumentId);
      setMarketDisplay(exchange, market);
      exchangeListLoaded = true;
      initialUrlStateConsumed = true;
      updateShareUrl();
      renderFavoriteMarkets();
      maybeRunInitialSimulation();
    } catch (err) {
      exchangeListLoaded = true;
      maybeRunInitialSimulation();
      console.warn('Exchange list fetch failed:', err);
    }
  }

  // Update unit label on amount type change
  amountTypeSelect.addEventListener('change', () => {
    updateAmountUnit();
    updateShareUrl();
    saveCurrentSettings({ statusMessage: '初期設定に保存しました' });
  });

  // Side button toggle
  document.querySelectorAll('[data-side]').forEach(btn => {
    btn.addEventListener('click', () => {
      setSide(btn.dataset.side);
      updateShareUrl();
      saveCurrentSettings({ statusMessage: '初期設定に保存しました' });
    });
  });

  // Simulate
  function runSimulation() {
    const side = sideSelect.value;
    const amountType = amountTypeSelect.value;
    const amount = parseNumberInput(amountInput.value);

    if (isNaN(amount) || amount <= 0) {
      lastSimulationResult = null;
      document.getElementById('simulation-results').innerHTML =
        '<div class="text-yellow-400 text-center py-4">正の数値を入力してください</div>';
      return;
    }

    const feeRatePct = parseNumberInput(feeRateInput.value);
    if (isNaN(feeRatePct) || feeRatePct < 0 || feeRatePct > 100) {
      lastSimulationResult = null;
      document.getElementById('simulation-results').innerHTML =
        '<div class="text-yellow-400 text-center py-4">手数料率は0%以上100%以下で入力してください</div>';
      return;
    }

    ws.simulate(side, amount, amountType, feeRatePct / 100, autoUpdate);
    const exchange = getSelectedExchange();
    const market = getSelectedMarket(exchange);
    lastComparisonParams = {
      exchangeId: exchange.id,
      instrumentId: market.instrumentId,
      side,
      amount,
      amountType,
      feeRate: feeRatePct / 100,
    };
    updateShareUrl();
    saveCurrentSettings();
    loadVenueComparison();
    loadSalesReferenceComparison();
    scheduleComparisonRefresh();
  }

  simulateBtn.addEventListener('click', runSimulation);

  if (copyShareUrlBtn) {
    copyShareUrlBtn.addEventListener('click', copyShareUrl);
  }

  document.addEventListener('click', (event) => {
    const button = event.target && event.target.closest
      ? event.target.closest('[data-export-kind][data-export-format]')
      : null;
    if (!button) return;

    const kind = button.dataset.exportKind;
    const format = button.dataset.exportFormat;
    runExportAction(button, () => (
      format === 'image'
        ? exportImage(kind)
        : Promise.resolve(exportCsv(kind))
    ));
  });

  if (alertTypeSelect) {
    alertTypeSelect.addEventListener('change', syncAlertHelp);
  }

  if (addAlertBtn) {
    addAlertBtn.addEventListener('click', addCurrentAlert);
  }

  if (refreshAlertsBtn) {
    refreshAlertsBtn.addEventListener('click', refreshAlerts);
  }

  if (saveFavoriteBtn) {
    saveFavoriteBtn.addEventListener('click', saveCurrentFavorite);
  }

  if (clearSettingsBtn) {
    clearSettingsBtn.addEventListener('click', () => {
      storageRemove(SETTINGS_STORAGE_KEY);
      setSettingsStatus('次回は標準設定で開きます');
    });
  }

  if (favoriteMarketList) {
    favoriteMarketList.addEventListener('click', (event) => {
      const target = event.target && event.target.closest
        ? event.target.closest('[data-favorite-key], [data-favorite-remove]')
        : null;
      if (!target) return;

      const removeKey = target.dataset.favoriteRemove;
      if (removeKey) {
        favoriteMarkets = favoriteMarkets.filter(item => favoriteKey(item.exchangeId, item.instrumentId) !== removeKey);
        saveFavoriteMarkets();
        renderFavoriteMarkets();
        setSettingsStatus('お気に入りを削除しました');
        return;
      }

      applyFavoriteMarket(target.dataset.favoriteKey);
    });
  }

  if (alertTbody) {
    alertTbody.addEventListener('click', (event) => {
      const button = event.target && event.target.closest
        ? event.target.closest('[data-alert-id]')
        : null;
      if (!button) return;
      const id = button.dataset.alertId;
      localAlerts = localAlerts.filter(alert => alert.id !== id);
      saveLocalAlerts();
      renderAlerts();
    });
  }

  amountInput.addEventListener('input', updateShareUrl);
  feeRateInput.addEventListener('input', () => {
    updateShareUrl();
    saveCurrentSettings();
  });

  amountInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') runSimulation();
  });

  clearBtn.addEventListener('click', () => {
    ws.clearSimulation();
    lastSimulationResult = null;
    setSimulationForChart(null);
    UI.clearSimulationView();
    clearVenueComparison();
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
        stopComparisonRefresh();
      } else if (amountInput.value) {
        runSimulation();
      } else {
        scheduleComparisonRefresh();
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
      updateShareUrl();
      saveCurrentSettings({ statusMessage: '初期設定に保存しました' });
      renderFavoriteMarkets();
    });
  }

  if (marketSelect) {
    marketSelect.addEventListener('change', () => {
      const exchange = getSelectedExchange();
      const market = getSelectedMarket(exchange);
      ws.setMarket(exchange.id, market.instrumentId);
      setMarketDisplay(exchange, market);
      clearMarketState();
      updateShareUrl();
      saveCurrentSettings({ statusMessage: '初期設定に保存しました' });
      renderFavoriteMarkets();
    });
  }

  // WebSocket handlers
  ws.on('connected', () => {
    UI.setConnectionStatus('connected');
    maybeRunInitialSimulation();
  });
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
    const preferredExchangeId = initialUrlStateConsumed
      ? ws.exchangeId
      : ((initialUrlState.hasExchange ? initialUrlState.exchangeId : savedSettings.exchangeId) || ws.exchangeId);
    const preferredInstrumentId = initialUrlStateConsumed
      ? ws.instrumentId
      : ((initialUrlState.hasInstrument ? initialUrlState.instrumentId : savedSettings.instrumentId) || ws.instrumentId);
    populateExchangeSelect(data.exchanges, data.defaultExchangeId, preferredExchangeId);
    const exchange = getSelectedExchange();
    populateMarketSelect(exchange, preferredInstrumentId || exchange.defaultInstrumentId);
    const market = getSelectedMarket(exchange);
    ws.setMarket(exchange.id, market.instrumentId);
    setMarketDisplay(exchange, market);
    exchangeListLoaded = true;
    initialUrlStateConsumed = true;
    updateShareUrl();
    renderFavoriteMarkets();
    maybeRunInitialSimulation();
  });

  ws.on('simulation', (data) => {
    lastSimulationResult = data && !data.error ? data : null;
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
  applyInitialUrlState();
  favoriteMarkets = readFavoriteMarkets();
  renderFavoriteMarkets();
  loadLocalAlerts();
  syncAlertHelp();
  renderAlerts();
  alertRefreshTimer = setInterval(refreshAlerts, ALERT_REFRESH_MS);
  initDepthChart();
  ws.connect();
  loadExchangesFromApi();
  refreshAlerts();
});
