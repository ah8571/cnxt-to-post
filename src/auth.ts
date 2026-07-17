/** Decode a base64url string to a Uint8Array */
function base64urlDecode(str: string): Uint8Array {
  const base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

/**
 * Validate a Supabase-issued JWT using the project's JWT secret.
 * Returns { sub, email } on success, null on failure.
 */
export async function validateSupabaseJWT(
  jwtSecret: string,
  authHeader: string | null
): Promise<{ sub: string; email: string } | null> {
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.slice(7);
  const parts = token.split(".");
  if (parts.length !== 3) return null;

  try {
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(jwtSecret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"]
    );

    const valid = await crypto.subtle.verify(
      "HMAC",
      key,
      base64urlDecode(parts[2]),
      new TextEncoder().encode(`${parts[0]}.${parts[1]}`)
    );
    if (!valid) return null;

    const payload = JSON.parse(
      new TextDecoder().decode(base64urlDecode(parts[1]))
    ) as { sub?: string; email?: string; exp?: number };

    if (!payload.sub || !payload.email) return null;
    if (payload.exp && Date.now() / 1000 > payload.exp) return null;

    return { sub: payload.sub, email: payload.email };
  } catch {
    return null;
  }
}
