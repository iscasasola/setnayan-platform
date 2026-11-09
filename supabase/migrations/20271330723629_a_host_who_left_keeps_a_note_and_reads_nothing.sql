-- a_host_who_left_keeps_a_note_and_reads_nothing
-- Created via `pnpm migration:new`. KEEP THIS MIGRATION IDEMPOTENT.
-- ════════════════════════════════════════════════════════════════════════════
-- SUPPLIER BUILD 3 · LANE B — owner ruling 2026-11-09 (corpus 22ec04ab),
-- refining 20271330575424:
--   ⚖ Leaving a chat keeps a NOTE, and the chat stays in the Chats list,
--     greyed out.
--   ⚖ While left_at is set the host reads NO messages in that thread — not
--     the old ones either. (20271330575424 let a departed host keep what was
--     said up to left_at; that branch is REMOVED here.)
--   ⚖ They still read their OWN member row (thread, left_at) so the list can
--     draw the thread greyed. left_note is read only by that member (and an
--     admin through the service role) — never by another member.
--   ⚖ A host may rejoin themselves — the same as being added: the full
--     history again, minus private messages not addressed to them. Rejoining
--     clears left_at and the note and posts "[name] joined".
--   ⚖ The supplier and the coordinator cannot leave (unchanged).
--
-- ── THE POLICY DIFF (chat_messages_member_read, SELECT) ─────────────────────
--     thread_id IN (SELECT current_thread_ids())                          (same)
--   − OR EXISTS (<a departed member row of this thread, created_at <= left_at>)
--     OR vendor_profile_id IN (SELECT current_vendor_profile_ids())       (same)
--     OR (vendor_profile_id IN (SELECT current_vendor_ids('viewer'))
--         AND event_id IN (SELECT agent_customer_event_ids()))            (same)
-- current_thread_ids() already excludes left_at IS NOT NULL (unchanged).
--
-- ── HOW THE NOTE STAYS PRIVATE ──────────────────────────────────────────────
-- RLS is per ROW, and chat_thread_members_read must show a member the other
-- members' rows (who is in this chat). So the note is closed per COLUMN: the
-- table-level SELECT grant to `authenticated` becomes a column list WITHOUT
-- left_note (the column-grant pattern chat_messages already uses), and the
-- member reads their own note through chat_thread_my_left_note().
-- ════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── 1 · the note ────────────────────────────────────────────────────────────
ALTER TABLE public.chat_thread_members
  ADD COLUMN IF NOT EXISTS left_note TEXT;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                  WHERE conname = 'chat_thread_members_left_note_is_short'
                    AND conrelid = 'public.chat_thread_members'::regclass) THEN
    ALTER TABLE public.chat_thread_members
      ADD CONSTRAINT chat_thread_members_left_note_is_short
      CHECK (left_note IS NULL OR char_length(left_note) <= 200);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                  WHERE conname = 'chat_thread_members_note_only_when_left'
                    AND conrelid = 'public.chat_thread_members'::regclass) THEN
    ALTER TABLE public.chat_thread_members
      ADD CONSTRAINT chat_thread_members_note_only_when_left
      CHECK (left_note IS NULL OR left_at IS NOT NULL);
  END IF;
END $$;

COMMENT ON COLUMN public.chat_thread_members.left_note IS
  'Why this host left (≤ 200 chars), written by chat_thread_leave(). Readable ONLY by that member (chat_thread_my_left_note()) and by the service role — authenticated has no SELECT on this column, so another member cannot read it. Cleared on rejoin. Migration 20271330723629.';

-- ── 2 · the note is closed per column ───────────────────────────────────────
REVOKE SELECT ON public.chat_thread_members FROM authenticated;
GRANT SELECT (thread_id, user_id, added_by_user_id, joined_at, left_at)
  ON public.chat_thread_members TO authenticated;

CREATE OR REPLACE FUNCTION public.chat_thread_my_left_note(p_thread_id UUID)
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT m.left_note
    FROM public.chat_thread_members m
   WHERE m.thread_id = p_thread_id
     AND m.user_id = auth.uid();
$$;
REVOKE ALL ON FUNCTION public.chat_thread_my_left_note(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.chat_thread_my_left_note(UUID) TO authenticated;

COMMENT ON FUNCTION public.chat_thread_my_left_note(UUID) IS
  'The caller''s OWN note from leaving this chat (NULL when none / still in it). Never another member''s. Migration 20271330723629.';

-- ── 3 · a host who left reads nothing in the thread ─────────────────────────
DROP POLICY IF EXISTS chat_messages_member_read ON public.chat_messages;
CREATE POLICY chat_messages_member_read
  ON public.chat_messages FOR SELECT
  TO authenticated
  USING (
    thread_id IN (SELECT public.current_thread_ids())
    OR vendor_profile_id IN (SELECT public.current_vendor_profile_ids())
    OR (
      vendor_profile_id IN (SELECT public.current_vendor_ids('viewer'))
      AND event_id IN (SELECT public.agent_customer_event_ids())
    )
  );

-- ── 4 · leave keeps a note ──────────────────────────────────────────────────
-- Returns: left · cannot_leave · last_host · not_a_member · not_found ·
-- unauthenticated (as before). A blank note is stored as NULL; a long one is
-- cut to 200 characters rather than refusing the leave.
DROP FUNCTION IF EXISTS public.chat_thread_leave(UUID);
CREATE OR REPLACE FUNCTION public.chat_thread_leave(p_thread_id UUID, p_note TEXT DEFAULT NULL)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid   UUID := auth.uid();
  v_event UUID;
  v_shop  UUID;
BEGIN
  IF v_uid IS NULL THEN
    RETURN 'unauthenticated';
  END IF;
  SELECT t.event_id, t.vendor_profile_id INTO v_event, v_shop
    FROM public.chat_threads t WHERE t.thread_id = p_thread_id;
  IF v_event IS NULL THEN
    RETURN 'not_found';
  END IF;

  PERFORM 1 FROM public.chat_thread_members m
   WHERE m.thread_id = p_thread_id AND m.user_id = v_uid AND m.left_at IS NULL
   FOR UPDATE;
  IF NOT FOUND THEN
    -- A coordinator or the supplier is in the thread without a row: they
    -- cannot leave. Anyone else was never in it (or already left).
    IF p_thread_id IN (SELECT public.current_thread_ids())
       OR v_shop IN (SELECT public.current_vendor_profile_ids())
       OR v_shop IN (SELECT public.current_vendor_ids('viewer')) THEN
      RETURN 'cannot_leave';
    END IF;
    RETURN 'not_a_member';
  END IF;

  IF NOT EXISTS (
       SELECT 1 FROM public.chat_thread_members m
        WHERE m.thread_id = p_thread_id AND m.left_at IS NULL AND m.user_id <> v_uid) THEN
    RETURN 'last_host';
  END IF;

  PERFORM public.chat_record_post_line(v_event, v_shop,
    public.chat_member_first_name(v_uid) || ' left this chat',
    'A host left this chat');
  UPDATE public.chat_thread_members
     SET left_at   = clock_timestamp(),
         left_note = NULLIF(left(btrim(COALESCE(p_note, '')), 200), '')
   WHERE thread_id = p_thread_id AND user_id = v_uid;
  RETURN 'left';
END;
$$;
REVOKE ALL ON FUNCTION public.chat_thread_leave(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.chat_thread_leave(UUID, TEXT) TO authenticated;

COMMENT ON FUNCTION public.chat_thread_leave(UUID, TEXT) IS
  'A host leaves ONE supplier conversation, with an optional note (≤ 200 chars, readable only by them). Posts "<name> left this chat". While left they read no message of the thread; their own member row stays readable so the list shows it greyed. Coordinators and the supplier cannot leave; the last host stays. Migration 20271330723629.';

-- ── 5 · add a host · or rejoin yourself ─────────────────────────────────────
-- Returns: added · rejoined · already · not_a_host · not_allowed · not_found ·
-- unauthenticated. A host who left may add THEMSELVES back (→ 'rejoined',
-- "<name> joined"); anyone else needs to be in the thread on the hosts' side.
CREATE OR REPLACE FUNCTION public.chat_thread_add_host(p_thread_id UUID, p_user_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid    UUID := auth.uid();
  v_event  UUID;
  v_shop   UUID;
  v_left   TIMESTAMPTZ;
  v_found  BOOLEAN;
  v_self   BOOLEAN;
BEGIN
  IF v_uid IS NULL THEN
    RETURN 'unauthenticated';
  END IF;
  SELECT t.event_id, t.vendor_profile_id INTO v_event, v_shop
    FROM public.chat_threads t WHERE t.thread_id = p_thread_id;
  IF v_event IS NULL THEN
    RETURN 'not_found';
  END IF;
  SELECT TRUE, m.left_at INTO v_found, v_left
    FROM public.chat_thread_members m
   WHERE m.thread_id = p_thread_id AND m.user_id = p_user_id
   FOR UPDATE;

  -- Rejoining yourself: only a host who was in this thread and left.
  v_self := (p_user_id = v_uid) AND COALESCE(v_found, FALSE) AND v_left IS NOT NULL;

  -- Anyone else: only someone IN the thread on the hosts' side (a live host
  -- or the event's coordinator). The supplier is never in current_thread_ids().
  IF NOT v_self AND p_thread_id NOT IN (SELECT public.current_thread_ids()) THEN
    RETURN 'not_allowed';
  END IF;
  IF p_user_id IS NULL OR NOT EXISTS (
       SELECT 1 FROM public.event_members em
         JOIN public.users u ON u.user_id = em.user_id
        WHERE em.event_id = v_event AND em.user_id = p_user_id AND em.member_type = 'couple') THEN
    RETURN 'not_a_host';
  END IF;
  IF v_found AND v_left IS NULL THEN
    RETURN 'already';
  END IF;

  IF v_found THEN
    UPDATE public.chat_thread_members
       SET left_at = NULL, left_note = NULL, joined_at = NOW(),
           added_by_user_id = CASE WHEN v_self THEN added_by_user_id ELSE v_uid END
     WHERE thread_id = p_thread_id AND user_id = p_user_id;
  ELSE
    INSERT INTO public.chat_thread_members (thread_id, user_id, added_by_user_id)
    VALUES (p_thread_id, p_user_id, v_uid);
  END IF;

  IF v_self THEN
    PERFORM public.chat_record_post_line(v_event, v_shop,
      public.chat_member_first_name(v_uid) || ' joined',
      'A host joined');
    RETURN 'rejoined';
  END IF;
  PERFORM public.chat_record_post_line(v_event, v_shop,
    public.chat_member_first_name(p_user_id) || ' was added to this chat by '
      || public.chat_member_first_name(v_uid),
    'A host was added to this chat');
  RETURN 'added';
END;
$$;
REVOKE ALL ON FUNCTION public.chat_thread_add_host(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.chat_thread_add_host(UUID, UUID) TO authenticated;

COMMENT ON FUNCTION public.chat_thread_add_host(UUID, UUID) IS
  'Add an event host to ONE supplier conversation (caller: a live host member or an event coordinator; never the supplier), or rejoin it yourself after leaving (→ rejoined, "<name> joined"). Either way the person reads the whole history again, minus private messages not addressed to them; the leave note is cleared. Migrations 20271330575424 + 20271330723629.';

COMMIT;
