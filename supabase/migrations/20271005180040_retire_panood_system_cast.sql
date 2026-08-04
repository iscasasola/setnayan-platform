-- retire_panood_system_cast — THE CAST RETIREMENT CUTOVER (owner-directed 2026-07-26).
--
-- This is the exact statement migration 20271001110000 (live_studio_unify_sku) staged
-- in a comment as "run at launch, NOT now". The owner has now directed it early. Its
-- § 3 rationale for waiting — "PANOOD_SYSTEM is LIVE and SELLING in prod, flipping
-- is_active would immediately stop live Cast sales" — turned out to rest on a premise
-- that is false: `orders` holds ZERO rows for PANOOD_SYSTEM, PANOOD_SYSTEM_MOBILE,
-- LIVE_STUDIO and LIVE_STUDIO_ROAM (verified against prod 2026-07-26). Nobody has ever
-- bought any Live Studio SKU, so there is no revenue to stop and no entitlement to
-- revoke from anyone.
--
-- ── WHY IT CANNOT WAIT: A ₱500 ARBITRAGE ───────────────────────────────────────
-- Wave 6 added the grandfather alias LIVE_STUDIO ← PANOOD_SYSTEM · PANOOD_SYSTEM_MOBILE
-- (SKU_OWNERSHIP_ALIASES, apps/web/lib/entitlements.ts) so an existing Cast buyer keeps
-- what they bought once the unified controller lands. The alias is a READ rule — it does
-- not care whether the order that triggers it is historical or brand new. So while
-- PANOOD_SYSTEM stays sellable at ₱2,500, ANY new buyer receives the full ₱2,999 Live
-- Studio entitlement through it: a ₱500 discount on the unified product, available to
-- anyone, with no code path anywhere that notices. PANOOD_SYSTEM_MOBILE (₱1,500) was
-- already is_active=false, so PANOOD_SYSTEM is the one open door. Closing it is this
-- migration's whole job.
--
-- ── WHAT THIS DOES NOT DO ──────────────────────────────────────────────────────
-- The alias STAYS. Retiring the catalog row stops new PURCHASES (checkout's
-- resolveServiceSellability → 'retired' → reject, before any charge resolver runs);
-- it does not touch ownership resolution, which reads `orders` and comp grants and
-- never consults the catalog. So a historical Cast order, an admin comp grant, a
-- founder seat and an internal host all keep resolving LIVE_STUDIO exactly as before.
-- Verified by apps/web/lib/entitlements.test.ts ("GRANDFATHER — a paid PANOOD_SYSTEM
-- (Cast) order confers LIVE_STUDIO"), which passes unchanged after this migration.
--
-- The row is PRESERVED, never DELETEd — order/activation rows reference service codes,
-- and `is_active=false` is the repo's only sanctioned retirement (owner 2026-06-08).
--
-- ── REVERSIBLE IN ONE LINE ─────────────────────────────────────────────────────
--   UPDATE public.platform_retail_catalog_v2
--      SET is_active = TRUE, updated_at = now() WHERE service_code = 'PANOOD_SYSTEM';

UPDATE public.platform_retail_catalog_v2
   SET is_active = FALSE, updated_at = now()
 WHERE service_code = 'PANOOD_SYSTEM'
   AND is_active IS DISTINCT FROM FALSE;

-- Informational verification (never fails the migration, and never blocks a re-run).
-- The order tally is printed rather than asserted on purpose: if a Cast order somehow
-- exists by the time this applies, the right response is an owner conversation, not a
-- failed deploy that leaves the arbitrage open.
DO $$
DECLARE
  v_cast   boolean;
  v_mobile boolean;
  v_studio boolean;
  v_orders bigint;
BEGIN
  SELECT is_active INTO v_cast   FROM public.platform_retail_catalog_v2 WHERE service_code = 'PANOOD_SYSTEM';
  SELECT is_active INTO v_mobile FROM public.platform_retail_catalog_v2 WHERE service_code = 'PANOOD_SYSTEM_MOBILE';
  SELECT is_active INTO v_studio FROM public.platform_retail_catalog_v2 WHERE service_code = 'LIVE_STUDIO';
  SELECT count(*)  INTO v_orders FROM public.orders
   WHERE service_key IN ('PANOOD_SYSTEM', 'PANOOD_SYSTEM_MOBILE');

  RAISE NOTICE 'PANOOD_SYSTEM is_active=% (expected FALSE — Cast retired; ₱500 alias arbitrage closed).', v_cast;
  RAISE NOTICE 'PANOOD_SYSTEM_MOBILE is_active=% (expected FALSE — retired 2026-07-21).', v_mobile;
  RAISE NOTICE 'LIVE_STUDIO is_active=% (expected TRUE — the unified SKU, still flag-dark).', v_studio;
  RAISE NOTICE 'Cast orders on record: % (0 at cutover time — the grandfather alias still serves any that exist).', v_orders;
END $$;
