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

  // Encryption key for token storage
  ENCRYPTION_KEY?: string;

  // Third-party social API provider (e.g. Ayrshare) — wraps multiple platforms
  SOCIAL_API_PROVIDER_KEY?: string;
  SOCIAL_API_PROVIDER_URL?: string;  // e.g. https://app.ayrshare.com/api

  // Environment name
  ENVIRONMENT?: string;

  // OAuth client credentials
  BLUESKY_CLIENT_ID?: string;  BLUESKY_CLIENT_SECRET?: string;
  BLUESKY_REDIRECT_URI?: string;
  LINKEDIN_CLIENT_ID?: string;  LINKEDIN_CLIENT_SECRET?: string;
  LINKEDIN_REDIRECT_URI?: string;
  FACEBOOK_CLIENT_ID?: string;  FACEBOOK_CLIENT_SECRET?: string;
  FACEBOOK_REDIRECT_URI?: string;
  INSTAGRAM_CLIENT_ID?: string;  INSTAGRAM_CLIENT_SECRET?: string;
  INSTAGRAM_REDIRECT_URI?: string;
  THREADS_CLIENT_ID?: string;  THREADS_CLIENT_SECRET?: string;
  THREADS_REDIRECT_URI?: string;
  TIKTOK_CLIENT_ID?: string;  TIKTOK_CLIENT_SECRET?: string;
  TIKTOK_REDIRECT_URI?: string;

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

    // Enhanced health check
    if (url.pathname === "/health") {
      return handleHealthCheck(env, origin);
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

  // --- Drafts API ---
  if (url.pathname === "/api/drafts" && request.method === "GET") {
    return handleGetDrafts(request, env, origin, h);
  }
  if (url.pathname === "/api/drafts" && request.method === "POST") {
    return handleCreateDraft(request, env, origin, h);
  }
  const draftDeleteMatch = url.pathname.match(/^\/api\/drafts\/([a-f0-9-]+)$/);
  if (draftDeleteMatch && request.method === "DELETE") {
    return handleDeleteDraft(request, env, draftDeleteMatch[1], origin, h);
  }

  // --- Hashtag Groups API ---
  if (url.pathname === "/api/hashtags" && request.method === "GET") {
    return handleGetHashtags(request, env, origin, h);
  }
  if (url.pathname === "/api/hashtags" && request.method === "POST") {
    return handleCreateHashtagGroup(request, env, origin, h);
  }
  const hashtagDeleteMatch = url.pathname.match(/^\/api\/hashtags\/([a-f0-9-]+)$/);
  if (hashtagDeleteMatch && request.method === "DELETE") {
    return handleDeleteHashtagGroup(request, env, hashtagDeleteMatch[1], origin, h);
  }

  // --- Saved Replies API ---
  if (url.pathname === "/api/replies/templates" && request.method === "GET") {
    return handleGetSavedReplies(request, env, origin, h);
  }
  if (url.pathname === "/api/replies/templates" && request.method === "POST") {
    return handleCreateSavedReply(request, env, origin, h);
  }
  const savedReplyDeleteMatch = url.pathname.match(/^\/api\/replies\/templates\/([a-f0-9-]+)$/);
  if (savedReplyDeleteMatch && request.method === "DELETE") {
    return handleDeleteSavedReply(request, env, savedReplyDeleteMatch[1], origin, h);
  }

  // --- Queue API ---
  if (url.pathname === "/api/queue" && request.method === "GET") {
    return handleGetQueue(request, env, origin, h);
  }
  if (url.pathname === "/api/queue" && request.method === "POST") {
    return handleAddToQueue(request, env, origin, h);
  }
  if (url.pathname === "/api/queue/refill" && request.method === "POST") {
    return handleRefillQueue(request, env, origin, h);
  }
  const queueDeleteMatch = url.pathname.match(/^\/api\/queue\/([a-f0-9-]+)$/);
  if (queueDeleteMatch && request.method === "DELETE") {
    return handleRemoveFromQueue(request, env, queueDeleteMatch[1], origin, h);
  }

  // --- Analytics API ---
  if (url.pathname === "/api/analytics" && request.method === "GET") {
    return handleGetAnalytics(request, env, origin, h);
  }
  if (url.pathname === "/api/analytics/trends" && request.method === "GET") {
    return handleGetAnalyticsTrends(request, env, origin, h);
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

  // Post to each platform in parallel, with provider fallback
  const results: PlatformPostResult[] = await Promise.all(
    body.platforms.map(async (platform) => {
      const result = await postToPlatform(platform, body.text, env, body.mediaUrls, body.replyTo, userTokens);
      // If direct keys aren't configured, try the third-party provider
      if (!result.success && result.error?.includes("not configured") && env.SOCIAL_API_PROVIDER_KEY) {
        return postViaProvider(platform, body.text, env, body.mediaUrls);
      }
      return result;
    })
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
 * Post via a third-party social API provider (e.g. Ayrshare) as fallback.
 */
async function postViaProvider(
  platform: Platform,
  text: string,
  env: Env,
  mediaUrls?: string[]
): Promise<PlatformPostResult> {
  if (!env.SOCIAL_API_PROVIDER_KEY || !env.SOCIAL_API_PROVIDER_URL) {
    return { platform, success: false, error: "API provider not configured" };
  }

  try {
    const res = await fetch(`${env.SOCIAL_API_PROVIDER_URL}/post`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${env.SOCIAL_API_PROVIDER_KEY}`,
      },
      body: JSON.stringify({
        post: text,
        platforms: [platform],
        mediaUrls: mediaUrls || [],
      }),
    });

    const data = (await res.json()) as any;
    if (!res.ok) {
      return { platform, success: false, error: `Provider error: ${data.message || res.status}` };
    }

    return {
      platform,
      success: true,
      postId: data.id || data.postIds?.[0]?.id,
      postUrl: data.postIds?.[0]?.postUrl || data.url,
    };
  } catch (e) {
    return { platform, success: false, error: e instanceof Error ? e.message : "Provider error" };
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

/**
 * Handle enhanced health check with system status
 */
async function handleHealthCheck(
  env: Env,
  origin: string
): Promise<Response> {
  const checks: Array<{ name: string; status: "healthy" | "degraded" | "unhealthy"; message?: string; response_time_ms: number }> = [];
  let overallStatus: "healthy" | "degraded" | "unhealthy" = "healthy";

  // Check Cloudflare KV (rate limiting)
  const kvStart = Date.now();
  try {
    if (env.RATE_LIMITS) {
      const testKey = `health-check-${Date.now()}`;
      await env.RATE_LIMITS.put(testKey, "ok", { expirationTtl: 60 });
      await env.RATE_LIMITS.get(testKey);
      checks.push({
        name: "rate_limiter_kv",
        status: "healthy",
        response_time_ms: Date.now() - kvStart,
      });
    } else {
      checks.push({
        name: "rate_limiter_kv",
        status: "degraded",
        message: "KV not configured - rate limiting disabled",
        response_time_ms: 0,
      });
      overallStatus = "degraded";
    }
  } catch (error) {
    checks.push({
      name: "rate_limiter_kv",
      status: "unhealthy",
      message: error instanceof Error ? error.message : "Unknown error",
      response_time_ms: Date.now() - kvStart,
    });
    overallStatus = "unhealthy";
  }

  // Check Supabase connectivity
  const dbStart = Date.now();
  try {
    if (env.SUPABASE_SERVICE_ROLE_KEY) {
      const supabaseUrl = env.SUPABASE_URL || "https://jstojewashwoswsskwjk.supabase.co";
      const response = await fetch(`${supabaseUrl}/rest/v1/`, {
        method: "HEAD",
        headers: {
          apikey: env.SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
        },
      });

      if (response.ok) {
        checks.push({
          name: "supabase_database",
          status: "healthy",
          response_time_ms: Date.now() - dbStart,
        });
      } else {
        checks.push({
          name: "supabase_database",
          status: "unhealthy",
          message: `HTTP ${response.status}`,
          response_time_ms: Date.now() - dbStart,
        });
        overallStatus = "unhealthy";
      }
    } else {
      checks.push({
        name: "supabase_database",
        status: "degraded",
        message: "Service role key not configured - multi-user mode disabled",
        response_time_ms: 0,
      });
      overallStatus = "degraded";
    }
  } catch (error) {
    checks.push({
      name: "supabase_database",
      status: "unhealthy",
      message: error instanceof Error ? error.message : "Unknown error",
      response_time_ms: Date.now() - dbStart,
    });
    overallStatus = "unhealthy";
  }

  // Check platform configuration
  const platformCheck = {
    name: "platform_credentials" as const,
    status: "healthy" as "healthy" | "degraded" | "unhealthy",
    message: "" as string,
    response_time_ms: 0,
  };

  const configuredPlatforms: string[] = [];
  const missingPlatforms: string[] = [];

  if (env.BLUESKY_HANDLE && env.BLUESKY_PASSWORD) configuredPlatforms.push("bluesky");
  else missingPlatforms.push("bluesky");

  if (env.LINKEDIN_ACCESS_TOKEN && env.LINKEDIN_AUTHOR) configuredPlatforms.push("linkedin");
  else missingPlatforms.push("linkedin");

  if (env.FACEBOOK_ACCESS_TOKEN && env.FACEBOOK_PAGE_ID) configuredPlatforms.push("facebook");
  else missingPlatforms.push("facebook");

  if (env.INSTAGRAM_ACCESS_TOKEN && env.INSTAGRAM_USER_ID) configuredPlatforms.push("instagram");
  else missingPlatforms.push("instagram");

  if (env.TIKTOK_ACCESS_TOKEN && env.TIKTOK_OPEN_ID) configuredPlatforms.push("tiktok");
  else missingPlatforms.push("tiktok");

  if (env.THREADS_ACCESS_TOKEN && env.THREADS_USER_ID) configuredPlatforms.push("threads");
  else missingPlatforms.push("threads");

  if (env.X_CONSUMER_KEY && env.X_CONSUMER_KEY_SECRET && env.X_ACCESS_TOKEN && env.X_ACCESS_TOKEN_SECRET) {
    configuredPlatforms.push("x");
  } else {
    missingPlatforms.push("x");
  }

  platformCheck.message = `Configured: ${configuredPlatforms.join(", ") || "none"}${missingPlatforms.length ? ` | Missing: ${missingPlatforms.join(", ")}` : ""}`;
  platformCheck.response_time_ms = 0;

  if (configuredPlatforms.length === 0) {
    platformCheck.status = "degraded";
    overallStatus = "degraded";
  }

  checks.push(platformCheck);

  // Check encryption key
  const cryptoCheck = {
    name: "encryption" as const,
    status: "healthy" as "healthy" | "degraded" | "unhealthy",
    message: "" as string,
    response_time_ms: 0,
  };

  if (env.ENCRYPTION_KEY) {
    cryptoCheck.status = "healthy";
    cryptoCheck.message = "Encryption key configured";
  } else {
    cryptoCheck.status = "degraded";
    cryptoCheck.message = "Using default encryption key - not recommended for production";
    overallStatus = "degraded";
  }
  checks.push(cryptoCheck);

  // Get performance stats
  const { getPerformanceStats, trackPerformance } = await import("./logging");
  trackPerformance("/health", "GET", overallStatus === "healthy" ? 200 : 503, Date.now() - Date.now());
  const perfStats = getPerformanceStats();

  // Compile health check response
  const healthData = {
    status: overallStatus,
    timestamp: new Date().toISOString(),
    version: "0.1.0",
    checks,
    performance: perfStats,
    environment: env.ENVIRONMENT || "unknown",
  };

  const statusCode = overallStatus === "healthy" ? 200 : overallStatus === "degraded" ? 200 : 503;
  return json(healthData, statusCode, corsHeaders(origin));
}

// ── Drafts API Handlers ──

/**
 * GET /api/drafts — List all drafts for the authenticated user
 */
async function handleGetDrafts(
  request: Request,
  env: Env,
  origin: string,
  headers: Record<string, string>
): Promise<Response> {
  const user = await validateSupabaseJWT(env.SUPABASE_JWT_SECRET, request.headers.get("Authorization"));
  if (!user) return errorResponse("Unauthorized", 401, origin);
  if (!env.SUPABASE_SERVICE_ROLE_KEY) return errorResponse("Not configured", 501, origin);

  try {
    const supabaseUrl = env.SUPABASE_URL || "https://jstojewashwoswsskwjk.supabase.co";
    const res = await fetch(
      `${supabaseUrl}/rest/v1/post_drafts?user_id=eq.${user.sub}&order=updated_at.desc`,
      {
        headers: {
          apikey: env.SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
        },
      }
    );

    if (!res.ok) {
      return errorResponse("Failed to fetch drafts", 500, origin);
    }

    const drafts = await res.json();
    return json({ drafts }, 200, headers);
  } catch (error) {
    console.error("Drafts fetch error:", error);
    return errorResponse("Failed to fetch drafts", 500, origin);
  }
}

/**
 * POST /api/drafts — Create a new draft
 */
async function handleCreateDraft(
  request: Request,
  env: Env,
  origin: string,
  headers: Record<string, string>
): Promise<Response> {
  const user = await validateSupabaseJWT(env.SUPABASE_JWT_SECRET, request.headers.get("Authorization"));
  if (!user) return errorResponse("Unauthorized", 401, origin);
  if (!env.SUPABASE_SERVICE_ROLE_KEY) return errorResponse("Not configured", 501, origin);

  let body: { text: string; platforms?: Platform[]; media?: Array<{ type: string; name: string }> };
  try {
    body = (await request.json()) as any;
  } catch {
    return errorResponse("Invalid JSON body", 400, origin);
  }

  if (!body.text?.trim()) {
    return errorResponse("Text content is required", 400, origin);
  }

  try {
    const supabaseUrl = env.SUPABASE_URL || "https://jstojewashwoswsskwjk.supabase.co";
    const res = await fetch(`${supabaseUrl}/rest/v1/post_drafts`, {
      method: "POST",
      headers: {
        apikey: env.SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
      body: JSON.stringify({
        user_id: user.sub,
        text: body.text,
        platforms: body.platforms || [],
        media: body.media || [],
      }),
    });

    if (!res.ok) {
      const errorData = await res.json() as { message?: string };
      return errorResponse(errorData.message || "Failed to create draft", 500, origin);
    }

    const [draft] = await res.json() as any[];
    return json({ draft }, 201, headers);
  } catch (error) {
    console.error("Draft creation error:", error);
    return errorResponse("Failed to create draft", 500, origin);
  }
}

/**
 * DELETE /api/drafts/:id — Delete a draft
 */
async function handleDeleteDraft(
  request: Request,
  env: Env,
  draftId: string,
  origin: string,
  headers: Record<string, string>
): Promise<Response> {
  const user = await validateSupabaseJWT(env.SUPABASE_JWT_SECRET, request.headers.get("Authorization"));
  if (!user) return errorResponse("Unauthorized", 401, origin);
  if (!env.SUPABASE_SERVICE_ROLE_KEY) return errorResponse("Not configured", 501, origin);

  try {
    const supabaseUrl = env.SUPABASE_URL || "https://jstojewashwoswsskwjk.supabase.co";
    const res = await fetch(
      `${supabaseUrl}/rest/v1/post_drafts?id=eq.${draftId}&user_id=eq.${user.sub}`,
      {
        method: "DELETE",
        headers: {
          apikey: env.SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
        },
      }
    );

    if (!res.ok) {
      return errorResponse("Failed to delete draft", 500, origin);
    }

    return json({ deleted: true }, 200, headers);
  } catch (error) {
    console.error("Draft deletion error:", error);
    return errorResponse("Failed to delete draft", 500, origin);
  }
}

// ── Hashtag Groups API Handlers ──

/**
 * GET /api/hashtags — List all hashtag groups for the user
 */
async function handleGetHashtags(
  request: Request,
  env: Env,
  origin: string,
  headers: Record<string, string>
): Promise<Response> {
  const user = await validateSupabaseJWT(env.SUPABASE_JWT_SECRET, request.headers.get("Authorization"));
  if (!user) return errorResponse("Unauthorized", 401, origin);
  if (!env.SUPABASE_SERVICE_ROLE_KEY) return errorResponse("Not configured", 501, origin);

  try {
    const supabaseUrl = env.SUPABASE_URL || "https://jstojewashwoswsskwjk.supabase.co";
    const res = await fetch(
      `${supabaseUrl}/rest/v1/post_hashtag_groups?user_id=eq.${user.sub}&order=created_at.desc`,
      {
        headers: {
          apikey: env.SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
        },
      }
    );

    if (!res.ok) {
      return errorResponse("Failed to fetch hashtag groups", 500, origin);
    }

    const groups = await res.json();
    return json({ groups }, 200, headers);
  } catch (error) {
    console.error("Hashtag groups fetch error:", error);
    return errorResponse("Failed to fetch hashtag groups", 500, origin);
  }
}

/**
 * POST /api/hashtags — Create a new hashtag group
 */
async function handleCreateHashtagGroup(
  request: Request,
  env: Env,
  origin: string,
  headers: Record<string, string>
): Promise<Response> {
  const user = await validateSupabaseJWT(env.SUPABASE_JWT_SECRET, request.headers.get("Authorization"));
  if (!user) return errorResponse("Unauthorized", 401, origin);
  if (!env.SUPABASE_SERVICE_ROLE_KEY) return errorResponse("Not configured", 501, origin);

  let body: { name: string; platform: Platform; hashtags: string[] };
  try {
    body = (await request.json()) as any;
  } catch {
    return errorResponse("Invalid JSON body", 400, origin);
  }

  if (!body.name?.trim()) {
    return errorResponse("Name is required", 400, origin);
  }
  if (!body.platform) {
    return errorResponse("Platform is required", 400, origin);
  }
  if (!body.hashtags || !Array.isArray(body.hashtags) || body.hashtags.length === 0) {
    return errorResponse("Hashtags array is required", 400, origin);
  }

  try {
    const supabaseUrl = env.SUPABASE_URL || "https://jstojewashwoswsskwjk.supabase.co";
    const res = await fetch(`${supabaseUrl}/rest/v1/post_hashtag_groups`, {
      method: "POST",
      headers: {
        apikey: env.SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
      body: JSON.stringify({
        user_id: user.sub,
        name: body.name,
        platform: body.platform,
        hashtags: body.hashtags.filter((h) => h.trim().startsWith("#")),
      }),
    });

    if (!res.ok) {
      const errorData = await res.json() as { message?: string };
      return errorResponse(errorData.message || "Failed to create hashtag group", 500, origin);
    }

    const [group] = await res.json() as any[];
    return json({ group }, 201, headers);
  } catch (error) {
    console.error("Hashtag group creation error:", error);
    return errorResponse("Failed to create hashtag group", 500, origin);
  }
}

/**
 * DELETE /api/hashtags/:id — Delete a hashtag group
 */
async function handleDeleteHashtagGroup(
  request: Request,
  env: Env,
  groupId: string,
  origin: string,
  headers: Record<string, string>
): Promise<Response> {
  const user = await validateSupabaseJWT(env.SUPABASE_JWT_SECRET, request.headers.get("Authorization"));
  if (!user) return errorResponse("Unauthorized", 401, origin);
  if (!env.SUPABASE_SERVICE_ROLE_KEY) return errorResponse("Not configured", 501, origin);

  try {
    const supabaseUrl = env.SUPABASE_URL || "https://jstojewashwoswsskwjk.supabase.co";
    const res = await fetch(
      `${supabaseUrl}/rest/v1/post_hashtag_groups?id=eq.${groupId}&user_id=eq.${user.sub}`,
      {
        method: "DELETE",
        headers: {
          apikey: env.SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
        },
      }
    );

    if (!res.ok) {
      return errorResponse("Failed to delete hashtag group", 500, origin);
    }

    return json({ deleted: true }, 200, headers);
  } catch (error) {
    console.error("Hashtag group deletion error:", error);
    return errorResponse("Failed to delete hashtag group", 500, origin);
  }
}

// ── Saved Replies API Handlers ──

/**
 * GET /api/replies/templates — List all saved replies for the user
 */
async function handleGetSavedReplies(
  request: Request,
  env: Env,
  origin: string,
  headers: Record<string, string>
): Promise<Response> {
  const user = await validateSupabaseJWT(env.SUPABASE_JWT_SECRET, request.headers.get("Authorization"));
  if (!user) return errorResponse("Unauthorized", 401, origin);
  if (!env.SUPABASE_SERVICE_ROLE_KEY) return errorResponse("Not configured", 501, origin);

  try {
    const supabaseUrl = env.SUPABASE_URL || "https://jstojewashwoswsskwjk.supabase.co";
    const res = await fetch(
      `${supabaseUrl}/rest/v1/post_saved_replies?user_id=eq.${user.sub}&order=created_at.desc`,
      {
        headers: {
          apikey: env.SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
        },
      }
    );

    if (!res.ok) {
      return errorResponse("Failed to fetch saved replies", 500, origin);
    }

    const replies = await res.json();
    return json({ replies }, 200, headers);
  } catch (error) {
    console.error("Saved replies fetch error:", error);
    return errorResponse("Failed to fetch saved replies", 500, origin);
  }
}

/**
 * POST /api/replies/templates — Create a new saved reply
 */
async function handleCreateSavedReply(
  request: Request,
  env: Env,
  origin: string,
  headers: Record<string, string>
): Promise<Response> {
  const user = await validateSupabaseJWT(env.SUPABASE_JWT_SECRET, request.headers.get("Authorization"));
  if (!user) return errorResponse("Unauthorized", 401, origin);
  if (!env.SUPABASE_SERVICE_ROLE_KEY) return errorResponse("Not configured", 501, origin);

  let body: { title: string; content: string; platforms?: Platform[] };
  try {
    body = (await request.json()) as any;
  } catch {
    return errorResponse("Invalid JSON body", 400, origin);
  }

  if (!body.title?.trim()) {
    return errorResponse("Title is required", 400, origin);
  }
  if (!body.content?.trim()) {
    return errorResponse("Content is required", 400, origin);
  }

  try {
    const supabaseUrl = env.SUPABASE_URL || "https://jstojewashwoswsskwjk.supabase.co";
    const res = await fetch(`${supabaseUrl}/rest/v1/post_saved_replies`, {
      method: "POST",
      headers: {
        apikey: env.SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
      body: JSON.stringify({
        user_id: user.sub,
        title: body.title,
        content: body.content,
        platforms: body.platforms || [],
      }),
    });

    if (!res.ok) {
      const errorData = await res.json() as { message?: string };
      return errorResponse(errorData.message || "Failed to create saved reply", 500, origin);
    }

    const [reply] = await res.json() as any[];
    return json({ reply }, 201, headers);
  } catch (error) {
    console.error("Saved reply creation error:", error);
    return errorResponse("Failed to create saved reply", 500, origin);
  }
}

/**
 * DELETE /api/replies/templates/:id — Delete a saved reply
 */
async function handleDeleteSavedReply(
  request: Request,
  env: Env,
  replyId: string,
  origin: string,
  headers: Record<string, string>
): Promise<Response> {
  const user = await validateSupabaseJWT(env.SUPABASE_JWT_SECRET, request.headers.get("Authorization"));
  if (!user) return errorResponse("Unauthorized", 401, origin);
  if (!env.SUPABASE_SERVICE_ROLE_KEY) return errorResponse("Not configured", 501, origin);

  try {
    const supabaseUrl = env.SUPABASE_URL || "https://jstojewashwoswsskwjk.supabase.co";
    const res = await fetch(
      `${supabaseUrl}/rest/v1/post_saved_replies?id=eq.${replyId}&user_id=eq.${user.sub}`,
      {
        method: "DELETE",
        headers: {
          apikey: env.SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
        },
      }
    );

    if (!res.ok) {
      return errorResponse("Failed to delete saved reply", 500, origin);
    }

    return json({ deleted: true }, 200, headers);
  } catch (error) {
    console.error("Saved reply deletion error:", error);
    return errorResponse("Failed to delete saved reply", 500, origin);
  }
}

// ── Queue API Handlers ──

/**
 * GET /api/queue — List all posts in the user's queue
 */
async function handleGetQueue(
  request: Request,
  env: Env,
  origin: string,
  headers: Record<string, string>
): Promise<Response> {
  const user = await validateSupabaseJWT(env.SUPABASE_JWT_SECRET, request.headers.get("Authorization"));
  if (!user) return errorResponse("Unauthorized", 401, origin);
  if (!env.SUPABASE_SERVICE_ROLE_KEY) return errorResponse("Not configured", 501, origin);

  try {
    const supabaseUrl = env.SUPABASE_URL || "https://jstojewashwoswsskwjk.supabase.co";
    const res = await fetch(
      `${supabaseUrl}/rest/v1/post_queue?user_id=eq.${user.sub}&status=eq.pending&order=created_at.asc`,
      {
        headers: {
          apikey: env.SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
        },
      }
    );

    if (!res.ok) {
      return errorResponse("Failed to fetch queue", 500, origin);
    }

    const queue = await res.json();
    return json({ queue }, 200, headers);
  } catch (error) {
    console.error("Queue fetch error:", error);
    return errorResponse("Failed to fetch queue", 500, origin);
  }
}

/**
 * POST /api/queue — Add a post to the queue
 */
async function handleAddToQueue(
  request: Request,
  env: Env,
  origin: string,
  headers: Record<string, string>
): Promise<Response> {
  const user = await validateSupabaseJWT(env.SUPABASE_JWT_SECRET, request.headers.get("Authorization"));
  if (!user) return errorResponse("Unauthorized", 401, origin);
  if (!env.SUPABASE_SERVICE_ROLE_KEY) return errorResponse("Not configured", 501, origin);

  let body: { text: string; platforms: Platform[]; scheduleTime?: string; mediaUrls?: string[] };
  try {
    body = (await request.json()) as any;
  } catch {
    return errorResponse("Invalid JSON body", 400, origin);
  }

  if (!body.text?.trim()) {
    return errorResponse("Text content is required", 400, origin);
  }
  if (!body.platforms || !Array.isArray(body.platforms) || body.platforms.length === 0) {
    return errorResponse("At least one platform is required", 400, origin);
  }

  const scheduleTime = body.scheduleTime ? new Date(body.scheduleTime) : null;
  if (scheduleTime && isNaN(scheduleTime.getTime())) {
    return errorResponse("Invalid schedule time", 400, origin);
  }

  try {
    const supabaseUrl = env.SUPABASE_URL || "https://jstojewashwoswsskwjk.supabase.co";
    const res = await fetch(`${supabaseUrl}/rest/v1/post_queue`, {
      method: "POST",
      headers: {
        apikey: env.SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
      body: JSON.stringify({
        user_id: user.sub,
        text: body.text,
        platforms: body.platforms,
        media_urls: body.mediaUrls || [],
        schedule_time: scheduleTime ? scheduleTime.toISOString() : null,
        status: "pending",
      }),
    });

    if (!res.ok) {
      const errorData = await res.json() as { message?: string };
      return errorResponse(errorData.message || "Failed to add to queue", 500, origin);
    }

    const [queued] = await res.json() as any[];
    return json({ queued }, 201, headers);
  } catch (error) {
    console.error("Queue addition error:", error);
    return errorResponse("Failed to add to queue", 500, origin);
  }
}

/**
 * POST /api/queue/refill — Refill the queue with content from drafts
 */
async function handleRefillQueue(
  request: Request,
  env: Env,
  origin: string,
  headers: Record<string, string>
): Promise<Response> {
  const user = await validateSupabaseJWT(env.SUPABASE_JWT_SECRET, request.headers.get("Authorization"));
  if (!user) return errorResponse("Unauthorized", 401, origin);
  if (!env.SUPABASE_SERVICE_ROLE_KEY) return errorResponse("Not configured", 501, origin);

  let body: { targetCount?: number };
  try {
    body = (await request.json()) as any;
  } catch {
    body = { targetCount: undefined };
  }

  const targetCount = body.targetCount || 7; // Default to 7 posts per week

  try {
    const supabaseUrl = env.SUPABASE_URL || "https://jstojewashwoswsskwjk.supabase.co";

    // Get current queue count
    const queueRes = await fetch(
      `${supabaseUrl}/rest/v1/post_queue?user_id=eq.${user.sub}&status=eq.pending&select=id`,
      {
        headers: {
          apikey: env.SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
        },
      }
    );
    const currentQueue = await queueRes.json() as any[];
    const queueCount = currentQueue.length;

    if (queueCount >= targetCount) {
      return json({ message: "Queue already full", queueCount, targetCount }, 200, headers);
    }

    const needed = targetCount - queueCount;

    // Get unused drafts
    const draftsRes = await fetch(
      `${supabaseUrl}/rest/v1/post_drafts?user_id=eq.${user.sub}&limit=${needed}&order=updated_at.desc&select=*`,
      {
        headers: {
          apikey: env.SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
        },
      }
    );
    const drafts = await draftsRes.json() as any[];

    if (!drafts || drafts.length === 0) {
      return json({ message: "No drafts available to refill queue", queueCount, targetCount }, 200, headers);
    }

    // Add drafts to queue with spaced scheduling
    const now = new Date();
    const dayMs = 24 * 60 * 60 * 1000;
    const added: any[] = [];

    for (let i = 0; i < drafts.length && i < needed; i++) {
      const scheduleTime = new Date(now.getTime() + (i + 1) * dayMs);
      const res = await fetch(`${supabaseUrl}/rest/v1/post_queue`, {
        method: "POST",
        headers: {
          apikey: env.SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
          "Content-Type": "application/json",
          Prefer: "return=representation",
        },
        body: JSON.stringify({
          user_id: user.sub,
          text: drafts[i].text,
          platforms: drafts[i].platforms,
          media_urls: drafts[i].media || [],
          schedule_time: scheduleTime.toISOString(),
          status: "pending",
        }),
      });

      if (res.ok) {
        const [queued] = await res.json() as any[];
        added.push(queued);
      }
    }

    return json(
      {
        message: `Added ${added.length} posts to queue`,
        added,
        queueCount: queueCount + added.length,
        targetCount,
      },
      200,
      headers
    );
  } catch (error) {
    console.error("Queue refill error:", error);
    return errorResponse("Failed to refill queue", 500, origin);
  }
}

/**
 * DELETE /api/queue/:id — Remove a post from the queue
 */
async function handleRemoveFromQueue(
  request: Request,
  env: Env,
  queueId: string,
  origin: string,
  headers: Record<string, string>
): Promise<Response> {
  const user = await validateSupabaseJWT(env.SUPABASE_JWT_SECRET, request.headers.get("Authorization"));
  if (!user) return errorResponse("Unauthorized", 401, origin);
  if (!env.SUPABASE_SERVICE_ROLE_KEY) return errorResponse("Not configured", 501, origin);

  try {
    const supabaseUrl = env.SUPABASE_URL || "https://jstojewashwoswsskwjk.supabase.co";
    const res = await fetch(
      `${supabaseUrl}/rest/v1/post_queue?id=eq.${queueId}&user_id=eq.${user.sub}`,
      {
        method: "DELETE",
        headers: {
          apikey: env.SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
        },
      }
    );

    if (!res.ok) {
      return errorResponse("Failed to remove from queue", 500, origin);
    }

    return json({ removed: true }, 200, headers);
  } catch (error) {
    console.error("Queue removal error:", error);
    return errorResponse("Failed to remove from queue", 500, origin);
  }
}

// ── Analytics API Handlers ──

/**
 * GET /api/analytics — Get analytics for all platforms
 */
async function handleGetAnalytics(
  request: Request,
  env: Env,
  origin: string,
  headers: Record<string, string>
): Promise<Response> {
  const user = await validateSupabaseJWT(env.SUPABASE_JWT_SECRET, request.headers.get("Authorization"));
  if (!user) return errorResponse("Unauthorized", 401, origin);
  if (!env.SUPABASE_SERVICE_ROLE_KEY) return errorResponse("Not configured", 501, origin);

  const url = new URL(request.url);
  const startDate = url.searchParams.get("start") || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const endDate = url.searchParams.get("end") || new Date().toISOString();

  try {
    const supabaseUrl = env.SUPABASE_URL || "https://jstojewashwoswsskwjk.supabase.co";

    // Get post history for the date range
    const historyRes = await fetch(
      `${supabaseUrl}/rest/v1/post_history?user_id=eq.${user.sub}&created_at=gte.${startDate}&created_at=lte.${endDate}&select=*`,
      {
        headers: {
          apikey: env.SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
        },
      }
    );

    if (!historyRes.ok) {
      return errorResponse("Failed to fetch analytics", 500, origin);
    }

    const posts = await historyRes.json() as any[];

    // Get engagement logs
    const engagementRes = await fetch(
      `${supabaseUrl}/rest/v1/post_engagement_log?post_id=in.(${posts.map((p: any) => p.id).join(",")})&select=*`,
      {
        headers: {
          apikey: env.SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
        },
      }
    );

    const engagements = engagementRes.ok ? await engagementRes.json() as any[] : [];

    // Aggregate analytics by platform
    const analytics: Record<string, any> = {
      bluesky: { posts: 0, likes: 0, comments: 0, shares: 0 },
      x: { posts: 0, likes: 0, comments: 0, shares: 0 },
      linkedin: { posts: 0, likes: 0, comments: 0, shares: 0 },
      facebook: { posts: 0, likes: 0, comments: 0, shares: 0 },
      instagram: { posts: 0, likes: 0, comments: 0, shares: 0 },
      threads: { posts: 0, likes: 0, comments: 0, shares: 0 },
      tiktok: { posts: 0, likes: 0, comments: 0, shares: 0 },
    };

    posts.forEach((post: any) => {
      const platform = post.platform;
      if (analytics[platform]) {
        analytics[platform].posts++;
      }
    });

    engagements.forEach((eng: any) => {
      const platform = eng.platform;
      if (analytics[platform]) {
        analytics[platform].likes += eng.likes || 0;
        analytics[platform].comments += eng.comments || 0;
        analytics[platform].shares += eng.shares || 0;
      }
    });

    // Calculate totals
    const totals = {
      posts: posts.length,
      likes: Object.values(analytics).reduce((sum: number, a: any) => sum + a.likes, 0),
      comments: Object.values(analytics).reduce((sum: number, a: any) => sum + a.comments, 0),
      shares: Object.values(analytics).reduce((sum: number, a: any) => sum + a.shares, 0),
    };

    return json(
      {
        analytics,
        totals,
        period: { start: startDate, end: endDate },
      },
      200,
      headers
    );
  } catch (error) {
    console.error("Analytics fetch error:", error);
    return errorResponse("Failed to fetch analytics", 500, origin);
  }
}

/**
 * GET /api/analytics/trends — Get analytics trends over time
 */
async function handleGetAnalyticsTrends(
  request: Request,
  env: Env,
  origin: string,
  headers: Record<string, string>
): Promise<Response> {
  const user = await validateSupabaseJWT(env.SUPABASE_JWT_SECRET, request.headers.get("Authorization"));
  if (!user) return errorResponse("Unauthorized", 401, origin);
  if (!env.SUPABASE_SERVICE_ROLE_KEY) return errorResponse("Not configured", 501, origin);

  const url = new URL(request.url);
  const days = parseInt(url.searchParams.get("days") || "30");

  try {
    const supabaseUrl = env.SUPABASE_URL || "https://jstojewashwoswsskwjk.supabase.co";
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    // Get post history grouped by day
    const historyRes = await fetch(
      `${supabaseUrl}/rest/v1/post_history?user_id=eq.${user.sub}&created_at=gte.${startDate}&order=created_at.desc&select=*`,
      {
        headers: {
          apikey: env.SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
        },
      }
    );

    if (!historyRes.ok) {
      return errorResponse("Failed to fetch trends", 500, origin);
    }

    const posts = await historyRes.json() as any[];

    // Group by day
    const trends: Record<string, { posts: number; likes: number; comments: number; shares: number }> = {};

    posts.forEach((post: any) => {
      const day = new Date(post.created_at).toISOString().split("T")[0];
      if (!trends[day]) {
        trends[day] = { posts: 0, likes: 0, comments: 0, shares: 0 };
      }
      trends[day].posts++;
      // Note: We'd need to fetch engagement logs for each post to get accurate trends
    });

    return json(
      {
        trends,
        period: { start: startDate, end: new Date().toISOString(), days },
      },
      200,
      headers
    );
  } catch (error) {
    console.error("Trends fetch error:", error);
    return errorResponse("Failed to fetch trends", 500, origin);
  }
}

/**
 * Handle cron job to process scheduled posts from the queue
 */
async function handleCron(env: Env): Promise<Response> {
  if (!env.SUPABASE_SERVICE_ROLE_KEY) {
    return json({ error: "Not configured" }, 501);
  }

  try {
    const supabaseUrl = env.SUPABASE_URL || "https://jstojewashwoswsskwjk.supabase.co";
    const now = new Date().toISOString();

    // Get pending posts scheduled for now or earlier
    const res = await fetch(
      `${supabaseUrl}/rest/v1/post_queue?status=eq.pending&schedule_time=lte.${now}&limit=10&order=schedule_time.asc&select=*`,
      {
        headers: {
          apikey: env.SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
        },
      }
    );

    if (!res.ok) {
      return json({ error: "Failed to fetch queue" }, 500);
    }

    const postsToPost = await res.json() as any[];

    if (!postsToPost || postsToPost.length === 0) {
      return json({ processed: 0, message: "No posts to process" }, 200);
    }

    // Process each post
    let processed = 0;
    let failed = 0;

    for (const queuedPost of postsToPost) {
      try {
        // Post to platforms
        const results: PlatformPostResult[] = await Promise.all(
          queuedPost.platforms.map((platform: Platform) =>
            postToPlatform(platform, queuedPost.text, env, queuedPost.media_urls)
          )
        );

        // Update queue status
        const updateRes = await fetch(
          `${supabaseUrl}/rest/v1/post_queue?id=eq.${queuedPost.id}`,
          {
            method: "PATCH",
            headers: {
              apikey: env.SUPABASE_SERVICE_ROLE_KEY,
              Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ status: "posted", posted_at: now }),
          }
        );

        // Add to post history
        const historyRes = await fetch(`${supabaseUrl}/rest/v1/post_history`, {
          method: "POST",
          headers: {
            apikey: env.SUPABASE_SERVICE_ROLE_KEY,
            Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            user_id: queuedPost.user_id,
            text: queuedPost.text,
            platforms: queuedPost.platforms,
            media_urls: queuedPost.media_urls,
            results,
            created_at: now,
          }),
        });

        if (updateRes.ok && historyRes.ok) {
          processed++;
        } else {
          failed++;
        }
      } catch (error) {
        console.error("Failed to process queued post:", queuedPost.id, error);
        failed++;
      }
    }

    return json({ processed, failed, total: postsToPost.length }, 200);
  } catch (error) {
    console.error("Cron error:", error);
    return json({ error: "Cron failed" }, 500);
  }
}
