## 2026-07-02 · perf(web): homepage TTFB — pin function region, parallelize reads, cache spotlight gate

Root-cause fixes for the ~1.6–2.6s homepage TTFB found in the 2026-07-02 load-delay
sweep. Three independent, behavior-preserving changes:

- **Pin Vercel functions to `sin1` (Singapore)** — `vercel.json` had no `regions`
  key, so every serverless function defaulted to `iad1` (US-East/Virginia) while
  Supabase is in Singapore and users are in the Philippines. Each request
  round-tripped PH→US-East compute→Singapore DB→back (~200–250ms per DB hop,
  matching the confirmed `x-vercel-id: hkg1::iad1`). Colocating compute with the
  DB collapses that hop to ~1–5ms. Single region — no plan change required.
- **`Promise.all` the homepage's four data reads** (`app/page.tsx`) — they were
  four serial top-level `await`s (`getHomePricingData`, `getClientShell`,
  `fetchPublishedBackgroundVideos`, `fetchHomepageSpotlight`) with no dependency
  between them, stacking ~4 sequential round-trips onto TTFB on this never-edge-
  cached (`force-dynamic`) page. Now one wall-clock round-trip.
- **Cache the Spotlight gate** (`lib/spotlight-awards.ts`) — `fetchHomepageSpotlight`
  ran a live `platform_settings` query on every homepage render just to read a
  default-OFF feature flag, almost always returning `[]`. Wrapped in
  `unstable_cache` (60s revalidate + new `SPOTLIGHT_HOMEPAGE_TAG` for immediate
  admin bust).

Still-open follow-ups from the same sweep (separate PRs, different files): ISR /
drop `force-dynamic` (needs a prod-build verify), font-preload trim, homepage
client-island split, media `preload` tuning, service-worker precache of `/`.

SPEC IMPACT: None (infra/perf only — no product behavior, pricing, or schema change).
