const fs = require('fs');
const path = require('path');
const test = require('node:test');
const assert = require('node:assert/strict');

const read = relativePath => fs.readFileSync(path.join(__dirname, '../..', relativePath), 'utf8');

test('TRX article exposes audience summaries, per-section TLDRs, diff controls, and contextual CTAs', () => {
  const source = read('content/trx.md');

  assert.match(source, /updated: 2026-08-01/);
  assert.match(source, /data-article-summary-tabs/);
  assert.match(source, /Key Takeaways/);
  assert.match(source, /trx-audience-meter/);
  assert.ok((source.match(/article-section-tldr/g) || []).length >= 7);
  assert.match(source, /data-article-diff-toggle/);
  assert.match(source, /data-article-update="2026-08-01"/);
  assert.match(source, /data-article-market-cta/);
});

test('TRX technical and onchain modules are interactive and source-defined', () => {
  const source = read('content/trx.md');
  const articleScript = read('public/js/article.js');
  const beginnerMode = read('public/js/beginner-mode.js');
  const routes = read('lib/server/register-api-routes.js');

  assert.match(source, /data-article-flow/);
  assert.match(source, /data-flow-label="TVM \/ TRC-20"/);
  assert.match(source, /data-tron-onchain-dashboard/);
  assert.match(source, /data-onchain-range="1m"/);
  assert.match(source, /data-onchain-range="1y"/);
  assert.match(source, /data-onchain-range="all"/);
  assert.match(articleScript, /function initTronOnchainDashboard/);
  assert.match(articleScript, /\/api\/article-onchain\/tron/);
  assert.match(routes, /app\.get\('\/api\/article-onchain\/tron'/);
  assert.match(beginnerMode, /'bandwidth-energy'/);
  assert.match(beginnerMode, /term-tooltip__visual/);
  assert.match(beginnerMode, /TRON公式：Resource Model/);
});

test('shared reader tools collapse into one FAB and Live reference becomes a compact expandable ticker', () => {
  const template = read('public/templates/article.html');
  const articleScript = read('public/js/article.js');
  const articleStyle = read('public/css/article.css');

  assert.match(template, /data-reader-tools-toggle/);
  assert.match(template, /data-reader-tools-menu hidden/);
  assert.match(articleScript, /article-live-market-card--ticker/);
  assert.match(articleScript, /data-live-market-expand/);
  assert.match(articleScript, /slot\.replaceWith\(card\)/);
  assert.match(template, /data-article-live-market-slot/);
  assert.match(articleStyle, /\.article-live-market-card--ticker/);
  assert.match(articleStyle, /\.article-reader-tools__fab/);
  assert.match(articleStyle, /\.article-reader-tools__menu\[hidden\]/);
});
