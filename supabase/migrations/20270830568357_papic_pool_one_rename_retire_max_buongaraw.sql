-- 20270830568357_papic_pool_one_rename_retire_max_buongaraw.sql
--
-- Papic naming lock (owner 2026-07-22). "Papic One" = the ONE-camera product;
-- "Papic Pool" = the shared, accumulated shot-pool. This SWAPS the shipped
-- display names and RETIRES Papic Max + the legacy per-day 'roll' meter (Papic
-- Buong Araw was a doorway LABEL, retired in code — no SKU).
--
--   shipped display                     -> new display
--   PAPIC_GUEST*  "Papic One — N shots" -> "Papic Pool — N shots"
--   PAPIC_CAMERA_MINI_DAY / tier 'mini'
--     "Papic Mini …"                    -> "Papic One"
--   tier 'roll' (legacy alias of mini)  -> DEACTIVATED (a live per-camera·day
--                                          meter under the flat "Papic One" name
--                                          would contradict the flat promise)
--   tier 'unlimited' "Papic Max" +
--     PAPIC_CAMERA_UNLIMITED_DAY        -> DEACTIVATED
--
-- Display title + is_active are display-only (never-rename lock). PRICES: this
-- migration also applies the owner's 2026-07-22 Papic Pool reprice (the only
-- price change here). Papic One stays ₱100/camera; its per-day→6-month-window
-- metering + bundled face-tag change is a SEPARATE migration/PR. Fully idempotent
-- (IS DISTINCT FROM guards); titles kept unique so the duplicate-active-title
-- guard is never tripped.
BEGIN;

-- 1. Point buckets -> "Papic Pool" + owner reprice 2026-07-22 (3,000=₱999 ·
--    6,000=₱1,999 · 10,000=₱2,999 · +10,000 top-up=₱2,999). Renamed BEFORE the
--    camera rung so no two active rows momentarily share a "Papic One …" title.
UPDATE public.platform_retail_catalog_v2 SET title = 'Papic Pool — 3,000 shots (per event)', retail_price_php = 999, updated_at = NOW()
  WHERE service_code = 'PAPIC_GUEST'       AND (title IS DISTINCT FROM 'Papic Pool — 3,000 shots (per event)' OR retail_price_php IS DISTINCT FROM 999);
UPDATE public.platform_retail_catalog_v2 SET title = 'Papic Pool — 6,000 shots (per event)', retail_price_php = 1999, updated_at = NOW()
  WHERE service_code = 'PAPIC_GUEST_6K'    AND (title IS DISTINCT FROM 'Papic Pool — 6,000 shots (per event)' OR retail_price_php IS DISTINCT FROM 1999);
UPDATE public.platform_retail_catalog_v2 SET title = 'Papic Pool — 10,000 shots (per event)', retail_price_php = 2999, updated_at = NOW()
  WHERE service_code = 'PAPIC_GUEST_10K'   AND (title IS DISTINCT FROM 'Papic Pool — 10,000 shots (per event)' OR retail_price_php IS DISTINCT FROM 2999);
UPDATE public.platform_retail_catalog_v2 SET title = 'Papic Pool — add 10,000 shots', retail_price_php = 2999, updated_at = NOW()
  WHERE service_code = 'PAPIC_GUEST_TOPUP' AND (title IS DISTINCT FROM 'Papic Pool — add 10,000 shots' OR retail_price_php IS DISTINCT FROM 2999);

-- 2. The per-camera rung -> "Papic One" (price unchanged at ₱100). Drop the
--    "per camera, per day" wording (metering moves to window-total in a later PR;
--    also keeps the title collision-free).
UPDATE public.papic_tier_config SET display_title = 'Papic One', updated_at = NOW()
  WHERE tier_code = 'mini' AND display_title IS DISTINCT FROM 'Papic One';
UPDATE public.platform_retail_catalog_v2 SET title = 'Papic One', updated_at = NOW()
  WHERE service_code = 'PAPIC_CAMERA_MINI_DAY' AND title IS DISTINCT FROM 'Papic One';

-- 3. RETIRE Papic Max (the 'unlimited' ₱200 / 500-pt rung) + the legacy per-day
--    'roll' alias (both the tier row and its catalog rate row). publicPapicLadder()
--    and the catalog readers filter on is_active, so they vanish everywhere.
--    (Papic Ltd is already inactive from 20270828150000.)
UPDATE public.papic_tier_config SET is_active = FALSE, updated_at = NOW()
  WHERE tier_code IN ('roll', 'unlimited') AND is_active IS DISTINCT FROM FALSE;
UPDATE public.platform_retail_catalog_v2 SET is_active = FALSE, updated_at = NOW()
  WHERE service_code IN ('PAPIC_CAMERA_UNLIMITED_DAY', 'PAPIC_CAMERA_ROLL_DAY')
    AND is_active IS DISTINCT FROM FALSE;

COMMIT;
