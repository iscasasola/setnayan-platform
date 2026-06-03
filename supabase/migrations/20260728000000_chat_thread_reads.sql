-- Per-user, per-thread read marker for the Messages unread badge.
-- Chat had no read-state in V1. Additive; RLS enabled at create; a user
-- manages only their own rows. (Helpers current_couple_event_ids/current_vendor_profile_ids
-- live in 20260513040000_fix_rls_infinite_recursion.sql + 20260513130000_iteration_0019_communications.sql.)
--
-- NOTE ON VENDOR HELPER: the task draft referenced current_vendor_ids(), but
-- that helper is a NULL-returning STUB in 20260512000000_setnayan_base.sql
-- (vendor_team_members lands in 0022 and the stub was never repointed). The
-- helper the 0019 chat RLS actually uses for vendor-side thread scoping is
-- current_vendor_profile_ids() (SELECT vendor_profile_id FROM vendor_profiles
-- WHERE user_id = auth.uid()), and chat_threads.vendor_profile_id references
-- vendor_profiles(vendor_profile_id). So the unread function below uses
-- current_vendor_profile_ids() to make the vendor-side count actually work.
CREATE TABLE IF NOT EXISTS public.chat_thread_reads (
  thread_id    UUID NOT NULL REFERENCES public.chat_threads(thread_id) ON DELETE CASCADE,
  user_id      UUID NOT NULL REFERENCES public.users(user_id) ON DELETE CASCADE,
  last_read_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (thread_id, user_id)
);
CREATE INDEX IF NOT EXISTS chat_thread_reads_user_idx ON public.chat_thread_reads(user_id);
ALTER TABLE public.chat_thread_reads ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS chat_thread_reads_self_all ON public.chat_thread_reads;
CREATE POLICY chat_thread_reads_self_all ON public.chat_thread_reads
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Unread-thread count for the current user (auth.uid()) across their threads.
-- A thread is "unread" if it has a message from someone else newer than the
-- user's last_read_at (or they've never read it). SECURITY DEFINER so it can
-- read across the helper-scoped threads; only counts threads the user is in.
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
      AND m.sender_user_id IS DISTINCT FROM auth.uid()
      AND m.created_at > COALESCE(
        (SELECT r.last_read_at FROM public.chat_thread_reads r
         WHERE r.thread_id = t.thread_id AND r.user_id = auth.uid()),
        'epoch'::timestamptz)
  );
$$;

GRANT EXECUTE ON FUNCTION public.count_unread_message_threads() TO authenticated;
