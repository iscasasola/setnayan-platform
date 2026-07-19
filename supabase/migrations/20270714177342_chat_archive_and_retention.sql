-- ============================================================================
-- 20270714177342_chat_archive_and_retention.sql
-- Chat archive (Viber-style) + Data Retention Schedule enforcement.
--
-- Corpus: Data_Retention_Schedule_2026-07-11.md (class 1 = chat, 5-yr default;
-- 10-yr legal-hold floor for money/contract records). See also DECISION_LOG
-- 2026-07-11 "Data Retention Schedule drafted".
--
-- Two additive changes, both idempotent:
--   1. chat_thread_reads.archived_at — per-user, per-thread archive marker. A
--      thread is archived-for-this-user when archived_at IS NOT NULL AND
--      archived_at >= chat_threads.updated_at; a newer message (which bumps
--      updated_at via the existing on_chat_message_inserted trigger) auto-
--      un-archives it. Pure UX state — NOTHING is deleted by archiving.
--   2. purge_expired_chat(p_years) — the retention sweep the weekly
--      /api/cron/retention-sweep calls. Hard-deletes whole threads (cascades
--      chat_messages + chat_thread_reads) for events older than p_years,
--      EXCEPT events carrying any orders row (a payment record puts the event
--      under the 10-yr BIR/contract legal-hold floor → its conversation is
--      retained past the 5-yr chat default).
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. Per-user archive marker (reuses the existing per-user thread-state table)
-- ----------------------------------------------------------------------------

ALTER TABLE public.chat_thread_reads
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;

COMMENT ON COLUMN public.chat_thread_reads.archived_at IS
  'Per-user Viber-style archive marker. Archived-for-this-user when archived_at IS NOT NULL AND archived_at >= chat_threads.updated_at; a newer message auto-un-archives. NULL = active. Archiving deletes nothing.';

-- ----------------------------------------------------------------------------
-- 2. Retention purge — Data Retention Schedule 2026-07-11 · class 1 chat
-- ----------------------------------------------------------------------------
--
-- Anchored to events.event_date (falling back to the thread's created_at when
-- the wedding date is unknown/NULL). Skips any event with an orders row — money
-- changed hands (or was ordered), so the conversation is dispute/tax-relevant
-- under the 10-yr floor and must NOT be purged at the 5-yr chat default.
--
-- SECURITY DEFINER + service-role-only (no GRANT to authenticated). Threads
-- cascade-delete chat_messages + chat_thread_reads. Returns the count deleted.

CREATE OR REPLACE FUNCTION public.purge_expired_chat(p_years INT DEFAULT 5)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted INT;
BEGIN
  IF p_years IS NULL OR p_years < 1 THEN
    RAISE EXCEPTION 'purge_expired_chat: p_years must be >= 1 (got %)', p_years;
  END IF;

  WITH del AS (
    DELETE FROM public.chat_threads t
    WHERE COALESCE(
            (SELECT e.event_date::timestamptz
               FROM public.events e
              WHERE e.event_id = t.event_id),
            t.created_at
          ) < (NOW() - make_interval(years => p_years))
      AND NOT EXISTS (
        SELECT 1 FROM public.orders o WHERE o.event_id = t.event_id
      )
    RETURNING t.thread_id
  )
  SELECT COUNT(*)::int INTO v_deleted FROM del;

  RETURN v_deleted;
END;
$$;

REVOKE ALL ON FUNCTION public.purge_expired_chat(INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.purge_expired_chat(INT) TO service_role;

COMMIT;
