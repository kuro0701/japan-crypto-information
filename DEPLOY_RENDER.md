# Render Free Web Service 公開手順

このアプリは Node.js サーバーと WebSocket を使うため、Render の Free Web Service で公開します。

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

アクセス解析画面は `/admin/analytics` です。Render の Environment で以下を設定してください。

- `ANALYTICS_ADMIN_TOKEN`: 管理画面/API用の長いトークン
- `ANALYTICS_SALT`: 訪問者の概算集計に使うランダム文字列

管理画面は `https://公開URL/admin/analytics` で開き、トークン欄に `ANALYTICS_ADMIN_TOKEN` を入力してください。URLで一度だけ渡す場合は `?token=...` も使えます。トークンはブラウザに保存され、表示後はURLから外して利用します。

## 無料枠の注意

Free Web Service はアクセスがない状態が続くとスリープします。次回アクセス時は起動まで少し待つことがあります。

板情報とシミュレーション結果は参考値です。一般公開する場合は、投資助言ではないことと、表示データの正確性・即時性を保証しないことを画面内にも明記してください。
