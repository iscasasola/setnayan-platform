-- Per-SHOP unread-thread counts for the current vendor user — the launcher's
-- shop cards previously surfaced only NEW inquiries (inquiry_status='pending'),
-- so an unread reply in an already-accepted conversation showed nothing. This
-- is the vendor-side twin of unread_message_threads_by_event(): same unread rule
-- (a thread with a message from someone else, newer than the user's
-- last_read_at, or never read) but grouped by vendor_profile_id, scoped to the
-- caller's own shops via current_vendor_profile_ids(). SECURITY DEFINER, and
-- exposes nothing the flat count_unread_message_threads() didn't already.
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
        AND m.created_at > COALESCE(
          (SELECT r.last_read_at FROM public.chat_thread_reads r
           WHERE r.thread_id = t.thread_id AND r.user_id = auth.uid()),
          'epoch'::timestamptz)
    )
  GROUP BY t.vendor_profile_id;
$$;

GRANT EXECUTE ON FUNCTION public.unread_message_threads_by_vendor() TO authenticated;
