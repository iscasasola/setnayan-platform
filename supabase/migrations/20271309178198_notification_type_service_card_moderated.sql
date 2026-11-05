-- notification_type_service_card_moderated
-- ============================================================================
-- The ONE notice a supplier gets when Setnayan changes one of their service
-- cards from the admin supplier page (admin minimum for supplier registration,
-- Sat 7 Nov 2026): a card taken down, a card put back, or a cover / showcase
-- photo removed. The words live in lib/service-card-moderation.ts, where a unit
-- test can read them.
--
-- ⚠ ITS OWN FILE, AND NOTHING ELSE IN IT, ON PURPOSE. notification_type is a
-- Postgres ENUM and Postgres forbids USING a newly added value in the same
-- transaction that adds it. Exact shape of
-- 20271226261855_notification_type_guest_takedown_honored.sql.
--
-- 🔑 IN-APP ONLY. It is deliberately NOT on EMAIL_ENABLED_TYPES (owner brief:
-- "the supplier gets an in-app notice (no new email)"). Low in push-levels.
-- ============================================================================

ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'service_card_moderated';
