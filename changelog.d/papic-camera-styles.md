## 2026-06-27 · feat(papic): event-wide camera look (Orig/Retro/Mono/Cine/Lomo)

The couple picks ONE Papic "look" when they set up their Papic account; it
becomes the locked event-wide template baked into every camera's photos (paid
seats, free sampler, guest disposables). Shooters never see a picker — the look
is a couple-side setup decision, applied uniformly so the gallery is one set.

- New `apps/web/lib/papic-photo-styles.ts` — the on-device look engine. Real
  per-pixel pipelines (tone-curve LUTs, channel WB, split-toning, Box–Muller
  film grain, separable-box-blur bloom, radial chromatic aberration, vignette)
  + a cheap `cssPreviewFilter()` for the live `<video>` preview. No server
  render (honours the no-video-render-pipeline constraint).
- Migration `20270307004141_events_papic_style.sql` — `events.papic_style`
  (TEXT, DEFAULT 'ORIG', CHECK in the 5 looks). NOT YET APPLIED to prod.
- Setup surface: new `studio/papic/style-picker.tsx` (5 CSS-previewed cards) +
  `setPapicStyle` server action (couple-only, allow-list validated) + a "Your
  Papic look" section on the Papic setup page.
- Capture surfaces read the locked style and apply it silently — picker REMOVED
  from `papic-seat-capture.tsx`; `papic-guest-capture.tsx` + the inline
  `[slug]` day-of camera both inherit it. A small read-only look pill shows the
  paparazzo which look is set.
- Architectural guards: faces auto-tag from the CLEAN frame BEFORE styling
  (MONO/LOMO/CINE would otherwise corrupt face-api's 128-d descriptors and tank
  the ≥0.85 auto-tag); CINE paints 2.39:1 letterbox BARS on LANDSCAPE frames
  only (no destructive crop — untagged-still-delivered + face boxes intact);
  clips (body + poster) stay un-styled (no V1 video pipeline) so the poster
  honestly matches the video. All style reads graceful-degrade to ORIG on a
  pre-migration DB.

Verified: repo typecheck 0 errors, `next lint` clean, engine harness (all 5
looks transform, no NaN, MONO true-grayscale, CINE bars landscape-only).

SPEC IMPACT: New Papic capture sub-feature (not in 0012 spec). NET-NEW V1 scope
+ a schema migration — flagged for owner sign-off before applying the migration
and merging. On confirmation: append a DECISION_LOG row + update 0012_papic.
Free (no SKU) — core capture polish, like the seat plan.
