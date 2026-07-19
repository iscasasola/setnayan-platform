## 2026-07-09 · feat(home): "Walk around" on the homepage 3D demo (desktop tap-to-dance)

The homepage 3D-Plan demo overlay was the QR-minting pitch only ("Click a guest …
opens the room from that guest's phone"); the interactive walking/roaming/dancing
lived on the phone guest-view (its "Walk around" → roam). So a DESKTOP visitor
couldn't tap the dance floor and watch a character dance without scanning the QR
to their phone first.

- `plan3d-demo-overlay.tsx`: add an opt-in **"Walk around"** toggle (mirrors the
  phone guest-view's own "Walk around"). OFF (default) = the unchanged whole-room
  orbit + click-a-guest-QR pitch. ON = pass `roam={{ guestId: guests[0] }}` to the
  scene, so a chase cam follows a guest — tap the floor to walk them, tap the
  **dance floor** to make them dance (the merged tap-to-dance). Guest-click
  (find-my-seat QR) still works inside roam (per the scene's own contract).

No new dependency; `Plan3DSceneLoader` already forwards `roam` (the phone view has
used it since the guest-walk shipped). Reuses the already-live `dancePose` +
dance-floor tap.

SPEC IMPACT: 0008_seating_chart_editor/0008_3DPlan_Fable_Design_2026-07-08.md —
the homepage demo can now roam + tap-to-dance on desktop (was phone-only).
