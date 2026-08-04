## 2026-07-25 · feat(live-studio): rehearse free, pay to broadcast — relocate the paywall

**Live Studio Wave 3** (owner-locked 2026-07-25 · `Live_Studio_Unified_Spec_2026-07-25.md` § 4d).
Moves the Live Studio paywall off the *mechanic* and onto *publication*. Stays dark behind
`NEXT_PUBLIC_LIVE_STUDIO_ROAM_ENABLED`. No migration.

**The model.** FREE = private rehearsal, unlimited (add cameras, name/rename channels, tap-cut
between them on CH 1, place the monogram + lower third, set guest-pick) · FREE = broadcasting ONE
camera (unchanged — the live `/pricing` "Single-camera livestream" promise is intact) · PAID ₱2,999 =
broadcasting MULTI-CAM. Event QR stays free; "Powered by SETNAYAN" stays forced on free broadcasts.

**The gate moved.**
- NEW `apps/web/lib/live-studio-publish.ts` — `decidePublish` / `limitPublishedManifest` /
  `canPublishMultiCam` (fail-closed). One free published channel; 2+ needs `LIVE_STUDIO`.
- Enforced in `mirrorRoamManifest` (`lib/live-studio-roam-provision.ts`) — the ONLY writer of
  `events.live_studio_roam_manifest`, the only column that makes a multi-channel stream
  guest-visible. Reduction is by OMISSION: withheld channels' video ids never leave the server.
- Re-enforced on every public read in `app/[slug]/_lib/loaders.ts`, BEFORE `applyGuestPick`, so a
  lapsed/refunded entitlement collapses an already-published multi-cam stream back to one channel
  (settings persist; permission does not).
- `requireLiveStudioOwned` REMOVED from the 9 rehearsal/config actions in
  `.../live-studio-control/setup/actions.ts` (add/delete/rename/cut/clear/feature zone, monogram,
  lower third, guest-pick). It remains ONLY on `markHighlight` / `deleteHighlight` (paid on-air).
- Single-cam `goLivePanood` / watch-url path untouched.

**UI — the boundary is legible, not padlocked.**
- The dimmed/greyscale tile with a 🔒 "Unlock to use" badge is DELETED, along with
  `ChannelTile.locked`, the `'placeholder'` tile kind and `LOCKED_PLACEHOLDER_NAMES`. Every
  configured camera renders at full brightness, cuttable, for every host; the CH 1 rehearsal
  preview is not dimmed or watermarked. Seeing the cameras work IS the conversion mechanism.
- NEW contextual `Unlock to broadcast` chip on a 2nd+ camera the moment the host puts it on CH 1
  (ordinal-based, so a deleted CH 2 never mis-nudges), placed clear of the tally chip. A nudge, not
  a block — the cut has already succeeded. Absent for entitled hosts.
- NEW go-live-moment line `Rehearse free · Unlock <price> to broadcast all your cameras`, shown only
  when an un-entitled host has >1 camera configured. Price from the live catalog, never hardcoded.
- Overlays split into `rehearsalOverlays` (as-if-owned, drives the monitor + chips) and
  `airOverlays` (entitlement-derived, states what actually airs) — same `resolveOverlays`, so they
  cannot drift.
- **Thumbnails:** no thumbnail source exists (nothing binds a joined phone to a ROAM channel;
  `camera_operator_id` has zero writers, `status` never leaves its `'planned'` default). Rather than
  fake a frame, tiles now state the channel's REAL state via `channelReadyCaption` ("Waiting for a
  camera" / "Camera connected" / …).

**Tests** (`lib/live-studio-publish.test.ts` new · `lib/live-studio-control.test.ts` rewritten): the
publish decision + reduction + fail-closed paths; guest-pick cannot re-expand what the paywall
removed; nudge fires only for an un-entitled host on an engaged 2nd+ camera and never blocks; the
un-entitled grid is byte-identical to the paid grid; and static WIRING guards asserting the gate is
still called at both enforcement points, that no rehearsal action has had `requireLiveStudioOwned`
re-added, and that the Setnayan bar is still derived-not-stored. Wave 1/2 tests that asserted the
dimmed/locked treatment were reversed with a comment saying why.

SPEC IMPACT: **PAYWALL RELOCATION.** `Live_Studio_Unified_Spec_2026-07-25.md` § 4d is now
implemented and supersedes the §§ 4b/4c gating description (`requireLiveStudioOwned` on the cut +
config actions, locked/padlocked tiles, guest-pick and overlays as PAID). Live Studio ₱2,999 is
unchanged in price but now buys BROADCASTING multi-cam, not USING the controller. § 4c's
"reality per feature" table needs the gating column re-read against
`apps/web/lib/live-studio-publish.ts`. The § 4c 🚨 open owner decision (full-screen
`lib/panood-watermark.ts` paywall overlay vs the "Powered by SETNAYAN" lower third — both still
draw) is UNRESOLVED and still blocks the flag flip; this PR did not touch it.
