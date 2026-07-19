-- add notification types
-- ============================================================================
-- 20270129155743_add_notification_types.sql
-- Notification Foundation fix · Phase A (2026-06-19, owner-approved).
--
-- Adds ten new values to public.notification_type so future emit-fix PRs
-- (Phase B) can wire emitNotification() calls at their action sites. Phase A
-- itself does NOT emit any of these new values — it only registers them in the
-- enum + the TS union — so this migration is safe to land independently of any
-- runtime usage (no code path INSERTs a brand-new type until Phase B).
--
-- New values (label/tone/deeplink wired in lib/notifications.ts in the same PR):
--   • vendor_status_change   — vendor verification / account status changed
--   • vendor_payout_update   — vendor payout state advanced (EWT / Form 2307)
--   • dispute_resolved       — an open dispute / force-majeure flag was closed
--   • vendor_review_reply    — vendor replied to a couple's review
--   • schedule_suggestion    — a vendor/coordinator suggested a timeline change
--   • pax_surcharge_changed  — vendor adjusted the pax-based surcharge on a booking
--   • vendor_joined          — an invited vendor claimed their profile
--   • editorial_decision     — editorial / sponsored-content decision landed
--   • showcase_featured      — couple's event was featured in the showcase
--   • guest_claim_rejected   — couple rejected a guest's invite-claim request
--
-- ALTER TYPE … ADD VALUE IF NOT EXISTS is idempotent and re-run safe. ADD VALUE
-- cannot run inside an explicit transaction block, so this migration is
-- intentionally bare (no BEGIN/COMMIT). Matches the pattern in
-- 20260907000000_notification_types_cross_actor_signals.sql and
-- 20260529030000_voucher_system_day3_admin_resubmit.sql.
-- ============================================================================

ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'vendor_status_change';
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'vendor_payout_update';
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'dispute_resolved';
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'vendor_review_reply';
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'schedule_suggestion';
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'pax_surcharge_changed';
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'vendor_joined';
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'editorial_decision';
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'showcase_featured';
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'guest_claim_rejected';

-- Pre-existing enum gap (flagged during Phase A): these three values exist in the
-- TS NotificationType union but were never added to the Postgres enum, so any
-- emit of them (kwento_story_batch DOES fire today) crashes at the DB. Add them.
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'kwento_story_batch';
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'kwento_flash_auto_walled';
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'kwento_assignment_nudge';
