-- papic_knows_the_moment
-- Created via `pnpm migration:new`. Prefix auto-allocated to sort AFTER every
-- existing migration. KEEP THIS MIGRATION IDEMPOTENT (it may be re-applied).
--
-- 📷 PAPIC CAPTURES KNOW THEIR MOMENT (owner 2026-11-01, corpus SCHEDULE_CHAPTERS_BUILD_PLAN_2026-11-01.md §3:
-- *"When there are photos on that moment and they try to delete it, you have to ask them deleting this moment will also
-- delete the papic photos and videos."* The warning names the count. Controller's calls, same paragraph: only Papic items
-- go, not uploads or supplier shots; a photo also added to another chapter stays there. Ruled 1 Nov: deleting a CHAPTER
-- keeps its photos under Unsorted — only a moment delete removes Papic items.)
--
-- 🔑 EXTEND, DO NOT REBUILD. Papic by chapter (20271300249267, #7153) links each capture to a CHAPTER
-- (`papic_chapter_captures`). The one fact missing is WHICH MOMENT of that chapter was happening at the shutter. So:
--
--   1 · `papic_chapter_captures.moment_block_id` — the moment of the link's chapter whose start → end holds the
--       capture's own `captured_at` (the later-starting one when two overlap); NULL when none was on, and always NULL for
--       a link `added` later. DERIVED by the link's trigger, never sent by a route — no capture route changes.
--   2 · DELETING A MOMENT REMOVES ITS PAPIC ITEMS (a BEFORE DELETE trigger on the moment, so every door that deletes a
--       moment — the sheet, an approved supplier delete — does it):
--         · a capture tagged with the moment and in NO other chapter is HIDDEN (`hidden_at`, the field every gallery,
--           wall, story, print and share already leaves out) and leaves the chapter;
--         · a capture also in another chapter only leaves THIS chapter — it stays there;
--         · a CHAPTER delete (its moments cascade) and the whole event's delete remove nothing: the photos fall back to
--           Unsorted, as ruled.
--
-- 💰 CREDITS ARE NOT TOUCHED. A guest's spent credits ARE the sum of `points_cost` over her capture rows
-- (20271276810836 "a guest shot spends with its row"), so erasing the ROW would hand the credits back — and "are spent
-- credits returned?" is still the owner's open question (plan §3). Hence HIDE, not erase: the row, its `points_cost`
-- and its files stay; nothing here reads or writes a price, a credit, a ceiling or a pool. If the owner rules credits
-- come back, the erasure is the shipped `deletePhotoForever` path, not a second one.
--
-- ⚠ ORDER: every ALTER TABLE comes first; there is no top-level INSERT/UPDATE in this file (prod refuses ALTER after
-- pending trigger events, SQLSTATE 55006).
--
-- Held by apps/web/tests/db/papic-knows-the-moment.db.test.ts.

-- ── 0 · the column (ALTER first) ──────────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.papic_chapter_captures
  ADD COLUMN IF NOT EXISTS moment_block_id UUID REFERENCES public.event_schedule_blocks(block_id) ON DELETE SET NULL;

COMMENT ON COLUMN public.papic_chapter_captures.moment_block_id IS
  'The moment of this link''s chapter happening at the shutter (start → end holds captured_at); NULL = none, or an '
  '`added` link. Derived by papic_chapter_captures_check. Deleting that moment removes the capture unless it is in another '
  'chapter (papic_moment_delete_takes_its_captures). 20271302139013.';

CREATE INDEX IF NOT EXISTS papic_chapter_captures_moment_idx
  ON public.papic_chapter_captures (moment_block_id) WHERE moment_block_id IS NOT NULL;

-- ── 1 · the moment happening at an instant, inside one chapter ────────────────────────────────────────────────────
-- Moments hold the venue's WALL CLOCK in a UTC column; lifted into real instants in the event's zone exactly as the
-- chapter's own window is (`papic_chapter_window_bounds`). A moment with no end is never "on".
CREATE OR REPLACE FUNCTION public.papic_chapter_moment_at(p_chapter UUID, p_at TIMESTAMPTZ)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT m.block_id
    FROM public.event_schedule_blocks m
   WHERE m.parent_block_id = p_chapter
     AND p_at IS NOT NULL
     AND m.start_at IS NOT NULL
     AND m.end_at IS NOT NULL
     AND p_at >= ((m.start_at AT TIME ZONE 'UTC') AT TIME ZONE public.papic_chapter_tz(m.event_id))
     AND p_at <  ((m.end_at   AT TIME ZONE 'UTC') AT TIME ZONE public.papic_chapter_tz(m.event_id))
   ORDER BY m.start_at DESC, m.sort_order DESC NULLS LAST, m.block_id
   LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.papic_chapter_moment_at(UUID, TIMESTAMPTZ) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.papic_chapter_moment_at(UUID, TIMESTAMPTZ) TO service_role;

-- ── 2 · the link's trigger now also stamps the moment (the 20271300249267 body, plus the stamp) ───────────────────
CREATE OR REPLACE FUNCTION public.papic_chapter_captures_check()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_event   UUID;
  v_cap_ev  UUID;
  v_guest   UUID;
  v_user    UUID;
  v_at      TIMESTAMPTZ;
  v_refusal TEXT;
BEGIN
  SELECT b.event_id INTO v_event
    FROM public.event_schedule_blocks b
   WHERE b.block_id = NEW.block_id AND b.parent_block_id IS NULL;
  IF v_event IS NULL THEN
    RAISE EXCEPTION 'not_a_chapter: Papic shoots into a chapter, not a moment.' USING ERRCODE = '23514';
  END IF;
  NEW.event_id := v_event;

  IF NEW.guest_capture_id IS NOT NULL THEN
    SELECT c.event_id, c.guest_id, c.captured_at INTO v_cap_ev, v_guest, v_at
      FROM public.papic_guest_captures c WHERE c.capture_id = NEW.guest_capture_id;
  ELSE
    SELECT p.event_id, s.guest_id, s.claimer_user_id, p.captured_at INTO v_cap_ev, v_guest, v_user, v_at
      FROM public.papic_photos p
      JOIN public.paparazzi_seats s ON s.seat_id = p.paparazzi_seat_id
     WHERE p.photo_id = NEW.seat_photo_id;
  END IF;
  IF v_cap_ev IS NULL OR v_cap_ev <> v_event THEN
    RAISE EXCEPTION 'not_a_chapter: that capture is not on this event.' USING ERRCODE = '23514';
  END IF;

  IF NEW.how = 'captured' THEN
    v_refusal := public.papic_chapter_capture_refusal(NEW.block_id, v_event, v_guest, v_user, v_at);
    IF v_refusal IS NOT NULL THEN
      RAISE EXCEPTION '%: this shot cannot go into that chapter.', v_refusal USING ERRCODE = '23514';
    END IF;
  END IF;

  -- 🆕 20271302139013 — the moment of this chapter happening at the shutter, if any. Derived here, never sent: a shot
  -- put into a chapter later (`added`, Memories) was not shot during one of its moments.
  NEW.moment_block_id := CASE
    WHEN NEW.how = 'captured' THEN public.papic_chapter_moment_at(NEW.block_id, v_at)
    ELSE NULL
  END;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.papic_chapter_captures_check() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS papic_chapter_captures_check ON public.papic_chapter_captures;
CREATE TRIGGER papic_chapter_captures_check
  BEFORE INSERT OR UPDATE ON public.papic_chapter_captures
  FOR EACH ROW EXECUTE FUNCTION public.papic_chapter_captures_check();

-- ── 3 · deleting a moment removes its Papic items ─────────────────────────────────────────────────────────────────
-- SECURITY DEFINER: whoever may delete a moment (a host, a coordinator with Edit on the Schedule) holds no write on the
-- capture tables — they are written by the capture routes only. It touches only the captures tagged with THIS moment.
CREATE OR REPLACE FUNCTION public.papic_moment_delete_takes_its_captures()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF OLD.parent_block_id IS NULL THEN
    RETURN OLD; -- a chapter: its links go by CASCADE and its photos fall back to Unsorted (ruled 1 Nov)
  END IF;
  -- Its chapter (or the whole event) is being deleted and this moment goes with it: nothing is removed — Unsorted.
  IF NOT EXISTS (SELECT 1 FROM public.event_schedule_blocks c WHERE c.block_id = OLD.parent_block_id)
     OR NOT EXISTS (SELECT 1 FROM public.events e WHERE e.event_id = OLD.event_id) THEN
    RETURN OLD;
  END IF;

  -- In no other chapter → hidden from every gallery (the row, its points_cost and its files stay: no credit moves).
  UPDATE public.papic_guest_captures g
     SET hidden_at = COALESCE(g.hidden_at, NOW())
   WHERE g.capture_id IN (
           SELECT l.guest_capture_id FROM public.papic_chapter_captures l
            WHERE l.moment_block_id = OLD.block_id AND l.guest_capture_id IS NOT NULL)
     AND NOT EXISTS (
           SELECT 1 FROM public.papic_chapter_captures o
            WHERE o.guest_capture_id = g.capture_id AND o.block_id <> OLD.parent_block_id);
  UPDATE public.papic_photos p
     SET hidden_at = COALESCE(p.hidden_at, NOW())
   WHERE p.photo_id IN (
           SELECT l.seat_photo_id FROM public.papic_chapter_captures l
            WHERE l.moment_block_id = OLD.block_id AND l.seat_photo_id IS NOT NULL)
     AND NOT EXISTS (
           SELECT 1 FROM public.papic_chapter_captures o
            WHERE o.seat_photo_id = p.photo_id AND o.block_id <> OLD.parent_block_id);

  -- Every one of them leaves THIS chapter; a capture also in another chapter stays there.
  DELETE FROM public.papic_chapter_captures WHERE moment_block_id = OLD.block_id;
  RETURN OLD;
END;
$$;
REVOKE ALL ON FUNCTION public.papic_moment_delete_takes_its_captures() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS papic_moment_delete_takes_its_captures ON public.event_schedule_blocks;
CREATE TRIGGER papic_moment_delete_takes_its_captures
  BEFORE DELETE ON public.event_schedule_blocks
  FOR EACH ROW EXECUTE FUNCTION public.papic_moment_delete_takes_its_captures();
