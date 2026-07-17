---
title: USDC総合分析｜準備資産・規制・流動性・機関投資家評価
description: USDCの発行体、ガバナンス、準備資産、月次アテステーション、市場流動性、各国規制、競争環境、リスクと機関投資家向けデューデリジェンスを総合分析します。
date: 2026-07-16
updated: 2026-07-17
author: 国内暗号資産取引所ナビ
slug: usdc
path: /articles/usdc
articleType: market
marketTicker: USDC
category: ステーブルコイン
tags: USDC, Circle, ステーブルコイン, 準備資産, BlackRock, Deloitte, MiCA, GENIUS Act, CCTP, 機関投資家
readMinutes: 20
---

> **重要：本記事は情報提供のみを目的としており、特定の暗号資産の売買・保有を勧誘または推奨する投資助言ではありません。** 掲載する評価、シナリオ、価格レンジ、運用例は調査時点の分析上の仮定であり、将来の成果を保証しません。暗号資産は価格変動・流動性・技術・規制等のリスクを伴います。実際の取引判断は、最新の公式情報を確認し、ご自身の状況に応じて行ってください。

## エグゼクティブサマリー

USDCは、Circleが発行する米ドル連動型ステーブルコインであり、2026年7月時点でもなお、規制面・透明性・機関投資家適合性の観点で最上位グループに属するプロダクトである。Circleの公式サイトでは、USDCの流通残高は2026年7月13日時点で約730億ドル、ネイティブ発行チェーンは35本、準備資産の大半はBlackRockが運用するCircle Reserve Fund（USDXX、SEC登録の2a-7政府MMF）に投資されていると開示している。市場データ上もUSDCの時価総額は約731億ドルで、総ステーブルコイン市場約3,102億ドルのうち約23.6%を占め、USDTに次ぐ第2位の規模である。

制度面では、USDCは2023年のCentre Consortium解消後、発行・ガバナンス・スマートコントラクト鍵管理がCircleに集約された。米国では2025年のSECスタッフ声明が、一定要件を満たす「Covered Stablecoins」は証券に該当しないとの見解を示し、同年にはGENIUS Actが成立して連邦レベルの枠組みが整備された。EUではCircle FranceがACPRの電子マネー機関ライセンスを取得し、USDCはMiCA準拠のEMTとして発行されている。日本では、SBI VCトレードが電子決済手段等取引業者の登録を完了し、USDCの取扱いが始まっている。

本稿の結論は明確である。USDCは、**「最大の流動性」ではUSDTに劣後する一方、** **「透明性・制度整合性・機関投資家向け説明可能性」では依然として優位性が高い。** 特に、月次の第三者アテステーション、BlackRock/BNY Mellonを軸とする準備資産運用・保管体制、EU MiCA対応、日本での制度上の受け皿、そしてVisa等の決済接続は、USDCを単なる暗号資産取引の待避通貨から、**決済・財務・クロスボーダー資金移動のインフラ** に押し上げている。

ただし、USDCは「無リスク資産」ではない。2023年3月のSilicon Valley Bank破綻時には、Circleが33億ドルをSVBに保有していたことが判明し、USDCは一時的に0.8776ドルまで下落した。加えて、USDCはスマートコントラクト上でブラックリスト機能を持ち、法令・制裁・当局命令に基づく凍結可能性が常に存在する。したがって、本レポートではUSDCを**規制順守を前提とするデジタル・ドル** と位置付け、完全な検閲耐性を持つ商品とは区別して評価する。

## 調査前提と評価軸

本レポートは、**2026年7月16日（日本時間）時点で取得可能な最新公表情報** に基づき作成した。準備資産・発行体・監査・法規制についてはCircle、BlackRock、SEC、White House、ESMA、FATF、金融庁、SBI VCトレードなどの一次資料を優先し、市場規模・取引量・取引所流動性については、Circleが自ら総合市場データを統合開示していないため、CoinGeckoおよびDefiLlamaの最新値を補完的に用いた。Circleの現時点の流通残高は2026年7月13日付スナップショットで約730億ドル、BlackRockのCircle Reserve Fundの公開データは2026年7月15日付で更新されている。

また、本稿でいう「市場価値」「時価総額」は、USDCが概ね1ドル近辺で推移する設計であることから、**流通残高とほぼ同義** として扱う場面がある。厳密には、アテステーション上の「USDC in Circulation」は、承認チェーン上の総供給から、未発行トークン、アクセス拒否トークン、保留中バーン残高などを差し引いた概念であり、単純なオンチェーン総供給とは一致しない。これはUSDCの制度設計と会計設計を理解するうえで重要な点である。

さらに、取引所「フロー」については、Circleが公式に取引所別純流入・純流出を開示していないため、本稿では**主要取引所・主要ペアの24時間出来高と板厚** を、機関投資家向け実務で使える流動性代理指標として採用した。これは厳密なオンチェーン・ネットフロー分析ではないが、執行可能性と流動性集中度を見るうえでは有用である。

## 発行体・ガバナンス・技術設計

USDCは2018年にCircleとCoinbaseが設立したCentre Consortiumのもとで立ち上がったが、2023年8月にCentreは解消され、以後はCircleがUSDCの発行主体・準備資産ガバナンス・スマートコントラクト運営責任を一元的に負う体制へ移行した。CircleとCoinbaseの共同声明では、規制の明確化を背景に独立したガバナンス主体が不要になったこと、そしてCircleがスマートコントラクト鍵を含む統治責任を直接保有することが明示されている。

法的発行主体としては、2026年のUSDC Examination Report上、**Circle Internet Financial, LLC** と **Circle Internet Financial Europe SAS** がUSDCの発行・償還主体として記載されている。これは、米国向けとEU向けの規制適合の受け皿が分かれていることを示しており、単一の民間トークンでありながら、法域ごとに異なる発行・償還ルートを持つ点がUSDCの制度的特徴である。

技術面では、USDCはもともとEthereum上のERC-20として始まったが、現在はマルチチェーン化が進み、Circle公式サイトでは2026年7月時点で**35のネイティブ発行ネットワーク** をサポートしている。FAQでは2026年5月13日時点で34ネットワークが列挙され、Algorand、Aptos、Arbitrum、Avalanche、Base、Ethereum、Solana、Stellar、Sui、XRP Ledger、ZKsyncなどが含まれている。さらにCircleは、CCTPを通じて一部チェーン間で**ブリッジ依存ではないburn-and-mint型のクロスチェーン移転** を提供している。

発行・償還メカニズムは比較的シンプルである。Circle Mintの対象となる適格法人がUSDを入金すると、Circleが同額のUSDCを発行する。逆にUSDCをCircleへ差し戻して償還請求すると、そのUSDCはバーンされ、同額のUSDが送金される。Circleはこれを明確に説明しており、USDCの信用の源泉は二次市場の価格ではなく、**発行体による1対1償還の実行可能性** にある。

<div class="article-mermaid">
<pre class="mermaid">flowchart LR
    A[機関投資家がUSD入金] --> B[Circle Mint]
    B --> C[USDC発行]
    C --> D[オンチェーン流通]
    D --> E[送金・決済・DeFi利用]
    E --> F[償還申請]
    F --> G[USDCバーン]
    G --> H[USD返金]
    D --> I[CCTP]
    I --> J[他チェーンで再発行]
</pre>
</div>

この設計は、ブロックチェーン上では公開性を確保しつつ、発行・償還は許可制の法定通貨ゲートウェイに結び付けるという、**「公開ネットワーク + 許可制償還」** のハイブリッド構造である。

一方で、USDCは完全に中立的なベアラートークンではない。CircleのEVM向けスマートコントラクト・リポジトリには、ブラックリスト機能が存在することが明記されており、MiCA向けホワイトペーパーでも、EVM系ではアップグレーダブルなUUPS proxyを採用しつつ、標準的なERC-20挙動を維持すると説明されている。さらに利用規約では、Circleは特定アドレスをブロックし、凍結する権利を保持している。これはAML/CFT・制裁対応上は制度的強みだが、暗号資産本来の无許可・検閲耐性を求める利用者にとっては明確な制約である。

## 準備資産・カストディ・アテステーション分析

CircleはUSDCを、**「100% backed by highly liquid cash and cash-equivalent assets」** と位置付けている。より具体的には、準備資産の大半はBlackRockが運用するCircle Reserve Fund（USDXX）に投資されており、このファンドはSEC登録のRule 2a-7政府MMFである。Circleはまた、同基金のポートフォリオがBlackRockを通じて日次公開されること、そして基金保管はBNY Mellonが担うことを明示している。

BlackRockの公開ページをみると、Circle Reserve Fundは2026年7月15日時点で**純資産約620億ドル**、7-Day SEC Yieldは**3.53%**、WAM/WALはいずれも**7日**、日次・週次流動資産比率はいずれも**100%** と表示されている。これは、USDC準備資産のコア部分が、極めて短期の米国政府関連資産と日次流動性に置かれていることを示す。他方でBlackRock自身も、このファンドは銀行預金ではなく、FDIC等による保証対象ではないと明記している。

アテステーションについては、CircleのUSDCページが「Big Four accounting firm」による月次準備金アテステーションを明示し、同ページのFAQでは、**Deloitte & Touche LLPがCircleの独立監査人であり、2022年度以降の財務諸表監査を担当している** としている。以前の監査人はGrant Thornton LLPであった。重要なのは、USDC関連の月次レポートは「audit」ではなく、AICPA基準に基づく**examination** だという点である。Deloitteは各報告日において、「Fair Value of Assets Held in USDC Reserve is equal to or greater than USDC in Circulation」との経営者主張が、重要な点で公正に表示されていると意見表明している。

### 月次アテステーション比較

| 公表日 | 対象日 | USDC流通残高 | 準備資産公正価値 | 超過担保額 | 会計事務所 | 結論 |
|---|---:|---:|---:|---:|---|---|
| 2026-03-27 | 2026-02-27 | 75,109,039,300 | 75,176,561,300 | 67,522,000 | Deloitte | 準備資産 ≥ 流通残高 |
| 2026-04-29 | 2026-03-31 | 77,049,290,538 | 77,125,330,954 | 76,040,416 | Deloitte | 準備資産 ≥ 流通残高 |
| 2026-05-28 | 2026-04-30 | 77,047,590,794 | 77,123,668,726 | 76,077,932 | Deloitte | 準備資産 ≥ 流通残高 |
| 2026-06-29 | 2026-05-29 | 75,885,403,148 | 75,961,621,872 | 76,218,724 | Deloitte | 準備資産 ≥ 流通残高 |

表注: 数値は各月次USDC Examination Reportの報告対象日ベース。いずれもAICPA基準によるexamination。

この表から読み取れるのは、少なくとも2026年2月末から5月末までに確認できる範囲では、USDCは毎月、**小幅ながら一貫して超過担保** で維持されていたという点である。ただし、この超過幅は数千万ドル規模であり、総残高比ではごく薄い。したがって、価値安定性の本質は「厚い自己資本バッファ」ではなく、**準備資産の流動性、償還オペレーション、そして市場の信認維持** に依存している。

2026年5月29日時点の準備資産内訳をみると、Circle Reserve Fundが**651.7億ドル**、その他の規制金融機関保管現金が**107.9億ドル**であり、準備資産全体の約85.8%が基金、約14.2%が分別管理現金という構成だった。さらに基金内部では、米国債が約220.6億ドル、米国債レポが約451.7億ドル、基金内現金が約10.0億ドルで、これに決済タイミング差異が調整されている。

<div class="article-mermaid">
<pre class="mermaid">pie showData
    title 2026-05-29時点のUSDC準備資産構成
    "Circle Reserve Fund" : 65.17
    "分別管理の銀行現金" : 10.79
</pre>
</div>

この構成は、2023年のSVBショック以前の「複数銀行への現金分散」モデルよりも、**政府MMF + 大手資産運用 + 大手カストディ** へと軸足を移した後の完成形に近い。CircleはSVBショック後、USDC準備のうち77%が短期米国債、23%が現金であり、現金の主たる保管先をBNY Mellonに移したと説明している。制度設計としては、信用リスクを分散するというより、**信用の見える化と流動性の一元化** を強めた格好である。

## 市場データ・流動性・ユースケース

USDCの市場規模は、2026年7月時点で再び強い回復局面にある。Circle公式値では2026年7月13日時点のUSDC流通残高は**730億ドル**、CoinGeckoでは市場時価総額**約730.8億ドル**、24時間出来高**約118億ドル**、DefiLlamaではUSDC残高**731.6億ドル**、総ステーブルコイン市場**3,102.5億ドル** とされる。これを基にすると、USDCの市場シェアはおおむね**23%台半ば**である。

2025年以降の回復も顕著である。CoinDeskは2025年2月、USDCの市場規模が**560億ドル超** に達し、2022年ピークを更新したと報じた。さらにCircleのS-1/Aでは、2024年末の預り金は前年比80.1%増、2025年3月末にはさらに37.2%増と説明されている。足元の730億ドルという水準は、USDCが2023年のSVB後退局面をほぼ乗り越え、制度整備と決済ユースケース拡大を追い風に、成長軌道へ戻ったことを示す。

<div class="article-mermaid">
<pre class="mermaid">xychart-beta
    title "USDC流通残高の推移 主要公式スナップショット"
    x-axis ["2026-02-27","2026-03-31","2026-04-30","2026-05-29","2026-07-13"]
    y-axis "USD bn" 65 --> 80
    line [75.11, 77.05, 77.05, 75.89, 73.00]
</pre>
</div>

上図は、月次アテステーションとCircle公式開示に基づく代表的スナップショットである。5月末から7月中旬にかけて残高はやや低下しているが、これはステーブルコイン市場全体でも30日ベースで小幅調整が出ている局面と整合的であり、構造的な崩れを示すものではない。

チェーン別分布では、DefiLlama上、Ethereumが**468.2億ドル**、Solanaが**69.2億ドル**、Hyperliquid L1が**60.7億ドル**、Baseが**42.8億ドル**、Arbitrumが**22.9億ドル** となっている。上位5チェーンで全体の約91%を占めており、USDCは事実上、**Ethereum系エコシステム + 高速L1/L2 + 取引主導チェーン** に供給が集中している。これはUSDCの主要ユースケースが、依然としてDeFi、取引所流動性、オンチェーン決済に深く結び付いていることを示唆する。

<div class="article-mermaid">
<pre class="mermaid">xychart-beta
    title "USDCチェーン別供給 2026-07時点 上位5"
    x-axis ["Ethereum","Solana","Hyperliquid","Base","Arbitrum"]
    y-axis "USD bn" 0 --> 50
    bar [46.818, 6.922, 6.066, 4.279, 2.290]
</pre>
</div>

取引所流動性も依然として厚い。CoinGeckoはUSDC価格算出に**402取引所・7,494市場** を使用している。主要ペアでは、BinanceのUSDC/USDTが24時間出来高**約17.1億ドル**、+2%深さ**約3,621万ドル / 6,875万ドル**、Coinbase InternationalのBTC/USDCが**約3.73億ドル**、BinanceのBTC/USDCが**約3.46億ドル**、BullishのBTC/USDCが**約3.40億ドル**、Bybit EUのETH/USDCが**約3.30億ドル** である。これは、USDCが依然として**暗号資産市場の主要クオート通貨の一つ** であることを示している。

<div class="article-mermaid">
<pre class="mermaid">xychart-beta
    title "主要取引所・主要ペアのUSDC出来高 24時間代理指標"
    x-axis ["Binance USDC/USDT","Coinbase Int BTC/USDC","Binance BTC/USDC","Bullish BTC/USDC","Bybit EU ETH/USDC"]
    y-axis "USD m" 0 --> 1800
    bar [1709, 373, 346, 340, 330]
</pre>
</div>

ユースケースは大きく四つに整理できる。第一に**決済**。Visaは2025年12月、米国内で発行体・アクワイアラがCircleのUSDCでVisaネットワークとの清算を行える体制を開始した。第二に**クロスボーダー送金**。Citiは、SMB向け国際B2B送金が安定コイン最大の実需機会の一つだと評価している。第三に**企業財務・流動性管理**。Circle Mintは機関顧客向けに24時間の発行・償還と配布機能を提供し、Kyribaとの提携ではUSDC残高を従来キャッシュと並べて可視化できる。第四に**DeFi/オンチェーン市場** であり、前述のチェーン分布がその実需を裏付ける。

## 規制・法的リスク・オペレーショナルリスク

米国では、USDCを取り巻く制度環境は2025年に大きく前進した。SEC企業金融部門の2025年4月4日声明は、低リスクで高流動性の準備資産により1対1償還が可能な「Covered Stablecoins」について、当該声明で記述された態様での募集・販売は証券規制の対象ではないとの見解を示した。さらにWhite Houseは2025年7月18日、GENIUS Act署名を公表し、流動資産による裏付けや月次開示など、連邦レベルの支払型ステーブルコイン枠組みを整備した。Circle自身もNYDFSのBitLicenseおよび送金業ライセンスを保有し、2026年7月にはOCCから米国ナショナル・トラスト・バンク設立の最終承認を得た。

EUでは、MiCAが暗号資産の統一市場ルールを設定し、ステーブルコインについてはEMTやARTに特有の規制を課している。Circleは2024年7月、フランスACPRの電子マネー機関ライセンス取得を公表し、USDCとEURCをEU域内でMiCA準拠発行している。ESMAもMiCAが透明性、開示、認可、監督の統一ルールを設けると整理している。他方で、EUと非EUの発行体が同一名称・同一機能のトークンをどこまで代替可能とみなすか、投資家保護・償還保護をどう解釈するかについては、2025年に欧州委員会が追加検討を進めた。したがって、USDCのEU展開は前進しているが、**法的ファンジビリティと償還優先順位** は今後も重要論点である。

日本では、金融庁が「デジタルマネー型ステーブルコイン」は原則として銀行・資金移動業者・信託会社が発行し、海外発行体についても国内と同等の利用者保護を求める方針を示してきた。実務面では、SBI VCトレードが2025年3月4日に電子決済手段等取引業者の登録を完了し、日本で初めてUSDCを取り扱える体制となった。金融庁の開示資料は、電子決済手段は法定通貨そのものではなく、利用者は登録業者を通じて利用する必要があることも明示している。加えてFSAは、安定コインを含む電子決済手段についてもトラベルルールを適用している。つまり日本でのUSDCは、**制度上は合法かつ利用可能だが、流通経路は強く規制された許可制チャネル** に依存する。

FATFの観点では、安定コインは利便性と同時にAML/CFT上の重点監督対象でもある。FATFの2026年報告は、2025年半ば時点で250超のステーブルコインが存在し、市場規模が3,000億ドルを超え、違法取引に占める比率でも安定コインの比重が高まっていると指摘する。また2025年6月の更新では、大量普及がマネロン・テロ資金供与・拡散金融リスクを増幅し得るとした。USDCのようなコンプライアンス重視型ステーブルコインにとって、これは規制負担でもある一方、**許可制・凍結可能・追跡可能** という設計が制度上の競争優位にもなる。

### 法域比較

| 法域 | 現状認識 | USDCへの含意 | 主な残存リスク |
|---|---|---|---|
| 米国 | GENIUS Act成立、SECは一定の「Covered Stablecoins」を証券外と整理、Circleは州ライセンスに加えOCC信託銀行承認 | 連邦制度整合性が大幅改善。銀行・決済ネットワーク接続余地が拡大 | 実施細則、AML/制裁対応、準備資産監督、非銀行発行体の将来要件 |
| EU | MiCAのEMT規制下でCircle FranceがACPRライセンス取得、USDC/EURCを域内発行 | 域内募集・流通の法的正統性が高い | EU版/非EU版USDCの扱い、償還保護の解釈、監督運用差 |
| 日本 | 電子決済手段の制度整備、登録EPIESP経由でUSDC取扱いが開始 | 国内利用の法的ルートが確立 | チャネル制限、トラベルルール、国内資産保持命令等の運用 |

表注: 米国はSEC・White House・Circle・Reuters、EUはCircle・ESMA・Reuters、日本はFSA・SBI VCトレードに基づく。

### 主要リスク評価

| リスク類型 | 評価 | 論点 |
|---|---|---|
| 準備資産・カストディ | 中位 | 資産自体は短期米国債・米国債レポ中心で高流動性だが、BlackRock基金とBNY Mellon等への集中が残る |
| 銀行・償還オペレーション | 中位 | 2023年SVB事案で示されたように、銀行アクセス遮断時には一時的価格乖離が起こり得る |
| 規制・コンプライアンス | 中位 | 規制順守は強みだが、凍結・遮断・法域別規制差異が利用可能性を左右する |
| 技術・スマートコントラクト | 中位 | アップグレーダブル、ブラックリスト機能あり。重大脆弱性があれば影響は大きい |
| 市場流動性 | 低位〜中位 | CEX/DEXともに厚いが、極端な市場不安時にはMMF類似のラン・ダイナミクスが理論上ありうる |
| 収益モデル依存 | 中位〜高位 | Circleの収益は準備資産利回りに敏感で、金利低下はマージン圧迫要因 |
| 配布パートナー依存 | 中位 | Coinbase等の分配チャネル変化はCircleの分配コスト・収益配分に直結 |

表注: リスク評価は本レポートの分析判断。基礎事実はCircle S-1/A、NY Fed、Circle/BlackRock資料等に基づく。

USDCの歴史的ストレス事象を整理すると、最大の試練はやはり2023年3月のSVB事案である。CircleはUSDC準備のうち33億ドルがSVBに滞留していると開示し、USDCは一時的に大きくディペッグした。FRB系研究でも、この開示が大量償還を誘発したと整理されている。その後、Circleは現金保管をBNY Mellon中心へ再編し、準備資産の透明性と即時流動性を一段と強めた。したがって、USDCの最大の教訓は「準備資産の質」だけでなく、**準備資産への即時アクセス能力** がペッグ維持に決定的である、という点にある。

その後のオペレーショナル事案としては、2024年2月にCircleがTRONでの新規発行を停止し、2025年2月までの移行期間を設けて段階的にサポートを終了したことが挙げられる。MiCA向けホワイトペーパーでは、TRONに加えFLOWも既に廃止済みチェーンとして記載されている。これは、USDCが「マルチチェーンであること」よりも「規制・リスク管理上適切なチェーンにのみ残ること」を優先する設計思想を持つことを示す。

## 競争環境・見通し・デューデリジェンス

競争環境を見ると、USDCの明確な優位は**透明性・制度適合性・発行体説明可能性** にあり、弱みは**市場シェアでUSDTに大きく劣後すること**、そして**非利回り型の基本設計が、流通パートナーへ利回りを還元する新型ステーブルコインに対し不利になりうること** である。実際、2026年にはMizuhoが、Open USDのようなパススルー型の新規プレイヤーがCircleの収益モデルを脅かすと評価している。

### 主要ステーブルコイン比較

| トークン | 発行体 | 基本モデル | 透明性・保証頻度 | 最新時価総額の目安 | コメント |
|---|---|---|---|---:|---|
| USDC | Circle | 法定通貨担保、政府MMF+現金 | 月次examination、BlackRockで日次ポートフォリオ開示 | 約731億ドル | 規制・透明性で最有力 |
| USDT | Tether | 法定通貨担保中心だが資産構成の幅が広い | 四半期準備報告、日次流通量開示 | 約1,842億ドル | 最大規模・最大流動性 |
| DAI | MakerDAO / Sky系 | 過剰担保型、オンチェーン担保 | オンチェーン透明性中心 | 約48.7億ドル | 分散性は高いが構造が異なる |
| PYUSD | PayPal / Paxos | 法定通貨担保、決済特化 | 公式説明上、1:1償還・ドル準備 | 約28.6億ドル | PayPal系決済導線が強み |
| RLUSD | Ripple | 法定通貨担保 | 月次第三者報告 | 約15.2億ドル | Ripple決済網との親和性 |
| BUSD | Paxos | 法定通貨担保 | 2023年に新規発行停止後、報告は縮小 | 約0.38億ドル | 実質的にウィンドダウン案件 |
| GUSD | Gemini | 法定通貨担保 | 月次BPM LLPアテステーション | 約1.5億ドル | NYDFS系の高規制だが縮小 |

表注: USDCはCircle/DefiLlama、USDTはTether/DefiLlama、DAIはMakerDAO/DefiLlama、PYUSDはPayPal・Paxos・CoinGecko/CMC、RLUSDはRipple/CMC、BUSDはPaxos・NYDFS・CoinGecko、GUSDはGemini・CMCに基づく。

マクロ面では、USDCを含むドル建てステーブルコインは、単なる暗号資産ではなく、短期米国債市場と銀行預金構造に影響を及ぼし始めている。BISの2026年ペーパーは、ドル建てステーブルコインへの流入が3か月物T-bill利回りを押し下げる効果を持つと示している。NY Fedは、ステーブルコインがMMFに似た「money-like asset」であり、ストレス時のランに脆弱と整理する。IMFは、安定コイン普及が通貨代替や資本フロー変動を通じてマクロ金融安定に影響し得るとし、ECBの研究は外貨依存が金融主権を弱めうると指摘する。したがってUSDCの成長は、企業財務の効率化と同時に、**米国短期国債需要の増加、銀行預金代替、ドル化の加速** という政策的含意を持つ。

### デューデリジェンス・チェックリスト

| 確認項目 | 何を見るか | 確認資料の例 |
|---|---|---|
| 発行主体 | どの法人が発行・償還責任を負うか | USDC Terms、Examination Report、MiCA white paper |
| 償還経路 | 自社がCircle Mint直結か、仲介経由か | 口座契約、KYC/AML手順、償還SLA |
| 準備資産 | 米国債、レポ、現金の内訳と変化 | 月次Examination Report、BlackRock USDXX |
| カストディ集中 | BNY/基金/銀行への依存度 | BlackRock fund data、当局開示 |
| 会計保証の質 | auditかattestationか、対象日か継続監査か | Deloitte opinion文言 |
| オンチェーン統制 | ブラックリスト、アップグレード権限、管理鍵 | smart-contract repo、ガバナンス開示 |
| 法域適合性 | 自社の事業法域での保有・送金可否 | 外部法律意見、FSA/ESMA/SEC資料 |
| 取引所流動性 | 執行市場の厚み、板深、カウンターパーティ分散 | CoinGecko depth/venue data、社内TCA |
| 事業継続性 | 銀行障害・チェーン停止・サポート終了時対応 | BCP、チェーン移行手順、停止条項 |
| パートナー依存 | Coinbase等の分配契約が収益・流動性に与える影響 | Circle S-1/A、商流レビュー |

表注: 項目設計は本レポートによる分析例。基礎資料はCircle、BlackRock、各国規制当局資料による。

### 先行きシナリオ

以下のシナリオ確率は、**2026年7月時点の主観的な分析推計** であり、統計モデル出力ではない。もっとも重要なドライバーは、規制整備の進展、銀行・カードネットワーク接続、金利水準、競合のインセンティブ設計、そしてリスク事象の有無である。

| シナリオ | 概要 | 主観確率 | 想定トリガー |
|---|---|---:|---|
| ブル | USDCが決済・財務・証券トークン化の共通資金レールとして採用拡大。流通残高は中期的に1,000億ドル超へ | 25% | 米国銀行接続の拡大、Visa等の本格商用化、EU/Japanでの制度利用拡大、RWA/証券トークン化加速 |
| ベース | USDCは第2位を維持しつつ80〜950億ドル帯へ漸進成長。金利低下による利鞘縮小は流通増で一部吸収 | 55% | GENIUS/MiCA後の安定運用、緩やかな利下げ、DeFiと実需決済の併存 |
| ベア | 新型競合や規制・信用イベントで成長停滞。流通残高は600億ドル前後まで後退する可能性 | 20% | 銀行・カストディ障害、再度のディペッグ、凍結・ブラックリスト論争、Open USD型競合の急伸 |

これを投資・財務実務へ落とし込むと、USDCは**「現時点で最も説明しやすい民間デジタル・ドル」** という位置づけを持つ。現金同等物そのものではないが、暗号資産市場の待避通貨以上の役割を担えるだけの制度的裏付けを獲得しつつある。他方で、USDCの安全性は中央銀行マネーではなく、**Circleのオペレーション、BlackRock／BNYの基盤、当局との整合、そして市場の償還信認** により支えられている。この分析では、USDCを「現金の代替」ではなく、**流動性管理されたデジタル決済レール** として区別して評価する。

## 主要情報源と参考文献

本レポートは、Circleの公式開示、準備資産・アテステーション資料、各国規制当局資料、市場・オンチェーンデータを横断して作成しています。市場規模や流動性は変動するため、リンク先の最新値とあわせて確認してください。

### Circle・準備資産・技術

- [USDC公式ページ（Circle）](https://www.circle.com/usdc)
- [USDCの透明性と準備資産（Circle）](https://www.circle.com/transparency)
- [USDC Reserve Reports（Circle）](https://www.circle.com/usdc-transparency)
- [USDC Terms（Circle）](https://www.circle.com/legal/usdc-terms)
- [Circle Mint](https://www.circle.com/circle-mint)
- [Cross-Chain Transfer Protocol（CCTP）](https://www.circle.com/cross-chain-transfer-protocol)
- [USDC対応ネットワーク（Circle Developers）](https://developers.circle.com/stablecoins/usdc-contract-addresses)
- [USDCスマートコントラクト（Circle GitHub）](https://github.com/circlefin/stablecoin-evm)
- [Circle Reserve Fund（BlackRock）](https://www.blackrock.com/cash/en-us/products/329365/circle-reserve-fund)
- [Centre Consortium解消に関するCircleとCoinbaseの発表](https://www.circle.com/blog/centre-consortium-announces-transition-to-circle-and-coinbase)

### 市場・オンチェーン・決済

- [USDC市場データ（CoinGecko）](https://www.coingecko.com/en/coins/usdc)
- [USDCチェーン別データ（DefiLlama）](https://defillama.com/stablecoin/usd-coin)
- [ステーブルコイン市場全体（DefiLlama）](https://defillama.com/stablecoins)
- [Visaのステーブルコイン決済](https://usa.visa.com/about-visa/newsroom/press-releases.releaseId.21121.html)
- [KyribaとCircleの提携](https://www.circle.com/pressroom/kyriba-and-circle-partner-to-bring-usdc-to-enterprise-treasury-management)

### 米国・欧州・日本の制度

- [Covered Stablecoinsに関するスタッフ声明（SEC）](https://www.sec.gov/newsroom/speeches-statements/statement-stablecoins-040425)
- [GENIUS Act署名に関するファクトシート（White House）](https://www.whitehouse.gov/fact-sheets/2025/07/fact-sheet-president-donald-j-trump-signs-genius-act-into-law/)
- [MiCA概要（ESMA）](https://www.esma.europa.eu/esmas-activities/digital-finance-and-innovation/markets-crypto-assets-regulation-mica)
- [CircleのMiCA対応発表](https://www.circle.com/pressroom/circle-is-first-global-stablecoin-issuer-to-comply-with-mica)
- [電子決済手段等取引業者の登録一覧（金融庁）](https://www.fsa.go.jp/menkyo/menkyoj/denshikessaisyudan.pdf)
- [USDC取扱開始（SBI VCトレード）](https://www.sbivc.co.jp/newsview/7k7i8wnm5)
- [暗号資産・ステーブルコインに関するFATF資料](https://www.fatf-gafi.org/en/topics/virtual-assets.html)

### リスク・マクロ金融

- [SVB破綻時のUSDC準備資産に関するCircle発表](https://www.circle.com/blog/an-update-on-usdc-and-silicon-valley-bank)
- [ステーブルコインの金融安定リスク（Federal Reserve Bank of New York）](https://www.newyorkfed.org/research/staff_reports/sr1073)
- [ステーブルコインと国債市場（BIS）](https://www.bis.org/publ/work1270.htm)
- [Understanding Stablecoins（IMF）](https://www.imf.org/-/media/files/publications/dp/2025/english/usea.pdf)
