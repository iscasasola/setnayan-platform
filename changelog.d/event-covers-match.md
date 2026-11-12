## 2026-11-12 · fix(covers): one event wears one cover on Home and Discover; the event menu goes back to My Home

Owner: *"The event icons are not similar?"* (Home vs Discover screenshots) and, on the
event menu beside the shop's, *"It need to be able to go back home. The need to have
similar way of presenting this to go back to home"*. Then: *"Fix it so they show properly"*.

- **Discover photo covers print the invitation.** `dressEventCoverGiven` now hands on the
  whole poster behind a scene that came from it (`scenePoster`), and
  `DiscoverEventCover` draws the same `<EventPoster>` the home board draws: the
  couple's names and date on their photo, not the bare photo. The Main background
  (no poster words) stays a plain picture. This retires the 2026-10-03 "no words on
  a photo here" line for poster-derived covers.
- **Home honours the couple's own background colour.** A `theme` poster on Home now
  asks `readEventCover` (Discover's resolver). Where the hub draws no theme loop
  (own colour / ombré), the card is the paper card in their colours. Before this it
  was dark words on the theme's dark ground. Only `theme` posters pay the extra read.
- `paperGroundStyle` moves into `event-poster.tsx` (one copy), and
  `EventPosterFacts.paperGround` carries the ground to the invitation card.
- **Event menu:** the focus row inside an event reads `← My Home` (caption Home), the
  same as HQ, the shop and the account spokes. This supersedes the 2026-09-23 "Events"
  + grid icon ruling, and `seam-invariants` / `rail-focus` are updated to pin the new row.
- Guard: two cases in `lib/event-cover-given.test.ts`. Sabotage check: with no scene
  poster the case goes red.

SPEC IMPACT: None. The ruling reversals are the owner's own (quoted above).
