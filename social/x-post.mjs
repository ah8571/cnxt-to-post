/**
 * X Post — Post a tweet via X API v2 using OAuth 1.0a User Context.
 *
 * (Copy of scripts/x-post.mjs for use in a standalone social repo.)
 *
 * Env vars:
 *   X_CONSUMER_KEY / consumer_key
 *   X_CONSUMER_KEY_SECRET / consumer_key_secret
 *   X_ACCESS_TOKEN / access_token
 *   X_ACCESS_TOKEN_SECRET / access_token_secret
 *
 * Usage:
 *   node scripts/social/x-post.mjs "Hello world"
 *   node scripts/social/x-post.mjs --file path/to/post.txt
 *   node scripts/social/x-post.mjs --dry-run "testing"
 *   node scripts/social/x-post.mjs --reply-to <id> "Nice point!"
 */

import { createHmac } from "node:crypto";
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

const POST_URL = "https://api.x.com/2/tweets";

function getEnv(name, ...fallbacks) {
  for (const key of [name, ...fallbacks]) {
    const val = process.env[key]?.trim();
    if (val) return val;
  }
  return undefined;
}

function parseArgs(argv) {
  const options = { text: "", file: "", dryRun: false, replyTo: "", textParts: [] };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--file") options.file = argv[++i]?.trim() ?? "";
    else if (arg === "--dry-run") options.dryRun = true;
    else if (arg === "--reply-to") {
      const raw = argv[++i]?.trim() ?? "";
      const match = raw.match(/status\/(\d+)/);
      options.replyTo = match ? match[1] : raw.replace(/[^\d]/g, "");
    } else options.textParts.push(arg);
  }
  options.text = options.textParts.join(" ").trim();
  return options;
}

function oauthHeader(method, url, consumerKey, consumerSecret, accessToken, accessTokenSecret) {
  const oauthParams = {
    oauth_consumer_key: consumerKey,
    oauth_nonce: Array.from({ length: 32 }, () =>
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"[
        Math.floor(Math.random() * 62)
      ]
    ).join(""),
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_token: accessToken,
    oauth_version: "1.0",
  };

  const encodedParams = Object.entries(oauthParams)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join("&");

  const signatureBase = [method.toUpperCase(), encodeURIComponent(url), encodeURIComponent(encodedParams)].join("&");
  const signingKey = `${encodeURIComponent(consumerSecret)}&${encodeURIComponent(accessTokenSecret)}`;
  const signature = createHmac("sha1", signingKey).update(signatureBase).digest("base64");
  oauthParams.oauth_signature = signature;

  return "OAuth " +
    Object.entries(oauthParams)
      .map(([k, v]) => `${encodeURIComponent(k)}="${encodeURIComponent(v)}"`)
      .join(", ");
}

async function postTweet(text, replyToId) {
  const consumerKey = getEnv("X_CONSUMER_KEY", "consumer_key");
  const consumerSecret = getEnv("X_CONSUMER_KEY_SECRET", "consumer_key_secret");
  const accessToken = getEnv("X_ACCESS_TOKEN", "access_token");
  const accessTokenSecret = getEnv("X_ACCESS_TOKEN_SECRET", "access_token_secret");

  const missing = [];
  if (!consumerKey) missing.push("X_CONSUMER_KEY / consumer_key");
  if (!consumerSecret) missing.push("X_CONSUMER_KEY_SECRET / consumer_key_secret");
  if (!accessToken) missing.push("X_ACCESS_TOKEN / access_token");
  if (!accessTokenSecret) missing.push("X_ACCESS_TOKEN_SECRET / access_token_secret");
  if (missing.length) throw new Error(`Missing env vars: ${missing.join(", ")}`);

  const authHeader = oauthHeader("POST", POST_URL, consumerKey, consumerSecret, accessToken, accessTokenSecret);

  const reqBody = { text };
  if (replyToId) reqBody.reply = { in_reply_to_tweet_id: replyToId };

  const res = await fetch(POST_URL, {
    method: "POST",
    headers: { Authorization: authHeader, "Content-Type": "application/json" },
    body: JSON.stringify(reqBody),
  });

  const body = await res.json();
  if (!res.ok) {
    const err = new Error(`X API error ${res.status}: ${JSON.stringify(body, null, 2)}`);
    err.status = res.status;
    err.body = body;
    throw err;
  }
  return body;
}

// ── Main ────────────────────────────────────────────────────────────────────

const opts = parseArgs(process.argv.slice(2));

let text = opts.text;
if (opts.file) { text = await readFile(opts.file, "utf-8"); text = text.trim(); }
if (!text && !process.stdin.isTTY) {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  text = Buffer.concat(chunks).toString("utf-8").trim();
}

if (!text) {
  console.log("Usage: node scripts/social/x-post.mjs \"Hello world\"");
  console.log("       node scripts/social/x-post.mjs --reply-to <id> \"Reply text\"");
  process.exit(1);
}

if (opts.dryRun) {
  console.log("\n[DRY-RUN] Would post to X:\n");
  console.log(`  ${text}`);
  if (opts.replyTo) console.log(`  Reply to: ${opts.replyTo}`);
  process.exit(0);
}

try {
  const result = await postTweet(text, opts.replyTo || undefined);
  console.log(`\n✅ Posted to X`);
  console.log(`  ID:  ${result.data.id}`);
  console.log(`  URL: https://x.com/i/status/${result.data.id}\n`);
} catch (err) {
  console.error(`\n❌ X post failed: ${err.message}\n`);
  process.exit(1);
}
