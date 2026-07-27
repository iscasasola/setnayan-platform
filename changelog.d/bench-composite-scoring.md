## 2026-07-27 · fix(bench): "Best fit" now calls the real composite scorer

The couple bench's "Best fit" lens ranked on `fitScore` — three BINARY flags
(reach + budgetFit + dateFit) summing to 0–3. Four possible scores meant most
cards in a category tied and the tie-breaks decided the real order, so "Best
fit" quietly degenerated into "sort by rating". It now calls
`lib/compat-score.ts` `computeCompatScore()`, the seven-dimension weighted
composite already used by category search, the 3-state build actions and the
tour — the bench was the one surface that never called it.

**The live defect this removes (spec §13.4).** `fitScore` scored
`reachesVenue === true ? 1 : 0`, so an UNKNOWN reach LOST a point. FREE-tier
vendors carry `serviceRadiusKm: 0` (`lib/vendor-tier-caps.ts:185`), so
`within_radius` never resolves for them and `reachesVenue` is permanently
`null` — **every free-tier vendor, and every vendor without geocoded
coordinates, was ranked down on every bench, forever, however close they
were.** The reach badge deliberately fails OPEN ("never a false out-of-range");
the sort failed CLOSED. The scorer's `NEUTRAL = 0.6` for any missing input is
exactly the admit-unknown rule the flags violated.

- `lib/compat-score.ts` — additive exports only, no behaviour change:
  `COMPAT_NEUTRAL`, `CompatDimension`, `compatSubScores()` (the per-dimension
  sub-scores `computeCompatScore` itself now consumes, so there is exactly ONE
  implementation) and `topCompatDimension()` (largest weighted lift ABOVE
  neutral; `null` when nothing rose above it).
- `lib/shortlist-taxonomy.ts` — `ShortlistVendor` carries three more scorer
  inputs the vendors page ALREADY computes per candidate (§14.3): `distanceKm`,
  `budgetFitRatio`, `faithMatch`. No new query.
- `lib/bench-sort.ts` — `fitScore` REMOVED (nothing else imported it);
  `benchCompatInputs()` + `benchFitScore()` added. `BenchSort`,
  `BENCH_SORTS`, `SortReason` and the `sortWithReasons()` signature are
  unchanged, so `shortlist-categories.tsx` is untouched.
- Reason pill: names the top-contributing dimension in couple-facing words
  ("Closest to your venue" · "Fits your budget" · "Free on your date" · "Most
  reviewed" · "Matches your style" · "Fits your ceremony" · "Verified"), never a
  bare score or %, and renders NOTHING when every input is neutral. The
  superlative wording is only used by the vendor that actually holds the best
  sub-score for that dimension in its category.
- `lib/bench-sort.test.ts` — rewritten: 16 cases, each §13.4/§14 regression
  stated as the defect it locks out.

**Not passed to the scorer, deliberately:** `refinement` (no style/song signal
on the bench card — omitted → neutral, per §14.3 "no new query") and `boosted`.
`boosted` is documented as `ad_rank > 0` (paid placement); `isSetnayan` is a
different fact (a first-party Setnayan SKU), and wiring it in would float
Setnayan's own services above real vendors inside a lens labeled "Best fit".
§14.4-6 calls that an owner decision, so it stays unset until it is one.

⚠ **Owner-visible:** card order on the Shortlist bench changes. Free-tier and
newly-listed vendors stop being buried; distance and budget now rank
continuously instead of as yes/no. §13.4 finding 2 (the reach threshold is the
VENDOR's tier, not the couple's need) persists inside the scorer's own
radius-scaled decay — that remains an open owner call, not something this PR
settles.

SPEC IMPACT: implements `Explore_Replan_BUILD_SPEC_2026-07-27.md` §14.4 step 1
and fixes the §13.4 finding-1 live defect. §13.4 finding 2 (tier-radius
threshold) and §14.4 steps 4–6 (per-category weights, admin-tunable weights,
the trust/boosted position) remain open.
