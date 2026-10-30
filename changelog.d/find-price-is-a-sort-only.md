## 2026-10-31 · feat(suppliers): Find's price is a sort only — and Nearest picks the venue in the same ⇅

Owner, 31 Oct (corpus `DECISION_LOG.md` "SEVEN OWNER ANSWERS" (1)): Find's price is *"sort only"*, never a filter —
and *"Find is already okay"*. Reworked from the first cut of this PR, which drew a SECOND sort control (a ≡ on the
thumb row) beside the ⇅ #7054 had already shipped, plus a "Your range ₱… – ₱…" sheet under Budget fit. Both are gone;
this is now the smallest delta on the shipped ⇅ (`find-sort-menu.tsx`).

- **Price only orders.** The ⇅'s Price thirds ("Under ₱X" · "₱X – ₱Y" · "₱Y and up") removed cards and are gone. Price
  is the ⇅'s Sort row **Lowest price** (already shipped), which orders every card and hides none. `FindFilters` no
  longer has a price field and `priceBands` is deleted (`lib/find-service-cards.ts`), so nothing on Find can drop a card
  for its price. Rating stays as it was.
- **No range sheet.** `find-budget-range.tsx` is not added; Budget fit keeps its shipped gate and order.
- **Nearest picks the venue (owner 2026-10-30, "Reception + Ceremony").** In the ⇅'s Sort list, one row per venue with a
  pin — **Nearest to reception** · **Nearest to ceremony** — measured from the Event Hub's own two venues
  (`resolveEventVenues`: a booked venue's pin, else the couple's own; `lib/find-near-anchors.server.ts`). One pin, or the
  same place twice → one row with the shipped label. The reception is now the BOOKED reception's pin where there is one
  (it was the first venue ever saved). Nearest is offered whenever a venue has a pin. Only the order and the reason pill
  move ("Closest to your ceremony"); a card's own distance line is untouched (`SortShape.adjust` in `lib/bench-sort.ts`,
  `orderInlineMoreRow`'s `adjust`).
- Unchanged on Find: the ⇅ itself, its place on the thumb row, the lens labels, Rating, the ✎.

Guard: `app/dashboard/[eventId]/vendors/find-price-is-a-sort-only.test.ts` — one sort control (the ⇅, built once), price
is a sort and never removes a card, no range sheet, Nearest's venue rows live in the same Sort list. Six sabotages each
seen red. Also `lib/find-sort-choices.test.ts` (the venue rows, executed), a ceremony case in `lib/bench-sort.test.ts`,
and the price case in `lib/find-service-cards.test.ts` re-aimed.

SPEC IMPACT: None — implements the owner rulings already recorded in `DECISION_LOG.md` (2026-10-31 "SEVEN OWNER
ANSWERS" (1)); no locked decision changed.
