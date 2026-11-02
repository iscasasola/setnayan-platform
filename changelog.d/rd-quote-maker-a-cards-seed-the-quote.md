## 2026-09-22 · feat(quote): a service card — or several — seeds the quote being written

Owner, 2026-09-22: *"the quotation maker in the vendor chatbox … can load 1 or multiple service
cards combined"* · *"apply the discount"*. Measured first: the builder's only seed was
`vendor_packages`, and production holds 0 packages and 0 proposal templates, so the picker
never rendered for a real shop and every quote was typed from a blank line.

- NEW pure `lib/quote-from-service-card.ts`: `quoteFromServiceCards` turns one or more cards into
  the builder's seed — the priced line by the card's basis (bracket for the guest count), an
  "Added guests" line by the card's own block rule, inclusions as Complimentary lines, ticked
  add-ons, the crew/transport opening state from the card's flags, the card's discount APPLIED
  with its reason (`pickBestDiscount`, judged on the event date; an unqualified ladder is never
  applied), the card's payment schedule + reservation terms, a last-minute surcharge line inside
  its window, and a lead-time warning. Nothing priced twice: lines resolve through
  `resolvePackageLine`, the schedule through `resolveSchedule`. The per-head crew price is not on
  a card and is deliberately `null`, never a number.
- NEW server `loadServiceCardLinesForQuote` beside `loadPackageLinesForQuote` (RLS-scoped; the
  event date read after the thread is proven the supplier's).
- `computeAddedPaxSurcharge` moved verbatim to pure `lib/added-pax-surcharge.ts`; `lib/pax.ts`
  re-exports it, every importer unchanged.
- Executed by `lib/quote-from-service-card.test.ts` (17 subtests); six sabotages watched red.

SPEC IMPACT: DECISION_LOG 2026-09-22 row (already recorded); kit `quote-maker-redesign-kit-2026-09-22`.
