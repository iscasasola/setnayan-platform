-- notification_type_deletion_request
-- ============================================================================
-- The four notification types the DELETION handshake needs.
--
-- ⚠ ITS OWN FILE, AND NOTHING ELSE IN IT, ON PURPOSE.
-- `notification_type` is a Postgres ENUM (20260513160000_iteration_0028), and
-- Postgres forbids USING a newly-added enum value in the same transaction that
-- adds it. So: no BEGIN/COMMIT, no other statements. Exact shape of
-- 20271142676882_notification_type_lock_request.sql.
--
-- 🔑 WHY THIS FILE HAD TO EXIST AT ALL — the failure would have been SILENT.
-- The union in `lib/notifications.ts` is TypeScript; the column is an enum. A
-- TS-only member typechecks perfectly and then the INSERT fails at runtime —
-- and `emitNotification` only `console.error`s a failed insert, so the supplier
-- is told nothing and nothing throws. Same family as the phantom column, the
-- phantom enum value and the phantom RPC argument: rejected, not thrown, and
-- the only symptom is an absence.
--
-- Who hears what:
--   deletion_request_received → the SUPPLIER. "A couple wants to remove a
--                               celebration you were paid for." They are owed
--                               the fact and the choice.
--   deletion_request_nudge    → the SUPPLIER, once. Owner 2026-08-21: an
--                               unanswered ask stays open FOREVER with ONE
--                               reminder — never auto-agreed, because that
--                               would manufacture a consent nobody gave.
--   deletion_request_agreed   → the COUPLE. They can remove it now.
--   deletion_request_declined → the COUPLE, carrying the supplier's own words
--                               when they gave any.
--
-- ⚠ ALL FOUR ARE TRANSACTIONAL AND MUST NOT BE MARKETING-GATED. The six
-- lock_request_* types were added to BOTH the email allowlist and the
-- marketing-gated set, which suppressed every one of them for every user
-- (marketing_opt_in is NOT NULL DEFAULT FALSE; prod had 9 users, 0 opted in).
-- Fixed 2026-08-21; `transactional-email-is-not-marketing.test.ts` now fails if
-- a `deletion_request_*` type ever lands in the gated set.
-- ============================================================================

ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'deletion_request_received';
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'deletion_request_nudge';
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'deletion_request_agreed';
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'deletion_request_declined';
