## 2026-06-29 · feat(stories): camera-move engine + live preview (Tier 1 · §16.9)

The "Vids AI" effect for Guest Stories — still photos that read as *filmed*
(push-in / pan / roll / orbit-feel) instead of slideshowed. Deterministic
transform math, no per-render AI, ₱0 per render (only marginal cost is R2).
Client-side, so it's NOT blocked by the absent server render pipeline.

- New `lib/stories-camera-move.ts` — render-target-agnostic engine: `cameraAt()`
  (the move envelope), `depthAdjust()` (Tier-3 per-layer parallax), `beatPunch()`
  (= the §16.4 `downbeat_accent:"zoom_punch"`), `toSvgTransform()`, and
  `defaultCameraMove()` (a tasteful per-slot move rotation). Pure — no React, no
  DOM, no deps. The same functions drive the §16.8 Phase-1 preview, the Phase-2
  client render, or a future server render.
- New `lib/stories-camera-move.test.ts` — 11 `node:test` cases (determinism,
  overscan ≥ 1 so pan/roll never reveal the edge, depth separation, punch decay).
- `lib/stories-templates.ts` — `StorySlot` gains an optional `cameraMove` field
  (backward-compatible; unset = no move = legacy behavior).
- New `app/camera-move-preview/page.tsx` — internal live preview: the engine
  running over a real wedding photo (rigid Ken-Burns) or a layered vector scene
  (to show the depth parallax that sells the orbit). The §16.8 Phase-1 surface.

Honesty lock carried from the spec: this is a fake-depth move (push-in + 2.5D
parallax + auto-reframe) that READS as a circling camera — NOT a true 360° orbit
(a real orbit needs generative image-to-video = per-render cost = breaks the
"template-driven, no per-render AI" lock).

SPEC IMPACT: None — implements the already-landed §16.9 of
`14_Music_Catalogue_Cowork_Playbook.md` (corpus decision logged 2026-06-29).
