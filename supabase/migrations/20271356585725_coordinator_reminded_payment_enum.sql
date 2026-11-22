-- coordinator_reminded_payment_enum
-- ============================================================================
-- 💸 "REMIND THE HOSTS" — the enum value of its own (owner 2026-11-21, DECISION_LOG
-- "COORDINATOR: DUE PAYMENTS VIEWABLE + 'REMIND THE HOSTS', NOT LOGGABLE":
-- *"the coordinator has the right to remind the hosts that they need to settle
-- something … viewable … but not loggable"*).
--
-- Its own migration because a new enum value cannot be USED in the transaction
-- that adds it; the definer that writes it (`remind_the_hosts_of_a_payment`) is
-- in 20271357113669. In-app only: never on the email allowlist.
--
-- Never applied by hand — the pipeline's `db push --include-all` applies it.
-- ============================================================================

ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'coordinator_reminded_payment';
