## 2026-08-29 · feat(explore): the marketplace grid orders by the approved ranking lenses

Owner 2026-08-29, asked whether the public marketplace should use the lenses:
***"use the lenses."***

**RULE 0 first: the plan already existed and I had asked a settled question.**
Five ranking lenses were approved 2026-07-27 and ship in `lib/ranking-lenses.ts`.
What I got wrong was *where* — they run on the couple's own shortlist bench, and
the public grid ordered by reviews and rating with no knowledge of budget or
distance at all (the word "budget" appeared **zero** times in 4,588 lines).

**There is still exactly ONE scorer.** `lib/explore-lens.ts` is a *projection*,
not a second scorer: it maps what the grid already knows onto `CompatInputs` and
hands it to `computeCompatScore` under the registry's own weight vectors —
exactly as `benchCompatInputs` does for the bench. Two projections of one scorer
is what §15.0 allows; two scorers is what it forbids. A test asserts the weight
objects are the registry's, by identity.

**It runs last, and relationship depth still wins.** A shop the couple already
knows floats above the lens order, as it does under every other sort here — the
lens decides the order *within* a depth, never whether somebody's own supplier
can be pushed down the page.

### Three rules built in, not caveated

- **A stranger sees no change.** No event → every driving input null → every lens
  hides itself → today's ordering, and the chip strip does not render at all.
  Same on production now: one live shop, so only "Best matches" is offerable.
- **"Fits your budget" needs a category.** The couple's budget is split per
  benchmark leaf, so a starting price can only be compared with the budget for
  *its* category. Passed only when a category filter is on; otherwise null, and
  the lens hides itself rather than ordering by a meaningless number. The
  canonical→leaf mapping is a **reverse index of the existing
  `LEAF_CANONICAL_SERVICES`**, never a second hand-typed table.
- ⛔ **"In demand right now" is NOT offered here.** It is the only signal telling
  a couple about OTHER couples and it has **no per-couple opt-out** —
  `lib/privacy-coverage.ts` records that as the open question for the NPC filing,
  which lodges January 2027. Its DPO approval (`same_date_demand`, active
  2026-07-30) covers the couple's own dashboard; a PUBLIC page is a different
  exposure. The demand count is **not passed to the scorer at all** from this
  surface, so a future weight change cannot switch it on by accident — asserted.

### Not faked

**"New here" needs a shop's first-verification date**, which this page does not
read. Left unresolved so the lens hides itself, rather than substituting
`created_at` — which the 2026-07-27 ruling explicitly REJECTED as the anchor
(row-insert time is the ADMIN's date for seeded profiles).

### Measured

typecheck: **CI is the authority** — local runs exited 144 with an empty log
against 11 concurrent `tsc` processes on this machine, which is neither a pass
nor a failure · lint clean on every touched file · **11,257 unit pass, 0 fail** ·
**6 mutations, each measured by occurrence count before → after, all RED**: the
demand lens offered, a demand count passed to the scorer, the visibility gate
skipped, stable ordering broken, the surface defining its own weights, and an
unmeasured shop penalised instead of neutral.

🪤 **One of those six was GREEN first, and the shape is new.** The tie-stability
test used two **structurally identical** fixtures, and `deepEqual` compares by
value — so `[a, b]` deep-equals `[b, a]` and reversing the tie comparator passed.
**An ordering test on indistinguishable fixtures cannot fail.** Fixed by tagging
them; re-run RED.

SPEC IMPACT: `DECISION_LOG.md` 2026-08-29.
