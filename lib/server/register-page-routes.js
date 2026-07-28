const path = require('path');

const CRYPTO_ICON_MODULES = Object.freeze({
  ADA: '@web3icons/core/svgs/tokens/branded/ADA.svg.js',
  BCH: '@web3icons/core/svgs/tokens/branded/BCH.svg.js',
  BNB: '@web3icons/core/svgs/tokens/branded/BNB.svg.js',
  BTC: '@web3icons/core/svgs/tokens/branded/BTC.svg.js',
  DAI: '@web3icons/core/svgs/tokens/branded/DAI.svg.js',
  DOGE: '@web3icons/core/svgs/tokens/branded/DOGE.svg.js',
  ETH: '@web3icons/core/svgs/tokens/branded/ETH.svg.js',
  GRAM: '@web3icons/core/svgs/tokens/branded/GRAM.svg.js',
  HYPE: '@web3icons/core/svgs/networks/branded/hyper-evm.svg.js',
  LEO: '@web3icons/core/svgs/tokens/branded/LEO.svg.js',
  LINK: '@web3icons/core/svgs/tokens/branded/LINK.svg.js',
  SOL: '@web3icons/core/svgs/tokens/branded/SOL.svg.js',
  TRX: '@web3icons/core/svgs/tokens/branded/TRX.svg.js',
  USDC: '@web3icons/core/svgs/tokens/branded/USDC.svg.js',
  USDT: '@web3icons/core/svgs/tokens/branded/USDT.svg.js',
  XLM: '@web3icons/core/svgs/tokens/branded/XLM.svg.js',
  XMR: '@web3icons/core/svgs/tokens/branded/XMR.svg.js',
  XRP: '@web3icons/core/svgs/tokens/branded/XRP.svg.js',
  ZEC: '@web3icons/core/svgs/tokens/branded/ZEC.svg.js',
});

const LOCAL_CRYPTO_ICONS = Object.freeze({
  CANTON: 'CANTON.svg',
  USD1: 'USD1.svg',
});

function registerPageRoutes(app, {
  publicDir,
  siteContentService,
}) {
  app.get('/healthz', (_req, res) => {
    res.status(200).json({ status: 'ok' });
  });

  app.get('/crypto-icons/:ticker.svg', async (req, res) => {
    const ticker = String(req.params.ticker || '').trim().toUpperCase();
    const localFile = LOCAL_CRYPTO_ICONS[ticker];
    const moduleId = CRYPTO_ICON_MODULES[ticker];
    if (!localFile && !moduleId) {
      res.status(404).type('text/plain').send('Icon not found');
      return;
    }

    res.set('Cache-Control', 'public, max-age=31536000, immutable');

    if (localFile) {
      res.type('image/svg+xml').sendFile(path.join(publicDir, 'crypto-icons', localFile));
      return;
    }

    try {
      const iconModule = await import(moduleId);
      res.type('image/svg+xml').send(iconModule.default);
    } catch (err) {
      console.warn(`[Crypto icon] Could not load ${ticker}:`, err.message);
      res.status(404).type('text/plain').send('Icon not found');
    }
  });

  app.get(['/', '/index.html'], (req, res) => {
    res.type('html').send(siteContentService.renderPublicPage(
      req,
      'index.html',
      { pageId: 'home' }
    ));
  });

  app.get(['/simulator', '/simulator.html'], (req, res) => {
    res.type('html').send(siteContentService.renderPublicPage(
      req,
      'simulator.html',
      { pageId: 'simulator' }
    ));
  });

  app.get(['/volume-share', '/volume-share.html'], (req, res) => {
    res.type('html').send(siteContentService.renderVolumeShareHtml(req));
  });

  app.get(['/derivatives', '/derivatives.html'], (req, res) => {
    res.type('html').send(siteContentService.renderPublicPage(
      req,
      'derivatives.html',
      { pageId: 'derivatives' }
    ));
  });

  app.get(['/sales-spread', '/sales-spread.html'], (req, res) => {
    res.type('html').send(siteContentService.renderPublicPage(
      req,
      'sales-spread.html',
      { pageId: 'sales-spread' }
    ));
  });

  app.get(['/financial-comparison', '/financial-comparison.html'], (req, res) => {
    res.type('html').send(siteContentService.renderFinancialComparisonHtml(req));
  });

  app.get(['/learn', '/learn/'], (req, res) => {
    res.type('html').send(siteContentService.renderLearnIndexHtml(req));
  });

  app.get(['/about', '/about.html'], (req, res) => {
    const article = siteContentService.getArticleBySlug('about');
    if (!article) {
      res.status(404).type('text/plain').send('Article not found');
      return;
    }

    res.type('html').send(siteContentService.renderArticleHtml(req, article));
  });

  app.get(['/research', '/research.html'], (req, res) => {
    res.type('html').send(siteContentService.renderResearchHtml(req));
  });

  app.get('/learn/:slug', (req, res) => {
    const article = siteContentService.getLearnArticleBySlug(req.params.slug);
    if (!article) {
      res.status(404).type('text/plain').send('Article not found');
      return;
    }

    if (req.path !== article.path) {
      res.redirect(301, article.path);
      return;
    }

    res.type('html').send(siteContentService.renderArticleHtml(req, article));
  });

  app.get(['/articles', '/articles/', '/articles.html'], (req, res) => {
    res.type('html').send(siteContentService.renderArticlesIndexHtml(req));
  });

  app.get(['/markets', '/markets.html'], (req, res) => {
    res.type('html').send(siteContentService.renderMarketsIndexHtml(req));
  });

  app.get(['/exchanges', '/exchanges.html'], (req, res) => {
    res.type('html').send(siteContentService.renderExchangesIndexHtml(req));
  });

  app.get('/markets/:instrumentId', (req, res) => {
    const instrumentId = siteContentService.normalizeMarketInstrumentId(req.params.instrumentId);
    const market = siteContentService.getMarketInfo(instrumentId);
    if (!market) {
      res.status(404).type('text/plain').send('Market not found');
      return;
    }

    if (req.params.instrumentId !== instrumentId) {
      res.redirect(301, siteContentService.marketPath(instrumentId));
      return;
    }

    res.type('html').send(siteContentService.renderMarketHtml(req, market));
  });

  app.get('/exchanges/:exchangeId', (req, res) => {
    const exchangeId = siteContentService.normalizeExchangeId(req.params.exchangeId);
    const exchange = siteContentService.getExchangeInfo(exchangeId);
    if (!exchange) {
      res.status(404).type('text/plain').send('Exchange not found');
      return;
    }

    const canonicalPath = siteContentService.exchangePath(exchangeId);
    const canonicalSlug = canonicalPath.split('/').pop();
    if (req.params.exchangeId !== canonicalSlug) {
      res.redirect(301, siteContentService.exchangePath(exchangeId));
      return;
    }

    res.type('html').send(siteContentService.renderExchangeHtml(req, exchange));
  });

  app.get('/articles/:slug', (req, res) => {
    const article = siteContentService.getArticleBySlug(req.params.slug);
    if (!article) {
      res.status(404).type('text/plain').send('Article not found');
      return;
    }

    const legacyPath = `/articles/${encodeURIComponent(article.slug)}`;
    if (article.path !== legacyPath) {
      res.redirect(301, article.path);
      return;
    }

    res.type('html').send(siteContentService.renderArticleHtml(req, article));
  });

  app.get(['/admin/analytics', '/admin-analytics', '/admin-analytics.html'], (_req, res) => {
    res.set('Cache-Control', 'no-store');
    res.type('html').send(siteContentService.renderStaticPublicPage('admin-analytics.html'));
  });

  app.get('/sitemap.xml', (req, res) => {
    res.type('application/xml').send(siteContentService.buildSitemapXml(siteContentService.requestOrigin(req)));
  });

  app.get('/rss.xml', (req, res) => {
    res.type('application/xml').send(siteContentService.buildRssXml(siteContentService.requestOrigin(req)));
  });
}

module.exports = {
  registerPageRoutes,
};
