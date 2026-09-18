## 2026-09-19 · fix(workspace): a recorded deposit is money — "Paid so far" and "Raise a dispute", not "Deposit paid —" and "Cancel booking"

The couple's own "Record deposit" writes the payment log and `deposit_recorded_at`, never
`deposit_paid_php`. Two workspace reads looked only at `deposit_paid_php`, so on a booking with a
recorded, supplier-confirmed ₱2,000 deposit (rosa-ben, prod) the costing card read "Deposit paid —"
under a header saying "Paid so far ₱2,000", and the page offered "Cancel booking", which
`cancelBookingAsHost` then refused. Both sides now ask one helper, `lib/booking-money-moved.ts`,
and the costing row shows the header's own "Paid so far" figure.

SPEC IMPACT: None
