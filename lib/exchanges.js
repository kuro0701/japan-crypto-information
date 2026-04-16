const DEFAULT_OKJ_MARKETS = [
  {
    instrumentId: 'BTC-JPY',
    label: 'BTC/JPY',
    baseCurrency: 'BTC',
    quoteCurrency: 'JPY',
    minSize: null,
    sizeIncrement: null,
    tickSize: null,
    status: 'active',
  },
];

const COINCHECK_EXCHANGE_ID = 'coincheck';
const DEFAULT_COINCHECK_INSTRUMENT_ID = 'BTC-JPY';
const DEFAULT_COINCHECK_MARKETS = [
  'BTC-JPY',
  'ETH-JPY',
  'ETC-JPY',
  'LSK-JPY',
  'XRP-JPY',
  'XEM-JPY',
  'BCH-JPY',
  'MONA-JPY',
  'IOST-JPY',
  'CHZ-JPY',
  'IMX-JPY',
  'SHIB-JPY',
  'AVAX-JPY',
  'FNCT-JPY',
  'DAI-JPY',
  'WBTC-JPY',
  'BRIL-JPY',
  'BC-JPY',
  'DOGE-JPY',
  'PEPE-JPY',
  'MASK-JPY',
  'MANA-JPY',
  'TRX-JPY',
  'GRT-JPY',
  'SOL-JPY',
  'FPL-JPY',
].map((instrumentId) => {
  const [baseCurrency, quoteCurrency] = instrumentId.split('-');
  return {
    instrumentId,
    label: `${baseCurrency}/${quoteCurrency}`,
    baseCurrency,
    quoteCurrency,
    minSize: null,
    sizeIncrement: null,
    tickSize: null,
    status: 'active',
  };
});

const BITFLYER_EXCHANGE_ID = 'bitflyer';
const DEFAULT_BITFLYER_INSTRUMENT_ID = 'BTC-JPY';
const DEFAULT_BITFLYER_MARKETS = [
  'BTC-JPY',
  'XRP-JPY',
  'ETH-JPY',
  'XLM-JPY',
  'MONA-JPY',
  'ELF-JPY',
].map((instrumentId) => {
  const [baseCurrency, quoteCurrency] = instrumentId.split('-');
  return {
    instrumentId,
    label: `${baseCurrency}/${quoteCurrency}`,
    baseCurrency,
    quoteCurrency,
    minSize: null,
    sizeIncrement: null,
    tickSize: null,
    status: 'active',
  };
});

const BITBANK_EXCHANGE_ID = 'bitbank';
const DEFAULT_BITBANK_INSTRUMENT_ID = 'BTC-JPY';
const DEFAULT_BITBANK_MARKETS = [
  'BTC-JPY',
  'XRP-JPY',
  'ETH-JPY',
  'SOL-JPY',
  'DOT-JPY',
  'DOGE-JPY',
  'LTC-JPY',
  'BCC-JPY',
  'MONA-JPY',
  'XLM-JPY',
  'QTUM-JPY',
  'BAT-JPY',
  'OMG-JPY',
  'XYM-JPY',
  'LINK-JPY',
  'MKR-JPY',
  'BOBA-JPY',
  'ENJ-JPY',
  'ASTR-JPY',
  'ADA-JPY',
  'AVAX-JPY',
  'AXS-JPY',
  'FLR-JPY',
  'SAND-JPY',
  'GALA-JPY',
  'CHZ-JPY',
  'APE-JPY',
  'OAS-JPY',
  'MANA-JPY',
  'GRT-JPY',
  'RNDR-JPY',
  'BNB-JPY',
  'DAI-JPY',
  'OP-JPY',
  'ARB-JPY',
  'KLAY-JPY',
  'IMX-JPY',
  'MASK-JPY',
  'POL-JPY',
  'CYBER-JPY',
  'RENDER-JPY',
  'TRX-JPY',
  'LPT-JPY',
  'ATOM-JPY',
  'SUI-JPY',
  'SKY-JPY',
  'MATIC-JPY',
].map((instrumentId) => {
  const [baseCurrency, quoteCurrency] = instrumentId.split('-');
  return {
    instrumentId,
    label: `${baseCurrency}/${quoteCurrency}`,
    baseCurrency,
    quoteCurrency,
    minSize: null,
    sizeIncrement: null,
    tickSize: null,
    status: 'active',
  };
});

const GMO_EXCHANGE_ID = 'gmo';
const DEFAULT_GMO_INSTRUMENT_ID = 'BTC-JPY';
const DEFAULT_GMO_MARKETS = [
  'BTC-JPY',
  'ETH-JPY',
  'BCH-JPY',
  'LTC-JPY',
  'XRP-JPY',
  'XLM-JPY',
  'XTZ-JPY',
  'DOT-JPY',
  'ATOM-JPY',
  'DAI-JPY',
  'FCR-JPY',
  'ADA-JPY',
  'LINK-JPY',
  'DOGE-JPY',
  'SOL-JPY',
  'ASTR-JPY',
  'NAC-JPY',
  'WILD-JPY',
  'SUI-JPY',
].map((instrumentId) => {
  const [baseCurrency, quoteCurrency] = instrumentId.split('-');
  return {
    instrumentId,
    label: `${baseCurrency}/${quoteCurrency}`,
    baseCurrency,
    quoteCurrency,
    minSize: null,
    sizeIncrement: null,
    tickSize: null,
    status: 'active',
  };
});

const BINANCE_JAPAN_EXCHANGE_ID = 'binance-japan';
const DEFAULT_BINANCE_JAPAN_INSTRUMENT_ID = 'BTC-JPY';
const DEFAULT_BINANCE_JAPAN_MARKETS = [
  'BTC-JPY',
  'ETH-JPY',
  'BNB-JPY',
  'XRP-JPY',
  'SOL-JPY',
  'ADA-JPY',
  'DOGE-JPY',
  'SHIB-JPY',
  'NEAR-JPY',
  'POL-JPY',
  'APT-JPY',
  'SUI-JPY',
  'XLM-JPY',
  'PEPE-JPY',
  'IOTX-JPY',
  'SEI-JPY',
  'LTC-JPY',
  'BCH-JPY',
  'LINK-JPY',
  'TRX-JPY',
  'LPT-JPY',
  'TRUMP-JPY',
  'FET-JPY',
  'TAO-JPY',
].map((instrumentId) => {
  const [baseCurrency, quoteCurrency] = instrumentId.split('-');
  return {
    instrumentId,
    label: `${baseCurrency}/${quoteCurrency}`,
    baseCurrency,
    quoteCurrency,
    minSize: null,
    sizeIncrement: null,
    tickSize: null,
    status: 'active',
  };
});

const EXCHANGES = [
  {
    id: 'okj',
    label: 'OKJ',
    fullName: 'OKCoin Japan',
    dataSourceLabel: 'OKCoin Japan WebSocket + REST fallback',
    status: 'active',
    defaultInstrumentId: DEFAULT_OKJ_MARKETS[0].instrumentId,
    markets: DEFAULT_OKJ_MARKETS,
  },
  {
    id: COINCHECK_EXCHANGE_ID,
    label: 'Coincheck',
    fullName: 'Coincheck',
    dataSourceLabel: 'Coincheck WebSocket + REST fallback',
    status: 'active',
    defaultInstrumentId: DEFAULT_COINCHECK_INSTRUMENT_ID,
    markets: DEFAULT_COINCHECK_MARKETS,
  },
  {
    id: BITFLYER_EXCHANGE_ID,
    label: 'bitFlyer',
    fullName: 'bitFlyer',
    dataSourceLabel: 'bitFlyer Realtime API + REST fallback',
    status: 'active',
    defaultInstrumentId: DEFAULT_BITFLYER_INSTRUMENT_ID,
    markets: DEFAULT_BITFLYER_MARKETS,
  },
  {
    id: BITBANK_EXCHANGE_ID,
    label: 'bitbank',
    fullName: 'bitbank',
    dataSourceLabel: 'bitbank Public Stream + REST fallback',
    status: 'active',
    defaultInstrumentId: DEFAULT_BITBANK_INSTRUMENT_ID,
    markets: DEFAULT_BITBANK_MARKETS,
  },
  {
    id: GMO_EXCHANGE_ID,
    label: 'GMO Coin',
    fullName: 'GMO Coin',
    dataSourceLabel: 'GMO Coin WebSocket + REST fallback',
    status: 'active',
    defaultInstrumentId: DEFAULT_GMO_INSTRUMENT_ID,
    markets: DEFAULT_GMO_MARKETS,
  },
  {
    id: BINANCE_JAPAN_EXCHANGE_ID,
    label: 'Binance Japan',
    fullName: 'Binance Japan',
    dataSourceLabel: 'Binance Spot REST market data',
    status: 'active',
    defaultInstrumentId: DEFAULT_BINANCE_JAPAN_INSTRUMENT_ID,
    markets: DEFAULT_BINANCE_JAPAN_MARKETS,
  },
];

const DEFAULT_EXCHANGE_ID = EXCHANGES[0].id;
const DEFAULT_OKJ_INSTRUMENT_ID = 'BTC-JPY';

function instrumentLabel(instrumentId, baseCurrency, quoteCurrency) {
  if (baseCurrency && quoteCurrency) return `${baseCurrency}/${quoteCurrency}`;
  return String(instrumentId || '').replace('-', '/');
}

function normalizeMarket(instrument) {
  const instrumentId = instrument.instrument_id || instrument.instrumentId;
  const baseCurrency = instrument.base_currency || instrument.baseCurrency || (instrumentId ? instrumentId.split('-')[0] : '');
  const quoteCurrency = instrument.quote_currency || instrument.quoteCurrency || (instrumentId ? instrumentId.split('-')[1] : '');

  return {
    instrumentId,
    label: instrument.label || instrumentLabel(instrumentId, baseCurrency, quoteCurrency),
    baseCurrency,
    quoteCurrency,
    minSize: instrument.min_size || instrument.minSize || null,
    sizeIncrement: instrument.size_increment || instrument.sizeIncrement || null,
    tickSize: instrument.tick_size || instrument.tickSize || null,
    status: instrument.status || 'active',
  };
}

function getDefaultMarket(exchange) {
  const preferredInstrumentId = exchange.defaultInstrumentId || DEFAULT_OKJ_INSTRUMENT_ID;
  return exchange.markets.find(market => market.instrumentId === preferredInstrumentId)
    || exchange.markets[0]
    || DEFAULT_OKJ_MARKETS[0];
}

function getExchange(id) {
  return EXCHANGES.find(exchange => exchange.id === id) || null;
}

function setExchangeMarkets(exchangeId, instruments) {
  const exchange = getExchange(exchangeId);
  if (!exchange) return null;

  const markets = (instruments || [])
    .map(normalizeMarket)
    .filter(market => market.instrumentId && market.baseCurrency && market.quoteCurrency);

  if (markets.length > 0) {
    exchange.markets = markets;
  }

  return exchange;
}

function toPublicExchange(exchange) {
  const defaultMarket = getDefaultMarket(exchange);
  return {
    id: exchange.id,
    label: exchange.label,
    fullName: exchange.fullName,
    dataSourceLabel: exchange.dataSourceLabel,
    status: exchange.status,
    defaultInstrumentId: defaultMarket.instrumentId,
    instrumentId: defaultMarket.instrumentId,
    instrumentLabel: defaultMarket.label,
    markets: exchange.markets.map(normalizeMarket),
  };
}

function getPublicExchanges() {
  return EXCHANGES.map(toPublicExchange);
}

module.exports = {
  EXCHANGES,
  DEFAULT_EXCHANGE_ID,
  DEFAULT_OKJ_INSTRUMENT_ID,
  COINCHECK_EXCHANGE_ID,
  DEFAULT_COINCHECK_INSTRUMENT_ID,
  BITFLYER_EXCHANGE_ID,
  DEFAULT_BITFLYER_INSTRUMENT_ID,
  BITBANK_EXCHANGE_ID,
  DEFAULT_BITBANK_INSTRUMENT_ID,
  GMO_EXCHANGE_ID,
  DEFAULT_GMO_INSTRUMENT_ID,
  BINANCE_JAPAN_EXCHANGE_ID,
  DEFAULT_BINANCE_JAPAN_INSTRUMENT_ID,
  getExchange,
  getPublicExchanges,
  setExchangeMarkets,
};
