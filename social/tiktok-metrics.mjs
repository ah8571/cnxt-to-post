/**
 * TikTok Metrics — Read metrics for TikTok videos via Display API.
 *
 * The Display API provides basic video info and stats for a creator's videos.
 *
 * Env vars:
 *   TIKTOK_ACCESS_TOKEN — OAuth 2.0 access token (Display API scope)
 *
 * Usage:
 *   npm run tiktok:metrics -- <creator-username>
 *   npm run tiktok:metrics -- un_contract
 *
 * Note: The Display API returns a list of videos for a creator, not a single
 * video by ID. To get a specific video's metrics, you'd need the Research API
 * (restricted to approved researchers).
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

function getEnv(name) {
  return process.env[name]?.trim();
}

// ── Main ────────────────────────────────────────────────────────────────────

const username = process.argv[2]?.trim()?.replace(/^@/, "");
if (!username) {
  console.log("Usage: npm run tiktok:metrics -- <username>");
  console.log("       npm run tiktok:metrics -- creator_name");
  console.log("\nNote: Display API requires creator authorization via Login Kit.\n");
  process.exit(1);
}

const token = getEnv("TIKTOK_ACCESS_TOKEN");
if (!token) {
  console.error("❌ Missing TIKTOK_ACCESS_TOKEN env var.");
  console.error("   See: https://developers.tiktok.com/doc/display-api-get-started\n");
  process.exit(1);
}

try {
  // Get creator's video list
  const res = await fetch("https://open.tiktokapis.com/v2/video/list/", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ max_count: 10 }),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(`TikTok API error ${res.status}: ${JSON.stringify(data)}`);

  const videos = data.data?.videos ?? [];

  console.log(`\n${"=".repeat(60)}`);
  console.log(`  TikTok Videos — @${username}`);
  console.log(`${"=".repeat(60)}\n`);
  console.log(`  Total videos: ${videos.length}\n`);

  for (const v of videos) {
    console.log(`  🎬 ${v.title || "(no title)"}`);
    console.log(`     ID:        ${v.id}`);
    console.log(`     Created:   ${v.create_time ? new Date(v.create_time * 1000).toISOString() : "—"}`);
    console.log(`     Views:     ${v.view_count?.toLocaleString() ?? "—"}`);
    console.log(`     Likes:     ${v.like_count?.toLocaleString() ?? "—"}`);
    console.log(`     Comments:  ${v.comment_count?.toLocaleString() ?? "—"}`);
    console.log(`     Shares:    ${v.share_count?.toLocaleString() ?? "—"}`);
    console.log(`     URL:       ${v.share_url || `https://tiktok.com/@${username}/video/${v.id}`}`);
    console.log("");
  }

  console.log(`${"=".repeat(60)}\n`);
} catch (err) {
  console.error(`\n❌ TikTok metrics failed: ${err.message}\n`);
  process.exit(1);
}
