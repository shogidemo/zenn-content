/**
 * Zenn記事をXに投稿するスクリプト
 *
 * 使用方法:
 *   node post-to-x.js [--dry-run] [--mark-shared]
 *
 * 環境変数:
 *   ARTICLES         投稿対象記事のJSON配列
 *   ZENN_USERNAME    Zennユーザー名
 *   X_API_KEY        X API Key
 *   X_API_KEY_SECRET X API Key Secret
 *   X_ACCESS_TOKEN   X Access Token
 *   X_ACCESS_TOKEN_SECRET X Access Token Secret
 *
 * オプション:
 *   --dry-run      投稿せずに内容を表示
 *   --mark-shared  投稿後にx_shared: trueに更新
 */

const fs = require("fs");
const matter = require("gray-matter");
const { TwitterApi } = require("twitter-api-v2");

// X投稿の最大文字数（URLは23文字としてカウント）
const MAX_TWEET_LENGTH = 280;
const URL_LENGTH = 23;

// X APIエラーコードのマッピング
const X_ERROR_CODES = {
  32: "認証エラー - APIキーまたはトークンが無効です",
  34: "ページが見つかりません",
  64: "アカウントが停止されています",
  88: "レート制限 - しばらく待ってから再試行してください",
  89: "トークンが無効または期限切れです",
  130: "内部エラー - しばらく待ってから再試行してください",
  131: "内部エラー - しばらく待ってから再試行してください",
  161: "フォロー制限に達しました",
  185: "日次ステータス更新制限に達しました",
  186: "ツイートが長すぎます",
  187: "重複投稿 - 同じ内容のツイートはできません",
  226: "この操作は自動化されたものと判定されました",
  261: "アプリが書き込み操作を許可されていません",
  326: "一時的にロックされています",
  354: "DM送信制限に達しました"
};

// ツイートの文字数を計算（URLは23文字としてカウント）
function calculateTweetLength(text) {
  // URLを検出して23文字としてカウント
  const urlPattern = /https?:\/\/[^\s]+/g;
  const urls = text.match(urlPattern) || [];
  let length = text.length;

  for (const url of urls) {
    length = length - url.length + URL_LENGTH;
  }

  return length;
}

// 投稿テキストを生成
function generateTweetText(article, username) {
  const url = `https://zenn.dev/${username}/articles/${article.slug}`;

  if (article.xPost) {
    // カスタム投稿文がある場合
    let text = article.xPost;

    if (text.includes("{url}")) {
      // {url}プレースホルダーを置換
      text = text.replace(/\{url\}/g, url);
    } else {
      // {url}がない場合は末尾にURLを追加
      text = `${text}\n\n${url}`;
      console.log("  注: x_postに{url}がないため、末尾にURLを追加しました");
    }

    return text;
  }

  // デフォルトフォーマット
  const hashtags = article.topics
    .split(" ")
    .filter((t) => t)
    .map((t) => `#${t}`)
    .join(" ");

  return `${article.title}\n\n${url}\n\n${hashtags} #zenn`;
}

// 文字数をチェックして警告を出力
function checkTweetLength(text, articleTitle) {
  const length = calculateTweetLength(text);

  if (length > MAX_TWEET_LENGTH) {
    console.error(
      `\n⚠️ 警告: "${articleTitle}" の投稿文が${MAX_TWEET_LENGTH}文字を超えています (${length}文字)`
    );
    console.error("投稿が失敗する可能性があります。x_postを短くしてください。");
    return false;
  }

  console.log(`  文字数: ${length}/${MAX_TWEET_LENGTH}`);
  return true;
}

// X APIエラーをパースして詳細メッセージを取得
function getErrorMessage(error) {
  // twitter-api-v2のエラー構造を解析
  const errorData = error.data || error;

  // エラーコードを取得
  let errorCode = null;
  let errorMessage = error.message || "不明なエラー";

  if (errorData?.errors && Array.isArray(errorData.errors)) {
    const firstError = errorData.errors[0];
    errorCode = firstError.code;
    errorMessage = firstError.message || errorMessage;
  } else if (errorData?.detail) {
    errorMessage = errorData.detail;
  }

  // 既知のエラーコードの詳細説明を追加
  if (errorCode && X_ERROR_CODES[errorCode]) {
    return `${X_ERROR_CODES[errorCode]} (code: ${errorCode})\n  詳細: ${errorMessage}`;
  }

  // クレジット関連のエラーを検出
  if (errorMessage?.includes("credits") || errorMessage?.includes("subscription")) {
    return `X API課金エラー\n  詳細: ${errorMessage}\n  X Developer Portalでクレジットをチャージしてください。\n  最低$5のチャージが必要です（1投稿あたり$0.01）\n  https://developer.twitter.com/`;
  }

  return errorMessage;
}

// 記事を投稿
async function postTweet(client, article, username, options = {}) {
  const { dryRun = false, markShared = false } = options;

  const text = generateTweetText(article, username);

  console.log(`\n--- ${article.title} ---`);
  console.log(`投稿内容:\n${text}`);

  // 文字数チェック（警告のみ、投稿は続行）
  checkTweetLength(text, article.title);

  if (dryRun) {
    console.log("[DRY RUN] 投稿をスキップしました");
    return true;
  }

  try {
    await client.v2.tweet(text);
    console.log("✅ 投稿成功");

    if (markShared) {
      // x_shared: true に更新（gray-matterで堅牢に処理）
      const content = fs.readFileSync(article.file, "utf8");
      const parsed = matter(content);
      parsed.data.x_shared = true;
      const updated = matter.stringify(parsed.content, parsed.data);
      fs.writeFileSync(article.file, updated);
      console.log("  x_shared: true に更新しました");
    }

    return true;
  } catch (error) {
    console.error(`❌ 投稿失敗: ${article.title}`);
    console.error(`  エラー: ${getErrorMessage(error)}`);
    return false;
  }
}

// メイン処理
async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const markShared = args.includes("--mark-shared");

  // 環境変数から記事情報を取得
  const articlesJson = process.env.ARTICLES;
  const username = process.env.ZENN_USERNAME;

  if (!articlesJson) {
    console.error("Error: ARTICLES environment variable is required");
    process.exit(1);
  }

  if (!username) {
    console.error("Error: ZENN_USERNAME environment variable is required");
    process.exit(1);
  }

  const articles = JSON.parse(articlesJson);

  if (articles.length === 0) {
    console.log("投稿対象の記事がありません");
    process.exit(0);
  }

  console.log(`=== X投稿処理 ===`);
  console.log(`対象記事数: ${articles.length}`);
  if (dryRun) console.log("[DRY RUN モード]");

  // X APIクライアントを初期化
  let client = null;
  if (!dryRun) {
    if (
      !process.env.X_API_KEY ||
      !process.env.X_API_KEY_SECRET ||
      !process.env.X_ACCESS_TOKEN ||
      !process.env.X_ACCESS_TOKEN_SECRET
    ) {
      console.error("Error: X API credentials are required");
      process.exit(1);
    }

    client = new TwitterApi({
      appKey: process.env.X_API_KEY,
      appSecret: process.env.X_API_KEY_SECRET,
      accessToken: process.env.X_ACCESS_TOKEN,
      accessSecret: process.env.X_ACCESS_TOKEN_SECRET
    });
  }

  // 投稿処理
  let successCount = 0;
  let failCount = 0;
  const failedArticles = [];

  for (const article of articles) {
    const success = await postTweet(client, article, username, {
      dryRun,
      markShared
    });

    if (success) {
      successCount++;
    } else {
      failCount++;
      failedArticles.push(article.title);
    }
  }

  // 結果サマリー
  console.log(`\n=== 投稿結果 ===`);
  console.log(`成功: ${successCount}件, 失敗: ${failCount}件`);

  if (failCount > 0) {
    console.error(`\n⚠️ 失敗した記事:`);
    failedArticles.forEach((title) => console.error(`  - ${title}`));
  }

  // 1件でも成功したらexit 0
  // 全て失敗した場合のみexit 1
  process.exit(successCount > 0 || articles.length === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error("Unexpected error:", error);
  process.exit(1);
});
