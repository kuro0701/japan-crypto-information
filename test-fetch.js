fetch('https://www.okcoin.jp/api/spot/v3/instruments', { timeout: 3000 })
  .then(res => res.json())
  .then(d => console.log('count:', d.length, 'first:', d[0].instrument_id))
  .catch(err => console.error(err));
