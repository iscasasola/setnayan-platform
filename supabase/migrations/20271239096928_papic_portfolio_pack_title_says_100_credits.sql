-- The ₱500 supplier pack SELLS 25 credits and GRANTS 100. Make the shop window
-- tell the truth.
--
-- WHAT WAS WRONG
-- `vendor_billing_catalog.sku_code = 'vendor_papic_portfolio_pack'` has read
--   "Photo importation fee — 25 Papic credits for your portfolio (per event)"
-- since it was seeded on 2026-09-05. The owner raised what one ₱500 buys from
-- 25 to 100 on 2026-09-06 — `lib/vendor-papic-credits.ts` records the decision
-- and the arithmetic behind it ("The price did not move; what one ₱500 buys
-- did"), and the code has granted `VENDOR_PAPIC_PORTFOLIO_PACK_CREDITS = 100`
-- ever since. The catalogue row was never touched: measured 2026-09-22, its
-- `updated_at` was still the 2026-09-05 seed timestamp.
--
-- So a supplier is told they are buying a QUARTER of what they actually get.
--
-- WHY IT SURVIVED, AND THE DURABLE LESSON
-- It errs in the customer's favour, so nobody ever complained. A generous lie
-- raises no support ticket — which is why this needed a measurement to find it
-- rather than a bug report. 🔑 When a constant moves, grep for every place the
-- number is SPOKEN as well as every place it is USED. The catalogue row lives
-- outside the repo, so no test in this codebase could ever have seen it.
--
-- WHY THIS IS A MIGRATION AND NOT AN ADMIN EDIT
-- `/admin/pricing` cannot fix it. `app/admin/pricing/actions.ts` → saveVendorRow
-- updates `price_php`, `description` and `is_active` ONLY, and says so:
-- "Title stays migration-owned (wires tier gates)". The title is deliberately
-- not admin-writable, so correcting it is a schema-side change by design.
--
-- ⚠ NOT A PRICE CHANGE. `price_php` stays 500 and is not referenced below. The
-- number of credits granted stays 100 and lives in TypeScript, not here. This
-- migration changes ONE STRING, so the label matches the grant that already
-- happens.

-- Idempotent and self-correcting: keyed on the SKU, and the WHERE clause makes a
-- re-run a no-op. It deliberately does NOT match on the old title — if somebody
-- has since reworded the row by hand we still want the number right, and an
-- exact-title match would silently skip that case.
UPDATE public.vendor_billing_catalog
   SET title      = 'Photo importation fee — 100 Papic credits for your portfolio (per event)',
       updated_at = NOW()
 WHERE sku_code   = 'vendor_papic_portfolio_pack'
   AND title IS DISTINCT FROM
       'Photo importation fee — 100 Papic credits for your portfolio (per event)';

-- Prove it landed, because a zero-row UPDATE is success-shaped and nothing above
-- would have noticed. A missing row is worth failing on: this SKU is seeded by
-- an earlier migration, so its absence means the catalogue has drifted.
DO $$
DECLARE
  v_title TEXT;
BEGIN
  SELECT title INTO v_title
    FROM public.vendor_billing_catalog
   WHERE sku_code = 'vendor_papic_portfolio_pack';

  IF v_title IS NULL THEN
    RAISE EXCEPTION
      'vendor_papic_portfolio_pack is missing from vendor_billing_catalog — expected it to be seeded already';
  END IF;

  IF v_title NOT LIKE '%100 Papic credits%' THEN
    RAISE EXCEPTION
      'vendor_papic_portfolio_pack title did not take the 100-credit wording: %', v_title;
  END IF;
END $$;
