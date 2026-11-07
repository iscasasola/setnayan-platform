-- 20271323859288_chat_messages_ping_their_people.sql
--
-- ⚡ CHAT ARRIVES INSTANTLY (owner 2026-10-29, "how long does it take for us to receive a chat from someone? is
-- this optimized already?" → "yes" to the proposal; owner 2026-11-08 "Finish this first now").
--
-- ── WHAT WAS TRUE BEFORE ────────────────────────────────────────────────────
-- An OPEN thread was already live (`postgres_changes` on chat_messages filtered by thread_id, in
-- `app/_components/chat-message-stream.tsx`). Everywhere ELSE — the Messages envelope on every signed-in page — a new
-- message waited for a 60 s count poll (`lib/tab-return.ts` COUNT_POLL_MS), so a reply could take up to a minute.
--
-- ── WHAT THIS ADDS (the database half; the client half is `apps/web/lib/user-live-channel.ts`) ─
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
-- RLS-guarded read it already used (`count_unread_message_threads`), so a ping cannot show anyone anything their own
-- read would not. And it cannot be forged from a browser: there is NO INSERT policy for `user:` topics.
--
-- ── WHO IS PINGED — exactly the people whose unread count can change ────────
-- `count_unread_message_threads()` counts a thread for a person when its event is one of their COUPLE events
-- (`current_couple_event_ids`: event_members.member_type = 'couple') or its shop is one of their shops
-- (`current_vendor_profile_ids`: vendor_profiles.user_id, plus vendor_team_members at rank ≥ admin), and counts only
-- messages they did not send themselves. `chat_message_recipient_ids` is that definition read backwards from the
-- message, minus the sender. Nobody else is pinged (a guest, an agent, a viewer, an unrelated user).
--
-- ── COST — O(recipients), never a scan ──────────────────────────────────────
-- OFF (the default): one primary-key read of the one-row platform_settings, then RETURN. Nothing else runs.
-- ON: three index lookups keyed on the message's own columns (chat_messages carries event_id and vendor_profile_id, so
-- not even chat_threads is read): the partial index below (couple members of ONE event — never its guests), the
-- vendor_profiles key, and vendor_team_members_vendor_profile_id_idx. Then one `realtime.send` row per recipient
-- (typically 2–4). Held by `apps/web/tests/db/chat-pings-reach-only-their-people.db.test.ts`.
--
-- ── IT CAN NEVER BREAK A SEND ───────────────────────────────────────────────
-- AFTER INSERT, and the whole body is inside an EXCEPTION block that swallows everything: a missing realtime schema
-- (the PGlite replay, a local shell), a missing day partition in realtime.messages, a Realtime outage — the message is
-- written exactly as before, and the reader falls back to the 60 s poll it has today.
--
-- ── THE KILL SWITCH IS ONE SWITCH, AT BOTH ENDS ─────────────────────────────
-- The switch is the env flag `NEXT_PUBLIC_CHAT_LIVE_ENABLED` (apps/web/lib/chat-live-flag.ts, OFF unless set). SQL
-- cannot read an env flag, so — exactly like `booking_fee_minting_live` (20271268087628) — the PRODUCTION app stamps
-- what it runs with into `platform_settings.chat_live_pings_live` (apps/web/lib/chat-live-stamp.ts, after a response,
-- never on anybody's wait). The trigger sends NOTHING unless that stamp is TRUE. So with the flag off: no browser joins a
-- `user:` topic AND the database writes no ping. NULL (never stamped) = off.
--
-- ── A SECOND EVENT ON THE SAME CHANNEL ──────────────────────────────────────
-- `user_live_send(recipients, event, payload)` is the one sender; `user_live_pings_on()` the one gate. A later
-- trigger (chat_message_hearts) calls the same two with its own event name; the policy below admits a person to their
-- `user:` topic whatever the event, and the client registers one listener per name in `USER_LIVE_EVENTS`.
--
-- ── NOT IN THIS MIGRATION ───────────────────────────────────────────────────
-- The open thread keeps its own postgres_changes subscription, unchanged. Moving it onto these pings is a measured
-- follow-up, not a rider here.
--
-- ORDER: every ALTER first (memory "alter-before-update-in-one-migration"); this file has no UPDATE/INSERT at all.
-- IDEMPOTENT.

-- ── 0 · the stamp the trigger reads (ALTER first) ────────────────────────────
ALTER TABLE public.platform_settings
  ADD COLUMN IF NOT EXISTS chat_live_pings_live BOOLEAN;

COMMENT ON COLUMN public.platform_settings.chat_live_pings_live IS
  'Stamped by the PRODUCTION app after a response: is NEXT_PUBLIC_CHAT_LIVE_ENABLED on? NULL = never stamped = off. The chat ping trigger (chat_messages_ping_recipients) sends nothing unless this is TRUE. Bookkeeping only — no admin field writes it.';

-- Re-stated after the ADD COLUMN, as every platform_settings migration since 20271014400000 does: anon holds nothing.
REVOKE ALL ON TABLE public.platform_settings FROM anon;
GRANT SELECT ON TABLE public.platform_settings TO authenticated;

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
  WHERE r.user_id IS NOT NULL
    AND r.user_id IS DISTINCT FROM p_sender;
$$;

COMMENT ON FUNCTION public.chat_message_recipient_ids(UUID, UUID, UUID) IS
  'Who a chat message pings: the people whose count_unread_message_threads() it can change (couple members of the event, the shop owner, shop owner/admin team members), minus the sender. Read backwards from the same definition the count uses. Internal: no client role holds EXECUTE.';

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

-- ── 3 · the one gate and the one sender (shared by every event on a user: topic) ─
CREATE OR REPLACE FUNCTION public.user_live_pings_on()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE((SELECT ps.chat_live_pings_live FROM public.platform_settings ps WHERE ps.id = 1), FALSE);
$$;

COMMENT ON FUNCTION public.user_live_pings_on() IS
  'TRUE only when the production app has stamped platform_settings.chat_live_pings_live = TRUE (NEXT_PUBLIC_CHAT_LIVE_ENABLED on). The gate every user: topic sender checks first. Internal: no client role holds EXECUTE.';

CREATE OR REPLACE FUNCTION public.user_live_send(p_recipients UUID[], p_event TEXT, p_payload JSONB)
RETURNS INTEGER
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER          -- realtime.send writes realtime.messages; no client may (there is no INSERT policy on user: topics)
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid  UUID;
  v_sent INTEGER := 0;
BEGIN
  IF p_recipients IS NULL OR cardinality(p_recipients) = 0 OR p_event IS NULL THEN
    RETURN 0;
  END IF;
  -- No Realtime here (the PGlite replay, a local shell, an older Realtime): nothing to ping, nothing to fail.
  IF to_regprocedure('realtime.send(jsonb,text,text,boolean)') IS NULL THEN
    RETURN 0;
  END IF;
  FOREACH v_uid IN ARRAY p_recipients LOOP
    CONTINUE WHEN v_uid IS NULL;
    PERFORM realtime.send(p_payload, p_event, 'user:' || v_uid::text, true);
    v_sent := v_sent + 1;
  END LOOP;
  RETURN v_sent;
EXCEPTION WHEN OTHERS THEN
  -- 🔒 Never raises: a ping is a nicety, the write that caused it is not.
  RETURN v_sent;
END $$;

COMMENT ON FUNCTION public.user_live_send(UUID[], TEXT, JSONB) IS
  'Sends one content-free broadcast per recipient to the PRIVATE topic user:<uid> with event p_event. Never raises. Callers check user_live_pings_on() first. Internal: no client role holds EXECUTE.';

REVOKE ALL ON FUNCTION public.user_live_pings_on() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.user_live_send(UUID[], TEXT, JSONB) FROM PUBLIC;
DO $revoke$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    EXECUTE 'REVOKE ALL ON FUNCTION public.user_live_pings_on() FROM anon';
    EXECUTE 'REVOKE ALL ON FUNCTION public.user_live_send(UUID[], TEXT, JSONB) FROM anon';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    EXECUTE 'REVOKE ALL ON FUNCTION public.user_live_pings_on() FROM authenticated';
    EXECUTE 'REVOKE ALL ON FUNCTION public.user_live_send(UUID[], TEXT, JSONB) FROM authenticated';
  END IF;
END $revoke$;

-- ── 4 · the trigger: one content-free ping per recipient ─────────────────────
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
    ARRAY(SELECT public.chat_message_recipient_ids(NEW.event_id, NEW.vendor_profile_id, NEW.sender_user_id)),
    'chat_message',
    jsonb_build_object('thread_id', NEW.thread_id, 'message_id', NEW.message_id, 'at', NEW.created_at)
  );
  RETURN NULL;
EXCEPTION WHEN OTHERS THEN
  -- 🔒 A ping must never cost a message. Whatever went wrong, the INSERT stands; readers fall back to the poll.
  RETURN NULL;
END $$;

COMMENT ON FUNCTION public.chat_messages_ping_recipients() IS
  'AFTER INSERT on chat_messages: when user_live_pings_on(), one content-free ping (thread_id, message_id, at; event chat_message) to each recipient''s private topic user:<uid>. O(recipients). Swallows every error so a Realtime problem can never block a send. See migration 20271323859288.';

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

-- ── 5 · who may LISTEN to a user: topic — its owner, and nobody else ─────────
CREATE OR REPLACE FUNCTION public.user_topic_is_mine(p_topic TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY INVOKER          -- needs nothing but the caller's own uid
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE(
    auth.uid() IS NOT NULL
      AND p_topic IS NOT NULL
      AND p_topic = 'user:' || auth.uid()::text,
    FALSE
  );
$$;

COMMENT ON FUNCTION public.user_topic_is_mine(TEXT) IS
  'Authorises a private Realtime channel user:<uid> for that uid only. Anon, NULL, another person''s uid, a lookalike prefix: FALSE, never an error (a raise inside a realtime.messages policy refuses EVERY private channel — see 20271187719883).';

-- Same house rule as call_rtc_can_access: REVOKE from PUBLIC, GRANT to authenticated — and the grant is LOAD-BEARING:
-- realtime.messages' permissive policies are OR-evaluated, so an un-executable predicate here would refuse every
-- private channel on the project (calls, Panood, Who's here), not just this one.
-- `realtime-policy-predicates-are-callable.db.test.ts` discovers this predicate from the policy below and holds the
-- grant. It returns only whether a topic string names the caller themself — nothing a caller does not already know.
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
  -- included — the only writer is user_live_send() above.
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
