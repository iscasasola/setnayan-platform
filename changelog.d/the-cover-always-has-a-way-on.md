## 2026-10-17 · fix(event-hub): the stranger's door stands in the cover's foot, and reads "Confirm your Booking"

Live on `/cale-ice`, signed out (owner: *"where is the RSVP and swipe marker?"* · *"the button shows after the
cover?"*). Since the Cover Scene took the whole first screen, the stranger's cover was drawn with `foot={false}` — no
RSVP button, no "Swipe up" hint — on the belief that its one door was docked under it. It was not on the first screen:
the photo cover stands in the page's first group and the door in the next, so the door began exactly at the fold
(y 812/812 at 375, y 800/800 at 1280, measured on live 78d4ec3).

- `site-body.tsx`: whenever a stranger's cover is drawn (photo or text), the ONE door moves into its foot — in the RSVP
  button's place, never beside it — with the "Swipe up" hint under it, and is not drawn again below. With no cover
  drawn the door keeps its row, as before. A viewer of that tree who meets no door (the host, a booked supplier, the
  canvas seen as someone else) gets the RSVP button to the shipped reply door instead.
- `pahina-masthead.tsx`: a `door` prop; the door is a cover line, so behind a closed veil it waits for the unveil.
- `get-inside.tsx`: the door reads **"Confirm your Booking"** (owner, verbatim: *"Change the button to 'Confirm your
  Booking'"*), `STRANGER_DOOR_WORDS`; its sub-line and what it opens are unchanged. `inFoot`: no first-screen fit
  around a door already at the cover's foot (an opened door is still brought into view). The seat page's link to the
  door says the same words.
- `lib/cover-scene.ts`: the foot clears the first-visit cookie notice while it is up (`--cookie-banner-top`).
- Guard: `app/[slug]/_components/the-cover-always-has-a-way-on.test.ts` — rendered, every viewer: every cover ends in
  its foot, the foot holds the door XOR the RSVP button plus the hint, the door is a veil line, never twice.

SPEC IMPACT: DECISION_LOG — owner rulings of 2026-10-17 (door in the cover's foot; door words "Confirm your Booking")
need a row; corpus not edited from this session (controller's instruction: never edit that checkout).
