# Personal Assistant App

AIを搭載したパーソナルアシスタントアプリ

## 機能

- 📊 ダッシュボード
- ✅ タスク管理
- 🎯 プロジェクト管理
- 📅 Googleカレンダー連携
- 💬 AI チャット（Claude）

## デプロイ

### Vercelでのデプロイ

1. このリポジトリをGitHubにプッシュ
2. Vercelでインポート
3. 環境変数を設定（必要に応じて）
4. デプロイ

### 環境変数

必要な環境変数はありません。GoogleクライアントIDはコードに含まれています。

## 開発

```bash
npm install
npm run dev
```

http://localhost:3000 でアプリが起動します。

## Google Calendar API設定

1. Google Cloud Consoleでプロジェクト作成
2. Google Calendar APIを有効化
3. OAuth 2.0クライアントIDを作成
4. リダイレクトURIに本番URLを追加
