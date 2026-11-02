# Changelog fragment — collected into CHANGELOG.md by scripts/changelog-collect.mjs

## 2026-07-14 · fix(papic): capture photos at high resolution (was shipping ~VGA)

Papic — the candid-PHOTO product — was grabbing stills by canvas-drawing the live video (`papic-guest-capture.tsx` / `papic-seat-capture.tsx` at `video.videoWidth × videoHeight`), and the shared camera hook (`lib/use-papic-camera.ts`) requested the stream with **no resolution constraint** → the browser default (~VGA/640×480), so photos shipped **far below the phone's real camera capability.**

- **`lib/use-papic-camera.ts`**: `acquire()` now requests `ideal` **2560×1440 (QHD)** on both the `deviceId` and `facingMode` constraint paths. `ideal` (not `exact`/`max`) targets high-res and **degrades gracefully** on weaker cameras (no `OverconstrainedError`); 5s clips off the same stream stay manageable. One edit covers **both** capture surfaces (guest + seat) since both use this hook.

Result: stills jump from ~0.3 MP to up to ~3.7 MP (≈4–10×), uniformly on iOS + Android. No migration/schema/price. tsc + lint + build green.

Note: true full-**sensor** stills (12 MP+) would need `ImageCapture.takePhoto()`, which iOS Safari doesn't support — deferred as an Android-only enhancement. This stream bump lifts every platform.

SPEC IMPACT: None — capture-quality improvement (Papic photo resolution). CALL 720p cap (#3231) was the opposite trade-off (lean); Papic wants quality (photos are the deliverable, stills don't stream). Logged in `DECISION_LOG.md`.
