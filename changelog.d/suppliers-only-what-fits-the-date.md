## 2026-11-13 · feat(suppliers): only what fits the date — Discover hides suppliers who are full; an empty list says "Nobody is free on <date>"

Owner ruling 13 Nov (6134): *"If a supplier is unavailable for that day, then we do not need to show them. we only
show what fits."* Builds on #7511 (Discover with suppliers).

- **Discover's supplier view** (`app/(shell)/explore/_lib/marketplace-view.tsx`): a supplier the couple has not
  saved, with no booking left on their date, leaves the list. It used to be moved down only. Same read as Find's
  `hideUnbookable` (`findSuppliersWithNoBookingLeft`: every bookable card in the category on screen refused by
  `service_cards_unbookable_on` on every day of the date — capacity per service through the schedule pools, no new
  rule). The landing's service cards are judged per card (`readCardRefusals`, free on at least one day). Suppliers
  on the couple's list, or who opened their event, stay. A failed read hides nobody. Signed-out visitors and couples
  without a day or month see no change. Pure rules in `lib/discover-shows-what-fits.ts`.
- **An empty list says why.** When the hide empties a list, Find's category page, the search sheet and Discover
  now say "Nobody is free on Sat, Dec 12, 2026." (or "…in December 2026."). Before, they said "No supplier lists
  this yet". The words are the approved prototype's. They come from `lib/supplier-find-empty.ts`, carried over
  from the unmerged `rd/suppliers-find-fits-the-event`. `searchCategoryVendors` now returns `hiddenForDate`,
  `hiddenForDateScope` and `nobodyFreeWords`, and only when the hide removed somebody.
- **Asked suppliers stay.** A supplier on the bench whose calendar shows the committed day taken now reads
  "Taken on Dec 12", the prototype's words. Before, it said "Booked that day". "Ask about another day" shows only
  when the couple has already asked; a supplier they never asked gets Remove only. The code already did this, and
  it is now written in the verb table and covered by a test.
- **Build's pick list** already left out suppliers who are taken on the date (`buildLinesOf` `blocked`). That is
  now covered by the guard.
- `findSuppliersWithNoBookingLeft` takes `canonicals: null` to mean every category. Discover uses this when no
  category is picked. Every existing caller is unchanged.
- Guard: `lib/find-shows-only-what-can-be-booked.test.ts` (from the rd branch, re-pointed). Each new assertion was
  seen red by sabotage.
- Fix: the bench's "Taken on Dec 12" badge read `TakenOnCtx` in `VendorCard` but used it in `FitBadges`, a
  separate component — a type error and a runtime ReferenceError. `FitBadges` now reads the context itself.
- Review shots: `build-sessions/shots-fits-the-date/` — 390 px Now beside Proposed, from `harness.html` (dummy
  data; the copy is the code's, printed by `findNobodyFreeWords` / `takenOnWords`).

Not changed: a supplier the couple saved but never asked still shows on their bench, behind "Not available on your
date", with Remove only. Decision #3 says such suppliers are never removed from the couple's list. Hiding them is
an owner call and is flagged in the PR.

SPEC IMPACT: None — implements the 13 Nov ruling; flag to the owner whether saved-never-asked suppliers should also
leave the bench.
