const fs = require('fs');
const path = require('path');
const { SITE_NAME } = require('../schema');

const HEAD_META_INJECT = '<!-- HEAD_META_INJECT -->';
const ARTICLE_JSON_LD_INJECT = '<!-- ARTICLE_JSON_LD_INJECT -->';

function createSiteContentService({
  getArticle,
  getPublicExchanges,
  listArticles,
  publicDir,
  renderHeadMeta,
}) {
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
    return exchangeId;
  }

  function exchangePath(exchangeId) {
    return `/exchanges/${encodeURIComponent(normalizeExchangeId(exchangeId))}`;
  }

  function marketLabel(instrumentId, market = {}) {
    if (market.label) return market.label;
    return String(instrumentId || '').replace('-', '/');
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

    const featuredRank = new Map([
      ['BTC-JPY', 0],
      ['ETH-JPY', 1],
      ['XRP-JPY', 2],
      ['SOL-JPY', 3],
    ]);

    const markets = (exchange.markets || [])
      .filter(market => market && market.instrumentId && (!market.status || market.status === 'active'))
      .map(market => ({
        ...market,
        label: marketLabel(market.instrumentId, market),
      }))
      .sort((a, b) => {
        const aRank = featuredRank.has(a.instrumentId) ? featuredRank.get(a.instrumentId) : 100;
        const bRank = featuredRank.has(b.instrumentId) ? featuredRank.get(b.instrumentId) : 100;
        if (aRank !== bRank) return aRank - bRank;
        return a.instrumentId.localeCompare(b.instrumentId);
      });

    const defaultMarket = markets.find(market => market.instrumentId === exchange.defaultInstrumentId)
      || markets[0]
      || {
        instrumentId: exchange.defaultInstrumentId || 'BTC-JPY',
        label: marketLabel(exchange.defaultInstrumentId || 'BTC-JPY'),
      };

    return {
      ...exchange,
      path: exchangePath(exchange.id),
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

    const markets = sortMarketsForIndex(Array.from(byInstrument.values()).map(market => ({
      ...market,
      exchangeCount: market.exchanges.length,
      exchangeLabels: market.exchanges.map(exchange => exchange.label),
    })));

    return {
      meta: {
        generatedAt: new Date().toISOString(),
        marketCount: markets.length,
        exchangeCount: publicExchanges.length,
      },
      exchanges: publicExchanges.map(exchange => ({
        id: exchange.id,
        label: exchange.label || exchange.id,
      })),
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

  function rssDate(value, fallback = new Date()) {
    const date = new Date(value || fallback);
    if (Number.isNaN(date.getTime())) return new Date(fallback).toUTCString();
    return date.toUTCString();
  }

  function buildSitemapXml(origin) {
    const pages = sitemapPages
      .concat(buildMarketSitemapPages())
      .concat(buildExchangeSitemapPages())
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

  function renderMarketJourneyLinks(market, aboutArticle) {
    const links = [
      {
        eyebrow: 'Simulator',
        title: `${market.label} の板シミュレーター`,
        description: 'この銘柄を選んだ状態で、成行注文の執行コストを確認します。',
        href: queryPath('/simulator', { market: market.instrumentId }),
      },
      {
        eyebrow: 'Volume',
        title: `${market.label} の出来高シェア`,
        description: '出来高シェアページをこの銘柄に絞った状態で開きます。',
        href: queryPath('/volume-share', { instrumentId: market.instrumentId }),
      },
      {
        eyebrow: 'Sales Spread',
        title: `${market.label} の販売所スプレッド`,
        description: '販売所の価格差と推移を、この銘柄で続けて確認できます。',
        href: queryPath('/sales-spread', { instrumentId: market.instrumentId }),
      },
    ];

    if (aboutArticle) {
      links.push({
        eyebrow: 'Article',
        title: aboutArticle.title,
        description: 'データソース、定義、免責事項をまとめた補足記事です。',
        href: aboutArticle.path,
      });
    }

    return links.map((link) => [
      `<a class="market-context-card" href="${xmlEscape(link.href)}">`,
      `  <span class="market-context-card__eyebrow">${xmlEscape(link.eyebrow)}</span>`,
      `  <strong class="market-context-card__title">${xmlEscape(link.title)}</strong>`,
      `  <span class="market-context-card__description">${xmlEscape(link.description)}</span>`,
      '  <span class="market-context-card__cta">開く</span>',
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
      ].join(' ').toLowerCase();
      const exchangeIds = market.exchanges.map(exchange => exchange.id).join(' ');
      const visibleExchanges = market.exchanges.slice(0, 5);
      const hiddenCount = Math.max(0, market.exchanges.length - visibleExchanges.length);
      const exchangeChips = visibleExchanges.map(exchange => (
        `<span>${xmlEscape(exchange.label)}</span>`
      )).join('');
      const moreChip = hiddenCount > 0 ? `<span>+${hiddenCount}</span>` : '';

      return [
        `<a class="market-index-card" href="${xmlEscape(market.path)}" data-market-search="${xmlEscape(searchText)}" data-exchanges="${xmlEscape(exchangeIds)}">`,
        '  <span class="market-index-card__topline">',
        `    <span class="market-index-card__label">${xmlEscape(market.label)}</span>`,
        `    <span class="market-index-card__count">${market.exchangeCount}社</span>`,
        '  </span>',
        `  <span class="market-index-card__id">${xmlEscape(market.instrumentId)}</span>`,
        `  <span class="market-index-card__currencies">${xmlEscape(market.baseCurrency)} / ${xmlEscape(market.quoteCurrency)}</span>`,
        `  <span class="market-index-card__exchanges">${exchangeChips}${moreChip}</span>`,
        '</a>',
      ].join('\n');
    }).join('\n');
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
    const description = 'BTC/JPY、ETH/JPY、XRP/JPYなど国内暗号資産取引所で扱う銘柄ページを一覧化。各銘柄の板、出来高シェア、販売所スプレッド、取引所別比較へ移動できます。';

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
      .replace('<!-- MARKET_INDEX_LIST -->', renderMarketIndexCards(model.markets));
  }

  function renderMarketHtml(req, market) {
    const origin = requestOrigin(req);
    const template = fs.readFileSync(path.join(publicDir, 'market.html'), 'utf8');
    const title = `${market.label} 板・出来高シェア・販売所スプレッド比較｜${SITE_NAME}`;
    const description = `${market.label} の国内暗号資産取引所データを集約。板情報、出来高シェア、販売所スプレッド、取引所別の成行コストを1ページで確認できます。`;
    const aboutArticle = getArticle('about') || listArticles()[0] || null;
    const pageConfig = {
      instrumentId: market.instrumentId,
      label: market.label,
      baseCurrency: market.baseCurrency,
      quoteCurrency: market.quoteCurrency,
    };

    return template
      .replace(HEAD_META_INJECT, renderHeadMeta({
        title,
        description,
        canonical: marketPath(market.instrumentId),
        ogImage: '/ogp/default.png',
        includeDefaultJsonLd: false,
        structuredData: marketStructuredData(market, origin, description),
        siteOrigin: origin,
      }))
      .replace('<!-- MARKET_JOURNEY_LINKS -->', renderMarketJourneyLinks(market, aboutArticle))
      .replace('<!-- MARKET_DATA_DEFINITIONS -->', renderMarketDataDefinitions(market))
      .replace('<!-- MARKET_DISCLAIMER -->', renderMarketDisclaimer(market, aboutArticle))
      .replace('__MARKET_PAGE_JSON__', safeJsonForHtml(pageConfig));
  }

  function renderExchangeJourneyLinks(exchange) {
    const defaultMarket = exchange.defaultMarket || exchange.markets[0] || { instrumentId: exchange.defaultInstrumentId || 'BTC-JPY', label: marketLabel(exchange.defaultInstrumentId || 'BTC-JPY') };
    const links = [
      {
        eyebrow: 'Simulator',
        title: `${exchange.label} で板シミュレーターを開く`,
        description: `${defaultMarket.label} を、この取引所を選んだ状態で比較に戻せます。`,
        href: queryPath('/simulator', { exchange: exchange.id, market: defaultMarket.instrumentId }),
      },
      {
        eyebrow: 'Market',
        title: `${defaultMarket.label} の銘柄ページ`,
        description: '代表銘柄を起点に、板・出来高・販売所スプレッドを続けて確認できます。',
        href: marketPath(defaultMarket.instrumentId),
      },
      {
        eyebrow: 'Campaign',
        title: 'キャンペーン掲載方針を見る',
        description: 'キャンペーン比較の掲載ルールと広告ポリシーをホームで確認できます。',
        href: '/#campaign-policy',
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

  function renderExchangeSummaryCards(exchange) {
    const cards = [
      {
        term: '既定 taker 手数料',
        description: `比較の既定値は ${exchange.feeLabel} を基準にしています。手動で上書きしたいときはシミュレーター側の手数料率入力を使います。`,
      },
      {
        term: '取扱銘柄',
        description: `${exchange.marketCount}銘柄をこのサイトで扱っています。代表銘柄は ${(exchange.markets || []).slice(0, 4).map(market => market.label).join(' / ') || 'BTC/JPY'} です。`,
      },
      {
        term: '板差の読み方',
        description: 'シミュレーターで差が出たときは、手数料だけでなく板の厚みとスプレッドも合わせて確認すると判断しやすくなります。',
      },
      {
        term: 'データソース',
        description: exchange.dataSourceLabel || '公開API / WebSocket を利用しています。',
      },
    ];

    return cards.map((card) => [
      '<article class="market-definition-card">',
      `  <h3 class="market-definition-card__term">${xmlEscape(card.term)}</h3>`,
      `  <p class="market-definition-card__description">${xmlEscape(card.description)}</p>`,
      '</article>',
    ].join('\n')).join('\n');
  }

  function renderExchangeDisclaimer(exchange, aboutArticle) {
    return [
      '<aside class="market-disclaimer-card">',
      '  <h3 class="market-disclaimer-card__title">キャンペーン確認の前提</h3>',
      '  <p class="market-disclaimer-card__body">キャンペーン比較は現在準備中です。現時点では、シミュレーターの順位と別軸で、各取引所の手数料条件・取扱銘柄・公式告知を確認する入口として使ってください。</p>',
      `  <p class="market-disclaimer-card__body"><strong>このページの基準:</strong> ${xmlEscape(exchange.label)} / ${xmlEscape(exchange.feeLabel)} / ${xmlEscape(String(exchange.marketCount))}銘柄</p>`,
      '  <p class="market-disclaimer-card__body">最終判断の前に、各取引所の公式画面、注文条件、キャンペーン適用条件、入出金条件を必ず確認してください。</p>',
      '  <a class="market-disclaimer-card__link" href="/#campaign-policy">ホームのキャンペーン掲載方針を見る</a>',
      aboutArticle
        ? `  <a class="market-disclaimer-card__link" href="${xmlEscape(aboutArticle.path)}">${xmlEscape(aboutArticle.title)} を読む</a>`
        : '',
      '</aside>',
    ].filter(Boolean).join('\n');
  }

  function renderExchangeMarketLinks(exchange) {
    const markets = exchange.markets || [];
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
    const title = `${exchange.label} 手数料・取扱銘柄・キャンペーン確認｜${SITE_NAME}`;
    const description = `${exchange.label} の既定 taker 手数料、取扱銘柄、このサイトでの比較導線をまとめた取引所詳細ページです。`;
    const aboutArticle = getArticle('about') || listArticles()[0] || null;
    const defaultMarket = exchange.defaultMarket || exchange.markets[0] || { instrumentId: exchange.defaultInstrumentId || 'BTC-JPY', label: marketLabel(exchange.defaultInstrumentId || 'BTC-JPY') };
    const lede = `${exchange.fullName || exchange.label} の比較前提をまとめています。まずは既定 taker 手数料と取扱銘柄を確認し、差が出た銘柄はそのまま板シミュレーターで見直せます。キャンペーン比較は準備中のため、掲載方針ページへの導線も置いています。`;

    return template
      .replace(HEAD_META_INJECT, renderHeadMeta({
        title,
        description,
        canonical: exchangePath(exchange.id),
        ogImage: '/ogp/default.png',
        pageId: 'home',
        includeDefaultJsonLd: false,
        structuredData: exchangeStructuredData(exchange, origin, description),
        siteOrigin: origin,
      }))
      .replaceAll('__EXCHANGE_LABEL__', xmlEscape(exchange.label || exchange.id))
      .replaceAll('__EXCHANGE_NAME__', xmlEscape(exchange.fullName || exchange.label || exchange.id))
      .replace('__EXCHANGE_LEDE__', xmlEscape(lede))
      .replace('__EXCHANGE_FEE_LABEL__', xmlEscape(exchange.feeLabel))
      .replace('__EXCHANGE_MARKET_COUNT__', xmlEscape(String(exchange.marketCount)))
      .replace('__EXCHANGE_DEFAULT_MARKET__', xmlEscape(defaultMarket.label || defaultMarket.instrumentId))
      .replace('<!-- EXCHANGE_JOURNEY_LINKS -->', renderExchangeJourneyLinks(exchange))
      .replace('<!-- EXCHANGE_SUMMARY_CARDS -->', renderExchangeSummaryCards(exchange))
      .replace('<!-- EXCHANGE_DISCLAIMER -->', renderExchangeDisclaimer(exchange, aboutArticle))
      .replace('<!-- EXCHANGE_MARKET_LINKS -->', renderExchangeMarketLinks(exchange));
  }

  return {
    buildMarketIndexModel,
    buildRssXml,
    buildSitemapXml,
    getArticleBySlug,
    getExchangeInfo,
    getMarketInfo,
    exchangePath,
    marketPath,
    normalizeExchangeId,
    normalizeMarketInstrumentId,
    renderArticleHtml,
    renderExchangeHtml,
    renderMarketHtml,
    renderMarketsIndexHtml,
    renderPublicPage,
    requestOrigin,
  };
}

module.exports = {
  createSiteContentService,
};
