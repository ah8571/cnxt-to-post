/**
 * Facebook Metrics — Read metrics for a Facebook Page post.
 *
 * Env vars:
 *   FACEBOOK_ACCESS_TOKEN — Page access token
 *
 * Usage:
 *   npm run facebook:metrics -- <post-id>
 *   npm run facebook:metrics -- 123456789_987654321
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

const API_BASE = "https://graph.facebook.com/v25.0";

function getEnv(name) {
  return process.env[name]?.trim();
}

async function getPostInsights(postId) {
  const token = getEnv("FACEBOOK_ACCESS_TOKEN");
  if (!token) throw new Error("Missing FACEBOOK_ACCESS_TOKEN env var.");

  // First get the post basics
  const postRes = await fetch(`${API_BASE}/${postId}?fields=message,created_time,permalink_url&access_token=${token}`);
  const post = await postRes.json();
  if (!postRes.ok) throw new Error(`Facebook API error: ${JSON.stringify(post)}`);

  // Then get insights
  const insightsRes = await fetch(
    `${API_BASE}/${postId}/insights?metric=post_impressions,post_engaged_users,post_reactions_like_total,post_comments_total,post_shares_total&access_token=${token}`
  );
  const insights = await insightsRes.json();
  if (!insightsRes.ok) throw new Error(`Facebook insights error: ${JSON.stringify(insights)}`);

  return { post, insights };
}

// ── Main ────────────────────────────────────────────────────────────────────

const postId = process.argv[2]?.trim();
if (!postId) {
  console.log("Usage: npm run facebook:metrics -- <post-id>");
  console.log("       npm run facebook:metrics -- 123456789_987654321");
  process.exit(1);
}

try {
  const { post, insights } = await getPostInsights(postId);

  console.log(`\n${"=".repeat(60)}`);
  console.log(`  Facebook Post — ${postId}`);
  console.log(`${"=".repeat(60)}\n`);
  console.log(`  Created:   ${post.created_time}`);
  console.log(`  Message:   ${(post.message || "(none)").slice(0, 200)}...`);
  console.log(`  ${"".padEnd(60, "─")}`);

  if (insights.data) {
    for (const metric of insights.data) {
      const val = metric.values?.[0]?.value ?? "—";
      console.log(`  ${metric.title || metric.name}: ${typeof val === "number" ? val.toLocaleString() : val}`);
    }
  }

  console.log(`  ${"".padEnd(60, "─")}`);
  console.log(`  URL: ${post.permalink_url || `https://facebook.com/${postId}`}`);
  console.log(`${"=".repeat(60)}\n`);
} catch (err) {
  console.error(`\n❌ Facebook metrics failed: ${err.message}\n`);
  process.exit(1);
}
