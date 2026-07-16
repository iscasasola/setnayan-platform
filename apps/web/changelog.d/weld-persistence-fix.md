## 2026-07-16 · fix(seating): combine that stays combined — pairwise weld exemption + cross-family rect↔serpentine link

Owner report (2D editor screenshots): two serpentines "combine but do not stay
combined — they separate"; two long-banquet tables welded end-to-end overlap
badly with doubled seam chairs and interpenetrating parallel rows. Follow-up
directive: "long and serpentine should also be able to link" (a straight run
flowing into a curve).

Diagnosis (reproduction suite `lib/seating-weld.test.ts`, failing on `main`):

- **Root cause 1 — the collision exemption was BLANKET, not pairwise.**
  `checkPlacement`/`penetrationDepth` exempted ANY two tables sharing a
  `link_group_id` (`seating.ts` ~2916/2959). The verdict assumed "same group ⇒
  always at a legal joint (rigid by construction)", but that invariant was
  violable — a third table stacked into a group, a legacy in-place link, or
  drift left same-group tables grossly overlapping yet **invisibly exempt**.
  That is the "combine doesn't stay combined / banquets overlap freely / doubled
  seam" bug: the oracle never complained, so nothing healed. The persistence
  path itself was fine (round-trip tests pass) — the exemption hid the overlap.
- **Root cause 2 — cross-family joins unsupported.** `legalJoinPose` rejected
  any `anchor.shape !== mover.shape`, so a banquet↔serpentine weld returned null.

Fix (shared oracle in `lib/seating.ts` — no forked logic):

- **`directlyWelded(a, b)`** — new exemption predicate: same group AND sitting at
  a legal joint with each other (`legalJoinPose` coincidence + rotation within
  tolerance). `checkPlacement`/`penetrationDepth` exempt only directly-welded
  pairs, so a groupmate a table is NOT welded to still collides — a 3-table run
  exempts each seam but flags a member stacked off-axis; two parallel rows in
  one group collide; the doubled-seam symptom disappears with the overlap.
- **`chainableShapes(a, b)`** + cross-family `legalJoinPose` — the linkable set
  is now `{long_banquet, family_head, serpentine}` with **any chain-class pair
  weldable, cross-family included** (banquet↔serpentine): the banquet end-face
  midpoint coincides with the serpentine end-tip and the run axis is
  tangent-continuous with the end-tangent (straight flows smoothly into curve,
  no kink, no gap). Round keeps its separate same-family kiss; round↔chain and
  sweetheart still reject. `linkTables` (actions.ts) gate relaxed same-family →
  chainable-set (NOT a blanket allow); server `isLegalJoint` validation is now
  cross-family aware.
- **Editor wiring** (`seating-editor.tsx`): drag-to-weld and pull-to-join (chain
  icon) both route through the unified `legalJoinPose` snap/anchor search over
  every chain-class neighbour, so a dragged serpentine snaps onto a banquet end
  and vice-versa; all persistence unchanged (the snapped pose already persists
  via `updateTablePosition`/`updateTableRotation`).

Tests: new `lib/seating-weld.test.ts` (9) pins pairwise exemption, S-bend
persistence round-trip, rect + cross-family seam has no doubled seat, cross-family
welds in both directions, and round↔serpentine rejection. Updated one oracle test
that had encoded the old blanket exemption. Full suite green (1895).

SPEC IMPACT: None (corpus already carries the 2026-07-16 verdict; this corrects
the shipped implementation to the pairwise-exemption invariant the verdict
assumes, and extends the linkable set per the later owner cross-family directive.)
