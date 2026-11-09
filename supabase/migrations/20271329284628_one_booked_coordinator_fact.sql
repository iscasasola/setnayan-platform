-- one_booked_coordinator_fact
-- ============================================================================
-- 🧭 ONE ANSWER TO "IS THIS PERSON THE BOOKED COORDINATOR OF THIS EVENT?"
-- (owner rule, 8 Nov 2026, verbatim: *"so each supplier or coordinator can
-- request for access for different parts of the event. they only see these
-- specific parts and edit it as needed. only coordinator and hosts has the
-- final say. so any supplier that is not a coordinator still has to request a
-- host or coordinator to accept the change."*)
--
-- "The coordinator" was TWO facts that could disagree:
--
--   1. THE TRADE — the caller's shop (as owner or team member) is BOOKED on the
--      event (`event_vendors.status` in the booked four) AND its services name
--      the coordinator trade (`services_make_a_coordinator`, 20271280303462).
--      That is `current_coordinator_booked_event_ids()`, which the day-of gates
--      (advance_schedule_block, the floor console) already ask.
--   2. THE SEAT — an `event_moderators` row with role_subtype
--      'wedding_planner_external'. That role is written by THREE doors: the
--      couple inviting their planner (hosts/actions.ts `inviteHost`), the
--      claim approval for a coordinator shop (`answer_claim_access_request`),
--      AND the host's answer to ANY booked supplier's area ask
--      (`answerAccessRequest`, which until this build wrote
--      'wedding_planner_external' for the photographer and the caterer too).
--      So the seat cannot mean "coordinator": a caterer granted the seat plan
--      holds the same role_subtype as the couple's planner.
--
-- 🔑 RECONCILED THIS WAY: the TRADE decides WHO the coordinator is; the SEAT
-- only says WHAT the person was handed. `is_booked_coordinator(event)` is the
-- trade fact, and every rule of the 8 Nov build asks it:
--   · a seat held by a booked supplier whose shop is NOT the coordinator trade
--     is a supplier's seat — it can see what it was granted and propose
--     changes, never write (`supplier_proposes_only`, next migration);
--   · a seat held by a person who is NOT a booked supplier on the event (the
--     couple's own planner invited by email, a co-host, a ninong) is the
--     hosts' own delegate — the supplier rule does not touch it;
--   · a booked coordinator writes through their seat's grants exactly as
--     before, and may answer OTHER suppliers' asks (never their own).
--
-- Mirrored in TypeScript by `isBookedCoordinator` (lib/coordinator-trade.ts):
-- booked AND `isCoordinatorTrade(services)`, the same list
-- (`coordinator-trade-is-one-list.test.ts` holds the list to its SQL copy).
-- ============================================================================

CREATE OR REPLACE FUNCTION public.is_booked_coordinator(p_event_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p_event_id IS NOT NULL
     AND (SELECT auth.uid()) IS NOT NULL
     AND p_event_id IN (SELECT public.current_coordinator_booked_event_ids());
$$;

COMMENT ON FUNCTION public.is_booked_coordinator(UUID) IS
  'THE booked-coordinator fact (owner 8 Nov 2026): the caller''s shop (owner or team member) is booked on the event and its services are the coordinator trade (services_make_a_coordinator). A wedding_planner_external SEAT does not make its holder the coordinator — the seat says what they were handed, this says who they are. TS mirror: isBookedCoordinator (lib/coordinator-trade.ts).';

REVOKE ALL ON FUNCTION public.is_booked_coordinator(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_booked_coordinator(UUID) TO authenticated, service_role;
