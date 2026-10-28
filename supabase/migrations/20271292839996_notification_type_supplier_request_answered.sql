-- notification_type_supplier_request_answered
-- ============================================================================
-- ADMIN SUPPLIER SLICE (owner 2026-10-28, DECISION_LOG "ADMIN SUPPLIER SLICE
-- APPROVED — BUILD NOW"). A supplier's name / web-address request and a flagged
-- service-card photo are answered from Admin › Work; the shop is told the answer
-- — and the reason, when it is "Needs a fix" or "Declined" — IN THE APP.
--
-- ⚠ ITS OWN FILE, AND NOTHING ELSE IN IT, ON PURPOSE. notification_type is a
-- Postgres ENUM and Postgres forbids USING a newly-added value in the same
-- transaction that adds it (same shape as
-- 20271262858364_notification_type_schedule_change_requested.sql).
--
-- ⛔ IN-APP ONLY. It is NOT on the email allowlist (lib/notification-emit.ts) —
-- owner rule 2026-10-11: no new emails without his word.
-- ============================================================================

ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'supplier_request_answered';
