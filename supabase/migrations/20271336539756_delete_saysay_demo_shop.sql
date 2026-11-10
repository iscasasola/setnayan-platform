-- DELETE THE SAYSAY DEMO SHOP — permanently (owner, in chat, 2026-11-11:
-- "delete say say shop" · "we do not need it anymore" · "Delete permanently").
--
-- THE SHOP: "Saysay Host and Band"
--   vendor_profile_id  d266c234-3aca-46c3-b1c8-6a5c78e3f310   (the ONLY key used below)
--   public_id          S89B-THD5QCKPWM
--   business_slug      saysay-live-band-and-hosting-fix
--   is_demo            true   (owned by the testnayan2 fixture account)
--
-- 🔒 TARGETED BY ITS UUID, NEVER BY NAME OR BY THE FLAG. `is_demo = true` alone
-- is not a safe filter (app/api/admin/demo/cleanup/route.ts says why), so the
-- flag is used only as a GUARD: if this uuid exists and is NOT a demo shop the
-- migration RAISES and deletes nothing.
--
-- 🔁 IDEMPOTENT. If the row is already gone — a re-run, or a fresh PGlite/branch
-- replay where it never existed — this is a NOTICE and a no-op.
--
-- WHAT GOES (rows that exist only because of this shop):
--   • the shop's chat messages and its 3 conversations (deleted explicitly
--     first, so no SET NULL from the proposals delete ever touches a message
--     that is about to go anyway);
--   • the one booking row that belongs to NO event (event_id IS NULL — a
--     2026-07-30 SongDesk test row; with its shop gone it would point at nothing);
--   • the "business" dependent row that mirrors this shop;
--   • vendor_service_price_history (keyed by vendor_profile_id with NO foreign
--     key, so a cascade would leave it orphaned);
--   • registered_crew_devices / manpower_gigs (ON DELETE NO ACTION — 0 rows at
--     map time, deleted here so a late row cannot block the delete);
--   • then the vendor_profiles row, whose ~130 ON DELETE CASCADE children
--     (services, team seat, songs, schedule pools, proposals, unlocks, follows,
--     profile views, booking-fee ledger + charges, verification rows, …) go with it.
--
-- WHAT STAYS (shared parents, and records the schema deliberately keeps):
--   • the testnayan2 account and every user; every event;
--   • the two bookings ON EVENTS (event_vendors on "Ana & Miguel" and
--     "Rosa & Ben") — each has a logged couple payment, and
--     `event_vendors_refuse_delete_with_payments` (SUP-67) exists precisely so a
--     payment is never deleted as a side effect of removing its supplier. Their
--     FKs are ON DELETE SET NULL, so they stay on the couple's page under their
--     own `vendor_name`, unlinked from the shop;
--   • orders (ON DELETE SET NULL — the paid ₱837.50 booking-fee order stays as
--     money history, with no shop);
--   • admin_audit_log (history is not erased).
--
-- 💰 FAIL CLOSED ON MONEY THE SHOP WAS OWED/BILLED: vendor_payouts and
-- vendor_ad_subscriptions are ON DELETE RESTRICT. Neither has a row for this
-- shop at map time; if one ever appears, this RAISES rather than deleting it.
--
-- R2 objects are NOT deleted here (a migration cannot reach R2).

DO $$
DECLARE
  v_shop     CONSTANT uuid := 'd266c234-3aca-46c3-b1c8-6a5c78e3f310';
  v_is_demo  boolean;
  v_n        bigint;
  r          record;
BEGIN
  SELECT vp.is_demo INTO v_is_demo
    FROM public.vendor_profiles vp
   WHERE vp.vendor_profile_id = v_shop;

  IF NOT FOUND THEN
    RAISE NOTICE 'delete_saysay_demo_shop: shop % is not present — nothing to do', v_shop;
    RETURN;
  END IF;

  IF v_is_demo IS NOT TRUE THEN
    RAISE EXCEPTION 'delete_saysay_demo_shop: vendor_profile % is NOT a demo shop (is_demo=%) — refusing to delete a real shop', v_shop, v_is_demo
      USING ERRCODE = 'check_violation';
  END IF;

  -- Money the shop could be owed / billed — never deleted as a side effect.
  IF EXISTS (SELECT 1 FROM public.vendor_payouts WHERE vendor_profile_id = v_shop) THEN
    RAISE EXCEPTION 'delete_saysay_demo_shop: shop % has vendor_payouts rows — refusing', v_shop;
  END IF;
  IF EXISTS (SELECT 1 FROM public.vendor_ad_subscriptions WHERE vendor_profile_id = v_shop) THEN
    RAISE EXCEPTION 'delete_saysay_demo_shop: shop % has vendor_ad_subscriptions rows — refusing', v_shop;
  END IF;

  -- The shop's only owner seat is removed by the cascade; this is the
  -- existing erasure switch `vendor_team_guard` honours (transaction-local).
  PERFORM set_config('app.vendor_seat_erasure', 'true', true);

  -- ── Report what the cascade / SET NULL will touch, BEFORE it happens ──────
  FOR r IN
    SELECT c.conrelid::regclass::text AS child, a.attname AS col, c.confdeltype AS rule
      FROM pg_constraint c
      JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
     WHERE c.contype = 'f' AND c.confrelid = 'public.vendor_profiles'::regclass
     ORDER BY 1, 2
  LOOP
    EXECUTE format('SELECT count(*) FROM %s WHERE %I = $1', r.child, r.col) INTO v_n USING v_shop;
    IF v_n > 0 THEN
      RAISE NOTICE 'delete_saysay_demo_shop: %.% → % row(s) (%)', r.child, r.col, v_n,
        CASE r.rule WHEN 'c' THEN 'cascade delete' WHEN 'n' THEN 'set null, row kept'
                    WHEN 'd' THEN 'set default, row kept' ELSE 'deleted explicitly' END;
    END IF;
  END LOOP;

  -- ── 1. Conversations: messages first, then the threads ────────────────────
  DELETE FROM public.chat_messages
   WHERE vendor_profile_id = v_shop
      OR thread_id IN (SELECT thread_id FROM public.chat_threads WHERE vendor_profile_id = v_shop);
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RAISE NOTICE 'delete_saysay_demo_shop: chat_messages deleted: %', v_n;

  DELETE FROM public.chat_threads WHERE vendor_profile_id = v_shop;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RAISE NOTICE 'delete_saysay_demo_shop: chat_threads deleted: % (members/reads/interests cascade)', v_n;

  -- ── 2. The booking row that belongs to no event ───────────────────────────
  DELETE FROM public.event_vendors
   WHERE event_id IS NULL
     AND (marketplace_vendor_id = v_shop OR linked_vendor_profile_id = v_shop);
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RAISE NOTICE 'delete_saysay_demo_shop: event-less event_vendors deleted: %', v_n;

  -- ── 3. The business dependent that mirrors this shop ──────────────────────
  DELETE FROM public.dependents
   WHERE vendor_profile_id = v_shop AND dependent_kind = 'business';
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RAISE NOTICE 'delete_saysay_demo_shop: business dependents deleted: %', v_n;

  -- ── 4. Rows keyed by the shop with no FK (would be orphaned) ──────────────
  IF to_regclass('public.vendor_service_price_history') IS NOT NULL THEN
    DELETE FROM public.vendor_service_price_history WHERE vendor_profile_id = v_shop;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    RAISE NOTICE 'delete_saysay_demo_shop: vendor_service_price_history deleted: %', v_n;
  END IF;

  -- ── 5. NO ACTION children (would block the delete) ────────────────────────
  DELETE FROM public.registered_crew_devices WHERE vendor_profile_id = v_shop;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RAISE NOTICE 'delete_saysay_demo_shop: registered_crew_devices deleted: %', v_n;

  DELETE FROM public.manpower_gigs WHERE vendor_profile_id = v_shop;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RAISE NOTICE 'delete_saysay_demo_shop: manpower_gigs deleted: %', v_n;

  -- ── 6. The shop itself (its CASCADE children go with it) ──────────────────
  DELETE FROM public.vendor_profiles WHERE vendor_profile_id = v_shop AND is_demo IS TRUE;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  IF v_n <> 1 THEN
    RAISE EXCEPTION 'delete_saysay_demo_shop: expected to delete 1 vendor_profiles row, deleted %', v_n;
  END IF;
  RAISE NOTICE 'delete_saysay_demo_shop: vendor_profiles % deleted', v_shop;
END $$;
