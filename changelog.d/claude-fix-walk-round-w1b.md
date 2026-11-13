## 2026-11-13 · fix(supplier+couple): W1 walk booking round — the Portfolio address, the delivered box

- **F-W1-64** `/vendor-dashboard/portfolio` (a 404) now goes to the Portfolio, `/vendor-dashboard/collections`
  (next.config redirect, exact source).
- **F-W1-72** The couple's "Also mark this supplier delivered" starts UNTICKED and is offered only once the event's day
  has passed (a refused or empty date read offers nothing). It was pre-ticked 179 days early with ₱0 paid.
- **F-W1-70** The couple's Suppliers row read a booking as "booked" only from a schedule-pool hold; an in-app booking
  (quote → ask → agree) is `contracted` with no hold, so the row stayed an inquiry ("Sent today"). The booking row's
  own `contracted` / `deposit_paid` status now counts as booked.
- **F-W1-65** Not a code bug: "Booked" on Today counts booked events DATED this Manila month (owner Q2 default; the
  full row says "this month"). The walk's booking is May 2027, so November reads 0.

SPEC IMPACT: None.
