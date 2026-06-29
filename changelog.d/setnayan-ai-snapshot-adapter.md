## 2026-06-30 · feat(setnayan-ai): DB→snapshot adapter + weekly-digest surface (engine now fires)

The piece that FEEDS the trigger engine real data + shows the result. The brain
(triggers + restraint + digest, #2421) existed but had no input; this wires it to
real budget data and surfaces the weekly digest. Still dormant behind the flag.

- **`lib/setnayan-ai-snapshot.ts`** (new):
  - Pure mapping helpers `paymentsFromBudget()` + `budgetFromTotals()` (unit-tested)
    that turn `event_vendor_line_items` + `event_vendor_payments` + `budget_builds`
    into the trigger engine's `SnapshotPayment[]` + `SnapshotBudget`.
  - `buildPlanningSnapshot(admin, eventId, eventType)` — assembles a snapshot from
    real data. V1 sources the **money guard floor** (payment-due GRD-01 +
    over-budget GRD-05); the other snapshot fields return EMPTY (no fabricated
    data) and slot in unchanged as those sources mature.
  - `computeUserAiDigest(admin, userId, now)` — aggregates every couple event's
    snapshot through runTriggers → applyRestraint → assembleWeeklyDigest; returns
    the rendered digest + surfaced interventions.
- **`app/dashboard/(account)/setnayan-ai/page.tsx`** — renders a "This week from
  Setnayan AI" block ONLY when the per-user flag is on AND the user is subscribed:
  the interventions as cards, or the calm quiet-week digest line. Dormant
  otherwise → never computed or shown.
- **Tests** — `setnayan-ai-snapshot.test.ts` (6 cases): the budget→snapshot
  mapping (reminders, fully-settled-goes-quiet, over-budget shape, top driver).
  typecheck + lint + entitlement-gate lint clean; CI prod-build gates the page.

End-to-end now: real budget data → snapshot → triggers → restraint → digest →
the account page. The money guard (payments + over-budget) actually fires once
turned on. Other triggers fire as their data sources are added (no engine change).

SPEC IMPACT: None to live behavior — flag-gated, dormant; reads existing budget
tables only, no schema change.
