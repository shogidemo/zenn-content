# Zenn CLI

Zenn（https://zenn.dev）で公開する技術記事を管理するリポジトリです。

- [📘 How to use](https://zenn.dev/zenn/articles/zenn-cli-guide)

## ディレクトリ構造

```
/
├── articles/          # 記事ファイル（*.md）
├── books/             # 本ファイル（ディレクトリ単位）
├── images/            # 画像ファイル
├── templates/         # 記事テンプレート
├── plans/             # 実装計画
├── .claude/           # Claude Code設定
│   ├── skills/        # カスタムスキル
│   └── rules/         # 自動適用ルール
├── CLAUDE.md          # Claude Code ガイダンス
└── package.json       # zenn-cli依存関係
```

## Claude Code カスタマイズ

このリポジトリでは、Claude Codeのskill機能とrules機能を活用して、技術ブログ執筆ワークフローを仕組み化しています。

### skills（ユーザーが呼び出すコマンド）

| スキル               | 説明                   | ファイル                                                    |
| -------------------- | ---------------------- | ----------------------------------------------------------- |
| `/check-controversy` | 炎上リスクチェック     | [check-controversy.md](.claude/skills/check-controversy.md) |
| `/review-article`    | 記事品質レビュー       | [review-article.md](.claude/skills/review-article.md)       |
| `/proofread`         | 校正チェック           | [proofread.md](.claude/skills/proofread.md)                 |
| `/publish`           | 公開（品質チェック後） | [publish.md](.claude/skills/publish.md)                     |
| `/new-article`       | 新規記事作成           | [new-article.md](.claude/skills/new-article.md)             |
| `/preview`           | プレビュー起動         | [preview.md](.claude/skills/preview.md)                     |

### rules（自動適用されるルール）

| ルール               | 説明                         | ファイル                                                                   |
| -------------------- | ---------------------------- | -------------------------------------------------------------------------- |
| 記事作成ワークフロー | 記事作成完了時の必須チェック | [article-creation-workflow.md](.claude/rules/article-creation-workflow.md) |
| 品質ガイドライン     | Zenn記事の品質基準           | [zenn-quality-guidelines.md](.claude/rules/zenn-quality-guidelines.md)     |
| 公開前チェックリスト | 公開前の確認項目             | [pre-publish-checklist.md](.claude/rules/pre-publish-checklist.md)         |
| 予約公開ルール       | 予約公開の日時決定ロジック   | [scheduled-publishing.md](.claude/rules/scheduled-publishing.md)           |
| トピックガイドライン | topics選定のガイドライン     | [topic-guidelines.md](.claude/rules/topic-guidelines.md)                   |

### 仕組みの概要

1. **炎上リスク検知**: 5つのパターン（顧客不在、マサカリ誘発、機密漏洩、上から目線、誤情報）をチェック
2. **品質定量評価**: 6観点（読者視点、正確性、引用、構成、SEO、Zenn固有）で評価
3. **校正自動化**: 誤字脱字、表記ゆれ、文法、句読点をチェック
4. **自動実行**: rulesにより、記事作成完了時にチェックが自動実行される

## セットアップ

```bash
# 依存関係のインストール
npm install

# プレビュー起動
npx zenn-cli preview
```

## ライセンス

- 記事本文: 著作権は筆者に帰属
- 設定ファイル（.claude/配下）: MIT License
