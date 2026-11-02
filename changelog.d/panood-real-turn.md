# Changelog fragment — collected into CHANGELOG.md by scripts/changelog-collect.mjs

## 2026-07-14 · fix(panood): TURN relay for the REAL Live Studio (operator phones → control room)

Extends the demo's TURN fix (#3226) to the real Live Studio transport (`lib/panood-webrtc.ts`). Same root cause: the operator-phone → control-room ingest leg was **public-STUN-only**, so a camera operator on their own mobile data (CGNAT) or an isolated venue Wi-Fi couldn't reach the control room and dropped. (The YouTube broadcast leg is untouched — TURN only relays the camera ingest, never the audience.)

- **`lib/panood-webrtc.ts`**: `publishPanoodCamera` / `watchPanoodCameras` take an optional `iceServers` (STUN-only default → backward-compatible), used in both `RTCPeerConnection` calls. Header updated.
- **`getPanoodIceServers(eventId)`** (new server action in `app/panood/actions.ts`): STUN always + a short-lived Cloudflare TURN relay (via the existing `lib/turn.ts` from #3226) when streaming is live. Gated so it isn't an open faucet — TURN is minted only when `NEXT_PUBLIC_PANOOD_STREAMING_ENABLED` is on AND the event exists (admin existence probe). STUN-only fallback when streaming off / event unknown / TURN unconfigured / Cloudflare errors.
- **Callers wired**: the control room (`broadcast/control-room.tsx`) and the camera operator (`panood-camera-publish.tsx`) both fetch ICE servers before opening any peer connection so they meet on the SAME relay.
- **`.env.example`**: the Cloudflare TURN section now notes it powers the demo, the real Live Studio, AND vendor calls (same two vars).

No migration/schema/price change. Reuses the one Cloudflare TURN key. Doubly dark: the whole surface is behind `NEXT_PUBLIC_PANOOD_STREAMING_ENABLED` (off in prod), and TURN itself is behind the Cloudflare env (unset) → STUN-only until both are set. Cost is ~₱0 at any realistic scale (a maxed 8-cam 24h event ≈ 215 GB, well inside the 1,000 GB/mo free tier).

SPEC IMPACT: Reverses "ICE is public STUN only — NO TURN in V1" for the **real Live Studio** (owner-approved 2026-07-14, "turn on real live studio"; extends the 2026-07-13 demo-scoped reversal). Logged in `DECISION_LOG.md`. The remaining STUN-only surface is the vendor↔couple call (`lib/call-webrtc.ts`) — next candidate.
