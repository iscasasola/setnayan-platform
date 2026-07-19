## 2026-07-03 · feat(demo): Papic homepage demo PR-2 — capture · style-on-popup · cross-phone tagging · save

Completes the loop PR-1's scope notes deferred (owner spec, DECISION_LOG 2026-07-03 + the two
Papic amendments). On PR-1's strict peer-to-peer privacy design — frames + face vectors relay
ONLY over the session's ephemeral Realtime channel and are never persisted anywhere:

- `use-demo-channel.ts` — broadcast support (one typed `demo` event: face / face-request / photo /
  style / style-request) alongside presence; hook now returns `{ presence, send }`.
- `lib/demo-sessions.ts` + `demo-session-actions.ts` — `DEMO_SHOT_CAP = 3` and
  `recordDemoShot(token)`: token-gated, ATOMIC optimistic-concurrency increment (two phones racing
  the last slot can't both win). The server counts shots; it never sees a frame.
- `demo-join-flow.tsx` (phone) — after PR-1's consent + on-device registration, the descriptor is
  now KEPT (in-tab memory) and relayed to the peer; the rear-camera SHOOT step enforces the cap
  server-first, tags on-device (`face-match-core` distance vs both registered vectors), compresses
  under the relay budget, mirrors to all peers, and SAVES to the phone with the pop-up-set style
  baked in (canvas filter). Fail-soft everywhere: no model / no face / no peer → the demo still
  works, it just tags less.
- `papic-demo-overlay.tsx` (desktop) — the LIVE MIRROR (tagged frames as they land) + the style
  row from the shipped `PAPIC_STYLES` registry (Orig · Retro · Mono · Cine · Lomo). The style is
  session-level, set ON the pop-up (owner rule): switching restyles the mirror instantly, answers
  phones' style-requests, and drives their saves. Shot counter + honest "demo roll finished —
  the real Papic is unlimited" close.

Verified locally: typecheck clean · radius lint clean · overlay + graceful mint-failure path ·
join dead-end page. Full two-phone camera flow requires prod + two devices (no local
SUPABASE_SERVICE_ROLE_KEY exists on this machine — same constraint PR-1 shipped under); owner
test script in the PR body.

SPEC IMPACT: None new — implements the recorded Papic demo spec (DECISION_LOG 2026-07-03).
