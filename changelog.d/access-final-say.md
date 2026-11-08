## 2026-11-08 · feat(access): a supplier proposes; a host or the booked coordinator has the final say

Owner rule, 8 Nov 2026, verbatim: *"so each supplier or coordinator can request for access for different parts of the
event. they only see these specific parts and edit it as needed. only coordinator and hosts has the final say. so any
supplier that is not a coordinator still has to request a host or coordinator to accept the change."*

- **One booked-coordinator fact.** `public.is_booked_coordinator(event)` / `is_booked_coordinator_for(event, user)` —
  booked AND `services_make_a_coordinator` (migration `20271329284628`, re-pointed in `20271330396757`); TS mirror
  `isBookedCoordinator` + `bookedSupplierFacts` (`lib/coordinator-trade.ts`). A `wedding_planner_external` SEAT never
  makes anyone the coordinator — the access answer wrote that role for every supplier it let in.
- **A non-coordinator never writes directly, enforced in RLS.** `moderator_area_level` and its `_of` twin cap `edit` to
  `view` on a supplier's seat (booked here, not the coordinator) — every area-gated policy inherits it
  (`20271329978605`). `grantLevelFor(area, { coordinator })`: the coordinator gets Edit (Budget View), everyone else
  "see it and propose changes". The schedule-request recipients no longer tell a capped seat it can approve.
- **More askable parts.** Mood Board and Budget & payments join seat plan · schedule · guest list · suppliers. The ask is
  ONE checkmark dropdown that shows what they hold, the waiting ask (naming who decides) and the last answer.
- **The coordinator answers.** `answer_area_access_request` (SQL) is the one answer path: a host, or the booked
  coordinator for a non-coordinator's ask (`answerable_by_coordinator`, forced by a trigger); never the asker; a
  coordinator shares only parts they hold; a coordinator's own ask is the hosts' alone. The coordinator answers on their
  client page (Details › Waiting on you) with the hosts' own `RequestCard`. In-app notice `access_answered`.
- **Change requests for the guest list, the seat plan and the suppliers.** `event_change_requests` (RLS at CREATE,
  whitelisted payload CHECK) + `answer_event_change_request` (Accept applied in place, atomically). The supplier proposes
  from their client page and sees "Waiting for the host or the coordinator", then the answer (`change_requested` /
  `change_answered`, in-app only). Hosts and the coordinator answer beside the schedule requests. The limited-helper gate
  tells a capped supplier to propose instead of handing back an empty success.
- Guardrails: Ugat joint J66, exposure baseline, RA 10173 export (author-scoped, no guest details) and erasure entries.
  The two access reads moved to `lib/my-area-grants.server.ts` (server-action budget at its ceiling).

SPEC IMPACT: Access model for suppliers changes (owner rule 8 Nov 2026). The spec corpus (`~/Documents/Claude/Projects/
Setnayan/`) is not reachable from this cloud session, so the DECISION_LOG row and the iteration `.md` edit are NOT
applied here — they need the owner's Cowork pass: add a DECISION_LOG row "A SUPPLIER PROPOSES; A HOST OR THE BOOKED
COORDINATOR HAS THE FINAL SAY (2026-11-08)" naming the five rules above, and supersede the 2026-10-30 line "Only the
host and whoever supplier they give access to" for Mood Board EDIT (a non-coordinator supplier now suggests photos).
