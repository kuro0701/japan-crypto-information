const { getPublicExchanges, setExchangeMarkets } = require('./lib/exchanges');
setExchangeMarkets('okj', [{"base_currency":"BTC","instrument_id":"BTC-JPY"},{"base_currency":"ETH","instrument_id":"ETH-JPY"}]);
console.log(JSON.stringify(getPublicExchanges(), null, 2));
