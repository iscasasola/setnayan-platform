-- 20271234098872 · drop two superseded couple-planning tables (S37)
--
-- S26's both-ends guard (#5625) ranked both `table-no-writer`. Re-measured
-- 2026-09-18 against origin/main and production:
--
--   event_category_build_state
--     The Lock / Auto / Hidden grid's per-group state. The grid and both of its
--     writers (setCategoryBuildState, resetBuildStates) were deleted 2026-07-29
--     (Explore_Integration_BUILD_SPEC_2026-07-29.md §7). Production held FOUR
--     rows, all on one internal event and all 'auto' — which the solver treats
--     exactly like an absent row, and only an 'excluded' row ever changed what
--     a screen showed. "Not needed" / "✓ Covered" live in
--     event_category_decisions. The app's two reads are removed in this change.
--
--   event_delegates
--     A coordinator/planner delegation table whose writer (an auto-grant
--     trigger) never shipped. Delegation is event_moderators
--     (role_subtype 'wedding_planner_external'), written by autoInviteCoordinator,
--     "Promote your coordinator" and the access-request flow. 0 rows in prod.
--     Its insert policy never checked member_type, and anon held SIUD grants.
--
-- The one thing that still named event_delegates is the event_action_log read
-- policy's second branch. It is recreated below with the member branch
-- UNCHANGED and the delegate branch removed (a branch over a table with no
-- rows admitted nobody). Not CASCADE on the drops: anything else unexpected
-- fails the push loudly.

DROP POLICY IF EXISTS event_action_log_event_members_read ON public.event_action_log;
CREATE POLICY event_action_log_event_members_read
  ON public.event_action_log FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.event_members em
      WHERE em.event_id = event_action_log.event_id
        AND em.user_id = (SELECT user_id FROM public.users WHERE user_id = auth.uid())
    )
  );

DROP TABLE IF EXISTS public.event_delegates;
DROP TABLE IF EXISTS public.event_category_build_state;
