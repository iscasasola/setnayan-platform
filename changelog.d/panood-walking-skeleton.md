## 2026-07-09 · feat(panood): walking skeleton — one real camera → the control room's PROGRAM monitor

Phase 2, PR #1 of the Live Studio controller build. Promotes the proven homepage-demo WebRTC transport (`lib/demo-webrtc.ts`) into a real event transport `lib/panood-webrtc.ts` (signaling channel `panood-rtc:{eventId}`, dynamic `cam{index}` slots so it scales past the demo's fixed two), and wires both ends:

- **Publisher** — the camera-operator page (`/panood/cam/[token]`) now publishes its `getUserMedia` stream to the couple's control room over WebRTC (was local-preview-only).
- **Viewer** — the control room's PROGRAM monitor renders the on-air camera's live feed (was a placeholder). Program-source key `cam{index}` maps 1:1 to a camera slot.

Flag-gated behind **`NEXT_PUBLIC_PANOOD_STREAMING_ENABLED` (default OFF)** — inert in prod (publish view stays preview-only, control room shows the placeholder) until the owner flips it for a real-event test (the couple's-unrepeatable-day gate). Media is peer-to-peer, STUN-only (no TURN), nothing recorded or stored — owner-locked light-privacy. Source tiles + venue-screen video stay placeholders (later PRs; this PR is one-camera → PROGRAM only).

⚠ Needs a **2-device runtime test** (phone publisher + laptop control room, flag ON) — WebRTC can't be exercised in CI. Typecheck + lint pass.

SPEC IMPACT: None — implements the controller media core per `Live_Studio_Repackaging_2026-07-08.md` + the 2026-07-03 demo groundwork.
