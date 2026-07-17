/**
 * X (Twitter) OAuth 1.0a 3-Legged Login Flow
 *
 * This is the "Login with X" flow where users authorize your app to act on their behalf.
 *
 * Requires: consumer_key, consumer_secret (from X Developer Portal)
 *
 * Flow:
 *   1. Call getRequestToken() — returns oauth_token + oauth_token_secret
 *   2. Build authorization URL with getAuthUrl(oauthToken)
 *   3. Redirect user to that URL
 *   4. User authorizes → X redirects to your callback with ?oauth_token=...&oauth_verifier=...
 *   5. Call exchangeCodeForTokens(oauthToken, oauthVerifier, oauthTokenSecret)
 *   6. Store the returned { accessToken, accessTokenSecret } for this user
 *
 * Reference: https://docs.x.com/resources/fundamentals/authentication/obtaining-user-access-tokens
 */

import { oauth1Signature, generateState } from "./auth-utils.mjs";

const REQUEST_TOKEN_URL = "https://api.x.com/oauth/request_token";
const AUTHORIZE_URL = "https://api.x.com/oauth/authorize";
const ACCESS_TOKEN_URL = "https://api.x.com/oauth/access_token";

/**
 * Step 1: Get a temporary request token.
 * Returns { oauthToken, oauthTokenSecret, oauthCallbackConfirmed }
 */
export async function getRequestToken(consumerKey, consumerSecret, callbackUrl) {
  const oauthParams = {
    oauth_consumer_key: consumerKey,
    oauth_nonce: generateState().slice(0, 32),
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_version: "1.0",
    oauth_callback: callbackUrl,
  };

  oauthParams.oauth_signature = oauth1Signature("POST", REQUEST_TOKEN_URL, oauthParams, consumerSecret);

  const headerValue = "OAuth " + Object.entries(oauthParams)
    .map(([k, v]) => `${encodeURIComponent(k)}="${encodeURIComponent(v)}"`)
    .join(", ");

  const res = await fetch(REQUEST_TOKEN_URL, {
    method: "POST",
    headers: { Authorization: headerValue },
  });

  const text = await res.text();
  if (!res.ok) throw new Error(`X request token error ${res.status}: ${text}`);

  const params = Object.fromEntries(new URLSearchParams(text));
  return {
    oauthToken: params.oauth_token,
    oauthTokenSecret: params.oauth_token_secret,
    oauthCallbackConfirmed: params.oauth_callback_confirmed === "true",
  };
}

/**
 * Step 2: Build the authorization URL to redirect the user to.
 */
export function getAuthUrl(oauthToken) {
  return `${AUTHORIZE_URL}?oauth_token=${encodeURIComponent(oauthToken)}`;
}

/**
 * Step 3 (final): Exchange the verifier for permanent access tokens.
 * Returns { accessToken, accessTokenSecret, userId, screenName }
 */
export async function exchangeCodeForTokens(
  consumerKey, consumerSecret,
  oauthToken, oauthVerifier, oauthTokenSecret,
) {
  const oauthParams = {
    oauth_consumer_key: consumerKey,
    oauth_nonce: generateState().slice(0, 32),
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_version: "1.0",
    oauth_token: oauthToken,
    oauth_verifier: oauthVerifier,
  };

  oauthParams.oauth_signature = oauth1Signature(
    "POST", ACCESS_TOKEN_URL, oauthParams, consumerSecret, oauthTokenSecret,
  );

  const headerValue = "OAuth " + Object.entries(oauthParams)
    .map(([k, v]) => `${encodeURIComponent(k)}="${encodeURIComponent(v)}"`)
    .join(", ");

  const res = await fetch(ACCESS_TOKEN_URL, {
    method: "POST",
    headers: { Authorization: headerValue },
  });

  const text = await res.text();
  if (!res.ok) throw new Error(`X access token error ${res.status}: ${text}`);

  const params = Object.fromEntries(new URLSearchParams(text));
  return {
    accessToken: params.oauth_token,
    accessTokenSecret: params.oauth_token_secret,
    userId: params.user_id,
    screenName: params.screen_name,
  };
}
