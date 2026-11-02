## 2026-10-13 · feat(booking-fee): the fee is made at the supplier's yes — doors, receipts, no charge is not unlocked, an unpaid fee expires when its booking or event ends

Owner 2026-10-12 "APPROVE ALL: THE BOOKING-FEE QUESTIONS (14)" #1, #7, #9 and 2026-10-13 (four approvals); audit
`controller-2026-10-12/BOOKING_FEE_RULES_AUDIT_2026-10-12.md` items 2, 3, 4, 12.

- **The fee is made at the yes (#1).** One mint, `lib/booking-fee-mint.server.ts`, called by the supplier's yes, the
  Locked-QR claim, a confirmed payment, and a dashboard catch-up for agreed / QR-claimed bookings with no charge
  (owner 2026-10-13: those ARE billed). A waiver settles at mint and holds the date. `booking-fee-single-trigger`
  pins the one collector call and the door set.
- **Item 3:** an admin's "payment stands" dispute settlement runs the acknowledge effects.
- **Item 4:** a promo-waived booking gets the waived receipt, saying why; the fee hub lists it.
- **Migration `20271268087628`:** status `cancelled_unbilled`; the date hold / release / follow count `waived_promo`
  and only for a booking still booked, and a fee-held day is given back on cancel (item 2); the gift quote answers
  `fee_waived` during a window or on a waived charge and asks the card last (item 2, #7); a booked shop with no
  charge is `booked_fee_due` (item 12); an UNPAID fee on a booking cancelled before its event, or on a DELETED
  event (owner 2026-10-13), becomes `cancelled_unbilled` and its open bill is cancelled — paid fees stay paid; a
  stale (voided, `expired`) amendment top-up no longer locks a booking (TS + SQL gate); and
  `fee_unlocks_event_enforced` is REFUSED unless the production app stamped `booking_fee_minting_live = TRUE`
  (`lib/booking-fee-minting-stamp.ts`, from `instrumentation.ts`, production only), standing down if minting turns
  off (owner 2026-10-13).
- Tests: `tests/db/the-fee-is-made-at-the-yes.db.test.ts` (sabotage-run per rule), unit guards updated with their
  reasons (single trigger, doors, receipts, sink, sweeps roster, money writer), `lib/booking-fee-minting-stamp.test.ts`.

SPEC IMPACT: None — implements owner rulings already in the corpus DECISION_LOG (2026-10-12 81292dc; 2026-10-13).
