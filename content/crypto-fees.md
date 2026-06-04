---
title: 暗号資産の手数料の見方
description: 暗号資産の取引手数料、販売所スプレッド、入出金手数料、maker・taker の違いを初心者向けに整理します。
date: 2026-04-29
updated: 2026-06-03
author: 国内暗号資産取引所ナビ
slug: crypto-fees
path: /learn/crypto-fees
---

暗号資産取引所を比較するとき、手数料だけを見ても実質コストは分かりません。取引手数料、販売所<span class="article-term" data-term-key="sales-spread">スプレッド</span>、入出金手数料、送金手数料、キャンペーン条件を分けて見る必要があります。

特に「取引手数料無料」という表示を見ると安く感じますが、販売所では [スプレッド](/learn/spread) が実質コストになることがあります。取引所では、手数料に加えて [スリッページ](/learn/slippage) も確認が必要です。

<div class="fee-summary-strip" aria-label="暗号資産の実質コストを見る3つの入口">
  <div class="fee-summary-item">
    <span>01</span>
    <strong>明示手数料</strong>
    <small>maker / taker、入出金、送金手数料</small>
  </div>
  <div class="fee-summary-item">
    <span>02</span>
    <strong>価格差</strong>
    <small>販売所スプレッド、板の売買差</small>
  </div>
  <div class="fee-summary-item">
    <span>03</span>
    <strong>約定のずれ</strong>
    <small>スリッページ、板の厚み、注文サイズ</small>
  </div>
</div>

## まず見るべき手数料

最初に確認したいのは、取引所形式の <span class="article-term" data-term-key="maker">maker</span> 手数料と <span class="article-term" data-term-key="taker">taker</span> 手数料です。

<section class="fee-visual fee-visual--maker-taker" aria-labelledby="maker-taker-visual-title">
  <div class="fee-visual__copy">
    <p class="fee-visual__eyebrow">Maker / Taker</p>
    <h3 id="maker-taker-visual-title">maker は板に置く、taker は板から取る</h3>
    <p><span class="article-term" data-term-key="maker">maker</span> は、板に新しく注文を置く側です。<span class="article-term" data-term-key="taker">taker</span> は、すでに板にある注文にぶつけて約定する側です。成行注文は基本的に taker として扱われます。</p>
  </div>
  <div class="orderbook-visual" aria-hidden="true">
    <div class="orderbook-visual__book">
      <div class="orderbook-visual__row orderbook-visual__row--ask"><span>売り</span><strong>10,042,000</strong></div>
      <div class="orderbook-visual__row orderbook-visual__row--ask"><span>売り</span><strong>10,041,000</strong></div>
      <div class="orderbook-visual__mid">板</div>
      <div class="orderbook-visual__row orderbook-visual__row--bid"><span>買い</span><strong>10,039,000</strong></div>
      <div class="orderbook-visual__row orderbook-visual__row--bid"><span>買い</span><strong>10,038,000</strong></div>
    </div>
    <div class="orderbook-visual__actions">
      <div class="orderbook-visual__actor orderbook-visual__actor--maker"><strong>maker</strong><span>指値を置く</span></div>
      <div class="orderbook-visual__actor orderbook-visual__actor--taker"><strong>taker</strong><span>成行で取る</span></div>
    </div>
  </div>
</section>

このサイトの取引コスト計算（板シミュレーター）では、各取引所の既定 taker 手数料を使って参考計算します。条件によって実際の手数料が変わる場合があるため、最終確認は各取引所の公式手数料表で行ってください。

<aside class="article-mode-note beginner-only">
  <strong>初心者モードの要点</strong>
  <span>最初は「成行注文を使うなら taker 手数料」と覚えるだけで十分です。maker は指値注文で板に注文を置くときに出てくる用語です。</span>
</aside>

<aside class="article-mode-note article-mode-note--advanced advanced-only">
  <strong>中上級者向けメモ</strong>
  <span>taker 手数料が低くても、板の厚みが薄いとマーケットインパクトで実効コストが悪化します。注文サイズごとの板消化量も合わせて見ます。</span>
</aside>

## 販売所スプレッドも手数料のように見る

販売所では、取引手数料とは別に買値と売値の差があります。この差は明細上の手数料として表示されない場合がありますが、買う人にとっては実質コストです。

販売所を使う場合は、購入前に [販売所スプレッド比較](/sales-spread?instrumentId=BTC-JPY) を確認してください。現在スプレッドだけでなく、24時間平均や7日平均も見ると、今だけ広いのか、普段から広いのかが分かりやすくなります。

<section class="fee-cost-compare" aria-labelledby="fee-cost-compare-title">
  <div class="fee-cost-compare__header">
    <p class="fee-visual__eyebrow">Cost Structure</p>
    <h3 id="fee-cost-compare-title">販売所と取引所では、見落としやすいコストが違います</h3>
  </div>
  <div class="fee-cost-grid">
    <article class="fee-cost-card fee-cost-card--broker">
      <span class="fee-cost-card__badge">販売所</span>
      <h4>表示は簡単。隠れやすいのはスプレッド</h4>
      <dl>
        <div><dt>見えるコスト</dt><dd>取引手数料無料の表示が多い</dd></div>
        <div><dt>見落としやすいコスト</dt><dd>買値と売値の差</dd></div>
        <div><dt>確認先</dt><dd>現在、24時間平均、7日平均のスプレッド</dd></div>
      </dl>
    </article>
    <article class="fee-cost-card fee-cost-card--exchange">
      <span class="fee-cost-card__badge">取引所</span>
      <h4>手数料は見える。約定のずれも確認</h4>
      <dl>
        <div><dt>見えるコスト</dt><dd>maker / taker 手数料</dd></div>
        <div><dt>見落としやすいコスト</dt><dd>スリッページと板の厚み</dd></div>
        <div><dt>確認先</dt><dd>注文サイズ別の平均約定価格</dd></div>
      </dl>
    </article>
  </div>
</section>

## 入出金と送金の手数料

暗号資産を買うコストだけでなく、日本円の入金、出金、暗号資産の送金にも手数料がかかる場合があります。頻繁に入出金する人や、外部ウォレットへ送金する人はここも大切です。

比較するときは、1回の売買だけでなく、口座へ入金して、買って、必要なら送金または出金するまでの総コストで考えると現実に近くなります。

日本円を銀行口座などへ戻す予定がある場合は、出金先銀行や出金額によって手数料が変わることがあります。主要取引所ごとの条件は [日本円出金手数料の比較](/learn/jpy-withdrawal-fees) にまとめています。

暗号資産を外部ウォレットや他サービスへ移す予定がある場合は、銘柄とネットワークごとの出金手数料が重要です。主要取引所の全銘柄比較は [暗号資産出金手数料の比較](/learn/crypto-withdrawal-fees) で確認できます。

## 比較の順番

手数料を見るときは、次の順番が実用的です。

<div class="fee-step-list" role="list" aria-label="手数料を比較する順番">
  <div class="fee-step" role="listitem">
    <span class="fee-step__number">1</span>
    <div><strong>取引所形式の maker / taker 手数料を見る</strong><small>成行注文を使うなら taker 手数料から確認します。</small></div>
  </div>
  <div class="fee-step" role="listitem">
    <span class="fee-step__number">2</span>
    <div><strong>販売所を使うならスプレッドを見る</strong><small>無料表示でも、買値と売値の差が実質コストになります。</small></div>
  </div>
  <div class="fee-step" role="listitem">
    <span class="fee-step__number">3</span>
    <div><strong>成行注文なら板の厚みとスリッページを見る</strong><small>注文サイズが大きいほど、平均約定価格がずれやすくなります。</small></div>
  </div>
  <div class="fee-step" role="listitem">
    <span class="fee-step__number">4</span>
    <div><strong>入金、<a href="/learn/jpy-withdrawal-fees">日本円出金</a>、<a href="/learn/crypto-withdrawal-fees">暗号資産出金</a>を見る</strong><small>売買以外の固定費まで含めると、実際の負担に近づきます。</small></div>
  </div>
  <div class="fee-step" role="listitem">
    <span class="fee-step__number">5</span>
    <div><strong>キャンペーン条件が実質コストを下げるか確認する</strong><small>特典額だけでなく、達成条件と通常時のコストを分けて見ます。</small></div>
  </div>
</div>

## 実際に確認する

[取引コスト計算（板シミュレーター）](/simulator?market=BTC-JPY&side=buy&amountType=jpy&amount=100000) では、手数料を含めた成行注文の参考コストを確認できます。手数料率を手動で入力すると、会員ランクやキャンペーン条件を仮定した比較もできます。

<section class="fee-mini-sim" data-fee-mini-sim aria-labelledby="fee-mini-sim-title">
  <div class="fee-mini-sim__header">
    <p class="fee-visual__eyebrow">Quick Check</p>
    <h3 id="fee-mini-sim-title">10万円分買うと、概算コストはいくら？</h3>
    <p>実際の板や販売所価格ではなく、コスト構造をつかむための簡易試算です。</p>
  </div>
  <div class="fee-mini-sim__controls">
    <label class="fee-mini-sim__field">
      <span>購入金額</span>
      <input data-fee-sim-amount type="number" min="1000" max="10000000" step="1000" value="100000" inputmode="numeric">
    </label>
    <div class="fee-mini-sim__modes" role="group" aria-label="試算する注文方法">
      <button type="button" data-fee-sim-mode="broker" class="is-active">販売所</button>
      <button type="button" data-fee-sim-mode="exchange">取引所</button>
    </div>
  </div>
  <output class="fee-mini-sim__result" data-fee-sim-output>
    <span data-fee-sim-label>販売所の概算</span>
    <strong data-fee-sim-total>約 1,500円</strong>
    <small data-fee-sim-note>スプレッド目安 1.5% として試算</small>
  </output>
  <a class="fee-mini-sim__link" href="/simulator?market=BTC-JPY&side=buy&amountType=jpy&amount=100000">実データでシミュレーターを開く</a>
</section>

どの観点から取引所を選ぶかを整理したい場合は、[失敗しない取引所の選び方と口座開設ガイド](/learn/exchange-checklist) へ進んでください。10万円分買う前の具体的な確認順は [10万円分買うときに見るべきポイント](/learn/buying-100k-points) にまとめています。
