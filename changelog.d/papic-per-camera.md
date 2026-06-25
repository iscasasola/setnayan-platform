## 2026-06-26 · feat(papic): per-camera pricing model — schema foundation (PR1/4)

First PR of the owner-locked **per-camera Papic** build (schema → buy flow →
presign enforcement → capture MVP). A "camera" is a paparazzi seat.

- Extends `paparazzi_seats` with a per-camera `tier` (`free` / `roll` /
  `unlimited`), a validity window (`valid_from` / `valid_until`), and a
  `paid_order_id` link to the `orders` row that provisioned it.
- Adds `papic_seat_day_usage` (per-camera per-day photo/video counts) — the
  source of truth for Free (5 photos + 1 video) and Roll (30 + 10) daily quota
  enforcement at presign time. RLS mirrors `papic_photos` (couple/admin full +
  claimer read).
- Adds admin-adjustable `events.papic_cost_cap_php` (default ₱6,999).
- Seeds the two per-camera rate SKUs into `platform_retail_catalog_v2`:
  `PAPIC_CAMERA_ROLL_DAY` ₱30 and `PAPIC_CAMERA_UNLIMITED_DAY` ₱100
  (prices admin-managed, never hardcoded).

Additive + idempotent. Old seat-pack SKUs (`PAPIC_SEATS` etc.) untouched —
retired in a later PR once the per-camera buy flow is proven live. Migration
applied to prod (`setnayan-prod`) and verified.

SPEC IMPACT: None new — the per-camera model is already captured in the corpus
(`0012_papic/Papic_v2_Pricing_and_Funnel_Strategy_2026-06-26.md` + DECISION_LOG
row 2026-06-26). Prices remain provisional admin-catalog dials.
