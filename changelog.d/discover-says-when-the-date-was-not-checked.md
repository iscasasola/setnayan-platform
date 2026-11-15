## 2026-11-13 · fix(suppliers): Discover says "Couldn't check who's free on <date>" when the capacity read fails

Audit of #7556. Discover hides suppliers who are full on the couple's date. When the capacity read failed, the
hide removed nobody — correct — but the read answered with an empty set, which means "checked, everybody is free",
so the page drew every supplier under a date it had promised to filter by and nothing on screen differed from a
real check.

- `lib/bench-bookable-days.server.ts`: new `readSuppliersWithNoBookingLeft` returns `null` on any failed read
  (cards query, `service_cards_unbookable_on`, a throw). `findSuppliersWithNoBookingLeft` is now a fold of it
  (`?? new Set()`), so Find's bench search behaves exactly as before.
- `lib/discover-shows-what-fits.ts`: `keepSuppliersThatFit` / `keepCardsThatFit` take `null` for an unread answer
  (capacity, or "who the couple knows" when somebody is full) and return `checked: false`; every row stays.
- `app/(shell)/explore/_lib/marketplace-view.tsx`: Discover reads the un-folded answer, and when either judgement
  came back unchecked draws one line above the results, rows or not:
  "Couldn't check who's free on Sat, Dec 12, 2026. Some of these suppliers may already be booked."
  (month form: "…in December 2026."). Words in `lib/supplier-find-empty.ts` (`dateUncheckedWords`).
- Test: `lib/find-shows-only-what-can-be-booked.test.ts` — a failed read keeps every row AND reports
  `checked: false`; the words; the page draws the line above the results. Sabotaged once (a null read reported as
  checked) → red.

SPEC IMPACT: None — implements the owner's existing rule that a failed read never renders as success.
