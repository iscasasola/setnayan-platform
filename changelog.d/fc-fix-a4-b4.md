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
- `/[slug]/seat`, `/find-seat`, `/find-my-table`: tables come from one guest-safe reader, `lib/seating.ts`
  `fetchPublicTables` (the seat plan's order and clean-up, and only the columns the map draws, so no table's QR token
  reaches the browser); `/seat`'s own copy shadowed the shared name. Each page still answers a refused read honestly
  (A4-34).
- `/[slug]/find-seat`: the door reads "Open your invitation", never "Confirm your Booking" (A4-35).
- `/[slug]/seat`: the "We'll let you know if your table changes" alerts ask is hidden until something sends them
  (owner ruling, Add 34 · A4-52): it is gated on `TABLE_CHANGE_ALERTS_SEND` (`lib/table-change-alerts.ts`, off), and a
  guard fails if it is turned on while nothing reads `guest_push_subscriptions`. A failed subscribe still says so.
- A signed-in account that holds the seat sees its own table and pass (owner ruling, Add 34 · A4-B11):
  `/[slug]/find-my-table` and `/[slug]/seat` read `readGuestSessionForEvent` (the invite-link cookie, else the
  account's own seat — the resolver `/find-seat` and the Hub use); `/api/guest/qr` and `/api/guest/pass-card` take
  `?event=` through `readGuestSessionForPassRoute`, and the Hub's ticket card names its event on both. Only that
  account's own seat: an account with no seat, or another guest's, still gets the invite-link message.

Held by `apps/web/app/[slug]/the-hub-says-what-it-knows.test.ts` and `apps/web/app/[slug]/a-seat-holder-opens-its-own-pass.test.ts`;
two entourage guards accept the wider guest read; `notifications-finally-have-a-subscriber.test.ts` and
`guest-can-keep-their-code.test.ts` are re-aimed to the owner ruling (Add 34).

SPEC IMPACT: None — wording and honest-state fixes under existing rules, and the owner's Add 34 rulings (already in the
brief: `build-sessions/FINAL-CHECK-OWNER-ADDS-2026-11-25.md`).
