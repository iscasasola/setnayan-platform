## 2026-06-25 · fix(seating): full server re-hydration after a failed 3D seat-plan save

Post-review fix (adversarial audit). In `seating-lab-3d.tsx`, the snapshot reconcile effect is merge-only (adds new rows, never overwrites an existing row's position/rotation nor drops a server-absent row), so a `router.refresh()` after a FAILED save recovered a rejected DELETE but not a rejected MOVE/ROTATE — leaving optimistic local state diverged from the DB. Now a save failure arms a one-shot `forceResyncRef`; the next `initialTables` snapshot does a FULL blind replace (positions, rotations, AND membership) from server truth, reverting the failed optimistic change. Both the lost-lock and generic-error branches arm it and refresh. Happy path unchanged (merge-only reconcile still guards in-flight optimistic moves while the lab holds the lock).

SPEC IMPACT: None.
