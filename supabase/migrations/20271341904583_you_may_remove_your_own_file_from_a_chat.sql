-- you_may_remove_your_own_file_from_a_chat
-- Created via `pnpm migration:new`. KEEP THIS MIGRATION IDEMPOTENT (it may be re-applied):
--   • CREATE OR REPLACE FUNCTION …
--
-- ════════════════════════════════════════════════════════════════════════════
-- 👈 YOUR OWN FILE IN A CHAT SWIPES AWAY — DELETED OUTRIGHT (owner, ruling 6076: "swipe-to-remove for your OWN file
-- in chat"; asked 12 Nov 2026 whether to hide it for the legal hold or delete it, the owner answered, verbatim:
-- "delete it outright").
--
-- ⚖ A DELIBERATE, OWNER-SIGNED EXCEPTION to the chat's immutable-evidence posture (migration 20270926679942,
-- `tests/db/chat-immutable-archive.db.test.ts`). That posture is UNCHANGED for everything else: there is still no
-- DELETE or UPDATE policy on chat_messages, so a member still cannot delete or edit a message by any table route,
-- and service-role retention (purge_expired_chat, the order legal-hold floor) is untouched. The one new way out is
-- this SECURITY DEFINER writer, for ONE message, only when ALL of these hold:
--   • the caller is signed in and SENT it (`sender_user_id = auth.uid()`) — never the other side's file, never a
--     system line (system lines have no sender);
--   • it CARRIES A FILE (`attachment_r2_key`, or the legacy `attachment_url`) — words are never removed this way;
--   • the caller can still read it (the member branches of `chat_messages_member_read`, without the read-only agent
--     branch) — a member who left the chat removes nothing.
-- Owner's call, recorded: this applies even where the event has an order (the 10-year hold covers what remains).
--
-- It returns the thread and the stored ref so the caller's route (`app/api/chat/attachment/[messageId]/route.ts`,
-- DELETE) drops the R2 object best-effort. The row is what the read route re-proves, so once it is gone the file is
-- unreachable through the app even if an object lingers.
--
-- What goes with the row (every FK into chat_messages, measured): its hearts and its decision filings CASCADE; a
-- supplier's filed copy under a service (`chat_message_id`) and the other links SET NULL — a filed copy is its own
-- private object and stays the filer's. A payment receipt is never a chat file (payment-proof bucket). The swipe
-- waits out the Undo window before it calls this (`deleteWithUndo`), so Undo needs no restore here.
-- ════════════════════════════════════════════════════════════════════════════

BEGIN;

CREATE OR REPLACE FUNCTION public.remove_my_chat_file(p_message_id UUID)
RETURNS TABLE (thread_id UUID, stored_ref TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_msg public.chat_messages%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'remove_my_chat_file: NOT_SIGNED_IN' USING ERRCODE = '42501';
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

  DELETE FROM public.chat_messages m WHERE m.message_id = p_message_id;

  thread_id := v_msg.thread_id;
  stored_ref := COALESCE(v_msg.attachment_r2_key, v_msg.attachment_url);
  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.remove_my_chat_file(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.remove_my_chat_file(UUID) TO authenticated;
COMMENT ON FUNCTION public.remove_my_chat_file(UUID) IS
  'Swipe-to-remove your OWN file in a chat (ruling 6076; owner 12 Nov 2026: "delete it outright"): deletes one chat_messages row the caller sent that carries a file and that the caller can still read; refuses anything else (NOT_YOURS · NO_FILE). Returns the thread and the stored ref so the route drops the R2 object. Hearts and decision filings cascade. The only member path that removes a message — there is still no DELETE policy. Migration 20271341904583.';

COMMIT;
