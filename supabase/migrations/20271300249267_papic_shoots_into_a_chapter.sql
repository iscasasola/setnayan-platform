-- papic_shoots_into_a_chapter
-- Created via `pnpm migration:new`. Prefix auto-allocated to sort AFTER every
-- existing migration. KEEP THIS MIGRATION IDEMPOTENT (it may be re-applied).
--
-- 📷 PAPIC BY CHAPTER (owner 2026-11-01, DECISION_LOG "PAPIC BY CHAPTER MOVES UP" · "THE PAPIC CARD ON HOME SHOOTS
-- INTO A CHAPTER" · "A CHAPTER'S PHOTOS: WHO + WHEN"; corpus SCHEDULE_CHAPTERS_BUILD_PLAN_2026-11-01.md §3 Photos,
-- §4 "Camera by chapter + upload"). Owner: *"when can i do a chapter so we can document our meetings? and be able to
-- use papic?"*
--
-- 🔑 EXTEND, DO NOT REBUILD. A chapter is a TOP-LEVEL `event_schedule_blocks` row (20271300072429). It already
-- carries everything this needs except two facts:
--   · WHEN Papic shoots into it — its own `start_at` → `end_at` (a meeting before the day turns Papic on at its start
--     and off at its end). A chapter with no end closes at the end of its own day.
--   · WHO may shoot into it — its own `photo_who` (People in this chapter · Only people tagged · Everybody), the photo
--     rule Step 2 stored on the block and left unenforced. REUSED here, never a second column.
-- So the only new facts are the HOST'S two acts on the Home card, and the capture → chapter link:
--
-- ── 1 · `papic_chapter_windows` — the host's acts on one chapter ─────────────────────────────────────────────────────
--   opened_early_at — "Start now" (owner: the host may start it early). A REAL instant (now()), never a wall clock.
--   picked          — the chapter the Home card shoots into, picked from its dropdown ("Meeting with caterer"). At most
--                     ONE per event (partial unique index). None picked = the chapter happening now.
--   A chapter with no row here behaves exactly as its block says. Deleting the chapter deletes the row (CASCADE).
--
-- ── 2 · `papic_chapter_captures` — a capture belongs to a chapter ────────────────────────────────────────────────────
--   One row per (chapter, capture). A capture is a guest's (`papic_guest_captures.capture_id`) or a seat camera's
--   (`papic_photos.photo_id`) — exactly one. MORE THAN ONE CHAPTER PER CAPTURE IS ALLOWED (plan §7: "A photo ↔ chapter
--   link that allows more than one chapter") — `how = 'added'` is the seam for Memories' "Add to Chapter" (Step 7, NOT
--   built here: no policy writes it).
--   🗑 Deleting a CHAPTER deletes its links, never a photo — they fall back under Unsorted (ruled 1 Nov). Deleting a
--   MOMENT deletes its Papic items (ruled 1 Nov) is NOT built here: captures link to chapters, and the moment-delete
--   warning reads its count from this table once moments carry captures (Step 7 seam).
--
-- ── 3 · THE REFUSALS — enforced HERE, at the link, never only on a screen ────────────────────────────────────────────
--   `papic_chapter_capture_refusal(chapter, event, guest, user, at)` answers NULL (shoot) or why not:
--     not_a_chapter    — not a top-level block of this event
--     chapter_not_open — the shutter is before its window (or its time is TBA and nobody pressed Start now)
--     chapter_closed   — the shutter is after its window
--     not_in_chapter   — this person may not shoot into it under its photo rule
--   The capture routes ask it BEFORE a credit moves; the link's trigger asks it AGAIN for every `captured` link,
--   judged by the capture's own `captured_at` (the shutter), so no caller can link a shot outside the window or by
--   someone outside the chapter. Nothing here touches prices, credits or ceilings: the spend RPCs are unchanged.
--
--   WHO MAY SHOOT (`photo_who`):
--     everybody — anyone the capture lane already let in (a guest of the event, a seat camera on it)
--     chapter   — People in this chapter: named on a task of the chapter or of its moments — as themselves, through a
--                 group they are in, through their role (`guests.role`), or as a booked supplier (also the block's own
--                 `responsible_vendor_ids`)
--     tagged    — Only people tagged: named ONE BY ONE on a task (a person, or a booked supplier) — not by group or role
--   The event's hosts (couple · coordinator) may always shoot into their own chapters.
--   ⚠ Controller's reading, not ruled: "Only people tagged" for SHOOTING = named one by one. Plan §2's chapter-level
--   "Who" (roles, groups, people on the chapter itself) is not built yet; until it is, a chapter's people are its tasks'.
--
-- ⏰ TIME. `start_at`/`end_at` hold the venue's WALL CLOCK in a UTC column (lib/schedule-datetime-local.ts). Here they
-- are lifted into real instants in the event's own zone (`events.timezone`, Asia/Manila when blank or unreadable), so
-- they compare with `now()`, `opened_early_at` and `captured_at`, which are real instants.
--
-- 🔐 RLS at CREATE TABLE:
--   papic_chapter_windows  — the couple reads + writes (current_couple_event_ids); a helper with the Schedule reads.
--   papic_chapter_captures — the couple and a helper with the Schedule READ; NOBODY writes through the API: the capture
--                            routes write with the service role, and the trigger re-checks every row they write.
--   anon holds no grant on either.
--
-- Held by apps/web/tests/db/papic-shoots-into-a-chapter.db.test.ts.

BEGIN;

-- ── 0 · the event's clock ─────────────────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.papic_chapter_tz(p_event_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_tz TEXT;
BEGIN
  SELECT NULLIF(btrim(e.timezone), '') INTO v_tz FROM public.events e WHERE e.event_id = p_event_id;
  IF v_tz IS NULL THEN
    RETURN 'Asia/Manila';
  END IF;
  BEGIN
    PERFORM now() AT TIME ZONE v_tz;
  EXCEPTION WHEN OTHERS THEN
    RETURN 'Asia/Manila';
  END;
  RETURN v_tz;
END;
$$;
-- INVOKER: the caller reads the event row through its own RLS (an unreadable row = Manila, the venue default).
REVOKE ALL ON FUNCTION public.papic_chapter_tz(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.papic_chapter_tz(UUID) TO authenticated, service_role;

-- A chapter's capture window, as REAL instants. Opens at its start — or earlier, when the host pressed Start now —
-- and closes at its end, or at the end of its own day when it has none (or an end not after its start).
-- A chapter with no start (Time TBA) opens only by Start now, and then closes at the end of THAT day.
CREATE OR REPLACE FUNCTION public.papic_chapter_window_bounds(
  p_start_at TIMESTAMPTZ,
  p_end_at TIMESTAMPTZ,
  p_opened_early_at TIMESTAMPTZ,
  p_tz TEXT,
  OUT opens_at TIMESTAMPTZ,
  OUT closes_at TIMESTAMPTZ
)
LANGUAGE plpgsql
STABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  v_start TIMESTAMPTZ;
  v_day_end TIMESTAMPTZ;
BEGIN
  IF p_start_at IS NOT NULL THEN
    -- the wall clock (UTC components) read as the venue's clock → a real instant
    v_start := (p_start_at AT TIME ZONE 'UTC') AT TIME ZONE p_tz;
    v_day_end := (date_trunc('day', p_start_at AT TIME ZONE 'UTC') + INTERVAL '1 day') AT TIME ZONE p_tz;
  ELSIF p_opened_early_at IS NOT NULL THEN
    v_day_end := (date_trunc('day', p_opened_early_at AT TIME ZONE p_tz) + INTERVAL '1 day') AT TIME ZONE p_tz;
  END IF;

  opens_at := CASE
    WHEN v_start IS NULL THEN p_opened_early_at
    WHEN p_opened_early_at IS NOT NULL AND p_opened_early_at < v_start THEN p_opened_early_at
    ELSE v_start
  END;
  IF opens_at IS NULL THEN
    closes_at := NULL;
    RETURN;
  END IF;
  closes_at := CASE
    WHEN p_end_at IS NOT NULL AND v_start IS NOT NULL AND ((p_end_at AT TIME ZONE 'UTC') AT TIME ZONE p_tz) > v_start
      THEN (p_end_at AT TIME ZONE 'UTC') AT TIME ZONE p_tz
    ELSE v_day_end
  END;
END;
$$;
REVOKE ALL ON FUNCTION public.papic_chapter_window_bounds(TIMESTAMPTZ, TIMESTAMPTZ, TIMESTAMPTZ, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.papic_chapter_window_bounds(TIMESTAMPTZ, TIMESTAMPTZ, TIMESTAMPTZ, TEXT) TO authenticated, service_role;

-- ── 1 · the host's acts on a chapter ──────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.papic_chapter_windows (
  block_id        UUID PRIMARY KEY REFERENCES public.event_schedule_blocks(block_id) ON DELETE CASCADE,
  -- Derived from the block by the trigger below — whatever a client sends is replaced.
  event_id        UUID NOT NULL REFERENCES public.events(event_id) ON DELETE CASCADE,
  opened_early_at TIMESTAMPTZ,
  picked          BOOLEAN NOT NULL DEFAULT FALSE,
  updated_by      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.papic_chapter_windows ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS papic_chapter_windows_event_idx ON public.papic_chapter_windows (event_id);
-- The card shoots into ONE chapter: at most one picked per event.
CREATE UNIQUE INDEX IF NOT EXISTS papic_chapter_windows_one_picked ON public.papic_chapter_windows (event_id) WHERE picked;

COMMENT ON TABLE public.papic_chapter_windows IS
  'Papic by chapter (owner 2026-11-01): the host''s acts on one chapter — Start now (opened_early_at, a real instant) and '
  'the chapter the Home card shoots into (picked, one per event). The window itself is the chapter''s start_at → end_at; '
  'who may shoot is its photo_who. 20271300249267.';

CREATE OR REPLACE FUNCTION public.papic_chapter_windows_same_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_event UUID;
BEGIN
  SELECT b.event_id INTO v_event
    FROM public.event_schedule_blocks b
   WHERE b.block_id = NEW.block_id AND b.parent_block_id IS NULL;
  IF v_event IS NULL THEN
    RAISE EXCEPTION 'That is not a chapter.' USING ERRCODE = '23503';
  END IF;
  NEW.event_id := v_event;
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.papic_chapter_windows_same_event() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS papic_chapter_windows_same_event ON public.papic_chapter_windows;
CREATE TRIGGER papic_chapter_windows_same_event
  BEFORE INSERT OR UPDATE ON public.papic_chapter_windows
  FOR EACH ROW EXECUTE FUNCTION public.papic_chapter_windows_same_event();

REVOKE ALL ON TABLE public.papic_chapter_windows FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.papic_chapter_windows TO authenticated;
GRANT ALL ON TABLE public.papic_chapter_windows TO service_role;

DROP POLICY IF EXISTS papic_chapter_windows_couple_write ON public.papic_chapter_windows;
CREATE POLICY papic_chapter_windows_couple_write
  ON public.papic_chapter_windows FOR ALL
  TO authenticated
  USING (event_id IN (SELECT public.current_couple_event_ids()))
  WITH CHECK (event_id IN (SELECT public.current_couple_event_ids()));

DROP POLICY IF EXISTS papic_chapter_windows_moderator_read ON public.papic_chapter_windows;
CREATE POLICY papic_chapter_windows_moderator_read
  ON public.papic_chapter_windows FOR SELECT
  TO authenticated
  USING (event_id IN (SELECT l.event_id FROM public.current_moderator_area_levels('schedule') l WHERE l.level IS NOT NULL));

-- ── 2 · who may shoot into a chapter ──────────────────────────────────────────────────────────────────────────────
-- p_guest_id: the guest taking the shot (guest camera, or a seat camera handed to a guest).
-- p_user_id:  the signed-in person holding a seat camera (its claimer).
CREATE OR REPLACE FUNCTION public.papic_chapter_person_may_shoot(p_block_id UUID, p_guest_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_event   UUID;
  v_who     TEXT;
  v_vendors UUID[];
  v_guest   UUID := p_guest_id;
  v_role    TEXT;
BEGIN
  SELECT b.event_id, b.photo_who, b.responsible_vendor_ids INTO v_event, v_who, v_vendors
    FROM public.event_schedule_blocks b
   WHERE b.block_id = p_block_id AND b.parent_block_id IS NULL;
  IF v_event IS NULL THEN
    RETURN FALSE;
  END IF;

  -- The event's hosts may always shoot into their own chapters.
  IF p_user_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.event_members em
     WHERE em.event_id = v_event AND em.user_id = p_user_id AND em.member_type IN ('couple', 'coordinator')
  ) THEN
    RETURN TRUE;
  END IF;

  -- Everybody: anyone the capture lane already let in.
  IF v_who = 'everybody' THEN
    RETURN TRUE;
  END IF;

  -- A seat camera held by someone who is a guest of this event speaks for that guest.
  IF v_guest IS NULL AND p_user_id IS NOT NULL THEN
    SELECT em.guest_id INTO v_guest
      FROM public.event_members em
     WHERE em.event_id = v_event AND em.user_id = p_user_id AND em.guest_id IS NOT NULL
     LIMIT 1;
  END IF;
  -- A guest of ANOTHER event (or removed from this one) is nobody here.
  IF v_guest IS NOT NULL THEN
    SELECT g.role INTO v_role FROM public.guests g
     WHERE g.guest_id = v_guest AND g.event_id = v_event AND g.deleted_at IS NULL;
    IF NOT FOUND THEN
      v_guest := NULL;
    END IF;
  END IF;

  -- Named on a task of the chapter or of one of its moments.
  IF EXISTS (
    SELECT 1
      FROM public.event_schedule_tasks t
      JOIN public.event_schedule_blocks b ON b.block_id = t.block_id
     WHERE (b.block_id = p_block_id OR b.parent_block_id = p_block_id)
       AND (
         -- one by one: the person …
         (v_guest IS NOT NULL AND t.guest_id = v_guest)
         -- … or the booked supplier they work for
         OR (p_user_id IS NOT NULL AND t.vendor_id IN (
               SELECT ev.vendor_id FROM public.event_vendors ev
                WHERE ev.event_id = v_event
                  AND ev.marketplace_vendor_id IN (
                    SELECT vp.vendor_profile_id FROM public.vendor_profiles vp WHERE vp.user_id = p_user_id
                    UNION
                    SELECT tm.vendor_profile_id FROM public.vendor_team_members tm WHERE tm.user_id = p_user_id
                  )))
         -- People in this chapter also counts a group they are in, and their role.
         OR (v_who = 'chapter' AND v_guest IS NOT NULL AND (
               t.group_id IN (SELECT m.group_id FROM public.guest_group_memberships m WHERE m.guest_id = v_guest)
               OR (t.role IS NOT NULL AND v_role IS NOT NULL AND lower(btrim(t.role)) = lower(btrim(v_role)))
             ))
       )
  ) THEN
    RETURN TRUE;
  END IF;

  -- The chapter's own supplier tags (responsible_vendor_ids) — a supplier on the chapter is one by one.
  IF p_user_id IS NOT NULL AND COALESCE(array_length(v_vendors, 1), 0) > 0 AND EXISTS (
    SELECT 1 FROM public.event_vendors ev
     WHERE ev.event_id = v_event AND ev.vendor_id = ANY (v_vendors)
       AND ev.marketplace_vendor_id IN (
         SELECT vp.vendor_profile_id FROM public.vendor_profiles vp WHERE vp.user_id = p_user_id
         UNION
         SELECT tm.vendor_profile_id FROM public.vendor_team_members tm WHERE tm.user_id = p_user_id
       )
  ) THEN
    RETURN TRUE;
  END IF;

  RETURN FALSE;
END;
$$;
REVOKE ALL ON FUNCTION public.papic_chapter_person_may_shoot(UUID, UUID, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.papic_chapter_person_may_shoot(UUID, UUID, UUID) TO service_role;

-- ── 3 · the one refusal ───────────────────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.papic_chapter_capture_refusal(
  p_block_id UUID,
  p_event_id UUID,
  p_guest_id UUID,
  p_user_id UUID,
  p_at TIMESTAMPTZ
)
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_start  TIMESTAMPTZ;
  v_end    TIMESTAMPTZ;
  v_early  TIMESTAMPTZ;
  v_opens  TIMESTAMPTZ;
  v_closes TIMESTAMPTZ;
BEGIN
  SELECT b.start_at, b.end_at INTO v_start, v_end
    FROM public.event_schedule_blocks b
   WHERE b.block_id = p_block_id AND b.event_id = p_event_id AND b.parent_block_id IS NULL;
  IF NOT FOUND THEN
    RETURN 'not_a_chapter';
  END IF;
  SELECT w.opened_early_at INTO v_early FROM public.papic_chapter_windows w WHERE w.block_id = p_block_id;
  SELECT x.opens_at, x.closes_at INTO v_opens, v_closes
    FROM public.papic_chapter_window_bounds(v_start, v_end, v_early, public.papic_chapter_tz(p_event_id)) x;
  IF v_opens IS NULL OR p_at IS NULL OR p_at < v_opens THEN
    RETURN 'chapter_not_open';
  END IF;
  IF p_at > v_closes THEN
    RETURN 'chapter_closed';
  END IF;
  IF NOT public.papic_chapter_person_may_shoot(p_block_id, p_guest_id, p_user_id) THEN
    RETURN 'not_in_chapter';
  END IF;
  RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.papic_chapter_capture_refusal(UUID, UUID, UUID, UUID, TIMESTAMPTZ) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.papic_chapter_capture_refusal(UUID, UUID, UUID, UUID, TIMESTAMPTZ) TO service_role;

-- ── 4 · a capture belongs to a chapter ────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.papic_chapter_captures (
  link_id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Derived from the chapter by the trigger below.
  event_id         UUID NOT NULL REFERENCES public.events(event_id) ON DELETE CASCADE,
  block_id         UUID NOT NULL REFERENCES public.event_schedule_blocks(block_id) ON DELETE CASCADE,
  guest_capture_id UUID REFERENCES public.papic_guest_captures(capture_id) ON DELETE CASCADE,
  seat_photo_id    UUID REFERENCES public.papic_photos(photo_id) ON DELETE CASCADE,
  -- 'captured' = shot into it by the camera (checked against window + people);
  -- 'added'    = put there later from Memories (Step 7 seam — nothing writes it yet).
  how              TEXT NOT NULL DEFAULT 'captured' CHECK (how IN ('captured', 'added')),
  added_by         UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT papic_chapter_captures_one_capture CHECK (num_nonnulls(guest_capture_id, seat_photo_id) = 1)
);

ALTER TABLE public.papic_chapter_captures ENABLE ROW LEVEL SECURITY;

CREATE UNIQUE INDEX IF NOT EXISTS papic_chapter_captures_guest_once
  ON public.papic_chapter_captures (block_id, guest_capture_id) WHERE guest_capture_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS papic_chapter_captures_seat_once
  ON public.papic_chapter_captures (block_id, seat_photo_id) WHERE seat_photo_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS papic_chapter_captures_event_idx ON public.papic_chapter_captures (event_id);
CREATE INDEX IF NOT EXISTS papic_chapter_captures_guest_idx ON public.papic_chapter_captures (guest_capture_id) WHERE guest_capture_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS papic_chapter_captures_seat_idx ON public.papic_chapter_captures (seat_photo_id) WHERE seat_photo_id IS NOT NULL;

COMMENT ON TABLE public.papic_chapter_captures IS
  'Papic by chapter (owner 2026-11-01): which chapter a capture belongs to — a guest capture or a seat photo, one per row; '
  'a capture may be in more than one chapter (how = added, Memories, Step 7). A captured link is refused outside the '
  'chapter''s window or for someone outside it (trigger). Deleting a chapter deletes its links, never a photo. 20271300249267.';

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
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.papic_chapter_captures_check() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS papic_chapter_captures_check ON public.papic_chapter_captures;
CREATE TRIGGER papic_chapter_captures_check
  BEFORE INSERT OR UPDATE ON public.papic_chapter_captures
  FOR EACH ROW EXECUTE FUNCTION public.papic_chapter_captures_check();

-- Grants: the browser reads (RLS decides what); only the service role (the capture routes) writes.
REVOKE ALL ON TABLE public.papic_chapter_captures FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.papic_chapter_captures TO authenticated;
GRANT ALL ON TABLE public.papic_chapter_captures TO service_role;

DROP POLICY IF EXISTS papic_chapter_captures_couple_read ON public.papic_chapter_captures;
CREATE POLICY papic_chapter_captures_couple_read
  ON public.papic_chapter_captures FOR SELECT
  TO authenticated
  USING (event_id IN (SELECT public.current_couple_event_ids()));

DROP POLICY IF EXISTS papic_chapter_captures_moderator_read ON public.papic_chapter_captures;
CREATE POLICY papic_chapter_captures_moderator_read
  ON public.papic_chapter_captures FOR SELECT
  TO authenticated
  USING (event_id IN (SELECT l.event_id FROM public.current_moderator_area_levels('schedule') l WHERE l.level IS NOT NULL));

-- ── 5 · the event's chapters as Papic sees them — ONE read for the Home card and the cameras ──────────────────────
-- SECURITY INVOKER: the caller's own RLS decides which blocks it sees (the couple: all; the service role: all).
CREATE OR REPLACE FUNCTION public.papic_event_chapters(p_event_id UUID)
RETURNS TABLE (
  block_id UUID,
  label TEXT,
  start_at TIMESTAMPTZ,
  photo_who TEXT,
  opens_at TIMESTAMPTZ,
  closes_at TIMESTAMPTZ,
  opened_early_at TIMESTAMPTZ,
  picked BOOLEAN,
  captures INTEGER
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
  SELECT b.block_id,
         b.label,
         b.start_at,
         b.photo_who,
         x.opens_at,
         x.closes_at,
         w.opened_early_at,
         COALESCE(w.picked, FALSE),
         (SELECT count(*)::int FROM public.papic_chapter_captures c WHERE c.block_id = b.block_id)
    FROM public.event_schedule_blocks b
    LEFT JOIN public.papic_chapter_windows w ON w.block_id = b.block_id
    CROSS JOIN LATERAL public.papic_chapter_window_bounds(b.start_at, b.end_at, w.opened_early_at, public.papic_chapter_tz(p_event_id)) x
   WHERE b.event_id = p_event_id AND b.parent_block_id IS NULL
   ORDER BY b.start_at NULLS LAST, b.sort_order;
$$;

REVOKE ALL ON FUNCTION public.papic_event_chapters(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.papic_event_chapters(UUID) TO authenticated, service_role;

-- The fences must really be there.
DO $$
BEGIN
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.papic_chapter_windows'::regclass)
     OR NOT (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.papic_chapter_captures'::regclass) THEN
    RAISE EXCEPTION 'papic chapter tables must have RLS on';
  END IF;
  IF has_table_privilege('anon', 'public.papic_chapter_windows', 'SELECT')
     OR has_table_privilege('anon', 'public.papic_chapter_captures', 'SELECT') THEN
    RAISE EXCEPTION 'anon must not read the papic chapter tables';
  END IF;
  IF has_table_privilege('authenticated', 'public.papic_chapter_captures', 'INSERT') THEN
    RAISE EXCEPTION 'only the capture routes (service role) write papic_chapter_captures';
  END IF;
END;
$$;

COMMIT;
