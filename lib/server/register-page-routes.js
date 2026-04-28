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

  app.get(['/campaigns', '/campaigns.html'], (req, res) => {
    res.type('html').send(siteContentService.renderCampaignsHtml(req));
  });

  app.get(['/learn', '/learn/'], (req, res) => {
    res.type('html').send(siteContentService.renderLearnIndexHtml(req));
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

  app.get('/campaigns/:campaignSlug', (req, res) => {
    const campaignSlug = siteContentService.normalizeCampaignSlug(req.params.campaignSlug);
    const campaign = siteContentService.getCampaignInfo(campaignSlug);
    if (!campaign) {
      res.status(404).type('text/plain').send('Campaign not found');
      return;
    }

    const canonicalPath = siteContentService.campaignPath(campaign);
    const canonicalSlug = canonicalPath.split('/').pop();
    if (req.params.campaignSlug !== canonicalSlug) {
      res.redirect(301, canonicalPath);
      return;
    }

    res.type('html').send(siteContentService.renderCampaignHtml(req, campaign));
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
