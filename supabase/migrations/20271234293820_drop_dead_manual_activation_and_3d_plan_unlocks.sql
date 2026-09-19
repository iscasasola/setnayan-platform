-- drop_dead_manual_activation_and_3d_plan_unlocks
-- ============================================================================
-- S34 · 2026-09-18 · two money-tier orphans from the both-ends baseline
-- (apps/web/tests/db/ugat-both-ends.baseline.txt). Each had ONE end, and the
-- missing end belongs to a feature that is retired, so the surviving end goes.
--
-- 1. public.verify_and_activate_manual_payment(text, uuid) — rpc-no-caller.
--    Flipped a manual_payment_logs row to VERIFIED_AND_ACTIVATED and fanned the
--    ordered items out into event_software_activations_v2. Activation no longer
--    works that way: a couple's SKU is live when its `orders` row is admin-
--    approved (`paid`/`fulfilled` → lib/entitlements.ts eventSkuActive), and
--    every reader of event_software_activations_v2 on the payment path was
--    already moved off it (see the comments in app/[slug]/_lib/loaders.ts,
--    app/dashboard/[eventId]/live/page.tsx, lib/face-blur.ts).
--    MEASURED IN PROD 2026-09-18: manual_payment_logs has 0 rows ever (0 in
--    VERIFIED_AND_ACTIVATED) and event_software_activations_v2 has 0 rows, so
--    this function has never activated anything. It was also EXECUTE-granted
--    to anon + authenticated with an unpinned search_path, which is a door
--    nobody needs open.
--    manual_payment_logs itself is NOT dropped: /api/v1/billing/initialize-maya
--    still inserts into it. That is a separate question.
--
-- 2. public.event_vendor_3d_plan_unlocks — table-no-writer.
--    The vendor-unlocks-a-₱1,000-3D-Plan-for-the-couple discount. Retired end
--    to end on 2026-09-05 (changelog.d/the-3d-plan-is-free-for-couples.md):
--    SEATING_3D is free for couples, so a discount on it cannot be true. That
--    PR deleted the writer (vendor-3d-plan-unlock-actions.ts), the reader
--    (lib/vendor-3d-plan-unlock.ts) and the price-resolver branch, and left the
--    table. 0 rows in prod. No view, function, trigger or FK references it.
--
-- NOT HERE: vendor_ad_subscriptions (also table-no-writer). It is still READ —
-- vendor_active_ads → vendor_market_stats.ad_rank orders the marketplace — and
-- boosting is paused "we add it later" (lib/sku-catalog.ts RETIRED_SKU_CODES),
-- not retired. Whether to rebuild the purchase or remove the rank is an owner
-- call; it stays in the baseline until he makes it.
--
-- Idempotent (IF EXISTS). No data is lost: both objects hold nothing.
-- ============================================================================

BEGIN;

DROP FUNCTION IF EXISTS public.verify_and_activate_manual_payment(text, uuid);

DROP TABLE IF EXISTS public.event_vendor_3d_plan_unlocks;

DO $$
BEGIN
  IF to_regprocedure('public.verify_and_activate_manual_payment(text, uuid)') IS NOT NULL THEN
    RAISE EXCEPTION 'POST-CONDITION FAILED: verify_and_activate_manual_payment still exists';
  END IF;
  IF to_regclass('public.event_vendor_3d_plan_unlocks') IS NOT NULL THEN
    RAISE EXCEPTION 'POST-CONDITION FAILED: event_vendor_3d_plan_unlocks still exists';
  END IF;
END $$;

COMMIT;
