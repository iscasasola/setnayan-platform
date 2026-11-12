## 2026-11-12 · feat(quote): the quote maker's money — offer on its own cards, offer before discount, pax follows the list

Piece 1 · PR-1 of `controller-2026-11-11/BUILD-PIECE1-QUOTE-NEGOTIATION.md`, to the approved
`quote-maker-polish.html` design and the owner's 11–12 Nov rulings. No migration.

- **An offer comes off its own cards' lines only** (`lib/quote-offer-door.ts`): every quote line carries the card it
  came from (`cardId`, set by the card and bundle seeds); an offer's anchor is the sum of the lines whose card it
  reaches (All cards = the whole quote). Its line says "on <card> only". Offer math is unchanged — the 9 Nov rule the
  owner kept (% first, then ₱ off the rest, `pickBestDiscount`).
- **Offer first, then the typed discount** (`lib/quote-money.ts` `quoteMoney`): Subtotal − offer − Discount = Total,
  the discount taken from what is left; the couple's lines list the offer before the Discount.
- **Low-first-payment and gift-only offers now fit** (they were dropped): a lower first payment sets the plan's first
  row ("from offer") and greys the presets that contradict it with the reason; a gift is a "from offer" Complimentary
  line (a Setnayan pack rides the shop-gift block, re-judged on send).
- **Pax follows their guest list**: no guests stepper; ONE quote-level "Bill at least"; billed = max(live, min)
  (`billedPax`). `billed_pax` / `min_pax` go into `merge_snapshot`; each line's `card_id` / `basis` / rate and an
  offer's `offer_id` ride in the `line_items` JSON (`lib/quote-line-structure.ts`, kept through the free-travel rebuild).
- **A revision keeps its line's offer** and re-opens per-pax / per-hour lines as they were priced, at the same minimum
  (`seedQuoteRevision`), instead of folding the offer into the Discount and flattening every line.
- **Valid until is required to send**: highlighted "Required to send", Send dimmed, an early press shakes the row.
- **Start from is grouped** (Service cards · Bundles · Saved quotes; Updating first, Blank last; no prefixes).
- **Sections per the design** ("Following their guest list", "Your offer", "What it comes to"); lines fold one at a
  time with the first open and one expand/collapse icon on the pinned "Pick service cards" heading; help captions sit
  behind the section's ⓘ; plan presets per the design plus "Custom" (the Final balance stays auto).
- Guards: `lib/quote-money.test.ts`, `lib/a-revised-quote-keeps-its-offer.test.ts`,
  `app/_components/the-quote-money-order.test.ts`, `lib/quote-offer-door.test.ts` (its "gift-only → []" case now
  expects the offer to fit); six older guards re-pointed to the ruled shapes.

SPEC IMPACT: None — the rulings are already in the DECISION_LOG (2026-11-11/12 rows).
