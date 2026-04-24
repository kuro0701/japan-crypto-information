const path = require('path');

function registerPageRoutes(app, {
  publicDir,
  siteContentService,
}) {
  app.get('/healthz', (_req, res) => {
    res.status(200).json({ status: 'ok' });
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
    res.type('html').send(siteContentService.renderPublicPage(
      req,
      'volume-share.html',
      { pageId: 'volume-share' }
    ));
  });

  app.get(['/sales-spread', '/sales-spread.html'], (req, res) => {
    res.type('html').send(siteContentService.renderPublicPage(
      req,
      'sales-spread.html',
      { pageId: 'sales-spread' }
    ));
  });

  app.get(['/markets', '/markets.html'], (req, res) => {
    res.type('html').send(siteContentService.renderMarketsIndexHtml(req));
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

    if (req.params.exchangeId !== exchangeId) {
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

    res.type('html').send(siteContentService.renderArticleHtml(req, article));
  });

  app.get(['/admin/analytics', '/admin-analytics'], (_req, res) => {
    res.set('Cache-Control', 'no-store');
    res.sendFile(path.join(publicDir, 'admin-analytics.html'));
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
