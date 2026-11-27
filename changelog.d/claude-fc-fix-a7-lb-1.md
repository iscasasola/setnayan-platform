## 2026-11-25 · feat(area 7): final-check lane B B1–B4 — as drawn (prototypes/final-check-area-7_2026-11-25, approved)

- B1 · A7-35 — Guests › Seats › 3D: when the seat counts do not fit beside the menu and the rounds (a rule on the row, `lib/guests-counts-line.ts`, not a screen width), they take their own line under it — same doors, left, 12 px apart, 44 px presses; when they fit, today's one line.
- B2 · A7-20 — Venue connection check: one hero number (the average upload, 30/700, "the stream needs 2.6") in the verdict block; Slowest second and Delay are quiet rows; a refused event read says "Couldn't load this event just now" with Try again (no 404); the progress bar moves by transform (scaleX, Move 320, settle).
- B3 · A7-05 — /pa3d and /pa3d/try: on a phone an up-or-down swipe scrolls the page (`touch-action: pan-y`, the two public pages only); a sideways drag turns the room, two fingers pinch; two 44 px "Turn left / Turn right" rounds on touch, one step each (Move 320, settle; a cut under reduced motion).
- B4 · A7-15 — Shop › Spaces: the house pinned row (Back + title), a saved change is the house toast, a removal is gone at once with Undo (6 s; one new op in the same `spacesWrite` dispatcher, no new server action), the empty page is `EmptyState` with one "Add a space" and no date row, no half-pixel type.

Tests: `lib/guests-counts-line.test.ts`, `venue-check-reads-as-drawn.test.ts`, `lib/plan3d-turn-step.test.ts`, `spaces-wears-the-house-pieces.test.ts`.

SPEC IMPACT: None — built to the approved drawing.
