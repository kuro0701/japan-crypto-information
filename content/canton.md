---
title: Canton Network（CC）総合分析｜プライバシー・Daml・トークノミクス・機関採用
description: Canton NetworkとCanton Coin（CC）のGlobal Synchronizer、Daml、選択的プライバシー、バーン・ミント、ガバナンス、機関採用、日本での取扱い、市場・規制・主要リスクを総合分析します。
date: 2026-07-27
updated: 2026-07-29
author: 国内暗号資産取引所ナビ
slug: canton
path: /articles/canton
articleType: market
marketTicker: CANTON
marketInstrumentId: CC-JPY
category: 機関金融・資産トークン化
tags: Canton Network, Canton Coin, CC, Global Synchronizer, Daml, RWA, トークン化, プライバシー, アトミック決済, DTCC, Tradeweb
readMinutes: 29
---

> **重要：本記事は情報提供のみを目的としており、特定の暗号資産の売買・保有を勧誘または推奨する投資助言ではありません。** 掲載する評価、市場データ、利用例は調査時点の分析上の情報であり、将来の成果を保証しません。暗号資産は、価格変動、流動性、技術、規制、税務、オペレーション、カウンターパーティー等のリスクを伴います。実際の利用・取引判断は、最新の公式情報を確認し、ご自身の状況に応じて行ってください。本稿の時点データは、原則として2026年7月27日JST時点で確認できた公開情報に基づきます。

<section class="article-key-takeaways" aria-labelledby="canton-key-takeaways-title">
  <div class="article-key-takeaways__header">
    <div>
      <span>Key takeaways</span>
      <h2 id="canton-key-takeaways-title">この記事でわかること</h2>
    </div>
    <p>まず3つの論点を押さえてから、仕組み・供給・採用事例を読み進められます。</p>
  </div>
  <ol class="article-key-takeaways__grid">
    <li>
      <span>Point 1</span>
      <strong>必要な当事者だけで同期</strong>
      <p>独立した台帳をGlobal Synchronizerでつなぎ、関係のない参加者へ取引内容を広く複製しない設計です。</p>
    </li>
    <li>
      <span>Point 2</span>
      <strong>利用料の焼却と報酬ミント</strong>
      <p>CCの供給は固定上限ではなく、ネットワーク利用による焼却と貢献報酬のミントの差で変動します。</p>
    </li>
    <li>
      <span>Point 3</span>
      <strong>採用段階を分けて確認</strong>
      <p>実証、限定的な本番取引、全面的な商用稼働を同じ「採用」と扱わず、案件ごとの実態を確認します。</p>
    </li>
  </ol>
</section>

## エグゼクティブサマリー

Canton Networkは、規制金融で求められるプライバシー、権限制御、相互運用性を同時に扱うために設計されたオープンなブロックチェーンネットワークです。単一の共有台帳へ全参加者の取引を公開するのではなく、独立して運営されるアプリケーション台帳を、必要な取引だけ<button type="button" class="article-term article-term--always" data-term-key="global-synchronizer" data-term-always="true" data-beginner-label="＝台帳間の同期基盤">Global Synchronizer</button>経由で同期させます。運営主体ごとの主権を残しながら、複数アプリケーションにまたがる資産移転を一つの原子的な処理として組み合わせられる点が中心です。

Cantonのプライバシーは、単純な匿名化ではありません。<button type="button" class="article-term article-term--always" data-term-key="daml" data-term-always="true" data-beginner-label="＝契約ルールを記述する言語">Daml</button>スマートコントラクトが契約当事者と権限を定義し、各<button type="button" class="article-term article-term--always" data-term-key="validator" data-term-always="true" data-beginner-label="＝関係取引を検証するノード">Validator</button>は自らが関係するデータだけを受け取り、検証します。Global Synchronizerは暗号化されたメッセージの順序付けと同期を担いますが、通常の私的な取引内容を全ノードへ複製しません。一方、Canton Coinの残高と移転は公開性を持つため、「Canton上のすべてが非公開」という説明も正確ではありません。

Global SynchronizerとCanton Coinは2024年7月1日に本番稼働しました。Global Synchronizerは独立組織が運営するSuper Validatorによって構成され、重要な構成変更、手数料、ミント曲線等は原則としてSuper Validatorの3分の2以上の承認を必要とします。Canton Foundationは運営の透明性と組織的中立性を支える役割を持ちます。CC保有量に応じて一般保有者が投票するトークンガバナンスではありません。

Canton Coin（CC）は、Global Synchronizerのトラフィック、アプリケーション料金、参加者間の価値移転、ネットワーク貢献者への報酬に利用できるユーティリティトークンです。ただし、参加ノードは第三者が法定通貨等で用意したトラフィック残高を使うこともでき、すべてのCanton利用者がCCを直接保有する必要はありません。CCの価値捕捉を考える際は、ネットワーク利用量だけでなく、どの料金がCCで焼却されるか、利用者がCCを直接調達するか、報酬として何枚ミントされるかを分けて確認する必要があります。

トークノミクスは<button type="button" class="article-term article-term--always" data-term-key="burn-mint" data-term-always="true" data-beginner-label="＝利用時に焼却し、貢献時に発行">Burn-Mint Equilibrium</button>を採用します。USD建ての利用料をCCで支払う際にCCを焼却し、アプリケーション提供者、Validator、Super Validatorはネットワークへの貢献に応じて新しいCCをミントできます。最初の10年間に1000億CCをミントできる曲線が設定されていますが、これは固定最大供給量ではありません。10年後も年25億CCのミント枠が続き、実際の流通供給はミントと焼却の差で変動します。

実運用では、DTCCによるDTC保管米国債のトークン化計画、Franklin TempletonからVirtu Financialへのトークン化米国債とUSDCxの同期決済、担保モビリティ、HQLAX、Goldman Sachsのデジタル資産基盤等が公表されています。ただし、エコシステム掲載、資金調達への参加、実証実験、限定的な本番取引、商用サービスの全面稼働は同じ採用段階ではありません。個々の案件の法的権利、対象顧客、取引量、反復性を確認する必要があります。

日本では、SBI VCトレードが2026年3月25日に国内でCantonの取扱いを開始しました。続いてOKJが2026年7月15日に `CC/JPY` の板取引、販売所、積立、入出庫の提供を開始し、同社発表では国内交換業者として初のCC板取引となりました。SBI VCトレード内の通貨単位は `CANTON`、OKJとネットワーク上の一般的な略号は `CC` です。名称が異なるため、入出庫先ネットワーク、対応ウォレット、最低数量、手数料、メンテナンス状況を取引所の最新案内で照合する必要があります。

市場データでは、2026年7月27日のCoinGecko表示でCCは約0.123ドル、流通供給約391.6億CC、時価総額約48.1億ドル、24時間出来高約758万ドルでした。時価総額に対して取引高が小さく、取引所・通貨ペアごとの板の厚みには差があります。価格、時価総額順位、出来高、流通供給は時刻と集計方法で変わるため、固定値ではなく時点スナップショットとして扱います。

## 基本情報

| 項目 | 内容 | 確認上の注意 |
|---|---|---|
| ネットワーク | Canton Network | 独立したアプリケーション台帳を同期する「network of networks」 |
| 主要開発企業 | Digital Asset | Canton、Daml、関連ソフトウェアを開発。ネットワーク全体を単独運営するわけではない |
| Global Synchronizer本番稼働 | 2024年7月1日 | Canton Coinと同時に運用開始 |
| スマートコントラクト | Daml | 契約当事者、権利、義務、可視性をモデル化 |
| 実行・検証ノード | Validator | ホストする当事者に関係する取引を処理・検証 |
| 共有同期基盤 | Global Synchronizer | 暗号化メッセージの同期、順序付け、原子性を支える |
| 基盤運営 | Super Validator | Global Synchronizerを共同運営し、CC取引をBFT合意で確認 |
| ネイティブ資産 | Canton Coin（CC） | SBI VCトレード内の表示はCANTON、OKJのシンボルはCC |
| 供給上限 | 固定上限なし | 最初の10年に最大1000億CCをミント可能、その後も年25億CCの曲線 |
| 主な用途 | トラフィック・アプリ料金、価値移転、貢献報酬 | CCの直接保有はすべてのCanton利用で必須ではない |
| ガバナンス | Super Validatorの投票、Canton Foundation | 一般CC保有者の保有量比例投票ではない |

## 歴史と発展

Digital Assetは2014年に設立され、金融機関向け分散台帳とスマートコントラクト技術を開発してきました。Canton Networkの構想は2023年5月に公表され、同年6月にTestNetを開始しました。複数の金融機関を含むテストを経て、2024年7月1日にGlobal SynchronizerとCanton Coinが稼働しました。

| 時期 | 出来事 | 読み方 |
|---|---|---|
| 2014年 | Digital Asset設立 | Damlと機関向け分散台帳の開発を開始 |
| 2023年5月 | Canton Network構想を公表 | 金融アプリケーション間の同期基盤を提案 |
| 2023年6月 | Global Synchronizer TestNet | 市場参加者による検証を開始 |
| 2024年3月 | トークン化資産の相互運用パイロット | 実証結果であり、市場全体の商用稼働ではない |
| 2024年7月1日 | Global SynchronizerとCCが本番稼働 | Super Validatorによる分散運営とミント開始 |
| 2025年6月 | Digital Assetが1.35億ドル調達 | DRW Venture Capital、Tradeweb等が参加 |
| 2025年12月 | DTCCとの米国債トークン化計画 | DTC保管資産を対象に段階的な本番化を計画 |
| 2026年3月25日 | SBI VCトレードが国内取扱い開始 | 国内サービスではCANTON表記 |
| 2026年7月15日 | OKJがCCの取扱い開始 | CC/JPYの国内初板取引、販売所、積立、入出庫に対応 |
| 2026年4月 | 日本国債担保管理PoC | みずほFG、野村HD、JSCC、Digital Assetが検証 |
| 2026年6月 | Digital Assetが3.55億ドル調達 | a16z crypto主導。DAへの出資とCC保有は別 |
| 2026年7月1日 | Tradeweb上の同期決済 | トークン化米国債とUSDCxをリアルタイム決済 |

2026年の3.55億ドル調達はDigital Assetという企業への資金提供です。参加企業の存在はCanton開発への事業上の関心を示しますが、その企業がCCを購入・保有したことや、将来のCC価格を保証するものではありません。

## アーキテクチャ：network of networks

### 単一台帳ではない構造

Cantonは、全アプリケーションが一つのグローバル状態を共有する設計ではありません。各運営者は、自社のValidator、アプリケーション、データ管理方針を持ちます。取引に複数のアプリケーションや当事者が関わるとき、Synchronizerが必要なメッセージを調整し、全構成要素が成立するか、全体が成立しないかという原子性を提供します。

<figure class="article-mermaid article-mermaid--canton article-concept-diagram">
  <figcaption>
    <span>Architecture</span>
    <strong>独立した台帳を、必要な取引だけ同期する</strong>
    <small>各Validatorは関係するデータだけを検証し、Global Synchronizerが複数レッグの順序と原子性を調整します。</small>
  </figcaption>
<pre class="mermaid">flowchart LR
    subgraph APPS["独立して運営されるアプリケーション"]
      A["資産アプリ<br/>Validator A"]
      B["決済アプリ<br/>Validator B"]
      C["担保アプリ<br/>Validator C"]
    end
    A -->|"必要なメッセージ"| S["Global<br/>Synchronizer"]
    B -->|"必要なメッセージ"| S
    C -->|"必要なメッセージ"| S
    S -->|"全レッグを同時確定"| D["同期された<br/>原子取引"]
    D -.-> A
    D -.-> B
    D -.-> C
    classDef app fill:#151925,stroke:#f3ff97,color:#f8fafc,stroke-width:1.5px
    classDef sync fill:#23243a,stroke:#c4b5fd,color:#ffffff,stroke-width:2px
    classDef result fill:#10231d,stroke:#35e0a5,color:#ffffff,stroke-width:2px
    class A,B,C app
    class S sync
    class D result</pre>
</figure>

この構造では、ある機関が資産台帳を変更しても、無関係な参加者へ取引内容を公開する必要はありません。一方、複数台帳の取引が完全に独立しているわけでもなく、関係当事者の承認と同期がそろった場合だけ状態更新を確定できます。

### ValidatorとSynchronizer

Digital Assetのドキュメントでは、Cantonの主要インフラをValidatorとSynchronizerに分けています。

- Validatorは、当事者の署名、Daml契約、入力状態、権限、取引の整合性を検証する
- Validatorは、ホストする当事者に関係するデータだけを保持する
- Synchronizerは、関係Validator間のメッセージ調整、順序付け、時間情報、原子性を支える
- Global Synchronizerは、Super Validatorが共同運営する公開接続用Synchronizer
- 第三者は、Spliceのオープンソースコードを使って別の同期ドメインを構成できる

「Global SynchronizerがCanton上の全取引内容を保存する」「すべてのValidatorが全契約を再実行する」という理解は適切ではありません。反対に、運営者ごとに完全分断された通常の企業データベースでもなく、共通プロトコルで複数台帳を同期できる点がCantonの違いです。

## Damlスマートコントラクト

Damlは、多者間の権利・義務・ワークフローを表現するスマートコントラクト言語です。契約のテンプレートには、誰が署名者か、誰が閲覧できるか、どの当事者がどの選択肢を実行できるかを定義できます。可視性はアプリケーション外の後付け設定だけではなく、契約モデルと取引処理へ組み込まれます。

Daml契約では、現在有効な契約を消費し、新しい契約を作る形で状態を更新します。関係当事者は自らに必要な部分だけを受け取り、入力契約の有効性、権限、署名等を検証します。Ethereum Virtual Machine互換ではないため、Solidityコントラクトを変更なしで導入できるわけではありません。Daml SDK、Canton APIs、運用基盤、参加者のID・鍵管理を含む別の開発・運用モデルが必要です。

### Damlで扱える主な要素

- 複数組織間の契約状態と承認フロー
- 資産の発行、移転、償還、凍結等の権限
- Delivery-versus-Payment（DvP）やPayment-versus-Payment（PvP）
- 担保差し替え、レポ、証券金融、コーポレートアクション
- 契約当事者ごとのデータ可視性
- 既存システムとのAPI連携

スマートコントラクトが技術的に原子的でも、法的権利、発行体の履行能力、オラクル、カストディ、オフチェーン決済、本人確認、誤操作対応まで自動的に保証されるわけではありません。

## プライバシーと選択的開示

### 「非公開」と「匿名」は異なる

Cantonの通常取引は、契約の当事者や権限を与えられた主体にだけ開示されます。これは取引履歴を全世界へ公開しないための設計ですが、当事者自身、Validator運営者、発行体、規制上必要な監査人等からも身元や取引内容を隠す匿名通貨の設計ではありません。規制金融ではKYC、AML、制裁対応、記録保存、当局報告等をアプリケーション運営者が実装します。

### サブトランザクション・プライバシー

一つの取引に複数のアプリケーションが含まれる場合でも、各参加者が取引全体の全データを見る必要はありません。例えば、証券の発行体は証券移転に必要な部分、決済事業者は現金側の部分、仲介者は自らの承認部分だけを確認できます。この部分可視性を維持したまま、全レッグを原子的に成立させられることがCantonの重要な設計目標です。

Canton Coinは例外的に公開性を持ちます。公式ホワイトペーパーは、CCのポジションと移転を公開し、アプリケーション利用の一部を観測可能にする設計を説明しています。ただし、CC支払いと組み合わせた私的サブトランザクションの内容まで公開されるわけではありません。

## 合意形成と確定

Cantonでは、関係当事者がDaml取引の妥当性を確認する処理と、Synchronizerがメッセージを順序付けて原子的に確定させる処理を分けます。Global SynchronizerではSuper Validatorが<button type="button" class="article-term article-term--always" data-term-key="bft" data-term-always="true" data-beginner-label="＝一部の障害に耐える合意方式">BFT</button>合意を形成し、Canton Coinの移転や共同サービスを確認します。ホワイトペーパーでは、Super Validator全体の3分の2以上による確認を基準としています。

これは「各プライベート台帳の内容をSuper Validatorがすべて閲覧して承認する」という意味ではありません。暗号化されたプロトコルメッセージを使い、関係するValidatorが内容を検証し、Synchronizerは二重使用や不整合を避けるための調整を行います。

確定性と可用性は、次の条件に依存します。

- 関係ValidatorとSynchronizerのオンライン状態
- Super ValidatorのBFTしきい値とネットワーク接続
- DamlおよびCantonソフトウェアの正しさ
- 鍵、証明書、ID、時刻、バックアップの運用
- 外部システム、オラクル、カストディ、法定通貨決済の状態

## Canton Coin（CC）の用途

### ネットワークトラフィック

Global Synchronizerを一定量以上利用するValidatorは、トラフィック残高を事前に用意します。CCを焼却して残高を購入する方法がありますが、第三者が法定通貨等を受け取り、利用者に代わって残高を用意することもできます。そのため、ネットワーク利用増加が同じ割合で一般利用者のCC購入へ直結するとは限りません。

### アプリケーション料金

アプリケーション提供者は、サービス料金をCCまたはUSD建てで設定し、CC決済として処理できます。料金を支払うとCCが焼却され、アプリケーション提供者は記録された活動に応じてミント権を得ます。料金と報酬は直接送金ではなく、焼却と新規ミントを介して結びつきます。

### 価値移転と公開指標

CC自体を参加者間で送ることができ、公開トークンとして一部のネットワーク活動を観測する指標になります。しかし、Canton上の証券、預金トークン、ステーブルコイン、担保等が必ずCC建てになるわけではありません。CCの取引量はネットワーク全体の経済価値と同義ではなく、私的アプリケーションの活動量を完全には表しません。

## トークノミクス

### ミント曲線

2024年版ホワイトペーパーのミント可能枠は次のとおりです。

| 稼働後の期間 | 年換算ミント可能量 | 期間内の累計枠 | アプリ | Validator | Super Validator |
|---|---:|---:|---:|---:|---:|
| 0〜0.5年 | 年400億CC | 200億CC | 15% | 5% | 80% |
| 0.5〜1.5年 | 年200億CC | 200億CC | 40% | 12% | 48% |
| 1.5〜5年 | 年100億CC | 350億CC | 62% | 18% | 20% |
| 5〜10年 | 年50億CC | 250億CC | 69% | 21% | 10% |
| 最初の10年 | — | 1000億CC | 500億CC | 150億CC | 350億CC |
| 10年後 | 年25億CC | 毎年継続 | 75% | 20% | 5% |

この表は「その枚数が自動的にすべて流通する」ことを意味しません。活動、上限、請求手続き等に応じてミントされ、未使用の枠が生じる場合があります。Super Validatorへの比率は初期インフラを立ち上げるため高く、時間とともにアプリケーション提供者へ移ります。

### 初期販売・特別割当

CCはGlobal Synchronizerが稼働してから、ネットワークへユーティリティを提供した主体がミントする設計で、一般的なICO、プレセール、創業者向け固定プールはありません。ただし、初期のSuper Validator報酬比率が高いこと、Super Validatorの重み付けがガバナンスで決まること、報酬を受けた主体が市場で売却できることは、供給集中と売却圧力の分析対象です。

「VC割当がない」と「Digital Assetへ外部投資家がいない」は別の話です。Digital Assetは株式等による資金調達を行っており、企業への出資者とCCのプロトコル配分を混同できません。

### Burn-Mint Equilibrium

利用料はUSD建てで計算され、CCで支払うと利用者側で焼却されます。アプリケーション提供者やインフラ提供者は別途、新しいCCをミントします。

<figure class="article-mermaid article-mermaid--canton article-concept-diagram">
  <figcaption>
    <span>Burn–Mint Equilibrium</span>
    <strong>利用と貢献を、焼却とミントの別経路で記録する</strong>
    <small>流通供給は「焼却量」と「実際にミントされた量」の差で変化します。価格を一定に保つ仕組みではありません。</small>
  </figcaption>
<pre class="mermaid">flowchart LR
    U["ネットワーク利用"] --> F["USD建て料金"]
    F --> B["CCを焼却"]
    B --> DOWN["供給を減らす要因"]
    U --> R["活動・貢献を記録"]
    R --> M["貢献者がCCをミント"]
    M --> UP["供給を増やす要因"]
    DOWN --> NET["純供給の変化"]
    UP --> NET
    classDef input fill:#151925,stroke:#c4b5fd,color:#ffffff,stroke-width:1.5px
    classDef burn fill:#2a1719,stroke:#ff6b70,color:#ffffff,stroke-width:2px
    classDef mint fill:#10231d,stroke:#35e0a5,color:#ffffff,stroke-width:2px
    classDef net fill:#242315,stroke:#f3ff97,color:#ffffff,stroke-width:2px
    class U,F,R input
    class B,DOWN burn
    class M,UP mint
    class NET net</pre>
</figure>

定常期には年25億CCのミント枠があり、同じ年に25億CCが焼却されれば理論上の純供給はおおむね横ばいになります。焼却が多ければ純減、少なければ純増です。ただし、ホワイトペーパーが説明する「均衡」は設計上の目標であり、市場価格を一定に保つペッグ、償還保証、中央銀行型の価格介入ではありません。

### 供給を確認するときの注意

- minted supply、circulating supply、market data providerの供給値は定義が異なる
- 最大供給量は設定されていない
- 1000億CCは最初の10年のミント曲線であり、固定上限ではない
- 焼却量とミント量の両方を見なければ純供給を判断できない
- 報酬受領者の保有・売却方針はプロトコルだけでは分からない
- Super Validatorは3分の2以上のガバナンスでミント曲線を変更できる

## ガバナンス

Canton Foundationは、Global Synchronizerの成長、透明性、メンバー参加、ガバナンスを支えます。Super Validatorはコード、サービス、構成、参加者、手数料、ミントパラメータ等の提案に投票します。Digital Assetは開発とエコシステムで大きな役割を持ちますが、単独で重要変更を承認・拒否できない設計とされています。

| 主体 | 主な役割 | 主な依存・リスク |
|---|---|---|
| Canton Foundation | 組織運営、透明性、メンバー参加 | 法人運営、委員会、情報開示 |
| Super Validator | Global Synchronizer運営、BFT、提案投票 | 運営者数、独立性、クラウド・地域集中 |
| Validator | 利用者・アプリのホストと検証 | 鍵管理、可用性、カストディ条件 |
| Application Provider | Damlアプリとサービス提供 | 契約設計、法令対応、外部システム |
| Digital Asset | 中核ソフトウェア・製品開発 | 開発集中、商用支援、ロードマップ |
| CC保有者 | 送金・料金等でCCを利用 | 保有量だけでプロトコル投票権は得ない |

ガバナンス評価では、名目上のノード数だけでなく、Super Validatorの実際の運営組織、投票参加率、提案履歴、ソフトウェア開発者の集中、クラウド・地域・法域の分散を確認する必要があります。

## エコシステムと採用事例

### DTCCとDTC保管米国債

DTCCとDigital Assetは2025年12月、DTCが保管する一部米国債をCanton上でトークン化する提携を公表しました。最初の段階は管理された本番環境でのMVPで、対象と規模を顧客需要に応じて拡大する計画です。DTCCは2026年5月、50社超と開発を進め、限定的な本番取引を2026年7月、サービス開始を同年10月に予定すると説明しました。

この事例は重要な市場インフラとの接続計画ですが、公表時点で全DTC資産がCantonへ移行したわけではありません。対象資産、参加者、稼働範囲、法的記録との関係を段階ごとに確認します。

### Tradeweb、Franklin Templeton、Virtu

2026年7月1日、Tradewebは、Franklin Templetonがトークン化米国債をVirtu Financialへ移転し、対価としてUSDCxを受け取るリアルタイム取引を公表しました。Tradewebが執行と価格発見を提供し、Cantonが証券と現金トークンの同期決済を支えました。Blockdaemon、Digital Asset、Société Généraleも参加しています。

これは複数レッグの同期決済を本番に近い環境で示した具体例です。一方、単一または限定された取引の成功と、日常的な大量取引、継続的な流動性、法定通貨への即時償還は別の評価項目です。

### 担保モビリティと日本国債PoC

CantonのIndustry Working Groupは、米国債、英国債、金、ステーブルコイン等を使う時間外担保移転や証券金融の検証を継続しています。日本では2026年4月、みずほフィナンシャルグループ、野村ホールディングス、日本証券クリアリング機構、Digital Assetが、日本国債を使うデジタル担保管理PoCを発表しました。日本の法令と既存の振替制度を維持しながら、24時間のクロスボーダー担保取引が可能かを検証するものです。

PoCは法務・業務・技術の実現可能性を調べる段階であり、商用サービスの開始や取引量を示すものではありません。

### エコシステム掲載の読み方

Canton公式エコシステムには、金融機関、市場インフラ、Validator、Super Validator、アプリケーション、ウォレット、データ・監査事業者等が掲載されています。掲載企業にはGoldman Sachs、BNP Paribas、Citi、Circle、SBI Group、Blockdaemon、Cumberland等が含まれますが、役割は同一ではありません。

- Foundation member
- Super ValidatorまたはValidator
- Damlを使う製品提供者
- パイロット・ワーキンググループ参加者
- 資金調達への出資者
- Canton上の資産・アプリ提供者
- サービスプロバイダー

ロゴ掲載だけから、取引量、CC保有、商用契約、継続利用を推定しないことが重要です。

## 市場データと流動性

2026年7月27日に確認した市場集計は次のとおりです。

| 指標 | CoinGecko | CoinMarketCap | 注意点 |
|---|---:|---:|---|
| 価格 | 約0.123ドル | 約0.123ドル | リアルタイムで変動 |
| 流通供給 | 約391.6億CC | 約391.6億CC | 集計定義と更新時刻に依存 |
| 時価総額 | 約48.1億ドル | 約48.1億ドル | 価格 × 集計上の流通供給 |
| 時価総額順位 | 20位 | 17位 | 対象銘柄・供給認定が異なる |
| 24時間出来高 | 約758万ドル | 約1141万ドル | 取引所採用、異常値除外、時刻が異なる |
| 過去最高値 | 約0.194ドル | 集計サイトで確認 | 2026年2月、現在値は約37%下 |

時価総額が数十億ドルでも、24時間出来高や板の厚みが比例して大きいとは限りません。大口注文では、表示価格に対するスリッページ、取引所間価格差、出庫停止、カストディ対応、マーケットメーカー依存が問題になります。市場データサイトの「流通供給」とプロトコル上のミント済み供給も一致するとは限りません。

## 日本での取扱いと実務

SBI VCトレードは2026年3月25日、国内で初めてCantonを取り扱いました。同社の取扱暗号資産ページでは、名称をCanton Coin、サービス内通貨単位をCANTON、一般的なネットワーク記号をCCとしています。OKJは2026年7月15日にCCの取扱いを開始し、取引所、販売所、積立、入出庫に対応しました。同社発表では、暗号資産交換業者によるCCの板取引は国内初です。

入出庫・取引前に確認する項目は次のとおりです。

- SBI VCトレードでの表示名はCANTONであること
- OKJの板取引ではCC/JPYとして表示されること
- 送信元・受信先がCanton Networkに対応していること
- 取引所が外部入出庫を提供しているか
- 最低注文量、呼値、販売所・取引所の別
- 入庫反映条件、出庫手数料、メンテナンス
- 自己管理ウォレットの対応と復旧方法
- 送信先のParty ID、アドレス、メモ等の必要情報

国内取扱いは、金融庁が価格安定性、将来価値、技術上の無事故を保証することを意味しません。交換業者の登録、個別銘柄の審査、利用者自身のリスク判断は別の制度・行為です。

## 規制・法務・税務

### EUのMiCA

EUではMarkets in Crypto-Assets Regulation（MiCA）が暗号資産の発行・勧誘・取引サービス等に共通ルールを設けます。CantonについてはMiCA対応ホワイトペーパーが公表・提出されたとSBI VCトレードが説明しています。ただし、MiCAの一般的な暗号資産ホワイトペーパーは、EU加盟国の当局が内容や価値を事前承認する目論見書ではありません。EUの所定文言も「管轄当局による承認を受けていない」ことを明記します。

したがって「MiCAホワイトペーパーがある」ことを、EU当局による安全性・価格・プロジェクト成功の保証として扱うことはできません。

### 日本

日本の交換業者で売買されるCCは、資金決済法上の暗号資産として取り扱われます。利用者保護、分別管理、広告、トラベルルール等の交換業者規制がありますが、Canton上で発行される証券、預金トークン、ステーブルコイン、ファンド持分は、それぞれ別の法的性質と発行条件を持ちます。ネットワークが同じでも、資産の法的権利は同一ではありません。

個人の暗号資産取引による利益は、日本では原則として雑所得に区分されますが、取引形態、事業性、法人、相続、報酬としての受領、DeFi利用等で扱いが変わる場合があります。最新の国税庁資料と専門家の確認が必要です。

## セキュリティ

Cantonのセキュリティ上の特徴は、データを全ノードへ配布しないこと、Damlで権限を明示すること、独立Validatorが関係取引を検証すること、Global SynchronizerをBFT運営することです。秘密情報の露出範囲を抑えられる一方、次のリスクは残ります。

### プロトコルと実装

- Canton、Daml、Splice、アプリケーションコードの脆弱性
- 暗号ライブラリ、依存パッケージ、ビルド環境のサプライチェーン
- BFT実装、メッセージ順序、状態同期の不具合
- プロトコル更新時の互換性と運用停止

### 運用と鍵管理

- Validator、Super Validator、管理者鍵の侵害
- クラウド、HSM、証明書、バックアップの設定ミス
- 内部不正、権限過多、監査ログ不足
- カストディ事業者、ウォレット、API認証の障害

### アプリケーションと資産

- Daml契約の権利・義務・可視性設定の誤り
- 発行体による凍結、償還停止、破綻
- オラクル価格、法定通貨決済、既存台帳との不整合
- ブリッジ・ラップ資産・ステーブルコインの準備資産
- 法的契約とオンチェーン状態の不一致

監査会社のエコシステム参加や個別監査は防御の一部ですが、ネットワーク全体と全アプリケーションの無欠陥を証明するものではありません。利用対象ごとに監査範囲、版、未解決項目、運用統制、インシデント対応を確認する必要があります。

## 競合・代替手段との比較

| 項目 | Canton | Ethereum / L2 | Avalanche L1 | XDC Network | 既存金融インフラ |
|---|---|---|---|---|---|
| 主な設計対象 | 規制金融の複数台帳同期 | 汎用公開スマートコントラクト | 主権を持つ個別L1と公開基盤 | 貿易金融・RWAを含む企業利用 | 法定台帳、清算、決済 |
| データ公開 | 関係者へ選択的開示、CCは公開 | 原則公開、追加プライバシー層が必要 | 構成するL1ごとに設計 | 公開・許可型要素 | 業務・法令に基づく限定共有 |
| 相互運用 | Global Synchronizerで原子同期 | ブリッジ、L2、メッセージング | Interchain Messaging等 | ブリッジ・統合 | 中央機関・メッセージ標準 |
| 開発環境 | Daml、Canton APIs | Solidity、EVM等 | EVMほか | EVM互換 | 専用システム |
| ネイティブ資産 | CCは利用可能だが常時必須ではない | ETHがガスに必要 | AVAX等 | XDC | 暗号資産が不要な場合もある |
| ガバナンス | Super ValidatorとFoundation | クライアント・開発者・Validator等 | 各L1の運営設計 | ネットワーク運営者 | 規制機関・市場インフラ |

Cantonの強みはプライバシーと原子同期を同時に設計している点です。一方、Ethereum系より開発者・ウォレット・流動性の基盤が小さく、Daml固有の学習と運用が必要です。既存金融インフラは法的確定性と大量処理の実績を持つため、Cantonが置き換えるとは限らず、既存制度と接続する補完基盤になる場合があります。

## 主なリスクと制限事項

### 採用段階の違い

パートナー一覧には、商用利用、実証、出資、ノード運営、技術提供が混在します。参加組織数だけでは、反復的な取引量、収益、CC焼却量を判断できません。

### 透明性の制約

私的取引は外部から完全には観測できません。公開KPIがあっても、名目取引額、メッセージ数、アプリ利用、経済的に独立した取引、テスト活動を区別する必要があります。

### ガバナンス集中

CC保有者ではなくSuper Validatorが重要パラメータを決めます。BFTしきい値があっても、運営組織、資本関係、クラウド、法域、ソフトウェア開発が集中していれば、実効的な独立性は低下します。

### 供給と売却圧力

初期ミント曲線は大きく、Super Validatorとインフラ提供者の比率も初期ほど高くなります。プレセールがないことは、報酬受領者の保有集中や売却をなくすものではありません。

### 価値捕捉の間接性

ネットワーク利用者はCCを直接保有せず、第三者経由でトラフィックを購入できます。Canton上の資産価値や決済額が増えても、同じ割合でCCの市場需要や焼却量が増えるとは限りません。

### 流動性

時価総額と24時間出来高の比率、取引所ごとの板、出庫可否、カストディ対応に差があります。価格表示だけで大口の執行可能性を判断できません。

### 技術とオペレーション

複数Validator、Synchronizer、既存システム、法的記録を組み合わせるため、単一チェーンとは異なる障害モードがあります。鍵、証明書、API、オラクル、バージョン互換性、参加者間の復旧手順が重要です。

### 規制・法的権利

同じCanton上でも、CC、証券、ファンド持分、ステーブルコイン、預金トークンの法的性質は異なります。国境をまたぐ取引では、準拠法、最終性、破綻時の権利、制裁、本人確認、データ所在を確認する必要があります。

## 継続的に確認する指標

Cantonの状況を追う場合、価格だけでなく次の公開情報を分けて確認します。

| 分野 | 確認項目 | 注意点 |
|---|---|---|
| ネットワーク | Validator、Super Validator、稼働率、更新 | 数と独立運営主体を分ける |
| 利用 | アプリ数、反復取引、名目取引額、CC焼却 | 実証・自己取引・本番を区別 |
| 供給 | ミント、焼却、流通供給、報酬集中 | 1000億CCを固定上限としない |
| ガバナンス | 提案、投票、パラメータ変更、参加者追加 | 3分の2しきい値と実参加率 |
| 市場 | 取引所別出来高、板、スプレッド、出庫 | 集計出来高と執行可能性は別 |
| 採用 | DTCC、Tradeweb、担保案件の稼働範囲 | 提携、PoC、限定本番、全面本番を区別 |
| 法務 | MiCA、日本の取扱い、資産ごとの権利 | ネットワーク規制と発行資産規制は別 |
| セキュリティ | リリース、監査、脆弱性、障害報告 | 監査対象とバージョンを確認 |

## まとめ

Canton Networkは、規制金融のプライバシーを維持しながら、独立したアプリケーション間で資産と決済を原子的に同期することを主眼とするネットワークです。Damlによる権利・権限モデル、関係者だけにデータを配るValidator、Super Validatorが運営するGlobal Synchronizerという構成は、全面公開型チェーンとも、完全に分断された企業内台帳とも異なります。

Canton Coinは、ネットワーク利用料、アプリ料金、価値移転、貢献報酬を結ぶ公開ユーティリティトークンです。最初の10年に1000億CCをミントでき、その後も年25億CCの枠が続くため、固定供給資産ではありません。Burn-Mint Equilibriumは利用と供給を結びつけますが、市場価格の固定や上昇を保証しません。CCを使わずに第三者経由でトラフィック残高を調達できる点も、ネットワーク活動とCC市場需要の関係を評価する上で重要です。

DTCC、Tradeweb、Franklin Templeton、Virtu Financial、日本国債担保PoC等は具体的な進展ですが、案件ごとに実証、本番、対象範囲、取引量が異なります。採用ロゴや名目取引額だけでなく、反復利用、CCの実際の焼却、供給増減、ガバナンスの独立性、流動性、法的権利、セキュリティ運用を継続して確認する必要があります。

## 参考資料

### Canton公式・技術

- [Canton Network公式サイト](https://www.canton.network/)
- [Global Synchronizer](https://www.canton.network/global-synchronizer)
- [Canton Network Whitepapers](https://www.canton.network/whitepapers)
- [Canton Coin: A Canton-Network-native payment application](https://www.digitalasset.com/hubfs/Canton%20Network%20Files/Documents%20%28whitepapers%2C%20etc...%29/Canton%20Coin_%20A%20Canton-Network-native%20payment%20application.pdf)
- [Canton Coin: A Responsible Approach to Digital Tokens](https://www.digitalasset.com/hubfs/Canton%20Coin%20A%20Responsible%20Approach%20to%20Digital%20Tokens.pdf)
- [Global SynchronizerとCanton Coinの本番稼働](https://www.canton.network/canton-network-press-releases/the-canton-networks-global-synchronizer-and-canton-coin-go-live)
- [Digital Asset Canton Documentation](https://docs.digitalasset.com/overview/3.4/overview/index.html)
- [Daml Documentation](https://docs.digitalasset.com/build/3.4/)
- [Splice（Hyperledger Labs）](https://github.com/hyperledger-labs/splice)

### ガバナンス・エコシステム

- [Canton Foundation](https://canton.foundation/)
- [Canton Foundationの役割](https://canton.foundation/about-the-foundation/)
- [Canton Validators](https://canton.foundation/validators/)
- [Canton Network Ecosystem](https://www.canton.network/ecosystem)
- [Canton Network Primer](https://www.canton.network/blog/canton-network-primer-8-terms)

### 採用・資金調達

- [DTCCとDigital Assetの米国債トークン化提携](https://www.dtcc.com/news/2025/december/17/dtcc-and-digital-asset-partner-to-tokenize-dtc-custodied-us-treasury-securities)
- [DTCCのTokenization Service開発状況](https://www.dtcc.com/news/2026/may/04/dtcc-advances-development-of-new-tokenization-service)
- [Tradewebのトークン化米国債・USDCx同期決済](https://www.tradeweb.com/newsroom/media-center/news-releases/tradeweb-facilitates-landmark-on-chain-u.s.-treasuries-transaction-on-the-canton-network)
- [日本国債を使うデジタル担保管理PoC](https://blog.digitalasset.com/press-release/launch-of-proof-of-concept-trial-for-digital-collateral-management-using-japanese-government-bonds-jgbs)
- [Digital Assetの2025年1.35億ドル資金調達](https://blog.digitalasset.com/press-release/digital-asset-raises-135-million-to-accelerate-adoption-of-canton-network)
- [Digital Assetの2026年3.55億ドル資金調達](https://blog.digitalasset.com/press-release/digital-asset-355m-funding-canton-capital-markets)
- [Digital Assetプレスリリース一覧](https://blog.digitalasset.com/press-release/all)

### 市場・規制・税務

- [Canton市場データ（CoinGecko）](https://www.coingecko.com/en/coins/canton)
- [Canton市場データ（CoinMarketCap）](https://coinmarketcap.com/currencies/canton-network/)
- [SBI VCトレード：Canton取扱い開始のお知らせ](https://www.sbivc.co.jp/newsview/4ji6fu9b63q)
- [SBI VCトレード：取扱暗号資産](https://www.sbivc.co.jp/services/handling-crypto-assets)
- [SBI VCトレード：Cantonの解説とMiCA対応状況](https://www.sbivc.co.jp/columns/content/4_gewkthgn)
- [OKJ：カントンコイン（CC）の取扱い開始](https://support.okj.com/hc/ja/articles/59887403461273)
- [暗号資産交換業者登録一覧（金融庁）](https://www.fsa.go.jp/menkyo/menkyoj/kasoutuka.pdf)
- [暗号資産の税務上の取扱い（国税庁）](https://www.nta.go.jp/publication/pamph/shotoku/kakuteishinkokukankei/kasoutuka/)
- [EU Markets in Crypto-Assets Regulation](https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=CELEX%3A32023R1114)
- [MiCAホワイトペーパー標準様式](https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=OJ%3AL_202402984)

### 比較資料

- [Ethereum Documentation](https://ethereum.org/en/developers/docs/)
- [Avalanche Documentation](https://build.avax.network/docs)
- [XDC Network Documentation](https://docs.xdc.community/)

## 免責事項

本記事は情報提供のみを目的としており、特定の暗号資産の売買・保有を勧誘または推奨する投資助言ではありません。公開情報をもとに可能な限り正確な記載に努めていますが、完全性・正確性・最新性を保証するものではありません。将来の記述やシナリオは成果を保証しません。暗号資産には元本の全部を失う可能性があり、税務・法務上の取扱いも居住地や利用方法により異なります。利用前に最新の公式情報と専門家の助言を確認してください。
