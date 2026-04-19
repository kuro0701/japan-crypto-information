const {
  EXCHANGES,
  DEFAULT_EXCHANGE_ID,
  COINCHECK_EXCHANGE_ID,
  BITFLYER_EXCHANGE_ID,
  BITBANK_EXCHANGE_ID,
  GMO_EXCHANGE_ID,
} = require('./exchanges');

const SITE_NAME = 'Japan クリプト インフォメーション';
const DEFAULT_SITE_ORIGIN = 'http://localhost:3000';
const LANGUAGE = 'ja-JP';

const PAGE_CONFIGS = {
  home: {
    pageId: 'home',
    path: '/',
    name: '成行取引リアルタイム板シミュレーター',
    title: '成行注文シミュレーター｜BTC・ETH国内取引所リアルタイム板｜Japan クリプト インフォメーション',
    description: '日本の暗号資産取引所の板情報をリアルタイムに取得し、成行注文の執行価格・スリッページ・マーケットインパクトをシミュレーション。OKJ・Coincheck・bitFlyer・bitbank・GMOコイン・Binance Japan対応。',
    ogImagePath: '/ogp/simulator.png',
  },
  'volume-share': {
    pageId: 'volume-share',
    path: '/volume-share',
    name: '出来高シェア',
    title: '国内暗号資産取引所 出来高シェア比較｜Japan クリプト インフォメーション',
    description: '国内主要取引所のBTC・ETH他銘柄の出来高シェアを日次・週次・月次で可視化。どの取引所に流動性が集まっているかをデータで確認。',
    ogImagePath: '/ogp/volume-share.png',
    datasetName: '国内暗号資産取引所 出来高シェアデータセット',
    datasetDescription: '国内暗号資産取引所の銘柄別24時間出来高、取引所別シェア、銘柄内シェアをJPY換算で集計したデータセットです。',
  },
  'sales-spread': {
    pageId: 'sales-spread',
    path: '/sales-spread',
    name: '販売所スプレッド',
    title: '販売所スプレッド比較｜Coincheck・bitFlyer・GMOコイン｜Japan クリプト インフォメーション',
    description: '国内販売所の買値・売値スプレッドをリアルタイム比較。販売所と取引所の実効コスト差を可視化。',
    ogImagePath: '/ogp/sales-spread.png',
    datasetName: '国内暗号資産取引所 販売所スプレッドデータセット',
    datasetDescription: '国内暗号資産取引所の販売所買値、売値、仲値、スプレッド、スプレッド率を銘柄別に集計したデータセットです。',
  },
};

const DATASET_MEASUREMENT_CONFIGS = {
  'volume-share': {
    metricName: '24時間出来高',
    propertySuffix: 'quoteVolume24h',
    unitText: 'JPY',
    valueReferenceName: 'JPY換算出来高',
    description: '24時間出来高をJPY建てで集計した値',
  },
  'sales-spread': {
    metricName: '販売所スプレッド率',
    propertySuffix: 'spreadPct',
    unitText: 'PERCENT',
    valueReferenceName: '買値と売値の仲値に対するスプレッド率',
    description: '販売所の買値と売値から算出したスプレッド率',
  },
};

const SALES_SPREAD_EXCHANGE_IDS = new Set([
  DEFAULT_EXCHANGE_ID,
  COINCHECK_EXCHANGE_ID,
  BITFLYER_EXCHANGE_ID,
  BITBANK_EXCHANGE_ID,
  GMO_EXCHANGE_ID,
]);

function compactObject(value) {
  if (Array.isArray(value)) {
    return value
      .map(compactObject)
      .filter(item => item != null && !(Array.isArray(item) && item.length === 0));
  }

  if (!value || typeof value !== 'object') return value;

  return Object.entries(value).reduce((acc, [key, item]) => {
    if (item == null) return acc;
    if (Array.isArray(item) && item.length === 0) return acc;
    if (typeof item === 'string' && item.trim() === '') return acc;
    acc[key] = compactObject(item);
    return acc;
  }, {});
}

function resolveSiteOrigin(origin = process.env.SITE_ORIGIN) {
  return String(origin || DEFAULT_SITE_ORIGIN).replace(/\/+$/, '');
}

function absoluteUrl(pathOrUrl, origin = process.env.SITE_ORIGIN) {
  const value = String(pathOrUrl || '');
  if (!value) return resolveSiteOrigin(origin);
  if (/^https?:\/\//i.test(value)) return value;

  const siteOrigin = resolveSiteOrigin(origin);
  if (value.startsWith('/')) return `${siteOrigin}${value}`;
  return `${siteOrigin}/${value}`;
}

function normalizePageId(pageId = 'home') {
  const value = String(pageId || 'home')
    .trim()
    .replace(/^\//, '')
    .replace(/\.html$/, '');

  if (!value || value === 'index' || value === 'home') return 'home';
  return value;
}

function getPageConfig(pageId = 'home') {
  return PAGE_CONFIGS[normalizePageId(pageId)] || PAGE_CONFIGS.home;
}

function organizationJsonLd(options = {}) {
  const origin = resolveSiteOrigin(options.origin);
  const organizationId = `${origin}/#organization`;
  const websiteId = `${origin}/#website`;

  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': organizationId,
        name: SITE_NAME,
        url: origin,
      },
      {
        '@type': 'WebSite',
        '@id': websiteId,
        name: SITE_NAME,
        url: origin,
        inLanguage: LANGUAGE,
        publisher: {
          '@id': organizationId,
        },
        potentialAction: {
          '@type': 'SearchAction',
          target: {
            '@type': 'EntryPoint',
            urlTemplate: `${origin}/?q={search_term_string}`,
          },
          'query-input': 'required name=search_term_string',
        },
      },
    ],
  };
}

function webApplicationJsonLd(options = {}) {
  const origin = resolveSiteOrigin(options.origin);
  const page = PAGE_CONFIGS.home;

  return compactObject({
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    '@id': `${origin}/#finance-application`,
    name: page.name,
    url: absoluteUrl(page.path, origin),
    description: options.description || page.description,
    inLanguage: LANGUAGE,
    applicationCategory: 'FinanceApplication',
    operatingSystem: 'Web',
    isAccessibleForFree: true,
    publisher: {
      '@id': `${origin}/#organization`,
    },
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'JPY',
    },
    featureList: [
      '国内暗号資産取引所の板情報取得',
      '成行注文の約定価格シミュレーション',
      'スリッページと板インパクトの可視化',
    ],
  });
}

function exchangesForDataset(pageId) {
  const normalizedPageId = normalizePageId(pageId);
  return EXCHANGES.filter((exchange) => {
    if (exchange.status && exchange.status !== 'active') return false;
    if (normalizedPageId === 'sales-spread') return SALES_SPREAD_EXCHANGE_IDS.has(exchange.id);
    return true;
  });
}

function buildDatasetVariableMeasured(pageId) {
  const normalizedPageId = normalizePageId(pageId);
  const config = DATASET_MEASUREMENT_CONFIGS[normalizedPageId];
  if (!config) return [];

  return exchangesForDataset(normalizedPageId).flatMap((exchange) => {
    const markets = Array.isArray(exchange.markets) ? exchange.markets : [];
    return markets
      .filter(market => !market.status || market.status === 'active')
      .map(market => compactObject({
        '@type': 'PropertyValue',
        name: `${exchange.label} ${market.label || market.instrumentId} ${config.metricName}`,
        description: config.description,
        propertyID: `${exchange.id}:${market.instrumentId}:${config.propertySuffix}`,
        unitText: config.unitText,
        measurementTechnique: exchange.dataSourceLabel,
        valueReference: {
          '@type': 'DefinedTerm',
          name: config.valueReferenceName,
          termCode: config.propertySuffix,
        },
        additionalProperty: [
          {
            '@type': 'PropertyValue',
            name: 'exchange',
            value: exchange.fullName || exchange.label || exchange.id,
            propertyID: exchange.id,
          },
          {
            '@type': 'PropertyValue',
            name: 'instrument',
            value: market.label || market.instrumentId,
            propertyID: market.instrumentId,
          },
        ],
      }));
  });
}

function datasetJsonLd({ pageId, origin } = {}) {
  const normalizedPageId = normalizePageId(pageId);
  const page = PAGE_CONFIGS[normalizedPageId];
  if (!page || !DATASET_MEASUREMENT_CONFIGS[normalizedPageId]) return null;

  const siteOrigin = resolveSiteOrigin(origin);
  const dataSources = exchangesForDataset(normalizedPageId)
    .map(exchange => exchange.dataSourceLabel)
    .filter(Boolean);

  return compactObject({
    '@context': 'https://schema.org',
    '@type': 'Dataset',
    '@id': `${absoluteUrl(page.path, siteOrigin)}#dataset`,
    name: page.datasetName,
    description: page.datasetDescription,
    url: absoluteUrl(page.path, siteOrigin),
    inLanguage: LANGUAGE,
    isAccessibleForFree: true,
    creator: {
      '@id': `${siteOrigin}/#organization`,
    },
    publisher: {
      '@id': `${siteOrigin}/#organization`,
    },
    measurementTechnique: Array.from(new Set(dataSources)),
    variableMeasured: buildDatasetVariableMeasured(normalizedPageId),
  });
}

function breadcrumbJsonLd(items, options = {}) {
  const origin = resolveSiteOrigin(options.origin);
  const itemListElement = (items || [])
    .map((item, index) => {
      const name = typeof item === 'string' ? item : item.name || item.title;
      const itemUrl = typeof item === 'string' ? '' : item.url || item.href || item.item || '';
      return compactObject({
        '@type': 'ListItem',
        position: index + 1,
        name,
        item: itemUrl ? absoluteUrl(itemUrl, origin) : undefined,
      });
    })
    .filter(item => item.name);

  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement,
  };
}

module.exports = {
  SITE_NAME,
  DEFAULT_SITE_ORIGIN,
  PAGE_CONFIGS,
  absoluteUrl,
  breadcrumbJsonLd,
  datasetJsonLd,
  getPageConfig,
  normalizePageId,
  organizationJsonLd,
  resolveSiteOrigin,
  webApplicationJsonLd,
};
