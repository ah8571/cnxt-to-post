/**
 * Facebook Post — Post to a Facebook Page via Graph API.
 *
 * Env vars:
 *   FACEBOOK_ACCESS_TOKEN — Page access token
 *   FACEBOOK_PAGE_ID       — Facebook Page ID
 *
 * Usage:
 *   npm run facebook:post -- "Hello world"
 *   npm run facebook:post -- --file path/to/post.txt
 *   npm run facebook:post -- --dry-run "testing"
 *   npm run facebook:post -- --link https://example.com "Check this article"
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

const API_BASE = "https://graph.facebook.com/v25.0";

function getEnv(name, ...fallbacks) {
  for (const key of [name, ...fallbacks]) {
    const val = process.env[key]?.trim();
    if (val) return val;
  }
  return undefined;
}

function parseArgs(argv) {
  const opts = { text: "", file: "", dryRun: false, link: "", textParts: [] };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--file") opts.file = argv[++i]?.trim() ?? "";
    else if (arg === "--dry-run") opts.dryRun = true;
    else if (arg === "--link") opts.link = argv[++i]?.trim() ?? "";
    else opts.textParts.push(arg);
  }
  opts.text = opts.textParts.join(" ").trim();
  return opts;
}

async function postFacebook(text, options = {}) {
  const accessToken = getEnv("FACEBOOK_ACCESS_TOKEN");
  const pageId = getEnv("FACEBOOK_PAGE_ID");

  if (!accessToken) throw new Error("Missing FACEBOOK_ACCESS_TOKEN env var.");
  if (!pageId) throw new Error("Missing FACEBOOK_PAGE_ID env var.");

  const body = new URLSearchParams();
  body.set("message", text);
  body.set("access_token", accessToken);
  if (options.link) body.set("link", options.link);

  const res = await fetch(`${API_BASE}/${pageId}/feed`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  const resBody = await res.json();
  if (!res.ok) {
    const err = new Error(`Facebook API error ${res.status}: ${JSON.stringify(resBody, null, 2)}`);
    err.status = res.status;
    throw err;
  }

  return resBody;
}

// ── Main ────────────────────────────────────────────────────────────────────

const opts = parseArgs(process.argv.slice(2));

let text = opts.text;
if (opts.file) { text = await readFile(opts.file, "utf-8"); text = text.trim(); }

if (!text) {
  console.log("Usage: npm run facebook:post -- \"Your post text\"");
  console.log("       npm run facebook:post -- --link https://... \"With link\"");
  process.exit(1);
}

if (opts.dryRun) {
  console.log("\n[DRY-RUN] Would post to Facebook Page:\n");
  console.log(`  ${text}`);
  if (opts.link) console.log(`  Link: ${opts.link}`);
  process.exit(0);
}

try {
  const result = await postFacebook(text, { link: opts.link || undefined });
  console.log(`\n✅ Posted to Facebook`);
  console.log(`  ID: ${result.id}`);
  const [pageId] = (result.id ?? "").split("_");
  console.log(`  URL: https://facebook.com/${pageId}/posts/${result.id}\n`);
} catch (err) {
  console.error(`\n❌ Facebook post failed: ${err.message}\n`);
  process.exit(1);
}
