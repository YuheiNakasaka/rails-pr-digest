# Ruby on Rails PR Digest

Ruby on Railsの最新変更を自動追跡し、AI要約付きで閲覧できるシステムです。

## 概要

このプロジェクトは、[rails/rails](https://github.com/rails/rails)リポジトリのmainブランチにマージされたPull Requestを定期的に収集し、OpenAI GPT-4oで要約・解説してGitHub Pagesで公開します。

### 主な機能

- **定期実行**: GitHub Actionsで2日ごとに自動実行
- **AI要約**: OpenAI GPT-4oで各PRを日本語で要約・解説
- **月別管理**: 月ごとにファイルを生成・更新
- **VitePress**: 美しいUIとローカル開発環境
- **検索機能**: VitePress組み込みの高速検索
- **ダークモード**: 自動切り替え対応
- **GitHub Pages**: 自動的にWebページとして公開
- **継続的更新**: 月内は同じファイルの先頭に追記、新しい月には新しいファイルを作成

### 技術スタック

- **TypeScript**: 型安全な開発環境
- **tsx**: 高速なTypeScript実行環境
- **Biome**: 統合されたformatter & linter
- **Vitest**: 高速でモダンなテストフレームワーク
- **厳格な型チェック**: strict mode有効化で品質向上

## セットアップ

### 1. 必要な環境

- Node.js 18以上
- GitHub リポジトリ
- GitHub Personal Access Token
- OpenAI API Key

### 2. 依存関係のインストール

```bash
npm install
```

### 3. 環境変数の設定

GitHub Actionsで実行する場合は、リポジトリのSecretsに以下を設定してください：

#### `GITHUB_TOKEN`

GitHub Actionsでは自動的に利用可能です。追加の設定は不要です。

#### `OPENAI_API_KEY`

1. [OpenAI Platform](https://platform.openai.com/api-keys)でAPI Keyを取得
2. GitHubリポジトリの Settings > Secrets and variables > Actions > New repository secret
3. Name: `OPENAI_API_KEY`
4. Secret: 取得したAPI Key

### 4. GitHub Pagesの有効化

1. GitHubリポジトリの Settings > Pages
2. Source: "GitHub Actions" を選択
3. 保存

## 使い方

### ローカル開発

VitePressの開発サーバーを起動して、サイトをプレビューできます：

```bash
npm run docs:dev
```

ブラウザで http://localhost:5173 にアクセスして、サイトをプレビューできます。
変更は即座に反映されます（ホットリロード）。

### ビルド

本番用の静的ファイルを生成：

```bash
npm run docs:build
```

ビルド後のプレビュー：

```bash
npm run docs:preview
```

### PR収集（手動実行）

ルートディレクトリに `.env` ファイルを作成：

```bash
# .env
GITHUB_TOKEN=your_github_token
OPENAI_API_KEY=your_openai_api_key
```

スクリプトを実行：

```bash
npm run collect
```

### 開発コマンド

コード品質を維持するための各種コマンド：

```bash
# コードフォーマット
npm run format

# Lintチェック
npm run lint

# Lint自動修正
npm run lint:fix

# TypeScript型チェック
npm run typecheck

# テスト実行
npm run test

# テスト実行（watchモード）
npm run test:watch

# テスト実行（UIモード）
npm run test:ui

# テスト実行（カバレッジ付き）
npm run test:coverage
```

### GitHub Actionsでの実行

#### 自動実行（デフォルト）

GitHub Actionsワークフローは2日ごと（午前0時UTC）に自動実行されます。

#### 手動トリガー

1. GitHubリポジトリの Actions タブを開く
2. "Collect Rails PRs" ワークフローを選択
3. "Run workflow" ボタンをクリック

## プロジェクト構造

```
./
├── .github/
│   └── workflows/
│       └── collect-prs.yml            # GitHub Actionsワークフロー
├── scripts/
│   ├── collect-and-summarize.ts       # PR収集・要約スクリプト（TypeScript）
│   └── collect-and-summarize.test.ts  # テストファイル
├── docs/                              # VitePressソースディレクトリ
│   ├── .vitepress/
│   │   ├── config.js                  # VitePress設定
│   │   ├── dist/                      # ビルド出力（gitignore）
│   │   └── cache/                     # キャッシュ（gitignore）
│   ├── index.md                       # トップページ
│   ├── monthly/                       # 月別ダイジェスト
│   │   ├── index.md                   # アーカイブ一覧
│   │   ├── 2025-11.md
│   │   └── ...
│   ├── monthly-index.json             # 月別インデックス（自動生成）
│   └── public/                        # 静的ファイル
├── biome.json                         # Biome設定（formatter & linter）
├── tsconfig.json                      # TypeScript設定
├── vitest.config.ts                   # Vitest設定
├── package.json
└── README.md
```

## 動作の仕組み

### 1. PR収集

- GitHub APIを使用して過去24時間にマージされたPRを検索
- PR番号、タイトル、説明、変更ファイルなどの情報を取得

### 2. AI要約

- OpenAI GPT-4oに各PRの情報を送信
- 日本語で以下の内容を生成：
  - 概要
  - 変更内容の詳細
  - 影響範囲・注意点
  - 参考情報

### 3. ファイル生成

- 年月に基づいてファイル名を決定（例: `2025-01.md`）
- 月の途中の実行では既存ファイルの先頭に追記（最新の情報が上に表示される）
- 新しい月の最初の実行では新しいファイルを作成

### 4. インデックス更新

- 月別ファイルの一覧を `monthly-index.json` として生成
- トップページで読み込んで表示

### 5. GitHub Pagesへのデプロイ

- 変更をコミット＆プッシュ
- GitHub Pagesに自動デプロイ

## カスタマイズ

### 実行頻度の変更

`.github/workflows/collect-prs.yml` のcron式を編集：

```yaml
on:
  schedule:
    # 毎日実行に変更
    - cron: '0 0 * * *'
```

### 要約プロンプトのカスタマイズ

`scripts/collect-and-summarize.ts` の `summarizePR()` 関数内のプロンプトを編集してください。

### 他のリポジトリへの対応

`scripts/collect-and-summarize.ts` の以下の定数を変更：

```typescript
const RAILS_OWNER = 'your-owner';
const RAILS_REPO = 'your-repo';
```

## トラブルシューティング

### PRが収集されない

- GitHub Tokenの権限を確認（read:org, repo スコープが必要）
- 過去24時間にマージされたPRが存在するか確認

### AI要約が生成されない

- OpenAI API Keyが正しく設定されているか確認
- APIレート制限に達していないか確認
- OpenAIアカウントに十分なクレジットがあるか確認
- スクリプトのログを確認

### GitHub Pagesが更新されない

- ワークフローが正常に完了しているか確認
- GitHub Pagesの設定が "GitHub Actions" になっているか確認
- `.nojekyll` ファイルが存在するか確認

### TypeScript型エラーが出る

- `npm run typecheck` で詳細なエラーを確認
- 必要に応じて型定義を追加・修正
- `tsconfig.json` の設定を確認

## 開発ガイドライン

### コード品質

このプロジェクトでは以下のツールでコード品質を維持しています：

- **Biome**: フォーマットとlintを統合管理
  - 設定: `biome.json`
  - スペース2個インデント、行幅100
  - Node.js組み込みモジュールは `node:` プロトコル必須

- **TypeScript**: 厳格な型チェック
  - 設定: `tsconfig.json`
  - Strict mode有効化
  - 未使用変数・パラメータの検出

- **Vitest**: テストフレームワーク
  - 設定: `vitest.config.ts`
  - ユニットテストをサポート
  - watchモード、UIモード、カバレッジレポートに対応

### コミット前のチェック

コードをコミットする前に以下を実行してください：

```bash
npm run format    # コードフォーマット
npm run lint      # Lintチェック
npm run typecheck # 型チェック
npm run test      # テスト実行
```

または一括で：

```bash
npm run format && npm run lint && npm run typecheck && npm run test
```

## ライセンス

MIT

## 貢献

Issue・Pull Requestを歓迎します。

## 参考リンク

### プロジェクト

- [Ruby on Rails GitHub](https://github.com/rails/rails)

### ツール & サービス

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [OpenAI API Documentation](https://platform.openai.com/docs)
- [GitHub Pages Documentation](https://docs.github.com/en/pages)
- [VitePress Documentation](https://vitepress.dev/)

### 開発ツール

- [TypeScript Documentation](https://www.typescriptlang.org/docs/)
- [Biome Documentation](https://biomejs.dev/)
- [tsx - TypeScript Execute](https://github.com/privatenumber/tsx)
- [Vitest Documentation](https://vitest.dev/)
