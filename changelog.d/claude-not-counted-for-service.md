## 2026-11-02 · feat(guests): "Not counted for ▾" — a guest who comes, left out of one booked service's headcount [migration]

Owner-approved 2026-11-02 (DECISION_LOG "NOT COUNTED FOR ▾"). Owner, verbatim: *"a dropdown above passed away or a place to
set this. it will list all booked services to pick if they are not counted?"* → *"yes. just to prevent caterers counting
attendees not counted"*.

- **Guest card:** one "Not counted for ▾" tick dropdown (the shared PickMenu, multi-select: a tick keeps it open, Done
  closes it) directly ABOVE Passed Away. It lists the event's BOOKED services (`event_vendors` in contracted · deposit
  paid · delivered · complete). Nothing ticked = "Counted for all" (the default). Like Passed Away it sits outside the
  autosave form and posts with it by `form=`, with a `not_counted_posted` marker so a form without the row never
  changes anything. Never for the couple or a guest who passed away; not drawn while nothing is booked, nor from a
  refused read. The title and its button stay visible; what it does is in the ⓘ.
- **Save:** `updateGuest` → `syncCardNotCounted` (`lib/guest-not-counted.server.ts`), as a DIFF from the card it started
  from (a tick another host added stays — the `guest-card-merge` rule), on the user's own session (RLS decides).
- **Storage:** `guest_not_counted_for (guest_id, event_vendor_id, event_id)` — migration
  `20271302857885_a_guest_not_counted_for_a_service`. RLS on at CREATE TABLE: the couple (`current_couple_event_ids`)
  and a guest-list helper at edit write; any guest-list helper reads; anon, guests and EVERY supplier read nothing. A
  trigger derives the event from the guest and refuses a booking of another event.
- **Supplier headcounts:** `get_vendor_event_brief` (client page Headcount · Hub / on-the-day pax · supplier desk),
  `get_vendor_catering_metrics` (production sheet) and `get_vendor_seat_plan` (meal counts) are re-copied from
  `20271292712479` with ONE more rule on every guest read — `g.guest_id <> ALL (v_not_counted)`, the guests ticked for
  the caller's booked service (`guests_not_counted_for_services`, callable by no browser role). Every earlier rule
  (request · passed away · represented role holder) is kept. Other services keep counting the guest; the supplier sees
  the number only, never who or why.
- **Guest List:** the row carries a quiet "Not counted for Catering" note.
- **Guards:** `lib/a-guest-not-counted-for-a-service.test.ts` (placement above Passed Away, PickMenu multi, marker, the
  diff, the row note, no supplier-side reader, every supplier guest read ruled) and
  `tests/db/a-guest-not-counted-for-a-service.db.test.ts` (the caterer's count drops in all three readers · the photo
  booth's does not · the supplier cannot read the table, call the helper, or find a guest id in what it is handed ·
  unticking counts them again). Ugat map: `guest_not_counted_for` claimed on joint J3 (Guest → Event).

SPEC IMPACT: None — builds the 2026-11-02 DECISION_LOG row as written. Noted for the corpus: a shop holds ONE booking
per event (`event_vendors_unique_marketplace_pick_per_event`), so "a booked service" and "a supplier on this event" are
the same thing today; the helper still requires EVERY booking it is handed, so a shop is never under-counted if that
ever widens. Papic's pool (`papic_event_guest_headcount`) is not a booked service and is unchanged.
