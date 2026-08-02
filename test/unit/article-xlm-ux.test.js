const fs = require('fs');
const path = require('path');
const test = require('node:test');
const assert = require('node:assert/strict');

const read = relativePath => fs.readFileSync(path.join(__dirname, '../..', relativePath), 'utf8');

test('XLM article exposes the requested reading modes, metric cards, sources, and contextual actions', () => {
  const source = read('content/xlm.md');

  assert.match(source, /data-summary-tab="full"/);
  assert.match(source, /data-summary-tab="quick"/);
  assert.match(source, /data-summary-tab="focus"/);
  assert.match(source, /article-key-metrics article-key-metrics--xlm/);
  assert.match(source, /500\.018/);
  assert.match(source, /155\.578/);
  assert.match(source, /100<small>stroops/);
  assert.match(source, /2026\/07\/24 05:28 UTC 取得/);
  assert.match(source, /data-article-market-cta/);
  assert.match(source, /bitbankのXLM板コストを見る/);
  assert.match(source, /各社のXLM販売所スプレッドを比較/);
});

test('XLM technical diagrams provide tappable explanations and step navigation', () => {
  const source = read('content/xlm.md');
  const script = read('public/js/article.js');

  assert.equal((source.match(/data-article-flow>/g) || []).length, 2);
  assert.match(source, /data-flow-label="Validator quorum settings"/);
  assert.match(source, /data-flow-label="Order book or AMM"/);
  assert.match(script, /article-flow-controls/);
  assert.match(script, /data-flow-step="prev"/);
  assert.match(script, /mouseenter/);
});

test('XLM glossary and shared reader controls include bottom-sheet navigation and highlights', () => {
  const beginner = read('public/js/beginner-mode.js');
  const template = read('public/templates/article.html');
  const style = read('public/css/article.css');

  assert.match(beginner, /scp:\s*\{/);
  assert.match(beginner, /soroban:\s*\{/);
  assert.match(beginner, /clawback:\s*\{/);
  assert.match(beginner, /'path-payment':\s*\{/);
  assert.match(beginner, /term-tooltip__section-link/);
  assert.match(beginner, /term-tooltip__related/);
  assert.match(template, /data-reader-highlights/);
  assert.match(style, /article-term-sheet-in/);
  assert.match(style, /article-reader-highlights/);
});

test('Live Reference supports an external 24-hour XLM sparkline without replacing domestic best rates', () => {
  const client = read('lib/market-reference-client.js');
  const script = read('public/js/article.js');

  assert.match(client, /XLM:\s*Object\.freeze/);
  assert.match(client, /coinGeckoId: 'stellar'/);
  assert.match(client, /fetchCoinGeckoSparkline/);
  assert.match(script, /EXTERNAL_MARKET_REFERENCE_TICKERS = new Set\(\['CANTON', 'XLM'\]\)/);
  assert.match(script, /renderArticleRemoteSparkline/);
  assert.match(script, /renderArticleLocalMiniSparkline/);
  assert.match(script, /renderDomesticMarketReference\(card, domesticReport, instrumentId\)/);
});
