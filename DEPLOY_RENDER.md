# Render 公開手順

このアプリは Node.js サーバーと WebSocket を使うため、Render の Web Service で公開します。出来高シェアと販売所スプレッドの履歴は、Google Sheets、Neon Postgres、JSON ファイルのいずれかに保存できます。

## 事前準備

1. このフォルダを GitHub リポジトリに push する。
2. `node_modules/` は push しない。
3. Render アカウントを作成し、GitHub と連携する。

## Render での作成

1. Render Dashboard で `New` から `Blueprint` を選ぶ。
2. このリポジトリを選択する。
3. `render.yaml` の内容を確認して `Apply` する。

このリポジトリの `render.yaml` は、Google Sheets にスナップショット履歴を保存する前提で Persistent Disk なしの設定にしています。JSON fallback やアクセス解析も永続化したい場合だけ、あとから Disk と `DATA_DIR` を追加してください。

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
- `SITE_ORIGIN`: `https://get-crypto.org`
- `LEGACY_HOSTS`: `japan-crypto-information.onrender.com`
- `SNAPSHOT_STORAGE`: `google-sheets`
- `GOOGLE_SHEETS_SPREADSHEET_ID`: 履歴保存用スプレッドシート ID
- `GOOGLE_SHEETS_SERVICE_ACCOUNT_JSON_BASE64`: Google サービスアカウント JSON を base64 化した値
- `GOOGLE_SHEETS_SHEET_NAME`: `app_state_snapshots`

`render.yaml` では `SNAPSHOT_STORAGE`、`GOOGLE_SHEETS_SPREADSHEET_ID`、`GOOGLE_SHEETS_SERVICE_ACCOUNT_JSON_BASE64` を `sync: false` の秘密値として宣言しています。初回 Blueprint 作成時は値の入力を促されます。既存サービスでは Render が `sync: false` の新規変数を自動追加しないため、Render Dashboard の Environment で実際の値を手動追加してください。

公開URLは Render が `https://japan-crypto-information.onrender.com` のような `onrender.com` サブドメインを自動発行します。このサブドメインは `SITE_ORIGIN` に設定した `https://get-crypto.org` へ 301 リダイレクトされます。

## Cloudflare

`get-crypto.org` は Cloudflare DNS で Render の Web Service に向けてください。Cloudflare Pages で `public/` だけを配信すると、`HEAD_META_INJECT`、`/api/*`、`/sitemap.xml`、WebSocket がサーバーを通らず正しく動きません。

推奨設定は以下です。

- DNS: `get-crypto.org` を Render のカスタムドメインターゲットへ CNAME/ALIAS で向け、Proxy status は Proxied にする。
- SSL/TLS: Full または Full (strict)。
- Cache Rules: `/api/*` と `/admin/*` は Bypass cache、HTML は origin の `s-maxage=300` を尊重、`/css/*` と `/js/*` は長期キャッシュ。
- Render Environment: `SITE_ORIGIN=https://get-crypto.org`、`LEGACY_HOSTS=japan-crypto-information.onrender.com`。

## アクセス解析

アクセス解析へのリンクは公開ページには出しません。管理画面は直URLで開き、APIはトークン必須です。

本番で見る場合は `https://公開URL/admin/analytics` を開き、画面上で管理トークンを入力してログインしてください。トークンは URL や `localStorage` に保存せず、`HttpOnly` のセッション Cookie で保持します。

Render の Environment には、訪問者の概算集計に使う `ANALYTICS_SALT` を設定してください。管理認証には `ANALYTICS_ADMIN_TOKEN` または `ANALYTICS_ADMIN_TOKEN_HASH` のどちらかが必須で、両方とも未設定だとサーバーは起動しません。

## 出来高・スプレッド履歴の保存

出来高シェアと販売所スプレッドの履歴は `SNAPSHOT_STORAGE` で保存先を選びます。`google-sheets` なら Google Sheets、`neon` なら Neon Postgres、`json` なら JSON ファイルに保存します。未設定時は `GOOGLE_SHEETS_SPREADSHEET_ID` があれば Google Sheets、なければ `DATABASE_URL` があれば Neon、どちらもなければ JSON を使います。アクセス解析は引き続き JSON ファイルに保存します。ローカル開発では `DATA_DIR` 未設定時にリポジトリ内の `data/` を使います。

出来高シェアは各取引所の24h出来高、販売所スプレッドは各販売所の現在価格差を、起動直後と定期更新のたびにスナップショットとして取得し、JSTの日付ごとに保存します。同じ日付の記録は最新のスナップショットで置き換えるため、Render が深夜にスリープしていても、次回起動時の取得分から7日/30日集計を積み上げられます。

Google Sheets を使う場合は、Google Cloud で Google Sheets API を有効化し、サービスアカウントを作成して、履歴保存用スプレッドシートをそのサービスアカウントのメールアドレスに Editor 権限で共有してください。Render の Environment には `SNAPSHOT_STORAGE=google-sheets`、`GOOGLE_SHEETS_SPREADSHEET_ID`、`GOOGLE_SHEETS_SERVICE_ACCOUNT_JSON_BASE64` を設定します。サービスアカウント JSON は `base64` 化して1行の値にすると、改行を含む秘密鍵を安全に渡せます。

```bash
base64 < service-account.json | tr -d '\n'
```

既存の Neon 履歴を Google Sheets に移す場合は、`DATABASE_URL` と Google Sheets 系の環境変数をローカルまたは一時ジョブに設定し、次を1回だけ実行してください。

```bash
npm run migrate:snapshots:neon-to-sheets
```

移行後は本番の `DATABASE_URL` を削除するか、`SNAPSHOT_STORAGE=google-sheets` を残して Sheets を優先させます。保存後は `Save, rebuild, and deploy` または `Save and deploy` を選び、起動ログに `snapshot history: Google Sheets` と出ることを確認してください。

Neon を使い続ける場合は、Render の Environment に `SNAPSHOT_STORAGE=neon` と Neon の接続文字列 `DATABASE_URL` を設定してください。接続文字列は Neon Dashboard の `Connect` から取得でき、`postgresql://.../dbname?sslmode=require` の形式です。

Persistent Disk を使う場合は Render のディスクを `/var/data` にマウントし、`DATA_DIR=/var/data` を設定します。これにより、アクセス解析や JSON fallback がデプロイや再起動のあとも保持されます。

アプリは起動時に次の保存先健全性チェックを行います。

1. `SNAPSHOT_STORAGE=google-sheets` の場合は、Google Sheets の認証情報とスプレッドシート ID が設定されているか
2. `DATA_DIR` を使う場合は絶対パスか
3. `DATA_DIR` を使う場合はアプリ配下のエフェメラル領域ではないか
4. `DATA_DIR` を使う場合はディレクトリへの read/write/rename ができるか
5. 既存 JSON ファイルが読み出し可能で、JSON として壊れていないか

## 無料枠の注意

Free Web Service はアクセスがない状態が続くとスリープします。次回アクセス時は起動まで少し待つことがあります。実行中に書き込んだローカルファイルはスリープ、再起動、デプロイで失われるため、JSON 保存を使う場合は Persistent Disk が必要です。Google Sheets または Neon に履歴を保存する構成なら、スナップショット履歴は Render のローカルファイルに依存しません。

板情報とシミュレーション結果は参考値です。一般公開する場合は、投資助言ではないことと、表示データの正確性・即時性を保証しないことを画面内にも明記してください。
