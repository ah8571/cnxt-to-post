/**
 * TikTok OAuth 2.0 Login Flow (Login Kit)
 *
 * Standard OAuth 2.0 with PKCE.
 *
 * Requires: client_key, client_secret (from developers.tiktok.com)
 *
 * Flow:
 *   1. Call getAuthUrl() — returns URL + state + codeVerifier (store both)
 *   2. Redirect user to that URL
 *   3. User authorizes → TikTok redirects to your callback with ?code=...&state=...
 *   4. Verify state, then call exchangeCodeForTokens(code, codeVerifier)
 *   5. Store { accessToken, refreshToken, openId } for this user
 *
 * Reference: https://developers.tiktok.com/products/login-kit
 */

import { generateState, generatePKCE } from "./auth-utils.mjs";

const AUTH_URL = "https://www.tiktok.com/v2/auth/authorize/";
const TOKEN_URL = "https://open.tiktokapis.com/v2/oauth/token/";

/**
 * Step 1: Build the authorization URL with PKCE.
 * Returns { url, state, codeVerifier } — store state + codeVerifier in session.
 */
export function getAuthUrl(clientKey, redirectUri, scopes = ["user.info.basic", "video.publish", "video.list"]) {
  const state = generateState();
  const { verifier, challenge } = generatePKCE();

  const params = new URLSearchParams({
    client_key: clientKey,
    response_type: "code",
    scope: scopes.join(","),
    redirect_uri: redirectUri,
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
  });

  return { url: `${AUTH_URL}?${params.toString()}`, state, codeVerifier: verifier };
}

/**
 * Step 2: Exchange authorization code for tokens.
 * Returns { accessToken, refreshToken, openId, scope, expiresIn }
 */
export async function exchangeCodeForTokens(clientKey, clientSecret, redirectUri, code, codeVerifier) {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_key: clientKey,
      client_secret: clientSecret,
      code,
      grant_type: "authorization_code",
      redirect_uri: redirectUri,
      code_verifier: codeVerifier,
    }).toString(),
  });

  const body = await res.json();
  if (!res.ok) throw new Error(`TikTok token error ${res.status}: ${JSON.stringify(body)}`);

  return {
    accessToken: body.access_token,
    refreshToken: body.refresh_token,
    openId: body.open_id,
    scope: body.scope,
    expiresIn: body.expires_in,
  };
}

/**
 * Step 3 (optional): Refresh an expired access token.
 */
export async function refreshToken(clientKey, clientSecret, refreshTokenValue) {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_key: clientKey,
      client_secret: clientSecret,
      grant_type: "refresh_token",
      refresh_token: refreshTokenValue,
    }).toString(),
  });

  const body = await res.json();
  if (!res.ok) throw new Error(`TikTok refresh error ${res.status}: ${JSON.stringify(body)}`);

  return {
    accessToken: body.access_token,
    refreshToken: body.refresh_token,
    openId: body.open_id,
    expiresIn: body.expires_in,
  };
}
