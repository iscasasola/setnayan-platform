## 2026-09-09 · feat(bench): the couple's sort reaches row 2 — bottom tier only, and the row says so

The Sort by bar sat above TWO rows and governed ONE of them. A couple picked *Lowest price*, watched the shortlist carousel reorder, watched the "More in {category}" results underneath it not move, and was told nothing about why.

**Measured first, and the second half is a decision, not a bug.** `sortWithReasons` (`lib/bench-sort.ts`) is called exactly once, on the shortlist carousel. `classifyInlineMoreRow` (`lib/inline-more-row.ts`) PARTITIONS row 2 and never orders it — its order comes from `_actions/category-search.ts`, the owner-locked 2026-05-31 ladder (relationship depth → **BOOSTED (paid placement)** → top-reviews → tail), whose own comment calls re-ranking *"a separate, sign-off-gated change"*. A shipped smart-sort price re-rank is already confined to *"the TAIL tier ONLY"*.

**Owner ruling 2026-09-09: _"bottom tier only."_** The couple's chosen lens now joins that shipped re-rank in the tail, on exactly the same terms. **Nothing paid moves by algorithm** — what Setnayan sells is the default position, and a chip that could demote a paying vendor is a refund nobody agreed to.

### The boundary is enforced by construction, not by a well-behaved comparator

`orderInlineMoreRow` (new, pure — `lib/inline-more-order.ts`) never sorts the array it is given. It collects the INDICES holding `ladderTier === 'tail'` rows, orders that sub-list, and writes it back into those same indices. Every protected row therefore ends at the byte-identical position it started at, because **no other index is ever written**.

⚠ That shape is load-bearing. The tail is **not a contiguous suffix**: `category-search.ts` applies a service-date down-rank AFTER the ladder that stable-partitions busy vendors to the end, so a boosted vendor who is busy on the date legitimately sits *below* tail rows. A "sort the last N" implementation would have dragged that paid card around — and there is a test that fails on exactly that.

### One rule, not a second comparator

`orderByBenchSort` + `BenchSortFacts` were extracted out of `sortWithReasons` and are now the single definition of what a sort chip MEANS; row 1 and row 2 both call it. A second comparator in row 2 would have been a second definition of "Lowest price", free to drift in exactly the way the couple would never be told about. `sortWithReasons`'s own comparators, tie-breaks and reason pills are unchanged (36 existing tests green).

Row 2 projects onto the SAME scorer (`lib/compat-score`). ⛔ **`boosted` is deliberately not passed** — the scorer documents it as `ad_rank > 0`, and feeding it would let ad spend buy score inside the one tier meant to be free of it (`bench-sort.ts` refuses it on row 1 for the same reason). `dateHeadroomRatio` is omitted too: row 2's date verdict is a partition applied *after* the sort, and scoring it as well would sink a clashing vendor twice. "Can this lens discriminate at all?" reuses the shipped §15.2 `LENSES[mode].hideWhen` rather than a second copy of that rule; when it says no, the ladder's own order is handed back untouched instead of running a comparator that would shuffle on tie-breaks nobody asked for.

### Two fields, derived once where they are already known

`CategoryVendorResult` gains `ladderTier` (which rung the ladder put this row on — stamped at the four assembly steps, never re-derived downstream from the public fields) and `startsAtPhp` (the vendor's cheapest pax-adjusted service floor — **not a quote**; there is no quote for a shop the couple has not contacted). The read behind `startsAtPhp` already ran unconditionally for the free budget-fit score; only its exposure is new, and the flag-gated smart-sort internals (`_startsAt` → `budgetPressure`) are untouched, so that shipped behaviour is byte-identical either way.

### And the row says what it is ordered by

`inlineMoreOrderNote` writes one line under "More in {category}", built from the tiers ACTUALLY PRESENT in that row and from whether the chosen sort could discriminate at all:

- *Featured and most reviewed first, then your ‘Lowest price’.*
- *Featured first, then Setnayan's order.* — when the sort had nothing to go on, the row does not claim it applied.
- *Featured and most reviewed first — your ‘Lowest price’ orders anything below them.* — when there is no tail, which is why nothing moved.
- *Ordered by your ‘Lowest price’.* — when the whole row is tail.

It quotes the chip label the component actually rendered (`Best fit` flag-off vs `Best matches` flag-on) rather than looking one up, so it cannot quote a different word from the button the couple just pressed. It reuses the existing `.mrnote` style — no new colour, no new tinted label.

### Measured

`NEXT_PUBLIC_EXPLORE_REPLAN_ENABLED` and `NEXT_PUBLIC_SMART_SORT_ENABLED` were both read from Vercel production on 2026-09-09 (`vercel env pull`, grepped, deleted) and are **`true`** — so the five-lens control and the shipped tail price re-rank are both live on this surface. That independently reproduces the gate-G6 answer another session recorded the same day; the flag was never actually unreadable.

**22 tests, exit 0** in `lib/inline-more-order.test.ts`, and **every one of 11 mutations was proved to turn them red** (counts before → after recorded in the PR): sorting the whole array (4 fail) · treating the tail as a suffix (1) · running the comparator with no signal (1) · feeding paid placement to the scorer (1) · a fixed sentence template (6) · claiming the sort applied when it did not (1) · the server dropping the boosted stamp (1) · returning a constant tier (1) · putting `startsAtPhp` back behind the flag (1) · feeding the classifier unordered rows (1) · computing the sentence but never rendering it (1). The first draft of the "no signal" test was **decoration** — with no prices every card ties at Infinity and `Array.sort` is stable, so deleting the guard left the order identical; it was rewritten against a lens, where the mutation is visible.

⚠ **AND CI CAUGHT ONE THING NO LOCAL RUN DID.** `Shaped` is `CategoryVendorResult & {…}`, so adding a REQUIRED `ladderTier` to the public type made the shaping literal — which cannot know its rung yet, the four assembly steps have not run — fail to satisfy it (`TS2322`, one error). `Shaped` now `Omit`s the public field and carries the provisional stamp on `_tier` alone, which is the honest shape anyway. The local typecheck was still running under a load average of 120 when the PR went up; it did not disagree, it had not finished.

`lint-port-no-lost-controls` green with the baseline UNTOUCHED (425 routes / 1538 controls / 4342 blocks) · the card-element guard green (5) · the contrast guard green (6) · `inline-more-row` (23) · `bench-sort` (36). Nothing is removed from a bench card; the change adds one line and orders one tier.

**Not in this change:** drag-to-rearrange (S8) — long-press, pins beating sort, "Your order" + Reset, and per-celebration shared storage are a separate session that depends on this one.

SPEC IMPACT: `SESSIONS_Chat_Bench_Exclusive_2026-09-09.md` — S7 marked shipped; `BUILD_PLAN_Chat_And_Exclusive_2026-09-09.md` — the bench-ordering work added to Stream B, which did not carry it.
