## 2026-11-02 · feat(budget): the Budget is its own page, opened from Home — Booked keeps a door to the same page

Owner 2026-11-01 (DECISION_LOG "SCHEDULE AND BUDGET GO TO HOME"): *"Okay place it in home"* — Budget also holds in-app
purchases (`orders`) and manual costs (`event_costs`). Plan `SCHEDULE_CHAPTERS_BUILD_PLAN_2026-11-01.md` §4, Step 3.

- `budget/page.tsx` stops redirecting into Suppliers (`?part=budget`); it renders where it is opened, with its own
  masthead and Share. Nothing re-drawn: the shipped `BudgetScreen` (summary · Booked suppliers · Bought on Setnayan ·
  Your expenses, from the one money resolver) is the page, as before. Where the event has suppliers a supplier row still
  opens the Booked Pay sheet (one plan, one door).
- ONE address: `budgetPageHref(eventId, { pay })` in `lib/pillar-parts.ts` (replaces `yourTeamBudgetHref`). Home's Budget
  widget (tile, Pay faces, summary, "+N more", the failed tile), Booked's Team · Budget · Schedule dropdown, the Booked
  Budget block, Suppliers ⚙ Payments and the plan accordion's Adjust all land on it.
- The old `/vendors?part=budget[&pay=]` address forwards to the Budget page with its `pay`, so bookmarks and old
  notifications still open the named payment. `BookedPartPage` now hosts Schedule only (typed).
- The menu: `/budget` lights Home, no longer Suppliers.
- Guard: `app/dashboard/[eventId]/budget/the-budget-page-is-one-place.test.ts` — the page never redirects elsewhere,
  Home and Booked open the same path, nothing hand-builds `?part=budget`, and orders + event_costs stay groups of the
  one read. Updated pins in `pillar-parts`, `customer-menu`, `booked-is-team-budget-schedule`, `our-services` and the
  Home widget tests. Regenerated `screens.generated.json`, `port-control-baseline.json`, root-map baselines.

SPEC IMPACT: None — implements the 2026-11-01 ruling as planned (a DECISION_LOG "as built" note only).
