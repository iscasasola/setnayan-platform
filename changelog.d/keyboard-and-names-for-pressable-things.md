## 2026-11-27 · fix(a11y): every press in ten files has a keyboard way in, and icon-only buttons a name

From the buttons audit (27 Nov, Bugs): `onClick` on a `<div>`, `<img>`, `<canvas>`, SVG node or table row with no role, tabIndex or key handler, so a keyboard user could not press it. No visible change.

- Location step's city rows, the welcome line ("Tap to continue"), the Ugat map's nodes, links, joint chips and finding marks, and the Ugat table rows: `role="button"` + `tabIndex` + Enter/Space through the new `lib/press-keys.ts` (`onPressKeys`).
- The pay page's receipt preview is a real `<button>` that opens the enlarged view.
- The two photo eyedroppers (mood-board recolor, admin colour ranges): Enter or Space samples the photo's center.
- The ticker's options are named through `aria-activedescendant`; the thumb row's field seat is `role="presentation"` (its control is reached directly).
- The Hide-some photo picks in a supplier's couple-story card carry "Hide this photo".
- `data-press-none` (new, `PRESS_NONE` in `app/_components/press-feel.tsx` + one rule in `globals.css`): a surface that took `role="button"` only for the keyboard keeps its own look, with no global dip or dimming. Every new role here wears it.
- The Ugat finding mark is a sibling of its node, no longer a button inside a button. The recolor photo is a control only while eyedropping.
- Guard: `lib/button-a11y-keyboard.test.ts` (keyboard way in, names, no nested buttons, `data-press-none`); `lib/the-press-feels-the-same-everywhere.test.ts` holds the opt-out.
- Left out: `app/_components/proposal-maker.tsx` (drag handle), which an open PR touches.

SPEC IMPACT: None
