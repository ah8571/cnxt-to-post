/**
 * Threads Metrics — Read engagement metrics for a Threads post.
 *
 * Env vars:
 *   THREADS_ACCESS_TOKEN — OAuth 2.0 access token
 *
 * Usage:
 *   node threads-metrics.mjs <media-id>
 *   node threads-metrics.mjs 123456789
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

const API_BASE = "https://graph.threads.net/v1.0";

function getEnv(name) {
  return process.env[name]?.trim();
}

async function getThreadsMetrics(mediaId) {
  const accessToken = getEnv("THREADS_ACCESS_TOKEN");
  if (!accessToken) throw new Error("Missing THREADS_ACCESS_TOKEN env var.");

  const res = await fetch(
    `${API_BASE}/${mediaId}?fields=id,text,permalink,timestamp,insights.metric(likes,reposts,replies,quotes,views)&access_token=${accessToken}`
  );

  const body = await res.json();
  if (!res.ok) throw new Error(`Threads API error ${res.status}: ${JSON.stringify(body)}`);

  const insights = body.insights?.data ?? [];
  const metrics = {};
  for (const item of insights) {
    metrics[item.name] = item.values?.[0]?.value ?? 0;
  }

  return {
    id: body.id,
    text: body.text?.slice(0, 100) + (body.text?.length > 100 ? "…" : ""),
    permalink: body.permalink,
    timestamp: body.timestamp,
    likes: metrics["likes"] ?? 0,
    reposts: metrics["reposts"] ?? 0,
    replies: metrics["replies"] ?? 0,
    quotes: metrics["quotes"] ?? 0,
    views: metrics["views"] ?? 0,
  };
}

// ── Main ────────────────────────────────────────────────────────────────────

const mediaId = process.argv[2];

if (!mediaId) {
  console.log("Usage: node threads-metrics.mjs <media-id>");
  process.exit(1);
}

try {
  const metrics = await getThreadsMetrics(mediaId);
  console.log(`\n📊 Threads post metrics:`);
  console.log(`  ID:      ${metrics.id}`);
  console.log(`  URL:     ${metrics.permalink}`);
  console.log(`  Posted:  ${metrics.timestamp}`);
  console.log(`  Likes:   ${metrics.likes}`);
  console.log(`  Reposts: ${metrics.reposts}`);
  console.log(`  Replies: ${metrics.replies}`);
  console.log(`  Quotes:  ${metrics.quotes}`);
  console.log(`  Views:   ${metrics.views}\n`);
} catch (err) {
  console.error(`\n❌ Threads metrics failed: ${err.message}\n`);
  process.exit(1);
}
