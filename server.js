const http = require('http');
const crypto = require('crypto');
const fs = require('fs');
const express = require('express');
const path = require('path');
const OKCoinClient = require('./lib/okcoin-client');
const CoincheckClient = require('./lib/coincheck-client');
const BitflyerClient = require('./lib/bitflyer-client');
const BitbankClient = require('./lib/bitbank-client');
const GMOClient = require('./lib/gmo-client');
const BinanceJapanClient = require('./lib/binance-japan-client');
const OKJSaleClient = require('./lib/okj-sale-client');
const CoincheckSalesClient = require('./lib/coincheck-sales-client');
const BitflyerSalesClient = require('./lib/bitflyer-sales-client');
const BitbankSalesClient = require('./lib/bitbank-sales-client');
const GMOSalesClient = require('./lib/gmo-sales-client');
const OrderBook = require('./lib/orderbook');
const WSManager = require('./lib/ws-manager');
const VolumeShareStore = require('./lib/volume-share-store');
const SalesSpreadStore = require('./lib/sales-spread-store');
const AnalyticsStore = require('./lib/analytics-store');
const { calculateImpact, DEFAULT_FEE_RATE } = require('./lib/impact-calculator');
const { renderHeadMeta } = require('./lib/head-meta');
const { getArticle, listArticles } = require('./lib/content');
const {
  DEFAULT_EXCHANGE_ID,
  DEFAULT_OKJ_INSTRUMENT_ID,
  COINCHECK_EXCHANGE_ID,
  DEFAULT_COINCHECK_INSTRUMENT_ID,
  BITFLYER_EXCHANGE_ID,
  DEFAULT_BITFLYER_INSTRUMENT_ID,
  BITBANK_EXCHANGE_ID,
  DEFAULT_BITBANK_INSTRUMENT_ID,
  GMO_EXCHANGE_ID,
  DEFAULT_GMO_INSTRUMENT_ID,
  BINANCE_JAPAN_EXCHANGE_ID,
  DEFAULT_BINANCE_JAPAN_INSTRUMENT_ID,
  EXCHANGES,
  getPublicExchanges,
  setExchangeMarkets,
} = require('./lib/exchanges');

const app = express();
app.set('trust proxy', 1);
const DATA_DIR = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : path.join(__dirname, 'data');
const PUBLIC_DIR = path.join(__dirname, 'public');
const HEAD_META_INJECT = '<!-- HEAD_META_INJECT -->';
const ARTICLE_JSON_LD_INJECT = '<!-- ARTICLE_JSON_LD_INJECT -->';

function fileLastmod(filePath) {
  try {
    return fs.statSync(filePath).mtime.toISOString();
  } catch (_err) {
    return new Date().toISOString();
  }
}

const SITEMAP_PAGES = [
  {
    path: '/',
    lastmod: fileLastmod(path.join(PUBLIC_DIR, 'index.html')),
    priority: '1.0',
  },
  {
    path: '/volume-share',
    lastmod: fileLastmod(path.join(PUBLIC_DIR, 'volume-share.html')),
    priority: '0.8',
  },
  {
    path: '/sales-spread',
    lastmod: fileLastmod(path.join(PUBLIC_DIR, 'sales-spread.html')),
    priority: '0.8',
  },
];

const volumeShareStore = new VolumeShareStore({
  dataFilePath: path.join(DATA_DIR, 'volume-share-history.json'),
});
const salesSpreadStore = new SalesSpreadStore({
  dataFilePath: path.join(DATA_DIR, 'sales-spread-history.json'),
});
const analyticsStore = new AnalyticsStore({
  dataFilePath: path.join(DATA_DIR, 'analytics.json'),
  salt: process.env.ANALYTICS_SALT,
});
const analyticsAdminToken = process.env.ANALYTICS_ADMIN_TOKEN || '';
const analyticsAdminTokenHash = process.env.ANALYTICS_ADMIN_TOKEN_HASH
  || '59875027e31f7e785553fea0cbef84c4b36fa25b9c5d81c6bd1be2c53861c3b0';

function publicHtmlWithMeta(req, filePath, metaOptions) {
  const html = fs.readFileSync(filePath, 'utf8');
  return html.replace(HEAD_META_INJECT, renderHeadMeta({
    ...metaOptions,
    siteOrigin: requestOrigin(req),
  }));
}

function xmlEscape(value) {
  return String(value == null ? '' : value).replace(/[<>&'"]/g, (char) => ({
    '<': '&lt;',
    '>': '&gt;',
    '&': '&amp;',
    "'": '&apos;',
    '"': '&quot;',
  }[char]));
}

function requestOrigin(req) {
  if (process.env.SITE_ORIGIN) return String(process.env.SITE_ORIGIN).replace(/\/+$/, '');
  const forwardedProto = String(req.get('x-forwarded-proto') || '').split(',')[0].trim();
  const protocol = forwardedProto || req.protocol || 'http';
  return `${protocol}://${req.get('host')}`;
}

function siteUrl(origin, urlPath) {
  if (/^https?:\/\//i.test(urlPath)) return urlPath;
  return `${origin}${urlPath.startsWith('/') ? urlPath : `/${urlPath}`}`;
}

function rssDate(value, fallback = new Date()) {
  const date = new Date(value || fallback);
  if (Number.isNaN(date.getTime())) return new Date(fallback).toUTCString();
  return date.toUTCString();
}

function buildSitemapXml(origin) {
  const pages = SITEMAP_PAGES.concat(listArticles().map(article => ({
    path: article.path,
    lastmod: article.updated,
    priority: '0.6',
  })));

  const urls = pages.map(page => [
    '  <url>',
    `    <loc>${xmlEscape(siteUrl(origin, page.path))}</loc>`,
    `    <lastmod>${xmlEscape(page.lastmod)}</lastmod>`,
    `    <priority>${xmlEscape(page.priority)}</priority>`,
    '  </url>',
  ].join('\n')).join('\n');

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    urls,
    '</urlset>',
  ].join('\n') + '\n';
}

function buildRssXml(origin) {
  const articles = listArticles();
  const items = articles.map(article => [
    '    <item>',
    `      <title>${xmlEscape(article.title)}</title>`,
    `      <link>${xmlEscape(siteUrl(origin, article.path))}</link>`,
    `      <guid isPermaLink="true">${xmlEscape(siteUrl(origin, article.path))}</guid>`,
    `      <pubDate>${xmlEscape(rssDate(article.date, article.updated))}</pubDate>`,
    article.description ? `      <description>${xmlEscape(article.description)}</description>` : '',
    '    </item>',
  ].filter(Boolean).join('\n')).join('\n');

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0">',
    '  <channel>',
    '    <title>Japan クリプト インフォメーション</title>',
    `    <link>${xmlEscape(origin)}</link>`,
    '    <description>国内暗号資産取引所の板情報、出来高シェア、販売所スプレッドを確認できます。</description>',
    '    <language>ja-JP</language>',
    `    <lastBuildDate>${xmlEscape(new Date().toUTCString())}</lastBuildDate>`,
    items,
    '  </channel>',
    '</rss>',
  ].filter(Boolean).join('\n') + '\n';
}

function jsonLdScript(data) {
  const json = JSON.stringify(data, null, 2)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e');
  return `<script type="application/ld+json">${json}</script>`;
}

function formatArticleDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('ja-JP', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function replaceTemplateSlots(template, slots) {
  return Object.entries(slots).reduce((html, [key, value]) => (
    html.replaceAll(`{{${key}}}`, String(value == null ? '' : value))
  ), template);
}

function articleJsonLd(article, origin) {
  const url = siteUrl(origin, article.path);
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: article.title,
    description: article.description,
    url,
    mainEntityOfPage: url,
    datePublished: article.date,
    dateModified: article.updated,
    inLanguage: 'ja-JP',
    author: {
      '@type': 'Organization',
      name: article.author,
    },
    publisher: {
      '@type': 'Organization',
      name: 'Japan クリプト インフォメーション',
    },
  };
}

function renderArticleHtml(req, article) {
  const origin = requestOrigin(req);
  const template = fs.readFileSync(path.join(PUBLIC_DIR, 'templates', 'article.html'), 'utf8');
  const title = `${article.title}｜Japan クリプト インフォメーション`;
  const withHead = template
    .replace(HEAD_META_INJECT, renderHeadMeta({
      title,
      description: article.description,
      canonical: article.path,
      ogImage: '/ogp/default.png',
      pageId: 'article',
      siteOrigin: origin,
    }))
    .replace(ARTICLE_JSON_LD_INJECT, jsonLdScript(articleJsonLd(article, origin)));

  return replaceTemplateSlots(withHead, {
    ARTICLE_TITLE: xmlEscape(article.title),
    ARTICLE_DESCRIPTION: xmlEscape(article.description),
    ARTICLE_DATE_ISO: xmlEscape(article.date),
    ARTICLE_DATE: xmlEscape(formatArticleDate(article.date)),
    ARTICLE_UPDATED_ISO: xmlEscape(article.updated),
    ARTICLE_UPDATED: xmlEscape(formatArticleDate(article.updated)),
    ARTICLE_BODY: article.html,
  });
}

function normalizeAnalyticsRoute(reqPath) {
  if (reqPath === '/' || reqPath === '/index.html') return '/';
  if (reqPath === '/volume-share' || reqPath === '/volume-share.html') return '/volume-share';
  if (reqPath === '/sales-spread' || reqPath === '/sales-spread.html') return '/sales-spread';
  return null;
}

function getRequestAdminToken(req) {
  const authorization = req.get('authorization') || '';
  if (authorization.toLowerCase().startsWith('bearer ')) {
    return authorization.slice(7).trim();
  }
  return req.get('x-admin-token') || req.query.token || '';
}

function sha256(value) {
  return crypto.createHash('sha256').update(String(value || '')).digest('hex');
}

function timingSafeEqualString(a, b) {
  const left = Buffer.from(String(a || ''), 'utf8');
  const right = Buffer.from(String(b || ''), 'utf8');
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

function requireAnalyticsAdmin(req, res, next) {
  const requestToken = getRequestAdminToken(req);
  if (!requestToken) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  if (analyticsAdminToken && timingSafeEqualString(requestToken, analyticsAdminToken)) {
    next();
    return;
  }

  if (analyticsAdminTokenHash && timingSafeEqualString(sha256(requestToken), analyticsAdminTokenHash)) {
    next();
    return;
  }

  res.status(401).json({ error: 'Unauthorized' });
}

app.use((req, res, next) => {
  if (req.method !== 'GET') {
    next();
    return;
  }

  const route = normalizeAnalyticsRoute(req.path);
  if (!route) {
    next();
    return;
  }

  res.on('finish', () => {
    if (res.statusCode >= 200 && res.statusCode < 400) {
      try {
        analyticsStore.trackPageView(req, route);
      } catch (err) {
        console.warn('[Analytics] Page view tracking failed:', err.message);
      }
    }
  });
  next();
});

app.get('/healthz', (_req, res) => {
  res.status(200).json({ status: 'ok' });
});
app.get(['/', '/index.html'], (req, res) => {
  res.type('html').send(publicHtmlWithMeta(
    req,
    path.join(PUBLIC_DIR, 'index.html'),
    { pageId: 'home' }
  ));
});
app.get(['/volume-share', '/volume-share.html'], (req, res) => {
  res.type('html').send(publicHtmlWithMeta(
    req,
    path.join(PUBLIC_DIR, 'volume-share.html'),
    { pageId: 'volume-share' }
  ));
});
app.get(['/sales-spread', '/sales-spread.html'], (req, res) => {
  res.type('html').send(publicHtmlWithMeta(
    req,
    path.join(PUBLIC_DIR, 'sales-spread.html'),
    { pageId: 'sales-spread' }
  ));
});
app.get('/articles/:slug', (req, res) => {
  const article = getArticle(req.params.slug);
  if (!article) {
    res.status(404).type('text/plain').send('Article not found');
    return;
  }

  res.type('html').send(renderArticleHtml(req, article));
});
app.get(['/admin/analytics', '/admin-analytics'], (_req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'admin-analytics.html'));
});
app.get('/sitemap.xml', (req, res) => {
  res.type('application/xml').send(buildSitemapXml(requestOrigin(req)));
});
app.get('/rss.xml', (req, res) => {
  res.type('application/xml').send(buildRssXml(requestOrigin(req)));
});
app.get('/api/volume-share', (req, res) => {
  res.json(volumeShareStore.getShare(req.query.window || '1d'));
});
app.get('/api/volume-share/history', (req, res) => {
  res.json(volumeShareStore.getHistory(req.query.window || '30d'));
});
app.get('/api/sales-spread', (_req, res) => {
  res.json(salesSpreadStore.getReport());
});
app.get('/api/sales-spread/history', (req, res) => {
  res.json(salesSpreadStore.getHistory(req.query.window || '30d'));
});
app.get('/api/admin/analytics', requireAnalyticsAdmin, (req, res) => {
  res.json(analyticsStore.getReport(req.query.window || '7d'));
});
app.get('/api/exchanges', (_req, res) => {
  res.json({
    defaultExchangeId: DEFAULT_EXCHANGE_ID,
    exchanges: getPublicExchanges(),
  });
});

function parseRequestNumber(value) {
  const parsed = parseFloat(String(value ?? '').replace(/,/g, ''));
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeComparisonAmountType(value) {
  const amountType = value === 'btc' ? 'base' : value;
  return amountType === 'jpy' ? 'jpy' : 'base';
}

function compareExecutionStatusRank(row) {
  if (!row || row.status !== 'ready' || !row.result) return 3;
  if (row.result.executionStatus === 'executable') return 0;
  if (row.result.executionStatus === 'insufficient_liquidity') return 1;
  return 2;
}

function comparisonSortValue(row, side, amountType) {
  if (!row || !row.result) {
    return side === 'sell' ? -Infinity : Infinity;
  }

  const field = amountType === 'jpy' ? 'effectiveVWAP' : 'effectiveCostJPY';
  const value = Number(row.result[field]);
  if (!Number.isFinite(value)) return null;
  return value;
}

function sortComparisonRows(rows, side, amountType) {
  return rows.sort((a, b) => {
    const statusDiff = compareExecutionStatusRank(a) - compareExecutionStatusRank(b);
    if (statusDiff !== 0) return statusDiff;

    const aValue = comparisonSortValue(a, side, amountType);
    const bValue = comparisonSortValue(b, side, amountType);
    if (aValue == null && bValue == null) return 0;
    if (aValue == null) return 1;
    if (bValue == null) return -1;

    const valueDiff = side === 'sell' ? bValue - aValue : aValue - bValue;
    if (valueDiff !== 0) return valueDiff;

    return String(a.exchangeLabel || a.exchangeId).localeCompare(String(b.exchangeLabel || b.exchangeId), 'ja');
  });
}

function getBestReadyComparisonRow(comparison) {
  return (comparison.rows || []).find(row => (
    row.status === 'ready' && row.result && !row.result.error && row.rank === 1
  )) || null;
}

function resultSummary(result) {
  if (!result || result.error) {
    return result && result.error ? { error: result.error } : null;
  }

  return {
    side: result.side,
    amountType: result.amountType,
    totalBTCFilled: result.totalBTCFilled,
    totalJPYSpent: result.totalJPYSpent,
    vwap: result.vwap,
    effectiveCostJPY: result.effectiveCostJPY,
    effectiveVWAP: result.effectiveVWAP,
    feesJPY: result.feesJPY,
    feeRatePct: result.feeRatePct,
    marketImpactPct: result.marketImpactPct,
    slippageFromBestPct: result.slippageFromBestPct,
    slippageFromMidPct: result.slippageFromMidPct,
    spreadPct: result.spreadPct,
    levelsConsumed: result.levelsConsumed,
    totalLevelsAvailable: result.totalLevelsAvailable,
    executionStatus: result.executionStatus,
    executionStatusLabel: result.executionStatusLabel,
    executableUnderGuards: result.executableUnderGuards,
    insufficient: result.insufficient,
    shortfallBTC: result.shortfallBTC,
    shortfallJPY: result.shortfallJPY,
    bookTimestamp: result.bookTimestamp,
  };
}

function buildMarketImpactComparison({ instrumentId, side, amount, amountType, feeRate }) {
  const generatedAt = new Date().toISOString();
  const rows = [];
  const publicExchanges = getPublicExchanges();

  for (const exchange of publicExchanges) {
    const market = (exchange.markets || []).find(item => (
      item.instrumentId === instrumentId && (!item.status || item.status === 'active')
    ));

    if (!market) {
      rows.push({
        exchangeId: exchange.id,
        exchangeLabel: exchange.label || exchange.id,
        instrumentId,
        instrumentLabel: instrumentId,
        status: 'unsupported',
        message: '未対応銘柄',
      });
      continue;
    }

    const client = clientsByExchange.get(exchange.id);
    if (client && typeof client.activateInstrument === 'function') {
      client.activateInstrument(instrumentId);
    }

    const book = wsManager.latestBooks.get(wsManager.marketKey(exchange.id, instrumentId));
    if (!book) {
      rows.push({
        exchangeId: exchange.id,
        exchangeLabel: exchange.label || exchange.id,
        instrumentId,
        instrumentLabel: market.label || instrumentId,
        baseCurrency: market.baseCurrency || null,
        quoteCurrency: market.quoteCurrency || 'JPY',
        status: 'waiting',
        message: '板データ待機中',
      });
      continue;
    }

    const result = calculateImpact(side, amount, amountType, book, { feeRate });
    rows.push({
      exchangeId: exchange.id,
      exchangeLabel: exchange.label || exchange.id,
      instrumentId,
      instrumentLabel: market.label || instrumentId,
      baseCurrency: market.baseCurrency || null,
      quoteCurrency: market.quoteCurrency || 'JPY',
      status: result && result.error ? 'error' : 'ready',
      message: result && result.error ? result.error : null,
      source: book.source || 'rest',
      receivedAt: book.receivedAt,
      timestamp: book.timestamp,
      bestBid: book.bestBid,
      bestAsk: book.bestAsk,
      midPrice: book.midPrice,
      spread: book.spread,
      spreadPct: book.spreadPct,
      result: resultSummary(result),
    });
  }

  const sortedRows = sortComparisonRows(rows, side, amountType);
  let rank = 0;
  for (const row of sortedRows) {
    if (row.status === 'ready' && row.result && !row.result.error) {
      rank += 1;
      row.rank = rank;
    } else {
      row.rank = null;
    }
  }

  return {
    meta: {
      generatedAt,
      instrumentId,
      side,
      amount,
      amountType,
      feeRate,
      readyCount: sortedRows.filter(row => row.status === 'ready').length,
      waitingCount: sortedRows.filter(row => row.status === 'waiting').length,
      unsupportedCount: sortedRows.filter(row => row.status === 'unsupported').length,
    },
    rows: sortedRows,
  };
}

app.get('/api/market-impact-comparison', (req, res) => {
  const side = req.query.side === 'sell' ? 'sell' : 'buy';
  const amountType = normalizeComparisonAmountType(req.query.amountType);
  const amount = parseRequestNumber(req.query.amount);
  const feeRate = parseRequestNumber(req.query.feeRate ?? DEFAULT_FEE_RATE);
  const instrumentId = String(req.query.instrumentId || DEFAULT_OKJ_INSTRUMENT_ID).toUpperCase();

  if (amount == null || amount <= 0) {
    res.status(400).json({ error: 'amount は正の数値を指定してください' });
    return;
  }

  if (feeRate == null || feeRate < 0 || feeRate > 1) {
    res.status(400).json({ error: 'feeRate は0以上1以下を指定してください' });
    return;
  }

  res.json(buildMarketImpactComparison({
    instrumentId,
    side,
    amount,
    amountType,
    feeRate,
  }));
});

function buildSalesReferenceResult(record, { side, amount, amountType }) {
  const price = side === 'buy' ? Number(record.buyPrice) : Number(record.sellPrice);
  if (!Number.isFinite(price) || price <= 0) {
    return null;
  }

  const isBaseAmount = amountType === 'base';
  const totalBase = isBaseAmount ? amount : amount / price;
  const grossQuote = totalBase * price;
  const effectiveQuote = grossQuote;

  return {
    side,
    amountType,
    price,
    priceSide: side === 'buy' ? 'buyPrice' : 'sellPrice',
    requestedAmount: amount,
    totalBase,
    grossQuote,
    effectiveQuote,
    effectiveVWAP: price,
    feesJPY: 0,
    spreadPct: record.spreadPct,
    capturedAt: record.capturedAt,
    priceTimestamp: record.priceTimestamp,
  };
}

function buildSalesDelta(salesResult, baselineResult, side, amountType) {
  if (!salesResult || !baselineResult) return null;

  if (amountType === 'base') {
    const disadvantageJpy = side === 'buy'
      ? salesResult.effectiveQuote - baselineResult.effectiveCostJPY
      : baselineResult.effectiveCostJPY - salesResult.effectiveQuote;
    return {
      type: 'quote',
      disadvantageJpy,
      quoteDelta: side === 'buy'
        ? salesResult.effectiveQuote - baselineResult.effectiveCostJPY
        : salesResult.effectiveQuote - baselineResult.effectiveCostJPY,
      baseDelta: 0,
    };
  }

  const baseDelta = salesResult.totalBase - baselineResult.totalBTCFilled;
  const disadvantageJpy = side === 'buy'
    ? (baselineResult.totalBTCFilled - salesResult.totalBase) * salesResult.price
    : (salesResult.totalBase - baselineResult.totalBTCFilled) * salesResult.price;

  return {
    type: 'base',
    disadvantageJpy,
    baseDelta,
    quoteDelta: 0,
  };
}

function saleReferenceSortValue(row) {
  if (!row || row.status !== 'ready' || !row.delta) return Infinity;
  const value = Number(row.delta.disadvantageJpy);
  return Number.isFinite(value) ? value : Infinity;
}

function sortSalesReferenceRows(rows) {
  return rows.sort((a, b) => {
    if (a.status === 'ready' && b.status !== 'ready') return -1;
    if (a.status !== 'ready' && b.status === 'ready') return 1;

    const valueDiff = saleReferenceSortValue(a) - saleReferenceSortValue(b);
    if (valueDiff !== 0) return valueDiff;

    return String(a.exchangeLabel || a.exchangeId).localeCompare(String(b.exchangeLabel || b.exchangeId), 'ja');
  });
}

function buildSalesReferenceComparison({ instrumentId, side, amount, amountType, feeRate }) {
  const generatedAt = new Date().toISOString();
  const venueComparison = buildMarketImpactComparison({
    instrumentId,
    side,
    amount,
    amountType,
    feeRate,
  });
  const baseline = getBestReadyComparisonRow(venueComparison);
  const latestSalesRecords = salesSpreadStore.getLatestRecords()
    .filter(record => record.instrumentId === instrumentId);

  const rows = latestSalesRecords.map((record) => {
    const result = buildSalesReferenceResult(record, { side, amount, amountType });
    const delta = baseline && result
      ? buildSalesDelta(result, baseline.result, side, amountType)
      : null;

    return {
      exchangeId: record.exchangeId,
      exchangeLabel: record.exchangeLabel,
      instrumentId: record.instrumentId,
      instrumentLabel: record.instrumentLabel,
      baseCurrency: record.baseCurrency,
      quoteCurrency: record.quoteCurrency || 'JPY',
      currencyFullName: record.currencyFullName,
      status: result ? 'ready' : 'error',
      message: result ? null : '販売所価格を計算できません',
      buyPrice: record.buyPrice,
      sellPrice: record.sellPrice,
      quotePrecision: record.quotePrecision,
      spread: record.spread,
      spreadPct: record.spreadPct,
      isOnline: record.isOnline,
      isWidgetOpen: record.isWidgetOpen,
      capturedAt: record.capturedAt,
      priceTimestamp: record.priceTimestamp,
      result,
      delta,
      riskLabel: '価格再提示リスクあり',
      assumption: '販売所の表示価格が全数量に適用されると仮定した参考値です。',
    };
  });

  const sortedRows = sortSalesReferenceRows(rows);
  let rank = 0;
  for (const row of sortedRows) {
    if (row.status === 'ready') {
      rank += 1;
      row.rank = rank;
    } else {
      row.rank = null;
    }
  }

  return {
    meta: {
      generatedAt,
      instrumentId,
      side,
      amount,
      amountType,
      feeRate,
      saleRecordCount: sortedRows.length,
      baselineExchangeId: baseline ? baseline.exchangeId : null,
      baselineExchangeLabel: baseline ? baseline.exchangeLabel : null,
      baselineReady: Boolean(baseline),
      venueReadyCount: venueComparison.meta.readyCount,
      refreshStatus: salesSpreadStore.refreshStatus,
      assumption: '販売所は板情報がないため、表示価格が全数量に適用されると仮定した参考値です。実際の発注時には価格再提示、数量制限、約定拒否が発生する場合があります。',
    },
    baseline,
    rows: sortedRows,
  };
}

app.get('/api/sales-reference-comparison', (req, res) => {
  const side = req.query.side === 'sell' ? 'sell' : 'buy';
  const amountType = normalizeComparisonAmountType(req.query.amountType);
  const amount = parseRequestNumber(req.query.amount);
  const feeRate = parseRequestNumber(req.query.feeRate ?? DEFAULT_FEE_RATE);
  const instrumentId = String(req.query.instrumentId || DEFAULT_OKJ_INSTRUMENT_ID).toUpperCase();

  if (amount == null || amount <= 0) {
    res.status(400).json({ error: 'amount は正の数値を指定してください' });
    return;
  }

  if (feeRate == null || feeRate < 0 || feeRate > 1) {
    res.status(400).json({ error: 'feeRate は0以上1以下を指定してください' });
    return;
  }

  res.json(buildSalesReferenceComparison({
    instrumentId,
    side,
    amount,
    amountType,
    feeRate,
  }));
});

app.use(express.static(PUBLIC_DIR));

const server = http.createServer(app);
const okjClient = new OKCoinClient(500, {
  defaultInstrumentId: DEFAULT_OKJ_INSTRUMENT_ID,
});
const coincheckClient = new CoincheckClient(500, {
  defaultInstrumentId: DEFAULT_COINCHECK_INSTRUMENT_ID,
});
const bitflyerClient = new BitflyerClient(500, {
  defaultInstrumentId: DEFAULT_BITFLYER_INSTRUMENT_ID,
});
const bitbankClient = new BitbankClient(500, {
  defaultInstrumentId: DEFAULT_BITBANK_INSTRUMENT_ID,
});
const gmoClient = new GMOClient(500, {
  defaultInstrumentId: DEFAULT_GMO_INSTRUMENT_ID,
});
const binanceJapanClient = new BinanceJapanClient(500, {
  defaultInstrumentId: DEFAULT_BINANCE_JAPAN_INSTRUMENT_ID,
});
const okjSaleClient = new OKJSaleClient();
const coincheckSaleClient = new CoincheckSalesClient();
const bitflyerSaleClient = new BitflyerSalesClient();
const bitbankSaleClient = new BitbankSalesClient();
const gmoSaleClient = new GMOSalesClient();
const clientsByExchange = new Map([
  [DEFAULT_EXCHANGE_ID, okjClient],
  [COINCHECK_EXCHANGE_ID, coincheckClient],
  [BITFLYER_EXCHANGE_ID, bitflyerClient],
  [BITBANK_EXCHANGE_ID, bitbankClient],
  [GMO_EXCHANGE_ID, gmoClient],
  [BINANCE_JAPAN_EXCHANGE_ID, binanceJapanClient],
]);
const defaultInstrumentIds = {
  [DEFAULT_EXCHANGE_ID]: DEFAULT_OKJ_INSTRUMENT_ID,
  [COINCHECK_EXCHANGE_ID]: DEFAULT_COINCHECK_INSTRUMENT_ID,
  [BITFLYER_EXCHANGE_ID]: DEFAULT_BITFLYER_INSTRUMENT_ID,
  [BITBANK_EXCHANGE_ID]: DEFAULT_BITBANK_INSTRUMENT_ID,
  [GMO_EXCHANGE_ID]: DEFAULT_GMO_INSTRUMENT_ID,
  [BINANCE_JAPAN_EXCHANGE_ID]: DEFAULT_BINANCE_JAPAN_INSTRUMENT_ID,
};
const wsManager = new WSManager(server, {
  exchanges: getPublicExchanges(),
  defaultExchangeId: DEFAULT_EXCHANGE_ID,
  onMarketSelected: ({ exchangeId, instrumentId }) => {
    const exchangeClient = clientsByExchange.get(exchangeId);
    if (exchangeClient) exchangeClient.activateInstrument(instrumentId);
  },
  onClientConnected: ({ request }) => {
    try {
      analyticsStore.trackWebSocketOpen(request);
    } catch (err) {
      console.warn('[Analytics] WebSocket tracking failed:', err.message);
    }
  },
  onClientDisconnected: () => {
    analyticsStore.trackWebSocketClose();
  },
});

function getFallbackInstrumentId(exchangeId) {
  return defaultInstrumentIds[exchangeId] || DEFAULT_OKJ_INSTRUMENT_ID;
}

function wireExchangeClient(exchangeId, client, label) {
  client.on('instruments', (instruments) => {
    const exchange = setExchangeMarkets(exchangeId, instruments);
    wsManager.setExchanges(getPublicExchanges());
    if (exchange) {
      client.activateInstrument(exchange.defaultInstrumentId || getFallbackInstrumentId(exchangeId));
    }
  });

  client.on('orderbook', (raw) => {
    try {
      const book = new OrderBook({
        ...raw,
        exchangeId,
        instrumentId: raw.instrument_id || raw.instrumentId || getFallbackInstrumentId(exchangeId),
      });
      wsManager.onOrderBook(book);
    } catch (err) {
      console.error(`[${label} OrderBook Parse Error]`, err.message);
    }
  });

  client.on('ticker', (data) => {
    const tickerInput = {
      ...data,
      exchangeId,
      instrumentId: data.instrument_id || data.instrumentId || getFallbackInstrumentId(exchangeId),
    };
    wsManager.onTicker(tickerInput);

    const exchange = getPublicExchanges().find(item => item.id === exchangeId);
    const market = exchange && exchange.markets.find(item => item.instrumentId === tickerInput.instrumentId);
    if (exchange && market) {
      volumeShareStore.upsertTicker(wsManager.normalizeTicker(tickerInput), exchange, market);
    }
  });

  client.on('connected', (message) => {
    wsManager.onStatus({ type: `${exchangeId}Connected`, exchangeId, message });
  });

  client.on('status', (data) => {
    wsManager.onStatus({ type: `${exchangeId}Status`, exchangeId, data });
  });

  client.on('error', (msg) => {
    console.warn(`[${label} API Error]`, msg);
    wsManager.onStatus({ type: 'apiError', exchangeId, message: msg });
  });

  client.on('rateLimit', (data) => {
    console.warn(`[${label} Rate Limit] instrument:`, data.instrumentId, 'backoff:', data.backoffMs, 'ms');
    wsManager.onStatus({ type: 'rateLimit', exchangeId, ...data });
  });

  client.on('disconnected', (msg) => {
    console.error(`[${label} Disconnected]`, msg);
    wsManager.onStatus({ type: 'disconnected', exchangeId, message: msg });
  });
}

wireExchangeClient(DEFAULT_EXCHANGE_ID, okjClient, 'OKJ');
wireExchangeClient(COINCHECK_EXCHANGE_ID, coincheckClient, 'Coincheck');
wireExchangeClient(BITFLYER_EXCHANGE_ID, bitflyerClient, 'bitFlyer');
wireExchangeClient(BITBANK_EXCHANGE_ID, bitbankClient, 'bitbank');
wireExchangeClient(GMO_EXCHANGE_ID, gmoClient, 'GMO Coin');
wireExchangeClient(BINANCE_JAPAN_EXCHANGE_ID, binanceJapanClient, 'Binance Japan');

const TICKER_FETCH_DELAY_MS = 120;
const VOLUME_REFRESH_INTERVAL_MS = 60 * 60 * 1000;
const STARTUP_VOLUME_REFRESH_DELAY_MS = 8000;
const SALES_SPREAD_REFRESH_INTERVAL_MS = 60 * 60 * 1000;
const STARTUP_SALES_SPREAD_REFRESH_DELAY_MS = 5000;
const JST_OFFSET_MS = 9 * 60 * 60 * 1000;
let volumeRefreshPromise = null;
let salesSpreadRefreshPromise = null;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function msUntilNextJstMidnight(now = new Date()) {
  const jstClock = new Date(now.getTime() + JST_OFFSET_MS);
  const nextJstMidnightAsUtc = Date.UTC(
    jstClock.getUTCFullYear(),
    jstClock.getUTCMonth(),
    jstClock.getUTCDate() + 1,
    0,
    0,
    5
  );
  return Math.max(1000, nextJstMidnightAsUtc - jstClock.getTime());
}

function getPublicExchangeById(exchangeId, label) {
  return getPublicExchanges().find(exchange => exchange.id === exchangeId) || {
    id: exchangeId,
    label,
  };
}

async function refreshAllVolumeTickers(source = 'scheduled') {
  if (volumeRefreshPromise) return volumeRefreshPromise;

  volumeRefreshPromise = (async () => {
    const capturedAt = new Date();
    const records = [];
    const errors = [];
    volumeShareStore.setRefreshStatus({
      running: true,
      startedAt: capturedAt.toISOString(),
      source,
      errors: [],
    });

    for (const exchange of getPublicExchanges()) {
      const client = clientsByExchange.get(exchange.id);
      if (!client || typeof client.fetchTicker !== 'function') continue;

      for (const market of exchange.markets || []) {
        if (market.status && market.status !== 'active') continue;

        try {
          const rawTicker = await client.fetchTicker(market.instrumentId);
          if (rawTicker) {
            const ticker = wsManager.normalizeTicker({
              ...rawTicker,
              exchangeId: exchange.id,
              instrumentId: rawTicker.instrument_id || rawTicker.instrumentId || market.instrumentId,
            });
            const record = volumeShareStore.buildRecord(ticker, exchange, market, capturedAt);
            if (record) records.push(record);
          }
        } catch (err) {
          errors.push({
            exchangeId: exchange.id,
            instrumentId: market.instrumentId,
            message: err.message,
          });
        }

        await sleep(TICKER_FETCH_DELAY_MS);
      }
    }

    if (records.length > 0) {
      volumeShareStore.replaceLatest(records, source, {
        capturedAt: capturedAt.toISOString(),
        errors,
      });
    }

    volumeShareStore.setRefreshStatus({
      running: false,
      finishedAt: new Date().toISOString(),
      source,
      errors,
    });

    return {
      capturedAt: capturedAt.toISOString(),
      records,
      errors,
    };
  })().finally(() => {
    volumeRefreshPromise = null;
  });

  return volumeRefreshPromise;
}

async function refreshSalesSpreadRecords(source = 'scheduled') {
  if (salesSpreadRefreshPromise) return salesSpreadRefreshPromise;

  salesSpreadRefreshPromise = (async () => {
    const capturedAt = new Date();
    const errors = [];
    salesSpreadStore.setRefreshStatus({
      running: true,
      startedAt: capturedAt.toISOString(),
      source,
      errors: [],
    });

    const records = [];
    const sources = [
      {
        exchangeId: DEFAULT_EXCHANGE_ID,
        label: 'OKJ',
        client: okjSaleClient,
      },
      {
        exchangeId: COINCHECK_EXCHANGE_ID,
        label: 'Coincheck',
        client: coincheckSaleClient,
      },
      {
        exchangeId: BITFLYER_EXCHANGE_ID,
        label: 'bitFlyer',
        client: bitflyerSaleClient,
      },
      {
        exchangeId: BITBANK_EXCHANGE_ID,
        label: 'bitbank',
        client: bitbankSaleClient,
      },
      {
        exchangeId: GMO_EXCHANGE_ID,
        label: 'GMO Coin',
        client: gmoSaleClient,
      },
    ];

    for (const sourceConfig of sources) {
      try {
        const exchange = getPublicExchangeById(sourceConfig.exchangeId, sourceConfig.label);
        const currencies = await sourceConfig.client.fetchCurrencies();
        for (const item of currencies) {
          const record = salesSpreadStore.buildRecord(item, exchange, capturedAt);
          if (record) records.push(record);
        }
      } catch (err) {
        errors.push({
          exchangeId: sourceConfig.exchangeId,
          message: err.message,
        });
      }
    }

    if (records.length > 0) {
      salesSpreadStore.replaceLatest(records, source, {
        capturedAt: capturedAt.toISOString(),
        errors,
      });
    }

    salesSpreadStore.setRefreshStatus({
      running: false,
      finishedAt: new Date().toISOString(),
      source,
      errors,
    });

    return {
      capturedAt: capturedAt.toISOString(),
      records,
      errors,
    };
  })().finally(() => {
    salesSpreadRefreshPromise = null;
  });

  return salesSpreadRefreshPromise;
}

function captureVolumeSnapshotFromResult(result, reason, options = {}) {
  if (!result || result.records.length === 0) return null;
  const capturedAt = new Date(result.capturedAt);
  const volumeDateJst = options.volumeDateJst || VolumeShareStore.getJstDate(capturedAt);

  if (options.skipIfExists && volumeShareStore.hasDailySnapshot(volumeDateJst)) {
    return null;
  }

  return volumeShareStore.captureDaily(result.records, {
    capturedAt: result.capturedAt,
    reason,
    volumeDateJst,
  });
}

async function captureDailyVolumeSnapshot(reason = 'jst-midnight') {
  const result = await refreshAllVolumeTickers(reason);

  return captureVolumeSnapshotFromResult(result, reason, {
    volumeDateJst: VolumeShareStore.getPreviousJstDate(new Date(result.capturedAt)),
  });
}

async function captureDailySalesSpreadSnapshot(reason = 'jst-midnight') {
  const result = await refreshSalesSpreadRecords(reason);

  return captureSalesSpreadSnapshotFromResult(result, reason, {
    spreadDateJst: SalesSpreadStore.getPreviousJstDate(new Date(result.capturedAt)),
  });
}

function captureSalesSpreadSnapshotFromResult(result, reason, options = {}) {
  if (!result || result.records.length === 0) return null;
  const capturedAt = new Date(result.capturedAt);
  const spreadDateJst = options.spreadDateJst || SalesSpreadStore.getJstDate(capturedAt);

  if (options.skipIfExists && salesSpreadStore.hasDailySnapshot(spreadDateJst)) {
    return null;
  }

  return salesSpreadStore.captureDaily(result.records, {
    capturedAt: result.capturedAt,
    reason,
    spreadDateJst,
  });
}

function captureRollingVolumeSnapshot(result, reason = 'refresh-snapshot') {
  if (!result || result.records.length === 0) return;
  const capturedAt = new Date(result.capturedAt);
  const parts = VolumeShareStore.getJstParts(capturedAt);
  // Before 02:00 JST, keep treating the first wake-up as a catch-up for yesterday.
  const isEarlyMorning = parts.hour <= 1;
  const volumeDateJst = isEarlyMorning
    ? VolumeShareStore.getPreviousJstDate(capturedAt)
    : parts.date;
  const existingSnapshot = isEarlyMorning ? volumeShareStore.getDailySnapshot(volumeDateJst) : null;
  const hasClosingSnapshot = existingSnapshot
    && ['jst-midnight', 'early-morning-catchup'].includes(existingSnapshot.reason);

  return captureVolumeSnapshotFromResult(result, isEarlyMorning ? 'early-morning-catchup' : reason, {
    volumeDateJst,
    skipIfExists: hasClosingSnapshot,
  });
}

function captureRollingSalesSpreadSnapshot(result, reason = 'refresh-snapshot') {
  if (!result || result.records.length === 0) return;
  const capturedAt = new Date(result.capturedAt);
  const parts = SalesSpreadStore.getJstParts(capturedAt);
  // Before 02:00 JST, keep treating the first wake-up as a catch-up for yesterday.
  const isEarlyMorning = parts.hour <= 1;
  const spreadDateJst = isEarlyMorning
    ? SalesSpreadStore.getPreviousJstDate(capturedAt)
    : parts.date;
  const existingSnapshot = isEarlyMorning ? salesSpreadStore.getDailySnapshot(spreadDateJst) : null;
  const hasClosingSnapshot = existingSnapshot
    && ['jst-midnight', 'early-morning-catchup'].includes(existingSnapshot.reason);

  return captureSalesSpreadSnapshotFromResult(result, isEarlyMorning ? 'early-morning-catchup' : reason, {
    spreadDateJst,
    skipIfExists: hasClosingSnapshot,
  });
}

function scheduleDailyVolumeSnapshot() {
  setTimeout(async () => {
    try {
      await captureDailyVolumeSnapshot('jst-midnight');
    } catch (err) {
      console.warn('[Volume Share] Daily snapshot failed:', err.message);
    } finally {
      scheduleDailyVolumeSnapshot();
    }
  }, msUntilNextJstMidnight());
}

function scheduleDailySalesSpreadSnapshot() {
  setTimeout(async () => {
    try {
      await captureDailySalesSpreadSnapshot('jst-midnight');
    } catch (err) {
      console.warn('[Sales Spread] Daily snapshot failed:', err.message);
    } finally {
      scheduleDailySalesSpreadSnapshot();
    }
  }, msUntilNextJstMidnight());
}

function scheduleVolumeShareJobs() {
  setTimeout(async () => {
    try {
      const result = await refreshAllVolumeTickers('startup');
      captureRollingVolumeSnapshot(result, 'startup-snapshot');
    } catch (err) {
      console.warn('[Volume Share] Startup refresh failed:', err.message);
    }
  }, STARTUP_VOLUME_REFRESH_DELAY_MS);

  setInterval(async () => {
    try {
      const result = await refreshAllVolumeTickers('hourly');
      captureRollingVolumeSnapshot(result, 'hourly-snapshot');
    } catch (err) {
      console.warn('[Volume Share] Hourly refresh failed:', err.message);
    }
  }, VOLUME_REFRESH_INTERVAL_MS);

  scheduleDailyVolumeSnapshot();
}

function scheduleSalesSpreadJobs() {
  setTimeout(async () => {
    try {
      const result = await refreshSalesSpreadRecords('startup');
      captureRollingSalesSpreadSnapshot(result, 'startup-snapshot');
    } catch (err) {
      console.warn('[Sales Spread] Startup refresh failed:', err.message);
    }
  }, STARTUP_SALES_SPREAD_REFRESH_DELAY_MS);

  setInterval(async () => {
    try {
      const result = await refreshSalesSpreadRecords('hourly');
      captureRollingSalesSpreadSnapshot(result, 'hourly-snapshot');
    } catch (err) {
      console.warn('[Sales Spread] Hourly refresh failed:', err.message);
    }
  }, SALES_SPREAD_REFRESH_INTERVAL_MS);

  scheduleDailySalesSpreadSnapshot();
}

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';
server.listen(PORT, HOST, () => {
  const displayHost = HOST === '0.0.0.0' ? 'localhost' : HOST;
  console.log(`成行取引リアルタイム板シミュレーター running on http://${displayHost}:${PORT} (${EXCHANGES.map(exchange => exchange.label).join(', ')})`);
  for (const client of clientsByExchange.values()) {
    client.start();
  }
  scheduleVolumeShareJobs();
  scheduleSalesSpreadJobs();
});
