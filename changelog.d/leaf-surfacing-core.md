## 2026-07-08 · feat(checklist): leaf-surfacing re-ranker core (inert)

Adds `lib/leaf-surfacing.ts` — the pure algorithm that gives every service leaf
category a fair, relevance-gated chance to be suggested to a couple, without
spam or pay-to-win. `selectDiverseLeaves()` is a greedy MMR re-ranker:
relevance-first, cross-category diversity (no three-of-a-kind), a bounded/decaying
exposure floor so under-shown leaves aren't buried, and it operates on organic
relevance only (fairness independent of paid promotion). Deterministic → safe to
render server-side.

Grounded in the 2026-07-08 marketplace-discovery research (Airbnb diverse
re-rank · Amazon P-Companion cross-category · amortized exposure fairness).

**Inert on landing** — no importers; PR-4 wraps it with the DB fit-gate +
checklist prompt. Unit-tested (cap, relevance-first, diversity, exposure floor
bounds, determinism, input clamping).

SPEC IMPACT: Implements the core of lane D / §4 of
`02_Specifications/Adaptive_Checklist_Build_Plan_2026-07-08.md`. Corpus current.
