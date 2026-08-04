-- live_studio_roam_activate — flip the LIVE_STUDIO_ROAM catalog row is_active=TRUE
-- so the generic retirement guard (resolveServiceSellability → submitOrderAction)
-- stops rejecting the Roam purchase as 'retired'.
--
-- WHY NOW (owner 2026-07-24, via the "make Roam buyable" task): the seed migration
-- 20270919479280 recorded the ₱3,500/day price is_active=FALSE ("dark until launch").
-- But is_active=FALSE is the ONE retirement switch the buy path reads
-- (lib/v2-catalog.ts resolveServiceSellability), so with it FALSE the Roam order can
-- never complete — the controller could configure channels but the purchase 500-block-
-- rejected. Flipping it TRUE is what makes the apply-then-pay checkout actually create
-- the LIVE_STUDIO_ROAM order → QR rail → /admin/payments.
--
-- ⚠ NOT a premature public launch. The Roam Studio tile, controller, buy drawer, and
-- public picker are ALL still gated by NEXT_PUBLIC_LIVE_STUDIO_ROAM_ENABLED (default
-- OFF), and the /pricing customer-catalog reader (fetchV2CustomerCatalog) now excludes
-- LIVE_STUDIO_ROAM BY NAME whenever that flag is off — mirroring the existing
-- TODAYS_FOCUS name-exclusion — so the owner-locked "not on /pricing until launch"
-- guarantee is preserved. Launch stays a single flag flip; the DB price is simply
-- recorded active so the (flag-gated) buy path works end-to-end when reached.
--
-- Live YouTube streaming remains gated separately: the Roam channel pool + broadcast
-- orchestration still need the owner's verified Setnayan channel + OAuth (G1/G3/G4).
-- Configuring channels and buying Roam does NOT require any of that.
--
-- Idempotent: a plain UPDATE keyed by service_code; re-running is a no-op. Never
-- clobbers a price change (only touches is_active).

UPDATE public.platform_retail_catalog_v2
   SET is_active = TRUE,
       updated_at = now()
 WHERE service_code = 'LIVE_STUDIO_ROAM'
   AND is_active IS DISTINCT FROM TRUE;

-- Informational verification (never fails the migration on re-run).
DO $$
DECLARE v_price numeric; v_active boolean;
BEGIN
  SELECT retail_price_php, is_active INTO v_price, v_active
    FROM public.platform_retail_catalog_v2 WHERE service_code = 'LIVE_STUDIO_ROAM';
  IF v_price IS NULL THEN
    RAISE NOTICE 'NOTE: LIVE_STUDIO_ROAM missing from platform_retail_catalog_v2 (seed migration 20270919479280 not applied?) — activation skipped.';
  ELSIF v_active THEN
    RAISE NOTICE 'LIVE_STUDIO_ROAM is now is_active=TRUE at price %/day (buyable behind the Roam flag).', v_price;
  END IF;
END $$;
