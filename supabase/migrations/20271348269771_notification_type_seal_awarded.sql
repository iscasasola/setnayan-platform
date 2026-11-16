-- notification_type_seal_awarded
-- ============================================================================
-- A SHOP IS TOLD WHEN IT IS GIVEN A SEAL (the badge build, J2 — the seals
-- engine; owner-approved prototypes 15 Nov, DECISION_LOG 7d6c8129).
--
-- The value belongs to J0 (PR #7753 adds it in
-- 20271348804021_notification_types_seal_and_card_badge.sql). It is repeated
-- here, IF NOT EXISTS, so whichever of the two PRs reaches main first, the value
-- exists — and the second file is a no-op. The engine (lib/shop-seals.server.ts)
-- does not send it yet: its sender lands with J0's notification wiring.
--
-- ⚠ ITS OWN FILE, AND NOTHING ELSE IN IT, ON PURPOSE. notification_type is a
-- Postgres ENUM and Postgres forbids USING a newly-added value in the same
-- transaction that adds it (same shape as
-- 20271343761700_notification_type_account_suspension.sql).
--
-- 🛑 NEVER APPLIED BY HAND. The pipeline pushes this file.
-- ============================================================================

ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'seal_awarded';
