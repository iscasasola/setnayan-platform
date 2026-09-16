-- A GUEST'S OWN REMOVAL IS FINAL — the couple cannot put it back.
--
-- ⚖ OWNER RULING 2026-09-14, confirmed 2026-09-16: asked whether the couple may
-- restore a photo a guest took off the wall herself, he answered "correct" —
-- they may not. Her withdrawal is the stronger signal; it is the difference
-- between a takedown and a suggestion.
--
-- ── WHAT WAS TRUE BEFORE THIS MIGRATION ────────────────────────────────────
-- `wall_unhide` authorised couple OR coordinator OR admin and then cleared BOTH
-- `wall_hidden_at` AND `wall_hidden_by_guest_id`. So a guest removed her own
-- photograph, the couple pressed un-hide, and:
--   • the photograph went back on the wall in front of the room, and
--   • the column recording THAT SHE WAS THE ONE WHO REMOVED IT was erased,
--     so nothing afterwards could tell her removal from a moderator's.
-- The second half is the worse half: it destroyed the evidence of the first.
--
-- ── WHAT CHANGES ───────────────────────────────────────────────────────────
-- `wall_unhide` now REFUSES when `wall_hidden_by_guest_id` is set. The couple
-- and coordinator keep every power they had over their own moderation — they
-- can still un-hide anything a moderator hid. They simply cannot reverse a
-- guest.
--
-- 🔑 THE GUEST'S OWN PATH IS UNTOUCHED, and that is the point: she may put it
-- back herself (`putMyPhotoBackOnTheWall`). "Final" means final against OTHERS,
-- never against her — a rule that locked her out of her own photograph would be
-- the same disrespect facing the other way.
--
-- ⚠ NOT A PERMISSION CHANGE. is_admin() is deliberately still allowed through
-- for the NPC/abuse path: a photograph hidden by a guest and then subject to a
-- lawful order needs a route that does not run through the couple. Narrowing
-- that is a separate, ruled decision and is not smuggled in here.

CREATE OR REPLACE FUNCTION public.wall_unhide(p_source_table text, p_source_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_event UUID;
  v_by_guest UUID;
BEGIN
  IF p_source_table = 'papic_photos' THEN
    SELECT event_id, wall_hidden_by_guest_id INTO v_event, v_by_guest
      FROM public.papic_photos WHERE photo_id = p_source_id;
  ELSIF p_source_table = 'papic_guest_captures' THEN
    SELECT event_id, wall_hidden_by_guest_id INTO v_event, v_by_guest
      FROM public.papic_guest_captures WHERE capture_id = p_source_id;
  ELSE
    RETURN FALSE;
  END IF;
  IF v_event IS NULL THEN RETURN FALSE; END IF;

  IF NOT (public.is_admin() OR EXISTS (
    SELECT 1 FROM public.event_members em
    WHERE em.event_id = v_event AND em.user_id = auth.uid()
      AND em.member_type IN ('couple', 'coordinator')
  )) THEN
    RAISE EXCEPTION 'not authorized to moderate this wall';
  END IF;

  -- ⚖ THE GUEST'S OWN REMOVAL IS FINAL. Checked AFTER authorisation so the
  -- message a couple sees is about the photograph, not about their access —
  -- they are allowed to moderate this wall; this one photograph is not theirs
  -- to restore. An admin may still act (NPC / abuse), per the note above.
  IF v_by_guest IS NOT NULL AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'this photograph was taken down by the guest in it, and only she can put it back';
  END IF;

  -- Wall-only un-hide (the durable gallery hidden_at is NOT touched here —
  -- restoring a gallery-hidden photo is a gallery decision, not a wall one).
  IF p_source_table = 'papic_photos' THEN
    UPDATE public.papic_photos
      SET wall_hidden_at = NULL, wall_hidden_by_guest_id = NULL
      WHERE photo_id = p_source_id;
  ELSE
    UPDATE public.papic_guest_captures
      SET wall_hidden_at = NULL, wall_hidden_by_guest_id = NULL
      WHERE capture_id = p_source_id;
  END IF;
  UPDATE public.wall_feed SET wall_hidden_at = NULL
    WHERE source_table = p_source_table AND source_id = p_source_id;
  RETURN TRUE;
END;
$function$;

COMMENT ON FUNCTION public.wall_unhide(text, uuid) IS
  'Un-hides a wall photograph for the couple/coordinator. REFUSES when wall_hidden_by_guest_id is set: a guest''s own removal is final against everyone but herself (owner ruling 2026-09-14/16). is_admin() still passes, deliberately, for the NPC/abuse path.';
