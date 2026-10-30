## 2026-10-30 · feat(supplier-customers): Dates and Money on the v13 frame — figures on the pinned row, the week strip, "Open for bookings"

Supplier dashboard v13 (APPROVED 2026-10-29), slice S4 — Customers › Dates · Money, extended in place inside the
shipped frame (#7051). Nothing redrawn: the month, the folds, the day switch, the payment rows and the fee rows are the
shipped ones.

- **The figures ride the pinned row** (DECISION_LOG "EVERY SUPPLIER-DASHBOARD PAGE: THE TOP ROWS COMPRESS INTO ONE PINNED
  ROW ON SCROLL"). Dates: booked · asking · days off for the month on show; Money: Received · To come in · Overdue. One
  new tile (`customers/_components/customers-figures.tsx`), the same look as Events' doors, folded by the shared
  `usePinFold`. `CustomersPin` gains one `figures` slot in the doors' place. Dates' figures are counted by the month
  (`customers/dates-figures.ts`) and follow ‹ ›; a tap picks the first day of that kind. Money's are the one money
  picture (`customers/money-pin-figures.ts`); each is a door to its rows. Unread → "—" and "couldn't load", never 0.
- **The week strip** — once the month scrolls up under the pinned row, the picked day's week pins under it, ‹ › a day
  (across a month's edge too). The Dates folds now sit inside the month's block so the strip stays pinned over them.
- **"Open for bookings"** — the day switch's v13 words ("Off = blocked · couples can't ask for it"); same writes.
- **Money** — the two big figures left the body (they are on the row now); the meter and its honest line stay. The
  eyebrows are v13's: Payments ⓘ (with the Next in ▾ window) and What you owe Setnayan ⓘ.
- Guard: `customers/the-customers-figures-are-the-pinned-row.test.ts`.

SPEC IMPACT: None — builds the approved v13 prototype (`carry-2026-10-29/supplier-dashboard-proto/`) and the recorded
2026-10-29 rulings; no decision changes.
