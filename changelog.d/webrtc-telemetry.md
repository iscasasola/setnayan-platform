# Changelog fragment — collected into CHANGELOG.md by scripts/changelog-collect.mjs

## 2026-07-14 · feat(observability): WebRTC relay-vs-direct telemetry ("how often does TURN kick in?")

The three WebRTC surfaces (demo · Live Studio · call) share one 1,000 GB/mo Cloudflare TURN budget, but the app had no visibility into how often a connection actually *relays* (TURN) vs goes *direct* (STUN) — only Cloudflare's GB dashboard. Adds an app-side signal so the owner can watch the relay rate and see which surface spends the budget.

- **`lib/webrtc-telemetry.ts`** (new, client): `reportConnectionType(pc, surface)` — on the first `connected`, reads `pc.getStats()`, finds the winning ICE candidate pair, and reports whether it's a **relay** (either candidate `candidateType === 'relay'`) or direct, plus a `local/remote` type tag. Self-detaches after one report; fully swallowed (telemetry must never affect a call).
- **`reportWebrtcConnection`** (new server action): fires a PostHog `webrtc_connection` event via the existing `captureEvent` — **no PII** (just `surface` · `connection_type` · `relayed`); no-op when PostHog env is unset.
- **Wired at all 5 peer-connection sites**: `call-webrtc.ts` (1), `demo-webrtc.ts` (2), `panood-webrtc.ts` (2), tagged `call` / `demo` / `panood`.

No migration/schema/price change. Owner can build a PostHog insight: `relayed` rate by `surface`. Part of the "make the most of the 1,000 GB/mo TURN free tier" plan (companion to Cloudflare billing + the direct-first levers: IPv6, Wi-Fi nudges, 720p call cap).

SPEC IMPACT: None — observability only. RA 10173 clean (no PII, opt-out honored by PostHog config). Logged in `DECISION_LOG.md`.
