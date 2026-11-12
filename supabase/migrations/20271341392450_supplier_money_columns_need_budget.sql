-- supplier_money_columns_need_budget
-- Created via `pnpm migration:new`. NOT applied anywhere by this PR — the pipeline pushes it.
-- ════════════════════════════════════════════════════════════════════════════
-- A SUPPLIERS-ONLY DELEGATE READS NO BOOKING AMOUNT (#5936) — the route Build 3 lane B round 4
-- (migration 20271333705710) left open and named for the owner:
--
--   "event_vendors carries the booking's price columns (total_cost_php, deposit_paid_php, transport_php, …) on the
--    SAME row a Suppliers delegate must read to do the job. RLS is per row, not per column."
--
-- ── THE ROUTE, MEASURED (exposure baseline + pg_policies after the replay) ───
--   event_vendors has exactly two browser SELECT doors:
--     event_vendors_couple_read      current_couple_event_ids()                         → the hosts
--     event_vendors_moderator_read   current_moderator_area_levels('vendors') NOT NULL  → ANY Suppliers delegate,
--                                    whatever their Budget & payments area says
--   and five money columns every browser role could SELECT on every row it could see:
--     total_cost_php · deposit_paid_php · transport_php · food_allowance_php · pax_surcharge_php
--   None of the five had moved to a counter or a hosts-only reader yet (round 4 closed only the chat, quote,
--   amendment, change-order, payment-ask and reuse routes, plus chat_threads.agreed_price_centavos).
--
-- ── THE CLOSURE ──────────────────────────────────────────────────────────────
--   §1 event_vendor_money_event_ids() — the events whose booking amounts the caller may read: they are a host there,
--      or a delegate whose Budget & payments area is not Off (moderator_area_level(…, 'budget') — the SAME grant
--      check money_hidden_event_ids() uses), and they are not a hidden coordinator by that predicate.
--   §2 event_vendor_money_read(p_event_id) — ONE definer reader: every booking row the caller may read at all
--      (the same two doors as the table's own SELECT policies), with the five amounts filled only on a §1 event and
--      `money_shown` saying which. The service role (server code on the admin client) reads every row filled.
--      A NULL amount with money_shown = FALSE is "hidden", never "₱0" — the app must say so.
--   §3 the five columns are closed per column to anon + authenticated. Every OTHER column keeps exactly the SELECT
--      each browser role held, and UPDATE / INSERT are untouched (a Suppliers-edit delegate still writes what they
--      wrote; this PR is about reads). A column added to event_vendors later is NOT browser-selectable until it is
--      granted — tests/db/a-suppliers-only-delegate-reads-no-booking-amount.db.test.ts fails on it and says so.
--
-- WIDENS NOBODY: a host reads the same figures through §2; the shop and admins never read event_vendors on a
-- browser session (no browser policy admits them).
-- ════════════════════════════════════════════════════════════════════════════

-- ── §1 · who reads the amounts ───────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.event_vendor_money_event_ids()
RETURNS SETOF UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT x.event_id
    FROM (
      SELECT public.current_couple_event_ids() AS event_id
      UNION
      SELECT l.event_id
        FROM public.current_moderator_area_levels('budget') l(event_id, level)
       WHERE l.level IS NOT NULL
    ) x
   WHERE x.event_id IS NOT NULL
     AND x.event_id NOT IN (SELECT public.money_hidden_event_ids());
$$;
REVOKE ALL ON FUNCTION public.event_vendor_money_event_ids() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.event_vendor_money_event_ids() TO authenticated;
COMMENT ON FUNCTION public.event_vendor_money_event_ids() IS
  'The events whose booking amounts (event_vendors.total_cost_php · deposit_paid_php · transport_php · food_allowance_php · pax_surcharge_php) the caller may read: a host there, or a delegate whose Budget & payments area is not Off — and never a coordinator money_hidden_event_ids() hides. Migration 20271341392450 (#5936).';

-- ── §2 · the one reader ──────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.event_vendor_money_read(p_event_id UUID)
RETURNS TABLE (
  vendor_id          UUID,
  total_cost_php     NUMERIC,
  deposit_paid_php   NUMERIC,
  transport_php      NUMERIC,
  food_allowance_php NUMERIC,
  pax_surcharge_php  INTEGER,
  money_shown        BOOLEAN
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_service BOOLEAN := COALESCE(auth.role(), '') = 'service_role';
  v_reads   BOOLEAN;
  v_shown   BOOLEAN;
BEGIN
  IF p_event_id IS NULL THEN
    RETURN;
  END IF;

  IF v_service THEN
    v_reads := TRUE;
    v_shown := TRUE;
  ELSE
    -- The SAME two doors as event_vendors' own SELECT policies — the reader never shows a row the table would not.
    v_reads := p_event_id IN (SELECT public.current_couple_event_ids())
            OR p_event_id IN (SELECT l.event_id
                                FROM public.current_moderator_area_levels('vendors') l(event_id, level)
                               WHERE l.level IS NOT NULL);
    v_shown := p_event_id IN (SELECT public.event_vendor_money_event_ids());
  END IF;

  IF NOT v_reads THEN
    RETURN;
  END IF;

  RETURN QUERY
    SELECT ev.vendor_id,
           CASE WHEN v_shown THEN ev.total_cost_php END,
           CASE WHEN v_shown THEN ev.deposit_paid_php END,
           CASE WHEN v_shown THEN ev.transport_php END,
           CASE WHEN v_shown THEN ev.food_allowance_php END,
           CASE WHEN v_shown THEN ev.pax_surcharge_php END,
           v_shown
      FROM public.event_vendors ev
     WHERE ev.event_id = p_event_id;
END;
$$;
REVOKE ALL ON FUNCTION public.event_vendor_money_read(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.event_vendor_money_read(UUID) TO authenticated, service_role;
COMMENT ON FUNCTION public.event_vendor_money_read(UUID) IS
  'The ONE browser read of a booking''s five amounts (event_vendors.total_cost_php · deposit_paid_php · transport_php · food_allowance_php · pax_surcharge_php). Returns every booking row of the event the caller may read (couple or Suppliers delegate — the table''s own two SELECT doors), amounts filled only where event_vendor_money_event_ids() admits the event; money_shown = FALSE means "hidden", never ₱0. The service role reads every amount. Migration 20271341392450 (#5936).';

-- ── §3 · the five columns are closed per column to browser roles ─────────────
DO $$
DECLARE
  v_role TEXT;
  v_cols TEXT;
  v_money CONSTANT TEXT[] := ARRAY['total_cost_php', 'deposit_paid_php', 'transport_php', 'food_allowance_php', 'pax_surcharge_php'];
BEGIN
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
  IF NOT has_column_privilege('authenticated', 'public.event_vendors', 'vendor_id', 'SELECT')
     OR NOT has_column_privilege('authenticated', 'public.event_vendors', 'status', 'SELECT')
     OR NOT has_column_privilege('authenticated', 'public.event_vendors', 'vendor_name', 'SELECT') THEN
    RAISE EXCEPTION 'POST-CONDITION FAILED: the column close took a column the app reads';
  END IF;
END $$;

COMMENT ON COLUMN public.event_vendors.total_cost_php IS
  'The booking''s agreed price, in pesos. No browser role may SELECT it directly (migration 20271341392450 — a Suppliers delegate without Budget & payments must not read it); browser reads go through event_vendor_money_read(event_id).';
