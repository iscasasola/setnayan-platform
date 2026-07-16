# Creators public page

## 2026-07-16 · feat(marketing): public /creators storyteller page + pricing "Storytellers — Free" callout

The public marketing presence for Setnayan STORYTELLERS (owner-ratified word) —
the acquisition-side sibling of `/vendors`, pitching only what is SHIPPED in
the Creator Economy Adventure-Chapter slice.

- **`app/creators/page.tsx`** (new, + `_components/creator-story-hero.tsx`,
  `creator-story-sections.tsx`, `creators-motion.tsx`) — mirrors the /vendors
  marketing-page structure and Clean Editorial `--m-*` vocabulary (no new
  design system). Flow: photographic hero ("Everywhere else, they watch. Here,
  they book." — real repo asset `public/realstories/maria-juan-tagaytay.jpg`)
  → dark thesis strip (₱0 · yours · courted) → the wedge (a reel dead-ends; a
  Chapter carries the real, bookable event) → anatomy of a Chapter (dark
  signature: embed + shop-this-event vendor cards mock + audience layer) → why
  storytellers publish here (vendor discount offers · zero setup · monetization
  untouched · permanence · badge · Real Stories featuring) → who it's for
  (wedding / travel / event creators) → the one-breath band (owner-ratified
  copy verbatim) → CTA "Publish your story" → `/signup`. Static (no DB reads —
  storytellers are free, no SKU), WebPage + BreadcrumbList JSON-LD (no Offer
  nodes), brand OG card. Deliberately does NOT promise: audience promos on the
  Book button, tier names, per-booking earnings, or cash.
- **`app/pricing/page.tsx`** — a "Storytellers — Free" callout row above the
  vendor pointer (publish free · keep your own monetization · vendors court
  you with exclusive rates → `/creators`). Static copy outside the
  catalog-driven SKU tables, which are untouched.
- **Discoverability** — footer Company column gains "For storytellers" →
  `/creators` (reskin-footer.tsx, next to "For vendors"); `/creators` joins
  SiteChrome `NAV_ROUTES` (glass nav + footer), robots.ts `ALLOWED_PATHS`,
  sitemap-static.xml (lastmod 2026-07-16 · 0.8), and the middleware
  `APP_EXCLUDED_MARKETING_PATHS` brochure set (native shells skip it, same as
  /vendors).

SPEC IMPACT: Creator Economy — public marketing surface for the
Adventure-Chapter model per `Creator_Adventure_Chapter_Build_Plan_2026-07-16.md`
+ `Creator_Program_Council_Verdict_2026-07-15.md` (corpus). DECISION_LOG.md row
appended in the corpus (uncommitted, per direct-edit authorization).
