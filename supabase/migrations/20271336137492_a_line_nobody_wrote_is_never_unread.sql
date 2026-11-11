-- a_line_nobody_wrote_is_never_unread
-- Created via `pnpm migration:new`. KEEP THIS MIGRATION IDEMPOTENT.
-- ════════════════════════════════════════════════════════════════════════════
-- A LINE NOBODY WROTE IS NEVER UNREAD (chat gaps, owner 8 Nov 2026: "yes build them").
--
-- ── WHAT WAS TRUE BEFORE (measured in this replay) ──────────────────────────
-- The three unread counters asked `m.sender_user_id IS DISTINCT FROM auth.uid()`. A Setnayan line (sender_role
-- 'system' — every payment, booking and member line the chat now records, 20271329937802) and the Auto-Reply
-- Assistant's reply are written by the service role with sender_user_id NULL, and NULL IS DISTINCT FROM anybody. So
-- every system line raised the Messages badge for EVERY party — the supplier who had just confirmed a payment got
-- their own "Payment confirmed" back as an unread message.
--
-- ── THE ONE CHANGE ──────────────────────────────────────────────────────────
--   − m.sender_user_id IS DISTINCT FROM auth.uid()
--   + m.sender_user_id IS NOT NULL AND m.sender_user_id <> auth.uid()
-- in count_unread_message_threads(), unread_message_threads_by_event() and unread_message_threads_by_vendor(). Every
-- other line of each function is its newest definition, byte for byte (count + by_event: 20271330575424; by_vendor:
-- 20271329968207) — who is counted (thread members, coordinators, the shop) and the private-line narrowing are
-- unchanged. The browser's own mirror (`lib/couple-inbox.ts`) and the stream's (`lib/chat-read-live.ts`
-- countsAsUnreadFor) say the same. Held by tests/db/a-line-nobody-wrote-is-never-unread.db.test.ts.
--
-- No table, no policy, no grant. CREATE OR REPLACE keeps each function's existing EXECUTE grants.
-- ════════════════════════════════════════════════════════════════════════════

BEGIN;

CREATE OR REPLACE FUNCTION public.count_unread_message_threads()
RETURNS INTEGER LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT COUNT(*)::int FROM public.chat_threads t
  WHERE (
    t.thread_id IN (SELECT public.current_thread_ids())
    OR t.vendor_profile_id IN (SELECT public.current_vendor_profile_ids())
  )
  AND EXISTS (
    SELECT 1 FROM public.chat_messages m
    WHERE m.thread_id = t.thread_id
      AND m.sender_user_id IS NOT NULL
      AND m.sender_user_id <> (SELECT auth.uid())
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
    AND t.thread_id IN (SELECT public.current_thread_ids())
    AND EXISTS (
      SELECT 1 FROM public.chat_messages m
      WHERE m.thread_id = t.thread_id
        AND m.sender_user_id IS NOT NULL
        AND m.sender_user_id <> auth.uid()
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
        AND m.sender_user_id IS NOT NULL
        AND m.sender_user_id <> auth.uid()
        AND (m.recipient_user_id IS NULL OR m.recipient_user_id = auth.uid())
        AND m.created_at > COALESCE(
          (SELECT r.last_read_at FROM public.chat_thread_reads r
           WHERE r.thread_id = t.thread_id AND r.user_id = auth.uid()),
          'epoch'::timestamptz)
    )
  GROUP BY t.vendor_profile_id;
$$;

COMMIT;
