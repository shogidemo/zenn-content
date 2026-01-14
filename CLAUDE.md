# CLAUDE.md

このファイルは、Zenn記事執筆リポジトリでClaude Codeが作業する際のガイダンスを提供します。

## 言語ポリシー

- **記事本文**: 日本語で執筆
- **コード・コマンド**: 英語のまま使用
- **Claude Codeの応答**: 日本語で回答

## リポジトリ概要

Zenn（https://zenn.dev）で公開する技術記事を管理するリポジトリです。

### ディレクトリ構造

```
/
├── articles/          # 記事ファイル（*.md）
├── books/             # 本ファイル（ディレクトリ単位）
├── templates/         # 記事テンプレート
├── .claude/
│   └── skills/        # カスタムスキル
├── CLAUDE.md          # このファイル
└── package.json       # zenn-cli依存関係
```

## テーマ方針

このZennアカウントでは、以下の領域を軸に記事を執筆します：

### 主要テーマ

1. **AI導入・活用**
   - Claude Code、GitHub Copilot等のAIツール導入
   - チームへのAIツール定着・浸透施策
   - AI活用の効果測定・ROI分析

2. **生産性向上**
   - 開発チームの生産性計測手法
   - ベロシティ・リードタイム等のメトリクス設計
   - 開発プロセス改善

3. **開発体制改善**
   - devcontainer、CI/CD等の開発環境整備
   - コードレビュープロセスの改善
   - ドキュメント駆動開発

### 記事の特徴

- **実践ベース**: 実際の業務経験に基づく具体的な内容
- **定量的**: 可能な限り数値・データを含める
- **再現可能**: 読者が追試できる具体的な手順

## Zenn記事フォーマット

### Front Matter（必須）

```yaml
---
title: "記事タイトル（60文字以内推奨）"
emoji: "🤖"
type: "tech"  # tech: 技術記事 / idea: アイデア記事
topics: ["claude", "ai", "productivity"]  # 最大5つ
published: false  # true: 公開 / false: 下書き
---
```

### Front Matter項目の説明

| 項目 | 必須 | 説明 |
|------|------|------|
| title | ✅ | 記事タイトル。SEO的には60文字以内推奨 |
| emoji | ✅ | 記事のアイキャッチ絵文字（1文字） |
| type | ✅ | `tech`（技術記事）または `idea`（アイデア記事） |
| topics | ✅ | タグ。最大5つ。小文字英数字とハイフンのみ |
| published | ✅ | `true`で公開、`false`で下書き |
| publication_name | - | Publicationに所属する場合のみ指定 |

### よく使うtopics

```
claude, ai, chatgpt, productivity, devops, dx,
typescript, python, testing, agile, scrum
```

## Zenn独自のMarkdown記法

### メッセージボックス

```markdown
:::message
通常のメッセージ
:::

:::message alert
警告メッセージ
:::
```

### アコーディオン（トグル）

```markdown
:::details タイトル
折りたたまれる内容
:::
```

### コードブロック

```markdown
```typescript:ファイル名.ts
// ファイル名付きコードブロック
const example = "hello";
```　← バッククォート3つで閉じる

```diff typescript
- const old = "before";
+ const new = "after";
```　← diffハイライト
```

### 数式（KaTeX）

```markdown
$$
e^{i\pi} + 1 = 0
$$
```

### 外部コンテンツ埋め込み

```markdown
@[card](https://example.com)  # リンクカード

https://github.com/user/repo  # GitHubリポジトリカード（URLのみで自動展開）

@[tweet](https://twitter.com/xxx/status/xxx)  # ツイート埋め込み
```

### 脚注

```markdown
本文中の脚注[^1]

[^1]: 脚注の内容
```

## 記事執筆ワークフロー

### 1. 記事作成

```bash
npx zenn-cli new:article
# または
npx zenn-cli new:article --slug my-article-slug
```

- `--slug`を指定しないとランダムなslugが生成される
- slugはURLの一部になる（`zenn.dev/ユーザー名/articles/slug`）
- slugは変更すると既存のURLが無効になるので注意

### 2. プレビュー

```bash
npx zenn-cli preview
# ブラウザで http://localhost:8000 を開く
```

### 3. 公開

1. `published: true` に変更
2. コミット＆プッシュ
3. Zennが自動デプロイ（GitHub連携済みの場合）

## 記事の品質チェックリスト

記事を公開する前に確認すること：

### 内容面

- [ ] タイトルは内容を的確に表している
- [ ] 導入部で「誰向けか」「何が得られるか」が明確
- [ ] 具体的な例・コード・数値が含まれている
- [ ] 結論・まとめが明確
- [ ] 再現可能な手順になっている（技術記事の場合）

### 形式面

- [ ] Front Matterが正しく設定されている
- [ ] topicsは適切か（最大5つ、関連性のあるもの）
- [ ] emojiは内容に合っている
- [ ] コードブロックに言語指定がある
- [ ] 画像がある場合、altテキストが設定されている

### SEO・読みやすさ

- [ ] タイトルは60文字以内
- [ ] 見出しの階層構造が適切（h1は使わない、h2から開始）
- [ ] 適度に見出しで区切られている
- [ ] 長すぎる段落がない

## コマンド一覧

### Zenn CLI

```bash
# 記事作成
npx zenn-cli new:article
npx zenn-cli new:article --slug 記事のslug

# 本作成
npx zenn-cli new:book --slug 本のslug

# プレビュー
npx zenn-cli preview
npx zenn-cli preview --port 3000  # ポート指定

# バージョン確認
npx zenn-cli --version
```

### カスタムスキル（.claude/skills/）

- `/new-article` - 新しい記事を作成（テーマ選定からFront Matter設定まで）
- `/preview` - プレビューサーバーを起動
- `/publish` - 記事を公開（品質チェック後にpublished: trueに変更）

## 注意事項

### 機密情報

- 社内の具体的なプロジェクト名・システム名は伏せる
- 数値データは公開可能な範囲に留める
- 顧客情報・個人情報は含めない

### 著作権

- 他者のコード・文章を引用する場合は出典を明記
- 画像は自作またはライセンス確認済みのものを使用

### Zenn利用規約

- Zenn利用規約（https://zenn.dev/terms）を遵守
- 宣伝目的のみの記事は避ける
- 技術的に価値のある内容を心がける
