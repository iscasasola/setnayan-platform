## 2026-09-22 · fix(overview): "overdue" is measured from the lock-by floor, not the planning aim

The Overview's "Decisions waiting on you" told a couple their coordinator was
**overdue by 278 days** while the Your Team page said **113D OVERDUE** — same
category, same wedding, same couple, 165 days apart. Owner reported it; measured
live on 2026-09-22, event 044f7e64 (wedding 2026-12-18, 87 days out, coordinator
unbooked).

**Neither was a date bug.** `todays-one-thing.ts` measured lateness from
`PLAN_GROUPS.monthsBefore` (12 → 2025-12-18, 278 days ago); the plan/budget model
measured it from `lockLeadDaysFor` (200 → 2026-06-01, 113 days ago). Both
arithmetics were correct about the number they were handed.

🔑 **`monthsBefore` IS AN AIM, AND MISSING AN AIM IS NOT BEING LATE.** Its own
docblock reads "how many months before the wedding date to **aim** to have this
locked", and the coordinator's hint says "Top coordinators book 9-12 months out."
The hard floor — the last day a lock is still realistic — is `lockLeadDaysFor`,
which `vendors-plan-budget.ts` has **exported since 2026-07-27** for the Coverage
Strip. The Overview simply never imported it, and `classify()` called the aim a
"hard-floor lock date" in its own comments.

Not just the coordinator: the aim sits earlier than the floor for 22 of the 26
groups carrying both, so this overstated lateness almost everywhere — venues by
95 days, attire by 78, officiant by 74, cake by 47 — in the one place on the
Overview whose whole job is to say what is most urgent.

- `todays-one-thing.ts` · `classify()` now reads `lockLeadDaysFor(group.id)`.
  `monthsBefore` stays as the **tie-break** for two equally-overdue categories
  ("a venue overdue by 30 days outranks a cake overdue by 30 days") — an aim
  orders things fine, it just cannot say whether you are late.
- `wedding-plan-groups.ts` · `computeTargetDate` / `targetDateStatus` take
  **days** and name the parameter `lockByDays`. Both had exactly one caller.
- **No lead-time value changed, and no table moved.** An earlier draft of this
  fix copied the floor table into a new `lock-by-floor.ts` — which would have
  created a second source of exactly the kind being removed. Reverted on finding
  the existing export.
- `upcoming-items.ts` deliberately **keeps** `monthsBefore` (above the
  admin-managed `planning_deadlines` table — 27 service rows in production). It
  is a forward-looking planning calendar that DROPS deadlines already passed, so
  it never calls anything overdue. An aim belongs there; a floor belongs in the
  warning.

Proof — `lib/one-floor-two-surfaces.test.ts`, 4 tests:

- the hero's own `daysContextual` for the coordinator is **113**, asserted
  through `pickTodaysOneThing` (with `groups` narrowed to the coordinator, since
  the 270-day venue floors would otherwise win the hero slot);
- **the invariant**: for every plan group, both resolvers put the floor on the
  same day — so a surface that starts measuring from the aim again fails here;
- the aim and the floor still differ for ≥15 groups, so a future "tidy-up" that
  conflates the two tables cannot make the first two tests vacuous;
- `lockLeadDaysFor` is total — a group added later gets 90 rather than producing
  "overdue by null days".

⚠ **Sabotage-checked, and the first version of the test FAILED that check.** It
asserted only the two helpers and never read the resolver's output, so it passed
4/4 with the fix reverted. Rewritten to assert `pickTodaysOneThing`, it now goes
red with `actual: 278, expected: 113` — reproducing the exact production defect.

SPEC IMPACT: None. No locked decision changes: the floor values are the
2026-06-01 taxonomy-timeline deep-dive's and are untouched.

**Owner decision, flagged not taken:** the AIM is admin-editable
(`planning_deadlines`), the FLOOR is code-only. Whether the floor should also get
an admin table is a product call.
