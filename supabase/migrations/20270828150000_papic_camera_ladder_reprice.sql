-- Papic camera ladder — reprice to the owner ladder, retire "Unli" and "Ltd".
-- Corpus: 0012_papic/Papic_Pricing_Lock_2026-07-20.md § 2.2 (owner session 2026-07-20).
--
--   Papic Mini   200 pts/camera·day   ₱30  → ₱100
--   Papic Max    500 pts/camera·day   ₱100 → ₱200   (was "Papic Unli", uncapped)
--   Papic Ltd    ₱50 rung                          → DEACTIVATED
--
-- ── WHY "UNLI" IS RETIRED AS A NAME ──────────────────────────────────────
-- The rung is being capped at 500 points, and a tier capped at 500 is not
-- unlimited. Shipping that word would be the same class of defect the 2026-07-20
-- website audit found across the live site (advertising what the code does not
-- do). The TIER CODE stays 'unlimited' — it is the schema CHECK value and the
-- value on existing seat rows — only the display title changes. Never rename a
-- tier code; that lock holds.
--
-- ── WHY CAPPING 'unlimited' AT 500 IS SAFE ───────────────────────────────
-- points_per_day NULL means "unlimited" to papic_reserve_camera_points, which
-- returns TRUE without touching the ledger. Setting 500 makes the fail-closed
-- gate BIND on this rung where it previously never did. Verified there is no
-- code path that special-cases the tier to skip metering: the `rung ===
-- 'unlimited'` checks in app/api/upload/route.ts:357 and app/papic/actions.ts:337
-- are the PAID gate (`!paid && rung === 'unlimited'`), and papic-cameras.ts:662
-- is a tier-code validator. Metering is driven purely by points_per_day.
--
-- Blast radius is nil regardless: PAPIC_CAMERA_* has ZERO orders in the
-- platform's lifetime (prod, 2026-07-20), so no seat exists to be re-metered and
-- NO GRANDFATHERING CLAUSE IS NEEDED. Do not write one.
--
-- ── WHY Ltd GOES ────────────────────────────────────────────────────────
-- The lock's ladder is Free → Mini → Max. Ltd was the ₱50 / 70-point middle
-- rung; PR #3422 built it days ago, and it is deactivated here rather than
-- dropped so the tier code and its catalog row survive for lineage. Zero buyers
-- either way.
--
-- ── THE DUPLICATE TITLE, FIXED ──────────────────────────────────────────
-- PAPIC_CAMERA_ROLL_DAY (₱30) and PAPIC_CAMERA_LTD_DAY (₱50) BOTH read
-- "Papic Ltd (per camera, per day)" in prod, and app/pricing/page.tsx maps every
-- active SKU into schema.org Product/Offer using sku.title verbatim — so answer
-- engines ingest two "Papic Ltd" offers at different prices. ROLL is retitled to
-- its real rung here. (papic_tier_config already carried the right label; the
-- catalog row did not.)

-- ---- 1. tier config — capacities, titles, and Ltd's retirement ------------

UPDATE public.papic_tier_config
SET points_per_day = 200, updated_at = NOW()
WHERE tier_code IN ('mini', 'roll') AND points_per_day IS DISTINCT FROM 200;

UPDATE public.papic_tier_config
SET points_per_day = 500,
    display_title  = 'Papic Max',
    updated_at     = NOW()
WHERE tier_code = 'unlimited'
  AND (points_per_day IS DISTINCT FROM 500 OR display_title IS DISTINCT FROM 'Papic Max');

UPDATE public.papic_tier_config
SET is_active = FALSE, updated_at = NOW()
WHERE tier_code = 'ltd' AND is_active IS DISTINCT FROM FALSE;

-- ---- 2. catalog — prices + the duplicate-title fix ------------------------

UPDATE public.platform_retail_catalog_v2
SET retail_price_php = 100, updated_at = NOW()
WHERE service_code = 'PAPIC_CAMERA_MINI_DAY' AND retail_price_php IS DISTINCT FROM 100;

UPDATE public.platform_retail_catalog_v2
SET retail_price_php = 100,
    title            = 'Papic Mini (legacy roll · per camera, per day)',
    updated_at       = NOW()
WHERE service_code = 'PAPIC_CAMERA_ROLL_DAY'
  AND (retail_price_php IS DISTINCT FROM 100
       OR title IS DISTINCT FROM 'Papic Mini (legacy roll · per camera, per day)');

UPDATE public.platform_retail_catalog_v2
SET retail_price_php = 200,
    title            = 'Papic Max (per camera, per day)',
    updated_at       = NOW()
WHERE service_code = 'PAPIC_CAMERA_UNLIMITED_DAY'
  AND (retail_price_php IS DISTINCT FROM 200
       OR title IS DISTINCT FROM 'Papic Max (per camera, per day)');

UPDATE public.platform_retail_catalog_v2
SET is_active = FALSE, updated_at = NOW()
WHERE service_code = 'PAPIC_CAMERA_LTD_DAY' AND is_active IS DISTINCT FROM FALSE;

-- ---- 3. post-conditions — fail loudly rather than half-apply -------------

DO $$
DECLARE
  v_mini_pts  INTEGER;
  v_max_pts   INTEGER;
  v_max_title TEXT;
  v_ltd_on    BOOLEAN;
  v_dupes     INTEGER;
BEGIN
  SELECT points_per_day INTO v_mini_pts FROM public.papic_tier_config WHERE tier_code = 'mini';
  IF v_mini_pts IS DISTINCT FROM 200 THEN
    RAISE EXCEPTION 'mini points_per_day failed to settle at 200 (got %)', v_mini_pts;
  END IF;

  SELECT points_per_day, display_title INTO v_max_pts, v_max_title
  FROM public.papic_tier_config WHERE tier_code = 'unlimited';
  IF v_max_pts IS DISTINCT FROM 500 THEN
    RAISE EXCEPTION 'unlimited (Papic Max) points_per_day failed to settle at 500 (got %)', v_max_pts;
  END IF;
  IF v_max_title IS DISTINCT FROM 'Papic Max' THEN
    RAISE EXCEPTION 'Papic Max title failed to settle (got %)', v_max_title;
  END IF;

  SELECT is_active INTO v_ltd_on FROM public.papic_tier_config WHERE tier_code = 'ltd';
  IF v_ltd_on IS DISTINCT FROM FALSE THEN
    RAISE EXCEPTION 'ltd tier is still active';
  END IF;

  -- The defect this migration exists to kill: no two ACTIVE customer SKUs may
  -- share a title, because /pricing emits each as a schema.org Offer verbatim.
  SELECT COUNT(*) INTO v_dupes FROM (
    SELECT title FROM public.platform_retail_catalog_v2
    WHERE is_active GROUP BY title HAVING COUNT(*) > 1
  ) d;
  IF v_dupes > 0 THEN
    RAISE EXCEPTION 'duplicate titles remain among ACTIVE catalog SKUs (% group(s))', v_dupes;
  END IF;
END $$;
