## 2026-11-19 · feat(clients-day): Availability plan step 4 — the day counts orders and pieces, nothing double booked

The Clients day (Clients › Dates › a day) reads each schedule by its cards' Availability style (owner "ok" to every
pick on `prototypes/availability_steps_3_4_2026-11-19.html`, DECISION_LOG 2026-11-19 "AVAILABILITY STEPS 3 AND 4
APPROVED"):

- **An AV tag on each group heading** ("AV-ORDER · made to order", "AV-PIECE · by the piece").
- **The day bar** (`lib/day-count-bar.ts`, `count-bar.tsx`): Made to order counts orders IN PROGRESS across each
  order's preparation window, not on its due date (owner 19 Nov, DECISION_LOG "AVAILABILITY FINALIZED", "Wrong, fix")
  — "3 of 5 in progress · 2 free", one piece per order up to ten. The count is the database's
  (`schedule_pool_in_progress_on`, returned by `vendor_day_pool_taken` as `in_progress`). Rented by the piece counts the SUM of quantities —
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

- **Usual preparation time** (card maker, Made to order only, `vendor_services.usual_prep_days`, 0..365): the days an
  order is being made before its date. Kept apart from "Order at least" (the couple's rule). Branch copies carry it.
  `event_vendors.prep_days` is THIS order's own time (NULL = the card's) — no writer yet: 2b's accept sheet adds it.
  The hard refusal (`acquire_schedule_pools`) still counts the due date only until 2b brings the soft warning.

New columns `event_vendors.booked_quantity` (NULL = one), written only by `set_booked_quantity`, and
`event_vendors.prep_days`, not browser-readable and written only by a definer (the same triggers refuse a browser
session). Migration `20271352068061_a_booking_takes_its_pieces_all_or_nothing`. Motions: none.

SPEC IMPACT: None — builds the approved step 4 drawing as ruled. (The drawing says "chairs"; cards have no noun field,
so the bar says "pieces" and names the card.)
