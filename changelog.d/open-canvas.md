## 2026-06-26 · feat(seating-3d): open-canvas framing — zoom out to fit a free/spread layout

Owner direction: floor should be "free size / unlimited expand" (Open canvas +
auto-fit chosen). The free board already lets tables sit far outside the default
room (pct can run −200..600) with NO perimeter box — but the camera was capped at
the small default room, so a spread-out layout fell off-screen. First, safe
increment toward auto-fit:

- **`lib/seating-3d.ts`** — new `contentBounds(tables, room)` (pure, unit-tested):
  world bbox + centre + span of the placed tables. The foundation the camera (and
  later walls) frame against, with no fixed venue rectangle.
- **`seating-lab-3d.tsx`** — OrbitControls `maxDistance` now `max(room.d*3,
  span*1.4)`, so you can zoom all the way out to take in the whole free layout.
  Single safe prop change — no `CameraRig` rewrite, no position-data change.
- **`lib/seating-3d.test.ts`** — +1 case (10 total): empty-board fallback + a
  free spread growing the span.

NEXT increments: true auto-fit-on-load (CameraRig frames the content bbox) +
draggable walls/dividers (on the venue-object foundation, acting as crowd
obstacles) — both want a preview pass to tune the feel.

SPEC IMPACT: 0008 Seating — 3D camera frames the open/free layout.
