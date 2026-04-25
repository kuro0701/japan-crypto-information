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

  function exchangePageUrl(exchangeId) {
    const normalized = String(exchangeId || '').trim().toLowerCase();
    const slug = ({
      gmo: 'gmo-coin',
    })[normalized] || normalized || 'okj';
    return `/exchanges/${encodeURIComponent(slug)}`;
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
    marketPageUrl,
    parseNumber,
    parseNumberInput: parseNumber,
    parseTimeValue,
    setText,
  });
})(window);
