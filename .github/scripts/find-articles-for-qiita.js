#!/usr/bin/env node
/**
 * Qiita同期用の記事検索スクリプト
 *
 * 環境変数:
 *   - EVENT_NAME: "workflow_dispatch" or "push"
 *   - SINGLE_SLUG: 特定の記事のみ対象（オプション）
 *   - CHANGED_FILES: 変更されたファイル一覧（スペース区切り、pushトリガー時のみ）
 *
 * 出力: JSON形式で記事情報を標準出力
 */

const fs = require("fs");
const path = require("path");
const matter = require("gray-matter");

const eventName = process.env.EVENT_NAME || "workflow_dispatch";
const singleSlug = process.env.SINGLE_SLUG || "";
const changedFiles = process.env.CHANGED_FILES || "";

const dir = "articles";

function getArticleInfo(filePath) {
  const content = fs.readFileSync(filePath, "utf8");
  const { data } = matter(content);
  return {
    file: filePath,
    slug: path.basename(filePath, ".md"),
    ...data
  };
}

function findArticles() {
  if (eventName === "workflow_dispatch") {
    // 手動実行時は全記事を対象（single_slugが指定されていればフィルタ）
    let files = fs.readdirSync(dir).filter((f) => f.endsWith(".md"));

    if (singleSlug) {
      files = files.filter((f) => path.basename(f, ".md") === singleSlug);
    }

    return files.map((f) => getArticleInfo(path.join(dir, f)));
  } else {
    // pushトリガー時は変更されたファイルのみ
    if (!changedFiles.trim()) {
      return [];
    }

    const files = changedFiles.trim().split(" ").filter(Boolean);
    return files.filter((f) => fs.existsSync(f)).map((f) => getArticleInfo(f));
  }
}

const articles = findArticles();
console.log(JSON.stringify(articles));
