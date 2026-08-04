## 2026-07-09 · feat(home): golden-hour cinematic look on the homepage 3D demo (Tier A, phone-safe)

The homepage 3D Plan demo mounted the scene with `cinematic` defaulting off, so it
ran the plain `standard` lighting while the lab's Play mode and the phone guest-walk
already had the warm golden-hour treatment. Flip it on for the marketing demo.

- `plan3d-demo-overlay.tsx`: pass `cinematic` to `Plan3DSceneLoader`. This is **Tier
  A only** — the palette-warm grade (`grade="play"`, pure light knobs) + the
  `StringLights` instanced bulb strands. There is **no Tier B** here: `plan3d-scene`
  never imports `postprocessing`/`@react-three/postprocessing` (that dynamic import
  lives solely in the lab's `seating-lab-3d.tsx`), and no dust motes are wired into
  the demo scene.
- **Phone-safe by construction**: the look rides the demo's existing quality knob
  (`quality={isMobile ? 'low' : 'high'}`), so mobile gets halved string-light
  strands and the free grade; the heavy bloom/DoF composer can never enter the
  homepage chunk. String lights already self-suppress when the couple's ceiling
  treatment occupies the band (`ceilingDecorOccupied`). Verified: `bundle-size-check`
  confirms `postprocessing` stays out of the homepage/demo chunks.

SPEC IMPACT: 0008_seating_chart_editor/0008_3DPlan_Fable_Design_2026-07-08.md — the
homepage demo now shows the Tier A cinematic grade (the lab-Play look, minus the
lab-only Tier B).
