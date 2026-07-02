const VISUAL_RESEARCH_BY_TICKER = Object.freeze({
  BTC: {
    ticker: 'BTC',
    label: 'ビットコイン',
    title: 'ビットコインを1枚で把握',
    subtitle: 'アップロード資料の入門リサーチを、価格・制度・供給・リスクの見取り図に整理しました。',
    sourceLabel: 'deep-research-report.md',
    checkedAt: '2026年7月3日 Asia/Tokyo 時点のリサーチ',
    lead: 'ビットコインは、中央管理者を置かずに価値を移転できる分散型ネットワークであり、同時に大きな価格変動と自己管理リスクを持つ暗号資産です。',
    keyMetrics: [
      {
        label: '供給上限',
        value: '2,100万 BTC',
        note: '発行量ルールが公開されている',
        tone: 'supply',
      },
      {
        label: '現行ブロック報酬',
        value: '3.125 BTC',
        note: '2024年4月20日の第4回半減期後',
        tone: 'event',
      },
      {
        label: '国内登録業者',
        value: '27社',
        note: '金融庁公表、2026年4月30日時点',
        tone: 'domestic',
      },
      {
        label: '参考BTC/JPY',
        value: '9,933,619円',
        note: 'レポート取得時点のbitFlyer参考価格',
        tone: 'market',
      },
    ],
    pillars: [
      {
        title: '仕組み',
        body: '公開台帳、暗号署名、Proof of Work を組み合わせ、中央の帳簿管理者なしに取引履歴を維持します。',
      },
      {
        title: '使われ方',
        body: '送金・決済の原点に加え、現在は価値保存、資産分散、ETFを通じた投資対象としても見られています。',
      },
      {
        title: '日本での前提',
        body: '暗号資産交換業者は登録制です。個人の暗号資産取引による利益は、国税庁FAQ上は原則として雑所得です。',
      },
    ],
    timeline: [
      { date: '2008', title: 'ホワイトペーパー公開', body: '第三者を介さない電子的現金を提案。' },
      { date: '2009', title: 'ジェネシスブロック', body: 'Bitcoinネットワークが始動。' },
      { date: '2017', title: 'Bitcoin Cash分岐', body: 'スケーリング方針を巡り大きな分岐が発生。' },
      { date: '2021', title: 'ETFとTaproot', body: 'カナダ現物ETF、米国先物ETF、Taprootなど制度化と技術更新が進展。' },
      { date: '2024', title: '米国現物ETF承認', body: '米SECが複数の現物ビットコインETFを承認。香港でも現物VA ETFが上場。' },
      { date: '2024', title: '第4回半減期', body: 'ブロック報酬が6.25 BTCから3.125 BTCへ低下。' },
      { date: '2025', title: '価格の節目', body: 'レポートでは約12.58万ドル台の史上高値を大きなマイルストーンとして整理。' },
    ],
    supplySchedule: [
      { period: '2009-2012', reward: '50 BTC', pct: 100 },
      { period: '2012-2016', reward: '25 BTC', pct: 50 },
      { period: '2016-2020', reward: '12.5 BTC', pct: 25 },
      { period: '2020-2024', reward: '6.25 BTC', pct: 12.5 },
      { period: '2024-2028', reward: '3.125 BTC', pct: 6.25 },
      { period: '2028目安-', reward: '1.5625 BTC', pct: 3.125 },
    ],
    marketSnapshot: [
      { label: 'BTC/USD', value: '61,624 USD', note: 'レポート取得時点の参考値' },
      { label: '時価総額', value: '約198.4兆円', note: 'bitFlyer掲載値ベース' },
      { label: '流通供給量', value: '約2,005万 BTC', note: '参照元により差あり' },
      { label: '30日先行IV', value: '41.73', note: 'Volmex BVIV' },
      { label: '1か月ボラ', value: '34.33', note: 'MarketVector指標' },
      { label: '1年ボラ', value: '39.52', note: 'MarketVector指標' },
    ],
    riskMap: [
      { label: '価格変動', level: '高', body: '短期の上下が大きく、高値掴みや急落に注意が必要です。' },
      { label: '鍵管理', level: '高', body: '秘密鍵やシードフレーズを失うと、資産を復旧できない可能性があります。' },
      { label: '送金ミス', level: '高', body: '送金は取り消せないため、アドレスとネットワーク確認が重要です。' },
      { label: '販売所スプレッド', level: '中', body: '買値と売値の差が実質コストになります。板取引との比較が必要です。' },
      { label: '税務', level: '中', body: '個人利益は原則雑所得。年間の損益計算と記録が重要です。' },
      { label: '環境負荷', level: '論点', body: '電力消費は大きく、推計値や評価には幅があります。' },
    ],
    scamPatterns: [
      '高利回り保証',
      'SNSや恋愛経由の投資勧誘',
      'seed phraseを求める偽サポート',
      '無登録業者への送金',
      'アドレスすり替え',
    ],
    regulationRows: [
      { region: '日本', stance: '交換業は登録制。個人利益は原則雑所得。仲介業制度も開始。' },
      { region: '米国', stance: 'BTCはコモディティとして扱われ、現物ETPも承認済み。税務ではproperty扱い。' },
      { region: 'EU', stance: 'MiCAで暗号資産サービス規制が整備。税制は加盟国ごとの差も残ります。' },
      { region: '中国本土', stance: '関連業務や採掘への規制が強く、合法投資商品として扱いにくい地域です。' },
    ],
  },
});

function normalizeTicker(value) {
  return String(value || '').split('-')[0].trim().toUpperCase();
}

function buildFallbackVisualResearch(market = {}) {
  const research = market.research || {};
  const ticker = normalizeTicker(market.baseCurrency || market.instrumentId || research.ticker);
  const label = research.name || market.label || ticker || '暗号資産';
  const exchangeCount = Number.isFinite(Number(market.exchangeCount)) ? Number(market.exchangeCount) : 0;

  return {
    ticker,
    label,
    title: `${ticker || label} リサーチボード`,
    subtitle: '銘柄ごとの詳細リサーチは順次追加予定です。まずは用途、仕組み、国内取扱、注文前リスクを整理しています。',
    sourceLabel: 'site market profile',
    checkedAt: '詳細リサーチ追加待ち',
    lead: research.plainUse || research.purpose || `${label} の用途とリスクを、国内取引所で買う前の確認観点に分けて整理します。`,
    keyMetrics: [
      { label: 'カテゴリ', value: research.category || '暗号資産', note: '用途ベースの分類', tone: 'domestic' },
      { label: 'ネットワーク', value: research.network || '公式確認', note: '送金前に対応ネットワークを確認', tone: 'supply' },
      { label: '供給条件', value: research.maxSupply || '公式確認', note: '発行上限・発行条件', tone: 'event' },
      { label: '国内取扱', value: exchangeCount ? `${exchangeCount}社` : '確認中', note: 'このサイトの掲載取引所ベース', tone: 'market' },
    ],
    pillars: [
      { title: '何に使うか', body: research.purpose || research.plainUse || '公式プロジェクト情報で用途を確認してください。' },
      { title: '仕組み', body: research.mechanism || 'ネットワーク、検証方式、発行条件を公式情報で確認してください。' },
      { title: '国内で見る点', body: research.domesticHandling || '板、販売所、入出庫条件を分けて確認してください。' },
    ],
    timeline: [],
    supplySchedule: [],
    marketSnapshot: [],
    riskMap: (research.featureCautions || research.risks || []).slice(0, 6).map((body, index) => ({
      label: index === 0 ? '最初に確認' : `確認${index + 1}`,
      level: index < 2 ? '高' : '中',
      body,
    })),
    scamPatterns: [],
    regulationRows: [],
  };
}

function getMarketVisualResearchContent(market = {}) {
  const ticker = normalizeTicker(market.baseCurrency || market.instrumentId);
  return VISUAL_RESEARCH_BY_TICKER[ticker] || buildFallbackVisualResearch(market);
}

module.exports = {
  getMarketVisualResearchContent,
};
