# Changelog fragment — collected into CHANGELOG.md by scripts/changelog-collect.mjs

## 2026-07-14 · feat(call): 3-way (up to 4) mesh-call transport + prototype route

Foundation for the group vendor↔couple call (owner design: 2-way default, a coordinator's 3rd seat, video-on-demand, active-speaker, cap 3–4). Built as a standalone prototype first — the exact path the 1:1 call took (`/prototype/call` → productionized) — so it can be validated on **real multiple devices** before touching any live surface. **Nothing in this PR touches the live 1:1 call, threads, or any product surface** — all-new files.

- **`lib/mesh-call-webrtc.ts`** (new): the 1:1 "perfect negotiation" transport (`lib/call-webrtc.ts`) generalized to an **N-way mesh** — one RTCPeerConnection per other participant, ADDRESSED sdp/ice (`to`), deterministic politeness per pair, presence via `hello`/`hello-ack`/`bye`. Media stays peer-to-peer (never a server, nothing recorded — same lock as the 1:1 call). STUN default + optional TURN `iceServers`. **`MAX_PEERS = 3`** (→ up to 4 participants) hard cap — free P2P mesh is comfortable to ~4; beyond needs an SFU. Includes an active-speaker signal (local mic-level analyser → broadcast → per-tile highlight) and mic/cam toggles.
- **`/prototype/mesh-call`** (new, `noindex`): open the same `?room=` on 2–4 devices to test a group call — live tiles, active-speaker ring, mic/cam/leave. STUN-only here (cross-network TURN is proven on the other surfaces; wired at productionization).

Deferred to PRODUCTIONIZATION (once validated on 3 devices): wire into the vendor↔couple thread with the **coordinator 3rd-seat gate** (a booked coordinator = an accepted `wedding_planner_external` `event_moderators` row — model already exists in `lib/coordinator-grant.ts`), **video-on-demand** (2 active video slots + audio-for-all), and TURN via `getCallIceServers`. No migration/schema/price. tsc + lint + build green.

SPEC IMPACT: New prototype surface only; no product/pricing change. Design + build state logged in `DECISION_LOG.md` and memory [[project_setnayan_turn_rollout]].
