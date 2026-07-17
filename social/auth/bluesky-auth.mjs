/**
 * Bluesky Authentication — App Password Flow
 *
 * Bluesky has two auth methods:
 *   1. App Password (this file) — create at https://bsky.app/settings/app-passwords
 *      Simple: POST /xrpc/com.atproto.server.createSession → accessJwt + refreshJwt
 *   2. OAuth 2.0 (DPoP + PKCE + PAR) — very complex, better handled by @atproto/api SDK.
 *      See: https://docs.bsky.app/docs/advanced-guides/oauth-client
 *
 * For a web app integration, the App Password approach means:
 *   1. Ask the user to create an App Password
 *   2. POST to createSession with handle + password
 *   3. Store the accessJwt + refreshJwt + did
 *   4. Use accessJwt as Bearer token for API calls
 *   5. Refresh with refreshJwt when expired
 *
 * Reference: https://docs.bsky.app/docs/get-started
 */

/**
 * Authenticate with Bluesky App Password.
 * Returns { accessJwt, refreshJwt, handle, did, email }
 */
export async function createSession(handle, appPassword, pdsUrl = "https://bsky.social") {
  const res = await fetch(`${pdsUrl}/xrpc/com.atproto.server.createSession`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identifier: handle, password: appPassword }),
  });

  const body = await res.json();
  if (!res.ok) throw new Error(`Bluesky auth failed: ${JSON.stringify(body)}`);

  return {
    accessJwt: body.accessJwt,
    refreshJwt: body.refreshJwt,
    handle: body.handle,
    did: body.did,
    email: body.email,
  };
}

/**
 * Refresh an expired access token.
 * Returns new { accessJwt, refreshJwt }
 */
export async function refreshSession(refreshJwt, pdsUrl = "https://bsky.social") {
  const res = await fetch(`${pdsUrl}/xrpc/com.atproto.server.refreshSession`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${refreshJwt}`,
      "Content-Type": "application/json",
    },
  });

  const body = await res.json();
  if (!res.ok) throw new Error(`Bluesky refresh failed: ${JSON.stringify(body)}`);

  return {
    accessJwt: body.accessJwt,
    refreshJwt: body.refreshJwt,
    handle: body.handle,
    did: body.did,
  };
}

/**
 * Resolve a handle to a DID.
 * Useful for converting user input to a stable identifier.
 */
export async function resolveHandle(handle, pdsUrl = "https://bsky.social") {
  const params = new URLSearchParams({ handle });
  const res = await fetch(`${pdsUrl}/xrpc/com.atproto.identity.resolveHandle?${params}`);
  const body = await res.json();
  if (!res.ok) throw new Error(`Bluesky resolve failed: ${JSON.stringify(body)}`);
  return body.did;
}
