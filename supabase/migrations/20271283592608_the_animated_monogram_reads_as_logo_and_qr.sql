-- the_animated_monogram_reads_as_logo_and_qr
-- Created via `pnpm migration:new`. Data-only and idempotent.
--
-- ── WHY ─────────────────────────────────────────────────────────────────────
-- Owner ruling 2026-10-22 (corpus DECISION_LOG "EVENT HUB PRO, PART BY PART", question 2, "yes"): the standalone
-- ₱500 Animated Monogram is RETIRED FROM SALE — the animated logo is the Logo & QR part of Event Hub Pro now
-- (`COUPLE_HUB_PART_LOGO_QR`, migration 20271282742262). Existing ANIMATED_MONOGRAM owners read as owning Logo & QR
-- (`SKU_OWNERSHIP_ALIASES`, apps/web/lib/entitlements.ts — the read side, no backfill), so nobody who paid is asked
-- again, and what they paid counts toward everything at the part's web value.
--
--   · is_active = FALSE, NOT deleted: every ownership read still names the code (the alias, the animation gate
--     `eventAnimatedMonogramActive`, the Studio tile's badge), and a past order must keep resolving.
--   · No price is written or read here.
--
-- ⚠ IN PRODUCTION THIS IS A REAL CHANGE. It reaches prod only through `deploy-prod`'s `supabase db push --include-all`.

UPDATE public.platform_retail_catalog_v2
   SET is_active = FALSE,
       updated_at = now()
 WHERE service_code = 'ANIMATED_MONOGRAM'
   AND is_active = TRUE;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.platform_retail_catalog_v2 WHERE service_code = 'ANIMATED_MONOGRAM' AND is_active) THEN
    RAISE EXCEPTION 'ANIMATED_MONOGRAM is still on sale — the Logo & QR part replaces it';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.platform_retail_catalog_v2 WHERE service_code = 'COUPLE_HUB_PART_LOGO_QR' AND is_active) THEN
    RAISE EXCEPTION 'the Logo & QR part is not on sale — retiring the Animated Monogram would leave the animation unsellable';
  END IF;
END $$;
