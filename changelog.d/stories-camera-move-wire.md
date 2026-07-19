## 2026-06-29 · feat(stories): apply camera moves in the live reel render

Wires the §16.9 camera-move engine into the LIVE Guest Stories render so couples'
reels actually move — stills now read as *filmed* (push-in / pan / roll /
orbit-feel) instead of slideshowed. Follows the engine landed in #2387.

- `lib/reel-render.ts` — `RenderClip` gains optional `cameraMove`; `drawCover()`
  applies the virtual camera about the canvas center (translate/rotate/scale →
  `ctx.drawImage`), with the engine's overscan (≥1.16) guaranteeing pan/roll
  never reveal the backdrop. Both encode paths (WebCodecs frame loop +
  MediaRecorder rAF tick) compute per-frame progress `p` (0→1 across the slot)
  and call `cameraAt(clip.cameraMove, p)`. Clips (video) are untouched — they
  already move; the move is photo-only.
- `app/papic/me/[token]/_components/guest-story-maker.tsx` — each photo clip is
  assigned `defaultCameraMove(i)` so every Guest Story carries varied moves with
  no per-photo authoring.
- `lib/stories-templates.ts` — `buildSlotsFromBeatGrid` + `evenSplitSlots` now
  stamp photo slots with `defaultCameraMove(slotIndex)` (clips left moveless), so
  the beat-aware scaffold carries moves too.
- Tests: `stories-templates.test.ts` gains 2 cases (photo slots carry a move,
  clips don't; moves vary across a reel). 19/19 green across both stories suites.

Verified: the real `drawCover` transform path renders the sample wedding photo
with visible motion between p=0.10 and p=0.90 (push-in 1.16→1.28, pan ±13.6,
roll ∓0.96°; mean pixel diff 14.2). ₱0 per render. tsc + lint clean.

SPEC IMPACT: None — implements §16.9 of `14_Music_Catalogue_Cowork_Playbook.md`.
