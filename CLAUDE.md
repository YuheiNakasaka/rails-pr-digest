# Rails PR Digest - Development Guide

このファイルはClaude Codeなどのツールが開発時に参照する詳細なドキュメントです。

## 📚 目次

- [プロジェクト構造](#プロジェクト構造)
- [コードアーキテクチャ](#コードアーキテクチャ)
- [動作の仕組み](#動作の仕組み)
- [セットアップ詳細](#セットアップ詳細)
- [カスタマイズ](#カスタマイズ)
- [トラブルシューティング](#トラブルシューティング)
- [開発ガイドライン](#開発ガイドライン)
- [技術スタック](#技術スタック)
- [参考リンク](#参考リンク)

## プロジェクト構造

```
./
├── .github/
│   └── workflows/
│       ├── ci.yml                     # CI ワークフロー（テスト・Lint・型チェック）
│       └── collect-prs.yml            # PR収集・デプロイ ワークフロー
├── scripts/
│   ├── main.ts                        # メインスクリプト（オーケストレーション）
│   ├── github-client.ts               # GitHub API クライアント
│   ├── github-client.test.ts          # GitHub クライアントテスト
│   ├── openai-client.ts               # OpenAI API クライアント
│   ├── openai-client.test.ts          # OpenAI クライアントテスト
│   ├── file-manager.ts                # ファイルシステム操作
│   ├── file-manager.test.ts           # ファイルマネージャーテスト
│   ├── formatter.ts                   # フォーマットとユーティリティ
│   ├── formatter.test.ts              # フォーマッターテスト
│   ├── rss-generator.ts               # RSS 2.0フィード生成
│   └── rss-generator.test.ts          # RSSジェネレータテスト
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
│   ├── pr-data.json                   # PRデータストア（自動生成、RSS用）
│   └── public/                        # 静的ファイル
│       └── feed.xml                   # RSSフィード（自動生成）
├── biome.json                         # Biome設定（formatter & linter）
├── tsconfig.json                      # TypeScript設定
├── vitest.config.ts                   # Vitest設定
├── renovate.json                      # Renovate Bot設定（依存関係自動更新）
├── package.json
├── CLAUDE.md                          # 開発者向け詳細ドキュメント（このファイル）
└── README.md                          # ユーザー向け基本ドキュメント
```

## コードアーキテクチャ

コードベースは責務ごとに明確に分離されており、保守性と拡張性を重視した設計になっています。

### モジュール構成

#### **github-client.ts** - GitHub API通信
- `GitHubClient`: GitHub API との通信を担当
  - `fetchRecentPRs()`: 最近マージされたPRを取得
  - `getPRDetails()`: PR詳細とファイルリストを取得
- テスト: `github-client.test.ts` (4テスト)

#### **openai-client.ts** - OpenAI API通信
- `OpenAIClient`: OpenAI API との通信を担当
  - `summarizePR()`: PRの要約を生成
- テスト: `openai-client.test.ts` (2テスト)

#### **file-manager.ts** - ファイルシステム操作
- `FileManager`: ファイルの読み書きを担当
  - `getExistingPRNumbers()`: 既存のPR番号を抽出
  - `updateMonthlyFile()`: 月別ファイルの更新
  - `generateMonthlyIndex()`: インデックスファイルの生成
  - `extractAndSavePRsFromMonthlyFiles()`: 月別マークダウンからPR抽出・保存
  - `extractPRsFromMarkdown()`: マークダウンのパース処理
  - `convertJapaneseDateToISO()`: 日付フォーマット変換
- テスト: `file-manager.test.ts` (16テスト)

#### **formatter.ts** - フォーマットとユーティリティ
- `getYearMonth()`: 年月の取得
- `getMonthlyFilename()`: ファイル名の生成
- `formatPREntry()`: PRエントリーのマークダウンフォーマット
- テスト: `formatter.test.ts` (10テスト)

#### **rss-generator.ts** - RSS 2.0フィード生成
- `RSSGenerator`: RSSフィードの生成を担当
  - `generate()`: PRデータからRSS 2.0 XMLを生成
  - `loadPRData()`: pr-data.jsonからPRデータを読み込み
  - `createFeed()`: Feed instanceを作成
  - `addPRItem()`: 個別のPRをフィードに追加
  - `convertSummaryToHTML()`: マークダウン要約をHTMLに変換
- テスト: `rss-generator.test.ts` (14テスト)

#### **main.ts** - メインスクリプト
- 各モジュールを組み合わせてPR収集・要約・RSS生成フローを実行
- 環境変数の検証
- エラーハンドリング

### 設計の利点

- **単一責任の原則**: 各モジュールが1つの明確な責務を持つ
- **テスト容易性**: モジュールごとに独立してテスト可能
- **再利用性**: 各クライアントを他のプロジェクトでも利用可能
- **保守性**: 変更が必要な場合、該当モジュールのみを修正
- **拡張性**: 新しい機能追加が容易

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
- 月の途中の実行では既存ファイルのheaderの下に追記（最新の情報が上に表示される）
- 新しい月の最初の実行では新しいファイルを作成

### 4. インデックス更新

- 月別ファイルの一覧を `monthly-index.json` として生成
- トップページ（`docs/index.md`）の「最新のPRを見る」リンクを自動更新
  - 最新の月へのリンクに自動的に差し替わる
  - 新しい月が作成されると、次回の実行時にリンクが更新される

### 5. RSSフィード生成

- 月別マークダウンファイルから全PRを抽出
  - PR番号、タイトル、URL、マージ日、作成者、**AI要約全文**を抽出
  - 正規表現でマークダウン構造をパース
- 最新50件を選択（日付降順でソート）
- `docs/pr-data.json` にJSON形式で保存
- RSS 2.0形式のXMLを生成
  - AI要約をHTMLに変換（見出し、コードブロック、リストなど）
  - `docs/public/feed.xml` として出力
- **重要**: RSSの内容は月別マークダウンファイルの実際の公開内容と完全に一致

### 6. GitHub Pagesへのデプロイ

- 変更をコミット＆プッシュ
- GitHub Pagesに自動デプロイ

## セットアップ詳細

### Renovate Botの有効化

このプロジェクトはRenovate Botを使用して依存パッケージを自動更新します。

#### 初回セットアップ

1. [Renovate GitHub App](https://github.com/apps/renovate)をリポジトリにインストール
2. インストール時にリポジトリを選択
3. Renovateが自動的にオンボーディングPRを作成します
4. オンボーディングPRをマージすると、設定が有効化されます

#### 設定内容 (renovate.json)

- **スケジュール**: 毎週月曜日の午前10時前（JST）
- **グループ化**:
  - マイナー/パッチバージョンを1つのPRにまとめる
  - TypeScript関連ツールをグループ化
  - テストツール（Vitest）をグループ化
  - Linting/Formatting（Biome）をグループ化
- **セマンティックコミット**: `chore(deps):` プレフィックス
- **脆弱性アラート**: セキュリティラベル付きで即座にPR作成
- **ロックファイルメンテナンス**: 毎月1日に実行

#### 動作

1. 毎週水曜日に依存関係をチェック
2. 更新がある場合、自動的にPRを作成
3. CIが自動実行され、全テストが実行される
4. テスト成功後、手動でマージ（またはレビュー後に自動マージ設定も可能）

### GitHub Pagesの有効化

1. GitHubリポジトリの Settings > Pages
2. Source: "GitHub Actions" を選択
3. 保存

### 環境変数の詳細

#### GitHub Actionsで実行する場合

リポジトリのSecretsに以下を設定：

**GITHUB_TOKEN**
- GitHub Actionsでは自動的に利用可能です
- 追加の設定は不要です

**OPENAI_API_KEY**
1. [OpenAI Platform](https://platform.openai.com/api-keys)でAPI Keyを取得
2. GitHubリポジトリの Settings > Secrets and variables > Actions > New repository secret
3. Name: `OPENAI_API_KEY`
4. Secret: 取得したAPI Key

**BASE_URL（オプション）**
1. デフォルトでは `https://yuheinakasaka.github.io/rails-pr-digest` が使用されます
2. 別のURLを使用する場合は、リポジトリのSecretsまたはVariablesに設定
3. Name: `BASE_URL`
4. Value: `https://yourusername.github.io/your-repo-name`

#### ローカルで実行する場合

ルートディレクトリに `.env` ファイルを作成：

```bash
GITHUB_TOKEN=your_github_token
OPENAI_API_KEY=your_openai_api_key
BASE_URL=https://yourusername.github.io/your-repo-name  # オプション
```

**環境変数の説明**:
- `GITHUB_TOKEN`: GitHub APIアクセス用のPersonal Access Token（必須）
- `OPENAI_API_KEY`: OpenAI APIキー（必須）
- `BASE_URL`: GitHub PagesのベースURL（オプション、デフォルト: `https://yuheinakasaka.github.io/rails-pr-digest`）
  - RSSフィードのリンク生成に使用
  - フォークして別のリポジトリで使用する場合は変更が必要

### ローカル開発サーバー

VitePressの開発サーバーを起動：

```bash
npm run docs:dev
```

ブラウザで http://localhost:5173 にアクセスして、サイトをプレビューできます。
変更は即座に反映されます（ホットリロード）。

### ビルドとプレビュー

本番用の静的ファイルを生成：

```bash
npm run docs:build
```

ビルド後のプレビュー：

```bash
npm run docs:preview
```

### GitHub Actionsの実行

#### 自動実行（デフォルト）

GitHub Actionsワークフローは毎日（午前0時UTC）に自動実行されます。

#### 手動トリガー

1. GitHubリポジトリの Actions タブを開く
2. "Collect Rails PRs" ワークフローを選択
3. "Run workflow" ボタンをクリック

## カスタマイズ

### 実行頻度の変更

`.github/workflows/collect-prs.yml` のcron式を編集：

```yaml
on:
  schedule:
    # 例: 2日ごとに実行
    - cron: '0 0 */2 * *'

    # 例: 毎週月曜日に実行
    # - cron: '0 0 * * 1'

    # 例: 毎時実行
    # - cron: '0 * * * *'
```

現在のデフォルト設定は毎日午前0時UTC（`0 0 * * *`）です。

### Renovateスケジュールの変更

`renovate.json` のschedule設定を編集：

```json
{
  "schedule": ["before 10am on wednesday"]
}
```

他のスケジュール例：
- `"before 10am on wednesday"`: 毎週水曜日の午前10時前
- `"after 5pm every weekday"`: 平日の午後5時以降
- `"every weekend"`: 毎週末

現在のデフォルト設定は毎週月曜日の午前10時前（JST）です。

### ベースURLの変更

フォークして別のリポジトリで使用する場合、RSSフィードのリンクを正しく生成するためにベースURLを変更します。

#### 方法1: 環境変数で設定（推奨）

`.env` ファイルまたはGitHub Actions Secretsに `BASE_URL` を設定：

```bash
BASE_URL=https://yourusername.github.io/your-repo-name
```

#### 方法2: デフォルト値を変更

`scripts/main.ts` の以下の行を編集：

```typescript
const BASE_URL = env.BASE_URL || "https://your-custom-domain.com";
```

### 要約プロンプトのカスタマイズ

`scripts/openai-client.ts` の `OpenAIClient.summarizePR()` メソッド内のプロンプトを編集してください。

### 他のリポジトリへの対応

`scripts/main.ts` の以下の定数を変更：

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

### CIが失敗する

- GitHub Actionsの「Actions」タブでログを確認
- どのジョブが失敗したかを特定（lint-and-format, typecheck, test, build-docs）
- ローカルで同じコマンドを実行して再現
- 修正後、再度Pushして確認

### Renovate BotのPRが作成されない

- [Renovate GitHub App](https://github.com/apps/renovate)がリポジトリにインストールされているか確認
- リポジトリの「Settings > Integrations」でRenovateの設定を確認
- Renovate Botのログを確認（PRのコメントに表示される）
- `renovate.json` の構文エラーがないか確認

### 依存関係の更新PRでテストが失敗する

- Breaking changesが含まれている可能性があります
- パッケージのCHANGELOGやリリースノートを確認
- 必要に応じてコードを修正してからマージ
- メジャーバージョンアップは慎重にレビュー

### RSSフィードが生成されない

- `docs/monthly/` ディレクトリに `.md` ファイルが存在するか確認
- `npm run collect` を実行して `docs/pr-data.json` が生成されるか確認
- `docs/public/feed.xml` が生成されているか確認
- スクリプトのログでエラーメッセージを確認
- マークダウンファイルのフォーマットが正しいか確認（PR番号、マージ日、作成者のパターン）

### RSSフィードの内容がWebサイトと異なる

- `npm run collect` を再実行して、月別マークダウンファイルから再抽出
- `docs/pr-data.json` と `docs/public/feed.xml` を削除してから再生成
- マークダウンファイルが最新の状態になっているか確認

### RSSフィードのバリデーションエラー

- [W3C Feed Validator](https://validator.w3.org/feed/) でフィードを検証
- 特殊文字のエスケープ問題の可能性（feedパッケージがCDATAセクションで処理）
- XMLフォーマットエラーの場合は、`rss-generator.ts` のHTML変換ロジックを確認

## 開発ガイドライン

### コード品質

このプロジェクトでは以下のツールでコード品質を維持しています：

- **Biome**: フォーマットとlintを統合管理
  - 設定: `biome.json`
  - スペース2個インデント、行幅100
  - Node.js組み込みモジュールは `node:` プロトコル必須
  - テストファイルでは`any`の使用を許可（`overrides`設定）

- **TypeScript**: 厳格な型チェック
  - 設定: `tsconfig.json`
  - Strict mode有効化
  - 未使用変数・パラメータの検出

- **Vitest**: テストフレームワーク
  - 設定: `vitest.config.ts`
  - ユニットテストをサポート
  - watchモード、UIモード、カバレッジレポートに対応

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

### CI/CD

GitHub Actionsによる自動化されたCI/CDパイプラインを使用しています。

#### CI ワークフロー (`.github/workflows/ci.yml`)

Pull RequestとmainブランチへのPushで自動実行され、以下のチェックを並列で実行します：

- **Lint & Format**: Biomeによるコードスタイルチェック
- **Type Check**: TypeScriptの型チェック
- **Test**: Vitestによるユニットテスト（45テスト）
- **Build Documentation**: VitePressドキュメントのビルド確認

すべてのチェックが成功しないとマージできません。

#### PR収集 ワークフロー (`.github/workflows/collect-prs.yml`)

毎日自動実行され、以下の処理を行います：

1. Rails/RailsリポジトリからマージされたPRを収集
2. OpenAI GPT-4oで日本語要約を生成
3. 月別マークダウンファイルを更新
4. 月別マークダウンファイルからPRを抽出してRSSフィード生成
5. VitePressサイトをビルド
6. GitHub Pagesにデプロイ

手動でも実行可能（Actions タブから "Run workflow"）

### 貢献ガイドライン

Pull Requestを作成する際は：

1. フォークしてブランチを作成
2. コードを修正
3. `npm run format && npm run lint && npm run typecheck && npm run test` を実行
4. コミットしてPull Requestを作成
5. CIが自動的に実行されます（全てのチェックが成功する必要があります）

## 技術スタック

- **TypeScript**: 型安全な開発環境
- **tsx**: 高速なTypeScript実行環境（ランタイム）
- **Biome**: 統合されたformatter & linter
- **Vitest**: 高速でモダンなテストフレームワーク（45テスト）
- **GitHub Actions**: CI/CDパイプラインによる品質保証
- **Renovate Bot**: 依存パッケージの自動更新
- **VitePress**: ドキュメントサイト生成
- **OpenAI GPT-4o**: PR要約生成（日本語）
- **Octokit**: GitHub API クライアント
- **feed**: RSS 2.0/Atom/JSON Feed生成ライブラリ

## 参考リンク

### ツール & サービス

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Renovate Bot Documentation](https://docs.renovatebot.com/)
- [OpenAI API Documentation](https://platform.openai.com/docs)
- [GitHub Pages Documentation](https://docs.github.com/en/pages)
- [VitePress Documentation](https://vitepress.dev/)

### 開発ツール

- [TypeScript Documentation](https://www.typescriptlang.org/docs/)
- [Biome Documentation](https://biomejs.dev/)
- [tsx - TypeScript Execute](https://github.com/privatenumber/tsx)
- [Vitest Documentation](https://vitest.dev/)
- [feed - RSS/Atom/JSON Feed Generator](https://github.com/jpmonette/feed)
