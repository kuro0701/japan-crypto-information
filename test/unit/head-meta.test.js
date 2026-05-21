const assert = require('node:assert/strict');
const test = require('node:test');

const {
  GOOGLE_TAG_ID,
  injectGoogleTag,
  renderGoogleTag,
} = require('../../lib/head-meta');

function countOccurrences(source, needle) {
  return String(source).split(needle).length - 1;
}

test('renderGoogleTag returns the configured Google tag snippet', () => {
  const html = renderGoogleTag();

  assert.ok(html.includes(`gtag/js?id=${GOOGLE_TAG_ID}`));
  assert.ok(html.includes(`gtag('config', '${GOOGLE_TAG_ID}')`));
});

test('injectGoogleTag inserts the tag after head without duplicating it', () => {
  const html = '<!DOCTYPE html><html lang="ja"><head><title>Test</title></head><body></body></html>';
  const tagged = injectGoogleTag(html);

  assert.ok(tagged.includes('<head>\n  <!-- Google tag (gtag.js) -->'));
  assert.equal(countOccurrences(tagged, `gtag/js?id=${GOOGLE_TAG_ID}`), 1);
  assert.equal(injectGoogleTag(tagged), tagged);
});
