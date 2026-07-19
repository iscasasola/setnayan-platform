# Changelog fragment — collected into CHANGELOG.md by scripts/changelog-collect.mjs

## 2026-07-14 · perf(call): cap vendor↔couple video call at 720p @ 30fps

The vendor↔couple video call (`thread-call-room.tsx`, shared by the "Call" tab and the appointment video/voice join) captured with a bare `video: true` — so it took whatever the device offered, sometimes 1080p/60fps. For a talking-heads call that's overkill: it burns ~2× the bytes of 720p for no visible gain at call-tile sizes, drains mobile battery, and (when a link relays) doubles TURN relay data.

- **`thread-call-room.tsx`**: the video-call `getUserMedia` now requests `width {ideal:1280,max:1280}` · `height {ideal:720,max:720}` · `frameRate {ideal:30,max:30}`. `ideal`+`max` firmly caps at 720p30 while still returning a stream on cameras that can't hit exactly 720p (downscales to fit — no `OverconstrainedError`). WebRTC still adapts *down* on weak networks.

Scoped to the CALL only (owner 2026-07-14). **Live Studio** (`panood-camera-publish.tsx`) and **Papic** (`use-papic-camera.ts`) keep their own capture settings — untouched.

Part of the "make the most of the 1,000 GB/mo TURN free tier" plan: leaner call streams = less relay data = more real usage inside the free tier.

SPEC IMPACT: Minor — call video-capture quality tuning (720p/30fps ceiling for the vendor↔couple call, not Live Studio/Papic). Logged in `DECISION_LOG.md`. No SKU/schema/pricing change.
