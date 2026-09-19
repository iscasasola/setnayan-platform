## 2026-09-19 · fix(money): the accepted quote's first payment is shown, is the minimum, and the quote is the one price

Owner, live as testnayan4 on a booked Band/DJ card: "we have set how much is
the downpayment but it did not show. it should follow the amount requested
and that means that is the minimum." The accepted quote (₱16,750) asked for
₱3,350 on lock, then ₱13,400 fourteen days before the event.

**Root cause.** `vendor_proposals.payment_schedule` had exactly one reader —
the public proposal page. The booked card's schedule reads
`event_vendor_payment_plan`, which is frozen from the supplier's SERVICE
template at lock and is empty for a booking that locked through a quote. So
the card showed an empty deposit box ("e.g. 10000"), no ₱3,350 anywhere, a
LINE ITEMS panel claiming the supplier "hasn't shared pricing yet", and a
manual Costing editor that could overwrite the quoted price.

- `lib/accepted-quote-terms.ts` (pure): the accepted quote's lines, schedule
  and first payment; `decideDepositAmount` (the minimum); `manualCostingEditorShown`;
  `paymentScheduleSource`; `lineItemsPanelLead`; `supplierFirstPaymentStatus`.
- Couple deposit card: "First payment requested: ₱3,350 — due on lock", the
  amount prefilled and `min` set; `recordDeposit` refuses less on the server
  (fails closed if the quote cannot be read). No accepted quote = unchanged.
- Payments section: the quote's full schedule with due dates when no real plan
  exists (it replaces a default 50/50 estimate; a real plan still wins).
- LINE ITEMS panel leads with the accepted quote's lines (display only; the
  money strip's totals are unchanged).
- Costing: with an accepted marketplace quote the manual editor and its
  "Log as service price" bridge no longer render — one read-only line points
  at the quote; crew size stays editable. `updateVendorCosts` no longer writes
  `total_cost_php`/`transport_php`/`food_allowance_php` for such a booking.
- Supplier client page: the same requested first payment, and whether the
  couple has recorded it (and how much).

Guard: `apps/web/lib/accepted-quote-terms.test.ts` — executes every decision
against the live quote's shape, including a below-minimum deposit refused by
the action's decision; each of 7 sabotages turned it red.

SPEC IMPACT: None.
