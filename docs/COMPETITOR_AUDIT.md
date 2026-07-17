# Competitor Feature Mapping

Targeted comparison of Buffer, Later, and cnxt-to-post — focused on features that matter to solo creators and small teams. AI features excluded by design.

Last updated: 2026-07-17

---

## Buffer

**Pricing:** Free (3 channels, 10 scheduled) → $5/ch/mo Essentials → $10/ch/mo Team
**Channels:** Bluesky, Facebook, Instagram, LinkedIn, Mastodon, Pinterest, Threads, TikTok, X, YouTube, Google Business (11)

### Feature breakdown

| Category | Feature | Free | Paid | Notes |
|---|---|---|---|---|
| **Publishing** | Cross-post to multiple platforms | 3 channels | Unlimited | Platform-specific customization per post |
| | Post scheduling + calendar | 10 scheduled | Unlimited | List view + calendar view |
| | Queue/refill posting | Yes | Yes | Auto-refill queue from content library |
| | Drafts | Unlimited | Unlimited | |
| | Browser extension | Yes | Yes | Share from any webpage |
| | First comment scheduling | No | Yes | Instagram hashtags in first comment |
| | Hashtag manager | No | Yes | Saved hashtag groups |
| | Thread scheduling (X) | Yes | Yes | Threaded posts in one editor |
| | Custom posting schedule per channel | Yes | Yes | Different times per platform per day |
| | Notification-based posting | Yes | Yes | For platforms that don't support auto-publish (Instagram Stories) |
| **Analytics** | Post metrics (likes, comments, shares) | Basic | Advanced | Per-post + aggregate |
| | Follower growth tracking | Yes | Yes | |
| | Audience demographics | No | Yes | |
| | Exportable reports | No | Yes | |
| | Benchmarks vs industry | No | Yes | |
| | "Takeaways" — plain-language insights | Yes | Yes | Actionable recommendations |
| **Community** | Unified inbox (replies + comments) | Yes | Yes | 10 platforms in one view |
| | Filters & sorting | Yes | Yes | Newest, oldest, unanswered |
| | Saved replies | Yes | Yes | Quick reply templates |
| | Comment score | Yes | Yes | Response rate, speed, consistency |
| | Notifications | Yes | Yes | |
| | Mobile replies | Yes | Yes | |
| **Organization** | Content ideas board | 100 ideas | Unlimited | Kanban-style |
| | Tags for content | 3 tags | 250 tags | |
| | Team collaboration | No | Team plan | |
| | Approval workflows | No | Team plan | |
| **Other** | Link-in-bio (Start Page) | Yes | Yes | |
| | Mobile app (iOS + Android) | Yes | Yes | |
| | API access | 3K req/mo | 15K req/mo | |
| | Integrations (Google Drive, Unsplash, etc.) | Yes | Yes | |

---

## Later

**Pricing:** $18.75/mo Starter → $37.50/mo Growth → $82.50/mo Scale
**Channels:** Instagram, Facebook, Threads, Pinterest, TikTok, LinkedIn, YouTube, Snapchat (8)

### Feature breakdown

| Category | Feature | Starter | Growth | Scale | Notes |
|---|---|---|---|---|---|
| **Publishing** | Visual calendar with drag-and-drop | Yes | Yes | Yes | Core differentiator |
| | Post scheduling | 30/profile | 180/profile | Unlimited | |
| | Multi-profile posting | 1 social set (8 profiles) | 2 sets (16) | 6 sets (48) | |
| | Auto-publish | Yes | Yes | Yes | |
| | Best Time to Post | 1 profile | Multi-profile | Multi-profile | Algorithmic recommendations |
| | Smart Scheduling (trends) | No | Yes | Yes | |
| **Content** | Media library | Yes | Yes | Yes | Organize images/videos |
| | Content creation tools | Yes | Yes | Yes | Edit media in-app |
| | UGC collection | No | Yes | Yes | Find & repost user content |
| | Link in Bio | Yes | Yes | Yes | Drive traffic to website/shop |
| **Analytics** | Platform analytics | 3 months | 1 year | 2 years | |
| | Custom reports | No | No | Yes | |
| | Competitive benchmarking | No | No | Yes | Compare vs competitors |
| | Brand health monitoring | No | No | Yes | Sentiment tracking |
| | Brand mentions | No | No | Yes | |
| | Future industry insights | No | No | Yes | Trend prediction |
| **Collaboration** | Internal collaboration | No | Yes | Yes | |
| | External approvals | No | Yes | Yes | |
| | Custom roles & permissions | No | Yes | Yes | |
| **Community** | Social inbox | No | Yes | Yes | Unified replies |
| **Other** | Mobile app | Yes | Yes | Yes | Instagram-first heritage |
| | Hashtag suggestions | No | No | Yes | |

---

## cnxt-to-post feature parity

### What we already match or exceed

| Feature | cnxt-to-post | Buffer | Later |
|---|---|---|---|
| Platforms supported | 7 (Bluesky, X, LinkedIn, Facebook, Instagram, Threads, TikTok) | 11 | 8 |
| Cross-posting | ✅ All at once | ✅ | ✅ |
| Post scheduling | ✅ API + calendar UI | ✅ | ✅ |
| Per-platform customization | ✅ Different text per platform through API | ✅ | ✅ |
| Post metrics | ✅ API for all 7 platforms | ✅ | ✅ |
| Replies | ✅ API for Bluesky, more coming | ✅ | ✅ |
| Multi-profile per platform | ✅ Schema supports it | ✅ | ❌ Limited |
| Mobile app | ✅ React Native scaffold | ✅ | ✅ |
| Full REST API | ✅ Free, unlimited | ✅ Rate-limited | ❌ No API |
| Link-in-bio | ✅ Via cnxt-to-links | ✅ | ✅ |
| Free tier | ✅ Unlimited, forever | 3 channels, 10 posts | No free tier |

### Priority gaps (what Buffer/Later have that we should build)

| Feature | Priority | Effort | Notes |
|---|---|---|---|
| **Drafts / content library** | High | Medium | Save posts, reuse later. Supabase table + simple UI. |
| **Queue posting** | High | Medium | Auto-post from queue on schedule. Worker cron + queue table. |
| **Hashtag manager** | Medium | Low | Save hashtag groups per platform. Simple KV or Supabase. |
| **First comment scheduling** | Medium | Low | Instagram/TikTok: schedule a comment with hashtags. |
| **Saved replies** | Medium | Low | Quick reply templates for community inbox. |
| **Best time to post** | Low | High | Requires analytics history — build after metrics are live. |
| **Media library** | Low | Medium | Upload/organize images and videos. Supabase Storage. |
| **Team collaboration** | Out of scope | — | Not needed for solo creators. |
| **AI features** | Out of scope | — | Intentionally excluded. |

---

## Key takeaway

Buffer and Later charge $5–$82/month for features that are mostly API calls and UI. cnxt-to-post already has the hard part done (multi-platform API integration, OAuth, scheduling infrastructure). The remaining gaps — drafts, queues, hashtag saving, saved replies — are all straightforward Supabase-backed features. None require external API keys or third-party services.
