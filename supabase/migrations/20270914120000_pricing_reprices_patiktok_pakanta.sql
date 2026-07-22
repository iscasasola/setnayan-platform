-- pricing_reprices_patiktok_pakanta
--
-- Two clean single-SKU reprices from the owner's 2026-07-22 pricing answers
-- (DECISION_LOG 2026-07-22 · Pricing.md § 00.G #6 + #7):
--   • Patiktok  (PATIKTOK_COMPILER)  ₱1,499/day → ₱1,500/day  (round-number
--     re-base, matching the catalog-wide charm→round pass: Live Studio ₱2,500 ·
--     Pakanta ₱2,500 · 3D Plan ₱3,000 · Monogram Pro ₱1,000).
--   • Pakanta   (PAKANTA)            ₱2,499     → ₱2,500       (owner #7: Music
--     Creator folds into Pakanta at ₱2,500; the orphan Music Creator Studio card
--     is retired in the same PR — app-side, it never had a catalog row of its own).
--
-- Pure price updates on active rows — NOT retirements, NO bundle/entitlement
-- change, NO grandfathering needed (entitlement reads orders.status, unaffected
-- by a price change). The larger bundle restructure (Website PRO ₱3,500 ·
-- Editorial PRO / Cinematic Reveal / Live Background → bundle-only · Monogram Pro
-- ₱1,000 + Live Background) is a SEPARATE PR — it touches ~8 buy/display surfaces
-- + the lib/v2-catalog.ts sellability map and is deliberately not folded in here.
--
-- Idempotent: each UPDATE no-ops when the row is already at the target price.

BEGIN;

UPDATE public.platform_retail_catalog_v2
SET    retail_price_php = 1500.00,
       updated_at       = now()
WHERE  service_code     = 'PATIKTOK_COMPILER'
  AND  retail_price_php IS DISTINCT FROM 1500.00;

UPDATE public.platform_retail_catalog_v2
SET    retail_price_php = 2500.00,
       updated_at       = now()
WHERE  service_code     = 'PAKANTA'
  AND  retail_price_php IS DISTINCT FROM 2500.00;

DO $$
DECLARE
  v_patiktok numeric;
  v_pakanta  numeric;
BEGIN
  SELECT retail_price_php INTO v_patiktok
    FROM public.platform_retail_catalog_v2 WHERE service_code = 'PATIKTOK_COMPILER';
  SELECT retail_price_php INTO v_pakanta
    FROM public.platform_retail_catalog_v2 WHERE service_code = 'PAKANTA';

  IF v_patiktok IS NULL THEN
    RAISE EXCEPTION 'PATIKTOK_COMPILER missing from platform_retail_catalog_v2';
  END IF;
  IF v_pakanta IS NULL THEN
    RAISE EXCEPTION 'PAKANTA missing from platform_retail_catalog_v2';
  END IF;
  IF v_patiktok <> 1500.00 THEN
    RAISE EXCEPTION 'Patiktok price did not settle (got %, expected 1500)', v_patiktok;
  END IF;
  IF v_pakanta <> 2500.00 THEN
    RAISE EXCEPTION 'Pakanta price did not settle (got %, expected 2500)', v_pakanta;
  END IF;
END $$;

COMMIT;
