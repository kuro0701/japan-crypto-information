---
title: Solana（SOL）総合分析｜技術・トークノミクス・エコシステム・リスク
description: Solana（SOL）のプロトコル設計、PoHとPoS、Alpenglow、供給・インフレ・ステーキング、DeFi・決済・DePIN、性能、障害史、分散性、規制と主要リスクを総合分析します。
date: 2026-07-17
updated: 2026-07-21
author: 国内暗号資産取引所ナビ
slug: sol
path: /articles/sol
articleType: market
marketTicker: SOL
category: レイヤー1
tags: Solana, SOL, Proof of History, Alpenglow, Firedancer, DeFi, DePIN, ステーキング, トークノミクス, レイヤー1
readMinutes: 18
---

> **重要：本記事は情報提供のみを目的としており、特定の暗号資産の売買・保有を勧誘または推奨する投資助言ではありません。** 掲載する評価、シナリオ、市場データ、運用例は調査時点の分析上の仮定であり、将来の成果を保証しません。暗号資産は価格変動・流動性・技術・規制等のリスクを伴います。実際の取引判断は、最新の公式情報を確認し、ご自身の状況に応じて行ってください。

## エグゼクティブサマリー

Solanaは、高速・低コスト・大量処理を重視して設計されたレイヤー1ブロックチェーンであり、アカウントベースの状態管理、事前に参照アカウントを列挙するトランザクション形式、並列実行に適したランタイム設計を中核に持ちます。現在のネットワークはProof of Stakeを基礎に、Proof of Historyによる時間順序付けとリーダースケジュール、ステーク加重の投票で動作しており、開発ロードマップ上ではAlpenglowによる大幅なコンセンサス刷新が計画されています。Solanaは「高性能なモノリシックL1」という立ち位置を維持しつつ、CU上限拡大、XDP、Firedancer、SIMD-123などを通じて、性能・収益配分・クライアント多様性を同時に引き上げようとしています。

トークノミクス面では、SOLは固定供給上限を明示しないインフレ型資産で、公開アナリティクスでは総供給約6.30億SOL、流通供給約5.83億SOL、現行インフレ率は約3.74%、年率15%のディスインフレで最終1.5%を目指す設計とされています。総供給の約67.5%がステークされており、ネットワーク安全性のかなりの部分をステーキング参加率が支えています。加えて、ユーザーの基本手数料の50%がバーンされるため、実効的な純発行圧力は利用状況に左右されます。

エコシステム面では、SolanaはDeFi、NFT、決済、DePIN、トークン化資産の各分野で厚みがあり、調査時点のDeFiLlamaではSolana上のDeFi TVLが約48.5億ドル、搭載プロトコル数は555と表示されています。Solana公式のウォレット一覧ページでは155のウォレットが掲載され、Phantom、Solflare、Backpack、SquadsXなどが前面に出されています。対個人向けではJupiter、Raydium、Magic Eden、Metaplex、対インフラ・機関向けではVisa、Worldpay、Circle、PayPal、Fiserv、Western Unionなどの名前が公式サイト上に並び、用途の広がりが特徴です。

分析対象として見た場合の論点は明確です。主な強みは、実利用を伴う低コスト・高スループット・開発者流入・深い流動性です。主な弱みは、過去の停止事例、依然として発展途上にあるクライアント多様性、性能と分散性・ハードウェア要求の緊張関係、そして規制の不確実性です。2026年7月時点でステータスページ上は直近90日100%稼働ですが、2021年9月の17時間停止や2024年2月の約4時間46分停止といった履歴は、Solanaを評価する上で現在も重要な確認事項です。

## 免責事項

本資料は教育・調査目的の情報提供であり、投資助言、勧誘、税務・法務助言ではありません。暗号資産は価格変動、流動性、技術、規制、カウンターパーティ、運用上の重大なリスクを伴います。Solana Foundation自身も、ネットワーク関連資料は教育・情報提供目的であり、投資助言ではないと明記しています。

## プロトコル概要

Solanaの基本設計は、**状態を保持するアカウント**と、**原則として状態を持たないプログラム**を分離するアカウントモデルにあります。公式ドキュメントでは、アカウントはデータ保持または実行可能プログラムのいずれかであり、ネイティブSOLやトークン、プログラム状態などはアカウントに保持されると説明されています。トランザクションは複数命令を含められ、すべての命令が成功した場合のみ成功する原子的実行です。加えて、メッセージ内で参照するアカウント群を先に列挙するため、実行計画を立てやすく、並列化しやすい構造になっています。

時間同期と順序付けでは、Solanaの白書がProof of Historyを「ブロックチェーンのための時計」と位置付けています。Terminologyではentry IDが、ある時間の経過後に生成され、どのトランザクションが含まれ、台帳内のどの位置にあるかの証拠になると定義されています。現行ネットワークでは、この時間順序付けとリーダースケジュール、ステーク加重投票、最終的に3分の2のステークが共通ルートを持つfinality条件が組み合わさって稼働しています。

手数料モデルは比較的シンプルです。Solana Docsによれば、基本手数料は**署名ごとに5,000 lamports**で、**基本手数料の50%はバーン**され、残り50%は処理したバリデータに支払われます。さらに優先手数料を付けることで、混雑時に取引処理の優先順位を高められます。この構造は、トークンの純供給を部分的に相殺しつつ、ブロック生産者への直接的な収益源を提供します。

<div class="article-mermaid">
<pre class="mermaid">flowchart LR
    A[ユーザー署名] --> B[トランザクションメッセージ作成]
    B --> C[参照アカウント列挙]
    C --> D[命令を順次実行]
    D --> E{全命令成功?}
    E -- Yes --> F[状態更新と確定]
    E -- No --> G[全体失敗]
</pre>
</div>

上の流れは、Solanaの「命令集合をまとめて送る原子的トランザクション」と「事前列挙型アカウント参照」の特徴を図式化したものです。金融アプリやDEXで複数操作を一括で通す場合、この実行モデルは実務上の利点になります。

ロードマップ上の最大テーマは**Alpenglow**です。Solana Foundationの2026年アップグレード一覧では、Alpenglowは「コンセンサスの大改修」とされ、**150msの確認時間**、既存の**PoHとオンチェーンvote transactionの除去**、そしてより単純な合意機構への移行が示されています。フォーラム上のSIMD-0326では、TowerBFTとPoHを置き換え、Votorと呼ばれる直接投票ベースの設計で**100〜150ms**の低遅延と、**20%敵対＋20%応答不能**でも生存性を目指す「20+20」レジリエンスが説明されています。2026年7月の公式チェンジログでは、AlpenglowのVotor部分をAgave v4.3以降で段階的に導入する作業が示されており、実装時期や仕様は今後も変更される可能性があります。これはSolanaの将来像を、単なる高速チェーンから超低遅延チェーンへ広げる試みと位置付けられます。

## トークノミクスと市場データ

以下は、2026年7月時点のSOLトークノミクスの要点です。単一ソースで完全一致するわけではなく、**流通供給や時価総額はデータプロバイダーごとに算定・更新時点がずれる**ため、概数として確認する必要があります。調査時点のSolana Compassでは総供給630,485,685 SOL、流通582,517,299 SOL、ステーク量425,847,335.6 SOL、インフレ率3.741%が表示され、CoinGeckoでは市場価格74.44ドル、時価総額433億ドル、過去最高値293.31ドル、過去最安値0.5008ドルが表示されていました。

| 項目 | 概要 |
|---|---|
| 総供給 | 約6.30億SOL。固定上限は明示されていないインフレ型。 |
| 流通供給 | 約5.83億SOL。算定方法により約5.80〜5.83億の幅。 |
| 現行インフレ率 | 約3.741%。 |
| 発行スケジュール | 初期8.0%、毎年15%ディスインフレ、最終1.5%を目標。 |
| ステーク比率 | 総供給の約67.5%がステーク。 |
| 手数料バーン | 基本手数料の50%をバーン。 |
| バリデータ報酬 | プロトコル発行＋手数料収入。将来的にSIMD-123によりブロック収益のdelegator分配を自動化予定。 |

市場面では、SOLはCoinGeckoで時価総額上位の大型暗号資産に位置付けられ、調査時点の24時間出来高は約15.6億ドルでした。価格履歴では、過去最高値が**293.31ドル**、過去最安値が**0.5008ドル**と示されており、ボラティリティは依然として高い状態です。流動性の厚み自体は大きい一方、価格変動幅も大きいため、現物保有・ステーキング・DeFi活用のいずれでもリスク管理が分析上の論点になります。

<div class="article-mermaid">
<pre class="mermaid">xychart-beta
    title "SOL 時価総額の代表点"
    x-axis ["2023Q4","2024Q4","2025Q3","2026-07-17"]
    y-axis "USD bn" 0 --> 120
    bar [43.8, 91.0, 113.5, 43.4]
</pre>
</div>

この図は、MessariとCoinGeckoの公開値から抽出した代表点です。2023年末の**438億ドル**、2024年末の**910億ドル**、2025年Q3の**1,135億ドル**を経て、2026年7月時点のCoinGecko値では**約434億ドル**に戻っています。これはSolanaの評価が、単純な右肩上がりではなく、マクロ市況・メムコイン循環・アプリ収益期待・規制・センチメントの影響を強く受けることを示唆します。なお、四半期末値と日次値を混在させているため、厳密な連続系列ではなく「代表観測点」です。

保有集中については、公開ソースから**最終受益者ベースの巨大保有者ランキングを厳密に確定するのは難しい**のが実情です。Solana Compassは、非流通供給の主な形態として、ロック付きステーク口座とSolana Labs／Solana Foundationが保有するステーク口座を挙げており、Foundationの委任プログラムは**2,000超のバリデータ**に再配分されると説明しています。また、同ページではAlameda関連のロック済みステークは**現在0 SOL**と表示されていました。したがって、SOLの保有集中を評価する際には、単純なウォレット残高ではなく、**カストディ、取引所オムニバス口座、Foundation委任、ロックアップ構造**を分けて確認する必要があります。

## エコシステムと開発動向

Solanaエコシステムの厚みは、単純なdApp数よりも、**用途の広さ**と**流動性の深さ**で評価するのが適切です。調査時点のDeFiLlamaでは、Solana上のプロトコル数は**555**、DeFi TVLは**約48.49億ドル**と表示されています。MessariのQ4 2025レポートでは、Solana上のステーブルコイン市場で**USDC 100億ドル、USDT 22億ドル、PYUSD 8.706億ドル**が確認でき、jitoSOLを中心としたliquid stakingも拡大しています。つまり、SOLは単なるL1トークンではなく、**ステーブルコイン流動性、LST、DEX、決済、トークン化資産**を束ねるエコシステム資産として機能しています。

ウォレット基盤も厚いです。Solanaの公式ウォレット比較ページでは**155ウォレット**が掲載され、Feature面では**Phantom、Solflare、Backpack、SquadsX**が目立ちます。さらに公式のWallet Standard／Solana Pay関連ドキュメントでは、**Phantom、Solflare、Backpack、Glow、Brave Wallet、Coinbase Wallet**などが接続先として挙げられています。これはリテールUXの観点で、Solanaがウォレット標準化を重視していることを示しています。

代表的なプロジェクト群を見ると、DeFiでは**Jupiter**がルーティング基盤、**Raydium**が流動性中核、**Jito**がMEV／LST領域、**Marinade**がliquid stakingの古参として知られます。NFT／コンシューマー領域では**Magic Eden**と**Metaplex**、DePINでは**Helium、Hivemapper、XNET**が繰り返し取り上げられています。2026年のSolanaエコシステム報告ではMagic EdenのSolana再集中、Metaplex Appのローンチ、KASTのwaitlistなどが示されており、NFTとコンシューマーアプリが再びSolanaネイティブに回帰している構図も見えます。

機関採用の文脈でも、Solanaは近年かなり前進しています。公式トップページには**Visa、Worldpay、Circle、PayPal、Fiserv、Western Union**が並び、2026年6月の記事では**MoneyGram**がSolana Developer Platformのインフラパートナー兼バリデータとして加わったとされています。こうした事例は、SolanaがDeFiとNFTだけのチェーンではなく、**決済・送金・トークン化・エンタープライズAPI**の土台としても展開されていることを示します。

開発者活動については、Electric CapitalのDeveloper Reportが、**Solanaは2024年の新規開発者獲得で1位、前年同期比83%増**と述べています。同じソースでは、Solanaが**NFT mint transactionsの64%**、**DEX transactionsの81%**を占めたとされ、開発者流入と実利用が連動していたことが読み取れます。加えてSolana Foundationの2025 Network Health ReportではAgave、Firedancer、Mithril、Sigという複数クライアント開発が進行しているとされ、アプリ開発だけでなく**基盤ソフトウェア側の開発密度**も高い状態です。

## パフォーマンス・セキュリティ・ガバナンス

Solanaの性能評価で重要なのは、**TPSだけを見ないこと**です。Solana Compassは、TPSはクラスタ全体の健康状態を見るのに有用だが、投票トランザクションが含まれるため全てではないと明記しています。同ページは**400msの期待ブロック時間**、投票TPSと非投票TPSの分離、CUベースのブロックスペース利用率など、より実務的な指標の方が重要だと示しています。つまりSolanaは、単純なTPS競争から、**compute capacity／latency／blockspace efficiency**の競争へ移行していると理解するのが適切です。

<div class="article-mermaid">
<pre class="mermaid">xychart-beta
    title "Solana の公開 throughput 代表値"
    x-axis ["2022平均実利用","公称能力","テスト環境"]
    y-axis "TPS" 0 --> 600000
    bar [4000,50000,600000]
</pre>
</div>

この図は、**厳密な時系列グラフではなく比較不能な代表値の整理**です。公式記事では2022年当時のネットワーク平均が**約4,000 TPS**、Coinbaseの要約ではSolanaは**50,000 TPSをサポート可能**と紹介され、別の公式記事ではFiredancerのテスト環境で**60万TPS**が示されています。したがって、SolanaのTPSは、**実利用値・公称能力・実験ベンチマークがしばしば混在する**点に注意が必要です。比較する場合は、Solana Data、Solana CompassやRPCの非投票TPS／block time／CUデータを時系列で確認する必要があります。

稼働安定性は、Solanaの主要な検証論点でもあります。公式ステータスページでは、2026年7月21日時点でMainnet Beta、RPC、Explorer、solana.comが**過去90日100% uptime**と表示され、直近のインシデント履歴も「なし」となっています。しかし公式の過去レポートでは、**2024年2月6日に4時間46分の停止**、**2021年9月14日に17時間の停止**が明記されています。2023年2月25日の障害では、長いblock finalization timeによりvote-only modeに入り、その後再起動が必要になりました。Solanaの安定性は改善していますが、「一度も止まらないチェーン」ではありません。

セキュリティ面では、近年の方向性はかなり明確です。Solanaのv1.17アップデート記事は、**fuzzers**と**複数の外部監査**を挙げ、監査レポートを公開するsecurity-auditsリポジトリへの掲載を案内しています。実際にanza-xyz/security-auditsには、Solana runtime、Durable Nonce、Address Lookup Table、Pinocchio、BLS signaturesなどに関する多数の監査ファイルが並んでいます。2025年4月のZK ElGamal Proof program脆弱性では、Anza・Firedancer・Jitoと外部監査会社がパッチをレビューし、スーパーマジョリティ採用後に公開、既知の悪用なしで収束しました。これは、障害報告だけでなく予防的なインシデント対応能力が高まっていることを示します。

ただし「Solanaは危険か」という問いには、**L1とアプリ層を分けて答える必要**があります。代表例として、2022年の**Wormhole**では約**3.2億ドル**規模の被害、同年の**Mango Markets**ではオラクル操作を用いた約**1.16億〜1.18億ドル**規模の被害が報告されました。これらはSolanaそのもののコンセンサス破綻ではなく、**ブリッジやアプリケーション設計の脆弱性**に属します。利用者・開発者にとっての実務上の教訓は、チェーン性能とは別に、**ブリッジ、オラクル、権限管理、監査品質、ガバナンス手続き**を個別に確認することです。

分散性は改善していますが、論点は残ります。調査時点のSolana Compass decentralization dashboardでは、**4,733ノード、714のstaked validators、Nakamoto coefficient 19、47カ国、450データセンター**と表示されています。一方でSolana Foundationの2025レポートは、**Agave／Jitoが約92%のステーク、Firedancerが約7%**とし、クライアント多様性は進展中だがまだ十分分散していないことを示します。2026年7月のFiredancer adoption trackerでは、Firedancerは**71バリデータ、14.69%のステーク**まで上昇しています。したがって、Solanaの分散性は単純な高低ではなく、**ノード地理的分散は広いが、ソフトウェア実装分散はまだ移行途中**と整理できます。

ガバナンスも転換点にあります。長らくSolanaのプロトコル変更は、**SIMD（Solana Improvement Documents）**とフォーラム議論、バリデータ・コア開発者の社会的合意に強く依存してきました。公式リポジトリは**SIMD-0001がプロセスを統治する**とし、2023年のValidator Health ReportもSIMDを「複数クライアント開発チームの調整が必要な変更のための設計文書」と説明しています。そこへ2026年には、**NCN snapshot＋svmgov**を用いたステーク加重のオンチェーン投票システムが加わりました。Solana Governance docsは、これをfully on-chainのvalidator governanceと説明しています。現在のSolanaは、非公式な社会的合意から形式化されたオンチェーン合意へと移行している最中です。

## 競争環境・規制・リスク

競争環境を一言で言えば、Solanaは**Ethereumのモジュラー優位**、**BNB Chainの流通優位**、**Aptos／Suiの新世代高性能L1**と同時に競合しています。Ethereumは公式にProof of Stakeを採用し、2015年以降の継続稼働を強調しています。BNB ChainはBNBに支えられたcommunity-driven ecosystemを掲げ、Aptosはsub-second finalityとzero downtimeを訴求し、Suiはhigh-performance full stackを前面に出しています。対してSolanaは、単一共有状態の高性能L1とエコシステムの厚みを特徴とします。差別化の中心は、**低遅延×低コスト×既存流動性×実アプリ稼働**です。

| ネットワーク | 公式上の主な打ち出し | 本稿の整理 |
|---|---|---|
| Solana | 高性能ネットワーク、低コスト、大量処理、アプリ・決済・資本市場向け。Alpenglowや100M CUが開発中。 | 実需と流動性の厚い高性能モノリシックL1 |
| Ethereum | PoS採用、2015年以降の継続稼働、実績のあるスマートコントラクト基盤。 | 安全性・実績・制度適合性で主要な比較対象 |
| BNB Chain | BNBに支えられたcommunity-driven decentralized ecosystem for Web3 dApps。 | 小売流通・既存ユーザー接点が強い競合 |
| Aptos | グローバルデジタル経済向けL1、sub-second finality、zero downtime。 | 新世代高性能L1としてSolanaと比較されやすい |
| Sui | 新しいグローバル経済向けfull-stack、高性能を前面に訴求。 | 近い市場を狙う高性能L1。アプリ厚みは継続的な比較項目 |

規制面では、SOLの扱いは法域依存であり、**単一のグローバル結論はまだない**と見る必要があります。米国ではSECの対Binance訴訟が2025年5月に却下され、Reutersはこれを暗号資産規制方針の変化と報じています。これはSOLに直接の白黒を与えるものではありませんが、米国の執行姿勢が固定的ではなく、政策変更の影響を強く受けることを示します。日本ではSBI VC TradeがSOLの現物・積立・レンディング・ステーキングを提供しており、国内流通面では一定の整備が進んでいます。市場参加者・事業者にとっては、**市場リスクに加えて、管轄リスクと商品提供リスク**が確認事項になります。

最後に、SOLの主要リスクを整理します。第一に、**運用リスク**。過去停止実績は改善していても完全解消ではありません。第二に、**ソフトウェア集中リスク**。Firedancerの浸透で改善中とはいえ、依然としてAgave系が支配的です。第三に、**エコシステムリスク**。ブリッジ、オラクル、権限管理の脆弱性はチェーン性能とは別に残ります。第四に、**評価倍率リスク**。SOLの時価総額は2025年に1,000億ドル超まで拡大し、その後2026年には大きく縮小しており、期待先行局面では下落幅も大きくなり得ることが示されています。第五に、**規制・上場リスク**。法域や取引所方針次第で、流動性アクセス条件が変わる可能性があります。

## 主要ソース

本稿は、Solanaの公式資料、公開アナリティクス、市場データ、規制・取扱情報を横断して作成しています。価格、供給量、ステーク比率、TVL、ネットワーク状態、規制状況は変化するため、リンク先の最新値とあわせて確認してください。

### プロトコル・アップグレード・ガバナンス

- [Solana Docs](https://solana.com/docs)
- [Accounts（Solana Docs）](https://solana.com/docs/core/accounts)
- [Transactions（Solana Docs）](https://solana.com/docs/core/transactions)
- [Fees（Solana Docs）](https://solana.com/docs/core/fees)
- [Terminology（Solana Docs）](https://solana.com/docs/references/terminology)
- [Solana Network Upgrades](https://solana.com/news/solana-network-upgrades)
- [SIMD-0326：Alpenglow Consensus Protocol Proposal](https://forum.solana.com/t/simd-0326-proposal-for-the-new-alpenglow-consensus-protocol/4236)
- [Solana Improvement Documents](https://github.com/solana-foundation/solana-improvement-documents)

### 稼働状況・セキュリティ・分散性

- [Solana Status](https://status.solana.com/)
- [Solana Network Health Report: June 2025](https://solana.com/news/network-health-report-june-2025)
- [Solana Security Audits](https://github.com/anza-xyz/security-audits)
- [Solana Compass](https://solanacompass.com/)
- [Solana Data](https://solana.com/data)

### エコシステム・市場データ

- [Solana公式ウォレット比較](https://solana.com/wallets)
- [Solana Pay](https://solana.com/docs/payments/accept-payments/solana-pay)
- [Solana Ecosystem Roundup: June 2026](https://solana.com/news/solana-ecosystem-roundup-june-2026)
- [Solana市場データ（CoinGecko）](https://www.coingecko.com/en/coins/solana)
- [Solanaチェーンデータ（DeFiLlama）](https://defillama.com/chain/Solana)
- [Electric Capital Developer Report](https://www.developerreport.com/)
- [SBI VC TradeのSOL取扱情報](https://www.sbivc.co.jp/services/crypto/sol)
