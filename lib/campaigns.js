function readOptionalEnv(name, fallback = null) {
  const value = String(process.env[name] || '').trim();
  return value || fallback || null;
}

const BITFLYER_REFERRAL_CODE = 'ml1wjtkl';
const BITFLYER_REFERRAL_URL = 'https://bitflyer.com/invitation?id=ml1wjtkl&lang=ja-JP';
const OKJ_REFERRAL_CODE = 'C250678';
const OKJ_REFERRAL_URL = 'https://www.okcoin.jp/account/join?invitation=C250678&type=0';
const BINANCE_JAPAN_REFERRAL_CODE = 'GRO_55250_0VBAH';
const BINANCE_JAPAN_REFERRAL_URL = 'https://s.binance.com/OKkHnAGC?ref=GRO_55250_0VBAH';
const BITTRADE_REFERRAL_CODE = 'tHc3p';
const BITTRADE_REFERRAL_URL = 'https://www.bittrade.co.jp/ja-jp/register/?invite_code=tHc3p';
const GMO_COIN_AFFILIATE_URL = 'https://h.accesstrade.net/sp/cc?rk=0100mtgp00osx0';
const GMO_COIN_TRACKING_PIXEL_URL = 'https://h.accesstrade.net/sp/rr?rk=0100mtgp00osx0';
const COINCHECK_AFFILIATE_URL = 'https://h.accesstrade.net/sp/cc?rk=0100nerr00osx0';
const COINCHECK_TRACKING_PIXEL_URL = 'https://h.accesstrade.net/sp/rr?rk=0100nerr00osx0';

const CAMPAIGNS = Object.freeze([
  {
    id: 'gmo-coin-campaigns',
    slug: 'gmo-coin',
    exchangeId: 'gmo',
    exchangeName: 'GMOコイン',
    campaignName: '口座開設・取引キャンペーン確認',
    benefit: '最大特典額は公式キャンペーンページで確認',
    audience: '新規口座開設者 / 既存ユーザー（案件ごと）',
    conditions: '新規口座開設、エントリー、対象サービスの取引など。案件ごとに異なります。',
    period: 'キャンペーンごとに異なる',
    officialUrl: 'https://coin.z.com/jp/corp/about/campaign/',
    affiliateEnvKey: 'GMO_COIN_REFERRAL_URL',
    defaultAffiliateUrl: GMO_COIN_AFFILIATE_URL,
    affiliateRel: 'nofollow',
    affiliateReferrerPolicy: 'no-referrer-when-downgrade',
    affiliateTarget: null,
    trackingPixelUrl: GMO_COIN_TRACKING_PIXEL_URL,
    lastChecked: '公式確認待ち',
    notes: [
      '暗号資産以外のサービス向けキャンペーンが混在する場合があります。',
      '終了日時、対象取引、エントリー要否を申込前に確認してください。',
    ],
  },
  {
    id: 'coincheck-campaigns',
    slug: 'coincheck',
    exchangeId: 'coincheck',
    exchangeName: 'Coincheck',
    campaignName: '公式キャンペーン・紹介プログラム確認',
    benefit: '特典額は公式サイトまたはアプリ内表示で確認',
    audience: '新規口座開設者 / 紹介経由の申込者（案件ごと）',
    conditions: '本人確認完了、入金、対象取引など。紹介制度は専用条件を確認してください。',
    period: '案件ごとに異なる',
    officialUrl: 'https://coincheck.com/',
    affiliateEnvKey: 'COINCHECK_REFERRAL_URL',
    defaultAffiliateUrl: COINCHECK_AFFILIATE_URL,
    affiliateRel: 'nofollow',
    affiliateReferrerPolicy: 'no-referrer-when-downgrade',
    affiliateTarget: null,
    trackingPixelUrl: COINCHECK_TRACKING_PIXEL_URL,
    lastChecked: '公式確認待ち',
    notes: [
      'アプリ内限定やログイン後表示の条件がある場合があります。',
      '販売所と取引所では対象取引が異なる可能性があります。',
    ],
  },
  {
    id: 'bitflyer-campaigns',
    slug: 'bitflyer',
    exchangeId: 'bitflyer',
    exchangeName: 'bitFlyer',
    campaignName: 'サービス・キャンペーン確認',
    benefit: '招待した方と、招待された方に 1,500 円分のビットコインをプレゼント！',
    audience: '新規口座開設者 / 既存ユーザー（案件ごと）',
    conditions: '口座開設、Lightning 取引、定期購入、紹介など。案件ごとに異なります。',
    period: '案件ごとに異なる',
    officialUrl: 'https://bitflyer.com/ja-jp/s/service',
    affiliateEnvKey: 'BITFLYER_REFERRAL_URL',
    defaultAffiliateUrl: BITFLYER_REFERRAL_URL,
    referralCode: BITFLYER_REFERRAL_CODE,
    referralSummary: '招待した方と、招待された方に 1,500 円分のビットコインをプレゼント！',
    referrerBenefit: '1,500円分のビットコイン',
    inviteeBenefit: '1,500円分のビットコイン',
    referralTrigger: '招待URL経由の口座開設など。詳細条件は公式ページで確認してください。',
    referralSourceUrl: 'https://bitflyer.com/ja-jp/faq/referral',
    lastChecked: '公式確認待ち',
    notes: [
      '販売所、Lightning、周辺サービスで条件が分かれる場合があります。',
      '紹介特典は対象者や上限、禁止事項を確認してください。',
      `招待コード: ${BITFLYER_REFERRAL_CODE}`,
    ],
  },
  {
    id: 'bitbank-campaigns',
    slug: 'bitbank',
    exchangeId: 'bitbank',
    exchangeName: 'bitbank',
    campaignName: 'キャンペーン当選金・プレゼント確認',
    benefit: '特典額・受取方法は公式サポートで確認',
    audience: 'キャンペーン対象者 / 条件達成ユーザー',
    conditions: 'キャンペーンごとの達成条件、受取方法、対象期間を確認してください。',
    period: '案件ごとに異なる',
    officialUrl: 'https://support.bitbank.cc/hc/ja/articles/22834304372505-%E5%90%84%E3%82%AD%E3%83%A3%E3%83%B3%E3%83%9A%E3%83%BC%E3%83%B3%E5%BD%93%E9%81%B8%E9%87%91-%E3%83%97%E3%83%AC%E3%82%BC%E3%83%B3%E3%83%88-%E3%81%AE%E5%8F%97%E5%8F%96%E6%96%B9%E6%B3%95%E3%81%AB%E3%81%A4%E3%81%84%E3%81%A6',
    affiliateEnvKey: 'BITBANK_REFERRAL_URL',
    lastChecked: '公式確認待ち',
    notes: [
      '常設の確認方法と個別キャンペーン条件は分けて確認してください。',
      '付与時期や受取方法がログイン後画面に依存する場合があります。',
    ],
  },
  {
    id: 'okj-campaigns',
    slug: 'okj',
    exchangeId: 'okj',
    exchangeName: 'OKJ',
    campaignName: 'キャンペーン・お知らせ確認',
    benefit: '特典内容は公式サポート・お知らせで確認',
    audience: '新規口座開設者 / 既存ユーザー（案件ごと）',
    conditions: '対象サービス、対象銘柄、取引数量、エントリー要否を確認してください。',
    period: '案件ごとに異なる',
    officialUrl: 'https://support.okcoin.jp/hc/ja',
    affiliateEnvKey: 'OKJ_REFERRAL_URL',
    defaultAffiliateUrl: OKJ_REFERRAL_URL,
    referralCode: OKJ_REFERRAL_CODE,
    referralTrigger: '招待リンク経由の口座開設など。詳細条件は公式画面で確認してください。',
    lastChecked: '公式確認待ち',
    notes: [
      'キャンペーンと通常のお知らせが同じ導線に掲載される場合があります。',
      '対象サービスを確認してから口座開設または取引へ進んでください。',
      `招待コード: ${OKJ_REFERRAL_CODE}`,
    ],
  },
  {
    id: 'binance-japan-campaigns',
    slug: 'binance-japan',
    exchangeId: 'binance-japan',
    exchangeName: 'Binance Japan',
    campaignName: '公式お知らせ・キャンペーン確認',
    benefit: '紹介リンク経由の特典内容は公式画面で確認',
    audience: '新規口座開設者 / 既存ユーザー（案件ごと）',
    conditions: '本人確認、入金、対象取引など。案件ごとに異なります。',
    period: '案件ごとに異なる',
    officialUrl: 'https://www.binance.com/ja-JP/support/announcement',
    affiliateEnvKey: 'BINANCE_JAPAN_REFERRAL_URL',
    defaultAffiliateUrl: BINANCE_JAPAN_REFERRAL_URL,
    referralCode: BINANCE_JAPAN_REFERRAL_CODE,
    referralTrigger: '招待リンク経由の口座開設など。詳細条件は公式画面で確認してください。',
    lastChecked: '公式確認待ち',
    notes: [
      'グローバル版BinanceとBinance Japanでは利用条件や対象サービスが異なります。',
      '紹介リンクの表示条件、対象者、付与時期、除外条件を申込前に確認してください。',
      `招待コード: ${BINANCE_JAPAN_REFERRAL_CODE}`,
    ],
  },
  {
    id: 'bittrade-campaigns',
    slug: 'bittrade',
    exchangeId: 'bittrade',
    exchangeName: 'BitTrade',
    campaignName: '公式キャンペーン・紹介プログラム確認',
    benefit: '紹介リンク経由の特典内容は公式画面で確認',
    audience: '新規口座開設者 / 既存ユーザー（案件ごと）',
    conditions: '本人確認、入金、対象取引など。案件ごとに異なります。',
    period: '案件ごとに異なる',
    officialUrl: 'https://www.bittrade.co.jp/ja-jp/campaign/',
    affiliateEnvKey: 'BITTRADE_REFERRAL_URL',
    defaultAffiliateUrl: BITTRADE_REFERRAL_URL,
    referralCode: BITTRADE_REFERRAL_CODE,
    referralTrigger: '招待リンク経由の口座開設など。詳細条件は公式画面で確認してください。',
    lastChecked: '公式確認待ち',
    notes: [
      'キャンペーン一覧と紹介リンク画面で対象条件が分かれる場合があります。',
      '紹介リンクの表示条件、対象者、付与時期、除外条件を申込前に確認してください。',
      `招待コード: ${BITTRADE_REFERRAL_CODE}`,
    ],
  },
]);

function normalizeSlug(value) {
  return String(value || '').trim().toLowerCase();
}

function readCampaignAffiliateUrl(campaign) {
  return readOptionalEnv(campaign.affiliateEnvKey, campaign.defaultAffiliateUrl);
}

function listCampaigns() {
  return CAMPAIGNS.map(campaignWithRuntimeFields);
}

function campaignPath(campaignOrSlug) {
  const slug = typeof campaignOrSlug === 'object'
    ? campaignOrSlug && campaignOrSlug.slug
    : normalizeCampaignSlug(campaignOrSlug);
  return `/campaigns/${encodeURIComponent(slug || '')}`;
}

function campaignWithRuntimeFields(campaign) {
  const affiliateUrl = readCampaignAffiliateUrl(campaign);
  const envOverride = String(process.env[campaign.affiliateEnvKey] || '').trim();
  return {
    ...campaign,
    affiliateUrl,
    trackingPixelUrl: envOverride ? null : (campaign.trackingPixelUrl || null),
    path: campaignPath(campaign),
  };
}

function findCampaign(value) {
  const normalized = normalizeSlug(value);
  if (!normalized) return null;

  return CAMPAIGNS.find(campaign => (
    normalizeSlug(campaign.slug) === normalized
    || normalizeSlug(campaign.id) === normalized
    || normalizeSlug(campaign.exchangeId) === normalized
    || normalizeSlug(`${campaign.exchangeId}-campaigns`) === normalized
  )) || null;
}

function getCampaign(value) {
  const campaign = findCampaign(value);
  return campaign ? campaignWithRuntimeFields(campaign) : null;
}

function normalizeCampaignSlug(value) {
  const campaign = findCampaign(value);
  return campaign ? campaign.slug : normalizeSlug(value);
}

module.exports = {
  campaignPath,
  getCampaign,
  listCampaigns,
  normalizeCampaignSlug,
};
