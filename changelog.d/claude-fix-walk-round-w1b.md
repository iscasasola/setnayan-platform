## 2026-11-13 · fix(supplier+couple): W1 walk booking round — the Portfolio address, the delivered box

- **F-W1-64** `/vendor-dashboard/portfolio` (a 404) now goes to the Portfolio, `/vendor-dashboard/collections`
  (next.config redirect, exact source).
- **F-W1-72** The couple's "Also mark this supplier delivered" starts UNTICKED and is offered only once the event's day
  has passed (a refused or empty date read offers nothing). It was pre-ticked 179 days early with ₱0 paid.

SPEC IMPACT: None.
