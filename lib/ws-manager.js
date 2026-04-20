const { WebSocketServer } = require('ws');
const { calculateImpact, calculateImpactThresholds } = require('./impact-calculator');

class WSManager {
  constructor(server, options = {}) {
    this.wss = new WebSocketServer({ server, path: '/ws' });
    this.exchanges = options.exchanges || [];
    this.defaultExchangeId = options.defaultExchangeId || (this.exchanges[0] && this.exchanges[0].id) || 'okj';
    this.onMarketSelected = options.onMarketSelected || (() => {});
    this.onClientConnected = options.onClientConnected || (() => {});
    this.onClientDisconnected = options.onClientDisconnected || (() => {});
    this.clients = new Map(); // ws -> { exchangeId, instrumentId, simulationParams }
    this.latestBooks = new Map();
    this.latestTickers = new Map();
    this.throttleTimer = null;
    this.pendingMarketKeys = new Set();

    this.wss.on('connection', (ws, request) => {
      const exchange = this.getExchange(this.defaultExchangeId);
      this.clients.set(ws, {
        exchangeId: this.defaultExchangeId,
        instrumentId: this.getDefaultInstrumentId(exchange),
        simulationParams: null,
      });
      this.onClientConnected({ request, clientCount: this.clients.size });

      this.sendExchanges(ws);

      let closed = false;
      const releaseClient = () => {
        if (closed) return;
        closed = true;
        this.clients.delete(ws);
        this.onClientDisconnected({ clientCount: this.clients.size });
      };

      ws.on('message', (raw) => {
        try {
          const msg = JSON.parse(raw);
          this.handleMessage(ws, msg);
        } catch (_) {
          ws.send(JSON.stringify({ type: 'error', message: '不正なメッセージ形式です' }));
        }
      });

      ws.on('close', () => {
        releaseClient();
      });

      ws.on('error', () => {
        releaseClient();
      });

      const state = this.clients.get(ws);
      const latestBook = this.latestBooks.get(this.marketKey(state.exchangeId, state.instrumentId));
      if (latestBook) {
        this.sendOrderbook(ws, latestBook);
      }
      const latestTicker = this.latestTickers.get(this.marketKey(state.exchangeId, state.instrumentId));
      if (latestTicker) {
        this.sendTicker(ws, latestTicker);
      }
    });
  }

  setExchanges(exchanges) {
    this.exchanges = exchanges || [];
    for (const [ws] of this.clients) {
      if (ws.readyState === 1) this.sendExchanges(ws);
    }
  }

  sendExchanges(ws) {
    if (ws.readyState !== 1) return;
    ws.send(JSON.stringify({
      type: 'exchanges',
      data: {
        defaultExchangeId: this.defaultExchangeId,
        exchanges: this.exchanges,
      },
    }));
  }

  marketKey(exchangeId, instrumentId) {
    return `${exchangeId}:${instrumentId}`;
  }

  getExchange(exchangeId) {
    return this.exchanges.find(exchange => exchange.id === exchangeId) || null;
  }

  getDefaultInstrumentId(exchange) {
    if (!exchange) return 'BTC-JPY';
    return exchange.defaultInstrumentId
      || exchange.instrumentId
      || (exchange.markets && exchange.markets[0] && exchange.markets[0].instrumentId)
      || 'BTC-JPY';
  }

  getMarket(exchangeId, instrumentId) {
    const exchange = this.getExchange(exchangeId);
    if (!exchange) return null;
    return (exchange.markets || []).find(market => market.instrumentId === instrumentId) || null;
  }

  selectMarket(ws, msg) {
    const client = this.clients.get(ws);
    if (!client) return false;

    const exchangeId = msg.exchangeId || client.exchangeId || this.defaultExchangeId;
    const exchange = this.getExchange(exchangeId);
    if (!exchange) {
      ws.send(JSON.stringify({ type: 'error', message: '未対応の取引所です' }));
      return false;
    }

    const instrumentId = msg.instrumentId || msg.instrument_id || client.instrumentId || this.getDefaultInstrumentId(exchange);
    const market = this.getMarket(exchangeId, instrumentId);
    if (!market) {
      ws.send(JSON.stringify({ type: 'error', message: '未対応の銘柄です' }));
      return false;
    }

    client.exchangeId = exchangeId;
    client.instrumentId = instrumentId;
    client.simulationParams = null;
    this.onMarketSelected({ exchangeId, instrumentId });

    const latestBook = this.latestBooks.get(this.marketKey(exchangeId, instrumentId));
    if (latestBook) {
      this.sendOrderbook(ws, latestBook);
    }
    const latestTicker = this.latestTickers.get(this.marketKey(exchangeId, instrumentId));
    if (latestTicker) {
      this.sendTicker(ws, latestTicker);
    }
    return true;
  }

  handleMessage(ws, msg) {
    const client = this.clients.get(ws);
    if (!client) return;

    if (msg.type === 'selectExchange' || msg.type === 'selectMarket') {
      this.selectMarket(ws, msg);
    } else if (msg.type === 'simulate') {
      const { side, amount } = msg;
      const amountType = msg.amountType === 'btc' ? 'base' : msg.amountType;
      const exchangeId = msg.exchangeId || client.exchangeId || this.defaultExchangeId;
      const exchange = this.getExchange(exchangeId);
      const instrumentId = msg.instrumentId || client.instrumentId || this.getDefaultInstrumentId(exchange);

      if (!this.getMarket(exchangeId, instrumentId)) {
        ws.send(JSON.stringify({ type: 'error', message: '未対応の銘柄です' }));
        return;
      }
      client.exchangeId = exchangeId;
      client.instrumentId = instrumentId;
      this.onMarketSelected({ exchangeId, instrumentId });

      // Validate
      if (!['buy', 'sell'].includes(side)) {
        ws.send(JSON.stringify({ type: 'error', message: 'side は buy または sell を指定してください' }));
        return;
      }
      if (!['base', 'jpy'].includes(amountType)) {
        ws.send(JSON.stringify({ type: 'error', message: 'amountType は base または jpy を指定してください' }));
        return;
      }
      const numAmount = parseFloat(String(amount).replace(/,/g, ''));
      if (isNaN(numAmount) || numAmount <= 0) {
        ws.send(JSON.stringify({ type: 'error', message: '正の数値を入力してください' }));
        return;
      }

      let feeRate = parseFloat(String(msg.feeRate).replace(/,/g, ''));
      if (!Number.isFinite(feeRate)) {
        const fallbackFeeLevel = parseInt(msg.feeLevel, 10) || 1;
        feeRate = ({ 1: 0.0014, 2: 0.0012, 3: 0.0010, 4: 0.0008, 5: 0.0007, 6: 0.0006 }[fallbackFeeLevel]) || 0.0014;
      }
      if (feeRate < 0 || feeRate > 1) {
        ws.send(JSON.stringify({ type: 'error', message: '手数料率は0%以上100%以下で入力してください' }));
        return;
      }

      // Store params for auto-recalculation
      const params = {
        side,
        amount: numAmount,
        amountType,
        feeRate,
        autoUpdate: msg.autoUpdate !== false,
        exchangeId,
        instrumentId,
      };
      client.simulationParams = params.autoUpdate ? params : null;

      // Run simulation
      const latestBook = this.latestBooks.get(this.marketKey(exchangeId, instrumentId));
      if (latestBook) {
        const result = calculateImpact(params.side, params.amount, params.amountType, latestBook, { feeRate: params.feeRate });
        ws.send(JSON.stringify({ type: 'simulation', data: result }));
      } else {
        ws.send(JSON.stringify({ type: 'error', message: '板データを取得中です。しばらくお待ちください。' }));
      }
    } else if (msg.type === 'clearSimulation') {
      client.simulationParams = null;
    } else if (msg.type === 'ping') {
      ws.send(JSON.stringify({ type: 'pong' }));
    }
  }

  onOrderBook(book) {
    const exchangeId = book.exchangeId || this.defaultExchangeId;
    const instrumentId = book.instrumentId || 'BTC-JPY';
    const key = this.marketKey(exchangeId, instrumentId);
    this.latestBooks.set(key, book);
    this.pendingMarketKeys.add(key);

    if (!this.throttleTimer) {
      this.throttleTimer = setTimeout(() => {
        this.throttleTimer = null;
        const marketKeys = Array.from(this.pendingMarketKeys);
        this.pendingMarketKeys.clear();
        marketKeys.forEach(marketKey => this.broadcast(marketKey));
      }, 500);
    }
  }

  broadcast(marketKey) {
    const latestBook = this.latestBooks.get(marketKey);
    if (!latestBook) return;

    const summary = latestBook.toSummary();
    const depthChart = latestBook.toDepthChart();
    const impactThresholds = calculateImpactThresholds(latestBook);
    const exchange = this.getExchange(summary.exchangeId);
    const market = this.getMarket(summary.exchangeId, summary.instrumentId);
    const ticker = this.latestTickers.get(marketKey) || null;
    const bookMsg = JSON.stringify({ type: 'orderbook', data: { ...summary, exchange, market, depthChart, impactThresholds, ticker } });

    for (const [ws, state] of this.clients) {
      if (ws.readyState !== 1) continue; // OPEN
      if (this.marketKey(state.exchangeId, state.instrumentId) !== marketKey) continue;

      ws.send(bookMsg);

      // Auto-recalculate active simulations
      if (state.simulationParams) {
        const p = state.simulationParams;
        const result = calculateImpact(p.side, p.amount, p.amountType, latestBook, { feeRate: p.feeRate });
        ws.send(JSON.stringify({ type: 'simulation', data: result }));
      }
    }
  }

  sendOrderbook(ws, book) {
    if (ws.readyState !== 1) return;
    const exchangeId = book.exchangeId || this.defaultExchangeId;
    const instrumentId = book.instrumentId || 'BTC-JPY';
    const summary = book.toSummary();
    const depthChart = book.toDepthChart();
    const impactThresholds = calculateImpactThresholds(book);
    const exchange = this.getExchange(exchangeId);
    const market = this.getMarket(exchangeId, instrumentId);
    const ticker = this.latestTickers.get(this.marketKey(exchangeId, instrumentId)) || null;
    ws.send(JSON.stringify({ type: 'orderbook', data: { ...summary, exchange, market, depthChart, impactThresholds, ticker } }));
  }

  parseNumber(value) {
    const parsed = parseFloat(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  normalizeTicker(raw = {}) {
    const instrumentId = raw.instrumentId || raw.instrument_id || raw.product_id || 'BTC-JPY';
    const exchangeId = raw.exchangeId || raw.exchange_id || this.defaultExchangeId;

    return {
      exchangeId,
      instrumentId,
      last: this.parseNumber(raw.last),
      open24h: this.parseNumber(raw.open24h ?? raw.open_24h),
      high24h: this.parseNumber(raw.high24h ?? raw.high_24h),
      low24h: this.parseNumber(raw.low24h ?? raw.low_24h),
      baseVolume24h: this.parseNumber(raw.baseVolume24h ?? raw.base_volume_24h),
      quoteVolume24h: this.parseNumber(raw.quoteVolume24h ?? raw.quote_volume_24h),
      quoteVolume24hEstimated: raw.quoteVolume24hEstimated === true || raw.quote_volume_24h_estimated === true,
      timestamp: raw.timestamp || new Date().toISOString(),
      dataSource: raw.dataSource || raw.data_source || raw.source || null,
    };
  }

  onTicker(raw) {
    const ticker = this.normalizeTicker(raw);
    const key = this.marketKey(ticker.exchangeId, ticker.instrumentId);
    this.latestTickers.set(key, ticker);

    for (const [ws, state] of this.clients) {
      if (ws.readyState !== 1) continue;
      if (this.marketKey(state.exchangeId, state.instrumentId) !== key) continue;
      this.sendTicker(ws, ticker);
    }
  }

  sendTicker(ws, ticker) {
    if (ws.readyState !== 1) return;
    const exchange = this.getExchange(ticker.exchangeId);
    const market = this.getMarket(ticker.exchangeId, ticker.instrumentId);
    ws.send(JSON.stringify({ type: 'ticker', data: { ...ticker, exchange, market } }));
  }

  onStatus(status) {
    const msg = JSON.stringify({ type: 'status', data: status });
    for (const [ws] of this.clients) {
      if (ws.readyState === 1) ws.send(msg);
    }
  }
}

module.exports = WSManager;
