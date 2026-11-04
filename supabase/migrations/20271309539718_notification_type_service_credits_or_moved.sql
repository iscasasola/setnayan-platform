-- notification_type_service_credits_or_moved
-- ============================================================================
-- THE COUPLE IS TOLD, IN THE APP, WHEN A SERVICE THEY COULD NOT USE BECAME PAPIC
-- CREDITS OR MOVED TO THEIR NEXT EVENT (owner 2026-11-05 "yes to refund";
-- the actions are in 20271309226989_a_service_they_cannot_use_becomes_credits_or_moves.sql).
--
-- ⚠ ITS OWN FILE, AND NOTHING ELSE IN IT, ON PURPOSE. notification_type is a
-- Postgres ENUM and Postgres forbids USING a newly-added value in the same
-- transaction that adds it. Same shape as
-- 20271293446382_notification_type_event_type_added.sql.
--
-- ⛔ IN-APP ONLY. Neither is on the email allowlist (lib/notification-emit.ts) —
-- owner rule 2026-10-11: no new emails without his word.
-- ============================================================================

ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'service_became_credits';
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'service_moved_to_event';
