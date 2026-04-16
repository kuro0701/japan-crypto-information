const OKCoinClient = require('./lib/okcoin-client');
const client = new OKCoinClient(500, { defaultInstrumentId: 'BTC-JPY' });
client.on('instruments', (insts) => {
  console.log('Instruments refreshed:', insts.length);
  const ok = client.activateInstrument('ETH-JPY');
  console.log('activate ETH-JPY:', ok);
});
client.on('orderbook', (data) => console.log('orderbook:', data.instrument_id, data.source));
client.start();
setTimeout(() => client.stop(), 5000);
