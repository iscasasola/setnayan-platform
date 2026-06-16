-- 20261227000000_kwento_flagged_notification_type.sql
-- Alaala Lane 3 · Kwento P1 — adds the `kwento_flagged` value to the
-- notification_type enum (0028) so the couple gets an in-app + email nudge when
-- a guest's Kwento is held by Tier-1 moderation and needs their okay before it
-- can appear on the Live Wall. Clean Kwentos do NOT notify (they surface in the
-- queue / wall console without an email — no spam during a live reception).
--
-- STANDALONE FILE BY REQUIREMENT: `ALTER TYPE … ADD VALUE` cannot run inside an
-- explicit transaction block, so the enum-add lives in its own migration —
-- mirrors 20260517020000_notification_type_force_majeure_filed.sql and the other
-- enum-extension migrations. The value is only USED at runtime (the API route),
-- never in this transaction.

ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'kwento_flagged';
