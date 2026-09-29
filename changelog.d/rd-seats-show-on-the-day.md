## 2026-09-30 · feat(seating): guests' seats show on the event day; tickets carry no table for now

Owner, verbatim: *"seatplan will show on the date of the event"*, then *"so on
their digital ticket, no seat plan for the moment."* and *"seat plan is only on
the day."*

- **One rule, one helper.** `apps/web/lib/guests-may-see-seats.ts`
  (`guestsMaySeeSeats` / `guestsMaySeeSeatsFor`): seats are visible from 00:00
  Manila on `events.event_date` (a multi-day event opens on its first day; only a
  `day`-precision date opens by itself), or earlier only when the couple turns on
  **"Show guests their seats early"** (`event_floor_plan.published_at`, the old
  "Guests see this now" switch). Turning it off before the day hides them again;
  on and after the day it no longer hides anything.
- **Every reader asks it.** Find your seat, the seat pass (table QR + personal),
  Find my table, the hub seat tile, the hub card + its "Find my table" quick link,
  the landing's "Find your seat" pill and the Details seat line
  (`data-seat-door`), the room footer / site nav / everything-else rows (via
  `loadDoorwayFacts`), the guest reminder email's table, the post-event "your own
  day" table, the print pack and the coordinator's floor command.
  `eventSeatingPublished` is deleted.
- **SQL twin.** Migration `20271254054934_seats_show_on_the_day.sql` adds
  `public.guests_may_see_seats(uuid)` (no client role may execute it) and points
  the three guest seat functions at it — `public_venue_scene` (3D walk),
  `public_seat_lookup` (name search), `coordinator_seat_by_guest_qr` — each
  re-stated from its latest definition with only the gate changed.
- **One-time reset of upcoming events** (owner: *"reset all upcoming events to
  'seats only on the day part of the website' they do not need to know their
  seat yet"*). Migration
  `20271254512668_seats_early_stamp_reset_for_upcoming_events.sql` clears
  `event_floor_plan.published_at` for every event whose Manila day has not
  arrived (no date / month-or-year-only counts as upcoming). Past and today
  events, the signs' `qr_published_at`, tables and seat assignments untouched.
  Guarded by `tests/db/seats-early-stamp-reset.db.test.ts`.
- **Printing the table signs no longer opens seats early.** New
  `stampTableSigns` stamps `event_tables.qr_published_at` only; "Publish & print"
  uses it instead of `publishSeating`.
- **Tickets carry no table.** `TICKET_SHOWS_TABLE = false` next to
  `passCardFacts` in `lib/print-layout.ts`; `ticketPass()` strips table + seat
  number from the Digital ticket (PNG), the Printed ticket (PDF) in every style,
  and the Pro zip. Flip the constant to bring it back.
- **Couple copy.** The seat plan switch, its ⓘ, the 3D lab panel and the 3D Plan
  control centre now say "Guests see their seats on the day · Show early · Hide
  until the day".
- Guards: `lib/guests-may-see-seats.test.ts` (rule matrix, reader sweep, door
  sweep, SQL twin), `tests/db/seats-show-on-the-day.db.test.ts`, updated ticket
  tests in `lib/the-pass-card-is-a-card.test.ts`; every guard sabotaged.

SPEC IMPACT: `DECISION_LOG.md` row "SEATS SHOW ON THE EVENT DAY" (supersedes the
2026-09-29 "GUESTS SEE THIS NOW" door as the default; the switch becomes "Show
guests their seats early"; printing signs no longer opens it; tickets carry no
table for now; reset of upcoming events approved 2026-09-30).
