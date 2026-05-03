(function attachAppComponents(root, factory) {
  const components = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = components;
    return;
  }
  root.AppComponents = Object.freeze(components);
})(typeof globalThis !== 'undefined' ? globalThis : window, function buildAppComponents() {
  const BADGE_TONES = new Set([
    'neutral',
    'idle',
    'loading',
    'ready',
    'normal',
    'caution',
    'warning',
    'danger',
    'critical',
    'error',
  ]);

  function escapeHtml(value) {
    return String(value == null ? '' : value).replace(/[<>&'"]/g, (char) => ({
      '<': '&lt;',
      '>': '&gt;',
      '&': '&amp;',
      "'": '&#39;',
      '"': '&quot;',
    }[char]));
  }

  function classNames(...values) {
    return values
      .flatMap(value => Array.isArray(value) ? value : [value])
      .filter(Boolean)
      .join(' ');
  }

  function attr(name, value) {
    if (value == null || value === false) return '';
    if (value === true) return ` ${name}`;
    return ` ${name}="${escapeHtml(value)}"`;
  }

  function attrs(values = {}) {
    return Object.entries(values).map(([name, value]) => attr(name, value)).join('');
  }

  function safeTone(tone, fallback = 'neutral') {
    const normalized = String(tone || '').trim().toLowerCase();
    return BADGE_TONES.has(normalized) ? normalized : fallback;
  }

  function htmlOrText({ html, text }) {
    if (html != null) return String(html);
    return escapeHtml(text);
  }

  function renderAction(action = {}) {
    const tag = action.href ? 'a' : 'button';
    const className = classNames(
      'btn',
      action.variant === 'primary' ? 'btn-primary' : action.variant === 'ghost' ? 'btn-ghost' : 'btn-secondary',
      'px-4 py-2.5 rounded-lg text-sm',
      action.className
    );
    const baseAttrs = {
      class: className,
      href: action.href,
      type: tag === 'button' ? (action.type || 'button') : null,
      target: action.target,
      rel: action.rel,
      id: action.id,
      'data-action': action.dataAction,
      'data-open-detail': action.dataOpenDetail,
      onclick: action.onclick,
    };
    return `<${tag}${attrs(baseAttrs)}>${escapeHtml(action.label || '詳しく見る')}</${tag}>`;
  }

  function renderBadge({ label = 'Status', tone = 'neutral', className = '', id = null, hidden = false } = {}) {
    const normalizedTone = safeTone(tone);
    return [
      `<span${attrs({
        id,
        hidden,
        class: classNames('ui-data-badge', `ui-data-badge--${normalizedTone}`, className),
      })}>`,
      escapeHtml(label),
      '</span>',
    ].join('');
  }

  function renderDataStatusBadge({ status = 'waiting', label = '', className = '', id = null, hidden = false } = {}) {
    const normalized = String(status || 'waiting').toLowerCase();
    const toneByStatus = {
      fresh: 'ready',
      live: 'ready',
      ready: 'ready',
      ok: 'ready',
      stale: 'warning',
      partial: 'warning',
      waiting: 'loading',
      loading: 'loading',
      idle: 'idle',
      offline: 'error',
      error: 'error',
      unsupported: 'neutral',
      unknown: 'neutral',
    };
    const labelByStatus = {
      fresh: 'Fresh',
      live: 'Live',
      ready: 'Ready',
      stale: 'Stale',
      partial: 'Partial',
      waiting: 'Waiting',
      loading: 'Loading',
      idle: 'Idle',
      offline: 'Offline',
      error: 'Error',
      unsupported: 'Unsupported',
      unknown: 'Unknown',
    };
    return renderBadge({
      id,
      hidden,
      label: label || labelByStatus[normalized] || labelByStatus.unknown,
      tone: toneByStatus[normalized] || toneByStatus.unknown,
      className: classNames('ui-data-status-badge', className),
    });
  }

  function renderFactGrid(facts = []) {
    const items = facts.filter(item => item && item.label);
    if (items.length === 0) return '';
    return [
      '<dl class="ui-fact-grid market-conclusion-facts">',
      items.map(item => [
        '  <div>',
        `    <dt>${escapeHtml(item.label)}</dt>`,
        `    <dd>${htmlOrText({ html: item.valueHtml, text: item.value })}</dd>`,
        '  </div>',
      ].join('\n')).join('\n'),
      '</dl>',
    ].join('\n');
  }

  function renderConclusionList(items = []) {
    const filteredItems = items.filter(Boolean);
    if (filteredItems.length === 0) return '';
    return [
      '<ul class="ui-conclusion-list market-conclusion-list">',
      filteredItems.map(item => {
        if (typeof item === 'object') return `  <li>${htmlOrText({ html: item.html, text: item.text })}</li>`;
        return `  <li>${escapeHtml(item)}</li>`;
      }).join('\n'),
      '</ul>',
    ].join('\n');
  }

  function renderConclusionCard(options = {}) {
    const titleTag = /^h[1-6]$/.test(String(options.titleTag || 'h3')) ? options.titleTag : 'h3';
    const status = options.status ? safeTone(options.status, 'neutral') : '';
    const badgeTone = safeTone(options.badgeTone || options.status || 'neutral');
    const badgeLabel = options.badgeLabel || options.badge || '';
    const classes = classNames(
      'ui-conclusion-card',
      'decision-summary-card',
      'market-conclusion-card',
      options.variant ? `ui-conclusion-card--${options.variant}` : '',
      status ? `ui-conclusion-card--${status}` : '',
      status === 'loading' ? 'decision-summary-card--loading' : '',
      ['error', 'danger', 'critical'].includes(status) ? 'decision-summary-card--error' : '',
      options.className
    );
    const header = [
      '<div class="ui-conclusion-card__header decision-summary-card__header market-conclusion-card__header">',
      '  <div>',
      `    <p class="ui-conclusion-card__eyebrow decision-summary-card__eyebrow market-insight-card__eyebrow">${escapeHtml(options.eyebrow || 'Conclusion')}</p>`,
      `    <${titleTag} class="ui-conclusion-card__title decision-summary-card__title market-conclusion-card__title">${escapeHtml(options.title || 'このページで分かること')}</${titleTag}>`,
      '  </div>',
      badgeLabel ? `  ${renderBadge({ label: badgeLabel, tone: badgeTone, className: 'decision-summary-badge market-insight-card__badge' })}` : '',
      '</div>',
    ].filter(Boolean).join('\n');
    const lead = (options.lead || options.leadHtml) ? `<p class="ui-conclusion-card__lead decision-summary-card__lead market-conclusion-card__verdict">${htmlOrText({ html: options.leadHtml, text: options.lead })}</p>` : '';
    const body = (options.body || options.bodyHtml) ? `<p class="ui-conclusion-card__body decision-summary-card__body market-insight-card__note">${htmlOrText({ html: options.bodyHtml, text: options.body })}</p>` : '';
    const meta = (options.meta || options.metaHtml) ? `<p class="ui-conclusion-card__meta market-insight-card__note">${htmlOrText({ html: options.metaHtml, text: options.meta })}</p>` : '';
    const actions = Array.isArray(options.actions) && options.actions.length > 0
      ? `<div class="ui-conclusion-card__actions decision-summary-card__actions">${options.actions.map(renderAction).join('')}</div>`
      : '';
    const content = [
      header,
      lead,
      body,
      renderConclusionList(options.items),
      renderFactGrid(options.facts),
      meta,
      actions,
    ].filter(Boolean).join('\n');

    if (options.fragment) return content;
    return `<article${attrs({ id: options.id, class: classes })}>\n${content}\n</article>`;
  }

  function conditionConclusionClassName(status = 'idle', className = '') {
    const normalized = safeTone(status, 'idle');
    return classNames(
      'ui-condition-conclusion',
      'beginner-conclusion-card',
      `beginner-conclusion-card--${normalized}`,
      className
    );
  }

  function renderConditionConclusionCard(options = {}) {
    const rows = (options.rows || [
      { label: '最安候補', value: options.candidate || options.lead || '比較前' },
      { label: '2位との差', value: options.gap || '-' },
      { label: '注意点', value: options.note || options.body || '数量または金額を入力して「比較する」を押してください。' },
    ]).filter(item => item && item.label);
    const status = safeTone(options.status, 'idle');
    const content = [
      '<div class="ui-condition-conclusion__header beginner-conclusion-card__header">',
      `  <p class="ui-condition-conclusion__prefix beginner-conclusion-card__prefix">${escapeHtml(options.prefix || 'この条件なら')}</p>`,
      `  ${renderBadge({ label: options.badgeLabel || '未実行', tone: options.badgeTone || status, className: 'decision-summary-badge' })}`,
      '</div>',
      '<dl class="ui-condition-conclusion__list beginner-conclusion-list">',
      rows.map(row => [
        '  <div>',
        `    <dt>${escapeHtml(row.label)}</dt>`,
        `    <dd>${htmlOrText({ html: row.valueHtml, text: row.value })}</dd>`,
        '  </div>',
      ].join('\n')).join('\n'),
      '</dl>',
      options.meta ? `<p class="ui-condition-conclusion__meta beginner-conclusion-card__meta">${escapeHtml(options.meta)}</p>` : '',
      options.action ? renderAction(options.action) : '',
    ].filter(Boolean).join('\n');
    if (options.fragment) return content;
    return `<div${attrs({ id: options.id, class: conditionConclusionClassName(status, options.className) })}>\n${content}\n</div>`;
  }

  function renderComparisonTable({ columns = [], rows = [], emptyMessage = 'データを取得中です', className = '', id = null } = {}) {
    const safeColumns = columns.filter(column => column && column.key);
    const header = safeColumns.map(column => {
      const alignClass = column.align === 'right' || column.numeric ? 'is-num text-right' : 'text-left';
      return `<th${attrs({ id: column.id, class: alignClass })}>${escapeHtml(column.label || column.key)}</th>`;
    }).join('');
    const bodyRows = rows.length > 0
      ? rows.map(row => [
        `<tr${attrs({ class: row.className })}>`,
        safeColumns.map(column => {
          const cell = row.cells && row.cells[column.key] != null ? row.cells[column.key] : row[column.key];
          const cellObject = cell && typeof cell === 'object' && !Array.isArray(cell) ? cell : { value: cell };
          const alignClass = column.align === 'right' || column.numeric ? 'is-num text-right' : 'text-left';
          return `<td${attrs({ class: classNames(alignClass, cellObject.className), 'data-label': column.label || column.key })}>${htmlOrText({ html: cellObject.html, text: cellObject.value })}</td>`;
        }).join(''),
        '</tr>',
      ].join('')).join('\n')
      : `<tr><td colspan="${safeColumns.length || 1}" class="text-center text-gray-500 py-4">${escapeHtml(emptyMessage)}</td></tr>`;
    return [
      `<table${attrs({ id, class: classNames('ui-comparison-table data-table data-table--cards text-xs', className) })}>`,
      '<thead class="sticky"><tr>',
      header,
      '</tr></thead>',
      '<tbody>',
      bodyRows,
      '</tbody>',
      '</table>',
    ].join('\n');
  }

  function renderRiskNoticeBox({ title = '注意点', body = '', bodyHtml = null, items = [], tone = 'caution', className = '', id = null } = {}) {
    const normalizedTone = safeTone(tone, 'caution');
    const itemHtml = items.length > 0
      ? `<ul class="ui-risk-box__list">${items.map(item => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`
      : '';
    return [
      `<aside${attrs({ id, class: classNames('ui-risk-box', `ui-risk-box--${normalizedTone}`, className) })}>`,
      `  <strong class="ui-risk-box__title">${escapeHtml(title)}</strong>`,
      body || bodyHtml ? `  <p class="ui-risk-box__body">${htmlOrText({ html: bodyHtml, text: body })}</p>` : '',
      itemHtml,
      '</aside>',
    ].filter(Boolean).join('\n');
  }

  function renderBeginnerNoteBox({ title = '初心者向けメモ', body = '', bodyHtml = null, items = [], className = '', id = null } = {}) {
    const itemHtml = items.length > 0
      ? `<ol class="ui-beginner-box__list">${items.map(item => `<li>${escapeHtml(item)}</li>`).join('')}</ol>`
      : '';
    return [
      `<aside${attrs({ id, class: classNames('ui-beginner-box', className) })}>`,
      `  <strong class="ui-beginner-box__title">${escapeHtml(title)}</strong>`,
      body || bodyHtml ? `  <p class="ui-beginner-box__body">${htmlOrText({ html: bodyHtml, text: body })}</p>` : '',
      itemHtml,
      '</aside>',
    ].filter(Boolean).join('\n');
  }

  function renderAccordion({ title = '詳細', body = '', bodyHtml = null, open = false, className = '', id = null } = {}) {
    return [
      `<details${attrs({ id, open, class: classNames('ui-accordion', className) })}>`,
      `  <summary class="ui-accordion__summary">${escapeHtml(title)}</summary>`,
      `  <div class="ui-accordion__body">${htmlOrText({ html: bodyHtml, text: body })}</div>`,
      '</details>',
    ].join('\n');
  }

  function renderDetailList(items = [], { className = '', compact = false } = {}) {
    const filteredItems = items.filter(item => item && item.label);
    if (filteredItems.length === 0) return '';
    return [
      `<dl class="${classNames('ui-detail-list', compact ? 'ui-detail-list--compact' : '', className)}">`,
      filteredItems.map(item => [
        '  <div>',
        `    <dt>${escapeHtml(item.label)}</dt>`,
        `    <dd>${htmlOrText({ html: item.valueHtml, text: item.value })}</dd>`,
        '  </div>',
      ].join('\n')).join('\n'),
      '</dl>',
    ].join('\n');
  }

  function renderEntityCard({
    type = 'market',
    title = '',
    href = '',
    eyebrow = '',
    description = '',
    descriptionHtml = null,
    badge = '',
    metrics = [],
    className = '',
    id = null,
  } = {}) {
    const tag = href ? 'a' : 'article';
    const cardClass = type === 'exchange' ? 'ui-exchange-card' : 'ui-market-card';
    const metricsHtml = metrics.length > 0
      ? `<span class="${cardClass}__metrics">${metrics.map(item => `<span>${escapeHtml(item)}</span>`).join('')}</span>`
      : '';
    return [
      `<${tag}${attrs({ id, href, class: classNames(cardClass, className) })}>`,
      eyebrow ? `  <span class="${cardClass}__eyebrow">${escapeHtml(eyebrow)}</span>` : '',
      '  <span class="' + cardClass + '__header">',
      `    <strong>${escapeHtml(title)}</strong>`,
      badge ? `    ${renderBadge({ label: badge, tone: 'ready' })}` : '',
      '  </span>',
      description || descriptionHtml ? `  <span class="${cardClass}__description">${htmlOrText({ html: descriptionHtml, text: description })}</span>` : '',
      metricsHtml,
      `</${tag}>`,
    ].filter(Boolean).join('\n');
  }

  function renderExchangeCard(options = {}) {
    return renderEntityCard({ ...options, type: 'exchange' });
  }

  function renderMarketCard(options = {}) {
    return renderEntityCard({ ...options, type: 'market' });
  }

  function renderFinancialMetricCard({ eyebrow = 'Financial', title = '', lead = '', badge = '', details = [], note = '', className = '', id = null } = {}) {
    return [
      `<article${attrs({ id, class: classNames('ui-financial-metric-card market-insight-card exchange-financial-card', className) })}>`,
      '  <div class="market-insight-card__header">',
      '    <div>',
      `      <p class="market-insight-card__eyebrow">${escapeHtml(eyebrow)}</p>`,
      `      <h3 class="market-insight-card__title">${escapeHtml(title)}</h3>`,
      '    </div>',
      badge ? `    <span class="market-insight-card__badge">${escapeHtml(badge)}</span>` : '',
      '  </div>',
      lead ? `  <p class="market-insight-card__lead">${escapeHtml(lead)}</p>` : '',
      renderDetailList(details, { className: 'exchange-detail-list', compact: details.length > 4 }),
      note ? `  <p class="market-insight-card__note exchange-financial-card__notice">${escapeHtml(note)}</p>` : '',
      '</article>',
    ].filter(Boolean).join('\n');
  }

  function renderSourceLinkCard({ title = '', href = '', description = '', badge = 'Source', meta = '', className = '', id = null } = {}) {
    return [
      `<a${attrs({ id, href, class: classNames('ui-source-link-card market-context-card', className), target: href ? '_blank' : null, rel: href ? 'noopener' : null })}>`,
      `  <span class="market-context-card__eyebrow">${escapeHtml(badge)}</span>`,
      `  <strong>${escapeHtml(title)}</strong>`,
      description ? `  <span>${escapeHtml(description)}</span>` : '',
      meta ? `  <small>${escapeHtml(meta)}</small>` : '',
      '</a>',
    ].filter(Boolean).join('\n');
  }

  return {
    conditionConclusionClassName,
    escapeHtml,
    renderAccordion,
    renderBadge,
    renderBeginnerNoteBox,
    renderComparisonTable,
    renderConclusionCard,
    renderConditionConclusionCard,
    renderDataStatusBadge,
    renderDetailList,
    renderExchangeCard,
    renderFinancialMetricCard,
    renderMarketCard,
    renderRiskNoticeBox,
    renderSourceLinkCard,
  };
});
