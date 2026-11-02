## 2026-07-10 · feat(plan3d): roam → return to your seat via own-table tap or a button

Owner: "if the person walks around, they can return to their seat also by
clicking their table or a button to go back to seat." Before this, the only
way back while roaming was tapping a subtle pulsing floor ring — undiscoverable.

- **Own-table tap** — while roaming, the guest's OWN table is a big tap target
  that walks them back to their seat. Wraps the table in a gesture-guarded
  group `onClick` (stops propagation so the floor tap behind it doesn't also
  steer a stray walk). Added to BOTH scenes: `Plan3DScene` (homepage demo +
  couple-lab-style path) and the public `guest-venue-3d` walk.
- **"Back to my seat" button** — a clear pill in the roam UI of the phone
  demo guest-view and the desktop overlay. Driven by a new
  `Plan3DScene` prop `returnToSeatSignal` (bump-a-counter → walk home), so the
  outer React UI can trigger the in-scene walk without a ref handle.
- **Refactor** — the proven gold-ring seat-tap logic is extracted to one
  `walkBackToSeat()` that the ring, the table tap, and the button all call, so
  there's a single, already-shipped code path for "go home."

`tsc` clean · full unit suite 1343/1343 · radius lint clean. The walk *feel*
(and r3f canvas taps) can't be exercised headless — owner eyeballs live: open
the demo, "Walk around," then tap your table or the button to return.

SPEC IMPACT: None (new affordance on the existing roam flow; matches the
seat-plan program's wayfinding item).
