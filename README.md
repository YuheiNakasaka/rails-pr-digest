# Ruby on Rails PR Digest

Ruby on Railsの最新変更を自動追跡し、AI要約付きで閲覧できるシステムです。

## 概要

[rails/rails](https://github.com/rails/rails)リポジトリにマージされたPull Requestを定期的に収集し、OpenAI GPT-4oで要約・解説してGitHub Pagesで公開します。

## 主な機能

- 2日ごとに自動実行（GitHub Actions）
- OpenAI GPT-4oによる日本語要約
- 月別管理とVitePressによる美しいUI
- 検索機能、ダークモード対応
- GitHub Pagesで自動公開

## クイックスタート

### 必要な環境

- Node.js 18以上
- GitHub Personal Access Token
- OpenAI API Key

### インストール

```bash
npm install
```

### 環境変数の設定

ルートディレクトリに `.env` ファイルを作成：

```bash
GITHUB_TOKEN=your_github_token
OPENAI_API_KEY=your_openai_api_key
```

GitHub Actionsで実行する場合は、リポジトリのSecretsに設定してください。

### PR収集の実行

```bash
npm run collect
```

### ローカル開発（VitePress）

```bash
npm run docs:dev
```

http://localhost:5173 でプレビューできます。

## 開発

開発コマンド：

```bash
npm run format     # フォーマット
npm run lint       # Lintチェック
npm run typecheck  # 型チェック
npm run test       # テスト実行
```

詳細な開発ガイドラインは [CLAUDE.md](./CLAUDE.md) を参照してください。

## ライセンス

MIT

## 貢献

Issue・Pull Requestを歓迎します。詳細は [CLAUDE.md](./CLAUDE.md) を参照してください。

## リンク

- [Ruby on Rails GitHub](https://github.com/rails/rails)
- [開発ドキュメント (CLAUDE.md)](./CLAUDE.md)
