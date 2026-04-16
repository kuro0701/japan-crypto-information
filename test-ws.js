const WebSocket = require('ws');
const ws = new WebSocket('wss://connect.okcoin.jp:443/ws/v3');
ws.on('open', () => {
  ws.send(JSON.stringify({ op: 'subscribe', args: ['spot/depth:ETH-JPY'] }));
});
ws.on('message', (data) => {
  if(data.toString('utf8').includes('ping')) return;
  const zlib = require('zlib');
  let text = '';
  try { text = zlib.inflateRawSync(data).toString('utf8'); } catch(e) { text = data.toString('utf8'); }
  console.log(text.substring(0, 500));
  process.exit(0);
});
