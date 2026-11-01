## 2026-10-29 · feat(supplier-hub): the supplier's Event Hub (the live day-of page) in the v13 frame — one row, three views

Owner, 29 Oct (supplier dashboard v13, *"Approved."*); prototype `renderEventHub` · `hubScanner` · `hubAnnounce`.
Builder S6, slice 2 of 3 — stacked on the Hub set-up slice. A restyle, not a rebuild: every shipped part stays.

- **One row** (`live/[eventId]/_components/event-hub-bar.tsx`): ‹ Exit (back to the Hub on this event) · **Event Hub ·
  <event> · <day> ▾** — The Day · Scanner · Announce, each its own address (`?view=`, `lib/event-hub-views.ts`) · 💬
  this event's chat · ⓘ the event in a sentence. From 701 it moves up into the shell's pinned row (the Hub's slot).
- **Now · Next · Coming** under it: Now/Next are the run of show's own (`deriveRunOfShow`, wall-clock times);
  Coming is the RSVP headcount and says so — a supplier cannot read arrivals yet, so no arrival count is invented.
- **The Day** = the console as shipped (the focal clock, run of show, the march, headcount, tools, live reviews, the
  specialization desk — Floor Command's requests, move/hold and seat finder; the song desk; the stage script), with the
  offline copy's mark on the focal card.
- **Scanner** = doors into the shipped tools: Find a guest's seat (the floor desk's `#seat-finder`, only when that desk
  is yours) and the hosts' Check-in desk for an event you run; otherwise it says the per-service scanner is set under
  Shop › Services.
- **Announce** = the couple's shipped composer (`AnnounceButton` → `sendCoordinatorBroadcast`) for the coordinator the
  hosts let announce, under the feature's own switch; anyone else is told who announces.
- Lab: `/dev/supplier-lab?s=event-hub&shell=1&view=day|scanner|announce`.

Guard: `live/[eventId]/the-event-hub-is-one-row-three-views.test.ts`.

SPEC IMPACT: None — builds the approved v13 prototype; no new decision.
