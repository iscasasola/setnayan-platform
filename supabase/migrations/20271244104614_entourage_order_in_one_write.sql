-- entourage_order_in_one_write
-- Created via `pnpm migration:new`. Prefix auto-allocated to sort AFTER every
-- existing migration. Idempotent (CREATE OR REPLACE + REVOKE/GRANT).
--
-- ⚖ OWNER 2026-09-23, on the Wedding March: *"when i move someone, the whole
-- screen refreshes. feels laggy."* · *"we want them to move and pair people
-- easily and fast."*
--
-- ── WHAT WAS SLOW, MEASURED ────────────────────────────────────────────────
-- `entourage-order-actions.ts` wrote a group's new order as ONE UPDATE PER
-- PERSON, awaited in a `for` loop — and it rewrites the WHOLE group on every
-- move by design (see its docblock: there is then no "have we normalised yet"
-- state to get wrong). For this event's Principal Sponsors that is 50 people,
-- so 50 sequential round trips from a Vercel lambda to Supabase Singapore for
-- ONE tap of Move ↑. The pairing path is worse: `pinOrder` runs the same loop
-- and THEN calls `join_entourage_line`.
--
-- Measured on 2026-09-23 against production, one couple's own moves:
--   POST …/guests 303 at 05:51:33  →  the page's GETs land 05:51:36-37
--   POST …/guests 303 at 05:52:17  →  05:52:19-20
-- i.e. ~2-4s of pure write latency per move, before the page even re-renders.
--
-- 🔑 THE ROW COUNT WAS NEVER THE PROBLEM — THE ROUND TRIPS WERE. Fifty UPDATEs
-- of one row each is fifty network waits; one UPDATE of fifty rows is one. So
-- this changes nothing about WHAT is written (the whole group, 0..n-1, both
-- halves of a pair sharing a number) and only how many times we ask.
--
-- ⛔ TOUCHES NO CHAIR. `entourage_order` is the line in the aisle;
-- `event_seat_assignments` + `seating_priority` are the chair. The processional
-- and the seat plan are two orderings on purpose.
--
-- SECURITY INVOKER, exactly like `join_entourage_line` and `pair_guests`: the
-- caller's own RLS decides which guests they may touch. This adds atomicity and
-- a row count — never reach.

CREATE OR REPLACE FUNCTION public.set_entourage_order(
  p_event_id  UUID,
  p_guest_ids UUID[],
  p_orders    INT[]
)
RETURNS INT
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_written INT;
BEGIN
  IF p_guest_ids IS NULL OR p_orders IS NULL
     OR array_length(p_guest_ids, 1) IS DISTINCT FROM array_length(p_orders, 1) THEN
    RAISE EXCEPTION 'Every guest must carry exactly one position';
  END IF;

  -- 🔑 A ZERO-ROW UPDATE IS SUCCESS-SHAPED. The caller refuses to report a save
  -- it cannot count, so hand back the number of rows RLS actually let through.
  WITH moved AS (
    UPDATE public.guests g
       SET entourage_order = v.ord,
           updated_at = now()
      FROM unnest(p_guest_ids, p_orders) AS v(gid, ord)
     WHERE g.event_id = p_event_id
       AND g.guest_id = v.gid
       AND g.deleted_at IS NULL
    RETURNING 1
  )
  SELECT count(*)::INT INTO v_written FROM moved;

  RETURN v_written;
END $$;

-- ── clear_entourage_order · hand one printed group back to the default ─────
-- The same shape, for the Reset link: NULL means "no opinion", and a group that
-- never got an opinion must be reachable again.
CREATE OR REPLACE FUNCTION public.clear_entourage_order(
  p_event_id  UUID,
  p_guest_ids UUID[]
)
RETURNS INT
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_written INT;
BEGIN
  WITH cleared AS (
    UPDATE public.guests g
       SET entourage_order = NULL,
           updated_at = now()
     WHERE g.event_id = p_event_id
       AND g.guest_id = ANY(p_guest_ids)
       AND g.deleted_at IS NULL
       AND g.entourage_order IS NOT NULL
    RETURNING 1
  )
  SELECT count(*)::INT INTO v_written FROM cleared;

  RETURN v_written;
END $$;

-- 🔒 REVOKE FROM PUBLIC FIRST — Postgres grants EXECUTE on a new function to
-- PUBLIC, so a GRANT to authenticated alone would leave anon able to call it.
REVOKE EXECUTE ON FUNCTION public.set_entourage_order(UUID, UUID[], INT[]) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.clear_entourage_order(UUID, UUID[]) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.set_entourage_order(UUID, UUID[], INT[]) FROM anon;
REVOKE EXECUTE ON FUNCTION public.clear_entourage_order(UUID, UUID[]) FROM anon;
GRANT EXECUTE ON FUNCTION public.set_entourage_order(UUID, UUID[], INT[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.clear_entourage_order(UUID, UUID[]) TO authenticated;
