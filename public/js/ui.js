const UI = {
  emptySimulationMessage: '数量または金額を入力して、シミュレーションを実行してください。',
  orderbookWaitingMessage: '取引所から板データを取得中です。接続に数秒かかる場合があります。',
  market: {
    baseCurrency: 'BTC',
    quoteCurrency: 'JPY',
    label: 'BTC/JPY',
  },
  latestOrderbook: null,

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

  impactRiskMeta(impactPct) {
    const impact = Math.abs(Number(impactPct));
    if (!Number.isFinite(impact)) {
      return {
        label: '判定待ち',
        tone: 'caution',
        thresholdLabel: 'Impact 判定待ち',
        guidance: '板データが揃うと危険度を表示します。',
      };
    }

    if (impact < 0.1) {
      return {
        label: '通常',
        tone: 'normal',
        thresholdLabel: 'Impact 0.1%未満',
        guidance: '通常の成行注文として扱える水準です。',
      };
    }

    if (impact < 0.5) {
      return {
        label: 'やや注意',
        tone: 'caution',
        thresholdLabel: 'Impact 0.1〜0.5%',
        guidance: '板は消費しています。注文サイズを少し意識したい水準です。',
      };
    }

    if (impact < 1.0) {
      return {
        label: '分割注文を検討',
        tone: 'warning',
        thresholdLabel: 'Impact 0.5〜1.0%',
        guidance: '複数回に分けるか、板の厚い取引所へ回す検討余地があります。',
      };
    }

    if (impact < 5.0) {
      return {
        label: '成行注文は非推奨',
        tone: 'danger',
        thresholdLabel: 'Impact 1.0%以上',
        guidance: 'このサイズの成行はコスト悪化が大きく、指値や分割が無難です。',
      };
    }

    return {
      label: 'このサイズの成行注文は危険',
      tone: 'critical',
      thresholdLabel: 'Impact 5.0%以上',
      guidance: '板を大きく崩す可能性があり、成行のまま出すのは避けたい水準です。',
    };
  },

  termLabel(label, key) {
    if (window.TermHelp && typeof window.TermHelp.inlineLabel === 'function') {
      return window.TermHelp.inlineLabel(label, key);
    }
    return label;
  },

  updateTicker(ticker) {
    if (!ticker) return;
    const baseVolume = ticker.baseVolume24h == null ? '-' : this.formatBase(ticker.baseVolume24h, true);
    this.setText('volume-24h-base', baseVolume);
    this.setText('volume-24h-quote-label', ticker.quoteVolume24hEstimated ? '24h売買代金 (概算)' : '24h売買代金');
    this.setText('volume-24h-quote', this.formatQuote(ticker.quoteVolume24h));
  },

  parseTimeValue(value) {
    if (value == null || value === '') return null;
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    const parsed = Date.parse(String(value));
    return Number.isFinite(parsed) ? parsed : null;
  },

  rowUpdatedAtMs(row) {
    return this.parseTimeValue(row && (row.updatedAt ?? row.receivedAt ?? row.timestamp));
  },

  rowAgeMs(row) {
    const updatedAt = this.rowUpdatedAtMs(row);
    return updatedAt == null ? null : Math.max(0, Date.now() - updatedAt);
  },

  rowAgeSeconds(row) {
    const ageMs = this.rowAgeMs(row);
    return ageMs == null ? null : Math.floor(ageMs / 1000);
  },

  marketFreshnessStatus(row = this.latestOrderbook) {
    const baseStatus = String((row && (row.freshnessStatus || row.status)) || 'waiting');
    if (baseStatus !== 'fresh' && baseStatus !== 'stale') return baseStatus;
    if (baseStatus === 'stale') return 'stale';
    const ageMs = this.rowAgeMs(row);
    const staleAfterMs = Number(row && row.staleAfterMs);
    if (ageMs != null && Number.isFinite(staleAfterMs) && staleAfterMs > 0 && ageMs > staleAfterMs) {
      return 'stale';
    }
    return 'fresh';
  },

  renderMarketFreshness() {
    const seconds = this.rowAgeSeconds(this.latestOrderbook);
    this.setText('book-age-label', seconds == null ? '-' : `${seconds}秒前`);

    const badge = document.getElementById('book-freshness-badge');
    if (badge) {
      badge.hidden = this.marketFreshnessStatus() !== 'stale';
    }
  },

  updateMarketOverview(data) {
    this.latestOrderbook = data || null;
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
    this.setText('book-timestamp', Fmt.timestamp(data.timestamp || data.updatedAt));
    this.setText('source-label', data.source === 'websocket' ? 'WebSocket' : 'REST');
    this.renderMarketFreshness();
    this.updateTicker(data.ticker);
    this.updateThresholdTable(data.impactThresholds);
  },

  clearMarketView() {
    this.latestOrderbook = null;
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
      'book-age-label',
      'source-label',
    ].forEach(id => this.setText(id, '-'));
    const badge = document.getElementById('book-freshness-badge');
    if (badge) badge.hidden = true;
    this.updateThresholdTable(null);
  },

  clearSimulationView() {
    const panel = document.getElementById('simulation-results');
    if (panel) {
      panel.innerHTML = `<div class="text-gray-500 text-center py-8">${this.emptySimulationMessage}</div>`;
    }

    const tbody = document.getElementById('fill-tbody');
    if (tbody) {
      tbody.innerHTML = `<tr><td colspan="9" headers="fill-col-side fill-col-idx fill-col-price fill-quantity-header fill-col-subtotal fill-col-cum-base fill-col-cum-quote fill-col-impact fill-col-orders" class="text-center text-gray-500 py-4">${this.emptySimulationMessage}</td></tr>`;
    }
  },

  updateThresholdTable(thresholds) {
    const tbody = document.getElementById('threshold-tbody');
    if (!tbody) return;

    if (!thresholds || !thresholds.targets) {
      tbody.innerHTML = `<tr><td colspan="3" headers="threshold-col-impact threshold-col-buy threshold-col-sell" class="text-center text-gray-500 py-4">${this.orderbookWaitingMessage}</td></tr>`;
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
        <td headers="threshold-col-impact" class="is-num text-right font-mono text-gray-300" data-label="変動">${pct}%</td>
        <td headers="threshold-col-buy" class="is-num text-right" data-label="買い">${cell(thresholds.buy[i])}</td>
        <td headers="threshold-col-sell" class="is-num text-right" data-label="売り">${cell(thresholds.sell[i])}</td>
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
    const risk = this.impactRiskMeta(r.marketImpactPct);
    const impactAbs = Math.abs(Number(r.marketImpactPct));
    const dangerousOrderSize = r.insufficient
      || r.autoCancelTriggered
      || r.circuitBreakerTriggered
      || ['auto_cancel', 'insufficient_liquidity', 'circuit_breaker'].includes(r.executionStatus)
      || (Number.isFinite(impactAbs) && impactAbs >= 0.5);
    const beginnerDangerWarning = dangerousOrderSize
      ? `
        <div class="beginner-only beginner-order-warning">
          <strong>危険な注文サイズの警告</strong>
          <span>Impact が ${Fmt.pct(r.marketImpactPct)} です。このサイズの成行注文は、分割注文・指値注文・板の厚い取引所への切り替えを先に検討してください。</span>
        </div>
      `
      : '';

    const slipClass = (v) => v > 0.5 ? 'text-red-400 font-bold' : v > 0.1 ? 'text-yellow-400' : 'text-gray-200';
    const statusClass = {
      executable: 'bg-green-950/50 border-green-700 text-green-200',
      invalid_constraints: 'bg-red-950/60 border-red-600 text-red-200',
      auto_cancel: 'bg-yellow-950/50 border-yellow-600 text-yellow-200',
      insufficient_liquidity: 'bg-yellow-950/50 border-yellow-600 text-yellow-200',
      circuit_breaker: 'bg-red-950/60 border-red-600 text-red-200',
    }[r.executionStatus] || 'bg-gray-800 border-gray-700 text-gray-200';
    const constraintSummary = r.constraintSummary || {};
    const formatScalar = (value, unit = '', maxDigits = 8) => {
      if (value == null || isNaN(value)) return '-';
      const digits = Math.min(Math.max(maxDigits, 0), 12);
      const text = Number(value).toFixed(digits).replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '');
      return unit ? `${text} ${unit}` : text;
    };
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
        ${beginnerDangerWarning}

        <div class="decision-summary-card">
          <div class="decision-summary-card__header">
            <div>
              <p class="decision-summary-card__eyebrow">Risk</p>
              <h3 class="decision-summary-card__title">Impact ベースの危険度</h3>
            </div>
            <span class="risk-badge risk-badge--${risk.tone}">${risk.label}</span>
          </div>
          <p class="decision-summary-card__lead">${Fmt.pct(r.marketImpactPct)} / ${risk.thresholdLabel}</p>
          <p class="decision-summary-card__body">${risk.guidance}</p>
        </div>

        <div class="flex justify-between items-center border-b border-gray-700 pb-2">
          <span class="text-gray-400">注文方向</span>
          <span class="${sideClass} font-bold">${sideLabel}</span>
        </div>
        <div class="flex justify-between items-center border-b border-gray-700 pb-2">
          <span class="text-gray-400">注文数量/金額</span>
          <span>${requestLabel}</span>
        </div>

        <div class="text-xs text-gray-500 uppercase tracking-wider pt-2">実注文制約</div>
        ${row('最小数量', constraintSummary.minSize == null ? '-' : this.formatBase(constraintSummary.minSize, true))}
        ${row('数量刻み', constraintSummary.sizeIncrement == null ? '-' : this.formatBase(constraintSummary.sizeIncrement, true))}
        ${row('価格刻み', constraintSummary.tickSize == null ? '-' : formatScalar(constraintSummary.tickSize, this.market.quoteCurrency || 'JPY', 8))}
        ${row(r.amountType === 'jpy' ? '約定見込み数量' : '入力数量', r.requestedBaseQuantity == null ? '-' : this.formatBase(r.requestedBaseQuantity, true))}
        ${row('丸め後数量', r.roundedBaseQuantity == null ? '-' : this.formatBase(r.roundedBaseQuantity, true), r.quantityRounded ? 'text-yellow-300 font-semibold' : '')}
        ${row('丸め差分', r.sizeRoundingDeltaBase == null ? '-' : this.formatBase(r.sizeRoundingDeltaBase, true), r.sizeRoundingDeltaBase > 1e-10 ? 'text-yellow-300' : '')}
        ${row('未使用予算', r.amountType === 'jpy' ? Fmt.jpy(r.unusedQuoteJPY) : '-', r.amountType === 'jpy' && r.unusedQuoteJPY > 0.5 ? 'text-yellow-300' : '')}

        <div class="text-xs text-gray-500 uppercase tracking-wider pt-2">約定結果</div>
        ${row(`約定${this.market.baseCurrency}数量`, this.formatBase(r.totalBTCFilled))}
        ${row(r.side === 'buy' ? '支払総額' : '受取総額', Fmt.jpy(r.totalJPYSpent), 'font-mono')}
        ${row(this.termLabel('VWAP (平均約定価格)', 'vwap'), Fmt.jpy(r.vwap), 'text-white font-bold font-mono')}
        ${row('最悪約定価格', Fmt.jpy(r.worstPrice), 'font-mono')}

        <div class="text-xs text-gray-500 uppercase tracking-wider pt-2">${this.termLabel('スリッページ', 'slippage')}</div>
        ${row('Best比 (JPY)', Fmt.jpy(r.slippageFromBestJPY), slipClass(Math.abs(r.slippageFromBestPct)))}
        ${row('Best比 (%)', Fmt.pct(r.slippageFromBestPct), slipClass(Math.abs(r.slippageFromBestPct)))}
        ${row('Mid比 (%)', Fmt.pct(r.slippageFromMidPct), slipClass(Math.abs(r.slippageFromMidPct)))}

        <div class="text-xs text-gray-500 uppercase tracking-wider pt-2">${this.termLabel('マーケットインパクト', 'impact')}</div>
        ${row(this.termLabel('インパクト', 'impact'), Fmt.pct(r.marketImpactPct), slipClass(Math.abs(r.marketImpactPct)))}
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
        ${row(this.termLabel('実効VWAP', 'vwap'), Fmt.jpy(r.effectiveVWAP), 'text-white font-bold font-mono')}
      </div>
    `;

    if (Array.isArray(r.blockingReasons) && r.blockingReasons.length > 0) {
      html += `
        <div class="mt-3 p-3 bg-red-950/60 border border-red-600 rounded text-red-200 text-sm">
          <div class="font-bold mb-1">実行不可理由</div>
          ${r.blockingReasons.map(reason => `<div class="result-note-line">${reason}</div>`).join('')}
        </div>
      `;
    }

    if (Array.isArray(r.constraintNotes) && r.constraintNotes.length > 0) {
      html += `
        <div class="mt-3 p-3 bg-gray-900/70 border border-gray-700 rounded text-gray-200 text-sm">
          <div class="font-bold mb-1">制約メモ</div>
          ${r.constraintNotes.map(note => `<div class="result-note-line">${note}</div>`).join('')}
        </div>
      `;
    }

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

  toggleChangedTableCellFlashes(tbody, previousRows) {
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

  updateFillTable(fills, side = 'buy') {
    const tbody = document.getElementById('fill-tbody');
    if (!tbody || !fills) return;

    if (fills.length === 0) {
      tbody.innerHTML = `<tr><td colspan="9" headers="fill-col-side fill-col-idx fill-col-price fill-quantity-header fill-col-subtotal fill-col-cum-base fill-col-cum-quote fill-col-impact fill-col-orders" class="text-center text-gray-500 py-4">${this.emptySimulationMessage}</td></tr>`;
      return;
    }

    const previousRows = new Map(Array.from(tbody.querySelectorAll('tr')).map((row, idx) => [idx + 1, row]));
    const isBuy = side === 'buy';
    const sideMark = isBuy ? '▲' : '▼';
    const sideLabel = isBuy ? '買い' : '売り';
    const sideClass = isBuy ? 'text-red-300' : 'text-green-300';

    tbody.innerHTML = fills.map((f, i) => `
      <tr class="border-b border-gray-800 ${f.fullyConsumed ? '' : 'bg-yellow-900/10'}">
        <td headers="fill-col-side" class="${sideClass}" data-label="方向">
          <span class="fill-side"><span class="fill-side__mark" aria-hidden="true">${sideMark}</span>${sideLabel}</span>
        </td>
        <td headers="fill-col-idx" class="is-num text-right text-gray-400" data-label="#">${i + 1}</td>
        <td headers="fill-col-price" class="is-num text-right font-mono" data-label="約定価格" data-value="${f.price}">${Fmt.jpy(f.price)}</td>
        <td headers="fill-quantity-header" class="is-num text-right font-mono" data-label="数量" data-value="${f.quantity}">${this.formatBase(f.quantity, true)}</td>
        <td headers="fill-col-subtotal" class="is-num text-right font-mono" data-label="小計" data-value="${f.subtotalJPY}">${Fmt.jpy(f.subtotalJPY)}</td>
        <td headers="fill-col-cum-base" class="is-num text-right font-mono" data-label="累計数量" data-value="${f.cumulativeBTC}">${this.formatBase(f.cumulativeBTC, true)}</td>
        <td headers="fill-col-cum-quote" class="is-num text-right font-mono" data-label="累計金額" data-value="${f.cumulativeJPY}">${Fmt.jpy(f.cumulativeJPY)}</td>
        <td headers="fill-col-impact" class="is-num text-right font-mono" data-label="累計Impact" data-value="${f.cumulativeImpactPct}">${Fmt.pct(f.cumulativeImpactPct)}</td>
        <td headers="fill-col-orders" class="is-num text-right font-mono" data-label="注文数" data-value="${f.orders}">${Fmt.num(f.orders)}</td>
      </tr>
    `).join('');

    this.toggleChangedTableCellFlashes(tbody, previousRows);
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

  isFlashTextTarget(id, element) {
    const flashIds = new Set([
      'spread-pct',
      'volume-24h-base',
      'volume-24h-quote',
      'ask-volume',
      'bid-volume',
      'ask-depth-jpy',
      'bid-depth-jpy',
      'ask-levels',
      'bid-levels',
    ]);
    return flashIds.has(id) || element.classList.contains('metric-value');
  },

  numericText(value) {
    const text = String(value ?? '').trim();
    if (!text || text === '-') return NaN;
    const normalized = text.replace(/,/g, '').replace(/[^\d.+-]/g, '');
    if (!/\d/.test(normalized)) return NaN;
    return Number(normalized);
  },

  setText(id, value) {
    const el = document.getElementById(id);
    if (!el) return;

    const previousValue = this.isFlashTextTarget(id, el) ? this.numericText(el.textContent) : NaN;
    const nextText = value ?? '-';
    el.textContent = nextText;

    if (this.isFlashTextTarget(id, el)) {
      this.applyFlashClass(el, previousValue, this.numericText(nextText));
    }
  },
};
