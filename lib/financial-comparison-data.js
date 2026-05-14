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

function addDerivedMetrics(company) {
  const latest = { ...company.latest };
  const revenue = numberOrNull(latest.revenue);
  const operatingProfit = numberOrNull(latest.operatingProfit);
  const netIncome = numberOrNull(latest.netIncome);

  latest.operatingMargin = revenue && operatingProfit != null
    ? round((operatingProfit / revenue) * 100, 2)
    : null;
  latest.netMargin = revenue && netIncome != null
    ? round((netIncome / revenue) * 100, 2)
    : null;
  latest.revenueYoY = percentChange(
    latestHistoryValue(company, 'revenue'),
    previousHistoryValue(company, 'revenue')
  );
  latest.netAssetsYoY = percentChange(
    latestHistoryValue(company, 'netAssets'),
    previousHistoryValue(company, 'netAssets')
  );

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
