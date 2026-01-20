---
name: new-article
description: 新しいZenn記事を作成するスキル。「記事を書きたい」「新しい記事を作成して」と依頼された場合に使用。テーマ選定、構成決定、ファイル作成、Front Matter設定までを対話的に行う。
---

# 新規記事作成

新しいZenn記事を作成する。

## 手順

### 1. テーマの確認

ユーザーがテーマを指定していない場合、以下から選択してもらう：

- AI導入・活用に関するテーマ
- 生産性向上に関するテーマ
- 開発体制改善に関するテーマ
- その他（自由指定）

### 2. 記事の構成を決める

- ターゲット読者を確認
- 記事のゴール（読者が得られること）を確認
- 大まかな見出し構成を提案

### 3. 記事ファイルを作成

```bash
npx zenn-cli new:article --slug <slug>
```

- slugは内容を表す英語のケバブケース
- 例: `introducing-claude-code-to-team`

### 4. Front Matterを設定

```yaml
---
title: "記事タイトル（60文字以内）"
emoji: "🤖"
type: "tech"
topics: ["claude", "ai", "productivity"]
published: false
---
```

- title: 60文字以内
- emoji: 内容に合った絵文字
- type: `tech`（技術記事）を基本
- topics: 関連タグを最大5つ
- published: `false`（下書き状態）

### 5. 次のステップを案内

- 記事ファイルのパスを表示
- プレビュー方法を案内（`/preview`）
- 執筆のヒントを提供

## 注意事項

- slugは一度決めたら変更しない（URLが変わる）
- topicsは小文字英数字とハイフンのみ
- 機密情報は含めないよう注意喚起
