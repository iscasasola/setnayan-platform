## 2026-09-17 · feat(dayof): the requests inbox opens where the coordinator already is

The coordinator's LIVE console carried a "Requests inbox" section whose only
affordance was a link to `/vendor-dashboard/on-the-day`. Reading *"everything
raised today — by the couple, the hosts, or your suppliers"* meant leaving the
fullscreen console mid-wedding and finding the way back.

The component was never missing. It was mounted on one surface and linked to from
the other — a missing MOUNT, invisible to both the usual checks: a capability
search finds `RequestsInbox` and answers "already ships", and nothing renders
wrongly, so there is no false branch to catch.

- the live console now fetches the view server-side, in the same round-trip as
  everything else that panel needs, and draws the inbox in place. First paint
  carries the rows, so a glance never meets a list that is really still loading;
- the link survives, demoted to "Open the full desk" — the desk holds more than
  the inbox, and this panel answers "is there anything I have to deal with", in place.

⚠ **A refused read is no longer an empty inbox.** `getDayRequestsView` resolved a
failed query as `rows: []`, byte-identical to "nothing has been raised today". That
was survivable while the only consumer was `IssuesLog`, which falls back to the
device-local log when anything goes wrong. It stops being survivable the moment the
read feeds a panel a coordinator reads mid-celebration as "no open issues" — and
acts on. The view gains `unreadable` (additive; `active` already separates *gated*
from *empty*, and this separates *unreadable* from *empty* one layer down) and the
panel says what it does not know.

`decideRequestsPanel` is a pure, total function in `lib/day-requests.ts`, and the
ORDER of its branches is the decision: `unreadable` is answered **before** `side`,
because a read that failed cannot be trusted to have established which side you are
on — reversing those two lines turns a failure into "you are not booked here", a
different lie behind the same empty screen.

Guarded by `apps/web/lib/the-inbox-opens-where-the-coordinator-is.test.ts` — the
decision EXERCISED across its whole input space including the both-true fixture that
catches a branch reorder, the mount PARSED. Sabotage-checked five ways, each still
parsing and typechecking, count printed before the colour: branches reordered ·
`unreadable` returning `inbox` · the mount gated on a constant `false` (it stays in
the file, so a mount count alone stays green) · the unreadable branch removed ·
an empty table reported as an unreadable one.

SPEC IMPACT: None.
