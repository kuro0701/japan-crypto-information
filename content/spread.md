---
title: スプレッドとは？
description: 暗号資産取引でよく出てくるスプレッドを、買値と売値の差、販売所コスト、取引所の板スプレッドに分けて説明します。
date: 2026-04-29
updated: 2026-06-28
author: 国内暗号資産取引所ナビ
slug: spread
path: /learn/spread
---

スプレッドとは、買う価格と売る価格の差です。暗号資産では、販売所の買値と売値の差、取引所の<span class="article-term" data-term-key="best-ask">最良売気配</span>と<span class="article-term" data-term-key="best-bid">最良買気配</span>の差のどちらにも使われます。

初心者にとって大事なのは、スプレッドが広いほど、買った直後に同じ場所で売ると不利になりやすいという点です。手数料が無料に見えても、スプレッドが実質的なコストになることがあります。

<aside class="article-mode-note beginner-only">
  <strong>初心者モードの要点</strong>
  <span>スプレッドは、空港の両替レートに近いものです。「買う値段」と「売る値段」の間にある差が、見えにくいコストになります。</span>
</aside>

<aside class="article-mode-note article-mode-note--advanced advanced-only">
  <strong>中上級者向けの確認ポイント</strong>
  <span>販売所は表示価格差、取引所は板スプレッド、taker手数料、スリッページを分けて確認します。実際の発注前は、同じ注文金額で板シミュレーターも見てください。</span>
</aside>

## 販売所のスプレッド

販売所では、交換業者が「この価格で買えます」「この価格で売れます」という価格を提示します。通常、ユーザーが買う価格は高め、売る価格は低めです。

たとえば BTC の買値が 10,100,000 円、売値が 9,900,000 円なら、差額の 200,000 円がスプレッドです。仲値を 10,000,000 円と見ると、スプレッド率は約 2% です。

<section class="spread-visual-card spread-visual-card--broker" aria-labelledby="broker-spread-visual-title">
  <div class="spread-visual-card__copy">
    <span class="spread-visual-card__eyebrow">Broker spread</span>
    <h3 id="broker-spread-visual-title">2%の差は、買った瞬間の不利なスタートになる</h3>
    <p>売値 9,900,000円と買値 10,100,000円の間にあるオレンジの帯がスプレッドです。同じ場所ですぐ売ると、この差が戻ってきません。</p>
  </div>
  <div class="spread-bar-visual" aria-label="売値9,900,000円、買値10,100,000円、スプレッド200,000円">
    <div class="spread-bar-visual__scale">
      <span class="spread-bar-visual__marker spread-bar-visual__marker--sell">
        <small>売値</small>
        <strong>9,900,000円</strong>
      </span>
      <span class="spread-bar-visual__gap">
        <strong>200,000円</strong>
        <small>スプレッド 約2%</small>
      </span>
      <span class="spread-bar-visual__marker spread-bar-visual__marker--buy">
        <small>買値</small>
        <strong>10,100,000円</strong>
      </span>
    </div>
    <div class="spread-bar-visual__loss">
      <span>10万円分なら</span>
      <strong>約 -2,000円</strong>
      <small>口座に入った瞬間のコスト目安</small>
    </div>
  </div>
</section>

このサイトでは、[販売所スプレッド比較](/sales-spread?instrumentId=BTC-JPY) で買値、売値、現在スプレッド、24時間平均、7日平均、30日平均を確認できます。

<section class="spread-mini-calculator" data-spread-cost-slider data-spread-rate="0.02" aria-labelledby="spread-mini-calculator-title">
  <div class="spread-mini-calculator__header">
    <span>Try it</span>
    <h3 id="spread-mini-calculator-title">その場でスプレッド計算</h3>
    <p>スプレッド2%の販売所で買うと、いくら分の不利なスタートになるかを金額で体感できます。</p>
  </div>
  <div class="spread-mini-calculator__body">
    <label class="spread-mini-calculator__range">
      <span>購入金額 <strong data-spread-cost-amount-output>100,000円</strong></span>
      <input type="range" min="10000" max="1000000" step="10000" value="100000" data-spread-cost-amount aria-label="購入金額">
    </label>
    <div class="spread-mini-calculator__result" aria-live="polite">
      <span>スプレッド2%の目安</span>
      <strong data-spread-cost-loss>-2,000円</strong>
      <small data-spread-cost-after>販売所価格が同じ前提の概算です。</small>
    </div>
  </div>
</section>

## 取引所のスプレッド

取引所では、板の一番安い売り注文と一番高い買い注文の差をスプレッドと呼びます。板が厚く、売買が活発な銘柄では、この差が狭くなりやすい傾向があります。

<section class="spread-visual-card spread-visual-card--book" aria-labelledby="exchange-spread-visual-title">
  <div class="spread-visual-card__copy">
    <span class="spread-visual-card__eyebrow">Order book</span>
    <h3 id="exchange-spread-visual-title">取引所では、中央のすき間を見る</h3>
    <p>赤い売り注文と緑の買い注文が中央に向かって並びます。中央に一番近い2本の差が、板のスプレッドです。</p>
  </div>
  <div class="mini-orderbook" aria-label="売り注文と買い注文が中央に向かって並ぶ板の模式図">
    <div class="mini-orderbook__side mini-orderbook__side--ask">
      <div style="--depth: 72%"><span>売り</span><strong>10,012,000</strong></div>
      <div style="--depth: 58%"><span>売り</span><strong>10,006,000</strong></div>
      <div style="--depth: 46%"><span>最良売気配</span><strong>10,002,000</strong></div>
    </div>
    <div class="mini-orderbook__mid">
      <span>板スプレッド</span>
      <strong>4,000円</strong>
    </div>
    <div class="mini-orderbook__side mini-orderbook__side--bid">
      <div style="--depth: 52%"><span>最良買気配</span><strong>9,998,000</strong></div>
      <div style="--depth: 64%"><span>買い</span><strong>9,994,000</strong></div>
      <div style="--depth: 78%"><span>買い</span><strong>9,988,000</strong></div>
    </div>
  </div>
</section>

ただし、取引所ではスプレッドだけで判断できません。大きめの<span class="article-term" data-term-key="market-order">成行注文</span>を出すと、最良価格だけでなく、その奥にある価格帯まで約定することがあります。その結果、平均約定価格がずれることがあります。

この価格のずれは <span class="article-term" data-term-key="slippage">スリッページ</span> と呼ばれます。スプレッドが狭くても、板が薄ければ実効コストは高くなることがあります。

## スプレッドを見るときの注意点

スプレッドは固定ではありません。相場が急に動くと広がることがあり、銘柄や取引所によっても差があります。

比較するときは、現在値だけでなく、短期平均と長期平均も見ると判断しやすくなります。現在だけ狭いのか、いつも狭い傾向なのかで意味が変わるためです。

また、販売所と取引所を比べるときは、販売所は表示価格が全数量に適用されると仮定した参考値、取引所は板に並ぶ数量に応じた参考値として見る必要があります。

## 次に確認する

<div class="spread-next-card-grid">
  <a class="spread-next-card spread-next-card--sales" href="/sales-spread?instrumentId=BTC-JPY">
    <img src="/ogp/sales-spread.png" alt="" loading="lazy">
    <span>Live data</span>
    <strong>BTC/JPY の販売所スプレッドを確認する</strong>
    <small>買値、売値、現在スプレッド、24時間平均、7日平均を実データで見ます。</small>
  </a>
  <a class="spread-next-card spread-next-card--learn" href="/learn/exchange-vs-broker">
    <img src="/ogp/default.png" alt="" loading="lazy">
    <span>Guide</span>
    <strong>販売所と取引所の違いを整理する</strong>
    <small>価格の決まり方を押さえると、販売所スプレッドと取引所板を比べやすくなります。</small>
  </a>
</div>

取引所で同じ金額を買う場合は、[取引コスト計算（板シミュレーター）](/simulator?market=BTC-JPY&side=buy&amountType=jpy&amount=100000) で成行注文時の平均約定価格を確認してください。販売所で損しやすい場面は [初心者が販売所で損しやすい理由](/learn/broker-loss-reasons) にまとめています。
