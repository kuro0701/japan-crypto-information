const FINANCIAL_METRICS = Object.freeze([
  {
    key: 'revenue',
    label: '営業収益 / 売上高',
    shortLabel: '売上',
    unit: '百万円',
    tone: 'scale',
    description: '本業の収益規模',
    help: '暗号資産売買や手数料など、本業から得た収益の規模です。大きいほど事業規模を把握しやすい一方、利益とは分けて確認します。',
  },
  {
    key: 'operatingProfit',
    label: '営業利益',
    shortLabel: '営業益',
    unit: '百万円',
    tone: 'profit',
    description: '本業で稼いだ利益',
    help: '営業収益から営業費用を差し引いた本業の利益です。黒字なら通常営業で利益が出ている目安になります。',
  },
  {
    key: 'netIncome',
    label: '当期純利益',
    shortLabel: '純利益',
    unit: '百万円',
    tone: 'profit',
    description: '最終的に残った利益',
    help: '税金や特別損益まで含め、最終的に残った利益です。一時的な損益が混ざることがあるため営業利益と合わせて見ます。',
  },
  {
    key: 'netAssets',
    label: '純資産',
    shortLabel: '純資産',
    unit: '百万円',
    tone: 'capital',
    description: '会社単体の資本の厚み',
    help: '資産から負債を引いた会社の資本です。一般に厚いほど損失を受け止める余力の目安になります。',
  },
  {
    key: 'totalAssets',
    label: '総資産',
    shortLabel: '総資産',
    unit: '百万円',
    tone: 'scale',
    description: '預り資産を含む貸借対照表上の規模',
    help: '貸借対照表上の資産規模です。取引所では利用者暗号資産や預り金が大きく含まれるため、会社固有の資産規模とは分けて見ます。',
  },
  {
    key: 'equityRatio',
    label: '自己資本比率',
    shortLabel: '自己資本',
    unit: '%',
    tone: 'ratio',
    description: '純資産 / 総資産',
    help: '総資産に対する純資産の割合です。一般に高いほど財務安定性の目安になりますが、取引所では預り資産の影響で低く見える場合があります。',
  },
  {
    key: 'operatingMargin',
    label: '営業利益率',
    shortLabel: '利益率',
    unit: '%',
    tone: 'ratio',
    description: '営業利益 / 営業収益',
    help: '営業収益のうち、営業利益として残った割合です。高いほど本業の収益性が高い目安になります。',
  },
  {
    key: 'revenueYoY',
    label: '売上成長率',
    shortLabel: '成長率',
    unit: '%',
    tone: 'growth',
    description: '直近期の前年差',
    help: '直近期の営業収益が前期からどれだけ増減したかを示します。決算期間が違う会社は単純比較しすぎないよう注意します。',
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
    exchangeId: 'mercoin',
    companyName: '株式会社メルコイン',
    serviceName: 'メルコイン',
    fiscalYearLabel: '2025年6月期',
    statementName: '第5期計算書類',
    path: 'https://about.mercoin.com/disclosure/',
    parentCompany: '株式会社メルカリが直接100%保有（第5期計算書類の関連当事者注記で確認）',
    sourceSummary: 'メルコイン公式開示資料、第2期（2022年6月期）から第5期（2025年6月期）までの計算書類で確認',
    latest: {
      fiscalYear: 2025,
      fiscalPeriod: '2025/6',
      revenue: 1742,
      operatingProfit: -941,
      ordinaryProfit: -955,
      netIncome: -708,
      netAssets: 3515,
      totalAssets: 34369,
      equityRatio: 10.23,
    },
    history: [
      { fiscalYear: 2022, fiscalPeriod: '2022/6', revenue: 0, operatingProfit: -1315, ordinaryProfit: -1315, netIncome: -1336, netAssets: 353, totalAssets: 585, equityRatio: 60.34 },
      { fiscalYear: 2023, fiscalPeriod: '2023/6', revenue: 51, operatingProfit: -2375, ordinaryProfit: -2373, netIncome: -1846, netAssets: 2306, totalAssets: 4155, equityRatio: 55.5 },
      { fiscalYear: 2024, fiscalPeriod: '2024/6', revenue: 815, operatingProfit: -1896, ordinaryProfit: -1902, netIncome: -1242, netAssets: 3404, totalAssets: 19320, equityRatio: 17.62 },
      { fiscalYear: 2025, fiscalPeriod: '2025/6', revenue: 1742, operatingProfit: -941, ordinaryProfit: -955, netIncome: -708, netAssets: 3515, totalAssets: 34369, equityRatio: 10.23 },
    ],
    sourceLinks: [
      {
        title: 'メルコイン 開示資料',
        href: 'https://about.mercoin.com/disclosure/',
        description: '第2期から第5期までの計算書類への導線を確認できます。',
        meta: '公式ページ',
      },
      {
        title: '第5期（2025年6月期）計算書類',
        href: 'https://about.mercoin.com/disclosure/dai5kikeisanshorui.pdf',
        description: '2025年6月期の貸借対照表、損益計算書、株主資本等変動計算書、関連当事者注記を確認できます。',
        meta: 'PDF',
      },
      {
        title: '第2期（2022年6月期）計算書類',
        href: 'https://about.mercoin.com/disclosure/dai2kikeisanshorui.pdf',
        description: '2022年6月期の貸借対照表、損益計算書、株主資本等変動計算書を確認できます。',
        meta: 'PDF',
      },
    ],
    cautions: [
      '2025年6月期は営業収益が1,742百万円まで伸びた一方、営業損失941百万円、当期純損失708百万円で、収益拡大と黒字化の進捗を分けて確認しましょう。',
      '総資産には利用者暗号資産28,919百万円と預託金などが大きく含まれるため、純資産や自己資本比率とは分けて見ましょう。',
      '株式会社メルカリが直接100%保有し、増資や借入などの関連当事者取引があるため、単体決算と親会社による資本支援をあわせて確認しましょう。',
    ],
    tags: ['メルカリ100%', '営業収益拡大', '6月決算'],
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
    exchangeId: 'crypto-garage',
    companyName: '株式会社Crypto Garage',
    serviceName: 'Crypto Garage',
    fiscalYearLabel: '2025年3月期',
    statementName: '第7期公表書類',
    path: 'https://cryptogarage.co.jp/',
    parentCompany: 'デジタルガレージ、東京短資、野村ホールディングスなどが出資（公式サイト・会社概要で確認）',
    sourceSummary: 'Crypto Garage公式サイトの公表書類、2022年3月期から2025年3月期までの公表用計算書類、公式会社概要で確認',
    latest: {
      fiscalYear: 2025,
      fiscalPeriod: '2025/3',
      revenue: 315,
      operatingProfit: -461,
      ordinaryProfit: -461,
      netIncome: -549,
      netAssets: 176,
      totalAssets: 27211,
      equityRatio: 0.65,
    },
    history: [
      { fiscalYear: 2022, fiscalPeriod: '2022/3', revenue: 0, operatingProfit: -446, ordinaryProfit: -456, netIncome: -457, netAssets: 1505, totalAssets: 1553, equityRatio: 96.97 },
      { fiscalYear: 2023, fiscalPeriod: '2023/3', revenue: 7, operatingProfit: -513, ordinaryProfit: -523, netIncome: -524, netAssets: 981, totalAssets: 1226, equityRatio: 80.0 },
      { fiscalYear: 2024, fiscalPeriod: '2024/3', revenue: 412, operatingProfit: -334, ordinaryProfit: -252, netIncome: -256, netAssets: 725, totalAssets: 828, equityRatio: 87.63 },
      { fiscalYear: 2025, fiscalPeriod: '2025/3', revenue: 315, operatingProfit: -461, ordinaryProfit: -461, netIncome: -549, netAssets: 176, totalAssets: 27211, equityRatio: 0.65 },
    ],
    sourceLinks: [
      {
        title: 'Crypto Garage 第7期（2025年3月期）公表書類',
        href: 'https://cryptogarage.co.jp/wp-content/uploads/2025/07/Crypto-Garage_%E7%AC%AC7%E6%9C%9F_%E5%85%AC%E8%A1%A8%E7%94%A8.pdf',
        description: '2025年3月期の貸借対照表、損益計算書、株主資本等変動計算書、個別注記表を確認できます。',
        meta: 'PDF',
      },
      {
        title: 'Crypto Garage 会社概要',
        href: 'https://cryptogarage.co.jp/about/',
        description: '会社名、所在地、代表者、暗号資産交換業登録番号、出資企業を確認できます。',
        meta: '公式ページ',
      },
      {
        title: 'Crypto Garage 第6期（2024年3月期）公表書類',
        href: 'https://cryptogarage.co.jp/wp-content/uploads/2024/06/Crypto-Garage_%E7%AC%AC6%E6%9C%9F_%E5%85%AC%E8%A1%A8%E7%94%A8.pdf',
        description: '2024年3月期の貸借対照表、損益計算書、株主資本等変動計算書を確認できます。',
        meta: 'PDF',
      },
    ],
    cautions: [
      '2025年3月期は利用者暗号資産26,608百万円が総資産と預り暗号資産に大きく反映され、自己資本比率が前期から大きく低下しています。',
      '2025年3月期は売上高315百万円、営業損失461百万円、当期純損失549百万円で、カストディ・OTC・web3開発など法人向け事業の投資段階として確認しましょう。',
      '2022年3月期の損益計算書は売上高の表示がなく、複数年の売上成長率は公表書類の表示差を踏まえて確認する必要があります。',
    ],
    tags: ['法人向けカストディ', 'Digital Garage系', '3月決算'],
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
    exchangeId: 'cointrade',
    companyName: '株式会社マーキュリー',
    serviceName: 'CoinTrade',
    fiscalYearLabel: '2025年12月期',
    statementName: '第9期貸借対照表及び損益計算書',
    path: 'https://coin-trade.cc/about/company/disclosure/',
    parentCompany: '株式会社セレスが直接100%保有（公式会社概要・第9期関連当事者注記で確認）',
    sourceSummary: 'CoinTrade公式会社概要・開示資料、第5期（2021年12月期）から第9期（2025年12月期）までの貸借対照表及び損益計算書で確認',
    latest: {
      fiscalYear: 2025,
      fiscalPeriod: '2025/12',
      revenue: -90,
      operatingProfit: -992,
      ordinaryProfit: -993,
      netIncome: -856,
      netAssets: 963,
      totalAssets: 2618,
      equityRatio: 36.78,
    },
    history: [
      { fiscalYear: 2021, fiscalPeriod: '2021/12', revenue: 23, operatingProfit: -537, ordinaryProfit: -541, netIncome: -900, netAssets: 486, totalAssets: 872, equityRatio: 55.78 },
      { fiscalYear: 2022, fiscalPeriod: '2022/12', revenue: -75, operatingProfit: -893, ordinaryProfit: -895, netIncome: -826, netAssets: 610, totalAssets: 1144, equityRatio: 53.32 },
      { fiscalYear: 2023, fiscalPeriod: '2023/12', revenue: 174, operatingProfit: -728, ordinaryProfit: -731, netIncome: -819, netAssets: 691, totalAssets: 1941, equityRatio: 35.6 },
      { fiscalYear: 2024, fiscalPeriod: '2024/12', revenue: 316, operatingProfit: -540, ordinaryProfit: -542, netIncome: -573, netAssets: 1018, totalAssets: 3119, equityRatio: 32.65 },
      { fiscalYear: 2025, fiscalPeriod: '2025/12', revenue: -90, operatingProfit: -992, ordinaryProfit: -993, netIncome: -856, netAssets: 963, totalAssets: 2618, equityRatio: 36.78 },
    ],
    sourceLinks: [
      {
        title: 'CoinTrade 開示資料',
        href: 'https://coin-trade.cc/about/company/disclosure/',
        description: '第5期から第9期までの決算公告、貸借対照表及び損益計算書への導線を確認できます。',
        meta: '公式ページ',
      },
      {
        title: '第9期（2025年12月期）貸借対照表及び損益計算書',
        href: 'https://coin-trade.cc/assets/pdf/about/company/disclosure/balancesheet_202512.pdf',
        description: '2025年12月期の貸借対照表、損益計算書、株主資本等変動計算書、個別注記表を確認できます。',
        meta: 'PDF',
      },
      {
        title: 'CoinTrade 会社概要',
        href: 'https://coin-trade.cc/about/company/',
        description: '会社名、資本金、所在地、株主、関係会社、暗号資産交換業登録番号を確認できます。',
        meta: '公式ページ',
      },
    ],
    cautions: [
      '2025年12月期は暗号資産売買等損益の影響で営業収益がマイナスとなり、営業損失992百万円、当期純損失856百万円を計上しています。',
      '第9期は親会社セレス引受けの第三者割当増資800百万円、関係会社取引、グループ通算税制の影響もあわせて確認しましょう。',
      '総資産には利用者暗号資産、預託金、利用者からの預り金などが含まれるため、純資産や自己資本比率とは分けて見ましょう。',
    ],
    tags: ['セレス100%', '営業収益マイナス期あり', '12月決算'],
  },
  {
    exchangeId: 'backseat-exchange',
    companyName: 'BACKSEAT 暗号資産交換業株式会社',
    serviceName: 'BACKSEAT Exchange',
    fiscalYearLabel: '2025年3月期',
    statementName: '第8期財務諸表・事業報告書',
    path: 'https://www.backseat-exchange.com/about',
    parentCompany: 'BACKSEAT株式会社が100%保有（公式会社概要・第8期事業報告書で確認）',
    sourceSummary: 'BACKSEAT公式会社概要、第5期から第8期までの事業報告書・財務諸表で確認。第7期までは株式会社coinbook名義',
    latest: {
      fiscalYear: 2025,
      fiscalPeriod: '2025/3',
      revenue: 113,
      operatingProfit: -462,
      ordinaryProfit: -465,
      netIncome: -171,
      netAssets: 249,
      totalAssets: 6658,
      equityRatio: 3.74,
    },
    history: [
      { fiscalYear: 2022, fiscalPeriod: '2022/3', revenue: 7, operatingProfit: -373, ordinaryProfit: -413, netIncome: -796, netAssets: 105, totalAssets: 244, equityRatio: 43.07 },
      { fiscalYear: 2023, fiscalPeriod: '2023/3', revenue: 11, operatingProfit: -442, ordinaryProfit: -437, netIncome: -471, netAssets: 134, totalAssets: 317, equityRatio: 42.41 },
      { fiscalYear: 2024, fiscalPeriod: '2024/3', revenue: 872, operatingProfit: 290, ordinaryProfit: 287, netIncome: 286, netAssets: 421, totalAssets: 27626, equityRatio: 1.52 },
      { fiscalYear: 2025, fiscalPeriod: '2025/3', revenue: 113, operatingProfit: -462, ordinaryProfit: -465, netIncome: -171, netAssets: 249, totalAssets: 6658, equityRatio: 3.74 },
    ],
    sourceLinks: [
      {
        title: 'BACKSEAT 会社概要・開示情報',
        href: 'https://www.backseat-exchange.com/about',
        description: '会社名、所在地、資本金、株主、暗号資産交換業登録番号、第5期から第8期までの開示資料への導線を確認できます。',
        meta: '公式ページ',
      },
      {
        title: '第8期（2025年3月期）財務諸表',
        href: 'https://www.backseat-exchange.com/_files/ugd/e89f1d_c8f3ceb6fdec47da9d6e995559e1fa1c.pdf',
        description: '2025年3月期の貸借対照表、損益計算書、株主資本等変動計算書、個別注記表を確認できます。',
        meta: 'PDF',
      },
      {
        title: '第8期（2025年3月期）事業報告書',
        href: 'https://www.backseat-exchange.com/_files/ugd/e89f1d_e3fe261e107f4c0180a6ba209d545399.pdf',
        description: '2025年3月期の事業経過、3期推移、親会社による完全子会社化、主要株主、監査人を確認できます。',
        meta: 'PDF',
      },
    ],
    cautions: [
      '第8期はBACKSEAT株式会社による完全子会社化と経営体制変更後の期で、旧coinbook期との連続性を踏まえて確認しましょう。',
      '2025年3月期は営業損失462百万円、当期純損失171百万円ですが、債務免除益460百万円と特別損失165百万円の影響もあわせて確認が必要です。',
      '総資産には利用者暗号資産や利用者からの預り金が大きく含まれるため、純資産や自己資本比率とは分けて見ましょう。',
    ],
    tags: ['BACKSEAT100%', '旧coinbook', '3月決算'],
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
    exchangeId: 'gate-japan',
    companyName: 'Gate Japan株式会社',
    serviceName: 'Gate Japan',
    fiscalYearLabel: '2025年12月期（8か月）',
    statementName: '第10期計算書類等',
    path: 'https://www.gate.com/ja-jp/about-us#Company',
    parentCompany: 'Gate Information PTE.LTDが直接100%保有（第10期計算書類等の関連当事者注記で確認）',
    sourceSummary: 'Gate Japan公式会社概要、第6期から第10期までの事業報告書・計算書類等で確認。第8期まではCoin Master株式会社名義',
    latest: {
      fiscalYear: 2025,
      fiscalPeriod: '2025/12',
      revenue: -13,
      operatingProfit: -370,
      ordinaryProfit: -370,
      netIncome: -370,
      netAssets: 1020,
      totalAssets: 1096,
      equityRatio: 93.05,
      revenueYoY: null,
    },
    history: [
      { fiscalYear: 2021, fiscalPeriod: '2021/4', revenue: 15, operatingProfit: null, ordinaryProfit: -390, netIncome: -396, netAssets: 284, totalAssets: 2422, equityRatio: 11.71 },
      { fiscalYear: 2022, fiscalPeriod: '2022/4', revenue: -100, operatingProfit: -677, ordinaryProfit: -677, netIncome: -797, netAssets: 237, totalAssets: 852, equityRatio: 27.78 },
      { fiscalYear: 2023, fiscalPeriod: '2023/4', revenue: -20, operatingProfit: -405, ordinaryProfit: -389, netIncome: -433, netAssets: 29, totalAssets: 356, equityRatio: 8.22 },
      { fiscalYear: 2024, fiscalPeriod: '2024/4', revenue: 13, operatingProfit: -181, ordinaryProfit: -181, netIncome: -494, netAssets: -218, totalAssets: 311, equityRatio: -70.22 },
      { fiscalYear: 2025, fiscalPeriod: '2025/4', revenue: -38, operatingProfit: -314, ordinaryProfit: -317, netIncome: -326, netAssets: 270, totalAssets: 348, equityRatio: 77.53 },
      { fiscalYear: 2025, fiscalPeriod: '2025/12', revenue: -13, operatingProfit: -370, ordinaryProfit: -370, netIncome: -370, netAssets: 1020, totalAssets: 1096, equityRatio: 93.05 },
    ],
    sourceLinks: [
      {
        title: 'Gate Japan 会社概要・開示情報',
        href: 'https://www.gate.com/ja-jp/about-us#Company',
        description: '会社名、登録番号、資本金、所在地、経営体制、第6期から第10期までの開示資料への導線を確認できます。',
        meta: '公式ページ',
      },
      {
        title: '第10期（2025年12月期）計算書類等',
        href: 'https://gimg2.staticimgs.com/docs/10_20260318_162037_b7114d6d9c458d66fa17b83343b0567d.pdf',
        description: '2025年5月1日から2025年12月31日までの貸借対照表、損益計算書、株主資本等変動計算書、関連当事者注記を確認できます。',
        meta: 'PDF',
      },
      {
        title: '第9期（2025年4月期）計算書類等',
        href: 'https://gimg-jp.gateimg.com/image/_2024hp202507311614030930137709.pdf',
        description: '2024年5月1日から2025年4月30日までの貸借対照表、損益計算書、後発事象の第三者割当増資を確認できます。',
        meta: 'PDF',
      },
    ],
    cautions: [
      '第10期は2025年5月1日から2025年12月31日までの8か月決算のため、通年決算との成長率比較は期間差を踏まえて確認しましょう。',
      '2025年12月期は親会社Gate Information PTE.LTDによる増資後の高い自己資本比率で、営業損失と資本支援を分けて見る必要があります。',
      '営業収益が暗号資産売買等損益の影響でマイナスになる期があり、通常の売上成長率や営業利益率としては扱いにくい点に注意してください。',
    ],
    tags: ['Gate Information傘下', '第10期は8か月', '営業赤字'],
  },
  {
    exchangeId: 'osl-japan',
    companyName: 'OSL Japan株式会社',
    serviceName: 'OSL Japan',
    fiscalYearLabel: '2025年7月期',
    statementName: '2025年7月期事業年度',
    path: 'https://www.osl.com/jp/cms/report',
    parentCompany: '香港上場会社OSL Groupの一員（公式会社概要で確認）',
    sourceSummary: 'OSL Japan公式の事業年度報告ページ、会社概要、2021年7月期から2025年7月期までの貸借対照表・損益計算書で確認',
    latest: {
      fiscalYear: 2025,
      fiscalPeriod: '2025/7',
      revenue: 374,
      operatingProfit: -147,
      ordinaryProfit: -123,
      netIncome: -228,
      netAssets: 547,
      totalAssets: 2199,
      equityRatio: 24.88,
    },
    history: [
      { fiscalYear: 2021, fiscalPeriod: '2021/7', revenue: 10, operatingProfit: -217, ordinaryProfit: -218, netIncome: -218, netAssets: 49, totalAssets: 351, equityRatio: 14.05 },
      { fiscalYear: 2022, fiscalPeriod: '2022/7', revenue: 2917, operatingProfit: 411, ordinaryProfit: 419, netIncome: 419, netAssets: 588, totalAssets: 1279, equityRatio: 46.0 },
      { fiscalYear: 2023, fiscalPeriod: '2023/7', revenue: 173, operatingProfit: -336, ordinaryProfit: -335, netIncome: -421, netAssets: 218, totalAssets: 916, equityRatio: 23.76 },
      { fiscalYear: 2024, fiscalPeriod: '2024/7', revenue: 87, operatingProfit: -287, ordinaryProfit: -286, netIncome: 41, netAssets: 259, totalAssets: 1607, equityRatio: 16.1 },
      { fiscalYear: 2025, fiscalPeriod: '2025/7', revenue: 374, operatingProfit: -147, ordinaryProfit: -123, netIncome: -228, netAssets: 547, totalAssets: 2199, equityRatio: 24.88 },
    ],
    sourceLinks: [
      {
        title: 'OSL Japan 事業年度報告',
        href: 'https://www.osl.com/jp/cms/report',
        description: '2021年7月期から2025年7月期までの事業年度報告への導線を確認できます。',
        meta: '公式ページ',
      },
      {
        title: '2025年7月期事業年度',
        href: 'https://www.osl.com/jp/public/cdn/public_file/2025/11/99bdfd54c4ab97867b8fc5596c772b24.pdf',
        description: '2025年7月期の貸借対照表と損益計算書を確認できます。',
        meta: 'PDF',
      },
      {
        title: 'OSL Japan 会社概要',
        href: 'https://www.osl.com/jp/cms/company',
        description: '旧CoinBest株式会社からの社名変更、OSL Groupとの関係、会社名、登録番号、資本金を確認できます。',
        meta: '公式ページ',
      },
    ],
    cautions: [
      '2024年7月期までは旧社名CoinBest株式会社での報告として公開されているため、社名変更前後をまたぐ推移として確認しましょう。',
      '2025年7月期は営業損失147百万円、当期純損失228百万円で、特別損失105百万円の影響もあわせて確認が必要です。',
      '2022年7月期は営業収益が大きく伸びた期で、2023年7月期以降の収益規模とは市況や取引量の違いを分けて見ましょう。',
    ],
    tags: ['OSL Group系', '旧CoinBest', '7月決算'],
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
    exchangeId: 'sblox',
    companyName: 'S.BLOX株式会社',
    serviceName: 'S.BLOX',
    fiscalYearLabel: '2025年3月期',
    statementName: '第8期計算書類・事業報告',
    path: 'https://www.sblox.jp/ja-jp/company/',
    parentCompany: 'Quetta Web株式会社が直接100%保有、ソニーグループ株式会社の間接100%子会社（会社概要・関連当事者注記で確認）',
    sourceSummary: 'S.BLOX公式会社概要、公式サイト内の第2期から第8期までの財務諸表・事業報告書で確認',
    latest: {
      fiscalYear: 2025,
      fiscalPeriod: '2025/3',
      revenue: 122,
      operatingProfit: -609,
      ordinaryProfit: -609,
      netIncome: -647,
      netAssets: 1448,
      totalAssets: 3796,
      equityRatio: 38.14,
    },
    history: [
      { fiscalYear: 2020, fiscalPeriod: '2020/3', revenue: 48, operatingProfit: -3994, ordinaryProfit: -4013, netIncome: -4416, netAssets: 2808, totalAssets: 4620, equityRatio: 60.79 },
      { fiscalYear: 2021, fiscalPeriod: '2021/3', revenue: 498, operatingProfit: -2340, ordinaryProfit: -2366, netIncome: -2384, netAssets: 9879, totalAssets: 13055, equityRatio: 75.67 },
      { fiscalYear: 2022, fiscalPeriod: '2022/3', revenue: 149, operatingProfit: -2888, ordinaryProfit: -2892, netIncome: -4676, netAssets: 1055, totalAssets: 4063, equityRatio: 25.96 },
      { fiscalYear: 2023, fiscalPeriod: '2023/3', revenue: -219, operatingProfit: -1278, ordinaryProfit: -1283, netIncome: -1284, netAssets: 371, totalAssets: 2004, equityRatio: 18.51 },
      { fiscalYear: 2024, fiscalPeriod: '2024/3', revenue: 309, operatingProfit: -413, ordinaryProfit: -405, netIncome: -93, netAssets: 1095, totalAssets: 3738, equityRatio: 29.29 },
      { fiscalYear: 2025, fiscalPeriod: '2025/3', revenue: 122, operatingProfit: -609, ordinaryProfit: -609, netIncome: -647, netAssets: 1448, totalAssets: 3796, equityRatio: 38.14 },
    ],
    sourceLinks: [
      {
        title: 'S.BLOX 会社概要',
        href: 'https://www.sblox.jp/ja-jp/company/',
        description: '会社名、所在地、暗号資産交換業登録番号、加盟協会などを確認できます。',
        meta: '公式ページ',
      },
      {
        title: '第8期（2025年3月期）計算書類',
        href: 'https://static.sblox.jp/history/%E8%B2%A1%E5%8B%99%E8%AB%B8%E8%A1%A8_%E7%AC%AC8%E6%9C%9F%EF%BC%88%E4%BB%A4%E5%92%8C06%E5%B9%B404%E6%9C%88-%E4%BB%A4%E5%92%8C07%E5%B9%B403%E6%9C%88%EF%BC%89.pdf',
        description: '2025年3月期の貸借対照表、損益計算書、株主資本等変動計算書、個別注記表を確認できます。',
        meta: 'PDF',
      },
      {
        title: '第8期（2025年3月期）事業報告',
        href: 'https://static.sblox.jp/history/%E4%BA%8B%E6%A5%AD%E5%A0%B1%E5%91%8A%E6%9B%B8_%E7%AC%AC8%E6%9C%9F%EF%BC%88%E4%BB%A4%E5%92%8C06%E5%B9%B404%E6%9C%88-%E4%BB%A4%E5%92%8C07%E5%B9%B403%E6%9C%88%EF%BC%89.pdf',
        description: '2021年度から2024年度までの営業成績、リニューアル状況、役員、会計監査人を確認できます。',
        meta: 'PDF',
      },
    ],
    cautions: [
      '2025年1月に暗号資産取引サービスをS.BLOXへリニューアルしており、旧Amber Japan・旧WhaleFin期を含む推移として確認しましょう。',
      '2025年3月期は営業収益122百万円、営業損失609百万円、当期純損失647百万円で、貸倒損失269百万円など単年度要因もあわせて確認が必要です。',
      '総資産には利用者暗号資産、預託金、利用者からの預り金などが含まれるため、純資産や自己資本比率とは分けて見ましょう。',
    ],
    tags: ['ソニーグループ傘下', '2025年1月リニューアル', '3月決算'],
  },
  {
    exchangeId: 'digital-asset-markets',
    companyName: '株式会社デジタルアセットマーケッツ',
    serviceName: 'Digital Asset Markets',
    fiscalYearLabel: '2025年3月期',
    statementName: '第8期計算書類',
    path: 'https://corp.digiasset.co.jp/disclosure',
    parentCompany: '主要株主にインタートレード、三井物産、日本取引所グループ、マネックスグループなどを記載（公式会社概要で確認）',
    sourceSummary: 'デジタルアセットマーケッツ公式開示情報、第2期（2019年9月期）から第8期（2025年3月期）までの決算報告書・計算書類、公式会社概要で確認',
    latest: {
      fiscalYear: 2025,
      fiscalPeriod: '2025/3',
      revenue: 36,
      operatingProfit: -691,
      ordinaryProfit: -691,
      netIncome: -738,
      netAssets: 348,
      totalAssets: 564,
      equityRatio: 61.8,
    },
    history: [
      { fiscalYear: 2021, fiscalPeriod: '2021/3', revenue: 10, operatingProfit: -630, ordinaryProfit: -629, netIncome: -630, netAssets: 642, totalAssets: 788, equityRatio: 81.39 },
      { fiscalYear: 2022, fiscalPeriod: '2022/3', revenue: 23, operatingProfit: -783, ordinaryProfit: -783, netIncome: -784, netAssets: 1188, totalAssets: 1357, equityRatio: 87.54 },
      { fiscalYear: 2023, fiscalPeriod: '2023/3', revenue: 1, operatingProfit: -923, ordinaryProfit: -923, netIncome: -960, netAssets: 746, totalAssets: 946, equityRatio: 78.85 },
      { fiscalYear: 2024, fiscalPeriod: '2024/3', revenue: 101, operatingProfit: -816, ordinaryProfit: -816, netIncome: -850, netAssets: 436, totalAssets: 610, equityRatio: 71.47 },
      { fiscalYear: 2025, fiscalPeriod: '2025/3', revenue: 36, operatingProfit: -691, ordinaryProfit: -691, netIncome: -738, netAssets: 348, totalAssets: 564, equityRatio: 61.8 },
    ],
    sourceLinks: [
      {
        title: 'デジタルアセットマーケッツ 開示情報',
        href: 'https://corp.digiasset.co.jp/disclosure',
        description: '2025年3月期（第8期）から2019年9月期（第2期）までの計算書類・決算報告書への導線を確認できます。',
        meta: '公式ページ',
      },
      {
        title: '第8期（2025年3月期）計算書類',
        href: 'https://www.digiasset.co.jp/pdf/report/8th_report.pdf',
        description: '2025年3月期の貸借対照表、損益計算書、株主資本等変動計算書、個別注記表を確認できます。',
        meta: 'PDF',
      },
      {
        title: 'デジタルアセットマーケッツ 会社概要',
        href: 'https://corp.digiasset.co.jp/aboutus',
        description: '会社名、所在地、暗号資産交換業登録番号、資本金、主要株主、加入協会を確認できます。',
        meta: '公式ページ',
      },
    ],
    cautions: [
      '2025年3月期は売上高36百万円、営業損失691百万円、当期純損失738百万円で、先行投資と減損損失45百万円を分けて確認しましょう。',
      '総資産には利用者暗号資産、利用者区分管理信託、利用者からの預り金などが含まれるため、純資産や自己資本比率とは分けて見ましょう。',
      '主要株主が複数に分散しているため、単体の決算推移に加えて主要株主・関連会社からの資本支援状況も確認しましょう。',
    ],
    tags: ['ZPG取扱い', '先行投資フェーズ', '3月決算'],
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
    exchangeId: 'gaia-btm',
    companyName: '株式会社ガイア',
    serviceName: 'GAIA BTM',
    fiscalYearLabel: '2025年11月期',
    statementName: '第18期事業報告・計算書類',
    path: 'https://www.gaia-btm.com/company/',
    parentCompany: '親会社なし。第18期事業報告書では小倉基宏氏が100%保有',
    sourceSummary: 'ガイア公式会社概要、第15期から第18期までの事業報告・計算書類で確認',
    latest: {
      fiscalYear: 2025,
      fiscalPeriod: '2025/11',
      revenue: 123,
      operatingProfit: -36,
      ordinaryProfit: -31,
      netIncome: -29,
      netAssets: 71,
      totalAssets: 157,
      equityRatio: 45.44,
    },
    history: [
      { fiscalYear: 2022, fiscalPeriod: '2022/11', revenue: 212, operatingProfit: -6, ordinaryProfit: 1, netIncome: 15, netAssets: 63, totalAssets: 272, equityRatio: 23.24 },
      { fiscalYear: 2023, fiscalPeriod: '2023/11', revenue: 158, operatingProfit: 15, ordinaryProfit: 27, netIncome: 27, netAssets: 90, totalAssets: 247, equityRatio: 36.44 },
      { fiscalYear: 2024, fiscalPeriod: '2024/11', revenue: 153, operatingProfit: 7, ordinaryProfit: 14, netIncome: 11, netAssets: 100, totalAssets: 217, equityRatio: 46.22 },
      { fiscalYear: 2025, fiscalPeriod: '2025/11', revenue: 123, operatingProfit: -36, ordinaryProfit: -31, netIncome: -29, netAssets: 71, totalAssets: 157, equityRatio: 45.44 },
    ],
    sourceLinks: [
      {
        title: 'ガイア 会社概要・事業報告書',
        href: 'https://www.gaia-btm.com/company/',
        description: '会社名、登録番号、所在地、資本金、事業内容、第15期から第18期までの事業報告書への導線を確認できます。',
        meta: '公式ページ',
      },
      {
        title: '第18期（2025年11月期）事業報告・計算書類',
        href: 'https://www.gaia-btm.com/financial_statements_18.pdf',
        description: '2025年11月期の事業報告、貸借対照表、損益計算書、株主資本等変動計算書、個別注記表を確認できます。',
        meta: 'PDF',
      },
      {
        title: '第17期（2024年11月期）事業報告・計算書類',
        href: 'https://www.gaia-btm.com/financial_statements_17.pdf',
        description: '2024年11月期の事業報告、貸借対照表、損益計算書、株主資本等変動計算書を確認できます。',
        meta: 'PDF',
      },
    ],
    cautions: [
      '第15期は2021年6月18日から2022年11月30日までの変則期間を含むため、通年決算との成長率比較は期間差を踏まえて確認しましょう。',
      '2025年11月期は売上高123百万円、営業損失36百万円、当期純損失29百万円で、一見両替サービス開始後の利用者拡大と収益化を分けて確認する必要があります。',
      '暗号資産BTMサービス中心の小規模事業者であり、総資産や預り資産の構造は大規模取引所と単純比較しにくい点に注意してください。',
    ],
    tags: ['暗号資産BTM', '小倉基宏氏100%', '11月決算'],
  },
  {
    exchangeId: 'tokyo-hash',
    companyName: '東京ハッシュ株式会社',
    serviceName: 'Tokyo Hash',
    fiscalYearLabel: '2025年12月期',
    statementName: '第8期計算書類',
    path: 'https://www.tokyohash.co.jp/company/profile/',
    parentCompany: 'HashKey Digital Asset Group Limitedが株主（公式会社概要で確認）',
    sourceSummary: '東京ハッシュ公式会社概要、第4期から第8期までの計算書類で確認',
    latest: {
      fiscalYear: 2025,
      fiscalPeriod: '2025/12',
      revenue: -85,
      operatingProfit: -286,
      ordinaryProfit: -219,
      netIncome: -219,
      netAssets: 92,
      totalAssets: 463,
      equityRatio: 19.9,
    },
    history: [
      { fiscalYear: 2021, fiscalPeriod: '2021/12', revenue: 5, operatingProfit: -318, ordinaryProfit: -325, netIncome: -349, netAssets: 180, totalAssets: 629, equityRatio: 28.6 },
      { fiscalYear: 2022, fiscalPeriod: '2022/12', revenue: -183, operatingProfit: -527, ordinaryProfit: -327, netIncome: -330, netAssets: 125, totalAssets: 353, equityRatio: 35.52 },
      { fiscalYear: 2023, fiscalPeriod: '2023/12', revenue: 207, operatingProfit: -90, ordinaryProfit: -344, netIncome: -356, netAssets: 154, totalAssets: 548, equityRatio: 28.18 },
      { fiscalYear: 2024, fiscalPeriod: '2024/12', revenue: 271, operatingProfit: 66, ordinaryProfit: -224, netIncome: -224, netAssets: 147, totalAssets: 566, equityRatio: 26.01 },
      { fiscalYear: 2025, fiscalPeriod: '2025/12', revenue: -85, operatingProfit: -286, ordinaryProfit: -219, netIncome: -219, netAssets: 92, totalAssets: 463, equityRatio: 19.9 },
    ],
    sourceLinks: [
      {
        title: '東京ハッシュ 会社概要・決算公告',
        href: 'https://www.tokyohash.co.jp/company/profile/',
        description: '会社名、株主、暗号資産交換業登録番号、第4期から第8期までの決算公告への導線を確認できます。',
        meta: '公式ページ',
      },
      {
        title: '第8期（2025年12月期）計算書類',
        href: 'https://www.tokyohash.co.jp/wp-content/uploads/2026/03/financial-statement-8th.pdf',
        description: '2025年12月期の貸借対照表、損益計算書、株主資本等変動計算書、個別注記表を確認できます。',
        meta: 'PDF',
      },
      {
        title: '第7期（2024年12月期）計算書類',
        href: 'https://www.tokyohash.co.jp/wp-content/uploads/2025/05/financial-statement-7th.pdf',
        description: '2024年12月期の貸借対照表、損益計算書、暗号資産に関する注記を確認できます。',
        meta: 'PDF',
      },
    ],
    cautions: [
      '営業収益は暗号資産売買等損益の影響でマイナスになる期があり、売上成長率や営業利益率は通常の収益成長指標としては扱いにくい点に注意してください。',
      '2025年12月期は営業損失286百万円、当期純損失219百万円で、新株発行による資本増強と継続的な収益力を分けて確認する必要があります。',
      '総資産には自己保有暗号資産や関係会社借入暗号資産などが含まれるため、純資産や自己資本比率とは分けて見ましょう。',
    ],
    tags: ['HashKey Digital Asset Group系', '営業収益マイナス期あり', '12月決算'],
  },
  {
    exchangeId: 'rakuten-wallet',
    companyName: '楽天ウォレット株式会社',
    serviceName: '楽天ウォレット',
    fiscalYearLabel: '2025年12月期',
    statementName: '第10期決算公告・事業報告',
    path: 'https://www.rakuten-wallet.co.jp/irpress/statement.html',
    parentCompany: '楽天証券ホールディングス株式会社が100%保有（第10期事業報告で確認）',
    sourceSummary: '楽天ウォレット公式の開示情報、2021年12月期から2025年12月期までの決算公告、第10期事業報告で確認',
    latest: {
      fiscalYear: 2025,
      fiscalPeriod: '2025/12',
      revenue: 2237,
      operatingProfit: 241,
      ordinaryProfit: 180,
      netIncome: -29,
      netAssets: 2233,
      totalAssets: 115138,
      equityRatio: 1.94,
    },
    history: [
      { fiscalYear: 2021, fiscalPeriod: '2021/12', revenue: 2120, operatingProfit: 133, ordinaryProfit: 123, netIncome: 87, netAssets: 3108, totalAssets: 33150, equityRatio: 9.38 },
      { fiscalYear: 2022, fiscalPeriod: '2022/12', revenue: 853, operatingProfit: -1234, ordinaryProfit: -1254, netIncome: -1636, netAssets: 1472, totalAssets: 22706, equityRatio: 6.48 },
      { fiscalYear: 2023, fiscalPeriod: '2023/12', revenue: 1014, operatingProfit: -821, ordinaryProfit: -834, netIncome: -960, netAssets: 2012, totalAssets: 47408, equityRatio: 4.24 },
      { fiscalYear: 2024, fiscalPeriod: '2024/12', revenue: 2412, operatingProfit: 756, ordinaryProfit: 733, netIncome: 250, netAssets: 2262, totalAssets: 116007, equityRatio: 1.95 },
      { fiscalYear: 2025, fiscalPeriod: '2025/12', revenue: 2237, operatingProfit: 241, ordinaryProfit: 180, netIncome: -29, netAssets: 2233, totalAssets: 115138, equityRatio: 1.94 },
    ],
    sourceLinks: [
      {
        title: '楽天ウォレット 開示情報',
        href: 'https://www.rakuten-wallet.co.jp/irpress/statement.html',
        description: '2021年12月期から2025年12月期までの決算公告・事業報告、2025年12月期の業務及び財産の状況に関する説明書を確認できます。',
        meta: '公式ページ',
      },
      {
        title: '2025年12月期決算公告',
        href: 'https://www.rakuten-wallet.co.jp/irpress/balance_sheet_202512.pdf',
        description: '2025年12月期の貸借対照表、損益計算書、株主資本等変動計算書、個別注記表を確認できます。',
        meta: 'PDF',
      },
      {
        title: '第10期（2025年12月期）事業報告',
        href: 'https://www.rakuten-wallet.co.jp/irpress/business_report_202512.pdf',
        description: '2022年12月期から2025年12月期までの財産・損益推移、親会社、主要事業、会計監査人を確認できます。',
        meta: 'PDF',
      },
    ],
    cautions: [
      '2025年12月期は営業黒字ですが、減損損失203百万円の計上により当期純損失29百万円となっています。',
      '総資産には利用者暗号資産、預託金、利用者からの預り金、受入保証金などが大きく含まれるため、自己資本比率は顧客預り資産の表示構造込みで確認しましょう。',
      '楽天証券ホールディングス100%子会社として、楽天グループ内の資金調達や関連当事者取引もあわせて確認する必要があります。',
    ],
    tags: ['楽天証券HD100%', '2025年は純損失', '12月決算'],
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
