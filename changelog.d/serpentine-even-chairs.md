## 2026-07-10 · feat(seating): linked serpentine chairs space evenly across the chain

Owner (ref photo of a linked S-serpentine with chairs bunched into clumps):
"when they link, the chairs need to adjust their spacing properly." Measured:
two linked segments' end chairs landed only 0.32 m apart (chairs ~0.5 m) — a
seam pile-up — while a single segment's chairs sat 0.47 m apart.

Root cause: each serpentine placed its chairs end-to-end across its own sweep
(end chairs hug the tips), so at a junction the two segments' tip chairs
collided, and the chain read as two clumps rather than one banquet.

- `serpentineChairs(capacity, even)` gains an `even` mode: **slot-centre**
  distribution (chairs at the centres of N equal arc slots). This gives a
  UNIFORM chair density across the sweep, so across a junction the gap is
  exactly one spacing — no pile-up — and the whole chain reads as one
  evenly-spaced curved banquet. Threaded through `chairLocalPositions` →
  `chairPlacements` and `worldSeatPose` (so a walked-in guest sits exactly
  where the evenly-spaced chair renders — render + seating stay in lockstep).
- Triggered by link membership: `even = table.linkGroupId != null` at the lab +
  demo render sites and in `worldSeatPose`. Standalone serpentines are
  unchanged (their `serpentineChairs(5)` reference test still passes).

Result (unit-tested): every gap — within a segment and across the seam — is now
the SAME uniform ~0.395 m. `tsc` clean · seating-3d 67/67 (incl. the uniform-
spacing proof) · full unit suite 1349/1349. Owner eyeballs the linked chain in
the 3D seat plan; chairs should flow evenly with no clumps.

SPEC IMPACT: None (chair layout refinement for linked serpentines).
