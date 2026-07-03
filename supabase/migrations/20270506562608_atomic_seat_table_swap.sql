-- ============================================================================
-- 20270506562608_atomic_seat_table_swap.sql
-- Atomic 3D seat / table swap + physical-chair collision guard (iteration 0008).
--
-- WHY --------------------------------------------------------------------------
-- The 3D seating lab swapped guests (and whole tables) by firing TWO or more
-- independent `event_seat_assignments` upserts from the client. Two problems:
--
--   1. NOT ATOMIC. A crash / lost connection between the two writes left a
--      half-swap — one guest moved, the other stranded. There was no
--      transaction boundary around the pair.
--
--   2. NO PHYSICAL-CHAIR UNIQUENESS. Nothing stopped two guests from ending up
--      on the SAME (event_id, table_id, seat_number). The only uniqueness was
--      (event_id, guest_id) — "a guest sits in one place" — never "a chair
--      holds one guest". A racing double-write or a buggy swap could double-seat
--      a chair silently.
--
-- WHAT THIS SHIPS --------------------------------------------------------------
--   a. Data cleanup — null out seat_number on the LATER-created row of every
--      existing (event_id, table_id, seat_number) collision (keep the earliest
--      by created_at, tie-break assignment_id). A NULL seat_number is valid =
--      "seated at this table, no specific chair", so nulling is non-destructive:
--      the guest stays at their table, just loses the contested chair index.
--   b. Partial unique index on (event_id, table_id, seat_number) WHERE
--      seat_number IS NOT NULL — the physical-chair guard. NULLs are exempt so
--      any number of table-only ("no chair") assignments coexist.
--   c. public.swap_seat_assignments(p_event_id, p_guest_a, p_guest_b) — atomic
--      exchange of (table_id, seat_number) between two guests' rows.
--   d. public.swap_table_assignments(p_event_id, p_table_a, p_table_b) — atomic
--      swap of every occupant between two tables (seat_numbers travel along).
--
-- Both functions are SECURITY INVOKER: the caller's own RLS applies, so the
-- existing couple write policy (event_id IN current_couple_event_ids()) is the
-- authorization — no privilege escalation, no new policy needed.
--
-- THE UNIQUE-INDEX-DURING-SWAP PROBLEM ----------------------------------------
-- The partial unique index CANNOT be deferred (Postgres only allows DEFERRABLE
-- on UNIQUE *constraints*, and not on partial ones). So a naive "UPDATE A to B's
-- chair; UPDATE B to A's chair" trips the index on the first statement: for the
-- instant between the two UPDATEs, A and B share a chair.
--
-- swap_seat_assignments solves this with a 3-step NULL-park inside ONE
-- transaction (the whole plpgsql function is atomic):
--     1. park guest A's seat_number at NULL           (A vacates the chair)
--     2. move guest B into A's old (table_id, seat)    (chair now free → OK)
--     3. move guest A into B's old (table_id, seat)    (B has vacated it → OK)
-- No statement ever has two live rows on the same chair, and because it is one
-- transaction there is no observable intermediate state to any other session.
--
-- swap_table_assignments moves whole tables. Because the chair index includes
-- table_id, a straight "UPDATE ... table_id = CASE" could transiently collide
-- (table A seat 3 flips to table B while table B seat 3 still points at table B).
-- We dodge it the same way: snapshot the rows, park every affected seat_number
-- to NULL (index now has zero entries for either table), flip the table_ids,
-- then restore the seats onto the NEW tables. Each restore is collision-free
-- because (event_id, new_table, orig_seat) was already unique on the OTHER table
-- before the swap.
--
-- Idempotent (CREATE INDEX IF NOT EXISTS · CREATE OR REPLACE FUNCTION).
-- Additive — no column drops, no policy changes.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- a. Data cleanup — resolve pre-existing physical-chair collisions before the
--    unique index can be created. For each (event_id, table_id, seat_number)
--    group with >1 row (seat_number NOT NULL), keep the earliest-created row and
--    NULL the seat_number of every later one. NULL = "at the table, no specific
--    chair" — a valid state — so no guest is unseated; they just drop the
--    contested chair index.
-- ----------------------------------------------------------------------------
WITH ranked AS (
  SELECT
    assignment_id,
    ROW_NUMBER() OVER (
      PARTITION BY event_id, table_id, seat_number
      ORDER BY created_at ASC, assignment_id ASC
    ) AS rn
  FROM public.event_seat_assignments
  WHERE seat_number IS NOT NULL
)
UPDATE public.event_seat_assignments a
   SET seat_number = NULL
  FROM ranked r
 WHERE a.assignment_id = r.assignment_id
   AND r.rn > 1;

-- ----------------------------------------------------------------------------
-- b. Partial unique index — one guest per physical chair. NULL seat_numbers are
--    excluded so any number of "seated at table, no chair" rows coexist.
-- ----------------------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS event_seat_assignments_chair_uniq
  ON public.event_seat_assignments (event_id, table_id, seat_number)
  WHERE seat_number IS NOT NULL;

COMMENT ON INDEX public.event_seat_assignments_chair_uniq IS
  'One guest per physical chair: unique (event_id, table_id, seat_number) where '
  'seat_number IS NOT NULL. NULL seat_number = "seated at table, no specific '
  'chair" and is exempt. Cannot be deferred, so swap_* RPCs use a NULL-park '
  'intermediate to exchange chairs within a single transaction.';

-- ----------------------------------------------------------------------------
-- c. swap_seat_assignments — atomically exchange (table_id, seat_number) between
--    two guests. Both guests MUST already have an assignment row in the event.
--    NULL-park intermediate (see header) keeps the un-deferrable chair index
--    happy inside the single (atomic) function transaction.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.swap_seat_assignments(
  p_event_id UUID,
  p_guest_a  UUID,
  p_guest_b  UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY INVOKER          -- caller's RLS applies (couple write policy authorizes)
SET search_path = public
AS $$
DECLARE
  a_table UUID;
  a_seat  INTEGER;
  b_table UUID;
  b_seat  INTEGER;
BEGIN
  IF p_guest_a = p_guest_b THEN
    RAISE EXCEPTION 'Cannot swap a guest with themselves';
  END IF;

  -- Read + lock both rows up front. FOR UPDATE serializes concurrent swaps
  -- touching the same guests so two editors can't interleave a half-exchange.
  -- RLS is applied to these SELECTs, so a caller who can't see the event finds
  -- no rows and gets the clear "no assignment" error below.
  SELECT table_id, seat_number INTO a_table, a_seat
    FROM public.event_seat_assignments
   WHERE event_id = p_event_id AND guest_id = p_guest_a
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Guest % has no seat assignment in event %', p_guest_a, p_event_id;
  END IF;

  SELECT table_id, seat_number INTO b_table, b_seat
    FROM public.event_seat_assignments
   WHERE event_id = p_event_id AND guest_id = p_guest_b
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Guest % has no seat assignment in event %', p_guest_b, p_event_id;
  END IF;

  -- Step 1: park A at NULL (frees A's chair so B can take it without collision).
  UPDATE public.event_seat_assignments
     SET seat_number = NULL
   WHERE event_id = p_event_id AND guest_id = p_guest_a;

  -- Step 2: move B into A's old chair (now free).
  UPDATE public.event_seat_assignments
     SET table_id = a_table, seat_number = a_seat
   WHERE event_id = p_event_id AND guest_id = p_guest_b;

  -- Step 3: move A into B's old chair (B has vacated it).
  UPDATE public.event_seat_assignments
     SET table_id = b_table, seat_number = b_seat
   WHERE event_id = p_event_id AND guest_id = p_guest_a;
END;
$$;

REVOKE ALL ON FUNCTION public.swap_seat_assignments(UUID, UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.swap_seat_assignments(UUID, UUID, UUID) TO authenticated;

COMMENT ON FUNCTION public.swap_seat_assignments(UUID, UUID, UUID) IS
  'Atomically exchange (table_id, seat_number) between two guests'' seat '
  'assignments in one event. SECURITY INVOKER (couple RLS authorizes). Raises if '
  'either guest lacks an assignment. Uses a NULL-park intermediate so the '
  'un-deferrable physical-chair unique index never sees two guests on one chair.';

-- ----------------------------------------------------------------------------
-- d. swap_table_assignments — atomically swap every occupant between two tables.
--    Each guest keeps their seat_number; only table_id flips A<->B. Snapshot →
--    park seats to NULL → flip table_ids → restore seats, all in one atomic
--    transaction, so the un-deferrable chair index never sees a transient
--    two-on-one-chair collision.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.swap_table_assignments(
  p_event_id UUID,
  p_table_a  UUID,
  p_table_b  UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF p_table_a = p_table_b THEN
    RAISE EXCEPTION 'Cannot swap a table with itself';
  END IF;

  -- Serialize concurrent writers on the affected rows (RLS applied, so a caller
  -- without access to the event locks — and touches — nothing).
  PERFORM 1 FROM public.event_seat_assignments
   WHERE event_id = p_event_id AND table_id IN (p_table_a, p_table_b)
   FOR UPDATE;

  -- Snapshot the affected rows with their DESTINATION table + original seat.
  CREATE TEMP TABLE _swap_seats ON COMMIT DROP AS
    SELECT assignment_id,
           CASE WHEN table_id = p_table_a THEN p_table_b ELSE p_table_a END AS new_table_id,
           seat_number AS orig_seat
      FROM public.event_seat_assignments
     WHERE event_id = p_event_id AND table_id IN (p_table_a, p_table_b);

  -- Pass 1: park every affected chair to NULL → the chair index now has zero
  -- entries for table A or B, so the table_id flip in pass 2 cannot collide.
  UPDATE public.event_seat_assignments
     SET seat_number = NULL
   WHERE event_id = p_event_id AND table_id IN (p_table_a, p_table_b);

  -- Pass 2: flip table_ids (seats still NULL → no index entries → safe).
  UPDATE public.event_seat_assignments a
     SET table_id = s.new_table_id
    FROM _swap_seats s
   WHERE a.assignment_id = s.assignment_id;

  -- Pass 3: restore each row's original seat on its NEW table. Every
  -- (event_id, new_table, orig_seat) is unique because it was unique on the
  -- OTHER table pre-swap (the index held on both tables), so restore is safe.
  UPDATE public.event_seat_assignments a
     SET seat_number = s.orig_seat
    FROM _swap_seats s
   WHERE a.assignment_id = s.assignment_id;

  DROP TABLE IF EXISTS _swap_seats;
END;
$$;

REVOKE ALL ON FUNCTION public.swap_table_assignments(UUID, UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.swap_table_assignments(UUID, UUID, UUID) TO authenticated;

COMMENT ON FUNCTION public.swap_table_assignments(UUID, UUID, UUID) IS
  'Atomically swap every occupant between two tables in one event; each guest '
  'keeps their seat_number, only table_id flips A<->B. SECURITY INVOKER (couple '
  'RLS authorizes). Snapshot → park seats to NULL → flip table_ids → restore '
  'seats, all in one transaction, so the un-deferrable physical-chair unique '
  'index never sees a transient two-on-one-chair collision.';

COMMIT;
