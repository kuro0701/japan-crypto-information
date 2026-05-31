const path = require('path');
const {
  configuredSiteOrigin,
  requestHostname,
  requestProtocol,
} = require('./request-origin');

const DEFAULT_LEGACY_HOSTS = Object.freeze([
  'japan-crypto-information.onrender.com',
]);

const HTML_CACHE_CONTROL = 'public, max-age=0, s-maxage=300, stale-while-revalidate=86400';
const STATIC_ASSET_CACHE_CONTROL = 'public, max-age=31536000, immutable';
const STATIC_DOCUMENT_CACHE_CONTROL = 'public, max-age=300, s-maxage=3600, stale-while-revalidate=86400';
const XML_FEED_CACHE_CONTROL = 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400';
const NO_STORE_CACHE_CONTROL = 'no-store';

function splitHostList(value) {
  return String(value || '')
    .split(',')
    .map(item => item.trim().toLowerCase())
    .filter(Boolean);
}

function canonicalHostname() {
  return new URL(configuredSiteOrigin()).hostname.toLowerCase();
}

function redirectHosts() {
  const hosts = new Set([
    ...DEFAULT_LEGACY_HOSTS,
    ...splitHostList(process.env.LEGACY_HOSTS),
  ]);
  const canonicalHost = canonicalHostname();
  if (canonicalHost && !canonicalHost.startsWith('www.') && !canonicalHost.includes('localhost')) {
    hosts.add(`www.${canonicalHost}`);
  }
  hosts.delete(canonicalHost);
  return hosts;
}

function targetUrlForRequest(req) {
  return `${configuredSiteOrigin()}${req.originalUrl || req.url || '/'}`;
}

function setSecurityHeaders(req, res, next) {
  res.set('X-Content-Type-Options', 'nosniff');
  res.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');
  res.set('X-DNS-Prefetch-Control', 'on');
  if (requestProtocol(req) === 'https') {
    res.set('Strict-Transport-Security', 'max-age=15552000');
  }
  next();
}

function redirectLegacyHosts(req, res, next) {
  if (!redirectHosts().has(requestHostname(req))) {
    next();
    return;
  }

  res.set('Cache-Control', 'public, max-age=3600');
  res.redirect(301, targetUrlForRequest(req));
}

function setDynamicCacheHeaders(req, res, next) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    next();
    return;
  }

  if (req.path === '/healthz' || req.path.startsWith('/api/')) {
    res.set('Cache-Control', NO_STORE_CACHE_CONTROL);
  } else if (req.path === '/sitemap.xml' || req.path === '/rss.xml') {
    res.set('Cache-Control', XML_FEED_CACHE_CONTROL);
  } else if (req.path === '/' || req.path.endsWith('.html') || !path.extname(req.path)) {
    res.set('Cache-Control', HTML_CACHE_CONTROL);
  }

  next();
}

function setStaticAssetHeaders(res, filePath) {
  const normalizedPath = filePath.split(path.sep).join('/');
  if (/\.(?:css|js|mjs)$/i.test(normalizedPath)) {
    res.setHeader('Cache-Control', STATIC_ASSET_CACHE_CONTROL);
    return;
  }

  if (/\.(?:avif|gif|ico|jpg|jpeg|png|svg|webp|woff2?)$/i.test(normalizedPath)) {
    res.setHeader('Cache-Control', 'public, max-age=604800, stale-while-revalidate=86400');
    return;
  }

  if (
    normalizedPath.includes('/public/data/')
    || /\.(?:json|txt|webmanifest|xml)$/i.test(normalizedPath)
  ) {
    res.setHeader('Cache-Control', STATIC_DOCUMENT_CACHE_CONTROL);
    return;
  }

  if (/\.html$/i.test(normalizedPath)) {
    res.setHeader('Cache-Control', HTML_CACHE_CONTROL);
  }
}

function applyCloudflareOptimizations(app) {
  app.disable('x-powered-by');
  app.use(setSecurityHeaders);
  app.use(redirectLegacyHosts);
  app.use(setDynamicCacheHeaders);
}

module.exports = {
  HTML_CACHE_CONTROL,
  NO_STORE_CACHE_CONTROL,
  STATIC_ASSET_CACHE_CONTROL,
  STATIC_DOCUMENT_CACHE_CONTROL,
  XML_FEED_CACHE_CONTROL,
  applyCloudflareOptimizations,
  redirectHosts,
  setStaticAssetHeaders,
  targetUrlForRequest,
};
