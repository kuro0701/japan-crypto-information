# Render 公開手順

このアプリは Node.js サーバーと WebSocket を使うため、Render の Web Service で公開します。本番運用では履歴保存のため Persistent Disk を前提にします。

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
- Plan: Starter
- Region: Singapore
- Build Command: `npm ci`
- Start Command: `npm start`
- Health Check Path: `/healthz`
- Node.js: `22.22.0`
- Persistent Disk: `10 GB`
- Disk mount path: `/var/data`
- `DATA_DIR`: `/var/data`

公開URLは Render が `https://japan-crypto-information.onrender.com` のような `onrender.com` サブドメインを自動発行します。

## アクセス解析

アクセス解析へのリンクは公開ページには出しません。管理画面は直URLで開き、APIはトークン必須です。

本番で見る場合は `https://公開URL/admin/analytics` を開き、画面上で管理トークンを入力してログインしてください。トークンは URL や `localStorage` に保存せず、`HttpOnly` のセッション Cookie で保持します。

Render の Environment には、訪問者の概算集計に使う `ANALYTICS_SALT` を設定してください。管理認証には `ANALYTICS_ADMIN_TOKEN` または `ANALYTICS_ADMIN_TOKEN_HASH` のどちらかが必須で、両方とも未設定だとサーバーは起動しません。

## 出来高・スプレッド履歴の保存

出来高シェア、販売所スプレッド、アクセス解析の履歴は JSON ファイルに保存します。ローカル開発では `DATA_DIR` 未設定時にリポジトリ内の `data/` を使いますが、本番 (`NODE_ENV=production`) では `DATA_DIR` の設定が必須です。

出来高シェアは各取引所の24h出来高、販売所スプレッドは各販売所の現在価格差を、起動直後と定期更新のたびにスナップショットとして取得し、JSTの日付ごとに保存します。同じ日付の記録は最新のスナップショットで置き換えるため、Render が深夜にスリープしていても、次回起動時の取得分から7日/30日集計を積み上げられます。

本番では Render の Persistent Disk を `/var/data` にマウントし、`DATA_DIR=/var/data` を設定します。これにより、デプロイや再起動のあとも JSON 履歴ファイルが保持され、7日/30日集計が消えません。

アプリは起動時に次の保存先健全性チェックを行います。

1. `DATA_DIR` が本番で設定済みか
2. `DATA_DIR` が絶対パスか
3. `DATA_DIR` がアプリ配下のエフェメラル領域ではないか
4. ディレクトリへの read/write/rename ができるか
5. 既存 JSON ファイルが読み出し可能で、JSON として壊れていないか

## 無料枠の注意

Free Web Service はアクセスがない状態が続くとスリープします。次回アクセス時は起動まで少し待つことがあります。さらに、実行中に書き込んだローカルファイルはスリープ、再起動、デプロイで失われるため、履歴集計の保存先には向きません。本番では Free を使わず、Starter 以上 + Persistent Disk を使ってください。

板情報とシミュレーション結果は参考値です。一般公開する場合は、投資助言ではないことと、表示データの正確性・即時性を保証しないことを画面内にも明記してください。
