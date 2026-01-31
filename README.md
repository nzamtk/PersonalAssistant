# Personal Assistant App

AIを搭載したパーソナルアシスタントアプリ

## 機能

- 📊 ダッシュボード
- ✅ タスク管理
- 🎯 プロジェクト管理
- 📅 Googleカレンダー連携
- 💬 AI チャット（Gemini）

## デプロイ

### Vercelでのデプロイ

1. このリポジトリをGitHubにプッシュ
2. Vercelでインポート
3. **環境変数を設定**（重要）
4. デプロイ

### 環境変数の設定

Vercelのプロジェクト設定で以下の環境変数を追加：

```
GEMINI_API_KEY=あなたのGemini APIキー
```

**Gemini APIキーの取得方法：**
1. https://aistudio.google.com/app/apikey にアクセス
2. 「Create API Key」をクリック
3. APIキーをコピー
4. Vercelの「Settings」→「Environment Variables」に追加

### Google Calendar API設定

1. Google Cloud Consoleでプロジェクト作成
2. Google Calendar APIを有効化
3. OAuth 2.0クライアントIDを作成
4. リダイレクトURIに本番URLを追加

## 開発

```bash
# 依存関係をインストール
npm install

# 環境変数を設定
cp .env.local.example .env.local
# .env.localを編集してGEMINI_API_KEYを設定

# 開発サーバー起動
npm run dev
```

http://localhost:3000 でアプリが起動します。

