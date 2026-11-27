## 2026-11-27 · fix(a11y): every press in eleven files has a keyboard way in, and icon-only buttons a name

From the buttons audit (27 Nov, Bugs): `onClick` on a `<div>`, `<img>`, `<canvas>`, SVG node or table row with no role, tabIndex or key handler, so a keyboard user could not press it. No visible change.

- Location step's city rows, the welcome line ("Tap to continue"), the Ugat map's nodes, links, joint chips and finding marks, and the Ugat table rows: `role="button"` + `tabIndex` + Enter/Space through the new `lib/press-keys.ts` (`onPressKeys`).
- The pay page's receipt preview is a real `<button>` that opens the enlarged view.
- The two photo eyedroppers (mood-board recolor, admin colour ranges): Enter or Space samples the photo's center.
- The ticker's options are named through `aria-activedescendant`; the thumb row's field seat is `role="presentation"` (its control is reached directly).
- The Hide-some photo picks in a supplier's couple-story card carry "Hide this photo".
- Guard: `lib/button-a11y-keyboard.test.ts`.
- Left out: `app/_components/proposal-maker.tsx` (drag handle), which an open PR touches.

SPEC IMPACT: None
