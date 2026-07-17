import type { PlatformPostResult, PlatformMetrics } from "../types";

const BSKY_PDS = "https://bsky.social";

interface BlueskySession {
  accessJwt: string;
  did: string;
}

/**
 * Create a Bluesky session using App Password auth.
 * App passwords are created at https://bsky.app/settings/app-passwords
 */
async function createSession(handle: string, appPassword: string): Promise<BlueskySession> {
  const res = await fetch(`${BSKY_PDS}/xrpc/com.atproto.server.createSession`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identifier: handle, password: appPassword }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Bluesky auth failed (${res.status}): ${err}`);
  }

  const data = (await res.json()) as { accessJwt: string; did: string };
  return { accessJwt: data.accessJwt, did: data.did };
}

/**
 * Post to Bluesky.
 * Requires BLUESKY_HANDLE and BLUESKY_PASSWORD (app password) in env/secrets.
 */
export async function postToBluesky(
  text: string,
  handle: string,
  appPassword: string,
  mediaUrls?: string[]
): Promise<PlatformPostResult> {
  try {
    const session = await createSession(handle, appPassword);

    const now = new Date().toISOString();
    const record: Record<string, unknown> = {
      $type: "app.bsky.feed.post",
      text,
      createdAt: now,
    };

    // TODO: Handle media uploads (images) via blob upload
    // Requires uploading to com.atproto.repo.uploadBlob first,
    // then referencing the blob in the record's embed.images array.

    const res = await fetch(`${BSKY_PDS}/xrpc/com.atproto.repo.createRecord`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.accessJwt}`,
      },
      body: JSON.stringify({
        repo: session.did,
        collection: "app.bsky.feed.post",
        record,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      return { platform: "bluesky", success: false, error: `Bluesky post failed: ${err}` };
    }

    const data = (await res.json()) as { uri: string; cid: string };
    // Convert at:// URI to https://bsky.app URL
    const postId = data.uri.split("/").pop() || data.cid;

    return {
      platform: "bluesky",
      success: true,
      postId,
      postUrl: `https://bsky.app/profile/${handle}/post/${postId}`,
    };
  } catch (e) {
    return {
      platform: "bluesky",
      success: false,
      error: e instanceof Error ? e.message : "Unknown Bluesky error",
    };
  }
}

/**
 * Read metrics for a Bluesky post.
 */
export async function getBlueskyMetrics(
  postUri: string,
  handle: string,
  appPassword: string
): Promise<PlatformMetrics> {
  try {
    const session = await createSession(handle, appPassword);

    // Get post thread with likes/reposts/replies
    const uri = encodeURIComponent(postUri);
    const res = await fetch(
      `${BSKY_PDS}/xrpc/app.bsky.feed.getPosts?uris=${uri}`,
      {
        headers: { Authorization: `Bearer ${session.accessJwt}` },
      }
    );

    if (!res.ok) {
      throw new Error(`Bluesky metrics failed: ${res.status}`);
    }

    const data = (await res.json()) as {
      posts: Array<{
        likeCount?: number;
        repostCount?: number;
        replyCount?: number;
      }>;
    };

    const post = data.posts?.[0];
    return {
      platform: "bluesky",
      likes: post?.likeCount ?? 0,
      shares: post?.repostCount ?? 0,
      comments: post?.replyCount ?? 0,
    };
  } catch {
    return { platform: "bluesky", likes: 0, shares: 0, comments: 0 };
  }
}
