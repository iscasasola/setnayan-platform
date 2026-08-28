## 2026-08-28 · feat(vendor-dashboard): the card maker's kind search finds any of the 262 live trades, ranked

A supplier making a new service card could only ever search ~46 legacy
department pills (`o.label.toLowerCase().includes(q)`). The 262 real trades in
the live coverage taxonomy — generator hire, tent rental, sorbetes carts,
bridesmaid dresses, ninong/ninang sets and 46 more with no word of their own in
that list, plus three funeral kinds that render in no group at all — were not
searchable there at all. Typing "generator" or "sorbetes" found nothing; that
shop had to file under Miscellaneous or a department that was not theirs.

Typing now searches the full live trade list, ranked by the same shared
four-tier matcher the couple-side marketplace search already uses
(`lib/taxonomy-search-rank.ts` — written because one-word "photobooth" used to
return zero results). Results appear only once something is typed (never a
rendered wall of 262 pills), each one carries the same offerability check the
Publish button enforces (so a capped supplier can no longer pick a trade here
and be refused only after writing the whole card), and a trade already shown
in the shop's own coverage band is never repeated.

New: `lib/kind-search-trades.ts` (imports the shared ranker, adds only the
exclusion the sheet needs — no second matcher). `services/new/page.tsx` now
builds the trade list from the same visible-coverage-tree read and the same
standing function the save already uses.

SPEC IMPACT: None — implements Slice 1 of
`WHATS_NEXT_The_Category_Suggester_2026-08-28.md`. No schema change, no model
call, no new payload risk beyond what `/explore`'s existing ~192-item taxonomy
autocomplete already ships as page data.
