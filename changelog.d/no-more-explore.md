## 2026-10-28 · fix(suppliers): the ⓘ no longer calls the page "Explore" or says "vendor"

Owner, verbatim (28 Oct): *"We do not have explore anymore it is suppliers with find build and book"*. The
Suppliers › Find "Cover your event" ⓘ still opened **"How Explore works"**. The minimal true-making fix, all in
`apps/web/lib/explore-info-copy.ts` (the one home for that copy):

- title "How Explore works" → **"How Suppliers works"**;
- "vendor" → "supplier" in every on-screen string of the file — the WHAT line, the booking line, the legend, and the
  "can't remove a category with a booked supplier" refusal;
- legend "Exploring" → **"Saved"** (glyph unchanged).

Deliberately NOT here (owner scope cut, same day): the WHAT / strip lines and the other legend rows are rewritten
with the full Suppliers ⓘ + tour inside the reorg PRs (Inspiration, Schedule), then one sweep after the last move.

`explore-info-copy.test.ts` keeps its properties: the veto patterns now take either noun (a pattern that only knew
"vendor" would pass the same promise reworded with "supplier"), plus one check that the ⓘ title, WHAT, booking line
and legend say neither "vendor" nor "Explore".

SPEC IMPACT: None — copy.
