## 2026-09-05 · fix(rail): the three doorway rows leave Studio once an event is open

Owner, hours after they were added: *"do not double the marketplace"* · *"Marketplace will
disappear on studio once we enter an event just like guestlist"* · *"and seat plan"*.

`marketplace` · `guest-list` · `seat-plan` now carry `StudioApp.doorwayOnly`, and
`railToolsSignedIn` drops a doorway row whenever there is an `eventId`.

**The duplication was real, and this repo had already written it down.** Inside an event the
same three destinations are on screen twice: the event's own rail (`EventRailContext` via
`customer-nav-config.ts`) carries **Guests · Marketplace→`/vendors` · Seat plan**, and the shell
adds its Marketplace destination row. `lib/free-tools-rail.ts` trimmed its own brief for exactly
this reason and calls a second copy *"the exact 'same destination, two names' defect … the
Studio/Suite rail once shipped precisely this duplicate and had to be corrected."*

**Gated on the EVENT, not on being signed in** — measured, not assumed. The shell's Marketplace
row is itself gated on `insideEvent` (owner 2026-08-22: *"marketplace is best shown inside an
event, not when they just logged in"*), so with no event open none of the competing rows render
and the doorway row is the only door to the page that explains the tool. A new test pins that
half; the count test cannot see it, because every fixture there has an eventId.

Row counts return to **10 · 9 · 8 · 6** — exactly where they were before the three were added,
which is the strongest evidence the rule is right. The sidebar/Suite parity helper excludes
doorway rows: two of the three have no `ADD_ONS` entry, so the Suite never had an opinion either.

SPEC IMPACT: DECISION_LOG row added (rail structure, 2026-09-05 — supersedes the same-day
"all three as new Studio rows" ruling for the in-event case only).
