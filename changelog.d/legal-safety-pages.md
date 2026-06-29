## 2026-06-30 · feat(legal): compliance footer + policy pages + working cookie consent

Made the website legally safe to take payments and host user content. The
homepage's placeholder footer (three non-clickable text lines, zero compliance
links) is replaced with a real "crawl-in" footer carrying a dedicated Legal
column; the cookie pill now actually works.

- **Homepage footer** (`_components/home/HomeReskin.tsx` + `home-reskin.css`):
  new `HomeFooter` — brand block + Explore/Company/Legal columns + DPO contact,
  with an IntersectionObserver-driven crawl-in (translateY + staggered fade,
  reduced-motion safe). Legal column links Privacy · Terms · Refunds · Cookie
  policy · Acceptable use · Cookie settings.
- **Working cookie consent** (`lib/cookie-consent.ts`): single source of truth
  (localStorage + window events). The homepage `CookiePill` and a new site-wide
  `CookieConsentBanner` (mounted in `layout.tsx`, self-hides on `/`) both
  Accept / Decline / Manage and persist the choice. `posthog-provider.tsx` now
  GATES PostHog init on analytics consent — declined visitors never load the
  SDK; accepting activates it live. RA 10173 opt-in.
- **New policy pages**: `/refunds` (digital services final once activated, full
  refund if undelivered — RA 7394), `/cookies` (essential vs opt-in analytics,
  no ad cookies), `/acceptable-use` (prohibited content, always-on NSFW filter,
  reporting/takedown, enforcement). Shared `_components/legal/legal-chrome.tsx`.
- **Terms rewrite** (`/terms`): replaced the self-labeled "Starter draft" with
  full clauses — eligibility (18+), account, acceptable use, payments/refunds,
  content license, vendor rules, liability cap, suspension, **PH governing law +
  proper courts of the Philippines**, changes.
- **Shared marketing footer** (`_SiteFooter.tsx`): added a Legal row (Privacy ·
  Terms · Refunds · Cookie policy · Acceptable use · Cookie settings).
- **Sitemap**: added `/refunds` `/cookies` `/acceptable-use`; bumped
  `/privacy` + `/terms` lastmod.

Owner-decided this session: refunds = final-once-activated + full-refund-if-
undelivered · governing law = PH (generic, proper courts of the Philippines) ·
min account age = 18.

SPEC IMPACT: None (website legal pages + consent plumbing; no corpus SKU/schema
change). Decision-log row appended to corpus DECISION_LOG.md.
