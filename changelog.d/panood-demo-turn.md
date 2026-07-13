# Changelog fragment — collected into CHANGELOG.md by scripts/changelog-collect.mjs

## 2026-07-13 · fix(panood): Live Studio DEMO gets a TURN relay so it syncs on all networks (owner-approved STUN-only reversal, demo-scoped)

The homepage Live Studio demo synced for some phones and not others — reported as "3 Android phones didn't sync." Root cause was NOT device/OS: the demo transport (`lib/demo-webrtc.ts`) was **public-STUN-only, no TURN**. STUN can't traverse symmetric NAT / CGNAT — which is the norm on PH mobile data (Globe/Smart/DITO) and on client-isolated venue/guest Wi-Fi — so a hard-NAT phone↔control-room pair had no relay to meet at and timed out after 15s. The `getUserMedia` capture code is fine on Android (uses `ideal` constraints, mic-blocked fallback); the Android clustering was which networks those phones were on, not the OS.

Fix (scoped to the DEMO only — the real Live Studio `lib/panood-webrtc.ts` and the vendor call `lib/call-webrtc.ts` are untouched):

- **`lib/turn.ts`** (new, `server-only`): `mintTurnIceServers()` mints short-lived Cloudflare Realtime TURN credentials via `POST /v1/turn/keys/{id}/credentials/generate`, TTL 30 min (outlasts the 20-min demo session). Reads `CLOUDFLARE_TURN_KEY_ID` + `CLOUDFLARE_TURN_API_TOKEN` (server-only; the API token never reaches the browser). Unconfigured or Cloudflare-errored → returns `[]` and callers fall back to STUN-only, i.e. exactly the pre-TURN behavior. Never throws.
- **`getDemoIceServers(sessionId)`** (new server action in `demo-session-actions.ts`): returns STUN always + a minted TURN relay when the session is live. Gated by new **`demoSessionIsLive()`** (`lib/demo-sessions.ts`) so it isn't an open relay-credential faucet.
- **`lib/demo-webrtc.ts`**: `publishDemoCamera` / `watchDemoCameras` take an optional `iceServers` (default = STUN-only `DEFAULT_ICE_SERVERS`, so the signature is backward-compatible). Both callers — the phone (`cam-join-flow.tsx`) and the control room (`panood-demo-overlay.tsx`) — now fetch ICE servers before opening any peer connection so both meet on the SAME relay.
- **Copy fix** (`cam-join-flow.tsx`): the failure hint no longer says "phone and computer on the same Wi-Fi usually does it" (wrong — same Wi-Fi with client isolation still fails, and TURN removes the same-network requirement). Now: "Switching your phone to mobile data (or a different Wi-Fi) usually fixes it."
- **`.env.example`**: documents the two new Cloudflare TURN vars + the owner provisioning step.

No migration — no schema change. **Owner action required to activate:** create a Cloudflare Realtime TURN key and set the two env vars in Vercel; until then the demo runs STUN-only (unchanged). Cost is bounded — only the hard-NAT minority relays (~$0.05/GB).

SPEC IMPACT: Reverses the owner-locked "ICE is public STUN only — NO TURN in V1" decision **for the homepage demo only** (owner-approved this session, 2026-07-13). Logged at the bottom of `DECISION_LOG.md`. The lock still stands for the real Live Studio and the vendor call until separately revisited.
