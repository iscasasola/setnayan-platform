## 2026-11-11 · fix(home): the greyed Example under a Home counter keeps its unit and small line apart

On an empty event, the faint "Example" under the Guests, Event Hub and Suppliers counters ran the unit into the small line at 390 px: "128 comingof 180 on the list", "Save the Date liveguests see it", "4 of 6 booked2 still to book". The real counters were fine.

Cause: `FaceBody` (`home-tile.tsx`) returns sibling inline spans (`.hc-big` with its `<small>` unit, then `.hc-sm`). A real face puts them in `.hc-face`, a flex column with a 5-px gap. The Example drew the same `FaceBody` straight inside `.sn-example`, a plain block, so the spans ran together with no space between them.

Fix: in the one shared render, the Example's `FaceBody` now sits in the same `<div className="hc-face">` box as a real face, so every Example face (Guests, Event Hub, Suppliers, Plan, Budget, Schedule) gets the real line break. No face strings changed. Held by `app/dashboard/[eventId]/_components/an-example-face-stacks-like-a-real-one.test.ts`, which renders the empty Home and checks that every Example's sample is wholly inside `.hc-face`, and that `.hc-face` is still a flex column. Both sabotages went red: dropping the wrapper, and flipping the column to a row.

SPEC IMPACT: None
