# Render 公開手順

このアプリは Node.js サーバーと WebSocket を使うため、Render の Web Service で公開します。

## 事前準備

1. このフォルダを GitHub リポジトリに push する。
2. `node_modules/` は push しない。
3. Render アカウントを作成し、GitHub と連携する。

## Render での作成

1. Render Dashboard で `New` から `Blueprint` を選ぶ。
2. このリポジトリを選択する。
3. `render.yaml` の内容を確認して `Apply` する。

設定値は以下です。

- Service type: Web Service
- Plan: Free
- Region: Singapore
- Build Command: `npm ci`
- Start Command: `npm start`
- Health Check Path: `/healthz`
- Node.js: `22.22.0`

公開URLは Render が `https://japan-crypto-information.onrender.com` のような `onrender.com` サブドメインを自動発行します。

## アクセス解析

アクセス解析へのリンクは公開ページには出しません。管理画面は直URLで開き、APIはトークン必須です。

本番で見る場合は `https://公開URL/admin/analytics` を開き、画面上で管理トークンを入力してログインしてください。トークンは URL や `localStorage` に保存せず、`HttpOnly` のセッション Cookie で保持します。

Render の Environment には、訪問者の概算集計に使う `ANALYTICS_SALT` を設定してください。管理認証には `ANALYTICS_ADMIN_TOKEN` または `ANALYTICS_ADMIN_TOKEN_HASH` のどちらかが必須で、両方とも未設定だとサーバーは起動しません。

## 出来高・スプレッド履歴の保存

出来高シェア、販売所スプレッド、アクセス解析の履歴は JSON ファイルに保存します。保存先は `DATA_DIR` で指定でき、未指定の場合はリポジトリ内の `data/` を使います。

出来高シェアは各取引所の24h出来高、販売所スプレッドは各販売所の現在価格差を、起動直後と定期更新のたびにスナップショットとして取得し、JSTの日付ごとに保存します。同じ日付の記録は最新のスナップショットで置き換えるため、Render が深夜にスリープしていても、次回起動時の取得分から7日/30日集計を積み上げられます。

Render の Free Web Service はローカルファイルが永続化されません。デプロイ、再起動、スリープ復帰で `data/*.json` の実行時更新が消えるため、7日/30日集計を本番で積み上げるには Free ではなく、永続ディスクを使える有料インスタンスか外部DBが必要です。

Render の Persistent Disk を使う場合は、ディスクをマウントしたパスを Environment の `DATA_DIR` に設定してください。例: `/var/data`

## 無料枠の注意

Free Web Service はアクセスがない状態が続くとスリープします。次回アクセス時は起動まで少し待つことがあります。さらに、実行中に書き込んだローカルファイルはスリープ、再起動、デプロイで失われるため、履歴集計の保存先には向きません。

板情報とシミュレーション結果は参考値です。一般公開する場合は、投資助言ではないことと、表示データの正確性・即時性を保証しないことを画面内にも明記してください。
