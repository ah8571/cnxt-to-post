/**
 * Instagram Metrics — Read metrics for an Instagram post/reel/story.
 *
 * Env vars:
 *   INSTAGRAM_ACCESS_TOKEN — Page access token
 *
 * Usage:
 *   npm run instagram:metrics -- <media-id>
 *   npm run instagram:metrics -- 18012345678901234
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

// ── Main ────────────────────────────────────────────────────────────────────

const mediaId = process.argv[2]?.trim();
if (!mediaId) {
  console.log("Usage: npm run instagram:metrics -- <media-id>");
  process.exit(1);
}

const token = getEnv("INSTAGRAM_ACCESS_TOKEN");
if (!token) {
  console.error("Missing INSTAGRAM_ACCESS_TOKEN env var.");
  process.exit(1);
}

try {
  // Get media details
  const mediaRes = await fetch(
    `${API_BASE}/${mediaId}?fields=id,caption,media_type,media_product_type,permalink,timestamp,like_count,comments_count&access_token=${token}`
  );
  const media = await mediaRes.json();
  if (!mediaRes.ok) throw new Error(JSON.stringify(media));

  // Get insights
  const insightsRes = await fetch(
    `${API_BASE}/${mediaId}/insights?metric=impressions,reach,engagement,saved&access_token=${token}`
  );
  const insights = await insightsRes.json();

  console.log(`\n${"=".repeat(60)}`);
  console.log(`  Instagram Post — ${mediaId}`);
  console.log(`${"=".repeat(60)}\n`);

  console.log(`  Type:       ${media.media_product_type ?? media.media_type}`);
  console.log(`  Created:    ${media.timestamp}`);
  console.log(`  Caption:    ${(media.caption || "(none)").slice(0, 200)}...`);
  console.log(`  Likes:      ${media.like_count?.toLocaleString() ?? "—"}`);
  console.log(`  Comments:   ${media.comments_count?.toLocaleString() ?? "—"}`);
  console.log(`  ${"".padEnd(60, "─")}`);

  if (insights.data) {
    for (const metric of insights.data) {
      const val = metric.values?.[0]?.value ?? "—";
      console.log(`  ${metric.title || metric.name}: ${typeof val === "number" ? val.toLocaleString() : val}`);
    }
  } else {
    console.log(`  Insights:   Not available`);
  }

  console.log(`  ${"".padEnd(60, "─")}`);
  console.log(`  URL: ${media.permalink || `https://instagram.com/p/${mediaId}`}`);
  console.log(`${"=".repeat(60)}\n`);
} catch (err) {
  console.error(`\n❌ Instagram metrics failed: ${err.message}\n`);
  process.exit(1);
}
