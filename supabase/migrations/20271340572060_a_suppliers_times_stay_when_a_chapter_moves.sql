-- a_suppliers_times_stay_when_a_chapter_moves
-- 🗓 SCHEDULES HAND-IN-HAND part (b), rule 1 (owner 2026-11-12, DECISION_LOG "SCHEDULES HAND-IN-HAND part (b)"):
-- *"When the couple moves a chapter, a supplier's arrive/done times STAY."*
--
-- Until now `move_schedule_chapter` (20271300072429 §2b) shifted the chapter and EVERY moment in it. A supplier's arrive
-- and done are two of those moments (My times → "<shop> arrives" / "<shop> is done", tagged to their booking), so they
-- moved with the chapter and the supplier's call time changed under them without anyone asking. This migration gives
-- the ONE door a list of moments to leave where they are. Which moments are a supplier's times is decided in the app
-- (`timesThatStay`, apps/web/lib/schedule-hand-in-hand.ts — the same words `timesRequests` writes with); the
-- database's part is only to move everything else in the same single statement, all or nothing, under the caller's
-- own RLS exactly as before. Only moments OF THIS CHAPTER can be kept: the chapter itself always moves, and an id that
-- is not one of its moments changes nothing.
--
-- The change lock (20271303409352) is untouched: a kept moment is not written, so it meets no lock; every moment that
-- does move meets the lock as it always did.
--
-- Signature: (UUID, TIMESTAMPTZ) → (UUID, TIMESTAMPTZ, UUID[] DEFAULT '{}'). The two-argument form is dropped first so
-- an untyped two-argument call keeps resolving to exactly one function; every existing caller is unchanged.
-- Held by apps/web/tests/db/a-suppliers-times-stay-when-a-chapter-moves.db.test.ts.

BEGIN;

DROP FUNCTION IF EXISTS public.move_schedule_chapter(UUID, TIMESTAMPTZ);

CREATE OR REPLACE FUNCTION public.move_schedule_chapter(
  p_block_id        UUID,
  p_start_at        TIMESTAMPTZ,
  p_keep_block_ids  UUID[] DEFAULT '{}'::UUID[]
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_from  TIMESTAMPTZ;
  v_shift INTERVAL;
  v_moved INTEGER;
BEGIN
  SELECT start_at INTO v_from
    FROM public.event_schedule_blocks
   WHERE block_id = p_block_id AND parent_block_id IS NULL;
  IF v_from IS NULL OR p_start_at IS NULL THEN
    RETURN 0;
  END IF;
  v_shift := make_interval(secs => EXTRACT(EPOCH FROM (p_start_at - v_from)));
  UPDATE public.event_schedule_blocks b
     SET start_at   = b.start_at + v_shift,
         end_at     = b.end_at + v_shift,
         updated_at = NOW()
   WHERE b.block_id = p_block_id
      OR (b.parent_block_id = p_block_id AND NOT (b.block_id = ANY (COALESCE(p_keep_block_ids, '{}'::UUID[]))));
  GET DIAGNOSTICS v_moved = ROW_COUNT;
  RETURN v_moved;
END;
$$;

REVOKE ALL ON FUNCTION public.move_schedule_chapter(UUID, TIMESTAMPTZ, UUID[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.move_schedule_chapter(UUID, TIMESTAMPTZ, UUID[]) TO authenticated;

COMMENT ON FUNCTION public.move_schedule_chapter(UUID, TIMESTAMPTZ, UUID[]) IS
  'Moves a chapter (top-level block) to p_start_at and every moment in it by the same amount, in one statement under '
  'the caller''s RLS — EXCEPT the moments named in p_keep_block_ids (a supplier''s own arrive / done, owner 2026-11-12: '
  'they STAY when the couple moves a chapter). Returns the rows moved (0 = nothing). 20271300072429 · 20271340572060.';

COMMIT;
