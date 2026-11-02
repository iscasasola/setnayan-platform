## 2026-09-29 · feat(maker-details): the march's "Leave the other side blank" in place; /find-date lands on Details › Date

Details part 2a follow-up (stacked on #6104), the two items the controller released from its "for the owner" list.

- **"Leave the other side blank"** on a Wedding March line (`launch/_components/details-march.tsx`) — the pair becomes two lines, each with its other side blank, without leaving the Maker (owner's no-link-outs rule). It calls the Guest list's own `unpairGuestAction` with `mode = 'in-place'`: the same `unpair_guest` RPC under the caller's RLS; in place a refusal is thrown (and said beside the line) and success returns for the Maker's one refresh. The Guest list's row form binds only two arguments, so it keeps its redirect. +0 exported server actions (1,212 before and after).
- **`/find-date` redirects** to Details › Date with "Help me choose" open (`?tool=details&item=date&date=help`) for a couple whose event has an Event Hub — the same two facts the Maker's own work area asks. A coordinator or an event type with no Event Hub keeps the page. `DateEditor` and the Date body open on the same mode (`helpFirst`).

SPEC IMPACT: `Setnayan/DECISION_LOG.md` — the part 2a as-built row's deviations (4) and (5) closed.
