## 2026-07-25 · feat(live-studio): approved single-screen controller layout (wave 1, dark)

Rebuilds the Live Studio controller (`/dashboard/[eventId]/studio/live-studio-control/setup`)
to the **owner-approved prototype** — the whole operating loop on ONE phone-first screen,
with one desktop breakpoint. Additive on PR #3683's shared free/paid controller; no schema
change, RLS untouched, still dark behind `NEXT_PUBLIC_LIVE_STUDIO_ROAM_ENABLED`.

**Wave 1 (Live_Studio_Unified_Spec_2026-07-25 § 4b):**

- **Status row** (44px) — event name · Off air/On air chip · Free chip. Replaces the
  150px masthead (the page keeps an `sr-only` h1 + its back doorway).
- **CH 1 monitor** — the CONTROLLED SCREEN: `CH 1 · Controlled screen` label, the on-air
  channel's identity, red edge + `ON AIR` badge under tally discipline, and a "Clear"
  control. **No faked video** — it reuses the shipped control room's honest
  "preview — live video arrives with the streaming rollout" placeholder.
- **Transport** — one wide `Go live` / `End broadcast` button driving the already-live
  `goLivePanood` / `endPanoodBroadcast` actions (free for every host), with plain-English
  reasons instead of a dead button when YouTube isn't connected.
- **Camera-channel grid** — CH 2+, each wearing the HOST'S OWN name/venue, ★ on the
  default, one tap = put that channel on Channel 1 (`cutToMainStage`), ✎ rename in place.
- **Free-vs-paid in place** — a free host keeps CH 1 + ONE usable channel (CH 2 = their own
  camera) and sees the rest of the grid locked with 🔒 "Unlock to use" + an inline
  `Unlock · <catalog price>` bar. The grid a free host sees contains **zero** cut controls
  (`ChannelTile.cuttable` is false for all of them); the server-side
  `requireLiveStudioOwned` backstop is unchanged.
- **Desktop (≥lg)** — monitor + transport left, channel grid right; same components.

**Channel vocabulary** (owner-locked): Channel 1 is the controlled screen, cameras are
numbered channels, "Main Stage" is a camera NAME. Internal names (`is_main_stage`,
`live_studio_roam_zones`) are unchanged — only the words the host reads.

**Honest omissions (§ 4b no-fake-door rule):** no Split/PiP chips, no Ⓜ monogram, no
lower-third, no event-QR overlay, no ⚡ highlight button (Wave 2 / P2). No viewer counter
and no on-air timer — no live viewer data exists yet, and a fabricated number would be a
fake door with a number on it. Guest-pick renders as **state, not a switch**: there is no
persisted off-switch yet, so a toggle would be a control that silently does nothing.

**New:** `renameRoamZone` server action (the ✎; reuses the add form's normalizers and the
same host + ownership gates) · pure `buildChannelTiles` / `channelForZoneIndex` /
`formatChannel` helpers in `lib/live-studio-control.ts` · 8 new unit tests covering the
numbering, the free/paid gate, tally truth, and the 12-camera cap.

SPEC IMPACT: None — implements the already-approved design in
`Live_Studio_Unified_Spec_2026-07-25.md` § 4b Wave 1. Two owner questions are surfaced in
the PR body rather than silently decided (guest-pick persistence; whether the buy page's
"directed Main Stage" copy should be reworded to the channel vocabulary).
