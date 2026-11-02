## 2026-09-19 · fix(papic): a refused read no longer reads as "nothing shot yet" or "your link is dead" (S41b · couple 3)

COUPLE-FACING tier of `result-dropped-silently` (S26 baseline, #5625), batch 3:
Papic. 28 sites, all option (a): join the missing end.

On screen:

- **Home tile + free-camera nudge**: `countLiveCameras` / `countCrewPhotos` /
  `countPapicCaptures` chose 0 on a refused count. A zero is the "nothing shot
  yet" signal, so the tile flipped back to "shots ready · 0 cameras out" and the
  "your free camera is ready" nudge showed on an event that might be mid-shoot.
  (The nudge's own docblock said it failed to false. The code did not.) Each
  count is now `null` when it was not measured. `preCapture` is true only on a
  measured zero, and the tile says "couldn't count photos / cameras".
- **Guest pool gallery**: a refused read printed "No photos yet — check back
  soon!". `PoolPage.unreadable` now drives a could-not-load state. Load-more gets
  a 503 `unreadable` and keeps its cursor so the guest can retry.
- **Crew seat claim**: a refused read sent a crew member with a good link to the
  terminal "This link isn't active — ask the host" screen. `seatClaimability`
  now returns `unreadable`, and the claim form comes back with a retry notice.

Reason kept, behaviour unchanged (documented degrades, fail-closed gates, or no
render): seat and camera provisioning ×6, Limited re-tiering ×3, tier config ×2,
pool status, face mode, drive-copy strays, gallery scope, blur stand-ins, own
camera points, ingest fidelity, guest live gallery (already `null`), face-match
upsert, Live Studio roam/guest-pick ×3, guest-capture gate (fails open, documented).

`papic-home-tile.test.ts` asserted the zero ("a failing capture-count table is a
zero"). It now asserts `null`, `preCapture: false` and no nudge.

SPEC IMPACT: None
