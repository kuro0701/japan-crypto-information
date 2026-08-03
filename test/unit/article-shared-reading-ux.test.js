const fs = require('fs');
const path = require('path');
const test = require('node:test');
const assert = require('node:assert/strict');
const { getArticle, listArticles } = require('../../lib/content');
const { renderHeadMeta } = require('../../lib/head-meta');
const { createSiteContentService } = require('../../lib/server/site-content-service');

const read = relativePath => fs.readFileSync(path.join(__dirname, '../..', relativePath), 'utf8');

test('long-form digest and changelog are generated for articles without duplicating curated modules', () => {
  const service = read('lib/server/site-content-service.js');

  assert.match(service, /function renderArticleSharedDigest/);
  assert.match(service, /data-shared-article-digest/);
  assert.match(service, /data-summary-jump/);
  assert.match(service, /function renderArticleSharedChangelog/);
  assert.match(service, /data-shared-article-changelog/);
  assert.match(service, /if \(\/data-article-summary-tabs\/i\.test\(html\)\) return ''/);
  assert.match(service, /if \(\/class="\[\^"\]\*\\barticle-changelog\\b\/i/);
  assert.match(service, /injectArticleSharedOverview\(article, normalizeArticleLeadDisclosure/);
});

test('beginner mode shares term annotations and technical folds across market reports', () => {
  const beginnerMode = read('public/js/beginner-mode.js');
  const articleScript = read('public/js/article.js');
  const articleStyle = read('public/css/article.css');

  assert.match(beginnerMode, /const AUTO_ARTICLE_TERMS/);
  assert.match(beginnerMode, /function annotateArticleTerms/);
  assert.match(beginnerMode, /article-term article-term--auto/);
  assert.match(articleScript, /function initMarketBeginnerSections/);
  assert.match(articleScript, /\.article-main\[data-article-kind="market"\]/);
  assert.doesNotMatch(articleScript, /function initSolBeginnerSections/);
  assert.match(articleStyle, /\.beginner-mode \.article-main\[data-article-kind="market"\] \.article-beginner-section/);
});

test('external citations and final disclaimers receive shared in-place reading controls', () => {
  const articleScript = read('public/js/article.js');

  assert.match(articleScript, /function initArticleEndDisclaimer/);
  assert.match(articleScript, /details\.dataset\.sharedEndDisclaimer = 'true'/);
  assert.match(articleScript, /article-source-link--shared/);
  assert.match(articleScript, /url\.origin === window\.location\.origin/);
  assert.match(articleScript, /参照ページを開く/);
});

test('live ticker placement and long-form interaction tools are shared by every article', () => {
  const articleScript = read('public/js/article.js');
  const articleStyle = read('public/css/article.css');

  assert.match(articleScript, /article\.classList\.add\('article-main--live-ticker'\)/);
  assert.match(articleStyle, /\.article-main--live-ticker\s*\{[^}]*overflow:\s*visible/s);
  assert.match(articleScript, /function initArticleSupportingAccordions/);
  assert.match(articleScript, /function initArticleReadingModes/);
  assert.match(articleScript, /function initArticleSectionShareTools/);
  assert.match(articleScript, /function initArticleSmartMobileBar/);
  assert.match(articleStyle, /\.article-reading-section\.is-reading-mode-hidden/);
  assert.match(articleStyle, /\.article-section-share/);
  assert.match(articleStyle, /\.article-mobile-actions--smart/);
  assert.match(articleStyle, /\.article-main \.article-data-table :is\(th, td\):first-child/);
  assert.match(articleStyle, /\.article-main \.article-data-table\.data-table--cards/);
  assert.match(articleScript, /function initArticleSmartHeader/);
  assert.match(articleScript, /data-article-table-view/);
  assert.match(articleScript, /articleSectionMinutes/);
  assert.match(articleStyle, /\.article-smart-header/);
  assert.match(articleStyle, /\.article-table-view-toggle/);
  assert.match(articleScript, /article\.dataset\.articleKind === 'market' && summary/);
  assert.match(articleScript, /article-live-market-card--summary-inline/);
  assert.match(articleStyle, /\.article-live-market-card--summary-inline\s*\{[^}]*position:\s*static\s*!important/s);
  assert.match(articleStyle, /\.article-main\[data-article-kind="market"\] \.article-body\s*\{[^}]*16\.5px/s);
  assert.match(articleStyle, /\.article-main\[data-article-kind="market"\] \.article-reading-section > p \+ p/);
});

test('key metrics, diagram steps, local sparklines, and market CTAs have shared fallbacks', () => {
  const articleScript = read('public/js/article.js');
  const beginnerMode = read('public/js/beginner-mode.js');
  const articleStyle = read('public/css/article.css');

  assert.match(articleScript, /function buildKeyMetricsFromTable/);
  assert.match(articleScript, /section\.dataset\.sharedKeyMetrics = 'true'/);
  assert.match(articleScript, /wrapper\.dataset\.articleFlow = 'auto'/);
  assert.match(articleScript, /wrapper\.dataset\.articleFlowAuto = 'true'/);
  assert.match(articleScript, /function ensureSharedContextualMarketCta/);
  assert.match(articleScript, /root\.dataset\.sharedMarketCta = 'true'/);
  assert.match(articleScript, /function renderArticleLocalMiniSparkline/);
  assert.match(articleScript, /sourceLabel: 'このブラウザの記録値'/);
  assert.match(beginnerMode, /function articleSectionForTerm/);
  assert.match(beginnerMode, /Node\.DOCUMENT_POSITION_PRECEDING/);
  assert.match(articleStyle, /\.article-context-market-cta\[hidden\]/);
  assert.match(articleStyle, /\.article-key-metrics/);
  assert.match(articleScript, /function fitArticleKeyMetricValues/);
  assert.match(articleScript, /article-key-metric-value--long/);
  assert.match(articleStyle, /container-type:\s*inline-size/);
  assert.match(articleStyle, /overflow-wrap:\s*anywhere/);
});

test('article asset versions are bumped for the shared rollout', () => {
  const template = read('public/templates/article.html');

  assert.match(template, /article\.css\?v=38/);
  assert.match(template, /beginner-mode\.js\?v=22/);
  assert.match(template, /article\.js\?v=33/);
});

test('all article routes render one changelog and never duplicate summary tabs', () => {
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

  listArticles().forEach((article) => {
    const html = service.renderArticleHtml(request, article);
    const summaryCount = (html.match(/data-article-summary-tabs/g) || []).length;
    const changelogCount = (html.match(/class="article-changelog(?:\s|")/g) || []).length;
    assert.ok(summaryCount <= 1, `${article.slug} must not duplicate summary tabs`);
    assert.equal(changelogCount, 1, `${article.slug} must render one changelog`);
    assert.doesNotMatch(html, /\{\{ARTICLE_[A-Z_]+\}\}/);
  });

  const solHtml = service.renderArticleHtml(request, getArticle('sol'));
  assert.doesNotMatch(solHtml, /data-shared-article-digest/);
  assert.doesNotMatch(solHtml, /data-shared-article-changelog/);

  const ethHtml = service.renderArticleHtml(request, getArticle('eth'));
  assert.match(ethHtml, /data-shared-article-digest/);
  assert.match(ethHtml, /data-shared-article-changelog/);
});
