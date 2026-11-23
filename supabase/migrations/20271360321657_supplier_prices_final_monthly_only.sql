-- supplier_prices_final_monthly_only
-- Created via `pnpm migration:new` (scripts/new-migration.mjs). Idempotent: a guarded precondition · UPDATEs that touch
-- only rows not already in their final state · COALESCE'd retire fields · a read-only post-condition. No table, column,
-- function, policy or grant changes.
--
-- ============================================================================
-- 💰 THE SUPPLIER PLANS SELL AT THE OWNER'S FINAL PRICES, MONTHLY ONLY. NO YEARLY, NO ADD-ONS.
-- ============================================================================
-- DECISION_LOG 2026-11-22:
--   · "SUPPLIER PLAN PRICES, FINAL" — owner, verbatim: *"okay 1990,4990 and 8990"* (per month, Plus · Pro · Ultra).
--   · "NO YEARLY SUPPLIER/COORDINATOR PLAN ANYWHERE" — owner, verbatim: *"no yearly for any supplier subscription.
--     remove the annual subscription everywhere"* ⇒ retire solo/pro/enterprise_vendor_annual, rows kept.
--   · "PAID PLANS = THREE STORAGE SIZES … FINAL SHAPE" (3) — *nothing else is sold to suppliers as a plan or add-on*
--     ⇒ the Ultra extra seat and extra branch retire too. The app already refuses both (`canBuyExtraSeats` /
--     `canBuyExtraBranches` answer no on every plan since PR #8186); this makes the catalogue agree.
--
-- Measured on production 2026-11-23 (read-only, before this was written):
--   · active rows: solo_vendor_monthly 1,490 · pro_vendor_monthly 4,990 · enterprise_vendor_monthly 9,990 ·
--     the three *_vendor_annual rows · vendor_extra_seat · vendor_additional_branch.
--   · vendor_subscriptions: 2 rows, both solo_vendor_monthly. No row on an annual, seat or branch SKU.
--   · vendor_profiles: no tier_billing_cycle / pending_tier_billing_cycle 'annual', no pending annual SKU,
--     no shop with extra_agent_seats > 0.
--
--   1 · PRECONDITION. Refuse to run if any shop holds or is scheduled onto a SKU this retires, or owns bought seats.
--       Then the owner decides; this never strands a paying shop by itself.
--   2 · The three monthly prices are set. `create_vendor_subscription` reads `price_php` at order time, so a NEW order
--       charges the new price. Rows already paid keep the amount they were charged (`vendor_subscriptions.amount_php`).
--       ⚠ What the two shops on Plus pay at RENEWAL is a separate owner call (DECISION_LOG "PRICES, FINAL", last line);
--       nothing here changes an existing subscription row.
--   3 · Five rows retire: off sale + retired_at + retirement_reason. Never deleted: an order or subscription may name
--       one. `create_vendor_subscription` already refuses an inactive SKU (`is_active = TRUE`, 20271177335213).
--
-- ── WHAT IS DELIBERATELY LEFT ────────────────────────────────────────────────
--   · `vendor_deep_search` (₱ per search) — its retirement and the one-run-a-month rule are subscriptions PR 1b.
--   · The annual arm inside `create_vendor_subscription` (365 days) — inert once no annual SKU is active.
--
-- Never applied by hand: the pipeline (`supabase db push --include-all`) applies it.
-- ============================================================================

BEGIN;

-- ── 1 · nobody holds or is moving onto a SKU that retires ─────────────────────
DO $$
DECLARE
  v_subs    INT;
  v_pending INT;
  v_cycle   INT;
  v_seats   INT;
BEGIN
  SELECT count(*) INTO v_subs
    FROM public.vendor_subscriptions
   WHERE sku_code IN ('solo_vendor_annual', 'pro_vendor_annual', 'enterprise_vendor_annual',
                      'vendor_extra_seat', 'vendor_additional_branch');
  SELECT count(*) INTO v_pending
    FROM public.vendor_profiles
   WHERE pending_tier_sku_code IN ('solo_vendor_annual', 'pro_vendor_annual', 'enterprise_vendor_annual');
  SELECT count(*) INTO v_cycle
    FROM public.vendor_profiles
   WHERE tier_billing_cycle::text = 'annual' OR pending_tier_billing_cycle::text = 'annual';
  SELECT count(*) INTO v_seats
    FROM public.vendor_profiles
   WHERE COALESCE(extra_agent_seats, 0) > 0;
  IF v_subs + v_pending + v_cycle + v_seats > 0 THEN
    RAISE EXCEPTION
      'supplier_prices_final_monthly_only: % subscription row(s) on a retiring SKU, % shop(s) scheduled onto an annual '
      'SKU, % shop(s) on an annual cycle, % shop(s) with bought seats. Nothing was changed. Ask the owner what each of '
      'them becomes, then re-run.',
      v_subs, v_pending, v_cycle, v_seats;
  END IF;
END $$;

-- ── 2 · the owner's final monthly prices ──────────────────────────────────────
UPDATE public.vendor_billing_catalog v
   SET price_php  = x.php,
       updated_at = NOW()
  FROM (VALUES ('solo_vendor_monthly',       1990::numeric),
               ('pro_vendor_monthly',        4990::numeric),
               ('enterprise_vendor_monthly', 8990::numeric)) AS x(sku, php)
 WHERE v.sku_code = x.sku
   AND v.price_php IS DISTINCT FROM x.php;

-- ── 3 · no yearly plan, no add-on ─────────────────────────────────────────────
UPDATE public.vendor_billing_catalog
   SET is_active         = FALSE,
       retired_at        = COALESCE(retired_at, NOW()),
       retirement_reason = COALESCE(retirement_reason,
         CASE WHEN offering_type = 'subscription_annual'
              THEN 'Owner 2026-11-22: no yearly supplier plan — monthly only (DECISION_LOG "NO YEARLY SUPPLIER/COORDINATOR PLAN ANYWHERE").'
              ELSE 'Owner 2026-11-22: nothing else is sold to suppliers as a plan or add-on (DECISION_LOG "PAID PLANS = THREE STORAGE SIZES … FINAL SHAPE").'
         END),
       replaced_by_sku_code = COALESCE(replaced_by_sku_code,
         CASE sku_code
           WHEN 'solo_vendor_annual'       THEN 'solo_vendor_monthly'
           WHEN 'pro_vendor_annual'        THEN 'pro_vendor_monthly'
           WHEN 'enterprise_vendor_annual' THEN 'enterprise_vendor_monthly'
         END),
       updated_at        = NOW()
 WHERE sku_code IN ('solo_vendor_annual', 'pro_vendor_annual', 'enterprise_vendor_annual',
                    'vendor_extra_seat', 'vendor_additional_branch')
   AND (is_active OR retired_at IS NULL);

-- ── 4 · post-condition: exactly the final ladder is on sale ───────────────────
DO $$
DECLARE
  v_wrong_price INT;
  v_monthly     INT;
  v_still_on    INT;
BEGIN
  SELECT count(*) INTO v_monthly
    FROM public.vendor_billing_catalog
   WHERE sku_code IN ('solo_vendor_monthly', 'pro_vendor_monthly', 'enterprise_vendor_monthly')
     AND is_active;
  SELECT count(*) INTO v_wrong_price
    FROM public.vendor_billing_catalog
   WHERE (sku_code = 'solo_vendor_monthly'       AND price_php <> 1990)
      OR (sku_code = 'pro_vendor_monthly'        AND price_php <> 4990)
      OR (sku_code = 'enterprise_vendor_monthly' AND price_php <> 8990);
  SELECT count(*) INTO v_still_on
    FROM public.vendor_billing_catalog
   WHERE is_active
     AND (offering_type IN ('subscription_annual', 'seat', 'branch')
          OR sku_code IN ('solo_vendor_annual', 'pro_vendor_annual', 'enterprise_vendor_annual',
                          'vendor_extra_seat', 'vendor_additional_branch'));
  IF v_monthly <> 3 OR v_wrong_price > 0 OR v_still_on > 0 THEN
    RAISE EXCEPTION
      'supplier_prices_final_monthly_only post-condition: % of 3 monthly plans on sale, % at a wrong price, '
      '% yearly/seat/branch row(s) still on sale.',
      v_monthly, v_wrong_price, v_still_on;
  END IF;
END $$;

COMMIT;
