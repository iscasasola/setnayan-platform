# Changelog fragment — collected into CHANGELOG.md by scripts/changelog-collect.mjs

## 2026-07-14 · fix(call): TURN relay for the vendor↔couple call — the last STUN-only surface

Completes the TURN rollout. The 1:1 vendor↔couple call (`lib/call-webrtc.ts`) was the last public-STUN-only WebRTC surface — so a couple (or coordinator) on their own mobile data (CGNAT) or an isolated venue Wi-Fi couldn't connect and the call silently failed. And it's a *paid* capability now (#3227), which made it the most exposed.

Same pattern as the demo / Live Studio:
- **`lib/call-webrtc.ts`**: `joinCall` takes an optional `iceServers` (STUN-only default via `DEFAULT_ICE_SERVERS`), used in `ensurePeer`'s `RTCPeerConnection`.
- **`getCallIceServers(threadId)`** (server action in `thread-call-actions.ts`): STUN always + a short-lived Cloudflare TURN relay (via `lib/turn.ts`) — gated to a real thread **member** (RLS-scoped `fetchThreadById` returns null for non-members, so it's existence + membership in one check; not an open faucet). STUN-only fallback when non-member / TURN unconfigured / Cloudflare errors.
- **`thread-call-room.tsx`**: fetches ICE servers before `joinCall` and passes them (with a post-await cancellation re-check).

Reuses the single Cloudflare TURN key (env-dark → STUN-only until set). No migration/schema/price change. tsc + lint + build green. All three WebRTC surfaces (demo · Live Studio · call) now have TURN.

SPEC IMPACT: Extends the 2026-07-13 demo-scoped STUN-only reversal to the vendor↔couple call. Logged in `DECISION_LOG.md`. The call transport is still 1:1; the 3-way mesh (coordinator seat) builds on this next.
