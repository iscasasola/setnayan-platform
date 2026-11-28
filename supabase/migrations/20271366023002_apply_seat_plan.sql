-- apply_seat_plan
-- Created via `pnpm migration:new`. Idempotent (CREATE OR REPLACE; grants re-run safely).
--
-- 🪑 ACCEPT WRITES THE PREVIEW IN ONE TRANSACTION (seat plan § 4.6 auto-arrange preview D and § 6 "Accept"; corpus
-- SEAT-PLAN-COMPLETE-2026-11-27.md: "writes run as one transaction, ideally one RPC, apply_seat_plan(event_id, moves,
-- base_version), that re-checks the hard rules against current locks and rejects a stale preview").
--
-- The preview (`autoArrange` intent=preview, lib/seat-plan-preview.ts) writes nothing; it hands the editor the exact
-- plan plus the `base`, a fingerprint of the seats it started from. Accept sends that plan back here, and in ONE
-- transaction this:
--   0. refuses a STALE preview: the seats now must hash to `p_base` (someone seated or moved a guest since);
--   1. takes off the seats "Seat everyone again" clears (only unlocked seats at unlocked tables, else it refuses);
--   2. adds the tables the plan needs for room (keys "new:<key>" in the rows resolve to them);
--   3. moves the tables the plan laid out (positions, clamped 0–100);
--   4. seats each row, re-checking every hard rule against the tables as they are NOW:
--        the table is this event's, not locked, not Spare, not the Sweetheart; the chair is a real chair of it (inside
--        capacity, not removed); the guest is this event's, not removed, has not declined; and no table ends over its
--        chairs. A taken chair or a guest already seated trips the unique indexes.
-- Any refusal raises, so NOTHING is written. It returns what Undo needs: the tables it added and the seats it took off.
--
-- SECURITY INVOKER: the couple's own RLS on event_tables / event_seat_assignments authorises every write, exactly as
-- the action's direct writes did. A per-event advisory lock keeps two Accepts from interleaving.
--
-- Fingerprint (the TS twin is `seatPlanBase`, lib/seat-plan-preview.ts — the two must agree byte for byte):
--   md5 of "guest_id:table_id:seat_number" (seat_number '-' when NULL), joined by ',', ordered by guest_id; '' when no seats.

BEGIN;

CREATE OR REPLACE FUNCTION public.apply_seat_plan(
  p_event_id    UUID,
  p_base        TEXT,
  p_clear       UUID[],
  p_new_tables  JSONB,
  p_positions   JSONB,
  p_rows        JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_now_base TEXT;
  v_cleared  JSONB := '[]'::jsonb;
  v_n_clear  INTEGER := COALESCE(cardinality(p_clear), 0);
  v_n_gone   INTEGER;
  v_keys     JSONB := '{}'::jsonb;
  v_added    UUID[] := '{}';
  r          JSONB;
  k          TEXT;
  v_id       UUID;
  v_table    UUID;
  v_ref      TEXT;
  v_seat     INTEGER;
  t          RECORD;
  g          RECORD;
  v_seated   INTEGER := 0;
  v_touched  UUID[] := '{}';
BEGIN
  IF p_rows IS NULL OR jsonb_typeof(p_rows) <> 'array' THEN
    RAISE EXCEPTION 'apply_seat_plan: rows must be an array';
  END IF;
  IF jsonb_array_length(p_rows) > 2000 OR v_n_clear > 2000 THEN
    RAISE EXCEPTION 'apply_seat_plan: a plan seats at most 2000 guests';
  END IF;
  IF p_new_tables IS NOT NULL AND jsonb_typeof(p_new_tables) = 'array' AND jsonb_array_length(p_new_tables) > 60 THEN
    RAISE EXCEPTION 'apply_seat_plan: a plan adds at most 60 tables';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('apply_seat_plan:' || p_event_id::text, 0));
  PERFORM 1 FROM public.event_seat_assignments WHERE event_id = p_event_id FOR UPDATE;

  -- 0 · A stale preview is refused.
  SELECT md5(COALESCE(string_agg(
           a.guest_id::text || ':' || a.table_id::text || ':' || COALESCE(a.seat_number::text, '-'),
           ',' ORDER BY a.guest_id), ''))
    INTO v_now_base
    FROM public.event_seat_assignments a
   WHERE a.event_id = p_event_id;
  IF p_base IS DISTINCT FROM v_now_base THEN
    RAISE EXCEPTION 'stale_preview: the seat plan changed since this preview' USING ERRCODE = 'P0001';
  END IF;

  -- 1 · The seats "Seat everyone again" takes off: unlocked seats at unlocked tables only.
  IF v_n_clear > 0 THEN
    WITH gone AS (
      DELETE FROM public.event_seat_assignments a
       USING public.event_tables tt
       WHERE a.event_id = p_event_id
         AND a.guest_id = ANY (p_clear)
         AND a.locked IS NOT TRUE
         AND tt.table_id = a.table_id
         AND tt.locked IS NOT TRUE
      RETURNING a.guest_id, a.table_id, a.seat_number, a.locked, a.placed_by, a.placed_at
    )
    SELECT COALESCE(jsonb_agg(to_jsonb(gone)), '[]'::jsonb), count(*) INTO v_cleared, v_n_gone FROM gone;
    IF v_n_gone <> (SELECT count(DISTINCT c) FROM unnest(p_clear) AS c) THEN
      RAISE EXCEPTION 'apply_seat_plan: a seat to clear is locked, at a locked table, or gone';
    END IF;
  END IF;

  -- 2 · The tables the plan adds for room.
  IF p_new_tables IS NOT NULL AND jsonb_typeof(p_new_tables) = 'array' THEN
    FOR r IN SELECT * FROM jsonb_array_elements(p_new_tables) LOOP
      k := r->>'key';
      IF k IS NULL OR k = '' OR v_keys ? k THEN
        RAISE EXCEPTION 'apply_seat_plan: each new table needs its own key';
      END IF;
      INSERT INTO public.event_tables (event_id, table_label, label_is_auto, table_type, capacity, sort_order, x_pos, y_pos)
      VALUES (
        p_event_id,
        r->>'label',
        (r->>'label') ~* '^\s*table\s+\d+\s*$',
        (r->>'type')::public.table_type,
        (r->>'capacity')::INTEGER,
        COALESCE((r->>'sort_order')::INTEGER, 0),
        CASE WHEN r ? 'x' AND jsonb_typeof(r->'x') = 'number' THEN LEAST(100, GREATEST(0, (r->>'x')::NUMERIC)) END,
        CASE WHEN r ? 'y' AND jsonb_typeof(r->'y') = 'number' THEN LEAST(100, GREATEST(0, (r->>'y')::NUMERIC)) END
      )
      RETURNING table_id INTO v_id;
      v_keys := v_keys || jsonb_build_object(k, v_id);
      v_added := v_added || v_id;
    END LOOP;
  END IF;

  -- 3 · Where the plan lays the tables out.
  IF p_positions IS NOT NULL AND jsonb_typeof(p_positions) = 'object' THEN
    FOR k, r IN SELECT * FROM jsonb_each(p_positions) LOOP
      IF jsonb_typeof(r->'x') = 'number' AND jsonb_typeof(r->'y') = 'number' THEN
        UPDATE public.event_tables
           SET x_pos = LEAST(100, GREATEST(0, (r->>'x')::NUMERIC)),
               y_pos = LEAST(100, GREATEST(0, (r->>'y')::NUMERIC))
         WHERE event_id = p_event_id AND table_id::text = k;
      END IF;
    END LOOP;
  END IF;

  -- 4 · Every seat, every hard rule re-checked now.
  FOR r IN SELECT * FROM jsonb_array_elements(p_rows) LOOP
    v_ref := r->>'table';
    IF v_ref LIKE 'new:%' THEN
      v_table := (v_keys->>substr(v_ref, 5))::UUID;
    ELSE
      v_table := v_ref::UUID;
    END IF;
    IF v_table IS NULL THEN
      RAISE EXCEPTION 'apply_seat_plan: a seat names a table the plan does not have';
    END IF;
    SELECT tt.table_type, tt.capacity, tt.removed_seats, tt.locked, tt.table_kind INTO t
      FROM public.event_tables tt
     WHERE tt.table_id = v_table AND tt.event_id = p_event_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'apply_seat_plan: table % is not in this event', v_table;
    END IF;
    IF t.locked IS TRUE OR t.table_kind = 'spare' OR t.table_type::text = 'sweetheart_2' THEN
      RAISE EXCEPTION 'apply_seat_plan: auto arrange never seats anyone at table % (locked, Spare or Sweetheart)', v_table;
    END IF;
    v_seat := (r->>'seat_number')::INTEGER;
    IF v_seat IS NULL OR v_seat < 0 OR v_seat >= t.capacity OR v_seat = ANY (COALESCE(t.removed_seats, '{}')) THEN
      RAISE EXCEPTION 'apply_seat_plan: seat % is not a chair of table %', v_seat, v_table;
    END IF;
    SELECT gg.rsvp_status::text AS rsvp INTO g
      FROM public.guests gg
     WHERE gg.guest_id = (r->>'guest_id')::UUID AND gg.event_id = p_event_id AND gg.deleted_at IS NULL;
    IF NOT FOUND OR g.rsvp = 'declined' THEN
      RAISE EXCEPTION 'apply_seat_plan: guest % cannot be seated', r->>'guest_id';
    END IF;
    INSERT INTO public.event_seat_assignments (event_id, table_id, guest_id, seat_number, placed_by, placed_at)
    VALUES (p_event_id, v_table, (r->>'guest_id')::UUID, v_seat, 'auto', now());
    v_seated := v_seated + 1;
    v_touched := v_touched || v_table;
  END LOOP;

  -- No table ends over its real chairs.
  IF EXISTS (
    SELECT 1
      FROM public.event_tables tt
      JOIN public.event_seat_assignments a ON a.table_id = tt.table_id AND a.event_id = p_event_id
     WHERE tt.table_id = ANY (v_touched)
     GROUP BY tt.table_id, tt.capacity, tt.removed_seats
    HAVING count(*) > tt.capacity - (
      SELECT count(DISTINCT s) FROM unnest(COALESCE(tt.removed_seats, '{}')) AS s WHERE s >= 0 AND s < tt.capacity
    )
  ) THEN
    RAISE EXCEPTION 'apply_seat_plan: a table would hold more people than chairs';
  END IF;

  RETURN jsonb_build_object('seated', v_seated, 'added_table_ids', to_jsonb(v_added), 'new_table_ids', v_keys, 'cleared', v_cleared);
END;
$$;

REVOKE ALL ON FUNCTION public.apply_seat_plan(UUID, TEXT, UUID[], JSONB, JSONB, JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.apply_seat_plan(UUID, TEXT, UUID[], JSONB, JSONB, JSONB) TO authenticated;

COMMENT ON FUNCTION public.apply_seat_plan(UUID, TEXT, UUID[], JSONB, JSONB, JSONB) IS
  'Seat plan § 4.6 Accept: writes an auto-arrange preview in ONE transaction. Refuses a stale preview (p_base = md5 of '
  'the event''s seats, the TS twin seatPlanBase), clears only unlocked seats at unlocked tables, adds the plan''s new '
  'tables, lays tables out, then seats each row re-checking every hard rule (table locked / Spare / Sweetheart, real '
  'chair, guest not declined or removed, no table over its chairs). Any refusal raises and nothing is written. '
  'SECURITY INVOKER (couple RLS authorises). Called by autoArrange intent=accept.';

COMMIT;
