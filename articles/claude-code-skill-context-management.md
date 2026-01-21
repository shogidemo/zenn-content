---
title: "skillでClaude Codeのコンテキスト爆発を防ぐ"
emoji: "🧠"
type: "tech"
topics: ["claudecode", "skill", "llm", "prompt-engineering"]
published: true
published_at: 2026-01-19 12:00
x_shared: true
---

:::message
**対象読者**: Claude Codeで外部APIを扱う際に、レスポンスが大きすぎてコンテキストが溢れた経験がある方
**得られること**: skillを使って大量データを効率的に扱う設計パターン
:::

## はじめに

Claude Codeで外部APIを叩いたとき、こんな経験はありませんか？

「APIからデータを取得して」とお願いしたら、Claude Codeが取得した全データをコンテキストに展開してしまい、**オートコンパクト（auto-compact）が頻発して処理に時間がかかり、さらにClaude Codeの利用制限枠まで消費されてしまった**...

私もBacklog APIで1,000件以上の課題データを取得したとき、まさにこの状況に陥りました。レスポンスが数MBにもなり、コンテキストウィンドウの実質的に使える領域をすぐに圧迫してしまったのです。

この記事では、Claude Codeの[skill](https://docs.anthropic.com/en/docs/claude-code/skills)を使って、この「コンテキスト爆発」を防ぐ方法を紹介します。

## コンテキスト爆発とは

まず、問題を具体的に説明します。

### 典型的な失敗パターン

```text
あなた: Backlog APIから完了した課題を全件取得して、四半期ごとに集計してください

Claude Code: はい、APIを呼び出します
[APIを実行]
取得したデータを確認しますね...

{
  "issues": [
    {"id": 1, "summary": "課題1", ...},
    {"id": 2, "summary": "課題2", ...},
    // ... 1,000件以上のデータが展開される
  ]
}

四半期ごとに集計すると...
[ここでauto-compactが頻発し、処理に時間がかかる＆利用制限を消費]
```

問題は、Claude Codeが「取得したデータを確認する」という親切心から、全データをコンテキストに含めてしまうことです。

### なぜ問題なのか

LLMのコンテキストウィンドウには上限があります。大量のデータで埋まってしまうと：

- その後の指示を理解する余裕がなくなる
- 会話の履歴が押し出されて、文脈を忘れる
- 応答が遅くなる、または途切れる

### Claude Codeのコンテキスト構成

Claude Codeのコンテキストウィンドウは200kトークンですが、すべてを自由に使えるわけではありません。以下は私の環境での例です（プロジェクトの設定により異なります）。

| 項目                          | トークン数 | 割合      |
| ----------------------------- | ---------- | --------- |
| システムプロンプト            | 約3k       | 1.5%      |
| システムツール定義            | 約19k      | 9.5%      |
| メモリファイル（CLAUDE.md等） | 約10k      | 5%        |
| skill定義                     | 約3k       | 1.5%      |
| **オートコンパクトバッファ**  | **約45k**  | **22.5%** |
| **実際に使える領域**          | **約120k** | **60%**   |

つまり、200kトークンのうち実際に会話やデータに使えるのは**約120kトークン（60%程度）**でした。

大量のAPIレスポンスをコンテキストに展開すると、この120kトークンをすぐに消費し、オートコンパクトが発動してしまいます。オートコンパクトは会話履歴を要約して圧縮する処理ですが、実行に時間がかかり、さらに利用制限枠も消費します。

## 解決策: skill

skillを使うと、データ取得と処理のロジックを**外部スクリプトとして切り出し**、Claude Codeのコンテキストには**サマリーだけ**を返すことができます。

### Before / After

**Before（skillなし）**

```text
[コンテキスト]
├── 会話履歴
├── 取得した全データ（数MB）  ← ここが問題
└── 処理結果
```

**After（skillあり）**

```text
[コンテキスト]
├── 会話履歴
└── サマリー（数KB）  ← 必要な情報だけ

[外部ファイル]
└── 詳細データ（数MB）  ← 必要に応じて参照
```

## 実装の詳細

### 1. ディレクトリ構成

```text
.claude/
└── skills/
    └── backlog-stats/
        ├── SKILL.md           # スキル定義
        └── fetch_issues.py    # データ取得スクリプト
```

### 2. SKILL.md（スキル定義ファイル）

:::details SKILL.mdの例

````markdown:SKILL.md
---
name: backlog-stats
description: |
  Backlog APIから課題データを取得し、統計情報を出力する
---

# Backlog Stats Skill

## 概要

Backlog APIを使って課題データを取得し、集計結果を出力します。

## 使い方

`/backlog-stats` で呼び出し、以下の引数を指定してください。

### 引数

- `--project`: プロジェクトキー（必須）
- `--from`: 開始日（YYYY-MM-DD形式、省略可）
- `--to`: 終了日（YYYY-MM-DD形式、省略可）

### 実行例

```bash
python .claude/skills/backlog-stats/fetch_issues.py --project PROJECT_KEY
````

### 出力

- `backlog-stats-output.json`: 詳細データ（外部ファイル）
- 標準出力: サマリー情報（コンテキストに含める）

## 環境変数

以下の環境変数が必要です。

- `BACKLOG_API_KEY`: BacklogのAPIキー
- `BACKLOG_SPACE`: スペース名（xxx.backlog.comのxxx部分）

## 注意事項

- 大量のデータを取得する場合、詳細は外部ファイルに出力される
- コンテキストにはサマリーのみが含まれる

````
:::

### 3. データ取得スクリプト

:::details fetch_issues.pyの例
```python:.claude/skills/backlog-stats/fetch_issues.py
#!/usr/bin/env python3
"""Backlogから課題を取得し、サマリーを出力するスキル用スクリプト"""

import argparse
import json
import os
import sys
import urllib.request
import urllib.parse
from datetime import datetime

API_KEY = os.environ.get("BACKLOG_API_KEY")
SPACE = os.environ.get("BACKLOG_SPACE")
BASE_URL = f"https://{SPACE}.backlog.com/api/v2"


def get_project_id(project_key: str) -> int:
    """プロジェクトキーからプロジェクトIDを取得"""
    url = f"{BASE_URL}/projects/{project_key}?apiKey={API_KEY}"
    with urllib.request.urlopen(url) as response:
        project = json.loads(response.read().decode("utf-8"))
        return project["id"]


def fetch_all_issues(project_id: int) -> list:
    """完了課題を全件取得（ページネーション対応）"""
    issues = []
    offset = 0
    count = 100

    while True:
        params = {
            "apiKey": API_KEY,
            "projectId[]": project_id,
            "statusId[]": 4,  # 完了
            "count": count,
            "offset": offset,
        }
        query = urllib.parse.urlencode(params, doseq=True)
        url = f"{BASE_URL}/issues?{query}"

        with urllib.request.urlopen(url) as response:
            chunk = json.loads(response.read().decode("utf-8"))
            if not chunk:
                break
            issues.extend(chunk)
            offset += len(chunk)
            if len(chunk) < count:
                break

    return issues


def aggregate_by_quarter(issues: list) -> dict:
    """課題を四半期ごとに集計"""
    quarters = {}
    for issue in issues:
        date_str = issue.get("updated")
        if not date_str:
            continue
        dt = datetime.fromisoformat(date_str.replace("Z", "+00:00"))
        quarter = f"{dt.year}Q{(dt.month - 1) // 3 + 1}"
        quarters[quarter] = quarters.get(quarter, 0) + 1
    return quarters


def aggregate_by_assignee(issues: list) -> dict:
    """担当者別に課題を集計"""
    assignees = {}
    for issue in issues:
        assignee = issue.get("assignee")
        name = assignee["name"] if assignee else "未割り当て"
        assignees[name] = assignees.get(name, 0) + 1
    return assignees


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--project", required=True, help="プロジェクトキー")
    args = parser.parse_args()

    project_id = get_project_id(args.project)
    issues = fetch_all_issues(project_id)

    # 詳細データは外部ファイルに出力
    with open("backlog-stats-output.json", "w") as f:
        json.dump(issues, f, ensure_ascii=False, indent=2)

    # サマリーは標準出力に（これがコンテキストに含まれる）
    by_quarter = aggregate_by_quarter(issues)
    by_assignee = aggregate_by_assignee(issues)

    print("=== Backlog Stats Summary ===")
    print(f"Total completed issues: {len(issues)}")
    print("\nBy Quarter:")
    for q in sorted(by_quarter.keys()):
        print(f"  {q}: {by_quarter[q]}")
    print("\nBy Assignee:")
    for name, count in sorted(by_assignee.items(), key=lambda x: -x[1]):
        print(f"  {name}: {count}")
    print(f"\nDetail data saved to: backlog-stats-output.json")


if __name__ == "__main__":
    main()
````

:::

### 4. 使い方

Claude Codeで `/backlog-stats` と入力すると、SKILL.mdが読み込まれ、スキルが利用可能になります。

```text
あなた: /backlog-stats --project MY_PROJECT

Claude Code: backlog-statsスキルを実行します。
[スクリプトを実行]

=== Backlog Stats Summary ===
Total completed issues: 1,247
By Quarter:
  2024Q1: 312
  2024Q2: 298
  2024Q3: 321
  2024Q4: 316
...

詳細データは backlog-stats-output.json に保存されています。
特定の課題について詳しく見たい場合はお知らせください。
```

コンテキストに含まれるのはサマリーだけ。1,247件の詳細データはファイルに出力され、必要なときだけ参照できます。

## 効果

| 項目                   | Before               | After                 |
| ---------------------- | -------------------- | --------------------- |
| コンテキスト消費       | 数MB（数万トークン） | 約2KB（数百トークン） |
| 後続の対話             | 困難                 | スムーズ              |
| 詳細データへのアクセス | 常に展開             | 必要時のみ            |

## 設計のポイント

skillを効果的に使うためのポイントをまとめます。

### 1. 入力はコマンドライン引数で

スクリプトへの入力は、コマンドライン引数や環境変数で渡します。これにより、Claude Codeが適切なパラメータでスクリプトを呼び出せます。

```python
# Good: コマンドライン引数
parser = argparse.ArgumentParser()
parser.add_argument("--project", required=True)
args = parser.parse_args()

# Avoid: 対話的な入力待ち
project_key = input("Project key?")
```

### 2. 出力はファイルに、サマリーはコンテキストに

大量のデータはファイルに出力し、サマリー（件数、集計結果など）だけを標準出力に出します。Claude Codeは標準出力をコンテキストに含めるので、サマリーがあれば次のアクションを判断できます。

```python
# 詳細データ → ファイル
with open("output.json", "w") as f:
    json.dump(data, f)

# サマリー → 標準出力（コンテキスト）
print(f"Total: {len(data)} items")
print("Detail saved to: output.json")
```

## まとめ

Claude Codeで外部APIを扱うとき、「コンテキスト爆発」は地味に厄介な問題です。オートコンパクトが頻発すると、作業が中断されるうえ、利用制限も消費してしまいます。

skillを使えば、この問題をシンプルに解決できます。

1. **データ取得ロジックを外部スクリプトに切り出す**
2. **詳細データはファイルに、サマリーだけをコンテキストに**
3. **SKILL.mdで使い方を明確に定義する**

私のチームでは、1,000件超のBacklogデータを扱う際にこの方法を導入し、オートコンパクトの発生がほぼゼロになりました。

「とりあえずAPIを叩いて」というアドホックな使い方から、skillで処理を切り出す設計へ。この一手間で、Claude Codeがより実用的な相棒になります。

## 関連記事

Backlog APIを使った具体的な活用例はこちらで解説しています。

@[card](https://zenn.dev/shosato/articles/backlog-productivity-claude-code)

:::message
この記事の内容は2026年1月時点のものです。

- Claude Code: v2.1.12
- skillの仕様は変更される可能性があります
  :::
