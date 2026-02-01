# CI修正計画

## 問題概要

CIのlintジョブが失敗している。原因は`articles/codex-vs-copilot-cli-benchmark.md`のtextlintエラー8件。

## エラー詳細

| #   | 行:列   | ルール                               | 問題箇所              |
| --- | ------- | ------------------------------------ | --------------------- |
| 1   | 80:29   | ja-no-weak-phrase                    | 「だと思います」      |
| 2   | 82:11   | ja-space-between-half-and-full-width | `:::details 採点方法` |
| 3   | 100:60  | ja-no-weak-phrase                    | 「かもしれません」    |
| 4   | 172:28  | no-doubled-joshi                     | 「は」が連続          |
| 5   | 174:100 | ja-no-weak-phrase                    | 「思います」          |
| 6   | 176:46  | ja-no-weak-phrase                    | 「思います」          |
| 7   | 192:11  | ja-space-between-half-and-full-width | `:::details 計測方法` |
| 8   | 196:18  | ja-unnatural-alphabet                | 「t検定」の「t」      |

---

## 修正方針

### A. 記事の修正（5件）

| 行  | 修正前                                 | 修正後                                 |
| --- | -------------------------------------- | -------------------------------------- |
| 80  | 「正直、**誤差レベル**だと思います。」 | 「正直、**誤差レベル**です。」         |
| 100 | 「出力量が少ないからかもしれません。」 | 「出力量が少ないためと考えられます。」 |
| 172 | 「最悪ケースはどちらも変わらない」     | 「最悪ケースも同様」                   |
| 174 | 「計測してみようと思います。」         | 「計測してみます。」                   |
| 176 | 「どちらでもいいと思います。」         | 「どちらでもよいです。」               |

### B. textlint設定の修正（3件）

#### 1. `:::details`のスペース問題（2件）

`allows`オプションで`:::details`パターンを許可:

```json
"ja-space-between-half-and-full-width": {
  "space": "never",
  "allows": ["/:::details /"]
}
```

#### 2. 「t検定」の問題（1件）

`allow`オプションで統計用語を許可:

```json
"ja-unnatural-alphabet": {
  "allow": ["t検定", "F検定", "z検定"]
}
```

---

## 修正対象ファイル

1. `/home/user/zenn-content/articles/codex-vs-copilot-cli-benchmark.md` - 記事5箇所を修正
2. `/home/user/zenn-content/.textlintrc.json` - 設定2箇所を追加

---

## 実装手順

1. `.textlintrc.json`の設定を更新
2. 記事の5箇所を修正
3. `npm run lint:text`で確認
4. `npm run lint`で全lint通過を確認
5. コミット＆プッシュ

---

## 検証方法

```bash
# 1. textlintでエラー0件を確認
npm run lint:text

# 2. 全lintが通ることを確認
npm run lint

# 3. プレビューで表示確認（任意）
npx zenn-cli preview
```

---

## 最終的なtextlint設定

```json
{
  "filters": {
    "comments": true
  },
  "rules": {
    "preset-ja-technical-writing": {
      "sentence-length": { "max": 150 },
      "max-kanji-continuous-len": { "max": 6 },
      "no-exclamation-question-mark": false,
      "ja-no-mixed-period": false,
      "no-doubled-joshi": {
        "allow": ["に", "で", "が", "と"]
      },
      "ja-unnatural-alphabet": {
        "allow": ["t検定", "F検定", "z検定"]
      }
    },
    "preset-ja-spacing": {
      "ja-space-between-half-and-full-width": {
        "space": "never",
        "allows": ["/:::details /"]
      },
      "ja-no-space-around-parentheses": false
    }
  }
}
```
