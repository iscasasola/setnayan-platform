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
