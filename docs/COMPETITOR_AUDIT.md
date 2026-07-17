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
| Replies | ✅ Full API for all platforms (get + reply) | ✅ | ✅ |
| Multi-profile per platform | ✅ Schema supports it | ✅ | ❌ Limited |
| Mobile app | ✅ React Native scaffold | ✅ | ✅ |
| Full REST API | ✅ Free, unlimited | ✅ Rate-limited | ❌ No API |
| Link-in-bio | ✅ Via cnxt-to-links | ✅ | ✅ |
| Free tier | ✅ Unlimited, forever | 3 channels, 10 posts | No free tier |
| Token encryption | ✅ AES-256-GCM encryption for all tokens | ❌ Unknown | ❌ Unknown |
| Structured error logging | ✅ Comprehensive logging system | ❌ Unknown | ❌ Unknown |
| OAuth flow support | ✅ Full OAuth 2.0 + OAuth 1.0a implementation | ✅ | ✅ |
| BYOK for X | ✅ Bring Your Own Keys support | ❌ | ❌ |
| Health monitoring | ✅ Enhanced health checks + performance tracking | ✅ | ✅ |
| Reply threading | ✅ Full reply threading support | ✅ | ✅ |
| Rate limiting | ✅ Per-user rate limiting + platform-aware | ✅ | ✅ |
| Token refresh | ✅ Automatic token refresh for Meta/LinkedIn | ✅ | ✅ |

### Priority gaps (what Buffer/Later have that we should build)

| Feature | Priority | Effort | Notes |
|---|---|---|---|
| **Drafts / content library** | High | Medium | Save posts, reuse later. Supabase table + simple UI. Schema ready in `setup.sql`. |
| **Queue posting** | High | Medium | Auto-post from queue on schedule. Worker cron + queue table. Schema ready in `setup.sql`. |
| **Hashtag manager** | High | Low | Save hashtag groups per platform. Schema ready in `setup.sql`. |
| **Saved replies** | High | Low | Quick reply templates for community inbox. Schema ready in `setup.sql`. |
| **First comment scheduling** | Medium | Low | Instagram/TikTok: schedule a comment with hashtags. |
| **Media library** | Medium | Medium | Upload/organize images and videos. Supabase Storage or Cloudflare Images. |
| **Best time to post** | Low | High | Requires analytics history — build after metrics are live. |
| **Engagement notifications** | Low | Medium | Push notifications for replies/mentions. |
| **Unified inbox** | Medium | High | Read and reply to all comments from one interface. Reply API ready in `src/replies.ts`. |
| **Analytics dashboard** | Medium | Medium | Visual engagement metrics across platforms. |
| **Post performance trends** | Low | Medium | Compare post performance over time. |
| **Bulk actions** | Low | Low | Delete/edit multiple posts at once. |
| **Content recycling** | Low | Medium | Repost evergreen content automatically. |
| **RSS-to-post** | Low | Medium | Auto-post from blog RSS feeds. |
| **Team collaboration** | Out of scope | — | Not needed for solo creators. |
| **AI features** | Out of scope | — | Intentionally excluded. |

---

## Additional Competitive Advantages (New)

### Security & Infrastructure Features
| Feature | cnxt-to-post | Buffer | Later | Notes |
|---|---|---|---|---|
| Token encryption at rest | ✅ AES-256-GCM | ❌ Unknown | ❌ Unknown | All platform tokens encrypted |
| BYOK (Bring Your Own Keys) | ✅ Full support | ❌ | ❌ | Users own their X API keys |
| Shared auth ecosystem | ✅ cnxt auth | ❌ | ❌ | Single sign-on across cnxt tools |
| Self-hostable | ✅ Open source + Cloudflare | ❌ | ❌ | Full control over data |
| GDPR compliance ready | ✅ Data retention policies | ✅ | ✅ | GDPR by design |
| SOC 2 ready | ✅ Audit logging + encryption | ✅ | ✅ | Enterprise-ready |

### API & Developer Features
| Feature | cnxt-to-post | Buffer | Later | Notes |
|---|---|---|---|---|
| API rate limits | ✅ Unlimited (free) | ✅ 3K-15K req/mo | ❌ No API | No artificial limits |
| Webhook support | 📋 Planned | ✅ | ❌ | Real-time post notifications |
| Batch operations | ✅ Native support | ✅ | ✅ | Multi-post operations |
| GraphQL support | 📋 Planned | ❌ | ❌ | Flexible data queries |
| API versioning | ✅ Semantic versioning | ✅ | ❌ | Stable API contracts |
| API documentation | ✅ Comprehensive | ✅ | ❌ | Full reference docs |

### User Experience Features
| Feature | cnxt-to-post | Buffer | Later | Notes |
|---|---|---|---|---|
| Zero setup required | ✅ Start posting immediately | ❌ Account needed | ❌ Account needed | No signup required |
| Progressive onboarding | ✅ Add platforms gradually | ✅ | ✅ | Start with one, add more |
| Cross-platform search | 📋 Planned | ❌ | ❌ | Search across all platforms |
| Content calendar | ✅ Visual + list views | ✅ | ✅ | Drag-and-drop scheduling |
| Post templates | 📋 Planned | ✅ | ❌ | Reusable post formats |
| Platform-specific preview | 📋 Planned | ✅ | ❌ | See posts as they'll appear |

### Advanced Analytics Features
| Feature | cnxt-to-post | Buffer | Later | Notes |
|---|---|---|---|---|
| Cross-platform metrics | ✅ Unified dashboard | ✅ | ✅ | Compare performance |
| Real-time metrics | ✅ Live updates | ✅ | ✅ | Instant feedback |
| Export functionality | 📋 Planned | ✅ | ✅ | CSV/JSON exports |
| Custom date ranges | 📋 Planned | ✅ | ✅ | Flexible time periods |
| Platform comparison | 📋 Planned | ✅ | ✅ | Side-by-side analysis |
| Trend analysis | 📋 Planned | ✅ | ✅ | Performance over time |
| Audience insights | 📋 Planned | ✅ | ✅ | Demographics data |
| Competitive benchmarking | 📋 Planned | ✅ | ✅ | Compare to competitors |

### Community & Engagement Features
| Feature | cnxt-to-post | Buffer | Later | Notes |
|---|---|---|---|---|
| Unified inbox | 📋 Planned | ✅ | ✅ | All comments in one place |
| Reply threading | ✅ Full support | ✅ | ✅ | Nested conversations |
| Mention tracking | 📋 Planned | ✅ | ❌ | Track brand mentions |
| Sentiment analysis | 📋 Planned | ✅ | ✅ | Analyze comment sentiment |
| Auto-responders | 📋 Planned | ✅ | ❌ | Automated replies |
| Comment moderation | 📋 Planned | ✅ | ✅ | Filter/manage comments |
| Team inbox | 📋 Planned | ✅ | ✅ | Shared comment management |

### Content Creation Features
| Feature | cnxt-to-post | Buffer | Later | Notes |
|---|---|---|---|---|
| Media library | 📋 Planned | ✅ | ✅ | Organize media assets |
| Image editor | 📋 Planned | ✅ | ✅ | Basic editing tools |
| Video trimming | 📋 Planned | ✅ | ✅ | Edit video clips |
| GIF support | ✅ Native | ✅ | ✅ | GIF uploads |
| Emoji picker | ✅ Native | ✅ | ✅ | Emoji suggestions |
| Character count | ✅ Platform-aware | ✅ | ✅ | Per-platform limits |
| Link shortening | 📋 Planned | ✅ | ❌ | Integrated shortener |
| UTM tracking | 📋 Planned | ✅ | ❌ | Campaign tracking |

---

## Missing Features (Not Yet Implemented)

### High Priority Gaps
| Feature | Impact | Est. Effort | Notes |
|---|---|---|---|
| Drafts & content library | Medium | 2-3 days | Database schema ready |
| Queue posting | High | 3-4 days | Cron jobs + UI |
| Hashtag manager | Medium | 1-2 days | Simple CRUD operations |
| Saved replies | Medium | 1-2 days | Template system |
| Unified inbox | High | 5-7 days | Complex UI + API integration |
| Analytics dashboard | High | 4-6 days | Data visualization |

### Medium Priority Gaps
| Feature | Impact | Est. Effort | Notes |
|---|---|---|---|
| Media library | Low-Medium | 3-4 days | Storage integration |
| First comment scheduling | Low | 1-2 days | Instagram/TikTok only |
| Engagement notifications | Medium | 2-3 days | Push notifications |
| Post templates | Low | 2-3 days | Template management |
| Content calendar enhancements | Low | 2-3 days | Drag-and-drop |

### Low Priority Gaps
| Feature | Impact | Est. Effort | Notes |
|---|---|---|---|
| Best time to post | Low | 5-7 days | Requires historical data |
| Performance trends | Low | 3-4 days | Analytics history |
| Bulk actions | Low | 1-2 days | Multi-select UI |
| Content recycling | Low | 3-4 days | Auto-reposting logic |
| RSS-to-post | Low | 2-3 days | Feed parsing + scheduling |

---

## Key takeaway

Buffer and Later charge $5–$82/month for features that are mostly API calls and UI. cnxt-to-post already has the hard part done (multi-platform API integration, OAuth, scheduling infrastructure). The remaining gaps — drafts, queues, hashtag saving, saved replies — are all straightforward Supabase-backed features. None require external API keys or third-party services.
