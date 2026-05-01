function readOptionalEnv(name) {
  const value = String(process.env[name] || '').trim();
  return value || null;
}

const EXCHANGE_PAGE_CONTENT = Object.freeze({
  okj: {
    pageSlug: 'okj',
    aliases: ['okcoin-japan'],
    officialUrl: 'https://www.okcoin.jp/',
    signupUrl: 'https://www.okcoin.jp/',
    campaignUrl: 'https://support.okcoin.jp/hc/ja',
    campaignLabel: '公式サポートでキャンペーン・お知らせを確認',
    referralEnvKey: 'OKJ_REFERRAL_URL',
    summary: 'BTC/JPY を起点に、板取引・積立・サービス導線をまとめて確認しやすい取引所です。',
    conclusion: {
      assetCoverage: '主要銘柄を中心に確認しやすい',
      salesDesk: 'あり',
      exchangeFormat: 'あり',
      orderbookDepth: 'BTC など主要銘柄から確認',
      operator: 'OK Group 系',
      suitableFor: '板取引と積立など周辺サービスを一緒に見たい人',
    },
    profile: {
      companyName: 'オーケーコイン・ジャパン株式会社',
      serviceName: 'OKJ',
      registrationNumber: '関東財務局長 第00020号（暗号資産交換業）',
      parentCompany: 'OK Group 系',
      foundedYear: '2017年',
      services: ['現物取引', '販売所', '取引所形式', '積立', '貸暗号資産など'],
    },
    features: {
      spotTrading: 'あり',
      leverageTrading: '公式確認',
      salesDesk: 'あり',
      exchangeFormat: 'あり',
      recurring: 'あり',
      depositsWithdrawals: '日本円入出金 / 暗号資産入出庫に対応（条件は公式確認）',
    },
    costs: {
      tradingFee: '銘柄・注文方式ごとの公式手数料表で確認',
      depositFee: '入金方式・銀行により条件が変わるため公式確認',
      withdrawalFee: '出金先・方法ごとの公式手数料表で確認',
      cryptoTransferFee: '銘柄・ネットワークごとの公式手数料表で確認',
      salesSpread: '販売所の買値・売値差を注文前に確認',
      exchangeCost: '取引手数料に加えて板スプレッドとスリッページを確認',
    },
    userTypes: [
      'まずは BTC/JPY を中心に板コストを見たい人',
      '積立や貸暗号資産も含めてサービス全体を確認したい人',
      '主要銘柄の板シミュレーションへすぐ戻りたい人',
    ],
    cautions: [
      'サービスごとに注文画面と条件が分かれるため、発注前に対象サービスを確認しましょう。',
      '取扱銘柄数だけでなく、実際に板取引で使う銘柄と最小注文数量も確認しておくと比較しやすくなります。',
      'キャンペーンや紹介制度の条件は変更されるため、申込前に公式案内を確認しましょう。',
    ],
  },
  coincheck: {
    pageSlug: 'coincheck',
    aliases: [],
    officialUrl: 'https://coincheck.com/',
    signupUrl: 'https://coincheck.com/registrations',
    campaignUrl: 'https://coincheck.com/',
    campaignLabel: '公式サイト・アプリ導線で最新情報を確認',
    referralEnvKey: 'COINCHECK_REFERRAL_URL',
    summary: 'アプリ導線と主要銘柄の比較を見ながら、販売所と板取引の使い分けを整理しやすい取引所です。',
    conclusion: {
      assetCoverage: '主要銘柄とアプリ導線を中心に確認しやすい',
      salesDesk: 'あり',
      exchangeFormat: 'あり',
      orderbookDepth: '銘柄によって差あり',
      operator: 'Coincheck Group N.V. / マネックスグループ関連',
      suitableFor: 'アプリ中心で販売所と取引所形式を使い分けたい人',
    },
    profile: {
      companyName: 'コインチェック株式会社',
      serviceName: 'Coincheck',
      registrationNumber: '関東財務局長 第00014号（暗号資産交換業）',
      parentCompany: 'Coincheck Group N.V.（マネックスグループ関連）',
      foundedYear: '2012年',
      services: ['現物取引', '販売所', '取引所形式', 'つみたて', '貸暗号資産', 'NFT など'],
    },
    features: {
      spotTrading: 'あり',
      leverageTrading: '公式提供状況を確認',
      salesDesk: 'あり',
      exchangeFormat: 'あり',
      recurring: 'あり',
      depositsWithdrawals: '日本円入出金 / 暗号資産入出庫に対応（条件は公式確認）',
    },
    costs: {
      tradingFee: '取引所形式は銘柄ごとの公式条件を確認',
      depositFee: '銀行振込・クイック入金など入金方式別に公式確認',
      withdrawalFee: '日本円出金手数料は公式手数料表で確認',
      cryptoTransferFee: '銘柄・ネットワークごとの公式手数料表で確認',
      salesSpread: '販売所では買値・売値差が実質コストになる',
      exchangeCost: '取引手数料に加えて板スプレッドとスリッページを確認',
    },
    userTypes: [
      'アプリ中心で主要銘柄の売買を始めたい人',
      '販売所と Trade View のどちらを使うか見比べたい人',
      '積立や家族・友だち紹介など周辺導線も確認したい人',
    ],
    cautions: [
      '販売所と板取引では対応銘柄や見えるコストが異なるため、注文前に実効コストを確認しましょう。',
      '板取引対応銘柄は販売所より少ないため、買いたい銘柄が板で使えるかを先に見ると迷いにくくなります。',
      '紹介制度や特典は適用条件・禁止事項を含めて更新されることがあるため、掲載前に公式条件を確認しましょう。',
    ],
  },
  bitflyer: {
    pageSlug: 'bitflyer',
    aliases: [],
    officialUrl: 'https://bitflyer.com/ja-jp/',
    signupUrl: 'https://bitflyer.com/ja-jp/',
    campaignUrl: 'https://bitflyer.com/ja-jp/s/service',
    campaignLabel: '公式サービスページで最新導線を確認',
    referralEnvKey: 'BITFLYER_REFERRAL_URL',
    summary: '主要銘柄の板比較を見つつ、販売所や Lightning 系の使い分けを確認しやすい取引所です。',
    conclusion: {
      assetCoverage: '主要銘柄を起点に確認しやすい',
      salesDesk: 'あり',
      exchangeFormat: 'あり',
      orderbookDepth: '主要銘柄と Lightning 系で確認',
      operator: '株式会社 bitFlyer Holdings 系',
      suitableFor: 'BTC や ETH など主要銘柄の板比較を重視する人',
    },
    profile: {
      companyName: '株式会社 bitFlyer',
      serviceName: 'bitFlyer',
      registrationNumber: '関東財務局長 第00003号（暗号資産交換業）',
      parentCompany: '株式会社 bitFlyer Holdings 系',
      foundedYear: '2014年',
      services: ['現物取引', '販売所', '取引所形式', 'Lightning', '定期購入など'],
    },
    features: {
      spotTrading: 'あり',
      leverageTrading: '公式提供状況を確認',
      salesDesk: 'あり',
      exchangeFormat: 'あり',
      recurring: 'あり',
      depositsWithdrawals: '日本円入出金 / 暗号資産入出庫に対応（条件は公式確認）',
    },
    costs: {
      tradingFee: 'Lightning / 取引所など注文画面別に公式確認',
      depositFee: '銀行・即時入金方式ごとの公式条件を確認',
      withdrawalFee: '日本円出金手数料は出金先銀行別に公式確認',
      cryptoTransferFee: '銘柄・ネットワークごとの公式手数料表で確認',
      salesSpread: '販売所では買値・売値差が実質コストになる',
      exchangeCost: '取引手数料に加えて板スプレッドとスリッページを確認',
    },
    userTypes: [
      'BTC や ETH など主要銘柄の板比較を優先したい人',
      '販売所と bitFlyer Lightning の違いを確認したい人',
      '紹介プログラムや定期購入を含めて導線を整理したい人',
    ],
    cautions: [
      '販売所と Lightning 系画面でコストの見え方が変わるため、発注前に使う画面を決めておくと比較しやすくなります。',
      '主要銘柄以外は板対応数が限られるため、取扱銘柄一覧を確認してから移動しましょう。',
      '紹介プログラムは対象条件や利用方法が変わる可能性があるため、公式案内の最新情報を確認しましょう。',
    ],
  },
  bitbank: {
    pageSlug: 'bitbank',
    aliases: [],
    officialUrl: 'https://bitbank.cc/',
    signupUrl: 'https://app.bitbank.cc/',
    campaignUrl: 'https://support.bitbank.cc/hc/ja/articles/22834304372505-%E5%90%84%E3%82%AD%E3%83%A3%E3%83%B3%E3%83%9A%E3%83%BC%E3%83%B3%E5%BD%93%E9%81%B8%E9%87%91-%E3%83%97%E3%83%AC%E3%82%BC%E3%83%B3%E3%83%88-%E3%81%AE%E5%8F%97%E5%8F%96%E6%96%B9%E6%B3%95%E3%81%AB%E3%81%A4%E3%81%84%E3%81%A6',
    campaignLabel: '常設プログラムの確認方法を公式サポートで見る',
    referralEnvKey: 'BITBANK_REFERRAL_URL',
    summary: 'アルトコインの板比較を広めに見たいときに、銘柄カバレッジと流動性の参考をまとめて確認しやすい取引所です。',
    conclusion: {
      assetCoverage: '多い',
      salesDesk: 'あり',
      exchangeFormat: 'あり',
      orderbookDepth: '銘柄によって差あり',
      operator: 'ビットバンク株式会社',
      suitableFor: 'アルトコインも含めて板取引対応銘柄を広く見たい人',
    },
    profile: {
      companyName: 'ビットバンク株式会社',
      serviceName: 'bitbank',
      registrationNumber: '関東財務局長 第00004号（暗号資産交換業）',
      parentCompany: '公式会社概要・公開情報で確認',
      foundedYear: '2014年',
      services: ['現物取引', '販売所', '取引所形式', '貸して増やすなど'],
    },
    features: {
      spotTrading: 'あり',
      leverageTrading: '公式提供状況を確認',
      salesDesk: 'あり',
      exchangeFormat: 'あり',
      recurring: '公式提供状況を確認',
      depositsWithdrawals: '日本円入出金 / 暗号資産入出庫に対応（条件は公式確認）',
    },
    costs: {
      tradingFee: 'maker / taker と銘柄ごとの公式条件を確認',
      depositFee: '銀行振込など入金方式別に公式確認',
      withdrawalFee: '日本円出金手数料は公式手数料表で確認',
      cryptoTransferFee: '銘柄・ネットワークごとの公式手数料表で確認',
      salesSpread: '販売所では買値・売値差が実質コストになる',
      exchangeCost: '取引手数料に加えて板スプレッドとスリッページを確認',
    },
    userTypes: [
      'アルトコインも含めて板取引対応銘柄を広く見たい人',
      '出来高や流動性を参考に比較候補を絞りたい人',
      '販売所と取引所の両方を使い分けたい人',
    ],
    cautions: [
      '販売所と取引所ではコスト構造が異なるため、板で買うのか販売所で買うのかを先に決めておくと比較しやすくなります。',
      '常設プログラムでもログイン後の対象表示が前提になることがあるため、キャンペーン条件を公式画面で確認しましょう。',
      '銘柄数が多いため、まずは出来高が集まりやすい銘柄から板の厚みを確認すると迷いにくくなります。',
    ],
  },
  gmo: {
    pageSlug: 'gmo-coin',
    aliases: ['gmo-coin'],
    officialUrl: 'https://coin.z.com/jp/',
    signupUrl: 'https://coin.z.com/jp/',
    campaignUrl: 'https://coin.z.com/jp/corp/about/campaign/',
    campaignLabel: 'キャンペーン・プログラム一覧を公式で確認',
    referralEnvKey: 'GMO_COIN_REFERRAL_URL',
    summary: '販売所・取引所・周辺サービスの情報量が多く、キャンペーンや取扱銘柄の更新を追いやすい取引所です。',
    conclusion: {
      assetCoverage: '多い',
      salesDesk: 'あり',
      exchangeFormat: 'あり',
      orderbookDepth: '銘柄によって差あり',
      operator: 'GMOフィナンシャルホールディングス系',
      suitableFor: '取扱銘柄数とサービス範囲を重視する人',
    },
    profile: {
      companyName: 'GMOコイン株式会社',
      serviceName: 'GMOコイン',
      registrationNumber: '関東財務局長 第00006号（暗号資産交換業）',
      parentCompany: 'GMOフィナンシャルホールディングス株式会社系',
      foundedYear: '2016年',
      services: ['現物取引', '販売所', '取引所形式', 'レバレッジ取引', 'つみたて暗号資産など'],
    },
    features: {
      spotTrading: 'あり',
      leverageTrading: 'あり',
      salesDesk: 'あり',
      exchangeFormat: 'あり',
      recurring: 'あり',
      depositsWithdrawals: '日本円入出金 / 暗号資産入出庫に対応（条件は公式確認）',
    },
    costs: {
      tradingFee: '現物取引・レバレッジ取引・銘柄ごとの公式条件を確認',
      depositFee: '即時入金・振込入金など入金方式別に公式確認',
      withdrawalFee: '日本円出金手数料は公式手数料表で確認',
      cryptoTransferFee: '銘柄・ネットワークごとの公式手数料表で確認',
      salesSpread: '販売所では買値・売値差が実質コストになる',
      exchangeCost: '取引手数料に加えて板スプレッドとスリッページを確認',
    },
    userTypes: [
      '販売所と取引所の両方を比較しながら候補を絞りたい人',
      '取扱銘柄数やキャンペーン更新をまとめて確認したい人',
      '主要銘柄以外も含めて流動性の参考を見たい人',
    ],
    cautions: [
      '同一サイト内に複数サービスがあるため、暗号資産の現物取引か別サービスかを確認してから進みましょう。',
      '販売所と取引所で対応銘柄・手数料・注文条件が異なるため、注文前に実効コストを確認しましょう。',
      'キャンペーン更新が多いため、適用条件や終了日時は申込前に公式一覧で確認するのが安全です。',
    ],
  },
  'binance-japan': {
    pageSlug: 'binance-japan',
    aliases: ['binance'],
    officialUrl: 'https://www.binance.com/ja-JP',
    signupUrl: 'https://www.binance.com/ja-JP/register',
    campaignUrl: 'https://www.binance.com/ja-JP/support/announcement',
    campaignLabel: '公式お知らせでキャンペーン・取扱銘柄の更新を確認',
    referralEnvKey: 'BINANCE_JAPAN_REFERRAL_URL',
    summary: '主要銘柄と一部アルトコインの板データを見ながら、グローバル系サービスの日本向け条件を確認しやすい取引所です。',
    conclusion: {
      assetCoverage: '主要銘柄と一部アルトコインを確認しやすい',
      salesDesk: '販売所データなし / 公式確認',
      exchangeFormat: 'あり',
      orderbookDepth: '銘柄によって差あり',
      operator: 'Binance グループ系',
      suitableFor: '日本向け条件を確認しながら取引所形式を使いたい人',
    },
    profile: {
      companyName: 'Binance Japan株式会社',
      serviceName: 'Binance Japan',
      registrationNumber: '関東財務局長 第00031号（暗号資産交換業）',
      parentCompany: 'Binance グループ系',
      foundedYear: '2017年（前身会社）',
      services: ['現物取引', '取引所形式', '日本向けサービスなど'],
    },
    features: {
      spotTrading: 'あり',
      leverageTrading: '日本向け提供状況を公式確認',
      salesDesk: '販売所データなし / 公式確認',
      exchangeFormat: 'あり',
      recurring: '公式提供状況を確認',
      depositsWithdrawals: '日本円入出金 / 暗号資産入出庫の対応条件は公式確認',
    },
    costs: {
      tradingFee: 'スポット取引の公式手数料表で確認',
      depositFee: '入金方式・提携サービスごとの公式条件を確認',
      withdrawalFee: '日本円出金手数料は公式手数料表で確認',
      cryptoTransferFee: '銘柄・ネットワークごとの公式手数料表で確認',
      salesSpread: '本サイトの販売所スプレッド追跡は対象外',
      exchangeCost: '取引手数料に加えて板スプレッドとスリッページを確認',
    },
    userTypes: [
      'BTC、ETH、BNB、SOL など主要銘柄をまとめて確認したい人',
      '国内サービスとしての登録情報や日本向け条件を公式情報で確認したい人',
      '出来高と板の厚みを見ながら、販売所ではなく取引所形式を優先したい人',
    ],
    cautions: [
      'グローバル版と日本向けサービスでは利用条件や取扱範囲が異なるため、公式画面が日本向けか確認しましょう。',
      'キャンペーンや取扱銘柄の更新が多いため、注文前に対象銘柄、手数料、出金条件を確認しましょう。',
      '販売所スプレッドの比較データがない場合は、板シミュレーターと公式注文画面を優先して確認しましょう。',
    ],
  },
  bittrade: {
    pageSlug: 'bittrade',
    aliases: [],
    officialUrl: 'https://www.bittrade.co.jp/ja-jp/',
    signupUrl: 'https://www.bittrade.co.jp/ja-jp/',
    campaignUrl: 'https://www.bittrade.co.jp/ja-jp/campaign/',
    campaignLabel: '公式キャンペーン一覧で最新条件を確認',
    referralEnvKey: 'BITTRADE_REFERRAL_URL',
    summary: '取扱銘柄の広さを確認しながら、板取引と販売所スプレッドの使い分けを整理しやすい取引所です。',
    conclusion: {
      assetCoverage: '多い',
      salesDesk: 'あり',
      exchangeFormat: 'あり',
      orderbookDepth: '銘柄によって差あり',
      operator: 'ビットトレード株式会社',
      suitableFor: 'アルトコインを含めて取扱銘柄を広く確認したい人',
    },
    profile: {
      companyName: 'ビットトレード株式会社',
      serviceName: 'BitTrade',
      registrationNumber: '関東財務局長 第00007号（暗号資産交換業）',
      parentCompany: '公式会社概要・公開情報で確認',
      foundedYear: '2016年',
      services: ['現物取引', '販売所', '取引所形式', 'レバレッジ取引など'],
    },
    features: {
      spotTrading: 'あり',
      leverageTrading: 'あり',
      salesDesk: 'あり',
      exchangeFormat: 'あり',
      recurring: '公式提供状況を確認',
      depositsWithdrawals: '日本円入出金 / 暗号資産入出庫に対応（条件は公式確認）',
    },
    costs: {
      tradingFee: '現物・レバレッジ・銘柄ごとの公式条件を確認',
      depositFee: '入金方式・銀行により条件が変わるため公式確認',
      withdrawalFee: '日本円出金手数料は公式手数料表で確認',
      cryptoTransferFee: '銘柄・ネットワークごとの公式手数料表で確認',
      salesSpread: '販売所では買値・売値差が実質コストになる',
      exchangeCost: '取引手数料に加えて板スプレッドとスリッページを確認',
    },
    userTypes: [
      'アルトコインを含めて取扱銘柄を広く確認したい人',
      '板取引と販売所の対応範囲を分けて見たい人',
      'キャンペーンより先に通常時コストと出金条件を確認したい人',
    ],
    cautions: [
      '取扱銘柄が多いほど、銘柄ごとの流動性や出金条件の差を個別に確認する必要があります。',
      '販売所と取引所では対応銘柄や実効コストが異なるため、注文前に使う画面を確認しましょう。',
      'キャンペーン条件や対象銘柄は変更されるため、申込前に公式一覧と注意事項を確認しましょう。',
    ],
  },
});

function normalizeSlug(value) {
  return String(value || '').trim().toLowerCase();
}

function resolveExchangePageId(value) {
  const normalized = normalizeSlug(value);
  if (!normalized) return '';

  const direct = EXCHANGE_PAGE_CONTENT[normalized];
  if (direct) return normalized;

  for (const [exchangeId, content] of Object.entries(EXCHANGE_PAGE_CONTENT)) {
    if (normalizeSlug(content.pageSlug) === normalized) return exchangeId;
    if ((content.aliases || []).some(alias => normalizeSlug(alias) === normalized)) return exchangeId;
  }

  return normalized;
}

function exchangePageSlug(exchangeId) {
  const resolvedId = resolveExchangePageId(exchangeId);
  const content = EXCHANGE_PAGE_CONTENT[resolvedId];
  return content && content.pageSlug ? content.pageSlug : normalizeSlug(exchangeId);
}

function getExchangePageContent(exchangeId) {
  const resolvedId = resolveExchangePageId(exchangeId);
  const content = EXCHANGE_PAGE_CONTENT[resolvedId] || null;
  if (!content) return null;

  return {
    ...content,
    referralUrl: readOptionalEnv(content.referralEnvKey),
  };
}

module.exports = {
  exchangePageSlug,
  getExchangePageContent,
  resolveExchangePageId,
};
