const fs = require('fs');
const path = require('path');
const { SITE_NAME } = require('../schema');
const {
  listCampaigns,
} = require('../campaigns');
const {
  exchangePageSlug,
  getExchangePageContent,
  resolveExchangePageId,
} = require('../exchange-page-content');
const {
  FINANCIAL_METRICS,
  getFinancialComparisonCompanies,
} = require('../financial-comparison-data');
const { getCryptoAssetBalanceComparison } = require('../crypto-asset-balance-data');
const { getMarketResearchContent } = require('../market-research-content');
const { getMarketVisualResearchContent } = require('../market-visual-research-content');
const { requestOrigin: resolveRequestOrigin } = require('./request-origin');
const UIComponents = require('../../public/js/ui-components');

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
      path: '/derivatives',
      lastmod: fileLastmod(path.join(publicDir, 'derivatives.html')),
      priority: '0.8',
    },
    {
      path: '/sales-spread',
      lastmod: fileLastmod(path.join(publicDir, 'sales-spread.html')),
      priority: '0.8',
    },
    {
      path: '/financial-comparison',
      lastmod: fileLastmod(__filename),
      priority: '0.8',
    },
    {
      path: '/exchanges',
      lastmod: fileLastmod(path.join(publicDir, 'exchange.html')),
      priority: '0.8',
    },
    {
      path: '/learn',
      lastmod: fileLastmod(path.join(publicDir, 'templates', 'article.html')),
      priority: '0.8',
    },
    {
      path: '/articles',
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
    return resolveRequestOrigin(req);
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

  function jsonForInlineScript(data) {
    return JSON.stringify(data)
      .replace(/</g, '\\u003c')
      .replace(/>/g, '\\u003e')
      .replace(/&/g, '\\u0026')
      .replace(/\u2028/g, '\\u2028')
      .replace(/\u2029/g, '\\u2029');
  }

  function volumeCampaignTag(campaign) {
    if (campaign.referralSummary || campaign.referralCode) return 'PRリンクあり';
    if (campaign.affiliateUrl) return '口座開設リンクあり';
    return '公式条件確認';
  }

  function volumeCampaignLastCheckedDisplay(value) {
    const label = String(value || '').trim();
    if (!label || label === '公式確認待ち' || label === '後ほど追加') return '';
    return label;
  }

  function buildVolumeShareCampaignPayload() {
    const exchanges = {};
    listCampaigns().forEach((campaign) => {
      if (!campaign.exchangeId) return;
      exchanges[campaign.exchangeId] = {
        exchangeId: campaign.exchangeId,
        exchangeName: campaign.exchangeName,
        campaignName: campaign.campaignName,
        tag: volumeCampaignTag(campaign),
        benefit: campaign.benefit,
        lastChecked: volumeCampaignLastCheckedDisplay(campaign.lastChecked),
        path: campaign.exchangeId ? exchangePath(campaign.exchangeId) : campaign.officialUrl,
        officialUrl: campaign.officialUrl,
        affiliateUrl: campaign.affiliateUrl || null,
        referralCode: campaign.referralCode || null,
        rel: campaign.affiliateRel || 'sponsored noopener',
        referrerPolicy: campaign.affiliateReferrerPolicy || null,
        target: campaign.affiliateTarget === null ? null : (campaign.affiliateTarget || '_blank'),
        trackingPixelUrl: campaign.trackingPixelUrl || null,
      };
    });

    return { exchanges };
  }

  function buildVolumeShareExchangeMetaPayload() {
    const exchanges = {};
    const publicExchanges = typeof getPublicExchanges === 'function' ? getPublicExchanges() : [];
    publicExchanges.forEach((exchange) => {
      if (!exchange || !exchange.id) return;
      const markets = {};
      (exchange.markets || []).forEach((market) => {
        if (!market || !market.instrumentId) return;
        markets[market.instrumentId] = {
          instrumentId: market.instrumentId,
          label: market.label || market.instrumentId,
          takerFeeRate: market.takerFeeRate ?? null,
          takerFeeNote: market.takerFeeNote || null,
        };
      });

      exchanges[exchange.id] = {
        exchangeId: exchange.id,
        exchangeName: exchange.label || exchange.id,
        takerFeeRate: exchange.takerFeeRate ?? null,
        takerFeeNote: exchange.takerFeeNote || null,
        markets,
      };
    });

    return { exchanges };
  }

  function renderVolumeShareInlineDataScript() {
    return [
      '<script>',
      `window.VolumeShareCampaigns=${jsonForInlineScript(buildVolumeShareCampaignPayload())};`,
      `window.VolumeShareExchangeMeta=${jsonForInlineScript(buildVolumeShareExchangeMetaPayload())};`,
      '</script>',
    ].join('');
  }

  function renderVolumeShareHtml(req) {
    const html = fs.readFileSync(path.join(publicDir, 'volume-share.html'), 'utf8');
    const withHead = html
      .replace(HEAD_META_INJECT, renderHeadMeta({
        pageId: 'volume-share',
        siteOrigin: requestOrigin(req),
      }))
      .replace('<!-- VOLUME_SHARE_CAMPAIGN_DATA -->', renderVolumeShareInlineDataScript());
    return injectCommonDisclosure(withHead, navOptionsForPage('volume-share'));
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
        { label: '取引所（板）のコスト計算', href: '/simulator' },
        { label: '販売所のスプレッド比較', href: '/sales-spread' },
        { label: '出来高・流動性（取引の活発さ）', href: '/volume-share' },
        { label: 'レバレッジ（FX・CFD）比較', href: '/derivatives' },
        { label: '財務・安全性データの比較', href: '/financial-comparison' },
        { label: '取引手数料の比較', href: '/learn/crypto-fees' },
        { label: '日本円の入出金手数料', href: '/learn/jpy-withdrawal-fees' },
        { label: '暗号資産の送金（出金）コスト', href: '/learn/crypto-withdrawal-fees' },
      ],
    },
    {
      id: 'markets',
      label: '銘柄深掘り',
      items: [
        { label: '銘柄深掘り一覧', href: '/markets' },
        { label: 'ビットコイン（BTC）', href: '/markets/BTC-JPY' },
        { label: 'イーサリアム（ETH）', href: '/markets/ETH-JPY' },
        { label: 'リップル（XRP）', href: '/markets/XRP-JPY' },
        { label: 'ソラナ（SOL）', href: '/markets/SOL-JPY' },
        { label: '出来高が多い銘柄', href: '/markets#market-category-high-volume' },
        { label: 'スプレッドが広い銘柄', href: '/markets#market-category-wide-spread' },
      ],
    },
    {
      id: 'articles',
      label: '記事',
      items: [
        { label: '銘柄記事一覧', href: '/articles' },
        { label: 'ビットコイン（BTC）', href: '/articles/btc' },
        { label: '初心者ガイド記事', href: '/learn' },
      ],
    },
    {
      id: 'exchanges',
      label: '取引所',
      items: [
        { label: 'すべての取引所を見る', href: '/exchanges' },
        { label: 'bitFlyer（ビットフライヤー）', href: '/exchanges/bitflyer' },
        { label: 'Coincheck（コインチェック）', href: '/exchanges/coincheck' },
        { label: 'GMOコイン', href: '/exchanges/gmo-coin' },
        { label: 'bitbank（ビットバンク）', href: '/exchanges/bitbank' },
      ],
    },
    {
      id: 'learn',
      label: 'ガイド',
      items: [
        { label: '初心者ガイド トップ', href: '/learn' },
        { label: '【重要】販売所と取引所の違い', href: '/learn/exchange-vs-broker' },
        { label: 'スプレッド（実質手数料）とは？', href: '/learn/spread' },
        { label: '板取引の仕組みとやり方', href: '/learn/order-book-trading' },
        { label: '失敗しない！10万円分の買い方', href: '/learn/buying-100k-points' },
        { label: 'なぜ販売所は損しやすいのか？', href: '/learn/broker-loss-reasons' },
        { label: '失敗しない取引所の選び方と口座開設ガイド', href: '/learn/exchange-checklist' },
        { type: 'separator' },
        { label: 'このサイトについて', href: '/about' },
        { label: 'データ取得元', href: '/about#data-sources' },
        { label: 'PR・広告表記について', href: '/about#pr-disclosure' },
        { label: '免責事項・利用規約', href: '/about#disclaimer' },
      ],
    },
  ];

  function navOptionsForPage(pageId) {
    const byPageId = {
      home: { activeSection: 'comparison', activePath: '/' },
      simulator: { activeSection: 'comparison', activePath: '/simulator' },
      'sales-spread': { activeSection: 'comparison', activePath: '/sales-spread' },
      'volume-share': { activeSection: 'comparison', activePath: '/volume-share' },
      derivatives: { activeSection: 'comparison', activePath: '/derivatives' },
      'financial-comparison': { activeSection: 'comparison', activePath: '/financial-comparison' },
      markets: { activeSection: 'markets', activePath: '/markets' },
      market: { activeSection: 'markets', activePath: '/markets' },
      articles: { activeSection: 'articles', activePath: '/articles' },
      article: { activeSection: 'articles', activePath: '/articles' },
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
    if (navPath === '/' || navPath === '/simulator' || navPath === '/sales-spread' || navPath === '/volume-share' || navPath === '/derivatives' || navPath === '/financial-comparison') {
      return 'comparison';
    }
    if (navPath === '/learn/crypto-fees' || navPath === '/learn/jpy-withdrawal-fees' || navPath === '/learn/crypto-withdrawal-fees') return 'comparison';
    if (navPath === '/markets' || navPath.startsWith('/markets/')) return 'markets';
    if (navPath === '/articles' || navPath.startsWith('/articles/')) return 'articles';
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
      '    <section class="panel panel--dense common-disclosure info-layer info-layer--bottom" data-info-layer="bottom" aria-labelledby="common-disclosure-title">',
      '      <details class="common-disclosure__details">',
      '        <summary class="common-disclosure__summary">',
      '          <div>',
      '            <span class="panel-kicker mb-2">⚠️ 確認事項</span>',
      '            <h2 id="common-disclosure-title" class="panel-title">サイトのご利用にあたって（免責事項・PR表記）</h2>',
      '            <span class="common-disclosure__summary-copy">投資助言ではないこと、価格変動リスク、データ取得遅延、広告・PRの可能性を記載しています。</span>',
      '          </div>',
      '          <span class="common-disclosure__summary-cta">詳細を確認する</span>',
      '        </summary>',
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
      '          <p>本ページには広告・PR・アフィリエイトリンクが含まれる場合があります。紹介リンクや公式導線を掲載する場合も、取引コストや順位の計算ロジックは変更しません。</p>',
      '          <p>掲載順位や評価基準は、各ページの比較基準・データ定義に基づきます。申込前には、各取引所の公式サイトで最新の手数料、本人確認、対象サービス、注意事項を確認してください。</p>',
      '        </div>',
      '      </div>',
      '      </details>',
      '    </section>',
    ].join('\n');
  }

  function injectCommonDisclosure(html, options = {}) {
    const withNavigation = injectSiteNavigation(html, options);
    const withDisclosure = (() => {
      if (String(withNavigation).includes('common-disclosure')) return withNavigation;
      if (!String(withNavigation).includes('</main>')) return withNavigation;
      return String(withNavigation).replace('</main>', `${renderCommonDisclosure()}\n  </main>`);
    })();
    return injectExchangeReferralLinks(withDisclosure);
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
    if (!/^[A-Z0-9]+(?:-[A-Z0-9]+)+$/.test(instrumentId)) return '';
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

  function campaignTarget(campaign) {
    if (!campaign) return undefined;
    if (Object.prototype.hasOwnProperty.call(campaign, 'affiliateTarget')) return campaign.affiliateTarget;
    return undefined;
  }

  function referralTarget(content, campaign) {
    if (content && Object.prototype.hasOwnProperty.call(content, 'referralTarget')) return content.referralTarget;
    const target = campaignTarget(campaign);
    if (target !== undefined) return target;
    return '_blank';
  }

  function buildExchangeReferralLinkPayload() {
    const campaignsByExchange = new Map(listCampaigns()
      .filter(campaign => campaign && campaign.exchangeId)
      .map(campaign => [campaign.exchangeId, campaign]));
    const exchanges = {};

    (typeof getPublicExchanges === 'function' ? getPublicExchanges() : []).forEach((exchange) => {
      if (!exchange || !exchange.id) return;
      const content = getExchangePageContent(exchange.id) || {};
      const campaign = campaignsByExchange.get(exchange.id) || null;
      const href = content.referralUrl || (campaign && campaign.affiliateUrl) || null;

      exchanges[exchange.id] = {
        exchangeId: exchange.id,
        exchangeName: exchange.label || exchange.id,
        detailPath: exchangePath(exchange.id),
        href,
        rel: href ? (content.referralRel || (campaign && campaign.affiliateRel) || 'sponsored noopener') : null,
        target: href ? referralTarget(content, campaign) : null,
        referrerPolicy: href ? (content.referralReferrerPolicy || (campaign && campaign.affiliateReferrerPolicy) || null) : null,
        trackingPixelUrl: href ? (content.referralTrackingPixelUrl || (campaign && campaign.trackingPixelUrl) || null) : null,
      };
    });

    return { exchanges };
  }

  function injectExchangeReferralLinks(html) {
    const text = String(html || '');
    if (text.includes('window.ExchangeReferralLinks') || !text.includes('</body>')) return text;
    const script = `<script>window.ExchangeReferralLinks=${jsonForInlineScript(buildExchangeReferralLinkPayload())};</script>`;
    return text.replace('</body>', `  ${script}\n</body>`);
  }

  function marketLabel(instrumentId, market = {}) {
    if (market.label) return market.label;
    const cfdMatch = String(instrumentId || '').match(/^([A-Z0-9]+)-CFD-([A-Z0-9]+)$/);
    if (cfdMatch) return `${cfdMatch[1]}-CFD/${cfdMatch[2]}`;
    return String(instrumentId || '').replace(/-/g, '/');
  }

  function parseNumber(value) {
    if (value == null || (typeof value === 'string' && value.trim() === '')) return null;
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

  function parsePctNumber(value) {
    if (value == null) return null;
    const numeric = Number(String(value).replace('%', '').replace(/[＋+]/g, '').trim());
    return Number.isFinite(numeric) ? numeric : null;
  }

  function formatSignedPct(value, decimals = 2) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return 'データ待ち';
    const sign = numeric > 0 ? '+' : '';
    return `${sign}${numeric.toFixed(decimals)}%`;
  }

  function marketToken(value) {
    return String(value || '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'market';
  }

  function marketTrendTone(changePct) {
    const numeric = Number(changePct);
    if (!Number.isFinite(numeric) || numeric === 0) return 'flat';
    return numeric > 0 ? 'up' : 'down';
  }

  function buildSparklinePoints(instrumentId, changePct) {
    const numeric = Number(changePct);
    const seedText = String(instrumentId || '');
    const points = [];
    let seed = 0;
    for (let i = 0; i < seedText.length; i += 1) {
      seed = (seed + seedText.charCodeAt(i) * (i + 3)) % 997;
    }
    const start = 56 - Math.max(-18, Math.min(18, numeric || 0)) * 0.6;
    const end = 56 + Math.max(-18, Math.min(18, numeric || 0)) * 0.9;
    for (let i = 0; i < 10; i += 1) {
      const progress = i / 9;
      const wave = Math.sin((seed + i * 37) / 23) * 5;
      const bend = Math.sin(progress * Math.PI) * (Number.isFinite(numeric) ? Math.sign(numeric) * 4 : 0);
      const y = Math.max(18, Math.min(86, start + (end - start) * progress + wave + bend));
      points.push({ x: Math.round(progress * 108), y: Math.round(y) });
    }
    return points;
  }

  function renderSparkline(instrumentId, changePct) {
    const tone = marketTrendTone(changePct);
    const points = buildSparklinePoints(instrumentId, changePct);
    const polyline = points.map(point => `${point.x},${point.y}`).join(' ');
    return [
      `<svg class="market-sparkline market-sparkline--${xmlEscape(tone)}" viewBox="0 0 108 100" focusable="false" aria-hidden="true">`,
      '  <path class="market-sparkline__baseline" d="M0 56H108"></path>',
      `  <polyline class="market-sparkline__line" points="${xmlEscape(polyline)}"></polyline>`,
      '</svg>',
    ].join('');
  }

  function renderAssetMark(market, sizeClass = '') {
    const base = market.baseCurrency || String(market.instrumentId || '').split('-')[0] || '?';
    const label = ({
      BTC: '₿',
      WBTC: '₿',
      ETH: 'Ξ',
      XRP: 'X',
      SOL: 'S',
      DOGE: 'Ð',
    })[String(base).toUpperCase()] || String(base).slice(0, 4).toUpperCase();
    const className = ['market-asset-mark', `market-asset-mark--${marketToken(base)}`, sizeClass].filter(Boolean).join(' ');
    return `<span class="${xmlEscape(className)}" aria-hidden="true">${xmlEscape(label)}</span>`;
  }

  function exchangeShortLabel(exchange) {
    const id = String(exchange && exchange.id || '').toLowerCase();
    const labels = {
      okj: 'OKJ',
      coincheck: 'CC',
      bitflyer: 'BF',
      bitbank: 'BB',
      gmo: 'GMO',
      'binance-japan': 'BN',
      bittrade: 'BT',
    };
    return labels[id] || String(exchange && exchange.label || exchange && exchange.id || '?').slice(0, 3).toUpperCase();
  }

  function renderExchangeIndicator(exchange) {
    const label = exchange.label || exchange.id;
    const className = [
      'market-exchange-logo',
      `market-exchange-logo--${marketToken(exchange.id || label)}`,
    ].join(' ');
    return `<span class="${xmlEscape(className)}" role="img" title="${xmlEscape(label)}" aria-label="${xmlEscape(label)}">${xmlEscape(exchangeShortLabel(exchange))}</span>`;
  }

  function trendArrow(changePct) {
    const numeric = Number(changePct);
    if (!Number.isFinite(numeric) || numeric === 0) return '→';
    return numeric > 0 ? '▲' : '▼';
  }

  function beginnerSpreadWarning(market) {
    if (!market || market.marketType === 'derivative') return '';
    const spread = Number(market.bestSpreadPct);
    if (!Number.isFinite(spread) || spread < 3) return '';
    return [
      '<span class="market-index-card__beginner-risk beginner-only" data-term-key="sales-spread" tabindex="0">',
      '  <span class="market-index-card__beginner-risk-mark" aria-hidden="true">!</span>',
      `  <span>販売所スプレッド広め: ${xmlEscape(formatPct(spread))}</span>`,
      '</span>',
    ].join('');
  }

  function renderMarketStatusBadges(market) {
    const badges = [
      {
        label: market.marketType === 'derivative' ? (market.marketTypeLabel || 'デリバティブ') : '現物',
        icon: market.marketType === 'derivative' ? 'CFD' : '現',
        termKey: market.marketType === 'derivative' ? 'cfd' : 'spot',
        tone: market.marketType === 'derivative' ? 'warn' : 'neutral',
      },
      {
        label: market.hasOrderbook ? '板取引' : '板待ち',
        icon: '板',
        termKey: 'orderbook',
        tone: market.hasOrderbook ? 'bid' : 'muted',
      },
    ];
    if (market.marketType !== 'derivative') {
      badges.push({
        label: market.hasSales ? '販売所' : '販売所待ち',
        icon: '販',
        termKey: 'sales-spread',
        tone: market.hasSales ? 'accent' : 'muted',
      });
    }
    return badges.map(badge => (
      [
        `<span class="market-status-badge market-status-badge--${xmlEscape(badge.tone)} article-term" data-term-key="${xmlEscape(badge.termKey)}" tabindex="0" aria-label="${xmlEscape(badge.label)}">`,
        `  <span class="market-status-badge__icon" aria-hidden="true">${xmlEscape(badge.icon)}</span>`,
        `  <span class="market-status-badge__text">${xmlEscape(badge.label)}</span>`,
        '</span>',
      ].join('')
    )).join('');
  }

  function marketSortValue(value, fallback = '') {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? String(numeric) : fallback;
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
    const change24hByInstrument = new Map();

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
      const changePct = parsePctNumber(row.latest && row.latest.change24h);
      if (changePct != null) {
        const existingChange = change24hByInstrument.get(row.instrumentId);
        const spreadRank = spreadPct == null ? Number.POSITIVE_INFINITY : spreadPct;
        if (!existingChange || spreadRank < existingChange.spreadRank) {
          change24hByInstrument.set(row.instrumentId, {
            exchangeId: row.exchangeId,
            exchangeLabel: row.exchangeLabel,
            changePct,
            spreadRank,
          });
        }
      }
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
      change24hByInstrument,
    };
  }

  function buildMarketTags(market) {
    const baseCurrency = String(market.baseCurrency || '').toUpperCase();
    const tags = [];

    if (market.marketType === 'derivative') tags.push('derivative');
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
    const parts = [
      `${market.exchangeCount}社対応`,
      market.marketType === 'derivative' ? (market.marketTypeLabel || 'デリバティブ') : '現物',
      market.hasOrderbook ? '板あり' : '板データ待ち',
    ];
    if (market.marketType !== 'derivative') {
      parts.push(market.hasSales ? '販売所あり' : '販売所データなし');
    }
    return parts.join('｜');
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
        key: 'derivatives',
        title: 'レバレッジ・FX',
        description: '暗号資産CFD/FXとして提供される板です。現物とは価格、証拠金、レバレッジ、手数料条件が異なります。',
        markets: [...markets]
          .filter(market => market.tags.includes('derivative'))
          .sort(sortByCoverageThenVolume)
          .slice(0, 12),
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
        navLabel: {
          featured: '主要',
          'many-exchanges': '多社',
          derivatives: 'FX/CFD',
          'single-exchange': '1社',
          altcoins: 'アルト',
          meme: 'ミーム',
          stable: 'ステーブル',
          'high-volume': '出来高',
          'wide-spread': 'スプレッド',
        }[category.key] || category.title,
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
    const change24h = metrics.change24hByInstrument.get(market.instrumentId) || null;

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
        actions: exchangeInfo ? {
          detailPath: exchangeInfo.path,
          officialUrl: exchangeInfo.pageContent && exchangeInfo.pageContent.officialUrl ? exchangeInfo.pageContent.officialUrl : null,
          signupUrl: exchangeInfo.pageContent && (exchangeInfo.pageContent.referralUrl || exchangeInfo.pageContent.signupUrl || exchangeInfo.pageContent.officialUrl)
            ? (exchangeInfo.pageContent.referralUrl || exchangeInfo.pageContent.signupUrl || exchangeInfo.pageContent.officialUrl)
            : null,
          referralUrl: exchangeInfo.pageContent && exchangeInfo.pageContent.referralUrl ? exchangeInfo.pageContent.referralUrl : null,
          referralRel: exchangeInfo.pageContent && exchangeInfo.pageContent.referralRel ? exchangeInfo.pageContent.referralRel : null,
          referralReferrerPolicy: exchangeInfo.pageContent && exchangeInfo.pageContent.referralReferrerPolicy ? exchangeInfo.pageContent.referralReferrerPolicy : null,
          referralTarget: exchangeInfo.pageContent && Object.prototype.hasOwnProperty.call(exchangeInfo.pageContent, 'referralTarget')
            ? exchangeInfo.pageContent.referralTarget
            : undefined,
          referralTrackingPixelUrl: exchangeInfo.pageContent && exchangeInfo.pageContent.referralTrackingPixelUrl ? exchangeInfo.pageContent.referralTrackingPixelUrl : null,
        } : {
          detailPath: exchangePath(exchange.id),
          officialUrl: null,
          signupUrl: null,
          referralUrl: null,
        },
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
      change24hPct: change24h ? change24h.changePct : null,
      change24hExchangeLabel: change24h ? change24h.exchangeLabel : null,
    };

    return {
      ...enriched,
      research: getMarketResearchContent(enriched),
      tags: buildMarketTags(enriched),
      summaryLine: buildMarketSummaryLine(enriched),
    };
  }

  function buildMarketOverviewContent(market) {
    if (market.marketType === 'derivative') {
      const underlying = market.underlyingInstrumentId || `${market.baseCurrency || market.label}-JPY`;
      return {
        lead: `${market.label} は国内取引所で提供される暗号資産デリバティブ板です。`,
        detail: `${underlying} の現物板とは別市場のため、価格、板の厚み、手数料、証拠金・レバレッジ条件を分けて確認する必要があります。`,
        checks: [
          '現物ではなく証拠金取引・CFD/FXであること',
          'ロスカット、追証、資金移動、建玉管理の条件',
          '取引手数料だけでなくレバレッジポイントやFunding等の費用',
        ],
      };
    }

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

    if (market.marketType === 'derivative') {
      return {
        title: 'デリバティブの要点',
        verdict: `${market.label} は現物の購入・売却ではなく、証拠金を使って価格変動を取引する市場です。`,
        bullets: [
          '現物板とは価格と流動性が別',
          'レバレッジにより損益変動が大きくなる',
          'ロスカットや証拠金維持率を確認したい',
          'Fundingやレバレッジポイントなど継続費用に注意',
          '初心者向けの現物比較とは用途を分けて見る銘柄',
        ],
      };
    }

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

  function renderMarketConclusionCard(market, snapshot = null) {
    const conclusion = buildMarketConclusionContent(market);
    const signalLabels = [
      market.topVolumeExchangeLabel,
      market.bestSpreadExchangeLabel,
    ].filter(Boolean);
    const signalizeText = (value) => {
      let html = xmlEscape(value);
      for (const label of Array.from(new Set(signalLabels)).sort((a, b) => b.length - a.length)) {
        const escapedLabel = xmlEscape(label);
        html = html.split(escapedLabel).join(`<span class="market-signal-badge">${escapedLabel}</span>`);
      }
      return html;
    };
    const statValueHtml = (value, meta, options = {}) => [
      `<span${options.valueId ? ` id="${xmlEscape(options.valueId)}"` : ''} class="market-conclusion-stat__value${options.signal ? ' market-conclusion-stat__value--signal' : ''}">${options.html ? value : xmlEscape(value)}</span>`,
      `<span${options.metaId ? ` id="${xmlEscape(options.metaId)}"` : ''} class="market-conclusion-stat__meta">${xmlEscape(meta)}</span>`,
    ].join('');
    const topVolumeLabel = market.topVolumeExchangeLabel || 'データ待ち';
    const bestBoard = snapshot && snapshot.cheapestBuy ? snapshot.cheapestBuy : null;
    const bestSales = snapshot && snapshot.tightestSalesSpread
      ? snapshot.tightestSalesSpread
      : (market.bestSpreadExchangeLabel ? {
        exchangeLabel: market.bestSpreadExchangeLabel,
        spreadPct: market.bestSpreadPct,
      } : null);
    const topVolume = snapshot && snapshot.topVolume
      ? snapshot.topVolume
      : (market.topVolumeExchangeLabel ? {
        exchangeLabel: market.topVolumeExchangeLabel,
        quoteVolume: market.instrumentTotalQuoteVolume,
      } : null);
    const dataPoints = [
      {
        key: 'best-board',
        label: '一番安く買うなら',
        className: bestBoard ? 'market-conclusion-fact--primary' : '',
        valueHtml: statValueHtml(
          bestBoard
            ? `<span class="market-signal-badge">${xmlEscape(bestBoard.exchangeLabel)}</span>`
            : 'データ待ち',
          bestBoard && Number.isFinite(Number(bestBoard.effectiveVWAP))
            ? `10万円買い / 実効VWAP ${formatJpyPrice(bestBoard.effectiveVWAP)}`
            : `${formatCount(market.exchangeCount)}社の板を集計`,
          {
            html: Boolean(bestBoard),
            signal: Boolean(bestBoard),
            valueId: 'market-conclusion-best-board',
            metaId: 'market-conclusion-best-board-meta',
          }
        ),
      },
      {
        key: 'best-sales',
        label: '販売所で買うなら',
        valueHtml: statValueHtml(
          bestSales
            ? `<span class="market-signal-badge">${xmlEscape(bestSales.exchangeLabel)}</span>`
            : 'データ待ち',
          bestSales && bestSales.spreadPct != null
            ? `販売所スプレッド ${formatPct(bestSales.spreadPct)}`
            : '販売所スプレッドを確認中',
          {
            html: Boolean(bestSales),
            signal: Boolean(bestSales),
            valueId: 'market-conclusion-best-sales',
            metaId: 'market-conclusion-best-sales-meta',
          }
        ),
      },
      {
        key: 'top-volume',
        label: '流動性を見るなら',
        valueHtml: statValueHtml(
          topVolume
            ? `<span class="market-signal-badge">${xmlEscape(topVolume.exchangeLabel || topVolumeLabel)}</span>`
            : xmlEscape(topVolumeLabel),
          topVolume && Number.isFinite(Number(topVolume.quoteVolume))
            ? `24h出来高 ${formatJpyCompact(topVolume.quoteVolume)}`
            : '24h売買代金ベース',
          {
            html: Boolean(topVolume),
            signal: Boolean(topVolume),
            valueId: 'market-conclusion-top-volume',
            metaId: 'market-conclusion-top-volume-meta',
          }
        ),
      },
    ];
    const changeText = market.change24hPct != null ? formatSignedPct(market.change24hPct) : 'データ待ち';
    const trendTone = marketTrendTone(market.change24hPct);
    const trendSource = market.change24hExchangeLabel
      ? `${market.change24hExchangeLabel} 24h`
      : '24h参考';
    const trendHtml = [
      `<span class="market-conclusion-trend market-conclusion-trend--${xmlEscape(trendTone)}">`,
      `  <span class="market-conclusion-trend__copy"><span>24h変化</span><strong>${xmlEscape(changeText)}</strong><small>${xmlEscape(trendSource)}</small></span>`,
      `  ${renderSparkline(market.instrumentId, market.change24hPct)}`,
      '</span>',
    ].join('');

    return UIComponents.renderConclusionCard({
      variant: 'market',
      eyebrow: '結論',
      title: conclusion.title,
      titleTag: 'h3',
      badgeLabel: market.label,
      badgeTone: 'ready',
      lead: conclusion.verdict,
      bodyHtml: trendHtml,
      items: conclusion.bullets.map(item => ({ html: signalizeText(item) })),
      facts: dataPoints,
      meta: '投資判断ではなく、取引前の確認観点として整理しています。実際の条件は各取引所の公式画面を確認してください。',
    });
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
      summary.items.map((item) => {
        const statClass = [
          'market-summary-stat',
          ['cheapest-buy', 'tightest-sales', 'top-volume'].includes(item.key) ? 'market-summary-stat--signal' : '',
        ].filter(Boolean).join(' ');
        return [
        `    <div class="${xmlEscape(statClass)}">`,
        `      <dt>${xmlEscape(item.label)}</dt>`,
        `      <dd id="market-summary-${xmlEscape(item.key)}">${xmlEscape(item.value)}</dd>`,
        `      <div id="market-summary-${xmlEscape(item.key)}-meta" class="market-summary-stat__meta">${xmlEscape(item.meta)}</div>`,
        '    </div>',
      ].join('\n');
      }).join('\n'),
      '  </dl>',
      '  <p class="market-insight-card__note">板が厚い取引所は公開板の Bid + Ask 可視深さを JPY 換算した参考値です。10万円購入時の最安候補は各取引所の既定 taker 手数料を含む買い比較です。入出金対応は公式条件確認を前提にしたチェック項目です。</p>',
      '</article>',
    ].join('\n');
  }

  function marketArticleList(items) {
    if (Array.isArray(items)) {
      return items.map(item => String(item == null ? '' : item).trim()).filter(Boolean);
    }
    const value = String(items == null ? '' : items).trim();
    return value ? [value] : [];
  }

  function renderCoinArticleParagraphs(items) {
    const paragraphs = marketArticleList(items);
    if (paragraphs.length === 0) return '';
    return [
      '<div class="market-coin-article__paragraphs">',
      paragraphs.map(item => `  <p>${xmlEscape(item)}</p>`).join('\n'),
      '</div>',
    ].join('\n');
  }

  function renderCoinArticleSubsections(items) {
    if (!Array.isArray(items) || items.length === 0) return '';
    return [
      '<div class="market-coin-article__subsections">',
      items.map(item => [
        '  <section>',
        `    <h5>${xmlEscape(item.heading || '')}</h5>`,
        `    <p>${xmlEscape(item.body || '')}</p>`,
        '  </section>',
      ].join('\n')).join('\n'),
      '</div>',
    ].join('\n');
  }

  function renderCoinArticleTextSection(section) {
    if (!section) return '';
    const id = `coin-article-${marketToken(section.id || section.heading || 'section')}`;
    return [
      `<section id="${xmlEscape(id)}" class="market-coin-article__section" data-market-coin-article-section>`,
      '  <div class="market-coin-article__section-head">',
      `    <span>${xmlEscape(section.kicker || '記事')}</span>`,
      `    <h4>${xmlEscape(section.heading || '')}</h4>`,
      section.lead ? `    <p>${xmlEscape(section.lead)}</p>` : '',
      '  </div>',
      renderCoinArticleParagraphs(section.paragraphs),
      renderCoinArticleSubsections(section.subsections),
      section.note ? `  <p class="market-coin-article__note">${xmlEscape(section.note)}</p>` : '',
      '</section>',
    ].filter(Boolean).join('\n');
  }

  function renderCoinArticleTakeaways(items) {
    const takeaways = marketArticleList(items);
    if (takeaways.length === 0) return '';
    return [
      '<section class="market-coin-article__takeaways" aria-labelledby="coin-article-takeaways-title">',
      '  <div class="market-coin-article__block-head">',
      '    <span>要点</span>',
      '    <h4 id="coin-article-takeaways-title">この記事でわかること</h4>',
      '  </div>',
      '  <ul>',
      takeaways.map(item => `    <li>${xmlEscape(item)}</li>`).join('\n'),
      '  </ul>',
      '</section>',
    ].join('\n');
  }

  function renderCoinArticleQuickFacts(items) {
    if (!Array.isArray(items) || items.length === 0) return '';
    return [
      '<section class="market-coin-article__facts" aria-labelledby="coin-article-facts-title">',
      '  <div class="market-coin-article__block-head">',
      '    <span>基本</span>',
      '    <h4 id="coin-article-facts-title">基本データ</h4>',
      '  </div>',
      '  <dl>',
      items.map(item => [
        '    <div>',
        `      <dt>${xmlEscape(item.label)}</dt>`,
        `      <dd>${xmlEscape(item.value)}</dd>`,
        item.note ? `      <p>${xmlEscape(item.note)}</p>` : '',
        '    </div>',
      ].filter(Boolean).join('\n')).join('\n'),
      '  </dl>',
      '</section>',
    ].join('\n');
  }

  function renderCoinArticleContents(items) {
    if (!Array.isArray(items) || items.length === 0) return '';
    return [
      '<nav class="market-coin-article__toc" aria-label="銘柄記事の目次">',
      '  <strong>目次</strong>',
      '  <div>',
      items.map((item, index) => `    <a${index === 0 ? ' class="is-active" aria-current="true"' : ''} href="${xmlEscape(item.href)}" data-market-coin-article-target>${xmlEscape(item.label)}</a>`).join('\n'),
      '  </div>',
      '</nav>',
    ].join('\n');
  }

  function renderCoinArticleMechanism(items) {
    if (!Array.isArray(items) || items.length === 0) return '';
    return [
      '<section id="coin-article-key-model" class="market-coin-article__mechanism" aria-labelledby="coin-article-key-model-title" data-market-coin-article-section>',
      '  <div class="market-coin-article__block-head">',
      '    <span>図解</span>',
      '    <h4 id="coin-article-key-model-title">秘密鍵・アドレス・ウォレットの関係</h4>',
      '    <p>ビットコインは「資産そのものをアプリに入れる」のではなく、動かす権限をどう管理するかで理解すると安全です。</p>',
      '  </div>',
      '  <div class="market-coin-article__mechanism-grid">',
      items.map((item, index) => [
        `    <article class="market-coin-article__mechanism-card" style="--mechanism-index:${index + 1}">`,
        `      <span>${xmlEscape(item.label || '')}</span>`,
        `      <strong>${xmlEscape(item.value || '')}</strong>`,
        `      <p>${xmlEscape(item.body || '')}</p>`,
        '    </article>',
      ].join('\n')).join('\n'),
      '  </div>',
      '</section>',
    ].join('\n');
  }

  function renderCoinArticleTableBlock(options) {
    const rows = Array.isArray(options.rows) ? options.rows.filter(Boolean) : [];
    if (rows.length === 0) return '';
    return [
      `<section class="market-coin-article__table-block ${xmlEscape(options.className || '')}">`,
      '  <div class="market-coin-article__block-head">',
      `    <span>${xmlEscape(options.eyebrow || 'データ')}</span>`,
      `    <h4>${xmlEscape(options.title)}</h4>`,
      options.description ? `    <p>${xmlEscape(options.description)}</p>` : '',
      '  </div>',
      '  <div class="market-coin-article__table-wrap">',
      '    <table class="market-coin-article__table">',
      '      <thead>',
      '        <tr>',
      (options.headers || []).map(header => `          <th>${xmlEscape(header)}</th>`).join('\n'),
      '        </tr>',
      '      </thead>',
      '      <tbody>',
      rows.map(row => [
        '        <tr>',
        (options.rowMapper(row) || []).map(cell => `          <td>${xmlEscape(cell)}</td>`).join('\n'),
        '        </tr>',
      ].join('\n')).join('\n'),
      '      </tbody>',
      '    </table>',
      '  </div>',
      '</section>',
    ].join('\n');
  }

  function renderCoinArticleTimeline(items) {
    if (!Array.isArray(items) || items.length === 0) return '';
    return [
      '<section class="market-coin-article__timeline-block">',
      '  <div class="market-coin-article__block-head">',
      '    <span>年表</span>',
      '    <h4>ビットコインの主な出来事</h4>',
      '  </div>',
      '  <ol class="market-coin-article__timeline">',
      items.map(item => [
        '    <li>',
        `      <time>${xmlEscape(item.date)}</time>`,
        '      <div>',
        `        <strong>${xmlEscape(item.event || item.title || '')}</strong>`,
        `        <p>${xmlEscape(item.note || item.body || '')}</p>`,
        '      </div>',
        '    </li>',
      ].join('\n')).join('\n'),
      '  </ol>',
      '</section>',
    ].join('\n');
  }

  function renderCoinArticleFaq(items) {
    if (!Array.isArray(items) || items.length === 0) return '';
    return [
      '<section id="coin-article-faq" class="market-coin-article__faq" data-market-coin-article-section>',
      '  <div class="market-coin-article__block-head">',
      '    <span>FAQ</span>',
      '    <h4>ビットコインFAQ</h4>',
      '  </div>',
      '  <div class="market-coin-article__faq-list">',
      items.map((item, index) => [
        index === 0 ? '    <details open>' : '    <details>',
        `      <summary>${xmlEscape(item.question)}</summary>`,
        `      <p>${xmlEscape(item.answer)}</p>`,
        '    </details>',
      ].join('\n')).join('\n'),
      '  </div>',
      '</section>',
    ].join('\n');
  }

  function renderCoinArticleLiveContext() {
    return [
      '<section id="coin-article-live-context" class="market-coin-article__live-context" aria-labelledby="coin-article-live-context-title">',
      '  <div class="market-coin-article__block-head">',
      '    <span>Live Context</span>',
      '    <h4 id="coin-article-live-context-title">いまの価格差で読む</h4>',
      '    <p>FAQの「販売所と取引所形式の違い」を、現在取得できている板・販売所データの差分で確認します。</p>',
      '  </div>',
      '  <div class="market-coin-article__live-grid">',
      '    <article>',
      '      <span>取引所形式</span>',
      '      <strong id="market-live-context-board">板データを取得中</strong>',
      '      <p id="market-live-context-board-meta">10万円買いの実効価格を確認しています。</p>',
      '    </article>',
      '    <article>',
      '      <span>販売所形式</span>',
      '      <strong id="market-live-context-sales">販売所価格を取得中</strong>',
      '      <p id="market-live-context-sales-meta">買値と売値の差を確認しています。</p>',
      '    </article>',
      '    <article>',
      '      <span>差分の目安</span>',
      '      <strong id="market-live-context-delta">計算中</strong>',
      '      <p id="market-live-context-delta-meta">データがそろうと価格差の目安を表示します。</p>',
      '    </article>',
      '  </div>',
      '</section>',
    ].join('\n');
  }

  function renderCoinArticleSources(items) {
    const sources = marketArticleList(items);
    if (sources.length === 0) return '';
    return [
      '<footer class="market-coin-article__sources">',
      '  <h4>参照した主な情報</h4>',
      '  <ul>',
      sources.map(item => `    <li>${xmlEscape(item)}</li>`).join('\n'),
      '  </ul>',
      '</footer>',
    ].join('\n');
  }

  function renderMarketVisualResearchBoard(market) {
    const article = getMarketVisualResearchContent(market);
    if (!article) return '';

    const sections = Array.isArray(article.sections) ? article.sections : [];
    const sectionById = (id) => sections.find(section => marketToken(section.id) === id);
    const title = article.title || `${market.label || article.label || article.ticker}とは？特徴・仕組み・リスク`;

    return [
      '<article class="market-coin-article" aria-labelledby="market-coin-article-title">',
      '  <header class="market-coin-article__hero">',
      '    <div class="market-coin-article__hero-copy">',
      '      <p class="market-coin-article__eyebrow">銘柄記事</p>',
      `      <h3 id="market-coin-article-title">${xmlEscape(title)}</h3>`,
      `      <p>${xmlEscape(article.lead || article.description || '')}</p>`,
      '      <div class="market-coin-article__meta">',
      `        <span>${xmlEscape(article.checkedAt || 'リサーチ確認日未設定')}</span>`,
      `        <strong>${xmlEscape(article.sourceLabel || 'research source')}</strong>`,
      '      </div>',
      '    </div>',
      article.audience ? [
        '    <aside class="market-coin-article__audience">',
        '      <span>対象読者</span>',
        `      <p>${xmlEscape(article.audience)}</p>`,
        '    </aside>',
      ].join('\n') : '',
      '  </header>',
      '  <div class="market-coin-article__summary-grid">',
      renderCoinArticleTakeaways(article.keyTakeaways),
      renderCoinArticleQuickFacts(article.quickFacts),
      '  </div>',
      '  <div class="market-coin-article__reader">',
      '    <aside class="market-coin-article__scrollspy">',
      renderCoinArticleContents(article.contents),
      '    </aside>',
      '    <div class="market-coin-article__body">',
      renderCoinArticleTextSection(sectionById('definition')),
      renderCoinArticleTextSection(sectionById('mechanism')),
      renderCoinArticleMechanism(article.mechanismLayers),
      renderCoinArticleTextSection(sectionById('history')),
      renderCoinArticleTimeline(article.timeline),
      renderCoinArticleTableBlock({
        eyebrow: '半減期',
        title: '半減期とブロック報酬',
        description: '発行ペースがどのように縮小してきたかを、期間と報酬で確認します。',
        headers: ['期間', 'ブロック報酬', 'メモ'],
        rows: article.halvings,
        rowMapper: item => [item.period, item.reward, item.note],
      }),
      renderCoinArticleTextSection(sectionById('market')),
      renderCoinArticleTableBlock({
        eyebrow: '市場',
        title: '市場データスナップショット',
        description: '価格やボラティリティは取得時点と参照元で変わるため、記事内では参考値として扱います。',
        headers: ['指標', '値', '注記'],
        rows: article.marketSnapshot,
        rowMapper: item => [item.metric || item.label, item.value, item.note],
      }),
      renderCoinArticleTextSection(sectionById('risk')),
      renderCoinArticleTableBlock({
        eyebrow: '安全',
        title: '代表的な詐欺パターンと対策',
        description: '初心者が被害に遭いやすい誘導を、注文前の確認リストとして整理します。',
        headers: ['パターン', 'よくある誘導', '対策'],
        rows: article.scams,
        rowMapper: item => [item.pattern, item.example, item.prevention],
      }),
      renderCoinArticleTableBlock({
        eyebrow: '保管',
        title: 'ウォレットの選択肢',
        description: '長期保有や送金を考える場合は、取引所保管と自己管理の違いを理解して選びます。',
        headers: ['名称', '種類', '向いている人', '注意点'],
        rows: article.wallets,
        rowMapper: item => [item.name, item.type, item.fit, item.caution],
      }),
      renderCoinArticleTextSection(sectionById('regulation')),
      renderCoinArticleTableBlock({
        eyebrow: '規制',
        title: '主要法域の規制・税務メモ',
        description: '国や地域によって、規制の軸と税務上の扱いは変わります。',
        headers: ['地域', '規制の見方', '税務の見方', '実務メモ'],
        rows: article.jurisdictions,
        rowMapper: item => [item.region, item.regulation, item.tax, item.practical],
      }),
      renderCoinArticleTextSection(sectionById('exchanges')),
      renderCoinArticleTableBlock({
        eyebrow: '国内',
        title: '国内取引所で見るポイント',
        description: '登録番号、売買形式、スプレッド、板、入出庫条件を分けて確認します。',
        headers: ['取引所', '登録番号', 'BTCの扱い', '確認ポイント'],
        rows: article.exchangeRows,
        rowMapper: item => [item.name, item.registration, item.btc, item.note],
      }),
      renderCoinArticleFaq(article.faqs),
      renderCoinArticleLiveContext(),
      renderCoinArticleSources(article.sourceNotes),
      '    <div class="market-coin-article__cta">',
      '      <p>実際に売買する前に、販売所スプレッド、板の厚み、入出金条件をこのページ内の比較表で確認してください。</p>',
      '      <a href="#market-exchange-comparison">国内取引所比較を見る</a>',
      '      <a href="#market-sales-spread-comparison">販売所スプレッドを見る</a>',
      '    </div>',
      '    </div>',
      '  </div>',
      '</article>',
    ].filter(Boolean).join('\n');
  }

  function renderMarketArticleTeaser(market) {
    const article = marketArticleForMarket(market);
    const ticker = String(market.baseCurrency || market.instrumentId || '').split('-')[0].toUpperCase();
    if (!article) {
      return [
        '<article class="market-insight-card market-insight-card--overview">',
        '  <div class="market-insight-card__header">',
        '    <div>',
        '      <p class="market-insight-card__eyebrow">Article</p>',
        `      <h3 class="market-insight-card__title">${xmlEscape(market.label)} の記事を準備中</h3>`,
        '    </div>',
        '    <span class="market-insight-card__badge">記事</span>',
        '  </div>',
        '  <p class="market-insight-card__lead">銘柄ごとの定義、仕組み、歴史、リスク、税金は記事タブへ集約していきます。</p>',
        '  <div class="decision-summary-card__actions">',
        '    <a class="btn btn-secondary px-4 py-2.5 rounded-lg text-sm" href="/articles">記事一覧を見る</a>',
        '  </div>',
        '</article>',
      ].join('\n');
    }

    return [
      '<article class="market-insight-card market-insight-card--summary">',
      '  <div class="market-insight-card__header">',
      '    <div>',
      '      <p class="market-insight-card__eyebrow">Article</p>',
      `      <h3 class="market-insight-card__title">${xmlEscape(article.title)}</h3>`,
      '    </div>',
      `    <span class="market-insight-card__badge">${xmlEscape(ticker || '記事')}</span>`,
      '  </div>',
      `  <p class="market-insight-card__lead">${xmlEscape(article.description || `${market.label} の詳しい記事を独立ページで読めます。`)}</p>`,
      '  <p class="market-insight-card__copy">このページでは国内取引所比較に集中し、銘柄の仕組み・歴史・税金・リスクは記事タブへ分けています。</p>',
      '  <div class="decision-summary-card__actions">',
      `    <a class="btn btn-primary px-4 py-2.5 rounded-lg text-sm" href="${xmlEscape(article.path)}">記事を読む</a>`,
      '    <a class="btn btn-secondary px-4 py-2.5 rounded-lg text-sm" href="/articles">記事一覧</a>',
      '  </div>',
      '</article>',
    ].join('\n');
  }

  function uniqueTextList(items) {
    const seen = new Set();
    return (items || []).filter((item) => {
      const value = String(item || '').trim();
      if (!value || seen.has(value)) return false;
      seen.add(value);
      return true;
    });
  }

  function relatedMarketItems(market, research) {
    const baseCurrency = String(market.baseCurrency || '').toUpperCase();
    return uniqueTextList(research.relatedTickers || [])
      .map(ticker => String(ticker || '').toUpperCase())
      .filter(ticker => ticker && ticker !== baseCurrency)
      .slice(0, 6)
      .map((ticker) => {
        const instrumentId = normalizeMarketInstrumentId(`${ticker}-JPY`);
        const relatedMarket = instrumentId ? getMarketInfo(instrumentId) : null;
        if (!relatedMarket) {
          return {
            label: ticker,
            meta: '関連銘柄',
            href: null,
          };
        }
        return {
          label: relatedMarket.label,
          meta: `${relatedMarket.exchanges.length}社対応`,
          href: marketPath(relatedMarket.instrumentId),
        };
      });
  }

  function renderRelatedMarketPills(items) {
    if (!items || items.length === 0) {
      return '<p class="market-feature-item__copy">関連銘柄は、国内取扱データが増え次第表示します。</p>';
    }

    return [
      '<div class="market-feature-related">',
      items.map((item) => {
        const tag = item.href ? 'a' : 'span';
        const href = item.href ? ` href="${xmlEscape(item.href)}"` : '';
        return [
          `  <${tag} class="market-feature-related__pill"${href}>`,
          `    <span class="market-feature-related__label">${xmlEscape(item.label)}</span>`,
          `    <span class="market-feature-related__meta">${xmlEscape(item.meta)}</span>`,
          `  </${tag}>`,
        ].join('\n');
      }).join('\n'),
      '</div>',
    ].join('\n');
  }

  function renderMarketDeepDiveCards(market) {
    const research = market.research || getMarketResearchContent(market);
    const domesticAvailability = research.domesticAvailability || {};
    const ticker = research.ticker || market.baseCurrency || market.instrumentId;
    const relatedItems = relatedMarketItems(market, research);
    const topVolumeText = market.topVolumeExchangeLabel
      ? `${market.topVolumeExchangeLabel} / ${market.instrumentTotalQuoteVolume > 0 ? formatJpyCompact(market.instrumentTotalQuoteVolume) : '出来高取得中'}`
      : '出来高データ待ち';
    const spreadText = market.bestSpreadExchangeLabel
      ? `${market.bestSpreadExchangeLabel} / ${formatPct(market.bestSpreadPct)}`
      : (market.marketType === 'derivative' ? '販売所スプレッド対象外' : '販売所データ待ち');
    const exchangeText = market.exchangeCount
      ? `${market.exchangeCount}社で取扱確認`
      : '取扱データ待ち';
    const quoteText = market.quoteCurrency ? `${market.quoteCurrency}建て` : 'JPY建て';
    const researchQuestions = [
      {
        label: '何に使う銘柄か',
        body: research.purpose || research.plainUse,
      },
      {
        label: '仕組みとネットワーク',
        body: `${research.network || '公式情報確認'} / ${research.consensus || '検証方式確認'}`,
      },
      {
        label: '国内での買い方',
        body: domesticAvailability.summary || `${exchangeText}。板、販売所、入出庫条件を分けて確認します。`,
      },
      {
        label: '比較対象',
        body: relatedItems.length > 0
          ? relatedItems.map(item => item.label).join(' / ')
          : '主要銘柄や同カテゴリの銘柄と用途を比べます。',
      },
    ];
    const evidenceRows = [
      { label: 'カテゴリ', value: research.category || '暗号資産', note: '価格ではなく用途の分類' },
      { label: '供給', value: research.maxSupply || '公式情報確認', note: '発行上限・発行条件' },
      { label: '国内取扱', value: exchangeText, note: `${market.marketTypeLabel || '現物'} / ${quoteText}` },
      { label: '流動性', value: topVolumeText, note: '24h出来高ベースの参考' },
      { label: '販売所コスト', value: spreadText, note: '買値と売値の差' },
      { label: '送金確認', value: market.fundingSupport ? market.fundingSupport.summary : '公式条件確認', note: 'ネットワーク・停止状況を確認' },
    ];
    const readingOrder = [
      '用途と仕組みを見て、短期ニュースだけで買わない',
      '国内取扱数、板の厚み、出来高を同じ銘柄で確認する',
      '販売所を使う場合はスプレッド率と注文金額をセットで見る',
      '送金予定がある場合はネットワーク、宛先タグ、最小出金額を公式画面で確認する',
    ];

    return [
      '<article class="market-deep-dive-hero market-insight-card">',
      '  <div class="market-deep-dive-hero__copy">',
      '    <p class="market-insight-card__eyebrow">Deep Dive</p>',
      `    <h3 class="market-insight-card__title">${xmlEscape(ticker)}を深掘りする</h3>`,
      `    <p class="market-insight-card__lead">${xmlEscape(research.plainUse || research.purpose)}</p>`,
      `    <p class="market-insight-card__copy">${xmlEscape(research.mechanism)}</p>`,
      '  </div>',
      '  <dl class="market-deep-dive-hero__facts">',
      evidenceRows.slice(0, 3).map(item => [
        '    <div>',
        `      <dt>${xmlEscape(item.label)}</dt>`,
        `      <dd>${xmlEscape(item.value)}</dd>`,
        `      <small>${xmlEscape(item.note)}</small>`,
        '    </div>',
      ].join('\n')).join('\n'),
      '  </dl>',
      '</article>',
      '<div class="market-deep-dive-grid">',
      '  <article class="market-deep-dive-card">',
      '    <h4>調べる観点</h4>',
      '    <div class="market-deep-dive-question-list">',
      researchQuestions.map(item => [
        '      <section>',
        `        <strong>${xmlEscape(item.label)}</strong>`,
        `        <p>${xmlEscape(item.body || '公式情報を確認します。')}</p>`,
        '      </section>',
      ].join('\n')).join('\n'),
      '    </div>',
      '  </article>',
      '  <article class="market-deep-dive-card">',
      '    <h4>見る順番</h4>',
      '    <ol class="market-deep-dive-steps">',
      readingOrder.map(item => `      <li>${xmlEscape(item)}</li>`).join('\n'),
      '    </ol>',
      '  </article>',
      '  <article class="market-deep-dive-card market-deep-dive-card--signals">',
      '    <h4>確認シグナル</h4>',
      '    <dl class="market-deep-dive-signal-list">',
      evidenceRows.slice(3).map(item => [
        '      <div>',
        `        <dt>${xmlEscape(item.label)}</dt>`,
        `        <dd>${xmlEscape(item.value)}</dd>`,
        `        <small>${xmlEscape(item.note)}</small>`,
        '      </div>',
      ].join('\n')).join('\n'),
      '    </dl>',
      '  </article>',
      '  <article class="market-deep-dive-card">',
      '    <h4>関連銘柄</h4>',
      renderRelatedMarketPills(relatedItems),
      '  </article>',
      '</div>',
    ].join('\n');
  }

  function renderMarketFeatureCard(market) {
    const research = market.research || getMarketResearchContent(market);
    const domesticAvailability = research.domesticAvailability || {};
    const assetName = research.ticker || market.baseCurrency || market.label;
    const useCases = uniqueTextList(research.featureUseCases || research.useCases || []).slice(0, 4);
    const cautions = uniqueTextList(research.featureCautions || research.risks || []).slice(0, 4);
    const domesticDetails = uniqueTextList([
      research.domesticHandling,
      domesticAvailability.summary,
      market.exchangeCount ? `このページでは国内現物 ${market.exchangeCount}社の板、出来高、販売所スプレッドを同じ銘柄で比較できます。` : '',
    ]).slice(0, 3);
    const relatedItems = relatedMarketItems(market, research);

    return [
      '<article class="market-insight-card market-insight-card--asset-feature">',
      '  <div class="market-insight-card__header">',
      '    <div>',
      '      <p class="market-insight-card__eyebrow">About Asset</p>',
      `      <h3 class="market-insight-card__title">${xmlEscape(assetName)}とは</h3>`,
      '    </div>',
      '    <span class="market-insight-card__badge">この銘柄について</span>',
      '  </div>',
      `  <p class="market-insight-card__lead">${xmlEscape(research.purpose || research.plainUse)}</p>`,
      domesticDetails[0] ? `  <p class="market-insight-card__copy">${xmlEscape(domesticDetails[0])}</p>` : '',
      '  <div class="market-feature-grid">',
      '    <section class="market-feature-item">',
      '      <h4 class="market-feature-item__title">1. 何のための銘柄か</h4>',
      `      <p class="market-feature-item__copy">${xmlEscape(research.purpose || research.plainUse)}</p>`,
      '    </section>',
      '    <section class="market-feature-item">',
      '      <h4 class="market-feature-item__title">2. 主な用途</h4>',
      '      <ol class="market-feature-list">',
      useCases.map(item => `        <li>${xmlEscape(item)}</li>`).join('\n'),
      '      </ol>',
      '    </section>',
      '    <section class="market-feature-item">',
      '      <h4 class="market-feature-item__title">3. 仕組み</h4>',
      `      <p class="market-feature-item__copy">${xmlEscape(research.mechanism)}</p>`,
      '    </section>',
      '    <section class="market-feature-item">',
      '      <h4 class="market-feature-item__title">4. 国内取引所での扱われ方</h4>',
      domesticDetails.map(item => `      <p class="market-feature-item__copy">${xmlEscape(item)}</p>`).join('\n'),
      '    </section>',
      '    <section class="market-feature-item market-feature-item--warning">',
      '      <h4 class="market-feature-item__title">5. 注意点</h4>',
      '      <ol class="market-feature-list">',
      cautions.map(item => `        <li>${xmlEscape(item)}</li>`).join('\n'),
      '      </ol>',
      '    </section>',
      '    <section class="market-feature-item">',
      '      <h4 class="market-feature-item__title">6. 関連銘柄</h4>',
      renderRelatedMarketPills(relatedItems),
      '    </section>',
      '  </div>',
      '  <p class="market-insight-card__note">銘柄の特徴は一般的な理解を助けるための整理です。購入判断ではなく、取扱方式、板の厚み、販売所スプレッド、入出庫条件を確認する入口として使ってください。</p>',
      '</article>',
    ].filter(Boolean).join('\n');
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
      renderMarketFeatureCard(market),
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
    if (market.marketType === 'derivative') {
      return {
        lead: 'デリバティブを取引する前に見るポイント',
        checks: [
          '現物ではなく証拠金取引・CFD/FXであること',
          '最大レバレッジと必要証拠金',
          'ロスカット、追加証拠金、建玉上限',
          '取引手数料、Funding、レバレッジポイント',
          '現物価格との乖離と板の厚み',
          '自分の注文サイズで約定価格がどこまで動くか',
        ],
        cautions: [
          'レバレッジにより損失が証拠金に対して大きくなる場合があります。',
          '現物BTC/JPYとは別市場なので、同じ価格で約定するとは限りません。',
          'Fundingやレバレッジポイントなど、保有中に発生する費用を公式条件で確認してください。',
          'ロスカットルール、証拠金維持率、建玉上限は取引所ごとに異なります。',
          ...(research.risks || []),
        ].filter(Boolean).slice(0, 6),
      };
    }

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
      '  <ul class="market-insight-checkbox-list" data-market-pretrade-checklist>',
      checklist.checks.map((item, index) => [
        '    <li>',
        `      <button class="market-insight-checkbox-list__button" type="button" data-pretrade-check="${index}" aria-pressed="false">`,
        '        <span class="market-insight-checkbox-list__box" aria-hidden="true"></span>',
        `        <span>${xmlEscape(item)}</span>`,
        '      </button>',
        '    </li>',
      ].join('\n')).join('\n'),
      '  </ul>',
      '  <div class="market-pretrade-ready" data-pretrade-ready hidden><span aria-hidden="true"></span><strong>おめでとうございます！準備完了です</strong><a id="market-pretrade-primary-cta" class="market-pretrade-ready__cta is-disabled" href="#market-exchange-comparison" aria-disabled="true">最安候補を確認する</a></div>',
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
      quoteCurrency: firstMarket.quoteCurrency || normalizedInstrumentId.split('-').at(-1) || 'JPY',
      marketType: firstMarket.marketType || 'spot',
      marketTypeLabel: firstMarket.marketTypeLabel || (firstMarket.marketType === 'derivative' ? 'デリバティブ' : '現物'),
      derivativeType: firstMarket.derivativeType || null,
      underlyingInstrumentId: firstMarket.underlyingInstrumentId || null,
      exchanges,
    };
  }

  function buildMarketSwitchOptions(currentMarket) {
    const currentInstrumentId = currentMarket && currentMarket.instrumentId;
    const candidateIds = [
      currentInstrumentId,
      'BTC-JPY',
      'ETH-JPY',
      'SOL-JPY',
      'XRP-JPY',
    ].filter(Boolean);
    const seen = new Set();
    return candidateIds
      .map(instrumentId => normalizeMarketInstrumentId(instrumentId))
      .filter((instrumentId) => {
        if (!instrumentId || seen.has(instrumentId)) return false;
        seen.add(instrumentId);
        return true;
      })
      .map(instrumentId => getMarketInfo(instrumentId))
      .filter(Boolean)
      .filter(market => market.marketType !== 'derivative')
      .map(market => ({
        instrumentId: market.instrumentId,
        label: market.label,
        baseCurrency: market.baseCurrency,
        quoteCurrency: market.quoteCurrency,
      }));
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
            quoteCurrency: market.quoteCurrency || instrumentId.split('-').at(-1) || 'JPY',
            marketType: market.marketType || 'spot',
            marketTypeLabel: market.marketTypeLabel || (market.marketType === 'derivative' ? 'デリバティブ' : '現物'),
            derivativeType: market.derivativeType || null,
            underlyingInstrumentId: market.underlyingInstrumentId || null,
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
      const change24h = metrics.change24hByInstrument.get(market.instrumentId) || null;
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
        change24hPct: change24h ? change24h.changePct : null,
        change24hExchangeLabel: change24h ? change24h.exchangeLabel : null,
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

  function renderCampaignContextCards(cards) {
    return cards.map((card) => {
      const attrs = [
        `class="market-context-card"`,
        card.href ? `href="${xmlEscape(card.href)}"` : '',
        card.target ? `target="${xmlEscape(card.target)}"` : '',
        card.rel ? `rel="${xmlEscape(card.rel)}"` : '',
        card.referrerPolicy ? `referrerpolicy="${xmlEscape(card.referrerPolicy)}"` : '',
      ].filter(Boolean).join(' ');
      const tag = card.href ? 'a' : 'article';
      return [
        `<${tag} ${attrs}>`,
        `  <span class="market-context-card__eyebrow">${xmlEscape(card.eyebrow)}</span>`,
        `  <strong class="market-context-card__title">${xmlEscape(card.title)}</strong>`,
        `  <span class="market-context-card__description">${xmlEscape(card.description)}</span>`,
        `  <span class="market-context-card__cta">${xmlEscape(card.cta)}${card.trackingPixelUrl ? `<img src="${xmlEscape(card.trackingPixelUrl)}" width="1" height="1" border="0" alt="">` : ''}</span>`,
        `</${tag}>`,
      ].join('\n');
    }).join('\n');
  }

  const LEARN_ARTICLE_ORDER = [
    '/learn/exchange-vs-broker',
    '/learn/spread',
    '/learn/order-book-trading',
    '/learn/crypto-fees',
    '/learn/jpy-withdrawal-fees',
    '/learn/crypto-withdrawal-fees',
    '/learn/buying-100k-points',
    '/learn/broker-loss-reasons',
    '/learn/exchange-checklist',
    '/learn/slippage',
    '/learn/market-order-risk',
    '/learn/exchange-company-analysis',
    '/learn/how-to-compare-exchanges',
  ];

  const LEARN_ARTICLE_META = {
    '/learn/exchange-vs-broker': {
      icon: '販/板',
      step: 'STEP 1',
      stepLabel: '取引の仕組みを知る',
      level: '超初心者',
      readMinutes: 4,
      mustRead: true,
      filters: ['beginner', 'mechanism'],
      tags: ['超初心者', '仕組み', '必読'],
    },
    '/learn/spread': {
      icon: '%',
      step: 'STEP 2',
      stepLabel: 'コストを理解する',
      level: '超初心者',
      readMinutes: 3,
      mustRead: true,
      filters: ['beginner', 'cost'],
      tags: ['超初心者', 'コスト', '必読'],
    },
    '/learn/order-book-trading': {
      icon: '板',
      step: 'STEP 1',
      stepLabel: '取引の仕組みを知る',
      level: '初級',
      readMinutes: 4,
      filters: ['mechanism'],
      tags: ['板取引', '仕組み'],
    },
    '/learn/crypto-fees': {
      icon: '￥',
      step: 'STEP 2',
      stepLabel: 'コストを理解する',
      level: '初級',
      readMinutes: 5,
      mustRead: true,
      filters: ['cost'],
      tags: ['手数料', 'コスト', '必読'],
    },
    '/learn/jpy-withdrawal-fees': {
      icon: '円',
      step: 'STEP 2',
      stepLabel: 'コストを理解する',
      level: '初級',
      readMinutes: 4,
      filters: ['cost', 'withdrawal'],
      tags: ['日本円出金', 'コスト'],
    },
    '/learn/crypto-withdrawal-fees': {
      icon: '送',
      step: 'STEP 2',
      stepLabel: 'コストを理解する',
      level: '初級',
      readMinutes: 5,
      filters: ['cost', 'withdrawal'],
      tags: ['暗号資産出金', '送金'],
    },
    '/learn/buying-100k-points': {
      icon: '10',
      step: 'STEP 3',
      stepLabel: '買う前に確認する',
      level: '超初心者',
      readMinutes: 4,
      mustRead: true,
      filters: ['beginner', 'risk'],
      tags: ['10万円', '買う前', '必読'],
    },
    '/learn/broker-loss-reasons': {
      icon: '注',
      step: 'STEP 3',
      stepLabel: '買う前に確認する',
      level: '初級',
      readMinutes: 6,
      filters: ['risk', 'cost'],
      tags: ['販売所', 'スプレッド', 'リスク'],
    },
    '/learn/exchange-checklist': {
      icon: '選',
      step: 'STEP 4',
      stepLabel: '取引所を選ぶ',
      level: '初級',
      readMinutes: 6,
      mustRead: true,
      filters: ['exchange'],
      tags: ['取引所選び', '口座開設', '必読'],
    },
    '/learn/slippage': {
      icon: 'ズ',
      step: 'STEP 2',
      stepLabel: 'コストを理解する',
      level: '初級',
      readMinutes: 3,
      filters: ['cost', 'risk'],
      tags: ['スリッページ', 'リスク'],
    },
    '/learn/market-order-risk': {
      icon: '成',
      step: 'STEP 3',
      stepLabel: '買う前に確認する',
      level: '初級',
      readMinutes: 3,
      filters: ['risk', 'mechanism'],
      tags: ['成行注文', 'リスク'],
    },
    '/learn/exchange-company-analysis': {
      icon: '財',
      step: 'STEP 4',
      stepLabel: '取引所を選ぶ',
      level: '初級',
      readMinutes: 5,
      filters: ['exchange'],
      tags: ['安全性', '運営会社'],
    },
    '/learn/how-to-compare-exchanges': {
      icon: '比',
      step: 'STEP 4',
      stepLabel: '取引所を選ぶ',
      level: '初級',
      readMinutes: 6,
      filters: ['exchange', 'cost'],
      tags: ['比較手順', '取引所選び'],
    },
  };

  const LEARN_FILTERS = [
    { value: 'all', label: 'すべて' },
    { value: 'must', label: '必読' },
    { value: 'beginner', label: '超初心者' },
    { value: 'mechanism', label: '仕組み' },
    { value: 'cost', label: 'コスト' },
    { value: 'exchange', label: '取引所選び' },
    { value: 'risk', label: 'リスク' },
    { value: 'withdrawal', label: '出金・送金' },
  ];

  const LEARN_ROADMAP = [
    {
      step: 'STEP 1',
      title: '取引の仕組みを知る',
      description: '販売所と取引所、板取引の違いを先に押さえます。',
      paths: ['/learn/exchange-vs-broker', '/learn/order-book-trading'],
    },
    {
      step: 'STEP 2',
      title: 'コストを理解する',
      description: 'スプレッド、手数料、出金コストを分けて見ます。',
      paths: ['/learn/spread', '/learn/crypto-fees', '/learn/slippage'],
    },
    {
      step: 'STEP 3',
      title: '買う前に確認する',
      description: '10万円分買う前の注意点と、損しやすい場面を確認します。',
      paths: ['/learn/buying-100k-points', '/learn/market-order-risk', '/learn/broker-loss-reasons'],
    },
    {
      step: 'STEP 4',
      title: '取引所を選ぶ',
      description: '口座開設前に見る条件、安全性、比較手順を整理します。',
      paths: ['/learn/exchange-checklist', '/learn/how-to-compare-exchanges', '/learn/exchange-company-analysis'],
    },
  ];

  function learnArticleRank(article) {
    const index = LEARN_ARTICLE_ORDER.indexOf(article.path);
    return index === -1 ? LEARN_ARTICLE_ORDER.length : index;
  }

  function learnArticleMeta(article) {
    return LEARN_ARTICLE_META[article.path] || {
      icon: '読',
      step: 'GUIDE',
      stepLabel: '補足ガイド',
      level: '初級',
      readMinutes: 4,
      filters: [],
      tags: ['ガイド'],
    };
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

  function listMarketArticles() {
    return listArticles()
      .filter(article => (
        String(article.path || '').startsWith('/articles/')
        || String(article.articleType || '').toLowerCase() === 'market'
        || Boolean(article.marketTicker)
      ))
      .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
  }

  function articleInstrumentId(article) {
    const explicit = normalizeMarketInstrumentId(article && article.marketInstrumentId);
    if (explicit) return explicit;
    const ticker = String(
      (article && article.marketTicker)
      || (article && article.slug)
      || ''
    ).trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    return ticker ? `${ticker}-JPY` : '';
  }

  function articleTicker(article) {
    const explicit = String(article && article.marketTicker || '').trim().toUpperCase();
    if (explicit) return explicit;
    const instrumentId = articleInstrumentId(article);
    return instrumentId ? instrumentId.split('-')[0] : '';
  }

  function articleReadMinutes(article) {
    const explicit = Number(article && article.readMinutes);
    if (Number.isFinite(explicit) && explicit > 0) return explicit;
    return learnArticleMeta(article).readMinutes || 5;
  }

  function marketArticleForMarket(market) {
    const instrumentId = normalizeMarketInstrumentId(market && market.instrumentId);
    const ticker = String(market && market.baseCurrency || (instrumentId ? instrumentId.split('-')[0] : '')).toUpperCase();
    return listMarketArticles().find(article => (
      articleInstrumentId(article) === instrumentId
      || articleTicker(article) === ticker
    )) || null;
  }

  function articleIndexStructuredData(articles, origin, description) {
    const pageUrl = siteUrl(origin, '/articles');
    return [
      {
        '@context': 'https://schema.org',
        '@type': 'CollectionPage',
        name: '銘柄記事ライブラリ',
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
        name: '銘柄記事一覧',
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

  function renderArticleFilterControls(articles) {
    const tickerFilters = [...new Set(articles.map(articleTicker).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b, 'ja'))
      .map(ticker => ({ value: ticker.toLowerCase(), label: ticker }));
    const filters = [
      { value: 'all', label: 'すべて' },
      { value: 'asset', label: '銘柄' },
      ...tickerFilters,
    ];

    return [
      '<div class="learn-library-toolbar">',
      '  <label class="learn-search-field">',
      '    <span class="sr-only">記事をキーワード検索</span>',
      '    <span class="learn-search-field__icon" aria-hidden="true">検索</span>',
      '    <input type="search" data-learn-search placeholder="BTC、税金、リスク、仕組みなど" autocomplete="off">',
      '  </label>',
      '  <div class="learn-filter-list" role="group" aria-label="記事を絞り込む">',
      filters.map((filter, index) => (
        `    <button class="learn-filter-chip${index === 0 ? ' is-active' : ''}" type="button" data-learn-filter="${xmlEscape(filter.value)}" aria-pressed="${index === 0 ? 'true' : 'false'}">${xmlEscape(filter.label)}</button>`
      )).join('\n'),
      '  </div>',
      '  <p class="learn-result-count" data-learn-result-count aria-live="polite"></p>',
      '</div>',
    ].join('\n');
  }

  function renderArticleCards(articles) {
    if (articles.length === 0) {
      return '<p class="text-center text-gray-500 py-8">銘柄記事を準備中です。</p>';
    }

    return articles.map((article) => {
      const ticker = articleTicker(article);
      const filters = ['asset', ticker.toLowerCase()].filter(Boolean);
      const tags = [ticker, article.category, ...(article.tags || [])].filter(Boolean);
      const instrumentId = articleInstrumentId(article);
      const searchText = [article.title, article.description, ticker, article.category, ...(article.tags || [])].join(' ');
      return [
        `<a class="learn-card" href="${xmlEscape(article.path)}" data-learn-card data-learn-tags="${xmlEscape(filters.join(' '))}" data-learn-search-text="${xmlEscape(searchText)}">`,
        '  <span class="learn-card__topline">',
        `    <span class="learn-card__icon" aria-hidden="true">${xmlEscape(ticker || '記事')}</span>`,
        '    <span class="learn-card__meta">',
        `      <span class="learn-card__step">${xmlEscape(instrumentId || 'ARTICLE')}</span>`,
        `      <span class="learn-card__reading-time">読む目安 ${xmlEscape(String(articleReadMinutes(article)))}分</span>`,
        '    </span>',
        '  </span>',
        `  <strong>${xmlEscape(article.title)}</strong>`,
        `  <span class="learn-card__description">${xmlEscape(article.description)}</span>`,
        '  <span class="learn-card__tags" aria-label="記事タグ">',
        tags.slice(0, 5).map(tag => `    <span>${xmlEscape(tag)}</span>`).join('\n'),
        '  </span>',
        '</a>',
      ].join('\n');
    }).join('\n');
  }

  function renderArticlesIndexHtml(req) {
    const origin = requestOrigin(req);
    const articles = listMarketArticles();
    const title = `銘柄記事ライブラリ｜${SITE_NAME}`;
    const description = 'BTC、ETH、XRPなど暗号資産ごとの仕組み、歴史、リスク、税金、国内取引所で見るポイントをまとめる銘柄記事ライブラリです。';
    const head = renderHeadMeta({
      title,
      description,
      canonical: '/articles',
      ogImage: '/ogp/default.png',
      pageId: 'articles',
      includeDefaultJsonLd: false,
      structuredData: articleIndexStructuredData(articles, origin, description),
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
      '  <link rel="stylesheet" href="/css/style.css?v=ui-35">',
      '</head>',
      '<body class="terminal-body bg-gray-950 text-gray-200 min-h-screen">',
      '  <a href="#main" class="sr-only skip-link">メインコンテンツへスキップ</a>',
      '  <header class="topbar px-6 py-3">',
      '    <div class="brand-cluster">',
      '      <div class="brand-mark" aria-hidden="true">₿</div>',
      '      <div class="brand-copy min-w-0">',
      `        <h1 class="page-title">${xmlEscape(SITE_NAME)}</h1>`,
      '        <div class="brand-subtitle">記事</div>',
      '      </div>',
      '    </div>',
      '    <nav class="nav-menu" aria-label="ページ間ナビゲーション">',
      '      <a class="nav-link" href="/">ホーム</a>',
      '      <a class="nav-link" href="/research">調べる</a>',
      '      <a class="nav-link is-active" href="/articles" aria-current="page">記事</a>',
      '      <a class="nav-link" href="/markets">銘柄深掘り</a>',
      '      <a class="nav-link" href="/learn">初心者ガイド</a>',
      '    </nav>',
      '  </header>',
      '  <main id="main" class="dashboard-shell home-shell flex flex-col gap-4 p-4 max-w-[1180px] mx-auto">',
      '    <section class="panel panel--dense learn-hero" aria-labelledby="articles-hero-title">',
      '      <div class="panel-title-row mb-4">',
      '        <div>',
      '          <p class="panel-kicker mb-2">Articles</p>',
      '          <h2 id="articles-hero-title" class="text-3xl md:text-4xl font-bold text-gray-100">銘柄記事ライブラリ</h2>',
      `          <p class="text-sm text-gray-400 mt-3 leading-7">${xmlEscape(description)}</p>`,
      '        </div>',
      '      </div>',
      '      <div class="learn-hero__actions" aria-label="記事ライブラリの入口">',
      '        <a class="btn btn-primary px-4 py-3 rounded-lg font-bold text-sm" href="#article-library">記事を探す</a>',
      '        <a class="btn btn-secondary px-4 py-3 rounded-lg font-bold text-sm" href="/markets">銘柄比較へ</a>',
      '      </div>',
      '      <div class="learn-hero__signals" aria-label="掲載内容">',
      '        <span>銘柄別</span>',
      '        <span>仕組みとリスク</span>',
      '        <span>国内取引所比較に接続</span>',
      '      </div>',
      '    </section>',
      '    <section id="article-library" class="panel panel--dense learn-library" aria-labelledby="article-library-title">',
      '      <div class="panel-title-row mb-4">',
      '        <div>',
      '          <p class="panel-kicker mb-2">Library</p>',
      '          <h2 id="article-library-title" class="panel-title">銘柄別に記事を探す</h2>',
      '        </div>',
      '      </div>',
      renderArticleFilterControls(articles),
      '      <div class="learn-card-grid" data-learn-card-grid>',
      renderArticleCards(articles),
      '      </div>',
      '      <p class="learn-empty-state" data-learn-empty hidden>条件に合う記事がありません。検索語を短くするか、別の銘柄を選んでください。</p>',
      '    </section>',
      renderCompareToolSection('articles-compare-tools-title'),
      '  </main>',
      `  <footer class="border-t border-gray-800 px-6 py-2 text-xs text-gray-600 text-center">${xmlEscape(SITE_NAME)} | 記事</footer>`,
      '  <script src="/js/learn.js?v=1"></script>',
      '</body>',
      '</html>',
    ].join('\n'), { activeSection: 'articles', activePath: '/articles' });
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

  function renderLearnFilterControls() {
    return [
      '<div class="learn-library-toolbar">',
      '  <label class="learn-search-field">',
      '    <span class="sr-only">記事をキーワード検索</span>',
      '    <span class="learn-search-field__icon" aria-hidden="true">検索</span>',
      '    <input type="search" data-learn-search placeholder="スプレッド、手数料、口座開設など" autocomplete="off">',
      '  </label>',
      '  <div class="learn-filter-list" role="group" aria-label="目的別に絞り込む">',
      LEARN_FILTERS.map((filter, index) => (
        `    <button class="learn-filter-chip${index === 0 ? ' is-active' : ''}" type="button" data-learn-filter="${xmlEscape(filter.value)}" aria-pressed="${index === 0 ? 'true' : 'false'}">${xmlEscape(filter.label)}</button>`
      )).join('\n'),
      '  </div>',
      '  <p class="learn-result-count" data-learn-result-count aria-live="polite"></p>',
      '</div>',
    ].join('\n');
  }

  function renderLearnRoadmap(articles) {
    const articleByPath = new Map(articles.map(article => [article.path, article]));
    return [
      '<section id="learn-roadmap" class="panel panel--dense learn-roadmap-section" aria-labelledby="learn-roadmap-title">',
      '  <div class="panel-title-row mb-4">',
      '    <div>',
      '      <p class="panel-kicker mb-2">Roadmap</p>',
      '      <h2 id="learn-roadmap-title" class="panel-title">まずはこの順番で読む</h2>',
      '    </div>',
      '  </div>',
      '  <div class="learn-roadmap-grid">',
      LEARN_ROADMAP.map(step => [
        '    <article class="learn-roadmap-card">',
        `      <span class="learn-roadmap-card__step">${xmlEscape(step.step)}</span>`,
        `      <h3>${xmlEscape(step.title)}</h3>`,
        `      <p>${xmlEscape(step.description)}</p>`,
        '      <ol class="learn-roadmap-card__links">',
        step.paths.map((articlePath) => {
          const article = articleByPath.get(articlePath);
          if (!article) return '';
          const meta = learnArticleMeta(article);
          return [
            '        <li>',
            `          <a href="${xmlEscape(article.path)}">`,
            `            <span>${xmlEscape(article.title)}</span>`,
            meta.mustRead ? '            <b>必読</b>' : '',
            '          </a>',
            '        </li>',
          ].filter(Boolean).join('\n');
        }).filter(Boolean).join('\n'),
        '      </ol>',
        '    </article>',
      ].join('\n')).join('\n'),
      '  </div>',
      '</section>',
    ].join('\n');
  }

  function renderLearnArticleCards(articles) {
    if (articles.length === 0) {
      return '<p class="text-center text-gray-500 py-8">初心者向け記事を準備中です。</p>';
    }

    return articles.map((article) => {
      const meta = learnArticleMeta(article);
      const filters = [...new Set([...(meta.filters || []), meta.mustRead ? 'must' : ''].filter(Boolean))];
      const searchText = [article.title, article.description, meta.stepLabel, meta.level, ...(meta.tags || [])].join(' ');
      return [
        `<a class="learn-card${meta.mustRead ? ' learn-card--must' : ''}" href="${xmlEscape(article.path)}" data-learn-card data-learn-tags="${xmlEscape(filters.join(' '))}" data-learn-search-text="${xmlEscape(searchText)}" data-learn-must="${meta.mustRead ? 'true' : 'false'}">`,
        '  <span class="learn-card__topline">',
        `    <span class="learn-card__icon" aria-hidden="true">${xmlEscape(meta.icon)}</span>`,
        '    <span class="learn-card__meta">',
        `      <span class="learn-card__step">${xmlEscape(meta.step)}</span>`,
        `      <span class="learn-card__reading-time">読む目安 ${xmlEscape(String(meta.readMinutes || 4))}分</span>`,
        '    </span>',
        meta.mustRead ? '    <span class="learn-card__must">必読</span>' : '',
        '  </span>',
        `  <strong>${xmlEscape(article.title)}</strong>`,
        `  <span class="learn-card__description">${xmlEscape(article.description)}</span>`,
        '  <span class="learn-card__tags" aria-label="記事タグ">',
        (meta.tags || []).map(tag => `    <span>${xmlEscape(tag)}</span>`).join('\n'),
        '  </span>',
        '</a>',
      ].join('\n');
    }).join('\n');
  }

  function renderLearnIndexHtml(req) {
    const origin = requestOrigin(req);
    const articles = listLearnArticles();
    const title = `初心者向け暗号資産取引ガイド｜${SITE_NAME}`;
    const description = '販売所と取引所の違い、スプレッド、板取引、暗号資産の手数料、10万円分買う前の確認ポイント、販売所で損しやすい理由、失敗しない取引所の選び方と口座開設ガイドを初心者向けに整理した学習ページです。';
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
      '  <link rel="stylesheet" href="/css/style.css?v=ui-35">',
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
      '      <a class="nav-link" href="/simulator">取引コスト計算</a>',
      '      <a class="nav-link" href="/markets">銘柄深掘り</a>',
      '      <a class="nav-link" href="/sales-spread">販売所スプレッド</a>',
      '    </nav>',
      '  </header>',
      '  <main id="main" class="dashboard-shell home-shell flex flex-col gap-4 p-4 max-w-[1180px] mx-auto">',
      '    <section class="panel panel--dense learn-hero" aria-labelledby="learn-hero-title">',
      '      <div class="panel-title-row mb-4">',
      '        <div>',
      '          <p class="panel-kicker mb-2">Learn</p>',
      '          <h2 id="learn-hero-title" class="text-3xl md:text-4xl font-bold text-gray-100">初心者向け暗号資産取引ガイド</h2>',
      `          <p class="text-sm text-gray-400 mt-3 leading-7">${xmlEscape(description)}</p>`,
      '        </div>',
      '      </div>',
      '      <div class="learn-hero__actions" aria-label="学習の入口">',
      '        <a class="btn btn-primary px-4 py-3 rounded-lg font-bold text-sm" href="#learn-roadmap">順番に読む</a>',
      '        <a class="btn btn-secondary px-4 py-3 rounded-lg font-bold text-sm" href="#learn-library">目的で探す</a>',
      '      </div>',
      '      <div class="learn-hero__signals" aria-label="掲載内容">',
      '        <span>初心者向け</span>',
      '        <span>読む順番つき</span>',
      '        <span>コスト比較に直結</span>',
      '      </div>',
      '    </section>',
      renderLearnRoadmap(articles),
      '    <section id="learn-library" class="panel panel--dense learn-library" aria-labelledby="learn-library-title">',
      '      <div class="panel-title-row mb-4">',
      '        <div>',
      '          <p class="panel-kicker mb-2">Library</p>',
      '          <h2 id="learn-library-title" class="panel-title">目的別に記事を探す</h2>',
      '        </div>',
      '      </div>',
      renderLearnFilterControls(),
      '      <div class="learn-card-grid" data-learn-card-grid>',
      renderLearnArticleCards(articles),
      '      </div>',
      '      <p class="learn-empty-state" data-learn-empty hidden>条件に合う記事がありません。検索語を短くするか、別のタグを選んでください。</p>',
      '    </section>',
      renderCompareToolSection('learn-compare-tools-title'),
      '  </main>',
      `  <footer class="border-t border-gray-800 px-6 py-2 text-xs text-gray-600 text-center">${xmlEscape(SITE_NAME)} | 初心者ガイド</footer>`,
      '  <script src="/js/learn.js?v=1"></script>',
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
    return exchanges.map((exchange) => UIComponents.renderExchangeCard({
      href: `${exchange.path}#exchange-research`,
      eyebrow: 'Exchange Research',
      title: exchange.label,
      description: `手数料 ${exchange.feeLabel} / 取扱銘柄 ${exchange.marketCount}件 / 運営会社・財務情報の確認へ`,
      badge: 'Research',
      metrics: ['取引所リサーチへ'],
      className: 'market-context-card',
    })).join('\n');
  }

  function renderResearchMarketCards(markets) {
    return markets.map((market) => {
      const research = market.research || getMarketResearchContent(market);
      return UIComponents.renderMarketCard({
        href: `${market.path}#market-research`,
        eyebrow: 'Asset Profile',
        title: market.label,
        description: `${research.category} / ${market.exchangeCount}社対応 / ${research.plainUse}`,
        badge: `${market.exchangeCount}社`,
        metrics: ['特徴・用途・リスクへ'],
        className: 'market-context-card',
      });
    }).join('\n');
  }

  function renderResearchGuideCards(articles) {
    const preferredPaths = [
      '/learn/exchange-vs-broker',
      '/learn/spread',
      '/learn/order-book-trading',
      '/learn/crypto-fees',
      '/learn/jpy-withdrawal-fees',
      '/learn/crypto-withdrawal-fees',
      '/learn/buying-100k-points',
      '/learn/broker-loss-reasons',
      '/learn/exchange-checklist',
      '/learn/slippage',
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
        title: '取引コスト計算（板シミュレーター）',
        description: '実際の取引価格（板情報）から、成行注文時の想定コストを計算',
        href: '/simulator?market=BTC-JPY&side=buy&amountType=jpy&amount=100000',
      },
      {
        title: '販売所スプレッド比較',
        description: '販売所の手数料相当額（スプレッド）を確認',
        href: '/sales-spread?instrumentId=BTC-JPY',
      },
      {
        title: '出来高シェア',
        description: '取引の活発さ（出来高）を見る',
        href: '/volume-share?instrumentId=BTC-JPY',
      },
      {
        title: 'レバレッジ・FX',
        description: '暗号資産FX・CFDの取引の活発さ（出来高）を見る',
        href: '/derivatives',
      },
      {
        title: '財務比較',
        description: '各社の財務諸表から収益性・安全性・成長性を比較',
        href: '/financial-comparison',
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
      '          <p class="text-xs text-gray-500 mt-1">注文する前に、実際の取引価格（板情報）・販売所の手数料相当額（スプレッド）・取引の活発さ（出来高）を銘柄ごとに比較・確認できます。</p>',
      '        </div>',
      '        <span class="panel-kicker">📊 比較ツール</span>',
      '      </div>',
      '      <div class="home-compare-link-grid">',
      renderCompareToolCards(),
      '      </div>',
      '    </section>',
    ].join('\n');
  }

  function financialMetricConfig(metricKey) {
    return FINANCIAL_METRICS.find(metric => metric.key === metricKey) || FINANCIAL_METRICS[0];
  }

  function financialMetricValue(company, metricKey) {
    if (!company || !company.latest) return null;
    const value = company.latest[metricKey];
    return Number.isFinite(Number(value)) ? Number(value) : null;
  }

  function formatFinancialMetricValue(value, metricKey) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return '開示なし';
    const metric = financialMetricConfig(metricKey);
    if (metric.unit === '%') return `${numeric.toFixed(Math.abs(numeric) >= 10 ? 1 : 2)}%`;
    const absolute = Math.abs(numeric);
    const sign = numeric < 0 ? '△' : '';
    return `${sign}${formatCount(absolute)}百万円`;
  }

  function financialMetricIconKind(metricKey) {
    if (metricKey === 'revenue') return 'revenue';
    if (metricKey === 'revenueYoY') return 'growth';
    if (metricKey === 'netAssets' || metricKey === 'totalAssets') return 'capital';
    if (metricKey === 'equityRatio' || metricKey === 'operatingMargin') return 'ratio';
    if (metricKey === 'operatingProfit' || metricKey === 'ordinaryProfit' || metricKey === 'netIncome') return 'profit';
    return 'default';
  }

  function renderFinancialMetricIcon(metricKey) {
    return `<span class="financial-metric-icon financial-metric-icon--${xmlEscape(financialMetricIconKind(metricKey))}" aria-hidden="true"></span>`;
  }

  function financialHistoryMetricValue(company, row, metricKey, index) {
    const direct = Number(row && row[metricKey]);
    if (Number.isFinite(direct)) return direct;
    const revenue = Number(row && row.revenue);
    if (metricKey === 'operatingMargin') {
      const operatingProfit = Number(row && row.operatingProfit);
      return revenue > 0 && Number.isFinite(operatingProfit) ? (operatingProfit / revenue) * 100 : null;
    }
    if (metricKey === 'revenueYoY' && index > 0 && Array.isArray(company.history)) {
      const previousRevenue = Number(company.history[index - 1] && company.history[index - 1].revenue);
      return revenue > 0 && previousRevenue > 0 ? ((revenue - previousRevenue) / Math.abs(previousRevenue)) * 100 : null;
    }
    return null;
  }

  function fiscalCautionText(company) {
    if (!company) return '';
    const label = String(company.fiscalYearLabel || '');
    const period = String(company.latest && company.latest.fiscalPeriod || '');
    const monthMatch = period.match(/\/(\d{1,2})$/);
    const month = monthMatch ? Number(monthMatch[1]) : null;
    const durationMatch = label.match(/（([^）]*(?:か月|ヶ月)[^）]*)）/);
    if (durationMatch) {
      return `${label}は${durationMatch[1]}の変則決算です。12か月決算の会社と単純比較しすぎないよう注意します。`;
    }
    if (month && month !== 3) {
      return `${label}です。3月決算の会社とは対象期間がずれるため、直近期比較では期末月の違いも確認します。`;
    }
    return '';
  }

  function renderFiscalCautionBadge(company) {
    const text = fiscalCautionText(company);
    if (!text) return '';
    return `<span class="financial-fiscal-badge financial-tooltip-trigger" data-tooltip="${xmlEscape(text)}" tabindex="0">決算期注意</span>`;
  }

  function renderFinancialSparkline(company, metricKey) {
    const rows = company && Array.isArray(company.history) ? company.history : [];
    const values = rows
      .map((row, index) => financialHistoryMetricValue(company, row, metricKey, index))
      .filter(value => Number.isFinite(Number(value)))
      .map(Number)
      .slice(-3);
    if (values.length < 2) return '';

    const width = 120;
    const height = 36;
    const pad = 4;
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min;
    const points = values.map((value, index) => {
      const x = pad + ((width - pad * 2) * index) / (values.length - 1);
      const y = range === 0
        ? height / 2
        : (height - pad) - ((value - min) / range) * (height - pad * 2);
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    }).join(' ');
    const areaPoints = `M ${points.replace(/ /g, ' L ')} L ${width - pad},${height - pad} L ${pad},${height - pad} Z`;

    return [
      '<svg class="financial-highlight-card__sparkline" viewBox="0 0 120 36" aria-hidden="true" focusable="false">',
      `  <path d="${xmlEscape(areaPoints)}"></path>`,
      `  <polyline points="${xmlEscape(points)}"></polyline>`,
      '</svg>',
    ].join('\n');
  }

  function sortedFinancialCompanies(companies, metricKey, options = {}) {
    const direction = options.direction === 'asc' ? 1 : -1;
    return (companies || [])
      .slice()
      .filter(company => financialMetricValue(company, metricKey) != null)
      .sort((a, b) => {
        const aValue = financialMetricValue(a, metricKey);
        const bValue = financialMetricValue(b, metricKey);
        if (aValue !== bValue) return (aValue - bValue) * direction;
        return String(a.label || a.serviceName).localeCompare(String(b.label || b.serviceName));
      });
  }

  function buildFinancialComparisonModel() {
    const companies = getFinancialComparisonCompanies().map((company) => {
      const exchange = getExchangeInfo(company.exchangeId);
      const pageContent = getExchangePageContent(company.exchangeId) || {};
      const financial = pageContent.financialAnalysis || {};
      const profile = pageContent.profile || {};
      const companySourceLinks = Array.isArray(company.sourceLinks) ? company.sourceLinks : [];
      const financialSourceLinks = Array.isArray(financial.sourceLinks) ? financial.sourceLinks : [];
      const companyCautions = Array.isArray(company.cautions) ? company.cautions : [];
      const financialCautions = Array.isArray(financial.cautions) ? financial.cautions : [];
      return {
        ...company,
        label: (exchange && exchange.label) || company.serviceName,
        fullName: (exchange && exchange.fullName) || company.companyName,
        path: company.path || (exchange ? exchange.path : exchangePath(company.exchangeId)),
        parentCompany: financial.parentCompany || company.parentCompany || profile.parentCompany || '',
        sourceSummary: financial.sourceSummary || company.sourceSummary || '',
        sourceLinks: (financialSourceLinks.length > 0 ? financialSourceLinks : companySourceLinks).slice(0, 3),
        cautions: (financialCautions.length > 0 ? financialCautions : companyCautions).slice(0, 2),
      };
    });

    const revenueLeader = sortedFinancialCompanies(companies, 'revenue')[0] || null;
    const profitLeader = sortedFinancialCompanies(companies, 'operatingProfit')[0] || null;
    const capitalLeader = sortedFinancialCompanies(companies, 'netAssets')[0] || null;
    const ratioLeader = sortedFinancialCompanies(companies, 'equityRatio')[0] || null;

    return {
      meta: {
        generatedAt: new Date().toISOString(),
        companyCount: companies.length,
        latestFiscalYear: '2025',
        unit: '百万円',
      },
      metrics: FINANCIAL_METRICS,
      companies,
      cryptoAssetBalances: getCryptoAssetBalanceComparison(),
      highlights: [
        {
          key: 'revenue',
          label: '収益規模',
          companyId: revenueLeader && revenueLeader.exchangeId,
          companyLabel: revenueLeader && revenueLeader.label,
          value: revenueLeader ? formatFinancialMetricValue(financialMetricValue(revenueLeader, 'revenue'), 'revenue') : '開示なし',
        },
        {
          key: 'operatingProfit',
          label: '営業利益',
          companyId: profitLeader && profitLeader.exchangeId,
          companyLabel: profitLeader && profitLeader.label,
          value: profitLeader ? formatFinancialMetricValue(financialMetricValue(profitLeader, 'operatingProfit'), 'operatingProfit') : '開示なし',
        },
        {
          key: 'netAssets',
          label: '純資産',
          companyId: capitalLeader && capitalLeader.exchangeId,
          companyLabel: capitalLeader && capitalLeader.label,
          value: capitalLeader ? formatFinancialMetricValue(financialMetricValue(capitalLeader, 'netAssets'), 'netAssets') : '開示なし',
        },
        {
          key: 'equityRatio',
          label: '自己資本比率',
          companyId: ratioLeader && ratioLeader.exchangeId,
          companyLabel: ratioLeader && ratioLeader.label,
          value: ratioLeader ? formatFinancialMetricValue(financialMetricValue(ratioLeader, 'equityRatio'), 'equityRatio') : '開示なし',
        },
      ],
    };
  }

  function financialComparisonStructuredData(model, origin, description) {
    const pageUrl = siteUrl(origin, '/financial-comparison');
    return [
      {
        '@context': 'https://schema.org',
        '@type': 'CollectionPage',
        name: '国内暗号資産取引所 財務比較',
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
        name: '国内暗号資産取引所 運営会社の財務比較',
        url: pageUrl,
        itemListElement: model.companies.map((company, index) => ({
          '@type': 'ListItem',
          position: index + 1,
          name: company.companyName,
          url: siteUrl(origin, company.path),
        })),
      },
    ];
  }

  function renderFinancialHighlightCards(model) {
    return model.highlights.map((item) => {
      const company = model.companies.find(candidate => candidate.exchangeId === item.companyId) || null;
      const sparkline = renderFinancialSparkline(company, item.key);
      return [
        '<article class="financial-highlight-card">',
        '  <div class="financial-highlight-card__top">',
        `    <span class="financial-highlight-card__label">${renderFinancialMetricIcon(item.key)}<span>${xmlEscape(item.label)}</span></span>`,
        sparkline ? '    <span class="financial-highlight-card__sparkline-label financial-tooltip-trigger" data-tooltip="横軸は直近3期、縦軸はカード指標の増減です。他社比較ではなく、掲載会社自身の推移を示します。" tabindex="0">直近3期推移</span>' : '',
        '  </div>',
        '  <div class="financial-highlight-card__main">',
        `    <strong>${xmlEscape(item.companyLabel || '-')}</strong>`,
        `    <span class="financial-highlight-card__value">${xmlEscape(item.value)}</span>`,
        '  </div>',
        sparkline,
        '</article>',
      ].filter(Boolean).join('\n');
    }).join('\n');
  }

  function renderFinancialMetricGroupButtons() {
    const groups = [
      { key: 'pl', label: 'PL', active: true },
      { key: 'bs', label: 'BS' },
      { key: 'ratio', label: '利益率' },
      { key: 'growth', label: '成長率' },
    ];
    return groups.map(group => [
      `<button class="btn-tab financial-metric-group-tab${group.active ? ' is-active' : ''}" type="button" data-financial-metric-group="${xmlEscape(group.key)}" aria-pressed="${group.active ? 'true' : 'false'}">`,
      `  <span>${xmlEscape(group.label)}</span>`,
      '</button>',
    ].join('\n')).join('\n');
  }

  function renderFinancialMetricButtons(metrics) {
    const initialMetricKeys = new Set(['revenue', 'operatingProfit', 'netIncome']);
    return metrics.map((metric, index) => [
      `<button class="btn-tab financial-metric-tab${index === 0 ? ' is-active' : ''}" type="button" data-financial-metric="${xmlEscape(metric.key)}" aria-pressed="${index === 0 ? 'true' : 'false'}"${initialMetricKeys.has(metric.key) ? '' : ' hidden'}>`,
      `  <span class="financial-metric-tab__label">${renderFinancialMetricIcon(metric.key)}<span>${xmlEscape(metric.shortLabel || metric.label)}</span></span>`,
      `  <span class="financial-help financial-help--tab" data-tooltip="${xmlEscape(metric.help || metric.description || metric.label)}" aria-hidden="true">?</span>`,
      '</button>',
    ].join('\n')).join('\n');
  }

  function renderFinancialSourceCards(companies) {
    return companies.map((company) => {
      const source = (company.sourceLinks && company.sourceLinks[0]) || null;
      return [
        '<article class="financial-source-card">',
        '  <div>',
        `    <span class="financial-source-card__eyebrow">${xmlEscape(company.fiscalYearLabel)}</span>`,
        `    <h3>${xmlEscape(company.label)}${renderFiscalCautionBadge(company)}</h3>`,
        `    <p>${xmlEscape(company.statementName)}</p>`,
        '  </div>',
        source ? `  <a class="table-link" href="${xmlEscape(source.href)}" target="_blank" rel="noopener">${xmlEscape(source.title)}</a>` : '',
        '</article>',
      ].filter(Boolean).join('\n');
    }).join('\n');
  }

  function renderFinancialComparisonHtml(req) {
    const origin = requestOrigin(req);
    const model = buildFinancialComparisonModel();
    const title = `国内暗号資産取引所 財務比較ダッシュボード｜${SITE_NAME}`;
    const description = '国内暗号資産取引所の運営会社について、公開財務諸表をもとに営業収益、営業利益、純利益、純資産、総資産、自己資本比率、成長率を視覚的に比較できます。';

    return injectCommonDisclosure([
      '<!DOCTYPE html>',
      '<html lang="ja">',
      '<head>',
      '  <meta charset="UTF-8">',
      '  <meta name="viewport" content="width=device-width, initial-scale=1.0">',
      renderHeadMeta({
        title,
        description,
        canonical: '/financial-comparison',
        ogImage: '/ogp/default.png',
        pageId: 'financial-comparison',
        includeDefaultJsonLd: false,
        structuredData: financialComparisonStructuredData(model, origin, description),
        siteOrigin: origin,
      }),
      '  <script src="https://cdn.tailwindcss.com"></script>',
      '  <script src="/vendor/chart.umd.min.js?v=4.5.1"></script>',
      '  <link rel="preconnect" href="https://fonts.googleapis.com">',
      '  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>',
      '  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Noto+Sans+JP:wght@400;500;700&display=swap" rel="stylesheet">',
      '  <link rel="stylesheet" href="/css/style.css?v=ui-31">',
      '</head>',
      '<body class="terminal-body bg-gray-950 text-gray-200 min-h-screen" data-financial-comparison-page>',
      '  <a href="#main" class="sr-only skip-link">メインコンテンツへスキップ</a>',
      '  <header class="topbar px-6 py-3">',
      '    <div class="brand-cluster">',
      '      <div class="brand-mark" aria-hidden="true">₿</div>',
      '      <div class="brand-copy min-w-0">',
      `        <h1 class="page-title">${xmlEscape(SITE_NAME)}</h1>`,
      '        <div class="brand-subtitle">財務比較ダッシュボード</div>',
      '      </div>',
      '    </div>',
      renderSiteNavigation({ activeSection: 'comparison', activePath: '/financial-comparison' }),
      '    <div class="status-cluster" role="status" aria-live="polite" aria-atomic="true">',
      '      <span class="badge badge--live">Finance</span>',
      `      <span class="status-text">掲載: ${xmlEscape(String(model.meta.companyCount))}社</span>`,
      `      <span class="text-xs text-gray-600 ml-2">単位: <span class="text-gray-400">${xmlEscape(model.meta.unit)}</span></span>`,
      '      <button class="theme-toggle" type="button" data-theme-toggle aria-pressed="false" aria-label="ライトモードに切り替え">',
      '        <span data-theme-toggle-icon aria-hidden="true">☀</span>',
      '        <span data-theme-toggle-label>ライト</span>',
      '      </button>',
      '    </div>',
      '  </header>',
      '  <main id="main" class="dashboard-shell financial-shell flex flex-col gap-4 p-4 max-w-[1600px] mx-auto">',
      '    <section class="panel panel--dense financial-hero-panel" aria-labelledby="financial-hero-title">',
      '      <div class="financial-hero-layout">',
      '        <div class="financial-hero-copy">',
      '          <p class="panel-kicker mb-2">Financial Statements</p>',
      '          <h2 id="financial-hero-title" class="financial-hero-title">各社の財務を、数字ではなく形で比べる</h2>',
      `          <p class="financial-hero-lead">${xmlEscape(description)}</p>`,
      '          <div class="financial-hero-tags">',
      '            <span>PL</span><span>BS</span><span>利益率</span><span>成長率</span><span>開示資料</span>',
      '          </div>',
      '        </div>',
      '        <div class="financial-highlight-grid" id="financial-highlight-grid">',
      renderFinancialHighlightCards(model),
      '        </div>',
      '      </div>',
      '    </section>',
      '    <section class="panel panel--dense financial-control-panel" aria-labelledby="financial-control-title">',
      '      <div class="panel-title-row mb-4">',
      '        <div>',
      '          <h2 id="financial-control-title" class="panel-title">比較軸</h2>',
      '          <p class="text-xs text-gray-500 mt-1">指標と表示会社を切り替えると、チャート、ランキング、ヒートマップが連動します。</p>',
      '        </div>',
      '        <span id="financial-current-metric" class="panel-kicker">営業収益 / 売上高</span>',
      '      </div>',
      '      <div class="financial-toolbar">',
      '        <div class="financial-metric-picker">',
      '          <div class="tab-group financial-metric-groups" aria-label="財務カテゴリ">',
      renderFinancialMetricGroupButtons(),
      '          </div>',
      '          <div class="tab-group financial-metric-tabs" aria-label="財務指標">',
      renderFinancialMetricButtons(model.metrics),
      '          </div>',
      '        </div>',
      '        <div id="financial-company-filter" class="financial-company-filter" aria-label="表示会社"></div>',
      '      </div>',
      '    </section>',
      '    <section class="financial-chart-grid" aria-label="財務チャート">',
      '      <article class="panel panel--dense financial-chart-panel">',
      '        <div class="history-chart-heading">',
      '          <h3 id="financial-bar-title">直近期の横比較</h3>',
      '          <p id="financial-bar-note">各社の最新開示期を横並びで比較します。</p>',
      '        </div>',
      '        <div class="chart-container financial-chart-container">',
      '          <canvas id="financial-bar-chart"></canvas>',
      '        </div>',
      '      </article>',
      '      <article class="panel panel--dense financial-chart-panel">',
      '        <div class="history-chart-heading">',
      '          <h3>複数年の推移</h3>',
      '          <p>同じ指標を開示済み期間で追います。点線は掲載社平均です。</p>',
      '        </div>',
      '        <div class="chart-container financial-chart-container">',
      '          <canvas id="financial-trend-chart"></canvas>',
      '        </div>',
      '      </article>',
      '      <article class="panel panel--dense financial-chart-panel financial-chart-panel--compact">',
      '        <div class="history-chart-heading">',
      '          <h3>財務バランス</h3>',
      '          <p id="financial-radar-note">選択中の会社を最大3社まで掲載社平均と比較します。</p>',
      '        </div>',
      '        <div class="chart-container financial-radar-container">',
      '          <canvas id="financial-radar-chart"></canvas>',
      '        </div>',
      '      </article>',
      '      <article class="panel panel--dense financial-spotlight" id="financial-spotlight" aria-live="polite"></article>',
      '    </section>',
      '    <section class="panel panel--dense financial-shape-panel" aria-labelledby="financial-shape-title">',
      '      <div class="panel-title-row mb-4">',
      '        <div>',
      '          <h2 id="financial-shape-title" class="panel-title">ビジュアルB/S・P/L</h2>',
      '          <p id="financial-shape-note" class="text-xs text-gray-500 mt-1">総資産・営業収益を同一スケールの面積で、純資産・営業利益をゴールドの厚みで比較します。</p>',
      '        </div>',
      '        <div class="tab-group financial-shape-tabs" aria-label="形比較モード">',
      '          <button class="btn-tab financial-shape-tab is-active" type="button" data-financial-shape-mode="bs" aria-pressed="true">B/S</button>',
      '          <button class="btn-tab financial-shape-tab" type="button" data-financial-shape-mode="pl" aria-pressed="false">P/L</button>',
      '        </div>',
      '      </div>',
      '      <div id="financial-shape-comparison" class="financial-shape-grid" aria-live="polite"></div>',
      '    </section>',
      '    <section class="panel panel--dense" aria-labelledby="financial-heatmap-title">',
      '      <div class="panel-title-row mb-4">',
      '        <div>',
      '          <h2 id="financial-heatmap-title" class="panel-title">強み・弱みヒートマップ</h2>',
      '          <p class="text-xs text-gray-500 mt-1">行名で取引所の並び、列名で指標の並びを切り替えできます。掲載社平均を基準に、総資産は預り資産を含む表示構造に注意してください。</p>',
      '        </div>',
      '        <span class="panel-kicker">Heatmap</span>',
      '      </div>',
      '      <div id="financial-heatmap" class="financial-heatmap overflow-auto scrollbar-thin"></div>',
      '    </section>',
      '    <section class="panel panel--dense" aria-labelledby="financial-ranking-title">',
      '      <div class="panel-title-row mb-4">',
      '        <div>',
      '          <h2 id="financial-ranking-title" class="panel-title">ランキングと開示元</h2>',
      '          <p class="text-xs text-gray-500 mt-1">ランキングは選択中の比較軸に連動します。詳細は各取引所ページと公式開示資料で確認できます。</p>',
      '        </div>',
      '        <span class="panel-kicker">Ranking / Sources</span>',
      '      </div>',
      '      <div class="financial-lower-grid">',
      '        <div id="financial-ranking" class="financial-ranking-list"></div>',
      '        <div class="financial-source-grid">',
      renderFinancialSourceCards(model.companies),
      '        </div>',
      '      </div>',
      '    </section>',
      '    <section class="panel panel--dense financial-asset-balance-panel" aria-labelledby="financial-asset-balance-title">',
      '      <div class="panel-title-row mb-4">',
      '        <div>',
      '          <h2 id="financial-asset-balance-title" class="panel-title">顧客預かり・自己保有暗号資産</h2>',
      '          <p class="text-xs text-gray-500 mt-1">銘柄別に顧客預かりと自己保有の両方を確認できる会社を左右対比で表示します。未開示・片側開示は推定せず、別枠に格納します。</p>',
      '        </div>',
      '        <span class="panel-kicker">Custody / Own Assets</span>',
      '      </div>',
      '      <div id="financial-asset-balance-summary" class="financial-asset-summary" aria-live="polite"></div>',
      '      <div id="financial-asset-filter" class="financial-asset-filter" aria-label="暗号資産フィルタ"></div>',
      '      <div id="financial-asset-balance-table" class="financial-asset-table-wrap financial-asset-butterfly-wrap"></div>',
      '      <p id="financial-asset-balance-note" class="financial-asset-note"></p>',
      '    </section>',
      '    <script id="financial-comparison-data" type="application/json">',
      safeJsonForHtml(model),
      '    </script>',
      '  </main>',
      `  <footer class="border-t border-gray-800 px-6 py-2 text-xs text-gray-600 text-center">${xmlEscape(SITE_NAME)} | 財務比較</footer>`,
      '  <script src="/js/financial-comparison.js?v=11"></script>',
      '</body>',
      '</html>',
    ].join('\n'), { activeSection: 'comparison', activePath: '/financial-comparison' });
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
      '  <link rel="stylesheet" href="/css/style.css?v=ui-19">',
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
      '      <a class="nav-link" href="/simulator">取引コスト計算</a>',
      '      <a class="nav-link" href="/markets">銘柄深掘り</a>',
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

  function articlePrimaryNextAction(article) {
    const instrumentId = articleInstrumentId(article);
    const ticker = articleTicker(article);
    if (instrumentId && String(article.path || '').startsWith('/articles/')) {
      return {
        href: marketPath(instrumentId),
        kicker: 'Market',
        title: `${ticker || instrumentId} の比較を見る`,
        description: '対応取引所、板、販売所スプレッド、出来高を同じ銘柄で確認します。',
        action: '比較へ ↗',
      };
    }

    return {
      href: '/simulator?market=BTC-JPY&side=buy&amountType=jpy&amount=100000',
      kicker: 'Simulator',
      title: 'コストを計算してみる',
      description: '10万円分の成行注文で、手数料・スリッページ込みの実質コストを確認します。',
      action: '開く ↗',
    };
  }

  function articleSecondNextAction(article, activePath) {
    if (String(article.path || '').startsWith('/articles/')) {
      return {
        href: '/articles',
        kicker: 'Articles',
        title: 'ほかの銘柄記事を探す',
        description: '仕組み、歴史、リスク、税金を銘柄ごとに読み比べます。',
        action: '一覧へ ↗',
      };
    }

    if (activePath === '/learn/exchange-checklist') {
      return {
        href: '/markets',
        kicker: 'Markets',
        title: '銘柄から候補を絞る',
        description: '買いたい銘柄ごとに、対応取引所、板、出来高、販売所スプレッドを確認します。',
        action: '探す ↗',
      };
    }

    return {
      href: '/learn/exchange-checklist',
      kicker: 'Guide',
      title: '自分に合う取引所を選ぶ',
      description: '手数料、スプレッド、入出金、公式条件を整理して比較します。',
      action: '読む ↗',
    };
  }

  function articleParentBreadcrumb(article) {
    const articlePath = String(article && article.path || '');
    if (articlePath.startsWith('/learn/')) {
      return '<a class="text-green-300 hover:text-green-200" href="/learn">初心者ガイド</a><span aria-hidden="true"> / </span>';
    }
    if (articlePath.startsWith('/articles/')) {
      return '<a class="text-green-300 hover:text-green-200" href="/articles">記事</a><span aria-hidden="true"> / </span>';
    }
    return '';
  }

  function articleMobileActions(article, primaryAction, secondAction) {
    if (String(article && article.path || '').startsWith('/articles/')) {
      return {
        primaryHref: primaryAction.href,
        primaryLabel: '比較',
        secondHref: secondAction.href,
        secondLabel: '記事',
        thirdHref: '/markets',
        thirdLabel: '銘柄',
        fourthHref: '/about',
        fourthLabel: 'このサイト',
      };
    }

    return {
      primaryHref: '/simulator',
      primaryLabel: '計算',
      secondHref: '/sales-spread',
      secondLabel: '比較',
      thirdHref: '/learn',
      thirdLabel: 'ガイド',
      fourthHref: '/about',
      fourthLabel: 'このサイト',
    };
  }

  function renderArticleHtml(req, article) {
    const origin = requestOrigin(req);
    const template = fs.readFileSync(path.join(publicDir, 'templates', 'article.html'), 'utf8');
    const title = `${article.title}｜${SITE_NAME}`;
    const activePath = normalizeNavPath(article.path);
    const feeComparisonPaths = new Set(['/learn/crypto-fees', '/learn/jpy-withdrawal-fees', '/learn/crypto-withdrawal-fees']);
    const activeSection = feeComparisonPaths.has(activePath) ? 'comparison' : navSectionForPath(activePath) || 'learn';
    const articleMeta = {
      ...learnArticleMeta(article),
      readMinutes: articleReadMinutes(article),
    };
    const primaryNextAction = articlePrimaryNextAction(article);
    const secondNextAction = articleSecondNextAction(article, activePath);
    const mobileActions = articleMobileActions(article, primaryNextAction, secondNextAction);
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
      ARTICLE_READING_MINUTES: xmlEscape(String(articleMeta.readMinutes || 4)),
      ARTICLE_MARKET_INSTRUMENT_ID: xmlEscape(articleInstrumentId(article) || ''),
      ARTICLE_MARKET_TICKER: xmlEscape(articleTicker(article) || ''),
      ARTICLE_PARENT_BREADCRUMB: articleParentBreadcrumb(article),
      ARTICLE_BODY: article.html,
      ARTICLE_PRIMARY_NEXT_HREF: xmlEscape(primaryNextAction.href),
      ARTICLE_PRIMARY_NEXT_KICKER: xmlEscape(primaryNextAction.kicker),
      ARTICLE_PRIMARY_NEXT_TITLE: xmlEscape(primaryNextAction.title),
      ARTICLE_PRIMARY_NEXT_DESCRIPTION: xmlEscape(primaryNextAction.description),
      ARTICLE_PRIMARY_NEXT_ACTION: xmlEscape(primaryNextAction.action),
      ARTICLE_SECOND_NEXT_HREF: xmlEscape(secondNextAction.href),
      ARTICLE_SECOND_NEXT_KICKER: xmlEscape(secondNextAction.kicker),
      ARTICLE_SECOND_NEXT_TITLE: xmlEscape(secondNextAction.title),
      ARTICLE_SECOND_NEXT_DESCRIPTION: xmlEscape(secondNextAction.description),
      ARTICLE_SECOND_NEXT_ACTION: xmlEscape(secondNextAction.action),
      ARTICLE_MOBILE_PRIMARY_HREF: xmlEscape(mobileActions.primaryHref),
      ARTICLE_MOBILE_PRIMARY_LABEL: xmlEscape(mobileActions.primaryLabel),
      ARTICLE_MOBILE_SECOND_HREF: xmlEscape(mobileActions.secondHref),
      ARTICLE_MOBILE_SECOND_LABEL: xmlEscape(mobileActions.secondLabel),
      ARTICLE_MOBILE_THIRD_HREF: xmlEscape(mobileActions.thirdHref),
      ARTICLE_MOBILE_THIRD_LABEL: xmlEscape(mobileActions.thirdLabel),
      ARTICLE_MOBILE_FOURTH_HREF: xmlEscape(mobileActions.fourthHref),
      ARTICLE_MOBILE_FOURTH_LABEL: xmlEscape(mobileActions.fourthLabel),
    }), { activeSection, activePath });
  }

  function marketStructuredData(market, origin, description) {
    const url = siteUrl(origin, marketPath(market.instrumentId));
    return [
      {
        '@context': 'https://schema.org',
        '@type': 'WebPage',
        name: `${market.label} 結論・国内取引所比較・銘柄特徴`,
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
          '銘柄特徴',
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
            name: '銘柄深掘り',
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
        name: '国内暗号資産 銘柄深掘り一覧',
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
        name: '国内暗号資産 銘柄深掘り一覧',
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
            name: '銘柄深掘り',
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
    const article = marketArticleForMarket(market);
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
      article ? {
        eyebrow: 'Article',
        title: `${market.label} の記事を読む`,
        description: '仕組み、歴史、リスク、税金など、比較表だけでは分かりにくい背景を確認します。',
        href: article.path,
      } : null,
      {
        eyebrow: 'Exchanges',
        title: `${market.label} 対応取引所を見る`,
        description: 'この銘柄を扱う取引所一覧から、各取引所の詳細ページへ進めます。',
        href: '#market-exchange-comparison',
      },
      {
        eyebrow: 'Learn',
        title: '販売所と取引所の違いを読む',
        description: '同じ銘柄でも販売所と取引所形式で実質コストが変わる理由を確認できます。',
        href: '/learn/exchange-vs-broker',
      },
      {
        eyebrow: 'Learn',
        title: '10万円分買う前のポイントを読む',
        description: 'この銘柄を10万円分買う前に、板、販売所スプレッド、手数料を確認する順番を整理できます。',
        href: '/learn/buying-100k-points',
      },
    ].filter(Boolean);

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
    return market.supportedExchanges.map((exchange) => {
      const actionHref = exchange.actions && (exchange.actions.signupUrl || exchange.actions.officialUrl);
      return [
      `<a class="market-context-card" href="${xmlEscape(exchange.path)}">`,
      '  <span class="market-context-card__eyebrow">Exchange</span>',
      `  <strong class="market-context-card__title">${xmlEscape(exchange.label)}</strong>`,
      `  <span class="market-context-card__description">既定 <span class="market-term" data-term-key="taker" tabindex="0"><span class="term-copy--expert">taker</span><span class="term-copy--beginner">成行注文（すぐ買う）</span></span> ${xmlEscape(exchange.feeLabel)} / ${xmlEscape(`${exchange.marketCount}銘柄`)} / 入出金 ${xmlEscape(exchange.fundingLabel || '公式条件確認')}。手数料、取扱銘柄、運営会社・財務情報を確認できます。</span>`,
      `  <span class="market-context-card__cta">${actionHref ? '詳細・公式確認' : '詳細を見る'}</span>`,
      '</a>',
    ].join('\n');
    }).join('\n');
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
      const marketId = market.instrumentId;
      const exchangeNames = market.exchangeLabels.join(' ');
      const searchText = [
        market.instrumentId,
        market.label,
        market.baseCurrency,
        market.quoteCurrency,
        market.marketTypeLabel || '',
        exchangeNames,
        market.topVolumeExchangeLabel || '',
        market.bestSpreadExchangeLabel || '',
      ].join(' ').toLowerCase();
      const exchangeIds = market.exchanges.map(exchange => exchange.id).join(' ');
      const visibleExchanges = market.exchanges.slice(0, 4);
      const hiddenCount = Math.max(0, market.exchanges.length - visibleExchanges.length);
      const exchangeChips = visibleExchanges.map(exchange => (
        renderExchangeIndicator(exchange)
      )).join('');
      const moreChip = hiddenCount > 0 ? `<span class="market-exchange-logo market-exchange-logo--more" role="img" aria-label="他${hiddenCount}社">+${hiddenCount}</span>` : '';
      const topVolumeExchangeText = market.topVolumeExchangeLabel || 'データ待ち';
      const topVolumeValueText = market.instrumentTotalQuoteVolume > 0
        ? formatJpyCompact(market.instrumentTotalQuoteVolume)
        : '集計中';
      const bestSpreadExchangeText = market.bestSpreadExchangeLabel
        ? market.bestSpreadExchangeLabel
        : (market.marketType === 'derivative' ? 'デリバティブ板' : '販売所なし');
      const bestSpreadValueText = market.bestSpreadPct != null
        ? formatPct(market.bestSpreadPct)
        : (market.marketType === 'derivative' ? '板で確認' : 'データ待ち');
      const changeValueText = market.change24hPct != null ? formatSignedPct(market.change24hPct) : 'データ待ち';
      const changeExchangeText = market.change24hExchangeLabel || '24h';
      const trendTone = marketTrendTone(market.change24hPct);
      const trendMark = trendArrow(market.change24hPct);

      return [
        `<article class="market-index-card" data-market-card data-market-id="${xmlEscape(marketId)}" data-market-label="${xmlEscape(market.label)}" data-market-path="${xmlEscape(market.path)}" data-market-search="${xmlEscape(searchText)}" data-exchanges="${xmlEscape(exchangeIds)}" data-exchange-count="${marketSortValue(market.exchangeCount, '0')}" data-volume="${marketSortValue(market.instrumentTotalQuoteVolume, '0')}" data-spread="${marketSortValue(market.bestSpreadPct)}" data-change="${marketSortValue(market.change24hPct)}">`,
        '  <div class="market-index-card__actions">',
        `    <button class="market-icon-action" type="button" data-market-favorite="${xmlEscape(marketId)}" aria-label="${xmlEscape(market.label)}をお気に入りに追加" aria-pressed="false">☆</button>`,
        `    <label class="market-compare-toggle"><input type="checkbox" data-market-compare="${xmlEscape(marketId)}"><span>比較</span></label>`,
        '  </div>',
        `  <a class="market-index-card__main" href="${xmlEscape(market.path)}">`,
        '    <span class="market-index-card__topline">',
        '      <span class="market-index-card__identity">',
        `        ${renderAssetMark(market)}`,
        '        <span class="market-index-card__titleblock">',
        `          <span class="market-index-card__label">${xmlEscape(market.label)}</span>`,
        `          <span class="market-index-card__id">${xmlEscape(market.instrumentId)}</span>`,
        '        </span>',
        '      </span>',
        `      <span class="market-index-card__count">${market.exchangeCount}社</span>`,
        '    </span>',
        `    <span class="market-index-card__badges">${renderMarketStatusBadges(market)}</span>`,
        '    <span class="market-index-card__trend" data-market-live-cell>',
        `      <span class="market-index-card__trend-copy"><span class="market-index-card__trend-label">24h変化 <span data-market-change-exchange>${xmlEscape(changeExchangeText)}</span></span><span class="market-index-card__trend-value market-trend market-trend--${xmlEscape(trendTone)}"><span class="market-trend-arrow" data-market-change-arrow aria-hidden="true">${xmlEscape(trendMark)}</span><span data-market-change-text>${xmlEscape(changeValueText)}</span></span></span>`,
        `      ${renderSparkline(market.instrumentId, market.change24hPct)}`,
        '    </span>',
        '    <span class="market-index-card__metrics" data-market-live-cell>',
        '      <span class="market-index-card__metric">',
        '        <span class="market-index-card__metric-label">出来高トップ</span>',
        `        <span class="market-index-card__metric-value" data-market-top-volume>${xmlEscape(topVolumeExchangeText)}</span>`,
        `        <span class="market-index-card__metric-meta" data-market-volume-value>${xmlEscape(topVolumeValueText)}</span>`,
        '      </span>',
        '      <span class="market-index-card__metric">',
        '        <span class="market-index-card__metric-label">最小スプレッド</span>',
        `        <span class="market-index-card__metric-value" data-market-best-spread>${xmlEscape(bestSpreadValueText)}</span>`,
        `        <span class="market-index-card__metric-meta" data-market-spread-exchange>${xmlEscape(bestSpreadExchangeText)}</span>`,
        '      </span>',
        '    </span>',
        `    ${beginnerSpreadWarning(market)}`,
        `    <span class="market-index-card__currencies">${xmlEscape(market.baseCurrency)} / ${xmlEscape(market.quoteCurrency)}</span>`,
        '    <span class="market-index-card__footer">',
        `      <span class="market-index-card__exchanges">${exchangeChips}${moreChip}</span>`,
        '      <span class="market-index-card__cta">コスト比較を見る</span>',
        '    </span>',
        '  </a>',
        '</article>',
      ].join('\n');
    }).join('\n');
  }

  function renderMarketIndexTableRows(markets) {
    if (!markets || markets.length === 0) return '';
    return markets.map((market) => {
      const exchangeIds = market.exchanges.map(exchange => exchange.id).join(' ');
      const exchangeNames = market.exchangeLabels.join(' ');
      const searchText = [
        market.instrumentId,
        market.label,
        market.baseCurrency,
        market.quoteCurrency,
        market.marketTypeLabel || '',
        exchangeNames,
        market.topVolumeExchangeLabel || '',
        market.bestSpreadExchangeLabel || '',
      ].join(' ').toLowerCase();
      const topVolumeText = market.topVolumeExchangeLabel
        ? market.topVolumeExchangeLabel
        : 'データ待ち';
      const topVolumeValueText = market.instrumentTotalQuoteVolume > 0
        ? formatJpyCompact(market.instrumentTotalQuoteVolume)
        : '集計中';
      const bestSpreadValueText = market.bestSpreadPct != null
        ? formatPct(market.bestSpreadPct)
        : (market.marketType === 'derivative' ? '板で確認' : 'データ待ち');
      const bestSpreadExchangeText = market.bestSpreadExchangeLabel
        ? market.bestSpreadExchangeLabel
        : (market.marketType === 'derivative' ? 'デリバティブ板' : '販売所なし');
      const changeText = market.change24hPct != null ? formatSignedPct(market.change24hPct) : 'データ待ち';
      const trendTone = marketTrendTone(market.change24hPct);
      const trendMark = trendArrow(market.change24hPct);

      return [
        `<tr data-market-row data-market-id="${xmlEscape(market.instrumentId)}" data-market-label="${xmlEscape(market.label)}" data-market-path="${xmlEscape(market.path)}" data-market-search="${xmlEscape(searchText)}" data-exchanges="${xmlEscape(exchangeIds)}" data-exchange-count="${marketSortValue(market.exchangeCount, '0')}" data-volume="${marketSortValue(market.instrumentTotalQuoteVolume, '0')}" data-spread="${marketSortValue(market.bestSpreadPct)}" data-change="${marketSortValue(market.change24hPct)}">`,
        '  <td data-label="銘柄">',
        '    <div class="market-index-row__identity">',
        `      ${renderAssetMark(market, 'market-asset-mark--sm')}`,
        '      <div>',
        `        <a class="market-index-row__label" href="${xmlEscape(market.path)}">${xmlEscape(market.label)}</a>`,
        `        <div class="market-index-row__id">${xmlEscape(market.instrumentId)}</div>`,
        '      </div>',
        '    </div>',
        '  </td>',
        `  <td data-label="対応数" data-sort-value="${marketSortValue(market.exchangeCount, '0')}">${market.exchangeCount}社</td>`,
        `  <td data-label="出来高トップ" data-sort-value="${marketSortValue(market.instrumentTotalQuoteVolume, '0')}" data-market-live-cell><span class="market-index-table__stack"><strong data-market-top-volume>${xmlEscape(topVolumeText)}</strong><small data-market-volume-value>${xmlEscape(topVolumeValueText)}</small></span></td>`,
        `  <td data-label="最小スプレッド" data-sort-value="${marketSortValue(market.bestSpreadPct)}" data-market-live-cell><span class="market-index-table__stack"><strong data-market-best-spread>${xmlEscape(bestSpreadValueText)}</strong><small data-market-spread-exchange>${xmlEscape(bestSpreadExchangeText)}</small>${beginnerSpreadWarning(market)}</span></td>`,
        `  <td data-label="24h変化" data-sort-value="${marketSortValue(market.change24hPct)}" data-market-live-cell><span class="market-trend market-trend--${xmlEscape(trendTone)}"><span class="market-trend-arrow" data-market-change-arrow aria-hidden="true">${xmlEscape(trendMark)}</span><span data-market-change-text>${xmlEscape(changeText)}</span></span></td>`,
        '  <td data-label="操作">',
        '    <div class="market-index-row__actions">',
        `      <button class="market-icon-action market-icon-action--sm" type="button" data-market-favorite="${xmlEscape(market.instrumentId)}" aria-label="${xmlEscape(market.label)}をお気に入りに追加" aria-pressed="false">☆</button>`,
        `      <label class="market-compare-toggle market-compare-toggle--compact"><input type="checkbox" data-market-compare="${xmlEscape(market.instrumentId)}"><span>比較</span></label>`,
        '    </div>',
        '  </td>',
        '</tr>',
      ].join('\n');
    }).join('\n');
  }

  function renderMarketCategoryNav(categories) {
    if (!categories || categories.length === 0) return '';
    return categories.map((category) => (
      `<a class="market-category-nav__link" href="#${xmlEscape(category.anchorId)}">${xmlEscape(category.title)}</a>`
    )).join('\n');
  }

  function renderMarketStickyCategoryNav(categories) {
    if (!categories || categories.length === 0) return '';
    return categories.map((category) => (
      `<a class="market-sticky-nav__link" href="#${xmlEscape(category.anchorId)}">${xmlEscape(category.navLabel || category.title)}</a>`
    )).join('\n');
  }

  function renderMarketCategorySections(categories) {
    if (!categories || categories.length === 0) {
      return '<p class="text-center text-gray-500 py-8">カテゴリ情報を準備中です</p>';
    }

    return categories.map((category) => [
      `<section id="${xmlEscape(category.anchorId)}" class="market-category-card market-category-card--${xmlEscape(marketToken(category.key))}">`,
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

  function renderMarketExchangeChips(exchanges) {
    if (!exchanges || exchanges.length === 0) return '';
    return exchanges.map(exchange => (
      `<button class="market-exchange-chip" type="button" data-market-exchange-chip="${xmlEscape(exchange.id)}" aria-pressed="false">${xmlEscape(exchange.label)}</button>`
    )).join('\n');
  }

  function renderMarketsIndexHtml(req) {
    const origin = requestOrigin(req);
    const model = buildMarketIndexModel();
    const template = fs.readFileSync(path.join(publicDir, 'markets.html'), 'utf8');
    const title = `国内暗号資産 銘柄深掘り一覧｜${SITE_NAME}`;
    const description = '国内取引所で買える暗号資産を、用途、仕組み、対応取引所数、板の有無、販売所スプレッド、出来高の観点で比較できます。BTC/JPY、ETH/JPY、XRP/JPYなど各銘柄深掘りページへ移動できます。';

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
      .replace('__MARKET_INDEX_EXCHANGE_CHIPS__', renderMarketExchangeChips(model.exchanges))
      .replace('<!-- MARKET_CATEGORY_NAV -->', renderMarketCategoryNav(model.categories))
      .replace('<!-- MARKET_CATEGORY_STICKY_NAV -->', renderMarketStickyCategoryNav(model.categories))
      .replace('<!-- MARKET_CATEGORY_SECTIONS -->', renderMarketCategorySections(model.categories))
      .replace('<!-- MARKET_INDEX_LIST -->', renderMarketIndexCards(model.markets))
      .replace('<!-- MARKET_INDEX_TABLE_ROWS -->', renderMarketIndexTableRows(model.markets)), { activeSection: 'markets', activePath: marketIndexPath() });
  }

  function renderMarketHtml(req, market) {
    const origin = requestOrigin(req);
    const template = fs.readFileSync(path.join(publicDir, 'market.html'), 'utf8');
    const pageMarket = buildMarketPageModel(market);
    const title = `${pageMarket.label} 結論・国内取引所比較・銘柄特徴｜${SITE_NAME}`;
    const description = `${pageMarket.label} の結論カード、国内取引所での板・出来高・販売所スプレッド比較、銘柄特徴、取引前チェックを1ページで確認できます。`;
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
      switchMarkets: buildMarketSwitchOptions(pageMarket),
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
      .replace('<!-- MARKET_CONCLUSION_CARD -->', renderMarketConclusionCard(pageMarket, marketSnapshot))
      .replace('<!-- MARKET_COMPARISON_SUMMARY_CARD -->', renderMarketComparisonSummaryCard(pageMarket, marketSnapshot))
      .replace('<!-- MARKET_VISUAL_RESEARCH_BOARD -->', renderMarketArticleTeaser(pageMarket))
      .replace('<!-- MARKET_DEEP_DIVE_CARDS -->', renderMarketDeepDiveCards(pageMarket))
      .replace('<!-- MARKET_PROFILE_CARDS -->', renderMarketProfileCards(pageMarket))
      .replace('<!-- MARKET_PRETRADE_CHECK_CARDS -->', renderMarketPreTradeCheckCards(pageMarket))
      .replace('<!-- MARKET_JOURNEY_LINKS -->', renderMarketJourneyLinks(pageMarket))
      .replace('<!-- MARKET_SUPPORTED_EXCHANGE_LINKS -->', renderMarketSupportedExchangeLinks(pageMarket))
      .replace('<!-- MARKET_DATA_DEFINITIONS -->', renderMarketDataDefinitions(pageMarket))
      .replace('<!-- MARKET_DISCLAIMER -->', renderMarketDisclaimer(pageMarket, aboutArticle))
      .replaceAll('__MARKET_PAGE_TITLE__', xmlEscape(`${pageMarket.label} 銘柄深掘り`))
      .replaceAll('__MARKET_PAGE_SUBTITLE__', '結論・国内取引所比較・銘柄深掘り')
      .replaceAll('__MARKET_HERO_TITLE__', xmlEscape(`${pageMarket.label} 国内取引所データ`))
      .replaceAll('__MARKET_FOOTER_LABEL__', xmlEscape(`${pageMarket.label} 銘柄深掘り`))
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

  function exchangeIndexAccent(exchangeId) {
    const accents = {
      okj: '#35c8d2',
      coincheck: '#2ed47a',
      bitflyer: '#1e88ff',
      bitbank: '#f4c95d',
      gmo: '#44b9ff',
      'binance-japan': '#f0b90b',
      bittrade: '#ff5f6d',
    };
    return accents[String(exchangeId || '').toLowerCase()] || '#8fb0ff';
  }

  function exchangeIndexProfile(exchange) {
    return (exchange && exchange.pageContent && exchange.pageContent.profile) || {};
  }

  function exchangeIndexHasLeverage(exchange) {
    const derivativeCount = (exchange.markets || []).filter(market => market && market.marketType === 'derivative').length;
    if (derivativeCount > 0) return true;
    const profile = exchangeIndexProfile(exchange);
    const text = [
      profile.leverageTrading,
      profile.services,
      exchange.pageContent && exchange.pageContent.serviceDescription,
      exchange.pageContent && exchange.pageContent.dataSourceDescription,
    ].flat().filter(Boolean).join(' ');
    return /レバレッジ|暗号資産FX|Crypto CFD|CFD|信用取引|証拠金/i.test(text);
  }

  function exchangeIndexSummary(exchange, index = 0) {
    const coverageCount = (exchange.coverage || []).length;
    const boardCount = (exchange.boardMarkets || []).length;
    const salesCount = (exchange.salesMarkets || []).length;
    const volumeCount = exchange.volume && Array.isArray(exchange.volume.rows) ? exchange.volume.rows.length : 0;
    const feeRate = exchange.takerFeeRate != null && Number.isFinite(Number(exchange.takerFeeRate))
      ? Number(exchange.takerFeeRate)
      : null;
    const hasLeverage = exchangeIndexHasLeverage(exchange);
    const defaultMarketLabel = exchange.defaultMarket
      ? (exchange.defaultMarket.label || exchange.defaultMarket.instrumentId)
      : (exchange.defaultInstrumentId || 'BTC/JPY');
    const searchText = [
      exchange.id,
      exchange.label,
      exchange.fullName,
      exchange.feeLabel,
      defaultMarketLabel,
      hasLeverage ? 'レバレッジ 暗号資産FX CFD' : '',
      boardCount > 0 ? '板取引' : '',
      salesCount > 0 ? '販売所' : '',
    ].join(' ').toLowerCase();

    return {
      id: exchange.id,
      label: exchange.label,
      fullName: exchange.fullName || exchange.label,
      path: exchange.path,
      index,
      accent: exchangeIndexAccent(exchange.id),
      shortLabel: exchangeShortLabel(exchange),
      feeLabel: exchange.feeLabel,
      feeRate,
      feeSort: feeRate == null ? '' : String(feeRate),
      coverageCount,
      boardCount,
      salesCount,
      volumeCount,
      defaultMarketLabel,
      hasBoard: boardCount > 0,
      hasSales: salesCount > 0,
      hasLeverage,
      hasZeroFee: feeRate === 0,
      referralUrl: exchange.referralUrl || null,
      referralCode: exchange.referralCode || null,
      referralRel: exchange.referralRel || null,
      referralReferrerPolicy: exchange.referralReferrerPolicy || null,
      referralTarget: Object.prototype.hasOwnProperty.call(exchange, 'referralTarget') ? exchange.referralTarget : undefined,
      referralTrackingPixelUrl: exchange.referralTrackingPixelUrl || null,
      searchText,
    };
  }

  function exchangeIndexReferralLink(summary) {
    if (!summary || !summary.referralUrl) return null;
    return {
      href: summary.referralUrl,
      target: summary.referralTarget === null ? null : (summary.referralTarget || '_blank'),
      rel: summary.referralRel || 'sponsored noopener noreferrer',
      referrerPolicy: summary.referralReferrerPolicy || null,
      trackingPixelUrl: summary.referralTrackingPixelUrl || null,
    };
  }

  function renderExchangeIndexReferralPixel(link) {
    return link && link.trackingPixelUrl
      ? `<img src="${xmlEscape(link.trackingPixelUrl)}" width="1" height="1" border="0" alt="">`
      : '';
  }

  function renderExchangeIndexCardReferralAction(summary) {
    const link = exchangeIndexReferralLink(summary);
    if (!link) return '';
    const label = summary.referralCode ? 'PR 口座開設・紹介条件' : 'PR 公式で確認';
    return [
      '  <div class="exchange-index-card__footer">',
      `    <a class="exchange-index-card__pr-link" ${linkAttrsForExchangeAction(link)}><span>PR</span>${xmlEscape(label.replace(/^PR\s*/, ''))}${renderExchangeIndexReferralPixel(link)}</a>`,
      '  </div>',
    ].join('\n');
  }

  function renderExchangeIndexRowReferralAction(summary) {
    const link = exchangeIndexReferralLink(summary);
    if (!link) return '';
    const ariaLabel = `${summary.label}のPRリンクで公式条件を確認`;
    return `      <a class="exchange-index-row__link exchange-index-row__link--pr" ${linkAttrsForExchangeAction(link)} aria-label="${xmlEscape(ariaLabel)}">PR${renderExchangeIndexReferralPixel(link)}</a>`;
  }

  function exchangeIndexCardBadges(summary) {
    return [
      summary.hasBoard ? { label: '板取引あり', tone: 'bid' } : null,
      summary.hasSales ? { label: '販売所データ', tone: 'accent' } : null,
      summary.hasLeverage ? { label: 'レバレッジ対応', tone: 'warn' } : null,
      summary.hasZeroFee ? { label: '取引所 0%', tone: 'gold' } : null,
    ].filter(Boolean);
  }

  function exchangeIndexDataAttrs(summary, prefix) {
    return [
      `data-exchange-${prefix}`,
      `data-exchange-id="${xmlEscape(summary.id)}"`,
      `data-exchange-label="${xmlEscape(summary.label)}"`,
      `data-exchange-search="${xmlEscape(summary.searchText)}"`,
      `data-fee-rate="${xmlEscape(summary.feeSort)}"`,
      `data-coverage-count="${xmlEscape(String(summary.coverageCount))}"`,
      `data-board-count="${xmlEscape(String(summary.boardCount))}"`,
      `data-sales-count="${xmlEscape(String(summary.salesCount))}"`,
      `data-volume-count="${xmlEscape(String(summary.volumeCount))}"`,
      `data-has-board="${summary.hasBoard ? 'true' : 'false'}"`,
      `data-has-sales="${summary.hasSales ? 'true' : 'false'}"`,
      `data-has-leverage="${summary.hasLeverage ? 'true' : 'false'}"`,
      `data-has-zero-fee="${summary.hasZeroFee ? 'true' : 'false'}"`,
      `data-original-index="${xmlEscape(String(summary.index))}"`,
    ].join(' ');
  }

  function renderExchangeIndexCards(exchanges) {
    if (!exchanges || exchanges.length === 0) {
      return '<p class="text-center text-gray-500 py-8">取引所データを準備中です</p>';
    }

    return exchanges.map((exchange, index) => {
      const summary = exchangeIndexSummary(exchange, index);
      const badges = exchangeIndexCardBadges(summary);
      const ribbon = summary.hasZeroFee ? '<span class="exchange-index-card__ribbon">取引所 0%</span>' : '';
      const badgeHtml = badges.map(badge => (
        `<span class="exchange-index-card__badge exchange-index-card__badge--${xmlEscape(badge.tone)}">${xmlEscape(badge.label)}</span>`
      )).join('');
      const attrs = exchangeIndexDataAttrs(summary, 'card');

      return [
        `<article class="exchange-index-card" ${attrs} style="--exchange-accent:${xmlEscape(summary.accent)}">`,
        ribbon,
        '  <div class="exchange-index-card__actions">',
        `    <label class="market-compare-toggle"><input type="checkbox" data-exchange-compare="${xmlEscape(summary.id)}"><span>比較</span></label>`,
        '  </div>',
        `  <a class="exchange-index-card__main" href="${xmlEscape(summary.path)}">`,
        '    <span class="exchange-index-card__topline">',
        '      <span class="exchange-index-card__identity">',
        `        <span class="exchange-index-logo" aria-hidden="true">${xmlEscape(summary.shortLabel)}</span>`,
        '        <span class="exchange-index-card__titleblock">',
        `          <strong>${xmlEscape(summary.label)}</strong>`,
        `          <span>${xmlEscape(summary.fullName)}</span>`,
        '        </span>',
        '      </span>',
        `      <span class="exchange-index-card__default">${xmlEscape(summary.defaultMarketLabel)}</span>`,
        '    </span>',
        `    <span class="exchange-index-card__badges">${badgeHtml}</span>`,
        '    <dl class="exchange-index-card__metrics">',
        `      <div><dt>取引所手数料</dt><dd>${xmlEscape(summary.feeLabel)}</dd></div>`,
        `      <div><dt>取扱銘柄数</dt><dd><strong>${xmlEscape(formatCount(summary.coverageCount))}</strong><span>銘柄</span></dd></div>`,
        `      <div><dt>板取引対応</dt><dd><strong>${xmlEscape(formatCount(summary.boardCount))}</strong><span>銘柄</span></dd></div>`,
        `      <div><dt>販売所スプレッド</dt><dd><strong>${xmlEscape(formatCount(summary.salesCount))}</strong><span>銘柄</span></dd></div>`,
        `      <div><dt>出来高データ</dt><dd><strong>${xmlEscape(formatCount(summary.volumeCount))}</strong><span>銘柄</span></dd></div>`,
        `      <div><dt>レバレッジ</dt><dd>${summary.hasLeverage ? '対応あり' : '現物中心'}</dd></div>`,
        '    </dl>',
        '    <span class="exchange-index-card__cta">取引所詳細へ<span aria-hidden="true">→</span></span>',
        '  </a>',
        renderExchangeIndexCardReferralAction(summary),
        '</article>',
      ].join('\n');
    }).join('\n');
  }

  function renderExchangeIndexTableRows(exchanges) {
    if (!exchanges || exchanges.length === 0) return '';
    return exchanges.map((exchange, index) => {
      const summary = exchangeIndexSummary(exchange, index);
      const attrs = exchangeIndexDataAttrs(summary, 'row');
      return [
        `<tr ${attrs} style="--exchange-accent:${xmlEscape(summary.accent)}">`,
        '  <td data-label="取引所">',
        '    <div class="exchange-index-row__identity">',
        `      <span class="exchange-index-logo exchange-index-logo--sm" aria-hidden="true">${xmlEscape(summary.shortLabel)}</span>`,
        '      <div>',
        `        <a class="market-index-row__label" href="${xmlEscape(summary.path)}">${xmlEscape(summary.label)}</a>`,
        `        <div class="market-index-row__id">${xmlEscape(summary.fullName)}</div>`,
        '      </div>',
        '    </div>',
        '  </td>',
        `  <td data-label="手数料" data-sort-value="${xmlEscape(summary.feeSort)}">${xmlEscape(summary.feeLabel)}</td>`,
        `  <td data-label="取扱" data-sort-value="${xmlEscape(String(summary.coverageCount))}">${xmlEscape(formatCount(summary.coverageCount))}銘柄</td>`,
        `  <td data-label="板取引" data-sort-value="${xmlEscape(String(summary.boardCount))}">${xmlEscape(formatCount(summary.boardCount))}銘柄</td>`,
        `  <td data-label="販売所" data-sort-value="${xmlEscape(String(summary.salesCount))}">${xmlEscape(summary.salesCount > 0 ? `${formatCount(summary.salesCount)}銘柄` : 'データ待ち')}</td>`,
        `  <td data-label="出来高" data-sort-value="${xmlEscape(String(summary.volumeCount))}">${xmlEscape(summary.volumeCount > 0 ? `${formatCount(summary.volumeCount)}銘柄` : 'データ待ち')}</td>`,
        `  <td data-label="レバレッジ">${summary.hasLeverage ? 'あり' : '-'}</td>`,
        '  <td data-label="操作">',
        '    <div class="market-index-row__actions">',
        `      <label class="market-compare-toggle market-compare-toggle--compact"><input type="checkbox" data-exchange-compare="${xmlEscape(summary.id)}"><span>比較</span></label>`,
        `      <a class="exchange-index-row__link" href="${xmlEscape(summary.path)}">詳細</a>`,
        renderExchangeIndexRowReferralAction(summary),
        '    </div>',
        '  </td>',
        '</tr>',
      ].join('\n');
    }).join('\n');
  }

  function exchangeIndexClientModel(model) {
    return {
      meta: model.meta,
      exchanges: (model.exchanges || []).map((exchange, index) => exchangeIndexSummary(exchange, index)),
    };
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
      '  <link rel="stylesheet" href="/css/style.css?v=ui-20">',
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
      `      <span id="exchange-index-status" class="status-text">掲載: <span id="exchange-index-visible-count">${xmlEscape(String(model.meta.exchangeCount))}</span>社</span>`,
      `      <span class="text-xs text-gray-600 ml-2">取扱集計: <span class="text-gray-400">${xmlEscape(formatCount(model.meta.marketCount))}</span></span>`,
      '    </div>',
      '  </header>',
      '  <main id="main" class="dashboard-shell home-shell flex flex-col gap-4 p-4 max-w-[1440px] mx-auto" data-exchanges-index>',
      '    <section class="panel panel--dense">',
      '      <div class="panel-title-row mb-4">',
      '        <div>',
      '          <p class="panel-kicker mb-2">Exchanges</p>',
      '          <h2 class="text-3xl md:text-4xl font-bold text-gray-100">取引所一覧</h2>',
      `          <p class="text-sm text-gray-400 mt-3 leading-7">${xmlEscape(description)}</p>`,
      '          <p class="exchange-index-freshness" data-exchange-generated-at="' + xmlEscape(model.meta.generatedAt) + '"><span class="exchange-index-freshness__dot" aria-hidden="true"></span><span data-exchange-generated-label>一覧データ更新済み</span></p>',
      '        </div>',
      '      </div>',
      '      <div class="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">',
      `        <div class="metric-row metric-row--hero"><span class="metric-label">掲載取引所</span><span class="metric-value metric-value--hero">${xmlEscape(String(model.meta.exchangeCount))}社</span></div>`,
      `        <div class="metric-row metric-row--hero bid"><span class="metric-label">取扱銘柄集計</span><span class="metric-value metric-value--hero text-green-300">${xmlEscape(formatCount(model.meta.marketCount))}</span></div>`,
      '      </div>',
      '      <div class="exchange-index-toolbar" aria-label="取引所一覧フィルター">',
      '        <label class="filter-control filter-control--search" for="exchange-index-search">',
      '          <span>取引所検索</span>',
      '          <input id="exchange-index-search" class="field" type="search" placeholder="Coincheck / 手数料 / レバレッジ" autocomplete="off">',
      '        </label>',
      '        <label class="filter-control" for="exchange-index-sort">',
      '          <span>並び替え</span>',
      '          <select id="exchange-index-sort" class="field">',
      '            <option value="rank">掲載順</option>',
      '            <option value="feeAsc">手数料が安い順</option>',
      '            <option value="coverageDesc">取扱銘柄数が多い順</option>',
      '            <option value="boardDesc">板取引銘柄が多い順</option>',
      '            <option value="volumeDesc">出来高データが多い順</option>',
      '          </select>',
      '        </label>',
      '        <fieldset class="exchange-index-filters">',
      '          <legend>絞り込み</legend>',
      '          <div class="exchange-index-filter-chips">',
      '            <label><input type="checkbox" data-exchange-filter="board"><span>板取引あり</span></label>',
      '            <label><input type="checkbox" data-exchange-filter="sales"><span>販売所データあり</span></label>',
      '            <label><input type="checkbox" data-exchange-filter="leverage"><span>レバレッジ対応</span></label>',
      '            <label><input type="checkbox" data-exchange-filter="zeroFee"><span>取引所 0%</span></label>',
      '          </div>',
      '        </fieldset>',
      '        <div class="exchange-index-toolbar__actions">',
      '          <div class="market-view-switch" role="group" aria-label="表示形式">',
      '            <button class="market-view-switch__button is-active" type="button" data-exchange-view="cards" aria-pressed="true">カード</button>',
      '            <button class="market-view-switch__button" type="button" data-exchange-view="table" aria-pressed="false">表</button>',
      '          </div>',
      '          <button id="exchange-index-clear" class="market-filter-clear" type="button">条件をクリア</button>',
      '        </div>',
      '      </div>',
      '    </section>',
      '    <section id="exchange-index-directory" class="panel panel--dense">',
      '      <div class="panel-title-row mb-3">',
      '        <div>',
      '          <h2 class="panel-title">比較ディレクトリ</h2>',
      '          <p id="exchange-index-meta" class="text-xs text-gray-500 mt-1">全取引所を表示中</p>',
      '        </div>',
      '        <span class="panel-kicker">Directory</span>',
      '      </div>',
      '      <div id="exchange-index-grid" class="exchange-index-grid">',
      renderExchangeIndexCards(model.exchanges),
      '      </div>',
      '      <div id="exchange-index-table-wrap" class="exchange-index-table-wrap" hidden>',
      '        <table id="exchange-index-table" class="exchange-index-table data-table">',
      '          <thead>',
      '            <tr>',
      '              <th>取引所</th>',
      '              <th>手数料</th>',
      '              <th>取扱</th>',
      '              <th>板取引</th>',
      '              <th>販売所</th>',
      '              <th>出来高</th>',
      '              <th>レバレッジ</th>',
      '              <th>操作</th>',
      '            </tr>',
      '          </thead>',
      '          <tbody>',
      renderExchangeIndexTableRows(model.exchanges),
      '          </tbody>',
      '        </table>',
      '      </div>',
      '      <p id="exchange-index-empty" class="text-center text-gray-500 py-8 hidden">条件に合う取引所がありません。検索語や絞り込み条件を変更してください。</p>',
      '    </section>',
      renderCompareToolSection('exchanges-compare-tools-title'),
      '  </main>',
      `  <footer class="border-t border-gray-800 px-6 py-2 text-xs text-gray-600 text-center">${xmlEscape(SITE_NAME)} | 取引所一覧</footer>`,
      `  <script>window.EXCHANGES_INDEX=${safeJsonForHtml(exchangeIndexClientModel(model))};</script>`,
      '  <script src="/js/exchanges-index.js?v=exchanges-1"></script>',
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
    const lede = pageContent.hero && pageContent.hero.body
      ? pageContent.hero.body
      : `${exchange.fullName || exchange.label} の基本情報、対応サービス、板取引対応銘柄、販売所対応銘柄、出来高シェアを確認できます。注文前には公式画面で最新条件と表示価格を確認してください。`;

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
      signupUrl: pageContent.referralUrl || pageContent.signupUrl || pageContent.officialUrl || null,
      campaignUrl: pageContent.campaignUrl || pageContent.officialUrl || null,
      campaignLabel: pageContent.campaignLabel || '公式ページで最新情報を確認',
      referralUrl: pageContent.referralUrl || null,
      referralCode: pageContent.referralCode || null,
      referralRel: pageContent.referralRel || null,
      referralReferrerPolicy: pageContent.referralReferrerPolicy || null,
      referralTarget: Object.prototype.hasOwnProperty.call(pageContent, 'referralTarget') ? pageContent.referralTarget : undefined,
      referralTrackingPixelUrl: pageContent.referralTrackingPixelUrl || null,
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
      sourceLinks: Array.isArray(financial.sourceLinks)
        ? financial.sourceLinks
          .filter(link => link && link.title && link.href)
          .map(link => ({
            title: fallbackText(link.title),
            href: fallbackText(link.href, ''),
            description: fallbackText(link.description, ''),
            badge: fallbackText(link.badge, 'Source'),
            meta: fallbackText(link.meta, ''),
          }))
        : [],
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
    const shouldMobileCollapse = options.mobileCollapse !== false && filteredItems.length > 4;
    const classes = [
      'exchange-detail-list',
      options.compact ? 'exchange-detail-list--compact' : '',
      shouldMobileCollapse ? 'exchange-detail-list--mobile-collapsed' : '',
    ].filter(Boolean).join(' ');

    const listHtml = [
      `<dl class="${classes}">`,
      filteredItems.map((item) => {
        const value = item.valueHtml != null ? item.valueHtml : xmlEscape(fallbackText(item.value));
        const classAttr = item.isLive ? ' class="exchange-detail-list__value--live"' : '';
        return [
          '  <div>',
          `    <dt>${xmlEscape(item.label)}</dt>`,
          `    <dd${classAttr}>${value}</dd>`,
          item.gauge ? renderExchangeGauge({
            label: item.gauge.label || item.label,
            value: item.gauge.value || fallbackText(item.value),
            percent: item.gauge.percent,
            tone: item.gauge.tone,
            compact: true,
          }) : '',
          '  </div>',
        ].filter(Boolean).join('\n');
      }).join('\n'),
      '</dl>',
    ].join('\n');

    if (!shouldMobileCollapse) return listHtml;

    return [
      '<div class="exchange-detail-list-shell" data-exchange-mobile-detail-list>',
      listHtml,
      '  <button class="exchange-mobile-detail-toggle" type="button" data-exchange-mobile-detail-toggle aria-expanded="false">詳細を表示</button>',
      '</div>',
    ].join('\n');
  }

  function clampGaugePercent(value) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return 0;
    return Math.max(0, Math.min(100, numeric));
  }

  function gaugePercentFromSpread(value) {
    const spread = parseNumber(value);
    if (spread == null) return 0;
    return clampGaugePercent((spread / 15) * 100);
  }

  function gaugeToneFromSpread(value) {
    const spread = parseNumber(value);
    if (spread == null) return 'neutral';
    if (spread >= 8) return 'danger';
    if (spread >= 3) return 'warning';
    return 'calm';
  }

  function renderTermHelpButton(termKey, label) {
    if (!termKey) return '';
    const readableLabel = fallbackText(label, termKey);
    return [
      `<button class="term-help exchange-term-help" type="button" data-term-key="${xmlEscape(termKey)}" aria-label="${xmlEscape(readableLabel)} の説明を開く">`,
      '  <span aria-hidden="true">?</span>',
      '</button>',
    ].join('');
  }

  function renderExchangeCardTitle(card) {
    const help = renderTermHelpButton(card.termKey, card.title);
    return `<h3 class="market-definition-card__term">${xmlEscape(card.title)}${help}</h3>`;
  }

  function renderExchangeGauge(visual = {}) {
    const percent = clampGaugePercent(visual.percent);
    const classes = [
      'exchange-visual-meter',
      visual.compact ? 'exchange-visual-meter--compact' : '',
      visual.field ? 'exchange-visual-meter--live' : '',
      visual.tone ? `exchange-visual-meter--${visual.tone}` : '',
    ].filter(Boolean).join(' ');
    const fieldAttr = visual.field ? ` data-exchange-gauge-field="${xmlEscape(visual.field)}"` : '';
    const value = fallbackText(visual.value, 'データ待ち');
    const label = fallbackText(visual.label, '参考値');
    const meta = fallbackText(visual.meta);

    return [
      `<div class="${classes}"${fieldAttr} aria-label="${xmlEscape(`${label}: ${value}`)}">`,
      '  <div class="exchange-visual-meter__topline">',
      `    <span>${xmlEscape(label)}</span>`,
      `    <strong data-exchange-gauge-value>${xmlEscape(value)}</strong>`,
      '  </div>',
      '  <div class="exchange-visual-meter__track" aria-hidden="true">',
      `    <span data-exchange-gauge-fill style="width: ${percent.toFixed(2)}%"></span>`,
      '  </div>',
      meta ? `  <small>${xmlEscape(meta)}</small>` : '',
      '</div>',
    ].filter(Boolean).join('\n');
  }

  function renderExchangeVisuals(visuals) {
    const filteredVisuals = (visuals || []).filter(Boolean);
    if (filteredVisuals.length === 0) return '';
    return [
      '<div class="exchange-visual-list">',
      filteredVisuals.map(renderExchangeGauge).join('\n'),
      '</div>',
    ].join('\n');
  }

  function renderExchangeInlineDetails({ summary = '詳細を見る', bodyHtml = '', className = '' } = {}) {
    if (!bodyHtml) return '';
    const classes = ['exchange-inline-details', className].filter(Boolean).join(' ');
    return [
      `<details class="${classes}">`,
      `  <summary>${xmlEscape(summary)}</summary>`,
      `  <div class="exchange-inline-details__body">${bodyHtml}</div>`,
      '</details>',
    ].join('\n');
  }

  function renderExchangeHeroTags(exchange, { boardCount, salesCount } = {}) {
    const profile = exchangePageProfile(exchange);
    const parentCompany = fallbackText(profile.parentCompany);
    const serviceText = formatExchangeServices(profile);
    const hasStaking = /ステーキング/.test(serviceText);
    const tags = [
      { label: exchange.id === 'coincheck' ? '初心者向け' : '基本確認向け', tone: 'primary' },
      { label: `板取引: ${formatCount(boardCount)}銘柄`, tone: 'board' },
      { label: `販売所: ${formatCount(salesCount)}銘柄`, tone: 'sales' },
      hasStaking ? { label: 'ステーキング対応', tone: 'staking' } : null,
      exchange.id === 'coincheck' ? { label: 'アプリDL実績あり', tone: 'app' } : null,
      parentCompany && /マネックス|Monex/i.test(parentCompany) ? { label: 'マネックスG系', tone: 'trust' } : null,
    ].filter(Boolean);

    return [
      '<div class="exchange-hero-tags" aria-label="クイックステータス">',
      tags.map(tag => (
        `<span class="exchange-hero-tag exchange-hero-tag--${xmlEscape(tag.tone)}">${xmlEscape(tag.label)}</span>`
      )).join('\n'),
      '</div>',
    ].join('\n');
  }

  function coincheckHeroBenefits(exchange, { boardCount } = {}) {
    if (exchange.id === 'coincheck') {
      return [
        {
          icon: 'UI',
          label: 'アプリ中心のUI',
          title: '初めてでも迷いにくい導線',
          body: 'スマホアプリ中心で価格確認から購入・管理まで進めやすく、販売所とTrade Viewの使い分けも同じページで整理できます。',
        },
        {
          icon: 'BD',
          label: '主要銘柄の板取引',
          title: `${formatCount(boardCount)}銘柄を板で確認`,
          body: 'BTC、ETH、XRP、SOLなどの主要銘柄で取引所形式を確認でき、販売所スプレッドと板コストを分けて判断できます。',
        },
        {
          icon: 'TR',
          label: 'マネックスGの安心感',
          title: '公開情報を追いやすい運営体制',
          body: '国内運営会社、Coincheck Group N.V.、マネックスグループの公開情報をあわせて確認しやすい構成です。',
        },
      ];
    }

    return [
      {
        icon: 'CV',
        label: '対応範囲',
        title: `${formatCount(exchange.coverage.length)}銘柄を確認`,
        body: '販売所と取引所形式の対応を分けて、自分が使う銘柄から確認できます。',
      },
      {
        icon: 'BD',
        label: '板取引',
        title: `${formatCount(boardCount)}銘柄の板を比較`,
        body: '板スプレッド、手数料、スリッページを同じ注文金額で見比べられます。',
      },
      {
        icon: 'TR',
        label: '信頼性',
        title: '公開資料をまとめて確認',
        body: '登録情報、運営会社、親会社、財務資料への導線を整理しています。',
      },
    ];
  }

  function renderExchangeHeroBenefits(exchange, options = {}) {
    const benefits = coincheckHeroBenefits(exchange, options);
    return [
      '<div class="exchange-hero-benefits" aria-label="キーベネフィット">',
      benefits.map(benefit => [
        '  <article class="exchange-hero-benefit">',
        `    <span class="exchange-hero-benefit__icon" aria-hidden="true">${xmlEscape(benefit.icon)}</span>`,
        '    <div>',
        `      <span class="exchange-hero-benefit__label">${xmlEscape(benefit.label)}</span>`,
        `      <strong>${xmlEscape(benefit.title)}</strong>`,
        `      <p>${xmlEscape(benefit.body)}</p>`,
        '    </div>',
        '  </article>',
      ].join('\n')).join('\n'),
      '</div>',
    ].join('\n');
  }

  function radarPoints(items) {
    const center = 54;
    const radius = 42;
    const count = items.length || 1;
    return items.map((item, index) => {
      const angle = (-90 + (360 / count) * index) * Math.PI / 180;
      const score = Math.max(0, Math.min(5, Number(item.score) || 0));
      const distance = (score / 5) * radius;
      const x = center + Math.cos(angle) * distance;
      const y = center + Math.sin(angle) * distance;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');
  }

  function radarGridPoints(count, fraction) {
    const center = 54;
    const radius = 42 * fraction;
    return Array.from({ length: count }).map((_, index) => {
      const angle = (-90 + (360 / count) * index) * Math.PI / 180;
      const x = center + Math.cos(angle) * radius;
      const y = center + Math.sin(angle) * radius;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');
  }

  function exchangeHeroScores(exchange) {
    if (exchange.id === 'coincheck') {
      return [
        { label: 'アプリUI', score: 4.7, criteria: '口座開設、価格確認、購入導線の分かりやすさを見ています。掲載社平均は同じ評価式で算出した目安です。' },
        { label: '板コスト', score: 4.2, criteria: '主要銘柄の板対応、板スプレッド、10万円買い時の価格影響を重視しています。' },
        { label: '銘柄数', score: 4.1, criteria: '販売所と取引所形式で確認できる銘柄数、主要銘柄のカバー状況を見ています。' },
        { label: '信頼性', score: 4.5, criteria: '登録情報、公開資料、運営会社・親会社情報の追いやすさを見ています。' },
      ];
    }
    return [
      { label: '使いやすさ', score: 4.0, criteria: '販売所、取引所形式、入出金など主要導線の見つけやすさを評価しています。' },
      { label: '板コスト', score: exchange.boardMarkets.length >= 10 ? 4.2 : 3.4, criteria: '板取引対応銘柄数と、主要銘柄で10万円買いを試算したときのImpactを見ています。' },
      { label: '銘柄数', score: exchange.coverage.length >= 20 ? 4.4 : 3.5, criteria: '取扱銘柄の広さと、板取引・販売所の対応形式を分けて確認できるかを見ています。' },
      { label: '信頼性', score: 4.0, criteria: '金融庁登録、会社情報、公開資料、注意事項への導線の追いやすさを評価しています。' },
    ];
  }

  function exchangeHeroScoreBenchmarks() {
    const rows = (getPublicExchanges() || []).map(exchange => exchangeHeroScores(buildExchangePageModel(exchange)));
    const byLabel = new Map();
    rows.flat().forEach((item) => {
      const score = Number(item.score);
      if (!item.label || !Number.isFinite(score)) return;
      const bucket = byLabel.get(item.label) || [];
      bucket.push(score);
      byLabel.set(item.label, bucket);
    });
    return new Map(Array.from(byLabel.entries()).map(([label, scores]) => [
      label,
      scores.reduce((sum, value) => sum + value, 0) / scores.length,
    ]));
  }

  function scoreBenchmarkCopy(item, average) {
    if (!Number.isFinite(Number(average))) return '掲載社平均はデータ準備中です。';
    const delta = Number(item.score) - Number(average);
    const deltaText = Math.abs(delta) < 0.05
      ? '平均並み'
      : `${delta > 0 ? '+' : ''}${delta.toFixed(1)}pt`;
    return `掲載社平均目安 ${Number(average).toFixed(1)}/5（${deltaText}）。`;
  }

  function renderExchangeHeroScore(exchange) {
    const scores = exchangeHeroScores(exchange);
    const benchmarks = exchangeHeroScoreBenchmarks();
    const count = scores.length;
    return [
      '<aside class="exchange-hero-score" aria-label="独自評価スコア">',
      '  <div class="exchange-hero-score__chart" aria-hidden="true">',
      '    <svg viewBox="0 0 108 108" role="img" focusable="false">',
      `      <polygon class="exchange-hero-score__grid" points="${xmlEscape(radarGridPoints(count, 1))}"></polygon>`,
      `      <polygon class="exchange-hero-score__grid exchange-hero-score__grid--inner" points="${xmlEscape(radarGridPoints(count, 0.64))}"></polygon>`,
      `      <polygon class="exchange-hero-score__grid exchange-hero-score__grid--inner" points="${xmlEscape(radarGridPoints(count, 0.32))}"></polygon>`,
      scores.map((_, index) => {
        const angle = (-90 + (360 / count) * index) * Math.PI / 180;
        const x = 54 + Math.cos(angle) * 42;
        const y = 54 + Math.sin(angle) * 42;
        return `      <line class="exchange-hero-score__axis" x1="54" y1="54" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}"></line>`;
      }).join('\n'),
      `      <polygon class="exchange-hero-score__shape" points="${xmlEscape(radarPoints(scores))}"></polygon>`,
      '      <circle class="exchange-hero-score__center" cx="54" cy="54" r="2.8"></circle>',
      '    </svg>',
      '  </div>',
      '  <div class="exchange-hero-score__body">',
      '    <span class="exchange-hero-score__eyebrow">Get Crypto Score</span>',
      '    <strong>使いやすさとコスト確認のバランス</strong>',
      '    <dl>',
      scores.map(item => [
        '      <div>',
        `        <dt><button class="exchange-hero-score__metric" type="button" data-score-popover-title="${xmlEscape(item.label)}" data-score-popover-body="${xmlEscape(`${item.criteria} ${scoreBenchmarkCopy(item, benchmarks.get(item.label))}`)}">${xmlEscape(item.label)}</button></dt>`,
        `        <dd>${xmlEscape(item.score.toFixed(1))}<small>/5</small></dd>`,
        '      </div>',
      ].join('\n')).join('\n'),
      '    </dl>',
      '  </div>',
      '</aside>',
    ].join('\n');
  }

  function renderExchangeDefinitionCards(cards) {
    return cards.map((card) => {
      const articleClasses = ['market-definition-card', card.className].filter(Boolean).join(' ');
      const description = card.descriptionHtml != null
        ? card.descriptionHtml
        : (card.description ? xmlEscape(card.description) : '');
      const descriptionHtml = description
        ? `<p class="market-definition-card__description">${description}</p>`
        : '';
      const headerHtml = card.badge ? [
        '  <div class="exchange-card-header">',
        '    <div>',
        `      ${renderExchangeCardTitle(card)}`,
        descriptionHtml ? `      ${descriptionHtml}` : '',
        '    </div>',
        `    <span class="badge">${xmlEscape(card.badge)}</span>`,
        '  </div>',
      ].filter(Boolean).join('\n') : [
        `  ${renderExchangeCardTitle(card)}`,
        descriptionHtml ? `  ${descriptionHtml}` : '',
      ].filter(Boolean).join('\n');
      const disclosureBody = card.disclosureHtml != null
        ? card.disclosureHtml
        : (card.disclosureText ? `<p>${xmlEscape(card.disclosureText)}</p>` : '');

      return [
        `<article class="${articleClasses}">`,
        headerHtml,
        card.bodyHtml || '',
        card.visuals ? renderExchangeVisuals(card.visuals) : '',
        card.details ? renderExchangeDetailList(card.details, { compact: card.compactDetails }) : '',
        disclosureBody ? renderExchangeInlineDetails({
          summary: card.disclosureSummary || '詳細を見る',
          bodyHtml: disclosureBody,
          className: card.disclosureClassName,
        }) : '',
        card.markets ? renderExchangeMarketPills(card.markets, { emptyMessage: card.emptyMessage }) : '',
        '</article>',
      ].filter(Boolean).join('\n');
    }).join('\n');
  }

  function exchangeReferralActionLink(exchange) {
    if (!exchange || !exchange.referralUrl) return null;
    return {
      href: exchange.referralUrl,
      target: exchange.referralTarget === null ? null : (exchange.referralTarget || '_blank'),
      rel: exchange.referralRel || 'sponsored noopener noreferrer',
      referrerPolicy: exchange.referralReferrerPolicy || null,
      trackingPixelUrl: exchange.referralTrackingPixelUrl || null,
    };
  }

  function renderExchangeActionTrackingPixel(link) {
    return link && link.trackingPixelUrl
      ? `<img src="${xmlEscape(link.trackingPixelUrl)}" width="1" height="1" border="0" alt="">`
      : '';
  }

  function renderExchangeHeroReferralAction(exchange) {
    const link = exchangeReferralActionLink(exchange);
    if (!link) return '';
    return [
      '<aside class="exchange-hero-referral" aria-label="PR紹介リンク">',
      '  <div class="exchange-hero-referral__copy">',
      '    <span class="exchange-hero-referral__eyebrow">限定特典 / 招待プログラム <small>PR</small></span>',
      `    <strong>${xmlEscape(exchange.label)}の紹介特典を適用する</strong>`,
      '    <p>招待コードはリンクに適用済みです。公式の招待ページで、対象者・本人確認・入金や取引条件を申込前に確認してください。</p>',
      '    <ol class="exchange-referral-steps" aria-label="紹介特典の流れ">',
      '      <li><span>1</span><strong>招待リンクを開く</strong></li>',
      '      <li><span>2</span><strong>口座開設</strong></li>',
      '      <li><span>3</span><strong>特典条件確認</strong></li>',
      '    </ol>',
      '  </div>',
      '  <div class="exchange-hero-referral__actions">',
      `    <a class="exchange-hero-referral__button" ${linkAttrsForExchangeAction(link)}><span>Official</span><strong>紹介特典を適用して口座開設</strong>${renderExchangeActionTrackingPixel(link)}</a>`,
      '    <span class="exchange-hero-referral__applied-note">招待コードはリンクに含まれています</span>',
      '  </div>',
      '</aside>',
    ].filter(Boolean).join('\n');
  }

  function renderExchangeConclusionCard(exchange) {
    const boardCount = exchange.boardMarkets.length;
    const salesCount = exchange.salesMarkets.length;
    const conclusion = exchangePageConclusion(exchange);
    const hero = (exchange.pageContent && exchange.pageContent.hero) || {};
    const salesDesk = supportText(conclusion.salesDesk, salesCount);
    const exchangeFormat = supportText(conclusion.exchangeFormat, boardCount);
    const suitableFor = fallbackText(conclusion.suitableFor || (exchange.pageContent.userTypes || [])[0], '使う銘柄と注文金額を決めて比較したい人');
    const defaultMarketLabel = exchange.defaultMarket.label || exchange.defaultMarket.instrumentId;
    const lead = fallbackText(
      hero.firstViewLead || exchange.pageContent.summary || hero.lead,
      `${exchange.label} は、販売所と取引所形式の対応範囲、手数料、板の厚みを一緒に比較しやすい国内暗号資産取引所です。`
    );
    const coverageNote = fallbackText(
      hero.coverageNote,
      `${defaultMarketLabel}を起点に、板取引対応 ${formatCount(boardCount)}件と販売所対応 ${formatCount(salesCount)}件を分けて見られます。`
    );
    const fitNote = fallbackText(
      hero.fitNote,
      '主要銘柄を買う前に、販売所と取引所形式のコスト差を並べて判断できます。'
    );
    const nextCheckTitle = fallbackText(hero.nextCheckTitle, `${defaultMarketLabel}の板と公式条件を確認`);
    const nextCheckNote = fallbackText(
      hero.nextCheckNote,
      '概算コストを見た後は、実際に使う画面の対象銘柄、板の厚み、公式画面の提示価格・手数料を確認します。'
    );
    const heroTitle = fallbackText(hero.title, `${exchange.fullName || exchange.label}の特徴まとめ`);

    return [
      '<div class="exchange-hero-layout">',
      '  <div class="exchange-hero-main">',
      '    <div class="ui-conclusion-card__header decision-summary-card__header market-conclusion-card__header">',
      '      <div>',
      '        <p class="ui-conclusion-card__eyebrow decision-summary-card__eyebrow market-insight-card__eyebrow">Exchange Detail</p>',
      `        <h2 class="ui-conclusion-card__title decision-summary-card__title market-conclusion-card__title">${xmlEscape(heroTitle)}</h2>`,
      '      </div>',
      '      <span class="decision-summary-badge decision-summary-badge--ready market-insight-card__badge">Summary</span>',
      '    </div>',
      renderExchangeHeroTags(exchange, { boardCount, salesCount }),
      `    <p class="ui-conclusion-card__lead decision-summary-card__lead market-conclusion-card__verdict">${xmlEscape(lead)}</p>`,
      renderExchangeHeroReferralAction(exchange),
      renderExchangeHeroBenefits(exchange, { boardCount, salesCount }),
      renderExchangeHeroScore(exchange),
      '  </div>',
      '  <div class="exchange-hero-cta" aria-label="10万円買いの概算コスト">',
      renderExchangeCostSimulator(exchange, {
        variant: 'hero',
        eyebrow: 'Live Cost',
        title: '買う金額で概算コストを見る',
        status: '自動計算',
        showModeComparison: false,
        showProTable: false,
        officialLabel: '公式条件を確認',
      }),
      '  </div>',
      '  <div class="exchange-hero-points" aria-label="最初に見る要点">',
      '      <div class="exchange-hero-point">',
      '        <span class="exchange-hero-point__label">特徴</span>',
      `        <strong>${xmlEscape(`販売所 ${salesDesk} / 取引所形式 ${exchangeFormat}`)}</strong>`,
      `        <span>${xmlEscape(coverageNote)}</span>`,
      '      </div>',
      '      <div class="exchange-hero-point">',
      '        <span class="exchange-hero-point__label">向いている人</span>',
      `        <strong>${xmlEscape(suitableFor)}</strong>`,
      `        <span>${xmlEscape(fitNote)}</span>`,
      '      </div>',
      '      <div class="exchange-hero-point">',
      '        <span class="exchange-hero-point__label">次に確認すること</span>',
      `        <strong>${xmlEscape(nextCheckTitle)}</strong>`,
      renderExchangeInlineDetails({
        summary: '詳細を見る',
        bodyHtml: `<p>${xmlEscape(nextCheckNote)}</p>`,
        className: 'exchange-inline-details--hero',
      }),
      '      </div>',
      '  </div>',
      '</div>',
    ].join('\n');
  }

  function renderExchangeCheckOrder(exchange) {
    const defaultMarketLabel = exchange.defaultMarket.label || exchange.defaultMarket.instrumentId;
    const referralLink = exchangeReferralActionLink(exchange);
    const steps = [
      {
        label: '1',
        title: '10万円買いの実質コスト',
        body: '販売所のスプレッドと、取引所形式の手数料・板スプレッド・スリッページを同じ金額で比べられます。',
        link: {
          href: queryPath('/simulator', { exchange: exchange.id, market: exchange.defaultMarket.instrumentId, side: 'buy', amountType: 'jpy', amount: 100000 }),
        },
        cta: 'コストを見る',
      },
      {
        label: '2',
        title: `${defaultMarketLabel}の板`,
        body: '最良Bid / Ask、可視板厚、注文サイズに対する価格影響から、板取引で使いやすいかを判断できます。',
        link: { href: '#exchange-liquidity' },
        cta: '板を見る',
      },
      {
        label: '3',
        title: referralLink ? 'PRリンクと公式条件' : '公式条件',
        body: referralLink
          ? '紹介リンク経由の特典、手数料、入出金、本人確認、公式条件を公式画面で見直します。'
          : '手数料、入出金、本人確認などの条件は申込前に一次情報で見直します。',
        link: referralLink || {
          href: exchange.officialUrl || '/',
          target: exchange.officialUrl ? '_blank' : null,
          rel: exchange.officialUrl ? 'noopener noreferrer' : null,
        },
        cta: referralLink ? 'PRリンクで確認' : '公式確認',
        tone: referralLink ? 'pr' : '',
      },
    ];

    return [
      '<section class="panel panel--dense exchange-check-order" aria-labelledby="exchange-check-order-title">',
      '  <div class="panel-title-row mb-4">',
      '    <div>',
      `      <h2 id="exchange-check-order-title" class="panel-title">${xmlEscape(exchange.label)}を確認する順番</h2>`,
      '      <p class="text-xs text-gray-500 mt-1">最初はコスト、次に板、最後に公式条件を見ると、申込前の判断材料を短時間で揃えられます。</p>',
      '    </div>',
      '    <span class="panel-kicker">Route</span>',
      '  </div>',
      '  <ol class="exchange-check-order__list">',
      steps.map(step => [
        '    <li class="exchange-check-order__item">',
        `      <span class="exchange-check-order__number">${xmlEscape(step.label)}</span>`,
        '      <div>',
        `        <strong>${xmlEscape(step.title)}</strong>`,
        `        <span>${xmlEscape(step.body)}</span>`,
        '      </div>',
        `      <a class="exchange-check-order__link${step.tone ? ` exchange-check-order__link--${xmlEscape(step.tone)}` : ''}" ${linkAttrsForExchangeAction(step.link)}>${xmlEscape(step.cta)}${renderExchangeActionTrackingPixel(step.link)}</a>`,
        '    </li>',
      ].join('\n')).join('\n'),
      '  </ol>',
      '</section>',
    ].join('\n');
  }

  function renderExchangeTabs(exchange) {
    const defaultMarketLabel = exchange.defaultMarket.label || exchange.defaultMarket.instrumentId;
    return [
      '<nav class="exchange-sticky-nav" aria-label="取引所ページ内ナビ">',
      '  <span class="exchange-sticky-nav__progress" aria-hidden="true"><i data-exchange-scroll-progress style="width:0%"></i></span>',
      '  <div class="tab-group exchange-tabs" role="tablist" aria-label="表示カテゴリ">',
      '    <button class="btn-tab is-active" type="button" role="tab" aria-selected="true" data-exchange-tab="simple">かんたん比較</button>',
      '    <button class="btn-tab" type="button" role="tab" aria-selected="false" data-exchange-tab="cost">コスト詳細</button>',
      '    <button class="btn-tab" type="button" role="tab" aria-selected="false" data-exchange-tab="trust">運営会社・信頼性</button>',
      '  </div>',
      '  <div class="exchange-sticky-nav__links" aria-label="主要セクション">',
      '    <a href="#exchange-overview">基本情報</a>',
      '    <a href="#exchange-fees">コスト</a>',
      `    <a href="#exchange-liquidity">${xmlEscape(defaultMarketLabel)}板</a>`,
      '    <a href="#exchange-coverage">取扱銘柄</a>',
      '    <a href="#exchange-faq">FAQ</a>',
      '  </div>',
      '  <div class="exchange-sticky-summary" data-exchange-sticky-summary aria-label="ライブ価格サマリー">',
      '    <span class="exchange-live-chip"><i aria-hidden="true"></i>LIVE</span>',
      '    <span><em>Amount</em><strong data-exchange-sticky-field="amount">10万円買い</strong></span>',
      '    <span><em>Price</em><strong data-exchange-sticky-field="price">読み込み中</strong></span>',
      '    <span><em>Spread</em><strong data-exchange-sticky-field="spread">比較待ち</strong></span>',
      '    <span><em>Delta</em><strong data-exchange-sticky-field="delta">計算中</strong></span>',
      '  </div>',
      '  <p class="exchange-data-status" data-exchange-live-field="dataTimestamp"><span class="exchange-refresh-ring" data-exchange-refresh-ring aria-hidden="true"></span><span data-exchange-refresh-label>データ取得時刻: ページ表示後に更新</span></p>',
      '</nav>',
    ].join('\n');
  }

  function renderExchangeModeComparison() {
    const modes = [
      {
        key: 'sales',
        title: '販売所',
        summary: 'すぐ買いやすい一方、買値・売値差が実質コストになりやすい方式です。',
        items: [
          { label: 'スピード', value: 92 },
          { label: '手軽さ', value: 95 },
          { label: 'コスト透明性', value: 46 },
        ],
      },
      {
        key: 'board',
        title: '取引所形式',
        summary: '板を見て注文できるため、手数料・板スプレッド・Impactを分けて確認できます。',
        items: [
          { label: 'コスト透明性', value: 88 },
          { label: '板の確認', value: 90 },
          { label: '手軽さ', value: 62 },
        ],
      },
    ];

    return [
      '<div class="exchange-mode-compare" aria-label="販売所と取引所形式の比較">',
      modes.map(mode => [
        `  <div class="exchange-mode-card exchange-mode-card--${xmlEscape(mode.key)}">`,
        '    <div class="exchange-mode-card__header">',
        `      <span class="exchange-mode-card__icon" aria-hidden="true"></span>`,
        `      <strong>${xmlEscape(mode.title)}</strong>`,
        '    </div>',
        `    <p>${xmlEscape(mode.summary)}</p>`,
        '    <div class="exchange-mode-card__bars">',
        mode.items.map(item => [
          '      <div class="exchange-mode-bar">',
          `        <span>${xmlEscape(item.label)}</span>`,
          `        <strong>${xmlEscape(String(item.value))}</strong>`,
          `        <i style="width:${clampGaugePercent(item.value).toFixed(0)}%"></i>`,
          '      </div>',
        ].join('\n')).join('\n'),
        '    </div>',
        '  </div>',
      ].join('\n')).join('\n'),
      '</div>',
    ].join('\n');
  }

  function renderExchangeCostSimulator(exchange, options = {}) {
    const defaultMarketLabel = exchange.defaultMarket.label || exchange.defaultMarket.instrumentId;
    const quickAmounts = [10000, 100000, 500000, 1000000, 5000000];
    const officialHref = exchange.officialUrl || '/';
    const defaultAmount = Number.isFinite(Number(options.defaultAmount)) ? Number(options.defaultAmount) : 100000;
    const classes = [
      'exchange-cost-simulator',
      options.variant ? `exchange-cost-simulator--${options.variant}` : '',
    ].filter(Boolean).join(' ');
    const title = fallbackText(options.title, `${defaultMarketLabel}をいくら買うかで比較`);
    const eyebrow = fallbackText(options.eyebrow, 'Cost Simulator');
    const status = fallbackText(options.status, '初期値を読み込み中');
    const showModeComparison = options.showModeComparison !== false;
    const showProTable = options.showProTable !== false;
    const officialLabel = fallbackText(options.officialLabel, '公式画面で最終条件を確認');
    return [
      `<article class="${classes} is-loading" data-exchange-cost-simulator data-exchange-id="${xmlEscape(exchange.id)}" data-instrument-id="${xmlEscape(exchange.defaultMarket.instrumentId)}" data-default-amount="${xmlEscape(String(defaultAmount))}" aria-busy="true">`,
      '  <div class="exchange-cost-simulator__header">',
      '    <div>',
      `      <span class="exchange-cost-simulator__eyebrow">${xmlEscape(eyebrow)}</span>`,
      `      <h3>${xmlEscape(title)}</h3>`,
      '    </div>',
      '    <div class="exchange-cost-simulator__state">',
      '      <span class="exchange-live-chip"><i aria-hidden="true"></i>LIVE</span>',
      `      <span class="exchange-cost-simulator__status" data-cost-field="status">${xmlEscape(status)}</span>`,
      '    </div>',
      '  </div>',
      '  <div class="exchange-cost-simulator__controls">',
      '    <label class="exchange-amount-slider">',
      '      <span>注文金額</span>',
      '      <input type="range" min="10000" max="5000000" step="10000" value="100000" data-cost-amount-range>',
      '    </label>',
      '    <label class="exchange-amount-input">',
      '      <span>JPY</span>',
      '      <input class="field" type="number" min="10000" max="5000000" step="10000" value="100000" inputmode="numeric" data-cost-amount-input>',
      '    </label>',
      '    <div class="exchange-quick-amounts" aria-label="注文金額のショートカット">',
      quickAmounts.map(amount => (
        `      <button type="button" data-cost-quick-amount="${xmlEscape(String(amount))}">${xmlEscape(formatJpyCompact(amount))}</button>`
      )).join('\n'),
      '    </div>',
      '  </div>',
      '  <div class="exchange-cost-beginner-summary beginner-only">',
      '    <strong data-cost-field="beginnerLoss">販売所と取引所形式の差額を計算中</strong>',
      '    <span>同じ金額で買ったとき、受け取れる数量と実質価格の差を見ます。</span>',
      '  </div>',
      '  <div class="exchange-cost-results">',
      '    <div class="exchange-cost-result exchange-cost-result--sales">',
      '      <span>販売所参考</span>',
      '      <strong data-cost-field="salesReceive">データ待ち</strong>',
      '      <small data-cost-field="salesMeta">スプレッド取得待ち</small>',
      '    </div>',
      '    <div class="exchange-cost-result exchange-cost-result--board">',
      '      <span>取引所形式</span>',
      '      <strong data-cost-field="boardReceive">データ待ち</strong>',
      '      <small data-cost-field="boardMeta">板データ取得待ち</small>',
      '    </div>',
      '    <div class="exchange-cost-result exchange-cost-result--delta">',
      '      <span>差額目安</span>',
      '      <strong data-cost-field="deltaJpy">計算中</strong>',
      '      <small data-cost-field="deltaMeta">販売所の表示価格を全数量に適用した参考値</small>',
      '    </div>',
      '  </div>',
      '  <div class="exchange-cost-bars" aria-label="販売所と取引所形式の受取数量比較">',
      '    <div class="exchange-cost-bars__item exchange-cost-bars__item--sales">',
      '      <span><b>販売所</b><em data-cost-field="salesBarLabel">受取数量を計算中</em></span>',
      '      <span class="exchange-cost-bars__track"><i data-cost-bar="sales"></i></span>',
      '    </div>',
      '    <div class="exchange-cost-bars__item exchange-cost-bars__item--board">',
      '      <span><b>取引所形式</b><em data-cost-field="boardBarLabel">板シミュレーション待ち</em></span>',
      '      <span class="exchange-cost-bars__track"><i data-cost-bar="board"></i></span>',
      '    </div>',
      '    <div class="exchange-cost-delta-rail">',
      '      <span>受取数量差</span>',
      '      <strong data-cost-field="deltaBase">比較待ち</strong>',
      '      <i aria-hidden="true"><b data-cost-bar="delta"></b></i>',
      '    </div>',
      '  </div>',
      showProTable ? [
        '  <div class="exchange-pro-table exchange-beginner-advanced">',
        '    <div><span>Amount</span><strong data-cost-field="proAmount">100,000 JPY</strong></div>',
        `    <div><span class="exchange-pro-label">Sales spread${renderTermHelpButton('sales-spread', 'Sales spread')}</span><strong data-cost-field="proSalesSpread">-</strong></div>`,
        `    <div><span class="exchange-pro-label">Board impact${renderTermHelpButton('impact', 'Board impact')}</span><strong data-cost-field="proImpact">-</strong></div>`,
        `    <div><span class="exchange-pro-label">Taker fee${renderTermHelpButton('taker-fee', 'Taker fee')}</span><strong data-cost-field="proFee">-</strong></div>`,
        '  </div>',
      ].join('\n') : '',
      showProTable ? [
        '  <div class="exchange-pro-explain exchange-beginner-advanced">',
        '    <span>Advanced</span>',
        '    <strong>Impact = 注文サイズによる最良気配値からの価格乖離</strong>',
        '    <small>成行想定は既定taker手数料を加算します。maker注文や指値条件は公式画面で最終確認してください。</small>',
        '  </div>',
      ].join('\n') : '',
      showModeComparison ? renderExchangeModeComparison() : '',
      '  <div class="exchange-cost-simulator__links">',
      `    <a class="exchange-cost-simulator__official" href="${xmlEscape(officialHref)}"${exchange.officialUrl ? ' target="_blank" rel="noopener noreferrer"' : ''}>${xmlEscape(officialLabel)}</a>`,
      `    <a class="exchange-cost-simulator__secondary" href="${xmlEscape(queryPath('/simulator', { exchange: exchange.id, market: exchange.defaultMarket.instrumentId, side: 'buy', amountType: 'jpy', amount: defaultAmount }))}">${xmlEscape(defaultMarketLabel)}の板詳細</a>`,
      '  </div>',
      '</article>',
    ].filter(Boolean).join('\n');
  }

  function renderExchangeDepthMiniChart(defaultMarketLabel) {
    return [
      '<div class="exchange-depth-mini" data-exchange-depth-chart>',
      '  <div class="exchange-depth-mini__head">',
      `    <span>${xmlEscape(defaultMarketLabel)} depth</span>`,
      '    <strong data-depth-field="total">読み込み中</strong>',
      '  </div>',
      '  <div class="exchange-depth-mini__row exchange-depth-mini__row--ask">',
      '    <span>Ask</span>',
      '    <i><b data-depth-bar="ask" style="width:0%"></b></i>',
      '    <strong data-depth-field="ask">-</strong>',
      '  </div>',
      '  <div class="exchange-depth-mini__row exchange-depth-mini__row--bid">',
      '    <span>Bid</span>',
      '    <i><b data-depth-bar="bid" style="width:0%"></b></i>',
      '    <strong data-depth-field="bid">-</strong>',
      '  </div>',
      '  <div class="exchange-depth-histogram" data-depth-histogram aria-label="板厚ミニヒストグラム">',
      '    <div class="exchange-depth-histogram__side exchange-depth-histogram__side--ask" data-depth-histogram-side="ask"></div>',
      '    <div class="exchange-depth-histogram__axis"><span>Ask</span><span>Bid</span></div>',
      '    <div class="exchange-depth-histogram__side exchange-depth-histogram__side--bid" data-depth-histogram-side="bid"></div>',
      '  </div>',
      '</div>',
    ].join('\n');
  }

  function renderExchangeMicroQuote(defaultMarketLabel) {
    return [
      '<div class="exchange-micro-quote" data-exchange-micro-quote>',
      '  <div class="exchange-micro-quote__head">',
      `    <span>${xmlEscape(defaultMarketLabel)} micro quote</span>`,
      '    <strong data-quote-field="age">更新待ち</strong>',
      '  </div>',
      '  <div class="exchange-micro-quote__grid">',
      '    <div class="exchange-micro-quote__cell exchange-micro-quote__cell--bid"><span>Bid</span><strong data-quote-field="bid">-</strong></div>',
      '    <div class="exchange-micro-quote__cell exchange-micro-quote__cell--ask"><span>Ask</span><strong data-quote-field="ask">-</strong></div>',
      '    <div class="exchange-micro-quote__cell exchange-micro-quote__cell--spread"><span>Spread</span><strong data-quote-field="spread">-</strong></div>',
      '  </div>',
      '</div>',
    ].join('\n');
  }

  function spreadCondition(exchangeSpread) {
    const avg1d = parseNumber(exchangeSpread && exchangeSpread.avg1d);
    const avg7d = parseNumber(exchangeSpread && exchangeSpread.avg7d);
    if (avg1d == null || avg7d == null) {
      return {
        tone: 'neutral',
        label: '判定待ち',
        body: '7日平均との比較データを準備中です。',
        delta: null,
      };
    }

    const delta = avg1d - avg7d;
    if (delta <= -0.15) {
      return {
        tone: 'narrow',
        label: '狭い',
        body: `直近1日平均は7日平均より ${formatPct(Math.abs(delta), 2)} 狭めです。`,
        delta,
      };
    }
    if (delta >= 0.15) {
      return {
        tone: 'wide',
        label: '広い',
        body: `直近1日平均は7日平均より ${formatPct(delta, 2)} 広めです。`,
        delta,
      };
    }
    return {
      tone: 'normal',
      label: '普通',
      body: '直近1日平均は7日平均と近い水準です。',
      delta,
    };
  }

  function renderExchangeSpreadSignal(exchangeSpread) {
    if (!exchangeSpread || !exchangeSpread.marketCount) return '';
    const condition = spreadCondition(exchangeSpread);
    return [
      `<div class="exchange-spread-signal exchange-spread-signal--${xmlEscape(condition.tone)}" data-spread-condition="${xmlEscape(condition.tone)}">`,
      '  <div class="exchange-spread-signal__lights" aria-hidden="true">',
      '    <span data-signal="narrow"></span>',
      '    <span data-signal="normal"></span>',
      '    <span data-signal="wide"></span>',
      '  </div>',
      '  <div>',
      `    <strong>7日平均比: ${xmlEscape(condition.label)}</strong>`,
      `    <span>${xmlEscape(condition.body)}</span>`,
      '  </div>',
      '</div>',
    ].join('\n');
  }

  function exchangePrimaryActionLink(exchange) {
    if (exchange.referralUrl) {
      return {
        href: exchange.referralUrl,
        target: exchange.referralTarget === null ? null : (exchange.referralTarget || '_blank'),
        rel: exchange.referralRel || 'sponsored noopener noreferrer',
        referrerPolicy: exchange.referralReferrerPolicy || null,
        trackingPixelUrl: exchange.referralTrackingPixelUrl || null,
      };
    }
    return {
      href: exchange.signupUrl || exchange.officialUrl || '/',
      target: exchange.signupUrl || exchange.officialUrl ? '_blank' : null,
      rel: exchange.signupUrl || exchange.officialUrl ? 'noopener noreferrer' : null,
    };
  }

  function renderExchangeInlineCta(exchange, options = {}) {
    const actionLink = exchangePrimaryActionLink(exchange);
    const title = fallbackText(options.title, `${exchange.label} 公式サイトで口座開設条件を確認`);
    const body = fallbackText(options.body, '手数料、対象サービス、本人確認などの条件は変わる場合があります。申込前に公式条件を確認してください。');
    const cta = fallbackText(options.cta, '公式サイトで確認');
    return [
      `<aside class="exchange-inline-cta exchange-inline-cta--${xmlEscape(options.tone || 'default')}">`,
      `  <span class="exchange-inline-cta__eyebrow">${xmlEscape(fallbackText(options.eyebrow, 'Official Check'))}</span>`,
      `  <strong>${xmlEscape(title)}</strong>`,
      `  <span>${xmlEscape(body)}</span>`,
      `  <a ${linkAttrsForExchangeAction(actionLink)}>${xmlEscape(cta)}${actionLink.trackingPixelUrl ? `<img src="${xmlEscape(actionLink.trackingPixelUrl)}" width="1" height="1" border="0" alt="">` : ''}</a>`,
      '</aside>',
    ].join('\n');
  }

  function renderExchangeFeeSpreadCards(exchange) {
    const costs = exchangePageCosts(exchange);
    const spreadDetails = exchange.spread.marketCount > 0
      ? [
        { label: '販売所対応', value: `${formatCount(exchange.spread.marketCount)}件` },
        {
          label: '直近1日平均',
          value: formatPct(exchange.spread.avg1d, 2),
          gauge: {
            percent: gaugePercentFromSpread(exchange.spread.avg1d),
            tone: gaugeToneFromSpread(exchange.spread.avg1d),
            value: formatPct(exchange.spread.avg1d, 2),
          },
        },
        {
          label: '7日平均',
          value: exchange.spread.avg7d != null ? formatPct(exchange.spread.avg7d, 2) : 'データ待ち',
          gauge: {
            percent: gaugePercentFromSpread(exchange.spread.avg7d),
            tone: gaugeToneFromSpread(exchange.spread.avg7d),
            value: exchange.spread.avg7d != null ? formatPct(exchange.spread.avg7d, 2) : 'データ待ち',
          },
        },
      ]
      : [
        { label: '販売所スプレッド', value: fallbackText(costs.salesSpreadStatus, 'データ待ち') },
      ];
    const cards = [
      {
        title: '取引手数料',
        description: fallbackText(costs.tradingFee, '公式手数料表で確認'),
        disclosureText: `本サイトの取引コスト計算では、既定 taker 手数料 ${exchange.feeLabel} を比較条件に使っています。`,
        badge: 'Trading',
        termKey: 'taker-fee',
      },
      {
        title: '販売所スプレッド',
        description: fallbackText(costs.salesSpread, '販売所では、買値と売値の差であるスプレッドが実質的なコストになります。本サイトでは、販売所対応銘柄のスプレッドを参考データとして集計しています。'),
        bodyHtml: renderExchangeSpreadSignal(exchange.spread),
        details: spreadDetails,
        badge: 'Spread',
        termKey: 'sales-spread',
      },
      {
        title: '取引所形式の実質コスト',
        descriptionHtml: [
          '<span class="exchange-live-value" data-exchange-live-field="effectiveCost">ページ表示後に10万円買い参考値を表示します。</span>',
        ].join(''),
        visuals: [
          {
            label: '10万円買いのImpact',
            value: '読み込み中',
            percent: 0,
            tone: 'neutral',
            field: 'impact',
            meta: '低いほど価格影響が小さい目安',
          },
        ],
        disclosureText: fallbackText(costs.exchangeCost, '取引所形式では、取引手数料だけでなく、板スプレッドやスリッページも実質コストになります。'),
        badge: 'Board',
        termKey: 'effective-cost',
      },
      {
        title: '注文前の見方',
        description: '販売所と取引所形式では、表示価格、手数料、約定の仕組みが異なります。同じ銘柄でも、使う画面ごとに実効コストを見比べておきましょう。',
        badge: 'Check',
        className: 'exchange-beginner-advanced',
      },
    ];

    return [
      renderExchangeDefinitionCards(cards),
      renderExchangeInlineCta(exchange, {
        eyebrow: 'Cost Check',
        title: `${exchange.label} の手数料・取引条件を公式で確認`,
        body: 'スプレッドや手数料は表示時点の参考値です。注文画面ごとの条件は申込前に公式サイトで見直してください。',
        cta: '公式条件を確認',
        tone: 'cost',
      }),
    ].join('\n');
  }

  function renderExchangeOrderbookVolumeCards(exchange) {
    const thickMarkets = exchange.thickMarkets.map((market) => ({
      label: `${market.label} ${market.quoteVolume != null ? formatJpyCompact(market.quoteVolume) : ''}`.trim(),
    }));
    const defaultMarketLabel = exchange.defaultMarket.label || exchange.defaultMarket.instrumentId;
    const thickDescription = exchange.thickMarkets.length > 0
      ? `24h 出来高が大きい銘柄を、板の厚みを見る候補として並べています。${defaultMarketLabel} はページ表示後に現在の可視板厚も取得します。`
      : `${defaultMarketLabel} を代表銘柄として、板データが取得でき次第、可視板厚を表示します。`;
    const cards = [
      {
        title: '主要銘柄の板厚',
        descriptionHtml: [
          `${xmlEscape(thickDescription)} `,
          '<span class="exchange-live-value" data-exchange-live-field="depth">ページ表示後に可視板厚を表示します。</span>',
        ].join(''),
        bodyHtml: renderExchangeDepthMiniChart(defaultMarketLabel),
        visuals: [
          {
            label: `${defaultMarketLabel} 可視板厚`,
            value: '読み込み中',
            percent: 0,
            tone: 'neutral',
            field: 'depth',
            meta: '大きいほどまとまった注文を吸収しやすい目安',
          },
        ],
        markets: thickMarkets,
        emptyMessage: '出来高データを準備中です。',
        badge: 'Depth',
        termKey: 'liquidity',
      },
      {
        title: '出来高シェア',
        description: `${exchangeVolumeSummaryText(exchange)} 出来高は流動性を見る材料の一つです。実際の約定価格は注文時の板で確認してください。`,
        badge: 'Volume',
        termKey: 'volume-share',
      },
      {
        title: '最良Bid / Ask',
        descriptionHtml: [
          `${xmlEscape(defaultMarketLabel)} の現在板から、売りたい場合の Bid と買いたい場合の Ask を確認できます。 `,
          '<span class="exchange-live-value" data-exchange-live-field="bidAsk">ページ表示後にBid / Askを表示します。</span>',
        ].join(''),
        bodyHtml: renderExchangeMicroQuote(defaultMarketLabel),
        badge: 'Quote',
        termKey: 'orderbook',
      },
      {
        title: 'スリッページの傾向',
        descriptionHtml: [
          '10万円買いの参考シミュレーションで、板の奥まで食う影響を把握できます。 ',
          '<span class="exchange-live-value" data-exchange-live-field="slippage">ページ表示後にスリッページ傾向を表示します。</span>',
        ].join(''),
        visuals: [
          {
            label: '価格影響',
            value: '読み込み中',
            percent: 0,
            tone: 'neutral',
            field: 'slippage',
            meta: '低いほど表示価格からずれにくい目安',
          },
        ],
        badge: 'Impact',
        termKey: 'slippage',
      },
      {
        title: '大きめ注文時の注意点',
        description: '大きめの注文では、最良価格だけでなく、板の奥行き、約定平均価格、taker手数料も確認してください。',
        disclosureText: '必要に応じて注文を分割したり、指値注文を使ったりすることで、想定外の約定を避けやすくなります。',
        badge: 'Caution',
        termKey: 'order-size',
        className: 'exchange-beginner-advanced',
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
    const summaryCard = UIComponents.renderFinancialMetricCard({
      eyebrow: 'Financial Stability',
      title: '公開資料で見る信頼性の要点',
      lead: `${exchange.label} の運営会社を見る際は、登録情報、純資産、利益、親会社、開示資料をあわせて確認できます。`,
      badge: 'Reference',
      className: 'exchange-financial-card--summary',
      details: [
        { label: '運営会社', value: companyName },
        { label: '親会社', value: financial.summary.parentCompany },
        { label: '登録番号', value: registrationNumber },
        { label: '純資産', value: financial.summary.netAssets },
        { label: '営業利益', value: financial.summary.operatingProfit },
        { label: '開示資料', value: financial.summary.disclosureStatus },
      ],
      note: notice,
    });

    const detailCards = [
      {
        eyebrow: 'Company',
        title: '会社概要',
        lead: 'サービス名、運営会社、登録番号、設立年、取扱サービスを確認できます。',
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
        eyebrow: 'Profit',
        title: '売上・利益の推移',
        lead: '単年の黒字 / 赤字だけでなく、売上高、営業利益、経常利益、当期純利益の流れを確認できます。',
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
        eyebrow: 'Equity',
        title: '純資産・自己資本',
        lead: '損益だけでなく、資本の厚みと自己資本比率も確認できます。顧客資産管理とは別の論点として見てください。',
        badge: 'Capital',
        details: [
          { label: '純資産', value: financial.indicators.netAssets },
          { label: '自己資本比率', value: financial.indicators.equityRatio },
          { label: '確認観点', value: '純資産の増減、資本増強、継続企業の前提' },
        ],
      },
      {
        eyebrow: 'Segment',
        title: '暗号資産事業の位置づけ',
        lead: '親会社や複数事業を持つ会社では、暗号資産事業が全体のどの部分を占めるかも見ておくと把握しやすくなります。',
        badge: 'Segment',
        details: [
          { label: '暗号資産関連事業の比率', value: financial.indicators.cryptoBusinessRatio },
          { label: '事業の位置づけ', value: financial.businessPosition },
          { label: '主な収益源', value: financial.revenueSource },
          { label: '関連サービス', value: services },
        ],
      },
      {
        eyebrow: 'Group',
        title: '親会社・グループ情報',
        lead: '親会社の有無、グループ内の位置づけ、上場企業かどうか、開示で確認できる範囲を整理しています。',
        badge: 'Group',
        details: [
          { label: '親会社の有無', value: financial.indicators.parentPresence },
          { label: '親会社・グループ', value: financial.summary.parentCompany },
          { label: '上場企業かどうか', value: financial.indicators.listedCompany },
          { label: 'グループ開示', value: financial.groupDisclosure },
        ],
      },
      {
        eyebrow: '開示情報',
        title: '開示資料',
        lead: '公式会社概要、決算公告、親会社IR、有価証券報告書、金融庁・財務局の公表資料など、一次情報への導線です。',
        badge: '一次情報',
        details: [
          { label: '開示資料', value: financial.disclosureMaterials },
          { label: '行政処分歴', value: financial.indicators.sanctions },
          { label: '監査法人', value: financial.indicators.auditor },
          { label: '開示資料の更新日', value: financial.indicators.disclosureUpdatedAt },
        ],
        links: financial.sourceLinks,
      },
      {
        eyebrow: 'Caution',
        title: '注意点',
        lead: notice,
        badge: 'Caution',
        checks: financial.cautions,
      },
    ];

    function renderFinancialAccordion(card) {
      const detailsHtml = card.details ? renderExchangeDetailList(card.details, { compact: card.details.length > 4 }) : '';
      const checksHtml = card.checks
        ? [
          '  <ol class="market-insight-checklist">',
          card.checks.map(item => `    <li>${xmlEscape(item)}</li>`).join('\n'),
          '  </ol>',
        ].join('\n')
        : '';
      const linksHtml = card.links && card.links.length > 0
        ? [
          '  <ul class="exchange-source-links">',
          card.links.map((link) => [
            '    <li>',
            `      <a href="${xmlEscape(link.href)}" target="_blank" rel="noopener noreferrer">${xmlEscape(link.title)}</a>`,
            `      <span>${xmlEscape([link.meta, link.description].filter(Boolean).join(' / '))}</span>`,
            '    </li>',
          ].join('\n')).join('\n'),
          '  </ul>',
        ].join('\n')
        : '';

      return [
        '<details class="market-insight-card exchange-financial-accordion">',
        '  <summary class="exchange-financial-accordion__summary">',
        '    <div>',
        `      <span class="market-insight-card__eyebrow">${xmlEscape(card.eyebrow)}</span>`,
        `      <h3 class="market-insight-card__title">${xmlEscape(card.title)}</h3>`,
        '    </div>',
        `    <span class="market-insight-card__badge">${xmlEscape(card.badge)}</span>`,
        '  </summary>',
        `  <p class="market-insight-card__lead">${xmlEscape(card.lead)}</p>`,
        detailsHtml,
        checksHtml,
        linksHtml,
        '</details>',
      ].filter(Boolean).join('\n');
    }

    return [
      summaryCard,
      ...detailCards.map(renderFinancialAccordion),
    ].join('\n');
  }

  function renderExchangeRiskCards(exchange) {
    const users = exchange.pageContent.userTypes || [];
    const cautions = exchange.pageContent.cautions || [];

    return [
      '<article class="market-insight-card exchange-risk-card exchange-risk-card--fit">',
      '  <div class="market-insight-card__header">',
      '    <div>',
      '      <p class="market-insight-card__eyebrow">Fit</p>',
      '      <h3 class="market-insight-card__title">向いているユーザーの例</h3>',
      '    </div>',
      '    <span class="market-insight-card__badge">メリット</span>',
      '  </div>',
      `  <p class="market-insight-card__lead">${xmlEscape(exchange.pageContent.summary || `${exchange.label} の比較導線を整理しやすい人向けの目安です。`)}</p>`,
      '  <ol class="market-insight-checklist">',
      (users.length > 0 ? users : ['主要銘柄から取引所の違いを比較したい人']).map(item => `<li><span class="exchange-risk-card__icon" aria-hidden="true">OK</span>${xmlEscape(item)}</li>`).join('\n'),
      '  </ol>',
      '</article>',
      '<article class="market-insight-card market-insight-card--summary exchange-risk-card exchange-risk-card--caution">',
      '  <div class="market-insight-card__header">',
      '    <div>',
      '      <p class="market-insight-card__eyebrow">Risk</p>',
      '      <h3 class="market-insight-card__title">注意点・リスク</h3>',
      '    </div>',
      '    <span class="market-insight-card__badge">注意</span>',
      '  </div>',
      '  <p class="market-insight-card__lead">取扱銘柄、手数料、入出金条件は変更される場合があります。申込や注文の前には、必ず公式サイトで最新情報を確認してください。</p>',
      '  <ol class="market-insight-checklist">',
      (cautions.length > 0 ? cautions : ['申込前に公式条件と注文画面を確認しましょう。']).map(item => `<li><span class="exchange-risk-card__icon" aria-hidden="true">!</span>${xmlEscape(item)}</li>`).join('\n'),
      '  </ol>',
      '</article>',
    ].join('\n');
  }

  function renderExchangeJourneyLinks(exchange) {
    const links = [
      {
        eyebrow: 'Simulator',
        title: `${exchange.label} で取引コスト計算を開く`,
        description: `${exchange.defaultMarket.label} を、この取引所を選んだ状態で比較に戻せます。`,
        href: queryPath('/simulator', { exchange: exchange.id, market: exchange.defaultMarket.instrumentId }),
      },
      {
        eyebrow: 'Market',
        title: `${exchange.defaultMarket.label} の銘柄深掘りを見る`,
        description: '代表銘柄を起点に、板・出来高・販売所スプレッドを続けて確認できます。',
        href: marketPath(exchange.defaultMarket.instrumentId),
      },
      {
        eyebrow: 'Finance',
        title: `${exchange.label} の財務情報を見る`,
        description: 'この取引所詳細ページ内の運営会社・財務情報セクションへ移動します。',
        href: '#exchange-research',
      },
      {
        eyebrow: 'Markets',
        title: '銘柄深掘り一覧を見る',
        description: '主要銘柄からニッチ銘柄まで、用途、板、出来高、販売所スプレッドを銘柄ごとに確認できます。',
        href: '/markets',
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

  function exchangeMarketPairForApi(exchange) {
    const instrumentId = exchange.defaultMarket && exchange.defaultMarket.instrumentId
      ? exchange.defaultMarket.instrumentId
      : 'BTC-JPY';
    return instrumentId.toLowerCase().replace('-', '_');
  }

  function exchangeApiSourceLinks(exchange) {
    if (exchange.id === 'coincheck') {
      const pair = exchangeMarketPairForApi(exchange);
      return [
        {
          title: 'Coincheck Public API docs',
          href: 'https://coincheck.com/documents/exchange/api',
          meta: '公式ドキュメント',
        },
        {
          title: 'Order Book endpoint',
          href: `https://coincheck.com/api/order_books?pair=${encodeURIComponent(pair)}`,
          meta: '公式API JSON',
        },
        {
          title: 'Ticker endpoint',
          href: `https://coincheck.com/api/ticker?pair=${encodeURIComponent(pair)}`,
          meta: '公式API JSON',
        },
      ];
    }

    return [
      {
        title: 'データ取得元と免責',
        href: '/about#data-sources',
        meta: '本サイトの説明',
      },
    ];
  }

  function renderExchangeSourceVerifier(exchange) {
    const links = exchangeApiSourceLinks(exchange);
    return [
      '<div class="exchange-source-verifier" data-exchange-source-verifier>',
      '  <div class="exchange-source-verifier__header">',
      '    <div>',
      '      <strong>データソースを確認</strong>',
      `      <span>${xmlEscape(exchange.defaultMarket.label || exchange.defaultMarket.instrumentId)} の板・気配値をページ内APIで照合できます。</span>`,
      '    </div>',
      '    <button class="btn btn-ghost" type="button" data-exchange-raw-toggle>生データを見る</button>',
      '  </div>',
      '  <div class="exchange-source-metadata exchange-beginner-advanced" aria-label="取得メタデータ">',
      '    <div><span>Data source</span><strong data-exchange-meta-field="source">確認中</strong></div>',
      '    <div><span>Data age</span><strong data-exchange-meta-field="dataAge">-</strong></div>',
      '    <div><span>Page API</span><strong data-exchange-meta-field="pageApi">-</strong></div>',
      '  </div>',
      '  <div class="exchange-source-verifier__links">',
      links.map(link => (
        `    <a href="${xmlEscape(link.href)}" target="_blank" rel="noopener noreferrer"><span>${xmlEscape(link.title)}</span><small>${xmlEscape(link.meta)}</small></a>`
      )).join('\n'),
      `    <code>/api/markets/${xmlEscape(exchange.defaultMarket.instrumentId)}</code>`,
      '  </div>',
      '  <pre class="exchange-source-verifier__raw" data-exchange-raw-viewer hidden>JSONを読み込みます。</pre>',
      '</div>',
    ].join('\n');
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
    const serviceDescription = exchange.id === 'bitflyer'
      ? 'bitFlyerでは、販売所、取引所形式、Lightning、Crypto CFDなど複数のサービスがあります。使う画面によってコストや注文条件が変わるため、事前に確認しておきましょう。'
      : fallbackText(
        exchange.pageContent.serviceDescription,
        `${exchange.label}では、販売所、取引所形式、積立など複数のサービスを確認できます。使う画面によってコストや注文条件が変わるため、事前に確認しておきましょう。`
      );
    const dataSourceDescription = fallbackText(
      exchange.pageContent.dataSourceDescription,
      `${exchange.dataSourceLabel || '公開API / WebSocket'} をもとに、本サイトで板・出来高・販売所スプレッドの参考データを集計しています。発注前は公式画面の価格と条件を優先してください。`
    );
    const cards = [
      {
        title: '会社・登録情報',
        description: '口座開設前に、サービス名、運営会社、登録番号、設立年、親会社を確認できます。',
        badge: 'Company',
        details: [
          { label: '会社名', value: companyName },
          { label: 'サービス名', value: serviceName },
          { label: '登録番号', value: registrationNumber },
          { label: '設立年', value: foundedYear },
          { label: '親会社', value: parentCompany },
        ],
      },
      {
        title: '取扱サービス',
        description: serviceDescription,
        badge: 'Service',
        details: [
          { label: '取扱サービス', value: formatExchangeServices(profile) },
          { label: '現物取引', value: fallbackText(features.spotTrading, '公式確認') },
          { label: 'レバレッジ取引', value: fallbackText(features.leverageTrading, '公式確認') },
          { label: '販売所', value: salesDesk },
          { label: '取引所', value: exchangeFormat },
          { label: '積立', value: fallbackText(features.recurring, '公式確認') },
        ],
      },
      {
        title: 'データ取得の前提',
        description: dataSourceDescription,
        badge: 'Data',
        disclosureSummary: '取得元を検証する',
        disclosureHtml: renderExchangeSourceVerifier(exchange),
      },
    ];

    return renderExchangeDefinitionCards(cards);
  }

  function renderExchangeFundingCards(exchange) {
    const features = exchangePageFeatures(exchange);
    const costs = exchangePageCosts(exchange);
    const cards = [
      {
        title: '対応状況',
        description: `${fundingSummaryLabel(exchange.funding)}。メンテナンスや金融機関、銘柄ごとの停止状況で利用条件が変わる場合があります。`,
        badge: 'Status',
        details: [
          { label: '入出金対応', value: fallbackText(features.depositsWithdrawals || (exchange.funding && exchange.funding.summary), '公式条件確認') },
        ],
      },
      {
        title: '日本円の入金',
        description: fallbackText(costs.depositFee, '入金方式・銀行ごとの公式条件を確認してください。'),
        badge: 'Deposit',
      },
      {
        title: '日本円の出金',
        description: fallbackText(costs.withdrawalFee, '日本円出金手数料は公式手数料表で確認してください。'),
        badge: 'JPY',
      },
      {
        title: '暗号資産の送金',
        description: `${fallbackText(costs.cryptoTransferFee, '銘柄・ネットワークごとの公式手数料表で確認してください。')} 送金前には、宛先ネットワーク、最小送金数量、停止情報を公式画面で確認しておきましょう。`,
        badge: 'Crypto',
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
      '通常時の手数料とスプレッドが、自分の利用頻度や注文金額に対して許容できる',
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
        lead: `${exchange.label} を長く使う候補にする場合は、通常時の使いやすさ、流動性、出金条件を優先して見ます。`,
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

  function renderExchangeCoverageFallbackItem(exchange, market) {
    const href = market.hasBoard
      ? queryPath('/simulator', { exchange: exchange.id, market: market.instrumentId })
      : queryPath('/sales-spread', { instrumentId: market.instrumentId });
    const badges = [
      market.hasBoard ? '<span>板</span>' : '',
      market.hasSales ? '<span>販売所</span>' : '',
      market.hasSales ? '<span>スプレッド</span>' : '',
    ].filter(Boolean).join('');

    return [
      `<a class="exchange-coverage-chip" href="${xmlEscape(href)}">`,
      `  ${renderAssetMark(market, 'market-asset-mark--xs')}`,
      '  <span class="exchange-coverage-chip__body">',
      `    <strong>${xmlEscape(market.label || market.instrumentId)}</strong>`,
      `    <small>${xmlEscape(market.instrumentId)}</small>`,
      `    <span class="exchange-coverage-chip__badges">${badges}</span>`,
      '  </span>',
      '</a>',
    ].join('\n');
  }

  function renderExchangeCoverageCards(exchange) {
    const featuredIds = ['BTC-JPY', 'ETH-JPY', 'XRP-JPY', 'XLM-JPY', 'MONA-JPY'];
    const coverageById = new Map((exchange.coverage || []).map(market => [market.instrumentId, market]));
    const featuredMarkets = featuredIds.map(id => coverageById.get(id)).filter(Boolean);
    const mainMarkets = featuredMarkets.length > 0 ? featuredMarkets : (exchange.coverage || []).slice(0, 5);
    const boardDescription = '板取引対応銘柄は、板の厚みや約定コストの比較につながりやすい銘柄です。BTC/JPY、ETH/JPY、XRP/JPYなど、使う予定の銘柄から確認できます。';
    const featuredSet = new Set(mainMarkets.map(market => market.instrumentId));
    const tagDefinitions = [
      { key: 'major3', label: '主要3銘柄' },
      { key: 'staking', label: 'ステーキング対象' },
      { key: 'l1l2', label: 'L1/L2' },
      { key: 'meme', label: 'ミームコイン' },
    ];
    const major3 = new Set(['BTC', 'ETH', 'XRP']);
    const staking = new Set(['ETH', 'SOL', 'DOT', 'ADA', 'ATOM', 'XTZ', 'MATIC', 'POL']);
    const l1l2 = new Set(['BTC', 'ETH', 'XRP', 'SOL', 'AVAX', 'ADA', 'DOT', 'MATIC', 'POL', 'ARB', 'OP', 'ASTR', 'APT', 'SUI', 'XLM']);
    const meme = new Set(['DOGE', 'SHIB', 'PEPE', 'MONA']);
    function coverageTagsForMarket(market) {
      const symbol = String(market.baseCurrency || (market.instrumentId || '').split('-')[0] || '').toUpperCase();
      return [
        major3.has(symbol) ? 'major3' : '',
        staking.has(symbol) ? 'staking' : '',
        l1l2.has(symbol) ? 'l1l2' : '',
        meme.has(symbol) ? 'meme' : '',
      ].filter(Boolean);
    }
    const coverageData = (exchange.coverage || []).map(market => ({
      instrumentId: market.instrumentId,
      label: market.label || market.instrumentId,
      hasBoard: Boolean(market.hasBoard),
      hasSales: Boolean(market.hasSales),
      hasSpread: Boolean(market.hasSales),
      featured: featuredSet.has(market.instrumentId),
      baseCurrency: market.baseCurrency || String(market.instrumentId || '').split('-')[0] || '',
      tags: coverageTagsForMarket(market),
      href: market.hasBoard
        ? queryPath('/simulator', { exchange: exchange.id, market: market.instrumentId })
        : queryPath('/sales-spread', { instrumentId: market.instrumentId }),
    }));

    const coverageOverview = [
      '<article class="market-definition-card exchange-coverage-overview">',
      '  <div class="flex items-start justify-between gap-3">',
      '    <div>',
      '      <h3 class="market-definition-card__term">主な取扱銘柄</h3>',
      '      <p class="market-definition-card__description">まずは主要銘柄と対応形式を見て、自分が使う銘柄が販売所・板取引のどちらで扱われるかを確認しておきましょう。</p>',
      '    </div>',
      `    <span class="badge">${xmlEscape(`${formatCount(exchange.coverage.length)}件`)}</span>`,
      '  </div>',
      renderExchangeDetailList([
        { label: '取扱銘柄数', value: `${formatCount(exchange.coverage.length)}件` },
        { label: '板取引対応', value: `${formatCount(exchange.boardMarkets.length)}件` },
        { label: '販売所対応', value: `${formatCount(exchange.salesMarkets.length)}件` },
      ]),
      '</article>',
    ].join('\n');

    const coverageTool = [
      '<article class="market-definition-card exchange-coverage-tool" data-exchange-coverage-tool>',
      '  <div class="flex items-start justify-between gap-3">',
      '    <div>',
      '      <h3 class="market-definition-card__term">銘柄検索・対応形式フィルタ</h3>',
      '      <p class="market-definition-card__description">主要銘柄から、板取引対応と販売所対応をすばやく確認できます。</p>',
      '    </div>',
      `    <span class="badge">${xmlEscape(`${formatCount(exchange.coverage.length)}件`)}</span>`,
      '  </div>',
      '  <div class="exchange-coverage-tool__controls">',
      '    <label class="exchange-coverage-search">',
      '      <span>銘柄検索</span>',
      '      <input class="field" type="search" data-exchange-coverage-search placeholder="BTC、ETH、XRP..." autocomplete="off">',
      '    </label>',
      '    <div class="tab-group exchange-coverage-filters" aria-label="対応形式フィルタ">',
      '      <button class="btn-tab" type="button" data-exchange-coverage-filter="board" aria-pressed="false">板取引対応</button>',
      '      <button class="btn-tab" type="button" data-exchange-coverage-filter="sales" aria-pressed="false">販売所対応</button>',
      '      <button class="btn-tab" type="button" data-exchange-coverage-filter="spread" aria-pressed="false">スプレッド取得あり</button>',
      '    </div>',
      '    <div class="exchange-coverage-smart-tags" aria-label="スマートタグ">',
      tagDefinitions.map(tag => (
        `      <button type="button" data-exchange-coverage-tag="${xmlEscape(tag.key)}" aria-pressed="false">${xmlEscape(tag.label)}</button>`
      )).join('\n'),
      '    </div>',
      '  </div>',
      `  <p class="exchange-coverage-result-meta" data-exchange-coverage-count>主要${xmlEscape(String(mainMarkets.length))}銘柄を表示中 / 全${xmlEscape(String(exchange.coverage.length))}件</p>`,
      '  <div class="exchange-coverage-result-grid" data-exchange-coverage-results>',
      mainMarkets.map(market => renderExchangeCoverageFallbackItem(exchange, market)).join('\n'),
      '  </div>',
      '  <div class="exchange-coverage-detail" data-exchange-coverage-detail hidden></div>',
      '  <button class="btn btn-ghost exchange-coverage-show-all" type="button" data-exchange-coverage-show-all>全銘柄を表示</button>',
      `  <script type="application/json" id="exchange-coverage-data">${safeJsonForHtml(coverageData)}</script>`,
      '</article>',
    ].join('\n');

    const boardCard = [
      '<article class="market-definition-card">',
      '  <div class="flex items-start justify-between gap-3">',
      '    <div>',
      '      <h3 class="market-definition-card__term">板取引対応銘柄</h3>',
      `      <p class="market-definition-card__description">${xmlEscape(boardDescription)}</p>`,
      '    </div>',
      `    <span class="badge">${xmlEscape(`${formatCount(exchange.boardMarkets.length)}件`)}</span>`,
      '  </div>',
      renderExchangeMarketPills(exchange.boardMarkets, {
        emptyMessage: '板取引対応銘柄を準備中です。',
      }),
      '</article>',
    ].join('\n');

    return [
      coverageOverview,
      coverageTool,
      boardCard,
      renderExchangeInlineCta(exchange, {
        eyebrow: 'Coverage Check',
        title: `${exchange.label} で使う銘柄の対応形式を公式で確認`,
        body: '板取引、販売所、入出庫対応は銘柄ごとに変わる場合があります。使う予定の銘柄は公式画面でも確認してください。',
        cta: '取扱銘柄を確認',
        tone: 'coverage',
      }),
    ].join('\n');
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
      '  <p class="market-insight-card__lead">取扱銘柄、注文条件、本人確認などの公式条件は変更されることがあります。</p>',
      '  <ol class="market-insight-checklist">',
      (cautions.length > 0 ? cautions : ['申込前に公式条件と注文画面を確認しましょう。']).map(item => `<li>${xmlEscape(item)}</li>`).join('\n'),
      '  </ol>',
      '</article>',
    ].join('\n');
  }

  function renderExchangeCampaignCards(exchange) {
    const cards = [
      {
        eyebrow: 'Official',
        title: '公式サイトで最新条件を確認する',
        description: `${exchange.campaignLabel}。手数料、本人確認、対象サービス、注意事項は申込前に公式情報を確認してください。`,
        href: exchange.campaignUrl || exchange.officialUrl || '/',
        cta: '公式で確認',
      },
      {
        eyebrow: 'Market',
        title: `${exchange.defaultMarket.label} の銘柄深掘りを見る`,
        description: '代表銘柄の用途、板、出来高、販売所スプレッドを続けて確認できます。',
        href: marketPath(exchange.defaultMarket.instrumentId),
        cta: '銘柄を見る',
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

  function linkAttrsForExchangeAction(link) {
    const href = link && link.href ? link.href : '/';
    const isExternal = /^https?:\/\//i.test(href);
    const target = Object.prototype.hasOwnProperty.call(link || {}, 'target')
      ? link.target
      : (isExternal ? '_blank' : null);
    const rel = link && link.rel
      ? link.rel
      : (isExternal ? 'noopener noreferrer' : null);
    const referrerPolicy = link && link.referrerPolicy ? link.referrerPolicy : null;
    return [
      `href="${xmlEscape(href)}"`,
      target ? `target="${xmlEscape(target)}"` : '',
      rel ? `rel="${xmlEscape(rel)}"` : '',
      referrerPolicy ? `referrerpolicy="${xmlEscape(referrerPolicy)}"` : '',
    ].filter(Boolean).join(' ');
  }

  function renderExchangeMobileActions(exchange) {
    const ctaLink = exchange.referralUrl
      ? {
        href: exchange.referralUrl,
        target: exchange.referralTarget === null ? null : (exchange.referralTarget || '_blank'),
        rel: exchange.referralRel || 'sponsored noopener noreferrer',
        referrerPolicy: exchange.referralReferrerPolicy || null,
      }
      : {
        href: exchange.signupUrl || exchange.officialUrl || '/',
        target: exchange.signupUrl || exchange.officialUrl ? '_blank' : null,
        rel: exchange.signupUrl || exchange.officialUrl ? 'noopener noreferrer' : null,
      };
    const officialLink = {
      href: exchange.officialUrl || '/',
      target: exchange.officialUrl ? '_blank' : null,
      rel: exchange.officialUrl ? 'noopener noreferrer' : null,
    };
    return [
      '<nav class="exchange-mobile-tabbar" aria-label="モバイル固定ナビ">',
      '  <a href="#exchange-fees"><span aria-hidden="true"></span><strong>コスト</strong></a>',
      '  <a href="#exchange-liquidity"><span aria-hidden="true"></span><strong>板情報</strong></a>',
      '  <a href="#exchange-coverage"><span aria-hidden="true"></span><strong>銘柄</strong></a>',
      `  <a ${linkAttrsForExchangeAction(officialLink)}><span aria-hidden="true"></span><strong>公式</strong></a>`,
      '</nav>',
      '<div class="exchange-floating-cta" data-exchange-floating-cta>',
      `  <a ${linkAttrsForExchangeAction(ctaLink)}>公式サイトで最新条件を確認${exchange.referralTrackingPixelUrl ? `<img src="${xmlEscape(exchange.referralTrackingPixelUrl)}" width="1" height="1" border="0" alt="">` : ''}</a>`,
      '</div>',
    ].join('\n');
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
        description: exchange.referralCode
          ? '招待コードはリンクに適用済みです。紹介特典や適用条件を確認できます。'
          : '紹介特典や適用条件を確認できます。申込前に最新条件を確認してください。',
        href: exchange.referralUrl,
        target: exchange.referralTarget === null ? null : (exchange.referralTarget || '_blank'),
        rel: exchange.referralRel || 'sponsored noopener noreferrer',
        referrerPolicy: exchange.referralReferrerPolicy || null,
        trackingPixelUrl: exchange.referralTrackingPixelUrl || null,
        cta: '紹介条件を見る',
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

    return renderCampaignContextCards(cards);
  }

  function renderExchangeRelatedLinks(exchange, aboutArticle) {
    const defaultMarketLabel = exchange.defaultMarket.label || exchange.defaultMarket.instrumentId;
    const groups = [
      {
        title: '次に見るべきページ',
        links: [
          {
            eyebrow: 'Cost',
            title: '10万円買いの実質コスト',
            description: '販売所スプレッドと取引所形式の価格影響を同じ金額で比較できます。',
            href: queryPath('/simulator', { exchange: exchange.id, market: exchange.defaultMarket.instrumentId, side: 'buy', amountType: 'jpy', amount: 100000 }),
            cta: '見る',
          },
          {
            eyebrow: 'Board',
            title: `${defaultMarketLabel}の板`,
            description: 'Bid / Ask、可視板厚、スリッページ傾向から板取引の使いやすさを判断できます。',
            href: queryPath('/simulator', { exchange: exchange.id, market: exchange.defaultMarket.instrumentId }),
            cta: '見る',
          },
          {
            eyebrow: 'Spread',
            title: '販売所スプレッドを見る',
            description: '販売所で買う場合の買値・売値差を取引所別に比較できます。',
            href: queryPath('/sales-spread', { instrumentId: exchange.defaultMarket.instrumentId }),
            cta: '見る',
          },
        ],
      },
      {
        title: '詳しく知る',
        links: [
          {
            eyebrow: 'Learn',
            title: '販売所と取引所の違い',
            description: '注文方式ごとの価格、手数料、スプレッドの違いを確認できます。',
            href: '/learn/exchange-vs-broker',
            cta: '読む',
          },
          {
            eyebrow: 'Learn',
            title: 'スプレッドとは',
            description: '販売所を使う前に見ておきたい実質コストの考え方です。',
            href: '/learn/spread',
            cta: '読む',
          },
          {
            eyebrow: 'Learn',
            title: '板取引とは',
            description: '板の厚み、最良気配、スリッページの基本を確認できます。',
            href: '/learn/order-book-trading',
            cta: '読む',
          },
        ],
      },
      {
        title: '申込前に確認',
        links: [
          {
            eyebrow: 'Official',
            title: '公式サイトの最新条件',
            description: '口座開設、手数料、入出金、対象サービスの一次情報を確認できます。',
            href: exchange.officialUrl || '/',
            cta: '公式へ',
          },
          {
            eyebrow: 'Official',
            title: '公式サイトの最新条件',
            description: `${exchange.campaignLabel}。手数料、本人確認、対象サービス、注意事項を申込前に公式情報で見直してください。`,
            href: exchange.campaignUrl || exchange.officialUrl || '/',
            cta: '公式で確認',
          },
        ].concat(exchange.referralUrl ? [{
          eyebrow: 'PR',
          title: '紹介リンク',
          description: exchange.referralCode
            ? '招待コードはリンクに適用済みです。紹介特典や適用条件を確認できます。'
            : '紹介特典や適用条件を確認できます。申込前に最新条件を確認してください。',
          href: exchange.referralUrl,
          cta: '紹介条件を見る',
          target: exchange.referralTarget === null ? null : (exchange.referralTarget || '_blank'),
          rel: exchange.referralRel || 'sponsored noopener noreferrer',
          referrerPolicy: exchange.referralReferrerPolicy || null,
          trackingPixelUrl: exchange.referralTrackingPixelUrl || null,
        }] : []).concat(aboutArticle ? [{
          eyebrow: '確認事項',
          title: aboutArticle.title,
          description: 'データ取得、免責、PR表記の前提を確認できます。',
          href: aboutArticle.path,
          cta: '読む',
        }] : []),
      },
    ];

    function renderRelatedLink(link) {
      const isExternal = /^https?:\/\//i.test(link.href || '');
      const targetAttr = Object.prototype.hasOwnProperty.call(link, 'target')
        ? (link.target ? ` target="${xmlEscape(link.target)}"` : '')
        : (isExternal ? ' target="_blank"' : '');
      const relAttr = link.rel
        ? ` rel="${xmlEscape(link.rel)}"`
        : (isExternal ? ' rel="noopener noreferrer"' : '');
      const referrerPolicyAttr = link.referrerPolicy
        ? ` referrerpolicy="${xmlEscape(link.referrerPolicy)}"`
        : '';
      const externalAttrs = isExternal
        ? `${targetAttr}${relAttr}${referrerPolicyAttr}`
        : '';
      return [
        `<a class="market-context-card" href="${xmlEscape(link.href)}"${externalAttrs}>`,
        `  <span class="market-context-card__eyebrow">${xmlEscape(link.eyebrow)}</span>`,
        `  <strong class="market-context-card__title">${xmlEscape(link.title)}</strong>`,
        `  <span class="market-context-card__description">${xmlEscape(link.description)}</span>`,
        `  <span class="market-context-card__cta">${xmlEscape(link.cta)}${link.trackingPixelUrl ? `<img src="${xmlEscape(link.trackingPixelUrl)}" width="1" height="1" border="0" alt="">` : ''}</span>`,
        '</a>',
      ].join('\n');
    }

    return groups.map((group) => [
        '<section class="exchange-related-group">',
        `  <h3 class="exchange-related-group__title">${xmlEscape(group.title)}</h3>`,
        '  <div class="market-context-grid market-context-grid--links">',
        group.links.map(renderRelatedLink).join('\n'),
        '  </div>',
      '</section>',
    ].join('\n')).join('\n');
  }

  function renderExchangeFaqCards(exchange) {
    const defaultMarketLabel = exchange.defaultMarket.label || exchange.defaultMarket.instrumentId;
    const faqs = [
      {
        question: `${exchange.label}で最初に見るコストは何ですか？`,
        answer: '販売所を使うならスプレッド、取引所形式を使うならtaker手数料、板スプレッド、スリッページを合わせた実質コストです。10万円買いの比較から入ると、画面ごとの差を判断しやすくなります。',
      },
      {
        question: `${defaultMarketLabel}は板取引で見られますか？`,
        answer: `${exchange.label}の${defaultMarketLabel}は、このサイトでは板取引対応銘柄として扱っています。注文前には公式画面で現在のBid / Ask、板の厚み、最小注文数量を見直してください。`,
      },
      {
        question: '取扱銘柄が多いときは何から絞ればよいですか？',
        answer: 'まず主要銘柄だけを見て、次に検索とフィルタで「板取引対応」「販売所対応」「スプレッド取得あり」を分けると、自分が使う銘柄の注文方式を短時間で把握できます。',
      },
      {
        question: '財務情報はどう使えばよいですか？',
        answer: '登録番号、運営会社、親会社、純資産、利益、開示資料の有無を並べて、公開資料で確認できる範囲を把握するための材料です。安全性や将来の業績を保証するものではありません。',
      },
      {
        question: 'このページの数値だけで申し込んでもよいですか？',
        answer: 'いいえ。表示データは参考値です。申込や注文の前には、公式サイトの手数料、入出金、取引条件、リスク説明を確認し、ご自身の責任で判断してください。',
      },
    ];

    return [
      '<div class="exchange-faq-list">',
      faqs.map((faq, index) => [
        '<details class="market-definition-card exchange-disclosure-card exchange-faq-item">',
        '  <summary class="exchange-disclosure-card__summary">',
        '    <div>',
        `      <h3 class="market-definition-card__term">${xmlEscape(faq.question)}</h3>`,
        `      <span class="market-definition-card__description">FAQ ${xmlEscape(String(index + 1))}</span>`,
        '    </div>',
        '  </summary>',
        `  <p class="market-definition-card__description">${xmlEscape(faq.answer)}</p>`,
        '</details>',
      ].join('\n')).join('\n'),
      '</div>',
    ].join('\n');
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
    const title = `${pageExchange.label} 手数料・スプレッド・取扱銘柄・板取引｜${SITE_NAME}`;
    const description = `${pageExchange.label} の手数料、販売所スプレッド、10万円買いの実質コスト、取扱銘柄、${pageExchange.defaultMarket.label || 'BTC/JPY'}の板取引、運営会社・信頼性を比較できます。`;

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
      .replace('<!-- EXCHANGE_CHECK_ORDER -->', renderExchangeCheckOrder(pageExchange))
      .replace('<!-- EXCHANGE_TABS -->', renderExchangeTabs(pageExchange))
      .replace('<!-- EXCHANGE_STICKY_LIVE_COST -->', renderExchangeCostSimulator(pageExchange, {
        variant: 'rail',
        eyebrow: 'Live Cost',
        title: '金額を変えて概算コストを見る',
        status: '自動計算',
        showModeComparison: false,
        showProTable: false,
        officialLabel: '公式条件を確認',
      }))
      .replace('<!-- EXCHANGE_COST_SIMULATOR -->', renderExchangeCostSimulator(pageExchange))
      .replace('<!-- EXCHANGE_OVERVIEW_CARDS -->', renderExchangeOverviewCards(pageExchange))
      .replace('<!-- EXCHANGE_FEE_SPREAD_CARDS -->', renderExchangeFeeSpreadCards(pageExchange))
      .replace('<!-- EXCHANGE_FUNDING_CARDS -->', renderExchangeFundingCards(pageExchange))
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
      .replace('<!-- EXCHANGE_FAQ_CARDS -->', renderExchangeFaqCards(pageExchange))
      .replace('<!-- EXCHANGE_MARKET_LINKS -->', renderExchangeMarketLinks(pageExchange, aboutArticle))
      .replace('<!-- EXCHANGE_MOBILE_ACTIONS -->', renderExchangeMobileActions(pageExchange)), { activeSection: 'exchanges', activePath: exchangePath(pageExchange.id) });
  }

  return {
    buildMarketIndexModel,
    buildRssXml,
    buildSitemapXml,
    getArticleBySlug,
    getLearnArticleBySlug,
    getExchangeInfo,
    getMarketInfo,
    exchangePath,
    marketPath,
    normalizeExchangeId,
    normalizeMarketInstrumentId,
    renderArticlesIndexHtml,
    renderArticleHtml,
    renderExchangeHtml,
    renderExchangesIndexHtml,
    renderFinancialComparisonHtml,
    renderLearnIndexHtml,
    renderMarketHtml,
    renderMarketsIndexHtml,
    renderPublicPage,
    renderResearchHtml,
    renderStaticPublicPage,
    renderVolumeShareHtml,
    requestOrigin,
    setMarketPageSnapshotLoader(loader) {
      marketPageSnapshotLoader = typeof loader === 'function' ? loader : null;
    },
  };
}

module.exports = {
  createSiteContentService,
};
