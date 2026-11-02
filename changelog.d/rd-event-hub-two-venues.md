## 2026-09-27 · feat(event-hub): the Venue scene shows both venues — Ceremony and Reception

A wedding has two venues (DECISION_LOG 2026-09-03), but the Event Hub read ONE off
`events.venue_name / venue_address / venue_latitude / venue_longitude`. On `cale-ice` — a
church booked as the ceremony and a hotel booked as the reception, both contracted, the event
row's name and address empty — the Venue scene said "Add your venue."

- **One resolver, `lib/event-venues.ts`.** Ceremony = the confirmed, un-archived
  `religious_venue` / `church_fees` booking (else the couple's typed Save-the-Date ceremony
  name); reception = the confirmed, un-archived `venue` booking (else the event row). Each
  booking's address and pin come from `event_manual_vendors` (added by hand),
  `venue_directory`, or the supplier's `vendor_profiles.hq_*` — only name, category, status and
  location columns are read. The same place twice is one venue, "Ceremony & Reception". An event
  pin is never laid under a booking that has none (it is a first-saved-wins anchor and can be a
  venue the couple never booked).
- **The Venue scene** draws one plate per venue — "Ceremony" / "Reception" — each with its own
  map (when there is a pin) and directions (Google Maps · Waze · Apple Maps from the pin, or a
  Google Maps search on name + address). The details card and the guest's event-details card
  list both the same way.
- **The same privacy gate, never wider.** `withheldVenue` now closes the address and pin of
  EVERY venue, exactly as it closed the event's own; the names stay visible, as `venue_name`
  always did. A guest who has not replied — and a stranger — sees both names, no map, no
  directions, and "The address and directions open as soon as you reply."
- **Every other mention agrees**: the greeting ("— at {ceremony} and {reception}"), the
  masthead line, the keepsake ticket, the 30-day checklist and the Save-the-Date calendar
  location (the first place a guest goes), the seat block (the reception), the day-of hub's
  "Getting there" panel, and the Save-the-Date film + prints (`lib/std-venues.ts` now takes its
  names from the same pick, so there is one query and one answer).
- The Maker no longer calls a scene with two named venues empty (`hasVenueContent` counts them).

Tests: `lib/the-event-hub-shows-both-venues.test.ts` (resolver, loader column list, guest
render, the gate) — each of 10 sabotages caught; `lib/the-venue-opens-after-the-reply.test.ts`
updated for the per-venue plates and the `venuedEvent` hand-off.

SPEC IMPACT: None — implements DECISION_LOG 2026-09-03 ("A WEDDING HAS TWO VENUES") and keeps
the 2026-09-20 / 2026-09-27 "venue opens after the reply" rule unchanged.
