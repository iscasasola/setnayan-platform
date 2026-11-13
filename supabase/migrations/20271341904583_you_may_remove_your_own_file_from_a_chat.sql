-- you_may_remove_your_own_file_from_a_chat
-- Created via `pnpm migration:new`. KEEP THIS MIGRATION IDEMPOTENT (it may be re-applied):
--   • CREATE TABLE IF NOT EXISTS · DROP POLICY IF EXISTS + CREATE POLICY · CREATE OR REPLACE FUNCTION …
--
-- ════════════════════════════════════════════════════════════════════════════
-- 👈 REMOVING YOUR OWN FILE FROM A CHAT — THE UNDO RING AND THE SWIPE.
--
-- DECISION_LOG 2026-11-13, two rows:
--   • "CHAT FILE: UNDO RING SHOWS AT ONCE ON SEND (10 S, INSTANT DELETE) · SWIPE = DELETE FOR EVERYONE (FIRST 5 MIN)
--     OR DELETE FOR ME." Owner, verbatim: "wait. so undo is instant delete and delete via swipe (the one you proposed)
--     will ask if delete for everyone (first 5 minutes) or delete for myself" and "undo button does not need to swipe.
--     it shows instantly".
--   • "CHAT FILE UNDO DRAWING APPROVED." Owner, verbatim: "chat undo drawing approve" — prototype
--     chat_file_undo_ring_2026-11-13 v3, as drawn: booking files (contract, payment proof, pinned to a decision) never
--     get Delete for everyone; words sent with the file stay; a failed delete keeps the bubble.
-- And 2026-11-12 "DOCUMENTS BELONG TO THE BOOKING": contracts, payment proofs and anything pinned to a decision keep
-- the shipped keeping rule.
--
-- ⚖ The chat's immutable-evidence posture (migration 20270926679942, `tests/db/chat-immutable-archive.db.test.ts`) is
-- UNCHANGED for everything else: there is still no DELETE or UPDATE policy on chat_messages. The one member path is
-- this SECURITY DEFINER writer, for ONE message, only when ALL of these hold:
--   • the caller is signed in and SENT it (`sender_user_id = auth.uid()`) — never the other side's file, never a
--     system line (system lines have no sender);
--   • it CARRIES A FILE (`attachment_r2_key`, or the legacy `attachment_url`);
--   • the caller can still read it (the member branches of `chat_messages_member_read`) — a member who left removes
--     nothing.
--
-- THREE MODES, every window measured HERE against the row's own created_at (never the phone's clock):
--   undo      ≤ 10 s after sending (+5 s grace) — the ↺ ring. No words: the row is deleted, no line is left. Words:
--             only the attachment columns are cleared, the words stay.
--   everyone  ≤ 5 min after sending (+30 s grace) — the swipe's red choice. The attachment columns are cleared (the
--             words stay) and a chat_file_removals row (for_everyone) lets both sides draw "… removed a file · time".
--   me        any time — a chat_file_removals row for the caller only. The other person and Setnayan keep the file.
-- A BOOKING FILE (`chat_message_is_booking_file`) refuses undo and everyone alike (BOOKING_FILE); only `me` is open.
--
-- What leaves with a deleted row (undo, no words): its hearts and decision filings CASCADE; a supplier's filed copy
-- (`event_supplier_files.chat_message_id`) SET NULLs — but a file filed to "This booking" is a booking file and is
-- never deleted here. The route drops the R2 object best-effort after the row (the row is what the read route
-- re-proves, so a lingering object is unreachable through the app).
-- ════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── §1 · who removed which file, and for whom ───────────────────────────────
-- No per-viewer hide existed on chat messages (searched 2026-11-13: chat_message_flags is the admin contact-info
-- queue; nothing else hides a message for one person), so this is the smallest table that carries both facts.
CREATE TABLE IF NOT EXISTS public.chat_file_removals (
  message_id    UUID        NOT NULL REFERENCES public.chat_messages(message_id) ON DELETE CASCADE,
  user_id       UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  thread_id     UUID        NOT NULL REFERENCES public.chat_threads(thread_id) ON DELETE CASCADE,
  -- TRUE = the sender removed it for everyone (both sides draw the line); FALSE = hidden for this user only.
  for_everyone  BOOLEAN     NOT NULL,
  removed_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (message_id, user_id)
);
ALTER TABLE public.chat_file_removals ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS chat_file_removals_thread_idx ON public.chat_file_removals(thread_id);

-- Your own row always; a for-everyone row to whoever can read the message itself (chat_messages' own RLS decides,
-- branch for branch — this policy never re-states who is in a chat).
DROP POLICY IF EXISTS chat_file_removals_read ON public.chat_file_removals;
CREATE POLICY chat_file_removals_read
  ON public.chat_file_removals FOR SELECT
  TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    OR (for_everyone AND EXISTS (SELECT 1 FROM public.chat_messages m WHERE m.message_id = chat_file_removals.message_id))
  );
-- No write policy and no write grant: remove_my_chat_file() is the only writer.
REVOKE ALL ON public.chat_file_removals FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.chat_file_removals TO authenticated;
COMMENT ON TABLE public.chat_file_removals IS
  'A chat file its sender removed (DECISION_LOG 2026-11-13 "CHAT FILE: UNDO RING…" + "CHAT FILE UNDO DRAWING APPROVED"): for_everyone = Delete for everyone (both sides draw "… removed a file · time"; the attachment columns are already cleared); FALSE = Delete for me (hidden for user_id only; the other person and Setnayan keep the file). Written only by remove_my_chat_file(). Migration 20271341904583.';

-- ── §2 · a booking file — the keeping rule, in one place ────────────────────
-- The shipped keeping rule (`lib/chat-file-rules.ts` CHAT_KEPT_FOREVER_COLUMNS + the sweep's proof/contract read),
-- plus a filing to a decision or to "This booking", plus the order legal hold (`purge_expired_chat`: an event with an
-- order). A dispute always names an order (vendor_disputes → orders), so the order arm covers it.
CREATE OR REPLACE FUNCTION public.chat_message_is_booking_file(p_message_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM public.chat_messages m
      LEFT JOIN public.chat_threads t ON t.thread_id = m.thread_id
     WHERE m.message_id = p_message_id
       AND (
            m.proposal_id IS NOT NULL
         OR m.appointment_id IS NOT NULL
         OR m.amendment_id IS NOT NULL
         OR m.offered_service_id IS NOT NULL
         OR EXISTS (SELECT 1 FROM public.chat_decision_messages dm WHERE dm.message_id = m.message_id)
         OR EXISTS (SELECT 1 FROM public.event_supplier_files f WHERE f.chat_message_id = m.message_id AND f.grp = 'booking')
         OR (m.attachment_r2_key IS NOT NULL AND (
                EXISTS (SELECT 1 FROM public.event_vendor_payments p WHERE p.proof_r2_key = m.attachment_r2_key)
             OR EXISTS (SELECT 1 FROM public.vendor_contracts c WHERE c.file_url = m.attachment_r2_key)))
         OR EXISTS (SELECT 1 FROM public.orders o WHERE o.event_id = COALESCE(t.event_id, m.event_id))
       )
  );
$$;
-- Internal: only the two functions below call it.
REVOKE ALL ON FUNCTION public.chat_message_is_booking_file(UUID) FROM PUBLIC, anon, authenticated;
COMMENT ON FUNCTION public.chat_message_is_booking_file(UUID) IS
  'TRUE when a chat message''s file is part of the booking: pinned to a decision (quote · meeting · adjustment · service card, or filed under a decision topic), filed to "This booking", named by a payment proof or a contract, or in a chat whose event has an order (the legal hold; a dispute always names an order). Such a file never gets Delete for everyone or the undo ring''s instant delete. Migration 20271341904583.';

-- ── §3 · what the sheet may offer — read before it opens ────────────────────
CREATE OR REPLACE FUNCTION public.chat_file_removal_options(p_message_id UUID)
RETURNS TABLE (is_booking BOOLEAN, sent_seconds_ago INTEGER)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_msg public.chat_messages%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'chat_file_removal_options: NOT_SIGNED_IN' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_msg FROM public.chat_messages m WHERE m.message_id = p_message_id;
  IF v_msg.message_id IS NULL
     OR v_msg.sender_user_id IS DISTINCT FROM v_uid
     OR NOT (
       v_msg.thread_id IN (SELECT public.current_thread_ids())
       OR v_msg.vendor_profile_id IN (SELECT public.current_vendor_profile_ids())
     ) THEN
    RAISE EXCEPTION 'chat_file_removal_options: NOT_YOURS' USING ERRCODE = '42501';
  END IF;
  is_booking := public.chat_message_is_booking_file(p_message_id);
  -- The SERVER's clock: the sheet's "N min left" never trusts the phone's.
  sent_seconds_ago := GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (NOW() - v_msg.created_at))))::INTEGER;
  RETURN NEXT;
END;
$$;
REVOKE ALL ON FUNCTION public.chat_file_removal_options(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.chat_file_removal_options(UUID) TO authenticated;
COMMENT ON FUNCTION public.chat_file_removal_options(UUID) IS
  'For the sender of a chat file only (NOT_YOURS otherwise): is it a booking file, and how many seconds ago was it sent by the server''s clock — what the swipe''s sheet may offer (Delete for everyone only within 5 minutes, never on a booking file). Changes nothing. Migration 20271341904583.';

-- ── §4 · the one writer ─────────────────────────────────────────────────────
-- An earlier draft of this PR had a one-argument version; it never reached main.
DROP FUNCTION IF EXISTS public.remove_my_chat_file(UUID);

CREATE OR REPLACE FUNCTION public.remove_my_chat_file(p_message_id UUID, p_mode TEXT)
RETURNS TABLE (outcome TEXT, thread_id UUID, stored_ref TEXT, removed_at TIMESTAMPTZ)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_msg public.chat_messages%ROWTYPE;
  v_age INTERVAL;
  v_has_words BOOLEAN;
  v_now TIMESTAMPTZ := NOW();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'remove_my_chat_file: NOT_SIGNED_IN' USING ERRCODE = '42501';
  END IF;
  IF p_mode IS NULL OR p_mode NOT IN ('undo', 'everyone', 'me') THEN
    RAISE EXCEPTION 'remove_my_chat_file: BAD_MODE — undo · everyone · me' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO v_msg FROM public.chat_messages m WHERE m.message_id = p_message_id FOR UPDATE;
  -- Not found, not yours and not readable all answer the same — it never confirms someone else's file exists.
  IF v_msg.message_id IS NULL
     OR v_msg.sender_user_id IS DISTINCT FROM v_uid
     OR NOT (
       v_msg.thread_id IN (SELECT public.current_thread_ids())
       OR v_msg.vendor_profile_id IN (SELECT public.current_vendor_profile_ids())
     ) THEN
    RAISE EXCEPTION 'remove_my_chat_file: NOT_YOURS' USING ERRCODE = '42501';
  END IF;
  IF v_msg.attachment_r2_key IS NULL AND v_msg.attachment_url IS NULL THEN
    RAISE EXCEPTION 'remove_my_chat_file: NO_FILE — only a file is removed this way' USING ERRCODE = '22023';
  END IF;

  thread_id := v_msg.thread_id;
  removed_at := v_now;

  -- Delete for me: hidden for the caller only. Nothing else changes, nothing leaves storage.
  IF p_mode = 'me' THEN
    INSERT INTO public.chat_file_removals (message_id, user_id, thread_id, for_everyone, removed_at)
    VALUES (v_msg.message_id, v_uid, v_msg.thread_id, FALSE, v_now)
    ON CONFLICT (message_id, user_id) DO NOTHING;
    outcome := 'hidden_for_me';
    stored_ref := NULL;
    RETURN NEXT;
    RETURN;
  END IF;

  -- A booking file stays for everyone — the ring and the red choice alike.
  IF public.chat_message_is_booking_file(v_msg.message_id) THEN
    RAISE EXCEPTION 'remove_my_chat_file: BOOKING_FILE — this file is part of the booking, so it stays for everyone'
      USING ERRCODE = '42501';
  END IF;

  v_age := v_now - v_msg.created_at;
  IF p_mode = 'undo' AND v_age > INTERVAL '15 seconds' THEN
    RAISE EXCEPTION 'remove_my_chat_file: WINDOW_CLOSED — undo is open for 10 seconds after sending' USING ERRCODE = '22023';
  END IF;
  IF p_mode = 'everyone' AND v_age > INTERVAL '5 minutes 30 seconds' THEN
    RAISE EXCEPTION 'remove_my_chat_file: WINDOW_CLOSED — delete for everyone is open for 5 minutes after sending' USING ERRCODE = '22023';
  END IF;

  stored_ref := COALESCE(v_msg.attachment_r2_key, v_msg.attachment_url);
  v_has_words := btrim(COALESCE(v_msg.body, '')) <> '';

  IF p_mode = 'undo' AND NOT v_has_words THEN
    -- Undo, nothing said with it: gone for both, no line.
    DELETE FROM public.chat_messages m WHERE m.message_id = v_msg.message_id;
    outcome := 'deleted';
    RETURN NEXT;
    RETURN;
  END IF;

  -- The words stay; only the file goes.
  UPDATE public.chat_messages m
     SET attachment_r2_key = NULL,
         attachment_url = NULL,
         attachment_name = NULL,
         attachment_mime = NULL,
         attachment_size_bytes = NULL
   WHERE m.message_id = v_msg.message_id;

  IF p_mode = 'everyone' THEN
    INSERT INTO public.chat_file_removals (message_id, user_id, thread_id, for_everyone, removed_at)
    VALUES (v_msg.message_id, v_uid, v_msg.thread_id, TRUE, v_now)
    ON CONFLICT (message_id, user_id) DO UPDATE SET for_everyone = TRUE, removed_at = EXCLUDED.removed_at;
    outcome := 'removed_for_everyone';
  ELSE
    outcome := 'file_removed';
  END IF;
  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.remove_my_chat_file(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.remove_my_chat_file(UUID, TEXT) TO authenticated;
COMMENT ON FUNCTION public.remove_my_chat_file(UUID, TEXT) IS
  'Removing your OWN file in a chat (DECISION_LOG 2026-11-13 "CHAT FILE: UNDO RING…" + "CHAT FILE UNDO DRAWING APPROVED"). undo (≤10 s +5 s grace): no words → the row is deleted, words → only the file goes, no line. everyone (≤5 min +30 s grace): the file goes, the words stay, a chat_file_removals row draws "… removed a file". me: hidden for the caller only. A booking file refuses undo and everyone (BOOKING_FILE). Refuses NOT_YOURS · NO_FILE · WINDOW_CLOSED · BAD_MODE. Returns the stored ref so the route drops the R2 object (never for me). The only member path that changes a message — there is still no DELETE or UPDATE policy. Migration 20271341904583.';

COMMIT;
