-- Per-EVENT unread-thread counts for the current couple user — the launcher's
-- "needs a decision now" line needs one number per event, but the shipped
-- `count_unread_message_threads()` (20260728000000_chat_thread_reads.sql)
-- flattens to a SINGLE total across the whole account (all couple events + all
-- vendor profiles combined). This is the grouped, couple-side variant.
--
-- Same unread rule as the flat counter: a thread is unread when it has a message
-- from someone OTHER than the current user, newer than that user's last_read_at
-- (or they've never read it). SECURITY DEFINER so it can read across the
-- helper-scoped threads; scoped to the caller's own couple events only, so it
-- exposes nothing beyond what the flat counter already does. Vendor-side (group
-- by vendor_profile_id) is deliberately NOT included here — the shop cards use a
-- different grouping and can get their own helper if/when needed.
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
        AND m.created_at > COALESCE(
          (SELECT r.last_read_at FROM public.chat_thread_reads r
           WHERE r.thread_id = t.thread_id AND r.user_id = auth.uid()),
          'epoch'::timestamptz)
    )
  GROUP BY t.event_id;
$$;

GRANT EXECUTE ON FUNCTION public.unread_message_threads_by_event() TO authenticated;
