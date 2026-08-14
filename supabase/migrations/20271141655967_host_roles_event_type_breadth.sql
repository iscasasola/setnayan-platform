-- Event Overview council verdict, Phase 5 (event-type breadth) — host roles.
--
-- The 13 legal `event_moderators.role_subtype` values are, with two exceptions,
-- wedding vocabulary: bride, groom, parent_of_bride, maid_of_honor, best_man,
-- ninong, ninang, wedding_planner_external. Setnayan has 16 active event types.
-- A birthday host adding their sister picked between "Maid of honor" and "Best
-- man"; a corporate organiser was offered "Parent of the bride".
--
-- This widens the CHECK with four generic roles so the other 15 types can
-- describe themselves: celebrant · parent · host · co_host.
--
-- ── WHY THE CONSTRAINT AND THE TYPESCRIPT MOVE TOGETHER ──────────────────────
-- The dropdown does not decide what is legal; this constraint does. Shipping
-- the new roles in `lib/host-roles.ts` alone would have produced an invite the
-- database REJECTS, surfaced to the host as a generic "please try again" —
-- the same shape as the `location_city` correction that was refused by an
-- un-widened CHECK for as long as it existed, with an absence as the only
-- symptom. `apps/web/tests/db/host-roles-check-constraint.db.test.ts` reads
-- this constraint back and fails if it ever disagrees with the TypeScript
-- vocabulary, in EITHER direction.
--
-- ── NOTHING IS REMOVED ───────────────────────────────────────────────────────
-- All 13 original values stay legal and keep their meaning. Production holds 3
-- moderator rows (bride, groom, wedding_planner_external) and every one remains
-- valid, so this is additive and cannot orphan an existing host.

BEGIN;

ALTER TABLE public.event_moderators
  DROP CONSTRAINT IF EXISTS event_moderators_role_subtype_check;

ALTER TABLE public.event_moderators
  ADD CONSTRAINT event_moderators_role_subtype_check
  CHECK (role_subtype = ANY (ARRAY[
    -- the original wedding set — unchanged, order preserved
    'bride'::text,
    'groom'::text,
    'partner1'::text,
    'partner2'::text,
    'parent_of_bride'::text,
    'parent_of_groom'::text,
    'maid_of_honor'::text,
    'best_man'::text,
    'wedding_planner_external'::text,
    'ninong'::text,
    'ninang'::text,
    'family_helper'::text,
    'viewer'::text,
    -- generic roles for the other 15 event types
    'celebrant'::text,
    'parent'::text,
    'host'::text,
    'co_host'::text
  ]));

COMMENT ON COLUMN public.event_moderators.role_subtype IS
  'Host role. 17 legal values: the original 13 wedding roles plus celebrant / '
  'parent / host / co_host for the other 15 event types. WHICH roles an event '
  'type offers is decided in apps/web/lib/host-roles.ts — never widen that list '
  'without widening this constraint in the same PR, or the invite is rejected '
  'here and the host only sees a generic failure.';

COMMIT;
