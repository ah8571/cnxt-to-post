/**
 * LinkedIn Metrics — Read metrics for a LinkedIn post.
 *
 * Env vars:
 *   LINKEDIN_ACCESS_TOKEN — OAuth 2.0 Bearer token
 *
 * Usage:
 *   npm run linkedin:metrics -- <post-urn>
 *   npm run linkedin:metrics -- urn:li:share:6844785523593134080
 *   npm run linkedin:metrics -- 6844785523593134080
 */

import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load .env
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

const API_BASE = "https://api.linkedin.com/rest";

function getEnv(name, ...fallbacks) {
  for (const key of [name, ...fallbacks]) {
    const val = process.env[key]?.trim();
    if (val) return val;
  }
  return undefined;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

async function getPost(postUrn) {
  const token = getEnv("LINKEDIN_ACCESS_TOKEN");
  if (!token) throw new Error("Missing LINKEDIN_ACCESS_TOKEN env var.");

  const encodedUrn = encodeURIComponent(postUrn);
  const res = await fetch(`${API_BASE}/posts/${encodedUrn}?viewContext=AUTHOR`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Linkedin-Version": "202607",
      "X-Restli-Protocol-Version": "2.0.0",
    },
  });

  const body = await res.json();
  if (!res.ok) throw new Error(`LinkedIn API error ${res.status}: ${JSON.stringify(body)}`);
  return body;
}

async function getSocialMetadata(postUrn) {
  const token = getEnv("LINKEDIN_ACCESS_TOKEN");
  if (!token) throw new Error("Missing LINKEDIN_ACCESS_TOKEN env var.");

  const encodedUrn = encodeURIComponent(postUrn);
  const res = await fetch(`${API_BASE}/socialMetadata/${encodedUrn}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Linkedin-Version": "202607",
      "X-Restli-Protocol-Version": "2.0.0",
    },
  });

  const body = await res.json();
  if (!res.ok) throw new Error(`LinkedIn API error ${res.status}: ${JSON.stringify(body)}`);
  return body;
}

// ── Main ────────────────────────────────────────────────────────────────────

const raw = process.argv[2]?.trim();
if (!raw) {
  console.log("Usage: npm run linkedin:metrics -- <post-urn>");
  console.log("       npm run linkedin:metrics -- urn:li:share:6844785523593134080");
  process.exit(1);
}

// Accept full URN or just the numeric ID
const postUrn = raw.startsWith("urn:li:") ? raw : `urn:li:share:${raw}`;

try {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`  LinkedIn Post — ${postUrn}`);
  console.log(`${"=".repeat(60)}\n`);

  const post = await getPost(postUrn);

  console.log(`  Author:      ${post.author}`);
  console.log(`  State:       ${post.lifecycleState}`);
  console.log(`  Visibility:  ${post.visibility}`);
  console.log(`  Created:     ${new Date(post.createdAt).toISOString()}`);
  console.log(`  Published:   ${new Date(post.publishedAt).toISOString()}`);
  console.log(` Commentary:   ${(post.commentary || "(none)").slice(0, 300)}${post.commentary?.length > 300 ? "..." : ""}`);
  console.log(`  ${"".padEnd(60, "─")}`);

  // Try social metadata for likes/comments/shares
  try {
    const meta = await getSocialMetadata(postUrn);
    const summary = meta?.summary;
    if (summary) {
      console.log(`  Likes:       ${summary.totalLikes ?? "—"}`);
      console.log(`  Comments:    ${summary.totalComments ?? "—"}`);
      console.log(`  Shares:      ${summary.totalShares ?? "—"}`);
      console.log(`  Impressions: ${summary.totalImpressions ?? "—"}`);
      console.log(`  Clicks:      ${summary.totalClicks ?? "—"}`);
      console.log(`  Engagement:  ${summary.totalEngagement ?? "—"}`);
    } else {
      console.log(`  Metrics:     Not available (social metadata may require org auth)`);
    }
  } catch {
    console.log(`  Metrics:     Could not fetch social metadata`);
  }

  console.log(`  ${"".padEnd(60, "─")}`);
  console.log(`  URL: https://linkedin.com/feed/update/${postUrn}`);
  console.log(`${"=".repeat(60)}\n`);
} catch (err) {
  console.error(`\n❌ LinkedIn metrics failed: ${err.message}\n`);
  process.exit(1);
}
