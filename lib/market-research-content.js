const MEME_BASE_CURRENCIES = new Set(['DOGE', 'SHIB', 'PEPE', 'TRUMP']);
const STABLE_BASE_CURRENCIES = new Set(['DAI', 'USDC', 'USDT']);

const MARKET_RESEARCH_CONTENT = Object.freeze({
  BTC: {
    ticker: 'BTC',
    name: 'Bitcoin',
    category: '主要暗号資産',
    network: 'Bitcoin',
    maxSupply: '2,100万 BTC',
    consensus: 'Proof of Work',
    purpose: '中央管理者を置かずに、インターネット上で価値を移転・保存することを目的とした代表的な暗号資産です。',
    mechanism: 'Bitcoin ネットワークでは、取引をブロックにまとめ、Proof of Work によって台帳へ追加します。発行上限は 2,100万 BTC に設定されています。',
    domesticHandling: '国内取引所では多くのサービスで取り扱われており、取引所形式の板取引にも対応しているケースが多い銘柄です。',
    plainUse: 'Bitcoin は、中央管理者に依存しにくい価値移転・価値保存を目的に使われる代表的な暗号資産です。',
    useCases: [
      '長期保有や資産分散の対象として使われることが多い',
      '取引所間の基準銘柄として、流動性や価格比較の起点になりやすい',
      '送金に使える一方、混雑時は手数料や反映時間に注意が必要',
    ],
    traits: [
      '発行上限があり、他の銘柄より市場規模と取扱取引所が大きい',
      '価格変動は大きく、短期の値動きだけで判断しにくい',
    ],
    risks: [
      '高値掴み、急落、レバレッジ取引による損失',
      '送金先アドレスやネットワークを間違えた場合の資産喪失',
      '販売所スプレッドと取引所板の実効コスト差',
    ],
    featureCautions: [
      '価格変動が大きく、短期の値動きだけで購入判断すると損失が出る可能性がある',
      '販売所で購入する場合はスプレッドによって実質コストが高くなることがあります。',
      '送金時はアドレス、ネットワーク、手数料、反映時間を確認する',
    ],
    relatedTickers: ['ETH', 'WBTC', 'BCH', 'LTC'],
  },
  ETH: {
    ticker: 'ETH',
    name: 'Ethereum',
    category: 'スマートコントラクト基盤',
    network: 'Ethereum',
    maxSupply: '固定の発行上限なし',
    consensus: 'Proof of Stake',
    purpose: 'スマートコントラクトを使ったアプリ、トークン、NFT、DeFi を動かす基盤として使われる暗号資産です。',
    mechanism: 'Ethereum では、スマートコントラクトがネットワーク上で実行され、ETH は取引手数料である gas の支払いに使われます。現在は Proof of Stake によって検証されます。',
    domesticHandling: '国内取引所では主要アルトコインとして扱われることが多く、販売所と取引所形式の両方で確認できるケースがあります。',
    plainUse: 'Ethereum は、分散型アプリやトークン、NFT、DeFi などを動かすための基盤として使われる暗号資産です。',
    useCases: [
      'Ethereum ネットワーク上の取引手数料である gas として使われる',
      'DeFi、NFT、ステーブルコインなど多くのアプリの基盤になっている',
      '国内取引所では主要銘柄として比較候補に入りやすい',
    ],
    traits: [
      'ネットワーク利用が増えると手数料が上がることがある',
      'アップグレードやレイヤー2の普及で利用環境が変化しやすい',
    ],
    risks: [
      'スマートコントラクトや外部サービス利用時の技術リスク',
      'ネットワーク混雑による送金コストの上昇',
      'BTC より板が薄い取引所では注文サイズに注意',
    ],
    featureCautions: [
      'ネットワーク混雑時は gas 代や送金反映時間が大きく変わることがある',
      '外部ウォレットや DeFi を使う場合はスマートコントラクトリスクがある',
      '取引所ごとに対応ネットワークや入出庫条件が異なる場合がある',
    ],
    relatedTickers: ['BTC', 'SOL', 'ADA', 'LINK', 'BNB'],
  },
  XRP: {
    ticker: 'XRP',
    name: 'XRP',
    category: '送金・決済関連',
    network: 'XRP Ledger',
    maxSupply: '1,000億 XRP',
    consensus: 'XRP Ledger Consensus Protocol',
    purpose: '国際送金や決済の効率化を意識したネットワークで利用される暗号資産として知られています。',
    mechanism: 'XRP Ledger では、独自の合意形成によって取引を検証します。送金時はアドレスに加えて宛先タグが必要になる場合があります。',
    domesticHandling: '国内では比較的多くの取引所で取り扱われており、取引所ごとの板厚や販売所スプレッドを比べやすい銘柄です。',
    plainUse: 'XRP は、送金や決済の効率化を意識したネットワークで使われる暗号資産として知られています。',
    useCases: [
      '高速・低コストな送金を目的に設計されたネットワークで使われる',
      '国内取扱が多く、複数取引所で比較しやすい',
      '短期売買の対象にもなりやすく、出来高を確認しやすい',
    ],
    traits: [
      'ニュースや規制動向で価格が動きやすい',
      '取引所ごとの板の厚みとスプレッド差を見比べやすい',
    ],
    risks: [
      '法規制・訴訟・提携ニュースによる急変',
      '短期の値動きに引っ張られた高値購入',
      '販売所と板取引のコスト差',
    ],
    featureCautions: [
      '規制、訴訟、提携ニュースなどで短期的に価格が動きやすい',
      '送金時に宛先タグなど追加情報が必要になる場合がある',
      '販売所と取引所形式で実質コストが変わることがある',
    ],
    relatedTickers: ['XLM', 'BTC', 'ETH', 'ADA'],
  },
  SOL: {
    ticker: 'SOL',
    name: 'Solana',
    category: '高速スマートコントラクト基盤',
    network: 'Solana',
    maxSupply: '固定の発行上限なし',
    consensus: 'Proof of History + Proof of Stake',
    purpose: '高速処理と低コストを重視したアプリ、NFT、DeFi、決済系サービスで使われるスマートコントラクト基盤の暗号資産です。',
    mechanism: 'Solana は Proof of History と Proof of Stake を組み合わせ、短い処理時間と低い手数料を目指すネットワークです。',
    domesticHandling: '国内では主要アルトコインとして扱われることが増えており、取扱先ごとの板厚とスプレッド差を確認したい銘柄です。',
    plainUse: 'Solana は、高速処理と低コストのアプリ実行を目指すスマートコントラクト基盤で使われる暗号資産です。',
    useCases: [
      'NFT、DeFi、ゲーム、決済系アプリなどで手数料として使われる',
      '取引速度や手数料の低さを重視するアプリの基盤になりやすい',
      '国内でも主要アルトコインとして比較対象に入りやすい',
    ],
    traits: [
      'ネットワーク稼働状況やエコシステムの成長に評価が左右されやすい',
      'BTC/ETH より価格変動と流動性差が大きくなりやすい',
    ],
    risks: [
      'ネットワーク障害や停止履歴に関する評価変化',
      'アルトコイン全体の急落局面での値動き',
      '取引所ごとの板厚不足によるスリッページ',
    ],
    featureCautions: [
      'ネットワーク稼働状況やエコシステム関連ニュースで評価が変わりやすい',
      '主要銘柄より取引所ごとの板厚差が出やすい',
      'アルトコイン市場全体の急落時に値動きが大きくなりやすい',
    ],
    relatedTickers: ['ETH', 'ADA', 'BNB', 'NEAR', 'SUI'],
  },
  ADA: {
    ticker: 'ADA',
    name: 'Cardano',
    category: 'スマートコントラクト基盤',
    network: 'Cardano',
    maxSupply: '450億 ADA',
    consensus: 'Ouroboros / Proof of Stake',
    purpose: 'Cardano ネットワーク上の送金、手数料、ステーキング、スマートコントラクト利用に関わる暗号資産です。',
    mechanism: 'Cardano は Ouroboros と呼ばれる Proof of Stake 系の仕組みを採用し、段階的な開発ロードマップで機能追加が進められてきました。',
    domesticHandling: '国内では複数取引所で扱われるアルトコインの一つで、取引方式、板厚、入出庫条件を分けて確認したい銘柄です。',
    plainUse: 'ADA は、Cardano ネットワークの手数料やステーキング、アプリ利用に関わる暗号資産です。',
    useCases: [
      'Cardano ネットワーク上の取引手数料として使われる',
      'ステーキングやガバナンス文脈で保有されることがある',
      '国内では複数社で比較しやすいアルトコインの一つ',
    ],
    traits: [
      '開発ロードマップやエコシステム拡大の進み方で評価が変わりやすい',
      '主要銘柄より取引所ごとの流動性差が出やすい',
    ],
    risks: [
      '開発進捗や採用状況への期待先行',
      '価格変動と出来高低下による売買しにくさ',
      '板が薄い状態での成行注文',
    ],
    featureCautions: [
      '開発ロードマップや採用状況への期待で価格が動きやすい',
      '取引所ごとに板の厚みや販売所スプレッドが異なる',
      '送金予定がある場合は対応ネットワークと出金条件を確認する',
    ],
    relatedTickers: ['ETH', 'SOL', 'DOT', 'XTZ'],
  },
  DAI: {
    ticker: 'DAI',
    name: 'Dai',
    category: 'ステーブルコイン',
    network: 'Ethereum ほか対応ネットワーク',
    maxSupply: '固定の発行上限なし',
    consensus: '発行先ネットワークに依存',
    purpose: '米ドルなどの価値に連動することを目指し、価格変動を抑えたい場面の待避先や DeFi 利用で使われる暗号資産です。',
    mechanism: 'DAI は担保やプロトコル設計によって価値連動を目指すステーブルコインです。利用するネットワークによって送金手数料や反映条件が変わります。',
    domesticHandling: '国内取引所では取扱先が限られる場合があり、日本円との売買ではスプレッドと入出庫条件を確認する必要があります。',
    plainUse: 'DAI は、米ドルなどの価値に連動することを目指すステーブルコインとして使われます。',
    useCases: [
      '価格変動を抑えたい場面の待避先として使われることがある',
      'DeFi やオンチェーン決済の文脈で利用される',
      '国内取引所では取扱先とスプレッド差の確認が重要',
    ],
    traits: [
      '値動きが小さく見えても、完全に価格が固定されるわけではない',
      '担保、発行設計、市場環境によって連動が崩れるリスクがある',
    ],
    risks: [
      'ペッグずれや流動性低下',
      '発行・担保・プロトコルに関する仕組みの理解不足',
      '日本円との売買時のスプレッド',
    ],
    featureCautions: [
      '価格連動は保証ではなく、ペッグずれが起きる可能性がある',
      '担保、発行体、プロトコル、償還条件の理解が重要',
      '日本円で売買する場合はスプレッドと流動性を確認する',
    ],
    relatedTickers: ['MKR', 'ETH', 'USDC', 'USDT'],
  },
  BNB: {
    ticker: 'BNB',
    name: 'BNB',
    category: '取引所・チェーン関連',
    network: 'BNB Chain',
    maxSupply: 'バーンにより長期的に 1億 BNB を目標',
    consensus: 'Proof of Staked Authority',
    purpose: '取引所エコシステムや BNB Chain 上の手数料、アプリ利用に関連して使われる暗号資産です。',
    mechanism: 'BNB Chain では BNB がネットワーク手数料などに使われます。供給面ではバーンなどの仕組みが価格評価の材料になることがあります。',
    domesticHandling: '国内では取扱先や流動性が限られる場合があるため、売買前に対応取引所、板厚、入出庫条件を確認したい銘柄です。',
    plainUse: 'BNB は、取引所エコシステムやブロックチェーン利用に関連して使われる暗号資産です。',
    useCases: [
      '対応チェーン上の手数料やアプリ利用に使われる',
      '取引所エコシステムの成長期待と結びついて見られることがある',
      '国内では取扱取引所と流動性を先に確認したい銘柄',
    ],
    traits: [
      '特定エコシステムへの依存度が比較的大きい',
      '海外市場のニュースや規制動向の影響を受けやすい',
    ],
    risks: [
      '取引所・チェーン関連ニュースによる急変',
      '国内での取扱先や送金条件の制約',
      '板が薄い時間帯の実効コスト上昇',
    ],
    featureCautions: [
      '特定の取引所・チェーンエコシステムへの依存度が比較的大きい',
      '海外市場の規制やニュースで値動きが大きくなることがある',
      '国内での取扱先、板厚、出金条件を先に確認する',
    ],
    relatedTickers: ['ETH', 'SOL', 'SUI', 'BTC'],
  },
  LINK: {
    ticker: 'LINK',
    name: 'Chainlink',
    category: 'オラクル関連',
    network: 'Chainlink / Ethereum ほか対応ネットワーク',
    maxSupply: '10億 LINK',
    consensus: '発行先ネットワークに依存',
    purpose: 'スマートコントラクトへ外部データを届けるオラクル領域に関わる暗号資産です。',
    mechanism: 'Chainlink は、価格などの外部データをブロックチェーン上のアプリへ連携するネットワークです。LINK はそのエコシステムに関連するトークンとして扱われます。',
    domesticHandling: '国内取扱はあるものの、主要銘柄に比べて取引所ごとの板厚やスプレッド差が出やすいため比較が重要です。',
    plainUse: 'LINK は、ブロックチェーン外の価格やデータをスマートコントラクトへ届けるオラクル領域に関わる暗号資産です。',
    useCases: [
      'DeFi などで必要な外部データ連携のネットワークに関連する',
      'スマートコントラクト基盤の周辺インフラ銘柄として見られる',
      '国内取扱はあるものの、取引所ごとの板厚確認が重要',
    ],
    traits: [
      'DeFi やオンチェーン金融の利用動向に評価が左右されやすい',
      '主要銘柄より流動性が偏る可能性がある',
    ],
    risks: [
      'プロジェクト採用状況への期待先行',
      'アルトコイン市場全体の急落',
      '出来高が少ない取引所でのスリッページ',
    ],
    featureCautions: [
      'DeFi やオンチェーン金融の利用動向に評価が左右されやすい',
      '採用ニュースへの期待が価格に先行することがある',
      '取引所ごとの出来高と板厚を見てから注文サイズを決める',
    ],
    relatedTickers: ['ETH', 'MKR', 'GRT', 'FET'],
  },
});

function buildFallbackContent(baseCurrency) {
  if (STABLE_BASE_CURRENCIES.has(baseCurrency)) {
    return {
      ticker: baseCurrency,
      name: baseCurrency,
      category: 'ステーブルコイン',
      network: '対応ネットワークは取引所・発行体情報で確認',
      maxSupply: '固定の発行上限なし',
      consensus: '発行先ネットワークに依存',
      purpose: `${baseCurrency} は、法定通貨などの価値に連動することを目指し、暗号資産取引の待避先や決済用途で使われることがあります。`,
      mechanism: '発行体やプロトコル、担保、対応ネットワークによって仕組みが異なります。連動対象、償還条件、対応チェーンを確認してください。',
      domesticHandling: '国内では取扱先や注文方式が限られる場合があります。日本円で売買する際はスプレッドと入出庫条件を確認してください。',
      plainUse: `${baseCurrency} は、価格連動型の暗号資産として扱われることが多い銘柄です。`,
      useCases: [
        '価格変動を抑えたいときの一時的な保有先として使われることがある',
        '海外サービスやオンチェーン取引の文脈で利用されることがある',
        '日本円で売買するときはスプレッドと取扱取引所を確認したい',
      ],
      traits: [
        '連動対象から価格がずれる可能性がある',
        '発行体、担保、償還条件、取扱条件の確認が重要',
      ],
      risks: [
        'ペッグずれ、発行体・担保・規制に関するリスク',
        '国内取引所での流動性不足',
        '日本円との売買スプレッド',
      ],
      featureCautions: [
        '価格連動は保証ではなく、ペッグずれが起きる可能性がある',
        '発行体、担保、償還条件、規制動向を確認する',
        '日本円での売買ではスプレッドと取扱取引所を確認する',
      ],
      relatedTickers: ['DAI', 'USDC', 'USDT', 'MKR', 'ETH'],
    };
  }

  if (MEME_BASE_CURRENCIES.has(baseCurrency)) {
    return {
      ticker: baseCurrency,
      name: baseCurrency,
      category: 'ミーム・コミュニティ銘柄',
      network: '公式プロジェクト情報を確認',
      maxSupply: '公式プロジェクト情報を確認',
      consensus: '公式プロジェクト情報を確認',
      purpose: `${baseCurrency} は、コミュニティや話題性を背景に保有・売買されやすい暗号資産です。`,
      mechanism: '仕組みや発行条件は銘柄ごとに異なります。公式プロジェクト情報、発行量、対応ネットワーク、主要な利用場面を確認してください。',
      domesticHandling: '国内では取扱先が限られたり、販売所中心になる場合があります。板厚、出来高、スプレッドを同時に確認したい銘柄です。',
      plainUse: `${baseCurrency} は、コミュニティや話題性で売買されやすいミーム系の暗号資産です。`,
      useCases: [
        'コミュニティ参加や短期売買の対象として扱われることが多い',
        'SNS やニュースの影響で売買が急増することがある',
        '長期用途よりも価格変動と流動性の確認が重要',
      ],
      traits: [
        '実需よりも話題性で値動きが大きくなりやすい',
        '取引所ごとのスプレッドと板厚に差が出やすい',
      ],
      risks: [
        '急騰後の急落、出来高減少、流動性不足',
        '販売所スプレッドの広がり',
        '短期の話題だけで購入判断してしまうこと',
      ],
      featureCautions: [
        'SNS やニュースで短期的な急騰・急落が起きやすい',
        '出来高が減ると売買しにくくなる可能性がある',
        '販売所スプレッドや板の薄さによる実質コストを確認する',
      ],
      relatedTickers: ['DOGE', 'SHIB', 'PEPE', 'TRUMP'],
    };
  }

  return {
    ticker: baseCurrency,
    name: baseCurrency,
    category: 'アルトコイン',
    network: '公式プロジェクト情報を確認',
    maxSupply: '公式プロジェクト情報を確認',
    consensus: '公式プロジェクト情報を確認',
    purpose: `${baseCurrency} は、プロジェクトやネットワークごとの用途を持つアルトコインです。購入前に何のための銘柄かを公式情報で確認してください。`,
    mechanism: '仕組みは銘柄ごとに異なります。対応ネットワーク、発行条件、検証方式、トークンの役割を公式情報で確認してください。',
    domesticHandling: '国内取引所では取扱先、注文方式、入出庫対応が銘柄ごとに異なります。販売所だけでなく取引所形式の板があるかも確認してください。',
    plainUse: `${baseCurrency} は、プロジェクトやネットワークごとの用途を持つアルトコインです。`,
    useCases: [
      'ネットワーク手数料、アプリ利用、ゲーム、DeFi、ガバナンスなど用途は銘柄ごとに異なる',
      '国内取引所では取扱先が限られる場合がある',
      '購入前に公式プロジェクト情報と国内取扱条件を確認したい',
    ],
    traits: [
      '主要銘柄より価格変動、出来高、板の厚みに差が出やすい',
      'プロジェクト進捗や上場・規制ニュースで急変しやすい',
    ],
    risks: [
      '流動性不足によるスリッページ',
      'プロジェクト期待が先行した価格形成',
      '送金停止、上場廃止、取扱条件変更の可能性',
    ],
    featureCautions: [
      '主要銘柄より価格変動、出来高、板の厚みに差が出やすい',
      'プロジェクト進捗や上場・規制ニュースで急変しやすい',
      '入出庫停止、上場廃止、取扱条件変更の可能性がある',
    ],
    relatedTickers: ['BTC', 'ETH', 'XRP', 'SOL'],
  };
}

function exchangeLabelsForMarket(market = {}) {
  if (Array.isArray(market.exchangeLabels) && market.exchangeLabels.length > 0) {
    return market.exchangeLabels.filter(Boolean);
  }
  if (Array.isArray(market.supportedExchanges) && market.supportedExchanges.length > 0) {
    return market.supportedExchanges.map(exchange => exchange && exchange.label).filter(Boolean);
  }
  if (Array.isArray(market.exchanges) && market.exchanges.length > 0) {
    return market.exchanges.map(exchange => exchange && exchange.label).filter(Boolean);
  }
  return [];
}

function buildDomesticAvailability(market = {}) {
  const exchangeLabels = exchangeLabelsForMarket(market);
  const exchangeCount = Number.isFinite(Number(market.exchangeCount))
    ? Number(market.exchangeCount)
    : exchangeLabels.length;
  const isDerivative = market.marketType === 'derivative';
  const supportedText = exchangeCount > 0
    ? `${isDerivative ? '国内デリバティブ' : '国内現物'}では ${exchangeCount}社で取扱を確認できます。`
    : '国内取扱状況は取得でき次第表示します。';
  const orderbookText = market.hasOrderbook
    ? (isDerivative ? '現物とは別のCFD/FX板を比較できます。' : '取引所形式の板を比較できます。')
    : '取引所形式の板データは取得待ちです。';
  const salesText = market.hasSales
    ? '販売所価格データも取得できています。'
    : (isDerivative ? '販売所スプレッド比較の対象外です。' : '販売所スプレッドは取得できた販売所から順に表示します。');

  return {
    summary: [supportedText, orderbookText].join(' '),
    exchangeCount,
    exchangeLabels,
    notes: [
      supportedText,
      orderbookText,
      salesText,
      isDerivative
        ? '証拠金、レバレッジ、ロスカット、Fundingやレバレッジポイントは各取引所の公式画面で確認してください。'
        : '入出金、対応ネットワーク、最小出金額、出金手数料は各取引所の公式画面で確認してください。',
    ],
  };
}

function uniqueList(items) {
  const seen = new Set();
  return (items || []).filter((item) => {
    const value = String(item || '').trim();
    if (!value || seen.has(value)) return false;
    seen.add(value);
    return true;
  });
}

function buildMechanismFallback(content, baseCurrency) {
  const network = content.network && content.network !== '公式プロジェクト情報を確認'
    ? content.network
    : '対応ネットワーク';
  const consensus = content.consensus && content.consensus !== '公式プロジェクト情報を確認'
    ? content.consensus
    : '検証方式';
  return `${baseCurrency} は ${network} に関連する暗号資産です。詳しい仕組みは、${consensus}、発行条件、トークンの役割を公式情報で確認してください。`;
}

function getMarketResearchContent(market = {}) {
  const baseCurrency = String(market.baseCurrency || market.instrumentId || '')
    .split('-')[0]
    .toUpperCase();
  const content = MARKET_RESEARCH_CONTENT[baseCurrency] || buildFallbackContent(baseCurrency || '暗号資産');
  const domesticAvailability = buildDomesticAvailability(market);

  return {
    ...content,
    baseCurrency,
    ticker: content.ticker || baseCurrency,
    name: content.name || baseCurrency,
    network: content.network || '公式プロジェクト情報を確認',
    maxSupply: content.maxSupply || '公式プロジェクト情報を確認',
    consensus: content.consensus || '公式プロジェクト情報を確認',
    purpose: content.purpose || content.plainUse || `${baseCurrency} の用途は銘柄ごとの公式情報で確認してください。`,
    mechanism: content.mechanism || buildMechanismFallback(content, baseCurrency),
    domesticHandling: content.domesticHandling || domesticAvailability.summary || '国内取引所での取扱状況は取得でき次第表示します。',
    featureCautions: uniqueList((content.featureCautions || []).concat(content.risks || [])).slice(0, 4),
    relatedTickers: uniqueList(content.relatedTickers || ['BTC', 'ETH', 'XRP', 'SOL'])
      .map(ticker => String(ticker || '').toUpperCase())
      .filter(ticker => ticker && ticker !== baseCurrency),
    domesticAvailability,
    beginnerCautions: [
      'まずは販売所ではなく取引所板でも買えるか確認する',
      '10万円など実際の注文金額で板シミュレーターを試す',
      '送金予定がある場合は対応ネットワークと出金条件を公式画面で確認する',
    ],
  };
}

module.exports = {
  getMarketResearchContent,
};
