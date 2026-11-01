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
- **Greyed rows keep their reason in the ⓘ (owner 2026-10-31, *"Yes, tidy it"*).** A PickMenu row that cannot be
  picked yet ("Nearest to your venue" · "Fits your budget" · "New here" on the ⇅) shows its label only, greyed, on one
  line at the 44-px height of every other row; its reason sits behind the shared `InfoTip` at the row's right edge.
  Tapping the ⓘ opens the reason and keeps the menu open (`OneOpenScope`); tapping the row picks nothing. This is the
  SHARED `PickMenu` (`pick-menu-off-row.tsx`), so every PickMenu with a `disabledNote` gets it (Seating's "Tap Edit
  first", the Event Hub editor's notes, Admin › Categories, …). The ⇅ list is floored at 240 px (`menuMinWidth`, passed
  through `ThumbMenu`) so its rows fit one line at 390 px with no rewording; the tip hangs inside the list's width
  (`[data-pick-off] .sn-tip` in `globals.css`). Measured at 390×844: the ⇅'s rows went from 589 px to 514 px tall, with
  every row 44 px (they were 63 · 90 · 54 for the three greyed rows).

Guard: `app/dashboard/[eventId]/vendors/find-price-is-a-sort-only.test.ts` — one sort control (the ⇅, built once), price
is a sort and never removes a card, no range sheet, Nearest's venue rows live in the same Sort list. Six sabotages each
seen red. `lib/a-greyed-choice-keeps-its-reason-in-the-info-tip.test.ts` renders the greyed row (no reason inline,
the reason in the ⓘ and named by it, the row cannot pick, PickMenu routes every disabled option to it); two sabotages
seen red. Also `lib/find-sort-choices.test.ts` (the venue rows, executed), a ceremony case in `lib/bench-sort.test.ts`,
and the price case in `lib/find-service-cards.test.ts` re-aimed.

SPEC IMPACT: None in the corpus from this PR. It implements the owner rulings in `DECISION_LOG.md` (2026-10-31 "SEVEN
OWNER ANSWERS" (1)) and the owner's 2026-10-31 *"Yes, tidy it"* for greyed menu rows, which is NOT yet a
`DECISION_LOG.md` row. That is flagged for the controller to record. No locked decision changed.
