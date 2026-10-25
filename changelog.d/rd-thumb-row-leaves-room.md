## 2026-10-25 · fix(thumb-row, suppliers): a page leaves room for its floating thumb row; an opened category reaches the top

Owner, live on production 702fc16, his computer, the event's Suppliers page: *"the suppliers page does not scroll up
anymore so i can add more categories. what happened?"*, then *"when i tapped food trucks it should expand and pin
foodtrucks on the top"* and *"we already used to have these both working"*.

**Bottom hidden under the thumb row — cause.** The page's room for its floating row (⇕ · Search suppliers · ＋) was a
per-page, phone-only number (`max-tab:pb-16` on Find's body), and from 701 px the event column reserves nothing
(`[data-shell-main]` → 0). It held while the computer's row was a 720-px box parked at the right edge, beside the
list's left half. `a7a91422e2` (PR #6858, 2026-10-23, "Home, Guests and Suppliers fill the body column from 1024")
stretched the row across the whole column, so "Need something else? ＋ Add to your event" sat 58 px under it at the
page's end (walked at 1280 on /dev/suppliers-lab with the real column padding: door bottom 776, row top 718,
`scrollY === max`). The overlay page lock (#6913 / f7f3bd5d0c) was checked and is not the cause: the body is never left
`position: fixed` after a pop-up closes (walked: lock on while the Add-your-own sheet is open, released on close).

**Fix — one measured token.** `lib/thumb-room.ts`: every floating row measures what it covers and publishes the largest
on `<html>` as `--sn-thumb-room` — mounted by the one `<ThumbRow>` (so every screen that draws it: Find, Guests,
Budget, Memories, the account rows, the supplier rows, Discover) and by Build's Save bar (not a ThumbRow). Every column
that clears the bottom chrome pads by `max(its dock clearance, --sn-thumb-room)` at every width: `[data-shell-main]`
(event tree), the `(account)` and `(launcher)` `<main>`s, the supplier dashboard column. Find's hand-added
`max-tab:pb-16` is gone. The Suppliers lab now wears the real column's `pb-6` (its `pb-28` hid this from every walk).

**Opened category stays low — cause.** The landing (`scrollBenchAnchor`, unchanged since c45748a2c2 on 2026-10-08)
runs, and is clamped by the page's end: a category low in the list with a short body cannot be scrolled to the top
(walked: the last row's head 394 px under the pin line at `scrollY === max`). **Fix:** `lib/pin-room.ts` — before
each landing scroll (a frame after the open, and again when the unfold ends) the bench gets exactly the padding the
page is short of (`--pin-room`), dropped when nothing is open.

Guards: `lib/a-thumb-row-leaves-room.test.ts` (arithmetic, the ThumbRow/Build mounts, every column's max(), no per-page
number, the lab matches the real column, the page lock releases only on the last close) and
`lib/an-opened-row-reaches-the-top.test.ts`; `the-page-clears-the-dock.test.ts` follows the new `max()` shape.

SPEC IMPACT: None.
