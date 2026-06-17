-- ============================================================================
-- 20270110320018_chat_threads_first_reply.sql
--
-- Adds vendor_first_reply_at to chat_threads so avg_response_minutes can be
-- computed accurately in lib/vendor-activity.ts (unblocks the stub at line 331).
--
-- Strategy:
--   1. ALTER TABLE — idempotent ADD COLUMN IF NOT EXISTS
--   2. Backfill — set vendor_first_reply_at = earliest chat_messages.created_at
--      WHERE sender_role = 'vendor' for threads that already have vendor messages.
--      Backfill affects 0 rows on a fresh DB — that's fine.
--   3. Trigger — stamp vendor_first_reply_at on the INSERT of the first vendor
--      message in each thread (NULL → value; subsequent vendor messages are
--      no-ops because of the IS NULL guard).
--
-- Idempotent: safe to run more than once.
-- ============================================================================

BEGIN;

-- -----------------------------------------------------------------------
-- 1. Add vendor_first_reply_at column to chat_threads
-- -----------------------------------------------------------------------
ALTER TABLE public.chat_threads
  ADD COLUMN IF NOT EXISTS vendor_first_reply_at TIMESTAMPTZ;

COMMENT ON COLUMN public.chat_threads.vendor_first_reply_at IS
  'Timestamp of the vendor''s first chat_messages INSERT on this thread. '
  'Stamped by the stamp_vendor_first_reply trigger; never updated once set. '
  'Used to compute avg_response_minutes in vendor_activity_stats.';

-- -----------------------------------------------------------------------
-- 2. Backfill: earliest vendor message per thread (idempotent via IS NULL)
-- -----------------------------------------------------------------------
UPDATE public.chat_threads ct
SET vendor_first_reply_at = (
  SELECT MIN(cm.created_at)
  FROM public.chat_messages cm
  WHERE cm.thread_id = ct.thread_id
    AND cm.sender_role = 'vendor'
)
WHERE ct.vendor_first_reply_at IS NULL;

-- -----------------------------------------------------------------------
-- 3. Trigger: stamp vendor_first_reply_at on first vendor INSERT
-- -----------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.stamp_vendor_first_reply()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only act on vendor-role messages; couple/coordinator messages are ignored.
  IF NEW.sender_role::text = 'vendor' THEN
    UPDATE public.chat_threads
    SET vendor_first_reply_at = NEW.created_at
    WHERE thread_id = NEW.thread_id
      AND vendor_first_reply_at IS NULL;  -- idempotent: only stamp the first time
  END IF;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.stamp_vendor_first_reply() IS
  'After a chat_messages INSERT, stamps chat_threads.vendor_first_reply_at = '
  'NEW.created_at for the first vendor message in the thread. Subsequent vendor '
  'messages are no-ops (IS NULL guard). Shares the same trigger slot as '
  'bump_chat_thread_updated_at (both fire AFTER INSERT on chat_messages).';

-- Drop + recreate so the trigger definition stays current on re-runs.
DROP TRIGGER IF EXISTS on_vendor_first_reply ON public.chat_messages;
CREATE TRIGGER on_vendor_first_reply
  AFTER INSERT ON public.chat_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.stamp_vendor_first_reply();

-- -----------------------------------------------------------------------
-- 4. Index: vendor_profile_id × vendor_first_reply_at (for activity stats query)
-- -----------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS chat_threads_vendor_first_reply_at_idx
  ON public.chat_threads (vendor_profile_id, vendor_first_reply_at)
  WHERE vendor_first_reply_at IS NOT NULL;

COMMIT;
