## 2026-10-04 · feat(maker): venues get a pin and a picked city, wait for Apply · Date gets the ceremony time

B4 (`INVITATION_RSVP_GUEST_FLOW_REMAINING_2026-10-04.md` § B4), built from the
approved design `prototypes/maker_venues_pin_and_time_2026-10-04_fable.html`
and the owner's 2026-10-04 "YES TO ALL" answers.

**Venues (Event Hub Maker › Event Details › Your event › Venues).**
- A booked venue shows the supplier's name, address and pin, and follows the
  booking (the shipped "Use the supplier's details / Enter your own" dropdown).
- "Enter your own" = the name + the shipped `AddressPinField` (exact address ·
  Find · the crosshair map · the Pinned-at line) + the photo. The field gained
  two props, not a fork: `hideHints` (its two hint lines, Maker only) and
  `onChange` (a caller with no form).
- City or area is ONE dropdown on onboarding's own list (`CityPick`: search ·
  Near me · km; the PSGC list loads lazily, as onboarding loads it) — never
  typed, one per event (the reception's), pre-filled from the reception pin by
  nearest km. `hubDraftAction` refuses a name not on the list
  (`lib/listed-place.ts`).
- Everything now goes to the Event Hub DRAFT and is published at Apply:
  `HUB_DRAFT_VENUE_COLUMNS` (names, street addresses, both pins, the city) and
  each card's source/photo (`widgets.venue_map.venue`). The Apply badge counts
  the venues once. "Saves immediately" is gone from the venue rows. Apply writes
  the reception pin into `events.venue_latitude/longitude` (the event's own
  distance + coverage anchor).
- The ceremony gets its own pin: migration `20271263730696_ceremony_venue_pin`
  (`events.ceremony_venue_latitude/longitude`, both-or-neither, SELECT+UPDATE
  to `authenticated`, `events_host` rebuilt). Guests' Directions use it
  (`resolveEventVenues`); it closes until the guest replies (`withheldVenue`).

**Date.** A "Ceremony time" line (the phone's time picker) under the date,
drafted as `ceremony_time` (not an `events` column). At Apply it creates the
Schedule's Ceremony block on the event's day when there is none, else moves its
time (its end and its parts with it) — the same block the invitation prints
(`ceremonyBlock` · `blockTime`); a date that moves takes the ceremony with it
(`lib/ceremony-time.server.ts`). With no single day yet it waits in the draft
("needs your day first"). The Maker's invitation preview draws the drafted
time (and drafted names/date) before Apply: each on-screen preview address
carries a `draft=` hash and the print route lays exactly those keys on
(`lib/ceremony-time.ts` `PRINT_DRAFTED_KEYS`); saved/printed files stay live.

Opening Venues or Date never writes. Tests:
`lib/the-venues-and-ceremony-time-wait-for-apply.test.ts`,
`tests/db/venues-and-ceremony-time-wait-for-apply.db.test.ts` (as the couple's
session, through the real `writeHubDraft` and `placeCeremonyBlock`).

SPEC IMPACT: DECISION_LOG.md — new 2026-10-04 row "B4 BUILT — VENUES GET A PIN
AND A PICKED CITY, WAIT FOR APPLY; DATE GETS THE CEREMONY TIME" (as built, incl.
the one schema addition and the "it already does in the Schedule" correction);
`INVITATION_RSVP_GUEST_FLOW_REMAINING_2026-10-04.md` § B4 status line.
