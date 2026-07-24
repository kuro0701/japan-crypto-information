---
title: Stellar（XLM）総合分析｜SCP・Soroban・供給・決済・集中リスク
description: Stellar（XLM）のSCP、資産発行・DEX、Soroban、XLM供給とSDF保有、MoneyGram・PYUSD・BENJI、市場データ、規制・セキュリティリスクを総合分析します。
date: 2026-07-24
updated: 2026-07-24
author: 国内暗号資産取引所ナビ
slug: xlm
path: /articles/xlm
articleType: market
marketTicker: XLM
category: 決済・資産トークン化
tags: Stellar, XLM, SCP, FBA, Soroban, SDEX, アンカー, PYUSD, MGUSD, BENJI, RWA, 国際送金
readMinutes: 28
---

> **重要：本記事は情報提供のみを目的としており、特定の暗号資産の売買・保有を勧誘または推奨する投資助言ではありません。** 掲載する評価、市場データ、利用例は調査時点の分析上の情報であり、将来の成果を保証しません。暗号資産は、価格変動、流動性、技術、規制、税務、オペレーション、カウンターパーティー等のリスクを伴います。実際の利用・取引判断は、最新の公式情報を確認し、ご自身の状況に応じて行ってください。本稿の時点データは、原則として2026年7月24日JST時点で確認できた公開情報に基づきます。

## エグゼクティブサマリー

Stellarは、法定通貨連動資産、ステーブルコイン、証券・ファンド持分等を発行・移転・交換できるパブリックネットワークです。ネイティブ資産のXLMだけを送るチェーンではありません。発行資産、組み込み型の分散型取引所（SDEX）、パス支払い、オン・オフランプ、スマートコントラクトを一つの台帳上で組み合わせ、国際送金、決済、資産トークン化を支えることを主な設計目標としています。

合意形成には**Stellar Consensus Protocol（SCP）**を使います。各バリデーターが信頼するノード集合を選ぶFederated Byzantine Agreement（FBA）型で、Proof of WorkのマイニングやProof of Stakeのステーキングはありません。バリデーターへのプロトコル報酬もありません。一方、クォーラム設定が一部の組織へ集中すると、複数組織の同時停止や設定不整合がネットワークの継続性へ影響します。2025年7月にSDFが公表した構成では、ネットワークのTier 1は7組織を中心にまとまり、7組織中5組織相当の合意を求める設計でした。

通常のClassic取引は、Payment、資産発行、信頼ライン、SDEX注文、パス支払い等のオペレーションを最大100個まで原子的にまとめられます。最低ベース手数料は1オペレーション当たり100 stroops、すなわち0.00001 XLMですが、混雑時はsurge pricingで上昇します。スマートコントラクト取引は、これにCPU、台帳I/O、イベント、保存期間等に応じたリソース手数料とデータ保管のrentが加わります。手数料は特定主体の収益にならずアクセス不能なfee poolへ蓄積されますが、技術的に毎回「焼却」されるわけではありません。

2024年2月のProtocol 20でSorobanスマートコントラクトがメインネットへ導入されました。2025年9月のProtocol 23「Whisk」は並列実行やイベント統合を進めましたが、その後にstate archivalの不整合が発覚し、一部エントリーの隔離・復元が必要になりました。2025年10月のProtocol 24で安定化対応が実施され、2026年1月のProtocol 25「X-Ray」ではBN254、Poseidon等のゼロ知識証明向け暗号プリミティブが追加されました。X-Rayはプライバシー対応アプリを作る基盤であり、Stellar上のすべての取引を自動的に匿名化する機能ではありません。

XLMは、手数料、Classicアカウントの最低残高、信頼ライン等の台帳エントリー、スマートコントラクトデータのrentに使われます。すべての送金でXLMが中継資産になるわけではなく、流動性のある発行資産同士を直接交換できる場合もあります。2026年7月24日の公式供給APIでは、総供給量は約500.018億XLM、流通供給量は約341.749億XLM、SDF Mandateに分類される残高は約155.578億XLMでした。元原稿にある「SDFが300億XLM、供給の60%を現在も保有」という数値は、2019年直後の配分を現在値として扱っており正確ではありません。

実利用では、MoneyGramの現金オン・オフランプと2026年6月に米国で開始したMGUSD、2025年9月にStellar対応したPayPal USD（PYUSD）、Franklin TempletonのBENJIトークン化ファンド、国際援助の配布事例等が公表されています。ただし、提携発表、実証実験、限定地域での開始、全世界での本番利用は区別が必要です。BENJIについても、2026年4月公表の約19.8億ドルは複数チェーンを含むBENJIスイート全体で、Stellar上は6.5億ドル超でした。

市場面では、2026年7月24日のCoinGecko集計でXLMは約0.184ドル、時価総額約62.9億ドル、24時間出来高約1.37億ドル、時価総額順位19位でした。集計サイト、時刻、異常値除外方法によって値は変わります。価格の長期推移だけでなく、SDF保有残高の放出、取引所別板の厚み、オンチェーン資産の発行体信用、バリデーター構成、規制、スマートコントラクトの不具合を別々に確認する必要があります。

## 基本情報

| 項目 | 内容 | 確認上の注意 |
|---|---|---|
| ネットワーク | Stellar | オープンソースのパブリック分散台帳 |
| 開始 | 2014年7月 | Jed McCaleb、Joyce Kimらが立ち上げ、Stripeが初期資金を提供 |
| 開発・支援組織 | Stellar Development Foundation（SDF） | 非営利組織。ネットワークそのものや全バリデーターを単独所有するわけではない |
| 合意形成 | Stellar Consensus Protocol（SCP） | FBA型。各バリデーターがクォーラムセットを選択 |
| ネイティブ資産 | lumen（XLM） | 発行体・信頼ラインを持たない唯一のネイティブ資産 |
| 主な用途 | 手数料、最低残高、rent、交換・流動性 | すべての支払いで中継資産として必須ではない |
| Classic機能 | 支払い、資産発行、信頼ライン、SDEX、AMM、複数署名等 | 発行資産には発行体・償還・権限リスクがある |
| スマートコントラクト | Soroban | Rust向けSDK、Wasm実行環境。2024年2月にProtocol 20で導入 |
| ステーキング | プロトコルには存在しない | バリデーター報酬もない。第三者の利回りサービスは別の信用リスク |
| 現行自動インフレ | なし | 2019年10月にバリデーター投票で廃止 |

## 歴史：初期ネットワークからSCPへ

Stellarは2014年7月に公開されました。初期ネットワークはRipple/Stellar系の旧合意アルゴリズムを利用していましたが、2014年12月に台帳が分岐し、数時間分をロールバックする事象が発生しました。SDFは安全性の確保を優先して一時的に単一バリデーターへ移行し、新しい合意方式の開発を進めました。

Stanford大学教授のDavid Mazièresが設計したSCPは2015年4月に論文とコードが公表され、同年にネットワークへ導入されました。SCPは、参加者全員が同一の中央リストに従うのではなく、各ノードが信頼する参加者を選べるFBAを採用します。この変更はStellarの現在の設計を理解する上で重要です。

主な出来事は次のとおりです。

| 時期 | 出来事 | 読み方 |
|---|---|---|
| 2014年7月 | Stellar公開 | 1000億XLM相当が初期生成 |
| 2014年12月 | 旧合意アルゴリズムで台帳分岐 | SCP以前の事象。ロールバックと一時的な単一バリデーター運用 |
| 2015年 | SCPへ移行 | 現在のFBA型合意形成の基礎 |
| 2019年5月 | ネットワークが67分停止 | Tier 1構成とクォーラム設計の課題を示した |
| 2019年10月 | 年1%の自動インフレを廃止 | バリデーターによるプロトコル投票 |
| 2019年11月 | SDFが約554.42億XLMをアクセス不能化 | 現在の総供給量は約500.018億XLM |
| 2024年2月 | Protocol 20 | Sorobanスマートコントラクトを導入 |
| 2025年9月 | Protocol 23「Whisk」 | 並列処理、イベント統合、state archivalの基盤 |
| 2025年10月 | Protocol 24 | state archival問題を受けた安定化 |
| 2026年1月 | Protocol 25「X-Ray」 | ZK証明検証向け暗号プリミティブを追加 |
| 2026年6月 | MGUSD開始 | MoneyGramが米国から開始。世界展開は段階的 |

## Stellar Consensus Protocol（SCP）

### クォーラムセットとクォーラムスライス

SCPでは、バリデーターが「どのノード群の賛成を十分とみなすか」をクォーラムセットとして設定します。クォーラムスライスは、そのノードが合意へ進むために必要な信頼集合の部分です。複数ノードのスライスが十分に重なり、**quorum intersection**が保たれていることが、安全性と一つの台帳へ収束するための重要な条件です。

<div class="article-mermaid">
<pre class="mermaid">graph TD
    A[Validator quorum settings] --> B[Overlapping quorum slices]
    B --> C[Nomination]
    B --> D[Ballot protocol]
    C --> E[Agreed transaction set]
    D --> E
    E --> F[Closed ledger]
</pre>
</div>

PoWのハッシュパワーやPoSの預託額に応じて権利を配る方式ではないため、SCPの分散性はノード数だけでは測れません。重要なのは、誰がバリデーターを運用し、どのクォーラム設定が実際に使われ、組織・クラウド・地域・ソフトウェアがどの程度分散しているかです。

### Tier 1構成と停止耐性

SDFが2025年7月に公表した自らのクォーラムセットには、Blockdaemon、Creit、Franklin Templeton、LOBSTR、Public Node、SatoshiPay、SDFの7組織が含まれました。各組織は3バリデーターのうち2を組織の票として扱い、7組織のうち5に相当する合意を必要とする構成でした。最大2組織の障害を許容する一方、同時に3組織が利用不能になると停止し得ます。

これはSDFがすべての取引を単独承認することを意味しません。しかし、ネットワーク全体が類似するTier 1集合を信頼している場合、名目上のノード数より組織依存が大きくなります。SDFはTier 1組織と障害耐性を増やす方針を示していますが、計画と実装済みの状態を分けて確認する必要があります。

### バリデーター報酬とガバナンス

Stellar Coreを動かすバリデーターへ、プロトコルがXLMを発行・配布する仕組みはありません。運営主体は、自社サービスの可用性、ネットワーク参加、公共インフラへの貢献等を理由に費用を負担します。XLM保有量が投票権になるオンチェーンガバナンスもありません。

プロトコルアップグレードやネットワークパラメータは、対応ソフトウェアを導入したバリデーターの合意で有効化されます。SDFは開発、提案、リリース調整で大きな役割を持ちますが、形式上はバリデーターがアップグレードを採択します。この構造では、コード開発の集中と検証運用の集中を別々に観察する必要があります。

## 台帳、アカウント、トランザクション

Stellarでは、合意済み状態が連続するledgerとして確定します。公式ドキュメントはledgerを一般に5〜7秒程度で閉じると説明しますが、実測値は負荷・設定・集計期間で変わります。2026年7月時点の公式サイトが直近30日指標として掲示したsettlement timeは約9.5秒でした。「常に5秒で確定する」と固定値で扱わない方が実態に近くなります。

Classicトランザクションは最大100個のオペレーションを含められ、全オペレーションが成功するか、全体が失敗する原子性を持ちます。スマートコントラクト実行トランザクションは原則1オペレーションで、CPUやI/O等のリソース上限を別に持ちます。

主なClassicオペレーションには次があります。

- XLMまたは発行資産を送るPayment
- 交換経路を指定し、送付資産と受取資産を変えるPath Payment
- アカウント作成、署名者・閾値・ホームドメイン等の設定
- 信頼ラインの作成・更新
- SDEXの買い・売りオファー作成
- 流動性プールへの入出金
- Claimable Balance、スポンサー付きリザーブ
- 発行資産の認可、凍結、clawback

取引所やカストディサービスへの入金では、同じ受取アドレスを多数ユーザーで共有し、memoで利用者を識別する場合があります。memoの欠落・誤入力、未対応資産、誤ったネットワークへの送信は、反映遅延や資金回収不能につながり得ます。アドレス、memo、資産コード、発行体、最低入金額、対応ネットワークを送信前に照合する必要があります。

## 手数料、最低残高、rent

### Classic取引の手数料

1 stroopは0.0000001 XLMです。Classic取引の最低ベース手数料は1オペレーション当たり100 stroops、すなわち0.00001 XLMです。複数オペレーションを含む場合は、オペレーション数を掛けます。ネットワーク容量を超えるとsurge pricingが働き、提示した上限まで実効手数料が上がる場合があります。

手数料はfee poolと呼ばれるアクセス不能な領域へ集まり、バリデーターやSDFの収益にはなりません。現在は非流通扱いですが、バリデーターが将来のプロトコル変更で扱いを変える理論上の余地があるため、公式供給統計では総供給に含まれます。「全手数料が恒久的にバーンされる」とする説明は正確ではありません。

### 最低残高

Classicアカウントのbase reserveは現在0.5 XLMで、基本アカウントは2 base reserves、合計1 XLMの最低残高を必要とします。信頼ライン、オファー、追加署名者、データ等のsubentryは原則1件当たり0.5 XLMを追加します。スポンサーがアカウントやsubentryのreserveを負担する仕組みもあるため、利用者が必ず自己資金で全額を保持するとは限りません。

### Sorobanのリソース手数料とrent

Soroban取引は、inclusion feeに加え、CPU命令、台帳エントリーの読み書き、バイト数、イベント、戻り値、保存期間等に基づくresource feeを支払います。スマートコントラクトデータはClassicのbase reserveではなく、Time to Live（TTL）を延長するrentを支払い、期限後はstate archivalの対象になります。したがって「Stellarの取引は一律0.00001 XLM」と説明すると、スマートコントラクト利用コストを過小評価します。

## Stellar資産、信頼ライン、発行体リスク

Stellarの発行資産は、一般に**資産コードと発行アカウントの組み合わせ**で識別されます。同じ`USD`や`USDC`というコードでも、発行体が違えば別資産です。名称やロゴだけで真正性を判定できません。

XLMは発行体も信頼ラインも持たないネイティブ資産です。これに対し、法定通貨連動トークン、ステーブルコイン、ファンド持分等を保有するには、対象資産への信頼ラインを作成します。信頼ラインは「その発行体の債務・償還条件を信頼する」という経済的意味を持ちますが、プロトコルが準備資産や法的請求権を保証するわけではありません。

発行体は設定により、次の制御を利用できます。

| 機能 | 内容 | 利用者への影響 |
|---|---|---|
| `AUTH_REQUIRED` | 各信頼ラインの利用を発行体が認可 | KYC完了前は受取・取引できない場合がある |
| `AUTH_REVOCABLE` | 既存の認可を取り消せる | 資産の移転停止・事実上の凍結が可能 |
| `AUTH_CLAWBACK_ENABLED` | 対象残高を発行体がclawbackして消却 | 法令対応・誤送信対応等に使える一方、発行体権限が強い |
| `AUTH_IMMUTABLE` | 認可関連設定を将来変更できない | 発行体の柔軟性と管理リスクの両方が低下 |

これらは発行資産の機能であり、ネイティブXLMの残高をSDFが任意に凍結・回収できるという意味ではありません。発行資産ごとに、発行体アドレス、ホームドメイン、準備資産、償還条件、認可フラグ、管理鍵、監査・保証、対象地域を確認する必要があります。

## SDEX、AMM、パス支払い

Stellarはプロトコルに注文板型のSDEXを持ちます。ユーザーは発行資産またはXLMの売買オファーを台帳へ登録でき、買い注文と売り注文をマッチさせます。さらにconstant-product型の流動性プールがあり、プールの取引手数料は30 basis pointsです。

Path Paymentは、送付人が持つ資産から受取人が希望する資産まで、SDEXの注文板や流動性プールを組み合わせて交換経路を探します。XLMは経路の一部になり得ますが、常にXLMを通るわけではありません。例えば十分な直接市場があれば、USDCから別の発行資産へ直接交換できます。

<div class="article-mermaid">
<pre class="mermaid">flowchart LR
    A[Sender asset] --> B[Order book or AMM]
    B --> C[Optional bridge asset]
    C --> D[Receiver asset]
    B --> D
</pre>
</div>

利便性は流動性に依存します。市場が薄いと、提示レートと実際の平均交換価格が乖離し、経路が見つからず取引が失敗する場合があります。資産コードが同じでも発行体が異なる市場は別物です。価格だけでなく、板の深さ、スプレッド、経路、最小受取額、発行体信用を確認する必要があります。

## アンカー、オン・オフランプ、SEP

アンカーまたはrampは、銀行口座、カード、現金拠点等のオフチェーン資金とStellar上の資産を接続します。一般的には、利用者の預金を受けて発行資産を渡し、償還時に発行資産を消却して法定通貨を返します。カストディ、本人確認、送金規制、銀行接続、準備資産管理は各事業者が担います。

Stellar Ecosystem Proposal（SEP）は、ウォレットとアンカー等の相互運用を助ける公開仕様です。

- SEP-6：API経由の入出金
- SEP-10：Stellarアカウントを使ったWeb認証
- SEP-12：KYC情報の交換
- SEP-24：対話型の入出金フロー
- SEP-31：クロスボーダー支払い
- SEP-38：見積もり・レート提示

SEP準拠は接続方法の互換性を高めますが、事業者の支払能力、準備資産、法令遵守、運用品質をプロトコルが保証する認証ではありません。対応国数も「現金拠点がある国」「アプリで利用できる国」「特定の送金回廊が本番対応する国」で意味が異なります。公式サイトは100以上の国・地域でcash-to-crypto rampが利用可能と掲示していますが、サービス、地域、本人確認、資産ごとの条件は個別確認が必要です。

## Sorobanとスマートコントラクト

Sorobanは、Rust向けSDKとWebAssembly（Wasm）実行環境を中心とするStellarのスマートコントラクト基盤です。Classic資産はStellar Asset Contractを介してコントラクトから扱えます。トークン化、交換、貸借、エスクロー、決済ロジック等をClassic機能より柔軟に実装できます。

Protocol 20は2024年2月20日にメインネットで可決され、Soroban機能を有効化しました。当初はネットワーク上限を保守的に設定し、2月27日、3月19日等のフェーズを通じて容量を段階的に拡大しました。「2月20日から制限なしで全面稼働した」という意味ではありません。

Sorobanの導入により、Stellarのリスク範囲も広がりました。Classicの組み込みオペレーションだけでなく、個別コントラクトのコード、管理権限、アップグレード、オラクル、フロントエンド、流動性、ブリッジを確認する必要があります。RustやWasmを使うこと自体が不具合を防ぐわけではありません。

## Protocol 23〜25とstate archival事象

### Protocol 23「Whisk」

2025年9月3日に完了したProtocol 23は、独立したSorobanトランザクションの並列実行、Classicとスマートコントラクトのイベント統合、手数料・実行効率の改善、state archival機能等を導入しました。並列化は競合しない処理のスループットを改善しますが、共有状態へアクセスする取引には競合制約があります。

### state archivalの不整合とProtocol 24

2025年10月、state archivalの復元処理に関する不整合が発見されました。SDFの公表では478件のスマートコントラクトエントリーが影響範囲となり、うち84件は壊れた状態から復元され、77件はその後変更されていました。ネットワークは対象エントリーを隔離し、関係者と復旧を進めました。

この事象は「プロトコルに重大事故がない」とする元原稿の記載と整合しません。Classic残高の全面消失やチェーン全体の永続停止ではありませんでしたが、スマートコントラクト状態の正しさに影響した重要なインシデントです。Protocol 24は2025年10月22日に完了し、state archivalの安定化対応を有効化しました。

### Protocol 25「X-Ray」とプライバシー

Protocol 25は2026年1月22日にメインネットで完了し、BN254楕円曲線とPoseidon／Poseidon2ハッシュ等、ゼロ知識証明を効率的に検証するための暗号プリミティブを追加しました。これにより、開発者は選択的開示、認証、残高・取引条件を秘匿するアプリ等を構築しやすくなります。

ただし、X-RayはStellarの通常支払い、SDEX注文、発行資産、アカウント残高をデフォルトで非公開にするものではありません。プライバシーは、個別コントラクト、ウォレット、鍵管理、コンプライアンス設計を含めて実装する必要があります。2026年に公開されたConfidential Tokens等も、機能の成熟度、監査、本番利用範囲を確認し、研究・プレビューと既存の標準機能を区別する必要があります。

## XLMの供給・用途・SDF保有

### 供給量の現状

Stellar開始時に1000億XLMが生成され、初期の年1%インフレにより約54.439億XLMが追加されました。インフレは2019年10月28日のバリデーター投票で廃止されました。2019年11月4日、SDFは約554.421億XLMを署名者のいないアクセス不能アカウントへ送り、供給から除外しました。

2026年7月24日5時28分UTCの公式Dashboard APIは次の値を示しました。

| 指標 | XLM | 意味 |
|---|---:|---|
| 初期供給 | 100,000,000,000 | ネットワーク開始時に生成 |
| 過去のインフレ発行 | 5,443,902,087.3472865 | 2019年の廃止までに生成 |
| アクセス不能化 | 55,442,115,247.4348098 | 主に2019年のSDFによる移転 |
| 現在の総供給 | 50,001,786,839.9124767 | 流通・SDF・fee pool・upgrade reserveを含む |
| 流通供給 | 34,174,901,809.4428527 | 公式定義による推計 |
| SDF Mandate | 15,557,774,831.974759 | SDFの公開Mandate口座 |
| Upgrade Reserve | 258,885,847.5135959 | 旧ネットワークからの移行用 |
| Fee Pool | 10,224,350.9812691 | アクセス不能で非流通 |

現在のプロトコルにはマイニングや自動インフレがなく、継続的な新規発行はありません。一方、供給パラメータはバリデーターによるプロトコル変更の対象になり得るため、「暗号学的に永遠に500億XLMへ固定された上限」と表現するより、**現在の総供給は約500.018億XLMで、現行仕様に自動発行がない**と説明する方が正確です。CoinGeckoがmax supplyを無限大と表示する一方、total supplyを約500.02億とするのも、このプロトコル変更可能性を反映した集計上の扱いです。

### XLMの用途

XLMの主なネットワーク用途は次のとおりです。

- Classic取引とSoroban取引の手数料
- Classicアカウント、信頼ライン、オファー、署名者等の最低残高
- Sorobanデータのrent
- SDEX、AMM、中央集権型取引所等での交換・流動性
- 発行資産間のパス支払いにおける任意の中継資産

XLMはSDFの株式、収益分配請求権、議決権ではありません。Stellar上の決済量やRWA残高が増えても、その経済価値がXLM保有者へ自動的に分配される仕組みはありません。また、ネットワークにネイティブステーキング報酬はありません。「XLMステーキング」「XLMで利回り」と表示する外部サービスは、貸付、流動性提供、カストディ、独自インセンティブ等を利用している可能性があり、相手方の破綻、出金停止、スマートコントラクト、価格変動等の別リスクがあります。

### SDF Mandateと供給集中

公式供給APIのSDF Mandate残高は約155.578億XLMで、現在の総供給の約31.1%、流通供給の約45.5%に相当します。2019年の再編直後にSDFが示した300億XLMを現在値として使うことはできません。SDFは現在、SDF Development、Stellar Growth、Product and Innovation、Assets and Liquidityの4区分で残高を公開しています。

SDFは運営費やMandate活動のため、Kraken、Coinbase、Bitstamp等の公開市場や直接販売でXLMを売却すると明記しています。配布・助成・投資は開発と利用を支える一方、市場への供給増加、受領者の売却、資金配分の裁量、情報の非対称性につながります。公開アドレス、四半期報告、区分別残高、取引所流入を継続的に分けて見る必要があります。

## 決済、ステーブルコイン、RWAの利用例

### MoneyGram、現金ランプ、MGUSD

MoneyGramのStellar連携は、対応ウォレットと物理拠点をつなぎ、現金とデジタル資産の入出金を可能にします。利用可能な国、資産、送金方向、本人確認、手数料、提携ウォレットは地域ごとに異なります。拠点数の大きさが、そのまますべての国で同一サービスを利用できることを意味しません。

MoneyGramは2026年6月2日、Stellarネイティブのドル連動ステーブルコインMGUSDを米国で開始しました。Bridgeが発行、M0がmint／burnインフラ、Fireblocksがウォレット基盤を担うと公表されています。MoneyGramはグローバル展開の方針を示していますが、開始時点は米国であり、「2026年6月に全世界で既に利用可能」とする表現は避ける必要があります。

### PayPal USD（PYUSD）

PayPalとPaxosは2025年6月にStellar対応計画を発表し、ニューヨーク州金融サービス局の承認後、2025年9月にPYUSDがStellar上で利用可能になりました。PayPalの現行規約はPYUSDの対応ネットワークとしてEthereum、Solana、Arbitrum、Stellarを記載しています。

Stellar対応はPYUSDの流通・決済経路を増やしますが、PYUSDの発行体信用、準備資産、償還、アドレス凍結、地域制限は別に残ります。また、Stellar上のPYUSD残高とPYUSD全体の供給量を混同できません。

### Franklin TempletonのBENJI

Franklin TempletonのFranklin OnChain U.S. Government Money Fundは、2021年からStellar上でファンド持分をBENJIトークンとして記録しています。2026年4月の5周年発表では、BENJIスイート全体の運用資産は約19.8億ドル、Stellar上は6.5億ドル超とされました。元原稿の「19.8億ドルがすべてStellar上」という読み方は正確ではありません。

これは米国登録ファンドの持分記録・移転にブロックチェーンを利用する例で、無許可の匿名トークンとは異なります。対象投資家、KYC、移転制限、カストディ、ファンド文書、基準価額、償還条件が適用されます。ネットワーク採用とファンド自体の信用・金利・流動性は分けて見る必要があります。

### 人道支援と金融包摂

UNHCR、International Rescue Committee等は、避難民・支援対象者への価値移転でStellarベースの仕組みを試行・利用した事例を公表しています。受取人が現地のMoneyGram拠点等で現金化できる設計は、銀行口座を持たない利用者への選択肢になります。

一方、本人確認、安全な端末、ウォレット復旧、現地通貨への換金、代理店の現金在庫、通信、制裁・AML対応が必要です。限定プログラムの参加者数を、そのまま世界全体での普及率へ外挿できません。

### Mastercard等との連携

StellarはMastercard Crypto Credentialエコシステムへの参加を公表しています。これは検証済みの識別情報やアドレスの扱いを改善する統合であり、Mastercardの全決済がStellarで清算されることを意味しません。金融機関・決済企業の発表は、本番稼働、実証、技術統合、共同マーケティングを区別して確認する必要があります。

## 市場データと流動性

2026年7月24日のCoinGecko画面で確認した市場スナップショットは次のとおりです。値は常時変動し、集計サイトは取引所の異常価格・出来高を除外または警告する場合があります。

| 指標 | スナップショット | 注意点 |
|---|---:|---|
| 価格 | 約0.1841ドル | 複数市場の出来高加重平均 |
| 時価総額 | 約62.91億ドル | 価格×流通供給量 |
| FDV | 約92.05億ドル | 価格×総供給量による理論値 |
| 24時間出来高 | 約1.369億ドル | 異常値、デリバティブ、集計範囲により差が出る |
| 流通供給量 | 約341.75億XLM | 公式Dashboard APIを参照 |
| 総供給量 | 約500.02億XLM | 現行総供給。自動発行はない |
| 時価総額順位 | 19位 | 時点で変動 |
| 過去最高値 | 0.8756ドル | 2018年1月2日 |
| 最高値からの乖離 | 約79%下 | 通貨単位・集計元で差が出る |

CoinGeckoは117取引所、252市場から価格を集計していました。Upbit、Binance、Coinbase等に流動性が分散する一方、市場一覧には異常価格として警告されたDEXペアもありました。単純な24時間出来高だけでなく、取引したい通貨ペアの買い板・売り板、2%深度、スプレッド、出入金可否、価格乖離を確認する必要があります。

日本では複数の登録暗号資産交換業者がXLM/JPYを取り扱っています。取引所方式と販売所方式、板の厚み、スプレッド、取引手数料、XLM出庫手数料、memo要件、メンテナンス状況は各社で異なります。

## 規制・法務・税務

### 米国

SECが2026年4月に公開した暗号資産と連邦証券法の説明は、XLMを「digital commodity」の例として記載しています。CFTCの2026年の文書もXLMを同様の例に含めます。ただし、これはXLMを使うあらゆる募集、運用商品、利回りサービス、デリバティブ、仲介、販売方法が証券法や他の金融規制から外れるという意味ではありません。

Stellar上で発行されるトークンの法的位置付けは、XLMとは別に、発行条件、収益請求権、運営主体、販売方法、対象者、管轄で決まります。ステーブルコイン、ファンド持分、預金連動資産、送金サービスには、発行・準備資産・送金・制裁・AML・消費者保護等の制度が関係します。

### 日本

日本で暗号資産の交換サービスを提供するには、原則として資金決済法上の登録が必要です。取扱業者や対象サービスは金融庁の登録一覧と各社公式情報で確認できます。XLMが取扱銘柄であることは、価格、流動性、発行体、ネットワーク、将来価値を行政が保証することを意味しません。

Stellar上の発行資産は、設計により暗号資産、電子決済手段、前払式支払手段、金融商品等の別区分に関係し得ます。「Stellar上のトークン」という技術的共通点だけでは法的分類を判断できません。

### 税務

日本の個人が暗号資産を売却、他の暗号資産と交換、商品・サービスの決済に使用した場合、原則として所得計算が必要です。事業性等がなければ雑所得に区分されるのが一般的ですが、個別事情で扱いが変わります。エアドロップ、報酬、DeFi、流動性提供、海外取引所、法人保有も論点が異なります。

取得価額、交換時の円換算額、手数料、送付先、取引ID、memo、発行資産の償還を記録し、国税庁の最新FAQと必要に応じて税理士等へ確認してください。

## 競合・代替インフラとの比較

| 項目 | Stellar | XRP Ledger | Solana | TRON | SWIFT・コルレス銀行 |
|---|---|---|---|---|---|
| 主な設計 | 決済、資産発行、交換、Soroban | 決済、発行資産、DEX、AMM | 汎用高性能スマートコントラクト | ステーブルコイン送金、TVM | 金融機関間メッセージと銀行台帳上の決済 |
| 合意形成 | SCP／FBA、各ノードの信頼設定 | Unique Node Listを使う合意 | Proof of StakeとProof of History | 27 Super RepresentativesのDPoS | 中央管理の通信網と各金融機関の統制 |
| ネイティブ資産 | XLM | XRP | SOL | TRX | なし |
| 発行資産 | Classic資産＋契約トークン | 発行トークン | Token Program等 | TRC規格 | 銀行預金・証券等を各台帳で管理 |
| 組み込み交換 | SDEX、AMM、Path Payment | DEX、AMM | 主にアプリのDEX | 主にアプリのDEX | 市場・銀行・決済網を別途利用 |
| 費用の扱い | XLM手数料はアクセス不能なfee pool | XRP手数料を消却 | SOL手数料と優先手数料、ステーキング | Bandwidth／EnergyとTRX | 銀行・回廊・サービスごとの料金 |
| 主な依存 | クォーラム構成、SDF、発行体、ramp | UNL構成、発行体、アプリ | バリデーター、クライアント、混雑 | SR集中、リソース価格、発行体 | 銀行、営業時間、仲介、規制 |

SWIFTはブロックチェーンそのものではなく、金融機関間のメッセージング基盤です。Stellarと一対一で同じ機能を競うというより、国際送金の一部で代替・接続・補完関係になり得ます。XRP Ledgerにも現在はAMMがあり、SolanaやTRONにもステーブルコイン送金があるため、古い機能比較を固定的に使えません。

## セキュリティと主要リスク

### 1. クォーラムと運用集中

Tier 1の実効的な組織数、相互依存するクラウド、クォーラム設定が分散性を左右します。2019年には67分のネットワーク停止がありました。3つのTier 1組織の同時停止でlivenessを失い得る構成は、PoWやPoSとは異なる集中リスクです。

### 2. プロトコル・state archival

2025年のstate archival不整合は、アップグレード後の新機能に運用・状態復元リスクがあることを示しました。Protocol 24で対処されても、将来の変更で新しい不具合が生じない保証にはなりません。ノード、SDK、RPC、インデクサーのバージョン差も確認対象です。

### 3. Sorobanコントラクト

個別コントラクトには、再入可能性、認可ミス、算術・丸め、アップグレード鍵、オラクル、流動性、フロントエンド、依存ライブラリ等のリスクがあります。監査済みでも無欠陥を意味せず、管理権限と緊急停止機能が新たな集中点になります。

### 4. 発行体・アンカー

発行資産は、準備資産不足、破綻、銀行口座凍結、償還停止、KYC障害、制裁、鍵漏えい、clawback、地域制限の影響を受けます。オンチェーンで残高が存在しても、法定通貨へ額面償還できるとは限りません。

### 5. SDF保有と資金配分

SDF Mandate残高は総供給の約31%に相当し、配布・助成・市場売却が流通供給と価格形成へ影響します。公開アドレスで追跡できる利点はありますが、将来の販売速度や受領者の行動を確定できません。

### 6. 市場・流動性

XLMは多くの市場で取引されますが、急変時の板の薄さ、取引所停止、地域ごとの上場廃止、価格乖離、デリバティブ清算が影響します。過去最高値から大きく下落した履歴は、採用ニュースとトークン価格が一致しないことを示します。

### 7. ウォレット、memo、フィッシング

秘密鍵・リカバリーフレーズの漏えい、偽ウォレット、偽エアドロップ、ドメイン偽装、誤ったmemo、資産コードだけを見た偽トークン受領が主な利用者リスクです。ネイティブ取引の最終性は、不正送信を取り消す仕組みではありません。

### 8. 規制とプライバシー

発行資産の認可・凍結・clawbackはコンプライアンスに役立つ一方、無許可利用や検閲耐性を制約します。ZK機能を利用するアプリは、プライバシー保護とAML・制裁・記録保存の要件を同時に扱う必要があります。国や事業者によって利用可否が変わります。

## ネットワークと事業のシナリオ

ここでのシナリオは価格予測ではなく、確認すべき条件の整理です。

| シナリオ | 起こり得る変化 | 確認指標 |
|---|---|---|
| 決済・RWA利用が拡大 | 発行資産、オン・オフランプ、契約利用が増える | 実残高、償還件数、アクティブ利用者、地域、手数料、継続率 |
| 利用は増えるがXLM需要は限定 | ステーブルコイン中心でXLMは手数料・reserveに限定 | XLM建て流動性、fee pool、最低残高、スポンサー利用、SDF放出 |
| Sorobanが成長 | DeFi・トークン化アプリが増える | TVLだけでなく利用者、監査、収益、障害、管理権限 |
| 分散性が改善 | Tier 1組織と障害耐性が増える | クォーラム分析、組織・地域・クラウド分散、停止テスト |
| 規制・発行体問題が強まる | 資産凍結、地域撤退、償還制限が増える | 発行体開示、準備資産、規約、当局措置、上場・ramp対応 |
| 技術障害が発生 | 取引停止、状態復旧、信頼低下 | incident report、影響エントリー、復旧方法、再発防止、バージョン |

利用量の増加がXLM価格へ自動的につながるという単純な関係はありません。最低手数料が小さく、スポンサーやfee-bumpで利用者からXLM保有を抽象化でき、主要な価値移転が発行資産で行われるためです。一方、アカウント、信頼ライン、rent、流動性の増加はXLM需要へ影響し得ます。需要側とSDF配布等の供給側を同時に見る必要があります。

## 確認チェックリスト

- 使う資産はXLMか、資産コード＋発行体で識別される発行資産か
- 発行体アドレス、ホームドメイン、準備資産、償還条件は一致しているか
- `AUTH_REQUIRED`、`AUTH_REVOCABLE`、clawback等の権限はどう設定されているか
- 送金先がmemoを要求するか、最低入金額と対応ネットワークは何か
- Classic手数料だけでなく、surge pricing、Soroban resource fee、rentを見ているか
- Path Paymentの経路、最小受取額、板・AMMの深さ、スリッページは十分か
- Sorobanコントラクトの監査、管理鍵、アップグレード、停止権限は何か
- バリデーターのTier 1構成とクォーラム設定は最新か
- SDF Mandate残高、配布・売却、受領先を過去の固定値で扱っていないか
- 提携は本番稼働か、計画・実証・限定地域の開始か
- 市場データの時刻、集計元、異常値、現物・デリバティブの区別は明確か
- 日本の登録業者、税務、発行資産ごとの法的区分を最新資料で確認したか

## まとめ

Stellarは、XLM送金だけでなく、発行資産、信頼ライン、SDEX、AMM、パス支払い、オン・オフランプ、Sorobanを統合した決済・資産トークン化ネットワークです。SCPはPoW・PoSを使わず迅速に台帳を閉じますが、実効的な安全性と継続性はクォーラム設定とTier 1組織の多様性に依存します。

XLMは手数料、最低残高、rent、交換に使われますが、ステーキング報酬、SDFの利益分配、保有者投票権はありません。現在の総供給は約500.018億XLM、SDF Mandateは約155.578億XLMであり、2019年直後の300億XLMという配分を現在値として使えません。手数料も自動的に焼却されるのではなく、アクセス不能なfee poolへ集まります。

MoneyGram、MGUSD、PYUSD、BENJI、国際援助は実利用を示す材料ですが、発行体信用、償還、KYC、対象地域、統合段階を分けて読む必要があります。BENJIの全チェーン合計とStellar上残高、MGUSDの米国開始と将来の世界展開も混同できません。

Protocol 20以降、Stellarは汎用スマートコントラクト基盤へ範囲を広げました。同時に、2025年のstate archival不整合は、新機能が新しい障害面を持つことも示しました。X-RayはZKアプリの基盤ですが、ネットワーク全体の自動匿名化ではありません。技術、発行体、クォーラム、供給、市場、規制を分けて検証することが、StellarとXLMを理解するための中心になります。

## 主な参照資料

### Stellar公式・技術資料

- [Stellar公開時の発表](https://stellar.org/blog/foundation-news/introducing-stellar)
- [旧合意アルゴリズムの分岐と安全性・活性の説明](https://stellar.org/blog/foundation-news/safety-liveness-and-fault-tolerance-consensus-choice)
- [Stellar Consensus Protocolの論文・コード公開](https://stellar.org/blog/foundation-news/stellar-consensus-protocol-proof-code)
- [Stellar Consensus Protocol](https://developers.stellar.org/docs/learn/fundamentals/stellar-consensus-protocol)
- [Stellar Stack](https://developers.stellar.org/docs/learn/fundamentals/stellar-stack)
- [Decentralization, Double Time](https://stellar.org/blog/developers/decentralization-double-time)
- [Operations and Transactions](https://developers.stellar.org/docs/learn/fundamentals/transactions/operations-and-transactions)
- [Fees, Resource Limits, and Metering](https://developers.stellar.org/docs/learn/fundamentals/fees-resource-limits-metering)
- [Lumensと供給指標](https://developers.stellar.org/docs/learn/fundamentals/lumens)
- [XLM供給Dashboard API](https://dashboard.stellar.org/api/v3/lumens)
- [SDF Mandate](https://stellar.org/foundation/mandate)
- [2019年のSDF保有再編](https://stellar.org/blog/foundation-news/sdfs-next-steps)
- [SDEXと流動性プール](https://developers.stellar.org/docs/learn/fundamentals/liquidity-on-stellar-sdex-liquidity-pools)
- [Asset Design Considerations](https://developers.stellar.org/docs/tokens/control-asset-access)
- [Clawbacks](https://developers.stellar.org/docs/build/guides/transactions/clawbacks)
- [Stellar Ecosystem Proposals](https://developers.stellar.org/docs/learn/fundamentals/stellar-ecosystem-proposals)
- [Ramps](https://developers.stellar.org/docs/learn/fundamentals/anchors)

### Soroban・アップグレード・セキュリティ

- [Protocol 20とスマートコントラクトのメインネット導入](https://stellar.org/blog/developers/protocol-20-and-smart-contracts-are-live-on-mainnet)
- [Protocol 20 Upgrade Guide](https://stellar.org/blog/developers/protocol-20-upgrade-guide)
- [Protocol 23 Upgrade Guide](https://stellar.org/blog/developers/protocol-23-upgrade-guide)
- [Protocol 23「Whisk」](https://stellar.org/blog/developers/introducing-whisk-stellar-protocol-23)
- [state archival不整合への対応](https://stellar.org/blog/developers/addressing-state-archival-inconsistencies-protocol-upgrade-vote-next-week)
- [Protocol 24 Upgrade Guide](https://stellar.org/blog/developers/protocol-24-upgrade-guide)
- [Protocol 25「X-Ray」](https://stellar.org/blog/developers/announcing-stellar-x-ray-protocol-25)
- [Protocol 25 Upgrade Guide](https://stellar.org/blog/developers/stellar-x-ray-protocol-25-upgrade-guide)
- [Financial Privacy on Stellar](https://stellar.org/blog/developers/financial-privacy)
- [Stellar Bug Bounty](https://stellar.org/bug-bounty)

### 利用事例・市場

- [MoneyGramによるMGUSD開始](https://www.prnewswire.com/news-releases/moneygram-launches-mgusd-a-stablecoin-to-power-its-own-global-network-302787799.html)
- [PayPal USDのStellar対応](https://stellar.org/press/paypal-pyusd-is-now-available-on-stellar)
- [PayPal暗号資産規約](https://www.paypal.com/us/legalhub/paypal/cryptocurrencies-tnc)
- [Franklin TempletonとBENJIの5周年発表](https://www.franklintempleton.com/press-releases/news-room/2026/franklin-templeton-stellar-development-foundation-mark-five-years-of-benji-the-first-u.s.-registered-tokenized-money-market-fund)
- [Franklin OnChain U.S. Government Money Fund](https://www.franklintempleton.com/investments/options/money-market-funds/products/29386/SINGLCLASS/franklin-on-chain-u-s-government-money-fund/FOBXX)
- [UNHCRの利用事例](https://stellar.org/case-studies/unhcr)
- [International Rescue Committeeの利用事例](https://stellar.org/case-studies/irc)
- [Mastercard Crypto Credentialとの連携](https://stellar.org/press/stellar-joins-the-mastercard-crypto-credential-ecosystem-to-unlock-verified-interactions-across-public-blockchain-networks)
- [XLM市場データ（CoinGecko）](https://www.coingecko.com/en/coins/stellar)

### 規制・税務・競合資料

- [SEC：Crypto Assets and the Federal Securities Laws](https://www.sec.gov/resources-small-businesses/capital-raising-building-blocks/crypto-assets-federal-securities-laws)
- [CFTC Letter No. 26-17](https://www.cftc.gov/csl/26-17/download)
- [暗号資産交換業者登録一覧（金融庁）](https://www.fsa.go.jp/menkyo/menkyoj/kasoutuka.pdf)
- [暗号資産の税務上の取扱い（国税庁）](https://www.nta.go.jp/publication/pamph/shotoku/kakuteishinkokukankei/kasoutuka/)
- [XRP Ledger Consensus](https://xrpl.org/docs/concepts/consensus-protocol)
- [Solana Documentation](https://solana.com/docs)
- [TRON Developer Documentation](https://developers.tron.network/docs)
- [SWIFTについて](https://www.swift.com/about-us/discover-swift)

## 免責事項

本記事は情報提供のみを目的としており、特定の暗号資産の売買・保有を勧誘または推奨する投資助言ではありません。公開情報をもとに可能な限り正確な記載に努めていますが、完全性・正確性・最新性を保証するものではありません。将来の記述やシナリオは成果を保証しません。暗号資産には元本の全部を失う可能性があり、税務・法務上の取扱いも居住地や利用方法により異なります。利用前に最新の公式情報と専門家の助言を確認してください。
