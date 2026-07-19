## 2026-07-12 · chore(cleanup): page-layer hygiene sweep — delete 22 stranded old-generation files + 2 prototype routes

The 2026-07-12 page-layer audit (23-agent council + adversarial hardening pass) traced the
"multiple layers/skins under the page" feeling to one repeating pattern: each reskin/rewrite
(ELN homepage → HomeReskin · 2026-07-10 "Home IS the dashboard" · vendor Overview rebuild ·
admin IA consolidation) dropped the old surface's imports but left the files — and in two
cases the routes — behind. This PR removes everything the hardening pass proved dead
(zero static/dynamic/barrel/test importers, no co-located strandings, no config/sitemap/
middleware/nav references, no orphaned CSS or sole-consumer assets):

- **Marketing (old-under-new):** `HeroVideoScrub.tsx` (pre-reskin frame-scrub hero; homepage
  renders `HomeReskin` off `lib/background-videos.ts`) + `_fixtures.ts` (pre-reskin pilot
  mock data that the price-sync sweep kept mechanically editing).
- **Couple dashboard (12 orphans):** budget-countdown-header · event-meta-line ·
  auspicious-chip · concierge-banner · vendor-availability-intersection ·
  finalized-chip-strip · love-quote-of-the-day · ceremony-type-chip · ceremony-type-modal ·
  event-date-input · event-switcher (superseded by AccountSwitcher) · match-criteria-strip.
- **Vendor dashboard (4 orphans):** completed-events-card · journal-feature-card ·
  shortlist-radar-card · services-picker.
- **Prototype routes shipped to prod:** `/prototype/call` (superseded by the wired
  `thread-call-room`) + `/camera-move-preview` (engine productionized into the guest
  Stories builder). Dropped the dangling `camera-move-preview` reserved-slug entry.
- **Knock-ons:** deleted `lib/love-quotes.ts` (sole consumer removed); stripped dead
  `getShortlistRadar()` + `toggleVendorBackendCount()` server actions and their types from
  `vendor-dashboard/actions.ts`; rewrote the stale `[eventId]/loading.tsx` skeleton to
  mirror the current EventDashboard render order (hero → briefing → bento → journey rail →
  decisions → around-your-event); scrubbed 9 dangling doc-comment references.

Explicitly KEPT (live, verified): `lib/hero-video.ts` + `/admin/hero-video` (feed the
/login still image + admin Studio) · `/admin/background-videos` (feeds the production
homepage hero) · `/admin/demand`, `/admin/insights`, `/admin/marketing` (owner decisions
pending — wire/merge/redirect, never bare-delete).

SPEC IMPACT: None (code hygiene only; the audit + owner decisions are logged in the spec
corpus `DECISION_LOG.md` 2026-07-12 and memory).
