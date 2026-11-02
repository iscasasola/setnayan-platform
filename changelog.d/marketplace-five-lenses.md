## 2026-07-27 · feat(marketplace): the lens registry and all FIVE ranking lenses — one scorer, five named weight vectors

Completes `Explore_Replan_BUILD_SPEC_2026-07-27.md` §15. PR #3839 landed the honest INPUTS for the three held-back lenses but deliberately shipped no registry ("the three weight vectors and their sort-control chips are NOT here… adding them once the mechanism lands is three registry rows and three chips"). This is that mechanism, plus all five lenses, the sort control, weight-aware explainability, and sort persistence.

Everything user-visible is behind `isExploreReplanEnabled()`. **Flag OFF the bench is byte-identical to production** — same three chips, same labels, same order, same reason pills, same queries.

> ⚠ **The flag stays OFF.** PR #3839 recorded that the §15.4 privacy legs **(b) opt-out** and **(d) DPO sign-off** are NOT built; transparency (a) and the min-N floor (c) are. This PR inherits that gate and does not lift it.

### 1 · The mechanism — a lens is a weight vector, not a second scorer

§15.0 is explicit that §15 adds **no second scorer and no bespoke comparator**. So `computeCompatScore`'s **signature** changed and its **maths did not**:

```ts
computeCompatScore(input, weights = COMPAT_WEIGHTS)
topCompatDimension(input, weights = COMPAT_WEIGHTS)
```

Every pre-existing caller passes one argument — `_actions/category-search.ts`, `build-3state-actions.ts`, `build-3state-fallback-actions.ts`, `vendor-autoreply/auto-accept.ts`, `plan-budget-accordion.tsx`, `app/tour/vendors/page.tsx` — and gets byte-for-byte the number it got before. That equality is **asserted by test**, not merely intended, and `LENSES.fit.weights` **is** `COMPAT_WEIGHTS` (the same object, not a copy) so the two cannot drift.

`COMPAT_WEIGHTS` gains `freshness: 0` alongside the `demandPressure: 0` that #3839 added. A zero weight is inert twice over: it contributes `0 × sub` to the composite, and it yields a lift of exactly 0 in `topCompatDimension`, so a lens-only dimension can never hijack another lens's reason pill.

### 2 · The five vectors (each sums to exactly 1.000, asserted per member)

| Lens | refinement | budgetFit | distance | reviews | dateHeadroom | faithFit | trust | demand | freshness |
|---|---|---|---|---|---|---|---|---|---|
| **Best matches** *(= `COMPAT_WEIGHTS`)* | 0.22 | 0.20 | 0.18 | 0.18 | 0.08 | 0.07 | 0.07 | 0 | 0 |
| **Nearest to your venue** | 0.15 | 0.13 | **0.45** | 0.10 | 0.06 | 0.05 | 0.06 | 0 | 0 |
| **Fits your budget** | 0.18 | **0.40** | 0.13 | 0.12 | 0.05 | 0.06 | 0.06 | 0 | 0 |
| **New here** | 0.22 | 0.16 | 0.14 | **0.06** | 0.05 | 0.06 | 0.06 | 0 | **0.25** |
| **In demand right now** | 0.20 | 0.15 | 0.13 | 0.12 | 0.06 | 0.06 | 0.06 | **0.22** | 0 |

**The second number in "New here" is the lens.** At the global 0.18, a newcomer sitting at the Bayesian prior (~0.6) is out-ranked by every proven rival and the chip returns Best-matches order — a control that changes nothing. Dropping `reviews` to 0.06 is what makes it work, and a test proves it: restore `reviews: 0.18` (taking the difference from freshness, so the vector still sums to 1) and the newcomer immediately loses to the established rival.

### 3 · Honesty guardrails, CI-checkable

**"Fits your budget" may never claim value.** `priceFitScore` returns a **flat 1.0 for every vendor at or under budget**, so a ₱30k and an ₱89k photographer tie *exactly* — the lens ranks distance-from-over-budget, not value. A test asserts the tie, then asserts that "best value" / "cheapest" / "most for your money" / "best price" are all caught by `FORBIDDEN_LENS_COPY`. Permitted: "Fits your {category} budget", "Fits your budget · est.".

**"In demand right now" is inquiry-backed, floored, and exact-date only.** It consumes `countInquiringCouples` (#3839), which discriminates a real inquiry from a mere save by joining on `chat_threads` existence. Below `MIN_DEMAND_COUPLE_COUNT` = 3 **the lens renders nothing at all — the chip is REMOVED, not greyed**, because every honest disabled-state wording either implies a scarcity concept nothing measures or discloses the absence of other couples' activity on this couple's date. Forbidden by test: "Only N left", "booking fast", "almost gone", "lock it in soon", plus "slots left", "selling fast", "last chance", "hurry", "act now". The only shipped phrasing is the measurement: **"3 couples inquired for your date"**.

**"New here" may never imply vetting.** The anchor is the AGE OF A TIMESTAMP. Forbidden: "vetted", "hand-picked", "curated", "endorsed", "rising star". Permitted: "New on Setnayan" / "Newest on Setnayan" — both pure date facts.

The guard is deliberately **not** applied to the two plain sorts, and that is the whole reason they are plain sorts: "Top rated" is an honest description of a comparator the couple asked for, while the same words inside a *recommendation* would be Setnayan vouching for a vendor.

### 4 · Lenses vs plain sorts

`Lowest price` and `Top rated` stay in the control as **plain sorts, visually separated** by a rule — no score, no reason pill. They are a user job, not a recommendation, and "Lowest price" **could not** be a weight vector even if we wanted it to be: `priceFitScore`'s flat 1.0 makes a "cheapest" vector arithmetically impossible.

### 5 · Explainability (§15.6) — weight-aware

Each card names its top-contributing dimension via `topCompatDimension`, measured as `weight × (sub − NEUTRAL)` — the **lift above neutral**. Under a raw `weight × sub` an all-unknown vendor would always "win" on refinement and every card would falsely claim "Matches your style". Now an **all-neutral vendor renders NO pill at all** (tested under every one of the five lenses), and superlatives ("Closest to your venue", "Newest on Setnayan") are used only by the vendor that actually holds the best sub-score in its category.

Passing the lens's own vector is what keeps pill and order honest together: under "New here" a newcomer's pill reads "Newest on Setnayan", and the same vendor under "Best matches" does not claim it.

### 6 · The visibility gate (§15.2)

`show(lens) := candidates ≥ 3 && candidates with a resolved driving input ≥ 2`, measured over every considered vendor on the bench (the control is bench-wide, so a lens offered on one rail and hidden on the next would read as a bug). The gate reads the **same `CompatInputs` the scorer reads**, so it can never disagree with the ranking about what data exists. Unavailable lenses render **disabled with an honest reason** ("Add your venue to sort by distance.") except `demand`, which is removed. Prod today has one unverified `coming_soon` profile and zero services/reviews/stats, so **only "Best matches" shows** — correct behaviour for an empty marketplace, and a test asserts it.

### 7 · Sort persistence (§13.3)

Was `useState<BenchSort>('fit')` and nothing else, so every reload or tab-away snapped the bench back to "Best fit" — §13.3 calls that "arguably a bigger daily annoyance than the missing lens". Now persisted **per event** in `localStorage`, read once on mount (never during render, so SSR hydration is unaffected). A stored lens the current bench can no longer offer is **not restored** but is **not deleted either** — if the venue anchor comes back, so does the lens. Storage access is wrapped: Safari private mode throws, and the sort must still work even if it cannot be remembered.

### 8 · ⚠ Deliberate divergence from §15.1 — `travelRadiusKm` stays

§15.1 rules that `travelRadiusKm` must be `undefined` at every bench call site, on the argument that a tier-derived radius lets a Pro vendor 45 km away out-rank a Verified vendor 25 km away — tier buying rank inside a lens labelled "nearest". **The owner ruled otherwise on 2026-07-27: a bigger tier means genuinely wider reach, so the declared radius stays in the score.** The owner ruling supersedes the spec text. `_actions/category-search.ts` still omits it, so the two surfaces answer "how near?" slightly differently by design; the divergence is documented in a comment at the call site so it is not "fixed" by a later reader.

**SPEC IMPACT:** `Explore_Replan_BUILD_SPEC_2026-07-27.md` §15.1 (tier-blind distance rule superseded by the owner's 2026-07-27 ruling), §15.3 (the "In demand right now — BLOCKED, do not ship" status is superseded: the owner approved it in the honest inquiry-backed form and #3839 landed the inputs), §15.9 decision #1 (freshness anchor — answered by #3839 with `MIN(vendor_tier_history.created_at)`, no new column) and #6 (tier-derived travel radius — answered by the owner ruling above). Logged at the bottom of `DECISION_LOG.md`.
