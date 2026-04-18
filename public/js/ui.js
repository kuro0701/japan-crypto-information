const UI = {
  market: {
    baseCurrency: 'BTC',
    quoteCurrency: 'JPY',
    label: 'BTC/JPY',
  },

  setMarketMeta(market) {
    this.market = {
      baseCurrency: market.baseCurrency || 'BTC',
      quoteCurrency: market.quoteCurrency || 'JPY',
      label: market.label || market.instrumentId || 'BTC/JPY',
    };

    const base = this.market.baseCurrency;
    this.setText('amount-type-base-option', `数量 (${base})`);
    this.setText('volume-24h-label', `24h取引量 (${base})`);
    this.setText('volume-24h-quote-label', '24h売買代金');
    this.setText('ask-volume-label', `Ask板数量 (${base})`);
    this.setText('bid-volume-label', `Bid板数量 (${base})`);
    this.setText('fill-quantity-header', `数量 (${base})`);
  },

  formatBase(value, compact = false) {
    return compact
      ? `${Fmt.baseCompact(value)} ${this.market.baseCurrency}`
      : Fmt.base(value, this.market.baseCurrency);
  },

  formatQuote(value) {
    if ((this.market.quoteCurrency || 'JPY').toUpperCase() === 'JPY') {
      return Fmt.jpyLarge(value);
    }

    if (value == null || isNaN(value)) return '-';
    return `${Fmt.num(value, 2)} ${this.market.quoteCurrency}`;
  },

  updateTicker(ticker) {
    if (!ticker) return;
    const baseVolume = ticker.baseVolume24h == null ? '-' : this.formatBase(ticker.baseVolume24h, true);
    this.setText('volume-24h-base', baseVolume);
    this.setText('volume-24h-quote-label', ticker.quoteVolume24hEstimated ? '24h売買代金 (概算)' : '24h売買代金');
    this.setText('volume-24h-quote', this.formatQuote(ticker.quoteVolume24h));
  },

  updateMarketOverview(data) {
    this.setText('mid-price', Fmt.jpy(data.midPrice));
    this.setText('best-bid', Fmt.jpy(data.bestBid));
    this.setText('best-ask', Fmt.jpy(data.bestAsk));
    this.setText('spread-jpy', Fmt.jpy(data.spread));
    this.setText('spread-pct', Fmt.pct(data.spreadPct));
    this.setText('ask-volume', this.formatBase(data.totalAskVolume));
    this.setText('bid-volume', this.formatBase(data.totalBidVolume));
    this.setText('ask-depth-jpy', Fmt.jpyLarge(data.totalAskDepthJPY));
    this.setText('bid-depth-jpy', Fmt.jpyLarge(data.totalBidDepthJPY));
    this.setText('ask-levels', data.askLevels);
    this.setText('bid-levels', data.bidLevels);
    this.setText('book-timestamp', Fmt.timestamp(data.timestamp));
    this.setText('source-label', data.source === 'websocket' ? 'WebSocket' : 'REST');
    this.updateTicker(data.ticker);
    this.updateThresholdTable(data.impactThresholds);
  },

  clearMarketView() {
    [
      'mid-price',
      'best-bid',
      'best-ask',
      'spread-jpy',
      'spread-pct',
      'volume-24h-base',
      'volume-24h-quote',
      'ask-volume',
      'bid-volume',
      'ask-depth-jpy',
      'bid-depth-jpy',
      'ask-levels',
      'bid-levels',
      'book-timestamp',
      'source-label',
    ].forEach(id => this.setText(id, '-'));
    this.updateThresholdTable(null);
  },

  clearSimulationView() {
    const panel = document.getElementById('simulation-results');
    if (panel) {
      panel.innerHTML = '<div class="text-gray-500 text-center py-8">シミュレーション未実行</div>';
    }

    const tbody = document.getElementById('fill-tbody');
    if (tbody) {
      tbody.innerHTML = '<tr><td colspan="9" class="text-center text-gray-500 py-4">シミュレーション結果なし</td></tr>';
    }
  },

  updateThresholdTable(thresholds) {
    const tbody = document.getElementById('threshold-tbody');
    if (!tbody) return;

    if (!thresholds || !thresholds.targets) {
      tbody.innerHTML = '<tr><td colspan="3" class="text-center text-gray-500 py-4">板データ待機中</td></tr>';
      return;
    }

    const cell = (row) => {
      const visibleDepthNote = row.limitedByVisibleDepth ? '<div class="text-[10px] text-yellow-500">表示板内で未到達</div>' : '';
      return `
        <div class="font-mono text-gray-100">${this.formatBase(row.maxBTCBeforeBreach, true)}</div>
        <div class="text-[10px] text-gray-500">${Fmt.jpyLarge(row.maxJPYBeforeBreach)}</div>
        <div class="text-[10px] text-gray-600">境界 ${Fmt.jpy(row.targetPrice)}</div>
        ${visibleDepthNote}
      `;
    };

    tbody.innerHTML = thresholds.targets.map((pct, i) => `
      <tr class="border-b border-gray-800">
        <td class="is-num text-right font-mono text-gray-300">${pct}%</td>
        <td class="is-num text-right">${cell(thresholds.buy[i])}</td>
        <td class="is-num text-right">${cell(thresholds.sell[i])}</td>
      </tr>
    `).join('');
  },

  updateSimulationResults(r) {
    const panel = document.getElementById('simulation-results');
    if (!panel) return;

    if (r.error) {
      panel.innerHTML = `<div class="text-red-400 text-center py-4">${r.error}</div>`;
      return;
    }

    const sideLabel = r.side === 'buy' ? '買い (Ask消費)' : '売り (Bid消費)';
    const sideClass = r.side === 'buy' ? 'text-red-400' : 'text-green-400';

    const slipClass = (v) => v > 0.5 ? 'text-red-400 font-bold' : v > 0.1 ? 'text-yellow-400' : 'text-gray-200';
    const statusClass = {
      executable: 'bg-green-950/50 border-green-700 text-green-200',
      auto_cancel: 'bg-yellow-950/50 border-yellow-600 text-yellow-200',
      insufficient_liquidity: 'bg-yellow-950/50 border-yellow-600 text-yellow-200',
      circuit_breaker: 'bg-red-950/60 border-red-600 text-red-200',
    }[r.executionStatus] || 'bg-gray-800 border-gray-700 text-gray-200';
    const row = (label, value, valueClass = '') => `
      <div class="flex justify-between gap-3">
        <span class="text-gray-400">${label}</span>
        <span class="text-right ${valueClass}">${value}</span>
      </div>
    `;

    let requestLabel;
    if (r.amountType === 'jpy') {
      requestLabel = Fmt.jpy(r.requestedAmount);
    } else {
      requestLabel = this.formatBase(r.requestedAmount, true);
    }

    let html = `
      <div class="space-y-3">
        <div class="border rounded p-3 ${statusClass}">
          <div class="flex justify-between gap-3">
            <span class="font-semibold">発注判定</span>
            <span class="font-bold text-right">${r.executionStatusLabel}</span>
          </div>
          <div class="mt-1 text-xs opacity-90">${r.recommendedAction}</div>
        </div>

        <div class="flex justify-between items-center border-b border-gray-700 pb-2">
          <span class="text-gray-400">注文方向</span>
          <span class="${sideClass} font-bold">${sideLabel}</span>
        </div>
        <div class="flex justify-between items-center border-b border-gray-700 pb-2">
          <span class="text-gray-400">注文数量/金額</span>
          <span>${requestLabel}</span>
        </div>

        <div class="text-xs text-gray-500 uppercase tracking-wider pt-2">約定結果</div>
        ${row(`約定${this.market.baseCurrency}数量`, this.formatBase(r.totalBTCFilled))}
        ${row(r.side === 'buy' ? '支払総額' : '受取総額', Fmt.jpy(r.totalJPYSpent), 'font-mono')}
        ${row('VWAP (平均約定価格)', Fmt.jpy(r.vwap), 'text-white font-bold font-mono')}
        ${row('最悪約定価格', Fmt.jpy(r.worstPrice), 'font-mono')}

        <div class="text-xs text-gray-500 uppercase tracking-wider pt-2">スリッページ</div>
        ${row('Best比 (JPY)', Fmt.jpy(r.slippageFromBestJPY), slipClass(Math.abs(r.slippageFromBestPct)))}
        ${row('Best比 (%)', Fmt.pct(r.slippageFromBestPct), slipClass(Math.abs(r.slippageFromBestPct)))}
        ${row('Mid比 (%)', Fmt.pct(r.slippageFromMidPct), slipClass(Math.abs(r.slippageFromMidPct)))}

        <div class="text-xs text-gray-500 uppercase tracking-wider pt-2">マーケットインパクト</div>
        ${row('インパクト', Fmt.pct(r.marketImpactPct), slipClass(Math.abs(r.marketImpactPct)))}
        ${row('価格レンジ', Fmt.jpy(r.priceRange), 'font-mono')}
        ${row('5%ガードまで', Fmt.pct(Math.max(0, r.remainingImpactToAutoCancelPct)), r.remainingImpactToAutoCancelPct <= 0 ? 'text-red-300 font-bold' : 'text-gray-200')}
        ${row('50%停止まで', Fmt.pct(Math.max(0, r.remainingImpactToCircuitBreakerPct)), r.remainingImpactToCircuitBreakerPct <= 0 ? 'text-red-300 font-bold' : 'text-gray-200')}

        <div class="text-xs text-gray-500 uppercase tracking-wider pt-2">注文ガード</div>
        ${row('5%以内の最大数量', this.formatBase(r.autoCancelMaxBTCBeforeBreach, true))}
        ${row('5%以内の最大金額', Fmt.jpyLarge(r.autoCancelMaxJPYBeforeBreach))}
        ${row('5%境界価格', Fmt.jpy(r.autoCancelThresholdPrice), 'font-mono')}
        ${row('50%境界価格', Fmt.jpy(r.circuitBreakerThresholdPrice), 'font-mono')}
        ${row('上限サーキット', Fmt.jpy(r.circuitBreakerUpperPrice), 'font-mono')}
        ${row('下限サーキット', Fmt.jpy(r.circuitBreakerLowerPrice), 'font-mono')}

        <div class="text-xs text-gray-500 uppercase tracking-wider pt-2">板消費</div>
        ${row('消費レベル数', `${r.levelsConsumed} / ${r.totalLevelsAvailable}`)}
        ${row('消費注文数', Fmt.num(r.ordersConsumed))}
        ${row('残存流動性', this.formatBase(r.remainingLiquidityBTC))}
        ${row('残存流動性 (JPY)', Fmt.jpyLarge(r.remainingLiquidityJPY))}

        <div class="text-xs text-gray-500 uppercase tracking-wider pt-2">手数料 (${Fmt.pct(r.feeRatePct)})</div>
        ${row('手数料', Fmt.jpy(r.feesJPY), 'font-mono')}
        ${row(`手数料込み実効${r.side === 'buy' ? 'コスト' : '受取額'}`, Fmt.jpy(r.effectiveCostJPY), 'text-white font-bold font-mono')}
        ${row('実効VWAP', Fmt.jpy(r.effectiveVWAP), 'text-white font-bold font-mono')}
      </div>
    `;

    if (r.insufficient) {
      const shortfall = r.amountType === 'jpy'
        ? `不足: ${Fmt.jpy(r.shortfallJPY)}`
        : `不足: ${this.formatBase(r.shortfallBTC)}`;
      html += `
        <div class="mt-3 p-3 bg-red-900/50 border border-red-500 rounded text-red-300 text-sm animate-pulse">
          流動性不足: 板の全量でも注文を完全に約定できません。${shortfall}
        </div>
      `;
    }

    if (r.autoCancelTriggered || r.circuitBreakerTriggered) {
      html += `
        <div class="mt-3 p-3 bg-yellow-950/50 border border-yellow-600 rounded text-yellow-200 text-sm">
          このダッシュボードは発注しません。上の明細は、ガードなしで板を消費した場合の試算です。
        </div>
      `;
    }

    panel.innerHTML = html;
  },

  applyFlashClass(element, currentValue, nextValue) {
    if (!element) return;
    if (currentValue == null || nextValue == null || isNaN(currentValue) || isNaN(nextValue)) return;
    if (nextValue === currentValue) return;
    const className = nextValue > currentValue ? 'flash-up' : 'flash-down';
    element.classList.remove('flash-up', 'flash-down');
    void element.offsetWidth;
    element.classList.add(className);
    setTimeout(() => element.classList.remove(className), 600);
  },

  updateFillTable(fills, side = 'buy') {
    const tbody = document.getElementById('fill-tbody');
    if (!tbody || !fills) return;

    if (fills.length === 0) {
      tbody.innerHTML = '<tr><td colspan="9" class="text-center text-gray-500 py-4">シミュレーション結果なし</td></tr>';
      return;
    }

    const previousRows = new Map(Array.from(tbody.querySelectorAll('tr')).map((row, idx) => [idx + 1, row]));
    const isBuy = side === 'buy';
    const sideMark = isBuy ? '▲' : '▼';
    const sideLabel = isBuy ? '買い' : '売り';
    const sideClass = isBuy ? 'text-red-300' : 'text-green-300';

    tbody.innerHTML = fills.map((f, i) => `
      <tr class="border-b border-gray-800 ${f.fullyConsumed ? '' : 'bg-yellow-900/10'}">
        <td headers="fill-col-idx" class="is-num text-right text-gray-400">${i + 1}</td>
        <td headers="fill-col-side" class="${sideClass}">
          <span class="fill-side"><span class="fill-side__mark" aria-hidden="true">${sideMark}</span>${sideLabel}</span>
        </td>
        <td headers="fill-col-price" class="is-num text-right font-mono" data-value="${f.price}">${Fmt.jpy(f.price)}</td>
        <td headers="fill-quantity-header" class="is-num text-right font-mono" data-value="${f.quantity}">${this.formatBase(f.quantity, true)}</td>
        <td headers="fill-col-subtotal" class="is-num text-right font-mono" data-value="${f.subtotalJPY}">${Fmt.jpy(f.subtotalJPY)}</td>
        <td headers="fill-col-cum-base" class="is-num text-right font-mono" data-value="${f.cumulativeBTC}">${this.formatBase(f.cumulativeBTC, true)}</td>
        <td headers="fill-col-cum-quote" class="is-num text-right font-mono" data-value="${f.cumulativeJPY}">${Fmt.jpy(f.cumulativeJPY)}</td>
        <td headers="fill-col-impact" class="is-num text-right font-mono" data-value="${f.cumulativeImpactPct}">${Fmt.pct(f.cumulativeImpactPct)}</td>
        <td headers="fill-col-orders" class="is-num text-right font-mono" data-value="${f.orders}">${Fmt.num(f.orders)}</td>
      </tr>
    `).join('');

    Array.from(tbody.querySelectorAll('tr')).forEach((row, idx) => {
      const previousRow = previousRows.get(idx + 1);
      if (!previousRow) return;
      const nextCells = row.querySelectorAll('td[data-value]');
      const prevCells = previousRow.querySelectorAll('td[data-value]');
      nextCells.forEach((cell, cellIndex) => {
        const previousValue = Number(prevCells[cellIndex]?.dataset.value);
        const nextValue = Number(cell.dataset.value);
        this.applyFlashClass(cell, previousValue, nextValue);
      });
    });
  },

  setConnectionStatus(status) {
    const dot = document.getElementById('status-dot');
    const text = document.getElementById('status-text');
    if (!dot || !text) return;

    const styles = {
      connected: { color: 'bg-green-500', label: '接続中' },
      disconnected: { color: 'bg-red-500', label: '切断' },
      reconnecting: { color: 'bg-yellow-500 animate-pulse', label: '再接続中...' },
    };
    const s = styles[status] || styles.disconnected;
    dot.className = `status-dot w-3 h-3 rounded-full ${s.color}`;
    text.textContent = s.label;
    const liveLabel = document.getElementById('status-live-label');
    if (liveLabel) liveLabel.textContent = `接続状態: ${s.label}`;
  },

  setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value ?? '-';
  },
};
