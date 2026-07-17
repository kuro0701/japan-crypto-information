---
title: USDT（テザー）総合分析｜準備金・規制・リスク・機関投資家評価
description: USDTの発行体、準備金構成、監査・保証、市場規模、ユースケース、規制動向、USDC・BUSD比較、リスクと機関投資家向け検討事項を総合分析します。
date: 2026-07-13
updated: 2026-07-17
author: 国内暗号資産取引所ナビ
slug: usdt
path: /articles/usdt
articleType: market
marketTicker: USDT
category: ステーブルコイン
tags: USDT, テザー, Tether, ステーブルコイン, 準備金, 監査, MiCA, GENIUS Act, USDC, BUSD
readMinutes: 22
---

> **重要：本記事は情報提供のみを目的としており、特定の暗号資産の売買・保有を勧誘または推奨する投資助言ではありません。** 掲載する評価、シナリオ、価格レンジ、運用例は調査時点の分析上の仮定であり、将来の成果を保証しません。暗号資産は価格変動・流動性・技術・規制等のリスクを伴います。実際の取引判断は、最新の公式情報を確認し、ご自身の状況に応じて行ってください。

## エグゼクティブサマリー

USDT（USD₮、通称 USDT）は、Tether が発行する米ドル建てステーブルコインであり、2026年7月時点でも世界最大のステーブルコインです。ライブ市場データでは時価総額はおおむね1,840億ドル規模、ステーブルコイン市場全体に占めるシェアは約59%で、USDC を大きく上回ります。Tether の2026年3月末時点の公表値では、発行体 Tether International, S.A. de C.V. の総資産は1,917.7億ドル、総負債は1,835.4億ドル、超過準備は82.3億ドルでした。これは、USDT が単なる暗号資産ペアの「待避先」ではなく、グローバルなドル流動性の供給インフラに近い規模へ成長したことを示します。

もっとも、機関投資家の観点では、USDT は「最大規模であること」と「最も規制整備が進んでいること」が一致しない代表例でもあります。Tether の準備金は主として短期米国債やレポで構成される一方、金、ビットコイン、担保付貸付、公開株式、その他投資も含みます。加えて、BDO による四半期ごとのアテステーションはあるものの、Tether 自身が2026年3月に「Big Four による初のフル監査の実施契約」を公表したことからも分かるように、2026年7月時点で市場が参照しているのは継続的なフル監査済み財務諸表ではなく、時点ベースの準備金報告とアテステーションです。

結論として、USDT は「最も広く使われるドル流動性トークン」である一方、「最も保守的な規制・監査プロファイルを持つ機関向けステーブルコイン」とは言い難い、という整理が妥当です。本レポートでは、取引・担保移転・オフショア決済といった用途に加え、保有上限、償還導線、チェーン分散、カウンターパーティ・モニタリングを分析上の確認事項とします。これは、FRB・BIS・IMF が共通して指摘するラン、資産売却、規制不確実性、通貨代替・資本流出といったステーブルコイン特有の脆弱性とも整合的です。

## 発行体と歴史

Tether は、公式サイト上で「2014年にブロックチェーン上で法定通貨をデジタルに利用するためのプラットフォームとして立ち上げられた」と説明しており、早期から“法定通貨のデジタル輸送レイヤー”を志向していました。現行サイトでは CEO を Paolo Ardoino、Chairman を Giancarlo Devasini、CFO を Simon McWilliams としています。

法域面では、Tether は2025年1月に、エルサルバドルで Digital Asset Service Provider ライセンスと stablecoin issuer としての認可を取得し、グループ子会社をエルサルバドルへ移転すると公表しました。エルサルバドル国家デジタル資産委員会の公開レジストリでも、Tether International S.A. de C.V. と TG Commodities S.A. de C.V. がステーブルコイン発行体として登録されています。したがって、現在の Tether は、歴史的にはオフショア色の強い発行体から、エルサルバドル規制下のデジタル資産グループへと制度的な足場を移したと評価できます。

一方、Tether の発展は「規制クリアランスの拡大」と「論争の継続」が同時進行してきた歴史でもあります。2021年にはニューヨーク州司法長官との和解、CFTC からの制裁命令という形で、過去の準備金表示を巡る問題が顕在化しました。その後、2025年から2026年にかけては、エルサルバドル認可、四半期アテステーション継続、フル監査への移行公表などを通じて制度面の補強が進みましたが、完全に「論争後」の状態に入ったとはまだ言えません。

Tether の戦略は、USDT 単体の発行に留まりません。Tether の投資ページでは、決済インフラ、トークナイゼーション、法執行協力、欧州 MiCA 準拠発行体支援、B2B 決済事業などへの出資を明示しており、USDT を核にしつつ、周辺インフラを垂直統合する構図が見て取れます。これは BlackRock 的な表現を用いれば、「単一商品の成功から、デジタルドル・エコシステムのプラットフォーム化」への移行と整理できます。

## 仕組みと準備金

USDT の基本設計は、Tether 公式説明によれば「1対1で現実世界の通貨にペッグされ、Tether の準備金で100%裏付けられる」ことにあります。新規発行は、厳格な KYC を経た顧客からの購入要求に応じて行われ、トークンは Ethereum、Tron、Solana、Ton を含む複数チェーン上で流通します。したがって USDT は、技術的にはマルチチェーン型、法的・経済的には発行体の準備金信用に依存する“受皿型ステーブルコイン”です。

<div class="article-mermaid">
<pre class="mermaid">flowchart LR
    A[機関顧客・取引所] -->|USD 入金 / KYC| B[Tether]
    B -->|USDT 発行| C[ブロックチェーン上で流通]
    C --> D[取引所売買]
    C --> E[決済・送金]
    C --> F[DeFi担保・流動性供給]
    C -->|償還要求| B
    B -->|USD 償還| A
</pre>
</div>

上図は Tether の「KYC 済み顧客に対する発行」と「ブロックチェーン上での二次流通」という二層構造を要約したものです。一次市場では発行体信用が、二次市場では取引所流動性と市場参加者の裁定が、ペッグ維持の中核になります。

2026年3月31日時点の BDO アテステーション付き Financial Figures and Reserves Report によると、Tether International の総資産は1,917.7億ドル、総負債は1,835.4億ドル、超過準備は82.3億ドルでした。資産内訳は、米国財務省短期証券 1,170.4億ドル、オーバーナイト RRP 193.3億ドル、ターム RRP 47.5億ドル、現金・銀行預金 1.07億ドル、貴金属 198.4億ドル、ビットコイン 66.2億ドル、公開株式 34.1億ドル、その他投資 48.4億ドル、担保付貸付 158.3億ドル、社債 0.03億ドルです。筆者計算では、米国債・RRP・現金等の高流動性資産は総資産の約73.6%を占めます。

<div class="article-mermaid">
<pre class="mermaid">pie showData
    title 2026年3月末 Tether 準備金構成
    "米国短期国債" : 117.0
    "オーバーナイトRRP" : 19.3
    "タームRRP" : 4.7
    "現金・預金" : 0.1
    "貴金属" : 19.8
    "ビットコイン" : 6.6
    "担保付貸付" : 15.8
    "公開株式" : 3.4
    "その他投資" : 4.8
</pre>
</div>

この準備金構成は、2022年前後の商業手形中心という批判を相当程度後退させる一方で、USDC のように「ほぼ現金・政府 MMF・短期国債」に集中した保守型とは依然として異なります。特に、金・ビットコイン・公開株式・その他投資・担保付貸付が残っている点は、通常の短期決済資産よりも時価変動・換金タイミング・評価の不確実性を残します。Tether 自身も、報告書で「通常の取引条件を前提に評価しており、想定外・異常市場や主要カストディアン/カウンターパーティの深刻な流動性逼迫は反映しない」と記載しています。

監査・保証の観点では、重要な留意点が三つあります。第一に、BDO の結論は四半期時点の Financial Figures and Reserves Report に対する保証であり、活動全期間を監査したものではありません。第二に、当該レポートは IFRS の認識・測定原則を用いる一方、一般表示や開示が不足しており、IFRS 準拠財務諸表そのものではないと明記されています。第三に、注記部分は BDO の保証対象外です。したがって、市場が受領しているのは「フルスコープ監査済み年次財務諸表」ではなく、「限定された範囲のアテステーションを伴う準備金報告」です。Tether が2026年3月に Big Four とのフル監査契約を公表したこと自体、このギャップを埋める必要性を会社側も認識していることを示します。

## 市場規模と主要ユースケース

2026年7月時点のライブデータでは、USDT の市場規模は約1,841億ドル、流通量は約1,843億USDT、ステーブルコイン全体に占める比率は約59%です。これは USDC の約734億ドルを大きく上回り、USDT が依然として決済・取引・担保移転における最重要インフラであることを示します。

<div class="article-mermaid">
<pre class="mermaid">xychart-beta
    title "USD₮ 発行残高の推移"
    x-axis ["2024-03","2024-12","2025-03","2025-06","2025-09","2025-12","2026-03"]
    y-axis "十億USD" 0 --> 200
    line [104.0,136.6,143.7,157.1,174.4,186.5,183.4]
</pre>
</div>

上図は、Tether が各四半期アテステーションで公表した「デジタルトークン関連負債」を時系列化したものです。USDT は2024年3月末の約1,040億ドルから、2025年末には約1,864億ドルまで拡大し、2026年3月末でも約1,834億ドルと高水準を維持しました。安定通貨である以上、流通供給残高は時価総額とほぼ同義に近く、USDT の成長が“価格上昇”ではなく“需要増加”で説明される点が重要です。

チェーン別には、DeFiLlama ベースの2026年7月時点データで、Ethereum 上の USDT は約764.9億ドル、Tron 上は約896.3億ドルです。両チェーン合計で USDT 全体の約90%を占めており、USDT の実務上のオペレーション・リスクは、発行体信用だけでなく Ethereum と Tron の二大基盤への集中にも大きく依存しています。

ユースケースの第一は、依然として暗号資産取引です。Tether 自身が「tier one exchanges で例外的な流動性を提供し、24時間取引量で最も活発に取引されるトークン」と説明しており、CoinMarketCap 上でも 2026年7月時点の24時間出来高は約437億ドルでした。したがって USDT は、価格安定コインというよりも、暗号資産市場における“基軸決済単位”として機能しています。

第二は、決済・送金です。Tether は公式に、マーチャント統合を通じて「商品・サービス購入」の機会を開くと説明し、さらに機関向けトークナイゼーション事業 Hadron では、ステーブルコインが国際送金の迅速化・低コスト化に資することを強調しています。Tether の投資先一覧でも、USDt ベースの越境 B2B 決済を行う XREX などが明示されており、USDT が新興国・越境商流のドル代替決済レールとして使われていることが読み取れます。

第三は DeFi です。Aave は自らを「stablecoin lending and borrowing の最大級プロトコル」と位置づけ、Ethereum 上の USDT・USDC の預入・借入の80%以上シェアを有すると説明しています。Aave のようなレンディング市場では、USDT は利回り獲得、レバレッジ、担保差し替え、流動性確保の用途で使われます。もっとも、DeFi ではスマートコントラクト・オラクル・ブリッジ・清算の複合リスクが加わるため、同じ USDT でも中央集権取引所保有よりリスク特性は大きく異なります。

第四は機関投資家・金融機関の利用ですが、ここは最も慎重な区分が必要です。Circle は明確に銀行・企業・機関投資家向けの USDC インフラを打ち出し、OCC の national trust bank 承認まで獲得しました。一方、USDT は市場流動性・オフショア決済・取引所担保では圧倒的優位を保つものの、発行体の監査・法域・EU MiCA 非適合の影響を踏まえると、伝統的金融機関が“直接の基幹準備資産”として採用しやすいのは現状では USDC の方だ、というのが合理的な推論です。これは USDT の弱さというより、用途別に「最適なステーブルコインが異なる」ことの表れです。

## リスク評価

USDT の信用リスクは、準備金資産の質、発行体の法的義務、監査の深さという三つの論点に分けて評価すべきです。2026年3月末時点で超過準備が82.3億ドル存在した点はポジティブですが、その一方で準備金には金、ビットコイン、担保付貸付、公開株式、その他投資が含まれます。また Tether の法務文書検索結果では、Tether Tokens は法定通貨ではなく、政府保証も保険もないと明示されています。よって、USDT の信用リスクは「直ちに高い」とまでは言えないものの、「短期国債ファンド等と同視できるほど低い」とも言えません。

流動性リスクの核心は、平常時の高流動性とストレス時の換金性が別物である点です。FRB は 2026年の分析で、ステーブルコイン市場における構造変化が新たな金融安定リスクを増幅し得ると指摘し、BIS は安定コイン準備資産の fire sale が基礎市場機能を傷める可能性を警告しています。Tether の報告書自身も、評価は「normal trading conditions」を前提にしていると記述しており、主要カストディアンや相手先の深刻な流動性逼迫は考慮していません。したがって、通常日の1ドル近傍での売買流動性は非常に高くても、大規模償還ショック時の“真の流動性”は別途検証が必要です。

規制リスクは、2026年時点でむしろ上昇しています。米国では GENIUS Act が成立し、1対1準備や許容準備資産、BSA/AML 義務を備えた連邦枠組みが導入されました。EU では MiCA により EMT/ART 規制が全面適用され、ESMA・欧州委員会は非適合 stablecoin の扱いに関するガイダンスを公表しました。実務上の影響として、Binance は 2025年3月に EEA ユーザー向けに USDT など非 MiCA 適合ステーブルコインの取引ペアを終了すると正式発表しています。つまり、USDT の最大リスクは「禁止」よりも、「地域ごとの利用可能性が断片化し、取引・保管・決済導線が法域別にばらつくこと」にあります。

オペレーショナルリスクは、ブロックチェーン基盤と発行体統制の双方から発生します。USDT はマルチチェーンで流通するため、チェーン停止、ブリッジ事故、スマートコントラクト障害、カストディ事故の影響を受け得ます。同時に、Tether は 2023年以降、制裁対象や犯罪関係ウォレットの凍結を積極化しており、2026年4月時点で 65か国・340超の法執行機関と協力し、44億ドル超の資産凍結を支援したと公表しています。これは AML/CFT 上の強みである一方、裏返せば USDT が「パーミッションレスな現金」ではなく、発行体がアドレス単位で介入できる強い管理権限を持つことを意味します。機関投資家にとっては、これは利点でもあり、同時に統治上の依存点でもあります。

ステーブルコイン固有の崩壊シナリオとしては、IMF が整理する通り、ラン、償還・売却の自己強化、資産売却による価格圧力、通貨代替や資本流出の増幅が中核です。BIS も、現在の stablecoin 設計は singleness・resilience・integrity の面で十分でないとし、Fed も銀行預金代替と信用供給への波及可能性を論じています。USDT 固有に言えば、「準備金の疑義 → 一部法域での取引制限 → 主要取引所の担保需要低下 → 二次市場ディスカウント → 償還集中 → 非中核資産の売却圧力」という連鎖が、最も典型的なストレス・パスです。

| リスク項目 | 評価 | 主因 | 実務インプリケーション |
|---|---|---|---|
| 信用リスク | 中位 | 準備金は大半が高流動性資産だが、金・BTC・貸付等も残存。フル監査は未完了。 | コア現金同等物としては扱わず、ヘアカット前提で管理。 |
| 流動性リスク | 中位 | 平常時流動性は極めて高いが、ストレス時は償還集中と資産売却圧力が問題。 | “市場流動性”と“償還流動性”を分けて検証。 |
| 規制リスク | 高位 | 米国・EU でルール明確化が進み、非適合トークンの取扱いが制限されうる。 | 法域別に保有可否・取引所可否・顧客提供可否を分離管理。 |
| オペレーショナルリスク | 中位 | チェーン集中、カストディ、ウォレット凍結、ブラックリスト実行。 | チェーン・カストディアン・取引所を分散。 |
| 崩壊シナリオ | 中位〜高位 | ラン、ディスカウント拡大、fire sale、法域断片化。 | 常時保有と短期運用・決済用途でリスク特性が異なる。 |

## 規制動向

### 米国

米国では、2025年7月に GENIUS Act が成立し、支払型ステーブルコインに初の連邦枠組みが導入されました。ホワイトハウスと CEA は、同法が少なくとも1対1の裏付け、許容資産の限定、BSA/AML 義務の明確化を要求すると説明しています。許容準備資産には米ドル現金、一定の預金、短期米国債、米国債担保レポ、マネー・マーケット・ファンド等が含まれます。

この制度は、USDT に二つの相反する影響を与えます。第一に、準備金の短期国債化が進んでいる Tether にとって、制度要件との距離は過去より縮んでいます。第二に、米国の機関投資家市場では、OCC 承認の national trust bank を得た Circle/USDC の方が、規制上の親和性で優位に立つ公算が大きいです。加えて、2026年2月には Sen. Jack Reed が Foreign Stablecoin Transparency Act を提案しており、外国発行体の監査・透明性は引き続き政策争点です。

### 欧州連合

EU では MiCA が安定コインを EMT（電子マネートークン）と ART（資産参照型トークン）に分けて規律しており、stablecoin 関連条項は 2024年6月30日から、MiCA 全体は 2024年12月30日から適用されています。EBA は EMT/ART 発行体の認可、流動性、ストレステスト、利益相反等の詳細基準を整備し、ESMA と欧州委員会は 2025年1月に非 MiCA 適合 stablecoin に関するガイダンスを公表しました。

USDT にとっての含意は明確です。Tether は欧州では自社の USDt を MiCA 準拠にするのではなく、MiCA 準拠の欧州発行体 StablR への投資と、Hadron を通じた支援に軸足を移しました。Binance は 2025年3月、USDT を含む非 MiCA 適合 stablecoin の EEA 向け取引ペアを終了すると公表しており、MiCA は USDT の欧州オンショア流通を制度的に圧迫しています。

### 日本

日本は、金融庁・日本銀行が繰り返し強調している通り、ステーブルコイン制度整備で早期に動いた法域です。金商法・資金決済法の改正を通じて「電子決済手段」の枠組みを導入し、2026年6月1日には電子決済手段・暗号資産サービス仲介業の新制度も開始されました。日本銀行副総裁も 2026年5月講演で、日本がステーブルコイン発行に必要な法制度整備を世界に先駆けて進めてきたと述べています。

他方で、日本制度は国内発行・国内仲介に重点があり、海外発行の USDT をそのまま日本の電子決済手段と同列に扱う設計ではありません。金融庁は 2025年末から2026年初にかけて、資金決済法改正や外貨建て・海外発行ステーブルコインの制度論を継続審議している一方、具体的内容は「未確定」と繰り返し説明しています。したがって、日本における USDT は、2026年7月時点では“包括的に制度化された商品”ではなく、“既存暗号資産・仲介規制との接続がなお整理中の域外発行トークン”として見るのが実務的です。

### 主要アジア法域

香港は 2025年8月1日に Stablecoins Ordinance を施行し、法定通貨参照型ステーブルコイン発行をライセンス制に移行しました。2026年4月には HKMA が Anchorpoint と HSBC に発行ライセンスを付与しており、アジアでは最も前進したオンショア制度の一つです。

シンガポールでは、MAS が 2023年にシングルカレンシー・ステーブルコインの規制枠組みを確定し、高度な価値安定性を担保する制度として位置づけました。2025年には DTSP 規制も強化され、国外向けのみのデジタルトークンサービスにも新たな許認可要件が課されました。シンガポールは stablecoin 一般を奨励するというより、「MAS 規制下の stablecoin」とそれ以外を明確に峻別する方向です。

韓国は 2026年7月時点で最終制度が未確定です。金融委員会は 2025年末から2026年初にかけて、ステーブルコイン発行主体や二段階法制の詳細は未確定と説明しており、同時に AML 体制の整備方針を示しています。したがって韓国は「制度設計中」の市場であり、USDT にとっては潜在市場であると同時に、将来の参入条件が読みにくい法域でもあります。

## 競争環境と過去の事件・論争

まず競争環境を整理すると、USDT の圧倒的な強みは規模と流動性であり、USDC の強みは規制整合性と透明性、BUSD は現在では主に“規制で縮小した先行事例”としての比較対象です。つまり競争軸は、もはや単なる「どちらが1ドルに近いか」ではなく、「どの法域・どのユースケース・どの監査水準に最適化されているか」に移っています。

| トークン | 発行体 | 現在規模 | 裏付け・準備金 | 監査・保証 | 規制ポジション | 総合評価 |
|---|---|---|---|---|---|---|
| USDT | Tether International / Tether Group | 約1,842億ドル、ステーブルコイン市場シェア約59%。 | 2026年3月末時点で短期米国債・RRP・現金が中心だが、金・BTC・担保付貸付・公開株式等も含む。 | BDO による四半期アテステーション。フル監査は2026年3月に Big Four と契約公表、未完了。 | エルサルバドルで stablecoin issuer 登録。EU MiCA では自社 USDT ではなく提携・投資型に転換。 | 流動性最強。だが機関投資家のコア保有には追加管理が必要。 |
| USDC | Circle | 約734億ドル。 | 100% 現金・現金等価資産。準備の大半は SEC 登録 2a-7 政府 MMF（USDXX）。 | Big Four による月次保証、週次開示。 | 2026年7月に OCC final approval を受け national trust bank 設立。米国制度との整合性が高い。 | 規制適合性・機関親和性で優位。取引流動性は USDT に劣後。 |
| BUSD | Paxos | 約3,800万ドル。縮小済み。 | 月次 reserve reports を継続。Paxos は償還または USDP 転換を提供。 | 月次透明性報告。 | 2023年に NYDFS が新規 mint 停止命令、2025年に Paxos/Binance 関係で AML 不備に対する制裁金。 | “規制により消えた大型 stablecoin” のケーススタディ。 |

過去の事件・論争では、2021年のニューヨーク州司法長官との和解が最重要です。司法長官は、Bitfinex と Tether に対し、ニューヨーカーとの取引停止や情報提出等を求める和解を発表しました。続いて CFTC も同年、2016年から2019年にかけて USDT が常時十分な米ドル準備を維持しているかのような不実・誤認的表示があったとして、Tether に 4,100万ドルの民事制裁金を課しました。これらは、USDT の「準備金問題」が単なる風評ではなく、米当局の正式処分対象であったことを意味します。

次に、BUSD は競合比較の観点から重要です。NYDFS は 2023年2月、Paxos に対し BUSD の新規 mint 停止を命じ、2025年8月には Paxos の AML・デューデリジェンス不備に関して4,850万ドルの和解を公表しました。BUSD は「規制に近い stablecoin でも、パートナー管理や AML が弱いと縮小しうる」ことを示した事例であり、USDT に対する示唆は小さくありません。

第三に、欧州 MiCA に伴う上場・取引制限です。Binance は 2025年3月、EEA ユーザー向けに USDT など非 MiCA 適合 stablecoin の取引ペアを終了すると発表しました。これは発行停止ではありませんが、機関実務では“実質的な流動性制限”として機能します。Tether 側も 2025年11月、EUR₮ の償還停止を最終実施し、欧州でよりリスク回避的な規制枠組みが整うまで別施策を優先すると説明しました。

第四に、係争・法執行協力です。Tether の2026年3月末報告書では、2017年・2018年のビットコイン価格下落を巡るクラスアクションがニューヨークで継続中と記載されています。他方で Tether は近年、DOJ、US Secret Service、各国当局と連携し、2026年4月時点で44億ドル超の資産凍結支援を公表しています。したがって Tether は「訴訟リスクを抱える被規制主体」であると同時に、「法執行協力を通じて規制受容を高める主体」でもあります。

## 将来展望と投資家・機関向け検討事項

USDT の中期展望は、三つのドライバーで決まります。第一は、フル監査の実行可否です。Big Four 監査が完了し、四半期アテステーションから一段深い透明性へ進めば、信用ディスカウントは大きく低下し得ます。第二は、米国 GENIUS Act 下での外国発行体の位置づけです。第三は、EU MiCA に象徴される域内規制の断片化が、USDT の地域別流動性にどの程度影響するかです。

| シナリオ | 前提 | 想定される帰結 | 機関投資家への含意 |
|---|---|---|---|
| 楽観ケース | Big Four フル監査が完了し、米国・主要アジア市場で認知が進展。EU では直接発行以外の形で流動性迂回路が確立。 | USDT は市場支配を維持しつつ、準備金ディスカウントが縮小。USDC との棲み分けが明確化。 | 取引・決済・担保用途で許容枠の拡大が検討対象になり得る。 |
| ベースケース | 監査進展はあるが完全決着は先送り。米国では USDC が制度優位、USDT はオフショア・取引所・新興国決済で優位を維持。 | “最大の流動性トークン”としての地位は維持するが、機関投資家のコア残高では USDC 優位。 | USDTを流動性用途、USDCを規制整合性重視用途に分ける二層構造が想定される。 |
| 悲観ケース | 規制の断片化、主要法域での取扱制限、準備金や訴訟を巡る新たな疑義、二次市場ディスカウント拡大。 | 取引所担保需要が減少し、償還圧力と市場ディスカウントが自己強化。 | 短期回転中心となり、常時保有のリスク評価が厳格化する可能性。 |

投資家・金融機関が検討する実務上の論点は三つあります。第一に、USDT を「高流動性だが発行体信用を伴うデジタル決済資産」と分類した場合の会計・ALM・担保ヘアカット。第二に、取引在庫、顧客決済フロー、財務余資を用途別の異なるリスク枠で管理する可能性。第三に、発行体直接、取引所経由、OTC 経由の償還ルートと、ストレス時の資金化所要日数です。これらは、Tether の準備金構成、監査の限定性、FRB／BIS／IMF が指摘するrun／fire-saleリスクを分析する際の主要な確認項目になります。

第四の論点は、チェーン集中とアドレス凍結可能性の管理です。Ethereum と Tron への集中は、技術障害・手数料急変・政治的制約のいずれにも脆弱です。また、Tether が法執行協力のためにアドレス凍結を実行しうるため、ウォレット審査、相手先スクリーニング、Travel Rule・制裁対応、セルフカストディ運用には、通常の暗号資産と異なる統制が必要になる可能性があります。

最後に、本レポートでは「USDT か USDC か」の二者択一ではなく、「どの機能にどのstablecoinを使うか」という機能分解の観点で整理します。規制整合性・会計安定性・対当局説明可能性を重視する用途ではUSDC型、グローバル取引流動性・新興国決済・オフショア担保移転ではUSDTに相対的な強みがあります。この二層モデルでは、USDTは「高い実用性と発行体・規制リスクを併せ持つ基幹流動性トークン」と位置づけられます。

## 主要情報源と参考文献

本レポートは、発行体の準備金報告・アテステーション、各国の法令・監督当局資料、中央銀行・国際機関の分析、市場・オンチェーンデータを横断して作成しています。市場規模や流通量は変動するため、リンク先の最新値とあわせて確認してください。

### 発行体・準備金・運用

- [Tether公式サイト](https://tether.to/)
- [Tether Token Terms of Sale and Service](https://tether.to/en/legal/)
- [対応ブロックチェーンとコントラクト（Tether）](https://tether.to/en/supported-protocols/)
- [Tether Q1 2026 アテステーション公表資料](https://tether.io/news/tether-posts-1-04b-q1-2026-profit-despite-highly-volatile-global-markets-reaches-all-time-highs-8-23b-reserve-buffer-and-maintains-u-s-treasury-heavy-backing/)
- [Tether 2025年通期準備金・利益公表資料](https://tether.io/news/tether-delivers-10b-profits-in-2025-6-3b-in-excess-reserves-and-record-141-billion-exposure-in-u-s-treasury-holdings/)
- [Tether Q1 2025 アテステーション公表資料](https://tether.io/news/tether-approaching-120b-in-u-s-treasuries-confirms-quarterly-operating-profit-over-1b-and-strengthens-global-usdt-demand-in-q1-2025/)
- [Tether Q2 2025 アテステーション公表資料](https://tether.io/news/tether-issues-20b-in-usdt-ytd-becomes-one-of-largest-u-s-debt-holders-with-127b-in-treasuries-net-profit-4-9b-in-q2-2025-attestation-report/)
- [Tether Q1–Q3 2025 アテステーション公表資料](https://tether.io/news/tether-attestation-reports-q1-q3-2025-profit-surpassing-10b-record-levels-in-us-treasuries-exposure-accelerating-usdt-supply-amidst-worlds-macroeconomic-uncertainty/)
- [Tether Q1 2024 アテステーション公表資料](https://tether.io/news/tether-releases-q1-2024-attestation-reports-record-breaking-4-52-billion-profit-highest-treasury-bill-ownership-percentage-ever-total-group-equity-of-11-37-billion/)
- [Big Fourによる初のフル監査契約（Tether）](https://tether.io/news/tether-signs-big-four-firm-to-complete-first-full-audit-setting-a-new-quality-standard-for-the-digital-asset-economy/)
- [法執行機関との資産凍結協力（Tether）](https://tether.io/news/tether-supports-freeze-of-more-than-344-million-in-usdt-in-coordination-with-ofac-and-u-s-law-enforcement/)

### 市場・オンチェーン・DeFi

- [USDT市場データ（CoinMarketCap）](https://coinmarketcap.com/currencies/tether/)
- [ステーブルコイン市場データ（DefiLlama）](https://defillama.com/stablecoins)
- [USDTチェーン別データ（DefiLlama）](https://defillama.com/stablecoin/tether)
- [Aaveのステーブルコイン基盤解説](https://aave.com/blog/stablecoin-infrastructure)
- [Aave 2025 Year in Review](https://aave.com/blog/aave-2025-recap)
- [USDC準備金・透明性（Circle）](https://www.circle.com/transparency)
- [Circle National TrustのOCC最終承認](https://www.circle.com/pressroom/circle-receives-final-occ-approval-to-establish-national-trust-bank)

### 米国・欧州の制度と執行

- [GENIUS Act署名に関するファクトシート（White House）](https://www.whitehouse.gov/fact-sheets/2025/07/fact-sheet-president-donald-j-trump-signs-genius-act-into-law/)
- [ステーブルコインと金融安定（Federal Reserve）](https://www.federalreserve.gov/econres/notes/feds-notes/stablecoins-in-2025-developments-and-financial-stability-implications-20260408.html)
- [ステーブルコインと越境決済（Federal Reserve）](https://www.federalreserve.gov/econres/notes/feds-notes/payment-stablecoins-and-cross-border-payments-benefits-and-implications-for-monetary-policy-20260330.html)
- [2026年5月 Financial Stability Report（Federal Reserve）](https://www.federalreserve.gov/publications/2026-may-financial-stability-report-funding-risks.htm)
- [MiCA概要（ESMA）](https://www.esma.europa.eu/esmas-activities/digital-finance-and-innovation/markets-crypto-assets-regulation-mica)
- [非MiCA適合ステーブルコインのガイダンス（ESMA）](https://www.esma.europa.eu/press-news/esma-news/esma-and-european-commission-publish-guidance-non-mica-compliant-arts-and-emts)
- [MiCAのART・EMT規制（EBA）](https://www.eba.europa.eu/regulation-and-policy/asset-referenced-and-e-money-tokens-mica)
- [EEAでの非MiCA適合ステーブルコイン取扱変更（Binance）](https://www.binance.com/en/support/announcement/detail/bcaa1f68d6a6450099056ff694ad6c46)
- [Tether・Bitfinexとの和解（New York Attorney General）](https://ag.ny.gov/press-release/2021/attorney-general-james-ends-virtual-currency-trading-platform-bitfinexs-illegal)
- [Tetherに対する制裁命令（CFTC）](https://www.cftc.gov/PressRoom/PressReleases/8450-21)
- [PaxosのAML不備に関する和解（NYDFS）](https://www.dfs.ny.gov/reports_and_publications/press_releases/pr20250806)

### 日本・アジアの制度

- [電子決済手段等取引業者の登録一覧（金融庁）](https://www.fsa.go.jp/en/regulated/licensed/denshikessaisyudan.pdf)
- [電子決済手段とトラベルルールに関する案内（金融庁）](https://www.fsa.go.jp/en/news/2026/20260501/20260501.html)
- [ステーブルコイン制度に関する講演（日本銀行）](https://www.boj.or.jp/en/about/press/koen_2026/ko260516a.htm)
- [香港のステーブルコイン発行者規制（HKMA）](https://www.hkma.gov.hk/eng/key-functions/international-financial-centre/stablecoin-issuers/)
- [香港初のステーブルコイン発行者ライセンス（HKMA）](https://www.hkma.gov.hk/eng/news-and-media/press-releases/2026/04/20260410-4/)
- [シンガポールのDigital Token Service Provider規制（MAS）](https://www.mas.gov.sg/news/media-releases/2025/mas-clarifies-regulatory-regime-for-digital-token-service-providers)
- [シンガポールPayment Services Act（MAS）](https://www.mas.gov.sg/regulation/acts/payment-services-act)

### 国際機関のリスク分析

- [Understanding Stablecoins（IMF）](https://www.imf.org/-/media/files/publications/dp/2025/english/usea.pdf)
- [Stablecoins and Global Finance（IMF）](https://www.imf.org/en/blogs/articles/2025/12/04/how-stablecoins-can-improve-payments-and-global-finance)
- [Anchoring trust in money: innovation beyond stablecoins（BIS）](https://www.bis.org/publ/arpdf/ar2026e3.htm)
- [Stablecoins: framing the debate（BIS）](https://www.bis.org/speeches/sp260420.pdf)
- [Considerations for the use of stablecoin arrangements（BIS CPMI）](https://www.bis.org/cpmi/publ/d220.pdf)
