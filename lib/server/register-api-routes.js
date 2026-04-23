function registerApiRoutes(app, {
  analyticsAdminService,
  analyticsStore,
  defaultExchangeId,
  getPublicExchanges,
  marketDataService,
  salesSpreadStore,
  siteContentService,
  volumeShareStore,
}) {
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

  app.post('/api/admin/session', analyticsAdminService.handleLogin);
  app.delete('/api/admin/session', analyticsAdminService.handleLogout);

  app.get('/api/admin/analytics', analyticsAdminService.requireAdmin, (req, res) => {
    res.set('Cache-Control', 'no-store');
    res.json(analyticsStore.getReport(req.query.window || '7d'));
  });

  app.get('/api/exchanges', (_req, res) => {
    res.json({
      defaultExchangeId,
      exchanges: getPublicExchanges(),
    });
  });

  app.get('/api/markets', (_req, res) => {
    res.json(siteContentService.buildMarketIndexModel());
  });

  app.get('/api/markets/:instrumentId', (req, res) => {
    const instrumentId = siteContentService.normalizeMarketInstrumentId(req.params.instrumentId);
    const report = marketDataService.buildMarketPageReport(instrumentId);
    if (!report) {
      res.status(404).json({ error: 'Market not found' });
      return;
    }
    res.json(report);
  });

  app.get('/api/market-impact-comparison', (req, res) => {
    const parsed = marketDataService.readComparisonRequest(req.query);
    if (parsed.error) {
      res.status(400).json({ error: parsed.error });
      return;
    }

    res.json(marketDataService.buildMarketImpactComparison(parsed.params));
  });

  app.get('/api/sales-reference-comparison', (req, res) => {
    const parsed = marketDataService.readComparisonRequest(req.query);
    if (parsed.error) {
      res.status(400).json({ error: parsed.error });
      return;
    }

    res.json(marketDataService.buildSalesReferenceComparison(parsed.params));
  });
}

module.exports = {
  registerApiRoutes,
};
