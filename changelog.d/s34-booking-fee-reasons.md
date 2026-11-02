## 2026-09-18 · fix(booking-fee): a failed fee RPC records its reason instead of dropping it (S34)

S26's both-ends guard flagged three `result-dropped-silently` sites in
`lib/booking-fee-charge.ts` (`booking_fee_open_charge`, `booking_fee_settle_charge`,
`booking_fee_proposal_cleared`). Each read `error` only as a condition and returned a bare
null/false.

- **Settle was the one with a consequence.** An RPC failure returned `false`, and the approval hook
  in `lib/sku-activation.ts` wrote `settled: false` into the order ledger, the same value an
  idempotent no-op on an already-settled charge writes. "The supplier's fee is still open on our
  books" and "nothing to do" were the same row. `settleBookingFeeCharge` now returns
  `{ settled, error }`, and the ledger row carries `settle_error`.
- Open and cleared keep their contracts: open fails OPEN on null, cleared fails CLOSED on false.
  Each failure branch now logs the RPC's code and message with the proposal/charge id, and open
  separates "RPC error" from "no charge returned".
- `lib/a-fee-rpc-failure-leaves-a-reason.test.ts` pins all three branches and the ledger field.
  A sabotage that collapses one branch back to a bare return goes red.

SPEC IMPACT: None.
