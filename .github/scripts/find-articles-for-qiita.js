#!/usr/bin/env node
/**
 * Qiita同期用の記事検索スクリプト
 *
 * 環境変数:
 *   - EVENT_NAME: "workflow_dispatch", "schedule", or "push"
 *   - SINGLE_SLUG: 特定の記事のみ対象（オプション）
 *   - CHANGED_FILES: 変更されたファイル一覧（スペース区切り、pushトリガー時のみ）
 *
 * 出力: JSON形式で記事情報を標準出力
 *
 * フィルタリング条件:
 *   - qiita_sync: true の記事のみ対象
 *   - published_at が未来の場合はスキップ（予約公開との連携）
 *     ※ published の値に関わらず、published_at が未来ならスキップ
 *     ※ 手動実行（workflow_dispatch）でも同様にスキップ
 */

const fs = require("fs");
const path = require("path");
const matter = require("gray-matter");

/**
 * JST日時をUTC Dateオブジェクトに変換
 * @param {string|Date} dateInput - 日時文字列またはDateオブジェクト
 * @returns {Date|null} - UTCのDateオブジェクト、または無効な場合はnull
 */
function jstToUtc(dateInput) {
  if (!dateInput) return null;

  // gray-matterがDateオブジェクトとして解釈した場合
  // （クォートなしの日時はUTCとして解釈される）
  if (dateInput instanceof Date) {
    return dateInput;
  }

  const dateStr = String(dateInput);
  let date;

  // 1. "YYYY-MM-DD HH:MM" または "YYYY-MM-DD HH:MM:SS" 形式（JST想定）
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}(:\d{2})?$/.test(dateStr)) {
    const normalized = dateStr.replace(" ", "T");
    date = new Date(normalized + "+09:00");
  }
  // 2. ISO形式（T区切り）
  else if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(dateStr)) {
    // タイムゾーン指定があるかチェック（時刻部分の後ろのみ）
    const hasTimezone = /T\d{2}:\d{2}(:\d{2})?(\.\d+)?([Z+-])/.test(dateStr);
    if (hasTimezone) {
      date = new Date(dateStr);
    } else {
      date = new Date(dateStr + "+09:00");
    }
  }
  // 3. "YYYY-MM-DD" 形式（00:00 JSTとして扱う）
  else if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    date = new Date(dateStr + "T00:00+09:00");
  }
  // 4. フォールバック
  else {
    date = new Date(dateStr);
  }

  if (isNaN(date.getTime())) {
    console.error(`Invalid date format: ${dateStr}`);
    return null;
  }

  return date;
}

/**
 * published_at が同期可能な状態かチェック
 * @param {object} article - 記事情報
 * @param {Date} now - 現在時刻
 * @returns {boolean} - 同期可能ならtrue
 */
function isPublishedAtReady(article, now) {
  // published_atが未設定 → 即時同期OK
  if (!article.published_at) {
    return true;
  }

  const publishedAtUtc = jstToUtc(article.published_at);

  // 形式不正 → エラーログを出力してスキップ
  if (!publishedAtUtc) {
    console.error(`  Skipping ${article.slug}: invalid published_at format`);
    return false;
  }

  // published_atが過去または現在 → 同期OK
  return publishedAtUtc <= now;
}

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
  let articles;

  if (eventName === "workflow_dispatch" || eventName === "schedule") {
    // 手動実行/定期実行時は全記事を対象（single_slugが指定されていればフィルタ）
    let files = fs.readdirSync(dir).filter((f) => f.endsWith(".md"));

    if (singleSlug) {
      files = files.filter((f) => path.basename(f, ".md") === singleSlug);
    }

    articles = files.map((f) => getArticleInfo(path.join(dir, f)));
  } else {
    // pushトリガー時は変更されたファイルのみ
    if (!changedFiles.trim()) {
      return [];
    }

    const files = changedFiles.trim().split(" ").filter(Boolean);
    articles = files.filter((f) => fs.existsSync(f)).map((f) => getArticleInfo(f));
  }

  // フィルタリング: qiita_sync: true かつ published_at が過去/現在
  const now = new Date();
  console.error(`Current UTC time: ${now.toISOString()}`);

  return articles.filter((article) => {
    // 1. qiita_sync: true が必須
    if (article.qiita_sync !== true) {
      return false;
    }

    // 2. published_atチェック（未設定 OR 過去/現在）
    if (!isPublishedAtReady(article, now)) {
      console.error(`  -> Skipping ${article.slug}: scheduled for future`);
      return false;
    }

    return true;
  });
}

const articles = findArticles();
console.log(JSON.stringify(articles));
