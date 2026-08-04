-- seating_3d_reprice_1500
-- ============================================================================
-- PRICING — the 3D Plan is ₱1,500 per wedding, not ₱2,999.
--
-- OWNER-DECIDED. Locked 2026-07-23 ("3D Plan host price ₱1,500"; the ₱2,999,
-- the interim ₱1,000 and the #3526 couple-discount were all retired at that
-- point) and re-confirmed 2026-08-02 in the words "1500 per wedding". The
-- catalog was never moved to match, so `platform_retail_catalog_v2.SEATING_3D`
-- has been charging ₱2,999 against a ₱1,500 decision ever since — a live
-- overcharge on an `is_active = TRUE` row, not a stale doc.
--
-- ── "PER WEDDING" NEEDS NO STRUCTURAL CHANGE ────────────────────────────────
-- The row is already `billing_period = 'one_time'` and `is_pax_priced = FALSE`,
-- i.e. one charge per event, flat, regardless of guest count. That is exactly
-- what "per wedding" describes, so this migration moves the NUMBER and nothing
-- else. No column, no basis change, no new SKU.
--
-- ── WHAT THIS DELIBERATELY DOES NOT TOUCH ──────────────────────────────────
-- `VENDOR_3D_PLAN_UNLOCK_PRICE_PHP` (lib/vendor-3d-plan-unlock.ts) is a
-- SEPARATE ₱1,000 price: what a couple pays for the 3D Plan when a booked
-- vendor with the booth add-on unlocks it for them. It stays ₱1,000 and is
-- still the cheaper of the two, so the discount remains coherent — but the gap
-- it represents narrows from ₱1,999 to ₱500. That is a consequence of the
-- owner's reprice, NOT a second decision taken here; flagged in the PR rather
-- than silently adjusted, because changing what we charge is never a side
-- effect of something else.
--
-- ── IDEMPOTENT + NARROW ────────────────────────────────────────────────────
-- Keyed on `service_code`, guarded on the current value so a re-run is a no-op
-- and so this can never quietly overwrite a LATER, deliberate reprice: if the
-- row is not at ₱2,999 the UPDATE matches nothing and the post-condition below
-- reports what it actually found.
-- ============================================================================

BEGIN;

UPDATE public.platform_retail_catalog_v2
   SET retail_price_php = 1500.00,
       updated_at       = NOW()
 WHERE service_code     = 'SEATING_3D'
   AND retail_price_php = 2999.00;

-- ----------------------------------------------------------------------------
-- Post-condition — assert the END STATE, but ONLY when the row exists.
--
-- ⚠ THE ROW IS PROD DATA, NOT MIGRATION DATA. `platform_retail_catalog_v2` is
-- seeded outside the migration stream, so on a FRESH database — every CI
-- migration replay, and `tests/db/*` — `SEATING_3D` is simply absent and the
-- UPDATE above matches zero rows. That is correct and harmless: there is no
-- price to correct on a database that sells nothing yet.
--
-- An earlier draft of this file raised on absence "to refuse to pass silently".
-- That turned a prod-data dependency into a hard replay failure and took the
-- ENTIRE db suite down with it (727 of 729 tests failed, because every one of
-- them builds its world by replaying migrations). Every sibling reprice —
-- 20270712300000, 20270710619774 — is a bare guarded UPDATE for exactly this
-- reason. This block keeps the safety value where it is real (prod, where the
-- row exists) and stays silent where the row legitimately does not.
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  v_price NUMERIC;
  v_period TEXT;
  v_pax BOOLEAN;
BEGIN
  SELECT retail_price_php, billing_period, is_pax_priced
    INTO v_price, v_period, v_pax
    FROM public.platform_retail_catalog_v2
   WHERE service_code = 'SEATING_3D';

  IF NOT FOUND THEN
    RAISE NOTICE 'SEATING_3D absent (fresh database / replay) — nothing to reprice';
    RETURN;
  END IF;

  IF v_price <> 1500.00 THEN
    RAISE EXCEPTION 'SEATING_3D is % — expected 1500.00 (owner-locked ₱1,500 per wedding)', v_price;
  END IF;

  -- "Per wedding" is carried by these two, so pin them: if a later change makes
  -- this per-guest or recurring, the price above stops meaning what the owner
  -- agreed to and this migration's own claim would be a lie.
  IF v_period IS DISTINCT FROM 'one_time' OR v_pax IS DISTINCT FROM FALSE THEN
    RAISE EXCEPTION 'SEATING_3D is no longer a flat one-time charge (billing_period=%, is_pax_priced=%) — ₱1,500 "per wedding" no longer holds',
      v_period, v_pax;
  END IF;
END $$;

COMMIT;
