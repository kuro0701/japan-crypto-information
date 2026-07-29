const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const articleScriptPath = path.join(__dirname, '../../public/js/article.js');

test('article Live reference resolves domestic orderbooks before any overseas fallback', () => {
  const source = fs.readFileSync(articleScriptPath, 'utf8');
  const start = source.indexOf('function initArticleLiveMarketCard()');
  const end = source.indexOf('function initSpreadCostSlider()', start);
  assert.ok(start >= 0);
  assert.ok(end > start);

  const liveReferenceSource = source.slice(start, end);
  const domesticFetch = liveReferenceSource.indexOf('/api/markets/');
  const overseasFetch = liveReferenceSource.indexOf('fetchExternalMarketReference');

  assert.ok(domesticFetch >= 0);
  assert.ok(overseasFetch > domesticFetch);
  assert.doesNotMatch(liveReferenceSource, /sales-spread|sales-reference|販売所データ/);
});
