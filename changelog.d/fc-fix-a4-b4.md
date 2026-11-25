## 2026-11-25 · fix(guest): the Event Hub says what it knows (final check, area 4, batch 4)

Final check fixer, area 4 (Guest), lane A batch 4 — Event Hub readers and offline words:

- `offline.html`: no longer promises "any pages you've already opened are still available"; it names what is kept
  (the event's main page and Find my table) (A4-01).
- The day-of banner no longer promises the QR and venue info "work offline if WiFi cuts out" (A4-23).
- The supplier desk on the Event Hub says "Couldn't read the running order" on a refused read, never "hasn't written
  the timeline yet" (A4-22).
- `/[slug]/everyone`: "Also coming" lists only a Yes from someone who counts toward the event (`countsTowardEvent`) —
  a stranger's pending request is not listed (A4-30).
- `/[slug]/find-my-table`: the entrance comes from the one reader, `fetchEntrance` (the floor plan's door wins), the
  same door `/seat` and `/find-seat` draw (A4-33).
- `/[slug]/seat`, `/find-seat`, `/find-my-table`: tables come from the couple's one seat-plan reader, `lib/seating.ts`
  `fetchTables` (one order, one clean-up); `/seat`'s own copy shadowed the shared name. Each page still answers a
  refused read honestly (A4-34).
- `/[slug]/find-seat`: the door reads "Open your invitation", never "Confirm your Booking" (A4-35).
- `/[slug]/seat`: a failed alerts subscribe keeps the ask and says "Alerts didn't turn on", instead of vanishing
  (A4-52, the silent half; whether anything SENDS is the owner's call).

Held by `apps/web/app/[slug]/the-hub-says-what-it-knows.test.ts`; two entourage guards accept the wider guest read.

SPEC IMPACT: None — wording and honest-state fixes under existing rules.
