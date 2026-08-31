## 2026-08-31 · feat(papic): the home tile says whether the credits are ENOUGH

"1,240 credits left" meant nothing to anybody who did not already know what a
credit buys. New pure module `lib/papic-credit-estimate.ts` turns the balance
into the answer it was standing in for, and the couple's Home now says
"enough for your event" or "short ~540 credits" under the Papic mini-tile.

⚖ **IT RECOMMENDS ONLY WHEN SHORT** (owner 2026-08-30: *"if they need to add
more … not over not under. if their count is good, then do not recommend."*).
A covered event contributes no decision row and no top-up figure at all — the
`CreditVerdict` union makes over-recommending unrepresentable rather than
merely discouraged. An event with no guest count yet resolves to `unknown` and
says nothing, so a brand-new event is never told it is short of something we
cannot measure.

- `estimateCreditsNeeded(guests, weights, mix)` — guests × (photos + clips) +
  a flat base for the couple's own coverage.
- `papicCreditVerdict(...)` — covered / short / unknown.
- `smallestRungCovering(shortfall, rungCredits)` — the smallest rung that
  clears the gap, for a caller that holds the live ladder.
- Decision-board row ("Top up Papic credits") joins the existing `pay` group
  only on a `short` verdict, deep-linking `/studio/papic?topup=<shortfall>`.

⚠ **EVERY CREDIT WEIGHT IS PASSED IN, NEVER WRITTEN HERE.**
`PAPIC_POINTS_PER_PHOTO` / `PAPIC_POINTS_PER_CLIP` live in one place and the
clip weight has already moved twice by owner call;
`lib/papic-copy-guardrails.test.ts` fails CI on a re-grown literal. Verified
green (103 tests across the four Papic suites).

⚠ **THE RECOMMENDATION IS A GAP, NOT A RUNG — a corrected mistake.** An earlier
cut of this rounded the shortfall up to a fixed 150, which is the Papic **ONE
camera** rung. The shared pool sells on a sixteen-rung `PAPIC_GUEST*` ladder
whose sizes are admin-editable catalog data and are not multiples of anything,
so that would have quoted figures the pool checkout cannot sell. Home states
the shortfall and links out; `PapicPoolCard`, which already reads the ladder,
picks the rung.

⚖ **TWO NUMBERS ARE OWNER-TUNABLE STARTING DEFAULTS, NOT MEASUREMENTS.**
`DEFAULT_CAPTURE_MIX` (6 photos + 1 clip per guest, 150 base credits) is a
first guess in the same spirit as `FAMILY_DISCOUNT_DEFAULT_PCT` — no
production event has yet run to completion with Papic, so there is no
distribution to fit. It errs slightly generous on purpose: a couple told they
are short buys credits they can still spend later, while a couple told they
are covered and then running dry mid-reception loses those photos for good.
Isolated in one frozen object so tuning it is a one-line edit.

Proved by mutation, not just by green: (1) `>=` → `>` on the covered boundary,
(2) over-recommending by a whole extra rung, (3) hardcoding the clip weight —
each turned the suite red, then was reverted.

SPEC IMPACT: None. No pricing, schema or catalog change; the estimate is
display-only and nothing here can charge.
