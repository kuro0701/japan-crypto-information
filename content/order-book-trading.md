---
title: 板取引とは？
description: 暗号資産取引所の板取引について、注文板、成行注文、指値注文、板の厚み、スリッページの見方を初心者向けに整理します。
date: 2026-04-29
updated: 2026-05-02
author: 国内暗号資産取引所ナビ
slug: order-book-trading
path: /learn/order-book-trading
---

板取引とは、取引所の<span class="article-term article-term--always" data-term-key="orderbook" data-term-always="true">注文板</span>に並んでいる売り注文と買い注文を相手に売買する方式です。販売所のように交換業者が提示する価格で買うのではなく、他のユーザーが出している注文と<span class="article-term article-term--always" data-term-key="execution" data-term-always="true">約定</span>します。

注文板には、価格ごとに「いくらで、どれだけ売りたいか」「いくらで、どれだけ買いたいか」が並びます。この数量が厚いほど、大きめの注文でも平均約定価格がずれにくくなります。

<section class="orderbook-learning-hero" data-orderbook-live-demo aria-labelledby="orderbook-learning-hero-title">
  <div class="orderbook-learning-hero__copy">
    <span class="orderbook-learning-hero__eyebrow">Interactive book</span>
    <h2 id="orderbook-learning-hero-title">板は「売りたい人」と「買いたい人」の待ち行列です</h2>
    <p>中央に近い価格ほど、次に約定しやすい注文です。数量が厚い価格帯はバーが長く表示されます。</p>
  </div>
  <div class="orderbook-learning-hero__book" aria-label="BTC/JPYのダミー注文板">
    <div class="orderbook-learning-hero__book-head">
      <span>売り注文</span>
      <strong>価格 / 数量</strong>
    </div>
    <div class="orderbook-learning-hero__rows orderbook-learning-hero__rows--ask" data-orderbook-demo-asks></div>
    <div class="orderbook-learning-hero__spread">
      <span>スプレッド</span>
      <strong data-orderbook-demo-spread>500円</strong>
    </div>
    <div class="orderbook-learning-hero__rows orderbook-learning-hero__rows--bid" data-orderbook-demo-bids></div>
    <div class="orderbook-learning-hero__book-head">
      <span>買い注文</span>
      <strong>価格 / 数量</strong>
    </div>
  </div>
</section>

## 板で見るポイント

まず見るべきなのは、<span class="article-term article-term--always" data-term-key="best-ask" data-term-always="true">最良売気配</span>、<span class="article-term article-term--always" data-term-key="best-bid" data-term-always="true">最良買気配</span>、そしてその周辺にどれだけ数量があるかです。

買う場合は、安い売り注文から順に約定します。最良売気配の数量だけで足りないと、次の高い価格の売り注文まで約定が進みます。売る場合はその逆で、高い買い注文から順に約定します。

## 成行注文と指値注文

<section class="orderbook-execution-sim" data-orderbook-execution-sim data-beginner-focus="true" data-beginner-spotlight="true" aria-labelledby="orderbook-execution-sim-title">
  <div class="orderbook-execution-sim__header">
    <div>
      <span class="orderbook-execution-sim__eyebrow">Market vs Limit</span>
      <h3 id="orderbook-execution-sim-title">注文金額を動かして、板が削られる感覚を見ます</h3>
    </div>
    <div class="orderbook-execution-sim__mode" role="group" aria-label="注文方法">
      <button type="button" class="is-active" data-orderbook-sim-mode="market" aria-pressed="true">成行</button>
      <button type="button" data-orderbook-sim-mode="limit" aria-pressed="false">指値</button>
    </div>
  </div>
  <div class="orderbook-execution-sim__body">
    <div class="orderbook-execution-sim__control">
      <label for="orderbook-sim-amount">注文金額 <strong data-orderbook-sim-amount-label>100,000円</strong></label>
      <input id="orderbook-sim-amount" type="range" min="25000" max="300000" step="25000" value="100000" data-orderbook-sim-amount>
      <p data-orderbook-sim-note>成行買いは、安い売り注文から順番に数量を消費します。</p>
    </div>
    <div class="orderbook-execution-sim__summary" aria-live="polite">
      <span data-orderbook-sim-kicker>成行買いの平均約定価格</span>
      <strong data-orderbook-sim-result>10,004,004円</strong>
      <small data-orderbook-sim-detail>最良売気配から +0.04% / 2段目まで約定</small>
    </div>
  </div>
  <div class="orderbook-execution-sim__book" data-orderbook-sim-levels aria-label="成行注文で消費される売り注文"></div>
</section>

<span class="article-term article-term--always" data-term-key="market-order" data-term-always="true">成行注文</span>は、価格を指定せずにすぐ約定させる注文です。約定しやすい一方、板が薄いと平均約定価格が不利になりやすくなります。

<span class="article-term article-term--always" data-term-key="limit-order" data-term-always="true">指値注文</span>は、価格を指定して板に注文を置く方法です。希望価格で売買できる可能性がありますが、相場が届かなければ約定しないことがあります。

## 板取引のコスト

板取引では、取引手数料だけでなく、注文サイズによる価格ずれも実質コストとして見ます。この価格ずれは <span class="article-term article-term--always" data-term-key="slippage" data-term-always="true">スリッページ</span> と呼ばれます。

同じ BTC 10万円分の買い注文でも、取引所や時間帯によって板の厚みが違えば、平均約定価格も変わります。

## 実際に確認する

[取引コスト計算（板シミュレーター）](/simulator?market=BTC-JPY&side=buy&amountType=jpy&amount=100000) では、公開板をもとに、成行注文時の平均約定価格、手数料込みの実効コスト、マーケットインパクトを確認できます。最初は [10万円分買うときに見るべきポイント](/learn/buying-100k-points) の順番で確認すると迷いにくくなります。

販売所で買う場合との違いを整理したい場合は、[販売所と取引所の違い](/learn/exchange-vs-broker) と [販売所スプレッド比較](/sales-spread?instrumentId=BTC-JPY) もあわせて確認してください。

<section class="orderbook-mini-quiz" data-orderbook-mini-quiz aria-labelledby="orderbook-mini-quiz-title">
  <span class="orderbook-mini-quiz__eyebrow">理解度チェック</span>
  <h2 id="orderbook-mini-quiz-title">今すぐ確実に買いたい時に使う注文方法は？</h2>
  <div class="orderbook-mini-quiz__choices" role="group" aria-label="回答を選ぶ">
    <button type="button" data-quiz-answer="market">成行注文</button>
    <button type="button" data-quiz-answer="limit">指値注文</button>
  </div>
  <p class="orderbook-mini-quiz__result" data-quiz-result aria-live="polite">答えを選ぶと、次に試すアクションが表示されます。</p>
  <a class="orderbook-mini-quiz__cta" href="/simulator?market=BTC-JPY&side=buy&amountType=jpy&amount=100000" data-quiz-cta hidden>正解。板シミュレーターで10万円買いを試す</a>
</section>
