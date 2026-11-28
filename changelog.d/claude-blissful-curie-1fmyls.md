## 2026-11-27 · fix(website editor): the house button, chip, colours and speeds (themes audit B1, Website part)

`/dashboard/[eventId]/website/**` moves onto the shared pieces. Behaviour is unchanged.

- **Sections panel** (`editor/_components/sections-panel.tsx`): the actions (Visible/Hidden, Move up/down, Remove for good, None) are `ActionButton`. The choice chips (mode, motion preset, transition, speed, arrangement, zoom, background) use the one chip look (`chipClass`).
- **Legacy `.button-primary`, all 11:** `actionButtonClass('brand', { main: true })`. This covers Our Photos, Our Story, the moment sheets, the Love Story add, the draft bar's Reset, and the draft button's primary. The Apply sheet writes the same class list by hand, because its import list is held by a first-load guard. Its ✕, remove and "Apply without" buttons are the neutral and quiet `ab` looks.
- **Colours:** the Tailwind `amber-*` and `red-*` classes and their hand `dark:` twins become the `warn-*` and `danger-*` ramps, which flip with the mode. This covers the Pro band, the unlock links, two error alerts and the milestone remove.
- **Speeds:** `duration-300 ease-in-out` and `duration-200` become `duration-sn-elem` / `duration-sn-control` with `ease-sn`.
- **Type:** half-pixel and typed sizes in the two sheets now use the `text-sn-*` scale.
- **Guard:** `website/the-website-wears-the-house-pieces.test.ts`. `lib/the-motion-control-is-real.test.ts` now reads the pressed chip's own word, not a 260-character window.

**Stopped, not changed:**
- Apply sheet → `Sheet`: its dark is set in `globals.css` (`div:has(> [data-apply-pro-sheet])`, off-limits here), and its imports are frozen by `every-stages-popup-follows-the-rule` (4).
- History list → `Sheet`/`RiseScreen`: it is a drawn full screen (frame M9) at z 90 over the Maker. `RiseScreen` sits at `--sn-z-pop` (40) and would draw under it.
- The editor "scrims": `background-cards.tsx` has a per-card load dim, which is not a modal scrim. The scene picker's clear close layer is held by the same guard (3).

SPEC IMPACT: None.
