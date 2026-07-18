# cnxt to post — API Reference

Base URL: `https://post.cnxt.to`

All endpoints require authentication via Supabase JWT. Your app gets this token when the user signs in through the shared cnxt auth system (`auth.cnxt.to`).

---

## Authentication

Include the Supabase access token in the `Authorization` header:

```
Authorization: Bearer <supabase-access-token>
```

**Getting a token in the browser:**
```js
const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const { data } = await supabase.auth.getSession();
const token = data.session?.access_token;
```

**Getting a token in a backend/script:**
Use the Supabase service role key to generate tokens, or have the user sign in via the OAuth flow and pass you their access token.

---

## Endpoints

### POST /api/post

Publish content to one or more social platforms simultaneously.

**Request:**
```json
{
  "platforms": ["bluesky", "linkedin", "x"],
  "text": "Hello world! This is my first cross-post.",
  "mediaUrls": ["https://example.com/photo.jpg"],
  "replyTo": "1883978684156510411"
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `platforms` | string[] | ✅ | Platforms to post to. Valid: `bluesky`, `x`, `linkedin`, `facebook`, `instagram`, `tiktok` |
| `text` | string | ✅ | Post content. Max varies by platform (300 chars safe for all) |
| `mediaUrls` | string[] | ❌ | Public URLs of images/videos to attach. Instagram requires at least one. |
| `replyTo` | string | ❌ | For X: tweet ID to reply to |

**Response (200):**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "postedAt": "2026-07-16T12:00:00.000Z",
  "results": [
    {
      "platform": "bluesky",
      "success": true,
      "postId": "3lbe2xz3zls2p",
      "postUrl": "https://bsky.app/profile/user.bsky.social/post/3lbe2xz3zls2p"
    },
    {
      "platform": "linkedin",
      "success": true,
      "postId": "urn:li:share:7234567890",
      "postUrl": "https://www.linkedin.com/feed/update/urn:li:share:7234567890"
    }
  ]
}
```

**Error responses:**
- `400` — Invalid body, missing platforms, or empty text
- `401` — Missing or invalid JWT
- `429` — Rate limit exceeded (30 posts/minute/user)

---

### GET /api/metrics/:platform/:postId

Retrieve engagement metrics for a previously published post.

**Path parameters:**
- `platform` — One of: `bluesky`, `x`, `linkedin`, `facebook`, `instagram`, `tiktok`
- `postId` — The platform-specific post ID returned when posting

**Example:**
```
GET /api/metrics/bluesky/3lbe2xz3zls2p
```

**Response (200):**
```json
{
  "platform": "bluesky",
  "likes": 42,
  "shares": 7,
  "comments": 12,
  "impressions": 1520,
  "clicks": 89
}
```

**Error responses:**
- `401` — Missing or invalid JWT
- `500` — Platform not configured on the server

---

### GET /health

Health check — no auth required.

**Response:** `200 OK` with body `ok`

---

## Platform-specific notes

### Bluesky
- Auth: App Password (create at bsky.app/settings/app-passwords)
- No API key registration needed
- Media: Upload via blob API before attaching to post

### X (Twitter)
- Auth: OAuth 1.0a (4 keys: consumer key/secret + access token/secret)
- **API is paid** — free tier limited to 1,500 posts/month
- BYOK: Users provide their own API keys
- Metrics use Bearer token (separate from OAuth 1.0a posting keys)

### LinkedIn
- Auth: OAuth 2.0 Bearer token
- Requires `Community Management API` product on your LinkedIn app
- Headers: `Linkedin-Version: YYYYMM`, `X-Restli-Protocol-Version: 2.0.0`

### Facebook Pages
- Auth: Page access token
- Permissions: `pages_manage_posts`, `pages_read_engagement`
- Graph API v25.0

### Instagram
- Auth: Same as Facebook (Meta app)
- **Requires Professional account** (Business/Creator) connected to a Facebook Page
- Two-step process: create media container → publish
- Rate limit: ~100 posts per 24 hours

### TikTok
- Auth: OAuth 2.0 via Login Kit
- **Content Posting API requires separate app review** by TikTok
- Only video posting supported (no text-only or image posts)

---

## Rate Limits

| Limit | Value |
|---|---|
| Posts per minute per user | 30 |
| Metrics reads per minute per user | 60 |

---

## Reusing this API

The cnxt-to-post API is designed to be called from any app — not just the official dashboard. Here's how to integrate it:

### From a web app
```js
const res = await fetch("https://post.cnxt.to/api/post", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${userAccessToken}`,
  },
  body: JSON.stringify({
    platforms: ["bluesky", "linkedin"],
    text: "Cross-posted from my app!",
  }),
});
const data = await res.json();
```

### From a Cloudflare Worker
```ts
const res = await fetch("https://post.cnxt.to/api/post", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${userJwt}`,
  },
  body: JSON.stringify({ platforms: ["bluesky"], text }),
});
```

### From Node.js
```js
const res = await fetch("https://post.cnxt.to/api/post", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${supabaseAccessToken}`,
  },
  body: JSON.stringify({ platforms: ["bluesky", "x"], text: "Hello!" }),
});
```

---

## Architecture

```
Your App / Dashboard
       │
       │ HTTPS + JWT
       ▼
┌─────────────────────┐
│  Cloudflare Worker   │  post.cnxt.to
│  src/index.ts        │
├─────────────────────┤
│  /api/post           │  → platforms/*.ts
│  /api/metrics        │  → platforms/*.ts
│  /health             │
├─────────────────────┤
│  Auth: Supabase JWT  │
│  Rate limit: KV      │
│  Secrets: env vars   │
└─────────────────────┘
       │
       ▼
┌──────────────────────────────────────┐
│         Platform APIs                 │
│  Bluesky  │ X │ LinkedIn │ Meta │ TikTok │
└──────────────────────────────────────┘
```
