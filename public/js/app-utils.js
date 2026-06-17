(function attachAppUtils(global) {
  function byId(id) {
    return document.getElementById(id);
  }

  function setText(id, value) {
    const el = byId(id);
    if (el) el.textContent = value ?? '-';
    return el;
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function parseNumber(value) {
    const parsed = parseFloat(String(value ?? '').replace(/,/g, ''));
    return Number.isFinite(parsed) ? parsed : null;
  }

  function parseTimeValue(value) {
    if (value == null || value === '') return null;
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    const parsed = Date.parse(String(value));
    return Number.isFinite(parsed) ? parsed : null;
  }

  function marketPageUrl(instrumentId) {
    const normalized = String(instrumentId || 'BTC-JPY').trim().toUpperCase();
    return `/markets/${encodeURIComponent(normalized)}`;
  }

  function normalizeExchangeId(exchangeId) {
    return String(exchangeId || '').trim().toLowerCase().replace(/_/g, '-');
  }

  function exchangePageUrl(exchangeId) {
    const normalized = normalizeExchangeId(exchangeId);
    const slug = ({
      gmo: 'gmo-coin',
    })[normalized] || normalized || 'okj';
    return `/exchanges/${encodeURIComponent(slug)}`;
  }

  function safeHref(value, fallback = '#') {
    const href = String(value || '').trim();
    if (!href) return fallback;
    if (/^(https?:)?\/\//i.test(href) || href.startsWith('/') || href.startsWith('#')) return href;
    return fallback;
  }

  function exchangeReferralFor(exchangeId) {
    const id = normalizeExchangeId(exchangeId);
    const payload = global.ExchangeReferralLinks && global.ExchangeReferralLinks.exchanges
      ? global.ExchangeReferralLinks.exchanges
      : {};
    return payload[id] || payload[id.replace(/-/g, '_')] || null;
  }

  function exchangeReferralLink(exchangeId, fallbackHref = '') {
    const fallback = safeHref(fallbackHref, exchangePageUrl(exchangeId));
    const referral = exchangeReferralFor(exchangeId);
    const referralHref = referral && referral.href ? safeHref(referral.href, '') : '';
    const hasReferral = Boolean(referralHref);
    return {
      href: hasReferral ? referralHref : fallback,
      hasReferral,
      rel: hasReferral ? (referral.rel || 'sponsored noopener') : null,
      target: hasReferral && Object.prototype.hasOwnProperty.call(referral, 'target') ? referral.target : (hasReferral ? '_blank' : null),
      referrerPolicy: hasReferral ? (referral.referrerPolicy || null) : null,
      trackingPixelUrl: hasReferral ? safeHref(referral.trackingPixelUrl || '', '') : '',
    };
  }

  function exchangeReferralAnchorAttrs(exchangeId, fallbackHref = '') {
    const link = exchangeReferralLink(exchangeId, fallbackHref);
    const attrs = [`href="${escapeHtml(link.href)}"`];
    if (link.target) attrs.push(`target="${escapeHtml(link.target)}"`);
    if (link.rel) attrs.push(`rel="${escapeHtml(link.rel)}"`);
    if (link.referrerPolicy) attrs.push(`referrerpolicy="${escapeHtml(link.referrerPolicy)}"`);
    return attrs.join(' ');
  }

  function exchangeReferralTrackingPixelHtml(exchangeId) {
    const link = exchangeReferralLink(exchangeId);
    if (!link.hasReferral || !link.trackingPixelUrl) return '';
    return `<img src="${escapeHtml(link.trackingPixelUrl)}" width="1" height="1" border="0" alt="">`;
  }

  function exchangeReferralNameHtml(exchangeId, label, options = {}) {
    const className = options.className || 'exchange-referral-link';
    const fallbackHref = options.fallbackHref || exchangePageUrl(exchangeId);
    const attrs = exchangeReferralAnchorAttrs(exchangeId, fallbackHref);
    const text = label || exchangeId || '取引所';
    const pixel = options.includeTrackingPixel === false ? '' : exchangeReferralTrackingPixelHtml(exchangeId);
    return `<a class="${escapeHtml(className)}" ${attrs}>${escapeHtml(text)}${pixel}</a>`;
  }

  function cssVar(name, fallback) {
    const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return value || fallback;
  }

  global.AppUtils = Object.freeze({
    byId,
    cssVar,
    escapeHtml,
    exchangePageUrl,
    exchangeReferralAnchorAttrs,
    exchangeReferralFor,
    exchangeReferralLink,
    exchangeReferralNameHtml,
    exchangeReferralTrackingPixelHtml,
    marketPageUrl,
    normalizeExchangeId,
    parseNumber,
    parseNumberInput: parseNumber,
    parseTimeValue,
    safeHref,
    setText,
  });
})(window);
