/**
 * Zenn記事からX投稿対象の記事を検出するスクリプト
 *
 * 使用方法:
 *   node find-articles.js [--scheduled|--immediate] [--before-sha SHA] [--after-sha SHA]
 *
 * オプション:
 *   --scheduled    予約公開記事を検出（published_at <= 現在時刻、x_shared: false）
 *   --immediate    即時公開記事を検出（published: true になった記事、published_atなし）
 *   --before-sha   比較元コミットSHA（--immediate時に使用）
 *   --after-sha    比較先コミットSHA（--immediate時に使用）
 *   --dry-run      実行結果を表示するだけで変更しない
 *
 * 出力:
 *   JSON形式で検出された記事の配列を出力
 *   [{ slug, title, topics, file, xPost }]
 */

const fs = require("fs");
const path = require("path");
const matter = require("gray-matter");
const { execSync } = require("child_process");

// JSTをUTCに変換（9時間引く）
function jstToUtc(dateStr) {
  if (!dateStr) return null;

  // 複数のフォーマットに対応
  let date;

  // 1. "YYYY-MM-DD HH:MM" 形式（JST想定）
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(dateStr)) {
    const normalized = dateStr.replace(" ", "T");
    date = new Date(normalized + "+09:00");
  }
  // 2. ISO形式（タイムゾーン付き）
  else if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(dateStr)) {
    date = new Date(dateStr);
    // タイムゾーンがない場合はJSTとして扱う
    if (!/[Z+-]/.test(dateStr)) {
      date = new Date(dateStr + "+09:00");
    }
  }
  // 3. フォールバック: Date.parseで解析を試みる
  else {
    date = new Date(dateStr);
  }

  if (isNaN(date.getTime())) {
    console.error(`Invalid date format: ${dateStr}`);
    return null;
  }

  return date;
}

// Front Matterからx_postを取得（マルチライン対応、空行保持）
function getXPost(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return null;

  const frontMatterStr = match[1];

  // x_post: | または x_post: > のマルチライン対応
  // 空行を保持するため、改良したパターンを使用
  const xPostMatch = frontMatterStr.match(/^x_post:\s*[|>]-?\s*\n((?:[ \t]+.*\n?)*)/m);
  if (xPostMatch) {
    // インデントを除去しつつ空行を保持
    const lines = xPostMatch[1].split("\n");
    // 最小インデントを検出
    const nonEmptyLines = lines.filter((line) => line.trim() !== "");
    if (nonEmptyLines.length === 0) return null;

    const minIndent = Math.min(
      ...nonEmptyLines.map((line) => {
        const match = line.match(/^([ \t]*)/);
        return match ? match[1].length : 0;
      })
    );

    // インデントを除去
    const processed = lines
      .map((line) => (line.length >= minIndent ? line.slice(minIndent) : line))
      .join("\n")
      .trim();

    return processed;
  }

  // 単一行の場合
  const singleLineMatch = frontMatterStr.match(/^x_post:\s*["']?(.+?)["']?\s*$/m);
  if (singleLineMatch) {
    return singleLineMatch[1];
  }

  return null;
}

// 記事情報を抽出
function parseArticle(filePath) {
  const content = fs.readFileSync(filePath, "utf8");

  try {
    const { data: frontMatter } = matter(content);
    const slug = path.basename(filePath, ".md");

    return {
      slug,
      title: frontMatter.title || "",
      topics: Array.isArray(frontMatter.topics) ? frontMatter.topics.join(" ") : "",
      published: frontMatter.published === true,
      publishedAt: frontMatter.published_at || null,
      xShared: frontMatter.x_shared,
      xPost: getXPost(content),
      file: filePath
    };
  } catch (error) {
    console.error(`Failed to parse ${filePath}: ${error.message}`);
    return null;
  }
}

// 予約公開記事を検出
function findScheduledArticles() {
  const articlesDir = path.join(process.cwd(), "articles");
  const files = fs.readdirSync(articlesDir).filter((f) => f.endsWith(".md"));
  const now = new Date();

  console.error(`Current UTC time: ${now.toISOString()}`);

  const articles = [];

  for (const file of files) {
    const filePath = path.join(articlesDir, file);
    const article = parseArticle(filePath);

    if (!article) continue;

    console.error(`\nFile: ${article.file}`);

    if (!article.published) {
      console.error("  -> Not published");
      continue;
    }

    if (!article.publishedAt) {
      console.error("  -> No published_at (immediate publish)");
      continue;
    }

    const publishedAtUtc = jstToUtc(article.publishedAt);
    console.error(`  published_at (JST): ${article.publishedAt}`);
    console.error(
      `  published_at (UTC): ${publishedAtUtc ? publishedAtUtc.toISOString() : "invalid"}`
    );

    // x_shared: false が明示的にある場合のみ投稿対象
    if (article.xShared === false) {
      if (publishedAtUtc && publishedAtUtc <= now) {
        console.error("  -> Ready to share!");
        articles.push({
          slug: article.slug,
          title: article.title,
          topics: article.topics,
          file: article.file,
          xPost: article.xPost
        });
      } else {
        console.error("  -> Not yet (scheduled for future)");
      }
    } else if (article.xShared === true) {
      console.error("  -> Already shared");
    } else {
      console.error("  -> No x_shared flag (skipped)");
    }
  }

  return articles;
}

// 即時公開記事を検出（pushトリガー用）
function findImmediateArticles(beforeSha, afterSha) {
  // 初回pushはスキップ
  if (beforeSha === "0000000000000000000000000000000000000000") {
    console.error("Initial push detected, skipping to avoid mass posting");
    return [];
  }

  // beforeShaが履歴に存在するか確認
  try {
    execSync(`git cat-file -e ${beforeSha}`, { stdio: "pipe" });
  } catch {
    console.error(`BEFORE_SHA (${beforeSha}) not found in history (force-push?), skipping`);
    return [];
  }

  // 変更されたファイルを取得
  let changedFiles;
  try {
    changedFiles = execSync(`git diff --name-only ${beforeSha} ${afterSha} -- 'articles/*.md'`, {
      encoding: "utf8"
    })
      .trim()
      .split("\n")
      .filter(Boolean);
  } catch {
    console.error("Failed to get changed files");
    return [];
  }

  if (changedFiles.length === 0) {
    return [];
  }

  const articles = [];

  for (const file of changedFiles) {
    if (!fs.existsSync(file)) continue;

    const article = parseArticle(file);
    if (!article) continue;

    if (!article.published) continue;

    // published_at がある場合は予約公開なのでスキップ
    if (article.publishedAt) {
      console.error(`Skipping ${file} (scheduled publishing)`);
      continue;
    }

    // push前の状態で published: true だったか確認
    let prevPublished = false;
    try {
      const prevContent = execSync(`git show ${beforeSha}:${file}`, {
        encoding: "utf8",
        stdio: ["pipe", "pipe", "pipe"]
      });
      const { data: prevFrontMatter } = matter(prevContent);
      prevPublished = prevFrontMatter.published === true;
    } catch {
      // ファイルが存在しなかった（新規作成）
      prevPublished = false;
    }

    if (!prevPublished) {
      // 新規公開
      articles.push({
        slug: article.slug,
        title: article.title,
        topics: article.topics,
        file: article.file,
        xPost: article.xPost
      });
    }
  }

  return articles;
}

// メイン処理
function main() {
  const args = process.argv.slice(2);
  const isScheduled = args.includes("--scheduled");
  const isImmediate = args.includes("--immediate");

  let articles = [];

  if (isScheduled) {
    articles = findScheduledArticles();
  } else if (isImmediate) {
    const beforeIdx = args.indexOf("--before-sha");
    const afterIdx = args.indexOf("--after-sha");

    if (beforeIdx === -1 || afterIdx === -1) {
      console.error("Error: --immediate requires --before-sha and --after-sha");
      process.exit(1);
    }

    const beforeSha = args[beforeIdx + 1];
    const afterSha = args[afterIdx + 1];
    articles = findImmediateArticles(beforeSha, afterSha);
  } else {
    // デフォルトは予約公開
    articles = findScheduledArticles();
  }

  // 結果をJSON形式で出力
  console.log(JSON.stringify(articles));
}

main();
