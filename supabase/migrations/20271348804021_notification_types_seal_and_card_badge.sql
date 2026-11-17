-- notification_types_seal_and_card_badge
-- ============================================================================
-- TWO NEW NOTICES FOR THE BADGE BUILD (J0, owner-approved prototypes 15 Nov):
--   · seal_awarded       — a shop is given a seal (No. 1 · Top 10 · Clients'
--                          Choice · Most In-Demand · Verified Partner · Verified);
--   · card_badge_earned  — one of the shop's service cards earns a card badge.
-- Their senders are J2 (seals) and J3 (card badges); this file only makes the
-- values exist so the app can name them (lib/notifications.ts).
--
-- ⚠ ITS OWN FILE, AND NOTHING ELSE IN IT, ON PURPOSE. notification_type is a
-- Postgres ENUM and Postgres forbids USING a newly-added value in the same
-- transaction that adds it (same shape as 20271346425846_notification_type_badge_earned).
-- 📧 Neither goes on the email allowlist here: the owner ruled email for
-- badge_earned only.
-- ============================================================================

ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'seal_awarded';
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'card_badge_earned';
