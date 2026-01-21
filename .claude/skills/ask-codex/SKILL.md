---
name: ask-codex
description: Codex CLIにタスクを依頼する。タスク種別と複雑さに応じてモデルとreasoning effortを自動選択。
allowed-tools: Bash(codex:*)
---

# Ask Codex（モデル自動選択版）

Codex CLIを使用してコーディング支援を受ける。タスクの種別と複雑さに応じてモデルとreasoning effortを自動選択する。

## モデル選択ガイドライン

| タスク種別       | モデル        |
| ---------------- | ------------- |
| コーディング関連 | gpt-5.2-codex |
| それ以外         | gpt-5.2       |

### コーディング関連の例

- コードレビュー
- バグ修正・デバッグ
- リファクタリング
- 新機能の実装
- コードの説明・分析
- テストコードの作成

### それ以外の例

- 記事のレビュー・校正
- 文章の改善提案
- 一般的な質問
- ドキュメントの作成支援

## Reasoning Effort選択ガイドライン

| 複雑さ | reasoning effort |
| ------ | ---------------- |
| 複雑   | xhigh            |
| 通常   | medium           |

### 複雑なタスクの例

- 大規模なコードベースの分析
- アーキテクチャの設計・レビュー
- 複数ファイルにまたがる変更
- 難解なバグの調査
- 記事全体の総合レビュー

### 通常タスクの例

- 単一関数の説明
- 簡単な質問への回答
- typo確認
- 短い文章の校正

## 実行手順

1. ユーザーの依頼内容を分析
2. コーディング関連かどうかを判断 → モデル選択
3. 複雑さを判断 → reasoning effort選択
4. 選択したオプションを明示してから`codex exec`を実行
5. 結果を報告

## コマンド形式

```bash
codex exec -m <MODEL> -c 'model_reasoning_effort="<EFFORT>"' "プロンプト"
```

## 実行例

**複雑なコーディングタスク:**

```bash
# アーキテクチャレビュー → gpt-5.2-codex + xhigh
codex exec -m gpt-5.2-codex -c 'model_reasoning_effort="xhigh"' "このプロジェクトのアーキテクチャをレビューしてください"
```

**通常のコーディングタスク:**

```bash
# 単一関数の説明 → gpt-5.2-codex + medium
codex exec -m gpt-5.2-codex -c 'model_reasoning_effort="medium"' "src/utils.tsのformatDate関数は何をしていますか？"
```

**複雑な記事レビュー:**

```bash
# 記事全体のレビュー → gpt-5.2 + xhigh
codex exec -m gpt-5.2 -c 'model_reasoning_effort="xhigh"' "articles/my-article.mdを総合的にレビューしてください"
```

**簡単な質問:**

```bash
# 一般的な質問 → gpt-5.2 + medium
codex exec -m gpt-5.2 -c 'model_reasoning_effort="medium"' "Markdownで脚注を書く方法を教えてください"
```

## 注意事項

- Codex CLIがインストールされ、PATHに通っている必要がある
- `--full-auto`オプションは必要に応じて追加可能
- 作業ディレクトリは`-C`オプションで指定可能
