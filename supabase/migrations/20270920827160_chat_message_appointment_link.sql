-- ============================================================================
-- 20270920827160_chat_message_appointment_link.sql
-- Link a chat message to a schedule/meeting request so an appointment renders
-- as an in-thread card (accept / propose-new-time / decline).
--
-- WHY THIS EXISTS
--   Negotiation auto-reader Phase 1 (owner 2026-07-24: "make negotiations easier
--   to manage — auto-read schedules … accept / revise / reject"). When a message
--   reads as a meeting request and the sender taps "set up this meeting", the
--   create action inserts an event_appointments row (the existing propose→confirm
--   machine, migration 20270713200000) AND posts a chat_messages row that points
--   at it via this FK. The message stream renders that row as an appointment card
--   instead of a plain bubble — the SAME pattern as the existing proposal card
--   (chat_messages.proposal_id, migration 20270225555952).
--
--   Gated behind NEXT_PUBLIC_CHAT_NEGOTIATION_V1 (ships dark). This migration is
--   purely additive — a nullable column + partial index. Existing rows and the
--   text/attachment/proposal paths are untouched.
--
-- IDEMPOTENT. Safe to (re-)apply.
-- ============================================================================

BEGIN;

ALTER TABLE public.chat_messages
  ADD COLUMN IF NOT EXISTS appointment_id UUID
    REFERENCES public.event_appointments(appointment_id) ON DELETE SET NULL;

COMMENT ON COLUMN public.chat_messages.appointment_id IS
  'Set when this message announces a schedule/meeting request — renders as an '
  'in-thread appointment card (accept / propose-new-time / decline) backed by '
  'event_appointments. Mirrors proposal_id. NULL on every other message. Gated '
  'by NEXT_PUBLIC_CHAT_NEGOTIATION_V1.';

-- Partial index — only the handful of appointment-card rows per thread.
CREATE INDEX IF NOT EXISTS chat_messages_appointment_id_idx
  ON public.chat_messages (appointment_id)
  WHERE appointment_id IS NOT NULL;

COMMIT;
