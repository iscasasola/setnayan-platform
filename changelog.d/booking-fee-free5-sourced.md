## 2026-10-12 · fix(booking-fee): a shop's first five free bookings are its first five Setnayan-sourced ones

Owner 2026-10-12 ("APPROVE ALL: THE BOOKING-FEE QUESTIONS (14)", answer 2); audit
`controller-2026-10-12/BOOKING_FEE_RULES_AUDIT_2026-10-12.md` A5 / build item 7.

The free-5 ordinal counted every lock ledger row, imports included, so a shop that brought its own clients first used
up its five and was billed on its first real Setnayan booking. Migration `20271268252763` adds one predicate,
`attribution = 'sourced'`, to the ordinal count in `booking_fee_open_lock_charge` and to both counts in
`setnayan_gift_quote_applies`; `resolveBookingFeeStanding` (the supplier's forecast) counts the same way. Frozen
ordinals are never re-derived, so no existing charge, receipt or bill moves.

DB test: `tests/db/first-five-free-counts-sourced-bookings.db.test.ts` (imports then five sourced → all five free, the
sixth billed; the quote projects the same; a frozen ordinal stays; the TS projection carries the predicate).

SPEC IMPACT: None — implements the owner's 2026-10-12 answer already in the corpus DECISION_LOG (81292dc). The
audit's record correction for "first 5 sourced bookings **per event**" (2026-07-27 canon) is the controller's item 1.
