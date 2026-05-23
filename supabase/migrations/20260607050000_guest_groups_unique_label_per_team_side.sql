-- ============================================================================
-- 20260607050000_guest_groups_unique_label_per_team_side.sql
--
-- Owner reported 2026-05-23 PM: "i tried making katropa Group team bride
-- since i have katropa team groom. it said a group with that name
-- already exists."
--
-- The 2026-06-04 guest_groups migration locked uniqueness at
-- (event_id, lower(label)) — case-insensitive label per event. But
-- Filipino weddings legitimately have the same group name on both
-- sides (e.g. "Katropa · Team Bride" + "Katropa · Team Groom" — same
-- circle of friends split by which spouse they're with). The label is
-- shared by intent.
--
-- Fix: widen the uniqueness key to (event_id, lower(label), team_side)
-- so the same label CAN exist twice per event as long as one is
-- bride-side and the other groom-side (or one is `both` and the others
-- aren't). Same-label + same-team_side still rejects, which is the
-- guardrail that prevents accidental duplicate group creation within
-- a single side.
--
-- Idempotent — DROP IF EXISTS then CREATE IF NOT EXISTS.
-- ============================================================================

BEGIN;

DROP INDEX IF EXISTS public.guest_groups_event_label_idx;

CREATE UNIQUE INDEX IF NOT EXISTS guest_groups_event_label_team_idx
  ON public.guest_groups (event_id, lower(label), team_side);

COMMENT ON INDEX public.guest_groups_event_label_team_idx IS
  'Same-label allowed across team_side (bride/groom/both) per event. Widened from (event_id, lower(label)) on 2026-05-23 PM after owner reported "Katropa · Team Bride" rejected because "Katropa · Team Groom" already existed.';

COMMIT;
