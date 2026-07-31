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

test('article Live reference links best bid and ask venues through exchange referral metadata', () => {
  const source = fs.readFileSync(articleScriptPath, 'utf8');
  const helperStart = source.indexOf('function articleExchangeAffiliateLink(');
  const rendererEnd = source.indexOf('function renderExternalMarketReference(', helperStart);
  assert.ok(helperStart >= 0);
  assert.ok(rendererEnd > helperStart);

  const domesticReferenceSource = source.slice(helperStart, rendererEnd);
  assert.match(domesticReferenceSource, /actions\.referralUrl/);
  assert.match(domesticReferenceSource, /sponsored noopener/);
  assert.match(domesticReferenceSource, /bestBid\.exchangeId/);
  assert.match(domesticReferenceSource, /bestAsk\.exchangeId/);
  assert.match(domesticReferenceSource, /article-live-market-card__venue-link/);
  assert.match(domesticReferenceSource, /data-live-market-exchange/);
  assert.match(domesticReferenceSource, /article-live-market-card__side--sell/);
  assert.match(domesticReferenceSource, /article-live-market-card__side--buy/);
  assert.match(domesticReferenceSource, /articleExchangeIdentity/);
  assert.match(domesticReferenceSource, /article-live-market-card__exchange-logo/);
  assert.match(domesticReferenceSource, /market-exchange-logo--/);
  assert.match(domesticReferenceSource, /仲値（国内取引所ベストレート）/);
});

test('article Live reference exposes a pulsing update status beside the board timestamp', () => {
  const source = fs.readFileSync(articleScriptPath, 'utf8');

  assert.match(source, /article-live-market-card__live-dot/);
  assert.match(source, /data-live-market-updated/);
  assert.match(source, /最良買気配と最良売気配の仲値/);
});

test('article Live reference flashes price updates according to direction', () => {
  const source = fs.readFileSync(articleScriptPath, 'utf8');

  assert.match(source, /flashLiveMarketPrice/);
  assert.match(source, /is-price-up/);
  assert.match(source, /is-price-down/);
  assert.match(source, /is-price-steady/);
});

test('desktop article contents starts expanded while mobile contents remains compact', () => {
  const source = fs.readFileSync(articleScriptPath, 'utf8');

  assert.match(source, /setTocExpanded\(toc, true\)/);
  assert.match(source, /setTocExpanded\(mobileToc, false\)/);
});
