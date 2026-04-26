# Render 公開手順

このアプリは Node.js サーバーと WebSocket を使うため、Render の Web Service で公開します。履歴保存は `Persistent Disk` または `Neon Postgres` のどちらでも運用できます。

## 事前準備

1. このフォルダを GitHub リポジトリに push する。
2. `node_modules/` は push しない。
3. Render アカウントを作成し、GitHub と連携する。

## Render での作成

1. Render Dashboard で `New` から `Blueprint` を選ぶ。
2. このリポジトリを選択する。
3. `render.yaml` の内容を確認して `Apply` する。

このリポジトリの `render.yaml` は、Neon にスナップショット履歴を保存する前提で Persistent Disk なしの設定にしています。JSON fallback やアクセス解析も永続化したい場合だけ、あとから Disk と `DATA_DIR` を追加してください。

設定値は以下です。

- Service type: Web Service
- Plan: Free
- Region: Singapore
- Build Command: `npm ci`
- Start Command: `npm start`
- Health Check Path: `/healthz`
- Node.js: `22.22.0`
- Persistent Disk: 未使用 (JSON fallback やアクセス解析も永続化したい場合だけ追加)
- `DATA_DIR`: 未設定 (Disk を使う場合は `/var/data` などのマウント先を設定)
- `DATABASE_URL`: Neon の接続文字列 (出来高シェア / 販売所スプレッドの履歴を Neon に保存する場合)

`render.yaml` では `DATABASE_URL` を `sync: false` の秘密値として宣言しています。初回 Blueprint 作成時は値の入力を促されます。既存サービスでは Render が `sync: false` の新規変数を自動追加しないため、Render Dashboard の Environment で実際の Neon 接続文字列を手動追加してください。

公開URLは Render が `https://japan-crypto-information.onrender.com` のような `onrender.com` サブドメインを自動発行します。

## アクセス解析

アクセス解析へのリンクは公開ページには出しません。管理画面は直URLで開き、APIはトークン必須です。

本番で見る場合は `https://公開URL/admin/analytics` を開き、画面上で管理トークンを入力してログインしてください。トークンは URL や `localStorage` に保存せず、`HttpOnly` のセッション Cookie で保持します。

Render の Environment には、訪問者の概算集計に使う `ANALYTICS_SALT` を設定してください。管理認証には `ANALYTICS_ADMIN_TOKEN` または `ANALYTICS_ADMIN_TOKEN_HASH` のどちらかが必須で、両方とも未設定だとサーバーは起動しません。

## 出来高・スプレッド履歴の保存

出来高シェアと販売所スプレッドの履歴は `DATABASE_URL` を設定すると Neon Postgres に保存され、未設定時は JSON ファイルに保存します。アクセス解析は引き続き JSON ファイルに保存します。ローカル開発では `DATA_DIR` 未設定時にリポジトリ内の `data/` を使います。

出来高シェアは各取引所の24h出来高、販売所スプレッドは各販売所の現在価格差を、起動直後と定期更新のたびにスナップショットとして取得し、JSTの日付ごとに保存します。同じ日付の記録は最新のスナップショットで置き換えるため、Render が深夜にスリープしていても、次回起動時の取得分から7日/30日集計を積み上げられます。

Neon を使う場合は、Render の Environment に Neon の接続文字列を `DATABASE_URL` として設定してください。接続文字列は Neon Dashboard の `Connect` から取得でき、`postgresql://.../dbname?sslmode=require` の形式です。
保存後は `Save, rebuild, and deploy` または `Save and deploy` を選び、起動ログに `snapshot history: Neon` と出ることを確認してください。

Persistent Disk を使う場合は Render のディスクを `/var/data` にマウントし、`DATA_DIR=/var/data` を設定します。これにより、アクセス解析や JSON fallback がデプロイや再起動のあとも保持されます。

アプリは起動時に次の保存先健全性チェックを行います。

1. `DATABASE_URL` がある場合は、Neon に接続できるか
2. `DATA_DIR` を使う場合は絶対パスか
3. `DATA_DIR` を使う場合はアプリ配下のエフェメラル領域ではないか
4. `DATA_DIR` を使う場合はディレクトリへの read/write/rename ができるか
5. 既存 JSON ファイルが読み出し可能で、JSON として壊れていないか

## 無料枠の注意

Free Web Service はアクセスがない状態が続くとスリープします。次回アクセス時は起動まで少し待つことがあります。実行中に書き込んだローカルファイルはスリープ、再起動、デプロイで失われるため、JSON 保存を使う場合は Persistent Disk が必要です。Neon に履歴を保存する構成なら、スナップショット履歴は Render のローカルファイルに依存しません。

板情報とシミュレーション結果は参考値です。一般公開する場合は、投資助言ではないことと、表示データの正確性・即時性を保証しないことを画面内にも明記してください。
