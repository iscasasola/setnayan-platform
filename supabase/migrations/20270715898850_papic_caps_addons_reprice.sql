-- Papic pricing reprice — owner-set 2026-07-11
-- (spec: 0012_papic/Papic_Pricing_Storage_Face_Build_Plan_2026-07-11.md · Pricing.md § 2.1 · DECISION_LOG 2026-07-11)
--
-- Three pure reprices, no new tables:
--   1. Per-tier CAPTURE caps: Ltd ₱5,999 · Unli ₱11,999 (were 6000 / 10000 defaults;
--      supersede the flat ₱15,000 that was spec-only and never reached these columns).
--   2. Live Photo Wall (LIVE_WALL) ₱2,499 → ₱2,500.
--   3. Camera Bridge (CAMERA_BRIDGE) ₱499 → ₱500.
--
-- The caps live in events.papic_ltd_cap_php / papic_unli_cap_php (integer PHP,
-- admin-adjustable · added in 20270302361811). We move the DEFAULT and reset rows
-- still sitting on a known policy value (6000 / 10000 / 15000), preserving any
-- genuinely custom per-event cap an admin may have dialed.

-- 1. New per-tier cap defaults ----------------------------------------------
alter table public.events
  alter column papic_ltd_cap_php  set default 5999,
  alter column papic_unli_cap_php set default 11999;

update public.events
  set papic_ltd_cap_php = 5999
  where papic_ltd_cap_php in (6000, 15000);

update public.events
  set papic_unli_cap_php = 11999
  where papic_unli_cap_php in (10000, 15000);

-- 2. Live Photo Wall reprice -------------------------------------------------
update public.platform_retail_catalog_v2
  set retail_price_php = 2500, updated_at = now()
  where service_code = 'LIVE_WALL';

-- 3. Camera Bridge reprice ---------------------------------------------------
update public.platform_retail_catalog_v2
  set retail_price_php = 500, updated_at = now()
  where service_code = 'CAMERA_BRIDGE';
