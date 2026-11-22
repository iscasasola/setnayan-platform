## 2026-11-20 · feat(spaces): Shop › Spaces — halls, rooms and rentals on schedule pools; #7968 reworked into it

The 19 Nov rulings (DECISION_LOG "Spaces on the Shop" → "SHOP PAGE FINAL + SPACES COMBINED WITH ROOMS & SEATING"),
built to specs `prototypes/spaces_final_screens_2026-11-19.html`:

- **Storage** (`20271356372536_spaces_on_schedule_pools`, needs controller GO after SHIP): a space IS a
  `vendor_schedule_pools` row with a `space_kind` (hall · room · cart · clothing · object · vehicle · item). Booked-whole kinds
  are `is_hall`, so the shipped Uses pick, booking seat per pool and day view serve them unchanged; objects and clothing are
  counted (`space_count`, `in_repair_count`). Plus Floor size, Connects to (both ways, same shop only), a room's floor and
  each kind's own rows. Existing halls become `space_kind = 'hall'`. #7968's tables and doors hang on a hall or room
  (`pool_id`); its floors/dining areas table is dropped. Every CHECK is written so it cannot pass by evaluating to NULL.
- **Screen** `/vendor-dashboard/spaces` (replaces #7968's `/vendor-dashboard/rooms-seating`): tile grid with a date pick,
  each tile saying what holds it that day; one search-or-add box + the sliders (Show: All + six kinds); one sheet for all
  kinds (Name given below Pro behind the shared 🔒, typed on Pro; How many → a numbered run with a preview; Hall or room ·
  Seated · Standing · Floor size · Connects to; the five other kinds' rows; More; Base layout = #7968's tables and doors
  with the shared plan maker); "Add another like this"; Remove refused while booked or used by a card.
- **Tile** "Spaces" in Shop › Specialized tools, right after Scanner, shown once the shop has a space (counted in the
  Shop page's existing read). The "Rooms & seating" tile is gone.
- **Locks** `space_floor_plan` and `space_names` in `lib/locks.ts` (Pro and up; inert while the paywall switch is off),
  refused on the server too.
- **Admin** a read-only Spaces fold on `/admin/vendors/[id]`, after Services.

SPEC IMPACT: None to the corpus wording. The build follows the approved drawing; its parity gaps and the four open
questions are in the PR's STATUS (Your halls move, Uses-pick "add the first", room numbers readable through the pools'
public-read policy, Start from this hall).

## 2026-11-22 · fix(spaces): the ship review's findings, and "add the first" on a venue card

- **A way in (finding 1).** A venue card with no hall shows the drawing's screen-8 row "Uses · None yet ▾" →
  "＋ Add a hall · For your shop" / "＋ Add something else"; the Spaces sheet opens in place (loaded on the pick) and
  the Spaces tile appears once the first is saved. A hall made in Clients ⚙ › Teams and days (`createCalendar`) is now
  `space_kind = 'hall'`, so it shows on Spaces at once.
- **Rentals stay out of the halls and schedules (finding 2).** One filter, `SCHEDULE_OR_HALL_POOLS`
  (`lib/schedule-pool-kinds.ts`), on every pre-Spaces reader: a venue card's halls pick, `setServiceHalls`, moving a
  category onto a schedule, Teams and days, a card's Schedule pick, Today, a chat's day answer and Check a date. They
  keep a team schedule, a hall and a room, as before Spaces.
- **Migration** `20271356372536`: `SET LOCAL lock_timeout = '5s'` (finding 3). Still needs SHIP + GO.
- **Hall size** follows the 21 Nov ruling: the space row is the truth; `vendor_profiles.venue_*` is only read, as the
  first hall's prefill. No code in this train writes it.
- **Low findings:** "Connects to" also frees whoever pointed at the new hall; a typed name's `%` and `_` are matched
  literally; removing a space says when the unlink fails. Every update and delete asks which rows changed and says
  "You can't change this" on zero (#7968's review, finding 2, fixed here where its actions now live); a refused re-read
  refuses a table move instead of skipping the plan check.
- Guards: `lib/schedule-pool-kinds.test.ts` (3) · `spaces/the-locks-are-on-the-server.test.ts` (+4).

SPEC IMPACT: None — implements the 19 Nov drawing's screen 8 "add the first" and the 21 Nov hall-size ruling.
