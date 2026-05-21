-- ============================================================================
-- 20260530020000_guest_role_add_bride_groom.sql
--
-- Extends the public.guest_role enum with 'bride' and 'groom' so couples
-- can explicitly mark these two roles on the guest list. The hard-single
-- (one bride + one groom per event) constraint is enforced by partial
-- unique indexes in the followup migration 20260531010000.
--
-- ALTER TYPE … ADD VALUE IF NOT EXISTS is idempotent and each statement
-- runs in its own implicit transaction — same pattern as
-- 20260514012000_notification_type_additions.sql. No explicit BEGIN/COMMIT
-- because subsequent statements in this file would otherwise not see the
-- new values until the outer transaction commits.
-- ============================================================================

ALTER TYPE public.guest_role ADD VALUE IF NOT EXISTS 'bride';
ALTER TYPE public.guest_role ADD VALUE IF NOT EXISTS 'groom';
