## 2026-09-23 · fix(papic): sheets clear the bottom nav, the look picker shows a real photo, the back link goes

Three owner reports from one live drive of the Papic controller.

🚨 **A SHEET'S BOTTOM CONTROL WAS UNREACHABLE.** Owner, on the capture-window sheet: *"i can no
longer update it again. under the bottom nav"* — a window that had been set could never be changed.
Reported on three sheets in a row (capture window, guest window, look picker); **one bug in the
shared `Sheet`, not three.**

⚠ Not a z-index fault: the sheet is already `z-50` against the nav's `z-30`. It was rendered
UNDERNEATH the floating pill in the layout. The clearance is the nav's own geometry —
`bottom-[calc(env(safe-area-inset-bottom)+12px)]` with an explicit 64px bar, so it occupies
`safe-area + 76px`; the sheet clears 88px and gives the same back from its max height, or a tall
sheet clips off the TOP instead. `lib/the-sheet-clears-the-bottom-nav.test.ts` pins both numbers AND
the nav geometry they were derived from — sabotaged three ways, including moving the nav's height
out from under the arithmetic.

**The look picker previews on a real photograph** (owner-supplied): *"papic look should have an
actual photo for sample with a lot of colors"*, then *"just leave the Orig, Retro, Mono, Cine, Lomo
and fill up the whole rectangle with the photo"*. A gradient could not show what a couple buys —
`Mono` on a gradient is a grey ramp and `Retro`'s matte shadows had nothing to sit in. Each card
uses the product's OWN `cssPreview` filter, not an invented one. ⚠ The name sits OUTSIDE the
filtered layer deliberately: nested, `Mono`'s `grayscale(1)` would grey the one label that most
needs to be legible. The blurb leaves the card but STAYS in the `aria-label`, so screen readers keep
the description.

**"Back to add-ons" removed** from the Papic page. `lint-port-no-lost-controls` caught the missing
control, as designed; the baseline is regenerated to record that the removal was deliberate.

SPEC IMPACT: None.
