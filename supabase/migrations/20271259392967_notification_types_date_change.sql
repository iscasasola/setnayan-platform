-- notification_types_date_change
-- ============================================================================
-- THE CLASHING-DATE FLOW'S FOUR NOTICES (owner 2026-10-01, DECISION_LOG "THE
-- CLASHING-DATE FLOW — APPROVED WITH THE CONTROLLER'S THREE SAFEGUARDS"; and
-- 2026-10-02 "Q7 + Q8": a date every booked supplier can do applies with a
-- plain notice).
--
-- ⚠ ITS OWN FILE, AND NOTHING ELSE IN IT, ON PURPOSE. notification_type is a
-- Postgres ENUM and Postgres forbids USING a newly-added value in the same
-- transaction that adds it. So: no BEGIN/COMMIT, no other statements — the
-- exact shape of 20271235690341_notification_type_booking_fee_waived.sql.
--
-- 🔑 A TYPE THE DATABASE HAS NEVER HEARD OF IS REFUSED, NOT THROWN.
-- emitNotification console.errors a refused INSERT by design, so without these
-- labels a supplier would simply never be asked. The other half is
-- `every-notice-type-exists-in-the-database.test.ts`.
--
-- Who hears what:
--   date_change_requested → each booked SUPPLIER whose calendar the new date
--                           clashes with: Move to <date> · Unlock my service.
--   date_change_answered  → the COUPLE, once per answer (and "every supplier
--                           answered — Apply your new date").
--   date_change_closed    → an asked SUPPLIER whose card disappears without
--                           their answer: the couple withdrew the ask, or
--                           released them after 3 days unanswered (this says
--                           which).
--   date_moved            → each booked SUPPLIER, when a new date goes live —
--                           the plain notice "The date moved to <date>", no
--                           decision (Q8).
-- ============================================================================

ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'date_change_requested';
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'date_change_answered';
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'date_change_closed';
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'date_moved';
