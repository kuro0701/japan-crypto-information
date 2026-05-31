const DEFAULT_PUBLIC_SITE_ORIGIN = 'https://get-crypto.org';

function firstHeaderValue(value) {
  return String(value || '').split(',')[0].trim();
}

function normalizeOrigin(origin, fallback = DEFAULT_PUBLIC_SITE_ORIGIN) {
  const value = String(origin || fallback).trim().replace(/\/+$/, '');
  try {
    const url = new URL(value);
    if (url.protocol === 'http:' || url.protocol === 'https:') {
      return url.toString().replace(/\/+$/, '');
    }
  } catch (_err) {
    // Fall through to the known-good fallback.
  }
  return fallback;
}

function requestProtocol(req) {
  return firstHeaderValue(req.get('x-forwarded-proto')) || req.protocol || 'http';
}

function requestHost(req) {
  return firstHeaderValue(req.get('x-forwarded-host')) || firstHeaderValue(req.get('host'));
}

function requestHostname(req) {
  const host = requestHost(req).toLowerCase();
  if (!host) return '';
  if (host.startsWith('[')) {
    const closingBracketIndex = host.indexOf(']');
    return closingBracketIndex >= 0 ? host.slice(0, closingBracketIndex + 1) : host;
  }
  return host.replace(/:\d+$/, '');
}

function configuredSiteOrigin() {
  return normalizeOrigin(process.env.SITE_ORIGIN, DEFAULT_PUBLIC_SITE_ORIGIN);
}

function requestOrigin(req) {
  if (process.env.SITE_ORIGIN) return normalizeOrigin(process.env.SITE_ORIGIN);
  const host = requestHost(req);
  if (!host) return DEFAULT_PUBLIC_SITE_ORIGIN;
  return `${requestProtocol(req)}://${host}`.replace(/\/+$/, '');
}

module.exports = {
  DEFAULT_PUBLIC_SITE_ORIGIN,
  configuredSiteOrigin,
  normalizeOrigin,
  requestHost,
  requestHostname,
  requestOrigin,
  requestProtocol,
};
