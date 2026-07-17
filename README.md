# cnxt to post

**Compose once, publish everywhere.** Free cross-posting to Bluesky, LinkedIn, Facebook, Instagram, TikTok, and X — from a single dashboard or API.

Schedule services like Buffer and Hootsuite charge $6–$99/month. Individual platform apps make you copy-paste between tabs. cnxt to post lets you write once and publish to every platform simultaneously — for free — with your own API keys.

---

## Why

Posting the same update across platforms shouldn't require six different apps or a monthly subscription. Each platform's API is well-documented and mostly free. The only hard part is wiring them all together.

cnxt to post does that wiring once, exposes it as a simple REST API, and gives you a clean dashboard on top. Use the hosted version for free, or call the API from your own apps.

## Supported Platforms

| Platform | Post | Read Metrics | API Cost |
|---|---|---|---|
| 🦋 Bluesky | ✅ | ✅ | Free |
| 𝕏 X (Twitter) | ✅ | ✅ | Paid (BYOK or credits) |
| 💼 LinkedIn | ✅ | ✅ | Free |
| 📘 Facebook | ✅ | ✅ | Free |
| 📸 Instagram | ✅ | ✅ | Free |
| 🎵 TikTok | ✅ | ✅ | Free |
| ▶️ YouTube | 📋 Planned | 📋 Planned | Free |

## Architecture

```
┌──────────────────────────────────────┐
│  Dashboard (Cloudflare Pages)         │  post.cnxt.to
│  Compose · History · Accounts · API   │
├──────────────────────────────────────┤
│  Worker API (Cloudflare Workers)      │
│  POST /api/post                       │
│  GET  /api/metrics/:platform/:postId  │
├──────────────────────────────────────┤
│  Auth: Supabase JWT (shared cnxt)     │
│  Rate limiting: Cloudflare KV         │
├──────────────────────────────────────┤
│  Platform Adapters                    │
│  Bluesky · X · LinkedIn · Facebook    │
│  Instagram · TikTok                   │
└──────────────────────────────────────┘
```

## Quick Start

### Use the hosted dashboard

Visit [post.cnxt.to](https://post.cnxt.to), sign in with your cnxt account, connect your social profiles, and start cross-posting.

### Call the API from your own app

```js
const res = await fetch("https://post.cnxt.to/api/post", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${userSupabaseJwt}`,
  },
  body: JSON.stringify({
    platforms: ["bluesky", "linkedin"],
    text: "Hello from my app!",
  }),
});
```

Full API reference: [API_REFERENCE.md](./API_REFERENCE.md)

### Deploy your own

```bash
git clone https://github.com/ah8571/cnxt-to-post
cd cnxt-to-post
npm install
npx wrangler kv:namespace create RATE_LIMITS   # copy ID to wrangler.toml
npx wrangler secret put SUPABASE_JWT_SECRET     # from Supabase dashboard
npx wrangler secret put BLUESKY_HANDLE          # per-platform secrets
npx wrangler deploy
```

## X / Twitter Pricing

X is the only platform that charges for API access. Two options:

- **BYOK (free):** Bring your own X API keys from developer.x.com. You pay X directly, we never touch your keys.
- **Credits (convenience):** Prepaid credits for occasional posters who don't want to manage API keys.

All other platforms are free via their standard APIs.

## Project Structure

```
cnxt-to-post/
├── src/                    # Cloudflare Worker (TypeScript)
│   ├── index.ts            # Main router, auth, rate limiting
│   ├── auth.ts             # Supabase JWT validation
│   ├── types.ts            # Shared types
│   └── platforms/          # Per-platform adapters
│       ├── bluesky.ts
│       ├── x.ts            # OAuth 1.0a via Web Crypto
│       ├── linkedin.ts
│       ├── facebook.ts
│       ├── instagram.ts
│       └── tiktok.ts
├── dashboard/              # Web UI (Cloudflare Pages)
│   ├── index.html
│   ├── css/style.css
│   └── js/dashboard.js
├── social/                 # Standalone Node.js scripts
│   ├── *-post.mjs          # Posting per platform
│   ├── *-metrics.mjs       # Metrics per platform
│   └── auth/               # Auth flows per platform
├── API_REFERENCE.md         # Full API documentation
├── docs/                    # Additional documentation
│   ├── SOCIAL_API_REFERENCE.md  # Per-platform API cheat sheet
│   ├── ROADMAP.md               # Development roadmap
│   └── To do's.md
└── wrangler.toml            # Cloudflare Worker config
```

## License

GNU General Public License v3.0 — see [LICENSE](./LICENSE).

---

Part of the [cnxt](https://cnxt.to) ecosystem — free tools for creators and freelancers.
