-- ============================================================================
-- ONLY THE COORDINATOR MAY ADVANCE THE PROGRAMME — the migration that follows.
--
-- `app/_actions/run-of-show.ts` has said so against itself since the narrowing
-- shipped, verbatim: "This is a NARROWING, so it is the enforcement — the DB
-- gate stays wider until a migration follows." This is that migration.
--
-- ── THE LIVE GAP (re-measured against prod 2026-09-14, not taken from a doc) ─
-- `advance_schedule_block(p_block_id uuid)` in production is SECURITY DEFINER
-- with acl `postgres=X | authenticated=X | service_role=X` — EXECUTE is granted
-- to `authenticated` — and its ownership gate reads:
--
--     IF v_event_id NOT IN (SELECT public.current_event_ids())
--        AND COALESCE(public.moderator_area_level(v_event_id,'schedule'),'') <> 'edit'
--        AND v_event_id NOT IN (SELECT public.current_vendor_booked_event_ids())
--        AND NOT public.is_admin() THEN ...
--
-- That third arm is EVERY supplier contracted on the wedding — caterer and
-- florist included. A booked caterer holding a session token can advance
-- somebody's wedding straight over PostgREST, never touching a server action
-- and never loading a screen. A server action is a public HTTP endpoint and a
-- screen is not an enforcement boundary; neither is a server action when the
-- function beneath it is granted to `authenticated` and gates wider.
--
-- ── THE DELTA: ONE ARM, ONE HELPER ──────────────────────────────────────────
--     current_vendor_booked_event_ids()  →  current_coordinator_booked_event_ids()
--
-- REUSED, NOT RE-IMPLEMENTED. The helper already exists (migration
-- 20271013100000), is already granted to `authenticated`, and is already the
-- exact predicate the TypeScript narrowing uses — the two halves of the gate
-- now read the same source of truth rather than two hand-rolled copies that can
-- drift. Its body is `current_vendor_booked_event_ids()`'s, over the same booked
-- statuses ('contracted','deposit_paid','delivered','complete') and the same
-- owner-or-team-member reach, plus ONE predicate: `'coordinator' = ANY(vp.services)`.
--
-- 🔑 A HAND-ROLLED BOOKED CHECK WOULD HAVE LOCKED THE REAL COORDINATOR OUT
-- WHILE LOOKING LIKE IT WORKED. A marketplace vendor cannot read their own
-- `event_vendors` row under RLS, so any copy of the booked test written inline
-- here returns "not booked" for everyone. Both helpers are SECURITY DEFINER for
-- exactly that reason. Do not inline this check.
--
-- ── THE THREE ARMS THAT DO NOT MOVE ─────────────────────────────────────────
-- host/couple (`current_event_ids`) · delegate with schedule:'edit'
-- (`moderator_area_level`) · `is_admin()`. One of four arms narrows; the other
-- three are byte-identical to 20270917100000, as is the entire body below it
-- (single-winner FOR UPDATE + run_state-precondition UPDATEs, idempotent
-- already/noop returns, sequential advance only — no jump, no rewind, and the
-- "never resurrects a finished block" invariant preserved).
--
-- ── THE REFUSAL STAYS EXPLICIT, AND THAT IS LOAD-BEARING ────────────────────
-- This RPC is single-winner and idempotent, so `'already'` and
-- `'noop_live_in_progress'` are benign successes. If the refusal were expressed
-- as a predicate that merely matched no rows, "you may not" and "somebody else
-- already did" would become the SAME observation — a zero-row UPDATE raises
-- nothing. The refusal therefore remains the pre-existing
-- `RAISE EXCEPTION 'not_on_this_event' USING ERRCODE = '42501'`, thrown BEFORE
-- any row is touched, so a caller (and a test) can tell the two apart.
--
-- ── WHO THIS BREAKS: NOBODY WHO COULD LEGITIMATELY DO IT ────────────────────
-- Every caller in the tree already reaches this RPC through `runAdvance`
-- (lib/run-of-show-advance.ts), whose vendor arm is ALREADY
-- `current_coordinator_booked_event_ids()`: the couple's schedule page and the
-- shared RunOfShowHeader via `advanceScheduleBlock`, and the live floor console
-- via `floorAdvanceBlock`, which additionally re-checks the coordinator tile.
-- Nothing in the app called the wide arm on purpose. What this closes is the
-- path that never went through the app at all.
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.advance_schedule_block(
  p_block_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event_id   UUID;
  v_run_state  public.schedule_run_state;
  v_sort_order INT;
  v_start_at   TIMESTAMPTZ;
  v_rows       INTEGER;
  v_live_count INTEGER;
  v_next_id    UUID;
BEGIN
  -- FOR UPDATE serializes concurrent advancers (double-tap / two devices): the
  -- second waits, re-reads the now-changed row, and is caught by the idempotent
  -- branches below.
  SELECT event_id, run_state, sort_order, start_at
    INTO v_event_id, v_run_state, v_sort_order, v_start_at
    FROM public.event_schedule_blocks
   WHERE block_id = p_block_id
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'block_not_found' USING ERRCODE = 'P0002';
  END IF;

  -- Ownership — host/couple (event membership) ∪ delegate coordinator with
  -- schedule:edit (event_moderators, widened 20270917100000) ∪ the booked
  -- COORDINATOR ∪ admin.
  --
  -- ⛔ THE THIRD ARM IS `current_coordinator_booked_event_ids`, NOT
  -- `current_vendor_booked_event_ids`. Widening it back admits every supplier
  -- contracted on the wedding — caterer, florist, photographer — to the control
  -- that runs somebody's ceremony. That was the live authorisation gap this
  -- migration closes; see the header.
  IF v_event_id NOT IN (SELECT public.current_event_ids())
     AND COALESCE(public.moderator_area_level(v_event_id, 'schedule'), '') <> 'edit'
     AND v_event_id NOT IN (SELECT public.current_coordinator_booked_event_ids())
     AND NOT public.is_admin() THEN
    -- EXPLICIT and thrown before any row is touched: a refusal must never be
    -- mistakable for the idempotent no-ops below.
    RAISE EXCEPTION 'not_on_this_event' USING ERRCODE = '42501';
  END IF;

  -- IDEMPOTENCY: an already-done block is a benign no-op (single-winner already
  -- won) — return gracefully so a retry/double-tap still shows "done".
  IF v_run_state = 'done' THEN
    RETURN jsonb_build_object('status', 'already', 'block_id', p_block_id);
  END IF;

  -- ── START branch ─────────────────────────────────────────────────────────
  -- Target is 'upcoming'. Only START it (don't mark done) when NOTHING on the
  -- event is currently live — otherwise an 'upcoming' target is a no-op (the
  -- caller should advance the live block first). run_state='upcoming' in the
  -- WHERE is the single-winner gate.
  IF v_run_state = 'upcoming' THEN
    SELECT count(*) INTO v_live_count
      FROM public.event_schedule_blocks
     WHERE event_id = v_event_id AND run_state = 'live';
    IF v_live_count > 0 THEN
      RETURN jsonb_build_object('status', 'noop_live_in_progress', 'block_id', p_block_id);
    END IF;
    UPDATE public.event_schedule_blocks
       SET run_state       = 'live',
           actual_start_at = COALESCE(actual_start_at, NOW()),
           updated_at      = NOW()
     WHERE block_id = p_block_id
       AND run_state = 'upcoming';
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    IF v_rows = 0 THEN
      RETURN jsonb_build_object('status', 'already', 'block_id', p_block_id);
    END IF;
    RETURN jsonb_build_object('status', 'started', 'block_id', p_block_id);
  END IF;

  -- ── ADVANCE branch (target is 'live') ────────────────────────────────────
  -- Mark this block done. run_state='live' in the WHERE is the single-winner
  -- gate (defense in depth alongside FOR UPDATE) — atomic even if the lock is
  -- ever removed.
  UPDATE public.event_schedule_blocks
     SET run_state     = 'done',
         actual_end_at = NOW(),
         updated_at    = NOW()
   WHERE block_id = p_block_id
     AND run_state = 'live';
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows = 0 THEN
    -- Lost the race between the FOR UPDATE read and the UPDATE (only possible if
    -- the lock is removed) — report already-done.
    RETURN jsonb_build_object('status', 'already', 'block_id', p_block_id);
  END IF;

  -- Light the NEXT block live (by sort_order, then start_at). Only an
  -- 'upcoming' block strictly after this one is promoted, so re-advancing
  -- earlier in the list never resurrects a finished block.
  SELECT block_id
    INTO v_next_id
    FROM public.event_schedule_blocks
   WHERE event_id = v_event_id
     AND run_state = 'upcoming'
     AND (sort_order, start_at, block_id) > (v_sort_order, v_start_at, p_block_id)
   ORDER BY sort_order ASC, start_at ASC, block_id ASC
   LIMIT 1
   FOR UPDATE;

  IF v_next_id IS NOT NULL THEN
    UPDATE public.event_schedule_blocks
       SET run_state       = 'live',
           actual_start_at = COALESCE(actual_start_at, NOW()),
           updated_at      = NOW()
     WHERE block_id = v_next_id
       AND run_state = 'upcoming';
  END IF;

  RETURN jsonb_build_object(
    'status',   'ok',
    'block_id', p_block_id,
    'next_id',  v_next_id);
END;
$$;

-- Re-assert the grant surface (CREATE OR REPLACE preserves ACLs, but be
-- explicit so a cold replay of this file alone lands the same posture).
-- `authenticated` KEEPS execute — the gate inside is the boundary, and revoking
-- here would take the couple and the coordinator down with the caterer.
REVOKE ALL ON FUNCTION public.advance_schedule_block(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.advance_schedule_block(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.advance_schedule_block(UUID) TO authenticated;

COMMENT ON FUNCTION public.advance_schedule_block(UUID) IS
  'Day-of run-of-show advance: marks the given timeline block done + lights the next live. Single-winner (SELECT FOR UPDATE + run_state<>done precondition UPDATE + ROW_COUNT), idempotent (already-done → no-op). Auth: host/couple (current_event_ids) ∪ delegate coordinator with schedule:edit (moderator_area_level — widened 20270917100000) ∪ the BOOKED COORDINATOR (current_coordinator_booked_event_ids — narrowed from every booked vendor 20271227867922, owner ruling: only the coordinator runs the programme) ∪ admin. Refusal is an explicit 42501 not_on_this_event raised before any row is touched, so it is never mistakable for the idempotent no-ops. Sequential advance only — no jump/rewind; never resurrects a finished block.';

COMMIT;
