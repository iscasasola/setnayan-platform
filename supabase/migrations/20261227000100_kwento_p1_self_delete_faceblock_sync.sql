-- 20261227000100_kwento_p1_self_delete_faceblock_sync.sql
-- Alaala Lane 3 · Kwento P1 completions. Two SECURITY DEFINER, service-role-only
-- RPCs (zero-account guests have no auth.uid(), so writes go through service
-- role — same trust model as submit_photo_message):
--
--  (1) guest_delete_own_message — a guest soft-deletes their OWN Kwento within
--      24h of submitting it, provided it hasn't already been baked into a
--      keepsake render. Pulls it from every public surface immediately.
--  (2) set_guest_messages_hidden_by_faceblock — when a guest enables FaceBlock
--      ("blur my face on the wall"), hide them as the PUBLIC author of every
--      Kwento they wrote (P2 parity with the wall's author_publicly_hidden gate).
--      The couple still sees them in their private moderation queue / magazine.

-- ─────────────────────────────────────────────────────────────────────────────
-- (1) Guest 24h self-delete.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.guest_delete_own_message(
  p_guest_id   uuid,
  p_message_id uuid
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v public.photo_messages%ROWTYPE;
BEGIN
  SELECT * INTO v FROM public.photo_messages WHERE message_id = p_message_id;
  IF NOT FOUND THEN RETURN false; END IF;

  -- Only the author may self-delete; only within 24h; never once it's gone or
  -- already locked into a produced keepsake (anti bait-and-switch).
  IF v.guest_id <> p_guest_id THEN RETURN false; END IF;
  IF v.user_deleted_at IS NOT NULL THEN RETURN false; END IF;
  IF v.baked_into_render THEN RETURN false; END IF;
  IF (now() - v.submitted_at) > interval '24 hours' THEN RETURN false; END IF;

  UPDATE public.photo_messages
     SET status          = 'user_deleted',
         user_deleted_at = now(),
         wall_eligible   = false,   -- leave the wall immediately
         hide_from_wall  = true,
         updated_at      = now()
   WHERE id = v.id;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.guest_delete_own_message(uuid, uuid)
  FROM public, anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- (2) FaceBlock → author_publicly_hidden sync.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.set_guest_messages_hidden_by_faceblock(
  p_guest_id uuid
) RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  UPDATE public.photo_messages
     SET author_publicly_hidden = true,
         updated_at = now()
   WHERE guest_id = p_guest_id
     AND author_publicly_hidden = false;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.set_guest_messages_hidden_by_faceblock(uuid)
  FROM public, anon, authenticated;
