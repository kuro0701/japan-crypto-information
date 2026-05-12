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
    financialAnalysis: {
      sourceSummary: '公式会社概要、決算公告、OK Group の公開情報で確認',
      summary: {
        disclosureStatus: '公式会社概要・決算公告・グループ公開情報で確認',
      },
      indicators: {
        parentPresence: 'OK Group 系として公開情報を確認',
        listedCompany: '運営会社または親会社の上場有無を公開資料で確認',
        disclosureUpdatedAt: '公式公告・開示資料の更新日を確認',
      },
      businessPosition: 'OK Group の日本向け暗号資産交換業として、グループ内での位置づけを確認',
      revenueSource: '取引手数料、販売所スプレッド、貸暗号資産などの公開説明を確認',
      groupDisclosure: 'OK Group の公式情報、オーケーコイン・ジャパンの会社概要・公告を確認',
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
    financialAnalysis: {
      sourceSummary: '公式会社概要、Coincheck Group / マネックスグループ関連の開示資料で確認',
      summary: {
        disclosureStatus: '公式会社概要・グループ開示資料で確認',
      },
      indicators: {
        parentPresence: 'Coincheck Group N.V. / マネックスグループ関連として公開資料を確認',
        listedCompany: '親会社・グループの上場開示を確認',
        disclosureUpdatedAt: 'グループIR・公式開示資料の更新日を確認',
      },
      businessPosition: 'アプリ取引、販売所、取引所形式、NFT など暗号資産関連サービスの位置づけを確認',
      revenueSource: '販売所スプレッド、取引手数料、周辺サービス収益の構成を開示資料で確認',
      groupDisclosure: 'Coincheck Group、マネックスグループ関連のIR・公式発表を確認',
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
    summary: 'bitFlyerは、BTCやETHなどの主要銘柄を中心に、販売所とLightning系の使い分けを確認したい人に向いています。',
    hero: {
      title: 'bitFlyerの特徴まとめ',
      lead: 'bitFlyerは、主要銘柄を中心に、販売所と取引所形式の両方を確認したい人に向いた国内暗号資産取引所です。特にBTCやETHなどを板取引で比較したい場合は、候補に入れやすい取引所です。',
      body: '販売所を使う場合はスプレッド、取引所形式を使う場合は手数料・板スプレッド・スリッページを分けて確認しましょう。注文前には、必ず公式画面で最新の条件と表示価格を確認してください。',
    },
    conclusion: {
      assetCoverage: '主要銘柄を起点に確認しやすい',
      salesDesk: 'あり',
      exchangeFormat: 'あり',
      orderbookDepth: '主要銘柄と Lightning 系で確認',
      operator: '株式会社 bitFlyer Holdings 系',
      suitableFor: 'BTC・ETH・XRPなど主要銘柄を板取引で比較したい人',
    },
    profile: {
      companyName: '株式会社 bitFlyer',
      serviceName: 'bitFlyer',
      registrationNumber: '関東財務局長 第00003号（暗号資産交換業）',
      parentCompany: '株式会社 bitFlyer Holdings 系',
      foundedYear: '2014年',
      services: ['現物取引', '販売所', 'かんたん取引所', 'bitFlyer Lightning', 'bitFlyer Crypto CFD', '定期貸しコイン', 'ETHステーキング', 'bitFlyer クレカ'],
    },
    financialAnalysis: {
      sourceSummary: '公式会社概要、第12期計算書類・事業報告書（2025年12月期）で確認',
      summary: {
        revenue: '営業収益 13,567百万円（2025年12月期）',
        operatingProfit: '営業利益 4,257百万円（2025年12月期）',
        netAssets: '純資産 29,750百万円、総資産 1,079,982百万円（2025年12月末）',
        disclosureStatus: '第6期から第12期までの計算書類・事業報告書を公式会社概要で公開',
      },
      indicators: {
        revenue: '営業収益は2022年度 7,378 → 2023年度 6,413 → 2024年度 14,904 → 2025年度 13,567百万円',
        operatingProfit: '営業利益 4,257百万円（2025年12月期。前年同期 7,896百万円）',
        ordinaryProfit: '経常利益は2022年度 △2,031 → 2023年度 627 → 2024年度 9,095 → 2025年度 4,415百万円',
        netIncome: '当期純利益は2022年度 △2,194 → 2023年度 436 → 2024年度 7,471 → 2025年度 2,461百万円',
        netAssets: '純資産は2022年度 25,030 → 2023年度 19,817 → 2024年度 27,289 → 2025年度 29,750百万円',
        equityRatio: '自己資本比率は約2.75%（2025年末、純資産29,750 / 総資産1,079,982百万円。顧客資産等の両建て表示に注意）',
        operatingCashFlow: '計算書類・事業報告書では営業キャッシュフロー計算書は確認対象外',
        cryptoBusinessRatio: '主要事業は暗号資産交換業・暗号資産関連デリバティブ取引業および関連事業',
        parentPresence: '株式会社 bitFlyer Holdings が議決権比率100%を保有（2025年12月31日時点）',
        listedCompany: '株式会社 bitFlyer / 株式会社 bitFlyer Holdings は非上場会社として公式開示を確認',
        sanctions: '金融庁・財務局の公表資料で最新の行政処分歴を別途確認',
        auditor: 'EY新日本有限責任監査法人',
        disclosureUpdatedAt: '公式会社概要で第12期（2025年1月1日-2025年12月31日）計算書類・事業報告書を公開',
      },
      businessPosition: '暗号資産交換業と金融商品取引業を営む国内事業会社。2025年末の顧客預かり資産は 1,047,251百万円',
      revenueSource: '2025年12月期の営業収益は受入手数料 2,475百万円、暗号資産売買等損益 11,030百万円、その他営業収益 60百万円',
      groupDisclosure: '株式会社 bitFlyer Holdings が親会社。公式会社概要に親会社概要、計算書類、事業報告書、金融商品取引業の説明書を掲載',
      disclosureMaterials: '会社概要の開示情報、第12期 計算書類、第12期 事業報告書、2025年12月期 業務及び財産の状況に関する説明書',
      sourceLinks: [
        {
          title: 'bitFlyer 会社概要・開示情報',
          href: 'https://bitflyer.com/ja-jp/s/company',
          description: '会社概要、登録番号、会計監査人、計算書類、事業報告書を確認できます。',
          meta: '公式ページ',
        },
        {
          title: '第12期 計算書類',
          href: 'https://bitflyer.com/pub/financial-statement-12th.pdf',
          description: '2025年12月期の貸借対照表、損益計算書、株主資本等変動計算書です。',
          meta: 'PDF',
        },
        {
          title: '第12期 事業報告書',
          href: 'https://bitflyer.com/pub/business-report-12th.pdf',
          description: '2025年度の事業経過、損益推移、親会社、従業員、監査法人を確認できます。',
          meta: 'PDF',
        },
      ],
      cautions: [
        '総資産・負債には顧客暗号資産や預り金が大きく含まれるため、自己資本比率は表示構造込みで確認しましょう。',
        '2025年末の顧客預かり資産は 1,047,251百万円で、2024年末の 1,178,804百万円から減少しています。',
        '営業収益と利益は暗号資産市場や売買等損益の影響を受けるため、単年だけでなく複数年推移で見ましょう。',
      ],
    },
    features: {
      spotTrading: 'あり',
      leverageTrading: 'あり（bitFlyer Crypto CFD）',
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
      salesSpread: '販売所では、買値と売値の差であるスプレッドが実質的なコストになります。本サイトでは、販売所対応銘柄のスプレッドを参考データとして集計しています。',
      exchangeCost: '取引所形式では、取引手数料だけでなく、板スプレッドやスリッページも実質コストになります。特に大きめの注文では、約定平均価格も確認してください。',
    },
    userTypes: [
      'BTC・ETH・XRPなど主要銘柄を板取引で比較したい人',
      '販売所と bitFlyer Lightning の違いを確認したい人',
      '紹介プログラムや定期購入を含めて導線を整理したい人',
    ],
    cautions: [
      '販売所と Lightning 系画面でコストの見え方が変わるため、発注前に使う画面を決めておくと比較しやすくなります。',
      '主要銘柄以外は板対応数が限られるため、取扱銘柄一覧を確認してから移動しましょう。',
      '取扱銘柄、手数料、キャンペーン、入出金条件は変更される場合があります。申込や注文の前には、必ず公式サイトで最新情報を確認してください。',
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
    financialAnalysis: {
      sourceSummary: '公式会社概要、決算公告、株主・資本関係の公開情報で確認',
      summary: {
        disclosureStatus: '公式会社概要・決算公告・公開情報で確認',
      },
      indicators: {
        parentPresence: '親会社・主要株主の有無を公式会社概要と公開情報で確認',
        listedCompany: '運営会社または親会社の上場有無を公開資料で確認',
        disclosureUpdatedAt: '決算公告・公式開示資料の更新日を確認',
      },
      businessPosition: '現物板取引、販売所、貸暗号資産など暗号資産関連サービスの位置づけを確認',
      revenueSource: '取引手数料、販売所スプレッド、貸暗号資産関連収益などの公開説明を確認',
      groupDisclosure: '公式会社概要、決算公告、株主・資本関係の公開情報を確認',
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
    financialAnalysis: {
      sourceSummary: '公式会社概要、GMOフィナンシャルホールディングスのIR、有価証券報告書で確認',
      summary: {
        disclosureStatus: '親会社IR・有価証券報告書で確認可能',
      },
      indicators: {
        parentPresence: 'GMOフィナンシャルホールディングス株式会社系として確認',
        listedCompany: '親会社・グループの上場開示と有価証券報告書で確認',
        disclosureUpdatedAt: '有価証券報告書・決算説明資料の更新日を確認',
      },
      businessPosition: 'GMOフィナンシャルホールディングス内の暗号資産事業として、金融サービス全体での位置づけを確認',
      revenueSource: '販売所スプレッド、取引手数料、レバレッジ取引、周辺サービス収益の構成を確認',
      groupDisclosure: 'GMOフィナンシャルホールディングスのIR、有価証券報告書、決算説明資料を確認',
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
    summary: 'Binance Japanは、主要銘柄とBNBを含むアルトコインを、国内登録業者の日本向け条件で確認したい人に向いた取引所です。販売所と取引所形式の違い、PayPayマネー連携、暗号資産入出庫の条件を分けて確認しましょう。',
    hero: {
      title: 'Binance Japanの特徴まとめ',
      lead: 'Binance Japanは、Binanceグループの日本法人として、国内登録の暗号資産交換業者として提供されているサービスです。BTC、ETH、BNB、SOLなどの主要銘柄を中心に、取引所形式の板と公式の販売所条件を分けて見たい人に向いています。',
      body: 'グローバル版Binanceとは利用条件や取扱範囲が異なるため、日本向けサービスの公式画面で手数料、入出金、販売所の提示価格、対象銘柄を確認してください。本サイトでは板データと出来高を中心に参考値を集計します。',
      coverageNote: 'BTC/JPYを起点に、本サイトでは主要な板取引銘柄を追跡します。販売所の提示価格とスプレッドは公式画面で確認してください。',
      fitNote: '主要銘柄を買う前に、取引所形式の板コストと販売所の提示価格差を分けて判断できます。',
      costFocusTitle: '取引所形式の板コストと販売所の提示価格差',
      costFocusNote: '本サイトでは10万円買いの板シミュレーションを参考値として表示します。販売所を使う場合は、注文直前に公式画面の買値・売値差を確認してください。',
    },
    conclusion: {
      assetCoverage: '主要銘柄とBNBを含むアルトコインを確認しやすい',
      salesDesk: 'あり（公式画面で提示価格を確認）',
      exchangeFormat: 'あり',
      orderbookDepth: 'BTC・ETH・BNBなど主要銘柄で確認',
      operator: 'Binance グループ系 / PayPay 40%出資',
      suitableFor: '日本向け条件でBinance系サービスを使いたい人',
    },
    profile: {
      companyName: 'Binance Japan株式会社',
      serviceName: 'Binance Japan',
      registrationNumber: '関東財務局長 第00031号（暗号資産交換業）',
      parentCompany: 'Binance グループ系 / PayPay が40%出資（2025年9月から持分法適用会社）',
      foundedYear: '2017年5月（前身会社を含む公開情報ベース）',
      services: ['現物取引', '販売所', '取引所形式', '貸暗号資産', 'PayPayマネー入出金連携', '暗号資産入出庫'],
    },
    serviceDescription: 'Binance Japanでは、現物取引、販売所、取引所形式、貸暗号資産、PayPayマネー入出金連携などを確認できます。グローバル版とは提供範囲が異なるため、日本向け公式画面で対象サービスを見直しましょう。',
    dataSourceDescription: 'Binance Spot REST market data をもとに、本サイトでは主要銘柄の板・出来高の参考データを集計しています。販売所の提示価格、PayPayマネー連携、入出金条件は公式画面を優先してください。',
    financialAnalysis: {
      sourceSummary: 'Binance Japan公式の第6期から第9期財務諸表、金融庁登録一覧、PayPay出資発表で確認',
      parentCompany: 'Binance グループ系 / PayPay が40%出資（2025年9月から持分法適用会社）',
      summary: {
        revenue: '営業収益 1,862百万円（第9期・2025年12月期）',
        operatingProfit: '営業利益 141百万円、当期純利益 263百万円（第9期・2025年12月期）',
        netAssets: '純資産 17,321百万円、総資産 129,252百万円（2025年12月末）',
        disclosureStatus: '公式サイトで第6期（2022年12月期）から第9期（2025年12月期）までの財務諸表を公開',
      },
      indicators: {
        revenue: '営業収益は2022年12月期 △28 → 2023年12月期 73 → 2024年12月期 1,055 → 2025年12月期 1,862百万円',
        operatingProfit: '営業利益は2022年12月期 △437 → 2023年12月期 △466 → 2024年12月期 23 → 2025年12月期 141百万円',
        ordinaryProfit: '経常利益は2022年12月期 △438 → 2023年12月期 △454 → 2024年12月期 114 → 2025年12月期 180百万円',
        netIncome: '当期純利益は2022年12月期 △467 → 2023年12月期 △456 → 2024年12月期 70 → 2025年12月期 263百万円',
        netAssets: '純資産は2022年末 408 → 2023年末 852 → 2024年末 5,491 → 2025年末 17,321百万円',
        equityRatio: '自己資本比率は約13.40%（2025年末、純資産17,321 / 総資産129,252百万円。利用者預り暗号資産等の両建て表示に注意）',
        operatingCashFlow: '公式財務諸表では貸借対照表、損益計算書、株主資本等変動計算書を確認。営業キャッシュフロー計算書は確認対象外',
        cryptoBusinessRatio: '日本国内では主に暗号資産現物取引、貸暗号資産、関連サービスを提供',
        parentPresence: 'Binanceグループの日本法人。PayPayがBinance Japan株式40%を取得し、2025年9月から持分法適用会社',
        listedCompany: 'Binance Japanは未上場としてPR TIMES会社概要で確認。PayPayも未上場会社として公式IRで確認',
        sanctions: '金融庁・財務局の公表資料で最新の行政処分歴を別途確認',
        auditor: '監査法人は公式開示資料・官報公告で確認',
        disclosureUpdatedAt: '公式財務諸表ページで第9期（2025年1月1日-2025年12月31日）まで公開。金融庁登録一覧は2026年4月1日現在',
      },
      businessPosition: 'Binanceグループの日本向け暗号資産交換業者として、2023年8月から主に現物取引と貸暗号資産を提供。PayPay連携により日本円入出金導線を拡張',
      revenueSource: '2025年12月期の営業収益は受入手数料 434百万円、暗号資産売買等損益 14百万円、その他営業収益 1,414百万円',
      groupDisclosure: 'Binance Japan公式財務諸表、金融庁登録一覧、PayPayの出資発表、資本金減少公告をあわせて確認',
      disclosureMaterials: '公式財務諸表ページ、第9期財務諸表、金融庁 暗号資産交換業者登録一覧、PayPay出資発表、資本金減少公告',
      sourceLinks: [
        {
          title: 'Binance Japan 財務諸表',
          href: 'https://www.binance.com/ja/about-legal/financial-statements-JP',
          description: '第6期から第9期までの財務諸表一覧を確認できます。',
          meta: '公式ページ',
        },
        {
          title: '第9期（令和7年12月期）財務諸表',
          href: 'https://www.binance.com/ja/about-legal/financial-statement-9-2025-jp',
          description: '2025年12月期の貸借対照表、損益計算書、株主資本等変動計算書を確認できます。',
          meta: '公式ページ / PDF表示',
        },
        {
          title: '金融庁 暗号資産交換業者登録一覧',
          href: 'https://www.fsa.go.jp/menkyo/menkyoj/kasoutuka.pdf',
          description: '登録番号、登録年月日、本店所在地、取扱暗号資産を確認できます。',
          meta: 'PDF',
        },
        {
          title: 'PayPay: Binance Japan株式会社へ出資について',
          href: 'https://about.paypay.ne.jp/pr/20251009/01/',
          description: 'PayPayの40%出資と持分法適用会社化を確認できます。',
          meta: '公式発表',
        },
        {
          title: 'PayPayマネー事前入出金連携の発表',
          href: 'https://about.paypay.ne.jp/pr/20260409/01/',
          description: 'PayPayマネー入出金、手数料、上限、販売所・取引所の説明を確認できます。',
          meta: '公式発表',
        },
        {
          title: 'Binance Japan 資本金の額の減少公告',
          href: 'https://public.bnbstatic.com/static/terms_doc/Announcement_Capital_Reduction_Nov_14_ja.pdf',
          description: '2023年12月15日効力発生の資本金減少と最終貸借対照表の掲載先を確認できます。',
          meta: 'PDF',
        },
        {
          title: 'Binance Japan ISO/IEC 27001・27701認証取得',
          href: 'https://prtimes.jp/main/html/rd/p/000000023.000126862.html',
          description: '情報セキュリティとプライバシー情報管理の認証取得を確認できます。',
          meta: '公式発表',
        },
      ],
      cautions: [
        'グローバル版BinanceとBinance Japanでは、利用条件、取扱銘柄、提供サービス、手数料が異なります。',
        '販売所の価格差、PayPayマネー連携手数料、出金上限は変更される場合があるため、注文・入出金直前に公式画面で確認しましょう。',
        '総資産・負債には利用者からの預り金や預り暗号資産が大きく含まれるため、自己資本比率は表示構造込みで確認しましょう。',
      ],
    },
    features: {
      spotTrading: 'あり',
      leverageTrading: '日本向け提供状況を公式確認（現物中心）',
      salesDesk: 'あり（公式画面で提示価格を確認）',
      exchangeFormat: 'あり',
      recurring: '定期購入などの提供状況は公式確認',
      depositsWithdrawals: '日本円入出金 / PayPayマネー連携 / 暗号資産入出庫の対応条件は公式確認',
    },
    costs: {
      tradingFee: 'スポット取引の公式手数料表で確認',
      depositFee: 'PayPayマネー事前入金は110円。銀行振込など他方式は公式条件を確認',
      withdrawalFee: 'PayPayマネー事前出金は110円。その他の日本円出金条件は公式手数料表で確認',
      cryptoTransferFee: '銘柄・ネットワークごとの公式手数料表で確認',
      salesSpread: '販売所ではBinance Japanが取引の相手方となり、提示価格で売買します。価格差が実質コストになるため、注文直前に公式画面で確認してください。',
      salesSpreadStatus: '公式画面で確認',
      exchangeCost: '取引所形式では、取引手数料に加えて板スプレッドとスリッページを確認',
    },
    userTypes: [
      'BTC、ETH、BNB、SOL など主要銘柄を日本向け条件でまとめて確認したい人',
      '販売所と取引所形式を使い分けながら、PayPayマネー連携も確認したい人',
      '国内登録情報、グループ情報、出資関係、開示資料の有無をまとめて見たい人',
    ],
    cautions: [
      'グローバル版と日本向けサービスでは利用条件や取扱範囲が異なるため、公式画面が日本向けか確認しましょう。',
      '販売所の提示価格差、取引所形式の板、PayPayマネー連携手数料、暗号資産出金ネットワークはそれぞれ確認場所が異なります。',
      'キャンペーンや取扱銘柄の更新が多いため、注文前に対象銘柄、手数料、出金条件を確認しましょう。',
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
    financialAnalysis: {
      sourceSummary: '公式会社概要、決算公告、グループ公開情報で確認',
      summary: {
        disclosureStatus: '公式会社概要・決算公告・公開情報で確認',
      },
      indicators: {
        parentPresence: '親会社・グループの有無を公式会社概要と公開情報で確認',
        listedCompany: '運営会社または親会社の上場有無を公開資料で確認',
        disclosureUpdatedAt: '決算公告・公式開示資料の更新日を確認',
      },
      businessPosition: '現物取引、販売所、取引所形式、レバレッジ取引などの暗号資産関連事業の位置づけを確認',
      revenueSource: '取引手数料、販売所スプレッド、レバレッジ取引関連収益などの公開説明を確認',
      groupDisclosure: '公式会社概要、決算公告、グループ公開情報を確認',
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
