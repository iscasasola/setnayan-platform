-- your_own_message_edit_unsend_voice_and_reminders
-- Created via `pnpm migration:new`. KEEP THIS MIGRATION IDEMPOTENT (it may be re-applied):
--   • CREATE TABLE IF NOT EXISTS · ADD COLUMN IF NOT EXISTS · DROP POLICY IF EXISTS + CREATE POLICY ·
--     CREATE OR REPLACE FUNCTION · DROP CONSTRAINT IF EXISTS + ADD CONSTRAINT
--
-- ════════════════════════════════════════════════════════════════════════════
-- 💬 UNICHAT PART H1 — MESSAGE EXTRAS: EDIT · UNSEND · VOICE NOTES · REMINDERS.
--
-- DECISION_LOG 2026-11-20 "Unichat live prototype v3 APPROVED" (… "search, edit/unsend, seen-by, failed-send retry,
-- voice notes, reminders, receipt, terms at Accept, crew for the day, handover + review") and "UNICHAT BUILD STARTS"
-- (parts A–I of build-sessions/UNICHAT-BUILD-PLAN-2026-11-20.md; this is the message half of row H).
-- The drawing (build-sessions/UNICHAT-LIVE-2026-11-19.html): "Hold your own new message: Edit or Unsend." — open for
-- 15 minutes (`Date.now()-m.born < 900000`), a voice note has Unsend only, an unsent message becomes the quiet line
-- "… unsent a message", an edited one wears a small "edited". "Empty box: the arrow is a mic. Hold to record, slide
-- left to cancel."
--
-- ⚖ THE CHAT IS STILL THE RECORD (migration 20270926679942, `tests/db/chat-immutable-archive.db.test.ts`): there is
-- STILL no UPDATE or DELETE policy on chat_messages. The member paths are two SECURITY DEFINER writers, each for ONE
-- message, and each KEEPS WHAT WAS THERE in `chat_message_revisions` before it changes anything — so an edit or an
-- unsend changes what the chat SHOWS, never what Setnayan HOLDS. Nothing is deleted, and no file leaves storage.
--
--   edit_my_chat_message(message, body)   — your own WORDS-ONLY message, ≤ 15 min (+30 s grace) after sending.
--   unsend_my_chat_message(message)       — your own words-only message OR your own voice note, same window.
--
-- Both refuse, with the same answer for not-found / not-yours / no-longer-in-the-chat (NOT_YOURS — never confirming
-- somebody else's message exists):
--   • anything that is not the caller's own message (`sender_user_id = auth.uid()`); a system or bot line has no sender;
--   • a caller who can no longer read the chat (the three member branches of `chat_messages_member_read` — a host who
--     left, a removed co-host, a team member taken off the shop);
--   • a card (quote · meeting · adjustment · amendment · service card · dropped offer) — a card is changed by its own
--     flow, never retyped (NOT_WORDS);
--   • a message carrying a photo / video / document (NOT_WORDS) — a file leaves by its own shipped door,
--     `remove_my_chat_file` (20271342335343), with its booking rule;
--   • a message filed under a decision (FILED) — a decision's evidence does not change under it;
--   • a message already unsent (GONE); past the window (WINDOW_CLOSED).
-- An edit is screened by the SAME contact rule as a send (`chat_contact_categories`, 20271221089848) — editing is not
-- a way round it (CONTACT_BLOCKED).
--
-- 🎤 A VOICE NOTE is a chat file like any other — same private bucket, same per-sender folder, same guard
-- (`tg_chat_messages_guard_end_user_write`), same read route — with an audio type and its length in
-- `chat_messages.voice_seconds`. No new storage path.
--
-- ⏰ A REMINDER (`chat_message_reminders`) is one person's own note-to-self on one message they can read. It is
-- delivered as an IN-APP notification (`chat_reminder`, the migration before this one) by the app — cron-free: the
-- person's next visit claims what is due (`claim_my_due_chat_reminders`, atomic, so two tabs never deliver twice) and
-- the app re-reads the message UNDER THAT PERSON'S OWN RLS before it says anything. A person who can no longer read
-- the message is told nothing about it.
-- ════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── §0 · the markers on the message itself ──────────────────────────────────
ALTER TABLE public.chat_messages ADD COLUMN IF NOT EXISTS edited_at TIMESTAMPTZ;
ALTER TABLE public.chat_messages ADD COLUMN IF NOT EXISTS unsent_at TIMESTAMPTZ;
ALTER TABLE public.chat_messages ADD COLUMN IF NOT EXISTS voice_seconds SMALLINT
  CHECK (voice_seconds IS NULL OR voice_seconds BETWEEN 1 AND 300);

COMMENT ON COLUMN public.chat_messages.edited_at IS
  'When its sender last edited this message''s words (Unichat H1). Written only by edit_my_chat_message(); the words before each edit are kept in chat_message_revisions. Migration 20271354347259.';
COMMENT ON COLUMN public.chat_messages.unsent_at IS
  'When its sender unsent this message (Unichat H1). The body is emptied and a voice note''s attachment columns cleared in the same write; what was there is kept in chat_message_revisions. Written only by unsend_my_chat_message(). Migration 20271354347259.';
COMMENT ON COLUMN public.chat_messages.voice_seconds IS
  'The length of a VOICE NOTE in seconds, as the recording phone measured it (display only — 1..300). Set on a message whose attachment is audio; NULL on every other message. Migration 20271354347259.';

-- The sender names the length when it sends a voice note. chat_messages carries PER-COLUMN insert grants
-- (20271132839561), so a new column is not writable until it is granted. edited_at / unsent_at get NO grant: only the
-- two definer writers below set them.
GRANT INSERT (voice_seconds) ON public.chat_messages TO authenticated;

-- An unsent message has no words and no file — the one more case the body rule must allow (20271346331739 allowed
-- "no words when it carries a file"). Loosens only; the 4,000 ceiling is unchanged.
ALTER TABLE public.chat_messages DROP CONSTRAINT IF EXISTS chat_messages_body_check;
ALTER TABLE public.chat_messages ADD CONSTRAINT chat_messages_body_check CHECK (
  length(body) <= 4000
  AND (length(body) > 0 OR attachment_url IS NOT NULL OR attachment_r2_key IS NOT NULL OR unsent_at IS NOT NULL)
);

-- ── §1 · what was there before — kept, and read by nobody in the chat ───────
CREATE TABLE IF NOT EXISTS public.chat_message_revisions (
  revision_id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  message_id                   UUID        NOT NULL REFERENCES public.chat_messages(message_id) ON DELETE CASCADE,
  thread_id                    UUID        NOT NULL REFERENCES public.chat_threads(thread_id) ON DELETE CASCADE,
  kind                         TEXT        NOT NULL CHECK (kind IN ('edit', 'unsend')),
  body_before                  TEXT        NOT NULL,
  attachment_r2_key_before     TEXT,
  attachment_name_before       TEXT,
  attachment_mime_before       TEXT,
  attachment_size_bytes_before BIGINT,
  voice_seconds_before         SMALLINT,
  changed_by                   UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  changed_at                   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.chat_message_revisions ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS chat_message_revisions_message_idx ON public.chat_message_revisions(message_id);
CREATE INDEX IF NOT EXISTS chat_message_revisions_thread_idx ON public.chat_message_revisions(thread_id);
-- No policy and no grant: nobody in the chat reads what a message used to say (that is what unsend means), and only
-- the two writers below add rows. The service role (retention, a dispute handled by Setnayan) bypasses RLS as it does
-- for the messages themselves.
REVOKE ALL ON public.chat_message_revisions FROM PUBLIC, anon, authenticated;
COMMENT ON TABLE public.chat_message_revisions IS
  'What a chat message held BEFORE its sender edited or unsent it (Unichat H1): the words, and for an unsent voice note its stored ref, name, type, size and length. One row per change, never updated. Keeps the chat the record while the screen shows the edit / "unsent a message". No end-user access at all (RLS on, no policy, no grant); written only by edit_my_chat_message() and unsend_my_chat_message(). Goes with its message and its thread (retention). Migration 20271354347259.';

-- ── §2 · "can the caller still read this chat" — the member read's own three branches ──
CREATE OR REPLACE FUNCTION public.chat_message_caller_is_in_chat(p_thread_id UUID, p_vendor_profile_id UUID, p_event_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  -- COALESCE IS LOAD-BEARING: a GROUP chat's messages carry no vendor_profile_id, and `NULL IN (…)` is NULL — so for
  -- a person in none of the branches the OR chain is NULL, and `IF NOT NULL` in the callers would NOT refuse.
  -- Unknown is "no".
  SELECT COALESCE(
    auth.uid() IS NOT NULL AND (
         p_thread_id IN (SELECT public.current_thread_ids())
      OR p_vendor_profile_id IN (SELECT public.current_vendor_profile_ids())
      OR (
        p_vendor_profile_id IN (SELECT public.current_vendor_ids('viewer'))
        AND p_event_id IN (SELECT public.agent_customer_event_ids())
      )
    ),
    FALSE
  );
$$;
-- Internal: only the two writers below call it.
REVOKE ALL ON FUNCTION public.chat_message_caller_is_in_chat(UUID, UUID, UUID) FROM PUBLIC, anon, authenticated;
COMMENT ON FUNCTION public.chat_message_caller_is_in_chat(UUID, UUID, UUID) IS
  'TRUE while the CALLER is still a party to this chat — the same three branches as the chat_messages_member_read policy (current_thread_ids · current_vendor_profile_ids · a viewer team member on a served event). Used by edit_my_chat_message / unsend_my_chat_message so a person who left or was removed changes nothing. Internal. Migration 20271354347259.';

-- ── §3 · edit your own words ────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.edit_my_chat_message(p_message_id UUID, p_body TEXT)
RETURNS TABLE (thread_id UUID, edited_at TIMESTAMPTZ)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid  UUID := auth.uid();
  v_msg  public.chat_messages%ROWTYPE;
  v_now  TIMESTAMPTZ := NOW();
  v_body TEXT := btrim(COALESCE(p_body, ''));
  v_cats TEXT[];
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'edit_my_chat_message: NOT_SIGNED_IN' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_msg FROM public.chat_messages m WHERE m.message_id = p_message_id FOR UPDATE;
  -- Not found, not yours and no longer in the chat all answer the same.
  IF v_msg.message_id IS NULL
     OR v_msg.sender_user_id IS DISTINCT FROM v_uid
     OR NOT public.chat_message_caller_is_in_chat(v_msg.thread_id, v_msg.vendor_profile_id, v_msg.event_id) THEN
    RAISE EXCEPTION 'edit_my_chat_message: NOT_YOURS' USING ERRCODE = '42501';
  END IF;
  IF v_msg.unsent_at IS NOT NULL THEN
    RAISE EXCEPTION 'edit_my_chat_message: GONE — this message was unsent' USING ERRCODE = '22023';
  END IF;
  IF COALESCE(v_msg.is_bot, FALSE)
     OR v_msg.proposal_id IS NOT NULL
     OR v_msg.appointment_id IS NOT NULL
     OR v_msg.change_order_id IS NOT NULL
     OR v_msg.amendment_id IS NOT NULL
     OR v_msg.offered_service_id IS NOT NULL
     OR v_msg.vendor_offer_id IS NOT NULL
     OR v_msg.attachment_r2_key IS NOT NULL
     OR v_msg.attachment_url IS NOT NULL THEN
    RAISE EXCEPTION 'edit_my_chat_message: NOT_WORDS — only a message of words is edited' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (SELECT 1 FROM public.chat_decision_messages dm WHERE dm.message_id = v_msg.message_id) THEN
    RAISE EXCEPTION 'edit_my_chat_message: FILED — this message is filed under a decision, so it stays as it is' USING ERRCODE = '42501';
  END IF;
  -- The row's own created_at against the SERVER's clock — never the phone's.
  IF v_now - v_msg.created_at > INTERVAL '15 minutes 30 seconds' THEN
    RAISE EXCEPTION 'edit_my_chat_message: WINDOW_CLOSED — a message can be edited for 15 minutes after sending' USING ERRCODE = '22023';
  END IF;
  IF length(v_body) = 0 THEN
    RAISE EXCEPTION 'edit_my_chat_message: EMPTY — a message needs words' USING ERRCODE = '22023';
  END IF;
  IF length(v_body) > 4000 THEN
    RAISE EXCEPTION 'edit_my_chat_message: TOO_LONG — max 4,000 characters' USING ERRCODE = '22023';
  END IF;
  -- The same screen a send passes (tg_chat_messages_guard_end_user_write). The text is never echoed.
  v_cats := public.chat_contact_categories(v_body, 'chat');
  IF cardinality(v_cats) > 0 THEN
    RAISE EXCEPTION 'edit_my_chat_message: CONTACT_BLOCKED — phone numbers, emails and outside-app contacts are not allowed in a conversation'
      USING ERRCODE = '23514', DETAIL = array_to_string(v_cats, ',');
  END IF;

  thread_id := v_msg.thread_id;
  -- The same words again change nothing and write no history.
  IF v_body = v_msg.body THEN
    edited_at := v_msg.edited_at;
    RETURN NEXT;
    RETURN;
  END IF;

  INSERT INTO public.chat_message_revisions (message_id, thread_id, kind, body_before, changed_by, changed_at)
  VALUES (v_msg.message_id, v_msg.thread_id, 'edit', v_msg.body, v_uid, v_now);

  UPDATE public.chat_messages m
     SET body = v_body,
         edited_at = v_now
   WHERE m.message_id = v_msg.message_id;

  edited_at := v_now;
  RETURN NEXT;
END;
$$;
REVOKE ALL ON FUNCTION public.edit_my_chat_message(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.edit_my_chat_message(UUID, TEXT) TO authenticated;
COMMENT ON FUNCTION public.edit_my_chat_message(UUID, TEXT) IS
  'Editing your OWN words-only chat message (Unichat H1, approved prototype v3): ≤ 15 min after sending (+30 s grace) by the server''s clock; the words before are kept in chat_message_revisions; edited_at is set. Refuses NOT_YOURS (not found · not the sender · no longer in the chat) · GONE (unsent) · NOT_WORDS (a card, a bot line, a message with a file) · FILED (filed under a decision) · WINDOW_CLOSED · EMPTY · TOO_LONG · CONTACT_BLOCKED (the send''s own contact screen). There is still no UPDATE policy on chat_messages. Migration 20271354347259.';

-- ── §4 · unsend your own message ────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.unsend_my_chat_message(p_message_id UUID)
RETURNS TABLE (thread_id UUID, unsent_at TIMESTAMPTZ)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid   UUID := auth.uid();
  v_msg   public.chat_messages%ROWTYPE;
  v_now   TIMESTAMPTZ := NOW();
  v_voice BOOLEAN;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'unsend_my_chat_message: NOT_SIGNED_IN' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_msg FROM public.chat_messages m WHERE m.message_id = p_message_id FOR UPDATE;
  IF v_msg.message_id IS NULL
     OR v_msg.sender_user_id IS DISTINCT FROM v_uid
     OR NOT public.chat_message_caller_is_in_chat(v_msg.thread_id, v_msg.vendor_profile_id, v_msg.event_id) THEN
    RAISE EXCEPTION 'unsend_my_chat_message: NOT_YOURS' USING ERRCODE = '42501';
  END IF;
  IF v_msg.unsent_at IS NOT NULL THEN
    RAISE EXCEPTION 'unsend_my_chat_message: GONE — this message was already unsent' USING ERRCODE = '22023';
  END IF;
  -- A voice note: an audio file with its length. Any other file leaves by remove_my_chat_file, with its booking rule.
  v_voice := v_msg.attachment_r2_key IS NOT NULL
         AND v_msg.voice_seconds IS NOT NULL
         AND COALESCE(v_msg.attachment_mime, '') LIKE 'audio/%';
  IF COALESCE(v_msg.is_bot, FALSE)
     OR v_msg.proposal_id IS NOT NULL
     OR v_msg.appointment_id IS NOT NULL
     OR v_msg.change_order_id IS NOT NULL
     OR v_msg.amendment_id IS NOT NULL
     OR v_msg.offered_service_id IS NOT NULL
     OR v_msg.vendor_offer_id IS NOT NULL
     OR v_msg.attachment_url IS NOT NULL
     OR (v_msg.attachment_r2_key IS NOT NULL AND NOT v_voice) THEN
    RAISE EXCEPTION 'unsend_my_chat_message: NOT_WORDS — only words or a voice note are unsent this way' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (SELECT 1 FROM public.chat_decision_messages dm WHERE dm.message_id = v_msg.message_id) THEN
    RAISE EXCEPTION 'unsend_my_chat_message: FILED — this message is filed under a decision, so it stays' USING ERRCODE = '42501';
  END IF;
  IF v_now - v_msg.created_at > INTERVAL '15 minutes 30 seconds' THEN
    RAISE EXCEPTION 'unsend_my_chat_message: WINDOW_CLOSED — a message can be unsent for 15 minutes after sending' USING ERRCODE = '22023';
  END IF;

  -- Kept first: the words, and a voice note's stored ref (the object itself is NOT deleted — once the row no longer
  -- names it, the read route, which re-proves from the row, cannot reach it).
  INSERT INTO public.chat_message_revisions (
    message_id, thread_id, kind, body_before,
    attachment_r2_key_before, attachment_name_before, attachment_mime_before, attachment_size_bytes_before,
    voice_seconds_before, changed_by, changed_at
  ) VALUES (
    v_msg.message_id, v_msg.thread_id, 'unsend', v_msg.body,
    v_msg.attachment_r2_key, v_msg.attachment_name, v_msg.attachment_mime, v_msg.attachment_size_bytes,
    v_msg.voice_seconds, v_uid, v_now
  );

  -- The row STAYS (hearts, order in the thread), so the change reaches everyone as a thread-filtered, RLS-checked
  -- realtime UPDATE and both sides draw "… unsent a message".
  UPDATE public.chat_messages m
     SET unsent_at = v_now,
         body = '',
         attachment_r2_key = NULL,
         attachment_name = NULL,
         attachment_mime = NULL,
         attachment_size_bytes = NULL,
         voice_seconds = NULL
   WHERE m.message_id = v_msg.message_id;

  -- A reminder on a message that no longer says anything has nothing to remind of.
  DELETE FROM public.chat_message_reminders r WHERE r.message_id = v_msg.message_id AND r.delivered_at IS NULL;

  thread_id := v_msg.thread_id;
  unsent_at := v_now;
  RETURN NEXT;
END;
$$;
REVOKE ALL ON FUNCTION public.unsend_my_chat_message(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.unsend_my_chat_message(UUID) TO authenticated;
COMMENT ON FUNCTION public.unsend_my_chat_message(UUID) IS
  'Unsending your OWN words-only chat message or voice note (Unichat H1, approved prototype v3): ≤ 15 min after sending (+30 s grace). The row stays and is marked (unsent_at), its words emptied and a voice note''s attachment columns cleared; what was there is kept in chat_message_revisions; nothing leaves storage; pending reminders on it go. Refuses NOT_YOURS · GONE · NOT_WORDS (a card, a bot line, a photo/video/document — those leave by remove_my_chat_file) · FILED · WINDOW_CLOSED. There is still no UPDATE or DELETE policy on chat_messages. Migration 20271354347259.';

-- ── §5 · "Remind me" — one person's own reminder on one message they can read ──
CREATE TABLE IF NOT EXISTS public.chat_message_reminders (
  reminder_id  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id   UUID        NOT NULL REFERENCES public.chat_messages(message_id) ON DELETE CASCADE,
  thread_id    UUID        NOT NULL REFERENCES public.chat_threads(thread_id) ON DELETE CASCADE,
  user_id      UUID        NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  -- The side of the chat the person set it from — which door the notice opens (the supplier's or the event's).
  side         TEXT        NOT NULL CHECK (side IN ('couple', 'vendor')),
  remind_at    TIMESTAMPTZ NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Set by claim_my_due_chat_reminders() only, the moment the person's visit claims it.
  delivered_at TIMESTAMPTZ,
  UNIQUE (message_id, user_id)
);
ALTER TABLE public.chat_message_reminders ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS chat_message_reminders_due_idx
  ON public.chat_message_reminders(user_id, remind_at) WHERE delivered_at IS NULL;
CREATE INDEX IF NOT EXISTS chat_message_reminders_thread_idx ON public.chat_message_reminders(thread_id);

-- Your own rows, only.
DROP POLICY IF EXISTS chat_message_reminders_own_read ON public.chat_message_reminders;
CREATE POLICY chat_message_reminders_own_read
  ON public.chat_message_reminders FOR SELECT
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- Set one for YOURSELF, on a message you can read NOW: the EXISTS runs under the caller's own chat_messages RLS
-- (the member read and every restrictive policy on it — a private line, a masked amount), so this policy never
-- re-states who is in a chat. Within a year, not in the past, never pre-marked delivered.
DROP POLICY IF EXISTS chat_message_reminders_own_insert ON public.chat_message_reminders;
CREATE POLICY chat_message_reminders_own_insert
  ON public.chat_message_reminders FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = (SELECT auth.uid())
    AND delivered_at IS NULL
    AND remind_at > NOW() - INTERVAL '1 minute'
    AND remind_at <= NOW() + INTERVAL '366 days'
    AND EXISTS (
      SELECT 1 FROM public.chat_messages m
       WHERE m.message_id = chat_message_reminders.message_id
         AND m.thread_id = chat_message_reminders.thread_id
         AND m.unsent_at IS NULL
    )
  );

-- Take your own reminder back (also how it is moved: remove, then set again).
DROP POLICY IF EXISTS chat_message_reminders_own_delete ON public.chat_message_reminders;
CREATE POLICY chat_message_reminders_own_delete
  ON public.chat_message_reminders FOR DELETE
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- No UPDATE at all for end users; delivered_at is the claim's to write.
REVOKE ALL ON public.chat_message_reminders FROM PUBLIC, anon, authenticated;
GRANT SELECT, DELETE ON public.chat_message_reminders TO authenticated;
GRANT INSERT (message_id, thread_id, user_id, side, remind_at) ON public.chat_message_reminders TO authenticated;
COMMENT ON TABLE public.chat_message_reminders IS
  '"Remind me" on a chat message (Unichat H1): one person''s own reminder on one message they can read — one per person per message. RLS: your own rows only; an insert needs a message the caller''s own chat_messages RLS returns; no end-user UPDATE. Delivered as an in-app notification (type chat_reminder, never an email) by the app after claim_my_due_chat_reminders() marks it — and only if the person can still read the message. Migration 20271354347259.';

-- The atomic claim: the caller's OWN due reminders, marked delivered and handed back in one statement — two tabs
-- (or two page loads) can never both take the same one. It says nothing about the message; the app re-reads that
-- under the caller's RLS.
CREATE OR REPLACE FUNCTION public.claim_my_due_chat_reminders()
RETURNS TABLE (reminder_id UUID, message_id UUID, thread_id UUID, side TEXT, remind_at TIMESTAMPTZ)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RETURN;
  END IF;
  RETURN QUERY
    UPDATE public.chat_message_reminders r
       SET delivered_at = NOW()
     WHERE r.user_id = v_uid
       AND r.delivered_at IS NULL
       AND r.remind_at <= NOW()
    RETURNING r.reminder_id, r.message_id, r.thread_id, r.side, r.remind_at;
END;
$$;
REVOKE ALL ON FUNCTION public.claim_my_due_chat_reminders() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_my_due_chat_reminders() TO authenticated;
COMMENT ON FUNCTION public.claim_my_due_chat_reminders() IS
  'Marks the CALLER''s own due chat reminders delivered and returns them (reminder · message · thread · side · when) — atomic, so a reminder is delivered once. Returns nothing for a signed-out caller and never another person''s rows. It does not read the message: the app does, under the caller''s own RLS, before it sends the in-app notice. Migration 20271354347259.';

COMMIT;
