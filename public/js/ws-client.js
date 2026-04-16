class WSClient {
  constructor() {
    this.ws = null;
    this.handlers = {};
    this.reconnectDelay = 1000;
    this.maxReconnectDelay = 10000;
    this.pingInterval = null;
    this.exchangeId = 'okj';
    this.instrumentId = 'BTC-JPY';
  }

  connect() {
    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const url = `${protocol}//${location.host}/ws`;

    this.ws = new WebSocket(url);

    this.ws.onopen = () => {
      this.reconnectDelay = 1000;
      this.emit('connected');
      this.send({ type: 'selectMarket', exchangeId: this.exchangeId, instrumentId: this.instrumentId });
      this.startPing();
    };

    this.ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        this.emit(msg.type, msg.data || msg);
      } catch (_) {}
    };

    this.ws.onclose = () => {
      this.stopPing();
      this.emit('disconnected');
      setTimeout(() => {
        this.reconnectDelay = Math.min(this.reconnectDelay * 2, this.maxReconnectDelay);
        this.emit('reconnecting');
        this.connect();
      }, this.reconnectDelay);
    };

    this.ws.onerror = () => {};
  }

  send(msg) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  setExchange(exchangeId) {
    this.exchangeId = exchangeId || 'okj';
    this.send({ type: 'selectMarket', exchangeId: this.exchangeId, instrumentId: this.instrumentId });
  }

  setMarket(exchangeId, instrumentId) {
    this.exchangeId = exchangeId || 'okj';
    this.instrumentId = instrumentId || 'BTC-JPY';
    this.send({ type: 'selectMarket', exchangeId: this.exchangeId, instrumentId: this.instrumentId });
  }

  simulate(side, amount, amountType, feeRate, autoUpdate) {
    this.send({
      type: 'simulate',
      side,
      amount,
      amountType,
      feeRate,
      autoUpdate,
      exchangeId: this.exchangeId,
      instrumentId: this.instrumentId,
    });
  }

  clearSimulation() {
    this.send({ type: 'clearSimulation' });
  }

  on(event, handler) {
    if (!this.handlers[event]) this.handlers[event] = [];
    this.handlers[event].push(handler);
  }

  emit(event, data) {
    (this.handlers[event] || []).forEach(h => h(data));
  }

  startPing() {
    this.pingInterval = setInterval(() => this.send({ type: 'ping' }), 30000);
  }

  stopPing() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }
}
