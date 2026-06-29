## 2026-06-29 · feat(setnayan-ai): trigger engine + weekly-digest assembly (pure, inert)

The "brain" that decides WHICH Setnayan AI templates fire. Pure + deterministic:
a typed planning snapshot + `now` in → the interventions that should surface out.
No I/O, no model, no clock of its own → fully unit-testable + free. The DB→snapshot
adapter (real data) and the surfacing UI are later PRs; this is the decision logic.

- **`lib/setnayan-ai-triggers.ts`** (new):
  - `PlanningSnapshot` input type (payments, statutory, shortlist, price changes,
    contracts, inquiries, budget, date clusters) + `TRIGGER_THRESHOLDS` (the dials
    in one place).
  - 8 pure triggers: payment-due (GRD-01), statutory-deadline (GRD-02, wedding-only),
    price-rise (GRD-03), over-budget (GRD-05), contract-window (GRD-07), vendor-quiet
    (SEC-04), stuck-category → decision/SEC-02 vs discovery/SEC-03, date-convergence
    (SEC-07). `runTriggers()` collects them.
  - `applyRestraint()` — the "earn the interruption" discipline: dedup by key
    (highest priority wins), drop cooled-down keys, sort by priority, optional cap.
  - `assembleWeeklyDigest()` — the SEC-01 receipt: honest quiet-week variant (names
    the soonest horizon item) vs busy-week variant (bulleted what-I-watched + a next
    step). All copy via the deterministic renderTemplate (no LLM).
- **Tests** — `setnayan-ai-triggers.test.ts` (12 cases): every trigger's fire/no-fire
  condition, restraint dedup/cooldown/cap/rank, and digest busy-vs-quiet. typecheck +
  lint + entitlement-gate lint clean.

INERT: nothing calls runTriggers yet, and the per-user gate is off, so no couple sees
output. Wiring the snapshot adapter + surfacing the digest are the next PRs.

SPEC IMPACT: None — pure decision logic, no schema/SKU/pricing/flow change. Realizes
the trigger→restraint→digest design from corpus Setnayan_AI_Template_Library.md.
