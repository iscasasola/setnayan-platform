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
- **The couple picks how many** (owner Q2, 19 Nov: "yes it should show"; AVAILABILITY_PLAN AV-PIECE): booking a
  by-the-piece card asks "How many ‹card› do you need?" first (`set_asked_quantity`; told honestly when not enough are
  free; an ask holds nothing). The supplier's Agree shows that number and may change it (`set_booked_quantity`).
- **No double booking, in the database:** the yes (`vendor_agree_to_lock`) now refuses when out + this booking's
  pieces > the card's number — before, it compared out >= number only, so two 100-chair yeses with 320 of 500 out
  could both land — under ONE lock per shop (`lock_shop_day_counts`, also taken by `set_booked_quantity`).
  `acquire_schedule_pools()` carries quantity, all or nothing. ONE count (`schedule_pool_taken_on`) is read by the
  schedule gate, the bench search's mirror (`service_cards_unbookable_on`) and the Clients day bar
  (`vendor_day_pool_taken`), so they cannot disagree. Every booking that is not by the piece is refused exactly as
  before.
- A schedule whose cards all rent by the piece may hold more than 500 (ruling 3).

New column `event_vendors.booked_quantity` (NULL = one), written only by `set_booked_quantity` (a trigger refuses a
browser session). Migration `20271352068061_a_booking_takes_its_pieces_all_or_nothing`. Motions: none.

SPEC IMPACT: None — builds the approved step 4 drawing as ruled. (The drawing says "chairs"; cards have no noun field,
so the bar says "pieces" and names the card.)
