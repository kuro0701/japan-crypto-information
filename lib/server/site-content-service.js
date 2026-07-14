Warning: truncated output (original token count: 88694)
Total output lines: 7519

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
        { label: 'テザー（USDT）', href: '/articles/usdt' },
        { label: 'BNB', href: '/articles/bnb' },
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
          '現物BTC/JPYとは別市場なので、同じ価格で約定するとは限りません。…38694 tokens truncated… '  </div>',
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
