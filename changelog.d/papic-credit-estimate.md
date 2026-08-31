## 2026-08-31 · feat(papic): the home tile says whether the credits are ENOUGH

"1,240 credits left" meant nothing to anybody who did not already know what a
credit buys. New pure module `lib/papic-credit-estimate.ts` turns the balance
into the answer it was standing in for, and the couple's Home now says
"enough for your event" or "short ~540 credits" under the Papic mini-tile.

🔑 **IT INVENTS NO NUMBER** (owner 2026-08-31, verbatim: *"don't guess"*).
What an event needs is the OWNER-CONFIGURED pool formula that has shipped since
migration 20270826385580:

    papic_event_pool_config: clamp(guests × points_per_guest, floor, ceiling)

All three fields are admin-editable without a deploy and PRICING-RELEVANT by
that table's own comment. `estimateCreditsNeeded` delegates to
`computeEventPool` — the pure, unit-tested implementation the SQL function
`papic_event_pool_status` mirrors — so the figure a couple is shown is the same
figure the capture fence enforces, and neither can drift from the other or from
what the owner set.

⚠ **A GUESS WAS WRITTEN, SHIPPED TO A PR, AND HAS BEEN REMOVED.** The first cut
of this module carried its own `DEFAULT_CAPTURE_MIX` — "6 photos + 1 clip per
guest, 150 base credits" — labelled an owner-tunable default. Nobody measured
it; no production event has completed with Papic, so there was no distribution
to fit. Dressing an invention as a constant on a surface that tells couples to
SPEND MONEY is the defect, and the label admitting it was a guess did not make
it safe. A guard test now fails CI if this module re-grows any domain constant
(anything ≥ 2) or any `photosPerGuest`/`clipsPerGuest`/`CAPTURE_MIX` symbol.

⚖ **IT RECOMMENDS ONLY WHEN SHORT** (owner 2026-08-30: *"not over not under. if
their count is good, then do not recommend."*). A covered event contributes no
decision row and no top-up figure at all — the `CreditVerdict` union makes
over-recommending unrepresentable rather than merely discouraged. An event with
no guest count resolves to `unknown` and says nothing, so a brand-new event is
never told it is short of something we cannot measure.

⚠ **THE RECOMMENDATION IS A GAP, NOT A RUNG — also a corrected mistake.** An
earlier cut rounded the shortfall up to a fixed 150, which is the Papic **ONE
camera** rung. The shared pool sells on a sixteen-rung `PAPIC_GUEST*` ladder
whose sizes are admin-editable catalog data and are not multiples of anything,
so that would have quoted figures the pool checkout cannot sell. Home states the
shortfall and links out; `PapicPoolCard`, which already reads the ladder, picks
the rung. `smallestRungCovering` is provided for a caller that holds it.

**Surfaces:** the mini-tile verdict line, and a "Top up Papic credits" row that
joins the existing `pay` decision group only on a `short` verdict, deep-linking
`/studio/papic?topup=<shortfall>`.

**Proved by mutation, not merely green** (85 tests across this module plus the
pool/held/copy-guardrail suites): replacing the delegation with a hand-rolled
`guests * 6 + 150` turns FIVE tests red, including the no-guess guard; the
covered-boundary `>=` → `>` and an over-recommending rung each turn it red too.

SPEC IMPACT: None. No pricing, schema or catalog change; the estimate is
display-only, reads owner-set config, and nothing here can charge.
