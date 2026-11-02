## 2026-07-26 · docs(privacy): disclose peer-to-peer connections and IP visibility

Owner-directed 2026-07-26. Closes a live **disclose-then-enable** breach: `NEXT_PUBLIC_LIVE_STUDIO_ROAM_ENABLED` was flipped ON in production, activating guest-pick (#3725), which connects a watching guest's browser **directly** to a camera operator's phone over WebRTC. On a direct connection both ends learn each other's IP address, and `/privacy` said nothing about it.

**The gap is older and wider than guest-pick.** An audit of every `RTCPeerConnection` call site found four LIVE peer-to-peer surfaces, three of which predate guest-pick by ~17 days:

| Surface | Transport | First shipped |
|---|---|---|
| 1:1 vendor↔couple voice/video call | `lib/call-webrtc.ts` | 2026-07-10 (`634088f57`) |
| Camera operator's phone → couple's control room | `lib/panood-webrtc.ts` | 2026-07-09 (`0ddcc37c0`) |
| Homepage live product demo (two visitor devices) | `lib/demo-webrtc.ts` | — |
| Guest-pick: guest → operator's phone | `lib/live-studio-guest-pick.ts` | 2026-07-26 (#3725) |

The 1:1 call is open to everyone today — `resolveThreadCallsEnabled` returns `true` whenever `VENDOR_TIER_FEATURE_GATE` is off (its default) — and the launcher renders on four real thread surfaces. So the disclosure is written for the whole **class** of direct connections, not patched onto the newest instance.

**New `/privacy` section — "Live video connections (calls and event cameras)".** Placed with the other media-flow sections, in the page's existing plain-language voice. It states, each verified against code:

- **Direct connections reveal IP addresses**, with a plain explanation of what an IP address is here, that it is inherent to direct video connections rather than something Setnayan adds, and that the device also contacts a public STUN server (Google / Cloudflare) to discover its own address — the two STUN URLs actually configured repo-wide.
- **Setnayan does not store those addresses — but the page does not claim they never touch us.** ICE candidates carry IP addresses and are broadcast over our own Supabase Realtime signaling channel (`call:{room}`, `panood-guest:{eventId}`), so the addresses genuinely do transit our infrastructure. The copy says exactly that, then draws the honest line at storage. Verified against `lib/webrtc-telemetry.ts` + `app/_actions/webrtc-telemetry-actions.ts`: the only per-connection record is `{ surface, connection_type, relayed }` — ICE candidate *types* (`host`/`srflx`/`relay`), never addresses, never content.
- **Relay fallback.** Per `lib/turn.ts`, hard-NAT pairs route media through a **Cloudflare** TURN relay on short-lived server-minted credentials (the API token never reaches the browser). Described as transit, not storage.
- **Anonymous session on camera tap.** Per `app/panood/guest-pick-actions.ts`, tapping a side camera mints a native-anonymous Supabase session — disclosed as a session identifier with no name/email, created only on tap and never on page view.
- **Calls are never recorded** (owner-locked), stated positively. Retention scoped to what `thread_calls` actually stores (migration `20270715600000`): starter, kind, start, end.

Also: `Subprocessors` — Cloudflare extended to name the relay role, Google extended to name the public STUN server; a cross-reference bullet added to `What we do not collect`; `last updated` bumped to 2026-07-26.

**Deliberately NOT disclosed.** Multi-camera *continuous recording of every angle* is discussed but unbuilt — describing it would make `/privacy` inaccurate in the other direction. `lib/mesh-call-webrtc.ts` (N-way mesh) is excluded too: it is self-declared PROTOTYPE, reachable only at `/prototype/mesh-call` and not wired into any thread. Both need their own disclosure if they ship.

Copy-only — no logic, so no tests. Typecheck + lint clean.

SPEC IMPACT: `DECISION_LOG.md` row appended (2026-07-26) recording the audit finding that the P2P/IP disclosure gap predates guest-pick and the whole class is now disclosed. **ROPA follow-up owed but NOT applied here** — `NPC_Compliance/02_Records_of_Processing_Activities*` is mid-adoption in another workstream; it needs an entry for the WebRTC signaling/relay processing (Cloudflare TURN as transit processor + the anonymous-session mint) once that workstream lands.
