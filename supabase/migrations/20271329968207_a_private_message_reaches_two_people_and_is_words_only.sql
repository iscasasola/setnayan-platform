-- a private message reaches two people and is words only
-- Created via `pnpm migration:new`. KEEP THIS MIGRATION IDEMPOTENT.
-- ════════════════════════════════════════════════════════════════════════════
-- SUPPLIER BUILD 3 · LANE B — owner rulings, DECISION_LOG 🔒 2026-11-09:
--   ⚖ Private messages live INSIDE the shared chat, visible only to the sender
--     and ONE recipient.
--   ⚖ A private message is WORDS ONLY — no attachment, file, photo or card.
--
-- 1 · chat_messages.recipient_user_id — NULL = everyone in the thread.
--     Keyed to public.users(user_id) exactly like sender_user_id, with ONE
--     deliberate difference: ON DELETE CASCADE, not SET NULL. A SET NULL here
--     would turn a private message PUBLIC the moment its recipient's account
--     row is deleted — the paparazzi_seats lesson (20271107090000's note): the
--     state must not live in a column an FK can null. A private line has no
--     reader left once its recipient is gone.
-- 2 · chat_messages_private_is_words_only (CHECK): a row with a recipient
--     carries no card link (proposal · appointment · change order · amendment
--     · offered service), no attachment column, is not a bot reply and is not
--     a 'system' line. Payment / form / decision / booking "cards" have no link
--     column on chat_messages (measured: the 19 columns are listed in the lane
--     report); their lines are written by server paths that never name a
--     recipient, and the system lines of 20271329937802 are 'system' — so the
--     CHECK refuses all of them.
-- 3 · chat_messages_private_is_between_members (BEFORE INSERT trigger, every
--     writer): the recipient must be somebody in this conversation — the
--     event's hosts (event_members couple) or the shop's owner / team — the
--     same "people on this conversation" set chat_pair_is_blocked() uses
--     (20271325581544). A private row needs a sender, and is never to oneself.
--     Fires after chat_messages_derive_sender (same timing, name order), so the
--     sender it checks is the derived one.
-- 4 · READ: chat_messages_private_reaches_two — a RESTRICTIVE SELECT policy
--     (the repo's block-guard shape): a row with a recipient is readable only
--     by its sender, its recipient, and is_admin(). Every permissive branch
--     still applies first; this only narrows.
-- 5 · EVERY OTHER READ PATH, measured in the replay (pg_proc.prosrc ILIKE
--     '%chat_messages%', views, matviews, publications):
--       • count_unread_message_threads · unread_message_threads_by_event ·
--         unread_message_threads_by_vendor — SECURITY DEFINER, so RLS does not
--         reach them: a private row would count as unread for a third member.
--         Re-issued here verbatim plus one predicate.
--       • tg_chat_message_hearts_scope — copies ids from the message; a heart
--         INSERT is already gated by an EXISTS that runs under chat_messages'
--         RLS, so a third member cannot heart what they cannot read. But the
--         hearts READ policy mirrors chat membership, not the message — a
--         recipient's heart would show a third member that a message exists.
--         Closed with a RESTRICTIVE SELECT policy: a heart is readable only
--         when its message is.
--       • tg_chat_messages_card_names_this_conversation · derive_sender ·
--         guard_end_user_write — write-side guards, return nothing.
--       • No view or materialized view reads chat_messages.
--       • supabase_realtime publishes chat_messages: postgres_changes applies
--         the subscriber's RLS per row, so (4) governs it.
--       • chat_messages_notify_webhook posts EVERY new row to /api/notify,
--         which pushes the body to the SHOP's devices (route.ts) — that would
--         put a host-to-host private line on a supplier's lock screen. The
--         trigger now fires for shared rows only; the recipient-only push
--         needs route.ts to learn recipient_user_id (app lane, see report).
-- ════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── 1 · the column ──────────────────────────────────────────────────────────
ALTER TABLE public.chat_messages
  ADD COLUMN IF NOT EXISTS recipient_user_id UUID
    REFERENCES public.users(user_id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS chat_messages_recipient_idx
  ON public.chat_messages (recipient_user_id)
  WHERE recipient_user_id IS NOT NULL;

COMMENT ON COLUMN public.chat_messages.recipient_user_id IS
  'NULL = everyone in the thread. Set = a PRIVATE message, readable only by its sender, this recipient and is_admin() (policy chat_messages_private_reaches_two). Words only (CHECK chat_messages_private_is_words_only); the recipient must be on the conversation (trigger chat_messages_private_is_between_members). ON DELETE CASCADE on purpose — SET NULL would make it public. Owner 2026-11-09, migration 20271329968207.';

-- The browser may NAME a recipient (column INSERT grants since 20271132839561).
GRANT INSERT (recipient_user_id) ON public.chat_messages TO authenticated;

-- ── 2 · words only ──────────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'public.chat_messages'::regclass
       AND conname  = 'chat_messages_private_is_words_only'
  ) THEN
    ALTER TABLE public.chat_messages
      ADD CONSTRAINT chat_messages_private_is_words_only
      CHECK (
        recipient_user_id IS NULL
        OR (
              proposal_id           IS NULL
          AND appointment_id        IS NULL
          AND change_order_id       IS NULL
          AND amendment_id          IS NULL
          AND offered_service_id    IS NULL
          AND attachment_url        IS NULL
          AND attachment_r2_key     IS NULL
          AND attachment_name       IS NULL
          AND attachment_mime       IS NULL
          AND attachment_size_bytes IS NULL
          AND NOT is_bot
          AND sender_role <> 'system'
        )
      );
  END IF;
END $$;

-- ── 3 · between two people on this conversation ─────────────────────────────
CREATE OR REPLACE FUNCTION public.tg_chat_messages_private_is_between_members()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.recipient_user_id IS NULL THEN
    RETURN NEW;
  END IF;
  IF NEW.sender_user_id IS NULL THEN
    RAISE EXCEPTION 'chat_messages: PRIVATE_NEEDS_A_SENDER — a private message is from a person'
      USING ERRCODE = '23514';
  END IF;
  IF NEW.recipient_user_id = NEW.sender_user_id THEN
    RAISE EXCEPTION 'chat_messages: PRIVATE_NOT_TO_SELF — a private message goes to someone else'
      USING ERRCODE = '23514';
  END IF;
  IF NOT (
       EXISTS (SELECT 1 FROM public.event_members em
                WHERE em.event_id = NEW.event_id
                  AND em.user_id = NEW.recipient_user_id
                  AND em.member_type = 'couple')
    OR EXISTS (SELECT 1 FROM public.vendor_profiles vp
                WHERE vp.vendor_profile_id = NEW.vendor_profile_id
                  AND vp.user_id = NEW.recipient_user_id)
    OR EXISTS (SELECT 1 FROM public.vendor_team_members tm
                WHERE tm.vendor_profile_id = NEW.vendor_profile_id
                  AND tm.user_id = NEW.recipient_user_id
                  AND tm.deactivated_at IS NULL)
  ) THEN
    RAISE EXCEPTION 'chat_messages: PRIVATE_NOT_A_MEMBER — a private message goes to someone in this conversation'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.tg_chat_messages_private_is_between_members() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS chat_messages_private_is_between_members ON public.chat_messages;
CREATE TRIGGER chat_messages_private_is_between_members
  BEFORE INSERT ON public.chat_messages
  FOR EACH ROW EXECUTE FUNCTION public.tg_chat_messages_private_is_between_members();

-- ── 4 · read: two people (and admins) ───────────────────────────────────────
DROP POLICY IF EXISTS chat_messages_private_reaches_two ON public.chat_messages;
CREATE POLICY chat_messages_private_reaches_two
  ON public.chat_messages
  AS RESTRICTIVE FOR SELECT TO authenticated
  USING (
    recipient_user_id IS NULL
    OR sender_user_id    = (SELECT auth.uid())
    OR recipient_user_id = (SELECT auth.uid())
    OR (SELECT public.is_admin())
  );

-- A heart is readable only where its message is.
DROP POLICY IF EXISTS chat_message_hearts_follow_the_message ON public.chat_message_hearts;
CREATE POLICY chat_message_hearts_follow_the_message
  ON public.chat_message_hearts
  AS RESTRICTIVE FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.chat_messages m WHERE m.message_id = chat_message_hearts.message_id));

-- ── 5 · the unread counters (SECURITY DEFINER: RLS does not reach them) ─────
-- Verbatim from 20271274849201 / 20270712208395 / 20270712457616 plus ONE
-- predicate: a private row counts only for its recipient (the sender is
-- already excluded by sender_user_id IS DISTINCT FROM the caller).
CREATE OR REPLACE FUNCTION public.count_unread_message_threads()
RETURNS INTEGER LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT COUNT(*)::int FROM public.chat_threads t
  WHERE (
    t.event_id IN (SELECT public.current_couple_event_ids())
    OR t.vendor_profile_id IN (SELECT public.current_vendor_profile_ids())
  )
  AND EXISTS (
    SELECT 1 FROM public.chat_messages m
    WHERE m.thread_id = t.thread_id
      AND m.sender_user_id IS DISTINCT FROM (SELECT auth.uid())
      AND (m.recipient_user_id IS NULL OR m.recipient_user_id = (SELECT auth.uid()))
      AND m.created_at > COALESCE(
        (SELECT r.last_read_at FROM public.chat_thread_reads r
         WHERE r.thread_id = t.thread_id AND r.user_id = (SELECT auth.uid())),
        'epoch'::timestamptz)
  );
$$;

CREATE OR REPLACE FUNCTION public.unread_message_threads_by_event()
RETURNS TABLE(event_id UUID, unread_count INT)
LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT t.event_id, COUNT(*)::int AS unread_count
  FROM public.chat_threads t
  WHERE t.event_id IN (SELECT public.current_couple_event_ids())
    AND EXISTS (
      SELECT 1 FROM public.chat_messages m
      WHERE m.thread_id = t.thread_id
        AND m.sender_user_id IS DISTINCT FROM auth.uid()
        AND (m.recipient_user_id IS NULL OR m.recipient_user_id = auth.uid())
        AND m.created_at > COALESCE(
          (SELECT r.last_read_at FROM public.chat_thread_reads r
           WHERE r.thread_id = t.thread_id AND r.user_id = auth.uid()),
          'epoch'::timestamptz)
    )
  GROUP BY t.event_id;
$$;

CREATE OR REPLACE FUNCTION public.unread_message_threads_by_vendor()
RETURNS TABLE(vendor_profile_id UUID, unread_count INT)
LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT t.vendor_profile_id, COUNT(*)::int AS unread_count
  FROM public.chat_threads t
  WHERE t.vendor_profile_id IN (SELECT public.current_vendor_profile_ids())
    AND EXISTS (
      SELECT 1 FROM public.chat_messages m
      WHERE m.thread_id = t.thread_id
        AND m.sender_user_id IS DISTINCT FROM auth.uid()
        AND (m.recipient_user_id IS NULL OR m.recipient_user_id = auth.uid())
        AND m.created_at > COALESCE(
          (SELECT r.last_read_at FROM public.chat_thread_reads r
           WHERE r.thread_id = t.thread_id AND r.user_id = auth.uid()),
          'epoch'::timestamptz)
    )
  GROUP BY t.vendor_profile_id;
$$;

-- ── 6 · the push webhook: shared rows only ──────────────────────────────────
-- Same function, same timing (AFTER INSERT, row) — tests/db/prod-object-
-- backfill asserts both — with a WHEN so a private row never reaches
-- /api/notify, which would push its words to the whole shop.
DROP TRIGGER IF EXISTS chat_messages_notify_webhook ON public.chat_messages;
CREATE TRIGGER chat_messages_notify_webhook
  AFTER INSERT ON public.chat_messages
  FOR EACH ROW
  WHEN (NEW.recipient_user_id IS NULL)
  EXECUTE FUNCTION public.notify_chat_message_webhook();

COMMIT;
