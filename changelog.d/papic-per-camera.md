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

## 2026-06-26 · feat(papic): per-camera buy flow (PR2/4)

The couple-facing per-camera purchase.

- New `apps/web/lib/papic-cameras.ts` — admin-managed rate fetch (from
  `platform_retail_catalog_v2`, never hardcoded), the pure `computeCameraQuote`
  cost calc clamped to the event cost cap, and `provisionPaidCamerasAdmin` which
  materializes paid cameras as tiered `paparazzi_seats` rows in their own index
  range (≥ 200, no collision with the pack 1–5 or sampler 101–103).
- New `purchasePapicCameras` server action — couple-guarded, enforces the
  5-camera minimum, creates an apply-then-pay order (`status='submitted'`), and
  provisions the cameras PENDING. Mints a unique `SN…` reference code.
- New `camera-picker.tsx` client component (Roll/Unlimited steppers · live
  capped cost · min-5 gate) wired into the Papic studio page with a
  payment-instructions success banner.

Strictly additive — the free sampler + PAPIC_SEATS pack are untouched. Capture
stays blocked until the order is paid (the presign gate is PR3). Verified:
typecheck + `next lint` + entitlement-gates + papic-keep all clean.

SPEC IMPACT: None new (captured in the corpus strategy doc + DECISION_LOG).
