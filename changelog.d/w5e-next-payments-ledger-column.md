## 2026-08-25 · fix(budget): the "Next payments" column is a ledger column, and the guard now censuses instead of shape-matching

**The miss.** The typeface pass earlier the same day moved each supplier's
Budget / Paid / Remaining into the ledger face and reported the budget screen
clean. It was not clean. The **Next payments** list renders a divided column of
amounts right-aligned down one edge — the Ledger archetype's `.l-amt .a`, Space
Mono and tabular — and it was still in the body face.

**Why the guard could not see it.** Rev 1 found money stats **by shape**: a
component taking both a `label` and a `value`. That is three components on this
screen and it matched all three. The Next-payments row takes a `payment`.
**One shape is not a survey** — the same family as the W4-A sweep that matched
one *spelling* of a colour and reported the colour delta closed.

**The guard is widened, and that is the larger half of this change.** Rule B no
longer looks for a shape. It censuses **every rendered `formatPhp(...)`** in the
resolved file set (21 today), works out which element actually encloses each one
with a real JSX scan, and demands the ledger face unless the figure is billed as
prose. Two things a regex gets wrong here, both proved while writing it and both
recorded in the file:

- "the nearest `<` before the match" names the wrong element when a figure
  follows a closing tag — `{formatPhp(a)}–{formatPhp(b)}` reports `<strong>` for
  the second. Hence an element stack.
- "is there a `>` between?" cannot tell an attribute from content, because a JSX
  attribute expression contains `>` constantly (`saveAmt > 0`, `() =>`). Hence a
  brace- and quote-aware walk to the real end of the tag.

**The bill has 11 lines and a reason each** — 8 genuinely prose ("₱120,000 of
₱400,000 paid", "Suggested ₱45,000 · typical range…") and 3 `<option>` labels in
native `<select>` menus, where a font family is not something this can promise.
Checked in both directions, plus a `CENSUS_FLOOR` so a scan that stops matching
cannot report a clean screen it never looked at.

SPEC IMPACT: None — closes a delta against an already-approved archetype.
