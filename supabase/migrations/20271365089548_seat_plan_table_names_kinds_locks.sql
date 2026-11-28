-- seat_plan_table_names_kinds_locks
-- Created via `pnpm migration:new`. Prefix auto-allocated to sort AFTER every
-- existing migration. KEEP THIS MIGRATION IDEMPOTENT (it may be re-applied):
--   • CREATE TABLE IF NOT EXISTS …   (+ ALTER TABLE … ENABLE ROW LEVEL SECURITY in the SAME migration)
--   • ALTER TABLE … ADD COLUMN IF NOT EXISTS …
--   • CREATE INDEX IF NOT EXISTS …
--   • CREATE OR REPLACE FUNCTION …
--   • DROP POLICY IF EXISTS … ; CREATE POLICY …   (policies have no IF NOT EXISTS)

--
-- ── WHY (owner 2026-11-27, corpus SEAT-PLAN-COMPLETE-2026-11-27.md § 6, rulings R6 + R8) ────────────────────
-- The seat plan's ONE migration. Columns on two existing tables only — no new table, no new policy: the
-- existing event_tables / event_floor_plan policies already cover every column added here.
--
--   event_tables.label_is_auto  · "a table names itself after its majority group; a host-set name is never
--                                  overwritten". TRUE = the shown name is read by `tableDisplayNames`
--                                  (apps/web/lib/table-auto-name.ts); FALSE = the host typed it. Backfill: every
--                                  label that is not the default `Table <n>` is a name a couple typed, so it is
--                                  kept (FALSE).
--   event_tables.table_kind     · regular · vip · elders · spare. Backfilled 'vip' from is_vip. is_vip stays (no
--                                  drop) for a later cleanup; the VIP writer now writes both.
--   event_tables.locked         · the table lock (seat locks stay event_seat_assignments.locked). A hard rule
--                                  for auto arrange.
--   event_floor_plan.speakers_* · the Speakers element, the entrance_* pattern (enabled + x/y percent).
--   event_floor_plan.auto_seat_rsvps / seat_suggestions · the two ⋯ switches, on by default.
--
-- Idempotent: ADD COLUMN IF NOT EXISTS; the backfills only touch rows still at their defaults; the CHECK is
-- dropped and re-added by name.

BEGIN;

ALTER TABLE public.event_tables
  ADD COLUMN IF NOT EXISTS label_is_auto BOOLEAN NOT NULL DEFAULT TRUE;

-- Every name a couple already typed is kept: only the default "Table <n>" stays auto.
UPDATE public.event_tables
   SET label_is_auto = FALSE
 WHERE label_is_auto = TRUE
   AND btrim(table_label) !~* '^table\s+[0-9]+$';

COMMENT ON COLUMN public.event_tables.label_is_auto IS
  'TRUE = the shown name is read (tableDisplayNames: majority group, else table_label "Table N"). FALSE = the host typed table_label and it never changes when guests move. Written by updateTableLabel / createTable.';

ALTER TABLE public.event_tables
  ADD COLUMN IF NOT EXISTS table_kind TEXT NOT NULL DEFAULT 'regular';

ALTER TABLE public.event_tables DROP CONSTRAINT IF EXISTS event_tables_table_kind_check;
ALTER TABLE public.event_tables
  ADD CONSTRAINT event_tables_table_kind_check
  CHECK (table_kind IN ('regular', 'vip', 'elders', 'spare'));

UPDATE public.event_tables
   SET table_kind = 'vip'
 WHERE is_vip = TRUE
   AND table_kind = 'regular';

COMMENT ON COLUMN public.event_tables.table_kind IS
  'regular · vip · elders · spare (seat plan § 4.7). Replaces is_vip as the read (is_vip kept, written in step, until a cleanup drops it).';

ALTER TABLE public.event_tables
  ADD COLUMN IF NOT EXISTS locked BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN public.event_tables.locked IS
  'The table lock: auto arrange keeps this table exactly as it is (a hard rule). Seat locks stay event_seat_assignments.locked.';

ALTER TABLE public.event_floor_plan
  ADD COLUMN IF NOT EXISTS speakers_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS speakers_x NUMERIC NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS speakers_y NUMERIC NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS auto_seat_rsvps BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS seat_suggestions BOOLEAN NOT NULL DEFAULT TRUE;

COMMENT ON COLUMN public.event_floor_plan.speakers_enabled IS
  'The Speakers element is on the plan (the entrance_* pattern). The solver keeps elders and children away from it.';
COMMENT ON COLUMN public.event_floor_plan.auto_seat_rsvps IS
  '⋯ "Seat new RSVPs for me": a new yes is seated by the rules, nobody already seated moves. Fails closed.';
COMMENT ON COLUMN public.event_floor_plan.seat_suggestions IS
  '⋯ "Suggest seats on the cards": the dry run''s suggestions show on the table cards.';

-- ── A UNIT TRADE IS ONE TRANSACTION (L10's note on #8460; seat plan § 4.1 "a trade only swaps units of the same
-- size") ──────────────────────────────────────────────────────────────────────────────────────────────────────────
-- `swapSeats` traded a guest-with-their-+1 for another pair by calling swap_seat_assignments once per pair — two
-- transactions, so a failure between them left one pair traded and the other not. This takes both sides as arrays
-- (lead first, then each +1, in matching order) and exchanges every pair inside ONE transaction. Same shape as its
-- single-pair twin: SECURITY INVOKER (the couple's RLS authorises), every row locked FOR UPDATE up front, and the
-- NULL-park so the un-deferrable physical-chair index never sees two guests on one chair. It also refuses a LOCKED
-- seat (`event_seat_assignments.locked`): a hand never moves a pinned guest (seat plan #17), so the database holds
-- that rule too, not only the action. The single-pair function stays as it is for a plain one-to-one swap.
CREATE OR REPLACE FUNCTION public.swap_seat_unit_assignments(
  p_event_id UUID,
  p_guests_a UUID[],
  p_guests_b UUID[]
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  n       INTEGER := COALESCE(array_length(p_guests_a, 1), 0);
  i       INTEGER;
  a_table UUID[] := '{}';
  a_seat  INTEGER[] := '{}';
  b_table UUID[] := '{}';
  b_seat  INTEGER[] := '{}';
  t       UUID;
  s       INTEGER;
  pinned  BOOLEAN;
BEGIN
  IF n = 0 OR n <> COALESCE(array_length(p_guests_b, 1), 0) THEN
    RAISE EXCEPTION 'A unit trade needs two lists of the same length';
  END IF;
  IF n > 16 THEN
    RAISE EXCEPTION 'A unit trade moves at most 16 pairs';
  END IF;
  IF (SELECT count(DISTINCT g) FROM unnest(p_guests_a || p_guests_b) AS g) <> 2 * n THEN
    RAISE EXCEPTION 'A guest appears twice in one trade';
  END IF;

  -- Read + lock every row up front, in the order given; a row the caller cannot see is "no assignment".
  FOR i IN 1..n LOOP
    SELECT table_id, seat_number, locked INTO t, s, pinned
      FROM public.event_seat_assignments
     WHERE event_id = p_event_id AND guest_id = p_guests_a[i]
     FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Guest % has no seat assignment in event %', p_guests_a[i], p_event_id;
    END IF;
    IF pinned THEN
      RAISE EXCEPTION 'Guest % is locked to their seat', p_guests_a[i];
    END IF;
    a_table := a_table || t;
    a_seat := a_seat || s;

    SELECT table_id, seat_number, locked INTO t, s, pinned
      FROM public.event_seat_assignments
     WHERE event_id = p_event_id AND guest_id = p_guests_b[i]
     FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Guest % has no seat assignment in event %', p_guests_b[i], p_event_id;
    END IF;
    IF pinned THEN
      RAISE EXCEPTION 'Guest % is locked to their seat', p_guests_b[i];
    END IF;
    b_table := b_table || t;
    b_seat := b_seat || s;
  END LOOP;

  -- Step 1: park every A at NULL (frees their chairs).
  UPDATE public.event_seat_assignments
     SET seat_number = NULL
   WHERE event_id = p_event_id AND guest_id = ANY (p_guests_a);

  -- Step 2: each B into its partner A's old chair (now free).
  FOR i IN 1..n LOOP
    UPDATE public.event_seat_assignments
       SET table_id = a_table[i], seat_number = a_seat[i]
     WHERE event_id = p_event_id AND guest_id = p_guests_b[i];
  END LOOP;

  -- Step 3: each A into its partner B's old chair (B has vacated it).
  FOR i IN 1..n LOOP
    UPDATE public.event_seat_assignments
       SET table_id = b_table[i], seat_number = b_seat[i]
     WHERE event_id = p_event_id AND guest_id = p_guests_a[i];
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.swap_seat_unit_assignments(UUID, UUID[], UUID[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.swap_seat_unit_assignments(UUID, UUID[], UUID[]) TO authenticated;

COMMENT ON FUNCTION public.swap_seat_unit_assignments(UUID, UUID[], UUID[]) IS
  'Exchange the seats of two same-size units (a guest and their +1s) in ONE transaction: pair i of p_guests_a trades '
  'with pair i of p_guests_b. SECURITY INVOKER (couple RLS authorises); every row locked first; refuses a locked seat; '
  'NULL-park so the physical-chair unique index never sees two on one chair. Called by swapSeats when a trade has +1s.';

COMMIT;
