## 2026-07-16 · fix(seating): connective snap positioning (linking deferred)

Owner reports (2D editor): serpentines "combine but do not stay combined — they
separate"; long-banquet tables overlap with doubled seam chairs; two round
tables deeply interpenetrate. Owner ruling: **stop linking. This PR ships ONE
thing — drag-to-connect snap POSITIONING; the link layer is deferred to a future
PR.**

What changed:

- **Connect = pure positioning, no linking.** Dragging a chainable table
  (long_banquet / family_head / serpentine) so its end nears another chainable
  end magnetically snaps it to the pose where the two ends connect cleanly —
  coincident endpoints, tangent-continuous (straight↔straight flush,
  straight↔curve smooth, curve↔curve S-bend/continue), no overlap, no gap, seam
  seats de-duplicated. **On drop the snapped x/y/rotation persists via the
  ordinary move path** (mark dirty → Save) — the two remain INDEPENDENT tables
  that merely sit connected. Reload keeps them connected from each table's own
  coordinates. The drop marks BOTH the mover and the anchor dirty so the join
  survives reload even when the anchor was a freshly-added (unsaved) table.
- **No `link_group_id` written on any drag.** The interactive link layer is
  removed: the drag-to-weld link step, the chain-icon pull-to-join, the tap-to-
  link, `doLinkTables`, and the "Link" toolbar buttons + linking banner are all
  retired. The `linkTables` server action + `link_group_id` column + existing
  data are left intact (unused by the UI; `unlinkTable` still breaks legacy
  groups apart).
- **The joint is collision-CLEAN by GEOMETRY, no link exemption.** The old
  link-group collision exemption is deleted. `checkPlacement`/`penetrationDepth`
  now exempt exactly one thing — `atLegalJoint(a, b)`: two chain-class tables
  whose poses match a `legalJoinPose` candidate (coincident ends + rotation) are
  valid ADJACENCY, computed purely from the poses with NO `link_group_id`. Two
  independent connected tables pass the oracle with zero violations; a non-joint
  overlap always collides.
- **Round / sweetheart / king are standalone furniture — non-connectable.** The
  "round kiss" snap + exemption (`roundKissSnap`, `ROUND_KISS_GAP`) is removed.
  Rounds never snap and two overlapping rounds are always a collision (fixes the
  deep round-overlap screenshot). Connectable set = {long_banquet, family_head,
  serpentine}, cross-family allowed among these.

Tests: `lib/seating-weld.test.ts` rewritten around positioning — serpentine +
banquet + cross-family connect land at coincident, tangent-continuous, de-duped
joints that `checkPlacement` accepts with NO link; a save/load round-trip keeps
the joint from each table's own coords; the adjacency holds with `link_group_id`
null; rounds never connect and always collide. Updated the oracle + e2e tests off
the retired link-exemption / round-kiss. Full unit suite green (1893).

SPEC IMPACT: None. Supersedes the 2026-07-16 verdict's "round kiss" join and its
`link_group_id`-based collision exemption: round is standalone, and connection is
positional geometry (no link). Linking itself is deferred to a future PR.
