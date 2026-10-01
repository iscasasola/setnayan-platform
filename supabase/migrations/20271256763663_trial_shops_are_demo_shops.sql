-- trial_shops_are_demo_shops
--
-- 2026-09-30 · DATA ONLY. The owner's two trial shops stop reading as real
-- verified suppliers.
--
-- Owner, DECISION_LOG 2026-09-29 "LANE 2 §2C — ALL FIVE OWNER QUESTIONS
-- ANSWERED" (1): "SetnaProd and Saysay become `is_demo = true` — owner's yes for
-- that prod write; they leave the public sitemap and stop reading as real
-- verified suppliers (accepted cost: Discover's Shops shelf and the marketplace
-- show nothing until a real supplier joins; the 'Booked 2×' from test bookings
-- goes with them)."
--
-- 🔑 BY STABLE ID, NEVER BY NAME. A business name is typed by a person and can
-- change (and "Saysay" also appears in fixture names); the primary key cannot.
--   51858369-2970-466b-99a2-a6713a7ea1bb  SetnaProd (slug `setnaprod`, the
--       owner's shop — the id its R2 logo prefix is filed under, recorded as
--       "the live shop setnaprod" by the 2026-08-10 prod-id sweep)
--   d266c234-3aca-46c3-b1c8-6a5c78e3f310  Saysay Live Band & Hosting (the
--       testnayan2 fixture, DECISION_LOG 2026-07-30 / 2026-08-01)
-- ⚠ Neither id was re-read from production by this session (no database
-- access). If either no longer exists, the UPDATE matches nothing and the
-- NOTICE below says how many rows it changed — it never fails the deploy.
--
-- WHAT THE FLAG DOES, and what else shipped with it so it actually does it:
--   · Every public reader of shops already skipped `is_demo` EXCEPT two, fixed
--     in the same change: `lib/live-shops.ts` LIVE_SHOP_GATE (the front door's
--     Shops shelf and the /explore count) and
--     `lib/marketplace-service-cards.ts` (the /explore body). Both shops are
--     fully verified, so without those this row changed nothing on screen.
--   · The admin "Cleanup ALL demo vendors" / regenerate / seed routes deleted
--     EVERY `is_demo` shop. They now delete only ownerless (seeded) rows —
--     both of these have owners — held by
--     `lib/a-demo-cleanup-never-deletes-an-owned-shop.test.ts`.
--   · Nothing is deleted. The owners still open their own dashboards; existing
--     bookings, threads and orders are untouched. To undo: set it back to false
--     for the same two ids.
--
-- 🧮 `vendor_services.is_demo` is deliberately NOT touched: every reader above
-- checks the SHOP flag, and an UPDATE on `vendor_services` fires that table's
-- card triggers for no gain. The rows here fire only
-- `guard_vendor_profiles_entitlement` (no-op outside `authenticated`/`anon`)
-- and `clamp_vendor_waitlist_to_tier` (clamps, never raises).

DO $trial$
DECLARE
  v_changed integer;
BEGIN
  UPDATE public.vendor_profiles
     SET is_demo = TRUE
   WHERE vendor_profile_id IN (
           '51858369-2970-466b-99a2-a6713a7ea1bb'::uuid,  -- SetnaProd
           'd266c234-3aca-46c3-b1c8-6a5c78e3f310'::uuid   -- Saysay
         )
     AND is_demo IS DISTINCT FROM TRUE;
  GET DIAGNOSTICS v_changed = ROW_COUNT;
  RAISE NOTICE 'trial_shops_are_demo_shops: % shop(s) marked is_demo = true (expected 2 on production, 0 on a fresh replay or a re-run)', v_changed;
END
$trial$;
