/**
 * LinkedIn OAuth 2.0 Authorization Code Flow
 *
 * Standard OAuth 2.0 flow. Much simpler than X.
 *
 * Requires: client_id, client_secret (from LinkedIn Developer App)
 *
 * Flow:
 *   1. Call getAuthUrl() — returns URL + state (store state in session)
 *   2. Redirect user to that URL
 *   3. User authorizes → LinkedIn redirects to your callback with ?code=...&state=...
 *   4. Verify state matches, then call exchangeCodeForTokens(code)
 *   5. Store { accessToken, refreshToken, expiresIn } for this user
 *
 * Reference: https://learn.microsoft.com/en-us/linkedin/shared/authentication/authorization-code-flow
 */

import { generateState } from "./auth-utils.mjs";

const AUTH_URL = "https://www.linkedin.com/oauth/v2/authorization";
const TOKEN_URL = "https://www.linkedin.com/oauth/v2/accessToken";

/**
 * Step 1: Build the authorization URL.
 * Returns { url, state } — store state in session for CSRF verification.
 */
export function getAuthUrl(clientId, redirectUri, scopes = ["openid", "profile", "w_member_social", "email"]) {
  const state = generateState();
  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: redirectUri,
    state,
    scope: scopes.join(" "),
  });
  return { url: `${AUTH_URL}?${params.toString()}`, state };
}

/**
 * Step 2: Exchange the authorization code for tokens.
 * Returns { accessToken, refreshToken, expiresIn, scope }
 */
export async function exchangeCodeForTokens(clientId, clientSecret, redirectUri, code) {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
      client_id: clientId,
      client_secret: clientSecret,
    }).toString(),
  });

  const body = await res.json();
  if (!res.ok) throw new Error(`LinkedIn token error ${res.status}: ${JSON.stringify(body)}`);

  return {
    accessToken: body.access_token,
    refreshToken: body.refresh_token,
    expiresIn: body.expires_in,
    scope: body.scope,
  };
}

/**
 * Step 3 (optional): Refresh an expired access token.
 * Returns { accessToken, refreshToken, expiresIn }
 */
export async function refreshToken(clientId, clientSecret, refreshTokenValue) {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshTokenValue,
      client_id: clientId,
      client_secret: clientSecret,
    }).toString(),
  });

  const body = await res.json();
  if (!res.ok) throw new Error(`LinkedIn refresh error ${res.status}: ${JSON.stringify(body)}`);

  return {
    accessToken: body.access_token,
    refreshToken: body.refresh_token,
    expiresIn: body.expires_in,
  };
}
