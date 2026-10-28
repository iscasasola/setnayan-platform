-- 20271296339552_chat_messages_ping_their_people.sql
--
-- ⚡ CHAT ARRIVES INSTANTLY (owner 2026-10-29, "how long does it take for us to receive a chat from someone? is
-- this optimized already?" → "yes" to the proposal).
--
-- ── WHAT WAS TRUE BEFORE ────────────────────────────────────────────────────
-- An OPEN thread was already live (`postgres_changes` on chat_messages filtered by thread_id, in
-- `app/_components/chat-message-stream.tsx`). Everywhere ELSE — the Messages envelope on every signed-in page and the
-- inbox rows — a new message waited for a 60 s count poll (`lib/tab-return.ts` COUNT_POLL_MS), so a reply could take
-- up to a minute to show.
--
-- ── WHAT THIS ADDS (the database half; the client half is `lib/user-live-channel.ts`) ─
-- One small PING per recipient when a chat message is written, sent with `realtime.send` to that person's own PRIVATE
-- topic `user:<uid>`. The browser holds ONE channel per signed-in person (only while a tab is in view), and on a ping
-- it re-asks the same honest count it always asked — so the badge moves within a second instead of a minute.
--
-- 🔑 WHY BROADCAST-FROM-DATABASE AND NOT MORE `postgres_changes`. On this project Realtime's postgres_changes WAL
-- polling once cost more than 10× all other database time (18 Oct load audit, max_connections 60). postgres_changes
-- re-checks RLS for EVERY subscriber on EVERY change; a broadcast is authorised ONCE, when the channel joins, and a
-- message is a plain row in `realtime.messages`. This adds ZERO postgres_changes subscriptions.
--
-- ── THE PING CARRIES NO CONTENT ─────────────────────────────────────────────
-- Only `thread_id` + `message_id` + `at`. Not the body, not the sender's name. The client re-reads through the SAME
-- RLS-guarded reads it already used (`count_unread_message_threads`, the inbox render), so a ping cannot show anyone
-- anything their own read would not. A forged or replayed ping costs one honest re-read and nothing else — and it
-- cannot be forged from a browser: there is NO INSERT policy for `user:` topics (only this trigger sends into them).
--
-- ── WHO IS PINGED — exactly the people whose unread count can change ────────
-- `count_unread_message_threads()` counts a thread for a person when its event is one of their COUPLE events
-- (`current_couple_event_ids`: event_members.member_type = 'couple') or its shop is one of their shops
-- (`current_vendor_profile_ids`: vendor_profiles.user_id, plus vendor_team_members at rank ≥ admin), and counts only
-- messages they did not send themselves. `chat_message_recipient_ids` is that definition read backwards from the
-- message, minus the sender. Nobody else is pinged (a guest, an agent, an unrelated user).
--
-- ── COST — O(recipients), never a scan ──────────────────────────────────────
-- Three index lookups keyed on the message's own columns (chat_messages carries event_id and vendor_profile_id, so
-- not even chat_threads is read): the partial index below (couple members of ONE event — never the event's guests),
-- the vendor_profiles primary key, and vendor_team_members_vendor_profile_id_idx. Then one `realtime.send` row per
-- recipient (typically 2–4). Held by `apps/web/tests/db/chat-pings-reach-only-their-people.db.test.ts`.
--
-- ── IT CAN NEVER BREAK A SEND ───────────────────────────────────────────────
-- AFTER INSERT, and the whole body is inside an EXCEPTION block that swallows everything: a missing realtime schema
-- (the PGlite replay, a local shell), a missing day partition in realtime.messages, a Realtime outage — the message is
-- written exactly as before, and the reader falls back to the 60 s poll it has today.
--
-- ── THE KILL SWITCH ─────────────────────────────────────────────────────────
-- The client side is `NEXT_PUBLIC_CHAT_LIVE_ENABLED` (lib/chat-live-flag.ts, OFF unless set): with it off no browser
-- joins a `user:` topic and every badge polls exactly as on main. The pings this trigger writes then reach nobody —
-- a few rows per message, dropped with realtime.messages' own daily partitions (3 days).
--
-- ── NOT IN THIS MIGRATION ───────────────────────────────────────────────────
-- The open thread keeps its own postgres_changes subscription, unchanged (another builder is moving the supplier
-- thread page onto the shared ChatBox; moving the thread onto these pings is a measured follow-up, not a rider here).
--
-- IDEMPOTENT.

-- ── 1 · the index that keeps the couple lookup O(couple members) ─────────────
-- event_members_event_id_idx alone would walk every member of the event, guests included — hundreds on a big day.
CREATE INDEX IF NOT EXISTS event_members_couple_by_event_idx
  ON public.event_members (event_id)
  WHERE member_type = 'couple';

-- ── 2 · who a message pings ──────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.chat_message_recipient_ids(
  p_event_id UUID,
  p_vendor_profile_id UUID,
  p_sender UUID
)
RETURNS SETOF UUID
LANGUAGE sql
STABLE
SECURITY DEFINER          -- reads membership rows the caller may not see; never exposed to a client (REVOKE below)
SET search_path = public, pg_temp
AS $$
  SELECT r.user_id FROM (
    SELECT em.user_id
      FROM public.event_members em
     WHERE em.event_id = p_event_id
       AND em.member_type = 'couple'
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
  WHERE r.user_id IS DISTINCT FROM p_sender;
$$;

COMMENT ON FUNCTION public.chat_message_recipient_ids(UUID, UUID, UUID) IS
  'Who a chat message pings: the people whose count_unread_message_threads() it can change (couple members of the event, the shop owner, shop owner/admin team members), minus the sender. Read backwards from the same definition the count uses. Called only by chat_messages_ping_recipients(); not executable by any client role.';

-- Only the trigger (a definer, running as the owner) calls it. No client role may enumerate a thread's people.
REVOKE ALL ON FUNCTION public.chat_message_recipient_ids(UUID, UUID, UUID) FROM PUBLIC;
DO $revoke$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    EXECUTE 'REVOKE ALL ON FUNCTION public.chat_message_recipient_ids(UUID, UUID, UUID) FROM anon';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    EXECUTE 'REVOKE ALL ON FUNCTION public.chat_message_recipient_ids(UUID, UUID, UUID) FROM authenticated';
  END IF;
END $revoke$;

-- ── 3 · the trigger: one content-free ping per recipient ─────────────────────
CREATE OR REPLACE FUNCTION public.chat_messages_ping_recipients()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER          -- realtime.send writes realtime.messages; the sender has (and must have) no INSERT policy on user: topics
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid     UUID;
  v_payload JSONB;
BEGIN
  -- No Realtime here (the PGlite replay, a local shell, an older Realtime): nothing to ping, nothing to fail.
  IF to_regprocedure('realtime.send(jsonb,text,text,boolean)') IS NULL THEN
    RETURN NULL;
  END IF;

  v_payload := jsonb_build_object(
    'thread_id',  NEW.thread_id,
    'message_id', NEW.message_id,
    'at',         NEW.created_at
  );

  FOR v_uid IN
    SELECT public.chat_message_recipient_ids(NEW.event_id, NEW.vendor_profile_id, NEW.sender_user_id)
  LOOP
    PERFORM realtime.send(v_payload, 'chat_message', 'user:' || v_uid::text, true);
  END LOOP;

  RETURN NULL;
EXCEPTION WHEN OTHERS THEN
  -- 🔒 A ping must never cost a message. Whatever went wrong, the INSERT stands; readers fall back to the poll.
  RETURN NULL;
END $$;

COMMENT ON FUNCTION public.chat_messages_ping_recipients() IS
  'AFTER INSERT on chat_messages: one content-free realtime.send ping (thread_id, message_id, at) to each recipient''s private topic user:<uid>. O(recipients). Swallows every error so a Realtime problem can never block a send. See migration 20271296339552.';

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

DROP TRIGGER IF EXISTS chat_messages_ping_recipients ON public.chat_messages;
CREATE TRIGGER chat_messages_ping_recipients
  AFTER INSERT ON public.chat_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.chat_messages_ping_recipients();

-- ── 4 · who may LISTEN to a user: topic — its owner, and nobody else ─────────
CREATE OR REPLACE FUNCTION public.user_topic_is_mine(p_topic TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY INVOKER          -- needs nothing but the caller's own uid
SET search_path = public, pg_temp
AS $$
  SELECT auth.uid() IS NOT NULL
     AND p_topic IS NOT NULL
     AND p_topic = 'user:' || auth.uid()::text;
$$;

COMMENT ON FUNCTION public.user_topic_is_mine(TEXT) IS
  'Authorises a private Realtime channel user:<uid> for that uid only. Anon, NULL, another person''s uid, a lookalike prefix: FALSE, never an error (a raise inside a realtime.messages policy refuses EVERY private channel — see 20271187719883).';

-- Same house rule as call_rtc_can_access: REVOKE from PUBLIC, GRANT to authenticated — and the grant is LOAD-BEARING:
-- realtime.messages' permissive policies are OR-evaluated, so an un-executable predicate here would refuse every
-- private channel on the project (calls, Panood), not just this one. `realtime-policy-predicates-are-callable.db.test.ts`
-- discovers this predicate from the policy below and holds the grant.
REVOKE ALL ON FUNCTION public.user_topic_is_mine(TEXT) FROM PUBLIC;
DO $grant$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    EXECUTE 'REVOKE ALL ON FUNCTION public.user_topic_is_mine(TEXT) FROM anon';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.user_topic_is_mine(TEXT) TO authenticated';
  END IF;
END $grant$;

DO $guard$
BEGIN
  IF to_regclass('realtime.messages') IS NULL THEN
    RAISE NOTICE 'realtime.messages absent (migration replay / local shell) — skipping the user-topic policy';
    RETURN;
  END IF;

  -- READ only. There is deliberately NO insert policy: a browser cannot send into anyone's user: topic, its own
  -- included — the only writer is chat_messages_ping_recipients() above.
  EXECUTE $ddl$
    DROP POLICY IF EXISTS user_topic_owner_can_read ON realtime.messages;
    CREATE POLICY user_topic_owner_can_read
      ON realtime.messages
      FOR SELECT
      TO authenticated
      USING (
        realtime.topic() LIKE 'user:%'
        AND public.user_topic_is_mine(realtime.topic())
      );
  $ddl$;
END $guard$;
