document.addEventListener('DOMContentLoaded', () => {
  const Api = window.AppApi;
  const AppFmt = window.AppFormatters;
  const AppUtil = window.AppUtils;
  const MarketData = window.MarketDataUtils;
  const config = window.MARKET_PAGE || {};
  const instrumentId = String(config.instrumentId || '').toUpperCase();
  const ws = new WSClient();
  const pagePoller = window.PagePoller.create();
  let summary = null;
  let selectedExchangeId = '';
  let comparisonTimer = null;
  let summaryAbortController = null;
  let comparisonAbortController = null;
  let lastComparisonData = null;
  const SUMMARY_REFRESH_MS = 60000;
  const ORDERBOOK_WAITING_MESSAGE = '取引所から板データを取得中です。接続に数秒かかる場合があります。';
  const PARTIAL_DATA_FAILURE_MESSAGE = '一部の取引所APIからデータを取得できていません。取得できた取引所のみで比較しています。';
  const EXCHANGE_ACCENTS = Object.freeze({
    okj: { color: '#35c8d2' },
    coincheck: { color: '#2ed47a' },
    bitflyer: { color: '#1e88ff' },
    bitbank: { color: '#f4c95d' },
    gmo: { color: '#44b9ff' },
    binance_japan: { color: '#f0b90b' },
    bittrade: { color: '#ff5f6d' },
  });
  const DEFAULT_EXCHANGE_ACCENT = Object.freeze({ color: '#8fb0ff' });

  const $ = AppUtil.byId;
  const setText = AppUtil.setText;
  const escapeHtml = AppUtil.escapeHtml;
  const marketPageUrl = AppUtil.marketPageUrl;
  const parseNumberInput = AppUtil.parseNumberInput;
  const fmtPct = AppFmt.pct;
  const fmtDateTime = AppFmt.dateTime;
  const fmtTime = AppFmt.time;
  const fmtJpyPrice = AppFmt.jpyPrice;
  const statusRank = MarketData.statusRank;
  const liveRowStatus = MarketData.liveRowStatus;
  const ageLabel = MarketData.ageLabel;
  const updatedAtLabel = MarketData.updatedAtLabel;
  const summarizeStatuses = MarketData.summarizeStatuses;
  const freshnessBadge = MarketData.freshnessBadge;
  const normalizeExchangeId = exchangeId => String(exchangeId || '').trim().toLowerCase();
  const storageKey = suffix => `okj.market.${instrumentId || 'default'}.${suffix}.v1`;
  const MY_EXCHANGES_STORAGE_KEY = storageKey('myExchanges');
  const MY_EXCHANGES_ONLY_STORAGE_KEY = storageKey('myExchangesOnly');
  const readStoredExchangeSet = () => {
    try {
      const parsed = JSON.parse(localStorage.getItem(MY_EXCHANGES_STORAGE_KEY) || '[]');
      return new Set((Array.isArray(parsed) ? parsed : []).map(normalizeExchangeId).filter(Boolean));
    } catch (_) {
      return new Set();
    }
  };
  const readStoredBoolean = (key) => {
    try {
      return localStorage.getItem(key) === 'true';
    } catch (_) {
      return false;
    }
  };
  const writeStoredExchangeSet = (value) => {
    try {
      localStorage.setItem(MY_EXCHANGES_STORAGE_KEY, JSON.stringify([...value]));
    } catch (_) {
      // noop
    }
  };
  const writeStoredBoolean = (key, value) => {
    try {
      localStorage.setItem(key, value ? 'true' : 'false');
    } catch (_) {
      // noop
    }
  };
  let myExchangeIds = readStoredExchangeSet();
  let showOnlyMyExchanges = readStoredBoolean(MY_EXCHANGES_ONLY_STORAGE_KEY);
  const rowFlashUntilByExchange = new Map();

  function beginnerModeEnabled() {
    return Boolean(window.BeginnerMode && window.BeginnerMode.isEnabled && window.BeginnerMode.isEnabled());
  }

  function termText(expert, beginner) {
    return beginnerModeEnabled() ? beginner : expert;
  }

  function isMyExchange(exchangeId) {
    return myExchangeIds.has(normalizeExchangeId(exchangeId));
  }

  function exchangeAccent(exchangeId) {
    return EXCHANGE_ACCENTS[normalizeExchangeId(exchangeId)] || DEFAULT_EXCHANGE_ACCENT;
  }

  function shouldShowExchange(exchangeId) {
    return !showOnlyMyExchanges || myExchangeIds.size === 0 || isMyExchange(exchangeId);
  }

  function orderRowsForMyExchanges(rows) {
    return (rows || [])
      .filter(row => shouldShowExchange(row.exchangeId))
      .map((row, index) => ({ row, index }))
      .sort((a, b) => {
        const mineDiff = Number(isMyExchange(b.row.exchangeId)) - Number(isMyExchange(a.row.exchangeId));
        return mineDiff || a.index - b.index;
      })
      .map(item => item.row);
  }

  function liveFlashClass(exchangeId) {
    const id = normalizeExchangeId(exchangeId);
    const until = rowFlashUntilByExchange.get(id);
    if (!until) return '';
    if (Date.now() > until) {
      rowFlashUntilByExchange.delete(id);
      return '';
    }
    return 'data-table__row--live-flash';
  }

  function markExchangeUpdated(exchangeId) {
    const id = normalizeExchangeId(exchangeId);
    if (id) rowFlashUntilByExchange.set(id, Date.now() + 900);
  }

  function exchangeIdentityHtml(exchangeId, label, subtext = '') {
    const id = normalizeExchangeId(exchangeId);
    const accent = exchangeAccent(id);
    const myBadge = isMyExchange(id) ? '<span class="exchange-identity__badge">My</span>' : '';
    const safeColor = escapeHtml(accent.color);
    return `
      <div class="exchange-identity" style="--exchange-accent:${safeColor}">
        <span class="exchange-identity__swatch" aria-hidden="true"></span>
        <span class="exchange-identity__copy">
          <span class="exchange-identity__name">${escapeHtml(label || exchangeId || '-')}</span>
          ${subtext ? `<span class="exchange-identity__meta">${escapeHtml(subtext)}</span>` : ''}
        </span>
        ${myBadge}
      </div>
    `;
  }

  function winnerBadge(label, tone = 'gold') {
    return `<span class="market-winner-badge market-winner-badge--${escapeHtml(tone)}">${escapeHtml(label)}</span>`;
  }

  function finiteNumber(value) {
    const num = Number(value);
    return Number.isFinite(num) ? num : null;
  }

  function bestIds(rows, valueSelector, direction = 'min') {
    const values = (rows || [])
      .map(row => ({ row, value: finiteNumber(valueSelector(row)) }))
      .filter(item => item.value != null);
    if (values.length === 0) return new Set();
    const target = direction === 'max'
      ? Math.max(...values.map(item => item.value))
      : Math.min(...values.map(item => item.value));
    return new Set(values
      .filter(item => item.value === target)
      .map(item => normalizeExchangeId(item.row.exchangeId)));
  }

  function spreadTone(value, min, max) {
    const spread = finiteNumber(value);
    if (spread == null) return 'neutral';
    if (min == null || max == null || max <= min) return 'low';
    const ratio = (spread - min) / (max - min);
    if (ratio <= 0.34) return 'low';
    if (ratio <= 0.68) return 'medium';
    return 'high';
  }

  function spreadCostHtml(value, options = {}) {
    const spread = finiteNumber(value);
    const tone = spreadTone(spread, options.min, options.max);
    const label = tone === 'low' ? '低コスト' : (tone === 'high' ? '警戒' : '注意');
    const best = options.best ? winnerBadge('最狭', 'green') : '';
    return `
      <div class="spread-cost-cell spread-cost-cell--${tone}">
        <span class="spread-cost-cell__rate">${spread == null ? '-' : fmtPct(spread)}</span>
        <span class="spread-cost-cell__label">${label}</span>
        ${best}
      </div>
    `;
  }

  function depthMiniChartHtml(orderbook) {
    const bid = finiteNumber(orderbook && orderbook.totalBidDepthJPY);
    const ask = finiteNumber(orderbook && orderbook.totalAskDepthJPY);
    const total = (bid || 0) + (ask || 0);
    if (!bid && !ask) return '';
    const bidPct = total > 0 ? Math.max(3, Math.round((bid / total) * 100)) : 0;
    const askPct = total > 0 ? Math.max(3, Math.round((ask / total) * 100)) : 0;
    return `
      <div class="market-depth-mini" aria-label="板厚比率 Bid ${Fmt.jpyLarge(bid)} Ask ${Fmt.jpyLarge(ask)}">
        <span class="market-depth-mini__side market-depth-mini__side--bid" style="--depth-width:${bidPct}%"></span>
        <span class="market-depth-mini__axis" aria-hidden="true"></span>
        <span class="market-depth-mini__side market-depth-mini__side--ask" style="--depth-width:${askPct}%"></span>
      </div>
    `;
  }

  function shareBarHtml(value) {
    const pct = Math.max(0, Math.min(100, finiteNumber(value) || 0));
    return `
      <div class="market-share-cell" style="--share-width:${pct}%">
        <span class="market-share-cell__value">${fmtPct(value)}</span>
        <span class="market-share-cell__track" aria-hidden="true"><span></span></span>
      </div>
    `;
  }

  function activeQuickAmount() {
    const amountType = $('market-amount-type')?.value === 'base' ? 'base' : 'jpy';
    if (amountType !== 'jpy') return null;
    return parseNumberInput($('market-amount')?.value);
  }

  function syncQuickAmountButtons() {
    const active = activeQuickAmount();
    document.querySelectorAll('[data-market-quick-amount]').forEach((button) => {
      const value = Number(button.dataset.marketQuickAmount);
      button.classList.toggle('is-active', active != null && value === active);
    });
  }

  function setQuickAmount(value) {
    const amountType = $('market-amount-type');
    const amount = $('market-amount');
    if (amountType) amountType.value = 'jpy';
    if (amount) amount.value = String(value);
    syncQuickAmountButtons();
    if (comparisonTimer) clearTimeout(comparisonTimer);
    comparisonTimer = setTimeout(loadComparison, 80);
  }

  function renderExchangePreferences() {
    const host = $('market-exchange-preferences');
    if (!host) return;
    const exchanges = supportedExchanges();
    if (exchanges.length === 0) {
      host.hidden = true;
      return;
    }
    host.hidden = false;
    const selectedCount = exchanges.filter(exchange => isMyExchange(exchange.id)).length;
    const onlyDisabled = selectedCount === 0;
    if (onlyDisabled && showOnlyMyExchanges) {
      showOnlyMyExchanges = false;
      writeStoredBoolean(MY_EXCHANGES_ONLY_STORAGE_KEY, false);
    }
    host.innerHTML = `
      <div class="market-exchange-preferences__header">
        <div>
          <p class="market-exchange-preferences__eyebrow">My Exchanges</p>
          <strong>自分の取引所を上に固定</strong>
          <span>${selectedCount > 0 ? `${selectedCount}社を選択中` : 'チェックすると比較表の先頭に並びます'}</span>
        </div>
        <div class="market-exchange-preferences__actions">
          <button class="market-preference-button ${showOnlyMyExchanges ? 'is-active' : ''}" type="button" data-market-my-only ${onlyDisabled ? 'disabled' : ''}>選択だけ表示</button>
          <button class="market-preference-button" type="button" data-market-my-clear ${onlyDisabled ? 'disabled' : ''}>クリア</button>
        </div>
      </div>
      <div class="market-exchange-chip-row">
        ${exchanges.map(exchange => {
          const id = normalizeExchangeId(exchange.id);
          const checked = isMyExchange(id) ? 'checked' : '';
          const accent = exchangeAccent(id);
          return `
            <label class="market-exchange-chip ${checked ? 'is-active' : ''}" style="--exchange-accent:${escapeHtml(accent.color)}">
              <input type="checkbox" data-market-my-exchange value="${escapeHtml(id)}" ${checked}>
              <span class="exchange-identity__swatch" aria-hidden="true"></span>
              <span>${escapeHtml(exchange.label || exchange.id)}</span>
            </label>
          `;
        }).join('')}
      </div>
    `;
  }

  function rerenderMarketTables() {
    renderExchangePreferences();
    syncQuickAmountButtons();
    if (summary) {
      renderHero();
      renderDomesticComparisonRows();
      renderOrderbookRows();
      renderVolumeRows();
      renderSalesRows();
      updateSelectedOrderbookMeta();
    }
    if (lastComparisonData) renderComparison(lastComparisonData);
  }

  const readOptionalFeeRatePct = (input) => {
    const raw = input && input.value != null ? String(input.value).trim() : '';
    if (!raw) return null;
    const parsed = parseNumberInput(raw);
    return Number.isFinite(parsed) ? parsed : NaN;
  };
  const marketLabel = () => (summary && summary.market && summary.market.label) || config.label || instrumentId;
  const sortedOrderbookRows = () => ((summary && summary.orderbooks) || [])
    .slice()
    .sort((a, b) => {
      const statusDiff = statusRank(liveRowStatus(a)) - statusRank(liveRowStatus(b));
      if (statusDiff !== 0) return statusDiff;
      const spreadDiff = Number(a.spreadPct ?? Infinity) - Number(b.spreadPct ?? Infinity);
      if (spreadDiff !== 0) return spreadDiff;
      return String(a.exchangeLabel || a.exchangeId).localeCompare(String(b.exchangeLabel || b.exchangeId), 'ja');
    });

  function updateFeePresetHint() {
    const hint = $('market-fee-preset-hint');
    const input = $('market-fee-rate');
    if (!hint || !input) return;
    const feeRatePct = readOptionalFeeRatePct(input);
    if (feeRatePct == null) {
      hint.textContent = beginnerModeEnabled()
        ? '未入力なら各取引所の成行手数料を自動で使います。入力すると全取引所を同じ手数料率で比較します。'
        : '未入力なら各取引所の既定 taker 手数料を使って比較します。入力すると全取引所を同じ手数料率で比較します。';
      return;
    }
    if (Number.isNaN(feeRatePct)) {
      hint.textContent = '手数料率は0%以上100%以下で入力してください。';
      return;
    }
    hint.textContent = beginnerModeEnabled()
      ? `現在は ${feeRatePct}% を全取引所に手動適用しています。空に戻すと各社の成行手数料に戻ります。`
      : `現在は ${feeRatePct}% を全取引所に手動適用しています。空に戻すと各取引所の既定手数料に戻ります。`;
  }
  function setEmpty(tbodyId, colspan, message) {
    const tbody = $(tbodyId);
    if (tbody) tbody.innerHTML = `<tr><td colspan="${colspan}" class="text-center text-gray-500 py-4">${escapeHtml(message)}</td></tr>`;
  }

  function supportedExchanges() {
    return (summary && summary.exchanges) || [];
  }

  function selectedExchange() {
    return supportedExchanges().find(exchange => exchange.id === selectedExchangeId) || supportedExchanges()[0] || null;
  }

  function selectedOrderbookRow() {
    return ((summary && summary.orderbooks) || []).find(row => row.exchangeId === selectedExchangeId) || null;
  }

  function updatePageLabels() {
    const label = marketLabel();
    const navLink = $('market-page-nav-link');
    document.title = `${label} 結論・国内取引所比較・銘柄特徴｜国内暗号資産取引所ナビ`;
    setText('market-page-title', `${label} 銘柄ページ`);
    setText('market-page-subtitle', '結論・国内取引所比較・銘柄特徴');
    setText('market-hero-title', `${label} 国内取引所データ`);
    setText('market-footer-label', `${label} 銘柄ページ`);
    setText('market-summary-title', `${label} 比較サマリー`);
    if (navLink) {
      navLink.href = marketPageUrl(instrumentId);
      navLink.title = `${label} 銘柄ページ`;
    }
  }

  function populateBoardExchangeSelect() {
    const select = $('market-board-exchange');
    if (!select) return;
    const exchanges = supportedExchanges();
    if (exchanges.length === 0) return;

    if (!selectedExchangeId || !exchanges.some(exchange => exchange.id === selectedExchangeId)) {
      const rows = sortedOrderbookRows();
      const fresh = rows.find(row => liveRowStatus(row) === 'fresh');
      const stale = rows.find(row => liveRowStatus(row) === 'stale');
      selectedExchangeId = fresh ? fresh.exchangeId : (stale ? stale.exchangeId : exchanges[0].id);
    }

    select.innerHTML = exchanges.map(exchange => `
      <option value="${escapeHtml(exchange.id)}">${escapeHtml(exchange.label || exchange.id)}</option>
    `).join('');
    select.value = selectedExchangeId;
  }

  function updateSelectedOrderbookMeta() {
    const exchange = selectedExchange();
    if (!exchange) return;
    const row = selectedOrderbookRow();
    const status = liveRowStatus(row);
    const source = row && row.source ? ` / ${String(row.source).toUpperCase()}` : '';
    const stale = status === 'stale' ? ' / STALE' : '';
    const updated = row && (status === 'fresh' || status === 'stale')
      ? ` / 最終更新 ${ageLabel(row)}`
      : '';
    setText('orderbook-meta', `${exchange.label || exchange.id} / ${marketLabel()} の板${source}${stale}${updated}`);
  }

  function connectSelectedOrderbook() {
    const exchange = selectedExchange();
    if (!exchange) return;
    selectedExchangeId = exchange.id;
    ws.setMarket(exchange.id, instrumentId);
    if (typeof setChartBaseCurrency === 'function') {
      setChartBaseCurrency((summary.market && summary.market.baseCurrency) || instrumentId.split('-')[0] || 'BTC');
    }
    updateSelectedOrderbookMeta();
  }

  function renderHero() {
    const rows = sortedOrderbookRows();
    const counts = summarizeStatuses(rows);
    const freshRows = rows.filter(row => liveRowStatus(row) === 'fresh');
    const bestBid = freshRows
      .filter(row => Number.isFinite(Number(row.bestBid)))
      .sort((a, b) => Number(b.bestBid) - Number(a.bestBid))[0];
    const bestAsk = freshRows
      .filter(row => Number.isFinite(Number(row.bestAsk)))
      .sort((a, b) => Number(a.bestAsk) - Number(b.bestAsk))[0];
    let statusText = '板データ取得中';
    if (counts.fresh > 0 && counts.stale > 0) statusText = '鮮度注意';
    else if (counts.fresh > 0) statusText = '集計済み';
    else if (counts.stale > 0) statusText = '鮮度切れ';
    setText('market-status', statusText);
    setText('market-updated-at', fmtDateTime(summary.meta && summary.meta.generatedAt));
    setText('market-exchange-count', `${supportedExchanges().length}社`);
    setText('market-best-bid', bestBid ? `${bestBid.exchangeLabel} ${fmtJpyPrice(bestBid.bestBid)}` : '-');
    setText('market-best-ask', bestAsk ? `${bestAsk.exchangeLabel} ${fmtJpyPrice(bestAsk.bestAsk)}` : '-');
    setText('market-hero-meta', `板 新鮮 ${counts.fresh}社 / stale ${counts.stale}社 / 待機 ${counts.waiting}社 | 出来高 ${summary.volume.rows.length}件 | 販売所 ${summary.sales.rows.length}件`);
  }

  function setSnapshotMetric(key, value, meta) {
    setText(`market-summary-${key}`, value);
    setText(`market-summary-${key}-meta`, meta);
  }

  function fundingSupportSummary() {
    const exchanges = supportedExchanges();
    const supportedCount = exchanges.filter(exchange => (
      exchange
      && exchange.funding
      && exchange.funding.fiatDeposit
      && exchange.funding.fiatWithdrawal
      && exchange.funding.cryptoDeposit
      && exchange.funding.cryptoWithdrawal
    )).length;
    return {
      exchangeCount: exchanges.length,
      supportedCount,
      summary: supportedCount === exchanges.length && exchanges.length > 0
        ? `${supportedCount}社すべて`
        : `${supportedCount}/${exchanges.length}社`,
      note: 'JPY入出金・暗号資産入出庫は銀行、銘柄、ネットワークごとの条件を公式確認',
    };
  }

  function renderSnapshot(snapshotData) {
    const snapshot = snapshotData && typeof snapshotData === 'object' ? snapshotData : null;
    const defaultExchangeCount = supportedExchanges().length;
    const funding = (snapshot && snapshot.fundingSupport)
      || (summary && summary.domesticComparison && summary.domesticComparison.meta && summary.domesticComparison.meta.fundingSupport)
      || fundingSupportSummary();
    const amount = snapshot && snapshot.comparisonAmount ? Number(snapshot.comparisonAmount.amount) : NaN;
    const freshnessNote = snapshot && snapshot.boardFreshness === 'stale'
      ? '現在は stale 板を含む参考値です'
      : '板は fresh データを優先して集計しています';
    const assumption = Number.isFinite(amount)
      ? `${fmtJpyPrice(amount)}買い / 各取引所既定 taker / ${freshnessNote}`
      : `10万円買い / 各取引所既定 taker / ${freshnessNote}`;
    setText('market-summary-assumption', assumption);

    setSnapshotMetric('exchange-count', `${snapshot && Number.isFinite(Number(snapshot.exchangeCount)) ? Number(snapshot.exchangeCount) : defaultExchangeCount}社`, '国内現物の対応数');
    setSnapshotMetric(
      'best-ask',
      snapshot && snapshot.bestAsk ? fmtJpyPrice(snapshot.bestAsk.price) : 'データ待ち',
      snapshot && snapshot.bestAsk ? snapshot.bestAsk.exchangeLabel : ORDERBOOK_WAITING_MESSAGE
    );
    setSnapshotMetric(
      'best-bid',
      snapshot && snapshot.bestBid ? fmtJpyPrice(snapshot.bestBid.price) : 'データ待ち',
      snapshot && snapshot.bestBid ? snapshot.bestBid.exchangeLabel : ORDERBOOK_WAITING_MESSAGE
    );
    setSnapshotMetric(
      'thickest-book',
      snapshot && snapshot.thickestBook ? snapshot.thickestBook.exchangeLabel : 'データ待ち',
      snapshot && snapshot.thickestBook ? `可視板厚 ${Fmt.jpyLarge(snapshot.thickestBook.visibleDepthJPY)}` : 'Bid + Ask 可視深さ'
    );
    setSnapshotMetric(
      'cheapest-buy',
      snapshot && snapshot.cheapestBuy ? snapshot.cheapestBuy.exchangeLabel : 'データ待ち',
      snapshot && snapshot.cheapestBuy
        ? `${snapshot.cheapestBuy.executionStatusLabel || '参考値'} / 実効VWAP ${fmtJpyPrice(snapshot.cheapestBuy.effectiveVWAP)}`
        : '買い / 100,000円 / 既定手数料'
    );
    setSnapshotMetric(
      'tightest-sales',
      snapshot && snapshot.tightestSalesSpread ? snapshot.tightestSalesSpread.exchangeLabel : 'データ待ち',
      snapshot && snapshot.tightestSalesSpread ? fmtPct(snapshot.tightestSalesSpread.spreadPct) : '販売所データ待ち'
    );
    setSnapshotMetric(
      'funding-support',
      funding ? funding.summary : '公式確認',
      funding ? funding.note : 'JPY入出金・暗号資産入出庫は公式条件確認'
    );
    setSnapshotMetric(
      'top-volume',
      snapshot && snapshot.topVolume ? snapshot.topVolume.exchangeLabel : 'データ待ち',
      snapshot && snapshot.topVolume ? `24h出来高 ${Fmt.jpyLarge(snapshot.topVolume.quoteVolume)}` : '出来高データを取得中です'
    );
  }

  function fundingLabel(funding) {
    if (!funding) return '公式条件確認';
    const summaryText = funding.summary || 'JPY入出金 / 暗号資産入出庫';
    const statusText = funding.statusLabel || '公式条件確認';
    return `${summaryText} (${statusText})`;
  }

  function renderDomesticComparisonRows() {
    const tbody = $('market-domestic-comparison-tbody');
    if (!tbody) return;
    const domestic = summary && summary.domesticComparison ? summary.domesticComparison : null;
    const rawRows = Array.isArray(domestic && domestic.rows) ? domestic.rows : [];
    const rows = orderRowsForMyExchanges(rawRows);
    const meta = domestic && domestic.meta ? domestic.meta : {};
    const baseCurrency = (summary && summary.market && summary.market.baseCurrency) || instrumentId.split('-')[0] || '';
    const counts = summarizeStatuses(rawRows.map(row => row.orderbook || {}));
    setText(
      'market-domestic-comparison-meta',
      `${marketLabel()} | 10万円買い / ${termText('各取引所既定 taker', '各社の成行手数料')} | 対応 ${meta.exchangeCount || rawRows.length || supportedExchanges().length}社${showOnlyMyExchanges && myExchangeIds.size > 0 ? ` / マイ取引所 ${rows.length}社表示` : ''} | 板 fresh ${counts.fresh || 0}社 / 待機 ${counts.waiting || 0}社`
    );

    if (rawRows.length === 0) {
      setEmpty('market-domestic-comparison-tbody', 6, '国内取引所比較データを取得中です。');
      return;
    }
    if (rows.length === 0) {
      setEmpty('market-domestic-comparison-tbody', 6, 'マイ取引所に一致する行がありません。選択だけ表示を解除してください。');
      return;
    }

    const readySalesRows = rows.filter(row => row.salesSpread && row.salesSpread.status === 'ready' && Number.isFinite(Number(row.salesSpread.spreadPct)));
    const salesValues = readySalesRows.map(row => Number(row.salesSpread.spreadPct));
    const minSales = salesValues.length > 0 ? Math.min(...salesValues) : null;
    const maxSales = salesValues.length > 0 ? Math.max(...salesValues) : null;
    const bestSalesIds = bestIds(readySalesRows, row => row.salesSpread.spreadPct, 'min');
    const bestDepthIds = bestIds(rows.filter(row => row.orderbook && (row.orderbook.status === 'fresh' || row.orderbook.status === 'stale')), row => row.orderbook.visibleDepthJPY, 'max');

    tbody.innerHTML = rows.map((row) => {
      const orderbook = row.orderbook || {};
      const orderbookStatus = liveRowStatus(orderbook);
      const hasBook = orderbookStatus === 'fresh' || orderbookStatus === 'stale';
      const cost = row.cost100k || {};
      const costReady = cost.status === 'fresh' && cost.executionStatus && Number.isFinite(Number(cost.totalBaseFilled));
      const sales = row.salesSpread || {};
      const salesReady = sales.status === 'ready' && Number.isFinite(Number(sales.spreadPct));
      const rowClass = [
        cost.rank === 1 && costReady ? 'data-table__row--rank-1' : '',
        isMyExchange(row.exchangeId) ? 'data-table__row--my-exchange' : '',
        orderbookStatus === 'stale' ? 'data-table__row--stale' : '',
        liveFlashClass(row.exchangeId),
      ].filter(Boolean).join(' ');
      const costStatus = costReady
        ? (cost.executionStatusLabel || '参考値')
        : (cost.status === 'stale' ? '板データが古い' : (cost.message || ORDERBOOK_WAITING_MESSAGE));
      const isBestSales = bestSalesIds.has(normalizeExchangeId(row.exchangeId));
      const isBestDepth = bestDepthIds.has(normalizeExchangeId(row.exchangeId));
      const costCellClass = costReady && cost.rank === 1 ? 'market-cell-highlight market-cell-highlight--gold' : '';
      const depthCellClass = hasBook && isBestDepth ? 'market-cell-highlight market-cell-highlight--green' : '';
      const salesCellClass = salesReady && isBestSales ? 'market-cell-highlight market-cell-highlight--green' : '';

      return `
        <tr class="border-b border-gray-800/60 ${rowClass}">
          <td class="text-left" data-label="対応取引所">
            ${exchangeIdentityHtml(row.exchangeId, row.exchangeLabel || row.exchangeId, `対応銘柄 / ${row.instrumentLabel || instrumentId}`)}
          </td>
          <td class="is-num text-right font-mono" data-label="最良Bid / Ask">
            <div class="text-green-300">Bid ${hasBook ? fmtJpyPrice(orderbook.bestBid) : '-'}</div>
            <div class="text-red-300">Ask ${hasBook ? fmtJpyPrice(orderbook.bestAsk) : '-'}</div>
            <div class="text-[10px] text-gray-500">${hasBook ? `Spread ${fmtPct(orderbook.spreadPct)}` : escapeHtml(orderbook.message || ORDERBOOK_WAITING_MESSAGE)}</div>
            ${freshnessBadge(orderbookStatus)}
          </td>
          <td class="is-num text-right font-mono ${depthCellClass}" data-label="板厚">
            <div class="text-gray-200">${hasBook ? Fmt.jpyLarge(orderbook.visibleDepthJPY) : '-'}</div>
            <div class="text-[10px] text-gray-500">${hasBook ? 'Bid + Ask可視深さ' : '-'}</div>
            ${hasBook ? depthMiniChartHtml(orderbook) : ''}
            ${hasBook && isBestDepth ? winnerBadge('最大板厚', 'green') : ''}
          </td>
          <td class="is-num text-right font-mono ${costCellClass}" data-label="10万円買い">
            <div class="${costReady ? 'text-red-300' : 'text-gray-500'}">${costReady ? `${cost.rank ? `#${cost.rank} ` : ''}${Fmt.baseCompact(cost.totalBaseFilled)} ${escapeHtml(baseCurrency)}` : '-'}</div>
            <div class="text-[10px] text-gray-500">${costReady ? `${termText('VWAP', '平均価格')} ${fmtJpyPrice(cost.effectiveVWAP)} / ${termText('Impact', '影響度')} ${fmtPct(cost.marketImpactPct)}` : escapeHtml(costStatus)}</div>
            ${costReady && cost.rank === 1 ? winnerBadge('10万円買い最良') : ''}
          </td>
          <td class="is-num text-right font-mono ${salesCellClass}" data-label="販売所Spread">
            ${salesReady ? spreadCostHtml(sales.spreadPct, { min: minSales, max: maxSales, best: isBestSales }) : '<div class="text-gray-500">-</div>'}
            <div class="text-[10px] text-gray-500">${salesReady ? `買 ${fmtJpyPrice(sales.buyPrice)} / 売 ${fmtJpyPrice(sales.sellPrice)}` : escapeHtml(sales.message || '販売所データなし')}</div>
          </td>
          <td class="text-left" data-label="入出金対応">
            <div class="font-bold text-gray-200">${escapeHtml(fundingLabel(row.funding))}</div>
            <div class="text-[10px] text-gray-500">${escapeHtml((row.funding && row.funding.note) || '銀行・銘柄・ネットワーク別の条件は公式確認')}</div>
          </td>
        </tr>
      `;
    }).join('');
  }

  function renderOrderbookRows() {
    const tbody = $('market-orderbook-tbody');
    if (!tbody) return;
    const rawRows = sortedOrderbookRows();
    const rows = orderRowsForMyExchanges(rawRows);
    if (rawRows.length === 0) {
      setEmpty('market-orderbook-tbody', 5, 'この銘柄の板を取得できる取引所がまだありません。');
      return;
    }
    if (rows.length === 0) {
      setEmpty('market-orderbook-tbody', 5, 'マイ取引所に一致する板データがありません。選択だけ表示を解除してください。');
      return;
    }

    tbody.innerHTML = rows.map(row => {
      const status = liveRowStatus(row);
      const hasBook = status === 'fresh' || status === 'stale';
      const rowClass = [
        status === 'stale' ? 'data-table__row--stale' : '',
        isMyExchange(row.exchangeId) ? 'data-table__row--my-exchange' : '',
        liveFlashClass(row.exchangeId),
      ].filter(Boolean).join(' ');
      return `
        <tr class="border-b border-gray-800/60 ${rowClass}">
          <td class="text-left" data-label="取引所">
            ${exchangeIdentityHtml(row.exchangeId, row.exchangeLabel || row.exchangeId, hasBook ? String(row.source || '-').toUpperCase() : (row.message || ORDERBOOK_WAITING_MESSAGE))}
          </td>
          <td class="is-num text-right font-mono text-green-300" data-label="Bid">${hasBook ? fmtJpyPrice(row.bestBid) : '-'}</td>
          <td class="is-num text-right font-mono text-red-300" data-label="Ask">${hasBook ? fmtJpyPrice(row.bestAsk) : '-'}</td>
          <td class="is-num text-right font-mono text-yellow-300" data-label="Spread">${hasBook ? fmtPct(row.spreadPct) : '-'}</td>
          <td class="text-right font-mono text-gray-400" data-label="更新">
            <div>${hasBook ? escapeHtml(updatedAtLabel(row)) : '-'}</div>
            <div class="text-[10px] text-gray-500">${hasBook ? escapeHtml(ageLabel(row)) : escapeHtml(row.message || ORDERBOOK_WAITING_MESSAGE)}</div>
            ${freshnessBadge(status)}
          </td>
        </tr>
      `;
    }).join('');
  }

  function renderVolumeRows() {
    const rawRows = ((summary.volume && summary.volume.rows) || [])
      .slice()
      .sort((a, b) => Number(b.quoteVolume || 0) - Number(a.quoteVolume || 0));
    const rows = orderRowsForMyExchanges(rawRows);
    if (rawRows.length === 0) {
      setEmpty('market-volume-tbody', 4, '出来高データを取得中です。取得でき次第、取引所ごとの流動性を表示します。');
      return;
    }
    if (rows.length === 0) {
      setEmpty('market-volume-tbody', 4, 'マイ取引所に一致する出来高データがありません。選択だけ表示を解除してください。');
      return;
    }

    const tbody = $('market-volume-tbody');
    const topVolumeIds = bestIds(rows, row => row.quoteVolume, 'max');
    tbody.innerHTML = rows.map(row => `
      <tr class="border-b border-gray-800/60 ${isMyExchange(row.exchangeId) ? 'data-table__row--my-exchange' : ''}">
        <td class="font-bold text-gray-200" data-label="取引所">${exchangeIdentityHtml(row.exchangeId, row.exchangeLabel || row.exchangeId)}</td>
        <td class="is-num text-right font-mono text-gray-300" data-label="出来高">${Fmt.jpyLarge(row.quoteVolume)}</td>
        <td class="is-num text-right font-mono" data-label="銘柄内シェア">
          ${shareBarHtml(row.instrumentSharePct)}
          ${topVolumeIds.has(normalizeExchangeId(row.exchangeId)) ? winnerBadge('首位', 'green') : ''}
        </td>
        <td class="text-right font-mono text-gray-400" data-label="取得">${fmtDateTime(row.lastFetchedAt || row.capturedAt)}</td>
      </tr>
    `).join('');
  }

  function renderSalesRows() {
    const rawRows = ((summary.sales && summary.sales.rows) || [])
      .slice()
      .sort((a, b) => {
        const aPct = a.latest && Number(a.latest.spreadPct);
        const bPct = b.latest && Number(b.latest.spreadPct);
        if (Number.isFinite(aPct) && Number.isFinite(bPct)) return aPct - bPct;
        return String(a.exchangeLabel).localeCompare(String(b.exchangeLabel), 'ja');
      });
    const rows = orderRowsForMyExchanges(rawRows);
    if (rawRows.length === 0) {
      setEmpty('market-sales-tbody', 5, '販売所価格を取得中です。取得できた販売所から順に比較します。');
      return;
    }
    if (rows.length === 0) {
      setEmpty('market-sales-tbody', 5, 'マイ取引所に一致する販売所データがありません。選択だけ表示を解除してください。');
      return;
    }

    const tbody = $('market-sales-tbody');
    const spreadValues = rows
      .map(row => finiteNumber(row.latest && row.latest.spreadPct))
      .filter(value => value != null);
    const minSales = spreadValues.length > 0 ? Math.min(...spreadValues) : null;
    const maxSales = spreadValues.length > 0 ? Math.max(...spreadValues) : null;
    const bestSalesIds = bestIds(rows, row => row.latest && row.latest.spreadPct, 'min');
    tbody.innerHTML = rows.map(row => {
      const latest = row.latest || {};
      const isBestSales = bestSalesIds.has(normalizeExchangeId(row.exchangeId));
      return `
        <tr class="border-b border-gray-800/60 ${isMyExchange(row.exchangeId) ? 'data-table__row--my-exchange' : ''}">
          <td class="font-bold text-gray-200" data-label="販売所">${exchangeIdentityHtml(row.exchangeId, row.exchangeLabel || row.exchangeId)}</td>
          <td class="is-num text-right font-mono text-red-300" data-label="買値">${fmtJpyPrice(latest.buyPrice)}</td>
          <td class="is-num text-right font-mono text-green-300" data-label="売値">${fmtJpyPrice(latest.sellPrice)}</td>
          <td class="is-num text-right font-mono ${isBestSales ? 'market-cell-highlight market-cell-highlight--green' : ''}" data-label="Spread">${spreadCostHtml(latest.spreadPct, { min: minSales, max: maxSales, best: isBestSales })}</td>
          <td class="text-right font-mono text-gray-400" data-label="取得">${fmtDateTime(latest.priceTimestamp || latest.capturedAt)}</td>
        </tr>
      `;
    }).join('');
  }

  function comparisonStatusClass(status) {
    return {
      executable: 'text-green-300',
      invalid_constraints: 'text-red-300',
      insufficient_liquidity: 'text-yellow-300',
      auto_cancel: 'text-yellow-300',
      circuit_breaker: 'text-red-300',
    }[status] || 'text-gray-300';
  }

  function comparisonReasonText(result) {
    if (!result) return '';
    const firstBlockingReason = Array.isArray(result.blockingReasons) ? result.blockingReasons[0] : '';
    if (firstBlockingReason) return firstBlockingReason;
    const firstConstraintNote = Array.isArray(result.constraintNotes) ? result.constraintNotes[0] : '';
    if (firstConstraintNote) return firstConstraintNote;
    return result.recommendedAction || '';
  }

  function comparisonAmountLabel(meta) {
    if (!meta) return '-';
    if (meta.amountType === 'jpy') return Fmt.jpy(meta.amount);
    return `${Fmt.baseCompact(meta.amount)} ${(summary.market && summary.market.baseCurrency) || instrumentId.split('-')[0] || ''}`;
  }

  async function loadComparison() {
    const side = $('market-side')?.value === 'sell' ? 'sell' : 'buy';
    const amountType = $('market-amount-type')?.value === 'base' ? 'base' : 'jpy';
    const amount = parseNumberInput($('market-amount')?.value);
    const feeRatePct = readOptionalFeeRatePct($('market-fee-rate'));
    if (comparisonAbortController) {
      comparisonAbortController.abort();
      comparisonAbortController = null;
    }
    if (!Number.isFinite(amount) || amount <= 0 || Number.isNaN(feeRatePct) || (feeRatePct != null && (feeRatePct < 0 || feeRatePct > 100))) {
      lastComparisonData = null;
      setEmpty('market-comparison-tbody', 6, '数量または金額、手数料率を確認してください。');
      return;
    }

    const params = new URLSearchParams({
      instrumentId,
      side,
      amountType,
      amount: String(amount),
    });
    if (feeRatePct != null) {
      params.set('feeRate', String(feeRatePct / 100));
    }
    const controller = new AbortController();
    comparisonAbortController = controller;
    try {
      const data = await Api.fetchJson(`/api/market-impact-comparison?${params.toString()}`, {
        signal: controller.signal,
      });
      renderComparison(data);
    } catch (err) {
      if (err.name === 'AbortError') return;
      lastComparisonData = null;
      setText('market-comparison-meta', '比較データを取得できませんでした。');
      setEmpty('market-comparison-tbody', 6, '比較データを取得できませんでした。時間をおいて再度お試しください。');
    } finally {
      if (comparisonAbortController === controller) {
        comparisonAbortController = null;
      }
    }
  }

  function renderComparison(data) {
    lastComparisonData = data && typeof data === 'object' ? data : null;
    const rawRows = Array.isArray(data && data.rows) ? data.rows : [];
    const rows = orderRowsForMyExchanges(rawRows);
    const meta = data.meta || {};
    const counts = summarizeStatuses(rawRows);
    setText('market-comparison-meta', `${marketLabel()} | ${meta.side === 'sell' ? '売り' : '買い'} | ${comparisonAmountLabel(meta)} | ${termText('手数料', '成行手数料')} ${meta.feeRate == null ? termText('各取引所既定', '各社の既定値') : fmtPct(meta.feeRate * 100)}${showOnlyMyExchanges && myExchangeIds.size > 0 ? ` | マイ取引所 ${rows.length}件表示` : ''} | 新鮮 ${counts.fresh || 0}件 / stale ${counts.stale || 0}件 / 待機 ${counts.waiting || 0}件${counts.waiting > 0 ? ` | ${PARTIAL_DATA_FAILURE_MESSAGE}` : ''}`);
    if (rawRows.length === 0) {
      setEmpty('market-comparison-tbody', 6, '比較できる取引所がありません。別の銘柄または条件で確認してください。');
      return;
    }
    if (rows.length === 0) {
      setEmpty('market-comparison-tbody', 6, 'マイ取引所に一致する比較行がありません。選択だけ表示を解除してください。');
      return;
    }

    const isSell = meta.side === 'sell';
    const tbody = $('market-comparison-tbody');
    tbody.innerHTML = rows.map(row => {
      const result = row.result || null;
      const status = liveRowStatus(row);
      const ready = status === 'fresh' && result && !result.error;
      const fixedQuote = meta.amountType === 'jpy';
      const value = ready
        ? (fixedQuote ? `${Fmt.baseCompact(result.totalBTCFilled)} ${(row.baseCurrency || '').toUpperCase()}` : Fmt.jpy(result.effectiveCostJPY))
        : '-';
      const vwap = ready ? Fmt.jpy(result.effectiveVWAP) : '-';
      const statusText = ready
        ? (result.executionStatusLabel || '発注可能')
        : (status === 'stale' ? '板データが古いため比較停止' : (row.message || ORDERBOOK_WAITING_MESSAGE));
      const statusSub = ready
        ? comparisonReasonText(result)
        : (status === 'fresh' || status === 'stale' ? `最終更新 ${ageLabel(row)}` : '');
      const valueClass = ready ? (isSell ? 'text-green-300' : 'text-red-300') : 'text-gray-500';
      const statusClass = ready
        ? comparisonStatusClass(result.executionStatus)
        : (status === 'stale' ? 'text-yellow-300' : 'text-gray-500');
      const rowClass = [
        row.rank === 1 && ready ? 'data-table__row--rank-1' : '',
        isMyExchange(row.exchangeId) ? 'data-table__row--my-exchange' : '',
        status === 'stale' ? 'data-table__row--stale' : '',
        liveFlashClass(row.exchangeId),
      ].filter(Boolean).join(' ');
      const resultCellClass = ready && row.rank === 1 ? 'market-cell-highlight market-cell-highlight--gold' : '';
      return `
        <tr class="border-b border-gray-800/60 ${rowClass}">
          <td class="is-num text-right font-mono text-gray-300" data-label="順位">${ready && row.rank ? `#${row.rank}` : '-'}</td>
          <td class="text-left" data-label="取引所">
            ${exchangeIdentityHtml(row.exchangeId, row.exchangeLabel || row.exchangeId, String(row.source || '-').toUpperCase())}
          </td>
          <td class="is-num text-right font-mono ${valueClass} ${resultCellClass}" data-label="結果">
            <div>${value}</div>
            ${ready && row.rank === 1 ? winnerBadge(isSell ? '売却最良' : '購入最良') : ''}
          </td>
          <td class="is-num text-right font-mono text-gray-300" data-label="${termText('VWAP', '平均購入価格')}">${vwap}</td>
          <td class="is-num text-right font-mono text-yellow-300" data-label="${termText('Impact', '値幅への影響度')}">${ready ? fmtPct(result.marketImpactPct) : '-'}</td>
          <td class="${statusClass}" data-label="判定">
            <div class="font-bold">${escapeHtml(statusText)}</div>
            ${statusSub ? `<div class="text-[10px] text-gray-500">${escapeHtml(statusSub)}</div>` : ''}
            ${freshnessBadge(status)}
          </td>
        </tr>
      `;
    }).join('');
  }

  function renderSummary(data) {
    summary = data;
    updatePageLabels();
    updateFeePresetHint();
    populateBoardExchangeSelect();
    renderSnapshot(summary && summary.snapshot);
    renderHero();
    renderExchangePreferences();
    renderDomesticComparisonRows();
    renderOrderbookRows();
    renderVolumeRows();
    renderSalesRows();
    syncQuickAmountButtons();
    connectSelectedOrderbook();
  }

  async function loadSummary() {
    if (summaryAbortController) {
      summaryAbortController.abort();
      summaryAbortController = null;
    }
    const controller = new AbortController();
    summaryAbortController = controller;
    try {
      const data = await Api.fetchJson(`/api/markets/${encodeURIComponent(instrumentId)}`, {
        signal: controller.signal,
      });
      renderSummary(data);
      void loadComparison();
    } catch (err) {
      if (err.name === 'AbortError') return;
      setText('market-status', '取得できませんでした');
      setText('market-hero-meta', '銘柄データを取得できませんでした。時間をおいて再読み込みしてください。');
    } finally {
      if (summaryAbortController === controller) {
        summaryAbortController = null;
      }
    }
  }

  const summaryRefreshTask = pagePoller.createTask({
    intervalMs: SUMMARY_REFRESH_MS,
    callback: loadSummary,
  });

  const freshnessTask = pagePoller.createTask({
    intervalMs: 1000,
    callback: () => {
      if (summary) {
        renderHero();
        renderDomesticComparisonRows();
        renderOrderbookRows();
        updateSelectedOrderbookMeta();
      }
      if (lastComparisonData) renderComparison(lastComparisonData);
    },
  });

  const boardSelect = $('market-board-exchange');
  if (boardSelect) {
    boardSelect.addEventListener('change', () => {
      selectedExchangeId = boardSelect.value;
      connectSelectedOrderbook();
    });
  }

  ['market-side', 'market-amount-type', 'market-amount', 'market-fee-rate'].forEach((id) => {
    const el = $(id);
    if (!el) return;
    const eventName = el.tagName === 'SELECT' ? 'change' : 'input';
    el.addEventListener(eventName, () => {
      if (id === 'market-fee-rate') updateFeePresetHint();
      syncQuickAmountButtons();
      if (comparisonTimer) clearTimeout(comparisonTimer);
      comparisonTimer = setTimeout(loadComparison, 250);
    });
  });

  document.querySelectorAll('[data-market-quick-amount]').forEach((button) => {
    button.addEventListener('click', () => {
      const value = Number(button.dataset.marketQuickAmount);
      if (!Number.isFinite(value)) return;
      button.classList.remove('market-quick-amount--pulse');
      void button.offsetWidth;
      button.classList.add('market-quick-amount--pulse');
      setQuickAmount(value);
    });
  });

  const preferenceHost = $('market-exchange-preferences');
  if (preferenceHost) {
    preferenceHost.addEventListener('change', (event) => {
      const input = event.target && event.target.closest ? event.target.closest('[data-market-my-exchange]') : null;
      if (!input) return;
      const id = normalizeExchangeId(input.value);
      if (!id) return;
      if (input.checked) myExchangeIds.add(id);
      else myExchangeIds.delete(id);
      writeStoredExchangeSet(myExchangeIds);
      if (myExchangeIds.size === 0) {
        showOnlyMyExchanges = false;
        writeStoredBoolean(MY_EXCHANGES_ONLY_STORAGE_KEY, false);
      }
      rerenderMarketTables();
    });
    preferenceHost.addEventListener('click', (event) => {
      const target = event.target && event.target.closest ? event.target : null;
      if (!target) return;
      const onlyButton = target.closest('[data-market-my-only]');
      const clearButton = target.closest('[data-market-my-clear]');
      if (onlyButton) {
        showOnlyMyExchanges = !showOnlyMyExchanges;
        writeStoredBoolean(MY_EXCHANGES_ONLY_STORAGE_KEY, showOnlyMyExchanges);
        rerenderMarketTables();
      } else if (clearButton) {
        myExchangeIds = new Set();
        showOnlyMyExchanges = false;
        writeStoredExchangeSet(myExchangeIds);
        writeStoredBoolean(MY_EXCHANGES_ONLY_STORAGE_KEY, false);
        rerenderMarketTables();
      }
    });
  }

  window.addEventListener('okj:beginner-mode-change', () => {
    updateFeePresetHint();
    rerenderMarketTables();
  });

  ws.on('connected', () => {
    connectSelectedOrderbook();
  });
  ws.on('orderbook', (data) => {
    if (!data || data.instrumentId !== instrumentId || data.exchangeId !== selectedExchangeId) return;
    markExchangeUpdated(data.exchangeId);
    if (summary && Array.isArray(summary.orderbooks)) {
      const index = summary.orderbooks.findIndex(row => row.exchangeId === data.exchangeId && row.instrumentId === data.instrumentId);
      if (index >= 0) {
        summary.orderbooks[index] = {
          ...summary.orderbooks[index],
          ...data,
          exchangeLabel: summary.orderbooks[index].exchangeLabel || data.exchange?.label || data.exchangeId,
          instrumentLabel: summary.orderbooks[index].instrumentLabel || data.market?.label || data.instrumentId,
          status: 'fresh',
          freshnessStatus: 'fresh',
          message: null,
        };
      }
      const domesticRows = summary.domesticComparison && Array.isArray(summary.domesticComparison.rows)
        ? summary.domesticComparison.rows
        : [];
      const domesticRow = domesticRows.find(row => row.exchangeId === data.exchangeId && row.instrumentId === data.instrumentId);
      if (domesticRow) {
        domesticRow.orderbook = {
          ...domesticRow.orderbook,
          status: 'fresh',
          message: null,
          bestBid: data.bestBid,
          bestAsk: data.bestAsk,
          spreadPct: data.spreadPct,
          totalAskDepthJPY: data.totalAskDepthJPY,
          totalBidDepthJPY: data.totalBidDepthJPY,
          visibleDepthJPY: Number(data.totalAskDepthJPY || 0) + Number(data.totalBidDepthJPY || 0),
          updatedAt: data.updatedAt || data.timestamp || data.receivedAt || null,
          staleAfterMs: data.staleAfterMs || null,
          source: data.source || null,
        };
      }
    }
    updateSelectedOrderbookMeta();
    setChartBaseCurrency(data.market?.baseCurrency || (summary.market && summary.market.baseCurrency) || 'BTC');
    updateDepthChart(data.depthChart, data.midPrice);
    if (summary) {
      renderHero();
      renderDomesticComparisonRows();
      renderOrderbookRows();
    }
  });

  initDepthChart();
  updateFeePresetHint();
  loadSummary();
  ws.connect();
  summaryRefreshTask.start({ immediate: false });
  freshnessTask.start({ immediate: false });
  window.addEventListener('beforeunload', () => {
    pagePoller.dispose();
    if (comparisonTimer) clearTimeout(comparisonTimer);
    if (summaryAbortController) summaryAbortController.abort();
    if (comparisonAbortController) comparisonAbortController.abort();
  });
});
