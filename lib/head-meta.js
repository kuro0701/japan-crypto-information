const {
  SITE_NAME,
  absoluteUrl,
  breadcrumbJsonLd,
  datasetJsonLd,
  getPageConfig,
  normalizePageId,
  organizationJsonLd,
  resolveSiteOrigin,
  webApplicationJsonLd,
} = require('./schema');

function escapeHtml(value) {
  return String(value == null ? '' : value).replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[char]));
}

function jsonLdScript(data) {
  if (!data) return '';
  const json = JSON.stringify(data, null, 2)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e');
  return `<script type="application/ld+json">${json}</script>`;
}

function metaName(name, content) {
  if (!content) return '';
  return `<meta name="${escapeHtml(name)}" content="${escapeHtml(content)}">`;
}

function metaProperty(property, content) {
  if (!content) return '';
  return `<meta property="${escapeHtml(property)}" content="${escapeHtml(content)}">`;
}

function linkRel(rel, href) {
  if (!href) return '';
  return `<link rel="${escapeHtml(rel)}" href="${escapeHtml(href)}">`;
}

function defaultBreadcrumbItems(page) {
  if (page.pageId === 'home') {
    return [
      { name: SITE_NAME, url: '/' },
    ];
  }

  return [
    { name: SITE_NAME, url: '/' },
    { name: page.name, url: page.path },
  ];
}

function pageJsonLd({ pageId, origin, description }) {
  const normalizedPageId = normalizePageId(pageId);
  const blocks = [
    organizationJsonLd({ origin }),
  ];

  if (normalizedPageId === 'simulator') {
    blocks.push(webApplicationJsonLd({ origin, description }));
  } else if (normalizedPageId === 'volume-share' || normalizedPageId === 'sales-spread' || normalizedPageId === 'derivatives') {
    blocks.push(datasetJsonLd({ pageId: normalizedPageId, origin }));
  }

  const page = getPageConfig(normalizedPageId);
  blocks.push(breadcrumbJsonLd(defaultBreadcrumbItems(page), { origin }));

  return blocks;
}

function renderHeadMeta({
  title,
  description,
  canonical,
  ogImage,
  pageId = 'home',
  siteOrigin,
  includeDefaultJsonLd = true,
  structuredData = [],
} = {}) {
  const origin = resolveSiteOrigin(siteOrigin || process.env.SITE_ORIGIN);
  const normalizedPageId = normalizePageId(pageId);
  const page = getPageConfig(normalizedPageId);
  const resolvedTitle = title || page.title;
  const resolvedDescription = description || page.description;
  const canonicalUrl = absoluteUrl(canonical || page.path, origin);
  const ogImageUrl = absoluteUrl(ogImage || page.ogImagePath, origin);

  const lines = [
    `<title>${escapeHtml(resolvedTitle)}</title>`,
    metaName('description', resolvedDescription),
    metaName('robots', 'index,follow'),
    linkRel('canonical', canonicalUrl),
    metaProperty('og:type', 'website'),
    metaProperty('og:site_name', SITE_NAME),
    metaProperty('og:locale', 'ja_JP'),
    metaProperty('og:title', resolvedTitle),
    metaProperty('og:description', resolvedDescription),
    metaProperty('og:url', canonicalUrl),
    metaProperty('og:image', ogImageUrl),
    metaName('twitter:card', 'summary_large_image'),
    metaName('twitter:title', resolvedTitle),
    metaName('twitter:description', resolvedDescription),
    metaName('twitter:image', ogImageUrl),
    metaName('google-site-verification', process.env.GOOGLE_SITE_VERIFICATION),
    metaName('msvalidate.01', process.env.BING_SITE_VERIFICATION),
    ...(includeDefaultJsonLd ? pageJsonLd({
      pageId: normalizedPageId,
      origin,
      description: resolvedDescription,
    }) : []).map(jsonLdScript),
    ...structuredData.map(jsonLdScript),
  ];

  return lines.filter(Boolean).join('\n');
}

module.exports = {
  renderHeadMeta,
};
