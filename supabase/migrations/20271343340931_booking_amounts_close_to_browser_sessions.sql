-- booking_amounts_close_to_browser_sessions
-- Created via `pnpm migration:new`. NOT applied anywhere by this PR — the pipeline pushes it.
-- ════════════════════════════════════════════════════════════════════════════
-- A BOOKING'S FIVE AMOUNTS ARE CLOSED TO BROWSER SESSIONS (#5936 · migration B of two)
-- DECISION_LOG 2026-11-09 — event_vendors price split, Supplier Build 5.
--
-- Migration A (20271342818285, PR #7560, merged and serving) added the two definer readers
-- event_vendor_money_event_ids() and event_vendor_money_read(event_id) and moved every user-session read of
--   total_cost_php · deposit_paid_php · transport_php · food_allowance_php · pax_surcharge_php
-- onto them. It closed nothing, so the build still serving when `db push` ran kept working. THIS migration is the
-- close: per column, for anon and authenticated, so a Suppliers delegate without Budget & payments cannot read an
-- amount by selecting the column directly (RLS is per row; the Suppliers job needs the row).
--
-- ── WHAT IT DOES ─────────────────────────────────────────────────────────────
--   A column REVOKE does not bite against a table-level grant, so for each browser role that holds table-level
--   SELECT: revoke the table-level SELECT and grant SELECT back on every column EXCEPT the five. Then revoke the five
--   explicitly (PUBLIC, anon, authenticated) and check the result.
--
-- ── WHAT IT DOES NOT DO, AND WHY ─────────────────────────────────────────────
--   • INSERT / UPDATE stay granted. Couples and Suppliers-edit delegates write a typed price on their own session
--     (vendors/actions.ts, chat-lock-booking.server.ts, packages/actions.ts, wizard-actions.ts …), and
--     lib/booking-cost-write.ts refuses to write any amount the caller's reader hid. Moving every writer to the
--     service role is a separate change. A write with `.select('vendor_id')` needs SELECT only on vendor_id, so these
--     writers keep working.
--   • RLS policies are unchanged. service_role keeps every column; the two definer readers run as their owner and
--     keep reading the five.
--   • No invoker function, view or policy reads the five off event_vendors (measured on the replay: the only invoker
--     match is the trigger guard_package_anchor_price, which reads NEW/OLD — a trigger needs no column privilege).
--
-- ⚠ A COLUMN ADDED TO event_vendors AFTER THIS IS NOT BROWSER-SELECTABLE UNTIL IT IS GRANTED
--   (`GRANT SELECT (new_col) ON public.event_vendors TO anon, authenticated;` in the same migration).
--   tests/db/a-suppliers-only-delegate-reads-no-booking-amount.db.test.ts fails on an ungranted column and says so.
--
-- ⏭ PUBLISH ORDER: deploy-prod applies migrations BEFORE the new build serves. This is safe only because prod already
--   serves #7560 (the app reads the amounts only through the reader). Do not publish it ahead of that.
-- ════════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  v_role  TEXT;
  v_cols  TEXT;
  v_money CONSTANT TEXT[] := ARRAY['total_cost_php', 'deposit_paid_php', 'transport_php', 'food_allowance_php', 'pax_surcharge_php'];
BEGIN
  -- ANTI-VACUITY: the five must all exist, or this closes nothing and says it did.
  IF (SELECT count(*) FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'event_vendors' AND column_name = ANY (v_money)) <> 5 THEN
    RAISE EXCEPTION 'ANTI-VACUITY FAILED: event_vendors does not carry all five booking amount columns';
  END IF;

  FOREACH v_role IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF has_table_privilege(v_role, 'public.event_vendors', 'SELECT') THEN
      SELECT string_agg(quote_ident(column_name), ', ' ORDER BY ordinal_position) INTO v_cols
        FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'event_vendors' AND column_name <> ALL (v_money);
      EXECUTE format('REVOKE SELECT ON public.event_vendors FROM %I', v_role);
      EXECUTE format('GRANT SELECT (%s) ON public.event_vendors TO %I', v_cols, v_role);
    END IF;
  END LOOP;
  REVOKE SELECT ON public.event_vendors FROM PUBLIC;
  REVOKE SELECT (total_cost_php, deposit_paid_php, transport_php, food_allowance_php, pax_surcharge_php)
    ON public.event_vendors FROM PUBLIC, anon, authenticated;

  -- POST-CONDITIONS
  IF EXISTS (
    SELECT 1 FROM unnest(v_money) c, unnest(ARRAY['anon', 'authenticated']) r
     WHERE has_column_privilege(r, 'public.event_vendors', c, 'SELECT')
  ) THEN
    RAISE EXCEPTION 'POST-CONDITION FAILED: a browser role can still SELECT a booking amount on event_vendors';
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns c, unnest(ARRAY['anon', 'authenticated']) r
     WHERE c.table_schema = 'public' AND c.table_name = 'event_vendors' AND c.column_name <> ALL (v_money)
       AND NOT has_column_privilege(r, 'public.event_vendors', c.column_name, 'SELECT')
  ) THEN
    RAISE EXCEPTION 'POST-CONDITION FAILED: the close took a column other than the five from a browser role';
  END IF;
  IF NOT has_column_privilege('service_role', 'public.event_vendors', 'total_cost_php', 'SELECT') THEN
    RAISE EXCEPTION 'POST-CONDITION FAILED: the service role lost a booking amount';
  END IF;
  IF NOT has_column_privilege('authenticated', 'public.event_vendors', 'total_cost_php', 'UPDATE') THEN
    RAISE EXCEPTION 'POST-CONDITION FAILED: the session writers lost UPDATE on the price (this migration closes reads only)';
  END IF;
END;
$$;

COMMENT ON FUNCTION public.event_vendor_money_read(UUID) IS
  'The ONE browser read of a booking''s five amounts (event_vendors.total_cost_php · deposit_paid_php · transport_php · food_allowance_php · pax_surcharge_php) — since migration 20271343340931 the columns themselves are closed to anon and authenticated. Returns every booking row of the event the caller may read (couple or Suppliers delegate — the table''s own two SELECT doors), amounts filled only where event_vendor_money_event_ids() admits the event; money_shown = FALSE means "hidden", never ₱0. The service role reads every amount. Migrations 20271342818285 + 20271343340931 (#5936).';
