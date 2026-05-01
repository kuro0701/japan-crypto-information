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
const { getMarketResearchContent } = require('../market-research-content');

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
      path: '/exchanges',
      lastmod: fileLastmod(path.join(publicDir, 'exchange.html')),
      priority: '0.8',
    },
    {
      path: '/campaigns',
      lastmod: fileLastmod(path.join(publicDir, 'campaigns.html')),
      priority: '0.8',
    },
    {
      path: '/learn',
      lastmod: fileLastmod(path.join(publicDir, 'templates', 'article.html')),
      priority: '0.8',
    },
    {
      path: '/research',
      lastmod: fileLastmod(path.join(publicDir, 'templates', 'article.html')),
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
    const withHead = html.replace(HEAD_META_INJECT, renderHeadMeta({
      ...metaOptions,
      siteOrigin: requestOrigin(req),
    }));
    return injectCommonDisclosure(withHead, navOptionsForPage(metaOptions && metaOptions.pageId));
  }

  function renderPublicPage(req, fileName, metaOptions) {
    return publicHtmlWithMeta(req, path.join(publicDir, fileName), metaOptions);
  }

  function renderStaticPublicPage(fileName) {
    const html = fs.readFileSync(path.join(publicDir, fileName), 'utf8');
    return injectCommonDisclosure(html);
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

  const siteNavGroups = [
    {
      id: 'comparison',
      label: '比較',
      items: [
        { label: '板シミュレーター', href: '/simulator' },
        { label: '販売所スプレッド', href: '/sales-spread' },
        { label: '出来高シェア', href: '/volume-share' },
        { label: '手数料比較', href: '/learn/crypto-fees' },
      ],
    },
    {
      id: 'markets',
      label: '銘柄',
      items: [
        { label: '銘柄一覧', href: '/markets' },
        { label: 'BTC', href: '/markets/BTC-JPY' },
        { label: 'ETH', href: '/markets/ETH-JPY' },
        { label: 'XRP', href: '/markets/XRP-JPY' },
        { label: 'SOL', href: '/markets/SOL-JPY' },
      ],
    },
    {
      id: 'exchanges',
      label: '取引所',
      items: [
        { label: '取引所一覧', href: '/exchanges' },
        { label: 'bitFlyer', href: '/exchanges/bitflyer' },
        { label: 'Coincheck', href: '/exchanges/coincheck' },
        { label: 'GMOコイン', href: '/exchanges/gmo-coin' },
        { label: 'bitbank', href: '/exchanges/bitbank' },
      ],
    },
    {
      id: 'learn',
      label: '学ぶ',
      items: [
        { label: '初心者ガイド', href: '/learn' },
        { label: '販売所と取引所の違い', href: '/learn/exchange-vs-broker' },
        { label: 'スプレッドとは', href: '/learn/spread' },
        { label: '板取引とは', href: '/learn/order-book-trading' },
        { type: 'separator' },
        { label: 'このサイトについて', href: '/about' },
        { label: 'データ取得元', href: '/about#data-sources' },
        { label: 'PR表記', href: '/about#pr-disclosure' },
        { label: '免責事項', href: '/about#disclaimer' },
      ],
    },
  ];

  function navOptionsForPage(pageId) {
    const byPageId = {
      home: { activeSection: 'comparison', activePath: '/' },
      simulator: { activeSection: 'comparison', activePath: '/simulator' },
      'sales-spread': { activeSection: 'comparison', activePath: '/sales-spread' },
      'volume-share': { activeSection: 'comparison', activePath: '/volume-share' },
      markets: { activeSection: 'markets', activePath: '/markets' },
      market: { activeSection: 'markets', activePath: '/markets' },
    };
    return byPageId[pageId] || {};
  }

  function normalizeNavPath(value) {
    const raw = String(value || '').trim();
    if (!raw) return '';
    const pathOnly = raw.split('#')[0].split('?')[0].replace(/\/+$/, '');
    return pathOnly || '/';
  }

  function navSectionForPath(value) {
    const navPath = normalizeNavPath(value);
    if (navPath === '/' || navPath === '/simulator' || navPath === '/sales-spread' || navPath === '/volume-share') {
      return 'comparison';
    }
    if (navPath === '/learn/crypto-fees') return 'comparison';
    if (navPath === '/markets' || navPath.startsWith('/markets/')) return 'markets';
    if (navPath === '/exchanges' || navPath.startsWith('/exchanges/')) return 'exchanges';
    if (navPath === '/learn' || navPath.startsWith('/learn/') || navPath === '/about') return 'learn';
    return '';
  }

  function inferLegacyNavState(html) {
    const match = String(html).match(/<a[^>]*class="[^"]*\bnav-link\b[^"]*\bis-active\b[^"]*"[^>]*href="([^"]+)"/);
    if (!match) return {};
    const activePath = normalizeNavPath(match[1]);
    return {
      activePath,
      activeSection: navSectionForPath(activePath),
    };
  }

  function isActiveNavItem(itemHref, activePath) {
    if (String(itemHref || '').includes('#') && !String(activePath || '').includes('#')) return false;
    const itemPath = normalizeNavPath(itemHref);
    const currentPath = normalizeNavPath(activePath);
    if (!itemPath || !currentPath) return false;
    if (itemPath === currentPath) return true;
    return itemPath !== '/' && currentPath.startsWith(`${itemPath}/`);
  }

  function renderSiteNavigation(options = {}) {
    const activePath = options.activePath || '';
    const activeSection = options.activeSection || navSectionForPath(activePath);
    const groups = siteNavGroups.map((group) => {
      const isActiveGroup = group.id === activeSection;
      const summaryClass = ['nav-link', 'nav-group__summary', isActiveGroup ? 'is-active' : ''].filter(Boolean).join(' ');
      const ariaCurrent = isActiveGroup ? ' aria-current="page"' : '';
      const items = group.items.map((item) => {
        if (item.type === 'separator') {
          return '        <span class="nav-dropdown__separator" aria-hidden="true"></span>';
        }
        const linkClass = ['nav-dropdown__link', isActiveNavItem(item.href, activePath) ? 'is-active' : ''].filter(Boolean).join(' ');
        return `        <a class="${linkClass}" href="${xmlEscape(item.href)}">${xmlEscape(item.label)}</a>`;
      }).join('\n');

      return [
        `      <details class="nav-group" data-nav-section="${xmlEscape(group.id)}">`,
        `        <summary class="${summaryClass}"${ariaCurrent}>`,
        `          <span>${xmlEscape(group.label)}</span>`,
        '          <span class="nav-group__chevron" aria-hidden="true">⌄</span>',
        '        </summary>',
        '        <div class="nav-dropdown">',
        items,
        '        </div>',
        '      </details>',
      ].join('\n');
    }).join('\n');

    return [
      '    <nav class="nav-menu nav-menu--grouped" aria-label="グローバルナビゲーション">',
      groups,
      '    </nav>',
    ].join('\n');
  }

  function injectSiteNavigation(html, options = {}) {
    const legacyState = inferLegacyNavState(html);
    const navOptions = {
      ...legacyState,
      ...options,
    };
    return String(html).replace(
      /\s{4}<nav class="nav-menu" aria-label="ページ間ナビゲーション">[\s\S]*?\n\s{4}<\/nav>/,
      `\n${renderSiteNavigation(navOptions)}`
    );
  }

  function renderCommonDisclosure() {
    return [
      '    <section class="panel panel--dense common-disclosure" aria-labelledby="common-disclosure-title">',
      '      <div class="panel-title-row mb-3">',
      '        <div>',
      '          <p class="panel-kicker mb-2">Disclosure</p>',
      '          <h2 id="common-disclosure-title" class="panel-title">重要な注意事項 / PR表記</h2>',
      '        </div>',
      '      </div>',
      '      <div class="common-disclosure__grid">',
      '        <div class="common-disclosure__item">',
      '          <h3>投資判断とリスク</h3>',
      '          <p>本サイトの情報は、暗号資産取引所の比較・情報提供を目的としたものであり、投資助言ではありません。暗号資産は価格変動リスクがあり、元本が保証されるものではありません。</p>',
      '          <p>取引・口座開設の判断は、各取引所の公式情報、手数料、注文条件、リスク説明を確認のうえ、ご自身の責任で行ってください。</p>',
      '        </div>',
      '        <div class="common-disclosure__item">',
      '          <h3>データと更新</h3>',
      '          <p>表示している価格、出来高、スプレッド、手数料、シミュレーション結果は、公開情報と取得時点データを機械的に整理した参考値です。実際の約定価格、約定可否、損益を保証するものではありません。</p>',
      '          <p>公開API / WebSocket の取得失敗、配信遅延、一時停止、欠損により、表示内容が最新の公式画面と異なる場合があります。</p>',
      '        </div>',
      '        <div class="common-disclosure__item">',
      '          <h3>広告・アフィリエイト</h3>',
      '          <p>本ページには広告・PR・アフィリエイトリンクが含まれる場合があります。紹介リンクの有無は各ページの公式リンク欄やキャンペーン一覧で確認できます。</p>',
      '          <p>掲載順位や評価基準は、各ページの比較基準・データ定義に基づきます。キャンペーン情報の最終確認日は、キャンペーン一覧・詳細ページの「最終確認日」を確認してください。</p>',
      '        </div>',
      '      </div>',
      '    </section>',
    ].join('\n');
  }

  function injectCommonDisclosure(html, options = {}) {
    const withNavigation = injectSiteNavigation(html, options);
    if (String(withNavigation).includes('class="panel panel--dense common-disclosure"')) return withNavigation;
    if (!String(withNavigation).includes('</main>')) return withNavigation;
    return String(withNavigation).replace('</main>', `${renderCommonDisclosure()}\n  </main>`);
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

  function fundingSummaryLabel(funding) {
    if (!funding) return '公式条件確認';
    const summary = funding.summary || 'JPY入出金 / 暗号資産入出庫';
    const status = funding.statusLabel || '公式条件確認';
    return `${summary} (${status})`;
  }

  function fundingSupportSummary(exchanges) {
    const items = exchanges || [];
    const supportedCount = items.filter(exchange => (
      exchange
      && exchange.funding
      && exchange.funding.fiatDeposit
      && exchange.funding.fiatWithdrawal
      && exchange.funding.cryptoDeposit
      && exchange.funding.cryptoWithdrawal
    )).length;
    return {
      exchangeCount: items.length,
      supportedCount,
      summary: supportedCount === items.length && items.length > 0
        ? `${supportedCount}社すべて`
        : `${supportedCount}/${items.length}社`,
      note: 'JPY入出金・暗号資産入出庫は銀行、銘柄、ネットワークごとの条件を公式確認',
    };
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
        funding: exchangeInfo ? exchangeInfo.funding : null,
        fundingLabel: exchangeInfo ? fundingSummaryLabel(exchangeInfo.funding) : '公式条件確認',
      };
    });
    const fundingSupport = fundingSupportSummary(supportedExchanges);

    const enriched = {
      ...market,
      exchangeCount: market.exchanges.length,
      exchangeLabels: market.exchanges.map(exchange => exchange.label),
      supportedExchanges,
      fundingSupport,
      hasOrderbook: market.exchanges.length > 0,
      hasSales: Boolean(bestSpread),
      topVolumeExchangeLabel: topVolume ? topVolume.exchangeLabel : null,
      instrumentTotalQuoteVolume: instrumentVolume ? instrumentVolume.quoteVolume : 0,
      bestSpreadExchangeLabel: bestSpread ? bestSpread.exchangeLabel : null,
      bestSpreadPct: bestSpread ? bestSpread.spreadPct : null,
    };

    return {
      ...enriched,
      research: getMarketResearchContent(enriched),
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

  function buildMarketConclusionContent(market) {
    const research = market.research || getMarketResearchContent(market);
    const baseCurrency = String(market.baseCurrency || market.label || '').toUpperCase();
    const assetName = baseCurrency || market.label;
    const exchangeCount = Number(market.exchangeCount || 0);

    if (baseCurrency === 'BTC') {
      return {
        title: 'BTCの要点',
        verdict: 'BTCは国内取引所で流動性が高い一方、販売所で購入する場合はスプレッドに注意が必要です。',
        bullets: [
          '代表的な暗号資産',
          '国内主要取引所で広く取扱あり',
          '板は比較的厚い傾向がある',
          '販売所ではスプレッドに注意',
          '少額購入でも取引所形式を確認したい銘柄',
        ],
      };
    }

    const coverageText = exchangeCount >= 5
      ? '国内主要取引所で広く取扱あり'
      : exchangeCount >= 2
        ? '国内で複数取引所を比較できる'
        : '国内取扱は限られるため対応取引所の確認が先';
    const liquidityText = market.topVolumeExchangeLabel
      ? `出来高は ${market.topVolumeExchangeLabel} を起点に確認しやすい`
      : '板の厚みと出来高を注文前に確認したい';
    const spreadText = market.bestSpreadExchangeLabel
      ? '販売所では取引所ごとのスプレッド差に注意'
      : '販売所スプレッドの有無と水準を確認したい';
    const orderText = exchangeCount >= 2
      ? '少額購入でも取引所形式と販売所形式を分けて見たい銘柄'
      : '注文前に取引方式、最小注文数量、出金条件を確認したい銘柄';

    return {
      title: `${assetName}の要点`,
      verdict: `${assetName}は${research.category}として扱われる暗号資産です。国内で購入する場合は、取扱取引所、板の厚み、販売所スプレッドを分けて確認してください。`,
      bullets: [
        `${research.category}として扱われる銘柄`,
        coverageText,
        liquidityText,
        spreadText,
        orderText,
      ],
    };
  }

  function renderMarketConclusionCard(market) {
    const conclusion = buildMarketConclusionContent(market);
    const dataPoints = [
      {
        label: '取扱',
        value: `${formatCount(market.exchangeCount)}社`,
      },
      {
        label: '出来高',
        value: market.topVolumeExchangeLabel || 'データ待ち',
      },
      {
        label: '販売所最小',
        value: market.bestSpreadExchangeLabel
          ? `${market.bestSpreadExchangeLabel}${market.bestSpreadPct != null ? ` ${formatPct(market.bestSpreadPct)}` : ''}`
          : 'データ待ち',
      },
    ];

    return [
      '<article class="market-conclusion-card">',
      '  <div class="market-conclusion-card__header">',
      '    <div>',
      '      <p class="market-insight-card__eyebrow">Conclusion</p>',
      `      <h3 class="market-conclusion-card__title">${xmlEscape(conclusion.title)}</h3>`,
      '    </div>',
      `    <span class="market-insight-card__badge">${xmlEscape(market.label)}</span>`,
      '  </div>',
      `  <p class="market-conclusion-card__verdict">${xmlEscape(conclusion.verdict)}</p>`,
      '  <ul class="market-conclusion-list">',
      conclusion.bullets.map(item => `    <li>${xmlEscape(item)}</li>`).join('\n'),
      '  </ul>',
      '  <dl class="market-conclusion-facts">',
      dataPoints.map(item => [
        '    <div>',
        `      <dt>${xmlEscape(item.label)}</dt>`,
        `      <dd>${xmlEscape(item.value)}</dd>`,
        '    </div>',
      ].join('\n')).join('\n'),
      '  </dl>',
      '  <p class="market-insight-card__note">投資判断ではなく、取引前の確認観点として整理しています。実際の条件は各取引所の公式画面を確認してください。</p>',
      '</article>',
    ].join('\n');
  }

  function buildMarketSnapshotMetrics(market, snapshot) {
    const boardFreshnessText = snapshot && snapshot.boardFreshness === 'stale'
      ? '現在は stale 板を含む参考値です'
      : '板は fresh データを優先して集計しています';
    const amountText = snapshot && snapshot.comparisonAmount && Number.isFinite(Number(snapshot.comparisonAmount.amount))
      ? `${formatJpyPrice(snapshot.comparisonAmount.amount)}買い / 各取引所既定 taker`
      : '10万円買い / 各取引所既定 taker';
    const fundingSupport = (snapshot && snapshot.fundingSupport) || market.fundingSupport || fundingSupportSummary(market.supportedExchanges);

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
          key: 'funding-support',
          label: '入出金対応',
          value: fundingSupport ? fundingSupport.summary : '公式確認',
          meta: fundingSupport ? fundingSupport.note : 'JPY入出金・暗号資産入出庫は公式条件確認',
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
      '    <span class="market-insight-card__badge">比較サマリー</span>',
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
      '  <p class="market-insight-card__note">板が厚い取引所は公開板の Bid + Ask 可視深さを JPY 換算した参考値です。10万円購入時の最安候補は各取引所の既定 taker 手数料を含む買い比較です。入出金対応は公式条件確認を前提にしたチェック項目です。</p>',
      '</article>',
    ].join('\n');
  }

  function renderMarketProfileCards(market) {
    const research = market.research || getMarketResearchContent(market);
    const domesticAvailability = research.domesticAvailability || {};
    const chips = [
      research.category,
      market.exchangeCount ? `${market.exchangeCount}社対応` : '',
      market.topVolumeExchangeLabel ? `出来高首位 ${market.topVolumeExchangeLabel}` : '',
      market.bestSpreadExchangeLabel ? `販売所最小 ${market.bestSpreadExchangeLabel}` : '',
    ].filter(Boolean);
    const profileFacts = [
      { label: 'ティッカー', value: research.ticker || market.baseCurrency || market.instrumentId },
      { label: '名称', value: research.name || market.label },
      { label: 'ネットワーク', value: research.network || '公式プロジェクト情報を確認' },
      { label: '発行上限', value: research.maxSupply || '公式プロジェクト情報を確認' },
      { label: 'コンセンサス方式', value: research.consensus || '公式プロジェクト情報を確認' },
      { label: '国内取扱状況', value: domesticAvailability.summary || `${market.exchangeCount || 0}社対応` },
    ];
    const exchangeLabels = (domesticAvailability.exchangeLabels || market.exchangeLabels || [])
      .filter(Boolean)
      .slice(0, 10);
    const localNotes = [
      market.exchangeCount ? `国内現物では ${market.exchangeCount}社で取扱を確認できます。` : '',
      market.topVolumeExchangeLabel ? `出来高は ${market.topVolumeExchangeLabel} を起点に見ると比較しやすい状態です。` : '出来高データは取得でき次第、取引所別に比較できます。',
      market.bestSpreadExchangeLabel ? `販売所スプレッドは ${market.bestSpreadExchangeLabel} が相対的に狭い参考値です。` : '販売所スプレッドは取得できた販売所から順に表示します。',
    ].filter(Boolean);
    const domesticNotes = (domesticAvailability.notes && domesticAvailability.notes.length > 0)
      ? domesticAvailability.notes
      : localNotes;

    return [
      '<article class="market-insight-card market-insight-card--profile">',
      '  <div class="market-insight-card__header">',
      '    <div>',
      '      <p class="market-insight-card__eyebrow">Profile</p>',
      `      <h3 class="market-insight-card__title">${xmlEscape(market.label)} は何に使われる？</h3>`,
      '    </div>',
      `    <span class="market-insight-card__badge">${xmlEscape(research.category)}</span>`,
      '  </div>',
      `  <p class="market-insight-card__lead">${xmlEscape(research.plainUse)}</p>`,
      '  <dl class="market-profile-facts">',
      profileFacts.map(item => [
        '    <div class="market-profile-fact">',
        `      <dt>${xmlEscape(item.label)}</dt>`,
        `      <dd>${xmlEscape(item.value)}</dd>`,
        '    </div>',
      ].join('\n')).join('\n'),
      '  </dl>',
      '  <div class="market-insight-card__chips">',
      chips.map(item => `    <span>${xmlEscape(item)}</span>`).join('\n'),
      '  </div>',
      '  <div class="market-insight-card__block">',
      '    <h4 class="market-insight-card__subtitle">主な用途</h4>',
      '    <ol class="market-insight-checklist">',
      (research.useCases || []).map(item => `      <li>${xmlEscape(item)}</li>`).join('\n'),
      '    </ol>',
      '  </div>',
      '</article>',
      '<article class="market-insight-card market-insight-card--summary">',
      '  <div class="market-insight-card__header">',
      '    <div>',
      '      <p class="market-insight-card__eyebrow">Traits</p>',
      `      <h3 class="market-insight-card__title">${xmlEscape(market.label)} の関連リスクと国内取扱状況</h3>`,
      '    </div>',
      '    <span class="market-insight-card__badge">国内比較メモ</span>',
      '  </div>',
      '  <div class="market-insight-card__block">',
      '    <h4 class="market-insight-card__subtitle">特徴</h4>',
      '    <ol class="market-insight-checklist">',
      (research.traits || []).map(item => `      <li>${xmlEscape(item)}</li>`).join('\n'),
      '    </ol>',
      '  </div>',
      '  <div class="market-insight-card__block">',
      '    <h4 class="market-insight-card__subtitle">関連するリスク</h4>',
      '    <ol class="market-insight-checklist">',
      (research.risks || []).map(item => `      <li>${xmlEscape(item)}</li>`).join('\n'),
      '    </ol>',
      '  </div>',
      '  <div class="market-insight-card__block">',
      '    <h4 class="market-insight-card__subtitle">国内取扱状況</h4>',
      `    <p class="market-insight-card__copy">${xmlEscape(domesticAvailability.summary || `${market.exchangeCount || 0}社対応`)}</p>`,
      exchangeLabels.length > 0 ? [
        '    <div class="market-insight-card__chips market-insight-card__chips--compact">',
        exchangeLabels.map(label => `      <span>${xmlEscape(label)}</span>`).join('\n'),
        '    </div>',
      ].join('\n') : '',
      '    <ol class="market-insight-checklist">',
      domesticNotes.map(item => `      <li>${xmlEscape(item)}</li>`).join('\n'),
      '    </ol>',
      '  </div>',
      '</article>',
    ].join('\n');
  }

  function buildMarketPreTradeChecklist(market) {
    const research = market.research || getMarketResearchContent(market);
    return {
      lead: 'この銘柄を買う前に見るポイント',
      checks: [
        '販売所ではなく取引所で買えるか',
        '板が十分に厚いか',
        'スプレッドが広すぎないか',
        '入出金に対応しているか',
        '最小注文数量はいくらか',
        '価格変動リスクを理解しているか',
      ],
      cautions: (research.risks || [])
        .concat(research.beginnerCautions || [])
        .filter(Boolean)
        .slice(0, 6),
    };
  }

  function renderMarketPreTradeCheckCards(market) {
    const checklist = buildMarketPreTradeChecklist(market);

    return [
      '<article class="market-insight-card market-insight-card--checklist">',
      '  <div class="market-insight-card__header">',
      '    <div>',
      '      <p class="market-insight-card__eyebrow">Before Trade</p>',
      '      <h3 class="market-insight-card__title">注文前のチェックリスト</h3>',
      '    </div>',
      '    <span class="market-insight-card__badge">Check</span>',
      '  </div>',
      `  <p class="market-insight-card__lead">${xmlEscape(checklist.lead)}</p>`,
      '  <ul class="market-insight-checkbox-list">',
      checklist.checks.map(item => [
        '    <li>',
        '      <span class="market-insight-checkbox-list__box" aria-hidden="true"></span>',
        `      <span>${xmlEscape(item)}</span>`,
        '    </li>',
      ].join('\n')).join('\n'),
      '  </ul>',
      '</article>',
      '<article class="market-insight-card market-insight-card--warning">',
      '  <div class="market-insight-card__header">',
      '    <div>',
      '      <p class="market-insight-card__eyebrow">Caution</p>',
      `      <h3 class="market-insight-card__title">${xmlEscape(market.label)} で注意する点</h3>`,
      '    </div>',
      '    <span class="market-insight-card__badge">Risk</span>',
      '  </div>',
      '  <ol class="market-insight-checklist">',
      checklist.cautions.map(item => `    <li>${xmlEscape(item)}</li>`).join('\n'),
      '  </ol>',
      '  <p class="market-insight-card__note">手数料、注文条件、取扱銘柄、出金条件は変更されることがあります。発注前の最終確認は公式情報を優先してください。</p>',
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

    return injectCommonDisclosure(template
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
      .replace('<!-- CAMPAIGN_ROWS -->', renderCampaignRows(campaigns)));
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

    return injectCommonDisclosure(template
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
      .replace('<!-- CAMPAIGN_LINK_CARDS -->', renderCampaignLinkCards(model)));
  }

  const LEARN_ARTICLE_ORDER = [
    '/learn/exchange-vs-broker',
    '/learn/spread',
    '/learn/order-book-trading',
    '/learn/slippage',
    '/learn/market-order-risk',
    '/learn/crypto-fees',
    '/learn/exchange-company-analysis',
    '/learn/how-to-compare-exchanges',
  ];

  function learnArticleRank(article) {
    const index = LEARN_ARTICLE_ORDER.indexOf(article.path);
    return index === -1 ? LEARN_ARTICLE_ORDER.length : index;
  }

  function listLearnArticles() {
    return listArticles()
      .filter(article => String(article.path || '').startsWith('/learn/'))
      .sort((a, b) => {
        const rankDiff = learnArticleRank(a) - learnArticleRank(b);
        if (rankDiff !== 0) return rankDiff;
        return String(a.title || '').localeCompare(String(b.title || ''), 'ja');
      });
  }

  function learnStructuredData(articles, origin, description) {
    const pageUrl = siteUrl(origin, '/learn');
    return [
      {
        '@context': 'https://schema.org',
        '@type': 'CollectionPage',
        name: '初心者向け暗号資産取引ガイド',
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
        name: '初心者向け暗号資産取引ガイド一覧',
        url: pageUrl,
        itemListElement: articles.map((article, index) => ({
          '@type': 'ListItem',
          position: index + 1,
          name: article.title,
          url: siteUrl(origin, article.path),
        })),
      },
    ];
  }

  function renderLearnArticleCards(articles) {
    if (articles.length === 0) {
      return '<p class="text-center text-gray-500 py-8">初心者向け記事を準備中です。</p>';
    }

    return articles.map(article => [
      `<a class="home-popular-link" href="${xmlEscape(article.path)}">`,
      `  <strong>${xmlEscape(article.title)}</strong>`,
      `  <span>${xmlEscape(article.description)}</span>`,
      '</a>',
    ].join('\n')).join('\n');
  }

  function renderLearnIndexHtml(req) {
    const origin = requestOrigin(req);
    const articles = listLearnArticles();
    const title = `初心者向け暗号資産取引ガイド｜${SITE_NAME}`;
    const description = '販売所と取引所の違い、スプレッド、スリッページ、成行注文、手数料、取引所比較の見方を初心者向けに整理した学習ページです。';
    const head = renderHeadMeta({
      title,
      description,
      canonical: '/learn',
      ogImage: '/ogp/default.png',
      pageId: 'home',
      includeDefaultJsonLd: false,
      structuredData: learnStructuredData(articles, origin, description),
      siteOrigin: origin,
    });

    return injectCommonDisclosure([
      '<!DOCTYPE html>',
      '<html lang="ja">',
      '<head>',
      '  <meta charset="UTF-8">',
      '  <meta name="viewport" content="width=device-width, initial-scale=1.0">',
      head,
      '  <script src="https://cdn.tailwindcss.com"></script>',
      '  <link rel="preconnect" href="https://fonts.googleapis.com">',
      '  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>',
      '  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Noto+Sans+JP:wght@400;500;700&display=swap" rel="stylesheet">',
      '  <link rel="stylesheet" href="/css/style.css?v=ui-7">',
      '</head>',
      '<body class="terminal-body bg-gray-950 text-gray-200 min-h-screen">',
      '  <a href="#main" class="sr-only skip-link">メインコンテンツへスキップ</a>',
      '  <header class="topbar px-6 py-3">',
      '    <div class="brand-cluster">',
      '      <div class="brand-mark" aria-hidden="true">₿</div>',
      '      <div class="brand-copy min-w-0">',
      `        <h1 class="page-title">${xmlEscape(SITE_NAME)}</h1>`,
      '        <div class="brand-subtitle">初心者向け暗号資産取引ガイド</div>',
      '      </div>',
      '    </div>',
      '    <nav class="nav-menu" aria-label="ページ間ナビゲーション">',
      '      <a class="nav-link" href="/">ホーム</a>',
      '      <a class="nav-link" href="/research">調べる</a>',
      '      <a class="nav-link is-active" href="/learn" aria-current="page">初心者ガイド</a>',
      '      <a class="nav-link" href="/simulator">板シミュレーター</a>',
      '      <a class="nav-link" href="/markets">銘柄ページ</a>',
      '      <a class="nav-link" href="/sales-spread">販売所スプレッド</a>',
      '    </nav>',
      '  </header>',
      '  <main id="main" class="dashboard-shell home-shell flex flex-col gap-4 p-4 max-w-[1180px] mx-auto">',
      '    <section class="panel panel--dense">',
      '      <div class="panel-title-row mb-4">',
      '        <div>',
      '          <p class="panel-kicker mb-2">Learn</p>',
      '          <h2 class="text-3xl md:text-4xl font-bold text-gray-100">初心者向け暗号資産取引ガイド</h2>',
      `          <p class="text-sm text-gray-400 mt-3 leading-7">${xmlEscape(description)}</p>`,
      '        </div>',
      '      </div>',
      '      <div class="home-popular-grid">',
      renderLearnArticleCards(articles),
      '      </div>',
      '    </section>',
      renderCompareToolSection('learn-compare-tools-title'),
      '  </main>',
      `  <footer class="border-t border-gray-800 px-6 py-2 text-xs text-gray-600 text-center">${xmlEscape(SITE_NAME)} | 初心者ガイド</footer>`,
      '</body>',
      '</html>',
    ].join('\n'), { activeSection: 'learn', activePath: '/learn' });
  }

  function researchStructuredData(origin, description) {
    const pageUrl = siteUrl(origin, '/research');
    return [
      {
        '@context': 'https://schema.org',
        '@type': 'CollectionPage',
        name: '調べる',
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
        '@type': 'FAQPage',
        mainEntity: [
          {
            '@type': 'Question',
            name: '取引所リサーチでは何を確認する？',
            acceptedAnswer: {
              '@type': 'Answer',
              text: '手数料、取扱銘柄、運営会社、財務情報、顧客資産管理、板の厚みを分けて確認します。',
            },
          },
          {
            '@type': 'Question',
            name: '銘柄リサーチでは何を確認する？',
            acceptedAnswer: {
              '@type': 'Answer',
              text: '銘柄の特徴、用途、リスク、国内対応取引所、販売所スプレッド、出来高を確認します。',
            },
          },
          {
            '@type': 'Question',
            name: '初心者ガイドでは何を学べる？',
            acceptedAnswer: {
              '@type': 'Answer',
              text: '販売所と取引所の違い、スプレッド、板取引、成行注文、手数料の見方を学べます。',
            },
          },
          {
            '@type': 'Question',
            name: 'この取引所は信頼できる？',
            acceptedAnswer: {
              '@type': 'Answer',
              text: '登録状況、運営会社、顧客資産管理、障害対応、手数料、板の厚みを分けて確認します。',
            },
          },
          {
            '@type': 'Question',
            name: 'この銘柄は何に使われる？',
            acceptedAnswer: {
              '@type': 'Answer',
              text: '銘柄プロフィールで用途、特徴、リスク、国内取扱取引所を確認します。',
            },
          },
          {
            '@type': 'Question',
            name: '初心者が注意すべき点は？',
            acceptedAnswer: {
              '@type': 'Answer',
              text: '販売所スプレッド、成行注文のスリッページ、送金条件、取扱変更リスクを確認します。',
            },
          },
        ],
      },
    ];
  }

  function renderResearchQuestionChips() {
    return [
      '手数料・取扱銘柄・運営会社は？',
      '特徴・用途・リスクは？',
      '対応取引所はどこ？',
      '販売所と取引所の違いは？',
      '板取引で何を見る？',
    ].map(item => `<span>${xmlEscape(item)}</span>`).join('\n');
  }

  function renderResearchPathwayCards() {
    const pathways = [
      {
        step: '3-1',
        title: '取引所リサーチ',
        description: '手数料、取扱銘柄、運営会社、財務情報を確認',
        href: '#research-exchanges',
        cta: '取引所を見る',
        checks: [
          '既定 taker 手数料と通常時コストを見る',
          '板取引・販売所それぞれの取扱銘柄を見る',
          '運営会社、登録状況、財務情報の確認観点を見る',
        ],
      },
      {
        step: '3-2',
        title: '銘柄リサーチ',
        description: '銘柄の特徴、用途、リスク、対応取引所を確認',
        href: '#research-markets',
        cta: '銘柄を見る',
        checks: [
          '主要銘柄の用途と特徴を先に把握する',
          '価格変動、流動性、送金条件などのリスクを見る',
          '対応取引所と板・販売所データの有無を見る',
        ],
      },
      {
        step: '3-3',
        title: '初心者ガイド',
        description: '販売所と取引所の違い、スプレッド、板取引を学ぶ',
        href: '#research-guides',
        cta: 'ガイドを読む',
        checks: [
          '販売所と取引所の価格の決まり方を学ぶ',
          'スプレッドと手数料の違いを整理する',
          '板取引、成行注文、スリッページの見方を学ぶ',
        ],
      },
    ];

    return pathways.map((pathway) => [
      `<a class="research-pathway-card" href="${xmlEscape(pathway.href)}">`,
      '  <div class="research-pathway-card__header">',
      `    <span class="research-pathway-card__step">${xmlEscape(pathway.step)}</span>`,
      '    <div>',
      `      <h3 class="research-pathway-card__title">${xmlEscape(pathway.title)}</h3>`,
      `      <p class="research-pathway-card__description">${xmlEscape(pathway.description)}</p>`,
      '    </div>',
      '  </div>',
      '  <ul class="research-pathway-card__list">',
      pathway.checks.map(item => `    <li>${xmlEscape(item)}</li>`).join('\n'),
      '  </ul>',
      `  <span class="research-pathway-card__cta">${xmlEscape(pathway.cta)}</span>`,
      '</a>',
    ].join('\n')).join('\n');
  }

  function renderResearchExchangeCards(exchanges) {
    return exchanges.map((exchange) => [
      `<a class="market-context-card" href="${xmlEscape(exchange.path)}#exchange-research">`,
      '  <span class="market-context-card__eyebrow">Exchange Research</span>',
      `  <strong class="market-context-card__title">${xmlEscape(exchange.label)}</strong>`,
      `  <span class="market-context-card__description">${xmlEscape(`手数料 ${exchange.feeLabel} / 取扱銘柄 ${exchange.marketCount}件 / 運営会社・財務情報の確認へ`)}</span>`,
      '  <span class="market-context-card__cta">取引所リサーチへ</span>',
      '</a>',
    ].join('\n')).join('\n');
  }

  function renderResearchMarketCards(markets) {
    return markets.map((market) => {
      const research = market.research || getMarketResearchContent(market);
      return [
        `<a class="market-context-card" href="${xmlEscape(market.path)}#market-research">`,
        '  <span class="market-context-card__eyebrow">Asset Profile</span>',
        `  <strong class="market-context-card__title">${xmlEscape(market.label)}</strong>`,
        `  <span class="market-context-card__description">${xmlEscape(`${research.category} / ${market.exchangeCount}社対応 / ${research.plainUse}`)}</span>`,
        '  <span class="market-context-card__cta">特徴・用途・リスクへ</span>',
        '</a>',
      ].join('\n');
    }).join('\n');
  }

  function renderResearchGuideCards(articles) {
    const preferredPaths = [
      '/learn/exchange-vs-broker',
      '/learn/spread',
      '/learn/order-book-trading',
      '/learn/slippage',
      '/learn/crypto-fees',
      '/learn/exchange-company-analysis',
    ];
    const byPath = new Map(articles.map(article => [article.path, article]));
    const selected = preferredPaths.map(item => byPath.get(item)).filter(Boolean);

    return selected.map(article => [
      `<a class="home-popular-link" href="${xmlEscape(article.path)}">`,
      `  <strong>${xmlEscape(article.title)}</strong>`,
      `  <span>${xmlEscape(article.description)}</span>`,
      '</a>',
    ].join('\n')).join('\n');
  }

  function renderCompareToolCards() {
    const tools = [
      {
        title: '板シミュレーター',
        description: '実際の板情報から、成行注文時の想定コストを比較',
        href: '/simulator?market=BTC-JPY&side=buy&amountType=jpy&amount=100000',
      },
      {
        title: '販売所スプレッド比較',
        description: '販売所で買う場合の実質コストを確認',
        href: '/sales-spread?instrumentId=BTC-JPY',
      },
      {
        title: '出来高シェア',
        description: 'どの取引所に流動性があるかを見る',
        href: '/volume-share?instrumentId=BTC-JPY',
      },
    ];

    return tools.map((tool) => [
      `<a class="home-compare-link" href="${xmlEscape(tool.href)}">`,
      `  <strong>${xmlEscape(tool.title)}</strong>`,
      `  <span>${xmlEscape(tool.description)}</span>`,
      '</a>',
    ].join('\n')).join('\n');
  }

  function renderCompareToolSection(titleId) {
    return [
      `    <section class="panel panel--dense compare-tool-section" aria-labelledby="${xmlEscape(titleId)}">`,
      '      <div class="panel-title-row mb-4">',
      '        <div>',
      `          <h2 id="${xmlEscape(titleId)}" class="panel-title">比較する</h2>`,
      '          <p class="text-xs text-gray-500 mt-1">比較ツール導線。注文前に、板・販売所・流動性を同じ銘柄で確認できます。</p>',
      '        </div>',
      '        <span class="panel-kicker">比較ツール導線</span>',
      '      </div>',
      '      <div class="home-compare-link-grid">',
      renderCompareToolCards(),
      '      </div>',
      '    </section>',
    ].join('\n');
  }

  function renderResearchHtml(req) {
    const origin = requestOrigin(req);
    const title = `調べる｜取引所・銘柄プロフィール・初心者ガイド｜${SITE_NAME}`;
    const description = '取引所の信頼性、運営会社・財務情報の確認観点、銘柄プロフィール、特徴・リスク、初心者向けガイドをまとめて調べるページです。';
    const exchanges = getPublicExchanges()
      .filter(exchange => !exchange.status || exchange.status === 'active')
      .map(exchange => getExchangeInfo(exchange.id))
      .filter(Boolean);
    const marketModel = buildMarketIndexModel();
    const featuredMarkets = FEATURED_MARKET_IDS
      .map(instrumentId => marketModel.markets.find(market => market.instrumentId === instrumentId))
      .filter(Boolean)
      .map(market => ({
        ...market,
        research: getMarketResearchContent(market),
      }));
    const articles = listLearnArticles();
    const head = renderHeadMeta({
      title,
      description,
      canonical: '/research',
      ogImage: '/ogp/default.png',
      pageId: 'research',
      includeDefaultJsonLd: false,
      structuredData: researchStructuredData(origin, description),
      siteOrigin: origin,
    });

    return injectCommonDisclosure([
      '<!DOCTYPE html>',
      '<html lang="ja">',
      '<head>',
      '  <meta charset="UTF-8">',
      '  <meta name="viewport" content="width=device-width, initial-scale=1.0">',
      head,
      '  <script src="https://cdn.tailwindcss.com"></script>',
      '  <link rel="preconnect" href="https://fonts.googleapis.com">',
      '  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>',
      '  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Noto+Sans+JP:wght@400;500;700&display=swap" rel="stylesheet">',
      '  <link rel="stylesheet" href="/css/style.css?v=ui-13">',
      '</head>',
      '<body class="terminal-body bg-gray-950 text-gray-200 min-h-screen">',
      '  <a href="#main" class="sr-only skip-link">メインコンテンツへスキップ</a>',
      '  <header class="topbar px-6 py-3">',
      '    <div class="brand-cluster">',
      '      <div class="brand-mark" aria-hidden="true">₿</div>',
      '      <div class="brand-copy min-w-0">',
      `        <h1 class="page-title">${xmlEscape(SITE_NAME)}</h1>`,
      '        <div class="brand-subtitle">取引所・銘柄を調べる</div>',
      '      </div>',
      '    </div>',
      '    <nav class="nav-menu" aria-label="ページ間ナビゲーション">',
      '      <a class="nav-link" href="/">ホーム</a>',
      '      <a class="nav-link is-active" href="/research" aria-current="page">調べる</a>',
      '      <a class="nav-link" href="/learn">初心者ガイド</a>',
      '      <a class="nav-link" href="/simulator">板シミュレーター</a>',
      '      <a class="nav-link" href="/markets">銘柄ページ</a>',
      '      <a class="nav-link" href="/campaigns">キャンペーン</a>',
      '    </nav>',
      '  </header>',
      '  <main id="main" class="dashboard-shell home-shell flex flex-col gap-4 p-4 max-w-[1440px] mx-auto">',
      '    <section class="panel panel--dense home-role-section">',
      '      <div class="panel-title-row mb-4">',
      '        <div>',
      '          <p class="panel-kicker mb-2">Research</p>',
      '          <h2 class="text-3xl md:text-4xl font-bold text-gray-100">調べる</h2>',
      `          <p class="text-sm text-gray-400 mt-3 leading-7">${xmlEscape(description)}</p>`,
      '        </div>',
      '      </div>',
      '      <div class="home-role-card">',
      '        <div class="home-role-card__header">',
      '          <span class="home-role-card__number">3</span>',
      '          <div>',
      '            <p class="home-role-card__eyebrow">Learn / Check</p>',
      '            <h3 class="home-role-card__title">取引所や銘柄を理解する</h3>',
      '          </div>',
      '        </div>',
      '        <p class="home-role-card__lead">比較結果を見る前後に、なぜその取引所・銘柄を使うのか、どこにリスクがあるのかを確認します。</p>',
      '        <div class="home-question-row" aria-label="調べるページで答える問い">',
      renderResearchQuestionChips(),
      '        </div>',
      '      </div>',
      '    </section>',
      '    <section class="panel panel--dense research-pathway-section" aria-labelledby="research-pathway-title">',
      '      <div class="panel-title-row mb-4">',
      '        <div>',
      '          <h2 id="research-pathway-title" class="panel-title">3. リサーチ導線</h2>',
      '          <p class="text-xs text-gray-500 mt-1">調べる対象ごとに入口を分けています。比較前後の確認に使えます。</p>',
      '        </div>',
      '        <span class="panel-kicker">Research Paths</span>',
      '      </div>',
      '      <div class="research-pathway-grid">',
      renderResearchPathwayCards(),
      '      </div>',
      '    </section>',
      '    <section id="research-exchanges" class="panel panel--dense">',
      '      <div class="panel-title-row mb-4">',
      '        <div>',
      '          <h2 class="panel-title">取引所リサーチ</h2>',
      '          <p class="text-xs text-gray-500 mt-1">手数料、取扱銘柄、運営会社、財務情報を確認します</p>',
      '        </div>',
      '        <span class="panel-kicker">Exchanges</span>',
      '      </div>',
      '      <div class="market-context-grid market-context-grid--links">',
      renderResearchExchangeCards(exchanges),
      '      </div>',
      '    </section>',
      '    <section id="research-markets" class="panel panel--dense">',
      '      <div class="panel-title-row mb-4">',
      '        <div>',
      '          <h2 class="panel-title">銘柄リサーチ</h2>',
      '          <p class="text-xs text-gray-500 mt-1">銘柄の特徴、用途、リスク、対応取引所を確認します</p>',
      '        </div>',
      '        <span class="panel-kicker">Assets</span>',
      '      </div>',
      '      <div class="market-context-grid market-context-grid--links">',
      renderResearchMarketCards(featuredMarkets),
      '      </div>',
      '    </section>',
      '    <section id="research-guides" class="panel panel--dense">',
      '      <div class="panel-title-row mb-4">',
      '        <div>',
      '          <h2 class="panel-title">初心者ガイド</h2>',
      '          <p class="text-xs text-gray-500 mt-1">販売所と取引所の違い、スプレッド、板取引を学べます</p>',
      '        </div>',
      '        <span class="panel-kicker">Guides</span>',
      '      </div>',
      '      <div class="home-popular-grid">',
      renderResearchGuideCards(articles),
      '      </div>',
      '    </section>',
      renderCompareToolSection('research-compare-tools-title'),
      '  </main>',
      `  <footer class="border-t border-gray-800 px-6 py-2 text-xs text-gray-600 text-center">${xmlEscape(SITE_NAME)} | 調べる</footer>`,
      '</body>',
      '</html>',
    ].join('\n'));
  }

  function getArticleBySlug(slug) {
    return getArticle(slug);
  }

  function getLearnArticleBySlug(slug) {
    const article = getArticle(slug);
    if (!article || !String(article.path || '').startsWith('/learn/')) return null;
    return article;
  }

  function renderArticleHtml(req, article) {
    const origin = requestOrigin(req);
    const template = fs.readFileSync(path.join(publicDir, 'templates', 'article.html'), 'utf8');
    const title = `${article.title}｜${SITE_NAME}`;
    const activePath = normalizeNavPath(article.path);
    const activeSection = activePath === '/learn/crypto-fees' ? 'comparison' : 'learn';
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

    return injectCommonDisclosure(replaceTemplateSlots(withHead, {
      ARTICLE_TITLE: xmlEscape(article.title),
      ARTICLE_DESCRIPTION: xmlEscape(article.description),
      ARTICLE_DATE_ISO: xmlEscape(article.date),
      ARTICLE_DATE: xmlEscape(formatArticleDate(article.date)),
      ARTICLE_UPDATED_ISO: xmlEscape(article.updated),
      ARTICLE_UPDATED: xmlEscape(formatArticleDate(article.updated)),
      ARTICLE_PARENT_BREADCRUMB: String(article.path || '').startsWith('/learn/')
        ? '<a class="text-green-300 hover:text-green-200" href="/learn">初心者ガイド</a><span aria-hidden="true"> / </span>'
        : '',
      ARTICLE_BODY: article.html,
    }), { activeSection, activePath });
  }

  function marketStructuredData(market, origin, description) {
    const url = siteUrl(origin, marketPath(market.instrumentId));
    return [
      {
        '@context': 'https://schema.org',
        '@type': 'WebPage',
        name: `${market.label} 結論・国内取引所比較`,
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
          '取引前チェック',
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
        eyebrow: 'Exchanges',
        title: `${market.label} の国内取引所比較に戻る`,
        description: '対応取引所、板の厚み、販売所スプレッドの比較ブロックへ移動します。',
        href: '#market-exchange-comparison',
      },
      {
        eyebrow: 'Learn',
        title: '販売所と取引所の違いを読む',
        description: '同じ銘柄でも販売所と取引所形式で実質コストが変わる理由を確認できます。',
        href: '/learn/exchange-vs-broker',
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
      `  <span class="market-context-card__description">既定 taker ${xmlEscape(exchange.feeLabel)} / ${xmlEscape(`${exchange.marketCount}銘柄`)} / 入出金 ${xmlEscape(exchange.fundingLabel || '公式条件確認')}</span>`,
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
      {
        term: '入出金対応',
        description: '日本円の入出金と暗号資産の入出庫が使えるかを確認するための項目です。銀行、銘柄、ネットワーク、メンテナンス状況は公式画面で確認してください。',
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

    return injectCommonDisclosure(template
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
      .replace('<!-- MARKET_INDEX_LIST -->', renderMarketIndexCards(model.markets)), { activeSection: 'markets', activePath: marketIndexPath() });
  }

  function renderMarketHtml(req, market) {
    const origin = requestOrigin(req);
    const template = fs.readFileSync(path.join(publicDir, 'market.html'), 'utf8');
    const pageMarket = buildMarketPageModel(market);
    const title = `${pageMarket.label} 結論・国内取引所比較・取引前チェック｜${SITE_NAME}`;
    const description = `${pageMarket.label} の結論カード、国内取引所での板・出来高・販売所スプレッド比較、銘柄プロフィール、取引前チェックを1ページで確認できます。`;
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

    return injectCommonDisclosure(template
      .replace(HEAD_META_INJECT, renderHeadMeta({
        title,
        description,
        canonical: marketPath(pageMarket.instrumentId),
        ogImage: '/ogp/default.png',
        includeDefaultJsonLd: false,
        structuredData: marketStructuredData(pageMarket, origin, description),
        siteOrigin: origin,
      }))
      .replace('<!-- MARKET_CONCLUSION_CARD -->', renderMarketConclusionCard(pageMarket))
      .replace('<!-- MARKET_COMPARISON_SUMMARY_CARD -->', renderMarketComparisonSummaryCard(pageMarket, marketSnapshot))
      .replace('<!-- MARKET_PROFILE_CARDS -->', renderMarketProfileCards(pageMarket))
      .replace('<!-- MARKET_PRETRADE_CHECK_CARDS -->', renderMarketPreTradeCheckCards(pageMarket))
      .replace('<!-- MARKET_JOURNEY_LINKS -->', renderMarketJourneyLinks(pageMarket))
      .replace('<!-- MARKET_SUPPORTED_EXCHANGE_LINKS -->', renderMarketSupportedExchangeLinks(pageMarket))
      .replace('<!-- MARKET_DATA_DEFINITIONS -->', renderMarketDataDefinitions(pageMarket))
      .replace('<!-- MARKET_DISCLAIMER -->', renderMarketDisclaimer(pageMarket, aboutArticle))
      .replaceAll('__MARKET_PAGE_TITLE__', xmlEscape(`${pageMarket.label} 銘柄ページ`))
      .replaceAll('__MARKET_PAGE_SUBTITLE__', '結論・国内取引所比較・取引前チェック')
      .replaceAll('__MARKET_HERO_TITLE__', xmlEscape(`${pageMarket.label} 国内取引所データ`))
      .replaceAll('__MARKET_FOOTER_LABEL__', xmlEscape(`${pageMarket.label} 銘柄ページ`))
      .replace('__MARKET_PAGE_JSON__', safeJsonForHtml(pageConfig)), { activeSection: 'markets', activePath: marketPath(pageMarket.instrumentId) });
  }

  function buildExchangesIndexModel() {
    const exchanges = getPublicExchanges()
      .filter(exchange => !exchange.status || exchange.status === 'active')
      .map(exchange => getExchangeInfo(exchange.id))
      .filter(Boolean)
      .map(exchange => buildExchangePageModel(exchange));

    return {
      meta: {
        generatedAt: new Date().toISOString(),
        exchangeCount: exchanges.length,
        marketCount: exchanges.reduce((sum, exchange) => sum + (exchange.coverage || []).length, 0),
      },
      exchanges,
    };
  }

  function exchangeIndexStructuredData(model, origin, description) {
    const pageUrl = siteUrl(origin, '/exchanges');
    return [
      {
        '@context': 'https://schema.org',
        '@type': 'CollectionPage',
        name: '国内暗号資産取引所一覧',
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
        name: '国内暗号資産取引所一覧',
        url: pageUrl,
        itemListElement: model.exchanges.map((exchange, index) => ({
          '@type': 'ListItem',
          position: index + 1,
          name: exchange.label,
          url: siteUrl(origin, exchange.path),
        })),
      },
    ];
  }

  function renderExchangeIndexCards(exchanges) {
    if (!exchanges || exchanges.length === 0) {
      return '<p class="text-center text-gray-500 py-8">取引所データを準備中です</p>';
    }

    return exchanges.map((exchange) => {
      const spreadText = exchange.spread && exchange.spread.marketCount
        ? `販売所スプレッド ${exchange.spread.marketCount}銘柄`
        : '販売所データ待ち';
      const volumeText = exchange.volume && exchange.volume.rows && exchange.volume.rows.length
        ? `出来高データ ${exchange.volume.rows.length}銘柄`
        : '出来高データ待ち';
      return [
        `<a class="market-context-card" href="${xmlEscape(exchange.path)}">`,
        '  <span class="market-context-card__eyebrow">Exchange Directory</span>',
        `  <strong class="market-context-card__title">${xmlEscape(exchange.label)}</strong>`,
        `  <span class="market-context-card__description">${xmlEscape(`手数料 ${exchange.feeLabel} / 取扱 ${exchange.coverage.length}銘柄 / ${spreadText} / ${volumeText}`)}</span>`,
        '  <span class="market-context-card__cta">取引所詳細へ</span>',
        '</a>',
      ].join('\n');
    }).join('\n');
  }

  function renderExchangesIndexHtml(req) {
    const origin = requestOrigin(req);
    const model = buildExchangesIndexModel();
    const title = `国内暗号資産 取引所一覧｜${SITE_NAME}`;
    const description = '国内暗号資産取引所を、取扱銘柄、板取引対応、販売所スプレッド、出来高、手数料の観点で比較し、各取引所の詳細ページへ移動できます。';

    return injectCommonDisclosure([
      '<!DOCTYPE html>',
      '<html lang="ja">',
      '<head>',
      '  <meta charset="UTF-8">',
      '  <meta name="viewport" content="width=device-width, initial-scale=1.0">',
      renderHeadMeta({
        title,
        description,
        canonical: '/exchanges',
        ogImage: '/ogp/default.png',
        pageId: 'exchanges',
        includeDefaultJsonLd: false,
        structuredData: exchangeIndexStructuredData(model, origin, description),
        siteOrigin: origin,
      }),
      '  <script src="https://cdn.tailwindcss.com"></script>',
      '  <link rel="preconnect" href="https://fonts.googleapis.com">',
      '  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>',
      '  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Noto+Sans+JP:wght@400;500;700&display=swap" rel="stylesheet">',
      '  <link rel="stylesheet" href="/css/style.css?v=ui-14">',
      '</head>',
      '<body class="terminal-body bg-gray-950 text-gray-200 min-h-screen">',
      '  <a href="#main" class="sr-only skip-link">メインコンテンツへスキップ</a>',
      '  <header class="topbar px-6 py-3">',
      '    <div class="brand-cluster">',
      '      <div class="brand-mark" aria-hidden="true">₿</div>',
      '      <div class="brand-copy min-w-0">',
      `        <h1 class="page-title">${xmlEscape(SITE_NAME)}</h1>`,
      '        <div class="brand-subtitle">国内暗号資産 取引所一覧</div>',
      '      </div>',
      '    </div>',
      renderSiteNavigation({ activeSection: 'exchanges', activePath: '/exchanges' }),
      '    <div class="status-cluster" role="status" aria-live="polite" aria-atomic="true">',
      '      <span class="badge badge--live">Directory</span>',
      `      <span class="status-text">掲載: ${xmlEscape(String(model.meta.exchangeCount))}社</span>`,
      `      <span class="text-xs text-gray-600 ml-2">取扱集計: <span class="text-gray-400">${xmlEscape(formatCount(model.meta.marketCount))}</span></span>`,
      '    </div>',
      '  </header>',
      '  <main id="main" class="dashboard-shell home-shell flex flex-col gap-4 p-4 max-w-[1440px] mx-auto">',
      '    <section class="panel panel--dense">',
      '      <div class="panel-title-row mb-4">',
      '        <div>',
      '          <p class="panel-kicker mb-2">Exchanges</p>',
      '          <h2 class="text-3xl md:text-4xl font-bold text-gray-100">取引所一覧</h2>',
      `          <p class="text-sm text-gray-400 mt-3 leading-7">${xmlEscape(description)}</p>`,
      '        </div>',
      '      </div>',
      '      <div class="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">',
      `        <div class="metric-row metric-row--hero"><span class="metric-label">掲載取引所</span><span class="metric-value metric-value--hero">${xmlEscape(String(model.meta.exchangeCount))}社</span></div>`,
      `        <div class="metric-row metric-row--hero bid"><span class="metric-label">取扱銘柄集計</span><span class="metric-value metric-value--hero text-green-300">${xmlEscape(formatCount(model.meta.marketCount))}</span></div>`,
      '      </div>',
      '      <div class="market-context-grid market-context-grid--links">',
      renderExchangeIndexCards(model.exchanges),
      '      </div>',
      '    </section>',
      renderCompareToolSection('exchanges-compare-tools-title'),
      '  </main>',
      `  <footer class="border-t border-gray-800 px-6 py-2 text-xs text-gray-600 text-center">${xmlEscape(SITE_NAME)} | 取引所一覧</footer>`,
      '</body>',
      '</html>',
    ].join('\n'), { activeSection: 'exchanges', activePath: '/exchanges' });
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

  function formatExchangeSpreadMarket(row) {
    if (!row || row.spreadPct == null) return 'データ待ち';
    return `${row.label || row.instrumentId} ${formatPct(row.spreadPct, 2)}`;
  }

  function exchangeVolumeSummaryText(exchange) {
    const volumeShare = exchange.volume && exchange.volume.exchangeShare;
    if (!volumeShare) return '出来高シェアはデータ待ちです。';
    return `${formatJpyCompact(volumeShare.quoteVolume)} / 全体シェア ${formatPct(volumeShare.sharePct, 1)}`;
  }

  function exchangePageProfile(exchange) {
    return (exchange.pageContent && exchange.pageContent.profile) || {};
  }

  function exchangePageFeatures(exchange) {
    return (exchange.pageContent && exchange.pageContent.features) || {};
  }

  function exchangePageCosts(exchange) {
    return (exchange.pageContent && exchange.pageContent.costs) || {};
  }

  function exchangePageConclusion(exchange) {
    return (exchange.pageContent && exchange.pageContent.conclusion) || {};
  }

  function fallbackText(value, fallback = '公式確認') {
    if (Array.isArray(value)) return value.filter(Boolean).join('、') || fallback;
    const text = String(value || '').trim();
    return text || fallback;
  }

  function supportText(value, supportedCount, supportedLabel = 'あり', unsupportedLabel = 'データ待ち') {
    if (value) return value;
    return supportedCount > 0 ? `${supportedLabel}（${formatCount(supportedCount)}件）` : unsupportedLabel;
  }

  function formatExchangeServices(profile) {
    return fallbackText(profile.services, '公式サービス一覧で確認');
  }

  function exchangeFinancialAnalysis(exchange) {
    const profile = exchangePageProfile(exchange);
    const financial = (exchange.pageContent && exchange.pageContent.financialAnalysis) || {};
    const summary = financial.summary || {};
    const indicators = financial.indicators || {};
    const sourceSummary = fallbackText(financial.sourceSummary, '公式会社概要、決算公告、親会社IR、有価証券報告書などの公開資料で確認');
    const parentCompany = fallbackText(financial.parentCompany || profile.parentCompany, '公式会社概要で確認');

    return {
      sourceSummary,
      summary: {
        revenue: fallbackText(summary.revenue || indicators.revenue, '公開資料で推移を確認'),
        operatingProfit: fallbackText(summary.operatingProfit || indicators.operatingProfit, '公開資料で黒字 / 赤字の推移を確認'),
        netAssets: fallbackText(summary.netAssets || indicators.netAssets, '純資産額と自己資本比率を確認'),
        parentCompany,
        disclosureStatus: fallbackText(summary.disclosureStatus || financial.disclosureStatus, sourceSummary),
      },
      indicators: {
        revenue: fallbackText(indicators.revenue, '売上高または営業収益の推移を確認'),
        operatingProfit: fallbackText(indicators.operatingProfit, '営業利益の黒字 / 赤字と継続性を確認'),
        ordinaryProfit: fallbackText(indicators.ordinaryProfit, '経常利益の推移を確認'),
        netIncome: fallbackText(indicators.netIncome, '当期純利益の推移を確認'),
        netAssets: fallbackText(indicators.netAssets, '純資産額を確認'),
        equityRatio: fallbackText(indicators.equityRatio, '自己資本比率を確認'),
        operatingCashFlow: fallbackText(indicators.operatingCashFlow, '営業キャッシュフローのプラス / マイナスを確認'),
        cryptoBusinessRatio: fallbackText(indicators.cryptoBusinessRatio, '暗号資産関連事業の比率を確認'),
        parentPresence: fallbackText(indicators.parentPresence, parentCompany),
        listedCompany: fallbackText(indicators.listedCompany, '運営会社または親会社の上場有無を確認'),
        sanctions: fallbackText(indicators.sanctions, '金融庁・財務局の公表資料で行政処分歴を確認'),
        auditor: fallbackText(indicators.auditor, '監査法人を開示資料で確認'),
        disclosureUpdatedAt: fallbackText(indicators.disclosureUpdatedAt, '開示資料の更新日を確認'),
      },
      businessPosition: fallbackText(financial.businessPosition, '暗号資産交換業がグループ全体または運営会社内でどの位置づけかを確認'),
      revenueSource: fallbackText(financial.revenueSource, '販売所スプレッド、取引手数料、貸暗号資産、周辺サービスなどの収益構成を確認'),
      groupDisclosure: fallbackText(financial.groupDisclosure, '親会社・グループ会社のIR、決算公告、公式会社概要を確認'),
      disclosureMaterials: fallbackText(financial.disclosureMaterials, sourceSummary),
      cautions: Array.isArray(financial.cautions) && financial.cautions.length > 0
        ? financial.cautions
        : [
          '売上や利益の増減だけで取引所の安全性を断定しない',
          '親会社がある場合でも、暗号資産交換業者単体の財務・管理体制を確認する',
          '行政処分や障害履歴は、原因、改善状況、再発防止策まで確認する',
        ],
    };
  }

  function renderExchangeDetailList(items, options = {}) {
    const filteredItems = (items || []).filter(item => item && item.label);
    if (filteredItems.length === 0) return '';
    const classes = ['exchange-detail-list', options.compact ? 'exchange-detail-list--compact' : ''].filter(Boolean).join(' ');

    return [
      `<dl class="${classes}">`,
      filteredItems.map((item) => {
        const value = item.valueHtml != null ? item.valueHtml : xmlEscape(fallbackText(item.value));
        const classAttr = item.isLive ? ' class="exchange-detail-list__value--live"' : '';
        return [
          '  <div>',
          `    <dt>${xmlEscape(item.label)}</dt>`,
          `    <dd${classAttr}>${value}</dd>`,
          '  </div>',
        ].join('\n');
      }).join('\n'),
      '</dl>',
    ].join('\n');
  }

  function renderExchangeDefinitionCards(cards) {
    return cards.map((card) => [
      '<article class="market-definition-card">',
      card.badge ? [
        '  <div class="flex items-start justify-between gap-3">',
        '    <div>',
        `      <h3 class="market-definition-card__term">${xmlEscape(card.title)}</h3>`,
        card.descriptionHtml != null
          ? `      <p class="market-definition-card__description">${card.descriptionHtml}</p>`
          : `      <p class="market-definition-card__description">${xmlEscape(card.description)}</p>`,
        '    </div>',
        `    <span class="badge">${xmlEscape(card.badge)}</span>`,
        '  </div>',
      ].join('\n') : [
        `  <h3 class="market-definition-card__term">${xmlEscape(card.title)}</h3>`,
        card.descriptionHtml != null
          ? `  <p class="market-definition-card__description">${card.descriptionHtml}</p>`
          : `  <p class="market-definition-card__description">${xmlEscape(card.description)}</p>`,
      ].join('\n'),
      card.details ? renderExchangeDetailList(card.details, { compact: card.compactDetails }) : '',
      card.markets ? renderExchangeMarketPills(card.markets, { emptyMessage: card.emptyMessage }) : '',
      '</article>',
    ].join('\n')).join('\n');
  }

  function renderExchangeConclusionCard(exchange) {
    const boardCount = exchange.boardMarkets.length;
    const salesCount = exchange.salesMarkets.length;
    const conclusion = exchangePageConclusion(exchange);
    const profile = exchangePageProfile(exchange);
    const assetCoverage = `${fallbackText(conclusion.assetCoverage, '本サイト集計で確認')}（本サイト集計 ${formatCount(exchange.coverage.length)}件）`;
    const salesDesk = supportText(conclusion.salesDesk, salesCount);
    const exchangeFormat = supportText(conclusion.exchangeFormat, boardCount);
    const orderbookDepth = fallbackText(conclusion.orderbookDepth, exchange.thickMarkets.length > 0 ? '銘柄によって差あり' : '主要銘柄から確認');
    const operator = fallbackText(conclusion.operator || profile.parentCompany || profile.companyName, exchange.fullName || exchange.label);
    const suitableFor = fallbackText(conclusion.suitableFor || (exchange.pageContent.userTypes || [])[0], '使う銘柄と注文金額を決めて比較したい人');
    const verdict = `${exchange.label} は、順位ではなく取扱範囲、販売所/取引所形式、板の厚みを分けて確認する候補です。`;

    return [
      '      <div class="decision-summary-card__header">',
      '        <div>',
      '          <p class="decision-summary-card__eyebrow">Exchange Detail</p>',
      `          <h2 class="decision-summary-card__title">1. ${xmlEscape(exchange.fullName || exchange.label)} の結論カード</h2>`,
      '        </div>',
      '        <span class="decision-summary-badge">Summary</span>',
      '      </div>',
      `      <p class="decision-summary-card__lead">${xmlEscape(verdict)}</p>`,
      `      <p class="decision-summary-card__body">${xmlEscape(exchange.lede)}</p>`,
      '      <ul class="market-conclusion-list exchange-conclusion-list">',
      `        <li>${xmlEscape(`取扱銘柄：${assetCoverage}`)}</li>`,
      `        <li>${xmlEscape(`販売所：${salesDesk}`)}</li>`,
      `        <li>${xmlEscape(`取引所形式：${exchangeFormat}`)}</li>`,
      `        <li>${xmlEscape(`板の厚み：${orderbookDepth}`)}</li>`,
      `        <li>${xmlEscape(`運営会社：${operator}`)}</li>`,
      `        <li>${xmlEscape(`向いている人：${suitableFor}`)}</li>`,
      '      </ul>',
      '      <dl class="market-conclusion-facts exchange-conclusion-facts">',
      '        <div>',
      '          <dt>販売所</dt>',
      `          <dd>${xmlEscape(salesDesk)}</dd>`,
      '        </div>',
      '        <div>',
      '          <dt>取引所形式</dt>',
      `          <dd>${xmlEscape(exchangeFormat)}</dd>`,
      '        </div>',
      '        <div>',
      '          <dt>基準銘柄</dt>',
      `          <dd>${xmlEscape(exchange.defaultMarket.label || exchange.defaultMarket.instrumentId)}</dd>`,
      '        </div>',
      '      </dl>',
    ].join('\n');
  }

  function renderExchangeFeeSpreadCards(exchange) {
    const costs = exchangePageCosts(exchange);
    const spreadDescription = exchange.spread.marketCount > 0
      ? `販売所対応 ${formatCount(exchange.spread.marketCount)}銘柄のデータを追跡しています。直近1日平均は ${formatPct(exchange.spread.avg1d, 2)}、7日平均は ${exchange.spread.avg7d != null ? formatPct(exchange.spread.avg7d, 2) : 'データ待ち'} です。`
      : '販売所スプレッドの比較データは準備中です。販売所を使う場合は、買値と売値の差を注文前に確認しましょう。';
    const cards = [
      {
        title: '取引手数料',
        description: `${fallbackText(costs.tradingFee, '公式手数料表で確認')}。本サイトの板シミュレーターでは既定 taker 手数料 ${exchange.feeLabel} を比較の基準にしています。`,
        badge: 'Trading',
      },
      {
        title: '入金手数料',
        description: fallbackText(costs.depositFee, '入金方式・銀行ごとの公式条件を確認してください。'),
        badge: 'Deposit',
      },
      {
        title: '出金手数料',
        description: fallbackText(costs.withdrawalFee, '日本円出金手数料は公式手数料表で確認してください。'),
        badge: 'JPY',
      },
      {
        title: '暗号資産送金手数料',
        description: fallbackText(costs.cryptoTransferFee, '銘柄・ネットワークごとの公式手数料表で確認してください。'),
        badge: 'Crypto',
      },
      {
        title: '販売所スプレッド',
        description: `${fallbackText(costs.salesSpread, '販売所の買値・売値差を確認してください。')} ${spreadDescription}`,
        badge: 'Spread',
      },
      {
        title: '取引所形式の実質コスト',
        descriptionHtml: [
          `${xmlEscape(fallbackText(costs.exchangeCost, '取引手数料、板スプレッド、スリッページをまとめて確認します。'))} `,
          '<span class="exchange-live-value" data-exchange-live-field="effectiveCost">代表銘柄の10万円買い参考値を取得中です。</span>',
        ].join(''),
        badge: 'Board',
      },
    ];

    return renderExchangeDefinitionCards(cards);
  }

  function renderExchangeOrderbookVolumeCards(exchange) {
    const thickMarkets = exchange.thickMarkets.map((market) => ({
      label: `${market.label} ${market.quoteVolume != null ? formatJpyCompact(market.quoteVolume) : ''}`.trim(),
    }));
    const defaultMarketLabel = exchange.defaultMarket.label || exchange.defaultMarket.instrumentId;
    const thickDescription = exchange.thickMarkets.length > 0
      ? `24h 出来高が大きい銘柄を板厚確認の候補として並べています。${defaultMarketLabel} はページ表示後に現在の可視板厚も取得します。`
      : `${defaultMarketLabel} を代表銘柄として、板データが取得でき次第、可視板厚を表示します。`;
    const cards = [
      {
        title: '主要銘柄の板厚',
        descriptionHtml: [
          `${xmlEscape(thickDescription)} `,
          '<span class="exchange-live-value" data-exchange-live-field="depth">代表銘柄の板厚を取得中です。</span>',
        ].join(''),
        markets: thickMarkets,
        emptyMessage: '出来高データを準備中です。',
        badge: 'Depth',
      },
      {
        title: '出来高シェア',
        description: `${exchangeVolumeSummaryText(exchange)} 出来高は流動性の参考であり、実際の約定価格は注文時の板で確認します。`,
        badge: 'Volume',
      },
      {
        title: '最良Bid / Ask',
        descriptionHtml: [
          `${xmlEscape(defaultMarketLabel)} の現在板から、売りたい場合の Bid と買いたい場合の Ask を確認します。 `,
          '<span class="exchange-live-value" data-exchange-live-field="bidAsk">代表銘柄のBid / Askを取得中です。</span>',
        ].join(''),
        badge: 'Quote',
      },
      {
        title: 'スリッページの傾向',
        descriptionHtml: [
          '10万円買いの参考シミュレーションで、板の奥まで食う影響を確認します。 ',
          '<span class="exchange-live-value" data-exchange-live-field="slippage">代表銘柄のスリッページ傾向を取得中です。</span>',
        ].join(''),
        badge: 'Impact',
      },
      {
        title: '大きめ注文時の注意点',
        description: '大きめの注文では、最良価格だけでなく板の奥行き、約定平均価格、taker 手数料、価格急変時の板更新遅れを合わせて確認してください。注文を分割する、指値を使う、公式画面で最終確認するなどの余地を残すと判断しやすくなります。',
        badge: 'Caution',
      },
    ];

    return renderExchangeDefinitionCards(cards);
  }

  function renderExchangeCompanyCards(exchange) {
    const profile = exchangePageProfile(exchange);
    const financial = exchangeFinancialAnalysis(exchange);
    const companyName = fallbackText(profile.companyName, exchange.fullName || exchange.label);
    const serviceName = fallbackText(profile.serviceName, exchange.label);
    const registrationNumber = fallbackText(profile.registrationNumber);
    const foundedYear = fallbackText(profile.foundedYear);
    const services = formatExchangeServices(profile);
    const notice = 'この情報は公開資料をもとにした参考情報であり、取引所の安全性や将来の業績を保証するものではありません。';
    const cards = [
      {
        eyebrow: 'Financial Stability',
        title: '財務から見る運営安定性',
        lead: `${exchange.label} の運営安定性は、売上や利益だけでなく、純資産、親会社、開示状況、行政処分歴を合わせて見ます。`,
        badge: 'Reference',
        className: 'exchange-financial-card--summary',
        details: [
          { label: '売上高', value: financial.summary.revenue },
          { label: '営業利益', value: financial.summary.operatingProfit },
          { label: '純資産', value: financial.summary.netAssets },
          { label: '親会社', value: financial.summary.parentCompany },
          { label: '開示状況', value: financial.summary.disclosureStatus },
        ],
        note: notice,
      },
      {
        eyebrow: '1. Company',
        title: '会社概要',
        lead: 'まずサービス名と運営会社、登録番号、親会社・資本関係を分けて確認します。',
        badge: 'Company',
        details: [
          { label: '会社名', value: companyName },
          { label: 'サービス名', value: serviceName },
          { label: '登録番号', value: registrationNumber },
          { label: '設立年', value: foundedYear },
          { label: '取扱サービス', value: services },
        ],
      },
      {
        eyebrow: '2. Profit',
        title: '売上・利益の推移',
        lead: '単年の黒字 / 赤字ではなく、売上高、営業利益、経常利益、当期純利益、営業キャッシュフローの流れを見ます。',
        badge: 'Trend',
        details: [
          { label: '売上高', value: financial.indicators.revenue },
          { label: '営業利益', value: financial.indicators.operatingProfit },
          { label: '経常利益', value: financial.indicators.ordinaryProfit },
          { label: '当期純利益', value: financial.indicators.netIncome },
          { label: '営業キャッシュフロー', value: financial.indicators.operatingCashFlow },
        ],
      },
      {
        eyebrow: '3. Equity',
        title: '純資産・自己資本',
        lead: '損益だけでなく、資本の厚みと自己資本比率を確認します。顧客資産管理とは別の論点として見ます。',
        badge: 'Capital',
        details: [
          { label: '純資産', value: financial.indicators.netAssets },
          { label: '自己資本比率', value: financial.indicators.equityRatio },
          { label: '確認観点', value: '純資産の増減、資本増強、継続企業の前提を確認' },
        ],
      },
      {
        eyebrow: '4. Segment',
        title: '暗号資産事業の位置づけ',
        lead: '親会社や複数事業を持つ会社では、暗号資産事業が全体のどの部分を占めるかを見ます。',
        badge: 'Segment',
        details: [
          { label: '暗号資産関連事業の比率', value: financial.indicators.cryptoBusinessRatio },
          { label: '事業の位置づけ', value: financial.businessPosition },
          { label: '主な収益源', value: financial.revenueSource },
          { label: '関連サービス', value: services },
        ],
      },
      {
        eyebrow: '5. Group',
        title: '親会社・グループ情報',
        lead: '親会社の有無、グループ内の位置づけ、上場企業かどうか、IRで確認できる範囲を整理します。',
        badge: 'Group',
        details: [
          { label: '親会社の有無', value: financial.indicators.parentPresence },
          { label: '親会社・グループ', value: financial.summary.parentCompany },
          { label: '上場企業かどうか', value: financial.indicators.listedCompany },
          { label: 'グループ開示', value: financial.groupDisclosure },
        ],
      },
      {
        eyebrow: '6. Disclosure',
        title: '開示資料',
        lead: '公式会社概要、決算公告、親会社IR、有価証券報告書、金融庁・財務局の公表資料を確認します。',
        badge: 'Sources',
        details: [
          { label: '開示資料', value: financial.disclosureMaterials },
          { label: '行政処分歴', value: financial.indicators.sanctions },
          { label: '監査法人', value: financial.indicators.auditor },
          { label: '開示資料の更新日', value: financial.indicators.disclosureUpdatedAt },
        ],
      },
      {
        eyebrow: '7. Caution',
        title: '注意点',
        lead: notice,
        badge: 'Caution',
        checks: financial.cautions,
      },
    ];

    return cards.map((card) => [
      `<article class="${['market-insight-card', 'exchange-financial-card', card.className || ''].filter(Boolean).join(' ')}">`,
      '  <div class="market-insight-card__header">',
      '    <div>',
      `      <p class="market-insight-card__eyebrow">${xmlEscape(card.eyebrow)}</p>`,
      `      <h3 class="market-insight-card__title">${xmlEscape(card.title)}</h3>`,
      '    </div>',
      `    <span class="market-insight-card__badge">${xmlEscape(card.badge)}</span>`,
      '  </div>',
      `  <p class="market-insight-card__lead">${xmlEscape(card.lead)}</p>`,
      card.details ? renderExchangeDetailList(card.details, { compact: card.details.length > 4 }) : '',
      card.note ? `  <p class="market-insight-card__note exchange-financial-card__notice">${xmlEscape(card.note)}</p>` : '',
      card.checks ? [
        '  <ol class="market-insight-checklist">',
        card.checks.map(item => `    <li>${xmlEscape(item)}</li>`).join('\n'),
        '  </ol>',
      ].join('\n') : '',
      '</article>',
    ].join('\n')).join('\n');
  }

  function renderExchangeRiskCards(exchange) {
    const users = exchange.pageContent.userTypes || [];
    const cautions = exchange.pageContent.cautions || [];

    return [
      '<article class="market-insight-card">',
      '  <div class="market-insight-card__header">',
      '    <div>',
      '      <p class="market-insight-card__eyebrow">Fit</p>',
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
      '      <p class="market-insight-card__eyebrow">Risk</p>',
      '      <h3 class="market-insight-card__title">注意点・リスク</h3>',
      '    </div>',
      '    <span class="market-insight-card__badge">Check</span>',
      '  </div>',
      '  <p class="market-insight-card__lead">取扱銘柄、注文条件、キャンペーン条件、入出金条件は変更されることがあります。</p>',
      '  <ol class="market-insight-checklist">',
      (cautions.length > 0 ? cautions : ['申込前に公式条件と注文画面を確認しましょう。']).map(item => `<li>${xmlEscape(item)}</li>`).join('\n'),
      '  </ol>',
      '</article>',
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
    const profile = exchangePageProfile(exchange);
    const features = exchangePageFeatures(exchange);
    const companyName = fallbackText(profile.companyName, exchange.fullName || exchange.label);
    const serviceName = fallbackText(profile.serviceName, exchange.label);
    const registrationNumber = fallbackText(profile.registrationNumber);
    const parentCompany = fallbackText(profile.parentCompany);
    const foundedYear = fallbackText(profile.foundedYear);
    const salesDesk = supportText(features.salesDesk, exchange.salesMarkets.length);
    const exchangeFormat = supportText(features.exchangeFormat, exchange.boardMarkets.length);
    const cards = [
      {
        title: '会社・登録情報',
        description: '口座開設前に、サービス名と運営会社、登録番号、親会社・資本関係を分けて確認します。',
        badge: 'Company',
        details: [
          { label: '会社名', value: companyName },
          { label: 'サービス名', value: serviceName },
          { label: '登録番号', value: registrationNumber },
          { label: '親会社', value: parentCompany },
          { label: '設立年', value: foundedYear },
        ],
      },
      {
        title: '取扱サービス',
        description: '同じサービス内でも、現物・レバレッジ・販売所・取引所形式でコストと注文条件が変わります。',
        badge: 'Service',
        details: [
          { label: '取扱サービス', value: formatExchangeServices(profile) },
          { label: '現物取引', value: fallbackText(features.spotTrading, '公式確認') },
          { label: 'レバレッジ取引', value: fallbackText(features.leverageTrading, '公式確認') },
          { label: '販売所', value: salesDesk },
          { label: '取引所', value: exchangeFormat },
          { label: '積立', value: fallbackText(features.recurring, '公式確認') },
          { label: '入出金対応', value: fallbackText(features.depositsWithdrawals || (exchange.funding && exchange.funding.summary), '公式条件確認') },
        ],
      },
      {
        title: 'データ取得の前提',
        description: `${exchange.dataSourceLabel || '公開API / WebSocket'} をもとに、本サイトで板・出来高・販売所スプレッドの参考データを集計しています。発注前は公式画面を優先してください。`,
        badge: 'Data',
      },
      {
        title: '入出金の見方',
        description: `${fundingSummaryLabel(exchange.funding)}。銀行、銘柄、ネットワーク、メンテナンス状況で条件が変わるため、出金前に公式手数料表と停止情報を確認してください。`,
        badge: 'Funding',
      },
    ];

    return renderExchangeDefinitionCards(cards);
  }

  function renderExchangeTrustCards(exchange) {
    const primaryChecks = [
      '金融庁・財務局の暗号資産交換業者登録、公式会社概要、利用規約を一次情報で確認する',
      '顧客資産の分別管理、セキュリティ方針、障害時のお知らせと補償方針を確認する',
      '自分が使う銘柄で板の厚み、販売所スプレッド、出金条件を確認する',
    ];
    const companyChecks = [
      '運営会社、親会社、決算公告やIR、資本関係など公開情報の有無',
      '収益源が販売所スプレッド、取引手数料、周辺サービスのどこに寄っているか',
      '長期停止、行政処分、情報漏えいなどの履歴が公式お知らせで説明されているか',
    ];
    const longTermChecks = [
      'よく使う銘柄の板が厚く、注文サイズに対してスリッページが小さい',
      '入金・出金・送金・サポートの条件が自分の使い方と合う',
      '通常時の手数料とスプレッドが、キャンペーン終了後も許容できる',
    ];

    const cards = [
      {
        eyebrow: 'Trust',
        title: 'この取引所は信頼できる？',
        lead: `${exchange.label} を信頼できるかは、知名度だけでなく登録状況、資産管理、障害対応、通常時コストを分けて確認します。`,
        checks: primaryChecks,
        badge: 'Checklist',
      },
      {
        eyebrow: 'Company',
        title: '財務・運営会社分析',
        lead: '本サイトでは財務健全性を格付けせず、公開情報で確認すべき観点を整理します。申込前は公式会社概要、決算公告、親会社IRなどの一次情報を確認してください。',
        checks: companyChecks,
        badge: 'Primary Sources',
      },
      {
        eyebrow: 'Long Term',
        title: '長く使うなら見る点',
        lead: `${exchange.label} を長く使う候補にする場合は、キャンペーンよりも通常時の使いやすさ、流動性、出金条件を優先して見ます。`,
        checks: longTermChecks,
        badge: 'Fit',
      },
    ];

    return cards.map((card) => [
      '<article class="market-insight-card">',
      '  <div class="market-insight-card__header">',
      '    <div>',
      `      <p class="market-insight-card__eyebrow">${xmlEscape(card.eyebrow)}</p>`,
      `      <h3 class="market-insight-card__title">${xmlEscape(card.title)}</h3>`,
      '    </div>',
      `    <span class="market-insight-card__badge">${xmlEscape(card.badge)}</span>`,
      '  </div>',
      `  <p class="market-insight-card__lead">${xmlEscape(card.lead)}</p>`,
      '  <div class="market-insight-card__chips">',
      `    <span>${xmlEscape(exchange.feeLabel)}</span>`,
      `    <span>${xmlEscape(`${exchange.coverage.length}銘柄`)}</span>`,
      `    <span>${xmlEscape(exchange.dataSourceLabel || '公開データ')}</span>`,
      '  </div>',
      '  <ol class="market-insight-checklist">',
      card.checks.map(item => `    <li>${xmlEscape(item)}</li>`).join('\n'),
      '  </ol>',
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

  function renderExchangeRelatedLinks(exchange, aboutArticle) {
    return [
      renderExchangeJourneyLinks(exchange),
      renderExchangeCampaignCards(exchange),
      renderExchangeLinkCards(exchange, aboutArticle),
      [
        '<a class="market-context-card" href="/learn/exchange-company-analysis">',
        '  <span class="market-context-card__eyebrow">Learn</span>',
        '  <strong class="market-context-card__title">運営会社・財務情報の見方</strong>',
        '  <span class="market-context-card__description">登録情報、決算公告、親会社IR、顧客資産管理を見る順番を確認できます。</span>',
        '  <span class="market-context-card__cta">読む</span>',
        '</a>',
        '<a class="market-context-card" href="/learn/how-to-compare-exchanges">',
        '  <span class="market-context-card__eyebrow">Learn</span>',
        '  <strong class="market-context-card__title">取引所の比較方法</strong>',
        '  <span class="market-context-card__description">取扱銘柄、板、スプレッド、手数料、出来高、キャンペーンを見る順番を整理します。</span>',
        '  <span class="market-context-card__cta">読む</span>',
        '</a>',
      ].join('\n'),
    ].filter(Boolean).join('\n');
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
    const title = `${pageExchange.label} 信頼性・運営会社・手数料・取扱銘柄確認｜${SITE_NAME}`;
    const description = `${pageExchange.label} の信頼性チェック、運営会社・財務情報の確認観点、取扱銘柄、板取引対応銘柄、販売所対応銘柄、出来高シェア、スプレッド傾向をまとめた取引所詳細ページです。`;

    return injectCommonDisclosure(template
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
      .replaceAll('__EXCHANGE_ID__', xmlEscape(pageExchange.id || ''))
      .replaceAll('__EXCHANGE_LABEL__', xmlEscape(pageExchange.label || pageExchange.id))
      .replaceAll('__EXCHANGE_NAME__', xmlEscape(pageExchange.fullName || pageExchange.label || pageExchange.id))
      .replaceAll('__EXCHANGE_DEFAULT_INSTRUMENT_ID__', xmlEscape(pageExchange.defaultMarket.instrumentId || pageExchange.defaultInstrumentId || ''))
      .replace('__EXCHANGE_LEDE__', xmlEscape(pageExchange.lede))
      .replace('__EXCHANGE_FEE_LABEL__', xmlEscape(pageExchange.feeLabel))
      .replace('__EXCHANGE_MARKET_COUNT__', xmlEscape(String(pageExchange.coverage.length)))
      .replace('__EXCHANGE_DEFAULT_MARKET__', xmlEscape(pageExchange.defaultMarket.label || pageExchange.defaultMarket.instrumentId))
      .replace('<!-- EXCHANGE_CONCLUSION_CARD -->', renderExchangeConclusionCard(pageExchange))
      .replace('<!-- EXCHANGE_OVERVIEW_CARDS -->', renderExchangeOverviewCards(pageExchange))
      .replace('<!-- EXCHANGE_FEE_SPREAD_CARDS -->', renderExchangeFeeSpreadCards(pageExchange))
      .replace('<!-- EXCHANGE_TRUST_CARDS -->', renderExchangeTrustCards(pageExchange))
      .replace('<!-- EXCHANGE_COVERAGE_CARDS -->', renderExchangeCoverageCards(pageExchange))
      .replace('<!-- EXCHANGE_COST_CARDS -->', renderExchangeCostCards(pageExchange))
      .replace('<!-- EXCHANGE_ORDERBOOK_VOLUME_CARDS -->', renderExchangeOrderbookVolumeCards(pageExchange))
      .replace('<!-- EXCHANGE_COMPANY_CARDS -->', renderExchangeCompanyCards(pageExchange))
      .replace('<!-- EXCHANGE_AUDIENCE_CARDS -->', renderExchangeAudienceCards(pageExchange))
      .replace('<!-- EXCHANGE_RISK_CARDS -->', renderExchangeRiskCards(pageExchange))
      .replace('<!-- EXCHANGE_CAMPAIGN_CARDS -->', renderExchangeCampaignCards(pageExchange))
      .replace('<!-- EXCHANGE_LINK_CARDS -->', renderExchangeLinkCards(pageExchange, aboutArticle))
      .replace('<!-- EXCHANGE_RELATED_LINKS -->', renderExchangeRelatedLinks(pageExchange, aboutArticle))
      .replace('<!-- EXCHANGE_MARKET_LINKS -->', renderExchangeMarketLinks(pageExchange, aboutArticle)), { activeSection: 'exchanges', activePath: exchangePath(pageExchange.id) });
  }

  return {
    buildMarketIndexModel,
    buildRssXml,
    buildSitemapXml,
    campaignPath,
    getArticleBySlug,
    getLearnArticleBySlug,
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
    renderExchangesIndexHtml,
    renderLearnIndexHtml,
    renderMarketHtml,
    renderMarketsIndexHtml,
    renderPublicPage,
    renderResearchHtml,
    renderStaticPublicPage,
    requestOrigin,
    setMarketPageSnapshotLoader(loader) {
      marketPageSnapshotLoader = typeof loader === 'function' ? loader : null;
    },
  };
}

module.exports = {
  createSiteContentService,
};
