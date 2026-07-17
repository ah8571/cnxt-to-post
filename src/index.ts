import { validateSupabaseJWT } from "./auth";
import type { PostRequest, PostResponse, PlatformPostResult, Platform } from "./types";
import { postToBluesky, getBlueskyMetrics } from "./platforms/bluesky";
import { postToLinkedIn, getLinkedInMetrics } from "./platforms/linkedin";
import { postToFacebook, getFacebookMetrics } from "./platforms/facebook";
import { postToInstagram, getInstagramMetrics } from "./platforms/instagram";
import { postToTikTok, getTikTokMetrics } from "./platforms/tiktok";
import { postToX, deleteFromX, getXMetrics } from "./platforms/x";
import { postToThreads, getThreadsMetrics } from "./platforms/threads";
import { fetchUserTokens, findToken, listConnectedProfiles, type PlatformToken } from "./tokens";

export interface Env {
  SUPABASE_JWT_SECRET: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;  // for querying platform_tokens
  SUPABASE_URL?: string;

  // Fallback env vars (used when SUPABASE_SERVICE_ROLE_KEY is not set — single-user mode)
  BLUESKY_HANDLE?: string;  BLUESKY_PASSWORD?: string;
  LINKEDIN_ACCESS_TOKEN?: string;  LINKEDIN_AUTHOR?: string;
  FACEBOOK_ACCESS_TOKEN?: string;  FACEBOOK_PAGE_ID?: string;
  INSTAGRAM_ACCESS_TOKEN?: string;  INSTAGRAM_USER_ID?: string;
  TIKTOK_ACCESS_TOKEN?: string;  TIKTOK_OPEN_ID?: string;
  THREADS_ACCESS_TOKEN?: string;  THREADS_USER_ID?: string;
  X_CONSUMER_KEY?: string;  X_CONSUMER_KEY_SECRET?: string;
  X_ACCESS_TOKEN?: string;  X_ACCESS_TOKEN_SECRET?: string;  X_BEARER_TOKEN?: string;

  RATE_LIMITS?: KVNamespace;
}

const ALLOWED_ORIGINS = [
  "https://post.cnxt.to",
  "https://cnxt.to",
  "http://localhost:5173",
  "http://localhost:3000",
];

function corsHeaders(origin: string): Record<string, string> {
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };
}

function json(data: unknown, status = 200, extraHeaders: Record<string, string> = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...extraHeaders },
  });
}

function errorResponse(message: string, status: number, origin: string) {
  return json({ error: message }, status, corsHeaders(origin));
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin") ?? "";
    const headers = corsHeaders(origin);

    // CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers });
    }

    // Health check
    if (url.pathname === "/health") {
      return new Response("ok", { status: 200 });
    }

    // --- Cron: process scheduled posts ---
    if (request.headers.get("X-Cron-Trigger") === "process-scheduled") {
      return handleCron(env);
    }

    // --- API routes ---
    if (url.pathname.startsWith("/api/")) {
      return handleApi(request, env, url, origin);
    }

    return new Response("cnxt to post — API", {
      status: 200,
      headers: { "Content-Type": "text/plain" },
    });
  },
};

async function handleApi(
  request: Request,
  env: Env,
  url: URL,
  origin: string
): Promise<Response> {
  const h = corsHeaders(origin);

  // --- GET /api/profiles — list connected platform profiles ---
  if (url.pathname === "/api/profiles" && request.method === "GET") {
    return handleProfiles(request, env, origin, h);
  }

  // --- POST /api/schedule — schedule a post for later ---
  if (url.pathname === "/api/schedule" && request.method === "POST") {
    return handleSchedule(request, env, origin, h);
  }

  // --- GET /api/scheduled — list scheduled posts ---
  if (url.pathname === "/api/scheduled" && request.method === "GET") {
    return handleScheduled(request, env, origin, h);
  }

  // --- DELETE /api/scheduled/:id — cancel scheduled post ---
  const scheduleMatch = url.pathname.match(/^\/api\/scheduled\/([a-f0-9-]+)$/);
  if (scheduleMatch && request.method === "DELETE") {
    return handleCancelSchedule(request, env, scheduleMatch[1], origin, h);
  }

  // --- GET /api/replies/:platform/:postId ---
  const repliesMatch = url.pathname.match(/^\/api\/replies\/([a-z]+)\/(.+)$/);
  if (repliesMatch && request.method === "GET") {
    return handleReplies(request, env, repliesMatch[1] as Platform, repliesMatch[2], origin, h);
  }

  // --- POST /api/reply ---
  if (url.pathname === "/api/reply" && request.method === "POST") {
    return handleReply(request, env, origin, h);
  }

  // --- POST /api/post ---
  if (url.pathname === "/api/post" && request.method === "POST") {
    return handlePost(request, env, origin, h);
  }

  // --- GET /api/metrics/:platform/:postId ---
  const metricsMatch = url.pathname.match(/^\/api\/metrics\/([a-z]+)\/(.+)$/);
  if (metricsMatch && request.method === "GET") {
    return handleMetrics(request, env, metricsMatch[1] as Platform, metricsMatch[2], origin, h);
  }

  return errorResponse("Not found", 404, origin);
}

/**
 * GET /api/profiles — list the user's connected platform profiles.
 */
async function handleProfiles(
  request: Request,
  env: Env,
  origin: string,
  headers: Record<string, string>
): Promise<Response> {
  const user = await validateSupabaseJWT(env.SUPABASE_JWT_SECRET, request.headers.get("Authorization"));
  if (!user) return errorResponse("Unauthorized", 401, origin);

  if (!env.SUPABASE_SERVICE_ROLE_KEY) {
    return json({ profiles: [], mode: "single-user" }, 200, headers);
  }

  try {
    const tokens = await fetchUserTokens(user.sub, env.SUPABASE_SERVICE_ROLE_KEY);
    return json({ profiles: listConnectedProfiles(tokens), mode: "multi-user" }, 200, headers);
  } catch {
    return json({ profiles: [], mode: "error" }, 200, headers);
  }
}

/**
 * POST /api/post — Post to one or more platforms.
 */
async function handlePost(
  request: Request,
  env: Env,
  origin: string,
  headers: Record<string, string>
): Promise<Response> {
  // Auth
  const user = await validateSupabaseJWT(
    env.SUPABASE_JWT_SECRET,
    request.headers.get("Authorization")
  );
  if (!user) return errorResponse("Unauthorized", 401, origin);

  // Parse body
  let body: PostRequest;
  try {
    body = (await request.json()) as PostRequest;
  } catch {
    return errorResponse("Invalid JSON body", 400, origin);
  }

  if (!body.platforms?.length) {
    return errorResponse("At least one platform is required", 400, origin);
  }
  if (!body.text?.trim()) {
    return errorResponse("Text content is required", 400, origin);
  }

  // Rate limit: 30 posts per minute per user (if KV is configured)
  if (env.RATE_LIMITS) {
    const rateKey = `rate:post:${user.sub}`;
    const current = parseInt((await env.RATE_LIMITS.get(rateKey)) ?? "0");
    if (current >= 30) {
      return errorResponse("Rate limit exceeded. Max 30 posts per minute.", 429, origin);
    }
    await env.RATE_LIMITS.put(rateKey, String(current + 1), { expirationTtl: 60 });
  }

  // Fetch per-user platform tokens (or fall back to env vars)
  let userTokens: PlatformToken[] = [];
  if (env.SUPABASE_SERVICE_ROLE_KEY) {
    userTokens = await fetchUserTokens(user.sub, env.SUPABASE_SERVICE_ROLE_KEY);
  }

  // Post to each platform in parallel
  const results: PlatformPostResult[] = await Promise.all(
    body.platforms.map((platform) =>
      postToPlatform(platform, body.text, env, body.mediaUrls, body.replyTo, userTokens)
    )
  );

  const response: PostResponse = {
    id: crypto.randomUUID(),
    results,
    postedAt: new Date().toISOString(),
  };

  return json(response, 200, headers);
}

/**
 * Route a post to the correct platform handler.
 */
async function postToPlatform(
  platform: Platform,
  text: string,
  env: Env,
  mediaUrls?: string[],
  replyTo?: string,
  userTokens?: PlatformToken[]
): Promise<PlatformPostResult> {
  // Try per-user token first, fall back to env vars
  const token = userTokens ? findToken(userTokens, platform) : null;

  switch (platform) {
    case "bluesky": {
      const handle = token?.platform_handle || env.BLUESKY_HANDLE;
      const password = token?.access_token || env.BLUESKY_PASSWORD;
      if (!handle || !password) return { platform, success: false, error: "Bluesky not connected" };
      return postToBluesky(text, handle, password, mediaUrls);
    }
    case "linkedin": {
      const accessToken = token?.access_token || env.LINKEDIN_ACCESS_TOKEN;
      const author = token?.platform_user_id || env.LINKEDIN_AUTHOR;
      if (!accessToken || !author) return { platform, success: false, error: "LinkedIn not connected" };
      return postToLinkedIn(text, accessToken, author);
    }
    case "facebook": {
      const accessToken = token?.access_token || env.FACEBOOK_ACCESS_TOKEN;
      const pageId = (token?.metadata as any)?.page_id || env.FACEBOOK_PAGE_ID;
      if (!accessToken || !pageId) return { platform, success: false, error: "Facebook not connected" };
      return postToFacebook(text, accessToken, pageId);
    }
    case "instagram": {
      const accessToken = token?.access_token || env.INSTAGRAM_ACCESS_TOKEN;
      const igUserId = (token?.metadata as any)?.ig_user_id || env.INSTAGRAM_USER_ID;
      if (!accessToken || !igUserId) return { platform, success: false, error: "Instagram not connected" };
      return postToInstagram(text, accessToken, igUserId, mediaUrls);
    }
    case "tiktok": {
      const accessToken = token?.access_token || env.TIKTOK_ACCESS_TOKEN;
      const openId = token?.platform_user_id || env.TIKTOK_OPEN_ID;
      if (!accessToken || !openId) return { platform, success: false, error: "TikTok not connected" };
      return postToTikTok(text, accessToken, openId, mediaUrls);
    }
    case "threads": {
      const accessToken = token?.access_token || env.THREADS_ACCESS_TOKEN;
      const userId = (token?.metadata as any)?.threads_user_id || env.THREADS_USER_ID;
      if (!accessToken || !userId) return { platform, success: false, error: "Threads not connected" };
      return postToThreads(text, accessToken, userId, mediaUrls);
    }
    case "x": {
      const consumerKey = env.X_CONSUMER_KEY;
      const consumerSecret = env.X_CONSUMER_KEY_SECRET;
      const accessToken = token?.access_token || env.X_ACCESS_TOKEN;
      const accessSecret = (token?.metadata as any)?.access_secret || env.X_ACCESS_TOKEN_SECRET;
      if (!consumerKey || !consumerSecret || !accessToken || !accessSecret)
        return { platform, success: false, error: "X not configured — OAuth 1.0a keys required" };
      return postToX(text, consumerKey, consumerSecret, accessToken, accessSecret, replyTo);
    }

    default:
      return { platform, success: false, error: `Unknown platform: ${platform}` };
  }
}

/**
 * POST /api/schedule — Schedule a post for future publishing.
 */
async function handleSchedule(
  request: Request,
  env: Env,
  origin: string,
  headers: Record<string, string>
): Promise<Response> {
  const user = await validateSupabaseJWT(env.SUPABASE_JWT_SECRET, request.headers.get("Authorization"));
  if (!user) return errorResponse("Unauthorized", 401, origin);

  let body: { platforms: Platform[]; text: string; scheduledAt: string; mediaUrls?: string[] };
  try { body = (await request.json()) as any; } catch { return errorResponse("Invalid JSON", 400, origin); }

  if (!body.platforms?.length) return errorResponse("At least one platform required", 400, origin);
  if (!body.text?.trim()) return errorResponse("Text required", 400, origin);
  if (!body.scheduledAt) return errorResponse("scheduledAt (ISO timestamp) required", 400, origin);

  const scheduledAt = new Date(body.scheduledAt);
  if (isNaN(scheduledAt.getTime())) return errorResponse("Invalid scheduledAt date", 400, origin);
  if (scheduledAt <= new Date()) return errorResponse("scheduledAt must be in the future", 400, origin);

  if (!env.SUPABASE_SERVICE_ROLE_KEY) {
    return errorResponse("Scheduling requires SUPABASE_SERVICE_ROLE_KEY", 501, origin);
  }

  try {
    const res = await fetch(`${env.SUPABASE_URL || "https://jstojewashwoswsskwjk.supabase.co"}/rest/v1/scheduled_posts`, {
      method: "POST",
      headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`, "Content-Type": "application/json", Prefer: "return=representation" },
      body: JSON.stringify({ user_id: user.sub, text: body.text, platforms: body.platforms, media_urls: body.mediaUrls || [], scheduled_at: body.scheduledAt }),
    });
    if (!res.ok) return errorResponse("Failed to schedule post", 500, origin);
    const [scheduled] = (await res.json()) as any[];
    return json({ id: scheduled.id, scheduledAt: scheduled.scheduled_at, platforms: scheduled.platforms }, 201, headers);
  } catch { return errorResponse("Scheduling failed", 500, origin); }
}

/**
 * GET /api/scheduled — List user's scheduled posts.
 */
async function handleScheduled(
  request: Request,
  env: Env,
  origin: string,
  headers: Record<string, string>
): Promise<Response> {
  const user = await validateSupabaseJWT(env.SUPABASE_JWT_SECRET, request.headers.get("Authorization"));
  if (!user) return errorResponse("Unauthorized", 401, origin);
  if (!env.SUPABASE_SERVICE_ROLE_KEY) return json([], 200, headers);

  try {
    const res = await fetch(
      `${env.SUPABASE_URL || "https://jstojewashwoswsskwjk.supabase.co"}/rest/v1/scheduled_posts?user_id=eq.${user.sub}&status=eq.pending&order=scheduled_at.asc`,
      { headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}` } }
    );
    const posts = (await res.json()) as any[];
    return json(posts.map((p: any) => ({ id: p.id, text: p.text, platforms: p.platforms, scheduledAt: p.scheduled_at, createdAt: p.created_at })), 200, headers);
  } catch { return json([], 200, headers); }
}

/**
 * DELETE /api/scheduled/:id — Cancel a scheduled post.
 */
async function handleCancelSchedule(
  request: Request,
  env: Env,
  id: string,
  origin: string,
  headers: Record<string, string>
): Promise<Response> {
  const user = await validateSupabaseJWT(env.SUPABASE_JWT_SECRET, request.headers.get("Authorization"));
  if (!user) return errorResponse("Unauthorized", 401, origin);
  if (!env.SUPABASE_SERVICE_ROLE_KEY) return errorResponse("Not configured", 501, origin);

  try {
    await fetch(`${env.SUPABASE_URL || "https://jstojewashwoswsskwjk.supabase.co"}/rest/v1/scheduled_posts?id=eq.${id}&user_id=eq.${user.sub}`, {
      method: "DELETE", headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}` },
    });
    return json({ deleted: true }, 200, headers);
  } catch { return errorResponse("Cancel failed", 500, origin); }
}

/**
 * GET /api/replies/:platform/:postId
 */
async function handleReplies(
  request: Request, env: Env, platform: Platform, postId: string, origin: string, headers: Record<string, string>
): Promise<Response> {
  const user = await validateSupabaseJWT(env.SUPABASE_JWT_SECRET, request.headers.get("Authorization"));
  if (!user) return errorResponse("Unauthorized", 401, origin);

  if (platform === "bluesky" && env.BLUESKY_HANDLE && env.BLUESKY_PASSWORD) {
    try {
      const session = await createBlueskySession(env.BLUESKY_HANDLE, env.BLUESKY_PASSWORD);
      const uri = `at://${session.did}/app.bsky.feed.post/${postId}`;
      const res = await fetch(`https://bsky.social/xrpc/app.bsky.feed.getPostThread?uri=${encodeURIComponent(uri)}&depth=1`, {
        headers: { Authorization: `Bearer ${session.accessJwt}` },
      });
      const data = (await res.json()) as any;
      const replies = (data.thread?.replies ?? []).map((r: any) => ({
        id: r.post?.uri?.split("/").pop() || "", text: r.post?.record?.text || "",
        author: r.post?.author?.handle || "", createdAt: r.post?.record?.createdAt || "",
      }));
      return json(replies, 200, headers);
    } catch { return json([], 200, headers); }
  }
  return json([], 200, headers);
}

/**
 * POST /api/reply — Reply to a post.
 */
async function handleReply(
  request: Request, env: Env, origin: string, headers: Record<string, string>
): Promise<Response> {
  const user = await validateSupabaseJWT(env.SUPABASE_JWT_SECRET, request.headers.get("Authorization"));
  if (!user) return errorResponse("Unauthorized", 401, origin);

  let body: { platform: Platform; postId: string; text: string };
  try { body = (await request.json()) as any; } catch { return errorResponse("Invalid JSON", 400, origin); }
  if (!body.text?.trim()) return errorResponse("Text required", 400, origin);

  if (body.platform === "bluesky" && env.BLUESKY_HANDLE && env.BLUESKY_PASSWORD) {
    try {
      const session = await createBlueskySession(env.BLUESKY_HANDLE, env.BLUESKY_PASSWORD);
      const parentUri = `at://${session.did}/app.bsky.feed.post/${body.postId}`;
      const now = new Date().toISOString();
      const res = await fetch("https://bsky.social/xrpc/com.atproto.repo.createRecord", {
        method: "POST", headers: { Authorization: `Bearer ${session.accessJwt}`, "Content-Type": "application/json" },
        body: JSON.stringify({ repo: session.did, collection: "app.bsky.feed.post",
          record: { $type: "app.bsky.feed.post", text: body.text, createdAt: now,
            reply: { root: { uri: parentUri, cid: "" }, parent: { uri: parentUri, cid: "" } } } }),
      });
      const data = (await res.json()) as any;
      if (!res.ok) return errorResponse("Reply failed", 500, origin);
      return json({ id: data.uri?.split("/").pop(), platform: "bluesky" }, 201, headers);
    } catch { return errorResponse("Reply failed", 500, origin); }
  }
  return errorResponse(`Replies not yet supported for ${body.platform}`, 501, origin);
}

async function createBlueskySession(handle: string, password: string) {
  const res = await fetch("https://bsky.social/xrpc/com.atproto.server.createSession", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identifier: handle, password }),
  });
  if (!res.ok) throw new Error("Bluesky auth failed");
  return (await res.json()) as { accessJwt: string; did: string };
}

/**
 * GET /api/metrics/:platform/:postId
 */
async function handleMetrics(
  request: Request,
  env: Env,
  platform: Platform,
  postId: string,
  origin: string,
  headers: Record<string, string>
): Promise<Response> {
  const user = await validateSupabaseJWT(
    env.SUPABASE_JWT_SECRET,
    request.headers.get("Authorization")
  );
  if (!user) return errorResponse("Unauthorized", 401, origin);

  switch (platform) {
    case "bluesky": {
      if (!env.BLUESKY_HANDLE || !env.BLUESKY_PASSWORD) {
        return errorResponse("Bluesky not configured", 500, origin);
      }
      const metrics = await getBlueskyMetrics(postId, env.BLUESKY_HANDLE, env.BLUESKY_PASSWORD);
      return json(metrics, 200, headers);
    }
    case "linkedin": {
      if (!env.LINKEDIN_ACCESS_TOKEN) {
        return errorResponse("LinkedIn not configured", 500, origin);
      }
      const metrics = await getLinkedInMetrics(postId, env.LINKEDIN_ACCESS_TOKEN);
      return json(metrics, 200, headers);
    }
    case "facebook": {
      if (!env.FACEBOOK_ACCESS_TOKEN) {
        return errorResponse("Facebook not configured", 500, origin);
      }
      const metrics = await getFacebookMetrics(postId, env.FACEBOOK_ACCESS_TOKEN);
      return json(metrics, 200, headers);
    }
    case "instagram": {
      if (!env.INSTAGRAM_ACCESS_TOKEN) {
        return errorResponse("Instagram not configured", 500, origin);
      }
      const metrics = await getInstagramMetrics(postId, env.INSTAGRAM_ACCESS_TOKEN);
      return json(metrics, 200, headers);
    }
    case "tiktok": {
      if (!env.TIKTOK_ACCESS_TOKEN) {
        return errorResponse("TikTok not configured", 500, origin);
      }
      const metrics = await getTikTokMetrics(postId, env.TIKTOK_ACCESS_TOKEN);
      return json(metrics, 200, headers);
    }
    case "threads": {
      if (!env.THREADS_ACCESS_TOKEN) {
        return errorResponse("Threads not configured", 500, origin);
      }
      const metrics = await getThreadsMetrics(postId, env.THREADS_ACCESS_TOKEN);
      return json(metrics, 200, headers);
    }
    case "x": {
      if (!env.X_BEARER_TOKEN) {
        return errorResponse("X Bearer token not configured", 500, origin);
      }
      const metrics = await getXMetrics(postId, env.X_BEARER_TOKEN);
      return json(metrics, 200, headers);
    }
    default:
      return errorResponse(`Unknown platform: ${platform}`, 400, origin);
  }
}
