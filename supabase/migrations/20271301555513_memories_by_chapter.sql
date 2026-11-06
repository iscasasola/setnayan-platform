-- memories_by_chapter
-- Created via `pnpm migration:new`. Prefix auto-allocated to sort AFTER every
-- existing migration. KEEP THIS MIGRATION IDEMPOTENT (it may be re-applied).
--
-- 📸 MEMORIES BY CHAPTER — Step 7 (owner 2026-11-01, DECISION_LOG "A CHAPTER'S PHOTOS: WHO + WHEN; ADD TO OTHER
-- CHAPTERS …" · "SCHEDULE PLAN §9: EIGHT OPEN ITEMS RULED" (3) "after the event hosts see every chapter, and a chapter's
-- Everybody = the whole guest list"; corpus SCHEDULE_CHAPTERS_BUILD_PLAN_2026-11-01.md §3 Photos, §4 rows "Memories by
-- chapter" and "Add to other chapters"). Owner: *"A chapter is exclusive to 1. the people part of that initially or
-- tagged only or to everybody 2. show instantly for everybody or will only show once event is done"* · *"Bride and groom
-- do not see until post event"* · *"We can add media files inside other chapters on memories directly."*
--
-- 🔑 EXTEND, DO NOT REBUILD. Everything this needs is already stored:
--   · a chapter's photos       — `papic_chapter_captures` (20271300249267; more than one chapter per capture allowed,
--                                `how = 'added'` was left as THIS step's seam)
--   · who sees, when           — the chapter's own `photo_who` / `photo_when` (20271300072429), unenforced until now
--   · who is in a chapter      — the people `papic_chapter_person_may_shoot` already names (tasks of the chapter and its
--                                moments; groups and roles; booked suppliers). That body is MOVED into ONE function,
--                                `papic_chapter_person_in`, which the shoot rule and the read rule below both call —
--                                one answer to "who is in this chapter", never two copies drifting apart.
--   · a face tag               — `photo_tags` (live rows, `removed_at IS NULL`)
--   · "the event is done"      — the app's own rule (`getMenuLifecyclePhase`, lib/day-of-mode.ts): cleared, or the
--                                venue clock has reached 06:00 on the morning after the last day. Mirrored here once.
-- No table is added.
--
-- ── THE READ RULE (the approved prototype's `seesMedia`, prototypes/schedule_chapters_2026-11-01) ──────────────────
--   A person sees a photo in a chapter when:
--     · it is THEIR OWN (they took it — a guest capture of theirs, or a seat camera they hold) — always;
--     · they are a HOST (the couple) and the event is DONE — every chapter (ruled 1 Nov);
--     · otherwise, the chapter's When first: "after the event" shows nothing to anyone until the event is done
--       (*"Bride and groom do not see until post event"*);
--     · then its Who:
--         everybody — the whole guest list (ruled 1 Nov), the hosts, and the chapter's own people;
--         chapter   — People in this chapter only (named on a task, through a group, through a role, a booked supplier);
--         tagged    — only the photos the viewer is face-tagged in.
--   🔒 A FACE TAG NEVER OVERRIDES "People in this chapter": under `chapter`, a tag on the photo grants nothing.
--   A photo in NO chapter is Unsorted — this rule does not touch it (the event-wide rules still decide it).
--   ⚠ Controller's reading, not ruled: before the event is done a host is judged like everyone else (as the prototype's
--   `seesMedia` does) — so a host on no task of a "People in this chapter" chapter sees only their own shots in it until
--   the morning after. That is what keeps *"Bride and groom do not see until post event"* true. Flagged in the PR.
--
-- ── THE READS (SECURITY DEFINER, keyed on auth.uid() — never on an id a caller sends) ───────────────────────────────
--   papic_memories_chapters(event)        — the chapters the caller may SEE (`listed`) or ADD TO (`may_add`), with how
--                                            many photos they see in each. The Memories dropdown lists `listed` only.
--   papic_memories_photo_chapters(event)  — one row per (capture, chapter) the caller sees it in; and, for the couple
--                                            or a moderator of the event only (who already read every link through
--                                            RLS), one `withheld` row per linked capture they see in NO chapter, so the
--                                            Memories read drops it.
--   ⏭ NOT HERE (the next Step 7 slice): the check on every photo URL, signed links included. The papic tables' own RLS
--   still lets the couple read every capture row, and a presigned URL is not re-checked against a chapter. The seam is
--   `papic_chapter_capture_visible(link, user)` below — the one per-photo answer that check must call.
--
-- ── THE WRITE (Add to Chapter) ──────────────────────────────────────────────────────────────────────────────────────
--   papic_memories_set_chapter(event, chapter, guest capture | seat photo, in) — adds (`how = 'added'`) or removes an
--   ADDED link. Hosts and a chapter's people may add a photo they can see, from a chapter they are in (hosts: any, or
--   Unsorted), to another chapter they are in (hosts: any). A shot's own chapter (`how = 'captured'`) is never removed.
--   Answers NULL (done) or why not; the link's trigger (20271300249267) still checks chapter and event.
--
-- Held by apps/web/tests/db/memories-by-chapter.db.test.ts.

BEGIN;

-- ── 0 · has the event finished? (lib/day-of-mode.ts `getMenuLifecyclePhase` → 'after') ───────────────────────────
CREATE OR REPLACE FUNCTION public.papic_event_is_done(p_event_id UUID, p_at TIMESTAMPTZ DEFAULT NOW())
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_date    DATE;
  v_end     DATE;
  v_cleared TIMESTAMPTZ;
  v_tz      TEXT;
BEGIN
  SELECT e.event_date, e.event_end_date, e.cleared_at INTO v_date, v_end, v_cleared
    FROM public.events e WHERE e.event_id = p_event_id;
  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;
  IF v_cleared IS NOT NULL THEN
    RETURN TRUE;
  END IF;
  IF v_date IS NULL THEN
    RETURN FALSE;
  END IF;
  v_tz := public.papic_chapter_tz(p_event_id);
  -- 06:00 on the morning after the last day, on the venue's clock.
  RETURN p_at >= ((COALESCE(v_end, v_date) + 1)::timestamp + TIME '06:00') AT TIME ZONE v_tz;
END;
$$;
REVOKE ALL ON FUNCTION public.papic_event_is_done(UUID, TIMESTAMPTZ) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.papic_event_is_done(UUID, TIMESTAMPTZ) TO service_role;

-- ── 1 · who is IN a chapter — ONE answer, for shooting and for seeing ─────────────────────────────────────────────
-- p_one_by_one: only people named one by one (a person, a booked supplier) — not through a group or a role.
CREATE OR REPLACE FUNCTION public.papic_chapter_person_in(p_block_id UUID, p_guest_id UUID, p_user_id UUID, p_one_by_one BOOLEAN)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_event   UUID;
  v_vendors UUID[];
  v_guest   UUID := p_guest_id;
  v_role    TEXT;
BEGIN
  SELECT b.event_id, b.responsible_vendor_ids INTO v_event, v_vendors
    FROM public.event_schedule_blocks b
   WHERE b.block_id = p_block_id AND b.parent_block_id IS NULL;
  IF v_event IS NULL THEN
    RETURN FALSE;
  END IF;

  -- A signed-in person who is a guest of this event speaks for that guest.
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
         OR (NOT p_one_by_one AND v_guest IS NOT NULL AND (
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
REVOKE ALL ON FUNCTION public.papic_chapter_person_in(UUID, UUID, UUID, BOOLEAN) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.papic_chapter_person_in(UUID, UUID, UUID, BOOLEAN) TO service_role;

-- The shoot rule (20271300249267), now over the ONE people function. Same answers, same signature, same grants:
-- the hosts always; Everybody; else the chapter's people (one by one under "Only people tagged").
CREATE OR REPLACE FUNCTION public.papic_chapter_person_may_shoot(p_block_id UUID, p_guest_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_event UUID;
  v_who   TEXT;
BEGIN
  SELECT b.event_id, b.photo_who INTO v_event, v_who
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
  RETURN public.papic_chapter_person_in(p_block_id, p_guest_id, p_user_id, v_who = 'tagged');
END;
$$;
REVOKE ALL ON FUNCTION public.papic_chapter_person_may_shoot(UUID, UUID, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.papic_chapter_person_may_shoot(UUID, UUID, UUID) TO service_role;

-- ── 2 · what a person sees of a chapter: 'all' its photos · 'tagged' only those they are in · NULL nothing ─────────
-- (Their OWN photos are always theirs — `papic_chapter_capture_visible` adds that per photo.)
CREATE OR REPLACE FUNCTION public.papic_chapter_viewer_sees(p_block_id UUID, p_user_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_event UUID;
  v_who   TEXT;
  v_when  TEXT;
  v_host  BOOLEAN;
  v_done  BOOLEAN;
  v_guest UUID;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN NULL;
  END IF;
  SELECT b.event_id, b.photo_who, b.photo_when INTO v_event, v_who, v_when
    FROM public.event_schedule_blocks b
   WHERE b.block_id = p_block_id AND b.parent_block_id IS NULL;
  IF v_event IS NULL THEN
    RETURN NULL;
  END IF;

  v_host := EXISTS (
    SELECT 1 FROM public.event_members em
     WHERE em.event_id = v_event AND em.user_id = p_user_id AND em.member_type = 'couple'
  );
  v_done := public.papic_event_is_done(v_event);

  -- Ruled 1 Nov: once the event is done, the hosts see every chapter.
  IF v_host AND v_done THEN
    RETURN 'all';
  END IF;
  -- When: "only once the event is done" holds for everybody — the hosts included (*"Bride and groom do not see until
  -- post event"*).
  IF v_when = 'after_event' AND NOT v_done THEN
    RETURN NULL;
  END IF;

  -- A guest of this event (live on its guest list).
  SELECT em.guest_id INTO v_guest
    FROM public.event_members em
    JOIN public.guests g ON g.guest_id = em.guest_id AND g.event_id = v_event AND g.deleted_at IS NULL
   WHERE em.event_id = v_event AND em.user_id = p_user_id
   LIMIT 1;

  IF v_who = 'everybody' THEN
    -- Ruled 1 Nov: Everybody = the whole guest list (and the hosts, and the chapter's own people).
    IF v_host OR v_guest IS NOT NULL OR public.papic_chapter_person_in(p_block_id, v_guest, p_user_id, FALSE) THEN
      RETURN 'all';
    END IF;
    RETURN NULL;
  END IF;
  IF v_who = 'tagged' THEN
    -- Only people tagged: each sees the photos they are in — nobody else's, whoever they are.
    IF v_host OR v_guest IS NOT NULL THEN
      RETURN 'tagged';
    END IF;
    RETURN NULL;
  END IF;
  -- People in this chapter. 🔒 A face tag never overrides it: it is not asked here at all.
  IF public.papic_chapter_person_in(p_block_id, v_guest, p_user_id, FALSE) THEN
    RETURN 'all';
  END IF;
  RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.papic_chapter_viewer_sees(UUID, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.papic_chapter_viewer_sees(UUID, UUID) TO service_role;

-- ── 3 · ONE photo in ONE chapter: may this person see it? — THE SEAM the per-URL check (next slice) must call ───────
CREATE OR REPLACE FUNCTION public.papic_chapter_capture_visible(p_link_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_block UUID;
  v_event UUID;
  v_gc    UUID;
  v_sp    UUID;
  v_guest UUID;
  v_sees  TEXT;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN FALSE;
  END IF;
  SELECT l.block_id, l.event_id, l.guest_capture_id, l.seat_photo_id INTO v_block, v_event, v_gc, v_sp
    FROM public.papic_chapter_captures l WHERE l.link_id = p_link_id;
  IF v_block IS NULL THEN
    RETURN FALSE;
  END IF;

  SELECT em.guest_id INTO v_guest
    FROM public.event_members em
   WHERE em.event_id = v_event AND em.user_id = p_user_id AND em.guest_id IS NOT NULL
   LIMIT 1;

  -- People always see their own photos.
  IF v_gc IS NOT NULL AND v_guest IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.papic_guest_captures c WHERE c.capture_id = v_gc AND c.guest_id = v_guest
  ) THEN
    RETURN TRUE;
  END IF;
  IF v_sp IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.papic_photos p
      JOIN public.paparazzi_seats s ON s.seat_id = p.paparazzi_seat_id
     WHERE p.photo_id = v_sp AND (s.claimer_user_id = p_user_id OR (v_guest IS NOT NULL AND s.guest_id = v_guest))
  ) THEN
    RETURN TRUE;
  END IF;

  v_sees := public.papic_chapter_viewer_sees(v_block, p_user_id);
  IF v_sees = 'all' THEN
    RETURN TRUE;
  END IF;
  IF v_sees = 'tagged' AND v_guest IS NOT NULL THEN
    RETURN EXISTS (
      SELECT 1 FROM public.photo_tags t
       WHERE t.event_id = v_event AND t.guest_id = v_guest AND t.removed_at IS NULL
         AND ((v_gc IS NOT NULL AND t.source_table = 'papic_guest_captures' AND t.source_id = v_gc)
           OR (v_sp IS NOT NULL AND t.source_table = 'papic_photos' AND t.source_id = v_sp))
    );
  END IF;
  RETURN FALSE;
END;
$$;
REVOKE ALL ON FUNCTION public.papic_chapter_capture_visible(UUID, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.papic_chapter_capture_visible(UUID, UUID) TO service_role;

-- ── 4 · the Memories reads (the caller is auth.uid(), never a parameter) ──────────────────────────────────────────

-- The chapters the caller may see or add to. `listed` = the dropdown lists it (they see the chapter, or at least one
-- photo in it — their own); `may_add` = a host, or one of its people. A chapter that is neither is not returned at all.
CREATE OR REPLACE FUNCTION public.papic_memories_chapters(p_event_id UUID)
RETURNS TABLE (
  block_id UUID,
  label TEXT,
  start_at TIMESTAMPTZ,
  photo_who TEXT,
  photo_when TEXT,
  sees TEXT,
  is_in BOOLEAN,
  may_add BOOLEAN,
  listed BOOLEAN,
  photos INTEGER
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid  UUID := auth.uid();
  v_host BOOLEAN;
BEGIN
  IF v_uid IS NULL THEN
    RETURN;
  END IF;
  v_host := EXISTS (
    SELECT 1 FROM public.event_members em
     WHERE em.event_id = p_event_id AND em.user_id = v_uid AND em.member_type = 'couple'
  );
  RETURN QUERY
  SELECT x.block_id, x.label, x.start_at, x.photo_who, x.photo_when, x.sees, x.is_in,
         (v_host OR x.is_in) AS may_add,
         (x.sees IS NOT NULL OR x.photos > 0) AS listed,
         x.photos
    FROM (
      SELECT b.block_id, b.label, b.start_at, b.photo_who, b.photo_when, b.sort_order,
             public.papic_chapter_viewer_sees(b.block_id, v_uid) AS sees,
             public.papic_chapter_person_in(b.block_id, NULL, v_uid, FALSE) AS is_in,
             (SELECT count(*)::int FROM public.papic_chapter_captures l
               WHERE l.block_id = b.block_id AND public.papic_chapter_capture_visible(l.link_id, v_uid)) AS photos
        FROM public.event_schedule_blocks b
       WHERE b.event_id = p_event_id AND b.parent_block_id IS NULL
    ) x
   WHERE x.sees IS NOT NULL OR x.photos > 0 OR v_host OR x.is_in
   ORDER BY x.start_at NULLS LAST, x.sort_order;
END;
$$;
REVOKE ALL ON FUNCTION public.papic_memories_chapters(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.papic_memories_chapters(UUID) TO authenticated, service_role;

-- One row per (capture, chapter) the caller sees it in — and, for those who already read every link through RLS (the
-- couple, a moderator with the Schedule), one `withheld` row (block_id NULL) per linked capture they see in NONE.
CREATE OR REPLACE FUNCTION public.papic_memories_photo_chapters(p_event_id UUID)
RETURNS TABLE (
  guest_capture_id UUID,
  seat_photo_id UUID,
  block_id UUID,
  how TEXT,
  withheld BOOLEAN
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid      UUID := auth.uid();
  v_link_rls BOOLEAN;
BEGIN
  IF v_uid IS NULL THEN
    RETURN;
  END IF;
  v_link_rls := EXISTS (
      SELECT 1 FROM public.event_members em
       WHERE em.event_id = p_event_id AND em.user_id = v_uid AND em.member_type = 'couple'
    ) OR EXISTS (
      SELECT 1 FROM public.current_moderator_area_levels('schedule') m WHERE m.event_id = p_event_id AND m.level IS NOT NULL
    );
  RETURN QUERY
  WITH links AS (
    SELECT l.guest_capture_id, l.seat_photo_id, l.block_id, l.how,
           public.papic_chapter_capture_visible(l.link_id, v_uid) AS visible
      FROM public.papic_chapter_captures l
     WHERE l.event_id = p_event_id
  )
  SELECT k.guest_capture_id, k.seat_photo_id, k.block_id, k.how, FALSE
    FROM links k WHERE k.visible
  UNION ALL
  SELECT k.guest_capture_id, k.seat_photo_id, NULL::uuid, NULL::text, TRUE
    FROM links k
   WHERE v_link_rls
   GROUP BY k.guest_capture_id, k.seat_photo_id
  HAVING NOT bool_or(k.visible);
END;
$$;
REVOKE ALL ON FUNCTION public.papic_memories_photo_chapters(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.papic_memories_photo_chapters(UUID) TO authenticated, service_role;

-- ── 5 · Add to Chapter — the one writer of `how = 'added'` ────────────────────────────────────────────────────────
-- Answers NULL (done) or why not:
--   not_signed_in · not_a_chapter · not_this_event · not_yours_to_add (target) · cannot_see_photo (source) ·
--   shot_here (a captured link is never removed)
CREATE OR REPLACE FUNCTION public.papic_memories_set_chapter(
  p_event_id UUID,
  p_block_id UUID,
  p_guest_capture_id UUID,
  p_seat_photo_id UUID,
  p_in BOOLEAN
)
RETURNS TEXT
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid    UUID := auth.uid();
  v_host   BOOLEAN;
  v_cap_ev UUID;
  v_linked BOOLEAN;
  v_source BOOLEAN;
  v_how    TEXT;
BEGIN
  IF v_uid IS NULL THEN
    RETURN 'not_signed_in';
  END IF;
  IF num_nonnulls(p_guest_capture_id, p_seat_photo_id) <> 1 THEN
    RETURN 'cannot_see_photo';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.event_schedule_blocks b
     WHERE b.block_id = p_block_id AND b.event_id = p_event_id AND b.parent_block_id IS NULL
  ) THEN
    RETURN 'not_a_chapter';
  END IF;
  IF p_guest_capture_id IS NOT NULL THEN
    SELECT c.event_id INTO v_cap_ev FROM public.papic_guest_captures c WHERE c.capture_id = p_guest_capture_id;
  ELSE
    SELECT p.event_id INTO v_cap_ev FROM public.papic_photos p WHERE p.photo_id = p_seat_photo_id;
  END IF;
  IF v_cap_ev IS NULL OR v_cap_ev <> p_event_id THEN
    RETURN 'not_this_event';
  END IF;

  v_host := EXISTS (
    SELECT 1 FROM public.event_members em
     WHERE em.event_id = p_event_id AND em.user_id = v_uid AND em.member_type = 'couple'
  );
  -- The TARGET: hosts, or one of the chapter's people.
  IF NOT v_host AND NOT public.papic_chapter_person_in(p_block_id, NULL, v_uid, FALSE) THEN
    RETURN 'not_yours_to_add';
  END IF;

  -- The SOURCE: a photo they can see, from a chapter they are in (a host: any chapter they see it in, or Unsorted).
  v_linked := EXISTS (
    SELECT 1 FROM public.papic_chapter_captures l
     WHERE (l.guest_capture_id = p_guest_capture_id OR l.seat_photo_id = p_seat_photo_id)
  );
  SELECT bool_or(
           public.papic_chapter_capture_visible(l.link_id, v_uid)
           AND (v_host OR public.papic_chapter_person_in(l.block_id, NULL, v_uid, FALSE))
         )
    INTO v_source
    FROM public.papic_chapter_captures l
   WHERE (l.guest_capture_id = p_guest_capture_id OR l.seat_photo_id = p_seat_photo_id);
  IF NOT COALESCE(v_source, FALSE) AND NOT (v_host AND NOT v_linked) THEN
    RETURN 'cannot_see_photo';
  END IF;

  IF p_in THEN
    IF p_guest_capture_id IS NOT NULL THEN
      INSERT INTO public.papic_chapter_captures (block_id, guest_capture_id, how, added_by)
      VALUES (p_block_id, p_guest_capture_id, 'added', v_uid)
      ON CONFLICT (block_id, guest_capture_id) WHERE guest_capture_id IS NOT NULL DO NOTHING;
    ELSE
      INSERT INTO public.papic_chapter_captures (block_id, seat_photo_id, how, added_by)
      VALUES (p_block_id, p_seat_photo_id, 'added', v_uid)
      ON CONFLICT (block_id, seat_photo_id) WHERE seat_photo_id IS NOT NULL DO NOTHING;
    END IF;
    RETURN NULL;
  END IF;

  SELECT l.how INTO v_how FROM public.papic_chapter_captures l
   WHERE l.block_id = p_block_id AND (l.guest_capture_id = p_guest_capture_id OR l.seat_photo_id = p_seat_photo_id);
  IF v_how = 'captured' THEN
    RETURN 'shot_here';
  END IF;
  DELETE FROM public.papic_chapter_captures l
   WHERE l.block_id = p_block_id AND l.how = 'added'
     AND (l.guest_capture_id = p_guest_capture_id OR l.seat_photo_id = p_seat_photo_id);
  RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.papic_memories_set_chapter(UUID, UUID, UUID, UUID, BOOLEAN) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.papic_memories_set_chapter(UUID, UUID, UUID, UUID, BOOLEAN) TO authenticated, service_role;

COMMENT ON FUNCTION public.papic_chapter_capture_visible(UUID, UUID) IS
  'Memories by chapter (owner 2026-11-01): may this person see this photo in this chapter? Own photos always; hosts every '
  'chapter once the event is done; else the chapter''s When, then its Who (everybody = the guest list; chapter = its '
  'people, a face tag never overrides; tagged = photos they are tagged in). The seam the per-URL check must call. 20271301555513.';

COMMIT;
