## 2026-11-17 · fix(supplier-today): an unreadable fee-bill list never reads as "Nothing waiting on you"

From the supplier dashboard audit (Today):
- Today turned `FEE_BILLS_UNREADABLE` into `[]`. With no bills and an empty desk it then said "Nothing waiting on you", even when a booking fee could be unpaid, which is the opposite of what the code's own comment intends. The unread bill list now marks the desk incomplete, so Today shows its existing "Some answers couldn't load — this list may be missing a booking ask or a payment" row and drops the count.
- Guarded in `_components/an-unread-desk-is-not-caught-up.test.ts`.

SPEC IMPACT: None.
