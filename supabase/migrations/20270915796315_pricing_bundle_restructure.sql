-- pricing_bundle_restructure
--
-- The bundle half of the owner's 2026-07-22 pricing answers (DECISION_LOG
-- 2026-07-22 · Pricing.md § 00.G #1–#3). The safe cleanups + reprices already
-- shipped (migration 20270914120000 / PR #3559); this is the money core of the
-- restructure:
--   • Website PRO  (COUPLE_WEBSITE_PRO)  REACTIVATE + reprice ₱4,999 → ₱3,500.
--     Becomes the ONLY path to the Cinematic Reveal + Editorial PRO.
--   • Monogram PRO (ANIMATED_MONOGRAM)   reprice ₱999 → ₱1,000, now ALSO confers
--     the LED Live Background (entitlement alias added in lib/entitlements.ts).
--   • Editorial PRO      (EDITORIAL_PRO)       → is_active=false (bundle-only).
--   • Cinematic Reveal   (STD_PREMIUM_OPENINGS) → is_active=false (bundle-only).
--   • Live Background    (LIVE_BACKGROUND)      → is_active=false (bundle-only).
--
-- ENFORCEMENT: is_active=false is the checkout retirement switch —
-- resolveServiceSellability() (lib/v2-catalog.ts) reads it directly and
-- submitOrderAction rejects a retired SKU, so a standalone purchase of any of
-- the three is blocked server-side. NO grandfathering needed: ownership reads
-- orders.status (lib/entitlements.ts), so every existing owner — direct OR via
-- the COUPLE_WEBSITE_PRO / ANIMATED_MONOGRAM alias — keeps access. The app-side
-- work (upsell rewires so no dead buy button, display fixes) ships in the same
-- PR; the entitlement alias LIVE_BACKGROUND ← ANIMATED_MONOGRAM is code, not DB.
--
-- The bundle-contents line on /pricing renders from `description` (the app must
-- never hardcode it — owner "every price is admin-managed"), so this sets the
-- Website PRO + Monogram PRO descriptions too.
--
-- Idempotent: each UPDATE no-ops when the row already matches.

BEGIN;

-- Website PRO — reactivate + reprice ₱3,500 + umbrella description.
UPDATE public.platform_retail_catalog_v2
SET    is_active       = TRUE,
       retail_price_php = 3500.00,
       description     = 'Every premium touch across your whole website in one unlock — the Save-the-Date Cinematic Reveal, RSVP, the on-the-day page, and Editorial PRO — plus the Setnayan watermark removed everywhere. The only way to get the Cinematic Reveal and Editorial PRO.',
       updated_at      = now()
WHERE  service_code    = 'COUPLE_WEBSITE_PRO'
  AND  (is_active IS DISTINCT FROM TRUE
        OR retail_price_php IS DISTINCT FROM 3500.00
        OR description IS DISTINCT FROM 'Every premium touch across your whole website in one unlock — the Save-the-Date Cinematic Reveal, RSVP, the on-the-day page, and Editorial PRO — plus the Setnayan watermark removed everywhere. The only way to get the Cinematic Reveal and Editorial PRO.');

-- Monogram PRO — reprice ₱1,000 + now includes the LED Live Background.
UPDATE public.platform_retail_catalog_v2
SET    retail_price_php = 1000.00,
       description     = 'Your monogram, drawn to life across your QR, your page, and your signage — and up on the LED stage screen. Includes the Live Background.',
       updated_at      = now()
WHERE  service_code    = 'ANIMATED_MONOGRAM'
  AND  (retail_price_php IS DISTINCT FROM 1000.00
        OR description IS DISTINCT FROM 'Your monogram, drawn to life across your QR, your page, and your signage — and up on the LED stage screen. Includes the Live Background.');

-- The three now-bundle-only SKUs — deactivate the standalone sale.
UPDATE public.platform_retail_catalog_v2
SET    is_active = FALSE, updated_at = now()
WHERE  service_code = 'EDITORIAL_PRO'        AND is_active IS DISTINCT FROM FALSE;

UPDATE public.platform_retail_catalog_v2
SET    is_active = FALSE, updated_at = now()
WHERE  service_code = 'STD_PREMIUM_OPENINGS' AND is_active IS DISTINCT FROM FALSE;

UPDATE public.platform_retail_catalog_v2
SET    is_active = FALSE, updated_at = now()
WHERE  service_code = 'LIVE_BACKGROUND'      AND is_active IS DISTINCT FROM FALSE;

DO $$
DECLARE
  r RECORD;
BEGIN
  SELECT retail_price_php, is_active INTO r
    FROM public.platform_retail_catalog_v2 WHERE service_code = 'COUPLE_WEBSITE_PRO';
  IF NOT FOUND THEN RAISE EXCEPTION 'COUPLE_WEBSITE_PRO missing'; END IF;
  IF r.retail_price_php <> 3500.00 OR NOT r.is_active THEN
    RAISE EXCEPTION 'COUPLE_WEBSITE_PRO did not settle (price %, active %)', r.retail_price_php, r.is_active;
  END IF;

  SELECT retail_price_php INTO r
    FROM public.platform_retail_catalog_v2 WHERE service_code = 'ANIMATED_MONOGRAM';
  IF NOT FOUND THEN RAISE EXCEPTION 'ANIMATED_MONOGRAM missing'; END IF;
  IF r.retail_price_php <> 1000.00 THEN
    RAISE EXCEPTION 'ANIMATED_MONOGRAM price did not settle (got %)', r.retail_price_php;
  END IF;

  FOR r IN
    SELECT service_code, is_active FROM public.platform_retail_catalog_v2
    WHERE service_code IN ('EDITORIAL_PRO', 'STD_PREMIUM_OPENINGS', 'LIVE_BACKGROUND')
  LOOP
    IF r.is_active THEN
      RAISE EXCEPTION '% is still active (should be bundle-only)', r.service_code;
    END IF;
  END LOOP;

  -- Informational: prove no owner is stripped (ownership reads orders.status).
  RAISE NOTICE 'Bundle restructure applied. Existing EDITORIAL_PRO / STD_PREMIUM_OPENINGS / LIVE_BACKGROUND owners keep access via orders.status + the COUPLE_WEBSITE_PRO / ANIMATED_MONOGRAM aliases.';
END $$;

COMMIT;
