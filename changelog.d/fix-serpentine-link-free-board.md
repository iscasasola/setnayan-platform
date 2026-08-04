## 2026-07-16 · fix(seating): serpentine (and rect/round) chain-link now welds on the FREE board, not just a sized venue

Owner: "the serpentine link tables still does not combine well — they overlap."

Root cause (measured live, not guessed): on a floor plan with NO venue
dimensions set (`venueScaled` false — the default), the chain-icon link path
`doLinkTables` was gated behind `venueScaled`, so it **grouped the two tables in
place without snapping them to a legal joint**. Two serpentines linked this way
kept whatever centres they had — measured on the repro board: the wedges'
centres sat ~91 px apart with a 180° rotation delta, when a clean tip-to-tip
S-bend needs ~164 px (2× the 82 px end-edge offset). ~73 px too close → the
bodies visibly interpenetrate. The drag-snap gesture never had this gate, which
is why *dragging* one wedge onto another welded fine but the *chain-icon link*
did not.

- `seating-editor.tsx` — `doLinkTables`: dropped the `venueScaled` condition
  from the pull-to-join guard. Every helper the weld calls already has a
  free-board path (`legalJoinPose` is pure px; `gapPxNow()` falls back to
  `COLLIDE_GAP`; `poseAt`/`scaleOf` resolve scale 1 when `pxPerMeter` is null;
  `zonesFor` still returns the dance/cocktail zones), so the gate was purely
  over-restrictive. Now B animates to the nearest oracle-valid legal joint on A
  before linking on the free board too — serpentines chain into a clean
  S/circle, banquets join flush, rounds kiss, on ANY board.

No geometry, oracle, snap-kernel, schema, or 3D change — `legalJoinPose` /
`isLegalJoint` were already correct (and stay green); they simply weren't being
invoked on the free board.

Existing linked units saved with the old in-place grouping keep their stored
poses (linked members are collision-exempt, so the resolver won't heal them);
Break apart + re-link (or drag end-to-end) re-welds them cleanly.

`tsc` clean · seating suites 147/147 (seating + oracle + 3D + reconcile). The
drag/link canvas gesture isn't headless-verifiable (pointer-driven, auth-gated
editor) → owner confirms live: on an event with no venue size set, link two
serpentine tables via the chain icon; they should snap into a clean S/circle
joint instead of overlapping.

SPEC IMPACT: None (editor link-gesture gate fix).
