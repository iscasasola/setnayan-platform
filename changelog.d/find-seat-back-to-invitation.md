## 2026-09-28 · fix(find-seat): "Back to the invitation" lands on the invitation with its Event Bar, not the front cover

Owner: *"pressing this lead be back to invitation but the actual invitation with
event bar."* The round back button (and the two "Back to the invitation" text
links) on `/[slug]/find-seat` were a bare `/${slug}` — the Event Hub's front
door, which opens on the hero scene and, on a Pro theme, replays the couple's
opening over it (the hub's `RevealOverlay` is `oncePerVisit="defer"` and never
records itself as seen).

- Guests now land on `/${slug}#site-details` — the Details scene that holds the
  seat door — with the Event Bar pinned. The hash makes `landedOnTheFirstPage`
  stand the first-page opening down. The invitation's own view params the page
  was opened with (`phase`, `as`, `invite`) are carried back so the stage holds.
- Inside the Maker's canvas the button sends the frame back to its OWN `src`
  (`/slug?editor=1&phase=…`), never to the plain guest page.
- A plain `<a>`, measured: a client-side push to `/rosa-ben#site-details` stayed
  at `scrollY 0` (the hero); a document load landed on The Details (`scrollY
  734`) with the bar pinned (test event rosa-ben, 390 px).
- One component (`SeatBackLink`) for all three back links; pure address logic in
  `app/[slug]/find-seat/_lib/back-to-the-invitation.ts`; guarded by
  `app/[slug]/find-seat/back-lands-on-the-invitation.test.ts`.

Not covered: on the Save the Date stage the film takeover still plays on a
return (the seat door is not on that stage's bar; only the venue QR reaches it).

SPEC IMPACT: None.
