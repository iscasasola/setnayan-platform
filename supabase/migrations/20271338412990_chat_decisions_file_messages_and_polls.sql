-- chat_decisions_file_messages_and_polls
-- Created via `pnpm migration:new`. Prefix auto-allocated to sort AFTER every
-- existing migration. KEEP THIS MIGRATION IDEMPOTENT (it may be re-applied):
--   • CREATE TABLE IF NOT EXISTS …   (+ ALTER TABLE … ENABLE ROW LEVEL SECURITY in the SAME migration)
--   • ALTER TABLE … ADD COLUMN IF NOT EXISTS …
--   • CREATE INDEX IF NOT EXISTS …
--   • CREATE OR REPLACE FUNCTION …
--   • DROP POLICY IF EXISTS … ; CREATE POLICY …   (policies have no IF NOT EXISTS)
--
-- ════════════════════════════════════════════════════════════════════════════
-- CHAT DECISIONS YOU CAN FILE MESSAGES UNDER · THE POLL CARD (owner 11 Nov 2026)
--
-- Rulings: DECISION_LOG 2026-11-11 🗳 "CHAT DECISIONS YOU CAN TAP · DOUBLE-TAP
-- FILES A MESSAGE · POLLS ARE THEIR OWN CARD · SLASH SHORTCUTS" and 🗳 "CHAT
-- POLLS — ONE PER CHAT · THE (+) REOPENS ONCE SENT · EITHER SIDE CLOSES".
-- Contract: plans/chat_decisions_polls_2026-11-11/BUILD-BRIEF.md + prototype v1.
--
--   1 · chat_decision_messages — a message filed under a decision topic. A
--       message sits under at most ONE OPEN topic at a time (enforced by the
--       writers under a row lock on the message; "Move to…" moves it). A message
--       may stay in a CLOSED topic's history and be filed again under an open
--       one. Private lines (recipient_user_id set) are never filed: a decision
--       is the whole chat's, a private line reaches two people.
--       Writers: chat_decision_file_message · chat_decision_move_message ·
--       chat_decision_remove_message. And the topic's own words:
--       chat_decision_rename (Edit topic — saves in place, one chat line).
--   2 · chat_polls / chat_poll_choices / chat_poll_votes — ONE OPEN POLL PER
--       THREAD (a partial unique index, not a convention), 2–6 choices, one
--       vote per person per poll that MOVES (an upsert) or is taken back.
--       Writers: chat_poll_open · chat_poll_vote · chat_poll_close ·
--       chat_poll_reopen · chat_poll_save_as_decision (through the shipped door
--       chat_decision_open, so the decision and its line are the same as any).
--       Either side closes; anyone in the chat reopens (owner 11 Nov "2. Either
--       side", mirroring decision topics 2026-11-09). A poll already saved as a
--       decision is settled — reopening it is refused ('saved').
--
-- RLS: the read predicate is chat_decision_topics_read copied branch for branch
-- (a host by live membership current_thread_ids(), the thread's shop, admin).
-- No write policy and no write grant on any table: the SECURITY DEFINER writers
-- below are the only door, and each asks chat_is_in_thread() itself.
-- The masked-coordinator rule (20271333705710): a poll question / choice that
-- names an amount is hosts-only exactly like a decision title (RESTRICTIVE).
-- The contact screen (20271221089848): a poll's question and choices pass
-- chat_contact_categories(…, 'chat') or the poll is refused — they are words
-- both sides read, so they may not carry a way out of the app.
-- Realtime: the four tables join supabase_realtime; the client listens on the
-- thread's EXISTING chat-${threadId} channel filtered by thread_id (each table
-- carries thread_id for that reason), as chat_message_hearts does.
-- ════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── 1 · messages filed under a decision ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.chat_decision_messages (
  topic_id          UUID        NOT NULL REFERENCES public.chat_decision_topics(topic_id) ON DELETE CASCADE,
  message_id        UUID        NOT NULL REFERENCES public.chat_messages(message_id) ON DELETE CASCADE,
  thread_id         UUID        NOT NULL REFERENCES public.chat_threads(thread_id) ON DELETE CASCADE,
  added_by_user_id  UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  added_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (topic_id, message_id)
);
ALTER TABLE public.chat_decision_messages ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS chat_decision_messages_message_idx
  ON public.chat_decision_messages (message_id);
CREATE INDEX IF NOT EXISTS chat_decision_messages_thread_idx
  ON public.chat_decision_messages (thread_id);
COMMENT ON TABLE public.chat_decision_messages IS
  'A chat message filed under a decision topic (owner 11 Nov 2026 — double-tap a message to add it to a decision). A message sits under at most one OPEN topic; never a private line. Written ONLY by chat_decision_file_message / chat_decision_move_message / chat_decision_remove_message. added_by_user_id stamps who filed it. Migration 20271338412990.';

DROP POLICY IF EXISTS chat_decision_messages_read ON public.chat_decision_messages;
CREATE POLICY chat_decision_messages_read
  ON public.chat_decision_messages FOR SELECT
  TO authenticated
  USING (
    thread_id IN (SELECT public.current_thread_ids())
    OR thread_id IN (SELECT t.thread_id FROM public.chat_threads t
                      WHERE t.vendor_profile_id IN (SELECT public.current_vendor_profile_ids())
                         OR t.vendor_profile_id IN (SELECT public.current_vendor_ids()))
    OR (SELECT public.is_admin())
  );
REVOKE ALL ON public.chat_decision_messages FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.chat_decision_messages TO authenticated;
GRANT ALL ON public.chat_decision_messages TO service_role;

-- The one check every filing writer shares: the topic is a live topic in a chat
-- the caller is in, and the message is a SHARED line of that same chat.
-- Returns NULL (go on) or the refusal word.
CREATE OR REPLACE FUNCTION public.chat_decision_filing_refusal(p_topic_id UUID, p_message_id UUID, p_need_open BOOLEAN)
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_thread UUID;
  v_closed TIMESTAMPTZ;
  v_m_thread UUID;
  v_private UUID;
BEGIN
  SELECT thread_id, closed_at INTO v_thread, v_closed
    FROM public.chat_decision_topics WHERE topic_id = p_topic_id;
  IF v_thread IS NULL OR auth.uid() IS NULL OR NOT public.chat_is_in_thread(v_thread) THEN
    RETURN 'not_found';
  END IF;
  SELECT thread_id, recipient_user_id INTO v_m_thread, v_private
    FROM public.chat_messages WHERE message_id = p_message_id;
  IF v_m_thread IS NULL OR v_m_thread <> v_thread THEN
    RETURN 'not_found';
  END IF;
  IF v_private IS NOT NULL THEN
    RETURN 'private';
  END IF;
  IF p_need_open AND v_closed IS NOT NULL THEN
    RETURN 'closed';
  END IF;
  RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.chat_decision_filing_refusal(UUID, UUID, BOOLEAN) FROM PUBLIC, anon, authenticated;

-- File a message under an open topic. Returns ok · already (it is filed there)
-- · filed_elsewhere (under another OPEN topic — Move it instead) · closed ·
-- private · not_found.
CREATE OR REPLACE FUNCTION public.chat_decision_file_message(p_topic_id UUID, p_message_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_refusal TEXT;
  v_thread UUID;
BEGIN
  v_refusal := public.chat_decision_filing_refusal(p_topic_id, p_message_id, TRUE);
  IF v_refusal IS NOT NULL THEN
    RETURN v_refusal;
  END IF;
  -- One filing at a time per message: two people filing the same line at once
  -- cannot both pass the "no other open topic" check.
  PERFORM 1 FROM public.chat_messages WHERE message_id = p_message_id FOR UPDATE;
  IF EXISTS (SELECT 1 FROM public.chat_decision_messages
              WHERE topic_id = p_topic_id AND message_id = p_message_id) THEN
    RETURN 'already';
  END IF;
  IF EXISTS (SELECT 1 FROM public.chat_decision_messages dm
               JOIN public.chat_decision_topics t ON t.topic_id = dm.topic_id
              WHERE dm.message_id = p_message_id AND t.closed_at IS NULL) THEN
    RETURN 'filed_elsewhere';
  END IF;
  SELECT thread_id INTO v_thread FROM public.chat_decision_topics WHERE topic_id = p_topic_id;
  INSERT INTO public.chat_decision_messages (topic_id, message_id, thread_id, added_by_user_id)
  VALUES (p_topic_id, p_message_id, v_thread, auth.uid());
  RETURN 'ok';
END;
$$;
REVOKE ALL ON FUNCTION public.chat_decision_file_message(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.chat_decision_file_message(UUID, UUID) TO authenticated;
COMMENT ON FUNCTION public.chat_decision_file_message(UUID, UUID) IS
  'Files a shared chat message under an OPEN decision topic of the same chat (double-tap a message, owner 11 Nov 2026). Anyone in the chat. A message sits under at most one open topic: filed_elsewhere means Move it. Returns ok · already · filed_elsewhere · closed · private · not_found. Migration 20271338412990.';

-- Move a message from one topic to another open topic of the same chat.
-- Returns ok · same · not_filed · closed (the target is closed) · private · not_found.
CREATE OR REPLACE FUNCTION public.chat_decision_move_message(p_message_id UUID, p_from_topic_id UUID, p_to_topic_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_refusal TEXT;
  v_thread UUID;
BEGIN
  IF p_from_topic_id = p_to_topic_id THEN
    RETURN 'same';
  END IF;
  v_refusal := public.chat_decision_filing_refusal(p_from_topic_id, p_message_id, FALSE);
  IF v_refusal IS NOT NULL THEN
    RETURN v_refusal;
  END IF;
  v_refusal := public.chat_decision_filing_refusal(p_to_topic_id, p_message_id, TRUE);
  IF v_refusal IS NOT NULL THEN
    RETURN v_refusal;
  END IF;
  PERFORM 1 FROM public.chat_messages WHERE message_id = p_message_id FOR UPDATE;
  IF NOT EXISTS (SELECT 1 FROM public.chat_decision_messages
                  WHERE topic_id = p_from_topic_id AND message_id = p_message_id) THEN
    RETURN 'not_filed';
  END IF;
  -- Out of every other OPEN topic too, so the one-open-topic rule holds after.
  DELETE FROM public.chat_decision_messages dm
   USING public.chat_decision_topics t
   WHERE dm.message_id = p_message_id
     AND t.topic_id = dm.topic_id
     AND (dm.topic_id = p_from_topic_id OR t.closed_at IS NULL)
     AND dm.topic_id <> p_to_topic_id;
  SELECT thread_id INTO v_thread FROM public.chat_decision_topics WHERE topic_id = p_to_topic_id;
  INSERT INTO public.chat_decision_messages (topic_id, message_id, thread_id, added_by_user_id)
  VALUES (p_to_topic_id, p_message_id, v_thread, auth.uid())
  ON CONFLICT (topic_id, message_id) DO NOTHING;
  RETURN 'ok';
END;
$$;
REVOKE ALL ON FUNCTION public.chat_decision_move_message(UUID, UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.chat_decision_move_message(UUID, UUID, UUID) TO authenticated;
COMMENT ON FUNCTION public.chat_decision_move_message(UUID, UUID, UUID) IS
  'Moves a filed message from one decision topic to another OPEN topic of the same chat ("Move to …", owner 11 Nov 2026). Anyone in the chat. Returns ok · same · not_filed · closed · private · not_found. Migration 20271338412990.';

-- Take a message out of a topic (swipe left, or "Remove from …"; Undo = file it
-- again). Returns ok · not_filed · not_found.
CREATE OR REPLACE FUNCTION public.chat_decision_remove_message(p_topic_id UUID, p_message_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_refusal TEXT;
BEGIN
  v_refusal := public.chat_decision_filing_refusal(p_topic_id, p_message_id, FALSE);
  IF v_refusal IS NOT NULL AND v_refusal <> 'private' THEN
    RETURN v_refusal;
  END IF;
  DELETE FROM public.chat_decision_messages WHERE topic_id = p_topic_id AND message_id = p_message_id;
  IF NOT FOUND THEN
    RETURN 'not_filed';
  END IF;
  RETURN 'ok';
END;
$$;
REVOKE ALL ON FUNCTION public.chat_decision_remove_message(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.chat_decision_remove_message(UUID, UUID) TO authenticated;
COMMENT ON FUNCTION public.chat_decision_remove_message(UUID, UUID) IS
  'Takes a filed message out of a decision topic (swipe left / "Remove from …", owner 11 Nov 2026; Undo files it again). Anyone in the chat. Returns ok · not_filed · not_found. Migration 20271338412990.';

-- Edit topic — the same line becomes a field, Enter saves in place. Open topics
-- only (a settled decision keeps its words; reopen it first). One chat line.
-- Returns ok · unchanged · empty · closed · not_found.
CREATE OR REPLACE FUNCTION public.chat_decision_rename(p_topic_id UUID, p_title TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_t RECORD;
  v_title TEXT := left(btrim(COALESCE(p_title, '')), 120);
  v_event UUID;
  v_shop UUID;
BEGIN
  SELECT topic_id, thread_id, title, closed_at INTO v_t
    FROM public.chat_decision_topics WHERE topic_id = p_topic_id FOR UPDATE;
  IF v_t.topic_id IS NULL OR auth.uid() IS NULL OR NOT public.chat_is_in_thread(v_t.thread_id) THEN
    RETURN 'not_found';
  END IF;
  IF v_title = '' THEN
    RETURN 'empty';
  END IF;
  IF v_t.closed_at IS NOT NULL THEN
    RETURN 'closed';
  END IF;
  IF v_title = v_t.title THEN
    RETURN 'unchanged';
  END IF;
  UPDATE public.chat_decision_topics SET title = v_title WHERE topic_id = p_topic_id;
  SELECT event_id, vendor_profile_id INTO v_event, v_shop FROM public.chat_threads WHERE thread_id = v_t.thread_id;
  PERFORM public.chat_record_post_line(v_event, v_shop, 'Decision renamed · ' || v_title, 'Decision renamed');
  RETURN 'ok';
END;
$$;
REVOKE ALL ON FUNCTION public.chat_decision_rename(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.chat_decision_rename(UUID, TEXT) TO authenticated;
COMMENT ON FUNCTION public.chat_decision_rename(UUID, TEXT) IS
  'Edit topic on an OPEN decision (owner 11 Nov 2026: Enter saves in place). Anyone in the chat. 120 characters. One chat line. Returns ok · unchanged · empty · closed · not_found. Migration 20271338412990.';

-- ── 2 · polls ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.chat_polls (
  poll_id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id          UUID        NOT NULL REFERENCES public.chat_threads(thread_id) ON DELETE CASCADE,
  question           TEXT        NOT NULL CHECK (char_length(btrim(question)) BETWEEN 1 AND 120),
  asked_by_user_id   UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  asked_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- The stream line the posted card rides ("Poll · <question>").
  message_id         UUID        REFERENCES public.chat_messages(message_id) ON DELETE SET NULL,
  closed_at          TIMESTAMPTZ,
  closed_by_user_id  UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  reopened_at        TIMESTAMPTZ,
  saved_decision_id  UUID        REFERENCES public.chat_decision_topics(topic_id) ON DELETE SET NULL
);
ALTER TABLE public.chat_polls ENABLE ROW LEVEL SECURITY;
-- 🗳 ONE OPEN POLL PER CHAT (owner 11 Nov 2026 "Only one poll can exist per chat").
CREATE UNIQUE INDEX IF NOT EXISTS chat_polls_one_open_per_thread
  ON public.chat_polls (thread_id) WHERE closed_at IS NULL;
CREATE INDEX IF NOT EXISTS chat_polls_thread_idx ON public.chat_polls (thread_id, asked_at);
CREATE INDEX IF NOT EXISTS chat_polls_message_idx ON public.chat_polls (message_id) WHERE message_id IS NOT NULL;
COMMENT ON TABLE public.chat_polls IS
  'A chat''s Poll card (owner 11 Nov 2026): a question both sides vote on. ONE OPEN POLL PER THREAD (chat_polls_one_open_per_thread). Either side closes; anyone reopens unless it was saved as a decision (saved_decision_id). Written ONLY by the chat_poll_* functions. Migration 20271338412990.';

CREATE TABLE IF NOT EXISTS public.chat_poll_choices (
  choice_id  UUID     PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id    UUID     NOT NULL REFERENCES public.chat_polls(poll_id) ON DELETE CASCADE,
  thread_id  UUID     NOT NULL REFERENCES public.chat_threads(thread_id) ON DELETE CASCADE,
  position   SMALLINT NOT NULL CHECK (position BETWEEN 1 AND 6),
  label      TEXT     NOT NULL CHECK (char_length(btrim(label)) BETWEEN 1 AND 60),
  UNIQUE (poll_id, position),
  UNIQUE (choice_id, poll_id)
);
ALTER TABLE public.chat_poll_choices ENABLE ROW LEVEL SECURITY;
COMMENT ON TABLE public.chat_poll_choices IS
  'A poll''s 2–6 choices (≤ 60 characters each), in order. Written once, with the poll, by chat_poll_open. Migration 20271338412990.';

CREATE TABLE IF NOT EXISTS public.chat_poll_votes (
  poll_id        UUID        NOT NULL REFERENCES public.chat_polls(poll_id) ON DELETE CASCADE,
  voter_user_id  UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  choice_id      UUID        NOT NULL,
  thread_id      UUID        NOT NULL REFERENCES public.chat_threads(thread_id) ON DELETE CASCADE,
  voted_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- ONE VOTE PER PERSON PER POLL; it moves (an upsert), it is never a second row.
  PRIMARY KEY (poll_id, voter_user_id),
  -- The choice must be one of THIS poll's choices.
  FOREIGN KEY (choice_id, poll_id) REFERENCES public.chat_poll_choices(choice_id, poll_id) ON DELETE CASCADE
);
ALTER TABLE public.chat_poll_votes ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS chat_poll_votes_choice_idx ON public.chat_poll_votes (choice_id, poll_id);
CREATE INDEX IF NOT EXISTS chat_poll_votes_voter_idx ON public.chat_poll_votes (voter_user_id);
CREATE INDEX IF NOT EXISTS chat_poll_votes_thread_idx ON public.chat_poll_votes (thread_id);
COMMENT ON TABLE public.chat_poll_votes IS
  'One person''s vote on a poll — one row per (poll, voter); tapping another choice MOVES it, tapping your own takes it back (the row goes). Written ONLY by chat_poll_vote. The voter''s own record: it dies with them. Migration 20271338412990.';

-- Read: whoever is in the conversation — chat_decision_topics_read, branch for branch.
DROP POLICY IF EXISTS chat_polls_read ON public.chat_polls;
CREATE POLICY chat_polls_read
  ON public.chat_polls FOR SELECT
  TO authenticated
  USING (
    thread_id IN (SELECT public.current_thread_ids())
    OR thread_id IN (SELECT t.thread_id FROM public.chat_threads t
                      WHERE t.vendor_profile_id IN (SELECT public.current_vendor_profile_ids())
                         OR t.vendor_profile_id IN (SELECT public.current_vendor_ids()))
    OR (SELECT public.is_admin())
  );
DROP POLICY IF EXISTS chat_poll_choices_read ON public.chat_poll_choices;
CREATE POLICY chat_poll_choices_read
  ON public.chat_poll_choices FOR SELECT
  TO authenticated
  USING (
    thread_id IN (SELECT public.current_thread_ids())
    OR thread_id IN (SELECT t.thread_id FROM public.chat_threads t
                      WHERE t.vendor_profile_id IN (SELECT public.current_vendor_profile_ids())
                         OR t.vendor_profile_id IN (SELECT public.current_vendor_ids()))
    OR (SELECT public.is_admin())
  );
DROP POLICY IF EXISTS chat_poll_votes_read ON public.chat_poll_votes;
CREATE POLICY chat_poll_votes_read
  ON public.chat_poll_votes FOR SELECT
  TO authenticated
  USING (
    thread_id IN (SELECT public.current_thread_ids())
    OR thread_id IN (SELECT t.thread_id FROM public.chat_threads t
                      WHERE t.vendor_profile_id IN (SELECT public.current_vendor_profile_ids())
                         OR t.vendor_profile_id IN (SELECT public.current_vendor_ids()))
    OR (SELECT public.is_admin())
  );

-- A question or a choice that names an amount is hosts-only for a masked
-- coordinator — the decision title's rule (20271333705710 §3), RESTRICTIVE.
DROP POLICY IF EXISTS chat_polls_money_hosts_only ON public.chat_polls;
CREATE POLICY chat_polls_money_hosts_only ON public.chat_polls
  AS RESTRICTIVE FOR SELECT TO authenticated
  USING (
    NOT public.chat_text_has_money(question)
    OR asked_by_user_id = (SELECT auth.uid())
    OR NOT public.chat_thread_money_hidden(thread_id)
  );
DROP POLICY IF EXISTS chat_poll_choices_money_hosts_only ON public.chat_poll_choices;
CREATE POLICY chat_poll_choices_money_hosts_only ON public.chat_poll_choices
  AS RESTRICTIVE FOR SELECT TO authenticated
  USING (
    NOT public.chat_text_has_money(label)
    OR NOT public.chat_thread_money_hidden(thread_id)
  );

REVOKE ALL ON public.chat_polls FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.chat_poll_choices FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.chat_poll_votes FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.chat_polls TO authenticated;
GRANT SELECT ON public.chat_poll_choices TO authenticated;
GRANT SELECT ON public.chat_poll_votes TO authenticated;
GRANT ALL ON public.chat_polls TO service_role;
GRANT ALL ON public.chat_poll_choices TO service_role;
GRANT ALL ON public.chat_poll_votes TO service_role;

-- Open a poll: question ≤ 120, 2–6 distinct choices ≤ 60, no contact details.
-- Posts the "Poll · <question>" line the card rides. Raises:
--   42501 chat_poll: NOT_IN_THIS_CHAT · 23505 chat_poll: ONE_OPEN_POLL ·
--   22023 chat_poll: BAD_QUESTION / BAD_CHOICES · 23514 chat_poll: CONTACT_BLOCKED
CREATE OR REPLACE FUNCTION public.chat_poll_open(p_thread_id UUID, p_question TEXT, p_choices TEXT[])
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_q TEXT := btrim(COALESCE(p_question, ''));
  v_choices TEXT[];
  v_id UUID;
  v_event UUID;
  v_shop UUID;
  v_msg UUID;
  v_body TEXT;
  i INTEGER;
BEGIN
  IF auth.uid() IS NULL OR NOT public.chat_is_in_thread(p_thread_id) THEN
    RAISE EXCEPTION 'chat_poll: NOT_IN_THIS_CHAT' USING ERRCODE = '42501';
  END IF;
  IF char_length(v_q) NOT BETWEEN 1 AND 120 THEN
    RAISE EXCEPTION 'chat_poll: BAD_QUESTION — a question of 1 to 120 characters' USING ERRCODE = '22023';
  END IF;
  SELECT array_agg(btrim(c) ORDER BY ord) INTO v_choices
    FROM unnest(COALESCE(p_choices, ARRAY[]::TEXT[])) WITH ORDINALITY AS u(c, ord)
   WHERE btrim(c) <> '';
  IF v_choices IS NULL OR cardinality(v_choices) NOT BETWEEN 2 AND 6
     OR EXISTS (SELECT 1 FROM unnest(v_choices) c WHERE char_length(c) > 60)
     OR (SELECT count(DISTINCT lower(c)) FROM unnest(v_choices) c) <> cardinality(v_choices) THEN
    RAISE EXCEPTION 'chat_poll: BAD_CHOICES — 2 to 6 different choices of up to 60 characters' USING ERRCODE = '22023';
  END IF;
  IF cardinality(public.chat_contact_categories(v_q || E'\n' || array_to_string(v_choices, E'\n'), 'chat')) > 0 THEN
    RAISE EXCEPTION 'chat_poll: CONTACT_BLOCKED — phone numbers, emails and outside-app contacts are not allowed in a conversation'
      USING ERRCODE = '23514';
  END IF;
  IF EXISTS (SELECT 1 FROM public.chat_polls WHERE thread_id = p_thread_id AND closed_at IS NULL) THEN
    RAISE EXCEPTION 'chat_poll: ONE_OPEN_POLL — close the open one first' USING ERRCODE = '23505';
  END IF;

  INSERT INTO public.chat_polls (thread_id, question, asked_by_user_id)
  VALUES (p_thread_id, v_q, auth.uid())
  RETURNING poll_id INTO v_id;
  FOR i IN 1 .. cardinality(v_choices) LOOP
    INSERT INTO public.chat_poll_choices (poll_id, thread_id, position, label)
    VALUES (v_id, p_thread_id, i, v_choices[i]);
  END LOOP;

  -- The line the posted card rides (chat_record_post_line's insert, keeping its id).
  SELECT event_id, vendor_profile_id INTO v_event, v_shop FROM public.chat_threads WHERE thread_id = p_thread_id;
  v_body := left('Poll · ' || v_q, 4000);
  BEGIN
    INSERT INTO public.chat_messages (thread_id, event_id, vendor_profile_id, sender_user_id, sender_role, body)
    VALUES (p_thread_id, v_event, v_shop, NULL, 'system', v_body)
    RETURNING message_id INTO v_msg;
    UPDATE public.chat_polls SET message_id = v_msg WHERE poll_id = v_id;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'chat_poll_open: no line posted for thread % (%): %', p_thread_id, SQLSTATE, SQLERRM;
  END;
  RETURN v_id;
EXCEPTION WHEN unique_violation THEN
  -- Two people opening a poll at the same moment: the index answers.
  RAISE EXCEPTION 'chat_poll: ONE_OPEN_POLL — close the open one first' USING ERRCODE = '23505';
END;
$$;
REVOKE ALL ON FUNCTION public.chat_poll_open(UUID, TEXT, TEXT[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.chat_poll_open(UUID, TEXT, TEXT[]) TO authenticated;
COMMENT ON FUNCTION public.chat_poll_open(UUID, TEXT, TEXT[]) IS
  'Opens a Poll in a chat (owner 11 Nov 2026): question ≤ 120, 2–6 different choices ≤ 60, no contact details; ONE OPEN POLL PER CHAT. Either side. Posts the "Poll · <question>" line the card rides (chat_polls.message_id). Raises 42501 NOT_IN_THIS_CHAT · 23505 ONE_OPEN_POLL · 22023 BAD_QUESTION/BAD_CHOICES · 23514 CONTACT_BLOCKED. Migration 20271338412990.';

-- Vote, move a vote, or take it back (p_choice_id NULL). Open polls only.
-- Returns ok · withdrawn · closed · bad_choice · not_found.
CREATE OR REPLACE FUNCTION public.chat_poll_vote(p_poll_id UUID, p_choice_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_p RECORD;
BEGIN
  SELECT poll_id, thread_id, closed_at INTO v_p FROM public.chat_polls WHERE poll_id = p_poll_id;
  IF v_p.poll_id IS NULL OR auth.uid() IS NULL OR NOT public.chat_is_in_thread(v_p.thread_id) THEN
    RETURN 'not_found';
  END IF;
  IF v_p.closed_at IS NOT NULL THEN
    RETURN 'closed';
  END IF;
  IF p_choice_id IS NULL THEN
    DELETE FROM public.chat_poll_votes WHERE poll_id = p_poll_id AND voter_user_id = auth.uid();
    RETURN 'withdrawn';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.chat_poll_choices WHERE choice_id = p_choice_id AND poll_id = p_poll_id) THEN
    RETURN 'bad_choice';
  END IF;
  INSERT INTO public.chat_poll_votes (poll_id, voter_user_id, choice_id, thread_id)
  VALUES (p_poll_id, auth.uid(), p_choice_id, v_p.thread_id)
  ON CONFLICT (poll_id, voter_user_id)
  DO UPDATE SET choice_id = EXCLUDED.choice_id, voted_at = NOW();
  RETURN 'ok';
END;
$$;
REVOKE ALL ON FUNCTION public.chat_poll_vote(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.chat_poll_vote(UUID, UUID) TO authenticated;
COMMENT ON FUNCTION public.chat_poll_vote(UUID, UUID) IS
  'The caller''s one vote on an OPEN poll: a choice sets or MOVES it, NULL takes it back. Anyone in the chat. Returns ok · withdrawn · closed · bad_choice · not_found. Migration 20271338412990.';

-- Close: either side (owner 11 Nov "2. Either side"). Returns ok · unchanged · not_found.
CREATE OR REPLACE FUNCTION public.chat_poll_close(p_poll_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_p RECORD;
  v_event UUID;
  v_shop UUID;
BEGIN
  SELECT poll_id, thread_id, question, closed_at INTO v_p FROM public.chat_polls WHERE poll_id = p_poll_id FOR UPDATE;
  IF v_p.poll_id IS NULL OR auth.uid() IS NULL OR NOT public.chat_is_in_thread(v_p.thread_id) THEN
    RETURN 'not_found';
  END IF;
  IF v_p.closed_at IS NOT NULL THEN
    RETURN 'unchanged';
  END IF;
  UPDATE public.chat_polls SET closed_at = NOW(), closed_by_user_id = auth.uid() WHERE poll_id = p_poll_id;
  SELECT event_id, vendor_profile_id INTO v_event, v_shop FROM public.chat_threads WHERE thread_id = v_p.thread_id;
  PERFORM public.chat_record_post_line(v_event, v_shop, 'Poll closed · ' || v_p.question, 'Poll closed');
  RETURN 'ok';
END;
$$;
REVOKE ALL ON FUNCTION public.chat_poll_close(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.chat_poll_close(UUID) TO authenticated;
COMMENT ON FUNCTION public.chat_poll_close(UUID) IS
  'Closes a poll — either side of the chat (owner 11 Nov 2026). One chat line. Returns ok · unchanged · not_found. Migration 20271338412990.';

-- Reopen: anyone in the chat, while no other poll is open, and never one already
-- saved as the decision. Returns ok · unchanged · one_open · saved · not_found.
CREATE OR REPLACE FUNCTION public.chat_poll_reopen(p_poll_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_p RECORD;
  v_event UUID;
  v_shop UUID;
BEGIN
  SELECT poll_id, thread_id, question, closed_at, saved_decision_id INTO v_p
    FROM public.chat_polls WHERE poll_id = p_poll_id FOR UPDATE;
  IF v_p.poll_id IS NULL OR auth.uid() IS NULL OR NOT public.chat_is_in_thread(v_p.thread_id) THEN
    RETURN 'not_found';
  END IF;
  IF v_p.closed_at IS NULL THEN
    RETURN 'unchanged';
  END IF;
  IF v_p.saved_decision_id IS NOT NULL THEN
    RETURN 'saved';
  END IF;
  IF EXISTS (SELECT 1 FROM public.chat_polls WHERE thread_id = v_p.thread_id AND closed_at IS NULL) THEN
    RETURN 'one_open';
  END IF;
  BEGIN
    UPDATE public.chat_polls
       SET closed_at = NULL, closed_by_user_id = NULL, reopened_at = NOW()
     WHERE poll_id = p_poll_id;
  EXCEPTION WHEN unique_violation THEN
    RETURN 'one_open';
  END;
  SELECT event_id, vendor_profile_id INTO v_event, v_shop FROM public.chat_threads WHERE thread_id = v_p.thread_id;
  PERFORM public.chat_record_post_line(v_event, v_shop, 'Poll reopened · ' || v_p.question, 'Poll reopened');
  RETURN 'ok';
END;
$$;
REVOKE ALL ON FUNCTION public.chat_poll_reopen(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.chat_poll_reopen(UUID) TO authenticated;
COMMENT ON FUNCTION public.chat_poll_reopen(UUID) IS
  'Reopens a closed poll — anyone in the chat — while no other poll in that chat is open, and never one already saved as the decision. One chat line. Returns ok · unchanged · one_open · saved · not_found. Migration 20271338412990.';

-- Save a CLOSED poll as the decision: the winning choice becomes a decision
-- topic through the shipped door (chat_decision_open → its "Decision opened ·"
-- line). A tie (or no votes) needs p_choice_id, one of the tied choices.
-- Raises 42501 NOT_IN_THIS_CHAT · 55000 STILL_OPEN · 23505 ALREADY_SAVED ·
-- 22023 TIE (DETAIL = the tied choice ids, comma-separated) · 22023 BAD_CHOICE.
CREATE OR REPLACE FUNCTION public.chat_poll_save_as_decision(p_poll_id UUID, p_choice_id UUID DEFAULT NULL)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_p RECORD;
  v_top UUID[];
  v_pick UUID;
  v_label TEXT;
  v_topic UUID;
BEGIN
  SELECT poll_id, thread_id, closed_at, saved_decision_id INTO v_p
    FROM public.chat_polls WHERE poll_id = p_poll_id FOR UPDATE;
  IF v_p.poll_id IS NULL OR auth.uid() IS NULL OR NOT public.chat_is_in_thread(v_p.thread_id) THEN
    RAISE EXCEPTION 'chat_poll: NOT_IN_THIS_CHAT' USING ERRCODE = '42501';
  END IF;
  IF v_p.closed_at IS NULL THEN
    RAISE EXCEPTION 'chat_poll: STILL_OPEN — close the poll first' USING ERRCODE = '55000';
  END IF;
  IF v_p.saved_decision_id IS NOT NULL THEN
    RAISE EXCEPTION 'chat_poll: ALREADY_SAVED' USING ERRCODE = '23505';
  END IF;
  -- The choices with the most votes (every choice when nobody voted).
  WITH counts AS (
    SELECT c.choice_id, count(v.voter_user_id) AS n
      FROM public.chat_poll_choices c
      LEFT JOIN public.chat_poll_votes v ON v.choice_id = c.choice_id AND v.poll_id = c.poll_id
     WHERE c.poll_id = p_poll_id
     GROUP BY c.choice_id
  )
  SELECT array_agg(choice_id) INTO v_top FROM counts WHERE n = (SELECT max(n) FROM counts);
  IF p_choice_id IS NOT NULL THEN
    IF NOT (p_choice_id = ANY (v_top)) THEN
      RAISE EXCEPTION 'chat_poll: BAD_CHOICE — only a winning choice is saved' USING ERRCODE = '22023';
    END IF;
    v_pick := p_choice_id;
  ELSIF cardinality(v_top) = 1 THEN
    v_pick := v_top[1];
  ELSE
    RAISE EXCEPTION 'chat_poll: TIE — pick the decision'
      USING ERRCODE = '22023', DETAIL = array_to_string(v_top, ',');
  END IF;
  SELECT label INTO v_label FROM public.chat_poll_choices WHERE choice_id = v_pick;
  v_topic := public.chat_decision_open(v_p.thread_id, v_label);
  UPDATE public.chat_polls SET saved_decision_id = v_topic WHERE poll_id = p_poll_id;
  RETURN v_topic;
END;
$$;
REVOKE ALL ON FUNCTION public.chat_poll_save_as_decision(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.chat_poll_save_as_decision(UUID, UUID) TO authenticated;
COMMENT ON FUNCTION public.chat_poll_save_as_decision(UUID, UUID) IS
  'Saves a CLOSED poll as the decision (owner 11 Nov 2026 — a poll gathers views, a decision is what was settled): the winning choice opens a decision topic through chat_decision_open; a tie needs p_choice_id (one of the tied). Either side. Returns the topic_id. Raises 42501 NOT_IN_THIS_CHAT · 55000 STILL_OPEN · 23505 ALREADY_SAVED · 22023 TIE (DETAIL = tied ids) / BAD_CHOICE. Migration 20271338412990.';

-- ── 3 · realtime on the existing publication (guarded, as 20271325581544) ───
DO $$
DECLARE
  t TEXT;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    FOREACH t IN ARRAY ARRAY['chat_decision_messages', 'chat_polls', 'chat_poll_choices', 'chat_poll_votes'] LOOP
      IF NOT EXISTS (SELECT 1 FROM pg_publication_tables
                      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = t) THEN
        EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
      END IF;
    END LOOP;
  END IF;
END $$;

COMMIT;
