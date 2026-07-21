---
title: TRON（TRX）総合分析｜技術・USDT決済・市場データ・規制リスク
description: TRON（TRX）のDPoS、TVM、BandwidthとEnergy、供給・ステーキング、USDT決済、オンチェーン実績、エコシステム、ガバナンス集中、規制・セキュリティリスクを総合分析します。
date: 2026-07-21
updated: 2026-07-21
author: 国内暗号資産取引所ナビ
slug: trx
path: /articles/trx
articleType: market
marketTicker: TRX
category: レイヤー1
tags: TRON, TRX, DPoS, TVM, TRC-20, USDT, Bandwidth, Energy, ステーキング, ステーブルコイン
readMinutes: 24
---

> **重要：本記事は情報提供のみを目的としており、特定の暗号資産の売買・保有を勧誘または推奨する投資助言ではありません。** 掲載する評価、市場データ、利用例は調査時点の分析上の情報であり、将来の成果を保証しません。暗号資産は価格変動・流動性・技術・規制・オペレーション・カウンターパーティー等のリスクを伴います。実際の取引判断は、最新の公式情報を確認し、ご自身の状況に応じて行ってください。本稿の時点データは、原則として2026年7月21日JST時点で確認できた公開情報に基づきます。

## エグゼクティブサマリー

TRONは、一般的なスマートコントラクトL1の一つとしてよりも、**低コスト・高稼働のステーブルコイン決済レール**として理解すると実態に近いプロトコルです。公式サイトはTRONを最大規模のUSDTネットワークを支えるブロックチェーンとして位置付けており、TRON DAOは自らをコミュニティ運営型DAOと説明しています。公式ホワイトペーパーでは、TRONは高スループット、高可用性、高拡張性を掲げるアプリケーション基盤であり、2018年以降はTVM、TRC-20、DPoS、Stake 2.0などを通じて機能拡張を続けてきたと整理されています。

技術面では、TRONは**27のSuper Representatives（SR）**がブロック生成を担うDelegated Proof of Stake（DPoS）を採用し、平均ブロック間隔は約3秒です。スマートコントラクト実行環境である**TRON Virtual Machine（TVM）**はSolidityに対応し、EVMとの高い互換性を持ちながら、手数料体系はGasではなく**BandwidthとEnergy**を中心に設計されています。Ethereum系開発者にとっては移植性が高い一方、ネイティブトークンの小数桁数、opcodeの一部挙動、実行時間制約など、実務上の差異は無視できません。

市場面では、調査時点のTRXの時価総額はおおむね**約309億ドル**、流通供給量は**約948.7億TRX**、過去最高値は**0.4313ドル**で、CoinGecko上では時価総額上位圏に位置しています。オンチェーン面では、TRONSCANはTRX保有アカウント数を**約2.39億**、直近30日平均のデイリーアクティブアカウントを**約464万**、直近30日平均のデイリートランザクションを**約1,214万件**と示していました。DefiLlamaでも24時間アクティブアドレスは約400万規模で、TRONの利用が実需型であることを裏付けます。

一方で、市場評価を難しくする論点も明確です。第一に、**ガバナンス集中**です。TRON DAOの2026年第1四半期レポートでは、上位13のSRが投票ウェイトの**68%**を占めています。第二に、**規制・訴訟リスク**です。SECは2023年にJustin Sun、Tron Foundation Limited等を提訴し、2026年には和解・請求棄却を伴う整理が進みました。第三に、**TVLや収益などの指標定義の差**です。DefiLlamaのTRON DeFi TVLは約48億ドルである一方、TRONSCANとTRON DAOの四半期レポートは約260億〜267億ドルを示しており、集計範囲の違いを見分ける必要があります。第四に、TRON研究の学術文献はまだ厚くなく、近年の研究はUSDT中心構造、取引所支配、リソース委任市場、ギャンブル系利用や潜在的な不正利用の可能性に注目しています。

総じて、TRONの本質的な強みはEthereumの完全代替ではなく、**ステーブルコイン送金・決済・低コスト実行に最適化された流動性／決済インフラ**にあります。他方、主な弱みはガバナンスの相対的集中、実需のUSDT偏重、規制ニュースへの感応度、そして一般的な開発者重視L1として見た場合の相対的なブランド力の弱さにあります。本稿ではTRONを、投機対象としてではなく、**グローバルなドル送金レイヤーとしての暗号資産インフラ**という観点から整理します。

## プロトコルと技術基盤

### アーキテクチャと実行環境

TRONの公式ホワイトペーパーは、プロトコルを**Core Layer、Storage Layer、Application Layer**の3層アーキテクチャとして説明しています。Core Layerにはスマートコントラクト、アカウント管理、コンセンサスが含まれ、Storage LayerはBlock StorageとState Storageを担い、Application Layer上でdAppsやウォレットが構築されます。通信・データ表現には**Protocol Buffers**が採用されており、多言語クライアント実装に向いた設計です。

TVMはTRONのスマートコントラクト実行環境であり、TRONを単なる分散台帳ではなく**分散ステートマシン**として機能させる中核要素です。開発者向けドキュメントとホワイトペーパーの双方が、TVMを軽量かつチューリング完全な仮想マシンとして記述しており、Solidityでコンパイルされたコントラクトを実行できます。TRONの状態はMerkle Trieで管理され、署名済みトランザクションによって状態遷移が起きます。

Ethereum互換性はTRONの重要な採用要因です。TRON Developer Hubは、TVMがEVMに概ね互換であり、**多くのEthereum SolidityコントラクトはTRON上へ移植可能**と説明しています。ただし、TRONはTRXが**6桁小数**、手数料モデルが**GasではなくBandwidth／Energy**、`GASPRICE`や`BASEFEE`など一部opcodeの挙動が異なるなど、差分を明示しています。開発ツールもTronBox、TRON-IDE、TronWeb、TRONSCANなど、Ethereum系ツールチェーンに相当する整備が進んでいます。

また、TRONのスマートコントラクトには明示的な**実行時間制限**が設定されています。公式ドキュメント上のネットワークパラメータでは、TVMの最大実行時間は**80ms**で、SR委員会の提案で変更可能な動的パラメータです。これはアプリケーション設計上、重いロジックや過度の再帰呼び出しを避ける必要があることを意味します。

次の図は、TRONの主要な技術・利用主体の関係を、公式サイト、公式ドキュメント、公式エクスプローラ、BTTC公式情報をもとに整理した概念図です。

<div class="article-mermaid">
<pre class="mermaid">graph TD
    A[TRON L1]
    A --> B[TRX]
    A --> C[TVM]
    A --> D[DPoS 27 SRs]
    A --> E[TRC-10]
    A --> F[TRC-20]
    A --> G[TRC-721 / TRC-1155]
    A --> H[TRONSCAN]
    A --> I[Developer Hub]
    A --> J[BTTC]
    F --> K[USDT on TRON]
    F --> L[USDD]
    F --> M[stUSDT]
    C --> N[JustLend DAO]
    C --> O[SUN.io]
    A --> P[TronLink]
    A --> Q[Payments]
    A --> R[DeFi]
    A --> S[AI / RWA initiatives]
</pre>
</div>

### コンセンサスとガバナンス

TRONのコンセンサスは**Delegated Proof of Stake**です。公式ドキュメントでは、TRONでは**3秒を1スロット**と見なし、通常時は各SRが対応スロットでブロックを生成します。TRX保有者がステーキングを通じて投票権を獲得し、**6時間ごと**に集計される投票で上位27候補がSRになります。ホワイトペーパーは、27 SRがブロック生成を担い、TRONの設計目標を**2,000 TPS超**と説明しています。なお、このTPS値は公式性能主張であり、独立ベンチマークではありません。

報酬設計はガバナンスパラメータにより変更されます。旧ホワイトペーパーでは3秒ごとに1ブロック、1ブロックにつき16 TRXというモデルが示されていましたが、調査時点の公式パラメータ一覧ではSRブロック生成報酬は**8 TRX**と表示されています。したがって、TRXの供給動態を確認する際は、過去の白書数値を現在値として扱わず、最新のネットワークパラメータとバーン量を併せて確認する必要があります。

TRONのガバナンス品質を評価する際には、単にオンチェーン投票があることよりも、**投票集中度**を確認する必要があります。TRON DAOのQ1 2026レポートは、上位13のSRが投票シェアの**68%**を占めるとしています。DPoSの高速性と引き換えに、検証者集合の絞り込みが相対的な集中リスクを伴う点は、TRONの主要な評価論点です。

### トークン規格、資源モデル、相互運用性

TRONのトークン規格は、**TRX、TRC-10、TRC-20、TRC-721、TRC-1155**が中核です。公式ドキュメントでは、TRC-10はシステムコントラクト経由のネイティブ規格、TRC-20はTVM上のスマートコントラクト規格で**ERC-20互換**、TRC-721は**ERC-721互換**と説明されています。この互換性は、Ethereum資産や開発体験に近い一方、コスト構造は異なるというTRONの特徴を示します。

手数料体系はTRON独特です。TRX送金やTRC-10移転は主に**Bandwidth Points**を消費し、スマートコントラクトのデプロイや実行には**BandwidthとEnergy**の双方が必要です。TRXをステーキングすることでこれらの資源を得られるため、単純なGas課金のみを前提にしたEthereum的理解では、TRONの実質コストを正しく把握できません。TRONSCANのステーキングページも、TRX保有者がステーキングを通じてガバナンス参加と報酬獲得を行う構造を示しています。

相互運用性では、**BTTC**がTRONの主要フロントです。BTTC公式ページは、Ethereum、BNB Chain、TRONを含む異種チェーン間のクロスチェーンサービスを提供すると説明しており、TRON側の公式サイトも相互運用性強化を今後の方向性として明示しています。もっとも、ブリッジは一般に高リスク領域であり、エコシステムのセキュリティ評価では本体チェーンとブリッジを分けて考える必要があります。

## 市場データとオンチェーン実績

TRXの市場面では、調査時点のCoinGeckoがTRXの時価総額を**約309億ドル**、流通供給量を**約950億TRX**とし、過去最高値を**0.4313ドル**、過去最安値を**0.001804ドル**と示していました。CoinMarketCapも流通供給量・総供給量ともに約948.7億TRX、最大供給量は上限なしと表示しており、TRXがビットコイン型の固定上限設計ではないことを確認できます。

価格は短期変動が大きいため、本稿は価格予想ではなく、**利用構造とネットワーク特性**の解釈に重心を置きます。以下の値は継続的に変化するスナップショットであり、確認時点の違いにより各データ提供元の表示が一致しない場合があります。

### 市場・オンチェーン主要指標

| 指標 | 2026年7月21日前後の確認値 | 読み方 |
|---|---:|---|
| TRX価格 | 約0.326〜0.329ドル | 市場価格は短期変動するため時点確認が必要 |
| 時価総額 | 約309億〜313億ドル | 主要暗号資産の上位圏 |
| 流通供給量 | 約948.7億TRX | 固定上限型ではなく、供給はバーンと発行の差で変動 |
| 過去最高値 | 0.4313ドル | CoinGeckoの調査時点表示 |
| TRX保有アカウント数 | 約2.39億 | 広い保有ベースを示唆 |
| 累計トランザクション | 約148.3億件 | 長期利用実績の規模を示す |
| 30日平均デイリーアクティブ | 約464万 | L1として高い活動水準 |
| 30日平均デイリーTx | 約1,214万件 | 送金・決済中心の高頻度利用 |
| 24時間アクティブアドレス | 約393万〜403万 | 独立集計でも高水準 |
| ステーク済みTRX | 約458.2億TRX | 供給の約48.3% |
| Stablecoins MCap | 約915億ドル | TRONの強みがステーブルコイン層に集中 |
| DeFi TVL | 約48億ドル | 独立定義ベースのDeFi規模 |
| TRONSCAN広義TVL | 約266億〜267億ドル | ステーキング等を含むためDefiLlamaと定義が異なる |

TRONの供給動態は、単純なインフレでも永久デフレでもありません。TRON Developer Hubは、TRONSCANデータに基づき、総供給量が一時**約1,020億**まで増加した後に長期的なデフレ傾向へ転じたと説明していますが、TRON DAOのQ1 2026レポートでは、同四半期は**約3.523億TRX発行、約2.818億TRXバーン、差し引き約7,050万TRX純増**で、四半期ベースではネットインフレでした。したがって、TRXの供給評価は期間を明示して行う必要があります。

次の円グラフは、現在の総供給とステーキング量から見たTRX供給の概観です。ステーク済みは約**458.2億TRX**、未ステークは単純差分で約**490.6億TRX**となります。

<div class="article-mermaid">
<pre class="mermaid">pie title TRX供給概観
    "ステーク済み 45.82B" : 45.82
    "未ステーク推計 49.06B" : 49.06
</pre>
</div>

### 取引所上場と流動性観察

TRXは主要取引所で広く取り扱われています。BinanceはTRX／USDT現物、Kraken ProはTRX／USD現物、OKXはTRX／USDT現物を提供しています。一方、調査時点のCoinbaseはTRXの価格ページを掲載しているものの、Coinbaseでは取引不可と表示していました。したがって、TRXの国際的な流動性は存在する一方、**取引所ごとの地域規制差**は無視できません。

| 取引所 | 確認できた取扱い | コメント |
|---|---|---|
| Binance | TRX／USDT現物 | グローバル流動性の中心の一つ |
| Kraken | TRX／USD現物 | 米ドル建て市場の確認先 |
| OKX | TRX／USDT現物 | 国際的な板流動性の補完先 |
| Coinbase | 価格掲載、現物取引不可 | 地域・取引所ごとの取扱差を示す例 |

### 大口保有者と分布の読み方

大口保有構造の把握では、**TRONSCANのTop AccountsまたはAccount List APIを当日取得すること**が重要です。TRONSCANにはTop Accountsランキングとアカウント一覧APIが存在し、残高や投票力等による並べ替えができます。ただし、公開検索レンダリングだけでは残高ベースの上位保有比率を安定的に固定できず、厳密な集中度分析にはTRONSCAN本体またはAPIの当日スナップショットが必要です。したがって、**保有者数が多いことと、実効支配が分散していることは別の論点**として確認する必要があります。

## エコシステムと競争環境

TRONのエコシステムは、公式エクスプローラ上でも**JustLend DAO、SUN.io、USDD、stUSDT、BTTC、BTFS、TronLink**が中核として並びます。これは、TRONのユースケースが決済、レンディング、AMM、分散型ステーブルコイン、RWA、クロスチェーン、ウォレットに広がっていることを意味します。ただし、DeFiの構造を見ると、DefiLlama上のTVL上位は**JustLend**と**USDD**、そして周辺プロトコルへの集中が大きく、プロトコル多様性はEthereumほど厚くありません。

TRON DAOの公式研究は、TRONを**ステーブルコイン決済・流動性インフラ**として強く打ち出しています。Q1 2026レポートでは、TRONが**860.2億ドルのステーブルコイン供給**と**1.96兆〜2.04兆ドル規模のステーブルコイン決済量**を支えたとし、MetaMask、WalletConnect、Anchorage、Mastercard等との統合拡大にも言及しています。独立系のDefiLlamaもTRONのStablecoins MCapを約**915億ドル**と示しており、TRONのネットワーク価値がトークン価格だけでなく、**ドル建て流動性の移動**にあることを補強します。

開発者活動については、Electric CapitalのライブダッシュボードがTRONを継続追跡しています。TRON DAOのQ1 2026レポートは、コア開発コミットが**前四半期比30%増**、提案#104の反映で**スマートコントラクト配備コストが約60%低下**したと述べています。これは、TRONが既存インフラの維持だけでなく、費用最適化と互換性改善を続ける稼働中のL1であることを示します。

### 競争ポジショニング

| チェーン | 技術構成 | 手数料・資源 | 活動の特徴 | DeFi TVL | Stablecoin規模 | 本稿の整理 |
|---|---|---|---|---:|---:|---|
| TRON | DPoS、27 SR、TVM、約3秒ブロック | Bandwidth／Energy、TRXステークで資源取得 | 約400万の24hアクティブ、約1,200万件のデイリーTx | 約48億ドル | 約915億ドル | 決済・送金・USDT基盤に強い。ガバナンス集中と実需偏重が論点 |
| Ethereum | PoS、EVM | Gas市場、ETH建て | 開発者・資本・制度接続が厚い | 約415億ドル | 約1,500億ドル | 汎用スマートコントラクト基盤の主要比較対象 |
| BNB Smart Chain | PoSA、EVM互換 | 低コスト、短ブロック | 小売・一般DeFiアクティビティが厚い | 約49億ドル | 約135億ドル | 低コストEVMの競合。TRONより一般DeFi色が強い |
| Solana | PoH併用PoS系、SVM | 低手数料 | 高頻度アプリと大量トランザクション | 約50億ドル | 約152億ドル | 高性能アプリ基盤。TRONほどUSDT決済偏重ではない |

この比較から見えてくるのは、TRONの競争軸がEthereumの万能L1、Solanaの高性能アプリL1、BSCの低コストEVMと少しずれている点です。TRONの優位は、**大規模ステーブルコイン供給と低コスト送金の組み合わせ**にあります。逆に、NFTカルチャー、最先端アプリ開発、制度商品化の中心という観点では、EthereumやSolanaの方が一般に強い存在感を持ちます。

## 採用ドライバーと主要リスク

### 採用ドライバー

TRONの主要な採用ドライバーは、グローバルなドル送金・決済需要の拡大です。TRON DAOはTRONを世界最大規模のUSDTネットワークと位置付け、Q1 2026の公式レポートではTRON上のステーブルコイン供給を**860.2億ドル**、決済量を**1.96兆〜2.04兆ドル**と報告しています。DefiLlamaでもTRONのStablecoins MCapは約**915億ドル**と表示され、送金ネットワークとしての規模が独立集計でも確認できます。国境をまたぐ少額・中口決済、取引所間の価値移転、店頭・新興国文脈のUSDT利用が続く限り、TRONの基盤需要を支える要因になります。

第二の採用ドライバーは、**EVM互換性を維持したままコスト競争力を出せること**です。TRONはSolidity開発を受け入れつつ、Bandwidth／Energyモデルにより、ユースケースによってはEthereumより低コストの実行環境を提供できます。2024年以降のGreatVoyage系アップグレードでも、Cancun互換命令導入、EIP-6780互換、JDK 17やARM64対応、ノード性能改善などが続いており、継続改良型の運用基盤であることが分かります。

第三の採用ドライバーは、**組織利用向け接続の改善**です。TRON DAO公式サイトはAnchorage対応拡大をニュースとして掲示し、Q1 2026レポートでもMetaMask、WalletConnect、Anchorage、Mastercardとの統合に言及しています。これらは将来需要を保証するものではありませんが、TRONが個人利用だけでなく、**カストディ・ウォレット・決済**のインフラ層に浸透しようとしていることを示します。

### リスクの整理

最重要リスクは、**規制とレピュテーションの結び付き**です。SECは2023年にJustin Sun、Tron Foundation Limited、BitTorrent Foundation Ltd.、Rainberry Inc.を提訴し、TRXとBTTの未登録提供、ウォッシュトレード等を主張しました。SECは2026年、グローバルな解決の一環としてRainberryに関する一部請求の和解案を提出し、残る請求を棄却したと公表しています。ただし、TRONのブランドは現在も創業者関連ニュースと切り離されていません。さらにEUのMiCAはステーブルコインと暗号資産サービスに規制を適用しており、TRONそのものだけでなく**TRON上の主要アセット流通**も制度評価の対象になります。

第二に、**コンプライアンスと不正利用のリスク**です。近年の学術研究は、TRONデータ分析の中でUSDTの中心性、取引所支配、ギャンブル利用、潜在的不正利用分析の重要性を指摘しています。これはTRON自体が違法という意味ではなく、**コストが低く流動性が豊富なインフラは、正当用途と不正用途の双方に利用されやすい**という構造的問題です。

第三に、**セキュリティは本体チェーンと周辺プロトコルを分けて評価する必要**があります。Least Authorityの2020年監査は、TRONコードベースを概ね整理されていると評価しつつ、Unsafe Random UsageやEclipse Attacks On TRON Nodesなどの問題を指摘しました。主要Issueは解決済みとされる一方、アップグレード配布の安全性やDataWord mutabilityの提案には残論点がありました。java-tronのSecurityページには調査時点で公開済みアドバイザリはなく、HackerOneを通じた報告窓口が案内されています。つまり、セキュリティ体制はあるものの、**恒常的なレビューが必要な稼働系インフラ**と位置付けられます。

第四に、**エコシステム集中**です。DefiLlama上でTRONのTVLはJustLendとUSDD周辺への依存が大きく、TRON DAO公式レポートでもTVLの中心はTRX StakingとJustLendです。TRONは広く分散した多様なアプリ経済圏というより、**ステーブルコイン・レンディング・ステーキングを核とした集中型のアクティビティ構造**です。これは効率性の源泉である一方、単一テーマ依存の脆弱性でもあります。

最後に、**指標の定義差**も実務リスクです。TRONのTVLだけでも、調査時点でDefiLlamaは約48億ドル、TRONSCANは約267億ドル、TRON DAO公式Q1 2026レポートは約260億ドルを示しています。これはどれか一つが必ず誤りというより、TVLの集計範囲に**ステーキング、ネイティブ資産、CDP、ブリッジ資産などをどこまで含めるか**の差があると考えられます。このため、TRON評価では**DeFi TVL、stablecoin supply、chain fees／revenue、transaction throughput**を分けて見る必要があります。

## 主要イベント年表

| 時期 | 出来事 | 意味 |
|---|---|---|
| 2017年7月 | TRON設立 | プロジェクトの起点 |
| 2017年8月 | ICO実施 | 初期資金調達 |
| 2018年5月 | Mainnet Odyssey 2.0 | 独立L1化 |
| 2018年6月 | SR選出開始 | DPoSガバナンスの本格化 |
| 2018年7月 | BitTorrent買収 | 配信・相互運用の構想拡張 |
| 2018年10月 | TVMローンチ | Ethereum互換路線の確立 |
| 2019〜2021年 | TRC-20 USDT拡大 | ステーブルコイン決済レール化 |
| 2021年 | BTTCローンチ | クロスチェーン強化 |
| 2023年1月 | GreatVoyage v4.7.0.1、Stake 2.0導入 | 資源管理・効率改善 |
| 2025年4月 | GreatVoyage v4.8.0 Kant | Ethereum近年仕様への適応 |
| 2026年2月 | GreatVoyage v4.8.1 Democritus | EIP-6780、JDK 17、ARM64最適化 |
| 2026年3月 | SEC案件の解決手続きが進展 | 法務・レピュテーション論点の更新 |
| 2026年Q1 | ステーブルコイン供給860.2億ドル、決済量約2兆ドル | TRONの決済インフラとしての規模を示す指標 |

## まとめ

TRONを理解する上で最初に押さえるべき点は、TRONが次のEthereumを目指すL1というより、**USDT送金を大量に処理する実用インフラ**として強い地位を持つことです。低コスト送金、約3秒のブロック、TVM、TRC-20 USDT、巨大なアクティブアドレス数は、ネットワークの現在地を示す主要な要素です。

技術や市場データは、**速い、低コスト、使われている**という三つの観点に分けると理解しやすくなります。技術面ではDPoS、TVM、Bandwidth／Energy、EVM互換性。市場面では時価総額、流通供給量、供給の増減。利用面ではTRX保有アカウント数、日次アクティブ、日次トランザクション、USDT供給、決済量が確認項目です。

一方、TRONを過度に肯定的または否定的に単純化することは適切ではありません。TRONは大規模決済インフラとして現実の需要を獲得している一方、ガバナンス集中、創業者関連ニュース、規制、ブリッジや周辺アプリのセキュリティ、指標定義の差異といった論点を伴います。技術だけ、または価格だけではなく、**インフラとしての実用性と制度的摩擦の両面**を確認する必要があります。

## 主要情報源と参考文献

本稿は、TRONの一次資料、公式エクスプローラ、規制当局資料、独立系オンチェーン集計を横断して作成しています。価格、供給量、ステーク比率、取引件数、TVL、ステーブルコイン供給、取引所取扱状況は変化するため、リンク先の最新値とあわせて確認してください。

### TRON公式資料・開発者資料

- [TRON公式サイト](https://tron.network/)
- [TRONホワイトペーパー v2.1](https://tron.network/static/doc/white_paper_v_2_1.pdf)
- [TRON Developer Hub](https://developers.tron.network/)
- [TRONのトークノミクスとDPoS](https://developers.tron.network/docs/tron-economic-model)
- [Super Representativesとネットワークパラメータ](https://developers.tron.network/docs/super-representatives)
- [java-tron公式リポジトリ](https://github.com/tronprotocol/java-tron)
- [java-tron Security](https://github.com/tronprotocol/java-tron/security)
- [BTTC Bridge](https://bt.io/bridge-solution)

### ネットワーク・市場データ

- [TRONSCAN](https://tronscan.org/)
- [TRX Staking（TRONSCAN）](https://tronscan.org/data/charts/trx/staked)
- [Super Representative投票（TRONSCAN）](https://tronscan.org/sr/votes)
- [Top Accounts（TRONSCAN）](https://tronscan.org/data/rankings/accounts)
- [TRON Q1 2026 Quarterly Report](https://trondao.org/research/tron-q1-2026-quarterly-report)
- [TRONチェーンデータ（DefiLlama）](https://defillama.com/chain/tron)
- [TRONステーブルコインデータ（DefiLlama）](https://defillama.com/stablecoins/tron)
- [TRX市場データ（CoinGecko）](https://www.coingecko.com/en/coins/tron)
- [TRX市場データ（CoinMarketCap）](https://coinmarketcap.com/currencies/tron/)
- [Electric Capital Developer Report](https://www.developerreport.com/)

### 規制・セキュリティ

- [SECのJustin Sun・Tron Foundation関連訴訟リリース](https://www.sec.gov/enforcement-litigation/litigation-releases/lr-26496)
- [SECの2026年提出文書](https://www.sec.gov/files/litigation/litreleases/2026/judgment26496.pdf)
- [MiCA概要（ESMA）](https://www.esma.europa.eu/esmas-activities/digital-finance-and-innovation/markets-crypto-assets-regulation-mica)
- [TRON DAO Bug Bounty（HackerOne）](https://hackerone.com/tron_dao)
