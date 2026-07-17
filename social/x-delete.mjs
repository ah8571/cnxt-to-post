/**
 * X Delete — Delete a tweet via X API v2 using OAuth 1.0a User Context.
 *
 * (Copy of scripts/x-delete.mjs for use in a standalone social repo.)
 *
 * Requires all 4 OAuth 1.0a credentials.
 * Also reads from .env: consumer_key, consumer_key_secret, access_token, access_token_secret
 *
 * Usage:
 *   node scripts/social/x-delete.mjs <tweet-id>
 *   node scripts/social/x-delete.mjs --dry-run <tweet-id>
 */

import { createHmac } from "node:crypto";
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

const API_BASE = "https://api.x.com/2/tweets";

function getEnv(name, ...fallbacks) {
  for (const key of [name, ...fallbacks]) {
    const val = process.env[key]?.trim();
    if (val) return val;
  }
  return undefined;
}

function parseArgs(argv) {
  const options = { ids: [], dryRun: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--dry-run") options.dryRun = true;
    else if (arg.startsWith("http")) {
      const match = arg.match(/status\/(\d+)/);
      if (match) options.ids.push(match[1]);
    } else if (/^\d+$/.test(arg)) options.ids.push(arg);
  }
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

async function deleteTweet(tweetId, dryRun) {
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

  const url = `${API_BASE}/${tweetId}`;
  const authHeader = oauthHeader("DELETE", url, consumerKey, consumerSecret, accessToken, accessTokenSecret);

  if (dryRun) {
    console.log(`[DRY-RUN] Would DELETE ${url}`);
    return { data: { deleted: true }, _dryRun: true };
  }

  const res = await fetch(url, { method: "DELETE", headers: { Authorization: authHeader } });
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

if (opts.ids.length === 0) {
  console.log("Usage: node scripts/social/x-delete.mjs <tweet-id-or-url> [...]");
  console.log("       node scripts/social/x-delete.mjs --dry-run <tweet-id>");
  process.exit(1);
}

console.log(`\nDeleting ${opts.ids.length} tweet(s)${opts.dryRun ? " [DRY-RUN]" : ""}...\n`);

let success = 0, failed = 0;
for (const id of opts.ids) {
  try {
    const result = await deleteTweet(id, opts.dryRun);
    if (result.data?.deleted) {
      console.log(`  ✅ ${id} — deleted`);
      success++;
    } else {
      console.log(`  ❌ ${id} — ${JSON.stringify(result)}`);
      failed++;
    }
  } catch (err) {
    console.log(`  ❌ ${id} — ${err.message}`);
    failed++;
  }
}

console.log(`\n${"─".repeat(40)}`);
console.log(`  Deleted: ${success} | Failed: ${failed}`);
console.log(`${"─".repeat(40)}\n`);
