## 2026-06-27 · feat(papic): on-viewfinder flip + lens (.5/1) camera controls

Both Papic web capture surfaces (claimed-seat paparazzo + per-guest disposable
camera) now carry camera controls on the viewfinder:

- **Flip camera** (front ↔ back) — works on every phone with a second camera;
  the selfie preview mirrors (scaleX(-1), preview only — saved frame is
  un-mirrored, the platform standard).
- **Lens toggle (.5× / 1×)** — gated to what the device actually exposes, so no
  dead buttons (owner 2026-06-27 "build all, gate by device"):
  - zoom-capable track (modern Chrome/Android logical cameras with a `zoom`
    capability dipping below 1×) → applies live via `applyConstraints`, no
    re-acquire;
  - else a distinct ultra-wide videoinput device → switches `deviceId`;
  - else (iPhone Safari/PWA only exposes one back camera; most front cameras) →
    the toggle isn't shown. The "selfie wide/normal" ask is the same lens logic
    applied to the front facing — it appears only where the front camera offers
    a second lens.
- Full lens parity (true 0.5× ultra-wide + front wide/normal on iPhone) needs the
  native camera APIs and lands with **native Papic (Phase 2)**.

Shared `usePapicCamera` hook now owns the single getUserMedia stream (the
iOS-safe one-stream shape) for both surfaces; capture/record/tag flows freeze
while the stream re-acquires (flip / deviceId lens swap).

New: `apps/web/lib/use-papic-camera.ts`, `apps/web/app/papic/_components/camera-controls.tsx`.

SPEC IMPACT: None — UX refinement of an existing surface (0012 Papic); no SKU,
schema, pricing, or scope change. Native Phase-2 lens parity already noted in the
corpus. Decision-log row appended.
