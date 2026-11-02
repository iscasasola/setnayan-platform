## 2026-09-23 · fix(papic): nothing tells a couple how many credits to buy until we have measured what events use

⚖ Owner, 2026-09-23: *"we will also collect data of how much photo is used for an event and that
will indicate what credits is ideal for that event and that is the recommendation. **until a data
is collected, nothing to recommend.**"*

Second time. On 2026-08-31 he rejected `DEFAULT_CAPTURE_MIX` in one word — *"don't guess"* — and the
decision log records it had been labelled a guess in the code, the changelog **and** the PR body, and
shipping it was still wrong. A number that sizes money is not improved by being annotated.

**Two surfaces go silent** (the public dial is a separate commit so it can be held back):

- `studio/papic/_components/credit-recommendation.tsx` — **deleted.** It rendered "146 guests × 150
  credits = 21,900". Showing the working was its virtue; the 150 had never been measured against a
  finished celebration.
- `_components/event-dashboard.tsx` — the board row, the mini-tile verdict, and
  `papicCreditVerdict` itself. **Both of its answers were guesses**: "short ~N credits" and "enough
  for your event" alike — telling a couple they have enough is the same unmeasured claim pointing
  the other way.

🚨 **The one that mattered most never used the word "recommend".** The verdict pre-filled the
purchase quantity: `href: ${base}/studio/papic?topup=${papicVerdict.shortfall}` — a number nobody
measured, choosing how much money a couple was about to spend. The first inventory of what to cut
was built by grepping the word and was wrong in **both** directions: it caught a "Recommended" badge
on *challenges* and missed this. **Grep the formula's consumers, not its vocabulary.**

**What deliberately stays:** the BALANCE (`HostPoolMeterCard`, `PapicPoolCard` — facts, not
opinions); the ADMIN editor, because `papic_event_pool_config` is where a number is *supposed* to
live and the ruling is "stop showing couples a guess", not "delete the knob"; and the per-guest
allotment a couple sets themselves, which is their instruction rather than our opinion.

**Cascade taken in the same commit**, not left half-done: `lib/papic-credit-estimate.ts` and its test
deleted whole (all four exports orphaned), `recommendedCredits()` cut from `papic-pool-sizing.ts`
with the two tests that asserted its figure. `fetchEventPoolSizing()` is **deliberately kept** and
says why — it reads config and renders nothing, and its inlined `.select()` is the subject of
`papic-pool-sizing-columns-match.test.ts`. Judgement flagged in the source, not hidden.

`the-page-reorders-itself.test.ts` asserted `<CreditRecommendation` because credits-above-coverage
was "only honest while the recommendation recomputes". **Re-pointed, not deleted:** the order is the
owner's own instruction and never rested on the recommendation, so the guard now asserts the top
block still carries a live balance — and that the recommendation has not come back.

New guard `lib/the-recommendation-waits-for-data.test.ts` asserts the **property**: no module turns a
guest count into a quotable figure, no link arrives with the quantity chosen, and — the other
direction — the balance is still rendered, so a future over-cut cannot pass by silencing the facts
too. Sabotage-proved three ways, including restoring the `?topup=` pre-fill specifically.

⚠ **Nothing is granted or revoked retroactively.** Credits already issued belong to whoever holds
them; forgiving or clawing back is a separate decision the owner has not made.

**What brings the recommendation back:** `papic_event_pool_usage.points_used` is the right source,
but it is **censored** — it records what an event was ALLOWED to spend, not what it wanted (an
earlier measurement, to be re-run: ~100,362 credits granted against 1 used). A mean over it reads
near-zero forever and is just a new guess. Whatever returns needs a stated minimum sample and a
stated method.

SPEC IMPACT: `DECISION_LOG.md` — the 2026-09-23 ruling is not yet recorded there, nor is the
`floor_points = 5000` decision from 2026-09-22. Flagged for the corpus holder; not edited from this
branch.
