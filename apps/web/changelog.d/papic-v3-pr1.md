## 2026-07-17 · feat(papic): v3 capture-points ledger + tier vocab + tier config (PR-1 of 12)

Schema-first foundation for the Papic v3 rebuild (owner-locked 2026-07-17). No enforcement yet — this PR only lays the ledger + config the later PRs read.

- Widen `paparazzi_seats.tier` CHECK to add `'mini'`/`'ltd'` (keep legacy `'free'`/`'roll'`/`'unlimited'` per never-rename-technical-ids). Legacy `'roll'` aliases to Mini economics (owner rec).
- New `public.papic_tier_config` (Pattern H · RLS at CREATE TABLE · public read · admin-only write): the single admin-editable source for each tier's daily **capture-point budget** (free/mini 20 · ltd 70 · unlimited ∞), rate SKU, free seats, and wedding day-cap default.
- Seed rate SKUs `PAPIC_CAMERA_MINI_DAY` (₱30) + `PAPIC_CAMERA_LTD_DAY` (₱50) in `platform_retail_catalog_v2` (before the config FK).
- Add `papic_seat_day_usage.points_used` (1 photo = 1 pt · 1 five-second clip = 3 pts); backfill `photos_used + videos_used*3`; keep the per-kind columns for lineage.
- New RPCs `papic_reserve_camera_points(seat,event,cost)` (atomic, budget-from-config, unlimited-passthrough) + `papic_camera_points_remaining(seat)`, forked from the proven `papic_reserve_camera_capture` pattern.

**SPEC IMPACT:** None — the corpus already carries the v3 model (`0012_papic/Papic_Good_Better_Best_Pricing_2026-07-17.md`, `Papic_Build_Brief_2026-07-17.md`, `Pricing.md` § 2.1). This PR is the code landing of an already-locked spec.

**⚠ PRE-APPLY (prod):** verify the `paparazzi_seats_tier_check` constraint name before the DROP/ADD, and confirm the `20270821` prefix sorts after the latest applied migration. Enforcement wiring (points at the presign/record seams) + free-camera provisioning land in PR-3; the `points_used` counter is written by nothing until then.
