const fs = require('fs');
const path = require('path');
const { SITE_NAME } = require('../schema');
const {
  campaignPath,
  getCampaign,
  listCampaigns,
  normalizeCampaignSlug,
} = require('../campaigns');
const {
  exchangePageSlug,
  getExchangePageContent,
  resolveExchangePageId,
} = require('../exchange-page-content');

const HEAD_META_INJECT = '<!-- HEAD_META_INJECT -->';
const ARTICLE_JSON_LD_INJECT = '<!-- ARTICLE_JSON_LD_INJECT -->';

function createSiteContentService({
  getArticle,
  getPublicExchanges,
  listArticles,
  publicDir,
  renderHeadMeta,
  salesSpreadStore,
  volumeShareStore,
}) {
  const FEATURED_MARKET_IDS = ['BTC-JPY', 'ETH-JPY', 'XRP-JPY', 'SOL-JPY', 'ADA-JPY', 'DOGE-JPY'];
  const MEME_BASE_CURRENCIES = new Set(['DOGE', 'SHIB', 'PEPE', 'TRUMP']);
  const STABLE_BASE_CURRENCIES = new Set(['DAI', 'USDC', 'USDT']);
  let marketPageSnapshotLoader = null;

  function fileLastmod(filePath) {
    try {
      return fs.statSync(filePath).mtime.toISOString();
    } catch (_err) {
      return new Date().toISOString();
    }
  }

  const sitemapPages = [
    {
      path: '/',
      lastmod: fileLastmod(path.join(publicDir, 'index.html')),
      priority: '1.0',
    },
    {
      path: '/simulator',
      lastmod: fileLastmod(path.join(publicDir, 'simulator.html')),
      priority: '0.9',
    },
    {
      path: '/volume-share',
      lastmod: fileLastmod(path.join(publicDir, 'volume-share.html')),
      priority: '0.8',
    },
    {
      path: '/sales-spread',
      lastmod: fileLastmod(path.join(publicDir, 'sales-spread.html')),
      priority: '0.8',
    },
    {
      path: '/campaigns',
      lastmod: fileLastmod(path.join(publicDir, 'campaigns.html')),
      priority: '0.8',
    },
    {
      path: '/markets',
      lastmod: fileLastmod(path.join(publicDir, 'markets.html')),
      priority: '0.8',
    },
  ];

  function requestOrigin(req) {
    if (process.env.SITE_ORIGIN) return String(process.env.SITE_ORIGIN).replace(/\/+$/, '');
    const forwardedProto = String(req.get('x-forwarded-proto') || '').split(',')[0].trim();
    const protocol = forwardedProto || req.protocol || 'http';
    return `${protocol}://${req.get('host')}`;
  }

  function publicHtmlWithMeta(req, filePath, metaOptions) {
    const html = fs.readFileSync(filePath, 'utf8');
    return html.replace(HEAD_META_INJECT, renderHeadMeta({
      ...metaOptions,
      siteOrigin: requestOrigin(req),
    }));
  }

  function renderPublicPage(req, fileName, metaOptions) {
    return publicHtmlWithMeta(req, path.join(publicDir, fileName), metaOptions);
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

  function siteUrl(origin, urlPath) {
    if (/^https?:\/\//i.test(urlPath)) return urlPath;
    return `${origin}${urlPath.startsWith('/') ? urlPath : `/${urlPath}`}`;
  }

  function safeJsonForHtml(data) {
    return JSON.stringify(data)
      .replace(/</g, '\\u003c')
      .replace(/>/g, '\\u003e')
      .replace(/&/g, '\\u0026');
  }

  function normalizeMarketInstrumentId(value) {
    const instrumentId = String(value || '').trim().toUpperCase();
    if (!/^[A-Z0-9]+-[A-Z0-9]+$/.test(instrumentId)) return '';
    return instrumentId;
  }

  function marketPath(instrumentId) {
    return `/markets/${encodeURIComponent(instrumentId)}`;
  }

  function marketIndexPath() {
    return '/markets';
  }

  function normalizeExchangeId(value) {
    const exchangeId = String(value || '').trim().toLowerCase();
    if (!/^[a-z0-9-]+$/.test(exchangeId)) return '';
    return resolveExchangePageId(exchangeId);
  }

  function exchangePath(exchangeId) {
    const normalizedExchangeId = normalizeExchangeId(exchangeId);
    const pageSlug = exchangePageSlug(normalizedExchangeId || exchangeId);
    return `/exchanges/${encodeURIComponent(pageSlug)}`;
  }

  function marketLabel(instrumentId, market = {}) {
    if (market.label) return market.label;
    return String(instrumentId || '').replace('-', '/');
  }

  function parseNumber(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  function formatCount(value) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return '-';
    return new Intl.NumberFormat('ja-JP').format(Math.round(numeric));
  }

  function priceDecimals(value, precision) {
    const abs = Math.abs(Number(value));
    if (!Number.isFinite(abs)) return 0;
    if (abs >= 1000) return 0;
    if (abs >= 100) return Math.min(Math.max(precision ?? 1, 1), 2);
    if (abs >= 1) return Math.min(Math.max(precision ?? 2, 2), 4);
    return Math.min(Math.max(precision ?? 4, 4), 8);
  }

  function formatJpyPrice(value, precision) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return 'データ待ち';
    return new Intl.NumberFormat('ja-JP', {
      style: 'currency',
      currency: 'JPY',
      minimumFractionDigits: 0,
      maximumFractionDigits: priceDecimals(numeric, precision),
    }).format(numeric);
  }

  function formatJpyCompact(value) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return 'データ待ち';
    const compact = new Intl.NumberFormat('ja-JP', {
      notation: 'compact',
      maximumFractionDigits: numeric >= 1e8 ? 1 : 0,
    }).format(numeric);
    return `¥${compact}`;
  }

  function formatPct(value, decimals = 2) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return 'データ待ち';
    return `${numeric.toFixed(decimals)}%`;
  }

  function pickSpreadPct(row) {
    if (!row) return null;
    const latest = parseNumber(row.latest && row.latest.spreadPct);
    if (latest != null) return latest;
    const oneDay = parseNumber(row.averages && row.averages['1d'] && row.averages['1d'].spreadPct);
    if (oneDay != null) return oneDay;
    return parseNumber(row.averages && row.averages['7d'] && row.averages['7d'].spreadPct);
  }

  function average(values) {
    const filtered = (values || []).filter(value => Number.isFinite(Number(value))).map(Number);
    if (filtered.length === 0) return null;
    return filtered.reduce((sum, value) => sum + value, 0) / filtered.length;
  }

  function featuredMarketRank(instrumentId) {
    return ({
      'BTC-JPY': 0,
      'ETH-JPY': 1,
      'XRP-JPY': 2,
      'SOL-JPY': 3,
    })[instrumentId] ?? 100;
  }

  function sortMarketsByPriority(markets) {
    return (markets || []).slice().sort((a, b) => {
      const aRank = featuredMarketRank(a.instrumentId);
      const bRank = featuredMarketRank(b.instrumentId);
      if (aRank !== bRank) return aRank - bRank;
      return String(a.instrumentId || '').localeCompare(String(b.instrumentId || ''));
    });
  }

  function spreadTrendSummary(avg1d, avg7d, marketCount) {
    if (!marketCount || avg1d == null) {
      return '販売所データは準備中です。';
    }
    if (avg7d == null) {
      return `直近1日平均 ${formatPct(avg1d, 2)} を表示しています。注文前に実効コストを確認しましょう。`;
    }

    const delta = avg1d - avg7d;
    if (delta <= -0.15) {
      return `直近1日は 7日平均よりやや狭めです。コスト比較の候補になります。`;
    }
    if (delta >= 0.15) {
      return `直近1日は 7日平均よりやや広めです。販売所を使う前に実効コストを確認しましょう。`;
    }
    return '直近1日と7日平均が近い水準です。販売所を使う前に実効コストを確認しましょう。';
  }

  function buildExchangeCoverage(boardMarkets, salesRows) {
    const byInstrument = new Map();

    for (const market of boardMarkets || []) {
      if (!market || !market.instrumentId) continue;
      byInstrument.set(market.instrumentId, {
        instrumentId: market.instrumentId,
        label: marketLabel(market.instrumentId, market),
        hasBoard: true,
        hasSales: false,
      });
    }

    for (const row of salesRows || []) {
      if (!row || !row.instrumentId) continue;
      const existing = byInstrument.get(row.instrumentId) || {
        instrumentId: row.instrumentId,
        label: row.instrumentLabel || marketLabel(row.instrumentId, row),
        hasBoard: false,
        hasSales: false,
      };
      existing.hasSales = true;
      byInstrument.set(row.instrumentId, existing);
    }

    return sortMarketsByPriority(Array.from(byInstrument.values()));
  }

  function buildExchangeSalesSummary(salesRows) {
    const rows = salesRows || [];
    const avg1d = average(rows.map(row => parseNumber(row.averages && row.averages['1d'] && row.averages['1d'].spreadPct)));
    const avg7d = average(rows.map(row => parseNumber(row.averages && row.averages['7d'] && row.averages['7d'].spreadPct)));
    const avg30d = average(rows.map(row => parseNumber(row.averages && row.averages['30d'] && row.averages['30d'].spreadPct)));
    const ranked = rows
      .map(row => ({
        instrumentId: row.instrumentId,
        label: row.instrumentLabel || marketLabel(row.instrumentId, row),
        spreadPct: pickSpreadPct(row),
      }))
      .filter(row => row.spreadPct != null)
      .sort((a, b) => a.spreadPct - b.spreadPct);

    return {
      marketCount: rows.length,
      avg1d,
      avg7d,
      avg30d,
      tightest: ranked[0] || null,
      widest: ranked[ranked.length - 1] || null,
      summary: spreadTrendSummary(avg1d, avg7d, rows.length),
    };
  }

  function buildExchangeVolumeSummary(exchangeId) {
    const share = volumeShareStore && typeof volumeShareStore.getShare === 'function'
      ? volumeShareStore.getShare('1d')
      : { exchanges: [], rows: [], meta: {} };
    const exchangeShare = (share.exchanges || []).find(row => row.exchangeId === exchangeId) || null;
    const rows = (share.rows || [])
      .filter(row => row.exchangeId === exchangeId)
      .map(row => ({
        ...row,
        quoteVolume: parseNumber(row.quoteVolume),
      }))
      .filter(row => row.quoteVolume != null)
      .sort((a, b) => b.quoteVolume - a.quoteVolume);

    return {
      exchangeShare,
      rows,
      latestCapturedAt: share.meta && share.meta.latestCapturedAt ? share.meta.latestCapturedAt : null,
    };
  }

  function buildMarketMetrics() {
    const volumeShare = volumeShareStore && typeof volumeShareStore.getShare === 'function'
      ? volumeShareStore.getShare('1d')
      : { instruments: [], rows: [] };
    const salesReport = salesSpreadStore && typeof salesSpreadStore.getReport === 'function'
      ? salesSpreadStore.getReport()
      : { rows: [] };
    const topVolumeByInstrument = new Map();
    const instrumentVolumeById = new Map();
    const bestSpreadByInstrument = new Map();

    for (const row of volumeShare.rows || []) {
      const quoteVolume = parseNumber(row.quoteVolume);
      if (quoteVolume == null) continue;
      const existing = topVolumeByInstrument.get(row.instrumentId);
      if (!existing || quoteVolume > existing.quoteVolume) {
        topVolumeByInstrument.set(row.instrumentId, {
          exchangeId: row.exchangeId,
          exchangeLabel: row.exchangeLabel,
          quoteVolume,
        });
      }
    }

    for (const row of volumeShare.instruments || []) {
      instrumentVolumeById.set(row.instrumentId, {
        quoteVolume: parseNumber(row.quoteVolume) || 0,
      });
    }

    for (const row of salesReport.rows || []) {
      const spreadPct = pickSpreadPct(row);
      if (spreadPct == null) continue;
      const existing = bestSpreadByInstrument.get(row.instrumentId);
      if (!existing || spreadPct < existing.spreadPct) {
        bestSpreadByInstrument.set(row.instrumentId, {
          exchangeId: row.exchangeId,
          exchangeLabel: row.exchangeLabel,
          spreadPct,
        });
      }
    }

    return {
      topVolumeByInstrument,
      instrumentVolumeById,
      bestSpreadByInstrument,
    };
  }

  function buildMarketTags(market) {
    const baseCurrency = String(market.baseCurrency || '').toUpperCase();
    const tags = [];

    if (FEATURED_MARKET_IDS.includes(market.instrumentId)) tags.push('featured');
    if (MEME_BASE_CURRENCIES.has(baseCurrency)) tags.push('meme');
    if (STABLE_BASE_CURRENCIES.has(baseCurrency)) tags.push('stable');
    if (market.exchangeCount === 1) tags.push('single-exchange');
    if (market.exchangeCount >= 3) tags.push('many-exchanges');
    if (
      !FEATURED_MARKET_IDS.includes(market.instrumentId)
      && !MEME_BASE_CURRENCIES.has(baseCurrency)
      && !STABLE_BASE_CURRENCIES.has(baseCurrency)
      && !['BTC', 'WBTC'].includes(baseCurrency)
    ) {
      tags.push('alt');
    }

    return tags;
  }

  function buildMarketSummaryLine(market) {
    return [
      `${market.exchangeCount}社対応`,
      market.hasOrderbook ? '板あり' : '板データ待ち',
      market.hasSales ? '販売所あり' : '販売所データなし',
    ].join('｜');
  }

  function buildMarketCategories(markets) {
    const byInstrumentId = new Map(markets.map(market => [market.instrumentId, market]));
    const byExchangeCount = [...markets].sort((a, b) => {
      if (b.exchangeCount !== a.exchangeCount) return b.exchangeCount - a.exchangeCount;
      return a.instrumentId.localeCompare(b.instrumentId);
    });
    const byVolume = [...markets]
      .filter(market => market.instrumentTotalQuoteVolume > 0)
      .sort((a, b) => {
        if (b.instrumentTotalQuoteVolume !== a.instrumentTotalQuoteVolume) {
          return b.instrumentTotalQuoteVolume - a.instrumentTotalQuoteVolume;
        }
        return a.instrumentId.localeCompare(b.instrumentId);
      });
    const byWideSpread = [...markets]
      .filter(market => market.bestSpreadPct != null)
      .sort((a, b) => {
        if (b.bestSpreadPct !== a.bestSpreadPct) return b.bestSpreadPct - a.bestSpreadPct;
        return a.instrumentId.localeCompare(b.instrumentId);
      });
    const sortByCoverageThenVolume = (a, b) => {
      if (b.exchangeCount !== a.exchangeCount) return b.exchangeCount - a.exchangeCount;
      if (b.instrumentTotalQuoteVolume !== a.instrumentTotalQuoteVolume) {
        return b.instrumentTotalQuoteVolume - a.instrumentTotalQuoteVolume;
      }
      return a.instrumentId.localeCompare(b.instrumentId);
    };

    const categories = [
      {
        key: 'featured',
        title: '主要銘柄',
        description: '比較の起点にしやすい主要銘柄です。まずは国内対応数と実効コストの傾向をまとめて確認できます。',
        markets: FEATURED_MARKET_IDS.map(instrumentId => byInstrumentId.get(instrumentId)).filter(Boolean),
      },
      {
        key: 'many-exchanges',
        title: '取扱取引所が多い銘柄',
        description: '国内で複数社比較しやすい銘柄です。販売所スプレッドだけでなく板の厚みも見比べやすくなります。',
        markets: byExchangeCount.filter(market => market.exchangeCount >= 3).slice(0, 12),
      },
      {
        key: 'single-exchange',
        title: '1社のみで買える銘柄',
        description: '比較先が少ないぶん、同一取引所内で板・販売所・手数料を丁寧に確認したい銘柄です。',
        markets: [...markets]
          .filter(market => market.exchangeCount === 1)
          .sort((a, b) => a.instrumentId.localeCompare(b.instrumentId))
          .slice(0, 12),
      },
      {
        key: 'altcoins',
        title: 'アルトコイン',
        description: '主要銘柄以外で国内比較しやすいアルトコインをまとめています。',
        markets: [...markets]
          .filter(market => market.tags.includes('alt'))
          .sort(sortByCoverageThenVolume)
          .slice(0, 16),
      },
      {
        key: 'meme',
        title: 'ミームコイン',
        description: '値動きと販売所スプレッドが大きくなりやすい銘柄です。購入前のコスト確認が特に重要です。',
        markets: [...markets]
          .filter(market => market.tags.includes('meme'))
          .sort(sortByCoverageThenVolume)
          .slice(0, 8),
      },
      {
        key: 'stable',
        title: 'ステーブルコイン',
        description: '価格連動型の銘柄でも、国内での取扱数や販売所スプレッドには差があります。',
        markets: [...markets]
          .filter(market => market.tags.includes('stable'))
          .sort(sortByCoverageThenVolume)
          .slice(0, 8),
      },
      {
        key: 'high-volume',
        title: '出来高が多い銘柄',
        description: '24時間出来高が大きく、流動性の参考にしやすい銘柄です。',
        markets: byVolume.slice(0, 10),
      },
      {
        key: 'wide-spread',
        title: 'スプレッドが広い銘柄',
        description: '販売所の最小スプレッドでも実効コストが重くなりやすい銘柄です。',
        markets: byWideSpread.slice(0, 10),
      },
    ];

    return categories
      .filter(category => category.markets.length > 0)
      .map(category => ({
        ...category,
        anchorId: `market-category-${category.key}`,
        count: category.markets.length,
      }));
  }

  function exchangeFeeLabel(exchange, defaultText = '各銘柄の既定値を確認') {
    if (exchange && exchange.takerFeeRate != null && Number.isFinite(Number(exchange.takerFeeRate))) {
      const pct = Number(exchange.takerFeeRate) * 100;
      const digits = pct < 0.1 ? 3 : 2;
      const note = exchange.takerFeeNote ? ` (${exchange.takerFeeNote})` : '';
      return `${Number(pct.toFixed(digits))}%${note}`;
    }
    return defaultText;
  }

  function buildMarketPageModel(market) {
    const metrics = buildMarketMetrics();
    const topVolume = metrics.topVolumeByInstrument.get(market.instrumentId) || null;
    const instrumentVolume = metrics.instrumentVolumeById.get(market.instrumentId) || null;
    const bestSpread = metrics.bestSpreadByInstrument.get(market.instrumentId) || null;

    const supportedExchanges = market.exchanges.map((exchange) => {
      const exchangeInfo = getExchangeInfo(exchange.id);
      return {
        id: exchange.id,
        label: exchange.label,
        fullName: exchange.fullName,
        path: exchangeInfo ? exchangeInfo.path : exchangePath(exchange.id),
        feeLabel: exchangeInfo ? exchangeInfo.feeLabel : '各銘柄の既定値を確認',
        marketCount: exchangeInfo ? exchangeInfo.marketCount : 0,
      };
    });

    const enriched = {
      ...market,
      exchangeCount: market.exchanges.length,
      exchangeLabels: market.exchanges.map(exchange => exchange.label),
      supportedExchanges,
      hasOrderbook: market.exchanges.length > 0,
      hasSales: Boolean(bestSpread),
      topVolumeExchangeLabel: topVolume ? topVolume.exchangeLabel : null,
      instrumentTotalQuoteVolume: instrumentVolume ? instrumentVolume.quoteVolume : 0,
      bestSpreadExchangeLabel: bestSpread ? bestSpread.exchangeLabel : null,
      bestSpreadPct: bestSpread ? bestSpread.spreadPct : null,
    };

    return {
      ...enriched,
      tags: buildMarketTags(enriched),
      summaryLine: buildMarketSummaryLine(enriched),
    };
  }

  function buildMarketOverviewContent(market) {
    const assetName = market.baseCurrency || market.label;
    const lead = market.exchangeCount >= 5
      ? `${assetName} は国内取引所で比較しやすい主要暗号資産の一つです。`
      : market.exchangeCount >= 2
        ? `${assetName} は国内で複数社を比較できる暗号資産です。`
        : `${assetName} は国内では対応取引所が限られる暗号資産です。`;
    const detailParts = [
      `${market.label} の実効コストは、取引所・販売所・注文サイズによって変わります。`,
      market.topVolumeExchangeLabel
        ? `出来高は ${market.topVolumeExchangeLabel} を起点に見やすい一方で、`
        : '',
      market.bestSpreadExchangeLabel
        ? `販売所スプレッドは ${market.bestSpreadExchangeLabel} が相対的に狭い参考値です。`
        : '販売所スプレッドは取引所ごとの差が出やすいため、注文前に確認しておきたい項目です。',
    ].join('');

    return {
      lead,
      detail: detailParts,
      checks: [
        '取引所で買えるか、販売所のみか',
        'スプレッドが広すぎないか',
        '10万円前後の注文サイズに対して板が十分厚いか',
      ],
    };
  }

  function buildMarketSnapshotMetrics(market, snapshot) {
    const boardFreshnessText = snapshot && snapshot.boardFreshness === 'stale'
      ? '現在は stale 板を含む参考値です'
      : '板は fresh データを優先して集計しています';
    const amountText = snapshot && snapshot.comparisonAmount && Number.isFinite(Number(snapshot.comparisonAmount.amount))
      ? `${formatJpyPrice(snapshot.comparisonAmount.amount)}買い / 各取引所既定 taker`
      : '10万円買い / 各取引所既定 taker';

    return {
      assumption: `${amountText} / ${boardFreshnessText}`,
      items: [
        {
          key: 'exchange-count',
          label: '対応取引所',
          value: `${formatCount(snapshot && snapshot.exchangeCount != null ? snapshot.exchangeCount : market.exchangeCount)}社`,
          meta: '国内現物の対応数',
        },
        {
          key: 'best-ask',
          label: '最良Ask',
          value: snapshot && snapshot.bestAsk ? formatJpyPrice(snapshot.bestAsk.price) : 'データ待ち',
          meta: snapshot && snapshot.bestAsk ? snapshot.bestAsk.exchangeLabel : '板データ待ち',
        },
        {
          key: 'best-bid',
          label: '最良Bid',
          value: snapshot && snapshot.bestBid ? formatJpyPrice(snapshot.bestBid.price) : 'データ待ち',
          meta: snapshot && snapshot.bestBid ? snapshot.bestBid.exchangeLabel : '板データ待ち',
        },
        {
          key: 'thickest-book',
          label: '板が厚い取引所',
          value: snapshot && snapshot.thickestBook ? snapshot.thickestBook.exchangeLabel : 'データ待ち',
          meta: snapshot && snapshot.thickestBook ? `可視板厚 ${formatJpyCompact(snapshot.thickestBook.visibleDepthJPY)}` : 'Bid + Ask 可視深さ',
        },
        {
          key: 'cheapest-buy',
          label: '10万円購入時の最安候補',
          value: snapshot && snapshot.cheapestBuy ? snapshot.cheapestBuy.exchangeLabel : 'データ待ち',
          meta: snapshot && snapshot.cheapestBuy
            ? `${snapshot.cheapestBuy.executionStatusLabel || '参考値'} / 実効VWAP ${formatJpyPrice(snapshot.cheapestBuy.effectiveVWAP)}`
            : '買い / 100,000円 / 既定手数料',
        },
        {
          key: 'tightest-sales',
          label: '販売所スプレッド最小',
          value: snapshot && snapshot.tightestSalesSpread ? snapshot.tightestSalesSpread.exchangeLabel : 'データ待ち',
          meta: snapshot && snapshot.tightestSalesSpread ? formatPct(snapshot.tightestSalesSpread.spreadPct) : '販売所データ待ち',
        },
        {
          key: 'top-volume',
          label: '出来高首位',
          value: snapshot && snapshot.topVolume ? snapshot.topVolume.exchangeLabel : 'データ待ち',
          meta: snapshot && snapshot.topVolume ? `24h出来高 ${formatJpyCompact(snapshot.topVolume.quoteVolume)}` : '出来高データ待ち',
        },
      ],
    };
  }

  function renderMarketOverviewCard(market) {
    const overview = buildMarketOverviewContent(market);

    return [
      '<article class="market-insight-card market-insight-card--overview">',
      '  <div class="market-insight-card__header">',
      '    <div>',
      '      <p class="market-insight-card__eyebrow">Overview</p>',
      `      <h3 class="market-insight-card__title">${xmlEscape(market.label)} の要点</h3>`,
      '    </div>',
      `    <span class="market-insight-card__badge">${xmlEscape(`${market.exchangeCount}社対応`)}</span>`,
      '  </div>',
      `  <p class="market-insight-card__lead">${xmlEscape(overview.lead)}</p>`,
      `  <p class="market-insight-card__copy">${xmlEscape(overview.detail)}</p>`,
      '  <div class="market-insight-card__chips">',
      `    <span>${xmlEscape(`${market.exchangeCount}社対応`)}</span>`,
      `    <span>${xmlEscape(market.topVolumeExchangeLabel ? `出来高首位 ${market.topVolumeExchangeLabel}` : '出来高データ待ち')}</span>`,
      `    <span>${xmlEscape(market.bestSpreadExchangeLabel ? `販売所最小 ${market.bestSpreadExchangeLabel}` : '販売所データ待ち')}</span>`,
      '  </div>',
      '  <div class="market-insight-card__block">',
      '    <h4 class="market-insight-card__subtitle">買う前に見るべき3点</h4>',
      '    <ol class="market-insight-checklist">',
      overview.checks.map((item) => `      <li>${xmlEscape(item)}</li>`).join('\n'),
      '    </ol>',
      '  </div>',
      '</article>',
    ].join('\n');
  }

  function renderMarketComparisonSummaryCard(market, snapshot) {
    const summary = buildMarketSnapshotMetrics(market, snapshot);
    return [
      '<article class="market-insight-card market-insight-card--summary">',
      '  <div class="market-insight-card__header">',
      '    <div>',
      '      <p class="market-insight-card__eyebrow">Snapshot</p>',
      `      <h3 id="market-summary-title" class="market-insight-card__title">${xmlEscape(`${market.label} 比較サマリー`)}</h3>`,
      '    </div>',
      '    <span class="market-insight-card__badge">SEO 主力導線</span>',
      '  </div>',
      `  <p id="market-summary-assumption" class="market-insight-card__copy">${xmlEscape(summary.assumption)}</p>`,
      '  <dl class="market-summary-grid">',
      summary.items.map((item) => [
        '    <div class="market-summary-stat">',
        `      <dt>${xmlEscape(item.label)}</dt>`,
        `      <dd id="market-summary-${xmlEscape(item.key)}">${xmlEscape(item.value)}</dd>`,
        `      <div id="market-summary-${xmlEscape(item.key)}-meta" class="market-summary-stat__meta">${xmlEscape(item.meta)}</div>`,
        '    </div>',
      ].join('\n')).join('\n'),
      '  </dl>',
      '  <p class="market-insight-card__note">板が厚い取引所は公開板の Bid + Ask 可視深さを JPY 換算した参考値です。10万円購入時の最安候補は各取引所の既定 taker 手数料を含む買い比較です。</p>',
      '</article>',
    ].join('\n');
  }

  function getMarketInfo(instrumentId) {
    const normalizedInstrumentId = normalizeMarketInstrumentId(instrumentId);
    if (!normalizedInstrumentId) return null;

    const exchanges = [];
    let firstMarket = null;

    for (const exchange of getPublicExchanges()) {
      const market = (exchange.markets || []).find(item => (
        item.instrumentId === normalizedInstrumentId && (!item.status || item.status === 'active')
      ));
      if (!market) continue;
      if (!firstMarket) firstMarket = market;
      exchanges.push({
        id: exchange.id,
        label: exchange.label || exchange.id,
        fullName: exchange.fullName || exchange.label || exchange.id,
        dataSourceLabel: exchange.dataSourceLabel || '',
        market,
      });
    }

    if (exchanges.length === 0 || !firstMarket) return null;

    return {
      instrumentId: normalizedInstrumentId,
      label: marketLabel(normalizedInstrumentId, firstMarket),
      baseCurrency: firstMarket.baseCurrency || normalizedInstrumentId.split('-')[0],
      quoteCurrency: firstMarket.quoteCurrency || normalizedInstrumentId.split('-')[1] || 'JPY',
      exchanges,
    };
  }

  function getExchangeInfo(exchangeId) {
    const normalizedExchangeId = normalizeExchangeId(exchangeId);
    if (!normalizedExchangeId) return null;

    const exchange = getPublicExchanges().find(item => item.id === normalizedExchangeId && (!item.status || item.status === 'active'));
    if (!exchange) return null;
    const pageContent = getExchangePageContent(exchange.id) || {};
    const markets = sortMarketsByPriority((exchange.markets || [])
      .filter(market => market && market.instrumentId && (!market.status || market.status === 'active'))
      .map(market => ({
        ...market,
        label: marketLabel(market.instrumentId, market),
      })));

    const defaultMarket = markets.find(market => market.instrumentId === exchange.defaultInstrumentId)
      || markets[0]
      || {
        instrumentId: exchange.defaultInstrumentId || 'BTC-JPY',
        label: marketLabel(exchange.defaultInstrumentId || 'BTC-JPY'),
      };

    return {
      ...exchange,
      path: exchangePath(exchange.id),
      pageSlug: exchangePageSlug(exchange.id),
      pageContent,
      markets,
      marketCount: markets.length,
      defaultMarket,
      feeLabel: exchangeFeeLabel(exchange),
    };
  }

  function sortMarketsForIndex(markets) {
    const featuredRank = new Map([
      ['BTC-JPY', 0],
      ['ETH-JPY', 1],
      ['XRP-JPY', 2],
      ['SOL-JPY', 3],
    ]);

    return markets.sort((a, b) => {
      const aRank = featuredRank.has(a.instrumentId) ? featuredRank.get(a.instrumentId) : 100;
      const bRank = featuredRank.has(b.instrumentId) ? featuredRank.get(b.instrumentId) : 100;
      if (aRank !== bRank) return aRank - bRank;
      if (b.exchangeCount !== a.exchangeCount) return b.exchangeCount - a.exchangeCount;
      return a.instrumentId.localeCompare(b.instrumentId);
    });
  }

  function buildMarketIndexModel() {
    const publicExchanges = getPublicExchanges().filter(exchange => !exchange.status || exchange.status === 'active');
    const byInstrument = new Map();
    const metrics = buildMarketMetrics();

    for (const exchange of publicExchanges) {
      for (const market of exchange.markets || []) {
        if (!market.instrumentId || (market.status && market.status !== 'active')) continue;
        const instrumentId = normalizeMarketInstrumentId(market.instrumentId);
        if (!instrumentId) continue;

        if (!byInstrument.has(instrumentId)) {
          byInstrument.set(instrumentId, {
            instrumentId,
            label: marketLabel(instrumentId, market),
            baseCurrency: market.baseCurrency || instrumentId.split('-')[0],
            quoteCurrency: market.quoteCurrency || instrumentId.split('-')[1] || 'JPY',
            path: marketPath(instrumentId),
            exchanges: [],
          });
        }

        byInstrument.get(instrumentId).exchanges.push({
          id: exchange.id,
          label: exchange.label || exchange.id,
          fullName: exchange.fullName || exchange.label || exchange.id,
        });
      }
    }

    const markets = sortMarketsForIndex(Array.from(byInstrument.values()).map((market) => {
      const exchangeCount = market.exchanges.length;
      const topVolume = metrics.topVolumeByInstrument.get(market.instrumentId) || null;
      const instrumentVolume = metrics.instrumentVolumeById.get(market.instrumentId) || null;
      const bestSpread = metrics.bestSpreadByInstrument.get(market.instrumentId) || null;
      const enriched = {
        ...market,
        exchangeCount,
        exchangeLabels: market.exchanges.map(exchange => exchange.label),
        hasOrderbook: exchangeCount > 0,
        hasSales: Boolean(bestSpread),
        topVolumeExchangeLabel: topVolume ? topVolume.exchangeLabel : null,
        instrumentTotalQuoteVolume: instrumentVolume ? instrumentVolume.quoteVolume : 0,
        bestSpreadExchangeLabel: bestSpread ? bestSpread.exchangeLabel : null,
        bestSpreadPct: bestSpread ? bestSpread.spreadPct : null,
      };
      const tags = buildMarketTags(enriched);
      return {
        ...enriched,
        tags,
        summaryLine: buildMarketSummaryLine(enriched),
      };
    }));
    const categories = buildMarketCategories(markets);

    return {
      meta: {
        generatedAt: new Date().toISOString(),
        marketCount: markets.length,
        exchangeCount: publicExchanges.length,
        categoryCount: categories.length,
      },
      exchanges: publicExchanges.map(exchange => ({
        id: exchange.id,
        label: exchange.label || exchange.id,
      })),
      categories,
      markets,
    };
  }

  function buildMarketSitemapPages() {
    const lastmod = fileLastmod(path.join(publicDir, 'market.html'));
    return buildMarketIndexModel().markets
      .map(market => ({
        path: market.path,
        lastmod,
        priority: market.instrumentId === 'BTC-JPY' || market.instrumentId === 'ETH-JPY' ? '0.7' : '0.6',
      }));
  }

  function buildExchangeSitemapPages() {
    const lastmod = fileLastmod(path.join(publicDir, 'exchange.html'));
    return getPublicExchanges()
      .filter(exchange => !exchange.status || exchange.status === 'active')
      .map(exchange => ({
        path: exchangePath(exchange.id),
        lastmod,
        priority: exchange.id === 'okj' ? '0.7' : '0.6',
      }));
  }

  function buildCampaignSitemapPages() {
    const lastmod = fileLastmod(path.join(publicDir, 'campaign.html'));
    return listCampaigns()
      .map(campaign => ({
        path: campaign.path || campaignPath(campaign),
        lastmod,
        priority: '0.6',
      }));
  }

  function rssDate(value, fallback = new Date()) {
    const date = new Date(value || fallback);
    if (Number.isNaN(date.getTime())) return new Date(fallback).toUTCString();
    return date.toUTCString();
  }

  function buildSitemapXml(origin) {
    const pages = sitemapPages
      .concat(buildMarketSitemapPages())
      .concat(buildExchangeSitemapPages())
      .concat(buildCampaignSitemapPages())
      .concat(listArticles().map(article => ({
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
      `    <title>${SITE_NAME}</title>`,
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
        name: SITE_NAME,
      },
    };
  }

  function campaignStructuredData(campaigns, origin, description) {
    const pageUrl = siteUrl(origin, '/campaigns');
    return [
      {
        '@context': 'https://schema.org',
        '@type': 'WebPage',
        name: 'キャンペーン一覧',
        url: pageUrl,
        description,
        inLanguage: 'ja-JP',
        isPartOf: {
          '@type': 'WebSite',
          name: SITE_NAME,
          url: origin,
        },
      },
      {
        '@context': 'https://schema.org',
        '@type': 'ItemList',
        name: '国内暗号資産取引所キャンペーン一覧',
        url: pageUrl,
        itemListElement: campaigns.map((campaign, index) => ({
          '@type': 'ListItem',
          position: index + 1,
          name: `${campaign.exchangeName} ${campaign.campaignName}`,
          url: siteUrl(origin, campaign.path || campaignPath(campaign)),
        })),
      },
    ];
  }

  function campaignDetailStructuredData(campaign, exchange, origin, description) {
    const url = siteUrl(origin, campaign.path || campaignPath(campaign));
    return [
      {
        '@context': 'https://schema.org',
        '@type': 'WebPage',
        name: `${campaign.exchangeName} キャンペーン詳細`,
        url,
        description,
        inLanguage: 'ja-JP',
        isPartOf: {
          '@type': 'WebSite',
          name: SITE_NAME,
          url: origin,
        },
        about: {
          '@type': 'Organization',
          name: campaign.exchangeName,
          url: campaign.officialUrl,
        },
      },
      {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
          {
            '@type': 'ListItem',
            position: 1,
            name: SITE_NAME,
            item: siteUrl(origin, '/'),
          },
          {
            '@type': 'ListItem',
            position: 2,
            name: 'キャンペーン一覧',
            item: siteUrl(origin, '/campaigns'),
          },
          {
            '@type': 'ListItem',
            position: 3,
            name: exchange ? `${exchange.label} キャンペーン` : `${campaign.exchangeName} キャンペーン`,
            item: url,
          },
        ],
      },
    ];
  }

  function renderCampaignActionLink(campaign) {
    if (!campaign.affiliateUrl) {
      return '<span class="campaign-link-status">紹介リンク未設定</span>';
    }

    return [
      `<a class="campaign-affiliate-link" href="${xmlEscape(campaign.affiliateUrl)}" target="_blank" rel="sponsored noopener">`,
      '  紹介リンクを開く',
      '</a>',
    ].join('\n');
  }

  function renderCampaignNotes(campaign) {
    return (campaign.notes || [])
      .map(note => `<li>${xmlEscape(note)}</li>`)
      .join('');
  }

  function renderCampaignCards(campaigns) {
    return campaigns.map((campaign) => [
      '<article class="campaign-card">',
      '  <div class="campaign-card__header">',
      '    <div>',
      `      <span class="campaign-card__exchange">${xmlEscape(campaign.exchangeName)}</span>`,
      `      <h3 class="campaign-card__title">${xmlEscape(campaign.campaignName)}</h3>`,
      '    </div>',
      `    <span class="decision-summary-badge">${xmlEscape(campaign.lastChecked)}</span>`,
      '  </div>',
      '  <dl class="campaign-card__facts">',
      `    <div><dt>特典</dt><dd>${xmlEscape(campaign.benefit)}</dd></div>`,
      `    <div><dt>対象者</dt><dd>${xmlEscape(campaign.audience)}</dd></div>`,
      `    <div><dt>条件</dt><dd>${xmlEscape(campaign.conditions)}</dd></div>`,
      `    <div><dt>期間</dt><dd>${xmlEscape(campaign.period)}</dd></div>`,
      '  </dl>',
      '  <details class="campaign-details">',
      '    <summary>詳細を見る</summary>',
      '    <div class="campaign-details__body">',
      '      <dl class="campaign-details__links">',
      `        <div><dt>公式URL</dt><dd><a href="${xmlEscape(campaign.officialUrl)}" target="_blank" rel="noopener">${xmlEscape(campaign.officialUrl)}</a></dd></div>`,
      `        <div><dt>紹介リンク/アフィリエイトリンク</dt><dd>${renderCampaignActionLink(campaign)}</dd></div>`,
      `        <div><dt>最終確認日</dt><dd>${xmlEscape(campaign.lastChecked)}</dd></div>`,
      '      </dl>',
      `      <ul class="campaign-note-list">${renderCampaignNotes(campaign)}</ul>`,
      '    </div>',
      '  </details>',
      '  <div class="campaign-card__actions">',
      `    <a class="btn btn-secondary px-4 py-3 rounded-lg font-bold text-sm" href="${xmlEscape(campaign.path || campaignPath(campaign))}">詳細ページ</a>`,
      `    <a class="btn btn-secondary px-4 py-3 rounded-lg font-bold text-sm" href="${xmlEscape(campaign.officialUrl)}" target="_blank" rel="noopener">公式URL</a>`,
      campaign.affiliateUrl
        ? `    <a class="btn btn-primary px-4 py-3 rounded-lg font-bold text-sm" href="${xmlEscape(campaign.affiliateUrl)}" target="_blank" rel="sponsored noopener">紹介リンク</a>`
        : '    <span class="campaign-card__empty-link">紹介リンク未設定</span>',
      '  </div>',
      '</article>',
    ].join('\n')).join('\n');
  }

  function renderCampaignRows(campaigns) {
    return campaigns.map((campaign) => [
      '<tr>',
      `  <td data-label="取引所名">${xmlEscape(campaign.exchangeName)}</td>`,
      `  <td data-label="キャンペーン名">${xmlEscape(campaign.campaignName)}</td>`,
      `  <td data-label="特典額">${xmlEscape(campaign.benefit)}</td>`,
      `  <td data-label="対象者">${xmlEscape(campaign.audience)}</td>`,
      `  <td data-label="条件">${xmlEscape(campaign.conditions)}</td>`,
      `  <td data-label="期間">${xmlEscape(campaign.period)}</td>`,
      `  <td data-label="公式URL"><a class="table-link" href="${xmlEscape(campaign.officialUrl)}" target="_blank" rel="noopener">公式URL</a></td>`,
      `  <td data-label="紹介リンク/アフィリエイトリンク">${renderCampaignActionLink(campaign)}</td>`,
      `  <td data-label="最終確認日">${xmlEscape(campaign.lastChecked)}</td>`,
      `  <td data-label="注意事項">${xmlEscape((campaign.notes || [])[0] || '公式条件を確認してください。')}</td>`,
      '</tr>',
    ].join('\n')).join('\n');
  }

  function renderCampaignsHtml(req) {
    const origin = requestOrigin(req);
    const campaigns = listCampaigns();
    const template = fs.readFileSync(path.join(publicDir, 'campaigns.html'), 'utf8');
    const title = `暗号資産取引所キャンペーン一覧｜${SITE_NAME}`;
    const description = '国内暗号資産取引所のキャンペーン、特典額、対象者、条件、期間、公式URL、紹介リンクを一覧で確認できます。キャンペーン条件は変わるため、申込前に公式ページを確認してください。';
    const affiliateCount = campaigns.filter(campaign => campaign.affiliateUrl).length;

    return template
      .replace(HEAD_META_INJECT, renderHeadMeta({
        title,
        description,
        canonical: '/campaigns',
        ogImage: '/ogp/default.png',
        pageId: 'campaigns',
        includeDefaultJsonLd: false,
        structuredData: campaignStructuredData(campaigns, origin, description),
        siteOrigin: origin,
      }))
      .replaceAll('__CAMPAIGN_COUNT__', String(campaigns.length))
      .replaceAll('__AFFILIATE_COUNT__', String(affiliateCount))
      .replace('<!-- CAMPAIGN_CARDS -->', renderCampaignCards(campaigns))
      .replace('<!-- CAMPAIGN_ROWS -->', renderCampaignRows(campaigns));
  }

  function getCampaignInfo(slug) {
    return getCampaign(slug);
  }

  function buildCampaignPageModel(campaign) {
    const exchange = campaign.exchangeId ? getExchangeInfo(campaign.exchangeId) : null;
    const pageExchange = exchange ? buildExchangePageModel(exchange) : null;
    const defaultMarket = pageExchange && pageExchange.defaultMarket
      ? pageExchange.defaultMarket
      : {
        instrumentId: 'BTC-JPY',
        label: 'BTC/JPY',
      };

    return {
      ...campaign,
      exchange,
      pageExchange,
      defaultMarket,
      feeLabel: pageExchange ? pageExchange.feeLabel : '公式確認',
      marketCount: pageExchange ? pageExchange.coverage.length : 0,
    };
  }

  function renderCampaignDetailNotes(campaign) {
    const notes = (campaign.notes || []).slice();
    notes.push('紹介リンクやアフィリエイトリンクを使う場合も、公式URLの条件を優先してください。');
    notes.push('キャンペーン特典よりも通常時の手数料、販売所スプレッド、板の厚みを先に確認すると判断しやすくなります。');
    return notes.map(note => `<li>${xmlEscape(note)}</li>`).join('\n');
  }

  function renderCampaignContextCards(cards) {
    return cards.map((card) => {
      const attrs = [
        `class="market-context-card"`,
        card.href ? `href="${xmlEscape(card.href)}"` : '',
        card.target ? `target="${xmlEscape(card.target)}"` : '',
        card.rel ? `rel="${xmlEscape(card.rel)}"` : '',
      ].filter(Boolean).join(' ');
      const tag = card.href ? 'a' : 'article';
      return [
        `<${tag} ${attrs}>`,
        `  <span class="market-context-card__eyebrow">${xmlEscape(card.eyebrow)}</span>`,
        `  <strong class="market-context-card__title">${xmlEscape(card.title)}</strong>`,
        `  <span class="market-context-card__description">${xmlEscape(card.description)}</span>`,
        `  <span class="market-context-card__cta">${xmlEscape(card.cta)}</span>`,
        `</${tag}>`,
      ].join('\n');
    }).join('\n');
  }

  function renderCampaignCostCards(model) {
    if (model.pageExchange) {
      return renderExchangeCostCards(model.pageExchange);
    }

    const cards = [
      {
        title: '手数料',
        description: '取引手数料は会員区分、注文方法、キャンペーン適用有無で変わる場合があります。',
      },
      {
        title: '販売所スプレッド',
        description: '販売所を使う場合は、買値と売値の差が実質コストになります。注文前に比較しましょう。',
      },
      {
        title: '板の厚み',
        description: '板取引では、注文サイズに対して十分な数量が並んでいるかを確認してください。',
      },
      {
        title: '出来高',
        description: '出来高は流動性の参考になりますが、実際の約定価格を保証するものではありません。',
      },
    ];

    return cards.map(card => [
      '<article class="market-definition-card">',
      `  <h3 class="market-definition-card__term">${xmlEscape(card.title)}</h3>`,
      `  <p class="market-definition-card__description">${xmlEscape(card.description)}</p>`,
      '</article>',
    ].join('\n')).join('\n');
  }

  function renderCampaignMarketLinks(model) {
    if (model.pageExchange) {
      return renderExchangeMarketLinks(model.pageExchange);
    }
    return '<p class="text-center text-gray-500 py-8">取扱銘柄データを準備中です</p>';
  }

  function renderCampaignSimulatorLinks(model) {
    const exchangeId = model.pageExchange ? model.pageExchange.id : null;
    const market = model.defaultMarket;
    const cards = [
      {
        eyebrow: 'Simulator',
        title: `${model.exchangeName} の板を確認する`,
        description: `${market.label || market.instrumentId} を選んだ状態で、成行注文の想定コストを見ます。`,
        href: queryPath('/simulator', { exchange: exchangeId, market: market.instrumentId }),
        cta: 'シミュレーターへ',
      },
      {
        eyebrow: 'Market',
        title: `${market.label || market.instrumentId} の横比較を見る`,
        description: '他の国内取引所と、板・出来高・販売所スプレッドを同じ銘柄で比較します。',
        href: marketPath(market.instrumentId),
        cta: '銘柄ページへ',
      },
      {
        eyebrow: 'Sales Spread',
        title: '販売所スプレッドを見る',
        description: '販売所で買う場合は、特典より先に買値と売値の差を確認してください。',
        href: queryPath('/sales-spread', { instrumentId: market.instrumentId }),
        cta: 'スプレッド比較へ',
      },
    ];
    return renderCampaignContextCards(cards);
  }

  function renderCampaignLinkCards(model) {
    const cards = [
      {
        eyebrow: 'Official',
        title: '公式キャンペーンページ',
        description: '特典額、対象者、条件、期間、付与時期、除外条件の一次情報を確認します。',
        href: model.officialUrl,
        target: '_blank',
        rel: 'noopener',
        cta: '公式URLを開く',
      },
    ];

    if (model.affiliateUrl) {
      cards.push({
        eyebrow: 'PR',
        title: '紹介リンク',
        description: '紹介経由の条件がある場合は、公式条件とあわせて確認してください。',
        href: model.affiliateUrl,
        target: '_blank',
        rel: 'sponsored noopener',
        cta: '紹介リンクを開く',
      });
    } else {
      cards.push({
        eyebrow: 'PR',
        title: '紹介リンク未設定',
        description: '紹介リンクを掲載する場合は、PR 表記と公式URLの併記を前提に差し替えます。',
        cta: '未設定',
      });
    }

    if (model.pageExchange) {
      cards.push({
        eyebrow: 'Exchange',
        title: `${model.pageExchange.label} の取引所詳細`,
        description: '手数料、取扱銘柄、板取引対応、販売所対応を取引所単位で確認できます。',
        href: exchangePath(model.pageExchange.id),
        cta: '取引所詳細へ',
      });
    }

    return renderCampaignContextCards(cards);
  }

  function renderCampaignHtml(req, campaign) {
    const origin = requestOrigin(req);
    const template = fs.readFileSync(path.join(publicDir, 'campaign.html'), 'utf8');
    const model = buildCampaignPageModel(campaign);
    const title = `${model.exchangeName} キャンペーン詳細｜${SITE_NAME}`;
    const description = `${model.exchangeName} のキャンペーン概要、特典内容、対象者、達成条件、注意点、手数料・スプレッド・板の厚み確認導線をまとめたページです。`;

    return template
      .replace(HEAD_META_INJECT, renderHeadMeta({
        title,
        description,
        canonical: model.path || campaignPath(model),
        ogImage: '/ogp/default.png',
        pageId: 'campaigns',
        includeDefaultJsonLd: false,
        structuredData: campaignDetailStructuredData(model, model.pageExchange, origin, description),
        siteOrigin: origin,
      }))
      .replaceAll('__CAMPAIGN_EXCHANGE_NAME__', xmlEscape(model.exchangeName))
      .replaceAll('__CAMPAIGN_NAME__', xmlEscape(model.campaignName))
      .replaceAll('__CAMPAIGN_LAST_CHECKED__', xmlEscape(model.lastChecked))
      .replaceAll('__CAMPAIGN_BENEFIT__', xmlEscape(model.benefit))
      .replaceAll('__CAMPAIGN_AUDIENCE__', xmlEscape(model.audience))
      .replaceAll('__CAMPAIGN_CONDITIONS__', xmlEscape(model.conditions))
      .replaceAll('__CAMPAIGN_PERIOD__', xmlEscape(model.period))
      .replaceAll('__CAMPAIGN_FEE_LABEL__', xmlEscape(model.feeLabel))
      .replaceAll('__CAMPAIGN_MARKET_COUNT__', xmlEscape(model.marketCount > 0 ? `${formatCount(model.marketCount)}件` : '確認中'))
      .replace('<!-- CAMPAIGN_NOTES -->', renderCampaignDetailNotes(model))
      .replace('<!-- CAMPAIGN_COST_CARDS -->', renderCampaignCostCards(model))
      .replace('<!-- CAMPAIGN_MARKET_LINKS -->', renderCampaignMarketLinks(model))
      .replace('<!-- CAMPAIGN_SIMULATOR_LINKS -->', renderCampaignSimulatorLinks(model))
      .replace('<!-- CAMPAIGN_LINK_CARDS -->', renderCampaignLinkCards(model));
  }

  function getArticleBySlug(slug) {
    return getArticle(slug);
  }

  function renderArticleHtml(req, article) {
    const origin = requestOrigin(req);
    const template = fs.readFileSync(path.join(publicDir, 'templates', 'article.html'), 'utf8');
    const title = `${article.title}｜${SITE_NAME}`;
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

  function marketStructuredData(market, origin, description) {
    const url = siteUrl(origin, marketPath(market.instrumentId));
    return [
      {
        '@context': 'https://schema.org',
        '@type': 'WebPage',
        name: `${market.label} 国内取引所データ`,
        url,
        description,
        inLanguage: 'ja-JP',
        about: {
          '@type': 'Thing',
          name: market.label,
          identifier: market.instrumentId,
        },
        isPartOf: {
          '@type': 'WebSite',
          name: SITE_NAME,
          url: origin,
        },
      },
      {
        '@context': 'https://schema.org',
        '@type': 'Dataset',
        name: `${market.label} 国内暗号資産取引所データ`,
        description,
        url,
        inLanguage: 'ja-JP',
        isAccessibleForFree: true,
        variableMeasured: [
          '板情報',
          '出来高シェア',
          '販売所スプレッド',
          '取引所別成行コスト',
        ].map(name => ({
          '@type': 'PropertyValue',
          name,
          valueReference: market.instrumentId,
        })),
      },
      {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
          {
            '@type': 'ListItem',
            position: 1,
            name: SITE_NAME,
            item: siteUrl(origin, '/'),
          },
          {
            '@type': 'ListItem',
            position: 2,
            name: '銘柄ページ',
            item: siteUrl(origin, marketIndexPath()),
          },
          {
            '@type': 'ListItem',
            position: 3,
            name: market.label,
            item: url,
          },
        ],
      },
    ];
  }

  function marketIndexStructuredData(model, origin, description) {
    const url = siteUrl(origin, marketIndexPath());
    return [
      {
        '@context': 'https://schema.org',
        '@type': 'CollectionPage',
        name: '国内暗号資産 銘柄ページ一覧',
        url,
        description,
        inLanguage: 'ja-JP',
        isPartOf: {
          '@type': 'WebSite',
          name: SITE_NAME,
          url: origin,
        },
      },
      {
        '@context': 'https://schema.org',
        '@type': 'ItemList',
        name: '国内暗号資産 銘柄ページ一覧',
        numberOfItems: model.markets.length,
        itemListElement: model.markets.map((market, index) => ({
          '@type': 'ListItem',
          position: index + 1,
          name: market.label,
          url: siteUrl(origin, market.path),
        })),
      },
      {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
          {
            '@type': 'ListItem',
            position: 1,
            name: SITE_NAME,
            item: siteUrl(origin, '/'),
          },
          {
            '@type': 'ListItem',
            position: 2,
            name: '銘柄ページ',
            item: url,
          },
        ],
      },
    ];
  }

  function exchangeStructuredData(exchange, origin, description) {
    const url = siteUrl(origin, exchangePath(exchange.id));
    return [
      {
        '@context': 'https://schema.org',
        '@type': 'WebPage',
        name: `${exchange.label} 手数料・取扱銘柄ガイド`,
        url,
        description,
        inLanguage: 'ja-JP',
        isPartOf: {
          '@type': 'WebSite',
          name: SITE_NAME,
          url: origin,
        },
      },
      {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
          {
            '@type': 'ListItem',
            position: 1,
            name: SITE_NAME,
            item: siteUrl(origin, '/'),
          },
          {
            '@type': 'ListItem',
            position: 2,
            name: '取引所詳細',
            item: url,
          },
        ],
      },
    ];
  }

  function queryPath(urlPath, params = {}) {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value == null || value === '') return;
      searchParams.set(key, String(value));
    });
    const query = searchParams.toString();
    return query ? `${urlPath}?${query}` : urlPath;
  }

  function renderMarketJourneyLinks(market) {
    const links = [
      {
        eyebrow: 'Simulator',
        title: `${market.label} の板シミュレーションを見る`,
        description: 'この銘柄を選んだ状態で、成行注文の執行コストを確認します。',
        href: queryPath('/simulator', { market: market.instrumentId }),
      },
      {
        eyebrow: 'Sales Spread',
        title: `${market.label} の販売所スプレッドを見る`,
        description: '販売所の価格差と推移を、この銘柄で続けて確認できます。',
        href: queryPath('/sales-spread', { instrumentId: market.instrumentId }),
      },
      {
        eyebrow: 'Volume',
        title: `${market.label} の出来高シェアを見る`,
        description: '出来高シェアページをこの銘柄に絞った状態で開きます。',
        href: queryPath('/volume-share', { instrumentId: market.instrumentId }),
      },
      {
        eyebrow: 'Campaign',
        title: `${market.label} を扱う取引所キャンペーンを見る`,
        description: '対応取引所の詳細ページから、手数料・取扱銘柄・キャンペーン確認へ進めます。',
        href: '#market-supported-exchanges',
      },
    ];

    return links.map((link) => [
      `<a class="market-context-card" href="${xmlEscape(link.href)}">`,
      `  <span class="market-context-card__eyebrow">${xmlEscape(link.eyebrow)}</span>`,
      `  <strong class="market-context-card__title">${xmlEscape(link.title)}</strong>`,
      `  <span class="market-context-card__description">${xmlEscape(link.description)}</span>`,
      '  <span class="market-context-card__cta">開く</span>',
      '</a>',
    ].join('\n')).join('\n');
  }

  function renderMarketSupportedExchangeLinks(market) {
    return market.supportedExchanges.map((exchange) => [
      `<a class="market-context-card" href="${xmlEscape(exchange.path)}">`,
      '  <span class="market-context-card__eyebrow">Exchange</span>',
      `  <strong class="market-context-card__title">${xmlEscape(exchange.label)}</strong>`,
      `  <span class="market-context-card__description">既定 taker ${xmlEscape(exchange.feeLabel)} / ${xmlEscape(`${exchange.marketCount}銘柄`)} / 手数料・取扱銘柄・キャンペーン確認へ</span>`,
      '  <span class="market-context-card__cta">詳細を見る</span>',
      '</a>',
    ].join('\n')).join('\n');
  }

  function renderMarketDataDefinitions(market) {
    const definitions = [
      {
        term: '板',
        description: `${market.label} の最良Bid / Askと板厚を、各取引所の公開オーダーブックから集計した値です。`,
      },
      {
        term: '出来高シェア',
        description: '24時間出来高をJPY換算し、取引所ごとの銘柄内シェアを比較できるようにした指標です。',
      },
      {
        term: '販売所スプレッド',
        description: '販売所の買値と売値の差、および仲値に対するスプレッド率を表示した参考値です。',
      },
      {
        term: '取引所別コスト比較',
        description: '公開板と taker 手数料を使い、成行注文の想定約定コストを横並びにしたシミュレーションです。',
      },
    ];

    return definitions.map((item) => [
      '<article class="market-definition-card">',
      `  <h3 class="market-definition-card__term">${xmlEscape(item.term)}</h3>`,
      `  <p class="market-definition-card__description">${xmlEscape(item.description)}</p>`,
      '</article>',
    ].join('\n')).join('\n');
  }

  function renderMarketDisclaimer(market, aboutArticle) {
    const exchangeLabels = market.exchanges
      .map(exchange => exchange.label || exchange.id)
      .filter(Boolean)
      .join(' / ');

    return [
      '<aside class="market-disclaimer-card">',
      '  <h3 class="market-disclaimer-card__title">免責とデータ取得</h3>',
      '  <p class="market-disclaimer-card__body">本ページの数値は参考情報であり、投資助言ではありません。表示時点と実際の約定価格、出来高、スプレッドは一致しない場合があります。</p>',
      `  <p class="market-disclaimer-card__body"><strong>対象取引所:</strong> ${xmlEscape(exchangeLabels || '国内取引所')}</p>`,
      '  <p class="market-disclaimer-card__body">板、出来高、販売所価格は各取引所の公開API / WebSocketをもとに機械的に集計しています。発注前は各取引所の公式画面、手数料、最小発注数量を必ず確認してください。</p>',
      aboutArticle
        ? `  <a class="market-disclaimer-card__link" href="${xmlEscape(aboutArticle.path)}">${xmlEscape(aboutArticle.title)} を読む</a>`
        : '',
      '</aside>',
    ].filter(Boolean).join('\n');
  }

  function renderMarketIndexCards(markets) {
    if (!markets || markets.length === 0) {
      return '<p class="text-center text-gray-500 py-8">銘柄データを準備中です</p>';
    }

    return markets.map((market) => {
      const exchangeNames = market.exchangeLabels.join(' ');
      const searchText = [
        market.instrumentId,
        market.label,
        market.baseCurrency,
        market.quoteCurrency,
        exchangeNames,
        market.topVolumeExchangeLabel || '',
        market.bestSpreadExchangeLabel || '',
      ].join(' ').toLowerCase();
      const exchangeIds = market.exchanges.map(exchange => exchange.id).join(' ');
      const visibleExchanges = market.exchanges.slice(0, 4);
      const hiddenCount = Math.max(0, market.exchanges.length - visibleExchanges.length);
      const exchangeChips = visibleExchanges.map(exchange => (
        `<span>${xmlEscape(exchange.label)}</span>`
      )).join('');
      const moreChip = hiddenCount > 0 ? `<span>+${hiddenCount}</span>` : '';
      const topVolumeText = market.topVolumeExchangeLabel
        ? `出来高トップ：${market.topVolumeExchangeLabel}`
        : '出来高データ待ち';
      const bestSpreadText = market.bestSpreadExchangeLabel
        ? `スプレッド最小：${market.bestSpreadExchangeLabel}`
        : '販売所データなし';

      return [
        `<a class="market-index-card" href="${xmlEscape(market.path)}" data-market-search="${xmlEscape(searchText)}" data-exchanges="${xmlEscape(exchangeIds)}">`,
        '  <span class="market-index-card__topline">',
        `    <span class="market-index-card__label">${xmlEscape(market.label)}</span>`,
        `    <span class="market-index-card__count">${market.exchangeCount}社</span>`,
        '  </span>',
        `  <span class="market-index-card__id">${xmlEscape(market.instrumentId)}</span>`,
        `  <span class="market-index-card__summary">${xmlEscape(market.summaryLine)}</span>`,
        '  <span class="market-index-card__metrics">',
        `    <span class="market-index-card__metric">${xmlEscape(topVolumeText)}</span>`,
        `    <span class="market-index-card__metric">${xmlEscape(bestSpreadText)}</span>`,
        '  </span>',
        `  <span class="market-index-card__currencies">${xmlEscape(market.baseCurrency)} / ${xmlEscape(market.quoteCurrency)}</span>`,
        '  <span class="market-index-card__footer">',
        `    <span class="market-index-card__exchanges">${exchangeChips}${moreChip}</span>`,
        '    <span class="market-index-card__cta">コスト比較を見る</span>',
        '  </span>',
        '</a>',
      ].join('\n');
    }).join('\n');
  }

  function renderMarketCategoryNav(categories) {
    if (!categories || categories.length === 0) return '';
    return categories.map((category) => (
      `<a class="market-category-nav__link" href="#${xmlEscape(category.anchorId)}">${xmlEscape(category.title)}</a>`
    )).join('\n');
  }

  function renderMarketCategorySections(categories) {
    if (!categories || categories.length === 0) {
      return '<p class="text-center text-gray-500 py-8">カテゴリ情報を準備中です</p>';
    }

    return categories.map((category) => [
      `<section id="${xmlEscape(category.anchorId)}" class="market-category-card">`,
      '  <div class="market-category-card__header">',
      '    <div>',
      `      <h3 class="market-category-card__title">${xmlEscape(category.title)}</h3>`,
      `      <p class="market-category-card__description">${xmlEscape(category.description)}</p>`,
      '    </div>',
      `    <span class="market-category-card__count">${category.count}銘柄</span>`,
      '  </div>',
      '  <div class="market-category-card__links">',
      category.markets.map((market) => [
        `    <a class="market-category-link" href="${xmlEscape(market.path)}">`,
        `      <span class="market-category-link__label">${xmlEscape(market.label)}</span>`,
        `      <span class="market-category-link__summary">${xmlEscape(market.summaryLine)}</span>`,
        '    </a>',
      ].join('\n')).join('\n'),
      '  </div>',
      '</section>',
    ].join('\n')).join('\n');
  }

  function renderMarketExchangeOptions(exchanges) {
    return [
      '<option value="__all__">すべて</option>',
      ...exchanges.map(exchange => `<option value="${xmlEscape(exchange.id)}">${xmlEscape(exchange.label)}</option>`),
    ].join('');
  }

  function renderMarketsIndexHtml(req) {
    const origin = requestOrigin(req);
    const model = buildMarketIndexModel();
    const template = fs.readFileSync(path.join(publicDir, 'markets.html'), 'utf8');
    const title = `国内暗号資産 銘柄ページ一覧｜${SITE_NAME}`;
    const description = '国内取引所で買える暗号資産を、対応取引所数・板の有無・販売所スプレッド・出来高の観点で比較できます。BTC/JPY、ETH/JPY、XRP/JPYなど各銘柄ページへ移動できます。';

    return template
      .replace(HEAD_META_INJECT, renderHeadMeta({
        title,
        description,
        canonical: marketIndexPath(),
        ogImage: '/ogp/default.png',
        includeDefaultJsonLd: false,
        structuredData: marketIndexStructuredData(model, origin, description),
        siteOrigin: origin,
      }))
      .replace('__MARKETS_INDEX_JSON__', safeJsonForHtml(model))
      .replaceAll('__MARKET_COUNT__', String(model.meta.marketCount))
      .replaceAll('__EXCHANGE_COUNT__', String(model.meta.exchangeCount))
      .replace('__MARKET_INDEX_EXCHANGE_OPTIONS__', renderMarketExchangeOptions(model.exchanges))
      .replace('<!-- MARKET_CATEGORY_NAV -->', renderMarketCategoryNav(model.categories))
      .replace('<!-- MARKET_CATEGORY_SECTIONS -->', renderMarketCategorySections(model.categories))
      .replace('<!-- MARKET_INDEX_LIST -->', renderMarketIndexCards(model.markets));
  }

  function renderMarketHtml(req, market) {
    const origin = requestOrigin(req);
    const template = fs.readFileSync(path.join(publicDir, 'market.html'), 'utf8');
    const pageMarket = buildMarketPageModel(market);
    const title = `${pageMarket.label} 板・出来高シェア・販売所スプレッド比較｜${SITE_NAME}`;
    const description = `${pageMarket.label} の国内暗号資産取引所データを集約。板情報、出来高シェア、販売所スプレッド、取引所別の成行コストを1ページで確認できます。`;
    const aboutArticle = getArticle('about') || listArticles()[0] || null;
    let marketSnapshot = null;
    if (typeof marketPageSnapshotLoader === 'function') {
      try {
        marketSnapshot = marketPageSnapshotLoader(pageMarket.instrumentId, pageMarket) || null;
      } catch (_err) {
        marketSnapshot = null;
      }
    }
    const pageConfig = {
      instrumentId: pageMarket.instrumentId,
      label: pageMarket.label,
      baseCurrency: pageMarket.baseCurrency,
      quoteCurrency: pageMarket.quoteCurrency,
    };

    return template
      .replace(HEAD_META_INJECT, renderHeadMeta({
        title,
        description,
        canonical: marketPath(pageMarket.instrumentId),
        ogImage: '/ogp/default.png',
        includeDefaultJsonLd: false,
        structuredData: marketStructuredData(pageMarket, origin, description),
        siteOrigin: origin,
      }))
      .replace('<!-- MARKET_OVERVIEW_CARD -->', renderMarketOverviewCard(pageMarket))
      .replace('<!-- MARKET_COMPARISON_SUMMARY_CARD -->', renderMarketComparisonSummaryCard(pageMarket, marketSnapshot))
      .replace('<!-- MARKET_JOURNEY_LINKS -->', renderMarketJourneyLinks(pageMarket))
      .replace('<!-- MARKET_SUPPORTED_EXCHANGE_LINKS -->', renderMarketSupportedExchangeLinks(pageMarket))
      .replace('<!-- MARKET_DATA_DEFINITIONS -->', renderMarketDataDefinitions(pageMarket))
      .replace('<!-- MARKET_DISCLAIMER -->', renderMarketDisclaimer(pageMarket, aboutArticle))
      .replace('__MARKET_PAGE_JSON__', safeJsonForHtml(pageConfig));
  }

  function buildExchangePageModel(exchange) {
    const pageContent = exchange.pageContent || getExchangePageContent(exchange.id) || {};
    const boardMarkets = sortMarketsByPriority(exchange.markets || []);
    const salesReport = salesSpreadStore && typeof salesSpreadStore.getReport === 'function'
      ? salesSpreadStore.getReport()
      : { rows: [] };
    const salesRows = (salesReport.rows || []).filter(row => row.exchangeId === exchange.id);
    const salesMarkets = sortMarketsByPriority(salesRows.map(row => ({
      instrumentId: row.instrumentId,
      label: row.instrumentLabel || marketLabel(row.instrumentId, row),
      baseCurrency: row.baseCurrency,
      quoteCurrency: row.quoteCurrency,
    })));
    const coverage = buildExchangeCoverage(boardMarkets, salesRows);
    const volume = buildExchangeVolumeSummary(exchange.id);
    const spread = buildExchangeSalesSummary(salesRows);
    const defaultMarket = exchange.defaultMarket || boardMarkets[0] || {
      instrumentId: exchange.defaultInstrumentId || 'BTC-JPY',
      label: marketLabel(exchange.defaultInstrumentId || 'BTC-JPY'),
    };
    const thickMarkets = volume.rows.slice(0, 6).map(row => ({
      instrumentId: row.instrumentId,
      label: row.instrumentLabel || marketLabel(row.instrumentId, row),
      quoteVolume: row.quoteVolume,
      instrumentSharePct: parseNumber(row.instrumentSharePct),
    }));
    const lede = `${exchange.fullName || exchange.label} の基本情報、板取引対応銘柄、販売所対応銘柄、出来高シェア、キャンペーン確認導線をまとめています。流動性の参考になります。注文前に実効コストを確認しましょう。`;

    return {
      ...exchange,
      boardMarkets,
      salesMarkets,
      coverage,
      defaultMarket,
      pageContent,
      volume,
      spread,
      thickMarkets,
      officialUrl: pageContent.officialUrl || null,
      signupUrl: pageContent.signupUrl || pageContent.officialUrl || null,
      campaignUrl: pageContent.campaignUrl || pageContent.officialUrl || null,
      campaignLabel: pageContent.campaignLabel || '公式ページで最新情報を確認',
      referralUrl: pageContent.referralUrl || null,
      lede,
    };
  }

  function renderExchangeMarketPills(markets, options = {}) {
    const {
      emptyMessage = 'データを準備中です',
      showCoverage = false,
    } = options;

    if (!markets || markets.length === 0) {
      return `<p class="text-xs text-gray-500 mt-3">${xmlEscape(emptyMessage)}</p>`;
    }

    return [
      '<div class="mt-3 flex flex-wrap gap-2">',
      markets.map((market) => {
        const coverageBadges = showCoverage
          ? [
            market.hasBoard ? '<span class="inline-flex rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-green-300">板</span>' : '',
            market.hasSales ? '<span class="inline-flex rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold text-yellow-300">販売所</span>' : '',
          ].filter(Boolean).join('')
          : '';
        return [
          '<span class="inline-flex min-h-9 items-center gap-2 rounded-full border border-gray-800 bg-gray-900/80 px-3 py-2 text-xs font-semibold text-gray-200">',
          `  <span>${xmlEscape(market.label || market.instrumentId)}</span>`,
          coverageBadges,
          '</span>',
        ].join('\n');
      }).join('\n'),
      '</div>',
    ].join('\n');
  }

  function renderExchangeJourneyLinks(exchange) {
    const links = [
      {
        eyebrow: 'Simulator',
        title: `${exchange.label} で板シミュレーターを開く`,
        description: `${exchange.defaultMarket.label} を、この取引所を選んだ状態で比較に戻せます。`,
        href: queryPath('/simulator', { exchange: exchange.id, market: exchange.defaultMarket.instrumentId }),
      },
      {
        eyebrow: 'Market',
        title: `${exchange.defaultMarket.label} の銘柄ページを見る`,
        description: '代表銘柄を起点に、板・出来高・販売所スプレッドを続けて確認できます。',
        href: marketPath(exchange.defaultMarket.instrumentId),
      },
      {
        eyebrow: 'Campaign',
        title: 'キャンペーン一覧を見る',
        description: 'PR 表記、公式URL、紹介リンクの有無を一覧で確認できます。',
        href: '/campaigns',
      },
    ];

    return links.map((link) => [
      `<a class="market-context-card" href="${xmlEscape(link.href)}">`,
      `  <span class="market-context-card__eyebrow">${xmlEscape(link.eyebrow)}</span>`,
      `  <strong class="market-context-card__title">${xmlEscape(link.title)}</strong>`,
      `  <span class="market-context-card__description">${xmlEscape(link.description)}</span>`,
      '  <span class="market-context-card__cta">開く</span>',
      '</a>',
    ].join('\n')).join('\n');
  }

  function renderExchangeOverviewCards(exchange) {
    const volumeShare = exchange.volume.exchangeShare;
    const cards = [
      {
        term: '取引所の基本情報',
        description: `${exchange.fullName || exchange.label} / ${exchange.dataSourceLabel || '公開API / WebSocket'} をもとに表示しています。`,
      },
      {
        term: '手数料',
        description: `比較の既定値は ${exchange.feeLabel} です。会員区分や注文条件で変わる場合があるため、注文前に公式条件を確認しましょう。`,
      },
      {
        term: '出来高シェア',
        description: volumeShare
          ? `直近集計では ${formatPct(volumeShare.sharePct, 1)} の出来高シェアです。流動性の参考になります。`
          : '出来高シェアはデータ待ちです。流動性の参考として後で見直せます。',
      },
      {
        term: 'スプレッド傾向',
        description: exchange.spread.marketCount > 0
          ? `販売所対応 ${exchange.spread.marketCount}銘柄の傾向を表示します。${exchange.spread.summary}`
          : '販売所スプレッドの比較データがある銘柄から、実効コストの候補を確認できます。',
      },
    ];

    return cards.map((card) => [
      '<article class="market-definition-card">',
      `  <h3 class="market-definition-card__term">${xmlEscape(card.term)}</h3>`,
      `  <p class="market-definition-card__description">${xmlEscape(card.description)}</p>`,
      '</article>',
    ].join('\n')).join('\n');
  }

  function renderExchangeCoverageCards(exchange) {
    const cards = [
      {
        title: '取扱銘柄',
        count: exchange.coverage.length,
        description: '板取引と販売所の対応範囲をまとめた一覧です。どこまで比較できるかの確認に使えます。',
        markets: exchange.coverage,
        showCoverage: true,
        emptyMessage: '対応銘柄データを準備中です。',
      },
      {
        title: '板取引対応銘柄',
        count: exchange.boardMarkets.length,
        description: 'このサイトで板シミュレーターに接続している銘柄一覧です。板の厚みや約定コストの確認に進めます。',
        markets: exchange.boardMarkets,
        emptyMessage: '板取引対応銘柄を準備中です。',
      },
      {
        title: '販売所対応銘柄',
        count: exchange.salesMarkets.length,
        description: '販売所スプレッドを追えている銘柄一覧です。販売所で買う前のコスト比較候補になります。',
        markets: exchange.salesMarkets,
        emptyMessage: '販売所データは準備中です。',
      },
    ];

    return cards.map((card) => [
      '<article class="market-definition-card">',
      '  <div class="flex items-start justify-between gap-3">',
      '    <div>',
      `      <h3 class="market-definition-card__term">${xmlEscape(card.title)}</h3>`,
      `      <p class="market-definition-card__description">${xmlEscape(card.description)}</p>`,
      '    </div>',
      `    <span class="badge">${xmlEscape(`${formatCount(card.count)}件`)}</span>`,
      '  </div>',
      renderExchangeMarketPills(card.markets, {
        emptyMessage: card.emptyMessage,
        showCoverage: card.showCoverage,
      }),
      '</article>',
    ].join('\n')).join('\n');
  }

  function renderExchangeCostCards(exchange) {
    const volumeShare = exchange.volume.exchangeShare;
    const thickDescription = exchange.thickMarkets.length > 0
      ? '24h 出来高が大きい銘柄を並べています。板の厚みを確認する候補として使えます。'
      : '出来高データを取得できた銘柄から候補を表示します。';
    const thickMarkets = exchange.thickMarkets.map((market) => ({
      label: `${market.label} ${market.quoteVolume != null ? formatJpyCompact(market.quoteVolume) : ''}`.trim(),
    }));
    const cards = [
      {
        title: '手数料',
        description: `${exchange.feeLabel} を比較の基準にしています。会員ランクや注文方法で条件が変わる場合があります。`,
      },
      {
        title: '出来高シェア',
        description: volumeShare
          ? `${formatJpyCompact(volumeShare.quoteVolume)} / 全体シェア ${formatPct(volumeShare.sharePct, 1)}。流動性の参考になります。`
          : '出来高シェアはデータ待ちです。主要銘柄から比較を始めると判断しやすくなります。',
      },
      {
        title: 'スプレッド傾向',
        description: exchange.spread.marketCount > 0
          ? `直近1日平均 ${formatPct(exchange.spread.avg1d, 2)} / 7日平均 ${exchange.spread.avg7d != null ? formatPct(exchange.spread.avg7d, 2) : 'データ待ち'}。${exchange.spread.summary}`
          : '販売所データを準備中です。販売所を使う前に実効コストを確認しましょう。',
      },
      {
        title: '板の厚い銘柄の参考',
        description: thickDescription,
        markets: thickMarkets,
        emptyMessage: '出来高データを準備中です。',
      },
    ];

    return cards.map((card) => [
      '<article class="market-definition-card">',
      `  <h3 class="market-definition-card__term">${xmlEscape(card.title)}</h3>`,
      `  <p class="market-definition-card__description">${xmlEscape(card.description)}</p>`,
      card.markets ? renderExchangeMarketPills(card.markets, { emptyMessage: card.emptyMessage }) : '',
      '</article>',
    ].join('\n')).join('\n');
  }

  function renderExchangeAudienceCards(exchange) {
    const users = exchange.pageContent.userTypes || [];
    const cautions = exchange.pageContent.cautions || [];

    return [
      '<article class="market-insight-card">',
      '  <div class="market-insight-card__header">',
      '    <div>',
      '      <p class="market-insight-card__eyebrow">Audience</p>',
      '      <h3 class="market-insight-card__title">向いているユーザーの例</h3>',
      '    </div>',
      '    <span class="market-insight-card__badge">Guide</span>',
      '  </div>',
      `  <p class="market-insight-card__lead">${xmlEscape(exchange.pageContent.summary || `${exchange.label} の比較導線を整理しやすい人向けの目安です。`)}</p>`,
      '  <ol class="market-insight-checklist">',
      (users.length > 0 ? users : ['主要銘柄から取引所の違いを比較したい人']).map(item => `<li>${xmlEscape(item)}</li>`).join('\n'),
      '  </ol>',
      '</article>',
      '<article class="market-insight-card market-insight-card--summary">',
      '  <div class="market-insight-card__header">',
      '    <div>',
      '      <p class="market-insight-card__eyebrow">Caution</p>',
      '      <h3 class="market-insight-card__title">注意点</h3>',
      '    </div>',
      '    <span class="market-insight-card__badge">Check</span>',
      '  </div>',
      '  <p class="market-insight-card__lead">取扱銘柄、注文条件、キャンペーン条件は変更されることがあります。</p>',
      '  <ol class="market-insight-checklist">',
      (cautions.length > 0 ? cautions : ['申込前に公式条件と注文画面を確認しましょう。']).map(item => `<li>${xmlEscape(item)}</li>`).join('\n'),
      '  </ol>',
      '</article>',
    ].join('\n');
  }

  function renderExchangeCampaignCards(exchange) {
    const cards = [
      {
        eyebrow: 'Campaign',
        title: '現在のキャンペーンを公式で確認する',
        description: `${exchange.campaignLabel}。内容や終了時期は変わるため、申込前に最新条件を確認してください。`,
        href: exchange.campaignUrl || exchange.officialUrl || '/campaigns',
        cta: '確認する',
      },
      {
        eyebrow: 'Policy',
        title: 'キャンペーン一覧を見る',
        description: 'このサイトで掲載するキャンペーンと紹介リンクの状態を確認できます。',
        href: '/campaigns',
        cta: '一覧を見る',
      },
    ];

    return cards.map((card) => [
      `<a class="market-context-card" href="${xmlEscape(card.href)}">`,
      `  <span class="market-context-card__eyebrow">${xmlEscape(card.eyebrow)}</span>`,
      `  <strong class="market-context-card__title">${xmlEscape(card.title)}</strong>`,
      `  <span class="market-context-card__description">${xmlEscape(card.description)}</span>`,
      `  <span class="market-context-card__cta">${xmlEscape(card.cta)}</span>`,
      '</a>',
    ].join('\n')).join('\n');
  }

  function renderExchangeLinkCards(exchange, aboutArticle) {
    const cards = [
      {
        eyebrow: 'Official',
        title: '公式サイト',
        description: '口座開設、手数料、入出金条件などの一次情報を確認できます。',
        href: exchange.officialUrl || '/',
        cta: '公式へ',
      },
      {
        eyebrow: 'Signup',
        title: '口座開設ページ',
        description: '申込導線や本人確認の流れを確認できます。',
        href: exchange.signupUrl || exchange.officialUrl || '/',
        cta: '開設導線を見る',
      },
    ];

    if (exchange.referralUrl) {
      cards.push({
        eyebrow: 'PR',
        title: '紹介リンク',
        description: '紹介特典や適用条件を確認できます。申込前に最新条件を確認してください。',
        href: exchange.referralUrl,
        cta: '紹介条件を見る',
      });
    } else {
      cards.push({
        eyebrow: 'PR',
        title: '紹介リンク掲載準備中',
        description: '紹介リンクを掲載する場合は、PR 表記と適用条件の明記を前提に差し替えます。',
        href: '/campaigns',
        cta: '一覧を見る',
      });
    }

    if (aboutArticle) {
      cards.push({
        eyebrow: 'Guide',
        title: aboutArticle.title,
        description: 'データ取得と免責の前提を確認できます。',
        href: aboutArticle.path,
        cta: '読む',
      });
    }

    return cards.map((card) => [
      `<a class="market-context-card" href="${xmlEscape(card.href)}">`,
      `  <span class="market-context-card__eyebrow">${xmlEscape(card.eyebrow)}</span>`,
      `  <strong class="market-context-card__title">${xmlEscape(card.title)}</strong>`,
      `  <span class="market-context-card__description">${xmlEscape(card.description)}</span>`,
      `  <span class="market-context-card__cta">${xmlEscape(card.cta)}</span>`,
      '</a>',
    ].join('\n')).join('\n');
  }

  function renderExchangeMarketLinks(exchange) {
    const markets = exchange.boardMarkets || [];
    if (markets.length === 0) {
      return '<p class="text-center text-gray-500 py-8">取扱銘柄データを準備中です</p>';
    }

    return markets.map((market) => [
      `<a class="exchange-market-link" href="${xmlEscape(queryPath('/simulator', { exchange: exchange.id, market: market.instrumentId }))}">`,
      `  <span class="exchange-market-link__label">${xmlEscape(market.label)}</span>`,
      `  <span class="exchange-market-link__meta">${xmlEscape(market.instrumentId)} をこの取引所で比較する</span>`,
      '</a>',
    ].join('\n')).join('\n');
  }

  function renderExchangeHtml(req, exchange) {
    const origin = requestOrigin(req);
    const template = fs.readFileSync(path.join(publicDir, 'exchange.html'), 'utf8');
    const aboutArticle = getArticle('about') || listArticles()[0] || null;
    const pageExchange = buildExchangePageModel(exchange);
    const title = `${pageExchange.label} 手数料・取扱銘柄・キャンペーン確認｜${SITE_NAME}`;
    const description = `${pageExchange.label} の基本情報、取扱銘柄、板取引対応銘柄、販売所対応銘柄、出来高シェア、スプレッド傾向、キャンペーン確認導線をまとめた取引所詳細ページです。`;

    return template
      .replace(HEAD_META_INJECT, renderHeadMeta({
        title,
        description,
        canonical: exchangePath(pageExchange.id),
        ogImage: '/ogp/default.png',
        pageId: 'home',
        includeDefaultJsonLd: false,
        structuredData: exchangeStructuredData(pageExchange, origin, description),
        siteOrigin: origin,
      }))
      .replaceAll('__EXCHANGE_LABEL__', xmlEscape(pageExchange.label || pageExchange.id))
      .replaceAll('__EXCHANGE_NAME__', xmlEscape(pageExchange.fullName || pageExchange.label || pageExchange.id))
      .replace('__EXCHANGE_LEDE__', xmlEscape(pageExchange.lede))
      .replace('__EXCHANGE_FEE_LABEL__', xmlEscape(pageExchange.feeLabel))
      .replace('__EXCHANGE_MARKET_COUNT__', xmlEscape(String(pageExchange.coverage.length)))
      .replace('__EXCHANGE_DEFAULT_MARKET__', xmlEscape(pageExchange.defaultMarket.label || pageExchange.defaultMarket.instrumentId))
      .replace('<!-- EXCHANGE_JOURNEY_LINKS -->', renderExchangeJourneyLinks(pageExchange))
      .replace('<!-- EXCHANGE_OVERVIEW_CARDS -->', renderExchangeOverviewCards(pageExchange))
      .replace('<!-- EXCHANGE_COVERAGE_CARDS -->', renderExchangeCoverageCards(pageExchange))
      .replace('<!-- EXCHANGE_COST_CARDS -->', renderExchangeCostCards(pageExchange))
      .replace('<!-- EXCHANGE_AUDIENCE_CARDS -->', renderExchangeAudienceCards(pageExchange))
      .replace('<!-- EXCHANGE_CAMPAIGN_CARDS -->', renderExchangeCampaignCards(pageExchange))
      .replace('<!-- EXCHANGE_LINK_CARDS -->', renderExchangeLinkCards(pageExchange, aboutArticle))
      .replace('<!-- EXCHANGE_MARKET_LINKS -->', renderExchangeMarketLinks(pageExchange));
  }

  return {
    buildMarketIndexModel,
    buildRssXml,
    buildSitemapXml,
    campaignPath,
    getArticleBySlug,
    getCampaignInfo,
    getExchangeInfo,
    getMarketInfo,
    exchangePath,
    marketPath,
    normalizeCampaignSlug,
    normalizeExchangeId,
    normalizeMarketInstrumentId,
    renderArticleHtml,
    renderCampaignHtml,
    renderCampaignsHtml,
    renderExchangeHtml,
    renderMarketHtml,
    renderMarketsIndexHtml,
    renderPublicPage,
    requestOrigin,
    setMarketPageSnapshotLoader(loader) {
      marketPageSnapshotLoader = typeof loader === 'function' ? loader : null;
    },
  };
}

module.exports = {
  createSiteContentService,
};
