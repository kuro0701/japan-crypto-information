---
title: 販売所と取引所の違い
description: 暗号資産の販売所と取引所の違いを、価格の決まり方、使いやすさ、スプレッド、板取引の観点から初心者向けに整理します。
date: 2026-04-29
updated: 2026-06-28
author: 国内暗号資産取引所ナビ
slug: exchange-vs-broker
path: /learn/exchange-vs-broker
---

<section class="broker-hero-visual" aria-label="販売所と取引所の概念図">
  <div class="broker-hero-visual__badges" aria-label="この記事の対象">
    <span>約3分で読めます</span>
    <span>対象: これからBTCを買う未経験者</span>
    <span>先に見る: スプレッドと板</span>
  </div>
  <div class="broker-flow-grid" aria-hidden="true">
    <div class="broker-flow broker-flow--shop">
      <div class="broker-flow__node broker-flow__node--source">
        <span>販売所</span>
        <strong>交換業者</strong>
        <small>お店のように価格を提示</small>
      </div>
      <div class="broker-flow__arrow">-></div>
      <div class="broker-flow__node">
        <span>あなた</span>
        <strong>金額入力</strong>
        <small>提示価格で買う</small>
      </div>
    </div>
    <div class="broker-flow broker-flow--book">
      <div class="broker-flow__node broker-flow__node--source">
        <span>取引所</span>
        <strong>板</strong>
        <small>売り手と買い手の注文</small>
      </div>
      <div class="broker-flow__arrow">-></div>
      <div class="broker-flow__node">
        <span>あなた</span>
        <strong>注文を選ぶ</strong>
        <small>ユーザー間で約定</small>
      </div>
    </div>
  </div>
  <p>販売所は「お店から買う」、取引所は「板に並んだ注文から買う」と考えると、価格とコストの違いをつかみやすくなります。</p>
</section>

暗号資産を買う画面には、大きく分けて「販売所」と「取引所」があります。どちらも同じ BTC や ETH を買える場合がありますが、価格の決まり方とコストの見え方が違います。

初心者が最初につまずきやすいのは、販売所の画面では手数料が無料に見えても、買値と売値の差である [スプレッド](/learn/spread) が実質コストになることです。取引所では板に並んでいる注文を相手に売買するため、手数料と [スリッページ](/learn/slippage) を分けて見る必要があります。

<section class="broker-comparison-section" aria-label="販売所と取引所の比較">
  <div class="broker-section-heading">
    <span>Quick compare</span>
    <h2>まず違いを一目で比較</h2>
    <p>結論だけ先に見るなら、便利さは販売所、コストの分解しやすさは取引所が強みです。</p>
  </div>
  <div class="broker-table-scroll-hint" aria-hidden="true">← 横スクロールできます →</div>
  <div class="broker-table-wrap">
    <table class="broker-compare-table">
      <thead>
        <tr>
          <th scope="col">比較軸</th>
          <th scope="col">販売所</th>
          <th scope="col">取引所</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <th scope="row">売買の相手</th>
          <td>暗号資産交換業者が提示する価格で売買</td>
          <td>板に並ぶユーザー同士の注文で売買</td>
        </tr>
        <tr>
          <th scope="row">見落としやすいコスト</th>
          <td>買値と売値の差であるスプレッド</td>
          <td>taker 手数料、板スプレッド、スリッページ</td>
        </tr>
        <tr>
          <th scope="row">難易度</th>
          <td>低い。購入金額を入れて進めやすい</td>
          <td>やや高い。板の厚みと注文方法を見る</td>
        </tr>
        <tr>
          <th scope="row">操作性</th>
          <td>1タップ購入に近く、初心者でも迷いにくい</td>
          <td>成行・指値などを選び、約定価格を確認する</td>
        </tr>
        <tr>
          <th scope="row">おすすめな人</th>
          <td>少額でまず体験したい人、操作の簡単さを重視する人</td>
          <td>実質コストを比較したい人、少し大きめの金額を買う人</td>
        </tr>
      </tbody>
    </table>
  </div>
</section>

<section class="broker-choice" data-broker-choice-tool aria-label="あなたに合う買い方のクイック診断">
  <div class="broker-section-heading">
    <span>Quick check</span>
    <h2>あなたに合うのはどっち？</h2>
    <p>迷ったら、今の目的に近いほうを選んでから実データで確認してください。</p>
  </div>
  <div class="broker-choice__buttons" role="group" aria-label="重視するポイント">
    <button type="button" data-broker-choice="easy" aria-pressed="false">1タップで楽に買いたい</button>
    <button type="button" data-broker-choice="cost" aria-pressed="false">1円でもコストを抑えたい</button>
  </div>
  <output class="broker-choice__result" data-broker-choice-result aria-live="polite">
    <span>選択待ち</span>
    <strong>目的を選ぶと、確認すべき画面がわかります。</strong>
    <small>どちらを選んでも、注文前には販売所スプレッドと板コストを分けて確認するのが安全です。</small>
  </output>
  <a class="broker-choice__link" data-broker-choice-link href="/simulator?market=BTC-JPY&side=buy&amountType=jpy&amount=100000">10万円買いでコストを計算してみる</a>
</section>

## 販売所とは

販売所は、暗号資産交換業者が提示する価格でユーザーが買ったり売ったりする形式です。操作はシンプルで、購入金額を入れてボタンを押すだけの画面が多く、初めてでも迷いにくいのが利点です。

一方で、販売所の買値は売値より高く設定されるのが一般的です。この差がスプレッドです。販売所の取引手数料が無料と表示されていても、スプレッドが広いと実際の購入コストは高くなります。

<section class="broker-spread-visual" aria-label="販売所スプレッドの視覚化">
  <div class="broker-section-heading broker-section-heading--compact">
    <span>Spread</span>
    <h3>買値と売値の隙間が「見えにくいコスト」になる</h3>
    <p>下の図は概念例です。隙間が広いほど、買った直後に同じ販売所で売ると不利になりやすくなります。</p>
  </div>
  <div class="broker-spread-visual__graphic" aria-hidden="true">
    <div class="broker-spread-visual__price broker-spread-visual__price--sell">
      <span>売値</span>
      <strong>9,980,000</strong>
    </div>
    <div class="broker-spread-visual__gap">
      <span>スプレッド</span>
    </div>
    <div class="broker-spread-visual__price broker-spread-visual__price--buy">
      <span>買値</span>
      <strong>10,020,000</strong>
    </div>
  </div>
</section>

<div class="broker-procon-grid" aria-label="販売所のメリットと注意点">
  <article class="broker-procon-card broker-procon-card--good">
    <span>メリット</span>
    <ul>
      <li>画面がシンプルで、少額から試しやすい。</li>
      <li>購入金額を入れるだけで、操作に迷いにくい。</li>
      <li>板や注文方法をまだ理解していなくても使いやすい。</li>
    </ul>
  </article>
  <article class="broker-procon-card broker-procon-card--risk">
    <span>注意点</span>
    <ul>
      <li>手数料無料に見えても、スプレッドが実質コストになる。</li>
      <li>相場急変時は提示価格の差が広がることがある。</li>
      <li>少し大きめの金額では、取引所形式との比較が必要。</li>
    </ul>
  </article>
</div>

販売所を使う前は、まず [BTC/JPY の販売所スプレッド比較](/sales-spread?instrumentId=BTC-JPY) のように、買値と売値の開きを確認すると判断しやすくなります。

## 取引所とは

取引所は、ユーザー同士の注文が板に並び、その板に対して売買する形式です。買いたい人の注文と売りたい人の注文が価格順に並びます。

取引所では、販売所よりスプレッドが狭く見えることがあります。ただし、注文サイズが板の厚みを超えると、複数の価格帯を食いながら約定して平均価格がずれることがあります。これがスリッページです。

<div class="broker-procon-grid" aria-label="取引所のメリットと注意点">
  <article class="broker-procon-card broker-procon-card--good">
    <span>メリット</span>
    <ul>
      <li>板が厚い主要銘柄では、実質コストを抑えられる場合がある。</li>
      <li>手数料、板スプレッド、スリッページを分けて確認できる。</li>
      <li>指値注文を使えば、買いたい価格を指定できる。</li>
    </ul>
  </article>
  <article class="broker-procon-card broker-procon-card--risk">
    <span>注意点</span>
    <ul>
      <li>板が薄い銘柄では、成行注文の平均価格がずれやすい。</li>
      <li>注文方法や約定条件を理解してから使う必要がある。</li>
      <li>取引所形式に対応していない銘柄もある。</li>
    </ul>
  </article>
</div>

取引所で成行注文を使う前は、[10万円分の BTC 買いで取引コスト計算（板シミュレーター）を開く](/simulator?market=BTC-JPY&side=buy&amountType=jpy&amount=100000) と、注文金額に対してどの価格帯まで約定しそうかを確認できます。

## どちらを使うべきか

短く言うと、操作の簡単さを優先するなら販売所、実質コストを細かく見たいなら取引所が候補になります。ただし、どちらが常に有利とは言えません。

販売所では、スプレッドが狭いタイミングかどうかが重要です。取引所では、板の厚み、taker 手数料、注文数量、相場の動きが重要です。

比較するときは次の順番で見ると迷いにくくなります。

<div class="broker-step-list" role="list" aria-label="販売所と取引所を比較する順番">
  <div class="broker-step" role="listitem">
    <span>1</span>
    <div>
      <strong>買いたい銘柄がどちらに対応しているか見る</strong>
      <small>同じ BTC でも、取引所によって販売所だけ、取引所形式あり、など対応が変わります。</small>
    </div>
  </div>
  <div class="broker-step" role="listitem">
    <span>2</span>
    <div>
      <strong>販売所のスプレッドを確認する</strong>
      <small>無料表示だけで判断せず、買値と売値の開きを見ます。</small>
      <a class="broker-inline-button" href="/sales-spread?instrumentId=BTC-JPY">BTC/JPY のスプレッドを見る</a>
    </div>
  </div>
  <div class="broker-step" role="listitem">
    <span>3</span>
    <div>
      <strong>希望金額の成行注文がどの価格まで届くか見る</strong>
      <small>10万円、50万円、100万円のように金額を変えると、板の厚みによる差が見えます。</small>
      <a class="broker-inline-button broker-inline-button--primary" href="/simulator?market=BTC-JPY&side=buy&amountType=jpy&amount=100000">計算してみる</a>
    </div>
  </div>
  <div class="broker-step" role="listitem">
    <span>4</span>
    <div>
      <strong>手数料、入出金条件、最小注文数量を公式ページで確認する</strong>
      <small>最終的な発注前は、必ず各社の公式画面とリスク説明を確認してください。</small>
    </div>
  </div>
</div>

## 次に確認する

まずは [スプレッドとは？](/learn/spread) で販売所の実質コストを理解し、そのあと [板取引とは？](/learn/order-book-trading) と [スリッページとは？](/learn/slippage) で取引所の注意点を見るとつながりやすくなります。

実際のデータで確認する場合は、まず [販売所スプレッド比較](/sales-spread?instrumentId=BTC-JPY) で販売所側のコストを見てから、[取引コスト計算（板シミュレーター）](/simulator?market=BTC-JPY&side=buy&amountType=jpy&amount=100000) で取引所板の10万円買いを比べるとつながります。10万円分買う前の確認順は [10万円分買うときに見るべきポイント](/learn/buying-100k-points) も参考にしてください。表示値は参考情報であり、実際の約定価格や取引判断を保証するものではありません。
