# Competitor Feature Audit

Last updated: 2026-07-17

## Buffer

**Pricing:** Free → $5/channel/mo (Essentials) → $10/channel/mo (Team)
**Channels:** Bluesky, Facebook, Instagram, LinkedIn, Mastodon, Pinterest, Threads, TikTok, X, YouTube, Google Business

| Feature | Free | Paid | cnxt status |
|---|---|---|---|
| Cross-posting to multiple platforms | 3 channels | Unlimited | ✅ All 7 platforms |
| Post scheduling + calendar | 10 scheduled | Unlimited | ✅ API built, UI pending |
| Queue/refill posting | Yes | Yes | ❌ Not built |
| AI content assistant | Yes | Yes | ❌ Not built |
| Drafts | Unlimited | Unlimited | ❌ Not built |
| Content ideas board | 100 | Unlimited | ❌ Not built |
| Hashtag manager | ❌ | Yes | ❌ Not built |
| First comment scheduling | ❌ | Yes | ❌ Not built |
| Post analytics/insights | Basic | Advanced | ✅ API built |
| Community inbox (replies) | Yes | Yes | ✅ API built (Bluesky) |
| Team collaboration | ❌ | Team plan | ❌ Not planned |
| Content approval workflows | ❌ | Team plan | ❌ Not planned |
| Link-in-bio (Start Page) | ❌ | ❌ | ✅ Via cnxt-to-links |
| Mobile app | Yes | Yes | ✅ React Native scaffold |
| Browser extension | Yes | Yes | ❌ Not built |
| API access | 3K req/mo | 15K req/mo | ✅ Full API |
| Multi-profile per platform | Yes | Yes | ✅ Schema supports it |

## Hootsuite

**Pricing:** $99/mo (Standard) → $199/mo (Professional) → $399/mo (Advanced) → Enterprise
**Channels:** Instagram, Facebook, X, LinkedIn, TikTok, YouTube, Pinterest

| Feature | Notes | cnxt status |
|---|---|---|
| Unlimited post scheduling | All paid plans | ✅ API built |
| AI post/image generation | Wisdom AI in all plans | ❌ |
| Social inbox | Unified replies across platforms | ✅ API built |
| Brand monitoring | Paid plans | ❌ |
| Custom analytics reports | Professional+ | ✅ API built |
| Team collaboration | All plans | ❌ |
| Approval workflows | Advanced+ | ❌ |
| Automated inbox replies | Professional+ | ❌ |
| Trend forecasting (90-day) | Professional+ | ❌ |
| SSO / compliance | Enterprise | ❌ |

## Later

**Pricing:** $18.75/mo (Starter) → $37.50/mo (Growth) → $82.50/mo (Scale)
**Channels:** Instagram, Facebook, Threads, Pinterest, TikTok, LinkedIn, YouTube, Snapchat

| Feature | Notes | cnxt status |
|---|---|---|
| Visual calendar | Drag-and-drop scheduling | ❌ Need to build |
| Best Time to Post | AI-powered recommendations | ❌ |
| Smart Scheduling | Future trends | ❌ |
| AI content tools | Credit-based | ❌ |
| Social inbox | Growth+ | ✅ API built |
| Link in Bio | All plans | ✅ Via cnxt-to-links |
| Competitive benchmarking | Scale plan | ❌ |
| Brand health / mentions | Scale plan | ❌ |
| UGC collection | Growth+ | ❌ |
| Hashtag suggestions | Scale plan | ❌ |

---

## What cnxt-to-post already has

| Feature | Status |
|---|---|
| Cross-post to 7 platforms (Bluesky, X, LinkedIn, Facebook, Instagram, Threads, TikTok) | ✅ |
| Multi-profile per platform (personal + company pages) | ✅ Schema ready |
| Post scheduling API (POST /api/schedule, GET /api/scheduled) | ✅ |
| Replies API (GET /api/replies, POST /api/reply) | ✅ Bluesky |
| Metrics API (GET /api/metrics/:platform/:postId) | ✅ All platforms |
| Full REST API for third-party integration | ✅ |
| Mobile app (React Native / Expo) | ✅ Scaffold |
| Free (no credit card, no subscription) | ✅ |

## Priority gaps (what competitors have that we don't)

1. **Calendar UI** — visual scheduling calendar (Buffer/Later's main differentiator)
2. **AI content assistant** — generate/rewrite posts (every competitor has this now)
3. **Best time to post** — analytics-driven scheduling recommendations
4. **Hashtag suggestions** — per-platform hashtag recommendations
5. **Drafts / content library** — save and reuse posts
6. **First comment scheduling** — schedule the first comment (for Instagram hashtags)
