-- a_ping_reaches_only_the_people_in_the_chat
-- Created via `pnpm migration:new`. Idempotent: CREATE OR REPLACE / CREATE INDEX IF NOT EXISTS / DROP … IF EXISTS.
--
-- ⚡🔒 THE CHAT PING FOLLOWS WHO IS IN THE CHAT, AND A PRIVATE LINE PINGS ITS ONE READER (Supplier Build 3 · integration).
--
-- Migration 20271328682743 (#7035, "chat arrives instantly") pings, on every chat_messages INSERT, the people whose
-- `count_unread_message_threads()` the line can move. It defined them as every COUPLE member of the event + the shop.
-- Build 3 then changed that count, in two migrations that replay before this one:
--   • 20271329968207 — a private line (recipient_user_id) counts for its recipient only;
--   • 20271330575424 — a host is in a supplier chat only through a live chat_thread_members row (left_at IS NULL),
--     and the event's coordinators are in every thread of their event (current_thread_ids()).
-- So the ping set and the count disagreed: a host who was never added, or who LEFT, was still pinged on every line,
-- and a host ↔ host private line pinged the supplier and every other host. The ping carries no content (thread_id ·
-- message_id · at), but "a private message never reaches a third person" (DECISION_LOG 🔒 2026-11-09) includes the
-- signal that one was written.
--
-- This replaces the recipient list with the count read backwards again:
--   • a private line → its recipient only (never the sender);
--   • a shared line  → the thread's live host members + the event's coordinators + the shop owner + the shop's
--     owner/admin team members — minus the sender.
-- The trigger keeps every guarantee it had: the content-free payload, the OFF switch, O(recipients), and a ping that
-- can never cost a message.
-- 🔒 apps/web/tests/db/chat-pings-reach-only-their-people.db.test.ts

-- The coordinator lookup is keyed like the couple one: a PARTIAL index on (event_id), so an event's guest rows are
-- never walked. chat_thread_members is keyed (thread_id, user_id) by its primary key.
CREATE INDEX IF NOT EXISTS event_members_coordinator_by_event_idx
  ON public.event_members (event_id)
  WHERE member_type = 'coordinator';

CREATE OR REPLACE FUNCTION public.chat_message_recipient_ids(
  p_thread_id UUID,
  p_event_id UUID,
  p_vendor_profile_id UUID,
  p_sender UUID,
  p_recipient UUID
)
RETURNS SETOF UUID
LANGUAGE sql
STABLE
SECURITY DEFINER          -- reads membership rows the caller may not see; never exposed to a client (REVOKE below)
SET search_path = public, pg_temp
AS $$
  -- A private line: its one reader.
  SELECT p_recipient
   WHERE p_recipient IS NOT NULL
     AND p_recipient IS DISTINCT FROM p_sender
  UNION
  -- A shared line: everyone whose unread count it moves.
  SELECT r.user_id FROM (
    SELECT ctm.user_id
      FROM public.chat_thread_members ctm
     WHERE ctm.thread_id = p_thread_id
       AND ctm.left_at IS NULL
    UNION
    SELECT em.user_id
      FROM public.event_members em
     WHERE em.event_id = p_event_id
       AND em.member_type = 'coordinator'
    UNION
    SELECT vp.user_id
      FROM public.vendor_profiles vp
     WHERE vp.vendor_profile_id = p_vendor_profile_id
       AND vp.user_id IS NOT NULL
    UNION
    SELECT vtm.user_id
      FROM public.vendor_team_members vtm
     WHERE vtm.vendor_profile_id = p_vendor_profile_id
       AND vtm.role IN ('owner', 'admin')
  ) r
  WHERE p_recipient IS NULL
    AND r.user_id IS NOT NULL
    AND r.user_id IS DISTINCT FROM p_sender;
$$;
COMMENT ON FUNCTION public.chat_message_recipient_ids(UUID, UUID, UUID, UUID, UUID) IS
  'Who a chat message pings — count_unread_message_threads() read backwards: a private line (p_recipient) pings its recipient only; a shared line pings the thread''s live chat_thread_members, the event''s coordinators, the shop owner and the shop''s owner/admin team members, minus the sender. Internal: no client role holds EXECUTE. Migration 20271334537840.';
REVOKE ALL ON FUNCTION public.chat_message_recipient_ids(UUID, UUID, UUID, UUID, UUID) FROM PUBLIC;
DO $revoke$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    EXECUTE 'REVOKE ALL ON FUNCTION public.chat_message_recipient_ids(UUID, UUID, UUID, UUID, UUID) FROM anon';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    EXECUTE 'REVOKE ALL ON FUNCTION public.chat_message_recipient_ids(UUID, UUID, UUID, UUID, UUID) FROM authenticated';
  END IF;
END $revoke$;

CREATE OR REPLACE FUNCTION public.chat_messages_ping_recipients()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER          -- reads membership through chat_message_recipient_ids, sends through user_live_send
SET search_path = public, pg_temp
AS $$
BEGIN
  -- OFF (flag unset in production, or never stamped): one primary-key read, and nothing else.
  IF NOT public.user_live_pings_on() THEN
    RETURN NULL;
  END IF;
  PERFORM public.user_live_send(
    ARRAY(SELECT public.chat_message_recipient_ids(
      NEW.thread_id, NEW.event_id, NEW.vendor_profile_id, NEW.sender_user_id, NEW.recipient_user_id)),
    'chat_message',
    jsonb_build_object('thread_id', NEW.thread_id, 'message_id', NEW.message_id, 'at', NEW.created_at)
  );
  RETURN NULL;
EXCEPTION WHEN OTHERS THEN
  -- 🔒 A ping must never cost a message. Whatever went wrong, the INSERT stands; readers fall back to the poll.
  RETURN NULL;
END $$;
COMMENT ON FUNCTION public.chat_messages_ping_recipients() IS
  'AFTER INSERT on chat_messages: when user_live_pings_on(), one content-free ping (thread_id, message_id, at; event chat_message) to each recipient''s private topic user:<uid> — the people in the chat, or a private line''s one reader (chat_message_recipient_ids). O(recipients). Swallows every error so a Realtime problem can never block a send. Migrations 20271328682743 · 20271334537840.';
REVOKE ALL ON FUNCTION public.chat_messages_ping_recipients() FROM PUBLIC;
DO $revoke$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    EXECUTE 'REVOKE ALL ON FUNCTION public.chat_messages_ping_recipients() FROM anon';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    EXECUTE 'REVOKE ALL ON FUNCTION public.chat_messages_ping_recipients() FROM authenticated';
  END IF;
END $revoke$;

-- One recipient definition: the event-wide one is gone (nothing else calls it).
DROP FUNCTION IF EXISTS public.chat_message_recipient_ids(UUID, UUID, UUID);
