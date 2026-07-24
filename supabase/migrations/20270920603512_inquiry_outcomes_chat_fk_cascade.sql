-- ============================================================================
-- 20270920603512_inquiry_outcomes_chat_fk_cascade.sql
--
-- Gap audit 2026-07-23 · Batch B2. inquiry_outcomes.chat_thread_id FK was
-- ON DELETE SET NULL, but the row's inquiry_outcomes_has_anchor CHECK requires
-- (vendor_proposal_id IS NOT NULL OR chat_thread_id IS NOT NULL). recordInquiryOutcome
-- ALWAYS inserts with chat_thread_id set and vendor_proposal_id NULL, so when
-- purge_expired_chat(5) deletes an aged chat_threads row, the SET NULL nulls the
-- outcome's ONLY anchor → the CHECK aborts the DELETE → the whole retention
-- sweep fails and no expired chat is ever purged.
--
-- FIX: ON DELETE CASCADE — an inquiry outcome with no inquiry thread has no
-- meaning, so it goes with the thread. purge_expired_chat then converges.
-- Idempotent (DROP CONSTRAINT IF EXISTS + ADD).
-- ============================================================================

BEGIN;

ALTER TABLE public.inquiry_outcomes
  DROP CONSTRAINT IF EXISTS inquiry_outcomes_chat_thread_id_fkey;

ALTER TABLE public.inquiry_outcomes
  ADD CONSTRAINT inquiry_outcomes_chat_thread_id_fkey
  FOREIGN KEY (chat_thread_id) REFERENCES public.chat_threads(thread_id)
  ON DELETE CASCADE;

COMMIT;
