## 2026-11-14 · style(supplier): RW-286b — the service card's Edit and Share at 44

- **RW-286b** (re-walk of #7663's T02/T04 size round, live e8be0ee) The service card's two icon buttons, Edit and
  "Share to a client", were drawn 40×40 by the card row; they are 44×44 now, one size for both (the row's guard moves
  with them). Shared row only; no new server action.
- Not changed here, each named in the PR with why: the pill selector's 38 px drawing is the owner's 2026-10-12 shared
  rule (its press already reaches 46); the shared `.input-field` already draws at 44 and the offer amount box at 48, so
  the measured 40s there need the exact element before anything moves; the service maker's 40 px row icons are
  decoration, not a press.

SPEC IMPACT: None.
