## 2026-11-04 · fix(rows): one tap opens a swipe row on iPhone again

The shared `SwipeToDelete` (#7217) made the red Delete behind a row visible on touch-down. iPhone Safari drops the click of a tap whose touch-down shows or hides content, so every swipe row — the guest list first — needed two taps to open (owner: "i see it needs a double tap?" → "yes keep single tap"). Touch-down now changes nothing; the row counts as dragging only once the swipe is decided sideways. Guard: `swipe-to-delete.test.ts` 4a (red on the old code, green on the fix).

SPEC IMPACT: None.
