## Google Search Console — How to Submit

Each subdomain should be a separate URL-prefix property in GSC:
Go to Google Search Console
Click Add property → URL prefix
Enter each URL one at a time:
Property URL	Sitemap to submit
https://invoices.cnxt.to/	https://invoices.cnxt.to/sitemap.xml
https://links.cnxt.to/	https://links.cnxt.to/sitemap.xml
https://hire.cnxt.to/	https://hire.cnxt.to/sitemap.xml
https://auth.cnxt.to/	https://auth.cnxt.to/sitemap.xml
https://post.cnxt.to/	https://post.cnxt.to/sitemap.xml

Verify ownership (DNS TXT record via Cloudflare is easiest — Cloudflare can auto-verify)
After verification, go to Sitemaps → paste the sitemap URL → Submit
Deployment order
Deploy cnxt-to-auth to Cloudflare Pages as auth.cnxt.to
Deploy dashboard to Cloudflare Pages as post.cnxt.to
Deploy cnxt-to-post Worker via npx wrangler deploy (needs KV namespace created + SUPABASE_JWT_SECRET set)
Submit all sitemaps to GSC

Getting credentials


## Auth cheat sheet

| Platform | Auth | Complexity | Get Keys |
|---|---|---|---|
| X | OAuth 1.0a | Medium | [developer.x.com](https://developer.x.com/en/portal/dashboard) |
| LinkedIn | OAuth 2.0 Bearer | Low | [linkedin.com/developers](https://www.linkedin.com/developers/apps) |
| Instagram | Facebook OAuth | Medium | [developers.facebook.com](https://developers.facebook.com/apps) |
| Facebook | Facebook OAuth | Medium | [developers.facebook.com](https://developers.facebook.com/apps) |
| TikTok | OAuth 2.0 (Login Kit) | Medium | [developers.tiktok.com](https://developers.tiktok.com/apps) |
| Bluesky | App Password or OAuth 2.0 + DPoP | Low / High | [bsky.app/settings](https://bsky.app/settings/app-passwords) |
| YouTube | Google OAuth 2.0 | Low | [console.cloud.google.com](https://console.cloud.google.com/apis/credentials) |