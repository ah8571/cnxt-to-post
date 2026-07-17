/**
 * Bluesky Post — Post to Bluesky via AT Protocol HTTP API.
 *
 * Uses App Password auth (simpler than OAuth for bots/scripts).
 * Create an App Password at https://bsky.app/settings/app-passwords
 *
 * Env vars:
 *   BLUESKY_HANDLE    — e.g. "user.bsky.social"
 *   BLUESKY_PASSWORD  — App Password (not your main password!)
 *
 * Usage:
 *   npm run bluesky:post -- "Hello world"
 *   npm run bluesky:post -- --file path/to/post.txt
 *   npm run bluesky:post -- --dry-run "testing"
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

const PDS = "https://bsky.social";

function getEnv(name, ...fallbacks) {
  for (const key of [name, ...fallbacks]) {
    const val = process.env[key]?.trim();
    if (val) return val;
  }
  return undefined;
}

function parseArgs(argv) {
  const opts = { text: "", file: "", dryRun: false, textParts: [] };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--file") opts.file = argv[++i]?.trim() ?? "";
    else if (arg === "--dry-run") opts.dryRun = true;
    else opts.textParts.push(arg);
  }
  opts.text = opts.textParts.join(" ").trim();
  return opts;
}

async function createSession(handle, password) {
  const res = await fetch(`${PDS}/xrpc/com.atproto.server.createSession`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identifier: handle, password }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(`Bluesky auth failed: ${JSON.stringify(body)}`);
  return body;
}

async function postToBluesky(text) {
  const handle = getEnv("BLUESKY_HANDLE");
  const password = getEnv("BLUESKY_PASSWORD");

  if (!handle || !password) {
    throw new Error("Missing BLUESKY_HANDLE or BLUESKY_PASSWORD env vars.\n" +
      "Create an App Password at https://bsky.app/settings/app-passwords");
  }

  // 1. Auth
  const session = await createSession(handle, password);

  // 2. Create post record
  const now = new Date().toISOString();
  const res = await fetch(`${PDS}/xrpc/com.atproto.repo.createRecord`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${session.accessJwt}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      repo: session.did,
      collection: "app.bsky.feed.post",
      record: {
        text,
        createdAt: now,
        $type: "app.bsky.feed.post",
      },
    }),
  });

  const body = await res.json();
  if (!res.ok) throw new Error(`Bluesky post failed: ${JSON.stringify(body)}`);

  return { ...body, did: session.did, handle: session.handle };
}

// ── Main ────────────────────────────────────────────────────────────────────

const opts = parseArgs(process.argv.slice(2));

let text = opts.text;
if (opts.file) { text = await readFile(opts.file, "utf-8"); text = text.trim(); }

if (!text) {
  console.log("Usage: npm run bluesky:post -- \"Hello world\"");
  console.log("       npm run bluesky:post -- --file path/to/post.txt");
  process.exit(1);
}

if (opts.dryRun) {
  console.log("\n[DRY-RUN] Would post to Bluesky:\n");
  console.log(`  ${text}`);
  process.exit(0);
}

try {
  const result = await postToBluesky(text);
  console.log(`\n✅ Posted to Bluesky`);
  console.log(`  URI:  ${result.uri}`);
  console.log(`  CID:  ${result.cid}`);
  console.log(`  URL:  https://bsky.app/profile/${result.handle}/post/${result.uri.split("/").pop()}\n`);
} catch (err) {
  console.error(`\n❌ Bluesky post failed: ${err.message}\n`);
  process.exit(1);
}
