-- ============================================================================
-- 20271003612974_vendor_team_roles_financial_secretary.sql
-- Vendor team roles — add FINANCIAL + SECRETARY to public.vendor_team_role,
-- and the vendor_assignment_received notification type.
--
-- Spec: ~/Documents/Claude/Projects/Setnayan/
--         Vendor_Monetization_Model_LOCKED_2026-07-25.md § 7 (Team seats + roles)
--
--   Owner/Admin — everything, incl. billing + settings           (exists)
--   Agent       — own clients + own calendar                     (exists)
--   Financial   — billing / payments / reports, NO client chat    <- NEW
--   Secretary   — scheduling + comms across the whole team        <- NEW
--
-- Roles + agent scheduling are a Pro+ capability. Assigning work to an agent
-- notifies them ("You've been booked for ..."), which needs a notification_type
-- the enum accepts — hence the second ALTER TYPE here.
--
-- ADDITIVE ONLY. No existing row changes: every current membership stays
-- owner/admin/agent/viewer and every predicate over those four is unchanged.
-- The app side is flag-dark behind NEXT_PUBLIC_VENDOR_TEAM_ROLES_V2 (default
-- OFF), so nothing can WRITE either new value until the owner flips the flag —
-- this migration only makes the values expressible.
--
-- WHY A DEDICATED FILE (house pattern, see
-- 20270815640306_creator_notification_type_new_chapter_from_followed.sql):
-- Postgres forbids USING a newly-added enum value in the same transaction that
-- adds it. This file runs ONLY ALTER TYPE statements — no INSERT/UPDATE/CHECK
-- references either new label — so all three values are committed before any
-- later migration or runtime code touches them.
--
-- Idempotent — ADD VALUE IF NOT EXISTS.
-- ============================================================================

-- Vendor team roles (public.vendor_team_role, created 20260514010000).
ALTER TYPE public.vendor_team_role ADD VALUE IF NOT EXISTS 'financial';
ALTER TYPE public.vendor_team_role ADD VALUE IF NOT EXISTS 'secretary';

-- Assignment notification (public.notification_type, created 20260513160000).
-- Emitted by lib/vendor-team-assignment-notify.ts when an admin assigns work to
-- a team member — flag-dark, never fired while the flag is OFF.
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'vendor_assignment_received';
