const Fmt = {
  _jpyFmt: new Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY', maximumFractionDigits: 0 }),
  _jpyDetailFmt: new Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY', maximumFractionDigits: 0 }),
  _numFmt: new Intl.NumberFormat('ja-JP'),

  jpy(n) {
    if (n == null || isNaN(n)) return '-';
    return this._jpyFmt.format(Math.round(n));
  },

  jpyLarge(n) {
    if (n == null || isNaN(n)) return '-';
    if (Math.abs(n) >= 1e8) {
      return (n / 1e8).toFixed(2) + '億円';
    }
    if (Math.abs(n) >= 1e4) {
      return (n / 1e4).toFixed(1) + '万円';
    }
    return this._jpyFmt.format(Math.round(n));
  },

  btc(n) {
    return this.base(n, 'BTC');
  },

  base(n, currency = 'BTC') {
    if (n == null || isNaN(n)) return '-';
    return `${parseFloat(n.toFixed(8))} ${currency}`;
  },

  btcShort(n) {
    if (n == null || isNaN(n)) return '-';
    return parseFloat(n.toFixed(4)) + '';
  },

  btcCompact(n) {
    return this.baseCompact(n);
  },

  baseCompact(n) {
    if (n == null || isNaN(n)) return '-';
    const abs = Math.abs(n);
    if (abs === 0) return '0';
    if (abs < 0.001) return parseFloat(n.toFixed(8)).toString();
    if (abs < 0.1) return parseFloat(n.toFixed(6)).toString();
    return parseFloat(n.toFixed(4)).toString();
  },

  pct(n) {
    if (n == null || isNaN(n)) return '-';
    return n.toFixed(3) + '%';
  },

  pct2(n) {
    if (n == null || isNaN(n)) return '-';
    return n.toFixed(2) + '%';
  },

  num(n, decimals = 0) {
    if (n == null || isNaN(n)) return '-';
    return this._numFmt.format(decimals > 0 ? parseFloat(n.toFixed(decimals)) : Math.round(n));
  },

  timestamp(ts) {
    if (!ts) return '-';
    const d = new Date(ts);
    return d.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  },
};
