/**
 * Threads Post — Post text, image, or video to Threads via Graph API.
 *
 * Two-step process: 1) Create media container  2) Publish it
 * Unlike Instagram, text-only posts are supported.
 *
 * Env vars:
 *   THREADS_ACCESS_TOKEN — OAuth 2.0 access token
 *   THREADS_USER_ID       — Threads user ID
 *
 * Usage:
 *   node threads-post.mjs "Hello Threads!"
 *   node threads-post.mjs --image https://example.com/photo.jpg "With photo"
 *   node threads-post.mjs --dry-run "testing"
 */

import { readFile } from "node:fs/promises";
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

function getEnv(name, ...fallbacks) {
  for (const key of [name, ...fallbacks]) {
    const val = process.env[key]?.trim();
    if (val) return val;
  }
  return undefined;
}

function parseArgs(argv) {
  const opts = { text: "", file: "", dryRun: false, image: "", video: "", textParts: [] };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--file") opts.file = argv[++i]?.trim() ?? "";
    else if (arg === "--dry-run") opts.dryRun = true;
    else if (arg === "--image") opts.image = argv[++i]?.trim() ?? "";
    else if (arg === "--video") opts.video = argv[++i]?.trim() ?? "";
    else opts.textParts.push(arg);
  }
  opts.text = opts.textParts.join(" ").trim();
  return opts;
}

async function postToThreads(text, options = {}) {
  const accessToken = getEnv("THREADS_ACCESS_TOKEN");
  const userId = getEnv("THREADS_USER_ID");

  if (!accessToken) throw new Error("Missing THREADS_ACCESS_TOKEN env var.");
  if (!userId) throw new Error("Missing THREADS_USER_ID env var.");

  // Step 1: Create media container
  const params = new URLSearchParams();
  params.set("access_token", accessToken);

  if (options.image) {
    params.set("media_type", "IMAGE");
    params.set("image_url", options.image);
  } else if (options.video) {
    params.set("media_type", "VIDEO");
    params.set("video_url", options.video);
  } else {
    params.set("media_type", "TEXT");
  }

  if (text) params.set("text", text);

  const containerRes = await fetch(`${API_BASE}/${userId}/threads`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });

  const container = await containerRes.json();
  if (!containerRes.ok) throw new Error(`Threads container error: ${JSON.stringify(container)}`);
  const containerId = container.id;
  console.log(`  Container created: ${containerId}`);

  // Step 2: Publish
  const publishRes = await fetch(`${API_BASE}/${userId}/threads_publish`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ access_token: accessToken, creation_id: containerId }).toString(),
  });

  const published = await publishRes.json();
  if (!publishRes.ok) throw new Error(`Threads publish error: ${JSON.stringify(published)}`);

  return { id: published.id, containerId };
}

// ── Main ────────────────────────────────────────────────────────────────────

const opts = parseArgs(process.argv.slice(2));

let text = opts.text;
if (opts.file) { text = await readFile(opts.file, "utf-8"); text = text.trim(); }

if (!text && !opts.image && !opts.video) {
  console.log("Usage: node threads-post.mjs \"Hello Threads!\"");
  console.log("       node threads-post.mjs --image <url> \"With photo\"");
  console.log("       node threads-post.mjs --file path/to/post.txt");
  process.exit(1);
}

if (opts.dryRun) {
  console.log("\n[DRY-RUN] Would post to Threads:\n");
  if (text) console.log(`  ${text}`);
  if (opts.image) console.log(`  Image: ${opts.image}`);
  if (opts.video) console.log(`  Video: ${opts.video}`);
  process.exit(0);
}

try {
  const result = await postToThreads(text, {
    image: opts.image || undefined,
    video: opts.video || undefined,
  });
  console.log(`\n✅ Posted to Threads`);
  console.log(`  ID: ${result.id}\n`);
} catch (err) {
  console.error(`\n❌ Threads post failed: ${err.message}\n`);
  process.exit(1);
}
