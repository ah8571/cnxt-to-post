/**
 * TikTok Post — Post a video to TikTok via Content Posting API.
 *
 * ⚠️ The Content Posting API requires separate app review by TikTok.
 * Until approved, you can only post via Share Kit (direct from a mobile app).
 * This script is ready for when you get API access.
 *
 * Uses the Direct Post flow (upload video from a public URL).
 *
 * Env vars:
 *   TIKTOK_ACCESS_TOKEN   — OAuth 2.0 access token
 *   TIKTOK_OPEN_ID        — TikTok user's open_id
 *
 * Usage:
 *   npm run tiktok:post -- --video https://example.com/video.mp4 "My caption"
 *   npm run tiktok:post -- --dry-run --video https://... "testing"
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

function parseArgs(argv) {
  const opts = { text: "", dryRun: false, video: "", textParts: [] };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--dry-run") opts.dryRun = true;
    else if (arg === "--video") opts.video = argv[++i]?.trim() ?? "";
    else opts.textParts.push(arg);
  }
  opts.text = opts.textParts.join(" ").trim();
  return opts;
}

// ── Main ────────────────────────────────────────────────────────────────────

const opts = parseArgs(process.argv.slice(2));

if (!opts.video) {
  console.log("Usage: npm run tiktok:post -- --video <url> \"Caption\"");
  console.log("       npm run tiktok:post -- --dry-run --video <url> \"testing\"");
  console.log("\n⚠️  Content Posting API requires TikTok app review approval.");
  console.log("   See: https://developers.tiktok.com/products/content-posting-api\n");
  process.exit(1);
}

const accessToken = getEnv("TIKTOK_ACCESS_TOKEN");
const openId = getEnv("TIKTOK_OPEN_ID");

if (!accessToken || !openId) {
  console.error("❌ TikTok Content Posting API requires TIKTOK_ACCESS_TOKEN and TIKTOK_OPEN_ID.");
  console.error("   These come from the OAuth 2.0 Login Kit flow after a user authorizes your app.");
  console.error("   See: https://developers.tiktok.com/products/login-kit\n");
  process.exit(1);
}

if (opts.dryRun) {
  console.log("\n[DRY-RUN] Would post to TikTok:\n");
  console.log(`  Video:   ${opts.video}`);
  console.log(`  Caption: ${opts.text || "(none)"}`);
  console.log(`  User:    ${openId}`);
  process.exit(0);
}

// Direct Post: POST /v2/post/publish/video/init/ then upload
try {
  const initBody = {
    post_info: {
      title: opts.text || "TikTok post",
      privacy_level: "PUBLIC_TO_EVERYONE",
      disable_duet: false,
      disable_comment: false,
      disable_stitch: false,
    },
    source_info: { source: "PULL_FROM_URL", video_url: opts.video },
  };

  const initRes = await fetch("https://open.tiktokapis.com/v2/post/publish/video/init/", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(initBody),
  });

  const initJson = await initRes.json();

  if (!initRes.ok) {
    throw new Error(`TikTok init error ${initRes.status}: ${JSON.stringify(initJson, null, 2)}`);
  }

  console.log(`\n✅ Posted to TikTok`);
  console.log(`  Status: ${JSON.stringify(initJson.data)}\n`);
} catch (err) {
  console.error(`\n❌ TikTok post failed: ${err.message}\n`);
  process.exit(1);
}
