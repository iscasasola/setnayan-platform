## 2026-10-08 · feat(maker): the Stages panel wears the approved templates — A · buttons and marks take the accent

Owner, 2026-10-08: *"we want the whole app to be adaptive to the same feel"* · *"if we change our color to blue, it
will be easy to change the button colors"* · *"pop up is like a notification. so it should peek from the top"*.

The shared stage panel (Style | Text | Animate), as the Invitation stage shows it:

- **One colour, from the one setting.** The panel's own `--sp-cta` (the picked card's ring, the slider's fill) and its
  wash now READ `--sn-accent`; `--sp-bad` reads the house danger token. Thirteen neutrals are all the panel still
  writes. The part frame, its name, ＋ ↑ ↓ ✕ and the grip are `bg-sn-accent text-sn-on-accent`; 🗑 is `--color-danger`.
- **The dropdown's ▾ is terracotta** — the panel no longer repaints it gold (nor Gallery ›, Upload +, the stage ▾).
- **Actions are the app's action button** (`ActionButton`): Style › Look's door ("Edit the E-Gifts") is the second
  button, not an ink-black bar; the remove confirm answers with the second button and the delete button (the house
  red, not the blush brown that read as a second terracotta); the typing bar's Done and the colour sheet's Use are
  the main button. `ActionButton`'s `brand` tone now reads `--sn-accent` / `--sn-on-accent` (same colour today).
- **Move's direction is ONE dropdown** ("From · the bottom ▾"), where four ink arrow buttons stood; **Grow | Shrink
  is the app's pill selector**.
- **Colour swatches are circles** (kind 21), the picked one ringed in the accent — one drawing (`Swatch`) for Text
  and Background.
- **The toast, drawn once**: `app/_components/toast/peek-toast.tsx` — peeks from the top centre, the accent with a ✓,
  the danger token darkened with a warning mark for a failure, leaves by itself, nothing under reduce motion, never
  darkens the page. The panel's "added / removed / moved" strip is this toast now. (`ToastProvider` / `useToast` —
  the older toast at the bottom, ~35 callers — adopts this drawing in the app-wide sweep; not moved here.)

Requests: none added. The Suppliers door is a client link now (`prefetch={false}`): one route fetch on a press,
where a full page load stood.

Guards: `lib/the-stages-panel-wears-the-accent.test.ts`, `lib/the-toast-peeks-from-the-top.test.ts` (21 sabotages,
each seen red). `scripts/port-control-baseline.json` regenerated (it named `<Dir>` gone; `PeekToast`,
`PillSelector`, `Swatch`, `SwatchMore`, `ActionButton` new).

SPEC IMPACT: None (the rulings are already in `INTERACTION_RULES.md` § 9; this builds them).
