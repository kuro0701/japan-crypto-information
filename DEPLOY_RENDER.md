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

アクセス解析へのリンクは公開ページには出しません。管理画面とAPIは `localhost` / `127.0.0.1` / `::1` からのアクセスだけ通します。

手元で見る場合はローカル起動後に `http://localhost:3000/admin/analytics` を開いてください。

Render の Environment には、訪問者の概算集計に使う `ANALYTICS_SALT` を設定してください。`ANALYTICS_ADMIN_TOKEN` はローカルでトークン認証したい場合だけ使います。

## 無料枠の注意

Free Web Service はアクセスがない状態が続くとスリープします。次回アクセス時は起動まで少し待つことがあります。

板情報とシミュレーション結果は参考値です。一般公開する場合は、投資助言ではないことと、表示データの正確性・即時性を保証しないことを画面内にも明記してください。
