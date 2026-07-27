## 2026-07-27 · fix(ui): collapse template — stop expanded accordions overflowing the viewport on mobile

- **Symptom:** on a phone, expanding a leaf category in the couple's vendors accordion pushed the
  page past the screen width (horizontal scroll / clipped content).
- **Cause, in the SHARED rule not the page:** the collapse template animates `grid-template-rows:
  0fr → 1fr` and gives its child `min-height:0` so it may be shorter than its natural height — but
  never `min-width:0`. A grid item defaults to `min-width:auto` ("never shrink below intrinsic
  content width"), so the horizontally-scrolling vendor rail inside inflated the collapse track
  past the viewport; the PAGE scrolled sideways instead of the rail scrolling inside itself.
- **Fix, at the template level (no per-page hack):**
  - `globals.css` `.sn-acc > *` — the canonical collapse primitive — gains `min-width:0`, with a
    comment explaining why it is the horizontal twin of the existing `min-height:0`. Every future
    collapse built on the template inherits it. (`.sn-acc` currently has no consumers, so this
    changes no shipped pixel today; it fixes the template so the defect cannot be re-inherited.)
  - `shortlist-categories.tsx`'s local duplicate of the same pattern (`.fold-collapse>.fold-body`,
    `.cat-collapse>.cat-body`) now matches the template. This is the live surface with the bug.
- Behaviour: the rail keeps its own `overflow-x:auto` and now scrolls inside its category, as
  designed. No layout change on desktop; no component, markup or dependency change.

SPEC IMPACT: None
