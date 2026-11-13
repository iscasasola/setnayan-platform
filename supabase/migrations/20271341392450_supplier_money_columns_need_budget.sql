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
-- ── THIS MIGRATION: THE READERS ONLY (migration A of two) ───────────────────
--   §1 event_vendor_money_event_ids() — the events whose booking amounts the caller may read: they are a host there,
--      or a delegate whose Budget & payments area is not Off (moderator_area_level(…, 'budget') — the SAME grant
--      check money_hidden_event_ids() uses), and they are not a hidden coordinator by that predicate.
--   §2 event_vendor_money_read(p_event_id) — ONE definer reader: every booking row the caller may read at all
--      (the same two doors as the table's own SELECT policies), with the five amounts filled only on a §1 event and
--      `money_shown` saying which. The service role (server code on the admin client) reads every row filled.
--      A NULL amount with money_shown = FALSE is "hidden", never "₱0" — the app must say so.
--
-- ⏭ THE COLUMN CLOSE IS NOT HERE (controller audit on PR #7560). deploy-prod runs `db push` BEFORE the Vercel
--   build, so closing the five columns in the same publish as the app that stops selecting them makes the OLD build
--   error on every couple's Suppliers / Budget / dashboard page until the new build serves, and blocks a Vercel
--   rollback. So this migration only ADDS the two readers (purely additive — the old build never calls them), the
--   app moves every user-session read onto them, and the per-column REVOKE ships as migration B in a SEPARATE
--   follow-up PR, published only after production is confirmed serving this commit. Until B lands the five columns
--   are still browser-selectable; nothing in the app selects them on a user session
--   (lib/booking-money-reads-through-the-reader.test.ts).
--
-- WIDENS NOBODY: both functions return only what the table's own SELECT policies already admit, with fewer amounts.
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
