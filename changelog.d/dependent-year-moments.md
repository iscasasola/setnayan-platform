## 2026-07-12 · feat(family-graph): dependents' milestones on the Year view (Phase 3 · flag-off)

The payoff for the dependent capture: a guardian's children/elders now surface their next milestone (a child's lucky-7th or debut, an elder's 60th) on the Year view — with the right lead-time tier, and nothing auto-created (a milestone is a suggestion until the go-signal tap).

- **`lib/dependent-moments.ts`** — `buildDependentMoments(dependents, today)` (pure): each dependent's next ladder milestone → a `YearMoment` (new `milestone` kind), `eventId: null` (go-signal creates the event). 4 unit tests.
- **`year/page.tsx`** — when `dependentPeopleEnabled()`, fetches the owner's dependents and folds their milestones into the year (sorted with the rest). Gated → zero effect / zero query when off.

Inert in production (flag off). Consumes a child's birthdate only behind the counsel gate.

SPEC IMPACT: master plan Phase-3 — dependent milestones on the Year view (the personalized moments the whole model promised).
