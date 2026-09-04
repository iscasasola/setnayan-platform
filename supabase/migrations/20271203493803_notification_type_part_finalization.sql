-- notification_type_part_finalization
-- ============================================================================
-- MB12 · the five notification types the per-part finalization handshake needs.
--
-- ⚠ ITS OWN FILE, AND NOTHING ELSE IN IT, ON PURPOSE.
-- notification_type is a Postgres ENUM (20260513160000_iteration_0028_notifications.sql),
-- and Postgres forbids USING a newly-added enum value in the same transaction
-- that adds it. So: no BEGIN/COMMIT, no other statements. Exact shape of
-- 20271142676882_notification_type_lock_request.sql.
--
-- 🔑 A TYPE THE DATABASE HAS NEVER HEARD OF IS REFUSED, NOT THROWN. Adding the
-- member to the TypeScript union costs one line and typechecks instantly;
-- without the label here the INSERT is rejected, emitNotification console.errors
-- it by design so the action still completes, and the only symptom is a person
-- who is never told. `every-notice-type-exists-in-the-database.test.ts` is what
-- makes that impossible to ship — this file is the other half of it.
--
-- Who hears what:
--   part_finalization_requested → the SUPPLIER. "The couple wants you to agree
--                                 to this part of their design." 48-hour fuse.
--   part_finalization_agreed    → the COUPLE. That part is settled and stops
--                                 following their main colours.
--   part_finalization_declined  → the COUPLE, carrying the supplier's own words.
--   part_reopen_requested       → the SUPPLIER. "The couple would like to change
--                                 a part you already agreed to." Their answer is
--                                 what releases it; silence leaves it frozen.
--   part_reopen_answered        → the COUPLE. Yes (it is theirs to change again)
--                                 or no (it stays as agreed) — one type, because
--                                 the two readings differ only in a sentence the
--                                 emit site already has.
--
-- 🔑 THERE IS NO `part_finalization_expired`. The booking handshake has one
-- because the couple is BLOCKED until somebody answers — an unanswered booking
-- ask means no supplier. An unanswered part ask means the design simply stays
-- editable, which is where it already was; the couple loses nothing and the
-- board says "no answer yet" on its own. A notification announcing that nothing
-- changed is the noise this repo has repeatedly cut.
-- ============================================================================

ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'part_finalization_requested';
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'part_finalization_agreed';
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'part_finalization_declined';
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'part_reopen_requested';
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'part_reopen_answered';
