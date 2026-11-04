-- guests_reply_by_chapter
-- Created via `pnpm migration:new`. Prefix auto-allocated to sort AFTER every
-- existing migration. KEEP THIS MIGRATION IDEMPOTENT (it may be re-applied).
--
-- ✉ GUESTS AND RSVP BY CHAPTER — STEP 5 (owner 2026-11-01; corpus SCHEDULE_CHAPTERS_BUILD_PLAN_2026-11-01 §3 "RSVP
-- depends on chapters" · "TBA" · §9 item 7 · §12 Step 5).
--
--   *"Rsvp will depend on what chapters we make."* Only chapters ON THE INVITATION (a top-level
--   `event_schedule_blocks` row with `on_invitation`) are replied to. Yes is one tap; "I can't make it" asks which.
--
-- 🔑 EXTEND, DO NOT REBUILD. `guests.rsvp_status` stays THE answer every count, gate and notice already reads
-- (attending = coming to at least one chapter). This table only adds WHICH chapters: one row per guest per chapter
-- they answered. A chapter's venue is never asked — a blank venue still sends, as "Venue TBA" (owner: *"Sometime it
-- can be tba"*).
--
-- ── WHO WRITES ────────────────────────────────────────────────────────────────────────────────────────────────────
--   · the GUEST, through `submitRsvp` (app/[slug]/actions.ts) on the service-role client, after it has proved the
--     reply's identity — exactly like the answer itself. No browser role can write a guest's reply.
--   · the DATABASE, below, when a chapter joins the invitation (the 1 Nov ruling, plan §9 #7).
--   · `removal_seen_at`: the guest pressing OK on "X is no longer on your invitation", through the same action.
-- ── WHO READS ─────────────────────────────────────────────────────────────────────────────────────────────────────
--   · hosts (current_couple_event_ids) and a Guest-list helper with any level — per-chapter counts and "who said
--     yes" before a chapter comes off the invitation (ruled 1 Nov: *"removed = hosts first see who said yes, then
--     guests are notified"*).
--   · anon and every other role: NOTHING. A guest's own row reaches them only through the service-role page.
--
-- 🗂 RULED 1 NOV (plan §9 #7) — ADDING A CHAPTER AFTER INVITES WENT OUT asks the guests who already replied about
-- that chapter alone ("a notice + one Yes / Can't make it"). For that to be computable, a reply must be on record
-- chapter by chapter BEFORE the new chapter arrives: the trigger below keeps every replied guest's answer as rows for
-- the chapters ALREADY on the invitation. When the switched-on chapter is the FIRST one, the guest's answer was to
-- the whole invitation, so it stands for that chapter too. Any later chapter has no row → it is asked as new.
-- REMOVING a chapter deletes no row (replies are kept); the guest who said yes is told once (removal_seen_at).
--
-- Held by apps/web/tests/db/guests-reply-by-chapter.db.test.ts.

BEGIN;

CREATE TABLE IF NOT EXISTS public.guest_chapter_replies (
  guest_id        UUID NOT NULL REFERENCES public.guests(guest_id) ON DELETE CASCADE,
  block_id        UUID NOT NULL REFERENCES public.event_schedule_blocks(block_id) ON DELETE CASCADE,
  -- Derived from the chapter by the trigger below — whatever a writer sends is replaced.
  event_id        UUID NOT NULL REFERENCES public.events(event_id) ON DELETE CASCADE,
  attending       BOOLEAN NOT NULL,
  replied_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- The chapter left the invitation and the guest has seen the notice that says so.
  removal_seen_at TIMESTAMPTZ,
  PRIMARY KEY (guest_id, block_id)
);

ALTER TABLE public.guest_chapter_replies ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS guest_chapter_replies_block_idx ON public.guest_chapter_replies (block_id, attending);
CREATE INDEX IF NOT EXISTS guest_chapter_replies_event_idx ON public.guest_chapter_replies (event_id);

COMMENT ON TABLE public.guest_chapter_replies IS
  'A guest''s answer per invitation chapter (owner 2026-11-01, "Rsvp will depend on what chapters we make"). guests.rsvp_status '
  'stays the overall answer (attending = at least one chapter). Written by the guest''s reply (service role) and by the '
  'database when a chapter joins the invitation; read by hosts and Guest-list helpers. anon reads nothing. 20271301452824.';

-- The event comes from the chapter; only a TOP-LEVEL block (a chapter) can be replied to, and only by a guest of the
-- same event. SECURITY DEFINER only to LOOK UP the chapter and the guest; it writes nothing but NEW.
CREATE OR REPLACE FUNCTION public.guest_chapter_replies_same_event()
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
    RAISE EXCEPTION 'Only a chapter is replied to, never a moment.' USING ERRCODE = '23514';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.guests g WHERE g.guest_id = NEW.guest_id AND g.event_id = v_event) THEN
    RAISE EXCEPTION 'That guest is not on this event.' USING ERRCODE = '23514';
  END IF;
  NEW.event_id := v_event;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.guest_chapter_replies_same_event() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS guest_chapter_replies_same_event ON public.guest_chapter_replies;
CREATE TRIGGER guest_chapter_replies_same_event
  BEFORE INSERT OR UPDATE ON public.guest_chapter_replies
  FOR EACH ROW EXECUTE FUNCTION public.guest_chapter_replies_same_event();

-- Grants: hosts and helpers READ through RLS; anon holds nothing; the guest's reply writes as service_role.
REVOKE ALL ON TABLE public.guest_chapter_replies FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.guest_chapter_replies TO authenticated;
GRANT ALL ON TABLE public.guest_chapter_replies TO service_role;

DROP POLICY IF EXISTS guest_chapter_replies_couple_read ON public.guest_chapter_replies;
CREATE POLICY guest_chapter_replies_couple_read
  ON public.guest_chapter_replies FOR SELECT
  TO authenticated
  USING (event_id IN (SELECT public.current_couple_event_ids()));

DROP POLICY IF EXISTS guest_chapter_replies_moderator_read ON public.guest_chapter_replies;
CREATE POLICY guest_chapter_replies_moderator_read
  ON public.guest_chapter_replies FOR SELECT
  TO authenticated
  USING (event_id IN (SELECT l.event_id FROM public.current_moderator_area_levels('guest_list') l WHERE l.level IS NOT NULL));

-- ── A CHAPTER JOINS THE INVITATION: keep every earlier reply as rows (ruled 1 Nov, plan §9 #7) ──────────────────────
-- Fires on the flip OFF → ON of a top-level block, from ANY writer (the Schedule's switch, a coordinator, a script).
-- For each guest who has replied (attending / declined, not removed): a row for every OTHER chapter already on the
-- invitation, carrying their answer — so the new chapter alone has no row and is asked as new. If no other chapter is
-- on the invitation, this is the first: their answer was to the whole invitation, and it stands for this chapter too.
-- ON CONFLICT DO NOTHING: an answer already given chapter by chapter is never overwritten.
CREATE OR REPLACE FUNCTION public.keep_replies_when_a_chapter_joins_the_invitation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_first BOOLEAN;
BEGIN
  IF NEW.parent_block_id IS NOT NULL OR NOT NEW.on_invitation
     OR (TG_OP = 'UPDATE' AND OLD.on_invitation) THEN
    RETURN NEW;
  END IF;
  v_first := NOT EXISTS (
    SELECT 1 FROM public.event_schedule_blocks c
     WHERE c.event_id = NEW.event_id AND c.parent_block_id IS NULL AND c.on_invitation AND c.block_id <> NEW.block_id
  );
  INSERT INTO public.guest_chapter_replies (guest_id, block_id, event_id, attending, replied_at)
  SELECT g.guest_id, c.block_id, NEW.event_id, g.rsvp_status = 'attending', COALESCE(g.rsvp_responded_at, NOW())
    FROM public.guests g
    JOIN public.event_schedule_blocks c
      ON c.event_id = NEW.event_id AND c.parent_block_id IS NULL
     AND ((c.on_invitation AND c.block_id <> NEW.block_id) OR (v_first AND c.block_id = NEW.block_id))
   WHERE g.event_id = NEW.event_id
     AND g.deleted_at IS NULL
     AND g.rsvp_status IN ('attending', 'declined')
  ON CONFLICT (guest_id, block_id) DO NOTHING;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.keep_replies_when_a_chapter_joins_the_invitation() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS keep_replies_when_a_chapter_joins_the_invitation ON public.event_schedule_blocks;
CREATE TRIGGER keep_replies_when_a_chapter_joins_the_invitation
  AFTER INSERT OR UPDATE OF on_invitation ON public.event_schedule_blocks
  FOR EACH ROW EXECUTE FUNCTION public.keep_replies_when_a_chapter_joins_the_invitation();

-- ── BACKFILL: chapters already on an invitation before this file ─────────────────────────────────────────────────
-- Their guests replied to that invitation as a whole: the answer stands for every chapter on it today.
INSERT INTO public.guest_chapter_replies (guest_id, block_id, event_id, attending, replied_at)
SELECT g.guest_id, c.block_id, c.event_id, g.rsvp_status = 'attending', COALESCE(g.rsvp_responded_at, NOW())
  FROM public.event_schedule_blocks c
  JOIN public.guests g ON g.event_id = c.event_id
 WHERE c.parent_block_id IS NULL AND c.on_invitation
   AND g.deleted_at IS NULL
   AND g.rsvp_status IN ('attending', 'declined')
ON CONFLICT (guest_id, block_id) DO NOTHING;

-- The fence must really be there: RLS on, anon without a grant, no policy for anon, no browser write.
DO $$
BEGIN
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.guest_chapter_replies'::regclass) THEN
    RAISE EXCEPTION 'guest_chapter_replies must have RLS on';
  END IF;
  IF has_table_privilege('anon', 'public.guest_chapter_replies', 'SELECT') THEN
    RAISE EXCEPTION 'anon must not read guest_chapter_replies';
  END IF;
  IF has_table_privilege('authenticated', 'public.guest_chapter_replies', 'INSERT') THEN
    RAISE EXCEPTION 'no browser role writes a guest''s reply';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'guest_chapter_replies'
             AND 'anon' = ANY (roles)) THEN
    RAISE EXCEPTION 'no policy on guest_chapter_replies may name anon';
  END IF;
END;
$$;

COMMIT;
