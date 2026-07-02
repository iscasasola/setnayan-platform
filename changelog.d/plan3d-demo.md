## 2026-07-03 · feat(homepage): 3D Plan live demo — click a guest, phone walks to their seat

- 3D Plan dock tile's hero gains a "Find your seat · try it" button opening the
  new `plan3d-demo` overlay (`Plan3dDemoOverlay`): the Maria & Jose sample room
  rendered live in three.js inside the pop-up, every seated guest clickable.
- Clicking a guest mints a per-guest QR (fresh `demo_sessions` row per overlay
  open, 20-min TTL, `demo_kind='3d_plan'`); the QR's join URL carries the guest
  id (`?g=`), allowlisted against the fictional 30-guest roster in
  `plan3d-demo-scene.ts` — zero real data, zero privacy surface.
- Scanning opens `/3d_plan/demo/[token]`: "You're {name} tonight" → "Where am I
  seated?" → the shipped `GuestVenue3D` auto-walk plays entrance → their seat
  (reuses `lib/seating-3d` steering; no new 3D code). Expired/invalid tokens
  render the same kind dead-end as the Papic demo.
- `GuestVenue3D` gains additive optional props (`onSeatClick`, `heightClass`,
  `emptyHudText`) — zero behavior change for the existing guest venue page.
- New server actions `startPlan3dDemo` / `renderPlan3dGuestQr` on the shared
  demo-sessions scaffold; purge piggybacks via `after()` (cron-free).

SPEC IMPACT: None beyond `Demo_3DPlan_Build_Brief_2026-07-03.md` (already in the
corpus) — DECISION_LOG row appended for the shipped shape.
