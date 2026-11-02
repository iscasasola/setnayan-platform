# worth-planning-holds-no-events

## 2026-08-24 · fix(board): the Worth-planning shelf stops listing celebrations that already exist

Observed live: "Cale & Ice — your wedding" and "Maria & Jose — your wedding" sat
under **Worth planning** with an *Open plan* button while both sat in
**Planning** on the same screen — the shelf contradicting the owner's own
naming ruling (DECISION_LOG 2026-08-21, PR #4678: *Planning holds celebrations
that EXIST and that shelf holds days that do not*). The rows were correct on the
retired /dashboard/year page and came along unchanged when it folded into the
board.

The membership rule now has one definition: `momentIsEventOwnDay` /
`worthPlanningMoments` in `lib/year-moments.ts`, applied by the strip. An
existing event's OWN day (a wedding's date, a recurring event's next
occurrence) never reaches the shelf; derived days (anniversaries, monthsaries)
and no-event days (holidays, the reader's own birthday) stay — dropping them
would quietly delete the owner-directed 2026-07-13 reminder lines from their
only remaining surface. The builder still describes the whole year truthfully;
the SHELF filters.

Guard `worth-planning-holds-no-events.test.ts` feeds one fixture to both
shelves' logic: the Planning events must produce zero shelf rows naming their
own day, and the derived anniversary must SURVIVE (the anti-empty-sweep floor).
A source assertion pins that the strip actually calls the filter. 3 mutations
measured before → after (bypass · passthrough · delete-all), all red.

⏭ Named, not changed: remaining derived-day rows (an anniversary of an existing
wedding) still carry an *Open plan* button that opens the source event —
whether their affordance should instead start planning the anniversary itself
is a small design call, flagged in the session report.

SPEC IMPACT: None.
