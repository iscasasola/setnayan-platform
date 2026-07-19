## 2026-07-10 · feat(seating-lab): a snapped serpentine also LINKS into one unit

Owner (ref photo of two serpentines snapped into an S): "i need it to snap and
link to other tables this way." The snap (#2989) positioned segments touching
but left them as two independent tables. This completes it: a serpentine that
snaps to another now **joins its chain as one unit** — moves together, prints
as one QR/name — and more segments extend the same group (a real multi-segment
serpentine table).

- `lib/seating-3d.ts` — `serpentineChainSnapWorld` now reports `neighbourId`
  (which table it chained to). Unit test asserts it.
- `seating-lab-3d.tsx` — on a successful serpentine snap, `commitDrag` calls the
  existing `doLink(dragged, neighbour)` (via a ref, since `doLink` is defined
  later), which sets the shared `link_group_id` + combined label and persists
  through `linkTables`. `doLink` merges into an existing chain group, so
  dropping a third segment onto the run joins the same unit. Snap stays gated to
  standalone serpentines (`!linkGroupId`), so a finished chain moves rigidly and
  new segments are what extend it.

`tsc` clean · seating-3d 66/66 · full unit suite 1348/1348. The drag+link flow
isn't headless-verifiable (r3f drag + auth-gated lab) → owner drags a serpentine
end onto another in the 3D seat plan; the two should click together AND become
one linked table (one name, moves as one). "Break apart" still splits them.

SPEC IMPACT: None (completes the 2D editor's snap+link parity in the 3D lab).
