## 2026-06-22 · feat(seating-3d): Play-settle bloom for the 3D floor monogram (paid)

PR2 of the 3D-monogram rollout (the static floor medallion shipped #1998). When
the couple owns the paid **ANIMATED_MONOGRAM**, the floor mark now BLOOMS in
(opacity 0.25→1 + scale 0.9→1, ease-out cubic, ~0.6s) each time the Play-mode
camera finishes its ease — the cinematic reveal beat. Free events keep the static
mark, so the seat-plan tool stays free.

- `page.tsx` resolves ownership via `eventAnimatedMonogramActive` (degrades to
  false → no bloom) and threads an `animatedMonogram` boolean through the loader.
- `seating-lab-3d.tsx`: a new `FloorMonogram` component owns the tween — it
  detects the rising edge of `playSettled` (`mode === 'play' && !camBusy`, reusing
  the existing CameraRig busy state, no new callback) and animates the material
  opacity + mesh scale in a single `useFrame`. The CanvasTexture is still built
  ONCE upstream (never re-rasterized per frame). Honors `prefers-reduced-motion`
  (stays full, no tween). Static behavior for free events is unchanged.

Flag-gated surface (`NEXT_PUBLIC_SEATING_3D`). No DB, no new SKU (reuses the
existing ANIMATED_MONOGRAM entitlement).

SPEC IMPACT: None (0008 seating + 0037 monogram; the paid animation applied to
the 3D floor mark). Rollout progress in `DECISION_LOG.md`.
