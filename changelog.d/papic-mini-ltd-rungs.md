## 2026-07-20 · feat(papic): stand up the missing Mini + Ltd rungs — the camera ladder is real

Owner-confirmed 2026-07-20: life events run a THREE-rung paid camera ladder —
**Papic Mini ₱30 · Papic Ltd ₱50 · Papic Unli ₱100** per camera per day, on top
of the 3 free cameras. Before this only `roll` (₱30) and `unlimited` (₱100) had
buy paths; `PAPIC_CAMERA_MINI_DAY` and `PAPIC_CAMERA_LTD_DAY` existed in the
catalog + `papic_tier_config` with **zero runtime references** — a fake ladder.

**`lib/papic-cameras.ts` — the ladder as data**
- New SKU constants `PAPIC_CAMERA_MINI_SKU` / `PAPIC_CAMERA_LTD_SKU`; new
  `PapicRung` vocabulary (`mini` | `ltd` | `unlimited`) + `PAPIC_RUNGS`.
- `papicRungForTier()` is now the ONE place that knows the **roll↔mini alias** —
  `roll` is the LEGACY tier code for the ₱30 rung (every already-sold seat/order
  in prod references it), so it is never deleted and always folds into Mini for
  quoting + display. Documented at length at the top of the module.
- `CameraTier` widened to `free | roll | mini | ltd | unlimited` (matches the
  `paparazzi_seats.tier` CHECK from migration `20270821110000`).
- `fetchCameraRates` reads all FOUR rate SKUs; Mini ↔ Roll fall back to each
  other in BOTH directions, so the ladder prices correctly whichever ₱30 catalog
  row the owner ultimately keeps.
- New `fetchPapicTierConfig()` — reads `papic_tier_config` for display titles,
  `points_per_day` and `wedding_day_cap_php`, so no surface hardcodes the ladder.
- `computeCameraQuote` is now per-rung: each rung clamps at its OWN cap
  independently (Mini ₱6,000 · Ltd ₱10,000 · Unli ₱15,000), weddings only —
  non-wedding events stay uncapped, byte-identical to #3407. Legacy quote fields
  (`rollCount` / `rollChargePhp` / `rollSubtotalPhp`) preserved as aliases of the
  Mini line. ⚠ `quote.ltdCapPhp` now carries the **Ltd** cap; pre-v3 it carried
  the Mini cap (no external readers).
- `opts.ltdFree` renamed to `opts.miniFree` with `ltdFree` kept as a deprecated
  alias — `PAPIC_UNLOCK_LTD` (₱9,000) keeps freeing exactly the ₱30 rung it was
  sold against. **No pass frees the new ₱50 Ltd rung** (owner pricing call).
- `provisionPaidCamerasAdmin` provisions at the canonical rung code
  (`mini`/`ltd`/`unlimited`) with the matching SKU; `rollCount` accepted as a
  legacy alias of `miniCount`.

**Money-safety fix** — both enforcement seams (`app/api/upload/route.ts` presign,
`app/papic/actions.ts` record) gated the paid-check on
`tier === 'roll' || tier === 'unlimited'`. A `mini`/`ltd` seat would have skipped
the paid-gate and shot before payment. Now expressed as `isPaidCameraTier()`
("not free"), so a future rung can never slip through an allow-list. `mini` and
`ltd` are also added to `PER_CAMERA_SKUS` / `papicPerCameraTier` so the points
gate meters them.

**Surfaces**
- `extra-cameras-picker.tsx` — was an Unlimited-only stepper; now the full
  3-rung ladder with per-rung steppers. Every title, rate, points budget and cap
  arrives as a server-resolved prop from `papic_tier_config` + the catalog.
- `studio/papic/actions.ts` — `purchasePapicCameras` and `purchasePapicExtras`
  both accept `mini`/`ltd`/`unlimited` (+ legacy `roll`) counts.
- `/pricing` `_papic-estimator.tsx` — 3 segments instead of 2, each showing its
  own rate/points/cap; the camera line now locks at the CHOSEN rung's cap,
  mirroring `computeCameraQuote` instead of diverging from it.
- `/pricing` page copy — replaced the stale synthetic-SKU blurb ("Ltd ₱30 (30
  photos + 10 videos) … first 5 free … Ltd ₱9,000") with catalog+config-driven
  text: correct rungs, correct points, `first 3 cameras free`, correct caps.

**Tests** — `lib/papic-cameras.test.ts` grows a three-rung block: independent
per-rung billing, day multipliers, **roll and mini quote identically**, roll+mini
summing into one rung, per-rung cap clamps, Ltd capping at the Ltd (not Mini)
cap, non-wedding uncapped across all three, `miniFree`/`ltdFree` equivalence, and
the rung↔tier/SKU plumbing. All pre-existing assertions kept green unchanged.

SPEC IMPACT: `0012_papic/Papic_Good_Better_Best_Pricing_2026-07-17.md` +
`Papic_v3_Whats_Next_2026-07-18.md` — the three-rung ladder is now purchasable in
code (brief-PR "make Mini/Ltd real"). Two owner decisions surfaced, NOT applied:
(1) the live catalog has **two ACTIVE SKUs both titled "Papic Ltd"** —
`PAPIC_CAMERA_ROLL_DAY` ₱30 (the Mini rung) and `PAPIC_CAMERA_LTD_DAY` ₱50 — a
title collision only the owner can settle; (2) whether the ₱9,000
`PAPIC_UNLOCK_LTD` pass should now also cover the new ₱50 Ltd rung (today it
covers only the ₱30/Mini rung it was sold against).
