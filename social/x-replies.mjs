/**
 * X Replies — Fetch replies to a tweet via X API v2.
 *
 * (Copy of scripts/x-replies.mjs for use in a standalone social repo.)
 *
 * Requires X_BEARER_TOKEN.
 *
 * Usage:
 *   node scripts/social/x-replies.mjs <tweet-id-or-url>
 *   node scripts/social/x-replies.mjs <tweet-id-or-url> --max 50
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

const args = process.argv.slice(2).filter(Boolean);
let tweetId = "";
let maxResults = 25;

for (let i = 0; i < args.length; i++) {
  if (args[i] === "--max" || args[i] === "-n") {
    maxResults = Math.min(100, Math.max(1, parseInt(args[++i], 10) || 25));
  } else if (!tweetId) {
    tweetId = extractId(args[i]);
  }
}

if (!tweetId) {
  console.error("Usage: node scripts/social/x-replies.mjs <tweet-id-or-url> [--max 50]");
  process.exit(1);
}

const url = new URL("https://api.x.com/2/tweets/search/recent");
url.searchParams.set("query", `conversation_id:${tweetId}`);
url.searchParams.set("max_results", maxResults.toString());
url.searchParams.set("tweet.fields", "author_id,created_at,in_reply_to_user_id,referenced_tweets");
url.searchParams.set("expansions", "author_id,referenced_tweets.id");
url.searchParams.set("user.fields", "username,name");

try {
  const response = await fetch(url, { headers: { Authorization: `Bearer ${BEARER}` } });
  if (!response.ok) {
    console.error(`HTTP ${response.status}: ${await response.text()}`);
    process.exit(1);
  }

  const { data, includes } = await response.json();

  if (!data || data.length === 0) {
    console.log(`No replies found for tweet ${tweetId}.`);
    process.exit(0);
  }

  const users = new Map();
  if (includes?.users) for (const user of includes.users) users.set(user.id, user);

  console.log(`\n${"=".repeat(70)}`);
  console.log(`  Replies to https://x.com/i/status/${tweetId}`);
  console.log(`  Found: ${data.length} | Showing: ${data.length}`);
  console.log(`${"=".repeat(70)}\n`);

  for (const reply of data) {
    if (reply.id === tweetId) continue;
    const user = users.get(reply.author_id);
    const replyTo = reply.referenced_tweets?.find((r) => r.type === "replied_to");
    const isDirectReply = replyTo?.id === tweetId;
    const prefix = isDirectReply ? "├─▶" : "│  └─▶";

    console.log(`  ${prefix} @${user?.username ?? "unknown"}`);
    console.log(`     ID:     ${reply.id}`);
    console.log(`     Time:   ${reply.created_at}`);
    console.log(`     Reply: ${reply.text.slice(0, 100)}${reply.text.length > 100 ? "..." : ""}`);
    console.log(`     Cmd:   node scripts/social/x-post.mjs --reply-to ${reply.id} "..."`);
    console.log("");
  }

  console.log(`${"=".repeat(70)}`);
  console.log(`  To reply to any of these:`);
  console.log(`  node scripts/social/x-post.mjs --reply-to <id> "Your response"`);
  console.log(`${"=".repeat(70)}\n`);
} catch (err) {
  console.error("Error fetching replies:", err.message);
  process.exit(1);
}
