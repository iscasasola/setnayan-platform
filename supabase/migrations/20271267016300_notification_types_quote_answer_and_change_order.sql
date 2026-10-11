-- notification_types_quote_answer_and_change_order
-- ============================================================================
-- FOUR NOTICES BETWEEN A COUPLE AND A SUPPLIER THAT HAD NO TYPE OF THEIR OWN
-- (owner 2026-10-10: "what we are building is the connection of the supplier
-- and user on their events").
--
--   quote_accepted / quote_declined
--     → the SUPPLIER. `respond_vendor_proposal` records the couple's answer to
--       a quote and nothing told the supplier: they learned it only by opening
--       the customer card. No existing type says it truthfully —
--       `chat_message` reads "New message", `booking_confirmed` is false by
--       definition (accepting a quote is not booking it).
--
--   change_order_proposed / change_order_answered
--     → whichever side did not act. A change order is a signed
--       `vendor_change_orders.delta_amount_php` on what the couple owes. All
--       four of its notices rode `schedule_suggestion`, the generic schedule
--       register that also carries meeting asks, terms, a handover and schedule
--       answers and is deliberately NOT emailed. Nothing on a notification row
--       tells a change order from those — the allowlist and the reason line are
--       keyed on the TYPE — so a notice that moves money gets its own.
--
-- All four are on the email allowlist (apps/web/lib/notification-emit.ts) and
-- declared in apps/web/lib/couple-supplier-notices.ts.
--
-- ⚠ ITS OWN FILE, AND NOTHING ELSE IN IT, ON PURPOSE. notification_type is a
-- Postgres ENUM and Postgres forbids USING a newly-added value in the same
-- transaction that adds it. Same shape as
-- 20271259392967_notification_types_date_change.sql and
-- 20271262858364_notification_type_schedule_change_requested.sql: bare
-- ADD VALUE IF NOT EXISTS statements, no row written, no function created.
--
-- ⛔ NOT HERE: a type for "the couple removed a supplier who still has a
-- conversation open". What happens to that conversation is an owner ruling that
-- has not been made (see the marker in deleteVendor).
--
-- 🔑 A TYPE THE DATABASE HAS NEVER HEARD OF IS REFUSED, NOT THROWN.
-- `every-notice-type-exists-in-the-database.test.ts` is the other half of it.
-- ============================================================================

ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'quote_accepted';
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'quote_declined';
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'change_order_proposed';
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'change_order_answered';
