-- notification_type_card_badge_earned
-- Created via `pnpm migration:new`. Idempotent: ADD VALUE IF NOT EXISTS only. Writes NO data.
-- ============================================================================
-- 🏅 BADGE BUILD J3 — the notice a supplier gets when one of their service cards earns a card badge.
--
-- The value BELONGS TO J0 (20271348804021_notification_types_seal_and_card_badge, its own PR). It is added here
-- too, with IF NOT EXISTS, so J3 does not depend on J0's merge order: whichever lands first makes the value, the
-- second is a no-op. Nothing else here on purpose — Postgres forbids USING a newly added enum value in the same
-- transaction that adds it.
-- 📧 Not on the email allowlist: the owner ruled email for badge_earned only (J0).
-- ============================================================================

ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'card_badge_earned';
