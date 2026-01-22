/**
 * Qiita APIで記事を投稿・更新するスクリプト
 *
 * 使用方法:
 *   node post-to-qiita.js [--dry-run]
 *
 * 環境変数:
 *   QIITA_TOKEN        Qiita APIトークン
 *   CONVERTED_ARTICLES 変換済み記事のJSON配列（convert-to-qiita.jsの出力）
 *
 * オプション:
 *   --dry-run  投稿せずに内容を表示
 */

const fs = require("fs");
const matter = require("gray-matter");

const QIITA_API_BASE = "https://qiita.com/api/v2";

/**
 * Qiita APIにリクエストを送信
 * @param {string} endpoint - APIエンドポイント
 * @param {string} method - HTTPメソッド
 * @param {object} body - リクエストボディ
 * @param {string} token - APIトークン
 * @returns {Promise<{ok: boolean, status: number, data: object}>}
 */
async function qiitaRequest(endpoint, method, body, token) {
  const url = `${QIITA_API_BASE}${endpoint}`;

  const response = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: body ? JSON.stringify(body) : undefined
  });

  let data = null;
  try {
    data = await response.json();
  } catch {
    // JSONパースエラーは無視
  }

  return {
    ok: response.ok,
    status: response.status,
    data
  };
}

/**
 * 記事を新規投稿
 * @param {object} articleData - 記事データ
 * @param {string} token - APIトークン
 * @returns {Promise<{success: boolean, id: string|null, error: string|null}>}
 */
async function createArticle(articleData, token) {
  const response = await qiitaRequest("/items", "POST", articleData, token);

  if (response.ok) {
    return {
      success: true,
      id: response.data.id,
      error: null
    };
  }

  return {
    success: false,
    id: null,
    error: response.data?.message || `HTTP ${response.status}`
  };
}

/**
 * 記事を更新
 * @param {string} itemId - Qiita記事ID
 * @param {object} articleData - 記事データ
 * @param {string} token - APIトークン
 * @returns {Promise<{success: boolean, id: string|null, error: string|null, notFound: boolean}>}
 */
async function updateArticle(itemId, articleData, token) {
  const response = await qiitaRequest(`/items/${itemId}`, "PATCH", articleData, token);

  if (response.ok) {
    return {
      success: true,
      id: response.data.id,
      error: null,
      notFound: false
    };
  }

  // 404の場合は記事が削除されている
  if (response.status === 404) {
    return {
      success: false,
      id: null,
      error: "記事が見つかりません（削除された可能性があります）",
      notFound: true
    };
  }

  return {
    success: false,
    id: null,
    error: response.data?.message || `HTTP ${response.status}`,
    notFound: false
  };
}

/**
 * Front Matterにqiita_idを追加
 * @param {string} filePath - 記事ファイルのパス
 * @param {string} qiitaId - Qiita記事ID
 */
function addQiitaIdToFrontMatter(filePath, qiitaId) {
  const content = fs.readFileSync(filePath, "utf8");
  const parsed = matter(content);

  // 既に同じIDがある場合はスキップ
  if (parsed.data.qiita_id === qiitaId) {
    return false;
  }

  parsed.data.qiita_id = qiitaId;
  const updated = matter.stringify(parsed.content, parsed.data);
  fs.writeFileSync(filePath, updated);
  return true;
}

/**
 * 記事を投稿または更新
 * @param {object} article - 変換済み記事
 * @param {string} token - APIトークン
 * @param {boolean} dryRun - dry-runモード
 * @returns {Promise<{success: boolean, action: string, id: string|null, updated: boolean}>}
 */
async function postOrUpdateArticle(article, token, dryRun) {
  const { slug, file, qiitaId, data } = article;

  console.log(`\n--- ${slug} ---`);
  console.log(`  タイトル: ${data.title}`);
  console.log(`  タグ: ${data.tags.map((t) => t.name).join(", ")}`);
  console.log(`  公開状態: ${data.private ? "非公開" : "公開"}`);
  console.log(`  Qiita ID: ${qiitaId || "(新規)"}`);

  if (dryRun) {
    console.log("  [DRY RUN] 投稿をスキップしました");
    return { success: true, action: "dry-run", id: qiitaId, updated: false };
  }

  let result;

  if (qiitaId) {
    // 既存記事を更新
    console.log("  更新中...");
    result = await updateArticle(qiitaId, data, token);

    if (result.notFound) {
      // 404の場合は新規作成にフォールバック
      console.log("  ⚠️ 記事が見つかりません。新規作成します...");
      result = await createArticle(data, token);

      if (result.success) {
        // 新しいIDでFront Matterを更新
        const updated = addQiitaIdToFrontMatter(file, result.id);
        console.log(`  ✅ 新規作成成功 (ID: ${result.id})`);
        return { success: true, action: "recreated", id: result.id, updated };
      }
    }

    if (result.success) {
      console.log("  ✅ 更新成功");
      return { success: true, action: "updated", id: result.id, updated: false };
    }
  } else {
    // 新規投稿
    console.log("  新規投稿中...");
    result = await createArticle(data, token);

    if (result.success) {
      // Front Matterにqiita_idを追加
      const updated = addQiitaIdToFrontMatter(file, result.id);
      console.log(`  ✅ 投稿成功 (ID: ${result.id})`);
      return { success: true, action: "created", id: result.id, updated };
    }
  }

  console.error(`  ❌ 失敗: ${result.error}`);
  return { success: false, action: "failed", id: null, updated: false };
}

/**
 * メイン処理
 */
async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");

  const token = process.env.QIITA_TOKEN;
  const articlesJson = process.env.CONVERTED_ARTICLES;

  if (!dryRun && !token) {
    console.error("Error: QIITA_TOKEN environment variable is required");
    process.exit(1);
  }

  if (!articlesJson) {
    console.error("Error: CONVERTED_ARTICLES environment variable is required");
    process.exit(1);
  }

  const articles = JSON.parse(articlesJson);

  if (articles.length === 0) {
    console.log("投稿対象の記事がありません");
    process.exit(0);
  }

  console.log("=== Qiita投稿処理 ===");
  console.log(`対象記事数: ${articles.length}`);
  if (dryRun) console.log("[DRY RUN モード]");

  let successCount = 0;
  let failCount = 0;
  let updatedFiles = [];
  const failedArticles = [];

  for (const article of articles) {
    const result = await postOrUpdateArticle(article, token, dryRun);

    if (result.success) {
      successCount++;
      if (result.updated) {
        updatedFiles.push(article.file);
      }
    } else {
      failCount++;
      failedArticles.push(article.slug);
    }
  }

  // 結果サマリー
  console.log("\n=== 投稿結果 ===");
  console.log(`成功: ${successCount}件, 失敗: ${failCount}件`);

  if (updatedFiles.length > 0) {
    console.log(`\nFront Matter更新が必要なファイル:`);
    updatedFiles.forEach((f) => console.log(`  - ${f}`));
  }

  if (failCount > 0) {
    console.error("\n⚠️ 失敗した記事:");
    failedArticles.forEach((slug) => console.error(`  - ${slug}`));
  }

  // GitHub Actionsの出力に更新ファイルリストを渡す
  if (process.env.GITHUB_OUTPUT) {
    const output = `updated_files=${updatedFiles.join(",")}`;
    fs.appendFileSync(process.env.GITHUB_OUTPUT, output + "\n");
  }

  // 1件でも成功したらexit 0
  process.exit(successCount > 0 || articles.length === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error("Unexpected error:", error);
  process.exit(1);
});
