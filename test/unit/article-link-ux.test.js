const fs = require('fs');
const path = require('path');
const test = require('node:test');
const assert = require('node:assert/strict');
const { getArticle, listArticles } = require('../../lib/content');
const { renderHeadMeta } = require('../../lib/head-meta');
const { createSiteContentService } = require('../../lib/server/site-content-service');

const read = relativePath => fs.readFileSync(path.join(__dirname, '../..', relativePath), 'utf8');

test('LINK article prioritizes its curated executive view before the inline Live Reference', () => {
  const content = read('content/link.md');
  const script = read('public/js/article.js');
  const style = read('public/css/article.css');

  assert.match(content, /updated: 2026-08-03/);
  assert.match(content, /article-summary-tabs--link/);
  assert.match(content, /data-summary-tab="full"/);
  assert.match(content, /data-summary-tab="quick"/);
  assert.match(content, /data-summary-tab="focus"/);
  assert.match(content, /結論から読むChainlink/);
  assert.match(script, /article\.dataset\.articleSlug === 'link' && summary/);
  assert.match(script, /summary\.insertAdjacentElement\('afterend', card\)/);
  assert.match(style, /\.article-live-market-card--link-inline\s*\{[^}]*position:\s*relative/s);
  assert.match(style, /\.article-main\[data-article-slug="link"\]/);
});

test('LINK data flows expose six accurate interactive steps for Data Feeds and CCIP', () => {
  const content = read('content/link.md');
  const script = read('public/js/article.js');
  const style = read('public/css/article.css');

  assert.equal((content.match(/class="article-mermaid" data-article-flow/g) || []).length, 2);
  assert.equal((content.match(/data-flow-label=/g) || []).length, 12);
  assert.match(content, /data-flow-label="OCR signed report"/);
  assert.match(content, /data-flow-label="Risk Management Network"/);
  assert.match(script, /STEP \$\{index \+ 1\} \/ \$\{steps\.length\}/);
  assert.match(script, /--article-flow-progress/);
  assert.match(style, /@keyframes article-link-flow/);
});

test('shared long-form controls use active H3 accordion navigation, bottom guidance, and SVG actions', () => {
  const script = read('public/js/article.js');
  const style = read('public/css/article.css');
  const template = read('public/templates/article.html');

  assert.match(script, /function articleTocSubheadings/);
  assert.match(script, /article-toc__subnav/);
  assert.match(script, /data-article-toc-group/);
  assert.match(script, /group\.classList\.toggle\('is-current'/);
  assert.match(style, /\.article-toc__group\.is-current \.article-toc__subnav/);
  assert.match(style, /\.article-beginner-guide\s*\{[^}]*bottom:\s*24px/s);
  assert.match(script, /class="article-icon-button"[^>]*data-article-section-share="image"/);
  assert.match(template, /article-toc__collapse article-icon-button/);
  assert.match(style, /\.article-data-table tbody tr:nth-child\(even\)/);
});

test('rendered LINK page keeps exactly one curated reading-mode module', () => {
  const service = createSiteContentService({
    analyticsStore: {},
    getArticle,
    getPublicExchanges: () => [],
    listArticles,
    publicDir: path.join(__dirname, '../../public'),
    renderHeadMeta,
    salesSpreadStore: {},
    volumeShareStore: {},
  });
  const request = { protocol: 'https', get: () => '' };
  const html = service.renderArticleHtml(request, getArticle('link'));

  assert.equal((html.match(/data-article-summary-tabs/g) || []).length, 1);
  assert.doesNotMatch(html, /data-shared-article-digest/);
  assert.match(html, /article-summary-tabs--link/);
});
