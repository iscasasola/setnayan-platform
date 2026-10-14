## 2026-10-12 · feat(booking-fee): the couple's side reads the charge where it must — and never names the fee

Owner 2026-10-07 ("no handshake, no record · no handshake, no access to certain features · no handshake, no
confirmation of the event being booked to them · meaning. no booking fee paid to us") and 2026-10-12 "APPROVE ALL:
THE BOOKING-FEE QUESTIONS (14)" #1 (the fee is made at the yes) and #14 (couples are not told about the supplier fee).
Audit `controller-2026-10-12/BOOKING_FEE_RULES_AUDIT_2026-10-12.md` C6, F2, F3, F6 / build item 13 (partial — see
below). Stacked on `rd/booking-fee-rules`.

- **One rule** — `lib/couple-booked-and-settled.ts` `coupleBookingStanding`: booked = confirmed AND the supplier's
  fee settled (paid or any waiver), or an off-platform supplier, or a handshake whose fee is still being made; an
  unreadable fee fails open. A billed, unpaid fee reads to the couple as the supplier not finished — never as a fee.
  Read by `readCoupleBookingStandings` (service-role, returns only a standing).
- **No handshake, no record (C6, F2):** `recordDeposit`, `logPayment`, `raiseChangeOrder` refuse server-side, and
  `readPublishedMethodsForCouple` withholds the supplier's account numbers (new state `not_yet`, its own sentence),
  until the booking is booked and settled — while the lock handshake is on (with it off the first confirmed payment
  IS the supplier's yes, so nothing is refused). Manual suppliers are never refused.
- **No handshake, no access (F3):** the mood-board share, the day-of call-times email and the booked-host lookup
  (emcee questions) reach only booked-and-settled Setnayan suppliers — they used to reach every Setnayan supplier on
  the event, even a shortlisted one.
- **No handshake, no confirmation (F6):** at the supplier's yes the fee is made FIRST; if it is billed and unpaid,
  "said yes" and "your booking is confirmed" are held back (a narrowed date is still told), and
  `tellCoupleTheBookingIsConfirmed` sends the confirmation when the payment approval settles the fee.

Left (named, not built): the "Booked" chips and counts on the couple's screens (F1 — `lockRequestStateOf` and its
~20 readers, inside files the Suppliers redesign PRs are rewriting); the SQL `set_vendor_colour_access` /
`request_part_finalization` and the couple-status trigger (C7), which cannot read the handshake/fee flags.

Tests: `lib/couple-booked-and-settled.test.ts`, `lib/the-couple-sees-booked-when-settled.test.ts` (sabotage-run),
`lib/the-plan-is-frozen-at-the-suppliers-yes.test.ts` (updated for the one held-back case).

SPEC IMPACT: None — implements rulings already in the corpus DECISION_LOG.
