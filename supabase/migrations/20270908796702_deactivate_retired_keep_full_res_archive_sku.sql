-- Deactivate the retired "Keep Full-Res" (HIGH_RES_ARCHIVE) SKU.
--
-- The owner retired "Keep Full-Res" ENTIRELY on 2026-07-17 (Pricing.md § 2.1),
-- but that retirement never landed in code: migration 20270723385655
-- (2026-07-11) had REVIVED it as is_active=true, ₱999/yr, and it sorts AFTER the
-- June retire migration — so the studio still renders a live, purchasable
-- "Keep Full-Res · ₱999/yr" buy card. `app/dashboard/[eventId]/studio/papic/
-- page.tsx` renders that card only when `keepFullResPricePhp` is truthy, and
-- that value is `null` whenever the catalog row is is_active=false (line ~304),
-- so flipping this off auto-hides the buy card. The is_active-filtered v2 catalog
-- readers (lib/v2-catalog.ts `.eq('is_active', true)`) also drop it from every
-- listing. This finishes the 2026-07-17 retirement in code.
--
-- Legacy buyers are UNAFFECTED: `ownsKeepFullRes` (an active-order check,
-- independent of the catalog is_active flag) still shows their "active" banner,
-- the drop-warning skip-guard still spares them, and lib/papic-fullres-drop.ts
-- still honors their originals by ORDER OWNERSHIP, not by catalog is_active. The
-- row is kept (not deleted) so historical order rows keep resolving.
--
-- Never-rename lock honored: is_active flip only, no service_code/tier change.
-- Idempotent (IS DISTINCT FROM guard).
UPDATE public.platform_retail_catalog_v2
   SET is_active = FALSE,
       updated_at = NOW()
 WHERE service_code = 'HIGH_RES_ARCHIVE'
   AND is_active IS DISTINCT FROM FALSE;
