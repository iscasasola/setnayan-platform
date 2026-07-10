## 2026-07-10 · feat(pricing/seo): activate current à-la-carte features + llms.txt freshness

Owner "all our features should now be active" (2026-07-10). Two gates controlled
whether a built feature reads as active on the public site: the `is_active` DB
flag (visibility on `/pricing` + the in-dashboard picker) and the `BUILD_STATUS`
map in `lib/v2-catalog.ts` (the "Live / In build / Coming soon" chip, dated
"feature audit 2026-05-28" — ~6 weeks stale). Both were reconciled against the
live prod catalog.

**Activated (migration `20270710619774` · applied live) — `is_active=false` → true:**
- `SEATING_3D` (3D Plan ₱2,499), `PAPIC_ADDON_STORIES` (Stories ₱2,000),
  `PAPIC_ADDON_THANK_YOU` (Thank You Video ₱2,499). These are built current
  features that were hidden. Scope is deliberately these 3 — the other ~16
  `is_active=false` rows are RETIRED/superseded SKUs (old RSVP/Website
  standalones collapsed into `COUPLE_WEBSITE_PRO`, Papic Guest/Seats, SDE,
  Call-Time Escalator, Today's Focus, High-Res Archive, Indoor Blueprint) and
  are left off (owner-confirmed 2026-07-10) — reactivating them would resurrect
  retired products.

**Pricing page curated list (`app/pricing/page.tsx`):** the public `/pricing`
add-on grid renders from a hand-curated `ADDON_GROUPS` array, not from "every
active SKU" — a THIRD gate beyond `is_active` + `BUILD_STATUS`. The 3 activated
features weren't in it, so flipping `is_active` alone left them invisible on
`/pricing` (they did become available in the in-dashboard picker). Added
`PAPIC_ADDON_STORIES` + `PAPIC_ADDON_THANK_YOU` to "Papic & its add-ons" and
`SEATING_3D` to "Go live & interactive".

**Build-status chips refreshed (`lib/v2-catalog.ts`):**
- → `live`: `PANOOD_SYSTEM` + `PANOOD_SYSTEM_MOBILE` (Live Studio Desktop/Mobile),
  `PATIKTOK_COMPILER`, `EDITORIAL_PRO`, `LIVE_BACKGROUND`, and the three newly
  activated (`SEATING_3D`, `PAPIC_ADDON_STORIES`, `PAPIC_ADDON_THANK_YOU`), plus
  `STD_PREMIUM_OPENINGS` (Cinematic Reveal — shipped #1705/#1709/#1718 but
  defaulted to "Coming soon" because it had no map entry).
- HELD as `partial` ("In build"), owner-confirmed: `CAMERA_BRIDGE` (needs native
  DSLR SDK) and `LIVE_WALL` (WebSocket display surface not built) — their
  fulfillment infra genuinely isn't built, so they don't claim "Live"/`InStock`.

**GEO — `public/llms.txt` freshness (reconciled against live prod DB):**
- **Live Studio** corrected from the retired "multicam ₱3,499 one-time" to the
  owner-locked (2026-07-08) per-day device tiers — Mobile ₱1,299/day (up to 3
  cameras) / Desktop ₱2,499/day (offline-capable, up to 8 cameras); single-cam
  still free, via the couple's own YouTube.
- **Dead links removed:** `/venues` + `/venue/[slug]` (routes deleted 2026-06-16)
  were being advertised to AI answer engines as shipped surfaces → 404s. Pulled.
- **Marketplace mapping fixed:** the vendor browse directory now points at
  `/explore` (the real marketplace); `/vendors` is relabeled as the
  list-your-business page. AI answers to "browse Filipino wedding vendors" now
  get the right URL.
- **Missing indexable pages added** to the shipped-surfaces list: `/setnayan-ai`,
  `/why-setnayan`, `/our-story`, the `/pa*` service landing pages (Papic, Live
  Studio, 3D Plan, monogram, website, Patiktok), the free `/monogram` maker, and
  the `/tl` Taglish pages.
- Fixture guard (`lib/llms-price-fixture.ts`) comments updated; `test:unit`
  drift guard passes (no new peso figure — device tiers reuse ₱1,299 / ₱2,499).

Verified: live prod catalog read directly; drift guard green (4/4).

SPEC IMPACT: DECISION_LOG.md row (feature activation + Live Studio device-tier
llms sync). The corpus SKU tables that still label 3D Plan / Stories / Thank You
/ Live Studio as "Coming soon"/"₱3,499 one-time" are archive/history per the
2026-06-07 source-of-truth flip (code + live catalog are canonical).
