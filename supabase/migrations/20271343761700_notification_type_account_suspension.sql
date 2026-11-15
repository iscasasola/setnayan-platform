-- notification_type_account_suspension
-- ============================================================================
-- ADMIN GAINS ACCOUNT SUSPEND (owner 2026-11-13, DECISION_LOG "ADMIN GAINS ACCOUNT
-- SUSPEND + EDITABLE PLAN CONTENTS": "Yes, add both"). The person is told, in words,
-- when their account is put on hold and when the hold is lifted — one in-app notice
-- each (lib/account-suspension.ts writes the words).
--
-- ⚠ ITS OWN FILE, AND NOTHING ELSE IN IT, ON PURPOSE. notification_type is a
-- Postgres ENUM and Postgres forbids USING a newly-added value in the same
-- transaction that adds it (same shape as
-- 20271337043699_notification_type_service_card_shared.sql).
--
-- ⛔ IN-APP ONLY. Neither type is on the email allowlist (lib/notification-emit.ts)
-- — owner rule 2026-10-11: no new emails without his word. The approved drawing
-- says "email + in-app"; the email half is flagged for the owner in the PR.
-- ============================================================================

ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'account_suspended';
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'account_unsuspended';
