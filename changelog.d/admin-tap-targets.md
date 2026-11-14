## 2026-11-14 · fix(a11y): admin Receipts "View" link presses at 44 px (AW-13)

The admin walkthrough (AW-13) measured six admin tap targets under the 44-px floor. One was a real fault in a file
no open PR holds: Receipts' "View" link was drawn and pressed 16 px tall. It now wears the shared `.sn-hit` press
(an invisible `::after` 46 px around its centre, vertical only) — the word, colour, size and spacing are unchanged.
Guarded in `lib/the-shared-controls-press-at-44.test.ts` (mutation-checked: removing `sn-hit` turns it red).

Measured, not changed: the section picker (`PickMenu` compact, `pickButtonClass` already wears `sn-hit`) and the ⓘ
(`InfoTip`, `.sn-dot-btn` halo) already press at 46 on `main`, both already guarded; the walkthrough's 28/16 were
their DRAWN sizes. The "due soon" pill, the lane chips and "Open event" sit in files held by open PRs and are left
for those.

SPEC IMPACT: None
