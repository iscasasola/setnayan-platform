-- guests_invited_to_chapters
-- Created via `pnpm migration:new`. Prefix auto-allocated to sort AFTER every
-- existing migration. KEEP THIS MIGRATION IDEMPOTENT (it may be re-applied).
--
-- ✉ PER-GUEST "INVITED TO" CHAPTERS (owner 2026-11-02, DECISION_LOG "PER-GUEST "INVITED TO" CHAPTERS", verbatim
-- *"Invited to yes"*; the 31 Oct parts model: guest card Invited to · a partial invite shows a tag · existing guests
-- keep all; corpus SCHEDULE_CHAPTERS_BUILD_PLAN_2026-11-01 §7 "Invitation per guest per chapter … now pointing at
-- chapters").
--
-- 🔑 STORED AS THE EXCEPTION, NOT THE RULE. A chapter is a top-level `event_schedule_blocks` row with `on_invitation`
-- (20271301452824). Every guest is invited to every such chapter UNLESS a row here says they are not:
--   · existing guests keep all — no backfill, nothing to migrate, no live event changes;
--   · a chapter the hosts add later reaches everyone at once (the 31 Oct "Everyone invited?" default yes);
--   · ONE answer to "is this guest invited to this chapter": on the invitation AND no row here
--     (`guestInvitedTo(row, notInvited)` in lib/invitation-chapters.ts — the one rule every reader asks).
-- `guests.invited_to_blocks` (five fixed words, 2026-05) is NOT a chapter and is not read for chapters: it stays what it
-- was for an event with no chapters on its invitation, and the card carries it unchanged once chapters exist.
--
-- ── THE REPLIES FOLLOW (the database is the fence, whoever writes) ───────────────────────────────────────────────
--   · a guest taken OFF a chapter loses their answer to it (their row in `guest_chapter_replies` is deleted), so every
--     per-chapter count stops counting them the moment they are taken off — no reader has to remember;
--   · an answer to a chapter a guest is not invited to is never stored: the guest's own reply, the "keep every earlier
--     reply" trigger when a chapter joins the invitation, and its backfill all skip it (BEFORE INSERT → skipped);
--   · put back ON a chapter, a guest who already replied has no answer for it, so it is asked as new — exactly as a
--     chapter added after they replied (ruled 1 Nov, plan §9 #7).
--
-- ── WHO WRITES / READS ───────────────────────────────────────────────────────────────────────────────────────────
--   · hosts (current_couple_event_ids), admin, and a Guest-list helper with EDIT — from the guest card's "Invited to ▾"
--     (`updateGuest`); a helper with any level reads. The terms `march_groups` uses (20271296703339).
--   · anon: NOTHING. A guest's own invitation reaches them only through the service-role guest page.
--
-- Held by apps/web/tests/db/guests-invited-to-chapters.db.test.ts.

BEGIN;

CREATE TABLE IF NOT EXISTS public.guest_chapter_not_invited (
  guest_id   UUID NOT NULL REFERENCES public.guests(guest_id) ON DELETE CASCADE,
  block_id   UUID NOT NULL REFERENCES public.event_schedule_blocks(block_id) ON DELETE CASCADE,
  -- Derived from the chapter by the trigger below — whatever a writer sends is replaced.
  event_id   UUID NOT NULL REFERENCES public.events(event_id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (guest_id, block_id)
);

ALTER TABLE public.guest_chapter_not_invited ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS guest_chapter_not_invited_block_idx ON public.guest_chapter_not_invited (block_id);
CREATE INDEX IF NOT EXISTS guest_chapter_not_invited_event_idx ON public.guest_chapter_not_invited (event_id);

COMMENT ON TABLE public.guest_chapter_not_invited IS
  'A guest who is NOT invited to one invitation chapter (owner 2026-11-02, "Invited to"). Default = invited to every '
  'chapter on the invitation; a row is the exception. Written from the guest card (updateGuest) by hosts and Guest-list '
  'helpers with edit; read by hosts and helpers. anon reads nothing. A row deletes the guest''s answer to that chapter; '
  'an answer to a chapter the guest is not invited to is never stored. 20271302948959.';

-- The event comes from the chapter; only a TOP-LEVEL block (a chapter) can be left off, and only for a guest of the same
-- event. SECURITY DEFINER only to LOOK UP the chapter and the guest; it writes nothing but NEW.
CREATE OR REPLACE FUNCTION public.guest_chapter_not_invited_same_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_event  UUID;
  v_parent UUID;
BEGIN
  SELECT b.event_id, b.parent_block_id INTO v_event, v_parent
    FROM public.event_schedule_blocks b WHERE b.block_id = NEW.block_id;
  IF v_event IS NULL THEN
    RAISE EXCEPTION 'That chapter is not on the schedule.' USING ERRCODE = '23503';
  END IF;
  IF v_parent IS NOT NULL THEN
    RAISE EXCEPTION 'A guest is invited to a chapter, never to a moment.' USING ERRCODE = '23514';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.guests g WHERE g.guest_id = NEW.guest_id AND g.event_id = v_event) THEN
    RAISE EXCEPTION 'That guest is not on this event.' USING ERRCODE = '23514';
  END IF;
  NEW.event_id := v_event;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.guest_chapter_not_invited_same_event() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS guest_chapter_not_invited_same_event ON public.guest_chapter_not_invited;
CREATE TRIGGER guest_chapter_not_invited_same_event
  BEFORE INSERT OR UPDATE ON public.guest_chapter_not_invited
  FOR EACH ROW EXECUTE FUNCTION public.guest_chapter_not_invited_same_event();

-- Taken off a chapter → their answer to it goes (every per-chapter count follows at once).
CREATE OR REPLACE FUNCTION public.not_invited_drops_the_chapter_reply()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  DELETE FROM public.guest_chapter_replies r WHERE r.guest_id = NEW.guest_id AND r.block_id = NEW.block_id;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.not_invited_drops_the_chapter_reply() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS not_invited_drops_the_chapter_reply ON public.guest_chapter_not_invited;
CREATE TRIGGER not_invited_drops_the_chapter_reply
  AFTER INSERT ON public.guest_chapter_not_invited
  FOR EACH ROW EXECUTE FUNCTION public.not_invited_drops_the_chapter_reply();

-- An answer to a chapter the guest is not invited to is never stored — from ANY writer (the guest's reply, the
-- "keep every earlier reply" trigger, its backfill). Fires after `guest_chapter_replies_same_event` (name order).
CREATE OR REPLACE FUNCTION public.guest_chapter_replies_skip_not_invited()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.guest_chapter_not_invited x WHERE x.guest_id = NEW.guest_id AND x.block_id = NEW.block_id) THEN
    RETURN NULL;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.guest_chapter_replies_skip_not_invited() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS guest_chapter_replies_skip_not_invited ON public.guest_chapter_replies;
CREATE TRIGGER guest_chapter_replies_skip_not_invited
  BEFORE INSERT ON public.guest_chapter_replies
  FOR EACH ROW EXECUTE FUNCTION public.guest_chapter_replies_skip_not_invited();

-- Grants: hosts and edit helpers write through RLS; anon holds nothing; the guest page reads as service_role.
REVOKE ALL ON TABLE public.guest_chapter_not_invited FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, DELETE ON TABLE public.guest_chapter_not_invited TO authenticated;
GRANT ALL ON TABLE public.guest_chapter_not_invited TO service_role;

DROP POLICY IF EXISTS guest_chapter_not_invited_host_all ON public.guest_chapter_not_invited;
CREATE POLICY guest_chapter_not_invited_host_all
  ON public.guest_chapter_not_invited FOR ALL
  TO authenticated
  USING (
    event_id IN (SELECT public.current_couple_event_ids())
    OR (SELECT public.is_admin())
    OR event_id IN (SELECT l.event_id FROM public.current_moderator_area_levels('guest_list') l WHERE l.level = 'edit')
  )
  WITH CHECK (
    event_id IN (SELECT public.current_couple_event_ids())
    OR (SELECT public.is_admin())
    OR event_id IN (SELECT l.event_id FROM public.current_moderator_area_levels('guest_list') l WHERE l.level = 'edit')
  );

DROP POLICY IF EXISTS guest_chapter_not_invited_moderator_read ON public.guest_chapter_not_invited;
CREATE POLICY guest_chapter_not_invited_moderator_read
  ON public.guest_chapter_not_invited FOR SELECT
  TO authenticated
  USING (event_id IN (SELECT l.event_id FROM public.current_moderator_area_levels('guest_list') l WHERE l.level IS NOT NULL));

-- The fence must really be there: RLS on, anon without a grant, no policy for anon.
DO $$
BEGIN
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.guest_chapter_not_invited'::regclass) THEN
    RAISE EXCEPTION 'guest_chapter_not_invited must have RLS on';
  END IF;
  IF has_table_privilege('anon', 'public.guest_chapter_not_invited', 'SELECT') THEN
    RAISE EXCEPTION 'anon must not read guest_chapter_not_invited';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'guest_chapter_not_invited'
             AND 'anon' = ANY (roles)) THEN
    RAISE EXCEPTION 'no policy on guest_chapter_not_invited may name anon';
  END IF;
END;
$$;

COMMIT;
