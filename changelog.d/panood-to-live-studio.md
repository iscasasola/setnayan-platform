## 2026-07-23 · copy(brand): finish the "Panood" → "Live Studio" rename across the app UI

Owner 2026-07-23: the livestream feature was renamed to **Live Studio** (2026-06-29), but the rename had only reached the SKU title + `/pricing` — the app UI still displayed the old **"Panood"** everywhere. Completed the rename of the customer-facing display name to "Live Studio".

Swept ~60 user-visible strings: the Suite card label, nav/route labels, the `/studio/panood` page title, the day-of launch + galleries source cards, the editorial "Powered by" service labels, the home pillar (name + its `HomeReskin` `===` comparison, in lockstep) and its mockup captions, Our Story, About (EN + TL), alaala (prose + JSON-LD + FAQ), features (prose + SEO/OG/Twitter meta, EN + TL), how-it-works (EN + TL), the privacy YouTube-integration section, the help center, the onboarding + wizard labels, the site-editor card, the integrations registry, the offline-cache label, `real-weddings` service chips, and the Maya billing description.

The home pillar's subtitle (`role`) was already "Live Studio", so renaming its name would have read "Live Studio · Live Studio" — changed the subtitle to "Broadcast".

**Kept unchanged (internal):** the `/panood` URL/route, the `PANOOD_SYSTEM` SKU code, DB columns (`panood_watch_url`, `panoodEmbedUrl`), component/type/function names (`PanoodControlRoom`, `PanoodCameraRow`, `watchPanoodCameras`, …), all code comments, and test fixtures. Also left the keynote/prototype demo assets under `public/keynote` + `public/proto` (stale demo data, not the live app) and the legacy `lib/sku-catalog.ts` "Panood Daily/Annual Broadcast" tier names (a parallel catalog that doesn't match the current single Live-Studio SKU — flagged for a separate reconciliation). `public/llms.txt` already says "Live Studio".

Verified: `next lint` clean (one pre-existing warning) · all 2777 unit tests pass · `tsc --noEmit` clean.

SPEC IMPACT: None — display/brand copy only; no pricing/SKU/schema/route change (the SKU code + URL stay `PANOOD_SYSTEM` / `/panood`).
