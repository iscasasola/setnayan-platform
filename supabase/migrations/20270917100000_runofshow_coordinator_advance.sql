-- ============================================================================
-- Run-of-Show trigger — DELEGATE-COORDINATOR advance widening (owner directive
-- 2026-07-23: "on the wedding day the HOST and the COORDINATOR set what is
-- currently happening").
--
-- WHAT THIS WIDENS (the exact gate): advance_schedule_block()'s auth gate as
-- shipped by 20270321980372_dayof_runofshow_handover.sql (the
-- `current_event_ids ∪ current_vendor_booked_event_ids ∪ is_admin` check) did
-- NOT admit a delegate coordinator: the real coordinator the product creates is
-- an `event_moderators` row (auto-granted schedule:'edit' on booked-planner
-- downpayment — lib/coordinator-grant.ts + COORDINATOR_AREAS), NOT an
-- event_members row, so `current_event_ids()` (event_members only, base
-- migration 20260512000000) rejected them with 42501 `not_on_this_event` even
-- though the schedule page already shows them the advance button AND RLS policy
-- `event_schedule_blocks_moderator_write` (20261129003000) already gives the
-- same delegate a direct FOR ALL write on the very rows the RPC updates. This
-- migration adds ONE arm to the gate:
--
--     COALESCE(moderator_area_level(v_event_id, 'schedule'), '') = 'edit'
--
-- i.e. an accepted, non-removed delegate whose permission grid says
-- schedule:edit may advance the run of show. No other behavior changes — the
-- function body below is otherwise byte-identical in semantics to 20270321980372
-- (single-winner FOR UPDATE + run_state-precondition UPDATEs, idempotent
-- already/noop returns, sequential advance only — no jump, no rewind, and the
-- "never resurrects a finished block" invariant is preserved).
--
-- INERTNESS NOTE: this widening goes live on merge (a caller class that 403'd
-- now succeeds). That is the owner directive itself — delegates already SEE the
-- advance button on the schedule page (canAdvance was hardcoded) and today get
-- a raw server error on tap. Permission ceiling is unchanged: the admitted
-- delegate could already write these rows via RLS.
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

  -- Ownership — host/couple (event membership) ∪ DELEGATE COORDINATOR with
  -- schedule:edit (event_moderators — the widening this migration ships) ∪
  -- booked vendor ∪ admin.
  IF v_event_id NOT IN (SELECT public.current_event_ids())
     AND COALESCE(public.moderator_area_level(v_event_id, 'schedule'), '') <> 'edit'
     AND v_event_id NOT IN (SELECT public.current_vendor_booked_event_ids())
     AND NOT public.is_admin() THEN
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
REVOKE ALL ON FUNCTION public.advance_schedule_block(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.advance_schedule_block(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.advance_schedule_block(UUID) TO authenticated;

COMMENT ON FUNCTION public.advance_schedule_block(UUID) IS
  'Day-of run-of-show advance: marks the given timeline block done + lights the next live. Single-winner (SELECT FOR UPDATE + run_state<>done precondition UPDATE + ROW_COUNT), idempotent (already-done → no-op). Auth: host/couple (current_event_ids) ∪ delegate coordinator with schedule:edit (moderator_area_level — widened 20270917100000 per owner directive 2026-07-23) ∪ booked vendor (current_vendor_booked_event_ids) ∪ admin. Sequential advance only — no jump/rewind; never resurrects a finished block.';

COMMIT;
