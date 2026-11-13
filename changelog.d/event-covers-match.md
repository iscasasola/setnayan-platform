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

## 2026-11-13 · fix(covers): event covers say the event name only, no date; the name is said once

Owner, verbatim: *"events should only say event name no date"*, then *"everything else is good"*
(DECISION_LOG 2026-11-13, "EVENT COVERS SAY THE EVENT NAME ONLY, NO DATE" and "#7540 EVENT COVERS
APPROVED").

- `<EventPoster nameOnly>` drops the weekday, the date and "Date to be set" (and the rule under the
  names that only separated them). Opt-in: Home's Planning board, Home's Examples shelf and both
  Discover posters pass it; the launch maker's preview keeps its date until ruled on.
- Discover covers lose the "SAT 12 DEC" corner plate (`.fd-date` removed).
- Ruling 2026-10-11 (*"yes ad drop so it is not twice"*): when a Discover cover prints the names (the
  paper card, or the invitation on the photo), the title line under it is screen-reader words only;
  the stretched link stays. A bare picture or the mark alone keeps the visible line.
- Guards: `lib/the-discover-card-wears-the-cover.test.ts` §4 (no date on any cover; name said once;
  Home and Discover pass `nameOnly`, the default stays dated). Sabotage-checked.
- Labs: `/dev/shop-card-lab` gains the paper and photo covers; `/dev/home-lab` and `/dev/bar-lab`
  draw the board name-only.

SPEC IMPACT: None. The corpus already carries both rulings.

## 2026-11-13 · fix(covers): poster chips never cover the mark; lab fixtures stop posing as one event

- `CollectionCard` (poster layout) sets `--chip-room` (3.75rem, the two-row chip stack) when it has
  kicker chips; the deep poster's mark, logo and words start below it (`event-poster.module.css`).
  Unset elsewhere → unchanged. Note: `posterFor` no longer produces `deep` in production (2026-09-26);
  the overlap was seen on the `/dev/home-lab` fixture. Guard: `lib/event-poster.test.ts`, evaluated
  across 128–300 px card widths; sabotage-checked.
- `/dev/shop-card-lab`: the paper fixture is now "Ana & Miguel" (it was a second, unrelated "Maria & Jose"
  fixture), and both fixtures are plain facts, so `posterFor` keeps exactly one caller.

SPEC IMPACT: None.
