## 2026-10-29 · fix(popups): every pop-up is drawn on top of the whole screen; Seats pop-ups, round chairs, 3D Plan facts behind ⓘ

Live regressions the owner hit on his phone (after #7044 / #7028):

- **The shared `Sheet` portals itself to `<body>`** (`app/_components/sheet.tsx`, via `usePortalHost`). Every event page
  lives inside `<main class="sn-vt-page">`, a stacking context, so a `fixed inset-0 z-50` sheet drawn in place painted
  UNDER the bottom bar and the top bar — the Home coordinator sheet's "Full access" row and the Guests › Seats table
  sheet. One fix for every caller; a caller's own portal around it still works. The Sheet also gains an optional
  `back` (‹ label) in its title row.
- **Admin › Categories' drawer is the shared Sheet** (`four-level-map.tsx` `MapDrawer`): drawn over the admin shell's
  bars, with a ‹ that goes back to the map standing on the level it was opened from (`closeDrawer`). The phone's Back
  pops the drawer's own `?open=` address; the parts picker (no address) takes a history entry of its own. The drawer's
  sections are untouched (a separate redesign).
- **Guests › Seats pop-ups** (`seating-editor.tsx`): the people sheet names the picked table/piece in its heading on
  the ✕ row, keeps the 16 px gutter (no flush edges, no clipped P-chips); the dock inside it draws no second ✕ and no
  duplicate name row; the Stage says one sentence, Done/Remove are the shared `ActionButton` in one wrapping row.
- **A guest card opened from a seat** (`guest-card-sheet.tsx`, `InspectorSheetAlone`, globals.css): Remove · Swap sit
  pinned at the card's foot (they were clipped above the sticky header); with no list behind it the card is the whole
  screen on a phone (no dim strip); the phone's Back closes it; the card's name and eyebrow wrap instead of "…".
- **2D chairs are round again** — the occupied footprint and the blank seat were `rounded-sm` squares (July
  "blueprint"); now circles in the guest's colour, the blank one dashed, as the approved Guests prototype draws them.
- **3D Plan facts behind ⓘ** in the Seats ⋯ menu beside "Show guests their seats early": Status · Seated · Made an
  avatar · Days to go — `lib/plan3d-control.ts` restored (the facts only) from before a01284796b; the seat page adds a
  head-only avatar count + `slug, timezone` to its existing events read.

Guards: `app/_components/an-open-panel-clears-the-top-bar.test.ts` (the Sheet portals; no NEW full-screen
`role="dialog"` drawn in place — `drawn-in-place.baseline.txt`, 31 files, only shrinks), `the-seat-plan-on-the-phone`
8–9, `lib/seats-in-guests-are-frameless` (round chairs), `lib/guests-words-are-never-cut` (card title/eyebrow),
`lib/plan3d-control.test.ts`. Each sabotaged red once.

SPEC IMPACT: None — restores approved behaviour (prototype round chairs, house pop-up rules); no decision changed.
