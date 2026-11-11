## 2026-11-11 · feat(features): /features becomes the v3 story — chapters per persona, live moments, every register row (Build 6 Lane M part 3)

Owner, 11 Nov: *"Much better"* → the live /features gets built from it → *"Yes"* (DECISION_LOG "FEATURES PAGE v3 — APPROVED"; spec corpus `prototypes/features_page_2026-11-11/index-v3.html` + `v3_data.py`).

The shipped hub was extended, not replaced (`app/features/_PageBody.tsx` and its sections). In English:

- **Hero:** a full-bleed photo, the persona's own headline and line, and the "I am" pick (Hosts and couples · Guests · Suppliers · Coordinators), kept in the URL hash (`/features#suppliers`). One `<h1>`, holding the chosen persona's title.
- **The story:** numbered chapters per persona (eyebrow · headline · paragraph · live moment · rows), photo strips between them from the repo's own `public/marketing/` renders (no base64).
- **Live moments** (`_story-sample-moments.tsx` — a sample event, named so the Root map reads its figures as a sample): the v3 CSS/SVG app screens (palette → Hub, RSVP + seats + monogram, supplier chat, Hub on the day + Papic, Memories, guest pass, shop, service card row, payment plan, reviews + analytics, run of show, the family timeline). They start when they scroll into view; under "reduce motion" each is drawn finished.
- **Rows:** every FEATURE_REGISTER row ✅ + 🔵 + 💡 for roles A–D (A 73 · B 16 · C 42 · D 6) plus the rows from 11 Nov rulings. Each row's ⓘ is the house `<Explain>` (one ⓘ app-wide) and says Problem → Solution → Why (DRAFT copy, kept in ONE typed module, `lib/features-page.ts`). The "I am" and "Compare" picks are the app's `PickMenu`. Planned rows wear a "Coming" chip and a dashed icon, and their ⓘ names the lane or ruling. A row with its own feature page links to it, so the hub still links every `/features/<slug>` page (the rest via the connect band).
- **"Nothing is typed twice"** (the ecosystem band, restyled) · **Plans compare** (Event plans / Supplier plans) whose prices are read from `platform_retail_catalog_v2` and `vendor_billing_catalog` through the hub's one reader (`readFeatureCatalogue` + `resolveFeaturePrice`) — no peso typed, "See pricing" when unreadable · **the close** with two equal buttons (Start planning · Open a shop).
- `/features` joins `DOORWAY_BLEED_PATHS` so the photo hero runs edge to edge; every section keeps its own ≥16 px gutters and 1200 px cap.

Taglish (`/tl/features`) keeps the shipped groups until the rows are written in Taglish; it gets the restyled connect band and close.

Copy changed from v3, each forced by a house guard: Kwento → Photo Notes · Samahan → Groups · "proposal" → quote / suggested times · "Payday" → Money in · "On the Day" → The Day · no "lock" in couple-read copy · "celebration(s)" → "event(s)" · "website"/"site" → "page"/"Event Hub"; the RSVP moment's "Maybe" chip reads "Not yet" (guests cannot answer Maybe); v3's bottom sheet and raw selects became the house Explain and PickMenu; the hero photo's alt describes the photo actually in the repo. v3's unplaced `aireply` row (merged into C31 in its own review notes) is not ported.

Guards: new `lib/features-page-rows-keep-their-status.test.ts` — every row's status pinned, planned rows name their lane, register coverage whole, the painted page draws "Coming" exactly where planned, no typed price / house words (mutation-checked: a flipped status, a dropped chip, a typed peso each turn it red). `the-public-page-shows-no-internals.test.ts` now paints the whole story and every ⓘ sheet. `features-tagging`, `supplier-plan-table-tells-the-truth` (no-select) and `one-shell-mount` (a bleed path may live in a route group) updated to the new sections; `lib/ugat/screens.generated.json` regenerated.

Proof: `docs/proof/features-v3-2026-11-11/` — Now beside Proposed at 320 · 375 · 390 · 1280, light and dark; gutters 16/16 and no horizontal overflow at every width (`measure.json`).

SPEC IMPACT: None — builds the approved prototype. Open for the owner (unchanged from the corpus README): the Problem → Solution wording, and E-Gifts vs Pabuya.
