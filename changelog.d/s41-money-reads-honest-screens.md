## 2026-09-19 · fix(money): four money screens say "couldn't load" instead of "none" when a read is refused (S41 · batch 1 of the money tier)

The `result-dropped-silently` class from S26's both-ends baseline (#5625): a
Supabase read whose `error` picks a branch that records nothing. On a money
screen that is the oldest disease here — a refused read renders byte-identical
to a genuine absence.

**What a person now sees (join the missing end — the failure reaches the render):**

- `/vendor-dashboard/booking-fees` — a refused read said *"No booking fees yet."*
  to a shop that may owe one. `fetchVendorFeeOrders` now returns
  `FEE_ORDERS_UNREADABLE`, and the page says it could not load.
- `/vendor-dashboard/payment-options` — *"No payment options yet."* invited a shop
  to re-add methods it already has. New `fetchOwnPaymentMethodsMeasured`
  (`measured:false` on refusal); the old name stays as a thin wrapper.
- Vendor Overview cash-flow tile — *"No booked installments yet."* over a refused
  payday read. `VendorEarningsSummary.paydayMeasured` carries it to the tile.
- Couple's Papic studio "Guests chipped in" — the card vanished on a refused read,
  identical to "nobody gave". It now shows a could-not-check card.

**Already honest on screen, now also leave the reason (logged, `logQueryError` or
`console.error`):** payday page, `/pay/[reference]` latest payment, admin payments
(duplicate exposure + bill catalogue), admin payment-methods inflow, delete-event
money check, mood-board balance, supplier-removal payment check, change-order
withdraw, and the vendor plan order insert (a plan purchase with no order is one
reconciliation cannot match).

`actions.ts` deny-paths are unchanged — each already failed closed or told the
person; only the reason is now kept.

Pinned by `lib/money-reads-are-honest.test.ts` (decisions executed against a
stubbed client; render order pinned by position; mutation-checked 3 ways, 3 red).

Pays down 17 `result-dropped-silently` MONEY lines of
`tests/db/ugat-both-ends.baseline.txt` (the file lands with #5625; the ratchet
prints them as paid down).

SPEC IMPACT: None
