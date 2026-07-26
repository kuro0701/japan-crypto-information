---
title: Cardano（ADA）総合分析｜Ouroboros・EUTXO・ステーキング・ガバナンス
description: Cardano（ADA）のOuroboros、EUTXO、Plutus・ネイティブトークン、供給・ステーキング、DRep・財務ガバナンス、Hydra・Leios、市場・規制・主要リスクを総合分析します。
date: 2026-07-26
updated: 2026-07-26
author: 国内暗号資産取引所ナビ
slug: ada
path: /articles/ada
articleType: market
marketTicker: ADA
category: スマートコントラクト・PoS
tags: Cardano, ADA, Ouroboros, EUTXO, Plutus, Aiken, ステーキング, DRep, CIP-1694, Hydra, Mithril, Leios, DeFi
readMinutes: 30
---

> **重要：本記事は情報提供のみを目的としており、特定の暗号資産の売買・保有を勧誘または推奨する投資助言ではありません。** 掲載する評価、市場データ、利用例は調査時点の分析上の情報であり、将来の成果を保証しません。暗号資産は、価格変動、流動性、技術、規制、税務、オペレーション、カウンターパーティー等のリスクを伴います。実際の利用・取引判断は、最新の公式情報を確認し、ご自身の状況に応じて行ってください。本稿の時点データは、原則として2026年7月26日JST時点で確認できた公開情報に基づきます。

## エグゼクティブサマリー

Cardanoは、査読研究と形式手法を重視して開発されてきた、オープンソースのProof of Stake（PoS）ブロックチェーンです。ネイティブ資産のADAは、送金、取引手数料、ステークプールへの委任、オンチェーンガバナンス、スマートコントラクトやネイティブトークンを含むアプリケーションで使われます。

合意形成には **Ouroboros** 系列を採用します。CardanoメインネットはOuroboros Classicから、一時的なByron BFTを経て、Shelley以降はOuroboros Praosで稼働してきました。Genesis、Chronos、Crypsinous、Phalanx、Leios等は同じ研究系列に属しますが、すべてが順番にメインネットへ実装されたわけではありません。特に高スループット化を目指すOuroboros Leiosは、2026年6月に公開テストネット「Musashi Dojo」が開始された段階であり、メインネット機能として扱うのは正確ではありません。

台帳には **Extended UTXO（EUTXO）** を使います。取引は消費する入力と新しく作る出力を明示し、スクリプト出力にはdatum、取引側にはredeemerを持たせられます。入力がまだ未使用なら実行前に妥当性と必要リソースを評価しやすい一方、複数利用者が同じ入力を同時に使おうとすると競合します。並列性は自動的に得られるものではなく、アプリケーションが状態を複数UTXOへ分割する設計が必要です。

Maryアップグレード以降、CardanoではADA以外の資産を台帳のネイティブ機能として発行できます。資産は原則としてpolicy IDとasset nameで識別され、minting policyが発行・焼却条件を制御します。ERC-20のように残高移転用コントラクトを毎回呼ぶ必要はありませんが、発行ポリシー、管理鍵、発行体、償還、流動性のリスクがなくなるわけではありません。Plutus Coreがオンチェーン実行基盤で、開発手段にはPlutus/Haskellに加えAiken等があります。

ADAの委任は、自己管理ウォレットでは資産をロックせず、ウォレットから移動させずに行えます。最低委任量はなく、委任中でも送金でき、現行プロトコルには委任ADAのスラッシングがありません。ただし、ステーク資格情報の登録には現在2 ADAの返還可能なデポジットがあり、報酬はプールの実績、飽和度、手数料、誓約、総委任量、準備金とプロトコルパラメータによって変動します。取引所や第三者サービスの「ステーキング」は、Cardanoのネイティブ委任とは異なる保管・契約条件を持つ場合があります。

最大供給量は450億ADAです。Cardano公式Supply Insightの2026年7月23日・epoch 645の表示では、準備金は約62.260億ADA、最大供給から準備金を差し引いたreleased supplyは約387.740億ADAでした。一方、CoinMarketCapの2026年7月26日集計では流通供給量は約364.899億ADAです。元原稿の「約36.5億ADA」は桁が一つ不足しています。released supplyと市場データ会社のcirculating supplyは、財務、デポジット、流通判定等の定義が異なるため一致しません。

ガバナンスは、2024年9月のChangで開始し、2025年1月29日のPlominでCIP-1694の全面機能へ移行しました。DRep、Stake Pool Operator（SPO）、Constitutional Committee（CC）が、提案種別に応じて投票します。2026年1月24日には更新版Cardano Constitutionが発効し、最大供給、財務、金融パラメータ等のガードレールを定めています。2026年7月18日のvan Rossemハードフォークは、全面ガバナンス移行後にDRep、SPO、CCの承認で実施された最初のプロトコル更新です。

エコシステム規模は、EthereumやSolanaと比べて小さい状態です。DefiLlamaの2026年7月26日表示ではCardanoのDeFi TVLは約6,213万ドル、ステーブルコイン時価総額は約6,353万ドル、DEX24時間出来高は約139万ドルでした。Minswap、Liqwid、Djed、Indigo等が掲載されていますが、TVLの米ドル値はADA価格でも動き、集計対象・二重計上除外・オラクル価格でも変わります。

市場面では、CoinMarketCapの同日集計でADAは約0.164ドル、時価総額約59.98億ドル、24時間出来高約1.34億ドル、16位でした。CoinGeckoでは約0.164ドル、時価総額約61.26億ドル、18位と差があります。2021年9月の最高値約3.09ドルからは約94.7%低い水準で、流動性がある主要銘柄でも大幅下落が起こり得ることを示します。

## 基本情報

| 項目 | 内容 | 確認上の注意 |
|---|---|---|
| ネットワーク | Cardano | オープンソースのパブリックブロックチェーン |
| メインネット開始 | 2017年9月29日 | Byron時代の開始 |
| 最小単位 | ADA / lovelace | 1 ADA = 1,000,000 lovelace |
| 合意形成 | Ouroboros Praos系PoS | 研究上のOuroboros全方式が実装済みという意味ではない |
| 台帳モデル | Extended UTXO（EUTXO） | 入力競合を避けるアプリ設計が必要 |
| スマートコントラクト | Plutus Core | Haskell、Aiken等の開発ツールがある |
| ネイティブ資産 | Mary以降 | 発行・焼却はminting policyで制御 |
| ステーキング | 非拘束型の委任 | 自己管理ウォレットと取引所サービスは別条件 |
| ガバナンス | CIP-1694 | DRep、SPO、CCが提案種別に応じて投票 |
| 最大供給 | 450億ADA | Constitutionにも上限を明記 |

## 歴史とハードフォーク

Cardanoの「Byron、Shelley、Goguen、Basho、Voltaire」という名称は、機能分野を説明する開発フェーズです。実際の台帳更新は、Hard Fork Combinatorを使った個別のハードフォークで段階的に導入されました。フェーズ名とハードフォーク名を同じものとして扱うと、時系列を誤りやすくなります。

| 日付 | 更新 | 主な内容 |
|---|---|---|
| 2017年9月29日 | Byron | メインネット開始、Ouroboros Classic |
| 2020年2月20日 | Byron BFT | Shelley移行のための中間合意方式 |
| 2020年7月29日 | Shelley | 分散型ステークプール、委任、Ouroboros Praos |
| 2021年3月1日 | Mary | マルチアセットとネイティブトークン |
| 2021年9月12日 | Alonzo | Plutusスマートコントラクト |
| 2022年9月22日 | Vasil | Plutus V2、参照入力、インラインdatum等 |
| 2023年2月14日 | Valentine | SECP256k1暗号プリミティブ |
| 2024年9月1日 | Chang | Conway台帳、CIP-1694ガバナンス開始 |
| 2025年1月29日 | Plomin | DRep投票を含む全面オンチェーンガバナンス |
| 2026年7月18日 | van Rossem | Protocol v11、台帳規則整理、VRF鍵一意性、Plutus・暗号機能改善 |

元原稿ではVasilを2023年、Valentineを2023年8月、Plominを2024年11月としていましたが、公式ハードフォーク履歴とは一致しません。また、van Rossemは日本時間2026年7月19日、UTCでは7月18日21:44:51、epoch 644の境界で有効になりました。

van Rossemの批准では、Intersectの公表値でDRep賛成77.63%（必要60%）、SPO賛成52.7%（必要51%）、CCは7名中6名承認（必要5名）でした。更新直後、最初のブロックまで約10分の空白がありましたが、次epochでは通常の約15秒へ戻ったと報告されています。この事象はアップグレード運用上の観測対象であり、「即時かつ無条件に完了した」と単純化できません。

<div class="article-mermaid">
<pre class="mermaid">flowchart TD
    A[Byron<br/>Classic] --> B[Byron BFT]
    B --> C[Shelley<br/>Praos]
    C --> D[Conway<br/>CIP-1694]
    D --> E[van Rossem<br/>Protocol v11]</pre>
</div>

## OuroborosとProof of Stake

### スロット、エポック、ブロック生成

Ouroborosは時間を **slot** と **epoch** へ分けます。現在のCardanoでは1 slotが1秒、1 epochは432,000 slots、約5日です。すべてのslotで必ずブロックが作られるわけではなく、active slot coefficientが約0.05のため、平均的には約20秒に1ブロックとなります。ランダム性があるため、実際の間隔は一定ではありません。

各ステークプールは、Verifiable Random Function（VRF）と委任を含む有効ステークに基づき、自身がslot leaderに選ばれたかを私的に判定します。選ばれたプールがブロックを作り、ノードは署名、台帳規則、チェーン選択規則に従って検証します。委任者がブロックを直接承認するわけではなく、委任量がプールの選出確率へ反映されます。

### 確定性の読み方

Ouroboros PraosはNakamoto型の確率的合意です。ブロックが追加された瞬間に数学的に不可逆となるdeterministic finalityではありません。後続ブロックが積み上がるほど覆る確率が低下する **probabilistic settlement** です。

ウォレットや取引所が表示する「数確認」は入出金運用上のしきい値であり、研究上のセキュリティパラメータによるsettlement guaranteeと同じではありません。大口移転、取引所入金、ブリッジ、業務決済では、サービスごとの必要確認数、停止時対応、チェーン分岐時の扱いを確認する必要があります。

### Ouroboros各方式の実装状況

| 方式 | 位置付け | 2026年7月時点の読み方 |
|---|---|---|
| Classic | 初期実装 | Byronメインネットで使用済み |
| Byron BFT | 移行用方式 | ClassicからPraosへの中間段階で使用済み |
| Praos | 分散型PoS | Shelley以降のメインネット基盤 |
| Genesis | 安全なブートストラップ研究 | 研究成果と実装状況を分けて確認 |
| Crypsinous | プライバシー保護PoS研究 | Cardanoへの実装予定なしとIOGが説明 |
| Chronos | 分散時計研究 | メインネットの現行合意方式ではない |
| Phalanx / Peras | 乱数・settlement改善の研究開発 | メインネット機能ではない |
| Leios | 並列ブロック設計 | 2026年6月から公開テストネット、未メインネット |

Ouroborosの安全性は、正直なステークが多数であること、暗号前提、ネットワーク伝播、正しいノード実装、鍵管理等に依存します。「査読済み」は重要な検証過程ですが、実装バグ、運用ミス、DDoS、サプライチェーン攻撃、未知の暗号脆弱性を排除する保証ではありません。

## EUTXOとトランザクション

### 入力、出力、datum、redeemer

Cardanoの各取引は、未使用出力（UTXO）を入力として消費し、新しいUTXOを出力として作ります。同じUTXOは一度しか使えません。通常の鍵アドレスでは署名が支出条件になり、スクリプトアドレスではvalidatorが支出可否を判定します。

EUTXOでは、出力に状態を表すdatumを持たせ、取引がredeemerとtransaction contextをvalidatorへ渡せます。validatorは「取引を許可するか」を判定し、状態更新後の出力は取引側が作成します。スマートコントラクトが共有アカウント残高を直接書き換えるモデルとは異なります。

<div class="article-mermaid">
<pre class="mermaid">flowchart LR
    A[既存UTXO<br/>value + datum] --> B[Transaction<br/>redeemer + context]
    B --> C[Validator]
    C --> D[新しいUTXO]
    C --> E[拒否]</pre>
</div>

### 予測可能性と競合

取引の有効性は、取引自身と参照する入力から事前評価できます。他の取引が先に同じ入力を消費しない限り、実行結果と必要リソースを送信前に見積もりやすい点が特徴です。しかし、同じ「状態UTXO」に利用者が集中すると、一方だけが成功し、残りは入力競合になります。

DEXやレンディングの開発者は、注文UTXO、バッチ処理、複数状態、参照入力等を組み合わせて並列性を設計します。EUTXOだから無制限に並列処理できるわけでも、account modelだから必ず逐次実行になるわけでもありません。実効性能は台帳モデル、アプリ設計、ブロック容量、スクリプト予算、ネットワーク需要の組み合わせで決まります。

### 「CSLとCCLの二層構造」の注意点

Cardanoの初期説明では、決済レイヤー（CSL）と計算レイヤー（CCL）を分ける構想が示されました。現在のメインネットを、独立した二つのチェーンが別々に稼働しているように理解するのは適切ではありません。ADA、ネイティブ資産、EUTXO、PlutusスクリプトはCardanoの同じ台帳規則と合意の下で処理されます。

## ネイティブ資産、Plutus、Aiken

### マルチアセット台帳

Mary以降、ADA以外のfungible tokenやNFTを台帳レベルで扱えます。通常、資産識別子はminting policyのハッシュであるpolicy IDとasset nameの組み合わせです。minting policyは、署名、期間、特定UTXOの消費、Plutus条件等で発行・焼却を制限できます。

ネイティブ資産はADAと同じUTXOへまとめて入り、複数資産を一取引で原子的に移転できます。ただし、次の点は個別確認が必要です。

- policyが追加発行を許すか、固定済みか
- 管理鍵を誰が保有するか
- 発行体が償還義務を負うか
- 凍結・回収・ブラックリスト相当の仕組みがあるか
- 参照価格、担保、ブリッジ、カストディに依存するか
- 同名資産ではなく正しいpolicy IDか

ADAはCardanoのネイティブ通貨であり、手数料と最低UTXO要件に特別な役割を持ちます。一般のCardano native tokenと同一条件ではありません。

### スマートコントラクト実行

オンチェーンスクリプトは最終的にUntyped Plutus Coreへコンパイルされます。Plutus TxはHaskellからの開発経路を提供しますが、Cardano開発がHaskellだけに限定されるわけではありません。AikenはCardano向け関数型スマートコントラクト言語で、ほかにもTypeScriptやPython系ツールを含むオフチェーン開発環境があります。

Marloweは金融契約を表現するドメイン固有言語です。形式的に分析しやすい設計はバグ削減に役立ちますが、オラクル、フロントエンド、鍵管理、契約条件、法的執行可能性まで自動的に保証するものではありません。利用可能な技術と実際の採用規模は分けて確認します。

## 手数料、最低ADA、送金実務

通常取引の基本手数料は、次の線形式で計算されます。

`fee = a × transaction size + b`

2026年7月のCardano Developer Portalでは、`a = 44 lovelace/byte`、`b = 155,381 lovelace`で、単純なADA送金の例はおおむね0.17〜0.20 ADAです。ネイティブ資産、メタデータ、多数の入力・出力で取引サイズが増え、Plutus取引にはCPU・メモリのexecution unit料金と参照スクリプト料金が加わります。

各UTXOには、保存する資産・datum・scriptの大きさに応じた最低ADAが必要です。多くの小さなUTXOや多数のトークンがあるウォレットは、将来の取引サイズと最低ADA拘束が増える場合があります。UTXO統合は将来のサイズを下げる一方、並列に使える入力を減らすため、常に有利とは限りません。

基本手数料や最低UTXO関連値はプロトコルパラメータであり、ガバナンス手続きを通じて変更され得ます。送金時はネットワーク名、アドレス、受取サービスの入金可否、最低入金額、必要確認数を確認します。Cardanoの通常送金に宛先タグはありませんが、取引所が内部識別用情報を別途求める場合はその案内が優先されます。

## ADAの供給・ステーキング・財務

### 初期配分と現在供給

Cardano公式Genesis Distributionでは、公開販売分は25,927,070,538 ADA、IOHK・EMURGO・Cardano Foundationへの配分を含むローンチ時総量は31,112,484,646 ADAでした。最大供給450億ADAとの差額は準備金となり、Shelley以降、各epochの報酬等へ段階的に使われます。

| 指標 | 2026年7月時点 | 定義上の注意 |
|---|---:|---|
| 最大供給 | 450億ADA | Constitutionの上限 |
| 公式準備金 | 約62.260億ADA | 2026年7月23日、epoch 645 |
| 公式released supply | 約387.740億ADA | 最大供給 − 準備金 |
| CMC流通供給 | 約364.899億ADA | 市場データ会社の流通判定 |
| CoinGecko流通供給 | 約370億ADA | 丸め・集計基準がCMCと異なる |

「発行済み」「released」「circulating」「委任中」「財務保有」は同義ではありません。複数ソースを比較する場合は、数値だけでなく定義、時刻、単位を確認します。

### ネイティブ委任の仕組み

自己管理ウォレットでのADA委任には、次の特徴があります。

- ADAはウォレットからステークプールへ送られず、支出可能なまま
- 最低委任量はない
- ステーク資格情報の登録に現在2 ADAの返還可能なデポジット
- 委任中のADAをいつでも送金可能
- 現行プロトコルに委任ADAのスラッシングはない
- ウォレット全体の有効ステークがepochごとのsnapshotへ反映
- 報酬反映にはsnapshotとepoch進行による時間差がある

「委任中に価格変動を回避できる」「報酬が固定される」という意味ではありません。プールのblock production、飽和度、固定費・margin、pledge、総active stake、準備金、金融パラメータによって報酬は変動します。過去実績を年率換算した表示は将来の率を保証しません。

取引所、カストディ、レンディング、DeFiが提供するADA運用は、資産を第三者へ移す、再委任する、ロック期間を設ける、独自条件で報酬を配る場合があります。ネイティブ委任の「非拘束・非カストディ・委任ADAにスラッシングなし」という性質を、そのまま第三者サービスへ当てはめることはできません。

### 報酬と準備金

epochごとの報酬原資は、取引手数料と準備金からのmonetary expansionで構成されます。準備金から取り出す割合は`monetaryExpansion`、そのうち財務へ回す割合は`treasuryCut`等のパラメータに影響されます。財務取り分はプール報酬の前に移されます。

2026年発効のConstitutionは、`monetaryExpansion`を0.001〜0.005、`treasuryCut`を10〜30%の範囲とするガードレールを定めます。ガードレールは現在値そのものではなく、ガバナンスが変更できる範囲です。準備金は徐々に減るため、取引手数料の増加やパラメータ変更がなければ、準備金由来の報酬は長期的に縮小します。

## ガバナンス：DRep、SPO、CC、財務

### CIP-1694の役割分担

CIP-1694では、ガバナンスを一つの投票箱へ集約せず、三つの主体へ役割を分けます。

| 主体 | 投票力 | 主な役割 |
|---|---|---|
| DRep | 委任された1 lovelace = 1票 | ADA保有者を代表し、幅広い提案へ投票 |
| SPO | active stakeの1 lovelace = 1票 | ハードフォーク、委員会等の一部提案へ投票 |
| Constitutional Committee | 1委員 = 1票 | 提案の合憲性を判定 |

ADA保有者はDRepへ投票権を委任する、自身をDRepとして登録する、abstainやno confidenceの選択肢を使うことができます。ステークプールへの委任とDRepへの投票権委任は別です。資産の所有権をDRepへ移す仕組みではありません。

ガバナンスアクションには、no confidence、CC更新、Constitution更新、hard fork、parameter change、treasury withdrawal、information actionがあります。必要なDRep・SPO・CCの組み合わせとしきい値は提案種別で異なります。すべての変更をADA保有者の単純過半数だけで決める制度ではありません。

### Constitutionと財務

更新版Cardano Constitutionは、2025年の初期Constitutionを置き換え、2026年1月24日に発効しました。批准時はactive DRep voting stakeの79%が賛成したとIntersectが公表しています。Constitutionは最大供給450億ADA、パラメータ変更範囲、財務引き出し、ネットワーク安全性等のガードレールを定めます。

オンチェーン財務は、Project Catalystと区別が必要です。Catalystは提案・審査・投票を伴うイノベーション資金制度として先行しました。CIP-1694のtreasury withdrawalはCardano台帳上のガバナンスアクションで、DRepとCC等の現行ルールに従います。Catalystの実績をそのままオンチェーン財務ガバナンスの実績として数えるのは正確ではありません。

### ガバナンスのリスク

- DRep投票力が委任ADA量に比例し、大口委任先へ集中し得る
- 参加率が低いと少数のactive voting stakeで結果が決まる
- DRepの活動停止、利益相反、情報不足を委任者が把握しにくい
- SPOの多重運営や取引所委任が実質的な影響力を集める場合がある
- CCの法的・技術的判断に裁量が残る
- 財務支出の成果測定、契約執行、マイルストーン管理が難しい
- 複雑なしきい値や期限が一般利用者の参加障壁になる

van Rossemの成立は制度が実際に作動した事例です。一方、一度の円滑な批准だけで、長期的な代表性、投票参加、財務規律、緊急時対応が確立したとは判断できません。

## スケーリング：Hydra、Mithril、Leios

### Hydra Head

Hydra Headは、少人数の参加者がCardano資産をHeadへコミットし、Cardanoと同じ台帳規則を使ってオフチェーン取引するisomorphic state channelです。Head内では参加者間だけで取引を複製するため、低遅延・低コストで処理でき、開設・終了・異議申立てはメインチェーンと連携します。

Hydra Headはversion 0.10.0以降メインネット互換で、実資産を使えますが、公式文書は開発中であること、既知の制約を確認すること、自己責任であることを明記しています。Headごとの参加者可用性、鍵管理、資金コミット、終了時間、ネットワーク接続がリスクになります。

複数Headの性能を合算した「100万TPS」等の表現は、Cardano L1全体が単一状態で同じ性能になったことを意味しません。Hydraは特定参加者間で繰り返し取引する決済、ゲーム、取引所、オークション等に適しますが、誰でも同じ共有流動性へアクセスする汎用L1の代替とは役割が異なります。

### Mithril

Mithrilは、ステーク加重の閾値マルチシグネチャでCardanoのスナップショットや状態を証明する仕組みです。認証済みスナップショットを検証してフルノードを高速にブートストラップでき、2026年4月にMithril signer 1.0.0がproduction-readyと発表されました。

Mithrilはノード同期と状態証明を効率化しますが、スマートコントラクトを並列実行するL2ではありません。Cardano L1の取引スループットを直接増やす仕組みとして説明するのは正確ではありません。

### Ouroboros LeiosとDijkstra

Leiosは、input block、endorsement block、ranking blockを分け、取引処理と順序付けを並列化する次世代合意設計です。2026年6月23日に公開テストネット「Musashi Dojo」が始まり、7月17日の開発報告では二つのprototype buildと投票dashboardを安定化した段階でした。

性能目標、シミュレーション、テストネット結果は、メインネットの実効性能ではありません。ノード要件、ネットワーク伝播、競合取引、障害時回復、インセンティブ、セキュリティ証明、ガバナンス承認を経て初めて本番条件が定まります。van Rossem後はDijkstra eraの準備が進み、Leios導入が将来範囲に含まれますが、実施時期と最終仕様は今後の開発・投票に依存します。

## DeFi、ステーブルコイン、利用事例

### DeFiの現在地

DefiLlamaの2026年7月26日スナップショットは次のとおりです。

| 指標 | 表示値 | 読み方 |
|---|---:|---|
| DeFi TVL | 約6,213万ドル | ADA価格と集計対象で変動 |
| ステーブルコイン時価総額 | 約6,353万ドル | USDC dominance約64.05% |
| DEX出来高 | 約139万ドル / 24時間 | 日ごとの変動が大きい |
| active addresses | 11,629 / 24時間 | 集計定義はサービス依存 |
| transactions | 22,059 / 24時間 | 単純送金と複合処理を同列に数える |

主要掲載プロトコルには、DEXのMinswap、レンディングのLiqwid、dual-token stablecoinのDjed、合成資産のIndigo、DEXのSplash等があります。同日時点の個別TVLはMinswap約1,214万ドル、Liqwid約1,158万ドル、Djed約471万ドル、Indigo約386万ドルでした。プロトコルの預かり資産を合計したTVLは、収益、利用者数、支払決済額、セキュリティを直接示しません。

### ステーブルコイン

DjedはADA等の準備資産とreserve coin SHENを使う過剰担保型の設計で、法定通貨預金を1対1で償還する一般的なfiat-backed stablecoinとは異なります。担保率、ミント・バーン条件、オラクル、スマートコントラクト、流動性、COTI等の運営主体を確認します。「前払いモデル」や法定通貨担保として説明するのは不正確です。

USDM等のfiat-backed stablecoinでは、発行体の銀行預金・短期資産、償還条件、監査・attestation、凍結権限、対象法域が中心リスクです。USDAを含む発表済みプロジェクトは、発表、再開、限定提供、一般利用可能な本番発行を区別する必要があります。

### ウォレットとアプリ

Daedalusはフルノードウォレットで、同期にストレージと時間が必要です。Lace、Yoroi、Eternl等は軽量ウォレットとして利用されますが、開発主体、対応プラットフォーム、オープンソース範囲、ハードウェアウォレット連携、DApp接続権限が異なります。

DAppへ接続するときは、表示名だけでなくURL、署名内容、送信資産、collateral設定、mint/burn、参照するpolicy IDを確認します。Cardano取引は署名前に内容を構造化できますが、ウォレットUIがすべてを分かりやすく表示するとは限りません。

### 企業・社会利用

Cardano Foundationは、Petrobrasの研修受講証明、Syngenta Foundation Indiaの農業データ、Grant Thorntonとの検証可能なデータ等を事例として掲載しています。また、同Foundationは2026年7月時点で「9 years nonstop uptime」「11M+ assets」「3000+ operators」と公表しています。これらはFoundation公表指標であり、独立監査済みの同一粒度KPIとは限りません。

2021年に発表されたエチオピア教育ID計画は、最大500万人の生徒・教員を対象とする構想でした。対象人数の発表を、現在の実稼働ユーザー数や完了済み配布数として扱うことはできません。提携発表、PoC、限定運用、全国本番稼働は段階を分けて評価します。元原稿にある「Ethereum Foundationとの提携」は確認できず、採用実績から除外しました。

## セキュリティ、障害、運用リスク

### 2025年11月21日のチェーン分岐

2025年11月21日08:00 UTC頃、特定のnode versionに残っていたdeserialization bugを、不正形式のdelegation transactionが突くことで、Cardanoメインネットが一時的に二つのチェーンへ分岐しました。正常チェーンでもブロック生成は継続しましたが速度が低下し、取引所は予防的に入出金を停止しました。

Intersectの報告では、ユーザー資産の盗難はなく、node 10.5.3への更新とSPOの協調で正常チェーンへ収束しました。50%超のstakeが正常チェーンへ移るまで約8〜9時間、正常チェーンがブロック生産で上回るまで約14時間とされています。

この事象は暗号方式そのものの破綻ではなくnode softwareの合意関連バグでしたが、実装バグがネットワーク履歴を分け得ること、複数node versionの挙動差、緊急アップデート時のSPO協調、取引所停止の影響を示します。Foundationの「nonstop uptime」はブロック生成が完全停止しなかったという説明とは両立しますが、無障害だったことを意味しません。

### スマートコントラクトと利用者側

- Plutus validator、minting policy、オフチェーンコードのロジック不備
- オラクル価格の停止・操作・遅延
- DEX・レンディングの流動性不足、清算、bad debt
- ブリッジ、wrapped asset、カストディの侵害
- フィッシング、偽ウォレット、偽policy ID、seed phrase流出
- ハードウェアウォレットやブラウザ拡張のサプライチェーン
- ステークプール、DRep、SPO、CCの鍵侵害
- node更新の遅れと互換性差

形式検証可能性はコードの保証範囲を明確にする手段です。仕様自体の誤り、検証していない依存関係、運用担当者、秘密鍵、法的契約まで自動的に安全にするものではありません。

## 市場データと流動性

2026年7月26日の市場データは次のとおりです。値は取得時刻と集計方法で変わります。

| 指標 | CoinMarketCap | CoinGecko |
|---|---:|---:|
| 価格 | 約0.1644ドル | 約0.1644ドル |
| 時価総額 | 約59.98億ドル | 約61.26億ドル |
| 24時間出来高 | 約1.341億ドル | 約1.369億ドル |
| 順位 | 16位 | 18位 |
| 流通供給 | 約364.899億ADA | 約370億ADA |
| 最大供給 | 450億ADA | 450億ADA |
| FDV | — | 約73.91億ドル |

取引量の大部分は海外の中央集権型取引所にあり、取引所ごとの板の厚み、スプレッド、入出金可否、カウンターパーティー、法域が異なります。世界全体の出来高が大きくても、国内ADA/JPYの特定取引所で同じ流動性が得られるとは限りません。

2021年9月2日の最高値約3.09ドルから、2026年7月26日時点では約94.7%低い水準です。最高値からの下落率は将来の回復余地を保証せず、時価総額、供給増、競合、需要、規制、市場サイクルが以前と同じ条件になるとも限りません。

元原稿の「CMEにADA先物がある」という記述は、CME Groupの現行商品として確認できなかったため削除しました。海外暗号資産取引所にはADA perpetual futures等がありますが、CFTC監督下の指定契約市場の商品、現物取引、無期限先物を同列に扱うことはできません。

## 規制・法務・税務

### 米国

米SECは2023年のCoinbase・Binance訴訟でADAに関する証券性の主張を含めましたが、訴状上の主張は裁判所による最終認定ではありません。その後の訴訟終結と制度変更を経て、SECが2026年3月に公表した暗号資産の連邦証券法上の解釈では、Cardano（ADA）を **digital commodity** の例として明記しました。

これは2026年の米国連邦証券法に関するSEC解釈であり、すべての取引、ステーキングサービス、ラップ商品、トークン販売、DeFi契約が規制対象外になるという意味ではありません。商品の構造、販売方法、仲介者、カストディ、利回り約束、対象州・法域で結論が変わります。

### 日本

日本ではADAは資金決済法上の暗号資産として、金融庁登録済みの複数の暗号資産交換業者が取り扱います。交換業者が登録済みでも、価格、システム停止、流動性、秘密鍵、信用、サイバー攻撃のリスクがなくなるわけではありません。利用前に金融庁の最新登録一覧と各社の現行取扱銘柄を確認します。

個人が暗号資産の売却、他の暗号資産との交換、商品・サービスへの使用等で得た利益は、原則として雑所得に区分されますが、事業性等により扱いが変わる場合があります。ステーキング報酬は受領時の時価が所得計算の基礎となり、その後の売却・交換時には別の損益計算が生じます。法人、相続、国外転出、DeFi、LP token、担保清算等は個別論点があるため、国税庁の最新資料と専門家を確認します。

## 競合比較

| 項目 | Cardano | Ethereum | Solana | Polkadot | Algorand |
|---|---|---|---|---|---|
| 台帳・実行 | EUTXO / Plutus | account / EVM | account系並列runtime | Relay Chain + parachain | account系AVM |
| 合意 | Ouroboros Praos PoS | Gasper系PoS | Tower BFT / PoH | NPoS | Pure PoS |
| 確定性 | 確率的settlement | checkpoint finality | Tower BFTとcommitment | GRANDPA finality | 即時finality設計 |
| ステーキング | liquid delegation、委任ADAのslashingなし | validator stake、slashingあり | delegation、slashing条件あり | nomination、slashingあり | participation方式 |
| 資産発行 | 台帳ネイティブ | token contract中心 | token program | chainごと | ASA |
| 主な拡張 | Hydra、将来Leios | rollup中心 | L1並列実行 | parachain | L1性能 |
| 2026年の相対規模 | DeFi・開発者規模は小さい | 最大級のスマコン経済圏 | 大規模な取引・アプリ活動 | マルチチェーン特化 | 比較的小規模 |

Cardanoの差別化は、EUTXO、非拘束型委任、台帳ネイティブ資産、査読研究、形式手法、オンチェーンConstitutionです。一方、開発者ツール、EVM互換性、stablecoin流動性、機関向けインフラ、アプリ利用規模では他チェーンが優位な領域があります。

単純なTPS比較は、取引定義、vote message、失敗取引、並列処理、batching、L2、finality、ハードウェア要件が異なるため注意が必要です。Cardanoの20秒平均ブロック間隔とSolanaのslot時間、Ethereum L1とrollup集計をそのまま横並びにしても、利用者が得る最終的な処理能力は分かりません。

## 主要リスク

### 技術・プロトコル

- Ouroborosの安全性が正直なstake多数とネットワーク前提に依存
- node implementationのバグが合意差や分岐を起こす可能性
- Leios、Phalanx、Peras等の研究成果が予定通り本番化するとは限らない
- EUTXOの状態競合とDApp設計の難しさ
- Plutus、オラクル、ブリッジ、ウォレットの脆弱性
- protocol parameter変更による手数料・報酬・容量の変化

### 経済・市場

- ADA価格の大幅変動と最高値からの長期下落
- 準備金減少に伴う報酬原資の変化
- 取引手数料需要が報酬・財務を十分補えない可能性
- USD建てTVLがADA価格に左右されること
- 国内板と世界出来高の流動性差
- 取引所、カストディ、stablecoin発行体の信用リスク

### ガバナンス

- DRep・SPOへの投票力集中
- 低参加率、委任者の無関心、情報格差
- 財務支出の利益相反と成果測定
- CCの判断、交代、緊急時対応
- アップグレード時にSPO・取引所・ウォレットの対応がそろわない可能性

### 採用・競争

- Ethereum、Solana、L2、アプリ専用chainとの競争
- EVM資産・開発者を移行させるコスト
- stablecoinとDeFi流動性の相対的な小ささ
- 実証実験や提携が継続利用へつながらない可能性
- 研究・ガバナンスの進捗と利用者需要が一致しない可能性

### 規制・税務

- 法域ごとの暗号資産、staking、DeFi、stablecoin規制
- 取引所の取扱停止、入出金制限
- 税率・損益区分・評価方法の変更
- DRep、SPO、財務受領者の法的責任が明確でない領域

## 評価シナリオ

以下は価格目標ではなく、ネットワークと利用状況を確認するためのシナリオです。

| シナリオ | 観測される状態 | 反証・悪化の兆候 |
|---|---|---|
| 利用拡大型 | Leiosがテストネットから安全に前進し、stablecoin、DEX、レンディング、企業利用の実取引が増える | 開発遅延、性能目標の縮小、TVL・出来高・手数料の停滞 |
| 漸進型 | L1は安定し、ガバナンスと既存アプリが継続するが、競合との差は大きく変わらない | 開発者・流動性が他chainへ移る |
| ガバナンス摩擦型 | 財務提案、DRep集中、Constitution解釈を巡り意思決定が長期化する | 投票参加率低下、アップグレード拒否、財務執行の停滞 |
| 技術障害型 | node bug、DApp侵害、アップグレード不整合で入出金やアプリが一時停止する | patch普及の遅れ、チェーン収束の長期化、資産損失 |
| 規制制約型 | 取引所・staking・stablecoinへの規制でアクセスと流動性が縮小する | 上場廃止、提供地域縮小、カストディコスト上昇 |

定期確認では、ADA価格だけでなく、Cardano node release、hard fork proposal、DRep・SPO投票参加、財務残高・支出、準備金、active stake、取引手数料、stablecoin供給、DEX出来高、DeFi TVL、主要DAppの監査・incidentを分けて追うと、変化の原因を把握しやすくなります。

## 確認チェックリスト

- Cardano公式の現行protocol versionとnode release
- hard forkとgovernance actionの批准・発効時刻
- Ouroboros研究とメインネット実装の区別
- Leiosのtestnet指標と本番導入条件
- ADAの最大供給、準備金、released supply、circulating supplyの定義
- 委任先プールの飽和度、実績、margin、固定費、pledge
- 自己管理委任と取引所・DeFiサービスの契約差
- DRepの投票履歴、活動状況、利益相反
- 財務提案のマイルストーン、契約、支出実績
- native tokenのpolicy ID、追加発行権限、発行体、償還条件
- DAppの監査、管理鍵、oracle、bridge、incident history
- 国内取引所の登録、取扱い、入出金、板、手数料
- 売却・交換・使用・staking rewardの税務記録

## まとめ

Cardanoは、Ouroboros Praos、EUTXO、台帳ネイティブ資産、Plutus、非拘束型ADA委任、CIP-1694ガバナンスを組み合わせたPoSスマートコントラクト基盤です。学術研究と形式手法を重視する設計は、仕様と安全性の前提を明示する強みがあります。一方、研究論文、prototype、testnet、本番実装、実利用の間には距離があり、それぞれを分けて確認する必要があります。

2026年7月の重要点は、van RossemでProtocol v11へ移行し、全面オンチェーンガバナンスで初のハードフォークを完了したこと、Leiosが公開テストネット段階へ進んだこと、更新版Constitutionが最大供給とパラメータのガードレールを運用していることです。同時に、2025年11月の一時的なチェーン分岐は、形式研究を重視するネットワークでも実装バグと緊急運用リスクが残ることを示しました。

ADAを調べる際は、価格やステーキング率だけでなく、準備金と報酬原資、DRep・SPO・CCの実際の投票、財務支出、node更新、DeFiの実利用、stablecoinの発行体、国内板の流動性、税務を別々に確認します。単一の指標やロードマップだけでCardano全体を評価することはできません。

## 参考資料

### Cardano公式・技術

- [Cardano公式サイト](https://cardano.org/)
- [Cardano Hard Forks](https://cardano.org/hardforks/)
- [Cardano Docs](https://docs.cardano.org/)
- [ByronからShelleyへの移行](https://docs.cardano.org/about-cardano/evolution/upgrades/byron-to-shelley)
- [Plominアップグレード](https://docs.cardano.org/about-cardano/evolution/upgrades/plomin)
- [Cardanoのerasとphases](https://docs.cardano.org/about-cardano/evolution/eras-and-phases)
- [Extended UTXO model](https://docs.cardano.org/about-cardano/learn/eutxo-explainer)
- [Cardano Developer Portal：Ethereum開発者向け比較](https://developers.cardano.org/docs/developers/curriculum/fundamentals/cardano-for-ethereum-developers/)
- [Smart Contracts Overview](https://developers.cardano.org/docs/developers/curriculum/smart-contracts/overview/)
- [Transaction Fees](https://developers.cardano.org/docs/developers/curriculum/fundamentals/core-concepts/fees/)
- [Cardano Staking](https://developers.cardano.org/docs/developers/curriculum/staking-governance/staking/)
- [Cardano Genesis Distribution](https://cardano.org/genesis/)
- [Cardano Supply Insight](https://cardano.org/insights/supply/)
- [Ouroboros各研究方式の説明](https://www.iog.io/news/from-classic-to-chronos-the-implementations-of-ouroboros-explained)
- [Ouroboros Leios](https://www.iog.io/news/advancing-ouroboros-leios-as-the-next-leap-in-scalability)
- [Leios testnet開発報告](https://cardano.org/news/2026-07-17-weekly-development-report/)

### ガバナンス・アップグレード

- [Cardano Governance Overview](https://docs.cardano.org/about-cardano/governance-overview)
- [Cardano Constitution](https://cardano.org/constitution/)
- [更新版Constitutionの批准結果と発効日](https://intersectmbo.org/news/updated-cardano-constitution-ratification-outcome-and-effective-date)
- [van Rossem Hard Fork](https://intersectmbo.org/news/cardano-upgrade-van-rossem-hard-fork)
- [van Rossem発効後の報告](https://intersectmbo.org/news/intersect-weekly-update-121-july-24-2026)
- [CIP-1694](https://cips.cardano.org/cip/CIP-1694)
- [Project Catalyst](https://projectcatalyst.io/)

### スケーリング・セキュリティ

- [Hydra Head Protocol](https://hydra.family/head-protocol/)
- [Hydra Head User Manual](https://hydra.family/head-protocol/docs/)
- [Mithril Documentation](https://mithril.network/doc/)
- [Mithril Client](https://mithril.network/doc/mithril/advanced/mithril-network/client/)
- [Mithril Signer 1.0.0](https://mithril.network/doc/dev-blog/)
- [2025年11月ネットワーク分岐のincident report](https://intersectmbo.org/news/incident-report-network-partition-analysis-and-resolution-strategy)
- [Cardano mainnet incident facts](https://intersectmbo.org/news/cardano-mainnet-incident-facts-at-a-glance)

### エコシステム・市場

- [Cardano Foundation](https://cardanofoundation.org/)
- [DefiLlama：Cardano](https://defillama.com/chain/cardano)
- [Minswap](https://minswap.org/)
- [Liqwid](https://liqwid.finance/)
- [Djed](https://djed.xyz/)
- [Indigo](https://indigoprotocol.io/)
- [ADA市場データ（CoinMarketCap）](https://coinmarketcap.com/currencies/cardano/)
- [ADA市場データ（CoinGecko）](https://www.coingecko.com/en/coins/cardano)

### 規制・税務・競合資料

- [SEC：Crypto Assets and the Federal Securities Laws](https://www.sec.gov/resources-small-businesses/capital-raising-building-blocks/crypto-assets-federal-securities-laws)
- [SEC Interpretive Release No. 33-11412](https://www.sec.gov/files/rules/interp/2026/33-11412.pdf)
- [暗号資産交換業者登録一覧（金融庁）](https://www.fsa.go.jp/menkyo/menkyoj/kasoutuka.pdf)
- [暗号資産の税務上の取扱い（国税庁）](https://www.nta.go.jp/publication/pamph/shotoku/kakuteishinkokukankei/kasoutuka/)
- [Ethereum Documentation](https://ethereum.org/en/developers/docs/)
- [Solana Documentation](https://solana.com/docs)
- [Polkadot Wiki](https://wiki.polkadot.network/)
- [Algorand Developer Portal](https://dev.algorand.co/)

## 免責事項

本記事は情報提供のみを目的としており、特定の暗号資産の売買・保有を勧誘または推奨する投資助言ではありません。公開情報をもとに可能な限り正確な記載に努めていますが、完全性・正確性・最新性を保証するものではありません。将来の記述やシナリオは成果を保証しません。暗号資産には元本の全部を失う可能性があり、税務・法務上の取扱いも居住地や利用方法により異なります。利用前に最新の公式情報と専門家の助言を確認してください。
