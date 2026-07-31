---
title: USD1総合分析｜発行体・準備金・償還・マルチチェーン・規制リスク
description: World Liberty Financial USD（USD1）の発行・償還主体、BitGo、準備資産、月次アテステーション、マルチチェーン構成、管理権限、流通、米国・EU・日本の規制、主要リスクを総合分析します。
date: 2026-07-28
updated: 2026-07-28
author: 国内暗号資産取引所ナビ
slug: usd1
path: /articles/usd1
articleType: market
marketTicker: USD1
marketInstrumentId: NONE
category: ステーブルコイン・決済
tags: USD1, World Liberty Financial, WLFI, BitGo, ステーブルコイン, 準備金, アテステーション, GENIUS Act, 電子決済手段
readMinutes: 27
---

<aside class="article-callout article-callout--warning" role="note" aria-label="重要な免責事項">
  <span class="article-callout__icon" aria-hidden="true">!</span>
  <div>
    <strong>重要：本記事は情報提供のみを目的としており、特定の暗号資産の売買・保有を勧誘または推奨する投資助言ではありません。</strong>
    <p>掲載する評価、市場データ、利用例は調査時点の分析上の情報であり、将来の成果を保証しません。USD1は1米ドルでの償還を設計目標としますが、二次市場価格、即時償還、流動性、元本、利回りを保証するものではありません。発行体、準備資産、銀行、スマートコントラクト、対応チェーン、規制、保管、取引所等のリスクがあり、元本の全部を失う可能性があります。実際の利用・取引にあたっては最新の公式情報をご確認ください。本稿の時点データは、原則として2026年7月28日JST時点で確認できた公開情報に基づきます。</p>
  </div>
</aside>

## エグゼクティブサマリー

World Liberty Financial USD（USD1）は、1 USD1を1米ドルで交換できることを目標とする、法定通貨準備型のステーブルコインです。World Liberty Financial（WLF）がブランドと関連サービスを担う一方、2026年5月の最新月次準備金報告では、BitGo Bank & Trust, N.A.がUSD1の発行・償還主体と記載されています。「WLFが準備金を直接保管し、単独で発行するトークン」という説明では、現在の役割分担を正確に表せません。

USD1は2025年3月25日に発表され、当初はEthereumとBNB Smart Chainで展開されました。2026年5月31日の準備金報告では、Ethereum、BNB Smart Chain、Tron、Solana、Aptos、Tempoの6ネットワークでネイティブ発行・償還されると記載されています。ブリッジ版や同名トークンを含め、ネットワーク名だけで正規資産と判断せず、公式コントラクトアドレスとの照合が必要です。

準備金は推測する必要がありません。Crowe LLPが検証した2026年5月31日時点の報告では、償還可能なUSD1は4,725,094,306枚、償還資産は4,734,684,613米ドルでした。資産内訳は、要求払預金710,202,692米ドルと、米国政府マネーマーケットファンド4,024,481,921米ドルです。償還処理中の9,501,996米ドルを調整した後の超過額は88,311米ドルでした。

この報告は、企業全体の財務諸表監査ではありません。BitGo経営者が作成した特定基準日のUSD1残高・償還資産・比較表について、CroweがAICPA基準に基づき意見を表明する「examination（検証業務）」です。準備金の存在と集計に重要な保証を与えますが、BitGoやWLFの全事業、内部統制、将来の支払能力、基準日後の状態を包括的に保証するものではありません。

直接償還も全保有者が無条件に使えるわけではありません。BitGoの公開規約では、GoAccountのAccountholderだけがBitGoと直接発行・償還でき、本人確認、AML、制裁、利用地域、口座状態、取引上限等の条件が適用されます。二次市場でUSD1を受け取った利用者は、適格なAccountholderにならない限り、BitGoへ直接1米ドル償還を請求できません。取引所やDEXでの売却価格は1米ドルから乖離し得ます。

USD1は銀行預金、法定通貨、MMF持分ではなく、保有者に準備金運用益を分配しません。BitGoの規約は、USD1自体が利息や収益を生まないこと、準備資産の証券に対する物権的持分を保有者が持たないこと、FDIC・SIPC保護の対象ではないことを明記しています。外部サービスが表示する利回りはUSD1固有の機能ではなく、そのサービスの貸借、流動性供給、キャンペーン等に由来します。

供給は単調に増えていません。月末の償還可能残高は、2025年4月末の約21.28億USD1から2026年1月末に約50.67億USD1へ増加した後、2026年5月末は約47.25億USD1でした。増減には発行と償還の両方が含まれます。時価総額順位や24時間出来高は集計時刻とデータ提供者で変わるため、固定的な「世界第何位」という説明は避けます。

価格安定は低リスクと同義ではありません。2026年2月には外部からの攻撃と説明された事象の後、二次市場価格が一時約0.994米ドルへ下がり、短時間で回復したと報じられました。元原稿にある「2026年4月に約20%下落」という数値は、取引所、時刻、出来高、信頼できる価格系列を確認できなかったため採用していません。

米国では2025年7月にGENIUS Actが成立し、決済用ステーブルコインに1対1の適格準備資産、発行者規制、償還、開示、AML・制裁対応等の連邦枠組みが設けられました。WLF系のスポンサーは2026年1月、USD1発行・償還と準備管理を行うWorld Liberty Trust Company, N.A.の設立をOCCへ申請しましたが、2026年7月28日時点でOCCの公開一覧では「pending application（審査中）」です。申請書の提出を認可済みと表現することはできません。

日本では、法定通貨と連動し額面償還を約するステーブルコインは、設計に応じて資金決済法上の「電子決済手段」に該当し、暗号資産とは別の規律を受けます。USD1を一律に「日本法上の暗号資産」と断定するのは不正確です。一方、国内での仲介には登録や取扱い審査が関係し、本稿確認時点でUSD1の国内正規取扱いを確認できません。海外サービスで表示されることと、日本居住者向けに適法に提供されることは同じではありません。

## USD1の基本情報

| 項目 | 内容 | 確認上の注意 |
|---|---|---|
| 名称 | World Liberty Financial USD | 一般的なティッカーはUSD1 |
| 設計目標 | 1 USD1を1米ドルで交換 | 二次市場価格の固定保証ではない |
| 発表 | 2025年3月25日 | 最初の月次報告は2025年4月分 |
| 発行・償還 | 最新準備金報告ではBitGo Bank & Trust, N.A. | 公開規約・関連ページの法人表記も確認 |
| ブランド | World Liberty Financial関連法人 | 発行・準備管理とブランド運営を区別 |
| 準備資産 | 現金、現金同等物、短期米国債、米国債担保リバースレポ、政府MMF等 | 実際の月末構成は報告書で確認 |
| 直接償還 | 適格なGoAccountのAccountholder | KYC、AML、制裁、地域、口座状態等の条件あり |
| 保有者利息 | USD1自体からは発生しない | 外部サービスの利回りは別契約・別リスク |
| 最大供給 | 固定上限なし | 発行・償還で増減 |
| 対応チェーン | ETH、BNB、Tron、Solana、Aptos、Tempo | 2026年5月末報告時点 |
| 管理機能 | 凍結・アップグレード等が規約上存在 | 法令・コンプライアンス・運用判断に依存 |
| 日本での位置付け | 電子決済手段該当性を含む個別判断が必要 | 国内での正規取扱いは未確認 |

USD1は、米ドルそのものをパブリックブロックチェーンへ移したものではありません。オンチェーンのトークン残高と、オフチェーンの準備資産およびBitGoとの契約上の償還権を組み合わせた商品です。この三つの層を分けると、確認すべきリスクが明確になります。

1. トークン層：コントラクト、秘密鍵、対応チェーン、送付
2. 発行・償還層：Accountholder資格、KYC、処理時間、上限、停止
3. 準備資産層：預金、政府MMF、保管金融機関、流動性、法的分別

## 歴史と役割分担

### 2025年の発表と初期発行

WLFは2025年3月25日、USD1を米ドル、短期米国債、その他の現金同等物で100%裏付けるステーブルコインとして発表しました。BitGoは同日付の説明で、USD1のカストディとインフラを担うこと、BitGo Primeが機関向け流動性を支えることを公表しています。

2025年4月の最初の準備金報告では、償還可能残高が4月22日の127,970,980 USD1から、4月30日の2,127,970,380 USD1へ急増しました。4月30日時点では、その大部分がBNB Smart Chain上にありました。報告書は残高とチェーンを確認しますが、個別保有者や取引目的までは証明しません。

2025年5月1日、WLF共同創設者は、アブダビのMGXがBinanceへ行った20億米ドルの出資の決済にUSD1が使われると発表しました。大規模な利用事例である一方、同月の供給増加だけから全保有者や資金の最終帰属を推測することはできません。この取引は、発行集中、相手先集中、政治・利益相反に関する議論も生みました。

### 2026年の拡張

2026年に入ると、月次報告上の対応ネットワークはEthereumとBNB Smart Chainに加え、Tron、Solana、Aptos、Tempoへ拡大しました。WLFは送金、DeFi、資本市場、AIエージェント決済等を用途として掲げています。ただし、公式サイトに掲載された用途、開発中機能、提携先ロゴは、実際の取引量、正式な統合範囲、安全性を自動的に証明するものではありません。

WLFの公式資料は、Donald J. TrumpをCo-Founder Emeritus、Eric Trump、Donald Trump Jr.、Barron Trumpらを共同創設者として表示し、Donald J. TrumpとSteve Witkoffは公職就任時に外れたと注記しています。また、WLF公式サイトは、Donald J. Trumpと一部家族に関係するDT Marks DEFI LLCがWLF Holdcoの持分約38%を保有すると開示しています。この関係は、USD1の技術仕様とは別に、評判、利益相反、規制、政策変更のリスク要因になります。

<section class="usd1-timeline-card" aria-labelledby="usd1-timeline-title">
  <div class="usd1-visual-heading">
    <span>History</span>
    <h3 id="usd1-timeline-title">USD1の主な経緯</h3>
  </div>
  <ol class="usd1-timeline">
    <li>
      <time datetime="2025-03">2025.03</time>
      <div><strong>USD1を発表</strong><p>BitGoがカストディとインフラ提供を公表。</p></div>
    </li>
    <li>
      <time datetime="2025-04">2025.04</time>
      <div><strong>初回の月次準備金報告</strong><p>月末残高は約21.28億USD1へ拡大。</p></div>
    </li>
    <li>
      <time datetime="2025-05">2025.05</time>
      <div><strong>大規模決済での利用を発表</strong><p>MGXによるBinance出資の決済にUSD1を採用。</p></div>
    </li>
    <li>
      <time datetime="2025-07">2025.07</time>
      <div><strong>GENIUS Act成立</strong><p>米国の決済用ステーブルコイン規制枠組みが成立。</p></div>
    </li>
    <li>
      <time datetime="2026-01">2026.01</time>
      <div><strong>OCCへ申請</strong><p>World Liberty Trust Companyが申請。月末残高は約50.67億USD1。</p></div>
    </li>
    <li>
      <time datetime="2026-05">2026.05</time>
      <div><strong>6ネットワークへ拡大</strong><p>月末残高は約47.25億USD1。6チェーンでの発行・償還を報告。</p></div>
    </li>
  </ol>
</section>

### 誰が何を担うのか

| 主体 | 公開資料上の主な役割 | 分けて確認する事項 |
|---|---|---|
| BitGo Bank & Trust / BitGo | 発行・償還、準備管理、口座・技術インフラ、月次報告 | 契約法人、規制資格、準備、償還条件 |
| World Liberty Financial | USD1ブランド、マーケティング、関連サービス、統合 | 所有・収益関係、提携、利益相反、実装状況 |
| Crowe LLP | 特定基準日の管理者主張を検証 | 対象、基準日、保証水準、除外範囲 |
| 銀行・MMF・保管機関 | 現金・現金同等物・政府MMFの保管 | 信用、流動性、名義、分別、障害 |
| ブロックチェーン | USD1トークンの記録・移転 | 手数料、停止、混雑、reorg、コントラクト |
| 取引所・DEX・ブリッジ | 二次流通、交換、チェーン間移動 | 発行体償還とは別の価格・信用・技術リスク |

<div class="article-mermaid">
<pre class="mermaid">flowchart TD
    U[適格Accountholder] -->|米ドルを入金| B[BitGo]
    B -->|USD1を発行| C[対応チェーン]
    C -->|送付・取引| H[一般保有者]
    B -->|分別して管理| R[預金・政府MMF等]
    H -->|二次市場| X[取引所・DEX]
    U -->|USD1を返却| B
    B -->|条件に従い米ドルを支払う| U
    W[World Liberty Financial] -->|ブランド・関連サービス| C
    A[Crowe] -->|基準日の管理者主張を検証| B</pre>
</div>

## 発行・償還の仕組み

### 直接発行

BitGoの公開規約では、GoAccountを持つAccountholderが発行・購入申請を行い、BitGoが受け入れた場合にUSD1が発行されます。Accountholderになる条件、利用可能地域、資金の種類、処理時刻等は、別途適用されるStablecoin Services Agreementに依存します。

USD1の供給は需要に応じて増減し、固定上限はありません。新規発行は「無担保で枚数だけ増やす」ことを意味せず、規約上は営業日末に発行済みUSD1以上の米ドル価値を持つ準備資産を維持するとされています。ただし、その遵守を継続的に確認するには、月次報告とリアルタイムProof of Reservesの更新状態を併せて見る必要があります。

### 直接償還

直接償還は、USD1をBitGoへ返し、条件に従って米ドルを受け取る手続きです。重要な制約は次のとおりです。

- BitGoと直接取引できるのはAccountholder
- 本人確認、AML、制裁、利用地域、口座のGood Standingが必要
- 規制当局、裁判所、法執行機関の命令により制限される場合がある
- BitGoは取引上限を設定できる
- 銀行、決済事業者、ブロックチェーン等の第三者手数料がかかる場合がある
- 交換手数料は取引時に開示され、料金体系は変更され得る
- 急な償還集中や準備資産の流動性低下で、遅延・停止が起こり得る

「1:1で償還可能」は、全ウォレットがいつでもスマートコントラクトへ1 USD1を送れば自動的に1米ドルを受け取れる、という意味ではありません。契約上の適格性とオフチェーン決済が必要です。

### 二次市場

Accountholderでない保有者は、取引所、DEX、相対取引等でUSD1を取得・売却できます。二次市場価格は、買い手と売り手、板の厚み、発行・償還へアクセスできる裁定業者、送金時間、チェーン混雑、取引所信用等で決まります。

BitGoの規約も、第三者プラットフォームでUSD1が常に1米ドルで評価されることを保証しないと明記しています。価格が0.999米ドルでも、大口売却時の平均約定価格、手数料、出金制限を含めれば実現価値は異なります。

## 準備資産と2026年5月報告

### 5月31日時点の実額

2026年5月31日23時59分UTCを基準とする最新公表報告の要点は次のとおりです。

| 項目 | 金額・数量 | 構成・意味 |
|---|---:|---|
| 償還可能USD1 | 4,725,094,306 USD1 | 対象6ネットワークの合計 |
| BitGo Bank & Trust口座の現金等 | 0米ドル | 当該基準日時点 |
| 要求払預金 | 710,202,692米ドル | 償還資産の約15.0% |
| 米国政府MMF | 4,024,481,921米ドル | 償還資産の約85.0%、CUSIP 31607A703 |
| 償還資産合計 | 4,734,684,613米ドル | 償還可能USD1を9,590,307米ドル上回る |
| 未決済の償還 | 9,501,996米ドル | タイミング差異 |
| 調整後の超過額 | 88,311米ドル | 報告書のSurplus |

<figure class="usd1-allocation" aria-labelledby="usd1-reserve-chart-title">
  <figcaption class="usd1-visual-heading">
    <span>Reserve allocation</span>
    <h3 id="usd1-reserve-chart-title">償還資産の構成</h3>
    <p>2026年5月31日時点。合計4,734,684,613米ドル。</p>
  </figcaption>
  <div class="usd1-allocation__body">
    <div class="usd1-donut usd1-donut--reserve" role="img" aria-label="米国政府MMF 85.0%、要求払預金 15.0%">
      <span><strong>85.0%</strong><small>政府MMF</small></span>
    </div>
    <dl class="usd1-allocation__legend">
      <div style="--usd1-share: 85%; --usd1-color: #35c8d2;">
        <dt><span aria-hidden="true"></span>米国政府MMF</dt>
        <dd><strong>85.0%</strong><small>4,024,481,921米ドル</small></dd>
      </div>
      <div style="--usd1-share: 15%; --usd1-color: #f4c95d;">
        <dt><span aria-hidden="true"></span>要求払預金</dt>
        <dd><strong>15.0%</strong><small>710,202,692米ドル</small></dd>
      </div>
    </dl>
  </div>
</figure>

要求払預金は米国商業銀行に置かれ、USD1保有者の利益のための名義と説明されています。ただし、銀行ごとの残高は示されず、預金がFDICの25万米ドル上限を超える場合があることも報告書に記載されています。政府MMFは、現金、現金同等物、短期債務証券を保有し、BitGo Bank & Trustの分別されたqualified trustで管理されると説明されています。

元原稿には「短期米国債50〜70%、預金10〜30%、MMF10〜30%」という推測値がありましたが、公開報告と一致しないため削除しました。2026年5月末の実際の開示は、政府MMFが約85%、要求払預金が約15%です。将来の構成は変わり得るため、固定比率としては扱いません。

### 認められる準備資産

BitGo規約と準備金報告では、規制上の承認や条件に従い、次のような資産が準備に含まれ得るとされています。

- 現金・現金同等物
- FDIC加入銀行口座の現金
- 満期まで3か月以内の米国財務省短期証券
- 米国債で完全担保されたオーバーナイトのリバースレポ
- 米国政府マネーマーケットファンド

「含めることができる資産」と「特定基準日に実際に保有した資産」は別です。月次報告の内訳を使い、商品説明だけから構成を推測しないことが重要です。

### アテステーションと監査の違い

2026年5月報告でCroweが行ったのは、AICPAの2025年「Asset-Backed Fiat-Pegged Tokens」基準に基づく検証業務です。対象は、指定した二つの基準日における次の管理者主張です。

1. 償還可能トークン残高
2. 利用可能な償還資産
3. 両者の比較とタイミング差異

Croweはreasonable assuranceを得る手続きを行い、管理者主張が重要な点で適正に表示されているとの意見を表明しました。一方、これは次を意味しません。

- WLFまたはBitGoグループ全体の財務諸表監査
- すべての日のリアルタイム残高保証
- 将来の償還、価格、利益、破綻回避の保証
- 全保管銀行、MMF、法的権利に関する無条件の保証
- スマートコントラクト、取引所、ブリッジの安全性保証

月次報告のページには2025年4月から2026年5月までの各月分が掲載されています。2026年7月28日時点で、6月分は掲載一覧に見当たりませんでした。公開頻度と実際の掲載タイミングにはずれが生じ得るため、「毎月」という方針だけでなく、最新報告の基準日と公表日を確認します。

## 供給推移とチェーン構成

### 月末残高は増減する

| 基準日 | 償還可能USD1 | 読み方 |
|---|---:|---|
| 2025年4月22日 | 127,970,980 | 初期発行段階 |
| 2025年4月30日 | 2,127,970,380 | 短期間で約20億枚増加 |
| 2025年12月31日 | 3,313,510,170 | 年末時点 |
| 2026年1月31日 | 5,066,501,777 | 公開月末値では5月末より多い |
| 2026年4月30日 | 4,497,235,671 | 発行と償還を反映 |
| 2026年5月31日 | 4,725,094,306 | 最新公表月次報告 |

供給増加は利用拡大を示す一つの指標ですが、利用者数、決済件数、取引高、保有集中、長期保有、取引所内部移動を区別しません。大口一件の発行で供給が大きく増える場合もあるため、供給だけから普及度を判断できません。

### 2026年5月31日のチェーン別残高

| 区分 | 残高 | 構成比 |
|---|---:|---:|
| Ethereum | 1,920,635,389 USD1 | 約40.6% |
| BNB Smart Chain | 1,788,761,516 USD1 | 約37.9% |
| その他4チェーン合計 | 1,015,697,401 USD1 | 約21.5% |
| 合計 | 4,725,094,306 USD1 | 100.0% |

<figure class="usd1-allocation" aria-labelledby="usd1-chain-chart-title">
  <figcaption class="usd1-visual-heading">
    <span>Native supply</span>
    <h3 id="usd1-chain-chart-title">チェーン別の構成比</h3>
    <p>2026年5月31日時点。その他はTron、Solana、Aptos、Tempoの合計。</p>
  </figcaption>
  <div class="usd1-allocation__body">
    <div class="usd1-donut usd1-donut--chains" role="img" aria-label="Ethereum 40.6%、BNB Smart Chain 37.9%、その他4チェーン 21.5%">
      <span><strong>6</strong><small>chains</small></span>
    </div>
    <dl class="usd1-allocation__legend">
      <div style="--usd1-share: 40.6%; --usd1-color: #35c8d2;">
        <dt><span aria-hidden="true"></span>Ethereum</dt>
        <dd><strong>40.6%</strong><small>1,920,635,389 USD1</small></dd>
      </div>
      <div style="--usd1-share: 37.9%; --usd1-color: #9c8cff;">
        <dt><span aria-hidden="true"></span>BNB Smart Chain</dt>
        <dd><strong>37.9%</strong><small>1,788,761,516 USD1</small></dd>
      </div>
      <div style="--usd1-share: 21.5%; --usd1-color: #f4c95d;">
        <dt><span aria-hidden="true"></span>その他4チェーン</dt>
        <dd><strong>21.5%</strong><small>1,015,697,401 USD1</small></dd>
      </div>
    </dl>
  </div>
</figure>

最新報告の「その他」にはTron、Solana、Aptos、Tempoが含まれますが、個別残高は同表で分解されていません。チェーン別データを扱う場合は、各チェーンのネイティブ発行量、ブリッジ保管残高、取引所内部残高を二重計上しないよう注意が必要です。

### 正規コントラクト

2026年5月報告に記載されたアドレスは次のとおりです。

| ネットワーク | 公式報告記載のコントラクト |
|---|---|
| Ethereum | `0x8d0d000ee44948fc98c9b98a4fa4921476f08b0d` |
| BNB Smart Chain | `0x8d0d000ee44948fc98c9b98a4fa4921476f08b0d` |
| Tron | `TPFqcBAaaUMCSVRCqPaQ9QnzKhmuoLR6Rc` |
| Solana | `USD1ttGY1N17NEEHLmELoaybftRBUSErhqYiQzvEmuB` |
| Aptos | `0x05fabd1b12e39967a3c24e91b7b8f67719a6dacee74f3c8b9fb7d93e855437d2` |
| Tempo | `0x20C000000000000000000000111111111E910F0f` |

EthereumとBNB Smart Chainでは同じ16進アドレスが使われますが、チェーン状態は別です。同じ文字列だから同じ残高、同じ取引、同じセキュリティになるわけではありません。

送付前には、ネットワーク、アドレス、トークン小数桁、受取サービスの対応、最低入金量、必要確認数、ブリッジの正規URLを確認します。偽USD1、コピー、ラップ版はBitGoの償還対象でない場合があります。

<div class="article-mermaid">
<pre class="mermaid">flowchart LR
    I[BitGoの発行・償還] --> E[Ethereum]
    I --> B[BNB Smart Chain]
    I --> T[Tron]
    I --> S[Solana]
    I --> A[Aptos]
    I --> P[Tempo]
    E --> M[二次市場・決済]
    B --> M
    T --> M
    S --> M
    A --> M
    P --> M</pre>
</div>

## スマートコントラクトと管理権限

法定準備型ステーブルコインは、誰にも変更できない固定供給トークンとは異なり、米ドルの入出金に合わせた発行・焼却、法令対応、事故対応が必要です。BitGoの規約は、USD1を保有場所にかかわらず凍結・アップグレードする権利、違法行為・制裁・法的命令等に関連するアドレスを制限する権利を明記しています。

### 管理機能の意味

| 機能 | 運用上の目的 | 利用者側のリスク |
|---|---|---|
| Mint / Burn | 入金・償還に合わせて供給を調整 | 発行鍵・手続き・会計への依存 |
| Freeze / Restrict | 制裁、盗難、法執行、規約違反への対応 | 自己管理ウォレットでも移転できない可能性 |
| Upgrade | 不具合修正、機能・法令対応 | 実装変更、新しい脆弱性、権限集中 |
| Chain support decision | Fork時に対応チェーンを選ぶ | 非対応fork上のトークンが償還対象外になる可能性 |

これは「中央管理だから安全」「中央管理だから危険」という二択ではありません。盗難対応や法令遵守に使える一方、誤凍結、鍵侵害、内部統制不備、過度な裁量、当局措置の影響を受けます。権限の所在、複数署名、変更履歴、凍結方針、異議申立て、緊急時の連絡手段を確認することが重要です。

USD1とWLFのガバナンストークンWLFIは別のコントラクト、用途、価値形成を持ちます。WLFIに関する凍結、訴訟、価格変動を、そのままUSD1の準備不足やデペグと同一視できません。一方、同じブランド・関連主体を共有するため、評判、経営、規制の影響が波及する可能性はあります。

## 価格安定と市場流動性

### 1米ドル付近に戻る経路

USD1の二次市場価格が1米ドルを下回ると、直接償還できる適格事業者には、市場で取得してBitGoへ償還する裁定余地が生じます。1米ドルを上回ると、適格事業者は新規発行したUSD1を市場へ供給する余地があります。

ただし、裁定には次の制約があります。

- GoAccountの適格性と口座状態
- 発行・償還処理時間
- 銀行営業時間と送金網
- 最低数量・取引上限・手数料
- チェーン間の供給偏在とブリッジ
- 取引所の入出庫停止
- AML・制裁審査
- 準備資産売却の流動性

したがって、準備が1対1以上でも、特定の取引所やチェーンで価格乖離が起こる可能性があります。

### 確認できた価格ストレス

Reutersは2026年2月23日、USD1が外部からの「attack」と説明された事象の後に一時約0.994米ドルへ下落し、短時間で回復したと報じました。約0.6%の乖離でも、大口、レバレッジ、担保評価、清算、薄い板では影響が拡大します。

一方、元原稿の「2026年4月に20%弱下落」という記述には、信頼できる市場全体の価格系列、取引所、時刻、出来高が示されていません。検証できない異常値を最大ドローダウンとして固定すると、USD1全体の市場価格を誤って表すため、本記事では採用しません。

### 流動性の測り方

時価総額や24時間出来高だけでは、償還能力や実際の売却コストを測れません。

| 指標 | 確認できること | 限界 |
|---|---|---|
| 償還可能供給 | 発行体報告上の負債規模 | 保有者数・集中度は不明 |
| 準備資産 | 基準日の裏付けと構成 | 基準日後の変化は不明 |
| 取引高 | 売買活動 | 自己売買・重複集計・取引所差 |
| 板の厚み | 指定数量の想定スリッページ | 取引所停止・急変時には変化 |
| DEX流動性 | オンチェーン交換余力 | MEV、価格影響、コントラクトリスク |
| 直接償還能力 | 1米ドルへの裁定経路 | Accountholderのみ、条件・時間あり |
| 保有集中 | 大口移動・売却リスク | 取引所オムニバス口座の実需は不明 |

## 利息・手数料・収益構造

### USD1自体は利回り商品ではない

BitGo規約は、USD1が保有者へ利息やリターンを生まず、準備資産から得る収益に保有者の権利がないことを明記しています。USD1をウォレットに保有するだけで、政府MMFや短期国債の利回りが自動的に配分されるわけではありません。

外部のレンディング、流動性プール、取引所キャンペーン等で表示されるAPRは、借り手金利、取引手数料、インセンティブ、別トークン報酬等から発生します。そこでは次の追加リスクが生じます。

- 貸付先・取引所・プロトコルの信用
- 担保不足と清算
- スマートコントラクトとオラクル
- LPの価格乖離とimpermanent loss
- 出金待ち、ロック、報酬条件の変更
- USD1自体と報酬トークン双方の価格・流動性

### 手数料

「ミントも償還も常に無料」という元原稿の断定は、現在の公開規約と一致しません。BitGoは交換手数料を取引時に開示し、料金体系を変更できるとしています。さらに銀行、決済事業者、ブロックチェーン、取引所、DEX、ブリッジ等の第三者手数料が発生する場合があります。

実効コストは次の合計で考えます。

`実効コスト = 発行・償還手数料 + 銀行送金費 + ネットワーク手数料 + 取引手数料 + スプレッド + スリッページ + ブリッジ費用`

## 米国の規制とOCC申請

### GENIUS Act

米国では2025年7月18日、GENIUS Actが成立しました。政府公表資料は、決済用ステーブルコイン発行者に対して、少なくとも1対1の適格準備、発行者の登録・監督、償還方針、開示、AML・制裁対応、法的命令時の凍結・焼却能力等を求める連邦枠組みと説明しています。

適格準備には、米ドル、一定の預金、短期米国債、米国債で担保されたリバースレポ、一定の政府MMF等が含まれます。USD1の公開規約と2026年5月報告の資産区分は、この種類と重なります。ただし、資産構成が似ていることだけで、すべての移行要件や細則への適合が完了したと断定できません。

### BitGoと発行法人の確認

最新月次報告はBitGo Bank & Trust, N.A.を発行・償還主体とします。一方、USD1の公開規約やWLFの利用規約にはBitGo Trust Company, Inc.等の法人名も記載されています。契約画面、利用地域、口座種別、サービス提供時期によって当事者が異なる可能性があるため、法人名を「BitGo」と一括りにせず、実際に同意する規約の当事者と規制資格を確認します。

公開規約には編集上の未確定表示も残っているため、契約日、版、準拠法、発行者表記を保存して確認することが重要です。

### World Liberty Trust Company

WLTC Holdings LLCは2026年1月5日、World Liberty Trust Company, N.A.を新設する申請書をOCCへ提出しました。公開申請書は、認可・開業後に同社がUSD1の発行・償還、準備管理、デジタル資産カストディを行う計画と説明しています。

OCCの公開一覧は2026年7月28日時点でも同申請を審査中として掲載しています。申請書には、予定銀行がFDIC預金保険を持たないnational trust companyになることも記載されています。計画上の役割は現在の運用主体と区別し、OCCの最終認可と開業を確認する必要があります。

## 日本での法的区分・取扱い・税務

### 暗号資産とは限らない

日本の資金決済法は、法定通貨と連動する価格で発行され、額面償還を約するもの等を「電子決済手段」として、暗号資産とは別に扱います。USD1は米ドル建てで1米ドル償還を掲げるため、法的性質と提供方法に応じて外国電子決済手段に関する規律が問題になります。

したがって、元原稿の「日本では暗号資産に該当する可能性が高い」「暗号資産交換業者による取扱い」という一律の説明は採用しません。具体的な区分は、発行者、償還権、スキーム、国内提供者、法令上の同等性、当局判断等に依存します。

### 国内での取扱い

2023年6月以降、日本で法定通貨連動ステーブルコインの仲介等を業として行うには、電子決済手段等取引業の登録が関係します。金融庁は登録事業者一覧を公表し、利用前に登録、行政処分、価格変動、サイバーセキュリティ等のリスクを確認するよう注意喚起しています。

2026年7月28日時点で、本サイトの国内対応市場および確認した登録事業者の一般向け取扱いにUSD1は見当たりません。海外取引所やDEXで技術的にアクセスできる場合でも、日本居住者向けの勧誘・提供が認められていること、直接償還できることを意味しません。地域制限、利用規約、登録、制裁・AML、出金ネットワークを確認する必要があります。

本サイトにはUSD1/JPYの国内比較市場がないため、この記事から存在しない銘柄ページへは誘導しません。国内取扱いが将来開始された場合も、登録事業者の公式発表と金融庁資料を基準に更新します。

### 日本円での価格

USD1は米ドルに対して1:1を目標とし、日本円に対して固定されません。USD1/USDが1.00付近でも、USD/JPYが変動すればUSD1の円換算額は動きます。海外取引所からの入出金、外貨交換、板の薄さ、送金手数料も円換算の実現価値に影響します。

### 税務

国税庁の2025年12月FAQは、電子決済手段を法定通貨と連動し額面償還を約する金銭債権に類似する資産として説明し、法人の期末評価について暗号資産とは異なる取扱いを示しています。これは、USD1を保有するすべての個人取引の所得区分を一律に決めるものではありません。

USD1の法的区分、取得・売却、外貨差損益、他トークンとの交換、DeFi預入、報酬、事業利用、居住地によって税務が変わり得ます。「ステーブルコインだから課税損益はない」「暗号資産と同じく必ず雑所得」という二つの断定を避け、取引履歴と円換算根拠を保存し、国税庁の最新資料と専門家へ確認します。

## EUのMiCA

EUのMarkets in Crypto-Assets Regulation（MiCA）は、一つの公式通貨を参照して安定価値を目指す暗号資産をe-money token（EMT）として扱い、発行者、認可、白書、償還、準備、監督等の要件を設けています。ESMAと欧州委員会は、MiCAに適合しないART・EMTの募集や取引サービスについて、CASPが対応する必要があると案内しています。

WLFの公式ドキュメントにはMiCA Whitepaperへの案内がありますが、文書の公開だけでEU全域の認可、適法な募集、全取引所での継続取扱いが保証されるわけではありません。利用するEU事業者、発行者、トークンの法的発行経路、各国当局の登録・監督状況を確認する必要があります。

## USDC・USDTとの比較

| 項目 | USD1 | USDC | USDT |
|---|---|---|---|
| ブランド・主な主体 | WLFブランド、BitGoが発行・償還・準備管理 | Circle関連発行体 | Tether関連発行体 |
| 目標 | 1米ドル | 1米ドル | 1米ドル |
| 準備の主な特徴 | 2026年5月末は政府MMF約85%、要求払預金約15% | 現金・短期米国債中心、週次開示・月次保証 | 現金同等物、国債、その他資産を含む準備 |
| 第三者報告 | Croweの月次examination | Big Fourによる月次保証 | 四半期の準備報告・保証 |
| 直接償還 | 適格なBitGo Accountholder | 適格なCircle Mint利用者 | 適格なTether顧客、最低額・手数料等 |
| 保有者への準備収益 | なし | なし | なし |
| 管理・凍結 | 規約上あり | 法令・規約に基づく管理あり | 法令・規約に基づく管理あり |
| 日本 | 一般向け正規取扱いを未確認 | 登録事業者による国内取扱いあり | 国内取扱い・法的区分は提供者ごとに確認 |

比較で重要なのは、時価総額の大小だけではありません。

- 誰が発行・償還義務を負うか
- 誰が直接償還できるか
- 準備資産の種類、満期、保管、名義
- 報告の頻度、保証水準、基準日
- 発行・凍結・アップグレード権限
- チェーンごとのネイティブ発行とブリッジ
- 利用地域と規制資格
- 取引所・決済での流動性

USDC・USDTの運用や規制も変化します。USD1の新しさだけを利点または欠点とせず、同じ基準日の一次資料で比較します。

## 主要リスク

### 準備資産・償還

- 政府MMF、銀行預金、短期証券の価格・流動性・決済リスク
- 保管銀行や仲介機関の破綻、凍結、アクセス障害
- FDIC保護上限を超える預金
- 急な償還集中による処理遅延・資産売却
- Accountholder資格、地域、口座状態、取引上限
- 発行体・規約・準拠法の変更

### 価格・流動性

- 二次市場で1米ドルから乖離
- 特定取引所・チェーン・大口保有者への集中
- 取引所の入出庫停止、板の縮小、スプレッド拡大
- DEXのスリッページ、MEV、流動性提供者の撤退
- 円換算での為替変動

### 技術

- スマートコントラクトの脆弱性
- 発行・凍結・アップグレード鍵の侵害
- 誤ったネットワーク、偽トークン、コピー、ラップ版
- ブリッジの侵害、二重計上、対応停止
- チェーン混雑、reorg、障害、手数料急騰
- 秘密鍵紛失、フィッシング、誤送付

### 管理・カウンターパーティー

- BitGo、WLF、銀行、MMF、取引所への依存
- 凍結、差押え、没収、焼却、アップグレード
- 内部統制、委託先、運用手順の不備
- WLF関連事業・WLFIトークンの問題による評判波及
- 公開規約の法人表記・編集状態・条件変更

### 規制・政治

- GENIUS Actの移行要件・細則・監督対応
- OCC申請の不認可、条件付認可、開業遅延
- 日本・EU・その他法域での取扱い制限
- AML、制裁、法執行による利用・償還制限
- 公職者・関連家族との関係を巡る利益相反・政策リスク
- 取引所上場廃止、広告・勧誘・決済利用の制限

### 情報開示

- 月次報告の公表遅延
- 基準日と公表日の時間差
- 報告対象外の内部統制・関連会社財務
- 銀行別残高や保有者集中の不開示
- リアルタイムProof of Reservesのデータ源・更新停止
- 同じ「監査」という言葉による保証範囲の誤解

## 確認チェックリスト

| 分野 | 確認項目 | 読み違えやすい点 |
|---|---|---|
| 正規性 | チェーン、コントラクト、発行方式 | 同名・コピー・ラップ版 |
| 発行者 | 実際の規約当事者と規制資格 | WLFブランドとBitGo発行を混同 |
| 償還 | Accountholder資格、上限、時間、費用 | 全保有者が無条件に直接償還可能と解釈 |
| 準備 | 最新月次報告の基準日・内訳・差異 | 商品説明の許容資産を実際の保有と混同 |
| 保証 | examinationの対象と意見 | 企業全体の監査・将来保証と解釈 |
| 価格 | 取引所別の板、スプレッド、入出庫 | 1米ドル償還と二次市場価格を同一視 |
| 供給 | 発行・償還、チェーン別残高、集中 | 時価総額だけで利用の広さを判断 |
| 管理 | 凍結、アップグレード、Fork方針 | 自己管理なら発行体権限を受けないと誤解 |
| 利回り | 収益源、預入先、ロック、報酬 | USD1保有だけで国債利息を得ると誤解 |
| 日本 | 登録事業者、取扱い、地域制限 | 海外表示を国内正規取扱いと解釈 |
| 税務 | 法的区分、円換算、交換、報酬 | 暗号資産税制を自動適用 |
| 規制 | GENIUS Act、OCC、MiCAの現在地 | 申請・白書公開を認可済みと解釈 |

## まとめ

USD1は、World Liberty Financialのブランド・関連サービスと、BitGoの発行・償還・準備管理インフラを組み合わせた法定準備型ステーブルコインです。2025年3月の発表から短期間で大口発行が行われ、2026年5月末には6ネットワーク、約47.25億USD1の償還可能残高へ拡大しました。

最新月次報告で最も重要な事実は、2026年5月31日時点の償還可能残高4,725,094,306 USD1に対し、償還資産が4,734,684,613米ドルあり、調整後の超過額が88,311米ドルだったことです。準備の約85%は政府MMF、約15%は要求払預金でした。推測比率や古い「短期国債中心」という説明より、実際の月次内訳を使う必要があります。

一方、1対1以上の準備は、全保有者の無条件・即時償還や二次市場価格を保証しません。直接償還は適格なBitGo Accountholderに限定され、規制、本人確認、上限、銀行、処理時間等に依存します。USD1は法定通貨でも銀行預金でも政府MMF持分でもなく、保有者に準備資産の利息は分配されません。

技術面でも、USD1は発行、焼却、凍結、アップグレードを伴う運用型トークンです。法令対応や事故対応を可能にする一方、発行体、管理鍵、内部統制、当局措置への依存を生みます。マルチチェーン化は利用範囲を広げますが、偽トークン、ブリッジ、チェーン別流動性、誤送付のリスクも増やします。

制度面では、米国のGENIUS Actが成立済みである一方、World Liberty Trust CompanyのOCC申請は審査中です。日本では法定通貨連動・額面償還型のステーブルコインは電子決済手段として暗号資産と区別され、USD1の国内一般向け正規取扱いは確認できません。EUでもMiCA白書の公開と、発行・募集・取引サービスの適法性は分けて確認する必要があります。

USD1を検証するときは、価格チャートだけでなく、最新月次報告、直接償還条件、規約当事者、準備資産、管理権限、チェーン別供給、国内提供者、規制手続きの状態を同じ基準日で確認することが重要です。

## 参考資料

### USD1・BitGo・World Liberty Financial

- [World Liberty Financial：USD1公式ページ](https://worldlibertyfinancial.com/usd1)
- [World Liberty Financial：USD1公式ドキュメント](https://docs.worldlibertyfinancial.com/usd1-token/what-is-usd1)
- [World Liberty Financial：公式コントラクトアドレス](https://docs.worldlibertyfinancial.com/usd1-token/contract-addresses)
- [World Liberty Financial：USD1 Risk Disclosures](https://docs.worldlibertyfinancial.com/usd1-token/usd1-risk-disclosures)
- [World Liberty Financial：USD1 Proof of Reserves](https://por.worldlibertyfinancial.com/)
- [World Liberty Financial Gold Paper](https://static.worldlibertyfinancial.com/docs/intl/gold-paper.pdf)
- [BitGo：USD1](https://www.bitgo.com/usd1/)
- [BitGo：USD1 Terms](https://www.bitgo.com/usd1-terms/)
- [BitGo：USD1 Attestations](https://www.bitgo.com/usd1/attestations/)
- [BitGo：USD1 Stablecoin-as-a-Service](https://www.bitgo.com/resources/blog/usd1-the-blueprint-for-bitgos-stablecoin-as-a-service/)
- [USD1発表（Business Wire）](https://www.businesswire.com/news/home/20250325773694/en/World-Liberty-Financial-Plans-to-Launch-USD1-the-Institutional-Ready-Stablecoin)

### 準備金報告・オンチェーン

- [USD1 Reserve Attestation Report - May 2026](https://landing.bitgo.com/rs/552-OGK-141/images/USD1_Reserve_Attestation_Report_May_2026.pdf)
- [USD1 Reserve Attestation Report - April 2026](https://landing.bitgo.com/rs/552-OGK-141/images/USD1_Reserve_Attestation_Report_April_2026.pdf)
- [USD1 Reserve Attestation Report - January 2026](https://landing.bitgo.com/rs/552-OGK-141/images/USD1_Reserve_Attestation_Report_January_2026.pdf)
- [USD1 Reserve Attestation Report - December 2025](https://landing.bitgo.com/rs/552-OGK-141/images/USD1_Reserve_Attestation_Report_December_2025.pdf)
- [USD1 Reserve Attestation Report - April 2025](https://landing.bitgo.com/rs/552-OGK-141/images/USD1_Reserve_Attestation_Report_April_2025%20.pdf)
- [USD1 Ethereum Contract](https://etherscan.io/address/0x8d0d000ee44948fc98c9b98a4fa4921476f08b0d)
- [USD1 BNB Smart Chain Contract](https://bscscan.com/address/0x8d0d000ee44948fc98c9b98a4fa4921476f08b0d)

### 規制・日本

- [米国政府：GENIUS Act署名](https://www.whitehouse.gov/briefings-statements/2025/07/the-president-signed-into-law-s-1582/)
- [米国政府：GENIUS Act Fact Sheet](https://www.whitehouse.gov/fact-sheets/2025/07/fact-sheet-president-donald-j-trump-signs-genius-act-into-law/)
- [OCC：Digital Assets Licensing Applications](https://www.occ.gov/topics/charters-and-licensing/digital-assets-licensing-applications/index-digital-assets-licensing-applications.html)
- [OCC：World Liberty Trust Company申請書](https://www.occ.gov/topics/charters-and-licensing/digital-assets-licensing-applications/world-liberty-trust-company.pdf)
- [金融庁：電子決済手段等取引業について](https://www.fsa.go.jp/common/shinsei/dendai/dentori.html)
- [金融庁：電子決済手段等取引業者登録一覧](https://www.fsa.go.jp/menkyo/menkyoj/denshikessaisyudan.pdf)
- [金融庁：外国発行ステーブルコインを含む制度資料](https://www.fsa.go.jp/frtc/kikou/2025/20260201_syouken.pdf)
- [国税庁：暗号資産等に関する税務上の取扱い](https://www.nta.go.jp/publication/pamph/shotoku/kakuteishinkokukankei/kasoutuka/)
- [EU Markets in Crypto-Assets Regulation](https://eur-lex.europa.eu/eli/reg/2023/1114/oj/eng)
- [ESMA：MiCA](https://www.esma.europa.eu/esmas-activities/digital-finance-and-innovation/markets-crypto-assets-regulation-mica)
- [ESMA：non-MiCA-compliant ARTs and EMTs](https://www.esma.europa.eu/press-news/esma-news/esma-and-european-commission-publish-guidance-non-mica-compliant-arts-and-emts)

### 比較・主要事例

- [Circle Transparency](https://www.circle.com/transparency)
- [Circle USDC Terms](https://www.circle.com/legal/usdc-terms)
- [Tether Transparency](https://tether.to/en/transparency/)
- [Tether Legal and Risk Disclosures](https://tether.to/en/legal/?tab=risk-disclosure-statement)
- [Reuters：MGX・Binance取引でのUSD1利用](https://www.reuters.com/world/middle-east/wlfs-zach-witkoff-usd1-selected-official-stablecoin-mgx-investment-binance-2025-05-01/)
- [Reuters：2026年2月の価格乖離](https://www.reuters.com/company/world-liberty-financial-inc/)

## 免責事項

本記事は情報提供のみを目的としており、特定の暗号資産の売買・保有を勧誘または推奨する投資助言ではありません。公開情報をもとに可能な限り正確な記載に努めていますが、完全性・正確性・最新性を保証するものではありません。将来の記述やシナリオは成果を保証しません。USD1は1米ドルでの償還を設計目標としますが、価格、即時償還、元本、流動性、利回りは保証されず、元本の全部を失う可能性があります。税務・法務上の取扱いは居住地や利用方法により異なります。利用前に最新の公式情報と専門家の助言を確認してください。
