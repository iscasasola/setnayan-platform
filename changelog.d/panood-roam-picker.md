## 2026-07-23 · feat(live-studio): wire Live Studio ROAM picker into the event page (flag-dark)

PR 2 of the ROAM series — connects the `RoamWatchPicker` (built in the foundation
PR) to the couple's public event page, still behind `NEXT_PUBLIC_PANOOD_ROAM_ENABLED`
(default OFF).

- The public event page (`app/[slug]/page.tsx`) now carries the Roam manifest ON
  the existing `watchLive` object (new optional `roam` field), so no prop-threading
  change was needed — every existing `watchLive` render site keeps working.
- When the flag is ON and `events.panood_roam_manifest` is non-empty, the day-of
  watch section fetches the manifest, sets the featured zone as the fallback embed
  (so a Roam-only event with no CAST watch URL still renders), and `WatchLiveBlock`
  swaps the single embed for the camera/zone/venue picker.
- When the flag is OFF (prod default), the whole block is skipped and CAST
  behavior is byte-for-byte unchanged. `fetchRoamManifest` graceful-degrades to []
  pre-migration, so flipping the flag on a DB without the column can't crash.

SPEC IMPACT: None (implements the already-recorded `Live_Studio_Cast_and_Roam_2026-07-23.md`; no new decisions).
