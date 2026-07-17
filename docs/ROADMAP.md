# cnxt to post — Development Roadmap

Free, open cross-posting tool. Compose once, publish everywhere. Read metrics across platforms from a single dashboard.

---

## North Star

A user connects their social accounts once, then posts to any combination of platforms from a single interface — with unified metrics and no per-platform subscription fees. X/Twitter is the only platform that charges for API access, so it gets a hybrid model (see below). Everything else is free.

---

## Platform Support Matrix

| Platform | Post | Read Metrics | Login | API Cost |
|---|---|---|---|---|
| Bluesky | ✅ scripted | ✅ scripted | ✅ scripted | Free |
| Facebook Pages | ✅ scripted | ✅ scripted | ✅ scripted | Free |
| Instagram (Pro) | ✅ scripted | ✅ scripted | ✅ scripted | Free |
| LinkedIn | ✅ scripted | ✅ scripted | ✅ scripted | Free |
| TikTok | ✅ scripted | ✅ scripted | ✅ scripted | Free |
| X (Twitter) | ✅ scripted | ✅ scripted | ✅ scripted | **Paid** (see below) |

Existing scripts live in `social/`:
- `*-post.mjs` — posting per platform
- `*-metrics.mjs` — reading engagement metrics
- `*-auth.mjs` — OAuth flows per platform
- `auth/auth-utils.mjs` — shared auth helpers

---

## X / Twitter Cost Strategy

X API v2 is not free. The free tier is heavily rate-limited (1,500 posts/month, 100 reads/month). Paid tiers: Basic ~$100/mo, Pro ~$5,000/mo.

**Two paths for users:**

### Path A: Bring Your Own Keys (BYOK) — Free
- User provides their own X API keys from developer.x.com
- Keys are encrypted at rest, never shared
- User gets whatever tier they've paid X for directly
- cnxt doesn't intermediate — your keys, your rate limits, your bill
- Works even on X's free tier for light usage

### Path B: Prepaid Credits — Convenience
- User buys credits (e.g., $5 for 500 posts)
- cnxt pools API access through a shared X API subscription
- No developer portal setup required — just connect your X account via OAuth
- Credit pricing transparently reflects X's API costs plus a small platform fee
- Unused credits don't expire (or have generous timeframes)
- Ideal for users who post occasionally and don't want to manage API keys

Both paths coexist. BYOK is always available as the zero-cost option. Credits are for convenience.

---

## Architecture

```
┌──────────────────────────────────────────────┐
│                 Dashboard UI                  │
│         (Cloudflare Pages, like links)        │
├──────────────────────────────────────────────┤
│              Cloudflare Worker API            │
│   Wraps social/*.mjs scripts as HTTP endpoints│
├──────────────────────────────────────────────┤
│              Supabase (shared)                │
│   Auth · User profiles · Platform tokens      │
│   Credit balances · Post history              │
├──────────────────────────────────────────────┤
│         Platform APIs (external)              │
│   X · Bluesky · LinkedIn · Meta · TikTok      │
└──────────────────────────────────────────────┘
```

---

## Phases

### Phase 1 — Core API (current → next)

**Goal:** Turn the existing `.mjs` scripts into a deployable API.

- [ ] Cloudflare Worker that wraps `social/*.mjs` as HTTP endpoints
- [ ] `POST /api/post` — post to one or more platforms
- [ ] `GET /api/metrics/:platform/:id` — read metrics for a post
- [ ] Platform token storage in Supabase (encrypted at rest)
- [ ] Rate limiting per user per platform
- [ ] `wrangler.toml` with routes, secrets, and KV bindings

### Phase 2 — Auth & Account Linking

**Goal:** Users connect their social accounts through the shared cnxt auth system.

- [ ] Centralized login via shared Supabase auth (auth.cnxt.to)
- [ ] OAuth flow per platform surfaced through the API
- [ ] Token refresh handling (Meta tokens expire every 60 days, etc.)
- [ ] Platform connection status in user profile
- [ ] BYOK key entry and validation for X

### Phase 3 — Dashboard UI

**Goal:** A web interface to compose, schedule, and review posts.

- [ ] Compose view — write once, select target platforms
- [ ] Platform preview — see how the post will look on each platform
- [ ] Post history — list of past posts with per-platform status
- [ ] Metrics dashboard — aggregated engagement across platforms
- [ ] Credit balance display (for X credit users)
- [ ] Mobile-responsive, similar design language to links dashboard

### Phase 4 — Credits & Monetization

**Goal:** Optional prepaid credits for X posting.

- [ ] Credit purchase flow (Stripe payment link or similar)
- [ ] Credit balance tracking in Supabase
- [ ] Per-post credit deduction for X
- [ ] Low-balance warnings
- [ ] Usage history and receipts

### Phase 5 — Advanced Features

**Goal:** Differentiators that make cnxt-to-post better than alternatives.

- [ ] Post scheduling (queue posts for future date/time)
- [ ] Thread support — auto-split long posts into X threads
- [ ] Cross-platform thread mapping (X thread → LinkedIn carousel, etc.)
- [ ] Hashtag suggestions per platform
- [ ] Best-time-to-post analytics
- [ ] RSS/Atom feed → auto-post (connect a blog, post when new content)
- [ ] Recurring posts (e.g., weekly promo tweet)

---

## Pricing Philosophy

| Feature | Cost |
|---|---|
| All platforms except X | Free |
| X via BYOK | Free |
| X via credits | Pay-as-you-go (~$0.01/post, subject to X API pricing) |
| Post scheduling | Free |
| Metrics dashboard | Free |
| API access (for devs) | Free with rate limits |

The only thing that costs money is X API access — and you can avoid that entirely by bringing your own keys. Display ads on the dashboard may help cover infrastructure costs for free-tier users.

---

## Current Status

| Component | Status |
|---|---|
| Per-platform post scripts | ✅ Done (`social/*-post.mjs`) |
| Per-platform metrics scripts | ✅ Done (`social/*-metrics.mjs`) |
| Per-platform auth scripts | ✅ Done (`social/*-auth.mjs`, `social/auth/*.mjs`) |
| API reference docs | ✅ Done (`SOCIAL_API_REFERENCE.md`) |
| Cloudflare Worker API | ❌ Not started |
| Dashboard UI | ❌ Not started |
| Central auth integration | ❌ Not started |
| Credit system | ❌ Not started |

---

## Tech Stack

- **API:** Cloudflare Workers (TypeScript)
- **Auth:** Supabase (shared across cnxt ecosystem)
- **Dashboard:** Cloudflare Pages, vanilla JS/TS or lightweight framework
- **Storage:** Supabase (user data, tokens, post history)
- **Secrets:** Cloudflare Worker secrets (platform API keys, encryption keys)
- **Credits/Payments:** Stripe Payment Links or Stripe Checkout
