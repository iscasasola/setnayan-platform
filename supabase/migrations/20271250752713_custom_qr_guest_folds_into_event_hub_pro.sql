-- custom_qr_guest_folds_into_event_hub_pro
-- Created via `pnpm migration:new`. Idempotent (an UPDATE that is a no-op once applied).
--
-- ⚖ THE "CUSTOM QR PER GUEST" PRODUCT FOLDS INTO EVENT HUB PRO (spec corpus
-- DECISION_LOG.md, 2026-09-27 — "QR LOGO: AFTER APPLE, WITH SHAPES · 'CUSTOM QR
-- PER GUEST' FOLDS INTO EVENT HUB PRO", brought forward by the 2026-09-28 row
-- "EVERY EVENT HUB BUILD FINISHES BEFORE THE APPLE CHECK"). Owner, verbatim:
-- *"QR is free with Setnayan Logo on the center. all Guest QR must have Setnayan
-- Logo on the center. QR on Pro makes the logo use their logo on the center. and
-- change the shape, pattern style."* · *"Fold into Event Hub Pro"*.
--
-- CUSTOM_QR_GUEST sold palette-tinted guest QR codes on their own (₱0.00 · active
-- in production since migration 20271184674948). That colour is now one of the
-- Pro QR's choices (apps/web/lib/qr-look.ts), decided by COUPLE_WEBSITE_PRO —
-- one Pro, not two. So the row goes OFF SALE:
--
--   · is_active = FALSE, NOT deleted. The retired-catalogue rule
--     (20271179454449) deletes only rows nothing reads by literal string, and
--     this code is still read — as a FREE key — by the seat pass (lib/seat-pass.ts,
--     FREE_FOR_ALL_SKUS in lib/entitlements.ts), until `rd/find-your-seat` gives
--     the pass its own gate. Inactive is what takes it off every buy surface
--     (fetchV2CustomerCatalog filters on the flag) and out of llms.txt's
--     REQUIRED_RETAIL (apps/web/lib/llms-txt.ts, changed in the same commit).
--   · bundle_components is untouched: an inactive child contributes nothing to a
--     bundle's worth or inclusions (the PAPIC_SEATS precedent), and the seed must
--     keep matching BUNDLE_MEMBERS / BUNDLE_CHILD_SKUS for lint-entitlement-gates.
--   · No price is written or read here. Nothing else changes on the row.
--
-- The CI fixture apps/web/lib/llms-txt-guard-input.ts flips is_active in the same
-- commit (tests/db/llms-fixture-matches-the-catalog.db.test.ts holds the pair).

UPDATE public.platform_retail_catalog_v2
   SET is_active = FALSE,
       updated_at = now()
 WHERE service_code = 'CUSTOM_QR_GUEST'
   AND is_active = TRUE;

-- ── PROVE IT ─────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.platform_retail_catalog_v2
     WHERE service_code = 'CUSTOM_QR_GUEST' AND is_active = TRUE
  ) THEN
    RAISE EXCEPTION 'CUSTOM_QR_GUEST is still on sale — the fold into Event Hub Pro did not take';
  END IF;
END $$;
