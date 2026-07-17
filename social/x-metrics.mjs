/**
 * X Metrics — Fetch public metrics for one or more tweets.
 *
 * (Copy of scripts/x-metrics.mjs for use in a standalone social repo.)
 *
 * Requires X_BEARER_TOKEN.
 *
 * Usage:
 *   node scripts/social/x-metrics.mjs <tweet-id-or-url>
 *   node scripts/social/x-metrics.mjs 2077859250143990188 2077101535721558079
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

const ids = process.argv.slice(2).filter(Boolean).map(extractId);

if (ids.length === 0) {
  console.error("Usage: node scripts/social/x-metrics.mjs <tweet-id-or-url> [...]");
  process.exit(1);
}

const url = `https://api.x.com/2/tweets?ids=${ids.join(",")}&tweet.fields=public_metrics,created_at&expansions=author_id&user.fields=username,name`;

try {
  const response = await fetch(url, { headers: { Authorization: `Bearer ${BEARER}` } });
  if (!response.ok) {
    console.error(`HTTP ${response.status}: ${await response.text()}`);
    process.exit(1);
  }

  const { data, includes } = await response.json();
  if (!data || data.length === 0) { console.log("No tweets found."); process.exit(0); }

  const users = new Map();
  if (includes?.users) for (const user of includes.users) users.set(user.id, user);

  for (const tweet of data) {
    const user = users.get(tweet.author_id);
    const m = tweet.public_metrics;
    console.log(`\n${"=".repeat(60)}`);
    console.log(`  @${user?.username ?? "unknown"} — ${tweet.created_at}`);
    console.log(`  ${"".padEnd(60, "-")}`);
    console.log(`  Impressions: ${m.impression_count.toLocaleString()}`);
    console.log(`  Likes:       ${m.like_count.toLocaleString()}`);
    console.log(`  Retweets:    ${m.retweet_count.toLocaleString()}`);
    console.log(`  Replies:     ${m.reply_count.toLocaleString()}`);
    console.log(`  Quotes:      ${m.quote_count.toLocaleString()}`);
    console.log(`  Bookmarks:   ${m.bookmark_count.toLocaleString()}`);
    console.log(`  ID:          ${tweet.id}`);
    console.log(`  URL:         https://x.com/i/status/${tweet.id}`);
    console.log(`${"=".repeat(60)}`);
  }

  console.log(`\nFetched ${data.length} tweet(s).`);
} catch (err) {
  console.error("Error fetching metrics:", err.message);
  process.exit(1);
}
