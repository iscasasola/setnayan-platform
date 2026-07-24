-- ============================================================================
-- 20270926679942_chat_thread_archive_immutable.sql
--
-- Chat = immutable evidence layer (couple↔vendor). Two changes, both additive
-- and idempotent:
--
--   1. chat_threads.archived_at — THREAD-LEVEL removal marker. Set when a
--      couple "removes" a vendor / withdraws an inquiry (withdrawInquiry,
--      app/dashboard/[eventId]/messages/actions.ts). The thread + all its
--      messages are PRESERVED; the row is merely hidden from the couple's
--      ACTIVE thread list (folded into the collapsible "Archived" section,
--      exactly like a 'displaced' inquiry) and re-openable — re-adding the
--      vendor NULLs archived_at and resumes the same thread (the
--      UNIQUE(event_id, vendor_profile_id) upsert). This is the destructive
--      hard-delete's replacement: the conversation is the dispute/evidence
--      record + the source of the couple-confirmed booking amount, so it must
--      never be destroyed by a user.
--
--      NOTE — distinct from chat_thread_reads.archived_at (migration
--      20270714177342). THAT is a PER-USER, Viber-style, reversible-by-any-new-
--      message archive marker (pure inbox UI state). THIS is a THREAD-level fact
--      ("the couple removed this vendor"), orthogonal to inquiry_status so the
--      pending/accepted lifecycle survives a remove→re-add round-trip.
--
--   2. chat_threads immutability at the RLS layer (defense-in-depth). The
--      canonical write policy `chat_threads_member_write` (20260821000000) is
--      `FOR ALL TO authenticated`, which INCLUDES DELETE — that is what let
--      withdrawInquiry hard-delete a whole thread (cascading chat_messages +
--      chat_thread_reads) straight through PostgREST. We split it into explicit
--      INSERT + UPDATE policies (identical predicate) and DEFINE NO DELETE
--      policy, so DELETE is denied-by-default for every authenticated user —
--      the same append-only posture chat_messages already has (INSERT+SELECT
--      only). The only legitimate thread removers remain the service-role paths
--      that BYPASS RLS: purge_expired_chat() (retention sweep, 20270714177342)
--      and the RA 10173 admin erasure (app/admin/users/actions.ts). This makes
--      "a user can't destroy the conversation" a schema invariant, not just an
--      app-code convention.
--
-- Retention interaction: unchanged. purge_expired_chat() anchors on event age +
-- absence of any orders row; it does not read archived_at, so an archived
-- thread is still purged after the retention window if (and only if) its event
-- is old enough AND carries no payment record. Archive is a visibility/lifecycle
-- marker, never a legal hold.
--
-- Idempotent: ADD COLUMN IF NOT EXISTS / DROP POLICY IF EXISTS + CREATE.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. Thread-level removal marker
-- ----------------------------------------------------------------------------
ALTER TABLE public.chat_threads
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;

COMMENT ON COLUMN public.chat_threads.archived_at IS
  'THREAD-level removal marker (couple removed the vendor / withdrew the inquiry). Non-NULL = folded out of the ACTIVE thread list into "Archived"; the thread + messages are preserved as the dispute/evidence record. Re-adding the vendor NULLs this to resume the same thread. Distinct from chat_thread_reads.archived_at (per-user Viber inbox state). Archive deletes NOTHING and is not a legal hold — retention (purge_expired_chat) ignores it.';

-- Partial index: the active-list read path filters archived_at IS NULL. Tiny N
-- per event/vendor, but the partial index keeps the common "active only" scan
-- index-only as thread volume grows.
CREATE INDEX IF NOT EXISTS chat_threads_active_idx
  ON public.chat_threads(event_id)
  WHERE archived_at IS NULL;

-- ----------------------------------------------------------------------------
-- 2. Immutability: split the FOR ALL write policy → INSERT + UPDATE, no DELETE.
--    Predicate is byte-for-byte the canonical one from 20260821000000
--    (couple OR own-vendor OR assigned-agent). Read policy is untouched.
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS chat_threads_member_write ON public.chat_threads;

-- INSERT — either party opens a thread between themselves. The RESTRICTIVE
-- chat_threads_follow_gate (20260514150000) still ANDs on top of this, so the
-- couple-must-follow gate is preserved.
CREATE POLICY chat_threads_member_insert
  ON public.chat_threads FOR INSERT
  TO authenticated
  WITH CHECK (
    event_id IN (SELECT public.current_couple_event_ids())
    OR vendor_profile_id IN (SELECT public.current_vendor_profile_ids())
    OR (
      vendor_profile_id IN (SELECT public.current_vendor_ids('viewer'))
      AND event_id IN (SELECT public.agent_customer_event_ids())
    )
  );

-- UPDATE — either party edits the thread (accept/decline, pax snapshot, and now
-- archive/unarchive via archived_at). The guard_thread_provenance_columns
-- BEFORE UPDATE trigger (20270820292403) still neutralizes provenance-column
-- forgery; it passes archived_at through untouched.
CREATE POLICY chat_threads_member_update
  ON public.chat_threads FOR UPDATE
  TO authenticated
  USING (
    event_id IN (SELECT public.current_couple_event_ids())
    OR vendor_profile_id IN (SELECT public.current_vendor_profile_ids())
    OR (
      vendor_profile_id IN (SELECT public.current_vendor_ids('viewer'))
      AND event_id IN (SELECT public.agent_customer_event_ids())
    )
  )
  WITH CHECK (
    event_id IN (SELECT public.current_couple_event_ids())
    OR vendor_profile_id IN (SELECT public.current_vendor_profile_ids())
    OR (
      vendor_profile_id IN (SELECT public.current_vendor_ids('viewer'))
      AND event_id IN (SELECT public.agent_customer_event_ids())
    )
  );

-- NO `FOR DELETE` policy → DELETE is denied for authenticated users. A chat
-- thread is an immutable evidence record; only the service-role retention +
-- erasure paths (which bypass RLS) may remove one.

COMMIT;
