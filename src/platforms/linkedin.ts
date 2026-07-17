import type { PlatformPostResult, PlatformMetrics } from "../types";

const API_BASE = "https://api.linkedin.com/rest";

/**
 * Post to LinkedIn.
 * Requires LINKEDIN_ACCESS_TOKEN (OAuth 2.0 Bearer) and LINKEDIN_AUTHOR (person or organization URN).
 */
export async function postToLinkedIn(
  text: string,
  accessToken: string,
  author: string
): Promise<PlatformPostResult> {
  try {
    const body: Record<string, unknown> = {
      author,
      commentary: text,
      visibility: "PUBLIC",
      distribution: {
        feedDistribution: "MAIN_FEED",
        targetEntities: [],
        thirdPartyDistributionChannels: [],
      },
      lifecycleState: "PUBLISHED",
      isReshareDisabledByAuthor: false,
    };

    const res = await fetch(`${API_BASE}/posts`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Linkedin-Version": "202607",
        "X-Restli-Protocol-Version": "2.0.0",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const data = (await res.json()) as { id?: string; message?: string };

    if (!res.ok) {
      return {
        platform: "linkedin",
        success: false,
        error: `LinkedIn error ${res.status}: ${JSON.stringify(data)}`,
      };
    }

    // LinkedIn returns a URN like "urn:li:share:123456"
    const postId = data.id ?? "";
    const numericId = postId.split(":").pop() ?? postId;

    return {
      platform: "linkedin",
      success: true,
      postId: numericId,
      postUrl: `https://www.linkedin.com/feed/update/${postId}`,
    };
  } catch (e) {
    return {
      platform: "linkedin",
      success: false,
      error: e instanceof Error ? e.message : "Unknown LinkedIn error",
    };
  }
}

/**
 * Read metrics for a LinkedIn post.
 */
export async function getLinkedInMetrics(
  postUrn: string,
  accessToken: string
): Promise<PlatformMetrics> {
  try {
    // LinkedIn social metadata API
    const encodedUrn = encodeURIComponent(postUrn);
    const res = await fetch(
      `${API_BASE}/socialMetadata/${encodedUrn}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Linkedin-Version": "202607",
          "X-Restli-Protocol-Version": "2.0.0",
        },
      }
    );

    if (!res.ok) {
      throw new Error(`LinkedIn metrics failed: ${res.status}`);
    }

    const data = (await res.json()) as {
      likesSummary?: { totalLikes?: number };
      commentsSummary?: { totalComments?: number };
      sharesSummary?: { totalShares?: number };
      impressions?: number;
    };

    return {
      platform: "linkedin",
      likes: data.likesSummary?.totalLikes ?? 0,
      shares: data.sharesSummary?.totalShares ?? 0,
      comments: data.commentsSummary?.totalComments ?? 0,
      impressions: data.impressions ?? 0,
      clicks: 0,
    };
  } catch {
    return { platform: "linkedin", likes: 0, shares: 0, comments: 0 };
  }
}
