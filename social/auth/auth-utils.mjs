/**
 * Shared OAuth utilities for social platform login flows.
 *
 * These are building blocks for a web app's OAuth flow:
 *   1. App redirects user to the platform's auth page (getAuthUrl)
 *   2. Platform redirects back to your callback URL with a code
 *   3. App exchanges the code for tokens (exchangeCodeForTokens)
 *   4. Store tokens per user; refresh when expired (refreshToken)
 *
 * Each platform's auth module exports { getAuthUrl, exchangeCodeForTokens, refreshToken? }
 */

import { createHmac, randomBytes } from "node:crypto";

/** Generate a random state parameter for CSRF protection */
export function generateState() {
  return randomBytes(32).toString("hex");
}

/** Base64-encode a buffer (URL-safe, no padding) */
export function base64UrlEncode(buffer) {
  return Buffer.from(buffer)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/** SHA-256 hash */
export function sha256(input) {
  return createHmac("sha256", "").update(input).digest();
}

/** PKCE: generate code verifier and challenge */
export function generatePKCE() {
  const verifier = base64UrlEncode(randomBytes(32));
  const challenge = base64UrlEncode(sha256(verifier));
  return { verifier, challenge };
}

/** OAuth 1.0a HMAC-SHA1 signer (for X) */
export function oauth1Signature(method, url, params, consumerSecret, tokenSecret = "") {
  const encodedParams = Object.entries(params)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join("&");

  const signatureBase = [
    method.toUpperCase(),
    encodeURIComponent(url),
    encodeURIComponent(encodedParams),
  ].join("&");

  const signingKey = `${encodeURIComponent(consumerSecret)}&${encodeURIComponent(tokenSecret)}`;
  return createHmac("sha1", signingKey).update(signatureBase).digest("base64");
}
