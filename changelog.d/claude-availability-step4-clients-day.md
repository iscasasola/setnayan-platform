## 2026-11-19 · feat(clients-day): Availability plan step 4 — the day counts orders and pieces, nothing double booked

The Clients day (Clients › Dates › a day) reads each schedule by its cards' Availability style (owner "ok" to every
pick on `prototypes/availability_steps_3_4_2026-11-19.html`, DECISION_LOG 2026-11-19 "AVAILABILITY STEPS 3 AND 4
APPROVED"):

- **Each group heading names its style in plain words** ("Made to order", "By the piece") — no AV codes (owner, final
  drawing `spaces_final_screens_2026-11-19.html`, DECISION_LOG ba647712).
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
- **The supplier says how many** (owner Q2, 20 Nov: NO — the couple's picker is withdrawn): a couple's ask on a
  by-the-piece card carries no number and never shows the stock; the supplier types how many they can give at the yes
  (`set_booked_quantity`), and a piece yes with no number is refused (`pieces_needed`), never one piece by default.
- **No double booking, in the database:** the yes (`vendor_agree_to_lock`) now refuses when out + this booking's
  pieces > the card's number — before, it compared out >= number only, so two 100-chair yeses with 320 of 500 out
  could both land — under ONE lock per shop (`lock_shop_day_counts`, also taken by `set_booked_quantity`).
  `acquire_schedule_pools()` carries quantity, all or nothing. ONE count (`schedule_pool_taken_on`) is read by the
  schedule gate, the bench search's mirror (`service_cards_unbookable_on`) and the Clients day bar
  (`vendor_day_pool_taken`), so they cannot disagree. Every booking that is not by the piece is refused exactly as
  before.
- Rented by the piece has no cap above 500 (ruling 3) on the CARD's own "How many do you have"; a schedule keeps its 1..500 and never holds pieces.

- **Usual preparation time** (card maker, Made to order only, `vendor_services.usual_prep_days`, 0..365): the days an
  order is being made before its date. Kept apart from "Order at least" (the couple's rule). Branch copies carry it.
  `event_vendors.prep_days` is THIS order's own time (NULL = the card's) — no writer yet: 2b's accept sheet adds it.
  The hard refusal (`acquire_schedule_pools`) still counts the due date only until 2b brings the soft warning.

New columns `event_vendors.booked_quantity` (NULL = one; browser-readable like every non-amount column, so the
couple's ask and the supplier's Agree can show it), written only by `set_booked_quantity`, and
`event_vendors.prep_days`, not browser-readable and written only by a definer (the same triggers refuse a browser
session). Migration `20271352068061_a_booking_takes_its_pieces_all_or_nothing`. Motions: none.

SPEC IMPACT: None — builds the approved step 4 drawing as ruled. (The drawing says "180 chairs free": the pieces are
named in the schedule's own word — its label, lower case — and "pieces" only when a schedule has no name.)

**Review fixes (19 Nov):** a failed or refused pieces write stops the supplier's yes instead of agreeing on the couple's number · a refused day count reads "Couldn't read", never "Free" · ONE number for pieces: the yes, the deposit gate (`acquire_schedule_pools`), `set_booked_quantity`, the bench mirror and the Day bar all hold pieces to the card's own "How many do you have" (`service_card_daily_limit`), never the schedule's "how many a day"; the schedule keeps its 1..500 (the >500 piece-schedule change is withdrawn) · a branch copy clamps to 500, not 50 · the couple's pieces popup no longer shows how many the supplier has · a full day reads "All 500 pieces out" / "5 of 5 orders in progress".

**Review fixes (20 Nov):** every writer of a booking's pieces locks in ONE order — the booking row, then the card, then
the shop's one count lock — so `set_booked_quantity` (drafted card → booking) can no longer deadlock against
`vendor_agree_to_lock` · the couple's ask (`set_asked_quantity`) locks the booking row before it reads its status, and
its write carries the status predicate, so an ask racing the supplier's yes can never rewrite a contracted booking's
number · a door with no "how many" field (Book this build, pending lock proposals) keeps the couple's earlier number;
with none anywhere the couple is sent to the supplier's card (`pieces_needed`), never a dead end · the pieces ask runs
on the time-slot path too, and the yes counts a slotted piece card by its pieces · the supplier's "how many" field
shows on every piece card (no "You have N" until the card has a number) · "180 chairs free", as drawn · DB tests 12–14
(lock order read from each function's code, the kept number, the slotted piece card).

**Re-review (20 Nov, second pass) · owner Q2 = NO:** the couple's "How many do you need?" picker
(`PiecesPickerModal`, `lockPiecesAsk`) and its definer `set_asked_quantity` are removed — the migration is unapplied, so
the function never reaches production. A couple never sees the stock and never states a number; the supplier gives it
at the yes. One of the schedule's word reads singular ("1 chair free"). DB test 6 now proves there is no couple-side
writer and the supplier's number is what the yes takes; the old tests 12 (ask part) and 13 (kept ask number) go with it. Owner,
verbatim: *"No, keep the ruling — remove the picker"*. A piece ask that is sent says "Ask sent. ‹shop› will tell you how
many they can give." on the lock button and in the pending proposals (`lock_requested` now carries `byThePiece`), and
a sent ask in the pending proposals reads "Ask sent", no longer "needs a few details".
