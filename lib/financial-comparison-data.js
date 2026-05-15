const FINANCIAL_METRICS = Object.freeze([
  {
    key: 'revenue',
    label: '営業収益 / 売上高',
    shortLabel: '売上',
    unit: '百万円',
    tone: 'scale',
    description: '本業の収益規模',
  },
  {
    key: 'operatingProfit',
    label: '営業利益',
    shortLabel: '営業益',
    unit: '百万円',
    tone: 'profit',
    description: '本業で稼いだ利益',
  },
  {
    key: 'netIncome',
    label: '当期純利益',
    shortLabel: '純利益',
    unit: '百万円',
    tone: 'profit',
    description: '最終的に残った利益',
  },
  {
    key: 'netAssets',
    label: '純資産',
    shortLabel: '純資産',
    unit: '百万円',
    tone: 'capital',
    description: '会社単体の資本の厚み',
  },
  {
    key: 'totalAssets',
    label: '総資産',
    shortLabel: '総資産',
    unit: '百万円',
    tone: 'scale',
    description: '預り資産を含む貸借対照表上の規模',
  },
  {
    key: 'equityRatio',
    label: '自己資本比率',
    shortLabel: '自己資本',
    unit: '%',
    tone: 'ratio',
    description: '純資産 / 総資産',
  },
  {
    key: 'operatingMargin',
    label: '営業利益率',
    shortLabel: '利益率',
    unit: '%',
    tone: 'ratio',
    description: '営業利益 / 営業収益',
  },
  {
    key: 'revenueYoY',
    label: '売上成長率',
    shortLabel: '成長率',
    unit: '%',
    tone: 'growth',
    description: '直近期の前年差',
  },
]);

const FINANCIAL_COMPANIES = Object.freeze([
  {
    exchangeId: 'okj',
    companyName: 'オーケーコイン・ジャパン株式会社',
    serviceName: 'OKJ',
    fiscalYearLabel: '2025年3月期',
    statementName: '第9期決算公告・計算書類',
    latest: {
      fiscalYear: 2025,
      fiscalPeriod: '2025/3',
      revenue: 2485,
      operatingProfit: 1398,
      ordinaryProfit: 1470,
      netIncome: 954,
      netAssets: 2145,
      totalAssets: 39316,
      equityRatio: 5.46,
    },
    history: [
      { fiscalYear: 2021, fiscalPeriod: '2021/3', revenue: 82, operatingProfit: -276, ordinaryProfit: -263, netIncome: -267, netAssets: 337 },
      { fiscalYear: 2022, fiscalPeriod: '2022/3', revenue: 202, operatingProfit: -314, ordinaryProfit: -293, netIncome: -387, netAssets: 503 },
      { fiscalYear: 2023, fiscalPeriod: '2023/3', revenue: 523, operatingProfit: -101, ordinaryProfit: -71, netIncome: -71, netAssets: 431 },
      { fiscalYear: 2024, fiscalPeriod: '2024/3', revenue: 1726, operatingProfit: 747, ordinaryProfit: 798, netIncome: 760, netAssets: 1191 },
      { fiscalYear: 2025, fiscalPeriod: '2025/3', revenue: 2485, operatingProfit: 1398, ordinaryProfit: 1470, netIncome: 954, netAssets: 2145 },
    ],
    tags: ['黒字化後の伸び', 'OK Group系', '3月決算'],
  },
  {
    exchangeId: 'zaif',
    companyName: '株式会社Ｚａｉｆ',
    serviceName: 'Zaif',
    fiscalYearLabel: '2025年9月期',
    statementName: '第9期事業報告書',
    path: 'https://corp.zaif.jp/business-report/',
    parentCompany: '公式会社概要では株主を株式会社ＪＮグループと記載',
    sourceSummary: 'Zaif公式会社概要・事業報告一覧、第3期（2019年12月期）から第9期（2025年9月期）までの事業報告書で確認',
    latest: {
      fiscalYear: 2025,
      fiscalPeriod: '2025/9',
      revenue: 1024,
      operatingProfit: -38,
      ordinaryProfit: -31,
      netIncome: -153,
      netAssets: 1088,
      totalAssets: 127205,
      equityRatio: 0.86,
    },
    history: [
      { fiscalYear: 2019, fiscalPeriod: '2019/12', revenue: 624, operatingProfit: -798, ordinaryProfit: -825, netIncome: -802, netAssets: 943, totalAssets: 27914, equityRatio: 3.38 },
      { fiscalYear: 2020, fiscalPeriod: '2020/12', revenue: 1184, operatingProfit: -399, ordinaryProfit: -490, netIncome: -493, netAssets: 2876, totalAssets: 70154, equityRatio: 4.1 },
      { fiscalYear: 2021, fiscalPeriod: '2021/9', revenue: 1375, operatingProfit: -204, ordinaryProfit: -193, netIncome: -1336, netAssets: 1741, totalAssets: 95713, equityRatio: 1.82 },
      { fiscalYear: 2022, fiscalPeriod: '2022/9', revenue: 724, operatingProfit: -1196, ordinaryProfit: -1198, netIncome: -929, netAssets: 1312, totalAssets: 54740, equityRatio: 2.4 },
      { fiscalYear: 2023, fiscalPeriod: '2023/9', revenue: 315, operatingProfit: -1753, ordinaryProfit: -1752, netIncome: -1747, netAssets: 630, totalAssets: 57815, equityRatio: 1.09 },
      { fiscalYear: 2024, fiscalPeriod: '2024/9', revenue: 869, operatingProfit: -257, ordinaryProfit: -257, netIncome: -339, netAssets: 927, totalAssets: 84492, equityRatio: 1.1 },
      { fiscalYear: 2025, fiscalPeriod: '2025/9', revenue: 1024, operatingProfit: -38, ordinaryProfit: -31, netIncome: -153, netAssets: 1088, totalAssets: 127205, equityRatio: 0.86 },
    ],
    sourceLinks: [
      {
        title: 'Zaif 事業報告一覧',
        href: 'https://corp.zaif.jp/business-report/',
        description: '2019年から2025年までの事業報告書への導線を確認できます。',
        meta: '公式ページ',
      },
      {
        title: '第9期（2025年9月期）事業報告書',
        href: 'https://corp.zaif.jp/hubfs/business_report_2025.pdf?hsLang=ja-jp',
        description: '2025年9月期の事業概況、貸借対照表、損益計算書を確認できます。',
        meta: 'PDF',
      },
      {
        title: 'Zaif 会社概要',
        href: 'https://corp.zaif.jp/outline/',
        description: '会社名、資本金、所在地、役員、株主、暗号資産交換業登録番号を確認できます。',
        meta: '公式ページ',
      },
    ],
    cautions: [
      '2021年9月期は9か月決算、2022年9月期以降は9月決算のため、2019年・2020年12月期との前年差は期間差を踏まえて確認しましょう。',
      '総資産には利用者暗号資産、預託金、顧客預り金などが大きく含まれるため、純資産や自己資本比率とは分けて確認しましょう。',
      '2025年9月期は営業損失が縮小した一方、固定資産等の減損損失104百万円を特別損失に計上しているため、当期純損失も確認が必要です。',
    ],
    tags: ['ＪＮグループ株主', '営業赤字縮小', '9月決算'],
  },
  {
    exchangeId: 'coincheck',
    companyName: 'コインチェック株式会社',
    serviceName: 'Coincheck',
    fiscalYearLabel: '2025年3月期',
    statementName: '第13期財務諸表・事業報告',
    latest: {
      fiscalYear: 2025,
      fiscalPeriod: '2025/3',
      revenue: 13414,
      operatingProfit: 3786,
      ordinaryProfit: 3679,
      netIncome: 2632,
      netAssets: 15154,
      totalAssets: 881153,
      equityRatio: 1.72,
    },
    history: [
      { fiscalYear: 2022, fiscalPeriod: '2022/3', revenue: 28508, operatingProfit: 13820, ordinaryProfit: 13877, netIncome: 9796, netAssets: 16144 },
      { fiscalYear: 2023, fiscalPeriod: '2023/3', revenue: 7484, operatingProfit: -835, ordinaryProfit: -712, netIncome: -485, netAssets: 10658 },
      { fiscalYear: 2024, fiscalPeriod: '2024/3', revenue: 9379, operatingProfit: 2349, ordinaryProfit: 2411, netIncome: 1863, netAssets: 12522 },
      { fiscalYear: 2025, fiscalPeriod: '2025/3', revenue: 13414, operatingProfit: 3786, ordinaryProfit: 3679, netIncome: 2632, netAssets: 15154 },
    ],
    tags: ['収益規模大', 'Nasdaq上場グループ', '3月決算'],
  },
  {
    exchangeId: 'bitflyer',
    companyName: '株式会社 bitFlyer',
    serviceName: 'bitFlyer',
    fiscalYearLabel: '2025年12月期',
    statementName: '第12期計算書類・事業報告書',
    latest: {
      fiscalYear: 2025,
      fiscalPeriod: '2025/12',
      revenue: 13567,
      operatingProfit: 4257,
      ordinaryProfit: 4415,
      netIncome: 2461,
      netAssets: 29750,
      totalAssets: 1079982,
      equityRatio: 2.75,
    },
    history: [
      { fiscalYear: 2022, fiscalPeriod: '2022/12', revenue: 7378, operatingProfit: null, ordinaryProfit: -2031, netIncome: -2194, netAssets: 25030 },
      { fiscalYear: 2023, fiscalPeriod: '2023/12', revenue: 6413, operatingProfit: null, ordinaryProfit: 627, netIncome: 436, netAssets: 19817 },
      { fiscalYear: 2024, fiscalPeriod: '2024/12', revenue: 14904, operatingProfit: 7896, ordinaryProfit: 9095, netIncome: 7471, netAssets: 27289 },
      { fiscalYear: 2025, fiscalPeriod: '2025/12', revenue: 13567, operatingProfit: 4257, ordinaryProfit: 4415, netIncome: 2461, netAssets: 29750 },
    ],
    tags: ['総資産規模大', 'bitFlyer Holdings系', '12月決算'],
  },
  {
    exchangeId: 'custodiem',
    companyName: '株式会社 Custodiem',
    serviceName: 'Custodiem',
    fiscalYearLabel: '2025年12月期',
    statementName: '第10期計算書類・業務及び財産の状況に関する説明書',
    path: 'https://www.custodiem.com/',
    parentCompany: '株式会社 bitFlyer Holdingsが直接100%保有（第10期計算書類の関連当事者注記で確認）',
    sourceSummary: 'Custodiem公式サイト、第8期から第10期までの計算書類、2025年12月期の業務及び財産の状況に関する説明書で確認',
    latest: {
      fiscalYear: 2025,
      fiscalPeriod: '2025/12',
      revenue: -28,
      operatingProfit: -471,
      ordinaryProfit: -374,
      netIncome: -272,
      netAssets: 1514,
      totalAssets: 8686,
      equityRatio: 17.43,
    },
    history: [
      { fiscalYear: 2023, fiscalPeriod: '2023/12', revenue: -262, operatingProfit: -1239, ordinaryProfit: -1241, netIncome: -1258, netAssets: 7403, totalAssets: 24509, equityRatio: 30.2 },
      { fiscalYear: 2024, fiscalPeriod: '2024/12', revenue: -633, operatingProfit: -1545, ordinaryProfit: 259, netIncome: 300, netAssets: 7703, totalAssets: 16758, equityRatio: 45.97 },
      { fiscalYear: 2025, fiscalPeriod: '2025/12', revenue: -28, operatingProfit: -471, ordinaryProfit: -374, netIncome: -272, netAssets: 1514, totalAssets: 8686, equityRatio: 17.43 },
    ],
    sourceLinks: [
      {
        title: 'Custodiem 会社概要・開示情報',
        href: 'https://www.custodiem.com/',
        description: '会社概要、暗号資産交換業登録番号、第10期事業報告、第9期・第10期計算書類、金融商品取引業に関する開示事項を確認できます。',
        meta: '公式ページ',
      },
      {
        title: '第10期（2025年12月期）計算書類',
        href: 'https://assets-3.custodiem.com/%E7%AC%AC10%E6%9C%9F%20%E8%A8%88%E7%AE%97%E6%9B%B8%E9%A1%9E.pdf',
        description: '2025年12月期の貸借対照表、損益計算書、株主資本等変動計算書、関連当事者注記を確認できます。',
        meta: 'PDF',
      },
      {
        title: '2025年12月期 業務及び財産の状況に関する説明書',
        href: 'https://assets-3.custodiem.com/2025%E5%B9%B412%E6%9C%88%E6%9C%9F%20%E6%A5%AD%E5%8B%99%E5%8F%8A%E3%81%B3%E8%B2%A1%E7%94%A3%E3%81%AE%E7%8A%B6%E6%B3%81%E3%81%AB%E9%96%A2%E3%81%99%E3%82%8B%E8%AA%AC%E6%98%8E%E6%9B%B8.pdf',
        description: '2023年12月期から2025年12月期までの経営成績、自己資本規制比率、事業状況を確認できます。',
        meta: 'PDF',
      },
    ],
    cautions: [
      '2025年12月期は取引所の売買営業を停止しており、売買事業再開とクリプトカストディ事業開始に向けた基盤整備段階として比較する必要があります。',
      '営業収益がマイナスの期を含むため、営業利益率や売上成長率は通常の収益成長指標としては扱いにくい点に注意してください。',
      '総資産には利用者暗号資産、預託金、顧客預り金などが含まれるため、自己資本や顧客預り資産の構成を個別に確認しましょう。',
    ],
    tags: ['bitFlyer Holdings傘下', '売買営業停止中', '12月決算'],
  },
  {
    exchangeId: 'bitbank',
    companyName: 'ビットバンク株式会社',
    serviceName: 'bitbank',
    fiscalYearLabel: '2025年12月期',
    statementName: '第12期計算書類・事業報告書',
    latest: {
      fiscalYear: 2025,
      fiscalPeriod: '2025/12',
      revenue: 5815,
      operatingProfit: -970,
      ordinaryProfit: -880,
      netIncome: -696,
      netAssets: 12775,
      totalAssets: 605330,
      equityRatio: 2.11,
    },
    history: [
      { fiscalYear: 2022, fiscalPeriod: '2022/12', revenue: 94, operatingProfit: -2569, ordinaryProfit: -2562, netIncome: -1967, netAssets: null },
      { fiscalYear: 2023, fiscalPeriod: '2023/12', revenue: 3863, operatingProfit: 701, ordinaryProfit: 720, netIncome: 542, netAssets: 11295 },
      { fiscalYear: 2024, fiscalPeriod: '2024/12', revenue: 7947, operatingProfit: 2799, ordinaryProfit: 2906, netIncome: 2103, netAssets: 13427 },
      { fiscalYear: 2025, fiscalPeriod: '2025/12', revenue: 5815, operatingProfit: -970, ordinaryProfit: -880, netIncome: -696, netAssets: 12775 },
    ],
    tags: ['板取引銘柄が広い', '2025年は赤字', '12月決算'],
  },
  {
    exchangeId: 'gmo',
    companyName: 'GMOコイン株式会社',
    serviceName: 'GMOコイン',
    fiscalYearLabel: '2025年12月期',
    statementName: '第10期決算公告・事業報告',
    latest: {
      fiscalYear: 2025,
      fiscalPeriod: '2025/12',
      revenue: 7398,
      operatingProfit: 3172,
      ordinaryProfit: 2559,
      netIncome: 1793,
      netAssets: 12354,
      totalAssets: 468629,
      equityRatio: 2.64,
    },
    history: [
      { fiscalYear: 2021, fiscalPeriod: '2021/12', revenue: 12067, operatingProfit: 4264, ordinaryProfit: 4468, netIncome: 3052, netAssets: 7641 },
      { fiscalYear: 2022, fiscalPeriod: '2022/12', revenue: 3676, operatingProfit: -83, ordinaryProfit: -832, netIncome: -1400, netAssets: 6241 },
      { fiscalYear: 2023, fiscalPeriod: '2023/12', revenue: 3544, operatingProfit: -106, ordinaryProfit: -487, netIncome: -392, netAssets: 10678 },
      { fiscalYear: 2024, fiscalPeriod: '2024/12', revenue: 8055, operatingProfit: 3089, ordinaryProfit: 2735, netIncome: 2518, netAssets: 10965 },
      { fiscalYear: 2025, fiscalPeriod: '2025/12', revenue: 7398, operatingProfit: 3172, ordinaryProfit: 2559, netIncome: 1793, netAssets: 12354 },
    ],
    tags: ['上場親会社', 'FX含む収益', '12月決算'],
  },
  {
    exchangeId: 'binance-japan',
    companyName: 'Binance Japan株式会社',
    serviceName: 'Binance Japan',
    fiscalYearLabel: '2025年12月期',
    statementName: '第9期財務諸表',
    latest: {
      fiscalYear: 2025,
      fiscalPeriod: '2025/12',
      revenue: 1862,
      operatingProfit: 141,
      ordinaryProfit: 180,
      netIncome: 263,
      netAssets: 17321,
      totalAssets: 129252,
      equityRatio: 13.4,
    },
    history: [
      { fiscalYear: 2022, fiscalPeriod: '2022/12', revenue: -28, operatingProfit: -437, ordinaryProfit: -438, netIncome: -467, netAssets: 408 },
      { fiscalYear: 2023, fiscalPeriod: '2023/12', revenue: 73, operatingProfit: -466, ordinaryProfit: -454, netIncome: -456, netAssets: 852 },
      { fiscalYear: 2024, fiscalPeriod: '2024/12', revenue: 1055, operatingProfit: 23, ordinaryProfit: 114, netIncome: 70, netAssets: 5491 },
      { fiscalYear: 2025, fiscalPeriod: '2025/12', revenue: 1862, operatingProfit: 141, ordinaryProfit: 180, netIncome: 263, netAssets: 17321 },
    ],
    tags: ['自己資本比率高め', 'PayPay出資', '12月決算'],
  },
  {
    exchangeId: 'sbi-vc-trade',
    companyName: 'SBI VCトレード株式会社',
    serviceName: 'SBI VCトレード',
    fiscalYearLabel: '2025年3月期',
    statementName: '第8期決算報告書・事業報告書',
    path: 'https://www.sbivc.co.jp/company-profile',
    parentCompany: 'SBIグループ100%（公式会社概要で確認）',
    sourceSummary: 'SBI VCトレード公式会社概要、第8期決算報告書・事業報告書、PR TIMES決算情報の過去決算表で確認',
    latest: {
      fiscalYear: 2025,
      fiscalPeriod: '2025/3',
      revenue: 17549,
      operatingProfit: 11720,
      ordinaryProfit: 11554,
      netIncome: 8020,
      netAssets: 17688,
      totalAssets: 407726,
      equityRatio: 4.34,
    },
    history: [
      { fiscalYear: 2021, fiscalPeriod: '2021/3', revenue: 473, operatingProfit: -673, ordinaryProfit: -691, netIncome: -79, netAssets: 1182, totalAssets: 4420, equityRatio: 26.74 },
      { fiscalYear: 2022, fiscalPeriod: '2022/3', revenue: 313, operatingProfit: -1856, ordinaryProfit: -1738, netIncome: -1929, netAssets: 7265, totalAssets: 64192, equityRatio: 11.32 },
      { fiscalYear: 2023, fiscalPeriod: '2023/3', revenue: 954, operatingProfit: -1679, ordinaryProfit: -1510, netIncome: -2006, netAssets: 5259, totalAssets: 50839, equityRatio: 10.34 },
      { fiscalYear: 2024, fiscalPeriod: '2024/3', revenue: 3662, operatingProfit: 998, ordinaryProfit: 963, netIncome: 717, netAssets: 5717, totalAssets: 154551, equityRatio: 3.7 },
      { fiscalYear: 2025, fiscalPeriod: '2025/3', revenue: 17549, operatingProfit: 11720, ordinaryProfit: 11554, netIncome: 8020, netAssets: 17688, totalAssets: 407726, equityRatio: 4.34 },
    ],
    sourceLinks: [
      {
        title: 'SBI VCトレード 会社概要・開示情報',
        href: 'https://www.sbivc.co.jp/company-profile',
        description: '会社概要、暗号資産交換業登録番号、四半期開示、決算公告、事業報告書への導線を確認できます。',
        meta: '公式ページ',
      },
      {
        title: '第8期（2025年3月期）決算報告書',
        href: 'https://www.sbivc.co.jp/profile/pdf/financial-results-08.pdf',
        description: '2025年3月期の貸借対照表、損益計算書、株主資本等変動計算書、個別注記表を確認できます。',
        meta: 'PDF',
      },
      {
        title: 'SBI VCトレード 第8期決算公告・過去決算',
        href: 'https://prtimes.com/finance/8011001116594/settlement',
        description: '第8期決算公告と過去決算の売上高、営業利益、経常利益、純利益、株主資本、総資産を確認できます。',
        meta: '決算情報',
      },
    ],
    cautions: [
      '総資産には利用者暗号資産や顧客分別金信託などが大きく含まれるため、自己資本比率は顧客預り資産の表示構造込みで確認しましょう。',
      '2025年3月期はDMM Bitcoinからの口座移管準備や銘柄追加を含む事業拡大期として、単年の伸びだけでなく継続的な収益性を確認する必要があります。',
      '営業収益は暗号資産売買等損益、受入手数料、その他で構成されるため、市況連動の影響を分けて見ましょう。',
    ],
    tags: ['SBIグループ100%', '2025年大幅増益', '3月決算'],
  },
  {
    exchangeId: 'bittrade',
    companyName: 'ビットトレード株式会社',
    serviceName: 'BitTrade',
    fiscalYearLabel: '2025年3月期',
    statementName: '第9期決算公告',
    latest: {
      fiscalYear: 2025,
      fiscalPeriod: '2025/3',
      revenue: 2187,
      operatingProfit: 604,
      ordinaryProfit: 567,
      netIncome: 566,
      netAssets: 3094,
      totalAssets: 23881,
      equityRatio: 12.96,
    },
    history: [
      { fiscalYear: 2022, fiscalPeriod: '2022/3', revenue: 380, operatingProfit: -550, ordinaryProfit: -519, netIncome: -619, netAssets: 2262 },
      { fiscalYear: 2023, fiscalPeriod: '2023/3', revenue: 399, operatingProfit: -364, ordinaryProfit: -446, netIncome: -457, netAssets: 1804 },
      { fiscalYear: 2024, fiscalPeriod: '2024/3', revenue: 2057, operatingProfit: 889, ordinaryProfit: 734, netIncome: 723, netAssets: 2527 },
      { fiscalYear: 2025, fiscalPeriod: '2025/3', revenue: 2187, operatingProfit: 604, ordinaryProfit: 567, netIncome: 566, netAssets: 3094 },
    ],
    tags: ['自己資本比率高め', '複数主要株主', '3月決算'],
  },
  {
    exchangeId: 'btcbox',
    companyName: 'BTCボックス株式会社',
    serviceName: 'BTCBOX',
    fiscalYearLabel: '2025年3月期',
    statementName: '第12期計算書類・事業報告',
    path: 'https://blog.btcbox.jp/financial-data',
    parentCompany: '株式会社TTX Holdingsが100%保有（第12期事業報告で確認）',
    sourceSummary: 'BTCBOX Blogの財務情報ページ、第8期から第12期までの計算書類、第12期事業報告で確認',
    latest: {
      fiscalYear: 2025,
      fiscalPeriod: '2025/3',
      revenue: -158,
      operatingProfit: -601,
      ordinaryProfit: -598,
      netIncome: -599,
      netAssets: 677,
      totalAssets: 12532,
      equityRatio: 5.4,
    },
    history: [
      { fiscalYear: 2021, fiscalPeriod: '2021/3', revenue: 937, operatingProfit: 584, ordinaryProfit: 589, netIncome: 496, netAssets: 1235, totalAssets: 10563, equityRatio: 11.69 },
      { fiscalYear: 2022, fiscalPeriod: '2022/3', revenue: 12, operatingProfit: -382, ordinaryProfit: -376, netIncome: -428, netAssets: 810, totalAssets: 8656, equityRatio: 9.36 },
      { fiscalYear: 2023, fiscalPeriod: '2023/3', revenue: -232, operatingProfit: -619, ordinaryProfit: -615, netIncome: -628, netAssets: 362, totalAssets: 5580, equityRatio: 6.49 },
      { fiscalYear: 2024, fiscalPeriod: '2024/3', revenue: 652, operatingProfit: 239, ordinaryProfit: 244, netIncome: 207, netAssets: 876, totalAssets: 12365, equityRatio: 7.08 },
      { fiscalYear: 2025, fiscalPeriod: '2025/3', revenue: -158, operatingProfit: -601, ordinaryProfit: -598, netIncome: -599, netAssets: 677, totalAssets: 12532, equityRatio: 5.4 },
    ],
    sourceLinks: [
      {
        title: 'BTCBOX 財務情報',
        href: 'https://blog.btcbox.jp/financial-data',
        description: '決算公告、事業報告、計算書類を一覧で確認できます。',
        meta: '公式ページ',
      },
      {
        title: '第12期（2025年3月期）計算書類',
        href: 'https://blog.btcbox.jp/wp2/wp-content/uploads/2025/07/%E7%AC%AC12%E6%9C%9F-%E8%A8%88%E7%AE%97%E6%9B%B8%E9%A1%9E.pdf',
        description: '2025年3月期の貸借対照表、損益計算書、株主資本等変動計算書、個別注記表を確認できます。',
        meta: 'PDF',
      },
      {
        title: '第12期（2025年3月期）事業報告',
        href: 'https://blog.btcbox.jp/wp2/wp-content/uploads/2025/07/%E7%AC%AC12%E6%9C%9F-%E4%BA%8B%E6%A5%AD%E5%A0%B1%E5%91%8A-%EF%BC%8820240401-20250331%EF%BC%89.pdf',
        description: '2025年3月期の事業経過、資金調達、親会社、会計監査人を確認できます。',
        meta: 'PDF',
      },
    ],
    cautions: [
      '営業収益が暗号資産売買等損益の影響でマイナスになる期があり、通常の売上成長率としては扱いにくい点に注意してください。',
      '第12期は親会社TTX Holdings引受けの第三者割当増資で資本調達を行っており、収益力と資本支援を分けて確認する必要があります。',
      '総資産には利用者暗号資産や預り金が大きく含まれるため、自己資本比率は表示構造込みで確認しましょう。',
    ],
    tags: ['TTX Holdings傘下', '営業収益マイナス期あり', '3月決算'],
  },
  {
    exchangeId: 'coinestate',
    companyName: 'FINX JCrypto株式会社',
    serviceName: 'Coin Estate',
    fiscalYearLabel: '2025年12月期（10か月）',
    statementName: '第16期財務諸表',
    path: 'https://coinestate.co.jp/company/profile/',
    parentCompany: 'FINX Fortune Ltd.が直接100%保有（第16期財務諸表の関連当事者注記で確認）',
    sourceSummary: 'FINX JCrypto公式会社概要・開示情報、第12期から第16期までの財務諸表で確認',
    latest: {
      fiscalYear: 2025,
      fiscalPeriod: '2025/12',
      revenue: 52,
      operatingProfit: -195,
      ordinaryProfit: -195,
      netIncome: -195,
      netAssets: 294,
      totalAssets: 1747,
      equityRatio: 16.82,
      revenueYoY: null,
    },
    history: [
      { fiscalYear: 2022, fiscalPeriod: '2022/2', revenue: 338, operatingProfit: -4, ordinaryProfit: -4, netIncome: -72, netAssets: 206, totalAssets: 317, equityRatio: 65.15 },
      { fiscalYear: 2023, fiscalPeriod: '2023/2', revenue: 20, operatingProfit: -472, ordinaryProfit: -470, netIncome: -524, netAssets: 135, totalAssets: 204, equityRatio: 66.25 },
      { fiscalYear: 2024, fiscalPeriod: '2024/2', revenue: 28, operatingProfit: -220, ordinaryProfit: -221, netIncome: -222, netAssets: 86, totalAssets: 155, equityRatio: 55.66 },
      { fiscalYear: 2025, fiscalPeriod: '2025/2', revenue: 14, operatingProfit: -201, ordinaryProfit: -202, netIncome: -203, netAssets: 239, totalAssets: 301, equityRatio: 79.35 },
      { fiscalYear: 2025, fiscalPeriod: '2025/12', revenue: 52, operatingProfit: -195, ordinaryProfit: -195, netIncome: -195, netAssets: 294, totalAssets: 1747, equityRatio: 16.82 },
    ],
    sourceLinks: [
      {
        title: 'FINX JCrypto 会社概要・開示情報',
        href: 'https://coinestate.co.jp/company/profile/',
        description: '会社概要、暗号資産交換業登録番号、2022年2月期から2025年12月期までの財務諸表への導線を確認できます。',
        meta: '公式ページ',
      },
      {
        title: '第16期（2025年12月期）財務諸表',
        href: 'https://coinestate.co.jp/static/resource/financial_statement_202512.pdf',
        description: '2025年3月1日から2025年12月31日までの貸借対照表、損益計算書、株主資本等変動計算書、個別注記表を確認できます。',
        meta: 'PDF',
      },
      {
        title: '第15期（2025年2月期）財務諸表',
        href: 'https://coinestate.co.jp/static/resource/financial_statement_202502.pdf',
        description: '2025年2月期の貸借対照表、損益計算書、株主資本等変動計算書、関連当事者注記を確認できます。',
        meta: 'PDF',
      },
    ],
    cautions: [
      '2025年12月期は決算期変更により2025年3月1日から2025年12月31日までの10か月決算のため、通年決算との成長率比較は期間差を踏まえて確認しましょう。',
      '総資産は利用者暗号資産と利用者預り暗号資産の増加で大きく伸びているため、自己資本や営業損益とは分けて見ましょう。',
      '2025年12月期も営業損失・当期純損失を計上しており、増資による資本支援と収益力を分けて確認する必要があります。',
    ],
    tags: ['FINX Fortune傘下', '2025年12月期は10か月', '販売所中心'],
  },
  {
    exchangeId: 'money-partners',
    companyName: '株式会社マネーパートナーズ',
    serviceName: 'マネーパートナーズ',
    fiscalYearLabel: '2025年3月期',
    statementName: '業務及び財産の状況に関する説明書',
    path: 'https://www.moneypartners.co.jp/aboutus/disclosure.html',
    parentCompany: '2025年3月末は株式会社マネーパートナーズグループが100%保有。同社は2025年2月13日に株式会社外為どっとコムの完全子会社化',
    sourceSummary: 'マネーパートナーズ公式の開示情報、2025年3月期・2024年3月期の業務及び財産の状況に関する説明書、会社概要で確認',
    latest: {
      fiscalYear: 2025,
      fiscalPeriod: '2025/3',
      revenue: 5636,
      operatingProfit: 932,
      ordinaryProfit: 955,
      netIncome: -641,
      netAssets: 9792,
      totalAssets: 50688,
      equityRatio: 19.32,
    },
    history: [
      { fiscalYear: 2023, fiscalPeriod: '2023/3', revenue: 5653, operatingProfit: 1023, ordinaryProfit: 1046, netIncome: 613, netAssets: 11106, totalAssets: 70842, equityRatio: 15.68 },
      { fiscalYear: 2024, fiscalPeriod: '2024/3', revenue: 5372, operatingProfit: 915, ordinaryProfit: 938, netIncome: 628, netAssets: 10837, totalAssets: 63939, equityRatio: 16.95 },
      { fiscalYear: 2025, fiscalPeriod: '2025/3', revenue: 5636, operatingProfit: 932, ordinaryProfit: 955, netIncome: -641, netAssets: 9792, totalAssets: 50688, equityRatio: 19.32 },
    ],
    sourceLinks: [
      {
        title: 'マネーパートナーズ 開示情報',
        href: 'https://www.moneypartners.co.jp/aboutus/disclosure.html',
        description: '自己資本規制比率と2024年3月期・2025年3月期の開示資料を確認できます。',
        meta: '公式ページ',
      },
      {
        title: '2025年3月期 業務及び財産の状況に関する説明書',
        href: 'https://www.moneypartners.co.jp/docs/aboutus/disclosure_2025.pdf',
        description: '2025年3月期の貸借対照表、損益計算書、株主資本等変動計算書、自己資本規制比率を確認できます。',
        meta: 'PDF',
      },
      {
        title: '2024年3月期 業務及び財産の状況に関する説明書',
        href: 'https://www.moneypartners.co.jp/docs/aboutus/disclosure_2024.pdf',
        description: '2023年3月期・2024年3月期の貸借対照表、損益計算書、自己資本規制比率を確認できます。',
        meta: 'PDF',
      },
    ],
    cautions: [
      '2025年3月期は営業黒字ですが、外為どっとコムとのサービス統合に関連する特別損失により当期純損失641百万円を計上しています。',
      '2025年3月期説明書では暗号資産交換業登録はあるものの業務未開始とされ、暗号資産CFDを含む金融商品取引業中心の会社として比較する必要があります。',
      '総資産には預託金、受入保証金、トレーディング商品などが含まれるため、現物暗号資産交換所の顧客預り資産構造とは分けて確認しましょう。',
    ],
    tags: ['暗号資産CFD', '外為どっとコム傘下', '3月決算'],
  },
]);

function numberOrNull(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function round(value, digits = 2) {
  const numeric = numberOrNull(value);
  if (numeric == null) return null;
  const scale = 10 ** digits;
  return Math.round(numeric * scale) / scale;
}

function latestHistoryValue(company, key) {
  for (let index = company.history.length - 1; index >= 0; index -= 1) {
    const value = numberOrNull(company.history[index][key]);
    if (value != null) return value;
  }
  return numberOrNull(company.latest[key]);
}

function previousHistoryValue(company, key) {
  let seenLatest = false;
  for (let index = company.history.length - 1; index >= 0; index -= 1) {
    const value = numberOrNull(company.history[index][key]);
    if (value == null) continue;
    if (!seenLatest) {
      seenLatest = true;
      continue;
    }
    return value;
  }
  return null;
}

function percentChange(current, previous) {
  const currentNumber = numberOrNull(current);
  const previousNumber = numberOrNull(previous);
  if (currentNumber == null || previousNumber == null || previousNumber === 0) return null;
  return round(((currentNumber - previousNumber) / Math.abs(previousNumber)) * 100, 2);
}

function positiveBasePercentChange(current, previous) {
  const currentNumber = numberOrNull(current);
  const previousNumber = numberOrNull(previous);
  if (currentNumber == null || previousNumber == null || currentNumber <= 0 || previousNumber <= 0) return null;
  return percentChange(currentNumber, previousNumber);
}

function marginPercent(profit, revenue) {
  const profitNumber = numberOrNull(profit);
  const revenueNumber = numberOrNull(revenue);
  if (profitNumber == null || revenueNumber == null || revenueNumber <= 0) return null;
  return round((profitNumber / revenueNumber) * 100, 2);
}

function addDerivedMetrics(company) {
  const latest = { ...company.latest };
  const hasLatestValue = key => Object.prototype.hasOwnProperty.call(company.latest, key);
  const revenue = numberOrNull(latest.revenue);
  const operatingProfit = numberOrNull(latest.operatingProfit);
  const netIncome = numberOrNull(latest.netIncome);

  if (!hasLatestValue('operatingMargin')) latest.operatingMargin = marginPercent(operatingProfit, revenue);
  if (!hasLatestValue('netMargin')) latest.netMargin = marginPercent(netIncome, revenue);
  if (!hasLatestValue('revenueYoY')) {
    latest.revenueYoY = positiveBasePercentChange(
      latestHistoryValue(company, 'revenue'),
      previousHistoryValue(company, 'revenue')
    );
  }
  if (!hasLatestValue('netAssetsYoY')) {
    latest.netAssetsYoY = percentChange(
      latestHistoryValue(company, 'netAssets'),
      previousHistoryValue(company, 'netAssets')
    );
  }

  return {
    ...company,
    latest,
  };
}

function getFinancialComparisonCompanies() {
  return FINANCIAL_COMPANIES.map(addDerivedMetrics);
}

module.exports = {
  FINANCIAL_METRICS,
  getFinancialComparisonCompanies,
};
