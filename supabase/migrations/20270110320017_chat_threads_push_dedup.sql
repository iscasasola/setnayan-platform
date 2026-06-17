-- Add push notification dedup column to chat_threads.
--
-- Prevents flooding vendors with repeated pushes for rapid-fire messages
-- within the same thread. The application enforces a 10-minute dedup window:
-- a push is only sent if (now() - last_push_notified_at) > interval '10 minutes'
-- OR last_push_notified_at IS NULL.

ALTER TABLE public.chat_threads
  ADD COLUMN IF NOT EXISTS last_push_notified_at timestamptz;

COMMENT ON COLUMN public.chat_threads.last_push_notified_at
  IS 'Timestamp of the last push notification sent for this thread. Used to enforce a 10-minute dedup window so rapid-fire messages do not flood the vendor.';
