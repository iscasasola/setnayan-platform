## 2026-11-19 · feat(clients-day): Availability plan step 4 — the day counts orders and pieces, nothing double booked

The Clients day (Clients › Dates › a day) reads each schedule by its cards' Availability style (owner "ok" to every
pick on `prototypes/availability_steps_3_4_2026-11-19.html`, DECISION_LOG 2026-11-19 "AVAILABILITY STEPS 3 AND 4
APPROVED"):

- **An AV tag on each group heading** ("AV-ORDER · made to order", "AV-PIECE · by the piece").
- **The day bar** (`lib/day-count-bar.ts`, `count-bar.tsx`): Made to order counts orders by the date they are due —
  "3 of 5 orders due · 2 free", one piece per order up to ten. Rented by the piece counts the SUM of quantities —
  "320 of 500 out · 180 free", a bar above ten. The dot is green when all are free, yellow when some are left, black
  when full; the words always say it too. A refused read says "Couldn't read how many are out", never "0 out".
- **The answer line sums the free counts** ("2 orders and 180 pieces free").
- **On a computer, two columns:** the groups and bars on the left (tools row under it), the tapped group's bookings on
  the right (`?grp=`).
- **Always available cards are never on the day** and never counted.
- **The supplier types the piece quantity when accepting** (ruling 2): Agree on a by-the-piece ask carries "How many
  ‹card› they need". `set_booked_quantity` takes them all or nothing, against the card's own number and every schedule
  the booking holds. The couple's picker is step 6.
- **No double booking:** `acquire_schedule_pools()` carries quantity — a booking takes its N pieces on every schedule
  it spans, all or nothing, under the same locks. Every booking that is not by the piece is refused exactly as before.
- A schedule whose cards all rent by the piece may hold more than 500 (ruling 3).

New column `event_vendors.booked_quantity` (NULL = one), written only by `set_booked_quantity` (a trigger refuses a
browser session). Migration `20271352068061_a_booking_takes_its_pieces_all_or_nothing`. Motions: none.

SPEC IMPACT: None — builds the approved step 4 drawing as ruled. (The drawing says "chairs"; cards have no noun field,
so the bar says "pieces" and names the card.)
