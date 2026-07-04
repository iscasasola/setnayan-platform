## 2026-07-05 · feat(people): staged Phase-2 connections UI (flag-off)

Wire the shipped `proposeConnection`/`confirmConnection`/`declineConnection` server
actions into a real interface on `/dashboard/people`, behind the OFF
`NEXT_PUBLIC_PEOPLE_CONNECTIONS` flag. When the flag is off (production today) the
page stays the honest "coming soon" preview; when it's on it renders a functional
suggest→confirm flow (add-by-email request · incoming Confirm/Decline · confirmed
list · pending-outgoing list) via a new `_components/connections-panel.tsx` client
component. The page reads the user's `people` person + `person_connections` edges
(RLS-scoped to the participant) and classifies them; connected names degrade to
neutral labels where `people` RLS doesn't yet surface the other person's row.

Nothing crosses the PH-counsel gate: the actions hard-guard on the same flag, so
no relationship data is written in production until the owner flips it. The
cross-person name-visibility RLS decision is deferred to the counsel review
(`03_Strategy/Phase2_Counsel_Review_Brief_2026-07-05.md`).

SPEC IMPACT: None. (Design locked in `03_Strategy/People_Graph_and_Lifelong_Identity_2026-07-04.md`; this only builds the staged UI for it.)
