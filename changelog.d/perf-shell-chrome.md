## 2026-07-02 · perf(shell): trim font preloads, parallelize layout reads, harden splash, stop SW precaching '/'

Root-shell / app-chrome first-paint cleanups from the 2026-07-02 load-delay sweep.
All behavior-preserving:

- **Font preloads** (`app/layout.tsx`, findings #5/#11/#12/#14) — added `preload:false`
  to the 7 monogram/script faces (Cinzel, Playfair, Great Vibes, Libre Caslon,
  Tangerine, Luxurious Script, Vidaloka). They render only in the Monogram Maker,
  never on public pages, but next/font was emitting a `<link rel=preload as=font>`
  for each into EVERY page's `<head>`. `preload:false` keeps them working
  (on-demand load + `display:swap`) while removing ~7 wasted font preloads from the
  site-wide first-paint path. (The 3 core + 4 v2.1 marketing faces stay preloaded to
  avoid FOUC; full scoping into nested layouts is a larger follow-up.)
- **Layout reads** (`app/layout.tsx`, findings #15/#30) — `getBrandSettings()` and
  `getNavSlotMap()` (both gate every page's render) now run via `Promise.all` instead
  of two serial awaits, so a cold-cache/post-revalidate request doesn't pay two
  sequential Singapore round-trips.
- **Cold-start splash** (`app/globals.css`, finding #21) — added `pointer-events:none`
  to the base `#sn-init-splash` rule so the aria-hidden splash can never intercept
  clicks / freeze the app shell beneath it, and shortened the CSS "stuck" failsafe
  from 4s → 1.5s (the JS fade normally completes by ~1.25s). App-shell only;
  homepage is unaffected (splash is `display:none` there).
- **Service worker** (`public/sw.js`, finding #26) — removed `'/'` from the install
  precache list. The homepage is force-dynamic / never-cached, so precaching it fired
  a second full-TTFB fetch of `/` right after first load. Offline navigation still
  falls back to the static `/offline.html`.
- **PostHog preconnect** (`app/layout.tsx`, finding #32) — dropped the speculative
  `<link rel=preconnect>` to the PostHog host (kept the cheap `dns-prefetch`). PostHog
  is consent-gated and never loads for most first-time visitors, so the preconnect
  just burned one of the browser's limited early connections.

Deferred to a separate build-verified PR (client-provider refactors that touch load-
bearing dashboard query-cache behavior): gate the IndexedDB persister + PostHog
Supabase-user resolution to authed surfaces (#17/#19), split the TanStack Query
provider out of the marketing bundle (#28), idle-defer the ~11 global client mounts
(#18). ISR / drop `force-dynamic` on the homepage also stays separate (needs a prod
build to verify against the build-time service-key path).

SPEC IMPACT: None (perf / infra only — no product behavior, pricing, or schema change).
