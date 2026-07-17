/**
 * X Read — Show a tweet and its full reply tree with metrics.
 *
 * (Copy of scripts/x-read.mjs for use in a standalone social repo.)
 *
 * Requires X_BEARER_TOKEN.
 *
 * Usage:
 *   node scripts/social/x-read.mjs <tweet-id-or-url>
 */

import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

try {
  const envPath = resolve(__dirname, "..", "..", ".env");
  const envFile = readFileSync(envPath, "utf-8");
  for (const line of envFile.split("\n")) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#") && trimmed.includes("=")) {
      const idx = trimmed.indexOf("=");
      const key = trimmed.slice(0, idx).trim();
      const val = trimmed.slice(idx + 1).trim();
      if (!process.env[key]) process.env[key] = val;
    }
  }
} catch { /* .env not found */ }

const BEARER = process.env.X_BEARER_TOKEN;

if (!BEARER) {
  console.error("Missing X_BEARER_TOKEN env var.");
  process.exit(1);
}

function extractId(input) {
  const match = input.match(/status\/(\d+)/);
  return match ? match[1] : input.replace(/[^\d]/g, "");
}

const tweetId = extractId(process.argv.slice(2).find(Boolean) ?? "");

if (!tweetId) {
  console.error("Usage: node scripts/social/x-read.mjs <tweet-id-or-url>");
  process.exit(1);
}

// ── 1. Fetch the original tweet ──────────────────────────────────────────────

const tweetUrl = `https://api.x.com/2/tweets/${tweetId}?tweet.fields=public_metrics,created_at,note_tweet&expansions=author_id&user.fields=username,name`;

const tweetRes = await fetch(tweetUrl, { headers: { Authorization: `Bearer ${BEARER}` } });
if (!tweetRes.ok) {
  console.error(`HTTP ${tweetRes.status} fetching tweet: ${await tweetRes.text()}`);
  process.exit(1);
}

const tweetData = await tweetRes.json();
const tweet = tweetData.data;
const author = tweetData.includes?.users?.find((u) => u.id === tweet.author_id);

// ── 2. Fetch replies via conversation_id ─────────────────────────────────────

const replyUrl = new URL("https://api.x.com/2/tweets/search/recent");
replyUrl.searchParams.set("query", `conversation_id:${tweetId}`);
replyUrl.searchParams.set("max_results", "100");
replyUrl.searchParams.set("tweet.fields", "author_id,created_at,public_metrics,in_reply_to_user_id,referenced_tweets");
replyUrl.searchParams.set("expansions", "author_id,referenced_tweets.id");
replyUrl.searchParams.set("user.fields", "username,name");

const replyRes = await fetch(replyUrl, { headers: { Authorization: `Bearer ${BEARER}` } });

let replies = [];
let replyUsers = new Map();

if (replyRes.ok) {
  const replyData = await replyRes.json();
  replies = replyData.data ?? [];
  if (replyData.includes?.users) {
    for (const u of replyData.includes.users) replyUsers.set(u.id, u);
  }
}

// ── 3. Display ────────────────────────────────────────────────────────────────

const m = tweet.public_metrics;
const fullText = tweet.note_tweet?.text ?? tweet.text;

console.log(`\n${"=".repeat(70)}`);
console.log(`  @${author?.username ?? "unknown"} — ${author?.name ?? ""}`);
console.log(`  ${tweet.created_at}`);
console.log(`  ${"".padEnd(70, "─")}`);
console.log(`  Impressions: ${m.impression_count.toLocaleString()}`);
console.log(`  Likes:       ${m.like_count.toLocaleString()}    Retweets:  ${m.retweet_count.toLocaleString()}`);
console.log(`  Replies:     ${m.reply_count.toLocaleString()}    Quotes:    ${m.quote_count.toLocaleString()}`);
console.log(`  Bookmarks:   ${m.bookmark_count.toLocaleString()}`);
console.log(`  ${"".padEnd(70, "─")}`);
console.log(`  ${fullText.replace(/\n/g, "\n  ")}`);
console.log(`  ${"".padEnd(70, "─")}`);
console.log(`  URL: https://x.com/i/status/${tweet.id}`);
console.log(`  Reply:  node scripts/social/x-post.mjs --reply-to ${tweet.id} "..."`);
console.log(`  Read:   node scripts/social/x-read.mjs ${tweet.id}`);

// ── 4. Reply tree ─────────────────────────────────────────────────────────────

const actualReplies = replies.filter((r) => r.id !== tweetId);

if (actualReplies.length === 0) {
  console.log(`\n  No replies yet.`);
} else {
  actualReplies.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  console.log(`\n  Reply tree (${actualReplies.length}):`);

  for (const reply of actualReplies) {
    const user = replyUsers.get(reply.author_id);
    const replyTo = reply.referenced_tweets?.find((r) => r.type === "replied_to");
    const isDirectReply = replyTo?.id === tweetId;
    const prefix = isDirectReply ? "├─▶" : "│  └─▶";
    const rm = reply.public_metrics;

    console.log(`\n  ${prefix} @${user?.username ?? "unknown"}`);
    console.log(`     ${reply.created_at}`);
    if (rm) console.log(`     ♥ ${rm.like_count}  🔁 ${rm.retweet_count}  💬 ${rm.reply_count}  👁 ${rm.impression_count}`);
    console.log(`     ${reply.text.slice(0, 120)}${reply.text.length > 120 ? "..." : ""}`);
    console.log(`     ID:     ${reply.id}`);
    console.log(`     Reply:  node scripts/social/x-post.mjs --reply-to ${reply.id} "..."`);
  }
}

console.log(`\n${"=".repeat(70)}\n`);
