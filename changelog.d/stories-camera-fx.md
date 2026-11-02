## 2026-06-29 · feat(stories): beat-punch + auto-reframe + depth parallax (§16.9 Tiers 1–3)

Completes the §16.9 camera-move feature for Guest Stories. Builds on the engine
(#2387) and the live-render wiring (#2401). All deterministic, ₱0 per render.

- **Beat-punch (live now).** `beatPunchAtDownbeats()` punches the zoom on the
  music's ACTUAL downbeats (`beat_grid.downbeats`), not a uniform bpm. Wired into
  both encode paths in `reel-render.ts` (multiplied into the camera scale per
  frame). Photo slots only — clips/booth untouched. Self-disables when a track
  has no beat grid.
- **Auto-reframe (live now, upgrade-ready).** `resolveFocus()` makes the zoom
  converge on the subject instead of dead center. `drawCover()` now scales/rotates
  about a focal point (new `withCamera()` helper). With no detector it uses a
  deterministic portrait bias (slightly above center, where faces sit); an
  optional `RenderClip.subjectCenter` lets a face/subject detector drive it
  exactly once that model is hosted.
- **Depth parallax (render path complete; inert until a depth model lands).**
  New `RenderClip.depthUrl` + `buildNearLayer()` compose a 2.5D effect: the photo
  is split into a far layer and a depth-masked NEAR layer (alpha = depth-map
  luminance, built once per photo) that moves ~1.6× more, so foreground separates
  from background — the real "orbit" depth. Gracefully falls back to a flat move
  when there's no `depthUrl` (so it adds ZERO cost to today's renders). Generating
  the depth map at ingest is the owner-infra model step (pick an OSS depth model;
  in-browser per-photo is the mobile long-pole flagged in §16.8 — spike first).

Tests: +3 engine cases (downbeat punch, focus resolution). 21/21 green across
both stories suites. Verified the depth pipeline visually with a synthetic depth
map (near layer 72% opaque; far/near separate in the composite). tsc + lint clean.

SPEC IMPACT: None — implements §16.9 Tiers 1–3 of
`14_Music_Catalogue_Cowork_Playbook.md`.
