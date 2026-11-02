## 2026-09-27 · fix(maker): the Maker's dropdowns open on the screen — Font, "Home ▾" and the rest

Measured live on production (commit 3e45275): tapping **Font** in the element
sheet on a phone drew its list wholly below the screen (button at 455px, list at
880px in an 844px screen) — nothing appeared. On desktop the same list opened at
left 2300 in a 1440 window. "Home ▾" in the navigator opened downward from the
bottom of a phone and showed ~66px of itself.

Cause: the element sheet is `.sn-glass-bare`, and an ancestor with
`backdrop-filter` becomes the containing block for `position: fixed`, so the
list's viewport coordinates were added to the sheet's own offset.

Fix, in the shared `PickMenu` (`app/dashboard/[eventId]/website/editor/_components/pick-menu.tsx`):
the list is portalled to `document.body`; where it opens is a new pure
`placePickList` (`pick-menu-place.ts`) — below when it fits, otherwise above
when that side has more room, with its height capped to the room so a long list
scrolls inside itself; left edge clamped as before. The list is measured after
it mounts (a layout effect, before paint) instead of guessed. z-index raised
from `z-[60]` to `z-[95]` so it clears the Maker overlay (`z-[80]`). The font
faces still draw in themselves — every `--font-*` variable is declared on
`<html>`.

Held by `pick-menu-place.test.ts` (the production measurements as cases, plus a
source check that the list is portalled and clears the Maker's z).

### And: the compact Maker bar is ONE picker, not two

Owner, on the compact bar showing "● Invitation ▾" + "Logo ▾": *"combine them
in 1 dropdown"* (DECISION_LOG 2026-09-27, "THE COMPACT MAKER BAR IS ONE PICKER,
NOT TWO"). When the bar is too narrow for the full row it now shows ONE button
naming where the couple is ("● Invitation" on a stage, "Logo" while a page is
open); its list has two labelled groups — **Stages** (Save the Date ·
Invitation · On the Day · Post Event, live-today dot kept) and **Pages**
(Details · Logo · Hero · Reveal · Love Story · RSVP · Prints & Tickets). Prints &
Tickets stays under Pages because the old Pages picker listed it there and the
compact bar must not lose a door. A pick runs the same `onPress` the wide row's
button does. The wide row is unchanged.

`PickMenu` gained an optional `group` per option: consecutive options sharing a
group sit under one heading, drawn as `role="group"` with an `aria-label`; the
heading is not a button, so arrow keys and first focus skip it. The picker's
contents are the pure `makerPlacePick` / `makerPlaceItem` (`maker-bar.ts`),
held by `the-compact-maker-bar-is-one-picker.test.ts`; the data attribute is now
`data-maker-place-pick` (the old `data-maker-stage-pick` /
`data-maker-pages-pick` are gone, and `the-maker-controls-are-compact.test.ts`
now fails if either returns).

SPEC IMPACT: None (the decision is already recorded in DECISION_LOG.md, 2026-09-27)
