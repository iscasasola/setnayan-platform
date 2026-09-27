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

SPEC IMPACT: None
