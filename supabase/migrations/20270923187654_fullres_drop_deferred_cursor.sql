-- ============================================================================
-- 20270923187654_fullres_drop_deferred_cursor.sql
--
-- Gap audit 2026-07-23. Fix the full-res drop sweep's Drive-deferred STARVATION:
-- a couple's Drive-deferred photos have full_res_dropped_at IS NULL and the
-- OLDEST captured_at, so `ORDER BY captured_at ASC LIMIT N` re-reads the same
-- stuck head every run, defers it again, drops nothing, and NEVER reaches newer
-- droppable photos behind it — the sweep converges to zero drops forever while
-- storage grows.
--
-- Fix (the audit's endorsed option): add a cursor column stamped on each defer.
-- The sweep now orders by (full_res_drop_deferred_at ASC NULLS FIRST,
-- captured_at ASC), so never-/least-recently-deferred rows are processed first
-- and a freshly-deferred row rotates to the BACK of the window. A row that later
-- becomes droppable (Drive finally confirmed) stops being re-stamped, keeps its
-- older cursor value, sorts ahead of the still-deferred backlog, and gets dropped.
--
-- Additive + idempotent: the column defaults NULL (= "never deferred", sorts
-- first), so existing rows behave exactly as before until the sweep stamps them.
-- ============================================================================

ALTER TABLE public.papic_photos
  ADD COLUMN IF NOT EXISTS full_res_drop_deferred_at TIMESTAMPTZ;

ALTER TABLE public.papic_guest_captures
  ADD COLUMN IF NOT EXISTS full_res_drop_deferred_at TIMESTAMPTZ;

COMMENT ON COLUMN public.papic_photos.full_res_drop_deferred_at IS
  'Full-res drop sweep cursor: last time this capture was DEFERRED (Drive copy '
  'not yet confirmed). NULL = never deferred. The sweep orders candidates by '
  'this ASC NULLS FIRST so deferred rows rotate to the back and never starve '
  'newer droppable rows (gap audit 2026-07-23 · papic-fullres-drop.ts).';

COMMENT ON COLUMN public.papic_guest_captures.full_res_drop_deferred_at IS
  'Full-res drop sweep cursor — see papic_photos.full_res_drop_deferred_at.';

-- Partial indexes matching the sweep's candidate predicate + sort, so the
-- reordered ORDER BY ... LIMIT stays a bounded index scan instead of sorting the
-- whole not-yet-dropped backlog on every run.
CREATE INDEX IF NOT EXISTS papic_photos_fullres_drop_cursor_idx
  ON public.papic_photos (full_res_drop_deferred_at NULLS FIRST, captured_at)
  WHERE full_res_dropped_at IS NULL;

CREATE INDEX IF NOT EXISTS papic_guest_captures_fullres_drop_cursor_idx
  ON public.papic_guest_captures (full_res_drop_deferred_at NULLS FIRST, captured_at)
  WHERE full_res_dropped_at IS NULL;
