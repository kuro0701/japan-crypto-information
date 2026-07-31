const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = relativePath => fs.readFileSync(path.join(__dirname, '../..', relativePath), 'utf8');

test('SOL article exposes audience summaries, changelog, interactive sources, and accessible glossary terms', () => {
  const source = read('content/sol.md');

  assert.match(source, /updated: 2026-08-01/);
  assert.match(source, /data-article-summary-tabs/);
  assert.match(source, /data-summary-tab="full"/);
  assert.match(source, /data-summary-tab="quick"/);
  assert.match(source, /data-summary-tab="market"/);
  assert.match(source, /article-changelog__timeline/);
  assert.match(source, /article-change-badge--updated/);
  assert.match(source, /data-term-key="proof-of-history"/);
  assert.match(source, /data-term-key="alpenglow"/);
  assert.match(source, /data-term-key="firedancer"/);
  assert.match(source, /data-term-key="lst"/);
  assert.match(source, /data-term-key="depin"/);
  assert.match(source, /data-term-key="nakamoto-coefficient"/);
  assert.match(source, /data-source-title="SIMD-0326"/);
  assert.match(source, /data-source-title="Solana Status"/);
  assert.match(source, /article-section-disclaimer/);
});

test('SOL charts use interactive Mermaid steps and Chart.js canvases with explicit caveats', () => {
  const source = read('content/sol.md');
  const articleScript = read('public/js/article.js');

  assert.match(source, /data-article-flow/);
  assert.match(source, /data-flow-label="参照アカウント列挙"/);
  assert.match(source, /data-article-chart data-chart-type="line"/);
  assert.match(source, /data-article-chart data-chart-type="bar"/);
  assert.match(source, /連続時系列ではなく/);
  assert.match(source, /直接比較不可/);
  assert.match(articleScript, /initInteractiveArticleFlows/);
  assert.match(articleScript, /\/vendor\/chart\.umd\.min\.js/);
  assert.match(articleScript, /plugins:\s*\{[\s\S]*tooltip:/);
});

test('shared article reader exposes search, accessibility, export, speech, and selection sharing tools', () => {
  const template = read('public/templates/article.html');
  const articleScript = read('public/js/article.js');

  assert.match(template, /data-article-search-open/);
  assert.match(template, /data-reader-font="down"/);
  assert.match(template, /data-reader-font="up"/);
  assert.match(template, /data-reader-focus/);
  assert.match(template, /data-reader-speech/);
  assert.match(template, /data-reader-print/);
  assert.match(template, /data-reader-markdown/);
  assert.match(template, /data-reader-share/);
  assert.match(template, /data-article-search-dialog/);
  assert.match(articleScript, /metaKey \|\| event\.ctrlKey/);
  assert.match(articleScript, /SpeechSynthesisUtterance/);
  assert.match(articleScript, /articleMarkdownFromDom/);
  assert.match(articleScript, /article-selection-tools/);
  assert.match(articleScript, /twitter\.com\/intent\/tweet/);
  assert.match(articleScript, /ARTICLE_MEMO_STORAGE_KEY/);
});

test('Live Reference adds real captured price history, spread gauge, and explicit exchange CTA', () => {
  const articleScript = read('public/js/article.js');

  assert.match(articleScript, /data-live-series-range="1h"/);
  assert.match(articleScript, /data-live-series-range="24h"/);
  assert.match(articleScript, /appendArticleLiveSeries/);
  assert.match(articleScript, /ARTICLE_LIVE_SERIES_STORAGE_KEY/);
  assert.match(articleScript, /renderArticleSpreadGauge/);
  assert.match(articleScript, /取引手数料と注文量によるスリッページは含みません/);
  assert.match(articleScript, /article-live-market-card__venue-cta/);
  assert.match(articleScript, /口座開設 \/ 取引へ/);
});
