## 2026-06-29 · feat(home): ELN-style homepage reskin ported to the live site

Replaced the homepage (`/`) UI with the owner-approved ELN-style reskin, ported
faithfully from the prototype `03_Strategy/Home_ELN_Reskin_2026-06-28.html`:

- Cool-greige design tokens (`#F2F2F0`/`#E9E7E2` bg · soft ink `#54514D` · gold
  `#C5A059`/`#97742f`), subtle liquid-glass nav, sans/serif/mono mapped to the
  already-loaded marketing fonts (Geist / Instrument Serif / JetBrains Mono).
  Scoped under `.home-reskin` / `.home-reskin-ov` so NO other surface changes —
  this intentionally overrides the warm-Alabaster + Instrument-Serif locks for
  the homepage only (owner sign-off 2026-06-29).
- No-scroll cinematic gate → unlock-on-"Learn more"; scroll-snap sections; the
  5-pillar dock (Ala Ala · Likhaan · Planuhan · Surian · Tiangge) swaps the hero
  photo + copy + Learn-more jump; logo = Home (re-locks the gate).
- Interactive per-pillar preview widgets (27 mocks, click-to-swap), drag/swipe
  feature carousel with center-snap, manifesto reveal, kinetic feelings ticker,
  Real Stories cards (→ `/realstories`).
- The four nav overlays (Prices · Download · Vendors · Sign in) as React, in a
  portal, with Esc/backdrop close + focus trap via `useModalA11y`.
- All navigation points at the REAL routes: Start planning → `/onboarding/wedding`,
  Sign in → `/login`, Download → `/download`, Vendors register → `/for-vendors`,
  Real Stories → `/realstories`, See full pricing → `/pricing`.
- **Prices overlay is CATALOG-DRIVEN, not hardcoded** — `getHomePricingData()`
  resolves every price from `platform_retail_catalog_v2` via
  `fetchV2CustomerCatalog` (lib/v2-catalog.ts); the Guests/Days slider recomputes
  per-day / per-guest-day lines off the catalog base rate. Setnayan AI shows the
  catalog price with the `/28 days` recurrence suffix. Falls back gracefully to
  literals only when a SKU isn't in the DB (CI build w/o service key).
- Suppressed the persistent `SiteChrome` top-nav on `/` (the reskin renders its
  own floating glass nav). Every other marketing route keeps the shared nav.
- **Sign in → the REAL auth at `/login`** (Google + Apple via `OAuthButtonRow`,
  the desktop loopback variant, and email/password — env-flag gated, identical
  to the live login). The prototype's mockup sign-in overlay was dropped — no
  dead `preventDefault` button. Both Google AND Apple are reachable.
- **Clean replacement — old homepage design fully REMOVED**, not just unimported.
  DELETED the now-orphaned homepage-design-only files (zero real importers across
  the whole repo, confirmed by grep): `_components/marketing/FeaturesNarrative.tsx`,
  `PostHeroReveal.tsx`, `SpotlightAwardsStrip.tsx`, `WhatYouGet.tsx`. The served
  homepage HTML contains ZERO old-design markup (no two-website flash). KEPT all
  shared infrastructure: `_sections.tsx` (Footer used by /about + /tl/about),
  `_premium.tsx` (motion hooks used by 13+ routes), `HeroVideoScrub.tsx` +
  `lib/hero-video.ts` (admin hero-video editor + still imported by _sections),
  `_SiteFooter.tsx` (15+ routes), `OurStory.tsx` (/our-story), the global nav,
  layout, providers.
- Preserved: homepage `generateMetadata`/SEO, the WebSite + SoftwareApplication
  JSON-LD graph, the cron-free admin morning-digest flush via `after()`, and
  `force-dynamic`.

New files: `app/_components/home/{HomeReskin,HomeOverlays,pillars,pricing-data,
vendor-benefits}.tsx` + `home-reskin.css`. Hero photos + the 26 widget mocks are
CSS gradient / element stand-ins (real desaturated event imagery + product
screenshots drop in later — handoff §7.2).

SPEC IMPACT: None (the reskin matches the prototype + copy SoT already in the
corpus; the prototype/handoff/copy docs are the design source of truth and are
unchanged by this code port). The homepage-overrides-warm-palette decision is
already logged in DECISION_LOG (2026-06-29) + the reskin memory note.
