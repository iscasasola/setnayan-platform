-- ═══════════════════════════════════════════════════════════════════════════
-- Papic One — ONE price. 150 credits for ₱50. (owner 2026-08-11)
-- ═══════════════════════════════════════════════════════════════════════════
-- ⚠ The FILENAME says "hundred_credits" and is wrong. The owner corrected the
-- figure to 150 while this was being written, and an APPLIED migration's name
-- can never be edited — so the correction lives here, at the top of the file
-- that actually does the work. Trust the SQL, never the filename.
--
-- Owner, verbatim: *"can we adjust papic one. 100 papic credits for 50 pesos.
-- can top up 100 credits for 50 pesos. remove the 100 pesos. let's just have one
-- price for papic one."* then, minutes later: *"sorry. my mistake. it should not
-- be 100 for 50 pesos. it is 150 papic credits for 50 pesos."*
--
-- SUPERSEDES the 2026-07-29 two-rung Papic One ladder (50 credits ₱50 · 100
-- credits ₱100) and the flat "₱1 = 1 shot" rule that went with it. Papic One is
-- now a SINGLE product at a single price, bought per camera and reloaded at
-- exactly the same rate — buying a camera and topping one up are the same
-- transaction, which is why there is no separate reload SKU and must never be one.
--
--   BEFORE                          AFTER
--   50 credits  → ₱50               150 credits → ₱50   (the only rung)
--   100 credits → ₱100              both old rungs retired
--
-- Rate: ₱0.333 per credit, down from ₱1.00. That puts Papic One within ~11% of
-- the shared Pool's ₱0.30 — a dedicated camera now costs essentially what the
-- shared pot costs, and the small premium is all that is charged for "unshared,
-- with its own QR". It used to be 3×.
--
-- ── WHY A NEW CODE INSTEAD OF REPRICING PAPIC_ONE_100 ─────────────────────
-- 🔑 BECAUSE THE NAME WOULD LIE. `PAPIC_ONE_100` means "100 credits". Putting
-- 150 in it leaves a stored value whose NAME states a different number from the
-- one it holds — and that is the precise failure that forced the
-- `sponsored_included` rename: a comment does not travel with a value into a
-- query result, a log line, or an audit. So the live rung is a new,
-- correctly-named `PAPIC_ONE_150`, and both old codes retire.
--
-- ✅ SAFE TO RETIRE BOTH, CHECKED AGAINST PROD 2026-08-11 rather than assumed:
-- `orders` holds ZERO rows for `PAPIC_ONE_100`, `PAPIC_CAMERA_MINI_DAY` and
-- `PAPIC_CAMERAS`, and `papic_one_orders` is empty. Nothing has ever been sold
-- on either code, so no in-flight order is stranded. Their activation hooks stay
-- wired anyway — a retired rung keeps its hook so a pre-existing order can still
-- convert, and "there are none today" is not a reason to remove the safety net.
--
-- 🔒 `PAPIC_CAMERA_MINI_DAY` IS DEACTIVATED, NOT DELETED, AND IS STILL
-- LOAD-BEARING. Two shipped things read the code itself:
--   1. `papic_grant_camera_points` branch (B) — the LEGACY multi-camera
--      PAPIC_CAMERAS shape — reads its points with `AND is_active`, then
--      `COALESCE(v_per, 50)`. Deactivating the row makes that lookup return
--      nothing and the COALESCE supply 50, the value the row holds today ⇒
--      legacy orders grant exactly what they granted before. Pinned by a db
--      test, not assumed.
--   2. `provisionPaidCamerasAdmin` stamps it as the `sku_code` on every 'mini'
--      seat it creates, including the ones the onboarding picker provisions. A
--      seat's sku_code is a label, not a purchase, so an inactive TIER row does
--      not affect it.
-- Deleting the row would break both.

-- ── 1 · the price (FIRST — papic_one_tiers.service_code FKs to the catalog) ─
-- Inserting the tier first fails the whole migration with a 23503. The Pool
-- ladder migration in this same commit learned that from the PGlite replay.
INSERT INTO public.platform_retail_catalog_v2
  (service_code, title, retail_price_php, saas_overhead_cost_php, description,
   is_active, is_token_able, is_pax_priced, billing_period)
VALUES
  ('PAPIC_ONE_150', 'Papic One — 150 credits (one camera)', 50, 4,
   'One named camera with its own QR and its own 150 credits — unshared, and '
   || 'reloadable with another 150 any time, for the same price.',
   TRUE, FALSE, FALSE, 'one_time')
ON CONFLICT (service_code) DO UPDATE
  SET title                  = EXCLUDED.title,
      saas_overhead_cost_php = EXCLUDED.saas_overhead_cost_php,
      description            = EXCLUDED.description,
      is_active              = TRUE,
      is_token_able          = EXCLUDED.is_token_able,
      is_pax_priced          = EXCLUDED.is_pax_priced,
      billing_period         = EXCLUDED.billing_period,
      updated_at             = now();

-- The price IS owner-set here, unlike the Pool ladder's insert: this row is new,
-- so there is no admin edit to preserve. Set it explicitly on first creation
-- only — a re-run must not undo a later change at /admin/pricing.
UPDATE public.platform_retail_catalog_v2
   SET retail_price_php = 50, updated_at = now()
 WHERE service_code = 'PAPIC_ONE_150' AND retail_price_php IS DISTINCT FROM 50
   AND NOT EXISTS (SELECT 1 FROM public.orders WHERE service_key = 'PAPIC_ONE_150');

-- ── 2 · the rung ───────────────────────────────────────────────────────────
INSERT INTO public.papic_one_tiers (service_code, points, sort_order, is_active)
VALUES ('PAPIC_ONE_150', 150, 10, TRUE)
ON CONFLICT (service_code) DO UPDATE
  SET points     = EXCLUDED.points,
      sort_order = EXCLUDED.sort_order,
      is_active  = TRUE,
      updated_at = now();

-- ── 3 · retire the old rungs, in BOTH places ───────────────────────────────
-- Catalog-dark alone is not a fence: resolveRetailChargeCentavos() prices by
-- service_code without checking is_active, so the tier row has to go dark too.
UPDATE public.papic_one_tiers
   SET is_active = FALSE, updated_at = now()
 WHERE service_code IN ('PAPIC_CAMERA_MINI_DAY', 'PAPIC_ONE_100');

UPDATE public.platform_retail_catalog_v2
   SET is_active  = FALSE,
       title      = title || ' (superseded 2026-08-11)',
       updated_at = now()
 WHERE service_code IN ('PAPIC_CAMERA_MINI_DAY', 'PAPIC_ONE_100')
   AND is_active;

-- ── 4 · prove it, in the migration ─────────────────────────────────────────
-- A price change that silently did not apply is indistinguishable from one that
-- did, until a couple is charged the old figure. Fail the migration instead.
DO $$
DECLARE
  v_points INTEGER;
  v_price  NUMERIC;
  v_rungs  INTEGER;
BEGIN
  SELECT t.points, c.retail_price_php
    INTO v_points, v_price
    FROM public.papic_one_tiers t
    JOIN public.platform_retail_catalog_v2 c ON c.service_code = t.service_code
   WHERE t.service_code = 'PAPIC_ONE_150' AND t.is_active AND c.is_active;

  IF v_points IS DISTINCT FROM 150 OR v_price IS DISTINCT FROM 50 THEN
    RAISE EXCEPTION 'Papic One did not land: credits=% price=% (want 150 / 50)',
      v_points, v_price;
  END IF;

  SELECT COUNT(*) INTO v_rungs FROM public.papic_one_tiers WHERE is_active;
  IF v_rungs <> 1 THEN
    RAISE EXCEPTION 'Papic One must have exactly ONE active rung, found %', v_rungs;
  END IF;
END $$;
