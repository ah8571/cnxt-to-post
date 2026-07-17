/**
 * cnxt Shared Auth — cross-domain session utility.
 *
 * Supabase stores sessions in localStorage (per-domain). This utility
 * bridges that gap by also setting a cookie on .cnxt.to so that signing
 * in once on any cnxt tool (or auth.cnxt.to) propagates to all other
 * *.cnxt.to subdomains.
 *
 * Usage in any cnxt tool:
 *   import { getSharedSession, setSharedSession, clearSharedSession } from "./cnxt-auth.js";
 *   const session = await getSharedSession();
 *   if (session) { /* user is signed in * / }
 *
 * Requires: Supabase JS SDK loaded (either via import map or dynamic import).
 */

const SUPABASE_URL = "https://jstojewashwoswsskwjk.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpzdG9qZXdhc2h3b3N3c3Nrd2prIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgzNTg2OTAsImV4cCI6MjA5MzkzNDY5MH0.o3hYxYr1ZbmEShPfZebx1vchjmIrN7uYZMX1C5fhoac";

const COOKIE_NAME = "cnxt_session";
const COOKIE_DOMAIN = ".cnxt.to";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

let _supabasePromise = null;

function getSupabase() {
  if (!_supabasePromise) {
    _supabasePromise = import("https://esm.sh/@supabase/supabase-js@2").then(
      ({ createClient }) =>
        createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
          auth: {
            persistSession: true,
            autoRefreshToken: true,
          },
        })
    );
  }
  return _supabasePromise;
}

// ── Cookie helpers ──

function setCookie(name, value, days) {
  const expires = new Date();
  expires.setTime(expires.getTime() + days * 24 * 60 * 60 * 1000);
  // Set on .cnxt.to so all subdomains can read it
  document.cookie = `${name}=${encodeURIComponent(value)};expires=${expires.toUTCString()};domain=${COOKIE_DOMAIN};path=/;SameSite=Lax`;
}

function getCookie(name) {
  const prefix = `${name}=`;
  for (const cookie of document.cookie.split(";")) {
    const c = cookie.trim();
    if (c.startsWith(prefix)) {
      return decodeURIComponent(c.slice(prefix.length));
    }
  }
  return null;
}

function deleteCookie(name) {
  document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 UTC;domain=${COOKIE_DOMAIN};path=/;SameSite=Lax`;
}

// ── Public API ──

/**
 * Get the current Supabase session, checking:
 * 1. Supabase's own localStorage (fastest, per-domain)
 * 2. Shared cookie from auth.cnxt.to (cross-domain)
 * 3. If cookie found but no localStorage, restore the session
 *
 * Returns { user, accessToken } or null.
 */
export async function getSharedSession() {
  try {
    const supabase = await getSupabase();

    // Check Supabase's own session storage first
    const { data } = await supabase.auth.getSession();
    if (data.session?.user) {
      // Refresh the shared cookie
      persistToCookie(data.session.access_token);
      return {
        user: data.session.user,
        accessToken: data.session.access_token,
      };
    }

    // Check the shared cookie
    const cookieToken = getCookie(COOKIE_NAME);
    if (cookieToken) {
      // Try to restore the session from the cookie
      const { data: restored } = await supabase.auth.setSession({
        access_token: cookieToken,
        refresh_token: "", // Supabase can work with just the access token for verification
      });

      if (restored.session?.user) {
        persistToCookie(restored.session.access_token);
        return {
          user: restored.session.user,
          accessToken: restored.session.access_token,
        };
      }

      // Token expired — clean up
      deleteCookie(COOKIE_NAME);
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Persist the session to both Supabase localStorage AND the shared cookie.
 * Call this after a successful sign-in.
 */
export async function setSharedSession() {
  try {
    const supabase = await getSupabase();
    const { data } = await supabase.auth.getSession();
    if (data.session?.access_token) {
      persistToCookie(data.session.access_token);
    }
  } catch {
    // Silently fail — localStorage still works
  }
}

/**
 * Clear the session everywhere.
 */
export async function clearSharedSession() {
  try {
    const supabase = await getSupabase();
    await supabase.auth.signOut();
  } catch {
    // Continue cleanup
  }
  deleteCookie(COOKIE_NAME);
}

// ── Internal ──

function persistToCookie(accessToken) {
  setCookie(COOKIE_NAME, accessToken, 30);
}
