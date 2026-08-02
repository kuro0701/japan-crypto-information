const fs = require('fs');
const path = require('path');
const test = require('node:test');
const assert = require('node:assert/strict');

const read = relativePath => fs.readFileSync(path.join(__dirname, '../..', relativePath), 'utf8');

test('DOGE article exposes audience, live cost, supply, and interactive architecture modules', () => {
  const source = read('content/doge.md');

  assert.match(source, /updated: 2026-08-02/);
  assert.match(source, /data-doge-purpose-switcher/);
  assert.match(source, /data-doge-persona="beginner"/);
  assert.match(source, /data-doge-persona="trader"/);
  assert.match(source, /data-doge-persona="developer"/);
  assert.match(source, /data-doge-cost-calculator/);
  assert.match(source, /GMOコインとbitbank/);
  assert.match(source, /data-doge-supply-simulator/);
  assert.match(source, /data-doge-supply-years/);
  assert.match(source, /article-mermaid--doge/);
  assert.match(source, /data-article-flow/);
  assert.match(source, /data-flow-label="Scryptマイナー"/);
});

test('DOGE modules use the shared reading, section sharing, and mobile foundations', () => {
  const script = read('public/js/article.js');

  assert.match(script, /function initDogeArticleExperience/);
  assert.match(script, /function initArticleReadingModes/);
  assert.match(script, /article:summary-mode-change/);
  assert.match(script, /is-reading-mode-hidden/);
  assert.match(script, /function initDogeSupplySimulator/);
  assert.match(script, /function initDogeCostCalculator/);
  assert.match(script, /DOGE-JPY/);
  assert.match(script, /function initArticleSectionShareTools/);
  assert.match(script, /saveArticleSectionCard/);
  assert.match(script, /function initArticleSmartMobileBar/);
  assert.match(script, /data-article-mobile-price/);
  assert.match(script, /data-live-series-range="7d"/);
  assert.match(script, /7 \* 24 \* 60 \* 60 \* 1000/);
});

test('shared Aa button opens direct reading settings with all requested controls', () => {
  const template = read('public/templates/article.html');
  const script = read('public/js/article.js');
  const style = read('public/css/article.css');

  assert.match(template, /data-reader-settings-dialog/);
  assert.match(template, /data-reader-size-range/);
  assert.match(template, /data-reader-line-height-range/);
  assert.match(template, /data-reader-theme="sepia"/);
  assert.match(template, /data-reader-theme="oled"/);
  assert.match(template, /data-reader-family="serif"/);
  assert.match(script, /setSettingsOpen/);
  assert.match(script, /--article-reader-line-height/);
  assert.match(style, /\.article-reader-settings/);
  assert.match(style, /data-reader-theme="oled"/);
});

test('DOGE terms include UTXO, Scrypt, AuxPoW, and DEX tap explanations', () => {
  const beginnerMode = read('public/js/beginner-mode.js');

  assert.match(beginnerMode, /utxo:\s*\{/);
  assert.match(beginnerMode, /scrypt:\s*\{/);
  assert.match(beginnerMode, /auxpow:\s*\{/);
  assert.match(beginnerMode, /dex:\s*\{/);
  assert.match(beginnerMode, /key: 'utxo'/);
  assert.match(beginnerMode, /key: 'scrypt'/);
  assert.match(beginnerMode, /key: 'auxpow'/);
  assert.match(beginnerMode, /key: 'dex'/);
});
