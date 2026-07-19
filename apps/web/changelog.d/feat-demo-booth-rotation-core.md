## 2026-07-11 · feat(plan3d): demo-room vendor-rotation core (3D Booth Ads · slice 9 · Part B, PR 1/N)

First layer of "3D Booth Ads · Part B" (owner-locked 2026-07-08): the public
homepage "Maria & Jose" 3D demo's booths show REAL marketplace vendors on
ROTATION — "your booth, inside every demo". This PR is the network-free PURE core
(nothing imports it yet) → 100% unit-testable.

`lib/demo-booth-rotation.ts`:
- `rotationWeight(tier, adRank)` — ring copies = airtime weight: Enterprise 3 ·
  Pro/Custom 2 · Verified 1 · +1 for an ad/token boost.
- `rankVendors` — premium-first (weight → ad_rank → stable id).
- `buildRotationRing` — **stride scheduling** (weighted fair queueing): each
  vendor's copies spread EVENLY, not clustered, so its weight actually converts
  to airtime (a clustered run gets deduped away in a window).
- `selectDemoRotation(pool, slots, window)` — the vendors on-air in the demo's
  booths for a window: strided distinct picks across the ring. Premium recur
  more; everyone eligible cycles in over time; deterministic per window (same for
  every visitor in the hour). `rotationWindow(nowMs)` = the hourly window index.

10 unit tests — weight/rank, stride-spread, premium-gets-more-airtime,
no-permanent-lockout, deterministic, empty/zero guards. All green · guards clean.

Behind a SEPARATE `NEXT_PUBLIC_PLAN3D_DEMO_ADS` flag (off; documented in
.env.example) — the public homepage is more sensitive than Part A's private lab,
so demo ads flip independently. This PR wires nothing → inert.

SPEC IMPACT: None (implements the locked slice-9 Part B).
