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
`papic_event_pool_status` mirrors — so this module states no figure of its own
and cannot invent one.

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

---

## 2026-09-12 · fix(papic): landing the above, and correcting what it claimed about itself

The commit above was finished 2026-08-31, pushed to a branch whose PR (#5037)
had **already merged the day before**, and therefore never got a PR of its own.
It sat unmerged for twelve days while the guess it removes stayed live in
production. Landed here. Three things had to be fixed first.

**1 · IT WOULD HAVE FAILED CI.** `lint-one-comment-stripper` exits 1 on this
branch: the source guard read the module through a hand-rolled two-replace
regex — the exact shape that guard exists to refuse, because taking block
comments first lets a line comment containing a block-open marker swallow
everything to the next close, after which the assertion runs against a blank
and passes. Swapped to `stripComments` from `lib/strip-comments.ts`. **Proved
the swap did not defang it:** injecting `const AVERAGE_PHOTOS_PER_GUEST = 6`
into the module turns test 14 red and names the number.

**2 · THE PROSE CLAIMED A MECHANISM THE CODE DOES NOT HAVE.** This fragment, the
module docblock and the dashboard comment all said the surface reads
`papic_event_pool_config`, "every field admin-editable without a deploy". It
does not. `config` is optional and `event-dashboard.tsx` calls
`papicCreditVerdict(papicHome.shotsLeft, guests.length)` — **no config** — so
the figure comes from `DEFAULT_EVENT_POOL_CONFIG`, the formula's last-resort
fallbacks. The row is not loaded on that surface, deliberately: the verdict was
built to cost no extra query.

**Measured against production** (`njrupjnvkjkitfctetvi`, 2026-09-12): the single
`default` row is `points_per_guest 150 · floor_points 5,000 · ceiling_points
30,000` — byte-identical to the fallbacks. **So the number a couple sees today
IS the owner's, and does match what the capture fence enforces.** But that is a
coincidence maintained by hand, not a mechanism: edit the row in `/admin/pricing`
without editing the constants and the tile quotes the old figure while the fence
meters by the new one. All three places now say exactly that.

**3 · A TRIPWIRE, because a comment cannot fail.** `an unpassed config uses the
fallbacks, and they still match prod` pins the three constants to the measured
row and carries the re-measure query. **Sabotage, measured:** `pointsPerGuest`
150 → 140 turns it red (15 tests → 14 pass / 1 fail). The instruction in the
test is explicit — if they have genuinely diverged, load the row on the tile's
surface; do not retune a constant until the test goes green again.

🔑 **OPEN, AND THE OWNER'S CALL, NOT TAKEN HERE:** whether the couple's home tile
should spend one indexed single-row read to follow `papic_event_pool_config`
live. Doing it would make "admin-editable without a deploy" true of this
surface. It is flagged rather than done because it changes what a money surface
queries, and the tripwire holds the line meanwhile.

**Re-verified on the branch MERGED INTO current `origin/main`, with the
worktree's own dependencies installed** (a fresh worktree has none, and `tsc`
there resolves nothing while looking like it ran): `papic-credit-estimate`
15/15 · `papic-copy-guardrails` 51/51 · re-inventing `guests * 6 + 150` turns
**six** tests red, not the five the original commit measured — the tripwire is
the sixth. Guards green: `lint-one-comment-stripper` · `lint-changelog-dir` ·
`lint-dup-rule-baseline` · `lint-port-no-lost-controls` · `lint-colour-exists` ·
`lint-no-engineering-notes-in-ui` · `lint-server-only-boundary`.

SPEC IMPACT: None. No pricing, schema or catalog change; the estimate is
display-only and nothing here can charge. The open question in 3 above is
recorded for the owner's desk, not applied.
