---
title: "Claude CodeでBacklogの生産性データを可視化してみた"
emoji: "📊"
type: "tech"
topics: ["claudecode", "backlog", "productivity", "api"]
published: false
---

:::message
**対象読者**: Backlogを使っているチームで、課題の消化状況や生産性を定期的に把握したい方
**得られること**: Claude Codeを使ってBacklog APIからデータを取得し、四半期ごとの生産性レポートを自動生成する方法
:::

## はじめに

チームの生産性を把握したいとき、「今四半期で何件の課題を消化したんだろう？」「担当者ごとの傾向は？」といった疑問が浮かぶことがあります。

Backlogには豊富なAPIがあるので、これを使えばデータは取れるはず。でも、APIのドキュメントを読んで、認証の仕組みを理解して、スクリプトを書いて...という作業は正直面倒です。

そこでClaude Codeに「Backlog APIを使って生産性データを可視化して」とお願いしてみたところ、思った以上にスムーズにできたので、その過程を共有します。

## 作りたいもの

最終的に作りたいのは、以下のようなレポートです。

- 四半期ごとの完了課題数
- 担当者別の課題消化数
- 課題種別（バグ、タスク、要望など）の内訳

出力形式はCSVにして、あとでスプレッドシートに貼り付けたりグラフ化したりできるようにします。

### 必要なもの

- Backlogのアカウントとプロジェクト
- Backlog APIキー
- Claude Code（または他のAIコーディングツール）
- Python 3.10以上

## 実装

### 1. Backlog APIキーの取得

まず、Backlogの個人設定からAPIキーを取得します。

1. Backlogにログイン
2. 右上のアイコン → 「個人設定」
3. 「API」タブ → 「新しいAPIキーを発行」

取得したAPIキーは環境変数に設定しておきます。

```bash
export BACKLOG_API_KEY="your-api-key"
export BACKLOG_SPACE="your-space"  # xxx.backlog.com の xxx 部分
export BACKLOG_PROJECT_KEY="PROJECT"  # プロジェクトキー
# 注: backlog.jp を使用している場合は、スクリプト内のBASE_URLを変更してください
```

### 2. Claude Codeにお願いする

Claude Codeを起動して、以下のようにお願いしました。

```text
Backlog APIを使って、指定したプロジェクトの課題データを取得し、
四半期ごとの完了課題数をCSVで出力するスクリプトを作ってください。

環境変数:
- BACKLOG_API_KEY: APIキー
- BACKLOG_SPACE: スペース名
- BACKLOG_PROJECT_KEY: プロジェクトキー
```

すると、Claude Codeは以下のようなスクリプトを生成してくれました。

:::details 生成されたスクリプト（backlog_stats.py）

```python:backlog_stats.py
#!/usr/bin/env python3
"""Backlogから完了課題を取得し、四半期ごとに集計するスクリプト"""

import os
import sys
import json
import urllib.request
import urllib.parse
from datetime import datetime

API_KEY = os.environ.get("BACKLOG_API_KEY")
SPACE = os.environ.get("BACKLOG_SPACE")
PROJECT_KEY = os.environ.get("BACKLOG_PROJECT_KEY")
BASE_URL = f"https://{SPACE}.backlog.com/api/v2"


def get_project_id() -> int:
    """プロジェクトキーからプロジェクトIDを取得"""
    url = f"{BASE_URL}/projects/{PROJECT_KEY}?apiKey={API_KEY}"
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
            "statusId[]": 4,  # 完了（デフォルト設定の場合。プロジェクトによりIDは異なる）
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
    """課題を四半期ごとに集計（最終更新日ベース）"""
    quarters = {}

    for issue in issues:
        # 注意: updatedは「完了日」ではなく「最終更新日」
        # 完了後にコメントが追加されると日付が変わる可能性あり
        date_str = issue.get("updated")
        if not date_str:
            continue

        dt = datetime.fromisoformat(date_str.replace("Z", "+00:00"))
        quarter = f"{dt.year}Q{(dt.month - 1) // 3 + 1}"
        quarters[quarter] = quarters.get(quarter, 0) + 1

    return quarters


def main():
    print("Fetching issues...", file=sys.stderr)
    project_id = get_project_id()
    issues = fetch_all_issues(project_id)
    print(f"Found {len(issues)} completed issues", file=sys.stderr)

    by_quarter = aggregate_by_quarter(issues)

    # CSV出力
    with open("quarterly-stats.csv", "w") as f:
        f.write("Quarter,Count\n")
        for quarter in sorted(by_quarter.keys()):
            f.write(f"{quarter},{by_quarter[quarter]}\n")

    print("Output: quarterly-stats.csv", file=sys.stderr)


if __name__ == "__main__":
    main()
```

:::

### 3. 実行結果

スクリプトを実行すると、以下のようなCSVが出力されました。

```csv
Quarter,Count
2024Q1,42
2024Q2,58
2024Q3,51
2024Q4,63
```

これをスプレッドシートに貼り付けてグラフ化すれば、四半期ごとの推移が一目でわかります。

### 4. 担当者別の集計を追加

「担当者別も見たい」とClaude Codeに追加でお願いすると、以下のような集計機能を追加してくれました。

```python
def aggregate_by_assignee(issues: list) -> dict:
    """担当者別に課題を集計"""
    assignees = {}

    for issue in issues:
        assignee = issue.get("assignee")
        name = assignee["name"] if assignee else "未割り当て"
        assignees[name] = assignees.get(name, 0) + 1

    return assignees
```

実行結果の例：

```csv
Assignee,Count
田中,45
佐藤,38
鈴木,32
未割り当て,12
```

### 5. 課題種別の集計を追加

課題種別（バグ、タスク、要望など）の内訳も同様に集計できます。

```python
def aggregate_by_issue_type(issues: list) -> dict:
    """課題種別ごとに集計"""
    types = {}

    for issue in issues:
        issue_type = issue.get("issueType", {})
        name = issue_type.get("name", "不明")
        types[name] = types.get(name, 0) + 1

    return types
```

実行結果の例：

```csv
IssueType,Count
要望,89
バグ,52
タスク,41
改善,32
```

## 遭遇した問題

実は、この作業中に一つ問題が発生しました。

プロジェクトの課題が1,000件以上あったため、全件取得しようとするとAPIレスポンスが約300KBになり、Claude Codeのコンテキストがかなり消費されてしまいました。

具体的には、Claude Codeが「取得したデータを確認しますね」と言って全データを表示しようとしたとき、auto-compactが頻発して作業が中断され、時間がかかるうえにAPIの利用制限も消費されてしまいました。

この問題を解決するために、Claude Codeの「skill機能」を使って、データ取得ロジックを外部スクリプトに切り出すアプローチを取りました。詳しい実装方法は別記事で解説しています。

@[card](https://zenn.dev/shosato/articles/claude-code-skill-context-management)

## 今後やりたいこと

現在は手動でスクリプトを実行していますが、GitHub Actionsで週次実行してSlackやTeamsに通知する、といった自動化も試してみたいと考えています。

```yaml:.github/workflows/backlog-stats.yml
name: Backlog Stats
on:
  schedule:
    - cron: '0 0 * * 1'  # 毎週月曜9時JST（UTCで0時=JST 9時）
jobs:
  stats:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: '3.12'
      - run: python backlog_stats.py
        env:
          BACKLOG_API_KEY: ${{ secrets.BACKLOG_API_KEY }}
          BACKLOG_SPACE: ${{ secrets.BACKLOG_SPACE }}
          BACKLOG_PROJECT_KEY: ${{ secrets.BACKLOG_PROJECT_KEY }}
```

## まとめ

Claude Codeを使ってBacklog APIからデータを取得し、生産性レポートを自動生成する方法を紹介しました。

私のチームでは、この方法で毎月の振り返りミーティングの準備時間が30分→5分程度に短縮できました。以前はBacklogからCSVで課題一覧をエクスポートして、Excelで集計していたので...。

ただし、データ量が多い場合はコンテキスト爆発に注意が必要です。その対策として、skill機能を活用する方法もぜひ試してみてください。

:::message
この記事の内容は2026年1月時点のものです。

- Claude Code: v2.1.12
- Python: 3.12.x
- Backlog API: v2
  :::
