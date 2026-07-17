/**
 * Bluesky Metrics — Read engagement metrics for Bluesky posts.
 *
 * Uses App Password auth.
 *
 * Env vars:
 *   BLUESKY_HANDLE    — e.g. "user.bsky.social"
 *   BLUESKY_PASSWORD  — App Password
 *
 * Usage:
 *   npm run bluesky:metrics -- <post-uri-or-url>
 *   npm run bluesky:metrics -- at://did:plc:abc/app.bsky.feed.post/xyz
 *   npm run bluesky:metrics -- https://bsky.app/profile/user.bsky.social/post/xyz
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

const PDS = "https://bsky.social";

function getEnv(name) {
  return process.env[name]?.trim();
}

// ── Helpers ─────────────────────────────────────────────────────────────────

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

function parsePostUri(raw) {
  // Accept full AT URI, HTTP URL, or just the record key
  if (raw.startsWith("at://")) return raw;
  // https://bsky.app/profile/user.bsky.social/post/abc123
  const urlMatch = raw.match(/\/profile\/(.+?)\/post\/([^/?]+)/);
  if (urlMatch) return `at://${urlMatch[0].split("/")[2]}/app.bsky.feed.post/${urlMatch[1]}`;
  // Could also be: https://bsky.app/profile/user.bsky.social/post/abc123
  const match = raw.match(/\/post\/([^/?]+)/);
  if (match) {
    // Need to resolve handle to DID... or just try with the raw handle
    throw new Error("Full AT URI required (at://...) or resolve handle first. Try passing the full at:// URI from a previous post.");
  }
  return raw; // assume it's already a valid URI
}

// ── Main ────────────────────────────────────────────────────────────────────

const raw = process.argv[2]?.trim();
if (!raw) {
  console.log("Usage: npm run bluesky:metrics -- <post-uri-or-url>");
  console.log("       npm run bluesky:metrics -- at://did:plc:abc/app.bsky.feed.post/xyz");
  console.log("       npm run bluesky:metrics -- https://bsky.app/profile/user/posts/abc123");
  process.exit(1);
}

const handle = getEnv("BLUESKY_HANDLE");
const password = getEnv("BLUESKY_PASSWORD");
if (!handle || !password) {
  console.error("Missing BLUESKY_HANDLE or BLUESKY_PASSWORD env vars.");
  process.exit(1);
}

try {
  const session = await createSession(handle, password);
  const uri = parsePostUri(raw);
  const encodedUri = encodeURIComponent(uri);

  // Get post details
  const res = await fetch(`${PDS}/xrpc/app.bsky.feed.getPosts?uris=${encodedUri}`, {
    headers: { Authorization: `Bearer ${session.accessJwt}` },
  });

  const data = await res.json();
  if (!res.ok) throw new Error(JSON.stringify(data));

  const post = data.posts?.[0];
  if (!post) {
    console.log(`\n  No post found for: ${uri}\n`);
    process.exit(0);
  }

  console.log(`\n${"=".repeat(60)}`);
  console.log(`  @${post.author.handle} — ${post.author.displayName || ""}`);
  console.log(`${"=".repeat(60)}\n`);

  console.log(`  URI:       ${post.uri}`);
  console.log(`  CID:       ${post.cid}`);
  console.log(`  Created:   ${post.record?.createdAt}`);
  console.log(`  ${"".padEnd(60, "─")}`);

  // Metrics
  console.log(`  Likes:     ${post.likeCount?.toLocaleString() ?? "—"}`);
  console.log(`  Reposts:   ${post.repostCount?.toLocaleString() ?? "—"}`);
  console.log(`  Replies:   ${post.replyCount?.toLocaleString() ?? "—"}`);
  console.log(`  Quotes:    ${post.quoteCount?.toLocaleString() ?? "—"}`);
  console.log(`  ${"".padEnd(60, "─")}`);

  console.log(`  Text:      ${(post.record?.text || "").replace(/\n/g, "\n  ")}`);
  console.log(`  ${"".padEnd(60, "─")}`);
  console.log(`  URL: https://bsky.app/profile/${post.author.handle}/post/${uri.split("/").pop()}`);
  console.log(`${"=".repeat(60)}\n`);
} catch (err) {
  console.error(`\n❌ Bluesky metrics failed: ${err.message}\n`);
  process.exit(1);
}
