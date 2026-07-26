## 2026-07-26 · feat(fees): a package now pays a booking fee — once, on the agreed total (§6.4)

`lockPackage` **never called the fee collector at all**. On flag-flip a package
booked for **₱0 in fees** regardless of size. Closes §6.4.

### Where the fee fires, and why there

On the **anchor** — the one row carrying `total_cost_php` = the whole number the
couple accepted. Owner-locked base (2026-07-26): *"the package price the couple
agreed to."*

Calling it per cascaded row instead would have priced the largest single **line**
(the ₱145,000 package in the journey test bills off a ₱90,000 line → ₱4,500
instead of ₱5,450) and, worse, burned **one of the vendor's five free bookings
per service** while freezing a ledger ordinal that is only ever computed once.

### The DB guard — why "careful callers" wasn't enough

`booking_fee_open_lock_charge` now refuses a covered row outright
(`covered_row_no_fee`).

The spec is explicit that the safety claim is *not* "the RPC skips a covered row
because its total is NULL". **It does not skip:** the RPC `COALESCE`s a NULL
total to 0, then still inserts a ledger row and freezes a free-5 ordinal. The ₱0
outcome comes only from `booking_fee_centavos(0)` short-circuiting. So a covered
row would have consumed a free booking and frozen an ordinal permanently —
silently, and unrecoverably.

### Also corrected

`primary_event_vendor_id` was picked by heuristic — venue category, else the
package's primary service, else *whichever row came back first*. That could land
on a covered row carrying no money. It is now the anchor, by construction.

**Tests:** the journey now warms a vendor past their five free bookings and
asserts the 6th bills **₱5,450** (the taper on ₱145,000), that a covered row is
refused, and that the whole package produces **exactly one** charge.
Falsifiable — deleting the guard turns it red. **4029 unit + 318 DB green**,
`tsc` exit=0, `next lint` exit=0. Ships dark behind
`NEXT_PUBLIC_BOOKING_FEE_ENABLED`; fail-soft, so a fee problem can never fail a
couple's booking.

SPEC IMPACT: §6.4 done — `HANDOFF_Package_Wave_2026-07-26.md`. The money path is
now complete end to end: authoring → choices → credit → lock → fee. Remaining
from the build spec: M2 (credit options + policy) and M3 (spend ledger) — ⚠ M2's
draft uses `'expire'/'refund'` while the shipped column is
`'expiring'/'refundable'`; reconcile before building it.
