/**
 * LinkedIn Post — Post to LinkedIn via REST API using OAuth 2.0.
 *
 * Env vars:
 *   LINKEDIN_ACCESS_TOKEN — OAuth 2.0 Bearer token
 *   LINKEDIN_AUTHOR       — URN (urn:li:person:xxx or urn:li:organization:xxx)
 *
 * Usage:
 *   npm run linkedin:post -- "Hello world"
 *   npm run linkedin:post -- --file path/to/post.txt
 *   npm run linkedin:post -- --dry-run "testing"
 *   npm run linkedin:post -- --image https://example.com/photo.jpg "Check this out"
 */

import { readFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load .env from project root
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
} catch {
  /* .env not found */
}

const API_BASE = "https://api.linkedin.com/rest";

function getEnv(name, ...fallbacks) {
  for (const key of [name, ...fallbacks]) {
    const val = process.env[key]?.trim();
    if (val) return val;
  }
  return undefined;
}

function parseArgs(argv) {
  const opts = { text: "", file: "", dryRun: false, image: "", textParts: [] };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--file") opts.file = argv[++i]?.trim() ?? "";
    else if (arg === "--dry-run") opts.dryRun = true;
    else if (arg === "--image") opts.image = argv[++i]?.trim() ?? "";
    else opts.textParts.push(arg);
  }

  opts.text = opts.textParts.join(" ").trim();
  return opts;
}

async function postLinkedIn(text, options = {}) {
  const accessToken = getEnv("LINKEDIN_ACCESS_TOKEN");
  const author = getEnv("LINKEDIN_AUTHOR");

  if (!accessToken) throw new Error("Missing LINKEDIN_ACCESS_TOKEN env var.");
  if (!author) throw new Error("Missing LINKEDIN_AUTHOR env var (e.g. urn:li:person:xxx or urn:li:organization:xxx).");

  const body = {
    author,
    commentary: text,
    visibility: "PUBLIC",
    distribution: { feedDistribution: "MAIN_FEED", targetEntities: [], thirdPartyDistributionChannels: [] },
    lifecycleState: "PUBLISHED",
    isReshareDisabledByAuthor: false,
  };

  // Image post
  if (options.image) {
    // For images: first upload to get an image URN, then reference it
    // Simplified: if image is a URL pointing to a public image, LinkedIn will scrape
    body.content = { media: { title: text.slice(0, 50), id: options.image } };
  }

  const res = await fetch(`${API_BASE}/posts`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Linkedin-Version": "202607",
      "X-Restli-Protocol-Version": "2.0.0",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const resBody = await res.json();

  if (!res.ok) {
    const err = new Error(`LinkedIn API error ${res.status}: ${JSON.stringify(resBody, null, 2)}`);
    err.status = res.status;
    err.body = resBody;
    throw err;
  }

  return resBody;
}

// ── Main ────────────────────────────────────────────────────────────────────

const opts = parseArgs(process.argv.slice(2));

let text = opts.text;
if (opts.file) {
  text = await readFile(opts.file, "utf-8");
  text = text.trim();
}

if (!text) {
  console.log("Usage: npm run linkedin:post -- \"Your post text\"");
  console.log("       npm run linkedin:post -- --file path/to/post.txt");
  console.log("       npm run linkedin:post -- --dry-run \"testing\"");
  console.log("       npm run linkedin:post -- --image https://... \"With image\"");
  process.exit(1);
}

if (opts.dryRun) {
  console.log("\n[DRY-RUN] Would post to LinkedIn:\n");
  console.log(`  ${text}`);
  if (opts.image) console.log(`  Image: ${opts.image}`);
  process.exit(0);
}

try {
  const result = await postLinkedIn(text, { image: opts.image || undefined });
  console.log(`\n✅ Posted to LinkedIn`);
  console.log(`  ID: ${result.id}`);
  console.log(`  URL: https://linkedin.com/feed/update/${result.id}\n`);
} catch (err) {
  console.error(`\n❌ LinkedIn post failed: ${err.message}\n`);
  process.exit(1);
}
