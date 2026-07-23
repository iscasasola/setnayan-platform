## 2026-07-23 · feat(live-studio): Live Studio Roam SKU + Suite tile (flag-dark, ₱3,500/day)

The Roam catalog SKU + Studio/Suite tile — owner-priced ₱3,500/day (Cast is
₱2,500/day). All dark until launch.

- **Migration `20270919479280_live_studio_roam_sku.sql`** — seeds `LIVE_STUDIO_ROAM`
  into `platform_retail_catalog_v2` at ₱3,500/day, `billing_period='per_day'`,
  **`is_active=FALSE`** (the reader filters `is_active=true`, so it's not on
  `/pricing` and not sellable yet — the legitimate not-yet-launched state). Price
  recorded now; owner flips `is_active=TRUE` + the flag at launch.
- **`lib/add-ons-catalog.ts`** — relabel the existing tile `Live Studio` →
  **`Live Studio Cast`** (two variants now); add the **`Live Studio Roam`** tile,
  **flag-gated**: appended to `ADD_ONS` only when
  `NEXT_PUBLIC_LIVE_STUDIO_ROAM_ENABLED` is on. No dedicated `/studio` page → opens
  the generic App Store detail.
- **`lib/add-ons-detail.ts`** — Roam's App Store detail content (result-framed
  voice, no mechanics), also flag-gated so the "no orphaned detail key" guard holds
  when the flag is off.
- **`lib/studio-recommendations.ts`** — Roam classified as a capture service (peak
  month 2, like Cast/Papic), flag-gated to stay consistent with the flag-gated
  catalog entry (the drift guards cross-check catalog ⟷ peak-months).
- **`lib/v2-catalog.ts`** — `BUILD_STATUS.LIVE_STUDIO_ROAM = 'partial'`.

Guards: full unit suite passes with the flag **both off and on** (2847/2847 each) —
the four suite/drift guards (detail content, orphaned keys, classification, non-
opensDirect detail) are all satisfied in the launched state.

⚠ NOT reconciled here (deliberate, flagged for a follow-up copy pass): the umbrella
"Live Studio" wording on ~10 marketing/home/alaala/editorial surfaces — those are
umbrella references and need per-surface owner intent (umbrella vs Cast).

SPEC IMPACT: Price + naming recorded in `Live_Studio_Cast_and_Roam_2026-07-23.md`, DECISION_LOG, and memory (2026-07-23). No new decisions here.
