/**
 * Meta (Facebook / Instagram) OAuth 2.0 Login Flow
 *
 * Facebook and Instagram share the same OAuth system via Meta apps.
 *
 * Requires: app_id, app_secret (from developers.facebook.com)
 *
 * Flow:
 *   1. Call getAuthUrl() — returns URL + state
 *   2. Redirect user to that URL
 *   3. User authorizes → Meta redirects to your callback with ?code=...&state=...
 *   4. Call exchangeCodeForTokens(code) — returns short-lived token
 *   5. (For Pages/IG) Exchange for a Page access token via getPageAccounts()
 *   6. Store tokens per user
 *
 * Facebook Login docs: https://developers.facebook.com/docs/facebook-login
 * Instagram: requires Facebook Login + Page connection
 */

import { generateState } from "./auth-utils.mjs";

const AUTH_URL = "https://www.facebook.com/v25.0/dialog/oauth";
const TOKEN_URL = "https://graph.facebook.com/v25.0/oauth/access_token";

/**
 * Step 1: Build the authorization URL.
 * For Instagram: scopes should include instagram_basic, instagram_content_publish, pages_read_engagement
 * For Facebook: scopes should include pages_manage_posts, pages_read_engagement
 */
export function getAuthUrl(appId, redirectUri, scopes = ["pages_manage_posts", "pages_read_engagement"]) {
  const state = generateState();
  const params = new URLSearchParams({
    client_id: appId,
    redirect_uri: redirectUri,
    state,
    scope: scopes.join(","),
    response_type: "code",
  });
  return { url: `${AUTH_URL}?${params.toString()}`, state };
}

/**
 * Step 2: Exchange code for a short-lived user access token.
 */
export async function exchangeCodeForTokens(appId, appSecret, redirectUri, code) {
  const res = await fetch(TOKEN_URL, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  });

  const params = new URLSearchParams({
    client_id: appId,
    client_secret: appSecret,
    redirect_uri: redirectUri,
    code,
  });

  const tokenRes = await fetch(`${TOKEN_URL}?${params.toString()}`);
  const body = await tokenRes.json();
  if (!tokenRes.ok) throw new Error(`Meta token error: ${JSON.stringify(body)}`);

  return { accessToken: body.access_token, expiresIn: body.expires_in };
}

/**
 * Step 3: Exchange short-lived token for a long-lived token (60 days).
 */
export async function getLongLivedToken(appId, appSecret, shortLivedToken) {
  const params = new URLSearchParams({
    grant_type: "fb_exchange_token",
    client_id: appId,
    client_secret: appSecret,
    fb_exchange_token: shortLivedToken,
  });

  const res = await fetch(`${TOKEN_URL}?${params.toString()}`);
  const body = await res.json();
  if (!res.ok) throw new Error(`Meta long-lived token error: ${JSON.stringify(body)}`);

  return { accessToken: body.access_token, expiresIn: body.expires_in };
}

/**
 * Step 4: Get the user's Facebook Pages and their access tokens.
 * Required for both Facebook Page posting and Instagram (which needs a Page).
 * Returns array of { id, name, access_token, category }
 */
export async function getPageAccounts(userAccessToken) {
  const res = await fetch(
    `https://graph.facebook.com/v25.0/me/accounts?access_token=${userAccessToken}`
  );
  const body = await res.json();
  if (!res.ok) throw new Error(`Meta pages error: ${JSON.stringify(body)}`);
  return body.data ?? [];
}

/**
 * Step 5: Get the Instagram Professional account connected to a Facebook Page.
 * Returns { id, username } or null if no IG account is connected to the page.
 */
export async function getInstagramAccount(pageId, pageAccessToken) {
  const res = await fetch(
    `https://graph.facebook.com/v25.0/${pageId}?fields=instagram_business_account{id,username}&access_token=${pageAccessToken}`
  );
  const body = await res.json();
  if (!res.ok) throw new Error(`Meta IG account error: ${JSON.stringify(body)}`);
  return body.instagram_business_account ?? null;
}
