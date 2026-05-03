const assert = require('node:assert/strict');
const test = require('node:test');

const UIComponents = require('../../public/js/ui-components');

test('renderConclusionCard builds escaped reusable conclusion markup', () => {
  const html = UIComponents.renderConclusionCard({
    title: '<BTC> の結論',
    badgeLabel: 'BTC/JPY',
    badgeTone: 'ready',
    lead: 'A&B を確認',
    items: ['取扱銘柄 < 多い'],
    facts: [{ label: '取扱', value: '6社' }],
  });

  assert.match(html, /ui-conclusion-card/);
  assert.match(html, /このページで分かること|&lt;BTC&gt; の結論/);
  assert.match(html, /A&amp;B を確認/);
  assert.match(html, /取扱銘柄 &lt; 多い/);
  assert.match(html, /<dt>取扱<\/dt>/);
});

test('renderConditionConclusionCard supports simulator summary content', () => {
  const html = UIComponents.renderConditionConclusionCard({
    fragment: true,
    status: 'ready',
    badgeLabel: '比較済み',
    candidate: 'OKJ',
    gap: '+120円',
    note: 'Impact は通常',
    action: { label: '詳しく見る', dataOpenDetail: true },
  });

  assert.match(html, /beginner-conclusion-list/);
  assert.match(html, /OKJ/);
  assert.match(html, /data-open-detail/);
});

test('renderComparisonTable renders empty table state', () => {
  const html = UIComponents.renderComparisonTable({
    columns: [
      { key: 'exchange', label: '取引所' },
      { key: 'cost', label: '実効コスト', numeric: true },
    ],
    rows: [],
    emptyMessage: '比較待ち',
  });

  assert.match(html, /ui-comparison-table/);
  assert.match(html, /colspan="2"/);
  assert.match(html, /比較待ち/);
});
