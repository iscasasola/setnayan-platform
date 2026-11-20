## 2026-11-20 · fix(for-suppliers): the fee ruler's bar really drags

Owner, 20 Nov: "shouldn't the line bar be moving?" The ruler said "Test it: drag the bar to see your fee", but the bar
was `aria-hidden` with `pointer-events: none`, so nothing answered a drag.

- The bar is a slider. Drag the dot with a mouse, finger or pen (pointer capture keeps it while the finger leaves the
  bar). Tap the track to jump there. Arrow keys, Home, End and Page keys also work. It has `role="slider"` with
  `aria-valuenow` and a spoken value ("₱300,000 booking, fee ₱7,000"), and a 74 px press area.
- The dot and the cards are one control. The bar scrolls the cards to its stop, and swiping the cards moves the dot. A
  hold stops the dot jumping back while the cards glide to a stop the bar chose, and a hand on the cards releases it.
- The ruler opens after layout, with the dot and the cards on the same start stop. Before, a snap container that had
  not measured could leave the cards on ₱50,000 with the dot elsewhere — what the owner saw.
- The fee maths is untouched (`bookingFeePhp` on the live schedule). The ruler draws no lock marker, because the live
  fee has no ceiling (the component header says so).
- Guard: `app/for-suppliers/the-fee-bar-really-drags.test.ts` — "drag the bar" is backed by pointer handlers; slider
  role, value and keys; sync both ways; press area ≥ 44 px. Seen RED with `onPointerMove` removed.

SPEC IMPACT: None — this makes the approved drawing's ruler behave as drawn.
