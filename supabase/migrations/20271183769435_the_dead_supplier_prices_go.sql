-- the_dead_supplier_prices_go
-- ============================================================================
-- ELEVEN SWITCHED-OFF SUPPLIER PRICES ARE DELETED. ONE STAYS, AND IT IS NOT
-- CLUTTER.
--
-- Owner 2026-08-29, of the switched-off supplier prices: *"okay to delete?"*
-- after the customer-side sweep on 2026-08-28 removed 35 and left the supplier
-- catalogue untouched.
--
-- ── HOW EACH ROW WAS JUDGED ────────────────────────────────────────────────
-- By the owner's own rule from the price-screen brief: a removability check must
-- ask whether a row has DONE anything, never only whether something points at
-- it. An FK is a pointer, not a job. Measured against production 2026-08-29 and
-- RE-MEASURED immediately before writing this, because main moved ~20 times in
-- between:
--
--   subscriptions · ad subscriptions · active ads · tool bundles ·
--   verifications · orders ever  →  ZERO for all twelve.
--
-- Then the half a database cannot see: does application code name the string?
--   · the six bidding-token packs   → 0 files. Tokens were retired entirely
--     2026-08-07; nothing grants, spends or sells one.
--   · vendor_custom_included_token  → 0 files.
--   · vendor_custom_photo_pack      → 1 file, and it is a DOCBLOCK LINE in
--     lib/vendor-custom-catalog.ts recording that the dial was removed from the
--     math and both configurators. The code constants beside it name base,
--     nationwide reach, event slot and domain — not these.
--   · vendor_custom_reach_step      → same, same file, same docblock.
--   · vendor_subdomain              → 1 file: daily-email-jobs.ts maps the
--     service key to the words "Custom Subdomain" for an order that already
--     exists. A pure string comparison; it never reads the catalogue row, and
--     zero orders have ever carried the key.
--   · booth_studio                  → 2 files, and NEITHER is this row. Both
--     are `vendor_set_booth_studio_content`, an unrelated RPC that merely
--     CONTAINS the word. 🔑 A substring match is not a reference.
--
-- ── THE ONE THAT STAYS: vendor_ai_addon_advanced ───────────────────────────
-- ⛔ NOT DELETED, and not because anything points at it — because it is PARKED,
-- not dead. `vendor-addon-selfgrant-guard.db.test.ts` asserts, in terms, that
-- the row EXISTS, that it is switched OFF, and that it is priced at ₱3,000
-- "so a fallback cannot under-charge". Its SKU is also a live constant
-- (VENDOR_AI_ADVANCED_SKU_CODE) wired into the activation spine.
-- Deleting it deletes a decision that was written down on purpose.
--
-- ── AND THE TWO ACTIVE BRANCH ROWS ARE DELIBERATELY UNTOUCHED ───────────────
-- `vendor_additional_branch` and `vendor_branch_28day` are BOTH active, both
-- ₱1,000, and duplicates of each other. They are not in scope here: one of them
-- is what the public pages read and the other's name is the prefix any future
-- branch order carries, so retiring either needs its readers repointed FIRST.
-- Nobody is affected meanwhile — zero branches have ever been bought. Named
-- rather than swept, because a duplicate deleted from the wrong side is a
-- customer quoted nothing.
--
-- 🔑 ANYTHING EVER SOLD MAY BE RETIRED, NEVER REMOVED. `orders.service_key` has
-- no foreign key to either catalogue — it is loose text — so deleting a sold SKU
-- is NOT blocked by the database and would orphan the receipt. That is why
-- `orders_ever` is in the measurement above and not assumed.
--
-- Idempotent and re-runnable: the DELETE is a no-op once the rows are gone, and
-- the post-condition below re-states the survivor rather than trusting it.
-- ============================================================================

BEGIN;

DELETE FROM public.vendor_billing_catalog
 WHERE is_active = FALSE
   AND sku_code IN (
     'booth_studio',
     'vendor_custom_included_token',
     'vendor_custom_photo_pack',
     'vendor_custom_reach_step',
     'vendor_subdomain',
     'vendor_token_pack_4',
     'vendor_token_pack_5',
     'vendor_token_pack_10',
     'vendor_token_pack_25',
     'vendor_token_pack_50',
     'vendor_token_pack_100'
   );

-- ⚠ RAISE, never a silent pass. If the parked Advanced row is ever swept by a
-- future edit to the list above, the guard that depends on it fails far away
-- from the cause; this fails here, naming it.
DO $$
DECLARE
  v_advanced INT;
BEGIN
  SELECT count(*) INTO v_advanced
    FROM public.vendor_billing_catalog
   WHERE sku_code = 'vendor_ai_addon_advanced';

  IF v_advanced <> 1 THEN
    RAISE EXCEPTION
      'vendor_ai_addon_advanced must survive this sweep — it is parked, not dead, and a db test asserts it exists at PHP 3,000 switched off';
  END IF;
END $$;

-- ── AND THE DUPLICATE BRANCH ROW IS TAKEN OFF SALE ─────────────────────────
-- 🔴 THERE WERE TWO ACTIVE BRANCH PRICES AND THE PUBLIC READ THE WRONG ONE.
-- `vendor_branch_28day` and `vendor_additional_branch` are both active, both
-- ₱1,000, and duplicates of each other — but the PURCHASE has always used
-- `vendor_additional_branch` (`BRANCH_SKU_CODE`, and the
-- `vendor_additional_branch__<id>` service key every branch order carries),
-- while the public price on /vendors and llms.txt quoted the OTHER one.
--
-- Nobody has been quoted wrongly: the two hold the same number and no branch has
-- ever been bought. It would have bitten the first time the branch price was
-- edited on /admin/pricing — the shown price and the charged price would have
-- moved apart, with nothing thrown. The repo already knew about it: a comment in
-- `v2-catalog.ts` recorded a ₱1 gap between them as "a known, reported defect".
--
-- ⚠ RETIRED, NOT DELETED, AND THE ORDER MATTERS. The public readers are
-- repointed to the charging row IN THE SAME CHANGE as this; taking the row off
-- sale after that is safe, deleting it is a separate act once nothing anywhere
-- names it. A duplicate destroyed from the wrong side is a customer quoted
-- nothing at all.
UPDATE public.vendor_billing_catalog
   SET is_active = FALSE,
       retired_at = COALESCE(retired_at, now()),
       retirement_reason = COALESCE(
         retirement_reason,
         'Duplicate of vendor_additional_branch, which is the row that charges. Public readers repointed 2026-08-29.'),
       replaced_by_sku_code = COALESCE(replaced_by_sku_code, 'vendor_additional_branch'),
       updated_at = now()
 WHERE sku_code = 'vendor_branch_28day'
   AND is_active = TRUE;

-- The charging row must still be on sale, or branches become unbuyable.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.vendor_billing_catalog
     WHERE sku_code = 'vendor_additional_branch' AND is_active
  ) THEN
    RAISE EXCEPTION
      'vendor_additional_branch must stay on sale — it is the row every branch order charges against';
  END IF;
END $$;

COMMIT;
