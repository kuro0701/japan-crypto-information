(function () {
  'use strict';

  const root = document.querySelector('[data-exchange-page]');
  if (!root) return;

  const exchangeId = String(root.getAttribute('data-exchange-id') || '').trim();
  const instrumentId = String(root.getAttribute('data-default-instrument-id') || '').trim();
  if (!exchangeId || !instrumentId) return;

  const waitingClass = 'is-waiting';
  const staleClass = 'is-stale';

  function numberOrNull(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  function priceDecimals(value) {
    const abs = Math.abs(Number(value));
    if (!Number.isFinite(abs)) return 0;
    if (abs >= 1000) return 0;
    if (abs >= 100) return 1;
    if (abs >= 1) return 2;
    return 4;
  }

  function formatJpyPrice(value) {
    const numeric = numberOrNull(value);
    if (numeric == null) return '-';
    return new Intl.NumberFormat('ja-JP', {
      style: 'currency',
      currency: 'JPY',
      maximumFractionDigits: priceDecimals(numeric),
    }).format(numeric);
  }

  function formatJpyCompact(value) {
    const numeric = numberOrNull(value);
    if (numeric == null) return '-';
    const compact = new Intl.NumberFormat('ja-JP', {
      notation: 'compact',
      maximumFractionDigits: Math.abs(numeric) >= 1e8 ? 1 : 0,
    }).format(numeric);
    return `¥${compact}`;
  }

  function formatPct(value, decimals = 3) {
    const numeric = numberOrNull(value);
    if (numeric == null) return '-';
    return `${numeric.toFixed(decimals)}%`;
  }

  function setLiveField(field, text, state) {
    document.querySelectorAll(`[data-exchange-live-field="${field}"]`).forEach((node) => {
      node.textContent = text;
      node.classList.toggle(waitingClass, state === 'waiting');
      node.classList.toggle(staleClass, state === 'stale');
    });
  }

  function orderbookState(orderbook) {
    if (!orderbook || orderbook.status === 'waiting' || orderbook.status === 'unsupported') return 'waiting';
    return orderbook.status === 'stale' ? 'stale' : 'ready';
  }

  function stateSuffix(state) {
    if (state === 'stale') return '（古い板データ）';
    if (state === 'waiting') return '（データ待ち）';
    return '';
  }

  function updateOrderbookFields(report, row) {
    const marketLabel = (report.market && report.market.label) || instrumentId.replace('-', '/');
    const orderbook = row && row.orderbook ? row.orderbook : null;
    const state = orderbookState(orderbook);
    const bestBid = numberOrNull(orderbook && orderbook.bestBid);
    const bestAsk = numberOrNull(orderbook && orderbook.bestAsk);
    const visibleDepth = numberOrNull(orderbook && orderbook.visibleDepthJPY);

    if (bestBid != null && bestAsk != null) {
      setLiveField('bidAsk', `${marketLabel}: Bid ${formatJpyPrice(bestBid)} / Ask ${formatJpyPrice(bestAsk)}${stateSuffix(state)}`, state);
    } else {
      setLiveField('bidAsk', `${marketLabel}: Bid / Ask はデータ待ちです。`, 'waiting');
    }

    if (visibleDepth != null && visibleDepth > 0) {
      setLiveField('depth', `${marketLabel}: 可視板厚 ${formatJpyCompact(visibleDepth)}（Bid+Ask）${stateSuffix(state)}`, state);
    } else {
      setLiveField('depth', `${marketLabel}: 可視板厚はデータ待ちです。`, 'waiting');
    }
  }

  function updateCostFields(report, row) {
    const marketLabel = (report.market && report.market.label) || instrumentId.replace('-', '/');
    const cost = row && row.cost100k ? row.cost100k : null;
    const impact = numberOrNull(cost && cost.marketImpactPct);
    const vwap = numberOrNull(cost && cost.effectiveVWAP);
    const feeLabel = cost && cost.feeLabel ? String(cost.feeLabel) : '既定手数料';
    const statusLabel = cost && cost.executionStatusLabel ? String(cost.executionStatusLabel) : '';

    if (impact == null) {
      setLiveField('effectiveCost', `${marketLabel}: 10万円買いの実質コストはデータ待ちです。`, 'waiting');
      setLiveField('slippage', `${marketLabel}: スリッページ傾向はデータ待ちです。`, 'waiting');
      return;
    }

    const vwapText = vwap != null ? ` / VWAP ${formatJpyPrice(vwap)}` : '';
    const statusText = statusLabel ? ` / ${statusLabel}` : '';
    setLiveField('effectiveCost', `${marketLabel}: 10万円買い参考 Impact ${formatPct(impact)}${vwapText} / 手数料 ${feeLabel}${statusText}`, 'ready');
    setLiveField('slippage', `${marketLabel}: 10万円買いの価格影響 ${formatPct(impact)}${statusText}`, 'ready');
  }

  async function loadExchangeMarket() {
    setLiveField('bidAsk', '代表銘柄のBid / Askを取得中です。', 'waiting');
    setLiveField('depth', '代表銘柄の板厚を取得中です。', 'waiting');
    setLiveField('effectiveCost', '代表銘柄の10万円買い参考値を取得中です。', 'waiting');
    setLiveField('slippage', '代表銘柄のスリッページ傾向を取得中です。', 'waiting');

    const response = await fetch(`/api/markets/${encodeURIComponent(instrumentId)}`, {
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) throw new Error(`Market API failed: ${response.status}`);

    const report = await response.json();
    const rows = report && report.domesticComparison && Array.isArray(report.domesticComparison.rows)
      ? report.domesticComparison.rows
      : [];
    const row = rows.find(item => item && item.exchangeId === exchangeId) || null;

    if (!row) {
      const marketLabel = (report.market && report.market.label) || instrumentId.replace('-', '/');
      setLiveField('bidAsk', `${marketLabel}: この取引所の板データは対象外です。`, 'waiting');
      setLiveField('depth', `${marketLabel}: この取引所の板厚データは対象外です。`, 'waiting');
      setLiveField('effectiveCost', `${marketLabel}: この取引所の実質コストは対象外です。`, 'waiting');
      setLiveField('slippage', `${marketLabel}: この取引所のスリッページ傾向は対象外です。`, 'waiting');
      return;
    }

    updateOrderbookFields(report, row);
    updateCostFields(report, row);
  }

  loadExchangeMarket().catch(() => {
    setLiveField('bidAsk', 'Bid / Ask を取得できませんでした。公式画面で確認してください。', 'waiting');
    setLiveField('depth', '板厚を取得できませんでした。公式画面で確認してください。', 'waiting');
    setLiveField('effectiveCost', '実質コストを取得できませんでした。板シミュレーターで確認してください。', 'waiting');
    setLiveField('slippage', 'スリッページ傾向を取得できませんでした。板シミュレーターで確認してください。', 'waiting');
  });
}());
