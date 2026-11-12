-- a_self_added_price_says_how_it_works
-- Created via `pnpm migration:new`. Prefix auto-allocated to sort AFTER every
-- existing migration. KEEP THIS MIGRATION IDEMPOTENT (it may be re-applied).
--
-- 🧾 A SUPPLIER THE COUPLE ADDS SAYS HOW ITS PRICE WORKS — One price · Per guest · Per hour (owner 2026-11-13,
-- DECISION_LOG "A MANUALLY ADDED SERVICE SAYS HOW ITS PRICE WORKS" · "PER-GUEST SERVICES ARE SET ON THE GUEST LIST ·
-- PER-HOUR SERVICES ARE SET ON SCHEDULES" · "MANUAL SERVICE PRICE BASIS — PROTOTYPE APPROVED";
-- prototype `prototypes/manual_service_price_basis_2026-11-13/index.html`).
--
-- ── RULE 0: WHICH COLUMN ALREADY SAYS THIS? NONE. ─────────────────────────────────────────────────────────────────────
-- `event_vendors` carries `pax_quote_base` (the count a base price is anchored to), `cost_basis_pax` (the pax a total
-- was set at) and `pax_surcharge_php` (an added-guest charge) — all three are COUNTS or MONEY for the retired adaptive
-- surcharge, none says "this price is per guest" and none holds a rate. `vendor_services.pricing_basis` says it for a
-- Setnayan service card, which a self-added supplier does not have. So the booking gets the two facts, in the Card
-- Maker's own vocabulary:
--   pricing_basis     'per_pax' | 'per_hour' — NULL = One price (every row today, and the default)
--   pricing_rate_php  the rate the couple agreed, per guest or per hour — set exactly when the basis is
-- `total_cost_php` STAYS THE ONE TOTAL the budget reads. The add/edit sheet writes it through `updateVendorCosts`
-- (rate × the number below); the follow below keeps it true when the guest list or the schedule moves.
-- RLS: columns on `event_vendors` ride its existing policies — no new table, no new policy.
--
-- ── THE TWO NUMBERS (`self_added_price_terms`) ────────────────────────────────────────────────────────────────────────
--   counted  — `quote_guest_count(event, booking)`: the guests this booking counts, the SAME count the shipped
--              pax-follow prices a quote on (#7516, 20271339826198) — the event's headcount basis, minus the guests
--              left out of THIS service ("Not counted for ▾" and its count rule). No booking yet → nobody left out.
--   hours    — from that supplier's moments on the schedule (`event_schedule_blocks.responsible_vendor_ids` holds the
--              booking — the column the call time already folds, `earliestTaggedBlock`): Arrive = the earliest tagged
--              moment, Done = the latest; hours = Done − Arrive. Time-TBA moments (or moments in a Time-TBA chapter)
--              have no time and are skipped. Fewer than two distinct times → NULL: no hours, so NO TOTAL.
--
-- ── NEVER A GUESSED TOTAL ─────────────────────────────────────────────────────────────────────────────────────────────
-- Per hour with no hours, or per guest with nobody counted yet → the total is NOT written; `total_cost_php` keeps
-- whatever it held. The sheet says "No times for them on the schedule yet, so no total." instead of ₱0.
--
-- ── PER HEAD ON THE GUEST LIST ────────────────────────────────────────────────────────────────────────────────────────
-- `event_vendor_counts_per_head` (20271307968824) joined only `vendor_services.pricing_basis`, so a self-added caterer
-- never showed on the guest list's per-head Show & sort row. It now also counts a booking whose own basis is per guest.
--
-- ── THE TOTAL FOLLOWS (the pax-follow's own path, extended — never a second one) ──────────────────────────────────────
-- `quote_follow_guest_count_quietly` — the wrapper every guest-list trigger already calls (guests · not-counted ticks ·
-- count rules · the estimate / final count) — now also runs `self_added_price_follow`, each in its own fault fence. A
-- statement trigger on `event_schedule_blocks` runs the same follow when the schedule moves (the per-hour twin the
-- 2026-11-13 controller check found missing). Up AND down: this is the couple's own record, not a supplier's quote.
--
-- Held by apps/web/tests/db/a-self-added-price-says-how-it-works.db.test.ts and
-- apps/web/lib/self-added-price-basis.test.ts.

BEGIN;

-- ── 1 · The two facts on the booking ──────────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.event_vendors
  ADD COLUMN IF NOT EXISTS pricing_basis TEXT,
  ADD COLUMN IF NOT EXISTS pricing_rate_php NUMERIC(12,2);

ALTER TABLE public.event_vendors DROP CONSTRAINT IF EXISTS event_vendors_pricing_basis_check;
ALTER TABLE public.event_vendors
  ADD CONSTRAINT event_vendors_pricing_basis_check
  CHECK (pricing_basis IS NULL OR pricing_basis IN ('per_pax', 'per_hour'));

ALTER TABLE public.event_vendors DROP CONSTRAINT IF EXISTS event_vendors_pricing_rate_with_basis_check;
ALTER TABLE public.event_vendors
  ADD CONSTRAINT event_vendors_pricing_rate_with_basis_check
  CHECK (
    (pricing_basis IS NULL AND pricing_rate_php IS NULL)
    OR (pricing_basis IS NOT NULL AND pricing_rate_php IS NOT NULL AND pricing_rate_php > 0)
  );

COMMENT ON COLUMN public.event_vendors.pricing_basis IS
  'How a supplier the COUPLE added prices (owner 2026-11-13): per_pax | per_hour; NULL = One price. The Card Maker''s '
  'vocabulary (vendor_services.pricing_basis). total_cost_php stays the one total. Migration 20271342032145.';
COMMENT ON COLUMN public.event_vendors.pricing_rate_php IS
  'The agreed rate for pricing_basis — per guest or per hour, in pesos. Set exactly when pricing_basis is. '
  'total_cost_php = rate × self_added_price_terms (counted | hours) when that number is known. Migration 20271342032145.';

-- ── 2 · Per head: the one test, now also the booking's own basis ──────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.event_vendor_counts_per_head(p_event_vendor_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM public.event_vendors ev
      JOIN public.vendor_services vs
        ON vs.vendor_service_id = ev.service_id
        OR vs.vendor_service_id = ANY (COALESCE(ev.requested_service_ids, ARRAY[]::UUID[]))
     WHERE ev.vendor_id = p_event_vendor_id
       AND vs.pricing_basis = 'per_pax'
  ) OR EXISTS (
    -- A supplier the couple added and priced per guest (20271342032145).
    SELECT 1
      FROM public.event_vendors ev
     WHERE ev.vendor_id = p_event_vendor_id
       AND ev.pricing_basis = 'per_pax'
  );
$$;
REVOKE ALL ON FUNCTION public.event_vendor_counts_per_head(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.event_vendor_counts_per_head(UUID) TO service_role;

-- ── 3 · The two numbers — counted · hours (no browser role) ───────────────────────────────────────────────────────────
-- p_event_vendor_id NULL = a supplier not added yet: the whole count, and no hours (no moment can name them).
CREATE OR REPLACE FUNCTION public.self_added_price_terms(p_event_id UUID, p_event_vendor_id UUID)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  WITH t AS (
    SELECT blk.start_at
      FROM public.event_schedule_blocks blk
      LEFT JOIN public.event_schedule_blocks ch ON ch.block_id = blk.parent_block_id
     WHERE p_event_vendor_id IS NOT NULL
       AND blk.event_id = p_event_id
       AND p_event_vendor_id = ANY (COALESCE(blk.responsible_vendor_ids, ARRAY[]::UUID[]))
       AND blk.start_at IS NOT NULL
       AND NOT COALESCE(blk.time_tba, FALSE)
       AND NOT COALESCE(ch.time_tba, FALSE)
  ), s AS (
    SELECT MIN(t.start_at) AS arrive_at, MAX(t.start_at) AS done_at FROM t
  )
  SELECT jsonb_build_object(
    'counted', public.quote_guest_count(p_event_id, p_event_vendor_id),
    'arrive_at', s.arrive_at,
    'done_at', s.done_at,
    'hours', CASE WHEN s.done_at > s.arrive_at
                  THEN round((EXTRACT(EPOCH FROM (s.done_at - s.arrive_at)) / 3600.0)::NUMERIC, 2)
             END
  ) FROM s;
$$;
REVOKE ALL ON FUNCTION public.self_added_price_terms(UUID, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.self_added_price_terms(UUID, UUID) TO service_role;

-- The couple's read (and a guest-list helper's, and the admin console's): NUMBERS only, never a guest. The same gate as
-- `get_event_service_counts`. A booking that is not on this event is refused, never answered as "0 counted".
CREATE OR REPLACE FUNCTION public.get_self_added_price_terms(p_event_id UUID, p_event_vendor_id UUID DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF auth.uid() IS NOT NULL
     AND NOT (
       p_event_id IN (SELECT public.current_couple_event_ids())
       OR public.is_admin()
       OR p_event_id IN (SELECT l.event_id FROM public.current_moderator_area_levels('guest_list') l WHERE l.level IS NOT NULL)
     ) THEN
    RAISE EXCEPTION 'not_allowed' USING ERRCODE = '42501';
  END IF;
  IF p_event_vendor_id IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM public.event_vendors ev WHERE ev.vendor_id = p_event_vendor_id AND ev.event_id = p_event_id) THEN
    RAISE EXCEPTION 'That service is not on this event.' USING ERRCODE = '23503';
  END IF;
  RETURN public.self_added_price_terms(p_event_id, p_event_vendor_id);
END;
$$;
REVOKE ALL ON FUNCTION public.get_self_added_price_terms(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_self_added_price_terms(UUID, UUID) TO authenticated, service_role;

-- ── 4 · The follow — rate × the number, when the number is known ──────────────────────────────────────────────────────
-- Only the couple's own records (no Setnayan shop), not archived. Returns how many totals moved. Never a guessed total:
-- no hours / nobody counted → the row is left as it was. Never a total under what was recorded as a deposit (the
-- table's own CHECK) — such a row is left as it was too.
CREATE OR REPLACE FUNCTION public.self_added_price_follow(p_event_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  r       RECORD;
  v_terms JSONB;
  v_n     NUMERIC;
  v_total NUMERIC(12,2);
  v_moved INTEGER := 0;
BEGIN
  IF p_event_id IS NULL THEN
    RETURN 0;
  END IF;
  FOR r IN
    SELECT ev.vendor_id, ev.pricing_basis, ev.pricing_rate_php, ev.total_cost_php, ev.deposit_paid_php
      FROM public.event_vendors ev
     WHERE ev.event_id = p_event_id
       AND ev.marketplace_vendor_id IS NULL
       AND ev.archived_at IS NULL
       AND ev.pricing_basis IN ('per_pax', 'per_hour')
       AND ev.pricing_rate_php > 0
     ORDER BY ev.vendor_id
       FOR UPDATE
  LOOP
    v_terms := public.self_added_price_terms(p_event_id, r.vendor_id);
    v_n := CASE r.pricing_basis
             WHEN 'per_pax'  THEN NULLIF((v_terms ->> 'counted')::NUMERIC, 0)
             WHEN 'per_hour' THEN NULLIF((v_terms ->> 'hours')::NUMERIC, 0)
           END;
    IF v_n IS NULL THEN
      CONTINUE;
    END IF;
    v_total := round(r.pricing_rate_php * v_n, 2);
    IF v_total IS NOT DISTINCT FROM r.total_cost_php OR v_total < COALESCE(r.deposit_paid_php, 0) THEN
      CONTINUE;
    END IF;
    UPDATE public.event_vendors
       SET total_cost_php = v_total,
           updated_at = now()
     WHERE vendor_id = r.vendor_id;
    v_moved := v_moved + 1;
  END LOOP;
  RETURN v_moved;
END;
$$;
REVOKE ALL ON FUNCTION public.self_added_price_follow(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.self_added_price_follow(UUID) TO service_role;

-- ── 5 · Who calls it: the pax-follow's own wrapper (every guest-list trigger already calls this) ──────────────────────
-- 20271339826198's body, plus the self-added follow — each in its own fence, so neither can refuse the guest-list write
-- that called it, nor stop the other.
CREATE OR REPLACE FUNCTION public.quote_follow_guest_count_quietly(p_event_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  BEGIN
    PERFORM public.quote_follow_guest_count(p_event_id);
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'quote_follow_guest_count event %: % %', p_event_id, SQLSTATE, SQLERRM;
  END;
  BEGIN
    PERFORM public.self_added_price_follow(p_event_id);
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'self_added_price_follow event %: % %', p_event_id, SQLSTATE, SQLERRM;
  END;
END;
$$;
REVOKE ALL ON FUNCTION public.quote_follow_guest_count_quietly(UUID) FROM PUBLIC, anon, authenticated;

-- ── 6 · …and the schedule (the per-hour twin) — statement level, one call per event per write ─────────────────────────
CREATE OR REPLACE FUNCTION public.tg_schedule_moves_a_self_added_price()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_event UUID;
BEGIN
  IF TG_OP = 'DELETE' THEN
    FOR v_event IN SELECT DISTINCT o.event_id FROM old_rows o WHERE o.event_id IS NOT NULL LOOP
      BEGIN
        PERFORM public.self_added_price_follow(v_event);
      EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'self_added_price_follow event %: % %', v_event, SQLSTATE, SQLERRM;
      END;
    END LOOP;
  ELSE
    FOR v_event IN SELECT DISTINCT n.event_id FROM new_rows n WHERE n.event_id IS NOT NULL LOOP
      BEGIN
        PERFORM public.self_added_price_follow(v_event);
      EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'self_added_price_follow event %: % %', v_event, SQLSTATE, SQLERRM;
      END;
    END LOOP;
  END IF;
  RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.tg_schedule_moves_a_self_added_price() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS event_schedule_blocks_move_a_self_added_price_ins ON public.event_schedule_blocks;
CREATE TRIGGER event_schedule_blocks_move_a_self_added_price_ins AFTER INSERT ON public.event_schedule_blocks
  REFERENCING NEW TABLE AS new_rows FOR EACH STATEMENT EXECUTE FUNCTION public.tg_schedule_moves_a_self_added_price();
DROP TRIGGER IF EXISTS event_schedule_blocks_move_a_self_added_price_upd ON public.event_schedule_blocks;
CREATE TRIGGER event_schedule_blocks_move_a_self_added_price_upd AFTER UPDATE ON public.event_schedule_blocks
  REFERENCING NEW TABLE AS new_rows FOR EACH STATEMENT EXECUTE FUNCTION public.tg_schedule_moves_a_self_added_price();
DROP TRIGGER IF EXISTS event_schedule_blocks_move_a_self_added_price_del ON public.event_schedule_blocks;
CREATE TRIGGER event_schedule_blocks_move_a_self_added_price_del AFTER DELETE ON public.event_schedule_blocks
  REFERENCING OLD TABLE AS old_rows FOR EACH STATEMENT EXECUTE FUNCTION public.tg_schedule_moves_a_self_added_price();

-- ── The fence must really be there ────────────────────────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF has_function_privilege('authenticated', 'public.self_added_price_terms(uuid, uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'self_added_price_terms skips the couple check — no browser role may call it';
  END IF;
  IF has_function_privilege('authenticated', 'public.self_added_price_follow(uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'self_added_price_follow writes totals — no browser role may call it';
  END IF;
END $$;

COMMIT;
