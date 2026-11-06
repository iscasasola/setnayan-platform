-- notification_type_event_type_added
-- ============================================================================
-- "CAN'T FIND YOURS? ASK US TO ADD IT" — AND THE PERSON WHO ASKED IS TOLD, IN
-- THE APP, WHEN IT IS ADDED. (owner 2026-10-28, DECISION_LOG "EVENT TYPES MUST
-- BE SPECIFIC — NO GENERIC 'CELEBRATION' / 'OTHER EVENT' FOR NEW EVENTS".)
--
-- ⚠ ITS OWN FILE, AND NOTHING ELSE IN IT, ON PURPOSE. notification_type is a
-- Postgres ENUM and Postgres forbids USING a newly-added value in the same
-- transaction that adds it. Same shape as
-- 20271262858364_notification_type_schedule_change_requested.sql.
--
-- ⛔ IN-APP ONLY. It is NOT on the email allowlist (lib/notification-emit.ts) —
-- owner rule 2026-10-11: no new emails without his word.
-- ============================================================================

ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'event_type_added';
