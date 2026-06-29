---
title: 失敗しない取引所の選び方と口座開設ガイド
description: 暗号資産取引所で口座開設する前に確認したい、取扱銘柄、販売所と取引所の対応、板の厚み、手数料、入出金、運営会社、キャンペーン条件を整理します。
date: 2026-05-02
updated: 2026-05-07
author: 国内暗号資産取引所ナビ
slug: exchange-checklist
path: /learn/exchange-checklist
---

暗号資産取引所を選ぶときは、有名かどうかやキャンペーンだけで決めるより、自分が買う銘柄と注文方法に合っているかを確認するほうが大切です。

このチェックリストは、初めて口座を作る前、または複数の取引所を使い分ける前に見るためのものです。最終判断は、必ず各取引所の公式手数料表、利用規約、リスク説明、最新のお知らせで確認してください。

<section class="exchange-checklist-hero" aria-label="取引所選びの確認フロー">
  <div>
    <span class="checklist-kicker">7 point flow</span>
    <h2>選ぶ順番は「銘柄 → 注文方法 → コスト → 条件」</h2>
    <p>キャンペーンや知名度を見る前に、実際に買う銘柄と注文金額で不利にならないかを先に確認します。</p>
  </div>
  <div class="checklist-hero-steps" aria-label="確認順">
    <span data-beginner-focus="true">銘柄</span>
    <span>注文方法</span>
    <span>板・出来高</span>
    <span>手数料</span>
    <span>入出金</span>
    <span>運営情報</span>
    <span>特典条件</span>
  </div>
</section>

## 1. 買いたい銘柄を扱っているか

まず、買いたい銘柄がその取引所で扱われているかを確認します。同じ BTC や ETH でも、販売所だけで扱う場合、取引所の板でも扱う場合、入出庫に対応している場合で使い勝手が変わります。

[銘柄ページ一覧](/markets) では、銘柄ごとに対応取引所、板、出来高、販売所スプレッドを確認できます。

<aside class="checklist-callout checklist-callout--important" data-beginner-focus="true">
  <span aria-hidden="true">💡</span>
  <strong>ココが重要</strong>
  <p>まず「買いたい銘柄があるか」を確認します。手数料が安くても、目的の銘柄が販売所だけならコストの見え方が変わります。</p>
</aside>

## 2. 販売所と取引所のどちらで買えるか

販売所は操作が簡単ですが、<span class="article-term article-term--always" data-term-key="sales-spread" data-term-always="true" data-beginner-label="＝価格差">スプレッド</span>が実質コストになります。取引所は板取引でコストを細かく見やすい一方、板の厚みや注文方法を理解する必要があります。

まず [販売所と取引所の違い](/learn/exchange-vs-broker) を確認し、自分が使う注文方法を決めてから比較します。

<section class="checklist-compare-visual" aria-labelledby="broker-exchange-visual-title">
  <div class="checklist-visual-heading">
    <span class="checklist-kicker">Visual compare</span>
    <h3 id="broker-exchange-visual-title">販売所と取引所は「相手」と「コストの見え方」が違う</h3>
  </div>
  <div class="checklist-compare-grid">
    <article class="checklist-compare-card checklist-compare-card--broker">
      <span class="checklist-compare-card__badge">販売所</span>
      <div class="checklist-flow" aria-hidden="true">
        <span>あなた</span>
        <strong>表示価格で買う</strong>
        <span>取引所会社</span>
      </div>
      <dl>
        <div><dt>向いている</dt><dd>少額で迷わず買いたい</dd></div>
        <div><dt>注意点</dt><dd>スプレッドが実質コスト</dd></div>
      </dl>
    </article>
    <article class="checklist-compare-card checklist-compare-card--exchange">
      <span class="checklist-compare-card__badge">取引所</span>
      <div class="checklist-flow" aria-hidden="true">
        <span>あなた</span>
        <strong>板の注文と約定</strong>
        <span>他の参加者</span>
      </div>
      <dl>
        <div><dt>向いている</dt><dd>コストを細かく見たい</dd></div>
        <div><dt>注意点</dt><dd>板が薄いと価格が動く</dd></div>
      </dl>
    </article>
  </div>
</section>

## 3. 板の厚みと出来高は十分か

取引所形式で買う場合は、板の厚みと出来高を見ます。板が薄いと、少し大きめの成行注文でも平均約定価格が不利になることがあります。

[取引コスト計算（板シミュレーター）](/simulator?market=BTC-JPY&side=buy&amountType=jpy&amount=100000) で10万円買いを試し、<span class="article-term article-term--always" data-term-key="impact" data-term-always="true" data-beginner-label="＝板への影響">Impact</span>や<span class="article-term article-term--always" data-term-key="effective-cost" data-term-always="true" data-beginner-label="＝実際に近いコスト">実効コスト</span>が極端に悪化しないか確認してください。流動性の集中先は [出来高シェア](/volume-share?instrumentId=BTC-JPY) でも確認できます。

<section class="checklist-book-visual" aria-labelledby="book-depth-visual-title">
  <div class="checklist-visual-heading">
    <span class="checklist-kicker">Order book depth</span>
    <h3 id="book-depth-visual-title">板が厚いほど、大きめの注文でも平均価格が崩れにくい</h3>
  </div>
  <div class="checklist-book-grid">
    <article class="checklist-book-card checklist-book-card--thin">
      <strong>板が薄い</strong>
      <div class="checklist-depth-bars" aria-label="薄い板の例">
        <span style="--depth: 26%">売 0.002 BTC</span>
        <span style="--depth: 38%">売 0.004 BTC</span>
        <span style="--depth: 52%">売 0.006 BTC</span>
      </div>
      <small>注文が数段にまたがり、平均約定価格が上がりやすい。</small>
    </article>
    <article class="checklist-book-card checklist-book-card--thick">
      <strong>板が厚い</strong>
      <div class="checklist-depth-bars" aria-label="厚い板の例">
        <span style="--depth: 78%">売 0.020 BTC</span>
        <span style="--depth: 88%">売 0.032 BTC</span>
        <span style="--depth: 70%">売 0.018 BTC</span>
      </div>
      <small>近い価格帯で約定しやすく、Impactが小さくなりやすい。</small>
    </article>
  </div>
</section>

<aside class="checklist-callout checklist-callout--risk">
  <span aria-hidden="true">⚠️</span>
  <strong>失敗リスク</strong>
  <p>「取引所形式だから安い」と決めつけず、実際の注文金額で板を確認します。少額では平気でも、金額を上げると結果が変わります。</p>
</aside>

## 4. 手数料とスプレッドを分けて見たか

取引所形式では <span class="article-term article-term--always" data-term-key="maker-fee" data-term-always="true" data-beginner-label="＝板に置く側">maker</span> / <span class="article-term article-term--always" data-term-key="taker-fee" data-term-always="true" data-beginner-label="＝板を取る側">taker</span> 手数料、販売所形式では<span class="article-term article-term--always" data-term-key="sales-spread" data-term-always="true" data-beginner-label="＝価格差">スプレッド</span>、入出金では銀行振込や出金手数料、暗号資産送金ではネットワークごとの手数料を見ます。

手数料の種類から整理したい場合は [暗号資産の手数料の見方](/learn/crypto-fees) を確認してください。

<section class="fee-mini-sim" data-fee-mini-sim aria-labelledby="checklist-cost-sim-title">
  <div class="fee-mini-sim__header">
    <span class="checklist-kicker">Inline simulator</span>
    <h3 id="checklist-cost-sim-title">購入予定金額で概算コストをつかむ</h3>
    <p>目安率を使った簡易計算です。最終判断はリンク先の板シミュレーターと公式画面で確認してください。</p>
  </div>
  <div class="fee-mini-sim__controls">
    <label class="fee-mini-sim__field">
      <span>購入予定金額</span>
      <input type="number" inputmode="numeric" min="1000" step="1000" value="100000" data-fee-sim-amount>
    </label>
    <div class="fee-mini-sim__modes" role="group" aria-label="試算方法">
      <button type="button" class="is-active" data-fee-sim-mode="broker">販売所</button>
      <button type="button" data-fee-sim-mode="exchange">取引所</button>
    </div>
  </div>
  <div class="fee-mini-sim__result" aria-live="polite">
    <span data-fee-sim-label>販売所の概算</span>
    <strong data-fee-sim-total>約 1,500円</strong>
    <small data-fee-sim-note>スプレッド目安 1.5% として試算</small>
  </div>
  <a class="fee-mini-sim__link" href="/simulator?market=BTC-JPY&side=buy&amountType=jpy&amount=100000">板シミュレーターで詳しく確認する ↗</a>
</section>

<p class="checklist-inline-cta">
  <a href="/learn/crypto-fees">手数料の比較表を見る ↗</a>
</p>

## 5. 入出金と送金の条件は合っているか

日本円の入金、出金、暗号資産の入庫、出庫に対応しているかを確認します。少額で買うだけなら気にならなくても、外部ウォレットへ送金する、他のサービスへ移す、頻繁に出金する場合は重要です。

特に暗号資産の送金は、銘柄、ネットワーク、最小出庫数量、出庫手数料、メンテナンス状況を公式画面で確認します。

日本円を戻すときのコストを先に見たい場合は、[日本円出金手数料の比較](/learn/jpy-withdrawal-fees) で各社の固定手数料、出金額による分岐、出金先銀行による違いを確認してください。外部ウォレットへ送る予定がある場合は、[暗号資産出金手数料の比較](/learn/crypto-withdrawal-fees) で代表銘柄ごとの条件も確認できます。

<p class="checklist-inline-cta">
  <a href="/learn/jpy-withdrawal-fees">日本円出金手数料を見る ↗</a>
  <a href="/learn/crypto-withdrawal-fees">暗号資産出金手数料を見る ↗</a>
</p>

## 6. 運営会社と開示情報を確認したか

長く使うなら、運営会社、登録情報、財務公告、セキュリティ方針、障害時のお知らせも見ます。

見る順番は [取引所の財務・運営会社分析の見方](/learn/exchange-company-analysis) にまとめています。キャンペーンや知名度だけでなく、通常時に安心して使えるかを確認してください。

## 7. キャンペーン条件を最後に見たか

キャンペーンは魅力的ですが、対象者、条件、期間、付与時期、除外条件があります。通常時のスプレッドや手数料が高い場合、特典だけで有利とは限りません。

先に通常時のコストを見てから、最後に [キャンペーン一覧](/campaigns) で条件を確認すると判断しやすくなります。

## チェックリストまとめ

<section class="interactive-checklist" data-exchange-checklist aria-labelledby="interactive-checklist-title">
  <div class="interactive-checklist__header">
    <div>
      <span class="checklist-kicker">Tap to check</span>
      <h3 id="interactive-checklist-title">口座開設前の7点チェック</h3>
    </div>
    <strong data-checklist-count>0 / 7</strong>
  </div>
  <div class="interactive-checklist__meter" aria-hidden="true"><span data-checklist-progress></span></div>
  <div class="interactive-checklist__items">
    <label><input type="checkbox" data-checklist-item><span>買いたい銘柄を扱っている。</span></label>
    <label><input type="checkbox" data-checklist-item><span>販売所と取引所のどちらで買えるか分かる。</span></label>
    <label><input type="checkbox" data-checklist-item><span>10万円買いで板の厚みとImpactを確認した。</span></label>
    <label><input type="checkbox" data-checklist-item><span>販売所スプレッドを確認した。</span></label>
    <label><input type="checkbox" data-checklist-item><span>maker / taker 手数料、入出金、送金手数料を確認した。</span></label>
    <label><input type="checkbox" data-checklist-item><span>運営会社、登録情報、開示情報を確認した。</span></label>
    <label><input type="checkbox" data-checklist-item><span>キャンペーン条件を通常時コストと分けて確認した。</span></label>
  </div>
  <div class="interactive-checklist__complete" data-checklist-complete hidden>
    <strong>準備完了です。</strong>
    <span>次は買いたい銘柄から、対応取引所とコストを絞り込みます。</span>
    <a href="/markets">銘柄ページで候補を絞る ↗</a>
  </div>
</section>

この7つを埋めてから選ぶと、「手数料無料」「有名」「キャンペーンがある」だけで決めるより、自分の使い方に合う取引所を選びやすくなります。
