-- ============================================================================
-- appointment_notification_types.sql
--
-- Appointments feature (Relationship_Workspace_and_Appointments_2026-07-11.md,
-- build-plan PR 5) — expand the notification_type enum for the two-sided
-- appointment scheduler. A vendor or couple PROPOSES a time; the other side
-- CONFIRMS (or declines). Each transition notifies the counterparty.
--
--   • appointment_proposed  — the other side proposed a tasting/fitting/call;
--                             recipient acts (confirm / propose new time).
--   • appointment_confirmed — the proposal was confirmed; recipient gets the
--                             in-app note + a branded email with the .ics.
--
-- (`appointment_reminder` already exists in the enum — reused by the scheduled
-- reminder email — so it is intentionally not re-added here.)
--
-- ALTER TYPE … ADD VALUE IF NOT EXISTS is idempotent and lives in its OWN
-- migration file (no surrounding transaction, nothing that USES the new value
-- in the same file) so the values are committed before any app code or later
-- migration references them — Postgres forbids using a freshly-added enum
-- value inside the transaction that added it.
-- ============================================================================

ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'appointment_proposed';
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'appointment_confirmed';
