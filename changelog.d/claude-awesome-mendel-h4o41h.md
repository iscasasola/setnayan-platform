## 2026-10-01 · feat(event-details): one information-only Event Details sheet, opened from Event Home

Lane 4 of `WEDDING_ONBOARDING_HUB_SETUP_EVENT_DETAILS_BUILD_SPEC_2026-10-01.md`
(design `event_details_one_page_2026-10-01_fable`; DECISION_LOG 2026-10-01
"EVENT DETAILS LIVES ON EVENT HOME" → "EVENT DETAILS IS INFORMATION ONLY" →
"CONTROLLER DEFAULTS APPROVED").

- `/dashboard/[eventId]/details` ("Personalization") is now **Event Details**:
  thirteen read-out sections — The basics · Key dates · Venues · Guests ·
  Budget · Your suppliers · Services · Purchases · Your Event Hub look · Love
  Story · What everyone wears · RSVP · Put this away. Each row reads the field
  its own app writes (no copy, no new table, no new server action); each section
  has one quiet "Open … ›" to the page that handles it. An empty fact reads
  "Not set yet", a failed read "Could not load this…", a part a helper was not
  given "Hidden by the couple" — never alike. Rows a booking governs carry a
  lock that opens "Locked by your booking" + Contact support (zero JS).
- Key dates shows the next 2 supplier payments; a coordinator refused the budget
  sees "Hidden by the couple"; Services opens the services hub; Purchases opens
  the orders list (owner-approved controller defaults).
- Fixed live bugs: the ceremony venue read "Not set" while a parish was booked,
  the reception showed its setting type ("Banquet hall") as the venue — venues
  now come from the confirmed bookings, locked only; "vendors" → "suppliers".
- The shipped editors (names, area, budget target, birth data, repeat, who is
  celebrated, kind · venue settings · guest count · date, guest-list closing
  date, how costs are shown) MOVED WHOLE to `/details/change` ("Event
  settings") — several of those facts have no other editor, so dropping them
  would have stranded them. Event Details' "Open Event settings ›" is the door.
- Event Home: an **Event Details** button beside the event name on the cover.
- The Maker's "Details" tab is renamed **"Your info"** (label only).
- Guard: `app/dashboard/[eventId]/details/event-details-shows-the-map.test.ts`
  — every one of THE MAP's 22 Event-Details rows renders in its own section
  (count), the sheet mounts no editor, the moved editors keep their door,
  empty/failed/hidden stay three words, no "vendor" in its copy, and the Home
  button sits on the cover. Port baseline regenerated (the four editors move
  from `/details` to `/details/change`).

SPEC IMPACT: None — builds the approved spec as written. One builder call is
recorded for the owner: the Personalization editors were moved to "Event
settings" rather than deleted, because region, the guest-list closing date,
the cost view, birth data, the repeat and who-is-celebrated have no other
editor today.
