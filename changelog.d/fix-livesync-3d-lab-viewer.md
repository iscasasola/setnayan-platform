## 2026-07-10 · fix(seating): 3D lab live-sync viewer now reflects peer move / rotate / delete / seat

Follow-up to the seat-plan live-sync (#2999) — a gap audit caught that the sync
was effectively a **no-op for the 3D lab viewer** for the events that matter most.

The lab holds two local caches — `tables` and the `seats` map — each reconciled
to the server snapshot by an effect that is **merge-only** unless a ref is armed:
`forceResyncRef` (armed only in `persist()`'s catch, i.e. on a *save failure*)
and `seatResyncRef` (armed only by a self-initiated bulk op). A pure VIEW-ONLY
surface (`canEdit === false` — a partner/coordinator watching while someone else
edits) never arms either ref, so `router.refresh()` delivered fresh
`initialTables` / `guests` props but the effects **discarded** them:
- table reconcile only patched link-grouping + appended new rows → a peer's
  **move, rotate, delete, or capacity change was dropped** (the table stayed at
  its mount-time position; a deleted table stayed on screen);
- the seats effect no-oped → a peer's **seat / unseat was invisible**.

Only *adds* and *link/unlink* ever reflected. So the 3D lab and the 2D editor
(which re-syncs correctly via `useOptimistic(tablesProp)`) disagreed about the
same plan.

**Fix:** both effects now do a **full replace from server truth when `!canEdit`**
(in addition to the existing failure/bulk-op resync). A viewer holds no
optimistic drag/seat state to protect, so mirroring the server exactly is always
correct; the editor path is unchanged (still merge-guarded so an in-flight drag
isn't clobbered). `canEdit` added to both effects' deps so losing the lock
(editor → viewer) triggers an immediate re-sync.

`tsc` clean. Behavioural (Realtime) — verify live after the #2999 migration is
applied: edit in 2D while watching the 3D lab as a second user; moves/rotations/
deletes/seatings should now appear without a manual reload.

SPEC IMPACT: None (completes the live-sync plumbing from #2999).
