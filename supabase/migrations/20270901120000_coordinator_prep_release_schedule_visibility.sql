-- ============================================================================
-- 20270901120000_coordinator_prep_release_schedule_visibility.sql
--
-- Coordinator P1 — "prep-then-release" visibility on the run-of-show.
-- Spec: Coordinator_Role_Feature_Spec_2026-07-18.md § 4 (P1); industry's #1
-- coordinator feature (Aisle Planner prep-then-release).
--
-- A coordinator (event_moderators wedding_planner_external, schedule 'edit')
-- stages schedule blocks PRIVATELY (visibility='coordinator_only'), then
-- RELEASES them so the couple sees them (visibility='couple_visible'). Security
-- boundary: a coordinator_only block is visible ONLY to the coordinator
-- (moderator_read) + the service role — excluded from the couple, the
-- public/guest site, and booked vendors.
--
-- Default 'couple_visible' → every existing + new row is visible, so flag-OFF
-- and pre-authoring behavior is byte-identical. Authoring coordinator_only is
-- gated app-side behind NEXT_PUBLIC_COORDINATOR_PREP_RELEASE_ENABLED (default
-- OFF); with the flag off no row is ever coordinator_only, so the tightened
-- read policies below are inert.
--
-- ⚠ The guest day-of read (`fetchPublicScheduleBlocks`) uses the SERVICE-ROLE
-- admin client, which BYPASSES RLS — so it carries its own (flag-gated)
-- coordinator_only filter in app code; this policy is defense-in-depth for the
-- anon-key path only.
--
-- Additive + idempotent (ADD COLUMN IF NOT EXISTS · DROP/CREATE POLICY).
-- Reversible: drop the two columns + restore the 3 policies without the clause.
-- ============================================================================

BEGIN;

ALTER TABLE public.event_schedule_blocks
  ADD COLUMN IF NOT EXISTS visibility TEXT NOT NULL DEFAULT 'couple_visible'
    CHECK (visibility IN ('coordinator_only', 'couple_visible')),
  ADD COLUMN IF NOT EXISTS released_at TIMESTAMPTZ;

COMMENT ON COLUMN public.event_schedule_blocks.visibility IS
  'Coordinator P1 prep-then-release: coordinator_only = staged, visible ONLY to the coordinator (moderator_read) until released; couple_visible = normal (default). Excluded from couple/public/booked-vendor reads when coordinator_only.';
COMMENT ON COLUMN public.event_schedule_blocks.released_at IS
  'Stamped when a coordinator releases a coordinator_only block to the couple (couple_visible). NULL for rows never staged.';

-- Couple read: released rows only (staged coordinator_only rows are hidden).
DROP POLICY IF EXISTS event_schedule_blocks_couple_read ON public.event_schedule_blocks;
CREATE POLICY event_schedule_blocks_couple_read
  ON public.event_schedule_blocks FOR SELECT
  TO authenticated
  USING (
    event_id IN (SELECT public.current_couple_event_ids())
    AND visibility <> 'coordinator_only'
  );

-- Public/guest (anon) read: published AND released.
DROP POLICY IF EXISTS event_schedule_blocks_public_read ON public.event_schedule_blocks;
CREATE POLICY event_schedule_blocks_public_read
  ON public.event_schedule_blocks FOR SELECT
  TO anon
  USING (is_public = TRUE AND visibility <> 'coordinator_only');

-- Booked-vendor read: full timeline (locked D2), but not the coordinator's
-- unreleased prep.
DROP POLICY IF EXISTS event_schedule_blocks_booked_vendor_read ON public.event_schedule_blocks;
CREATE POLICY event_schedule_blocks_booked_vendor_read
  ON public.event_schedule_blocks FOR SELECT
  TO authenticated
  USING (
    event_id IN (SELECT public.current_vendor_booked_event_ids())
    AND visibility <> 'coordinator_only'
  );

-- UNCHANGED (noted for the reviewer): event_schedule_blocks_moderator_read
-- (coordinator sees ALL rows incl. own prep — the point of the feature) ·
-- _couple_write · _moderator_write.

COMMIT;
