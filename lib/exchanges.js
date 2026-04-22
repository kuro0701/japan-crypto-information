function buildStaticMarket(instrumentId, overrides = {}) {
  const [baseCurrency, quoteCurrency] = String(instrumentId || '').split('-');
  return {
    instrumentId,
    label: `${baseCurrency}/${quoteCurrency}`,
    baseCurrency,
    quoteCurrency,
    minSize: null,
    sizeIncrement: null,
    tickSize: null,
    status: 'active',
    takerFeeRate: null,
    takerFeeNote: null,
    ...overrides,
  };
}

function buildStaticMarkets(instrumentIds, overridesByInstrument = {}) {
  return instrumentIds.map(instrumentId => buildStaticMarket(instrumentId, overridesByInstrument[instrumentId]));
}

const OKJ_TAKER_FEE_RATE = 0.0014;
const COINCHECK_TAKER_FEE_RATE = 0;
const BITFLYER_TAKER_FEE_RATE = 0.0015;
const BITBANK_TAKER_FEE_RATE = 0.0012;
const GMO_TAKER_FEE_RATE = 0.0003;
const BINANCE_JAPAN_TAKER_FEE_RATE = 0.001;
const BITTRADE_TAKER_FEE_RATE = 0.001;

const COINCHECK_MARKET_OVERRIDES = {
  'ETC-JPY': { takerFeeRate: 0.001, takerFeeNote: '取引所通常' },
  'IOST-JPY': { takerFeeRate: 0.001, takerFeeNote: '取引所通常' },
  'FNCT-JPY': { takerFeeRate: 0.001, takerFeeNote: '取引所通常' },
  'BRIL-JPY': { takerFeeRate: 0.001, takerFeeNote: '取引所通常' },
  'BC-JPY': { takerFeeRate: 0.001, takerFeeNote: '取引所通常' },
  'FPL-JPY': { takerFeeRate: 0.001, takerFeeNote: '取引所通常' },
};

const BITFLYER_MARKET_OVERRIDES = {
  'BTC-JPY': { minSize: 0.001, sizeIncrement: 0.00000001 },
  'ETH-JPY': { minSize: 0.01, sizeIncrement: 0.00000001 },
  'XRP-JPY': { minSize: 0.1, sizeIncrement: 0.000001 },
  'XLM-JPY': { minSize: 0.1, sizeIncrement: 0.0000001 },
  'MONA-JPY': { minSize: 0.1, sizeIncrement: 0.00000001 },
  'ELF-JPY': { minSize: 0.01, sizeIncrement: 0.00000001, takerFeeRate: 0.002, takerFeeNote: 'かんたん取引所通常' },
};

const BITBANK_MARKET_OVERRIDES = {
  'BTC-JPY': { takerFeeRate: 0.001, takerFeeNote: '取引所通常' },
};

const DEFAULT_OKJ_MARKETS = buildStaticMarkets([
  'BTC-JPY',
], {
  'BTC-JPY': {
    takerFeeRate: OKJ_TAKER_FEE_RATE,
    takerFeeNote: '通常',
  },
});

const COINCHECK_EXCHANGE_ID = 'coincheck';
const DEFAULT_COINCHECK_INSTRUMENT_ID = 'BTC-JPY';
const DEFAULT_COINCHECK_MARKETS = buildStaticMarkets([
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
], Object.assign({
  'BTC-JPY': { takerFeeRate: COINCHECK_TAKER_FEE_RATE, takerFeeNote: '取引所通常' },
  'ETH-JPY': { takerFeeRate: COINCHECK_TAKER_FEE_RATE, takerFeeNote: '取引所通常' },
  'XRP-JPY': { takerFeeRate: COINCHECK_TAKER_FEE_RATE, takerFeeNote: '取引所通常' },
  'XEM-JPY': { takerFeeRate: COINCHECK_TAKER_FEE_RATE, takerFeeNote: '取引所通常' },
  'BCH-JPY': { takerFeeRate: COINCHECK_TAKER_FEE_RATE, takerFeeNote: '取引所通常' },
  'MONA-JPY': { takerFeeRate: COINCHECK_TAKER_FEE_RATE, takerFeeNote: '取引所通常' },
  'CHZ-JPY': { takerFeeRate: COINCHECK_TAKER_FEE_RATE, takerFeeNote: '取引所通常' },
  'IMX-JPY': { takerFeeRate: COINCHECK_TAKER_FEE_RATE, takerFeeNote: '取引所通常' },
  'SHIB-JPY': { takerFeeRate: COINCHECK_TAKER_FEE_RATE, takerFeeNote: '取引所通常' },
  'AVAX-JPY': { takerFeeRate: COINCHECK_TAKER_FEE_RATE, takerFeeNote: '取引所通常' },
  'DAI-JPY': { takerFeeRate: COINCHECK_TAKER_FEE_RATE, takerFeeNote: '取引所通常' },
  'WBTC-JPY': { takerFeeRate: COINCHECK_TAKER_FEE_RATE, takerFeeNote: '取引所通常' },
  'DOGE-JPY': { takerFeeRate: COINCHECK_TAKER_FEE_RATE, takerFeeNote: '取引所通常' },
  'PEPE-JPY': { takerFeeRate: COINCHECK_TAKER_FEE_RATE, takerFeeNote: '取引所通常' },
  'MASK-JPY': { takerFeeRate: COINCHECK_TAKER_FEE_RATE, takerFeeNote: '取引所通常' },
  'MANA-JPY': { takerFeeRate: COINCHECK_TAKER_FEE_RATE, takerFeeNote: '取引所通常' },
  'TRX-JPY': { takerFeeRate: COINCHECK_TAKER_FEE_RATE, takerFeeNote: '取引所通常' },
  'GRT-JPY': { takerFeeRate: COINCHECK_TAKER_FEE_RATE, takerFeeNote: '取引所通常' },
  'SOL-JPY': { takerFeeRate: COINCHECK_TAKER_FEE_RATE, takerFeeNote: '取引所通常' },
}, COINCHECK_MARKET_OVERRIDES));

const BITFLYER_EXCHANGE_ID = 'bitflyer';
const DEFAULT_BITFLYER_INSTRUMENT_ID = 'BTC-JPY';
const DEFAULT_BITFLYER_MARKETS = buildStaticMarkets([
  'BTC-JPY',
  'XRP-JPY',
  'ETH-JPY',
  'XLM-JPY',
  'MONA-JPY',
  'ELF-JPY',
], Object.assign({
  'BTC-JPY': { takerFeeRate: BITFLYER_TAKER_FEE_RATE, takerFeeNote: '直近30日10万円未満' },
  'ETH-JPY': { takerFeeRate: BITFLYER_TAKER_FEE_RATE, takerFeeNote: '直近30日10万円未満' },
  'XRP-JPY': { takerFeeRate: BITFLYER_TAKER_FEE_RATE, takerFeeNote: '直近30日10万円未満' },
  'XLM-JPY': { takerFeeRate: BITFLYER_TAKER_FEE_RATE, takerFeeNote: '直近30日10万円未満' },
  'MONA-JPY': { takerFeeRate: BITFLYER_TAKER_FEE_RATE, takerFeeNote: '直近30日10万円未満' },
}, BITFLYER_MARKET_OVERRIDES));

const BITBANK_EXCHANGE_ID = 'bitbank';
const DEFAULT_BITBANK_INSTRUMENT_ID = 'BTC-JPY';
const DEFAULT_BITBANK_MARKETS = buildStaticMarkets([
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
], Object.assign({
  'BTC-JPY': { takerFeeRate: BITBANK_TAKER_FEE_RATE, takerFeeNote: 'BTC/JPY 通常' },
  'XRP-JPY': { takerFeeRate: BITBANK_TAKER_FEE_RATE, takerFeeNote: '取引所通常' },
  'ETH-JPY': { takerFeeRate: BITBANK_TAKER_FEE_RATE, takerFeeNote: '取引所通常' },
  'SOL-JPY': { takerFeeRate: BITBANK_TAKER_FEE_RATE, takerFeeNote: '取引所通常' },
}, BITBANK_MARKET_OVERRIDES));

const GMO_EXCHANGE_ID = 'gmo';
const DEFAULT_GMO_INSTRUMENT_ID = 'BTC-JPY';
const DEFAULT_GMO_MARKETS = buildStaticMarkets([
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
], {
  'BTC-JPY': { takerFeeRate: GMO_TAKER_FEE_RATE, takerFeeNote: '現物 JPY 通常' },
  'ETH-JPY': { takerFeeRate: GMO_TAKER_FEE_RATE, takerFeeNote: '現物 JPY 通常' },
  'BCH-JPY': { takerFeeRate: GMO_TAKER_FEE_RATE, takerFeeNote: '現物 JPY 通常' },
  'LTC-JPY': { takerFeeRate: GMO_TAKER_FEE_RATE, takerFeeNote: '現物 JPY 通常' },
  'XRP-JPY': { takerFeeRate: GMO_TAKER_FEE_RATE, takerFeeNote: '現物 JPY 通常' },
});

const BINANCE_JAPAN_EXCHANGE_ID = 'binance-japan';
const DEFAULT_BINANCE_JAPAN_INSTRUMENT_ID = 'BTC-JPY';
const DEFAULT_BINANCE_JAPAN_MARKETS = buildStaticMarkets([
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
], {
  'BTC-JPY': { takerFeeRate: BINANCE_JAPAN_TAKER_FEE_RATE, takerFeeNote: '既定' },
  'ETH-JPY': { takerFeeRate: BINANCE_JAPAN_TAKER_FEE_RATE, takerFeeNote: '既定' },
  'BNB-JPY': { takerFeeRate: BINANCE_JAPAN_TAKER_FEE_RATE, takerFeeNote: '既定' },
  'XRP-JPY': { takerFeeRate: BINANCE_JAPAN_TAKER_FEE_RATE, takerFeeNote: '既定' },
  'SOL-JPY': { takerFeeRate: BINANCE_JAPAN_TAKER_FEE_RATE, takerFeeNote: '既定' },
});

const BITTRADE_EXCHANGE_ID = 'bittrade';
const DEFAULT_BITTRADE_INSTRUMENT_ID = 'BTC-JPY';
const DEFAULT_BITTRADE_MARKETS = buildStaticMarkets([
  'BTC-JPY',
  'ETH-JPY',
  'XRP-JPY',
  'ADA-JPY',
  'FLR-JPY',
  'XYM-JPY',
  'OP-JPY',
  'ONT-JPY',
  'BCH-JPY',
  'IOST-JPY',
  'BSV-JPY',
  'TRUMP-JPY',
  'AXS-JPY',
  'DAI-JPY',
  'A-JPY',
  'APT-JPY',
  'MATIC-JPY',
  'SUI-JPY',
  'WBTC-JPY',
  'PEPE-JPY',
  'LINK-JPY',
  'ARB-JPY',
  'SXP-JPY',
  'HBAR-JPY',
  'XLM-JPY',
  'BAT-JPY',
  'TON-JPY',
  'QTUM-JPY',
  'TRX-JPY',
  'DOGE-JPY',
  'LTC-JPY',
  'COT-JPY',
  'BNB-JPY',
  'XTZ-JPY',
  'JOC-JPY',
  'CRTS-JPY',
  'ASTR-JPY',
  'SHIB-JPY',
  'SOL-JPY',
  'SAND-JPY',
  'JASMY-JPY',
  'BOBA-JPY',
  'DOT-JPY',
  'DEP-JPY',
  'ATOM-JPY',
  'UPC-JPY',
  'ETC-JPY',
  'SKY-JPY',
], {
  'BTC-JPY': { takerFeeRate: BITTRADE_TAKER_FEE_RATE, takerFeeNote: '既定' },
  'ETH-JPY': { takerFeeRate: BITTRADE_TAKER_FEE_RATE, takerFeeNote: '既定' },
  'XRP-JPY': { takerFeeRate: BITTRADE_TAKER_FEE_RATE, takerFeeNote: '既定' },
  'ADA-JPY': { takerFeeRate: BITTRADE_TAKER_FEE_RATE, takerFeeNote: '既定' },
});

const EXCHANGES = [
  {
    id: 'okj',
    label: 'OKJ',
    fullName: 'OKCoin Japan',
    dataSourceLabel: 'OKCoin Japan WebSocket + REST fallback',
    status: 'active',
    takerFeeRate: OKJ_TAKER_FEE_RATE,
    takerFeeNote: '通常',
    defaultInstrumentId: DEFAULT_OKJ_MARKETS[0].instrumentId,
    markets: DEFAULT_OKJ_MARKETS,
  },
  {
    id: COINCHECK_EXCHANGE_ID,
    label: 'Coincheck',
    fullName: 'Coincheck',
    dataSourceLabel: 'Coincheck WebSocket + REST fallback',
    status: 'active',
    takerFeeRate: COINCHECK_TAKER_FEE_RATE,
    takerFeeNote: '取引所通常',
    defaultInstrumentId: DEFAULT_COINCHECK_INSTRUMENT_ID,
    markets: DEFAULT_COINCHECK_MARKETS,
  },
  {
    id: BITFLYER_EXCHANGE_ID,
    label: 'bitFlyer',
    fullName: 'bitFlyer',
    dataSourceLabel: 'bitFlyer Realtime API + REST fallback',
    status: 'active',
    takerFeeRate: BITFLYER_TAKER_FEE_RATE,
    takerFeeNote: '直近30日10万円未満',
    defaultInstrumentId: DEFAULT_BITFLYER_INSTRUMENT_ID,
    markets: DEFAULT_BITFLYER_MARKETS,
  },
  {
    id: BITBANK_EXCHANGE_ID,
    label: 'bitbank',
    fullName: 'bitbank',
    dataSourceLabel: 'bitbank Public Stream + REST fallback',
    status: 'active',
    takerFeeRate: BITBANK_TAKER_FEE_RATE,
    takerFeeNote: '取引所通常',
    defaultInstrumentId: DEFAULT_BITBANK_INSTRUMENT_ID,
    markets: DEFAULT_BITBANK_MARKETS,
  },
  {
    id: GMO_EXCHANGE_ID,
    label: 'GMO Coin',
    fullName: 'GMO Coin',
    dataSourceLabel: 'GMO Coin WebSocket + REST fallback',
    status: 'active',
    takerFeeRate: GMO_TAKER_FEE_RATE,
    takerFeeNote: '現物 JPY 通常',
    defaultInstrumentId: DEFAULT_GMO_INSTRUMENT_ID,
    markets: DEFAULT_GMO_MARKETS,
  },
  {
    id: BINANCE_JAPAN_EXCHANGE_ID,
    label: 'Binance Japan',
    fullName: 'Binance Japan',
    dataSourceLabel: 'Binance Spot REST market data',
    status: 'active',
    takerFeeRate: BINANCE_JAPAN_TAKER_FEE_RATE,
    takerFeeNote: '既定',
    defaultInstrumentId: DEFAULT_BINANCE_JAPAN_INSTRUMENT_ID,
    markets: DEFAULT_BINANCE_JAPAN_MARKETS,
  },
  {
    id: BITTRADE_EXCHANGE_ID,
    label: 'BitTrade',
    fullName: 'BitTrade',
    dataSourceLabel: 'BitTrade REST market data + retail WebSocket',
    status: 'active',
    takerFeeRate: BITTRADE_TAKER_FEE_RATE,
    takerFeeNote: '既定',
    defaultInstrumentId: DEFAULT_BITTRADE_INSTRUMENT_ID,
    markets: DEFAULT_BITTRADE_MARKETS,
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
    minSize: instrument.min_size ?? instrument.minSize ?? null,
    sizeIncrement: instrument.size_increment ?? instrument.sizeIncrement ?? null,
    tickSize: instrument.tick_size ?? instrument.tickSize ?? null,
    status: instrument.status || 'active',
    takerFeeRate: instrument.taker_fee_rate ?? instrument.takerFeeRate ?? null,
    takerFeeNote: instrument.taker_fee_note ?? instrument.takerFeeNote ?? null,
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

function mergeMarketMetadata(existing, incoming) {
  if (!existing) return incoming;
  const merged = { ...existing };
  Object.entries(incoming || {}).forEach(([key, value]) => {
    if (value === null || value === undefined || value === '') return;
    merged[key] = value;
  });
  return merged;
}

function setExchangeMarkets(exchangeId, instruments) {
  const exchange = getExchange(exchangeId);
  if (!exchange) return null;
  const existingMarkets = new Map((exchange.markets || [])
    .map(normalizeMarket)
    .filter(market => market.instrumentId)
    .map(market => [market.instrumentId, market]));

  const markets = (instruments || [])
    .map((instrument) => {
      const normalized = normalizeMarket(instrument);
      const existing = existingMarkets.get(normalized.instrumentId) || null;
      return normalizeMarket(mergeMarketMetadata(existing, normalized));
    })
    .filter(market => market.instrumentId && market.baseCurrency && market.quoteCurrency);

  if (markets.length > 0) {
    exchange.markets = markets;
  }

  return exchange;
}

function toPublicExchange(exchange) {
  const defaultMarket = getDefaultMarket(exchange);
  const markets = (exchange.markets || []).map((market) => {
    const normalized = normalizeMarket(market);
    if (normalized.takerFeeRate != null) return normalized;
    if (exchange.takerFeeRate == null) return normalized;
    return {
      ...normalized,
      takerFeeRate: exchange.takerFeeRate,
      takerFeeNote: normalized.takerFeeNote || exchange.takerFeeNote || null,
    };
  });
  return {
    id: exchange.id,
    label: exchange.label,
    fullName: exchange.fullName,
    dataSourceLabel: exchange.dataSourceLabel,
    status: exchange.status,
    takerFeeRate: exchange.takerFeeRate ?? null,
    takerFeeNote: exchange.takerFeeNote || null,
    defaultInstrumentId: defaultMarket.instrumentId,
    instrumentId: defaultMarket.instrumentId,
    instrumentLabel: defaultMarket.label,
    markets,
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
  BITTRADE_EXCHANGE_ID,
  DEFAULT_BITTRADE_INSTRUMENT_ID,
  getExchange,
  getPublicExchanges,
  setExchangeMarkets,
};
