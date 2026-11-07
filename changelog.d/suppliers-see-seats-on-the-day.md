## 2026-11-03 · fix(seating): a booked supplier sees the seat plan on the day, like the guests do

Supplier go-live audit E2 (2 Nov). Owner 2026-09-30: "seatplan will show on the date of the event" — the guests got that rule as `public.guests_may_see_seats()`, but the two supplier readers kept asking the couple's "Show guests their seats early" switch alone. On the event day a booked caterer or venue whose couple never flipped "early" was told "The couple hasn't published their seating plan yet" while every guest at the door could see their table.

- Migration `20271304542745_suppliers_see_seats_on_the_day`: `get_vendor_seat_plan` and `get_vendor_event_brief` re-stated from their latest bodies with ONE line each changed (marked 🪑) — the seat-plan gate and the brief's `seat_plan.published` now ask `guests_may_see_seats(p_event_id)`. Fee gate, booking and category gates untouched; grants unchanged.
- Guard: `lib/guests-may-see-seats.test.ts` now also holds the two supplier readers to the rule.
- DB test `tests/db/suppliers-see-seats-on-the-day.db.test.ts`: before the day + switch off → closed; on the day (Manila) + switch off → opens with its table; early switch → opens. Red without the migration (the on-the-day case), green with it.

SPEC IMPACT: None — applies the 2026-09-30 seat rule to the supplier side; no new decision.
