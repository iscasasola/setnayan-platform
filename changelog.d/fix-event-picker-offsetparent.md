## 2026-06-28 · fix(create-event): event-type photos clickable on desktop

The full-page create-event "feel photo" picker was unclickable on desktop: the
centered photo showed no "Begin →" affordance and tapping it did nothing.

Root cause: `EventTypePhotoPicker` computed the centered ("active") card from
`el.offsetLeft`, which is measured relative to the nearest *positioned*
ancestor. The scrolling deck is not positioned, so on the centered `max-w-2xl`
create-event layout the card's `offsetLeft` was measured from `<body>` —
~590px off from `deck.scrollLeft`'s coordinate space. `computeActive()` then
picked the wrong card, so the visually-centered photo was never `active`;
`onTap` does `i === active ? onSelect : centerTo(i)`, so tapping the centered
card only re-centered an already-centered card and never fired `onSelect`.
On mobile the deck sits ~16px from the edge so the skew stayed under half a
card and the bug was masked — which is why the prior 2026-06-28 scroll-into-view
fix (aimed at the inline form below the fold) didn't resolve it.

Fix: measure both `computeActive()` and `centerTo()` in viewport coordinates
via `getBoundingClientRect()` (immune to offsetParent and to the cards' CSS
scale transform, whose center is unchanged), instead of `offsetLeft`.

SPEC IMPACT: None — bug fix to shipped behavior; matches the locked
2026-06-04 "tap the centered photo to begin" picker spec.
