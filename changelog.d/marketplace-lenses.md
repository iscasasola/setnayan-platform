## 2026-07-27 · feat(marketplace): ranking lenses — "Best matches" + "Nearest to your venue" (flag-dark)

Explore Replan §15 (L1 + L2). The bench's segmented control learns the difference
between a **recommendation** and a **sort**.

- `lib/compat-score.ts` — SIGNATURE change only, the maths is untouched.
  `computeCompatScore(input, weights = COMPAT_WEIGHTS)` and
  `topCompatDimension(input, weights = COMPAT_WEIGHTS)` now accept a weight
  vector. `COMPAT_WEIGHTS` is byte-identical, so `category-search.ts`,
  `build-3state-actions.ts`, `plan-budget-accordion.tsx`, `app/tour/vendors` and
  `vendor-autoreply` — none of which passes a vector — keep their exact current
  output. A regression test pins the constant's values digit-for-digit.
- `lib/ranking-lenses.ts` (new) — the lens registry. A lens is a NAMED WEIGHT
  VECTOR handed to the one scorer, never a second scorer and never a bespoke
  comparator. **Best matches** = `COMPAT_WEIGHTS`. **Nearest to your venue**
  raises `distance` to 0.45 and rebalances the other six down. Every vector sums
  to 1.000, asserted per-member in CI.
- **Exactly two lenses ship**; the other three are neither built nor stubbed, and
  a test asserts the registry holds only the two. PR #3839 landed their honest
  *inputs* in parallel — that does not unblock the lenses themselves:
  - "Fits your budget" — `priceFitScore` returns a flat 1.0 for every in-budget
    vendor, so the field ties and the data cannot rank value.
  - "New here" — #3839 landed the anchor (`firstVerifiedAt`, from the
    append-only `vendor_tier_history`), but there is still no `freshness`
    DIMENSION in `COMPAT_WEIGHTS` to give it weight; standing one up is owner
    decision §15.9-1.
  - "In demand right now" — ⛔ #3839 re-sourced the count to inquiry-backed
    threads and floored it at n≥3, fixing the *input*; the lens stays blocked on
    the owner's min-N ruling and the absent cross-couple capacity read.
    `demandPressure` therefore stays at weight **0 in every vector here**, with
    a dedicated test asserting it — a non-zero weight would ship the blocked
    behaviour without ever adding a chip for it.
- `lib/bench-sort.ts` — `BENCH_LENSES` + `BENCH_PLAIN_SORTS` render as two
  visually separate groups. "Lowest price" and "Top rated" stay PLAIN SORTS: a
  user job, no scorer, no reason pill.
- **Explainability**, per card, mandatory: the pill names the top-contributing
  dimension measured as `weight × (sub − NEUTRAL)` — the LIFT above neutral, not
  `weight × sub`. Under the naive form an all-unknown vendor always "wins" on
  refinement and every blank card would falsely claim "Matches your style"; under
  the lift form it renders no pill at all. Superlatives ("Closest to your venue")
  only for the actual category leader on that dimension; everyone else gets the
  measured number ("6.3 km from your venue"), and a vendor scoring *below*
  neutral on distance gets nothing rather than a penalty dressed as a feature.
- **Visibility gate (§15.2):** "Nearest" needs ≥3 candidates with ≥2 measurable
  distances. Below that the chip renders DISABLED carrying "Add your venue to
  sort by distance." — a sort that silently no-ops is worse than no sort.
- **Sort persistence (§13.3):** the chosen lens now survives a reload/tab-away,
  in `localStorage` keyed per event (`sn.bench.sort.<eventId>`). Read once on
  mount, never during render, so there is no hydration mismatch; storage is
  client-writable and therefore treated as untrusted (an unrecognised value
  falls back to the default rather than resurrecting a mode the code no longer
  implements). A stored "Nearest" that meets an unsupported bench is neutralised
  at render (`activeSort`), not at read — so the control and the visible order
  can never disagree, and the couple's preference returns on its own once their
  venue anchor exists again.
- ⚠ **Deliberate divergence from §15.1:** `travelRadiusKm` KEEPS being passed at
  the bench call sites. §15.1 asks for tier-blind distance; the owner ruled
  2026-07-27 that a bigger tier means wider reach, and the owner ruling
  supersedes the spec. Noted in a comment at the call site.

All user-visible behaviour is behind `isExploreReplanEnabled()` (default OFF).
Flag OFF renders the pre-lens `BENCH_SORTS` trio with the pre-lens handler and
`'fit'` resolves to `COMPAT_WEIGHTS`, so production is unchanged.

SPEC IMPACT: `Explore_Replan_BUILD_SPEC_2026-07-27.md` §15 — L1 + L2 land; §15.1's
tier-blind-distance rule is superseded by the owner's 2026-07-27 wider-reach
ruling; the three owner-blocked lenses (§15.1 "Fits your budget" / "New here",
§15.3 "In demand") remain unbuilt and their blockers unchanged.
