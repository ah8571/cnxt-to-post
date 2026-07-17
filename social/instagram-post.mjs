/**
 * Instagram Post — Publish single image, video, reel, or story to an
 * Instagram Professional account via Facebook Graph API.
 *
 * Two-step process: 1) Create media container  2) Publish it
 *
 * Env vars:
 *   INSTAGRAM_ACCESS_TOKEN — Page access token (or IG user token)
 *   INSTAGRAM_USER_ID       — Instagram Professional account ID
 *
 * Usage:
 *   npm run instagram:post -- --image https://example.com/photo.jpg "My caption"
 *   npm run instagram:post -- --video https://example.com/video.mp4 "My reel"
 *   npm run instagram:post -- --reel https://example.com/video.mp4 "Reel caption"
 *   npm run instagram:post -- --dry-run --image https://... "testing"
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

function getEnv(name, ...fallbacks) {
  for (const key of [name, ...fallbacks]) {
    const val = process.env[key]?.trim();
    if (val) return val;
  }
  return undefined;
}

function parseArgs(argv) {
  const opts = { text: "", dryRun: false, image: "", video: "", reel: false, textParts: [] };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--dry-run") opts.dryRun = true;
    else if (arg === "--image") opts.image = argv[++i]?.trim() ?? "";
    else if (arg === "--video") opts.video = argv[++i]?.trim() ?? "";
    else if (arg === "--reel") { opts.reel = true; opts.video = argv[++i]?.trim() ?? ""; }
    else opts.textParts.push(arg);
  }
  opts.text = opts.textParts.join(" ").trim();
  return opts;
}

async function postInstagram(caption, options = {}) {
  const accessToken = getEnv("INSTAGRAM_ACCESS_TOKEN");
  const igUserId = getEnv("INSTAGRAM_USER_ID");

  if (!accessToken) throw new Error("Missing INSTAGRAM_ACCESS_TOKEN env var.");
  if (!igUserId) throw new Error("Missing INSTAGRAM_USER_ID env var.");

  // Step 1: Create media container
  const mediaParams = new URLSearchParams();
  mediaParams.set("access_token", accessToken);
  if (caption) mediaParams.set("caption", caption);

  if (options.image) {
    mediaParams.set("image_url", options.image);
  } else if (options.video) {
    mediaParams.set("video_url", options.video);
    mediaParams.set("media_type", options.reel ? "REELS" : "VIDEO");
  } else {
    throw new Error("Must provide --image or --video URL.");
  }

  const containerRes = await fetch(`${API_BASE}/${igUserId}/media`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: mediaParams.toString(),
  });

  const container = await containerRes.json();
  if (!containerRes.ok) throw new Error(`Instagram container error: ${JSON.stringify(container)}`);
  const containerId = container.id;
  console.log(`  Container created: ${containerId}`);

  // Step 2: Publish
  const publishRes = await fetch(`${API_BASE}/${igUserId}/media_publish`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ access_token: accessToken, creation_id: containerId }).toString(),
  });

  const published = await publishRes.json();
  if (!publishRes.ok) throw new Error(`Instagram publish error: ${JSON.stringify(published)}`);

  return { id: published.id, containerId };
}

// ── Main ────────────────────────────────────────────────────────────────────

const opts = parseArgs(process.argv.slice(2));

if (!opts.image && !opts.video) {
  console.log("Usage: npm run instagram:post -- --image <url> \"Caption\"");
  console.log("       npm run instagram:post -- --video <url> \"Caption\"");
  console.log("       npm run instagram:post -- --reel <url> \"Reel caption\"");
  process.exit(1);
}

if (opts.dryRun) {
  console.log("\n[DRY-RUN] Would post to Instagram:\n");
  if (opts.image) console.log(`  Image: ${opts.image}`);
  if (opts.video) console.log(`  Video: ${opts.video}${opts.reel ? " (Reel)" : ""}`);
  console.log(`  Caption: ${opts.text || "(none)"}`);
  process.exit(0);
}

try {
  const result = await postInstagram(opts.text || undefined, {
    image: opts.image || undefined,
    video: opts.video || undefined,
    reel: opts.reel,
  });
  console.log(`\n✅ Posted to Instagram`);
  console.log(`  Media ID: ${result.id}\n`);
} catch (err) {
  console.error(`\n❌ Instagram post failed: ${err.message}\n`);
  process.exit(1);
}
