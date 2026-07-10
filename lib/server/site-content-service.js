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
        { label: 'イーサリアム（ETH）', href: '/articles/eth' },
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
        label: row.instrumentLabel || marketLabel(row.instrumen