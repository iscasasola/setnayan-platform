-- live_studio_unify_sku — the unified Live Studio catalog SKU (owner 2026-07-25).
--
-- Merge Cast (PANOOD_SYSTEM, ₱2,500/day, LIVE in prod) + Roam (LIVE_STUDIO_ROAM,
-- ₱3,500/day, shipped flag-dark #3666) into ONE customer-facing "Live Studio" SKU:
--   LIVE_STUDIO · ₱2,999 · PER EVENT (one_time, not per-day, not monthly).
-- See Live_Studio_Unified_Spec_2026-07-25.md § 3.
--
-- ── 1. Create LIVE_STUDIO (active-but-flag-dark, mirroring the Roam idiom) ──────
-- is_active = TRUE so the (flag-gated) apply-then-pay buy path works end-to-end:
-- resolveServiceSellability (lib/v2-catalog.ts) reads is_active and would reject a
-- FALSE row as 'retired', 500-blocking the order. But the unified Studio tile,
-- controller, buy page and /pricing row are ALL still gated by
-- NEXT_PUBLIC_LIVE_STUDIO_ROAM_ENABLED (default OFF) — and fetchV2CustomerCatalog
-- excludes LIVE_STUDIO by name while that flag is off (same guard as
-- LIVE_STUDIO_ROAM/TODAYS_FOCUS) — so the price is merely RECORDED active; nothing
-- is visible or buyable until the owner flips the flag. billing_period='one_time'
-- → renders a bare "₱2,999" (no "/ day" suffix), matching the per-event model.
INSERT INTO public.platform_retail_catalog_v2
  (service_code, title, retail_price_php, saas_overhead_cost_php, is_token_able, is_active, billing_period, description)
VALUES
  ('LIVE_STUDIO',
   'Live Studio',
   2999.00,
   0.00,
   FALSE,
   TRUE,
   'one_time',
   'Your celebration, streamed live for everyone who can''t be there. One directed Main Stage plus switchable guest cameras across your angles and venues — cut the Main Stage between them with one tap, or let remote guests pick their own view. Per event. Cameras join as phones via the event QR (no install). Free single-camera livestream stays free.')
ON CONFLICT (service_code) DO NOTHING;

-- ── 2. Retire LIVE_STUDIO_ROAM into LIVE_STUDIO — SAFE NOW ──────────────────────
-- Roam shipped flag-dark with ZERO orders (its tile/controller/picker/pricing are
-- all behind NEXT_PUBLIC_LIVE_STUDIO_ROAM_ENABLED, still OFF), so deactivating it
-- changes NOTHING live. Its capability folds into LIVE_STUDIO, which is sold from
-- the same (repurposed) Roam controller. is_active=false → resolveServiceSellability
-- returns 'retired' and the checkout rejects any lingering LIVE_STUDIO_ROAM order.
-- Row is PRESERVED (never DELETE) — order/activation FKs reference service codes.
UPDATE public.platform_retail_catalog_v2
   SET is_active = FALSE, updated_at = now()
 WHERE service_code = 'LIVE_STUDIO_ROAM'
   AND is_active IS DISTINCT FROM FALSE;

-- ── 3. PANOOD_SYSTEM (Cast) retirement is DELIBERATELY NOT DONE HERE ────────────
-- PANOOD_SYSTEM (Live Studio Cast, ₱2,500/day) is LIVE and SELLING in prod. A
-- migration auto-applies on merge and CANNOT read the NEXT_PUBLIC flag, so flipping
-- is_active=false here would immediately stop live Cast sales and drop it off
-- /pricing WHILE the unified Live Studio is still flag-dark — a "no behavior change
-- when the flag is off" violation on a live, revenue-bearing SKU. So the Cast
-- retirement is staged as the LAUNCH CUTOVER (a separate, owner-run migration that
-- accompanies the flag flip), not part of this dark PR. Until then Cast keeps
-- selling PANOOD_SYSTEM exactly as today; when the owner launches the unified
-- product, the Cast studio surfaces already redirect into Live Studio (flag-gated,
-- code side) so there are no dead buy buttons even before the flip.
--
-- The exact cutover statement (run at launch, NOT now):
--   UPDATE public.platform_retail_catalog_v2
--      SET is_active = FALSE, updated_at = now()
--    WHERE service_code = 'PANOOD_SYSTEM' AND is_active IS DISTINCT FROM FALSE;

-- Informational verification (never fails the migration on re-run).
DO $$
DECLARE v_new numeric; v_roam boolean; v_cast boolean;
BEGIN
  SELECT retail_price_php INTO v_new FROM public.platform_retail_catalog_v2 WHERE service_code = 'LIVE_STUDIO';
  SELECT is_active INTO v_roam FROM public.platform_retail_catalog_v2 WHERE service_code = 'LIVE_STUDIO_ROAM';
  SELECT is_active INTO v_cast FROM public.platform_retail_catalog_v2 WHERE service_code = 'PANOOD_SYSTEM';
  IF v_new IS NULL THEN
    RAISE NOTICE 'NOTE: LIVE_STUDIO missing after insert (a prior row may exist; DO NOTHING preserves it).';
  ELSE
    RAISE NOTICE 'LIVE_STUDIO seeded at PHP % (one_time / per event), active-but-flag-dark.', v_new;
  END IF;
  RAISE NOTICE 'LIVE_STUDIO_ROAM is_active=% (expected FALSE — retired into LIVE_STUDIO).', v_roam;
  RAISE NOTICE 'PANOOD_SYSTEM is_active=% (LEFT AS-IS on purpose — Cast retirement is the launch cutover).', v_cast;
END $$;
