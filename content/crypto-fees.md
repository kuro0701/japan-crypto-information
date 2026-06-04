---
title: 暗号資産の手数料の見方
description: 暗号資産の取引手数料、販売所スプレッド、入出金手数料、maker・taker の違いを初心者向けに整理します。
date: 2026-04-29
updated: 2026-06-05
author: 国内暗号資産取引所ナビ
slug: crypto-fees
path: /learn/crypto-fees
---

暗号資産取引所を比較するとき、手数料だけを見ても実質コストは分かりません。取引手数料、販売所<span class="article-term" data-term-key="sales-spread">スプレッド</span>、入出金手数料、送金手数料、キャンペーン条件を分けて見る必要があります。

特に「取引手数料無料」という表示を見ると安く感じますが、販売所では [スプレッド](/learn/spread) が実質コストになることがあります。取引所では、手数料に加えて [スリッページ](/learn/slippage) も確認が必要です。

<div class="quick-recommendation-grid" aria-label="目的別のクイックおすすめ">
  <a class="quick-recommendation-card quick-recommendation-card--free" href="#jpy-withdrawal-fee-comparison">
    <span class="quick-recommendation-card__icon" aria-hidden="true">🏆</span>
    <span>とにかく手数料無料にこだわるなら</span>
    <strong>GMOコイン</strong>
    <small>通常の日本円出金は無料。<span class="article-term" data-term-key="large-withdrawal">大口出金</span>は条件を確認。</small>
  </a>
  <a class="quick-recommendation-card quick-recommendation-card--bank" href="#jpy-withdrawal-fee-comparison">
    <span class="quick-recommendation-card__icon" aria-hidden="true">🏦</span>
    <span>三井住友銀行ユーザーなら</span>
    <strong>bitFlyer</strong>
    <small>3万円未満なら 220円、3万円以上なら 440円。</small>
  </a>
  <a class="quick-recommendation-card quick-recommendation-card--pay" href="#jpy-withdrawal-fee-comparison">
    <span class="quick-recommendation-card__icon" aria-hidden="true">📱</span>
    <span>PayPay経済圏なら</span>
    <strong>Binance Japan</strong>
    <small>PayPayマネー連携の出金は 110円/回。</small>
  </a>
</div>

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

<span id="jpy-withdrawal-fee-comparison"></span>

## 日本円出金手数料のリアルタイム比較

日本円を銀行口座やPayPayマネーへ戻す予定がある場合は、出金先銀行や出金額によって手数料が変わることがあります。下の比較は、主要取引所の公式公開ページで確認できる範囲をもとに、出金額と銀行条件に合わせて安い順に並び替えます。確認日は 2026年6月5日です。

<section class="jpy-withdrawal-tool" data-jpy-withdrawal-tool aria-labelledby="jpy-withdrawal-tool-title">
  <div class="jpy-withdrawal-tool__header">
    <div>
      <p class="fee-visual__eyebrow">JPY Withdrawal</p>
      <h3 id="jpy-withdrawal-tool-title">出金額を入れると、手数料が安い順に並びます</h3>
    </div>
    <p data-jpy-withdrawal-updated>公式公開情報をもとにした参考比較。出金前は公式画面で最終確認してください。</p>
  </div>

  <div class="jpy-withdrawal-beginner beginner-only" aria-label="初心者向けの出金注意点">
    <div class="jpy-withdrawal-beginner__item">
      <span>1</span>
      <strong>口座名義を合わせる</strong>
      <small>取引所の登録名義と出金先口座の名義が違うと、出金できない場合があります。</small>
    </div>
    <div class="jpy-withdrawal-beginner__item">
      <span>2</span>
      <strong>手数料と最低金額を見る</strong>
      <small>少額では固定手数料の影響が大きく、PayPay連携などは下限額もあります。</small>
    </div>
    <div class="jpy-withdrawal-beginner__item">
      <span>3</span>
      <strong>確定画面で確認する</strong>
      <small>金融機関メンテナンス、残高不足、登録情報不備で条件が変わることがあります。</small>
    </div>
  </div>

  <div class="jpy-withdrawal-controls">
    <label class="jpy-withdrawal-field">
      <span>出金したい金額</span>
      <span class="jpy-withdrawal-field__control">
        <span aria-hidden="true">¥</span>
        <input data-jpy-withdrawal-amount type="text" inputmode="numeric" autocomplete="off" value="50,000" aria-describedby="jpy-withdrawal-help">
      </span>
    </label>
    <div class="jpy-withdrawal-bank-filter" role="radiogroup" aria-label="出金先銀行">
      <button type="button" data-jpy-withdrawal-bank="smbc" aria-pressed="true">三井住友銀行を使う</button>
      <button type="button" data-jpy-withdrawal-bank="other" aria-pressed="false">それ以外の銀行を使う</button>
    </div>
  </div>
  <p id="jpy-withdrawal-help" class="jpy-withdrawal-help">bitFlyer は出金先銀行で手数料が変わります。Binance Japan は PayPayマネー連携の条件を表示します。</p>

  <output class="jpy-withdrawal-summary" data-jpy-withdrawal-summary aria-live="polite"></output>

  <div class="jpy-withdrawal-table-shell">
    <table class="jpy-withdrawal-table" data-jpy-withdrawal-table>
      <thead>
        <tr>
          <th scope="col">順位</th>
          <th scope="col">取引所</th>
          <th scope="col">手数料</th>
          <th scope="col">受取目安</th>
          <th scope="col">条件</th>
          <th scope="col">公式確認先</th>
        </tr>
      </thead>
      <tbody data-jpy-withdrawal-body>
        <tr><td colspan="6">手数料データを読み込み中です。</td></tr>
      </tbody>
    </table>
  </div>
</section>

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
