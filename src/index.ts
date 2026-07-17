import { validateSupabaseJWT } from "./auth";
import type { PostRequest, PostResponse, PlatformPostResult, Platform } from "./types";
import { postToBluesky, getBlueskyMetrics } from "./platforms/bluesky";
import { postToLinkedIn, getLinkedInMetrics } from "./platforms/linkedin";
import { postToFacebook, getFacebookMetrics } from "./platforms/facebook";
import { postToInstagram, getInstagramMetrics } from "./platforms/instagram";
import { postToTikTok, getTikTokMetrics } from "./platforms/tiktok";
import { postToX, deleteFromX, getXMetrics } from "./platforms/x";

export interface Env {
  SUPABASE_JWT_SECRET: string;

  // Bluesky
  BLUESKY_HANDLE?: string;
  BLUESKY_PASSWORD?: string;

  // LinkedIn
  LINKEDIN_ACCESS_TOKEN?: string;
  LINKEDIN_AUTHOR?: string;

  // Facebook
  FACEBOOK_ACCESS_TOKEN?: string;
  FACEBOOK_PAGE_ID?: string;

  // Instagram
  INSTAGRAM_ACCESS_TOKEN?: string;
  INSTAGRAM_USER_ID?: string;

  // TikTok
  TIKTOK_ACCESS_TOKEN?: string;
  TIKTOK_OPEN_ID?: string;

  // X (Twitter) — OAuth 1.0a
  X_CONSUMER_KEY?: string;
  X_CONSUMER_KEY_SECRET?: string;
  X_ACCESS_TOKEN?: string;
  X_ACCESS_TOKEN_SECRET?: string;
  X_BEARER_TOKEN?: string; // for reading metrics

  // KV for rate limiting
  RATE_LIMITS: KVNamespace;
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

  // Rate limit: 30 posts per minute per user
  const rateKey = `rate:post:${user.sub}`;
  const current = parseInt((await env.RATE_LIMITS.get(rateKey)) ?? "0");
  if (current >= 30) {
    return errorResponse("Rate limit exceeded. Max 30 posts per minute.", 429, origin);
  }
  await env.RATE_LIMITS.put(rateKey, String(current + 1), { expirationTtl: 60 });

  // Post to each platform in parallel
  const results: PlatformPostResult[] = await Promise.all(
    body.platforms.map((platform) => postToPlatform(platform, body.text, env, body.mediaUrls, body.replyTo))
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
  replyTo?: string
): Promise<PlatformPostResult> {
  switch (platform) {
    case "bluesky": {
      if (!env.BLUESKY_HANDLE || !env.BLUESKY_PASSWORD) {
        return { platform, success: false, error: "Bluesky not configured" };
      }
      return postToBluesky(text, env.BLUESKY_HANDLE, env.BLUESKY_PASSWORD, mediaUrls);
    }

    case "linkedin": {
      if (!env.LINKEDIN_ACCESS_TOKEN || !env.LINKEDIN_AUTHOR) {
        return { platform, success: false, error: "LinkedIn not configured" };
      }
      return postToLinkedIn(text, env.LINKEDIN_ACCESS_TOKEN, env.LINKEDIN_AUTHOR);
    }

    case "facebook": {
      if (!env.FACEBOOK_ACCESS_TOKEN || !env.FACEBOOK_PAGE_ID) {
        return { platform, success: false, error: "Facebook not configured" };
      }
      return postToFacebook(text, env.FACEBOOK_ACCESS_TOKEN, env.FACEBOOK_PAGE_ID);
    }

    case "instagram": {
      if (!env.INSTAGRAM_ACCESS_TOKEN || !env.INSTAGRAM_USER_ID) {
        return { platform, success: false, error: "Instagram not configured" };
      }
      return postToInstagram(text, env.INSTAGRAM_ACCESS_TOKEN, env.INSTAGRAM_USER_ID, mediaUrls);
    }

    case "tiktok": {
      if (!env.TIKTOK_ACCESS_TOKEN || !env.TIKTOK_OPEN_ID) {
        return { platform, success: false, error: "TikTok not configured" };
      }
      return postToTikTok(text, env.TIKTOK_ACCESS_TOKEN, env.TIKTOK_OPEN_ID, mediaUrls);
    }

    case "x": {
      if (!env.X_CONSUMER_KEY || !env.X_CONSUMER_KEY_SECRET ||
          !env.X_ACCESS_TOKEN || !env.X_ACCESS_TOKEN_SECRET) {
        return { platform, success: false, error: "X (Twitter) not configured — OAuth 1.0a keys required" };
      }
      return postToX(text, env.X_CONSUMER_KEY, env.X_CONSUMER_KEY_SECRET,
        env.X_ACCESS_TOKEN, env.X_ACCESS_TOKEN_SECRET, replyTo);
    }

    default:
      return { platform, success: false, error: `Unknown platform: ${platform}` };
  }
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
