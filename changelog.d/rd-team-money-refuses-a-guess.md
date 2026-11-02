## 2026-09-22 · fix(your-team): the money tiles stop guessing ₱0 for a price nobody recorded

Owner, 2026-09-22, answering the plan's blocking question **"2. yes"**: split the money and let the
buffer refuse to compute while any row is unpriced.

`teamMoney` read `candidateCostsPhp.reduce((s, c) => s + (c ?? 0), 0)`. A candidate whose price
nobody has recorded was therefore added as **zero** — the total did not refuse and did not warn, it
just came out smaller. **It lied rather than refusing**, and it is the number a couple reads to
decide what they can still afford.

**Measured on production 2026-09-22, event 044f7e64 (a live wedding):** both locked suppliers and
both candidates carry `total_cost_php = NULL`, so the section printed **"LOCKED ₱0"** and
**"₱2,250,000 to spare"** beside **"₱26,499 paid"** — and each of the three row surfaces drew
**nothing at all** where the price goes, indistinguishable from free, from ₱0, and from a layout bug.

The shape is the one `lib/guests.ts` already uses for reads (`MeasuredGuests`): a value plus a
statement about whether it is complete. Its rule applies unchanged — **"unknown" means we do not
know, NOT zero.**

- **`lib/your-team.ts`** — `teamMoney` sums only the prices that EXIST and returns
  `lockedUnpriced` / `inBuildUnpriced`; `bufferPhp` goes **null** while either is non-zero, because
  a buffer is a claim about what is left and cannot be made from a sum missing rows.
- **`bufferTile(bufferPhp, unpricedCount)`** says `Not knowable`, and **"Not knowable" outranks
  "No budget set"** — a couple who HAS set a budget and reads "No budget set" would reasonably think
  it had been lost.
- **`unpricedNote(n)`** → `2 suppliers have no price recorded`, or **`null`**. Returning null is the
  mechanism, the same one `hiddenMoreLabel` uses in `lib/capped-rows.ts`: with no string there is no
  note, so "0 suppliers have no price recorded" is *unrepresentable*.
- **`subtotalLabel(php, unpriced)`** — `₱52,500` · `₱52,500 + 2 with no price recorded` ·
  **`No prices recorded yet`, never `₱0`**, which is the live case.
- **`build-locked.tsx`** — all three money tiles (Locked · Still to lock · Buffer) render their own
  note, untruncated below the value; `LockTile` gained a `note` prop for it, because the value line
  is `truncate`d in a half-width cell and a cut-off reason is no reason at all.
- **`RowPrice`** replaces `{pesoFromPhp(r.cost) && …}` at all three row surfaces, so a missing price
  reads **"No price recorded"** instead of empty space. Without it the tiles' "2 suppliers have no
  price recorded" was unverifiable — the note said how many, and no row said which.
- **One sum, not two.** `toLockTotal` was a second `reduce` with the same `?? 0`, so the heading and
  the tile could disagree after either was edited. Both now read one derivation.

⚠ **The wording is borrowed, not invented:** `budget-truth.ts` already tells a couple a supplier
"is booked but has no price recorded yet". One vocabulary for one fact.

Proof — `lib/your-team.test.ts` (+8 cases) and `lib/the-money-tiles-say-what-they-do-not-know.test.ts`
(5 cases, a source guard that counts mounts per component rather than matching once):

| sabotage | what went red |
|---|---|
| `c ?? 0` back in `teamMoney` | 4 cases, incl. the live production shape |
| `bufferTile(money.bufferPhp)` without the count | the render guard — the tile silently reverts to "No budget set" |
| `note=` on 2 tiles instead of 3 | the mount count (3→2) |
| `pesoFromPhp(r.cost) &&` back on one row | the `RowPrice` count (3→2) |
| refuse the buffer unconditionally | the fully-priced case still expects ₱82,000 |

🪤 **THE DEFECT WAS PINNED BY A PASSING TEST.** `your-team.test.ts`'s first case was written
`candidateCostsPhp: [40_000, 12_500, null]` and asserted `bufferPhp === 300_000 - 25_000 - 52_500` —
it asserted that an unrecorded price contributes zero, and it was green. **A guard can hold a defect
in place as firmly as it holds a fix.** The `null` is out of that case and the behaviour it blessed
is now the subject of its own tests.

SPEC IMPACT: None. No locked decision changes; no price, SKU or schema moves. This makes an existing
derivation state its own incompleteness.

**Not in this change, flagged not smuggled:** `vendors-plan-budget.ts`'s `lockedTotal`
(`picks.filter(locked).reduce((s, p) => s + pickCostCentavos(p), 0)`) has the identical
null-swallowing shape and is the true source of the locked figure — but it also feeds the accordion,
the folder headers and `/budget`, so correcting it there moves numbers on three other surfaces. This
slice takes a **count** instead: the locked figure does not move, and the screen stops presenting a
partial sum as a whole one. **Fixing `lockedTotal` itself is its own slice.**

**Two neighbouring guards were REPOINTED, neither weakened** — found by running every test file that
mentions `your-team` / `build-locked` / `LockTile` (10 files, 117 cases), not just the two I edited:

- `couple-money-reads-like-a-ledger.test.ts` re-derived its set of cost rows from the punctuation
  around each of the **three** inline render sites. `RowPrice` collapses those three into one, so the
  guard now asserts **3 mounts + exactly one render site + `tabular-nums` on it**, and additionally
  that a null price is still *stated*. Its own docblock sanctions this ("If a branch was removed,
  delete its half of this assertion deliberately"), and the property is stronger than before: with a
  single render site the three rows cannot drift apart.
- `deposit-pay-step.test.ts`'s "Still to lock" assertion matched the label and the figure **on one
  line**; the tile gained a `note` prop and prettier split it over four. Made whitespace-tolerant —
  the property is the label and the figure, not their line breaks.

🪤 **And the repointed ledger guard convicted the fix, for the second time in two slices.** It reads
raw source, and `build-locked.tsx`'s new comment *quotes* `pesoFromPhp(r.cost) &&` as the thing that
used to happen. Routed through the canonical `stripComments`. **The same trap that
`capped-rows.test.ts` hit in Slice 0 — knowing about it did not stop me writing it again.** Three
further sabotages confirm the repointed guards still bite: drop `tabular-nums` → red; give one row
its own cost render back → red; rename the tile to "In build" → red.

**On `lockedCentavos ?? 0` — asked about, judged, and KEPT.** It is the same syntactic shape as the
defect, and it is correct: `lockedCentavos` is a **sum** (`chosenCentavos`), so its absence means
"no locked rows were summed", and the total of nothing genuinely is zero. A candidate's `null` cost
is the opposite — the row exists and its price is unrecorded, so zero is a claim nobody made. That
asymmetry is now written where the coalesce is. (I had removed it mid-slice by reflex; removing it
would also have rendered a runtime `undefined` as **"₱NaN"**, which informs a couple of nothing.)
