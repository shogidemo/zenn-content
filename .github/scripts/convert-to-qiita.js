/**
 * Zenn記事をQiita形式に変換するスクリプト
 *
 * 使用方法:
 *   node convert-to-qiita.js [--all] [--dry-run] [--file <path>]
 *
 * オプション:
 *   --all      全ての記事を変換
 *   --dry-run  変換結果を表示するだけで、APIリクエスト用データは出力しない
 *   --file     特定のファイルのみ変換
 *
 * 環境変数:
 *   ARTICLES   変換対象記事のJSON配列（GitHub Actionsから渡される）
 *   GITHUB_REPOSITORY  リポジトリ名（例: shogidemo/zenn-content）
 *
 * 出力:
 *   変換後の記事データをJSON形式で標準出力に出力
 */

const fs = require("fs");
const path = require("path");
const matter = require("gray-matter");

// 設定
const QIITA_MAX_TAGS = 5;
const DEFAULT_REPO = "shogidemo/zenn-content";
const DEFAULT_BRANCH = "main";

/**
 * コードブロックを一時的にプレースホルダーに置換
 * @param {string} content - Markdown本文
 * @returns {{ content: string, codeBlocks: string[] }}
 */
function extractCodeBlocks(content) {
  const codeBlocks = [];
  const placeholder = "___CODE_BLOCK_PLACEHOLDER___";

  // バッククォート3つ以上のコードブロックを抽出
  const codeBlockPattern = /(```+[\s\S]*?```+)/g;
  const extracted = content.replace(codeBlockPattern, (match) => {
    codeBlocks.push(match);
    return `${placeholder}${codeBlocks.length - 1}${placeholder}`;
  });

  return { content: extracted, codeBlocks };
}

/**
 * プレースホルダーをコードブロックに復元
 * @param {string} content - プレースホルダー付きの本文
 * @param {string[]} codeBlocks - 抽出したコードブロック
 * @returns {string}
 */
function restoreCodeBlocks(content, codeBlocks) {
  const placeholder = "___CODE_BLOCK_PLACEHOLDER___";
  return content.replace(
    new RegExp(`${placeholder}(\\d+)${placeholder}`, "g"),
    (_, index) => codeBlocks[parseInt(index, 10)]
  );
}

/**
 * Zenn記法をQiita記法に変換
 * @param {string} content - Markdown本文
 * @param {string} repo - GitHubリポジトリ名
 * @returns {string}
 */
function convertZennToQiita(content, repo) {
  // コードブロックを退避
  const { content: withoutCode, codeBlocks } = extractCodeBlocks(content);

  let converted = withoutCode;

  // 1. ブロック記法を変換（:::message, :::details など）
  // スタックベースでネストに対応
  converted = convertBlockDirectives(converted);

  // 4. @[card](URL) → URL直書き
  converted = converted.replace(/@\[card\]\((https?:\/\/[^)]+)\)/g, "$1");

  // 5. 画像パス変換: /images/xxx → GitHub raw URL
  const imageBaseUrl = `https://raw.githubusercontent.com/${repo}/${DEFAULT_BRANCH}`;
  converted = converted.replace(
    /!\[([^\]]*)\]\(\/images\/([^)]+)\)/g,
    `![$1](${imageBaseUrl}/images/$2)`
  );

  // コードブロックを復元
  converted = restoreCodeBlocks(converted, codeBlocks);

  return converted;
}

/**
 * Zennのブロック記法を変換（:::message, :::details など）
 * @param {string} content
 * @returns {string}
 */
function convertBlockDirectives(content) {
  const lines = content.split("\n");
  const result = [];
  const stack = []; // ネストされたブロックを追跡: { type: 'details'|'note', indent: number }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmedLine = line.trim();
    const indent = line.length - line.trimStart().length;

    // :::details タイトル の開始（スペースなしも対応）
    const detailsMatch = trimmedLine.match(/^:::details\s*(.+)$/);
    if (detailsMatch) {
      const title = detailsMatch[1].trim();
      result.push(`${" ".repeat(indent)}<details><summary>${title}</summary>`);
      result.push("");
      stack.push({ type: "details", indent });
      continue;
    }

    // :::message alert の開始（先にチェック）
    if (trimmedLine === ":::message alert") {
      result.push(`${" ".repeat(indent)}:::note warn`);
      stack.push({ type: "note", indent });
      continue;
    }

    // :::message の開始
    if (trimmedLine === ":::message") {
      result.push(`${" ".repeat(indent)}:::note info`);
      stack.push({ type: "note", indent });
      continue;
    }

    // ::: の終了
    if (trimmedLine === ":::") {
      if (stack.length > 0) {
        const top = stack[stack.length - 1];
        if (top.type === "details") {
          result.push("");
          result.push(`${" ".repeat(indent)}</details>`);
          stack.pop();
          continue;
        } else if (top.type === "note") {
          result.push(`${" ".repeat(indent)}:::`);
          stack.pop();
          continue;
        }
      }
    }

    result.push(line);
  }

  return result.join("\n");
}

/**
 * Front MatterをQiita形式に変換
 * @param {object} frontMatter - Zenn形式のFront Matter
 * @returns {object} - Qiita API用のデータ
 */
function convertFrontMatter(frontMatter) {
  const tags = Array.isArray(frontMatter.topics)
    ? frontMatter.topics.slice(0, QIITA_MAX_TAGS).map((name) => ({ name }))
    : [];

  if (frontMatter.topics && frontMatter.topics.length > QIITA_MAX_TAGS) {
    console.error(
      `  ⚠️ タグが${QIITA_MAX_TAGS}件を超えています。最初の${QIITA_MAX_TAGS}件のみ使用します。`
    );
  }

  return {
    title: frontMatter.title || "",
    tags,
    private: frontMatter.published !== true,
    tweet: false // X投稿は不要
  };
}

/**
 * 変換結果をチェックし、未変換のZenn記法がないか確認
 * @param {string} content - 変換後の本文
 * @returns {string[]} - 警告メッセージの配列
 */
function validateConversion(content) {
  const warnings = [];

  // コードブロックを除外してチェック
  const { content: withoutCode } = extractCodeBlocks(content);

  if (/:::message/.test(withoutCode)) {
    warnings.push("未変換の :::message 記法が残っています");
  }
  if (/:::details/.test(withoutCode)) {
    warnings.push("未変換の :::details 記法が残っています");
  }
  if (/@\[card\]/.test(withoutCode)) {
    warnings.push("未変換の @[card] 記法が残っています");
  }
  if (/!\[[^\]]*\]\(\/images\//.test(withoutCode)) {
    warnings.push("未変換のローカル画像パス (/images/) が残っています");
  }

  return warnings;
}

/**
 * 記事ファイルを変換
 * @param {string} filePath - 記事ファイルのパス
 * @param {string} repo - GitHubリポジトリ名
 * @returns {object|null} - 変換結果
 */
function convertArticle(filePath, repo) {
  const content = fs.readFileSync(filePath, "utf8");
  const { data: frontMatter, content: body } = matter(content);
  const slug = path.basename(filePath, ".md");

  console.error(`\n--- ${slug} ---`);
  console.error(`  タイトル: ${frontMatter.title}`);
  console.error(`  公開状態: ${frontMatter.published ? "公開" : "非公開"}`);

  // Front Matter変換
  const qiitaData = convertFrontMatter(frontMatter);

  // 本文変換
  const convertedBody = convertZennToQiita(body, repo);

  // 変換結果をチェック
  const warnings = validateConversion(convertedBody);
  if (warnings.length > 0) {
    console.error("  ⚠️ 変換警告:");
    warnings.forEach((w) => console.error(`    - ${w}`));
  }

  return {
    slug,
    file: filePath,
    qiitaId: frontMatter.qiita_id || null,
    data: {
      ...qiitaData,
      body: convertedBody.trim()
    }
  };
}

/**
 * 全記事を取得
 * @returns {string[]} - 記事ファイルパスの配列
 */
function getAllArticles() {
  const articlesDir = path.join(process.cwd(), "articles");
  const files = fs.readdirSync(articlesDir).filter((f) => f.endsWith(".md"));
  return files.map((f) => path.join(articlesDir, f));
}

/**
 * メイン処理
 */
function main() {
  const args = process.argv.slice(2);
  const isAll = args.includes("--all");
  const isDryRun = args.includes("--dry-run");
  const fileIndex = args.indexOf("--file");

  const repo = process.env.GITHUB_REPOSITORY || DEFAULT_REPO;

  console.error("=== Zenn → Qiita 変換 ===");
  console.error(`リポジトリ: ${repo}`);
  if (isDryRun) console.error("[DRY RUN モード]");

  let filePaths = [];

  if (fileIndex !== -1 && args[fileIndex + 1]) {
    // 特定のファイルを変換
    filePaths = [args[fileIndex + 1]];
  } else if (isAll) {
    // 全記事を変換
    filePaths = getAllArticles();
  } else if (process.env.ARTICLES) {
    // 環境変数から記事リストを取得
    const articles = JSON.parse(process.env.ARTICLES);
    filePaths = articles.map((a) => a.file);
  } else {
    console.error("Error: --all, --file, または ARTICLES 環境変数が必要です");
    process.exit(1);
  }

  if (filePaths.length === 0) {
    console.error("変換対象の記事がありません");
    console.log("[]");
    process.exit(0);
  }

  console.error(`対象記事数: ${filePaths.length}`);

  const results = [];
  let warningCount = 0;

  for (const filePath of filePaths) {
    if (!fs.existsSync(filePath)) {
      console.error(`  ⚠️ ファイルが見つかりません: ${filePath}`);
      continue;
    }

    const result = convertArticle(filePath, repo);
    if (result) {
      results.push(result);

      // 警告があったかチェック
      const warnings = validateConversion(result.data.body);
      if (warnings.length > 0) {
        warningCount++;
      }
    }
  }

  console.error(`\n=== 変換結果 ===`);
  console.error(`成功: ${results.length}件, 警告: ${warningCount}件`);

  if (isDryRun) {
    // dry-runモードでは各記事の変換結果を表示
    for (const result of results) {
      console.error(`\n========== ${result.slug} ==========`);
      console.error(`Title: ${result.data.title}`);
      console.error(`Tags: ${result.data.tags.map((t) => t.name).join(", ")}`);
      console.error(`Private: ${result.data.private}`);
      console.error(`Qiita ID: ${result.qiitaId || "(新規)"}`);
      console.error("--- Body ---");
      console.error(result.data.body.substring(0, 500) + "...");
    }
  }

  // JSON形式で出力（post-to-qiita.jsで使用）
  console.log(JSON.stringify(results));
}

main();
