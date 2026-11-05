-- a_moment_can_be_right_after_the_one_above
-- Created via `pnpm migration:new`. Prefix auto-allocated to sort AFTER every
-- existing migration. KEEP THIS MIGRATION IDEMPOTENT (it may be re-applied).
--
-- 📖 A MOMENT CAN BE "RIGHT AFTER THE ONE ABOVE", WITH NO TIME (owner 2026-11-02, DECISION_LOG "SCHEDULE FITS THE
-- COORDINATOR'S TIMELINE AS WRITTEN: 4 ADDITIONS" (1)). A real coordinator's timeline writes "Bouquet toss" with no
-- clock, under "Cake cutting": it happens when the one above is done. Until now the database refused it — a moment
-- could not be Time TBA (CHECK `event_schedule_blocks_time_tba_check`, 20271300482585: TBA was chapter-only).
--
-- 🔑 EXTEND, DO NOT REBUILD. The flag that already says "this row's clock is not known" is `time_tba`, and ~40 readers
-- already ask it (`isTimeTba`, `onlyTimedBlocks`, the guard `a-tba-chapter-is-never-midnight.test.ts`): a reader that
-- cannot say "Right after" fences the row out or says "Time TBA", and never draws its stored start as a clock. So an
-- untimed MOMENT is a moment with `time_tba` — the one new column is WHICH moment it follows.
--
-- 🛑 NEVER A GUESSED MIDNIGHT. `start_at` stays NOT NULL (~70 readers, three triggers, a CHECK). An untimed moment
-- stores the START OF THE MOMENT IT FOLLOWS — not a time anybody typed, only its place in the order — and `time_tba`
-- says so. Readers that know the flag draw "Right after"; readers that do not, fence it out. The order key keeps the
-- moment beside its anchor in every `ORDER BY start_at` read.
--
--   follows_block_id — the moment above it (same chapter). Set only on an untimed moment. When that moment's start
--                      moves (a drag, a time typed, a supplier's request approved), the follower moves with it — in the
--                      same statement, by the trigger below, so the order never breaks. A chain (C after B after A)
--                      moves as one. Deleting the anchor leaves the follower where it was (ON DELETE SET NULL): still
--                      "right after" whatever is above it now, never dropped.
--
-- Also refused, as before: an end on an untimed row (an end with no start is a guess too), and showing an untimed row
-- to guests (`is_public`) — every guest reader is fenced by `is_public`, so a placeholder start can never reach the
-- Event Hub. The host's Run of show, the guest's "Your schedule" (their own moments) and the supplier's Schedule
-- view say "Right after".
--
-- Held by apps/web/tests/db/a-moment-can-be-right-after.db.test.ts.

BEGIN;

ALTER TABLE public.event_schedule_blocks
  ADD COLUMN IF NOT EXISTS follows_block_id UUID REFERENCES public.event_schedule_blocks(block_id) ON DELETE SET NULL;

-- A moment may now be TBA ("right after"); a chapter still may. Neither has an end, neither is shown to guests.
ALTER TABLE public.event_schedule_blocks
  DROP CONSTRAINT IF EXISTS event_schedule_blocks_time_tba_check;
ALTER TABLE public.event_schedule_blocks
  ADD CONSTRAINT event_schedule_blocks_time_tba_check
    CHECK (NOT time_tba OR (end_at IS NULL AND is_public = FALSE));

-- Only an untimed MOMENT follows another, and never itself.
ALTER TABLE public.event_schedule_blocks
  DROP CONSTRAINT IF EXISTS event_schedule_blocks_follows_check;
ALTER TABLE public.event_schedule_blocks
  ADD CONSTRAINT event_schedule_blocks_follows_check
    CHECK (
      follows_block_id IS NULL
      OR (time_tba AND parent_block_id IS NOT NULL AND follows_block_id <> block_id)
    );

CREATE INDEX IF NOT EXISTS event_schedule_blocks_follows_idx
  ON public.event_schedule_blocks(follows_block_id)
  WHERE follows_block_id IS NOT NULL;

COMMENT ON COLUMN public.event_schedule_blocks.follows_block_id IS
  'Untimed moment only: the moment in the same chapter it happens right after. start_at holds that moment''s start as an ORDER KEY (never a clock) and moves with it. 20271302727358.';
COMMENT ON COLUMN public.event_schedule_blocks.time_tba IS
  'The clock is not known. Chapter: Time TBA, start_at keeps the DAY at 00:00. Moment: "Right after" the one above (follows_block_id), start_at is only its order key. Never an end, never shown to guests. 20271300482585 · 20271302727358.';

-- ── the anchor is a moment of the SAME chapter (and of the same event) ──────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.event_schedule_blocks_follows_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_parent UUID;
  v_event  UUID;
BEGIN
  IF NEW.follows_block_id IS NULL THEN
    RETURN NEW;
  END IF;
  SELECT parent_block_id, event_id INTO v_parent, v_event
    FROM public.event_schedule_blocks
   WHERE block_id = NEW.follows_block_id;
  IF v_event IS DISTINCT FROM NEW.event_id OR v_parent IS DISTINCT FROM NEW.parent_block_id THEN
    RAISE EXCEPTION 'follows_other_chapter' USING ERRCODE = '23514',
      HINT = 'A moment can only be right after a moment of its own chapter.';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.event_schedule_blocks_follows_guard() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS event_schedule_blocks_follows_guard ON public.event_schedule_blocks;
CREATE TRIGGER event_schedule_blocks_follows_guard
  BEFORE INSERT OR UPDATE OF follows_block_id, parent_block_id ON public.event_schedule_blocks
  FOR EACH ROW EXECUTE FUNCTION public.event_schedule_blocks_follows_guard();

-- ── when a moment's start moves, the moments right after it move with it ─────────────────────────────────────────
-- SECURITY INVOKER: it is the caller's own write, so RLS decides exactly as for a hand edit. A follower already moved
-- by the same statement (a chapter move shifts every moment at once) already equals its anchor and is left alone —
-- the `IS DISTINCT FROM` below — so nothing moves twice. A follower's own UPDATE fires this again for ITS followers,
-- so a chain moves as one.
CREATE OR REPLACE FUNCTION public.event_schedule_blocks_followers_move()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  UPDATE public.event_schedule_blocks f
     SET start_at   = NEW.start_at,
         updated_at = NOW()
   WHERE f.follows_block_id = NEW.block_id
     AND f.time_tba
     AND f.start_at IS DISTINCT FROM NEW.start_at;
  RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.event_schedule_blocks_followers_move() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS event_schedule_blocks_followers_move ON public.event_schedule_blocks;
CREATE TRIGGER event_schedule_blocks_followers_move
  AFTER UPDATE OF start_at ON public.event_schedule_blocks
  FOR EACH ROW
  WHEN (NEW.parent_block_id IS NOT NULL AND OLD.start_at IS DISTINCT FROM NEW.start_at)
  EXECUTE FUNCTION public.event_schedule_blocks_followers_move();

COMMIT;
