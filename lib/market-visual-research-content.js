const MARKET_ARTICLES_BY_TICKER = Object.freeze({
  BTC: {
    ticker: 'BTC',
    label: 'ビットコイン',
    sourceLabel: 'pasted-text.txt',
    checkedAt: '2026年7月3日 Asia/Tokyo 時点の調査メモを再構成',
    title: 'ビットコインとは？仕組み・歴史・税金・リスクを初心者向けに解説',
    description: 'ビットコインの定義、仕組み、半減期、ETF、メリット・デメリット、詐欺対策、日本の規制と税金までを初心者向けに中立的に整理します。',
    lead: 'ビットコインは、中央管理者を置かずにインターネット上で価値を移転できる分散型ネットワークです。一方で、価格変動、秘密鍵管理、送金ミス、税務など、利用者自身が理解すべきリスクも大きい資産です。',
    audience: 'ビットコインを初めて調べる人、国内取引所で買う前に仕組みとリスクを押さえたい人向け',
    keyTakeaways: [
      'ビットコインは円やドルのような法定通貨ではなく、インターネット上で売買・送金・保管できる暗号資産です。',
      '公開台帳、暗号署名、Proof of Work によって、中央管理者なしに取引履歴を維持します。',
      '総供給上限は2,100万 BTCで、半減期によって新規発行ペースが下がる設計です。',
      '日本では暗号資産交換業者の登録制があり、個人の利益は国税庁FAQ上、原則として雑所得です。',
      '買う前には価格変動、販売所スプレッド、秘密鍵管理、詐欺、送金ミスを必ず確認してください。',
    ],
    mechanismLayers: [
      {
        label: '秘密鍵',
        value: '署名する',
        body: '資産を動かすための権限です。第三者へ渡すと、取り戻せない送金につながる可能性があります。',
      },
      {
        label: 'アドレス',
        value: '受け取る',
        body: '公開してよい送金先です。送金前にはネットワークと文字列全体を確認します。',
      },
      {
        label: 'ウォレット',
        value: '保管・操作する',
        body: '秘密鍵やシードフレーズを管理し、送金や残高確認を行う道具です。',
      },
    ],
    quickFacts: [
      { label: '分類', value: '暗号資産 / P2P電子現金', note: '法定通貨ではありません' },
      { label: '供給上限', value: '2,100万 BTC', note: '発行ルールが公開されています' },
      { label: 'コンセンサス', value: 'Proof of Work', note: 'マイニングで台帳を保護します' },
      { label: '現行ブロック報酬', value: '3.125 BTC', note: '2024年4月20日の第4回半減期後' },
      { label: '国内登録業者', value: '27社', note: '金融庁公表、2026年4月30日時点' },
      { label: '税務の基本', value: '原則 雑所得', note: '個人の暗号資産取引利益' },
    ],
    contents: [
      { href: '#coin-article-definition', label: 'ビットコインとは' },
      { href: '#coin-article-mechanism', label: '仕組み' },
      { href: '#coin-article-key-model', label: '鍵管理' },
      { href: '#coin-article-history', label: '歴史と半減期' },
      { href: '#coin-article-market', label: '市場データ' },
      { href: '#coin-article-risk', label: 'リスクと詐欺対策' },
      { href: '#coin-article-regulation', label: '日本の規制・税金' },
      { href: '#coin-article-exchanges', label: '国内取引所で見る点' },
      { href: '#coin-article-faq', label: 'FAQ' },
    ],
    sections: [
      {
        id: 'definition',
        heading: 'ビットコインとは何か',
        lead: 'ビットコインは、第三者の金融機関を介さずに価値を送れる P2P 電子現金システムとして提案された暗号資産です。',
        paragraphs: [
          'サトシ・ナカモト名義のホワイトペーパーは、二重支払い問題をブロックチェーンと Proof of Work で解こうとしました。現在も、ビットコインは「決済ネットワーク」であり「新しい種類のお金」と説明されることがあります。',
          'ただし、日本の読者にとって重要なのは、ビットコインが円やドルのような法定通貨ではない点です。国が価値を保証するものではなく、価格は市場で大きく変動します。',
          '初心者向けには、「送金や保管ができるデジタル資産だが、価格変動と自己責任を伴う資産」と捉えると誤解が少なくなります。',
        ],
        note: '記事では、便利な決済技術としての側面と、投資・保有対象としてのリスクを同時に扱うことが大切です。',
      },
      {
        id: 'mechanism',
        heading: 'ビットコインの仕組み',
        lead: 'ビットコインは、公開台帳、暗号署名、マイニングという複数の仕組みを組み合わせて、中央管理者なしに取引の正しさを保ちます。',
        subsections: [
          {
            heading: 'ブロックチェーン',
            body: '確認済みの取引はブロックにまとめられ、過去のブロックとつながる形で公開台帳に記録されます。過去を書き換えるには膨大な再計算が必要になるため、履歴の改ざんが難しくなります。',
          },
          {
            heading: '秘密鍵・アドレス・ウォレット',
            body: 'ウォレットは資産そのものを入れる箱ではなく、ビットコインを動かす権限である秘密鍵を管理する道具です。秘密鍵やシードフレーズを失うと、資産を動かせなくなる可能性があります。',
          },
          {
            heading: 'マイニングと Proof of Work',
            body: 'マイナーは未承認取引をブロック候補に取り込み、計算競争によって新しいブロックを作ります。この仕組みがネットワーク全体の時系列と整合性を守ります。',
          },
        ],
      },
      {
        id: 'history',
        heading: '歴史と半減期',
        lead: 'ビットコインは、技術開発、価格形成、規制、ETF承認などが重なりながら市場として成熟してきました。',
        paragraphs: [
          '2008年のホワイトペーパー公開、2009年のジェネシスブロック、2017年の Bitcoin Cash 分岐、2021年のETFとTaproot、2024年の米国現物ETF承認、2024年4月の第4回半減期は、初心者向け記事で押さえたい節目です。',
          '価格面では、2013年の1,000ドル到達、2021年の約6万9,000ドル、2024年の7万ドル突破と10万ドル突破、2025年の約12.58万ドル台が大きな節目として整理できます。',
        ],
      },
      {
        id: 'market',
        heading: '直近市場データの見方',
        lead: '暗号資産市場は24時間365日動くため、価格や時価総額は取得時点と参照元で差が出ます。',
        paragraphs: [
          '添付資料の取得時点では、BTC/USD は約61,624ドル、bitFlyer の BTC/JPY 参考価格は9,933,619円、同ページ掲載の時価総額は約198.4兆円でした。',
          'ボラティリティも単一指標だけで判断しない方が安全です。Volmex BVIV は30日先行のインプライド・ボラティリティ、MarketVector の指標は履歴系の変動率として分けて見ると、読者に誤解を与えにくくなります。',
        ],
        note: '掲載時は「調査時点の参考値」と明記し、実際の注文前には取引所の公式画面で最新価格を確認してください。',
      },
      {
        id: 'risk',
        heading: 'メリット・デメリットとリスク',
        lead: 'ビットコインの魅力は、中央管理者なしで稼働し、国境を越えて24時間送れることです。一方で、取り返しにくい失敗もあります。',
        paragraphs: [
          'メリットは、発行ルールが公開されていること、誰でも参加できるオープンソース性、国境を越えた価値移転、価値保存や資産分散の選択肢になっている点です。',
          'デメリットは、価格変動の大きさ、秘密鍵喪失の取り返しのつかなさ、送金の不可逆性、税務の煩雑さ、環境負荷への批判です。',
          '初心者向け記事では、相場の話だけでなく、詐欺対策を早い段階で扱うべきです。特に「必ず増える」「高利回り保証」「seed phrase を入力して」といった誘導は危険信号です。',
        ],
      },
      {
        id: 'regulation',
        heading: '日本の規制と税金',
        lead: '日本では、暗号資産交換業に登録制が課されています。国内で売買する場合は、まず登録業者かどうかを確認するのが基本です。',
        paragraphs: [
          '金融庁は2026年4月30日時点で、暗号資産交換業者の登録業者数を27社と公表しています。2026年6月1日からは、媒介のみを行う「電子決済手段・暗号資産サービス仲介業」の制度も始まっています。',
          '税務では、国税庁FAQ上、個人の暗号資産取引による利益は原則として雑所得に区分されます。帳簿保存や取引規模によって扱いが変わる可能性もあるため、詳細は税理士など専門家への相談が無難です。',
        ],
      },
      {
        id: 'exchanges',
        heading: '日本で買う前に見る取引所のポイント',
        lead: 'ビットコインを買う前に見るべきなのは、対応取引所数だけではありません。販売所と取引所形式、板の厚み、スプレッド、出金条件を分けて確認します。',
        paragraphs: [
          '販売所は操作が簡単ですが、買値と売値の差であるスプレッドが実質コストになります。取引所形式の板で買える場合は、同じ10万円でも受け取れるBTC数量が変わる可能性があります。',
          '送金予定がある場合は、ネットワーク、最小出金数量、出金手数料、メンテナンス状況を公式画面で確認してください。',
        ],
      },
    ],
    halvings: [
      { period: '2009-2012', reward: '50 BTC', note: 'ローンチ直後の初期発行' },
      { period: '2012-2016', reward: '25 BTC', note: '第1回半減後' },
      { period: '2016-2020', reward: '12.5 BTC', note: '第2回半減後' },
      { period: '2020-2024', reward: '6.25 BTC', note: '第3回半減後' },
      { period: '2024-2028', reward: '3.125 BTC', note: '第4回半減後の現行水準' },
      { period: '2028-2032目安', reward: '1.5625 BTC', note: '次回半減後の想定' },
    ],
    timeline: [
      { date: '2008-10-31', event: 'ホワイトペーパー公開', note: 'サトシ・ナカモト名義で P2P 電子現金を提案' },
      { date: '2009-01-03', event: 'ジェネシスブロック', note: 'Bitcoin ネットワークが始動' },
      { date: '2012-11', event: '第1回半減期', note: 'ブロック報酬 50 BTC から 25 BTC へ' },
      { date: '2017-08-01', event: 'Bitcoin Cash 分岐', note: 'スケーリング方針をめぐり分岐' },
      { date: '2021', event: 'ETFとTaproot', note: 'カナダ現物ETF、米国先物ETF、Taproot など' },
      { date: '2024-01-10', event: '米国現物ETF承認', note: '米SECが複数の現物ビットコインETFを承認' },
      { date: '2024-04-20', event: '第4回半減期', note: 'ブロック報酬 6.25 BTC から 3.125 BTC へ' },
      { date: '2025-10-06', event: '価格の節目', note: '添付資料では約12.58万ドル台の史上高値を記録' },
    ],
    marketSnapshot: [
      { metric: 'BTC/USD', value: '61,624 USD', note: '添付資料の取得時点の参考値' },
      { metric: 'BTC/JPY', value: '9,933,619円', note: 'bitFlyer 参考仲値' },
      { metric: '24時間高値', value: '10,000,524円', note: 'bitFlyer 表示' },
      { metric: '24時間安値', value: '9,652,973円', note: 'bitFlyer 表示' },
      { metric: '時価総額', value: '約198.4兆円', note: 'bitFlyer 表示' },
      { metric: '流通供給量', value: '約2,005万 BTC', note: '参照元により差あり' },
      { metric: '30日先行IV', value: '41.73', note: 'Volmex BVIV' },
      { metric: '1か月ボラティリティ', value: '34.33', note: 'MarketVector 指標' },
      { metric: '1年ボラティリティ', value: '39.52', note: 'MarketVector 指標' },
    ],
    scams: [
      { pattern: '投資詐欺', example: '必ず増える、高利回り保証、配当付き', prevention: '収益保証を信じず、金融庁登録の有無を確認する' },
      { pattern: 'SNS・恋愛経由の勧誘', example: '長期会話で信用形成後に送金させる', prevention: '知り合ったばかりの相手の投資助言を信じない' },
      { pattern: 'なりすましサポート', example: '復旧や本人確認を理由に seed phrase を求める', prevention: 'seed phrase と秘密鍵は絶対に渡さない' },
      { pattern: '無登録業者', example: '海外サイトに送金したら出金できない', prevention: 'FSA登録業者か確認する' },
      { pattern: 'アドレスすり替え', example: 'コピペ時に別アドレスへ誘導', prevention: '送金前にアドレス全体を再確認する' },
    ],
    wallets: [
      { name: 'Ledger Nano X', type: 'ハードウェア', fit: '長期保有を重視する人', caution: '購入費用と自己管理が必要' },
      { name: 'Trezor Safe 3 / 5', type: 'ハードウェア', fit: '透明性と自主管理を重視する人', caution: '復旧情報の管理は利用者責任' },
      { name: 'Bitkey', type: 'ハードウェア+アプリ', fit: 'seed phrase 管理に不安がある人', caution: '自己保管の損失リスクは残る' },
      { name: 'Electrum', type: 'ソフトウェア', fit: 'PC中心で軽量運用したい人', caution: '常時接続端末の攻撃面に注意' },
    ],
    exchangeRows: [
      { name: 'bitFlyer', registration: '第00003号', btc: '販売所・取引所・Lightning 現物', note: '日本語導線が豊富。参考価格は実約定と異なる場合あり' },
      { name: 'Coincheck', registration: '第00014号', btc: '販売所中心で始めやすい', note: 'スマホ導線が強い一方、スプレッド理解が必要' },
      { name: 'bitbank', registration: '第00004号', btc: '現物取引に強い訴求', note: '取引所型コンテンツが充実。板と手数料を確認したい' },
      { name: 'SBI VC Trade', registration: '第00011号', btc: '販売所・取引所価格を提示', note: 'SBIグループとの親和性。価格更新タイミングに注意' },
    ],
    jurisdictions: [
      { region: '日本', regulation: '交換業は登録制。仲介業制度も開始', tax: '個人利益は原則雑所得', practical: '国内登録業者を使い、損益計算を年次で残す' },
      { region: '米国', regulation: 'BTCはコモディティ。現物ETPも承認', tax: 'IRSでは property 扱い', practical: '証券・商品・税務が重層的に絡む' },
      { region: 'EU', regulation: 'MiCAによりCASP規制が整備', tax: '直接税は加盟国差', practical: '規制はEU統一、税は国別確認' },
      { region: '中国本土', regulation: '関連業務や採掘への規制が強い', tax: '取引禁止が中心論点', practical: '合法投資商品として扱いにくい地域' },
    ],
    faqs: [
      {
        question: 'ビットコインは安全ですか？',
        answer: 'ネットワーク設計としては強固な仕組みを持ちますが、価格変動、秘密鍵管理、送金ミス、詐欺のリスクがあります。安全かどうかは、使い方と管理方法に大きく左右されます。',
      },
      {
        question: '販売所で買うのと取引所で買うのは何が違いますか？',
        answer: '販売所は簡単ですが、買値と売値の差であるスプレッドが実質コストになります。取引所形式では板でユーザー同士が売買するため、注文サイズと板の厚みを確認する必要があります。',
      },
      {
        question: 'ビットコインの利益には税金がかかりますか？',
        answer: '日本の個人取引では、国税庁FAQ上、暗号資産取引による利益は原則として雑所得です。実際の申告は取引履歴や所得状況によって変わるため、必要に応じて専門家に確認してください。',
      },
      {
        question: '初心者は最初に何を確認すべきですか？',
        answer: '取引所が金融庁登録業者か、販売所と取引所形式のどちらで買うのか、10万円など実際の金額でスプレッドや板の厚みがどう変わるか、送金予定があるなら出金条件を確認してください。',
      },
    ],
    sourceNotes: [
      'Bitcoin.org / Bitcoin Whitepaper',
      '金融庁・財務局 登録業者一覧',
      '国税庁 暗号資産FAQ',
      '日本銀行 暗号資産の説明',
      'SEC / IRS / EU MiCA 関連資料',
      'bitFlyer、Volmex、MarketVector などの市場データ',
    ],
  },
});

function normalizeTicker(value) {
  return String(value || '').split('-')[0].trim().toUpperCase();
}

function buildFallbackArticle(market = {}) {
  const research = market.research || {};
  const ticker = normalizeTicker(market.baseCurrency || market.instrumentId || research.ticker);
  const label = research.name || market.label || ticker || '暗号資産';
  const exchangeCount = Number.isFinite(Number(market.exchangeCount)) ? Number(market.exchangeCount) : 0;

  return {
    ticker,
    label,
    sourceLabel: 'site market profile',
    checkedAt: '詳細記事は順次追加予定',
    title: `${label}とは？特徴・仕組み・国内取引所で見るポイント`,
    description: `${label}の用途、仕組み、国内取扱、注文前のリスクを整理します。`,
    lead: research.plainUse || research.purpose || `${label} の用途とリスクを、国内取引所で買う前の確認観点に分けて整理します。`,
    audience: `${label}を国内取引所で買う前に特徴を知りたい人向け`,
    keyTakeaways: [
      research.purpose || research.plainUse || '用途は公式プロジェクト情報で確認してください。',
      research.mechanism || 'ネットワーク、検証方式、発行条件を確認してください。',
      research.domesticHandling || '国内取引所では対応形式と入出庫条件を確認してください。',
      exchangeCount ? `このサイトでは国内 ${exchangeCount}社での取扱を確認できます。` : '国内取扱状況は取得でき次第表示します。',
    ].filter(Boolean),
    quickFacts: [
      { label: 'カテゴリ', value: research.category || '暗号資産', note: '用途ベースの分類' },
      { label: 'ネットワーク', value: research.network || '公式確認', note: '送金前に確認' },
      { label: '供給条件', value: research.maxSupply || '公式確認', note: '発行上限・発行条件' },
      { label: '国内取扱', value: exchangeCount ? `${exchangeCount}社` : '確認中', note: 'このサイトの掲載取引所ベース' },
    ],
    mechanismLayers: [
      {
        label: 'ネットワーク',
        value: research.network || '公式確認',
        body: '送金先ネットワークや対応チェーンは、入出庫前に公式画面で確認します。',
      },
      {
        label: '権限管理',
        value: '秘密鍵・口座管理',
        body: '取引所保管と自己管理では、復旧方法と責任範囲が異なります。',
      },
      {
        label: '注文前確認',
        value: '板・スプレッド',
        body: '販売所価格、取引所形式、板の厚みを分けて確認すると実質コストを見誤りにくくなります。',
      },
    ],
    contents: [
      { href: '#coin-article-definition', label: `${label}とは` },
      { href: '#coin-article-mechanism', label: '仕組み' },
      { href: '#coin-article-key-model', label: '確認図解' },
      { href: '#coin-article-exchanges', label: '国内で見る点' },
      { href: '#coin-article-risk', label: 'リスク' },
    ],
    sections: [
      {
        id: 'definition',
        heading: `${label}とは何か`,
        lead: research.purpose || research.plainUse || `${label}は暗号資産の一つです。`,
        paragraphs: [research.domesticHandling || '国内取引所での扱われ方は、販売所、取引所形式、入出庫対応に分けて確認してください。'],
      },
      {
        id: 'mechanism',
        heading: '仕組み',
        lead: research.mechanism || '詳しい仕組みは公式プロジェクト情報で確認してください。',
        paragraphs: [],
      },
      {
        id: 'exchanges',
        heading: '国内で買う前に見る点',
        lead: '取扱取引所数だけでなく、板の厚み、販売所スプレッド、出金条件を確認します。',
        paragraphs: ['実際に買う前には、公式画面で最新の手数料、最小注文数量、入出庫条件を確認してください。'],
      },
      {
        id: 'risk',
        heading: 'リスク',
        lead: '暗号資産は価格変動が大きく、取扱条件も変わることがあります。',
        paragraphs: research.featureCautions || research.risks || [],
      },
    ],
    halvings: [],
    timeline: [],
    marketSnapshot: [],
    scams: [],
    wallets: [],
    exchangeRows: [],
    jurisdictions: [],
    faqs: [],
    sourceNotes: ['公式プロジェクト情報', '国内取引所の公式条件', 'このサイトの市場データ'],
  };
}

function getMarketVisualResearchContent(market = {}) {
  const ticker = normalizeTicker(market.baseCurrency || market.instrumentId);
  return MARKET_ARTICLES_BY_TICKER[ticker] || buildFallbackArticle(market);
}

module.exports = {
  getMarketVisualResearchContent,
};
