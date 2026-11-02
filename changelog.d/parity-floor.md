## 2026-06-26 · feat(seating-3d): 2D→3D parity — floor designer (move/resize stage + dance, toggles)

The 3D lab can now edit the floor itself, not just reflect it — "make full use of
this so our edit is not just a seat plan":

- **Move** the stage / dance floor / entrance — tap "Move", then tap the floor to
  drop it (reuses the proven floor-tap conversion; no blind drag-feel).
- **Resize** the stage + dance floor with W/D −/+ (clamped 2–100%).
- **Toggle** the dance floor + entrance on/off.

All via a collapsible **Floor & stage** panel; every edit is optimistic + persists
through the SAME `saveFloorPlan` the 2D editor uses.

**Data safety (the load-bearing part):** `saveFloorPlan` upserts the whole floor
row, so the lab round-trips the fields it doesn't edit — the service door + the
cocktail/waiting room (new `Lab3DFloorExtras`, threaded from the page) — so a 3D
save can never wipe what the 2D editor set. (priority_order + published_at are NOT
in `saveFloorPlan`'s upsert payload — they're written by separate single-column
upserts — so they're untouched by a floor save; verified against the live actions.)

Found + fixed by an adversarial review (`floor-designer-review`): an in-flight
guard so a concurrent mutation's refresh can't clobber an optimistic floor edit,
and full cross-cancellation of the place/link/move modes so a floor tap is never
ambiguous. `floor` is now local state with an in-flight-gated re-sync.

Deferred (noted): drag-resize corner handles + booth/sign placement.

SPEC IMPACT: 0008 Seating — 3D lab floor-designer parity.
